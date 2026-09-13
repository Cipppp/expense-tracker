import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Dovada că un utilizator nu vede datele altuia.
 *
 * Filtrarea stă în extensia de Prisma tocmai pentru că o omisiune acolo nu dă
 * nici eroare, nici warning, și nu se vede la testat cu un singur cont — se
 * vede când al doilea om deschide pagina. Exact de-aia mecanismul are nevoie
 * de o probă, nu de o citire atentă: o singură scăpare în `db.ts` schimbă
 * liniștit aplicația dintr-una cu conturi în una cu date comune.
 *
 * Testul are nevoie de un Postgres adevărat — extensia lucrează pe interogări,
 * nu pe obiecte, deci un fals n-ar dovedi nimic. `TEST_DATABASE_URL` îl dă;
 * în CI e serviciul din workflow, local e containerul de dezvoltare.
 */
const url = process.env.TEST_DATABASE_URL;

const CUM_PORNESTI =
  "  docker run -d --name et-test -e POSTGRES_PASSWORD=local -p 55440:5432 postgres:16\n" +
  "  TEST_DATABASE_URL=postgresql://postgres:local@localhost:55440/postgres npm test";

/*
 * Local, lipsa unei baze e o neplăcere: primești instrucțiunile și mergi mai
 * departe. În CI e altceva — un test care se sare în tăcere arată exact ca
 * unul care trece, și atunci toată proba de mai jos nu apără nimic. Acolo,
 * absența bazei e o eroare de configurare, nu un motiv de clemență.
 */
if (!url) {
  if (process.env.CI) {
    throw new Error(
      "TEST_DATABASE_URL lipsește în CI. Testele de izolare între conturi ar fi " +
        "fost sărite, iar filtrarea pe utilizator ar fi rămas neverificată.",
    );
  }
  console.warn(
    `\n  ⚠️  TEST_DATABASE_URL nu e setat — testele de izolare NU au rulat.\n` +
      `     Filtrarea pe utilizator rămâne neverificată. Ca să ruleze:\n\n${CUM_PORNESTI}\n`,
  );
}

type Db = typeof import("@/lib/db").db;
type Tenant = typeof import("@/lib/tenant");

let db: Db;
let runAsUser: Tenant["runAsUser"];

const A = "test-tenant-a";
const B = "test-tenant-b";

/** O cheltuială validă; tot ce nu contează aici primește valori fixe. */
function expense(userId: string, description: string) {
  return {
    userId,
    date: new Date("2026-08-15T12:00:00Z"),
    description,
    amountRon: 10_000,
    amountUsd: 2_000,
    fxRate: 5,
    merchant: "test",
    dedupKey: `${userId}|${description}`,
  };
}

describe.skipIf(!url)("izolarea între utilizatori", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });

    ({ db } = await import("@/lib/db"));
    ({ runAsUser } = await import("@/lib/tenant"));

    // Un rulaj anterior oprit la mijloc n-are voie să strice următorul.
    await db.user.deleteMany({ where: { id: { in: [A, B] } } });
    for (const id of [A, B]) {
      await db.user.create({
        data: { id, email: `${id}@exemplu.test`, passwordHash: "", updatedAt: new Date() },
      });
    }

    await runAsUser(A, async () => {
      await db.expense.create({ data: expense(A, "a-unu") });
      await db.expense.create({ data: expense(A, "a-doi") });
      await db.job.create({ data: { userId: A, name: "Client comun", rateUsd: 50 } });
    });
    await runAsUser(B, async () => {
      await db.expense.create({ data: expense(B, "b-unu") });
    });
  }, 120_000);

  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { id: { in: [A, B] } } });
    await db.$disconnect();
  });

  describe("citirile", () => {
    it("findMany întoarce doar rândurile tale", async () => {
      const mine = await runAsUser(A, () => db.expense.findMany());
      expect(mine.map((e) => e.description).sort()).toEqual(["a-doi", "a-unu"]);
    });

    it("findFirst nu poate nimeri rândul altuia", async () => {
      const found = await runAsUser(A, () =>
        db.expense.findFirst({ where: { description: "b-unu" } }),
      );
      expect(found).toBeNull();
    });

    it("count numără doar ce e al tău", async () => {
      expect(await runAsUser(A, () => db.expense.count())).toBe(2);
      expect(await runAsUser(B, () => db.expense.count())).toBe(1);
    });

    it("aggregate se oprește la granița contului", async () => {
      const sum = await runAsUser(B, () =>
        db.expense.aggregate({ _sum: { amountRon: true } }),
      );
      expect(sum._sum.amountRon).toBe(10_000);
    });

    it("groupBy nu scapă rânduri străine în găleți", async () => {
      const rows = await runAsUser(B, () =>
        db.expense.groupBy({ by: ["category"], _count: { _all: true } }),
      );
      expect(rows.reduce((n, r) => n + r._count._all, 0)).toBe(1);
    });
  });

  /*
   * `findUnique` nu acceptă câmpuri în plus în `where` — cheia unică e cheie
   * unică, deci filtrul nu poate fi adăugat acolo. Proprietarul se verifică pe
   * rezultat, iar testele astea acoperă exact ramura aia.
   */
  describe("căutarea după id", () => {
    it("id-ul altuia întoarce null, nu rândul lui", async () => {
      const alLuiB = await runAsUser(B, () => db.expense.findFirstOrThrow());
      const vazutDeA = await runAsUser(A, () =>
        db.expense.findUnique({ where: { id: alLuiB.id } }),
      );
      expect(vazutDeA).toBeNull();
    });

    it("verificarea ține și când ceri doar anumite coloane", async () => {
      const alLuiB = await runAsUser(B, () => db.expense.findFirstOrThrow());
      const vazutDeA = await runAsUser(A, () =>
        db.expense.findUnique({
          where: { id: alLuiB.id },
          select: { description: true },
        }),
      );
      expect(vazutDeA).toBeNull();
    });

    it("findUniqueOrThrow crapă în loc să dea rândul altuia", async () => {
      const alLuiB = await runAsUser(B, () => db.expense.findFirstOrThrow());
      await expect(
        runAsUser(A, () => db.expense.findUniqueOrThrow({ where: { id: alLuiB.id } })),
      ).rejects.toThrow();
    });

    it("propriul id se găsește normal", async () => {
      const alMeu = await runAsUser(A, () => db.expense.findFirstOrThrow());
      const dinNou = await runAsUser(A, () =>
        db.expense.findUnique({ where: { id: alMeu.id } }),
      );
      expect(dinNou?.id).toBe(alMeu.id);
    });
  });

  describe("scrierile", () => {
    it("nu poți modifica rândul altuia după id", async () => {
      const alLuiB = await runAsUser(B, () => db.expense.findFirstOrThrow());
      await expect(
        runAsUser(A, () =>
          db.expense.update({
            where: { id: alLuiB.id },
            data: { description: "furat" },
          }),
        ),
      ).rejects.toThrow();

      const inca = await runAsUser(B, () =>
        db.expense.findUniqueOrThrow({ where: { id: alLuiB.id } }),
      );
      expect(inca.description).toBe("b-unu");
    });

    it("updateMany nu trece dincolo de contul tău", async () => {
      await runAsUser(A, () =>
        db.expense.updateMany({ data: { category: "Atins" } }),
      );
      const aleLuiB = await runAsUser(B, () => db.expense.findMany());
      expect(aleLuiB.every((e) => e.category !== "Atins")).toBe(true);
    });

    it("deleteMany nu șterge rândurile altuia", async () => {
      await runAsUser(A, () => db.expense.deleteMany({}));
      expect(await runAsUser(A, () => db.expense.count())).toBe(0);
      expect(await runAsUser(B, () => db.expense.count())).toBe(1);
    });
  });

  describe("fără niciun cont", () => {
    /*
     * Alternativa — interogarea să meargă nescopată — ar însemna ca un bug de
     * autentificare să întoarcă datele altcuiva în loc să dea eroare.
     */
    it("o citire în afara oricărui context crapă, nu întoarce tot", async () => {
      await expect(db.expense.findMany()).rejects.toThrow(/nicio sesiune/i);
    });

    it("și o numărătoare, la fel", async () => {
      await expect(db.expense.count()).rejects.toThrow(/nicio sesiune/i);
    });
  });

  /*
   * Interogările Prisma sunt leneșe: pornesc abia la `.then()`. Dacă
   * `runAsUser` dă funcția direct lui `store.run`, forma scurtă iese din
   * context înainte să apuce să ruleze — și interogarea pornește fără
   * proprietar. Merge doar varianta cu `async`, adică exact cea pe care n-o
   * scrii din reflex, iar compilatorul le acceptă pe amândouă.
   */
  describe("contextul ține și pentru interogările leneșe", () => {
    it("forma scurtă, care întoarce direct interogarea", async () => {
      const rows = await runAsUser(B, () => db.expense.findMany());
      expect(rows).toHaveLength(1);
    });

    it("forma cu await înăuntru", async () => {
      const rows = await runAsUser(B, async () => await db.expense.findMany());
      expect(rows).toHaveLength(1);
    });

    it("și pe mai multe niveluri de imbricare", async () => {
      const n = await runAsUser(B, () =>
        runAsUser(B, async () => db.expense.count()),
      );
      expect(n).toBe(1);
    });
  });

  describe("cheile unice sunt per cont", () => {
    /*
     * Înainte de conturi, numele unui client era unic pe toată instalarea. Doi
     * oameni cu același client ar fi însemnat că al doilea nu-l poate adăuga.
     */
    it("doi utilizatori pot avea un client cu același nume", async () => {
      await expect(
        runAsUser(B, () =>
          db.job.create({ data: { userId: B, name: "Client comun", rateUsd: 70 } }),
        ),
      ).resolves.toBeTruthy();
    });

    it("dar același nume de două ori în același cont, nu", async () => {
      await expect(
        runAsUser(B, () =>
          db.job.create({ data: { userId: B, name: "Client comun", rateUsd: 90 } }),
        ),
      ).rejects.toThrow();
    });
  });
});

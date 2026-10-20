import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Rutele prin care Mac-ul cu tokenul urca mesajele din SPV. Ruleaza pe un
 * Postgres adevarat (TEST_DATABASE_URL), ca testele de izolare: tokenul de
 * API alege contul, iar un cont nu vede si nu scrie mesajele altuia.
 */
const url = process.env.TEST_DATABASE_URL;

const A = "test-spv-a";
const B = "test-spv-b";
const msg = (id: string, tip = "RECIPISA") => ({
  id,
  cif: "10000001",
  tip,
  detalii: `recipisa pentru CIF 10000001, tip D112, perioada raportare 8.2026 (${id})`,
  data_creare: "24.09.2026 05:29:09",
  id_solicitare: null,
});

describe.skipIf(!url)("sincronizarea SPV", () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let runAsUser: typeof import("@/lib/tenant").runAsUser;
  let sync: typeof import("@/app/api/anaf/spv/sync/route").POST;
  let putPdf: typeof import("@/app/api/anaf/spv/pdf/route").PUT;

  const post = (token: string, body: unknown) =>
    sync(new Request("http://x/api/anaf/spv/sync", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }));
  const pdf = (token: string, anafId: string, bytes: string) =>
    putPdf(new Request(`http://x/api/anaf/spv/pdf?anafId=${anafId}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: bytes,
    }));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    ({ db } = await import("@/lib/db"));
    ({ runAsUser } = await import("@/lib/tenant"));
    ({ POST: sync } = await import("@/app/api/anaf/spv/sync/route"));
    ({ PUT: putPdf } = await import("@/app/api/anaf/spv/pdf/route"));

    await db.user.deleteMany({ where: { id: { in: [A, B] } } });
    for (const id of [A, B]) {
      await db.user.create({ data: { id, email: `${id}@exemplu.test`, passwordHash: "", updatedAt: new Date() } });
      await runAsUser(id, async () => {
        await db.settings.create({ data: { userId: id, timelogToken: `tok-${id}` } });
      });
    }
  }, 120_000);

  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { id: { in: [A, B] } } });
    await db.$disconnect();
  });

  it("fara token corect, 401", async () => {
    expect((await post("tok-nimeni", { mesaje: [] })).status).toBe(401);
    expect((await pdf("", "1", "%PDF-1.4")).status).toBe(401);
  });

  it("pastreaza mesajele noi o singura data si cere doar PDF-urile lipsa", async () => {
    const first = await (await post(`tok-${A}`, { mesaje: [msg("101"), msg("102")] })).json();
    expect(first.created).toBe(2);
    expect(first.needPdf.sort()).toEqual(["101", "102"]);

    expect((await pdf(`tok-${A}`, "101", "%PDF-1.4 test")).status).toBe(200);

    const again = await (await post(`tok-${A}`, { mesaje: [msg("101"), msg("102")] })).json();
    expect(again.created).toBe(0);
    expect(again.needPdf).toEqual(["102"]);
  });

  it("tine minte cand a sincronizat ultima data, chiar fara mesaje noi", async () => {
    const before = Date.now();
    await post(`tok-${A}`, { mesaje: [] });
    const s = await runAsUser(A, () => db.settings.findUnique({ where: { userId: A }, select: { spvSyncedAt: true } }));
    expect(s?.spvSyncedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("refuza ce nu e PDF, cum e eroarea JSON de la ANAF", async () => {
    const r = await pdf(`tok-${A}`, "102", '{"eroare":"Nu aveti dreptul"}');
    expect(r.status).toBe(400);
  });

  it("un cont nu vede si nu scrie mesajele altuia", async () => {
    expect((await pdf(`tok-${B}`, "102", "%PDF-1.4 strain")).status).toBe(404);
    const b = await (await post(`tok-${B}`, { mesaje: [msg("101")] })).json();
    expect(b.created).toBe(1);
    expect(b.needPdf).toEqual(["101"]);
    expect(await runAsUser(A, () => db.spvMessage.count())).toBe(2);
    expect(await runAsUser(B, () => db.spvMessage.count())).toBe(1);
  });
});

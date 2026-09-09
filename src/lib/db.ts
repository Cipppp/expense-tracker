import { PrismaClient } from "@prisma/client";
import { NoTenantError, tenantFromContext } from "@/lib/tenant";

/**
 * Clientul Prisma, cu filtrarea pe utilizator băgată în stratul de date.
 *
 * Alternativa era să scriem `where: { userId }` în fiecare din cele ~190 de
 * interogări din aplicație. O singură omisiune acolo nu dă eroare, nu dă
 * warning și nu se vede la testare cu un singur cont — se vede abia când al
 * doilea utilizator deschide pagina și găsește cheltuielile primului. Aici,
 * dacă uiți, nu se întâmplă nimic: filtrul e pus oricum.
 *
 * Scrierile rămân explicite. `userId` e obligatoriu în tipurile generate, deci
 * compilatorul cere la fiecare `create` să spună al cui e rândul — și e bine
 * să fie așa, pentru că acolo alegi, nu doar citești.
 *
 * Modelele-copil (InvoiceLine, EfacturaSubmission, GratitudeReaction) nu au
 * `userId`: se ajunge la ele doar prin părintele lor, care e deja filtrat.
 */
const SCOPED = new Set([
  "Expense", "Income", "Job", "Invoice", "Subscription", "TaxPayment",
  "CompanyPayout", "Holding", "SavingsAccount", "NetWorthSnapshot", "Settings",
  "Chore", "ChoreWeek", "GratitudeItem", "Supplement", "SupplementLog",
  "ImportBatch", "CategoryRule", "Passkey", "AnafToken",
]);

/** Operațiile care citesc sau ating rânduri existente — toate primesc filtrul. */
const FILTERED = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
  "update", "updateMany", "delete", "deleteMany", "count", "aggregate", "groupBy",
]);

async function requireUserId(): Promise<string> {
  const fromCtx = tenantFromContext();
  if (fromCtx) return fromCtx;
  // Import târziu: `next/headers` nu există în scripturi, iar un import de sus
  // ar face fișierul imposibil de folosit în afara unei cereri.
  try {
    const { currentUserId } = await import("@/lib/session");
    const id = await currentUserId();
    if (id) return id;
  } catch {
    /* în afara unei cereri — cade mai jos */
  }
  throw new NoTenantError();
}

function makeClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED.has(model)) return query(args);
          if (!FILTERED.has(operation)) return query(args);

          const userId = await requireUserId();
          const a = (args ?? {}) as Record<string, unknown>;

          /*
           * `findUnique` nu acceptă câmpuri în plus în `where` — cheia unică e
           * cheie unică. Așa că îl lăsăm să ruleze și verificăm proprietarul pe
           * rezultat: cine cere o factură după id și nu e a lui primește null,
           * nu factura altcuiva. Când apelantul cere doar anumite coloane,
           * adăugăm `userId` la ele, altfel n-am avea ce compara.
           */
          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const sel = a.select as Record<string, unknown> | undefined;
            const patched = sel ? { ...a, select: { ...sel, userId: true } } : a;
            const res = (await query(patched)) as { userId?: string } | null;
            if (res && res.userId !== undefined && res.userId !== userId) {
              if (operation === "findUniqueOrThrow") {
                throw new Error("Rândul cerut aparține altui utilizator.");
              }
              return null;
            }
            return res;
          }

          return query({ ...a, where: { ...(a.where as object), userId } });
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof makeClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
};

export const db: ExtendedClient = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

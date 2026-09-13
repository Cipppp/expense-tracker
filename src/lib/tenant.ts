import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Cine e utilizatorul curent, pentru stratul de date.
 *
 * În mod normal iese din sesiune, deci nu trebuie transmis prin nimic: fiecare
 * cerere are cookie-ul ei, iar extensia de Prisma îl citește singură. Dar
 * există și cod care rulează în afara unei cereri — cronurile, scripturile de
 * migrare, seed-ul — și acolo nu există sesiune. Pentru ele se intră explicit
 * într-un context cu `runAsUser`.
 *
 * Nu există „fără utilizator". Dacă nici sesiunea, nici contextul nu spun cine
 * e, interogarea crapă cu un mesaj limpede. Alternativa — să meargă nescopat —
 * ar însemna ca un bug de autentificare să întoarcă datele altcuiva.
 */
type Ctx = { userId: string };

const store = new AsyncLocalStorage<Ctx>();

/*
 * `await fn()`, nu `fn` direct — și contează.
 *
 * Interogările Prisma sunt leneșe: `db.expense.findMany()` nu pornește nimic,
 * întoarce un obiect care abia la `.then()` execută. Dat direct lui
 * `store.run`, un `() => db.expense.findMany()` iese din context înainte să
 * apuce să ruleze, iar interogarea pornește afară — fără proprietar.
 *
 * Cu `await` înăuntru, și crearea, și pornirea se întâmplă în context, deci
 * merge și forma scurtă, și cea cu `async`. Altfel apelul evident ar fi fost
 * tocmai cel greșit — și ar fi trecut de compilator fără o vorbă.
 */
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ userId }, async () => await fn());
}

/** Contextul explicit, dacă există. Nu atinge sesiunea. */
export function tenantFromContext(): string | null {
  return store.getStore()?.userId ?? null;
}

export class NoTenantError extends Error {
  constructor() {
    super(
      "Nicio sesiune și niciun context de utilizator. Interogarea a fost oprită ca să nu citească datele altcuiva.",
    );
    this.name = "NoTenantError";
  }
}

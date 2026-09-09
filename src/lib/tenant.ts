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

export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ userId }, fn);
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

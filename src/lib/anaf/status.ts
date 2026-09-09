import "server-only";
import { anafConfigured, anafEnv } from "./index";
import { buildForInvoice } from "./build";
import { tokenStatus } from "./oauth";
import { checkSubmission, reconcileStuck, viewOf, type SubmissionView } from "./send";
import {
  efacturaDeadline,
  efacturaScope,
  efacturaTracked,
  policyAllows,
  workingDaysUntil,
  type EfacturaScope,
} from "./scope";

/*
 * Tot ce arata panoul e-Factura despre o factura, intr-un singur obiect,
 * folosit si de pagina (server render, fara apel la ANAF) si de ruta de status
 * (cu un pas de urmarire daca e pe drum).
 */
export type EfacturaStatus = {
  env: "test" | "prod";
  configured: boolean;
  /** Exista tokenuri salvate (autorizare facuta). */
  connected: boolean;
  /** Tokenul cere iar certificatul. */
  needsReauth: boolean;
  scope: EfacturaScope;
  reason: string;
  extern: boolean;
  policy: string;
  willSendByPolicy: boolean;
  /** Termenul legal; null pentru facturile de dinaintea depunerii directe (depuse prin SmartBill/Oblio). */
  deadline: string | null;
  workingDaysLeft: number | null;
  blockers: string[];
  warnings: string[];
  category: string;
  /** Factura a fost deja depusa prin Oblio (istoric, inainte de legatura directa). */
  viaOblio: string | null;
  submission: SubmissionView | null;
};

export async function efacturaStatus(
  invoiceId: string,
  opts: { refresh?: boolean } = {},
): Promise<EfacturaStatus | null> {
  const built = await buildForInvoice(invoiceId);
  if (!built) return null;
  const { invoice, settings, doc } = built;
  const configured = anafConfigured();
  const tok = configured ? await tokenStatus(true) : null;

  const { scope, extern, reason } = efacturaScope(invoice);
  const deadline = scope === "required" && efacturaTracked(invoice.issuedAt) ? efacturaDeadline(invoice.issuedAt) : null;

  let submission: SubmissionView | null = null;
  if (invoice.efacturaCurrent) {
    const cur = invoice.efacturaCurrent;
    // Apelurile merg pe mediul RANDULUI (client.ts primeste env explicit),
    // deci un rand de prod se urmareste corect si cand ANAF_ENV e pe test.
    const canCall = Boolean(opts.refresh && configured && tok?.connected && !tok.needsReauth);
    if (canCall && cur.state === "uploading" && !cur.indexIncarcare) {
      submission = viewOf((await reconcileStuck(cur, settings.issuerCif)).sub);
    } else {
      const onTheWay =
        cur.state === "in_prelucrare" ||
        ((cur.state === "ok" || cur.state === "nok" || cur.state === "xml_nepreluat" || cur.state === "download_failed") &&
          !cur.zipS3Key &&
          !cur.zipInline);
      submission = viewOf(canCall && onTheWay ? await checkSubmission(cur) : cur);
    }
  }

  return {
    env: anafEnv(),
    configured,
    connected: tok?.connected ?? false,
    needsReauth: tok?.needsReauth ?? false,
    scope,
    reason,
    extern,
    policy: invoice.efacturaPolicy,
    willSendByPolicy: policyAllows(invoice.efacturaPolicy, scope),
    deadline: deadline?.toISOString() ?? null,
    workingDaysLeft: deadline ? workingDaysUntil(deadline) : null,
    blockers: doc.blockers,
    warnings: doc.warnings,
    category: doc.category,
    viaOblio: invoice.oblioNumber,
    submission,
  };
}

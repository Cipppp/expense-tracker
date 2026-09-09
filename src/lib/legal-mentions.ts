import type { VatKind } from "@/lib/vat";

/*
 * Mentiunile legale de TVA de pe factura, intr-un singur loc, in romana si
 * engleza. Le folosesc PDF-ul, previzualizarea, Oblio (campul "Mentiuni") si,
 * pe scurt, XML-ul e-Factura — ca toate documentele aceleiasi facturi sa
 * spuna acelasi lucru.
 *
 * Fara diacritice: fontul din PDF nu are glifele, iar Oblio si SPV le
 * accepta oricum asa.
 *
 *   eu_reverse  art. 196 Directiva 2006/112/CE, cu codul art. 317 al firmei
 *   export      art. 278 Cod fiscal (locul prestarii la beneficiar, non-UE)
 *   exempt_310  regimul special de scutire pentru intreprinderile mici
 *   domestic    TVA colectat — nu e nimic de mentionat
 */

export type LegalMention = { ro: string; en: string };

export function legalMentions(
  kind: VatKind,
  opts: { issuerVatIntra?: string | null } = {},
): LegalMention | null {
  const intra = (opts.issuerVatIntra ?? "").trim();
  switch (kind) {
    case "eu_reverse":
      return {
        ro:
          "Operatiune neimpozabila in Romania - taxare inversa. TVA se achita de beneficiar conform art. 196 din Directiva 2006/112/CE (servicii intracomunitare B2B)." +
          (intra ? ` Cod TVA intracomunitar furnizor: ${intra}.` : ""),
        en:
          "Transaction not subject to Romanian VAT - reverse charge. VAT to be accounted for by the recipient under Article 196 of Council Directive 2006/112/EC (intra-Community B2B services)." +
          (intra ? ` Supplier's intra-Community VAT number: ${intra}.` : ""),
      };
    case "export":
      return {
        ro: "Operatiune neimpozabila in Romania - servicii prestate catre un beneficiar din afara UE, locul prestarii fiind la beneficiar (art. 278 din Legea nr. 227/2015 privind Codul fiscal). TVA conform legislatiei din tara beneficiarului.",
        en: "Transaction not subject to Romanian VAT - services supplied to a customer established outside the EU; the place of supply is where the customer is established (Art. 278 of Romanian Law no. 227/2015 / Art. 44 of Council Directive 2006/112/EC). VAT, if any, is due under the customer's local rules.",
      };
    case "exempt_310":
      return {
        ro: "Neplatitor de TVA - scutit conform art. 310 din Legea nr. 227/2015 privind Codul fiscal (regim special de scutire pentru intreprinderile mici).",
        en: "Not registered for VAT - exempt under Art. 310 of Romanian Law no. 227/2015 (special exemption scheme for small enterprises).",
      };
    default:
      return null;
  }
}

/** Textul pentru campuri cu o singura valoare (Oblio): RO, apoi EN. */
export function legalMentionText(kind: VatKind, opts: { issuerVatIntra?: string | null } = {}): string | null {
  const m = legalMentions(kind, opts);
  return m ? `${m.ro}\n${m.en}` : null;
}

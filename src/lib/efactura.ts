import "server-only";
import { vatKindForInvoice, type VatKind } from "@/lib/vat";

/**
 * Romanian e-Factura (CIUS_RO 1.0.1, UBL 2.1 Invoice) generator.
 *
 * Produce XML-ul care se incarca la ANAF — direct, prin src/lib/anaf, sau de
 * mana in SPV. Regulile de mai jos sunt cele din Schematronul oficial
 * (ro16931-ubl-1.0.9) si din ghidul ANAF v2.9; unde o regula a costat o
 * respingere e citata cu codul ei.
 *
 *  - CustomizationID e OBLIGATORIU 1.0.1 (BR-RO-001); 1.0.0 a murit in 2022.
 *  - Neplatitor de TVA (art. 310) = categoria O, "Not subject to VAT", cu
 *    VATEX-EU-O si FARA cbc:Percent nicaieri (BR-O-05/06). Categoria E cu
 *    VATEX-EU-D, cum era inainte, inseamna mijloace de transport second-hand —
 *    o cu totul alta operatiune, declarata la ANAF cu semnatura ta.
 *  - Sub categoria O NICIUNA din parti nu are PartyTaxScheme cu schema VAT
 *    (BR-O-02, fatal). Identitatea vanzatorului merge in
 *    PartyLegalEntity/CompanyID (BT-30) si PartyIdentification/ID.
 *  - Pentru cumparatorul din Romania CountrySubentity e obligatoriu
 *    (BR-RO-111), iar Bucurestiul se scrie "SECTORn" + "RO-B" (BR-RO-101).
 *  - Un identificator de TVA fara prefix de tara (EIN american "12-3456789")
 *    sub schema VAT pica BR-CO-09. Merge in BT-47, unde nu e verificat.
 *  - Nume articol ≤100 (BR-RO-L100), strada ≤150, oras ≤50, denumiri ≤200.
 *
 * `buildEfacturaDocument` intoarce si lista de blocaje — lucruri care ar fi
 * respinse sigur — ca sa fie aratate INAINTE de a porni termenul de 5 zile.
 */

export type EfacturaInput = {
  issuer: {
    name: string;
    /** CIF-ul fiscal, doar cifre (51711091). Se pune in BT-30 si PartyIdentification. */
    cif: string;
    /**
     * Identificatorul de TVA pus sub PartyTaxScheme/VAT, cu prefix de tara —
     * RO51711091 cand firma e platitoare (S), RO55415170 (art. 317) pe
     * facturile intracomunitare (AE). Ignorat sub categoria O.
     */
    vatId?: string | null;
    /** false = scutit art. 310. */
    vatRegistered?: boolean;
    reg: string; // J2025030670009 → CompanyLegalForm (BT-33)
    address: string;
    /** ISO 3166-2:RO al sediului; dedus din adresa daca lipseste. */
    county?: string | null;
    iban: string;
    swift?: string; // BIC — FinancialInstitutionBranch (BT-86)
    postalZone?: string;
  };
  invoice: {
    series: string;
    number: string;
    issuedAtISO: string; // yyyy-mm-dd
    dueAtISO?: string | null;
    clientCompany: string;
    clientCui?: string | null; // CIF (RO) sau cod TVA/inregistrare (strain)
    clientReg?: string | null;
    clientAddress?: string | null;
    clientCountry?: string | null; // ISO2
    clientCounty?: string | null; // ISO 3166-2:RO, doar pentru RO
    clientPostalZone?: string;
    invoiceCurrency: string;
    bnrRate?: number | null;
    vatRate: number;
    lines: Array<{
      description: string;
      unit: string; // "buc" | "h"
      quantity: number;
      unitPrice: number; // invoiceCurrency
      amount: number; // invoiceCurrency
    }>;
  };
};

export type TaxCategoryId = "S" | "AE" | "O";

export type EfacturaDocument = {
  xml: string;
  /** true = clientul n-are identificator RO; se incarca cu &extern=DA. */
  extern: boolean;
  kind: VatKind;
  category: TaxCategoryId;
  /** Respingeri sigure. Nu se trimite cu lista nevida. */
  blockers: string[];
  /** De stiut, dar nu blocheaza. */
  warnings: string[];
};

/* ------------------------------------------------------------------ utils */

// Caracterele de control ilegale in XML 1.0 (un form feed copiat dintr-un
// PDF) ar face documentul rau format: ANAF ar intoarce o eroare de parsare
// in loc de un mesaj Schematron. Se scot inainte de entitati.
const esc = (s: string) =>
  s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
/*
 * Cantitatea se scria cu 2 zecimale in timp ce suma liniei pastra precizia
 * intreaga, deci pe factura cantitate x pret nu dadea totalul liniei (7,42 h
 * x 25 = 185,50, dar linia scria 185,52). EN16931 permite 4 zecimale.
 */
const qty = (n: number) => (Math.round(n * 10000) / 10000).toString();
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** Codurile ISO 3166-2:RO acceptate de validator pentru CountrySubentity. */
export const RO_COUNTIES = new Set([
  "RO-AB", "RO-AR", "RO-AG", "RO-BC", "RO-BH", "RO-BN", "RO-BT", "RO-BV", "RO-BR", "RO-B",
  "RO-BZ", "RO-CS", "RO-CL", "RO-CJ", "RO-CT", "RO-CV", "RO-DB", "RO-DJ", "RO-GL", "RO-GR",
  "RO-GJ", "RO-HR", "RO-HD", "RO-IL", "RO-IS", "RO-IF", "RO-MM", "RO-MH", "RO-MS", "RO-NT",
  "RO-OT", "RO-PH", "RO-SM", "RO-SJ", "RO-SB", "RO-SV", "RO-TR", "RO-TM", "RO-TL", "RO-VS",
  "RO-VL", "RO-VN",
]);

/*
 * Localitate + judet pentru o adresa din Romania.
 *
 * "Sector N" e un indiciu sigur de Bucuresti si e si singurul format acceptat
 * pentru oras acolo (BR-RO-101: "SECTOR1".."SECTOR6"). In restul tarii orasul
 * e ultimul segment al adresei, iar judetul trebuie sa vina explicit — nu-l
 * ghicim: un client din Cluj declarat in judetul gresit e o factura respinsa
 * sau, mai rau, acceptata cu date false.
 */
function roLocality(
  address: string,
  county: string | null | undefined,
  who: string,
): { city: string; subentity: string; problems: string[] } {
  const problems: string[] = [];
  const sector = address.match(/sector(?:ul)?\s*(\d)/i);
  const c = (county ?? "").trim().toUpperCase();
  if (c && !RO_COUNTIES.has(c)) {
    problems.push(`${who}: county "${c}" is not an ISO 3166-2:RO code (e.g. RO-B, RO-CJ)`);
  }
  if (sector) {
    if (c && c !== "RO-B") problems.push(`${who}: address says Sector ${sector[1]} but county is ${c}`);
    return { city: `SECTOR${sector[1]}`, subentity: "RO-B", problems };
  }
  const isBuc = c === "RO-B" || /bucure[sș]ti/i.test(address);
  if (isBuc) {
    problems.push(`${who}: Bucharest address must contain "Sector N" (ANAF wants SECTOR1–6 as the city)`);
    return { city: "BUCURESTI", subentity: "RO-B", problems };
  }
  const parts = address.split(",").map((x) => x.trim()).filter(Boolean);
  const city = parts.length > 1 ? parts[parts.length - 1] : address;
  if (!c) problems.push(`${who}: missing county (ISO 3166-2:RO) — required by ANAF for Romanian addresses`);
  return { city, subentity: RO_COUNTIES.has(c) ? c : "", problems };
}

/*
 * Orasul pentru o adresa straina, in lipsa unui camp dedicat.
 *
 * "Strada, Oras" → Oras. "Strada, Oras, Tara" → Oras. In adresele americane
 * segmentul dinaintea tarii e "CA 94104" (stat + cod postal), deci daca arata
 * a cod, se ia segmentul dinaintea lui. BT-52 nu e validat de ANAF, dar e
 * citit de client pe factura.
 */
function cityFromAddress(address: string): string {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return address;
  if (parts.length === 2) return parts[1];
  // Mergem inapoi de la segmentul dinaintea tarii si sarim peste ce arata a
  // stat + cod postal ("CA 94104") sau a cod postal ("1100-053").
  const looksLikeCode = (s: string) => /^[A-Z]{2}\s+\d[\dA-Z-]{2,}$/.test(s) || /\d{4,}/.test(s);
  for (let i = parts.length - 2; i >= 1; i--) {
    if (!looksLikeCode(parts[i])) return parts[i];
  }
  return parts[parts.length - 2];
}

// UN/ECE unit code: hours → HUR, otherwise "piece" → C62.
function unitCode(unit: string): string {
  return unit.trim().toLowerCase() === "h" ? "HUR" : "C62";
}

/** Identificator de TVA valid pentru schema VAT: prefix ISO2 + alfanumerice. */
const VAT_ID_RE = /^[A-Z]{2}[A-Z0-9]{2,}$/;
const normId = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toUpperCase();
const stripRo = (s: string) => s.replace(/^RO/i, "");

/* ------------------------------------------------------------------ party */

type Party = {
  name: string;
  address: string;
  country: string; // ISO2
  postalZone?: string;
  county?: string | null;
  /** Sub PartyTaxScheme/VAT — doar daca `allowVatScheme` si e in format valid. */
  vatId?: string | null;
  /** PartyLegalEntity/CompanyID (BT-30 vanzator / BT-47 cumparator). */
  legalId?: string | null;
  /** PartyLegalEntity/CompanyLegalForm (BT-33). */
  legalForm?: string | null;
  /** PartyIdentification/ID (BT-29 / BT-46). */
  identification?: string | null;
};

function partyXml(
  tag: "AccountingSupplierParty" | "AccountingCustomerParty",
  p: Party,
  allowVatScheme: boolean,
  problems: string[],
): string {
  const who = tag === "AccountingSupplierParty" ? "Issuer" : "Client";
  const isRo = p.country === "RO";
  const loc = isRo
    ? roLocality(p.address, p.county, who)
    : { city: cityFromAddress(p.address), subentity: "", problems: [] as string[] };
  problems.push(...loc.problems);
  if (!p.address.trim()) problems.push(`${who}: address is empty`);
  if (!p.name.trim()) problems.push(`${who}: name is empty`);

  const vat = normId(p.vatId);
  const emitVat = allowVatScheme && vat.length > 0;
  if (emitVat && !VAT_ID_RE.test(vat)) {
    problems.push(
      `${who}: VAT id "${vat}" has no ISO country prefix — ANAF rejects it under the VAT scheme (BR-CO-09)`,
    );
  }
  const postal = (p.postalZone ?? "").trim();

  return `  <cac:${tag}>
    <cac:Party>${
      p.identification
        ? `\n      <cac:PartyIdentification>
        <cbc:ID>${esc(p.identification)}</cbc:ID>
      </cac:PartyIdentification>`
        : ""
    }
      <cac:PostalAddress>
        <cbc:StreetName>${esc(cap(p.address, 150))}</cbc:StreetName>
        <cbc:CityName>${esc(cap(loc.city, 50))}</cbc:CityName>${
          postal ? `\n        <cbc:PostalZone>${esc(postal)}</cbc:PostalZone>` : ""
        }${
          isRo && loc.subentity
            ? `\n        <cbc:CountrySubentity>${loc.subentity}</cbc:CountrySubentity>`
            : ""
        }
        <cac:Country>
          <cbc:IdentificationCode>${esc(p.country)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${
        emitVat
          ? `\n      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(vat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(cap(p.name, 200))}</cbc:RegistrationName>${
          p.legalId ? `\n        <cbc:CompanyID>${esc(p.legalId)}</cbc:CompanyID>` : ""
        }${
          p.legalForm ? `\n        <cbc:CompanyLegalForm>${esc(p.legalForm)}</cbc:CompanyLegalForm>` : ""
        }
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:${tag}>`;
}

/* --------------------------------------------------------------- document */

export function buildEfacturaDocument(input: EfacturaInput): EfacturaDocument {
  const { issuer, invoice: inv } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  const country = (inv.clientCountry ?? "RO").trim().toUpperCase() || "RO";
  const rate = inv.bnrRate ?? 1;
  const vatRegistered = issuer.vatRegistered ?? true;
  const kind = vatKindForInvoice(country, inv.vatRate, vatRegistered);

  // Presentation/document currency mirrors the PDF: RON for RO clients, the
  // contract currency otherwise.
  const docCur = country === "RO" ? "RON" : inv.invoiceCurrency;
  const factor = docCur === inv.invoiceCurrency ? 1 : rate;
  const foreign = docCur !== "RON";
  if (docCur !== inv.invoiceCurrency && !(inv.bnrRate && inv.bnrRate > 0)) {
    blockers.push("Romanian client billed in a foreign currency but the invoice has no BNR rate");
  }

  /*
   * Categoria de TVA, dupa tratament:
   *   S  — platitor, cota standard (facturile istorice cu 21%)
   *   AE — taxare inversa intracomunitara (art. 196 Directiva 2006/112)
   *   O  — neimpozabil: neplatitor art. 310 (client RO) sau servicii cu locul
   *        prestarii in afara UE (art. 278). Ambele fara Percent, cu VATEX-EU-O.
   */
  type Cat = { id: TaxCategoryId; percent: number | null; reasonCode: string; reason: string };
  const cat: Cat =
    kind === "domestic"
      ? { id: "S", percent: Math.round(inv.vatRate * 10000) / 100, reasonCode: "", reason: "" }
      : kind === "eu_reverse"
        ? {
            id: "AE",
            percent: 0,
            reasonCode: "VATEX-EU-AE",
            reason: "Reverse charge - art. 196 Directive 2006/112/EC",
          }
        : kind === "export"
          ? {
              id: "O",
              percent: null,
              reasonCode: "VATEX-EU-O",
              reason: "Not subject to VAT - services supplied outside the EU (art. 278 Cod fiscal)",
            }
          : kind === "exempt_310"
            ? {
                id: "O",
                percent: null,
                reasonCode: "VATEX-EU-O",
                reason: "Not subject to VAT - art. 310 Legea 227/2015 (regim special de scutire)",
              }
            : // "none": 0% intern la un emitent marcat platitor. Fara temei legal —
              // blocat mai jos; textul ramane neutru ca sa nu afirme art. 310.
              { id: "O", percent: null, reasonCode: "VATEX-EU-O", reason: "Not subject to VAT" };
  if (kind === "domestic" && !vatRegistered) {
    warnings.push("VAT charged while the issuer is not VAT-registered — fine for invoices issued before 03.08.2026, wrong after");
  }
  if (kind === "none") {
    blockers.push(
      "Domestic invoice at 0% while the issuer is marked VAT-registered — either charge VAT or mark the issuer as art. 310 exempt in Settings",
    );
  }
  const allowVatScheme = cat.id !== "O";

  // Identificatorul de TVA al vanzatorului (BT-31), doar sub S / AE.
  const issuerCifDigits = stripRo(normId(issuer.cif));
  let issuerVat: string | null = null;
  if (cat.id === "S") issuerVat = normId(issuer.vatId) || `RO${issuerCifDigits}`;
  if (cat.id === "AE") {
    issuerVat = normId(issuer.vatId);
    if (!issuerVat) blockers.push("Intra-community invoice without the art. 317 VAT code (Settings → issuerVatIntra)");
  }

  // Cumparatorul: unde ii punem identificatorul depinde de categorie.
  const clientId = normId(inv.clientCui);
  let clientVat: string | null = null;
  let clientLegalId: string | null = null;
  if (country === "RO") {
    clientLegalId = clientId ? stripRo(clientId) : null;
    if (cat.id === "S" && /^RO\d+$/.test(clientId)) clientVat = clientId;
    // ANAF identifica cumparatorul dupa CUI ("ERRIdentif: CUI cumparator
    // incorect" pe un CUI inexistent); fara el factura nu are unde ajunge.
    if (!clientLegalId || !/^\d{2,10}$/.test(clientLegalId)) {
      blockers.push(`Romanian client needs a valid CUI (got "${clientId || "nothing"}") — ANAF routes the invoice by it`);
    }
  } else if (cat.id === "AE") {
    if (VAT_ID_RE.test(clientId)) clientVat = clientId;
    else blockers.push(`EU client needs a VAT number with country prefix for reverse charge (got "${clientId || "nothing"}")`);
    clientLegalId = normId(inv.clientReg) || null;
  } else {
    // O (export): niciun PartyTaxScheme; identificatorul, oricare ar fi, in BT-47.
    clientLegalId = clientId || normId(inv.clientReg) || null;
  }

  /*
   * TVA-ul se rotunjeste PE LINIE si apoi se aduna — aceeasi regula ca in
   * PDF. Rotunjit pe total, doua linii de 10,03 x 21% dadeau 4,21 in XML si
   * 4,22 pe PDF: ambele trec BR-CO-17 (toleranta ±0,01), dar clientul ar fi
   * primit doua sume de plata pentru aceeasi factura.
   */
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const lines = inv.lines.map((l) => {
    const net = round2(l.amount * factor);
    return {
      ...l,
      docUnitPrice: round2(l.unitPrice * factor),
      docNet: net,
      docVat: cat.id === "S" ? round2(net * inv.vatRate) : 0,
    };
  });
  if (!lines.length) blockers.push("Invoice has no lines");
  const net = round2(lines.reduce((a, l) => a + l.docNet, 0));
  const vat = round2(lines.reduce((a, l) => a + l.docVat, 0));
  const gross = round2(net + vat);
  const ronVat = foreign ? Math.round(vat * rate * 100) / 100 : vat;

  const percentLine = (indent: string) =>
    cat.percent != null ? `\n${indent}<cbc:Percent>${cat.percent.toFixed(2)}</cbc:Percent>` : "";

  const taxCategoryXml = (indent: string) =>
    `${indent}<cac:TaxCategory>
${indent}  <cbc:ID>${cat.id}</cbc:ID>${percentLine(`${indent}  `)}${
      cat.reasonCode
        ? `\n${indent}  <cbc:TaxExemptionReasonCode>${cat.reasonCode}</cbc:TaxExemptionReasonCode>\n${indent}  <cbc:TaxExemptionReason>${esc(cap(cat.reason, 100))}</cbc:TaxExemptionReason>`
        : ""
    }
${indent}  <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
${indent}</cac:TaxCategory>`;

  // TaxTotal in moneda documentului (cu subtotal). Cand documentul nu e in
  // RON, al doilea TaxTotal poarta TVA-ul in RON (BR-53 / BR-RO-030).
  const taxTotalDoc = `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${docCur}">${money(vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${docCur}">${money(net)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${docCur}">${money(vat)}</cbc:TaxAmount>
${taxCategoryXml("      ")}
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;
  const taxTotalRon = foreign
    ? `\n  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">${money(ronVat)}</cbc:TaxAmount>
  </cac:TaxTotal>`
    : "";

  const linesXml = lines
    .map((l, i) => {
      const desc = l.description.trim();
      const name = cap(desc, 100);
      const overflow = desc.length > 100 ? cap(desc, 200) : "";
      return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode(l.unit)}">${qty(l.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${docCur}">${money(l.docNet)}</cbc:LineExtensionAmount>
    <cac:Item>${overflow ? `\n      <cbc:Description>${esc(overflow)}</cbc:Description>` : ""}
      <cbc:Name>${esc(name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${cat.id}</cbc:ID>${cat.percent != null ? `\n        <cbc:Percent>${cat.percent.toFixed(2)}</cbc:Percent>` : ""}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${docCur}">${money(l.docUnitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("\n");

  const partyProblems: string[] = [];
  const supplier = partyXml(
    "AccountingSupplierParty",
    {
      name: issuer.name,
      address: issuer.address,
      country: "RO",
      postalZone: issuer.postalZone,
      county: issuer.county ?? null,
      vatId: issuerVat,
      legalId: issuerCifDigits,
      legalForm: issuer.reg || null,
      identification: issuerCifDigits,
    },
    allowVatScheme,
    partyProblems,
  );
  const customer = partyXml(
    "AccountingCustomerParty",
    {
      name: inv.clientCompany,
      address: inv.clientAddress ?? "",
      country,
      postalZone: inv.clientPostalZone,
      county: inv.clientCounty ?? null,
      vatId: clientVat,
      legalId: clientLegalId,
    },
    allowVatScheme,
    partyProblems,
  );
  blockers.push(...partyProblems);

  const note =
    kind === "exempt_310"
      ? `\n  <cbc:Note>${esc(
          "Neplatitor de TVA - regim special de scutire pentru intreprinderile mici, art. 310 Legea nr. 227/2015",
        )}</cbc:Note>`
      : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>${esc(inv.series + inv.number)}</cbc:ID>
  <cbc:IssueDate>${inv.issuedAtISO}</cbc:IssueDate>${
    /* BT-9. Fara scadenta, factura pleca la SPV fara NICIUN termen de plata —
       nici DueDate, nici PaymentTerms — asa ca se emite nota de mai jos. */
    inv.dueAtISO ? `\n  <cbc:DueDate>${inv.dueAtISO}</cbc:DueDate>` : ""
  }
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${note}
  <cbc:DocumentCurrencyCode>${docCur}</cbc:DocumentCurrencyCode>${
    foreign ? `\n  <cbc:TaxCurrencyCode>RON</cbc:TaxCurrencyCode>` : ""
  }
${supplier}
${customer}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(issuer.iban)}</cbc:ID>${
        issuer.swift?.trim()
          ? `\n      <cac:FinancialInstitutionBranch>
        <cbc:ID>${esc(issuer.swift.trim())}</cbc:ID>
      </cac:FinancialInstitutionBranch>`
          : ""
      }
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>${
    inv.dueAtISO
      ? ""
      : `\n  <cac:PaymentTerms>
    <cbc:Note>Plata la primirea facturii / Payment due on receipt</cbc:Note>
  </cac:PaymentTerms>`
  }
${taxTotalDoc}${taxTotalRon}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${docCur}">${money(net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${docCur}">${money(net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${docCur}">${money(gross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${docCur}">${money(gross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>
`;

  // extern=DA: cumparator fara niciun identificator romanesc.
  const extern = country !== "RO" && !/^RO\d+$/.test(clientId);

  return { xml, extern, kind, category: cat.id, blockers: dedupe(blockers), warnings: dedupe(warnings) };
}

/** Compat: doar XML-ul. */
export function buildEfacturaXml(input: EfacturaInput): string {
  return buildEfacturaDocument(input).xml;
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

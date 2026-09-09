/*
 * Fixture-uri e-Factura pentru cele trei forme de client (RO / non-UE / UE),
 * scrise in /tmp/efx si, optional, trecute prin validatorul public ANAF
 * (fara token, fara efecte):
 *
 *   node --import tsx --conditions=react-server scripts/efactura-fixtures.ts
 *   for f in /tmp/efx/*.xml; do curl -s -X POST -H 'Content-Type: text/plain' \
 *     --data-binary "@$f" https://webservicesp.anaf.ro/prod/FCTEL/rest/validare/FACT1; echo; done
 *
 * `--conditions=react-server` face ca `server-only` sa se rezolve la varianta
 * goala, ca in RSC.
 */
import { writeFileSync } from "node:fs";
import { buildEfacturaDocument } from "../src/lib/efactura";

const issuer = {
  name: "PROJECT CIP S.R.L.",
  cif: "51711091",
  vatRegistered: false,
  reg: "J2025030670009",
  address: "Bld Dacia, Nr.133, Et.d, Sector 2, Jud. Bucuresti",
  county: "RO-B",
  iban: "RO95INGB0000999918378858",
  swift: "INGBROBU",
};
const lines = [
  { description: "IT consulting services - August 2026", unit: "h", quantity: 8, unitPrice: 100, amount: 800 },
];

const cases: Record<string, Record<string, unknown>> = {
  ro_cluj: {
    clientCompany: "FUSECON S.R.L.", clientCui: "RO38855898", clientReg: "J12/1234/2018",
    clientAddress: "Str Memorandumului 5, Cluj-Napoca", clientCountry: "RO", clientCounty: "RO-CJ",
    invoiceCurrency: "RON", vatRate: 0,
  },
  ro_bucuresti: {
    clientCompany: "TEST BUC S.R.L.", clientCui: "12345678",
    clientAddress: "Str Lipscani 10, Sector 3", clientCountry: "RO", clientCounty: "RO-B",
    invoiceCurrency: "RON", vatRate: 0,
  },
  ro_missing_county: {
    clientCompany: "X S.R.L.", clientCui: "12345678", clientAddress: "Str Lunga 1, Brasov",
    clientCountry: "RO", invoiceCurrency: "RON", vatRate: 0,
  },
  us_blng: {
    clientCompany: "BLNG Inc.", clientCui: "12-3456789",
    clientAddress: "548 Market St, San Francisco, CA 94104, United States", clientCountry: "US",
    invoiceCurrency: "USD", bnrRate: 4.5335, vatRate: 0,
  },
  pt_aethra: {
    clientCompany: "AETHRA, S.A.", clientCui: "PT514422793",
    clientAddress: "Av. da Liberdade 110, Lisboa, Portugal", clientCountry: "PT",
    invoiceCurrency: "EUR", bnrRate: 5.2586, vatRate: 0,
  },
};

for (const [k, c] of Object.entries(cases)) {
  const doc = buildEfacturaDocument({
    issuer: { ...issuer, vatId: k.startsWith("pt") ? "RO55415170" : null },
    invoice: {
      series: "CP", number: "9999", issuedAtISO: "2026-09-01", dueAtISO: "2026-09-06", lines,
      ...(c as object),
    } as Parameters<typeof buildEfacturaDocument>[0]["invoice"],
  });
  writeFileSync(`/tmp/efx/${k}.xml`, doc.xml);
  console.log(`\n### ${k}: category=${doc.category} kind=${doc.kind} extern=${doc.extern}`);
  if (doc.blockers.length) console.log("  BLOCKERS:", doc.blockers);
  if (doc.warnings.length) console.log("  warnings:", doc.warnings);
  console.log(
    `  Percent=${/<cbc:Percent>/.test(doc.xml)}  PartyTaxScheme=${/<cac:PartyTaxScheme>/.test(doc.xml)}  TaxCurrencyCode=${/TaxCurrencyCode/.test(doc.xml)}  CountrySubentity=${(doc.xml.match(/<cbc:CountrySubentity>([^<]+)/g) ?? []).join(",")}`,
  );
}

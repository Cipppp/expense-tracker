import { describe, expect, it } from "vitest";
import type { IngRow } from "@/lib/ing-csv";
import {
  ownerMatcher,
  parseIngExpenses,
  parseIngPayouts,
  parseIngTaxPayments,
} from "@/lib/tax-import";

/*
 * Aici se decide ce număr vezi pe dashboard ca „taxe de plătit”. Nimic din
 * codul ăsta nu crapă când greșește: o plată clasificată aiurea sau o lună
 * calculată greșit iese ca o cifră perfect plauzibilă.
 *
 * Testele de mai jos sunt, aproape toate, cazuri care chiar au apărut în
 * extrasele reale — de-aia arată atât de specific.
 */

type IngPatch = Omit<Partial<IngRow>, "date" | "amount"> & {
  amount: number;
  date: string;
};

function ing(o: IngPatch): IngRow {
  return {
    account: "RO39INGB0000999900000001",
    date: new Date(`${o.date}T12:00:00Z`),
    amount: o.amount,
    currency: o.currency ?? "RON",
    type: o.type ?? "Transfer ING Business",
    counterparty: o.counterparty ?? "Bugetul de stat/51711091",
    counterpartyIban: o.counterpartyIban ?? "",
    counterpartyBank: o.counterpartyBank ?? "",
    details: o.details ?? "",
  };
}

describe("ownerMatcher", () => {
  it("găsește asociatul în numele contrapartidei", () => {
    const is = ownerMatcher("Popescu Ion");
    expect(is("POPESCU ION")).toBe(true);
  });

  it("trece peste diacritice: „Pârvu” din extras = „Parvu” din setări", () => {
    expect(ownerMatcher("Parvu")("PÂRVU ANDREI")).toBe(true);
    expect(ownerMatcher("Pârvu")("PARVU ANDREI")).toBe(true);
  });

  it("acceptă mai multe nume, despărțite prin virgulă", () => {
    const is = ownerMatcher("Popescu, Ionescu");
    expect(is("IONESCU MARIA")).toBe(true);
    expect(is("Altcineva SRL")).toBe(false);
  });

  /*
   * Cazul care contează: fără nume configurate, varianta „prinde tot” ar face
   * din fiecare plată un dividend și ar inventa impozit. Mai bine niciunul.
   */
  it("fără nume configurate nu potrivește nimic", () => {
    const is = ownerMatcher("");
    expect(is("Popescu Ion")).toBe(false);
    expect(is("")).toBe(false);
  });

  it("ignoră fragmentele prea scurte ca să fie un nume", () => {
    expect(ownerMatcher("ab")("Fabrica de ceva")).toBe(false);
  });
});

describe("parseIngTaxPayments — ce fel de taxă e", () => {
  /*
   * Bug-ul de la care a pornit regula: contrapartida e mereu „Bugetul de
   * stat”, care se potrivește cu tiparul pentru BS+BAS. Citind de acolo, o
   * penalitate de întârziere ajungea să treacă drept contribuții plătite — și
   * dispărea din ce mai ai de plătit.
   */
  it("citește felul taxei din etichetă, nu din contrapartidă", () => {
    const [p] = parseIngTaxPayments([
      ing({
        date: "2026-08-20",
        amount: -50,
        counterparty: "Bugetul de stat/51711091",
        details: "Penalitati intarziere",
      }),
    ]);
    expect(p.kind).toBe("alte");
  });

  it("recunoaște contribuțiile salariale", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-08-20", amount: -1561, details: "BS + BASS iulie" }),
    ]);
    expect(p.kind).toBe("bs_bas");
  });

  it.each([
    ["Impozit dividende august", "dividende"],
    ["Impozit venit microintreprinderi", "venit"],
    ["Impozit micro trim III", "micro"],
    ["CAM iulie", "cam"],
    ["TVA august", "tva"],
  ])("„%s” → %s", (label, kind) => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-09-20", amount: -100, details: label }),
    ]);
    expect(p.kind).toBe(kind);
  });

  it("cade pe contrapartidă doar când nu există descriere", () => {
    const [p] = parseIngTaxPayments([
      ing({
        date: "2026-08-20",
        amount: -100,
        counterparty: "Bugetul de stat",
        details: "",
      }),
    ]);
    expect(p.kind).toBe("bs_bas");
  });
});

describe("parseIngTaxPayments — ce lună acoperă", () => {
  it("ia luna din etichetă când e scrisă acolo", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-08-20", amount: -1561, details: "BS + BASS iunie" }),
    ]);
    expect(p.forPeriod).toBe("2026-06");
  });

  it("o lună de după plată aparține anului trecut", () => {
    // „decembrie”, plătit în ianuarie.
    const [p] = parseIngTaxPayments([
      ing({ date: "2027-01-20", amount: -1561, details: "BS + BASS decembrie" }),
    ]);
    expect(p.forPeriod).toBe("2026-12");
  });

  it("fără lună în etichetă, plata acoperă luna dinainte", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-08-20", amount: -1561, details: "BS + BASS" }),
    ]);
    expect(p.forPeriod).toBe("2026-07");
  });

  /*
   * Scăderea unei luni trebuie făcută pe an/lună, nu mutând data. Pe 31 martie,
   * „luna minus unu” pe obiectul Date dă 31 februarie, pe care JS îl împinge
   * înapoi în martie — și luna acoperită ieșea exact cea din care plecaseși.
   */
  it("pe 31 ale lunii nu sare peste februarie", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-03-31", amount: -1561, details: "BS + BASS" }),
    ]);
    expect(p.forPeriod).toBe("2026-02");
  });

  it("în ianuarie, luna dinainte e decembrie anul trecut", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-01-25", amount: -1561, details: "BS + BASS" }),
    ]);
    expect(p.forPeriod).toBe("2025-12");
  });

  /*
   * Taxele unice nu acoperă nicio perioadă: rămân în luna în care le-ai plătit.
   */
  it("taxa de timbru rămâne în luna plății", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-08-06", amount: -200, details: "Taxa de timbru" }),
    ]);
    expect(p.forPeriod).toBe("2026-08");
  });
});

describe("parseIngTaxPayments — restituirile", () => {
  /*
   * Cazul real: taxă de timbru de 200 lei plătită pe 6 august, întoarsă pe 10.
   * Numărată, luna arăta cu 200 de lei mai multe taxe decât a costat.
   */
  const debit = ing({
    date: "2026-08-06",
    amount: -200,
    counterparty: "MINISTRY OF FINANCE/51711091",
    details: "Taxa de timbru",
  });

  it("o plată întoarsă nu se numără", () => {
    const credit = ing({
      date: "2026-08-10",
      amount: 200,
      counterparty: "MINISTRY OF FINANCE",
      details: "Restituire",
    });
    expect(parseIngTaxPayments([debit, credit])).toHaveLength(0);
  });

  it("banii se pot întoarce de la același nume scris altfel", () => {
    // Plata pleacă spre „…/51711091”, restituirea vine de la numele scurt.
    const credit = ing({
      date: "2026-08-10",
      amount: 200,
      counterparty: "MINISTRY OF FINANCE",
    });
    expect(parseIngTaxPayments([debit, credit])).toHaveLength(0);
  });

  it("o încasare de la altcineva nu anulează plata", () => {
    const credit = ing({
      date: "2026-08-10",
      amount: 200,
      counterparty: "Client SRL",
      counterpartyBank: "Bugetul de stat",
    });
    expect(parseIngTaxPayments([debit, credit])).toHaveLength(1);
  });

  it("o încasare de altă sumă nu anulează plata", () => {
    const credit = ing({
      date: "2026-08-10",
      amount: 150,
      counterparty: "MINISTRY OF FINANCE",
    });
    expect(parseIngTaxPayments([debit, credit])).toHaveLength(1);
  });

  it("după 45 de zile nu mai e o restituire", () => {
    const credit = ing({
      date: "2026-10-01",
      amount: 200,
      counterparty: "MINISTRY OF FINANCE",
    });
    expect(parseIngTaxPayments([debit, credit])).toHaveLength(1);
  });

  it("o încasare dinainte de plată nu o anulează", () => {
    const credit = ing({
      date: "2026-08-01",
      amount: 200,
      counterparty: "MINISTRY OF FINANCE",
    });
    expect(parseIngTaxPayments([debit, credit])).toHaveLength(1);
  });

  it("o singură restituire anulează o singură plată", () => {
    const alDoilea = { ...debit, date: new Date("2026-08-07T12:00:00Z") };
    const credit = ing({
      date: "2026-08-10",
      amount: 200,
      counterparty: "MINISTRY OF FINANCE",
    });
    expect(parseIngTaxPayments([debit, alDoilea, credit])).toHaveLength(1);
  });
});

describe("parseIngTaxPayments — ce intră și ce nu", () => {
  it("ignoră încasările", () => {
    expect(
      parseIngTaxPayments([ing({ date: "2026-08-20", amount: 1000 })]),
    ).toHaveLength(0);
  });

  it("ignoră plățile în altă monedă — taxele se plătesc în lei", () => {
    expect(
      parseIngTaxPayments([
        ing({ date: "2026-08-20", amount: -100, currency: "EUR" }),
      ]),
    ).toHaveLength(0);
  });

  it("ignoră plățile care nu merg la stat", () => {
    expect(
      parseIngTaxPayments([
        ing({ date: "2026-08-20", amount: -100, counterparty: "Anthropic PBC" }),
      ]),
    ).toHaveLength(0);
  });

  it("recunoaște statul și după bancă sau IBAN, nu doar după nume", () => {
    const out = parseIngTaxPayments([
      ing({
        date: "2026-08-20",
        amount: -100,
        counterparty: "Necunoscut",
        counterpartyBank: "Trezoreria Sector 1",
      }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("convertește în bani, nu în lei", () => {
    const [p] = parseIngTaxPayments([
      ing({ date: "2026-08-20", amount: -1561.37, details: "BS + BASS" }),
    ]);
    expect(p.amountRon).toBe(156137);
  });
});

describe("parseIngTaxPayments — chei de deduplicare", () => {
  /*
   * Reimportul aceluiași extras nu trebuie să dubleze nimic, dar două viramente
   * identice în aceeași zi chiar sunt două plăți.
   */
  it("două plăți identice în aceeași zi primesc chei diferite", () => {
    const r = ing({ date: "2026-08-20", amount: -100, details: "CAM iulie" });
    const out = parseIngTaxPayments([r, { ...r }]);
    expect(out).toHaveLength(2);
    expect(out[0].dedupKey).not.toBe(out[1].dedupKey);
    expect(out[1].dedupKey).toMatch(/#2$/);
  });

  it("același extras importat de două ori dă aceleași chei", () => {
    const rows = [
      ing({ date: "2026-08-20", amount: -100, details: "CAM iulie" }),
      ing({ date: "2026-08-20", amount: -100, details: "CAM iulie" }),
      ing({ date: "2026-08-21", amount: -50, details: "TVA iulie" }),
    ];
    expect(parseIngTaxPayments(rows).map((p) => p.dedupKey)).toEqual(
      parseIngTaxPayments(rows).map((p) => p.dedupKey),
    );
  });
});

describe("parseIngPayouts", () => {
  const isOwner = ownerMatcher("Popescu Ion");
  const catreAsociat = (o: IngPatch) =>
    ing({ counterparty: "POPESCU ION", ...o });

  it("eticheta explicită decide", () => {
    const [p] = parseIngPayouts(
      [catreAsociat({ date: "2026-08-15", amount: -5000, details: "Dividende" })],
      isOwner,
    );
    expect(p.kind).toBe("dividende");
    expect(p.presumed).toBe(false);
  });

  it("salariul nu e dividend", () => {
    const [p] = parseIngPayouts(
      [catreAsociat({ date: "2026-08-15", amount: -3000, details: "Salariu iulie" })],
      isOwner,
    );
    expect(p.kind).toBe("salariu");
  });

  /*
   * ING scrie „No details” când nu completezi descrierea, iar parserul îl
   * golește. În practică viramentele astea au fost dividende — dar se marchează
   * ca presupuse, ca să se vadă în interfață ce s-a dedus.
   */
  it("un transfer fără etichetă e dividend presupus", () => {
    const [p] = parseIngPayouts(
      [catreAsociat({ date: "2026-08-15", amount: -5000, details: "" })],
      isOwner,
    );
    expect(p.kind).toBe("dividende");
    expect(p.presumed).toBe(true);
  });

  it.each(["Imprumut asociat", "Restituire creditare", "Avans deplasare"])(
    "„%s” nu e dividend",
    (details) => {
      const [p] = parseIngPayouts(
        [catreAsociat({ date: "2026-08-15", amount: -2000, details })],
        isOwner,
      );
      expect(p.kind).toBe("alte");
      expect(p.presumed).toBe(false);
    },
  );

  it("nu numără plățile către altcineva", () => {
    expect(
      parseIngPayouts(
        [ing({ date: "2026-08-15", amount: -5000, counterparty: "Anthropic PBC" })],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it("nu numără taxele drept plăți către asociat", () => {
    expect(
      parseIngPayouts(
        [
          catreAsociat({
            date: "2026-08-15",
            amount: -1000,
            counterpartyBank: "Bugetul de stat",
          }),
        ],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it("schimbul valutar nu e o plată către asociat", () => {
    expect(
      parseIngPayouts(
        [
          catreAsociat({
            date: "2026-08-15",
            amount: -5000,
            type: "Schimb valutar ING Business",
          }),
        ],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it("luna acoperită e chiar luna în care au ieșit banii", () => {
    const [p] = parseIngPayouts(
      [catreAsociat({ date: "2026-08-15", amount: -5000, details: "Dividende" })],
      isOwner,
    );
    expect(p.forPeriod).toBe("2026-08");
  });
});

describe("parseIngExpenses", () => {
  const isOwner = ownerMatcher("Popescu Ion");

  it("o plată obișnuită de firmă e cheltuială", () => {
    const [e] = parseIngExpenses(
      [
        ing({
          date: "2026-08-15",
          amount: -120.5,
          currency: "USD",
          counterparty: "ANTHROPIC PBC",
          details: "Claude Max",
        }),
      ],
      isOwner,
    );
    expect(e.description).toBe("Claude Max");
    expect(e.amount).toBeCloseTo(120.5, 2);
    expect(e.currency).toBe("USD");
  });

  it("taxele nu se numără a doua oară ca și cheltuieli", () => {
    expect(
      parseIngExpenses(
        [ing({ date: "2026-08-20", amount: -1561, details: "BS + BASS" })],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it("banii către asociat nu sunt cheltuială", () => {
    expect(
      parseIngExpenses(
        [ing({ date: "2026-08-15", amount: -5000, counterparty: "POPESCU ION" })],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it("mutarea între conturile proprii nu e cheltuială", () => {
    expect(
      parseIngExpenses(
        [
          ing({
            date: "2026-08-15",
            amount: -5000,
            counterparty: "PROJECT CIP SRL",
          }),
        ],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it.each(["Schimb valutar ING Business", "Acoperire sold negativ"])(
    "„%s” e același ban mutat, nu o cheltuială",
    (type) => {
      expect(
        parseIngExpenses(
          [ing({ date: "2026-08-15", amount: -5000, type, counterparty: "ING Bank" })],
          isOwner,
        ),
      ).toHaveLength(0);
    },
  );

  it("încasările nu sunt cheltuieli", () => {
    expect(
      parseIngExpenses(
        [ing({ date: "2026-08-15", amount: 5000, counterparty: "Client SRL" })],
        isOwner,
      ),
    ).toHaveLength(0);
  });

  it("cheia de deduplicare ține cont de monedă", () => {
    const [usd] = parseIngExpenses(
      [ing({ date: "2026-08-15", amount: -100, currency: "USD", counterparty: "X SRL" })],
      isOwner,
    );
    const [eur] = parseIngExpenses(
      [ing({ date: "2026-08-15", amount: -100, currency: "EUR", counterparty: "X SRL" })],
      isOwner,
    );
    expect(usd.dedupKey).not.toBe(eur.dedupKey);
  });

  it("fără descriere, rămâne numele contrapartidei", () => {
    const [e] = parseIngExpenses(
      [ing({ date: "2026-08-15", amount: -100, counterparty: "AWS EMEA", details: "" })],
      isOwner,
    );
    expect(e.description).toBe("AWS EMEA");
  });
});

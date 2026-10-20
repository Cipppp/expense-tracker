import { describe, expect, it } from "vitest";
import { describeSpv, isCnp, maskCnp, parseAnafDay } from "@/lib/spv";

/*
 * Un mesaj citit gresit nu crapa nimic: o notificare cu termen apare ca
 * informativa, sau o recipisa apare pe perioada gresita, si afli de la ANAF.
 * Textele de mai jos sunt luate din mesaje reale (cu CIF-uri inventate).
 */

const day = (s: string) => parseAnafDay(s)!;
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("parseAnafDay", () => {
  it("pastreaza ziua, nu ora pe 12 ore fara AM/PM", () => {
    expect(iso(parseAnafDay("24.08.2026 02:54:22"))).toBe("2026-08-24");
    expect(parseAnafDay("24.08.2026 02:54:22")!.getUTCHours()).toBe(12);
  });

  it.each(["", "2026-08-24", "31.02.2026 10:00:00", "ieri"])("respinge %j", (s) => {
    expect(parseAnafDay(s)).toBeNull();
  });
});

describe("describeSpv", () => {
  const received = day("02.10.2026 11:31:14");

  it("recipisa spune declaratia si perioada", () => {
    const r = describeSpv(
      "RECIPISA",
      "recipisa pentru CIF 10000001, tip D112, numar_inregistrare INTERNT-1/24-09-2026, perioada raportare 8.2026",
      received,
    );
    expect(r).toEqual({ title: "Recipisă D112 · 08/2026", tone: "ok", deadline: null });
  });

  it("recunoaste si formularele Z, ca cererea de certificat de rezidenta", () => {
    const r = describeSpv("RECIPISA", "recipisa pentru CIF 10000001, tip Z01, perioada raportare 12.2026", received);
    expect(r.title).toBe("Recipisă Z01 · 12/2026");
  });

  it("nedepunerea e de rau si are 15 zile", () => {
    const r = describeSpv(
      "NOTIFICARE",
      "Notificari pentru nedepunerea in termen a declaratiilor pentru CIF 10000001, prelucrata la 05-10-2026",
      received,
    );
    expect(r.tone).toBe("danger");
    expect(iso(r.deadline)).toBe("2026-10-17");
  });

  it("declaratia cu erori cere rectificativa in 15 zile", () => {
    const r = describeSpv(
      "NOTIFICARE",
      "Notificare privind depunerea eronata a declaratiilor pentru CIF 10000001, prelucrata la 03-09-2026",
      received,
    );
    expect(r.tone).toBe("warn");
    expect(iso(r.deadline)).toBe("2026-10-17");
  });

  it("riscul de inactivare da 30 de zile", () => {
    const r = describeSpv(
      "NOTIFICARE",
      "Notificare privind indeplinirea conditiilor pentru declararea ca inactiv",
      received,
    );
    expect(r.tone).toBe("danger");
    expect(iso(r.deadline)).toBe("2026-11-01");
  });

  it("deciziile de inactivare si de anulare a TVA sunt de rau", () => {
    expect(describeSpv("Decizie inactivare", "Decizie inactivare", received).tone).toBe("danger");
    expect(
      describeSpv(
        "Decizie privind anularea din oficiu a inregistrarii in scopuri de TVA",
        "Decizie privind anularea din oficiu a inregistrarii in scopuri de TVA",
        received,
      ).tone,
    ).toBe("danger");
  });

  it("raspunsul la o solicitare spune ce ai cerut", () => {
    const r = describeSpv("RASPUNS SOLICITARE", "duplicat VECTOR FISCAL pentru CUI 10000001", received);
    expect(r).toEqual({ title: "Răspuns: VECTOR FISCAL", tone: "info", deadline: null });
  });

  it("decontul precompletat e informativ", () => {
    expect(describeSpv("P300 ETVA", "P300", received).tone).toBe("info");
  });

  it("un tip necunoscut nu dispare, apare ca informativ", () => {
    expect(describeSpv("CEVA NOU", "x", received)).toEqual({ title: "CEVA NOU", tone: "info", deadline: null });
  });
});

describe("CNP", () => {
  it("se recunoaste dupa 13 cifre si nu se afiseaza intreg", () => {
    expect(isCnp("1900101000001")).toBe(true);
    expect(isCnp("10000001")).toBe(false);
    expect(maskCnp("1900101000001")).toBe("1••••••••0001");
  });
});

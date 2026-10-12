import { describe, expect, it } from "vitest";
import {
  THEME_IDS,
  THEMES,
  contrast,
  hexToHsl,
  isThemeId,
  themeCss,
  themeVars,
  type Hsl,
  type ThemeId,
} from "@/lib/theme";

/*
 * O tema gresita nu crapa nimic: arata frumos in captura si e ilizibila pe
 * telefon, in soare. Testele de aici verifica exact ce nu se vede dintr-o
 * privire: contrastul textului, pentru fiecare tema si pentru culori de
 * accent alese intentionat prost.
 */

const parse = (v: string): Hsl => {
  const [h, s, l] = v.replace(/%/g, "").split(/\s+/).map(Number);
  return [h, s, l];
};

/** Valorile din globals.css, pentru tema de baza, care nu scrie nimic. */
const CLASSIC = {
  light: { background: "240 14% 97%", card: "0 0% 100%" },
  dark: { background: "240 8% 8%", card: "240 8% 11%" },
};

function colors(id: ThemeId, mode: "light" | "dark", accent = "") {
  const v = themeVars({ preset: id, accent })[mode];
  const base = id === "classic" ? CLASSIC[mode] : {};
  const get = (k: string, fallback?: string) => parse(v[k] ?? fallback ?? "0 0% 0%");
  return {
    background: get("--background", (base as { background?: string }).background),
    card: get("--card", (base as { card?: string }).card),
    accent: get("--accent"),
    accentText: get("--accent-text"),
    accentForeground: get("--accent-foreground"),
    action: get("--action"),
    actionForeground: get("--action-foreground"),
    mutedForeground: get("--muted-foreground"),
  };
}

describe("hexToHsl", () => {
  it.each([
    ["#ffffff", [0, 0, 100]],
    ["#000000", [0, 0, 0]],
    ["#fff", [0, 0, 100]],
    ["#ff0000", [0, 100, 50]],
  ])("%s", (hex, hsl) => {
    expect(hexToHsl(hex)).toEqual(hsl);
  });

  it("recunoaste accentul de azi al aplicatiei", () => {
    const [h, s, l] = hexToHsl("#f24b1a")!;
    expect(h).toBeCloseTo(14, 0);
    expect(s).toBeCloseTo(89, 0);
    expect(l).toBeCloseTo(53, 0);
  });

  it.each(["", "red", "#12345", "#gggggg", "rgb(0,0,0)"])("respinge %j", (bad) => {
    expect(hexToHsl(bad)).toBeNull();
  });
});

describe("tema de baza", () => {
  /*
   * Promisiunea de la care pleaca totul: cine nu alege nimic vede aplicatia
   * exact ca inainte. Classic nu suprascrie nicio variabila.
   */
  it("fara accent ales, nu scrie absolut nimic peste globals.css", () => {
    expect(themeCss({ preset: "classic", accent: "" })).toBe("");
  });

  it("cu accent ales, schimba doar accentul", () => {
    const { light, dark } = themeVars({ preset: "classic", accent: "#e11d74" });
    const keys = ["--accent", "--accent-foreground", "--accent-text"];
    expect(Object.keys(light).sort()).toEqual(keys);
    expect(Object.keys(dark).sort()).toEqual(keys);
  });
});

describe("fiecare tema", () => {
  const themed = THEME_IDS.filter((id) => id !== "classic");

  it.each(themed)("%s are aceleasi variabile in light si in dark", (id) => {
    const { light, dark } = themeVars({ preset: id, accent: "" });
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it.each(themed)("%s pune dark dupa light in CSS", (id) => {
    const css = themeCss({ preset: id, accent: "" });
    expect(css.indexOf(":root{")).toBe(0);
    expect(css.indexOf(".dark{")).toBeGreaterThan(0);
  });

  it.each(themed)("%s are o scara de 8 categorii", (id) => {
    const { light, dark } = themeVars({ preset: id, accent: "" });
    for (const vars of [light, dark]) {
      expect(Object.keys(vars).filter((k) => k.startsWith("--cat-"))).toHaveLength(8);
    }
  });
});

describe("contrast, pe fiecare tema si mod", () => {
  const cases = THEME_IDS.filter((id) => id !== "classic").flatMap((id) =>
    (["light", "dark"] as const).map((mode) => [id, mode] as const),
  );

  it.each(cases)("%s / %s: textul de accent se citeste pe fundal si pe carduri", (id, mode) => {
    const c = colors(id, mode);
    expect(contrast(c.accentText, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentText, c.card)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases)("%s / %s: textul de pe butoane se citeste", (id, mode) => {
    const c = colors(id, mode);
    expect(contrast(c.actionForeground, c.action)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases)("%s / %s: textul secundar se citeste", (id, mode) => {
    const c = colors(id, mode);
    expect(contrast(c.mutedForeground, c.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases)("%s / %s: bifele si insignele pe accent se vad", (id, mode) => {
    const c = colors(id, mode);
    expect(contrast(c.accentForeground, c.accent)).toBeGreaterThanOrEqual(3);
  });
});

describe("accentul ales liber", () => {
  /*
   * Culori alese dinadins greu: galben si alb nu se citesc ca text pe alb,
   * negru si bleumarin nu se citesc pe fundal intunecat. Fiecare trebuie
   * adusa la un text lizibil, pe orice tema.
   */
  const hard = ["#ffeb3b", "#ffffff", "#000000", "#00ffff", "#1e3a8a", "#777777", "#f24b1a"];
  const cases = THEME_IDS.flatMap((id) =>
    hard.flatMap((hex) => (["light", "dark"] as const).map((mode) => [id, hex, mode] as const)),
  );

  it.each(cases)("%s + %s / %s ramane lizibil", (id, hex, mode) => {
    const c = colors(id, mode, hex);
    expect(contrast(c.accentText, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentText, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentForeground, c.accent)).toBeGreaterThanOrEqual(3);
  });

  it("un accent invalid e ignorat, nu stricat", () => {
    expect(themeCss({ preset: "rose", accent: "nu-e-culoare" })).toBe(
      themeCss({ preset: "rose", accent: "" }),
    );
  });

  it("pastreaza culoarea aleasa pe butoane si bife in light", () => {
    const c = colors("classic", "light", "#e11d74");
    expect(c.accent).toEqual(hexToHsl("#e11d74"));
  });
});

describe("isThemeId", () => {
  it("accepta doar temele cunoscute", () => {
    for (const id of THEME_IDS) expect(isThemeId(id)).toBe(true);
    expect(isThemeId("neon")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });

  it("fiecare tema are un nume de afisat", () => {
    for (const id of THEME_IDS) expect(THEMES[id].name.length).toBeGreaterThan(0);
  });
});

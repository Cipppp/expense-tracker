/**
 * Temele contului: ce culori are aplicatia pentru cine e logat.
 *
 * Tot sistemul vizual sta in variabile CSS (`--accent`, `--background`,
 * `--cat-1`…), declarate in globals.css. O tema nu face decat sa le
 * suprascrie, cu un <style> pus dupa foaia de stil, deci nicio componenta nu
 * trebuie sa stie ca exista teme.
 *
 * Ce schimba o tema: accentul (elementul activ din meniu, selectia de text,
 * insignele), butoanele si linkurile, nuanta fundalului si scara de culori a
 * categoriilor din grafic. Ce NU schimba: culorile seriilor (castigat,
 * cheltuit, disponibil) si paleta categoriala a investitiilor. Alea poarta
 * sens, iar un „cheltuit" care isi schimba culoarea de la un cont la altul
 * te obliga sa reinveti graficul.
 *
 * Fisierul e pur, fara `server-only`: acelasi cod genereaza CSS-ul pe server
 * si previzualizarea din pagina de setari.
 */

/** [nuanta 0–360, saturatie %, luminozitate %], formatul din globals.css. */
export type Hsl = readonly [h: number, s: number, l: number];

export const THEME_IDS = ["classic", "rose", "lavender", "ocean", "forest", "graphite"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

type Mode = "light" | "dark";

type ModeColors = {
  /** Accentul, folosit si ca fundal plin (insigne, bife). */
  accent: Hsl;
  /** Accentul ca text pe fundal deschis, deci mai inchis decat `accent`. */
  accentText: Hsl;
  /** Butoane, linkuri, inelul de focus. */
  action: Hsl;
};

type ThemeSpec = {
  id: ThemeId;
  name: string;
  /** Nuanta si saturatia gri-urilor din fundal. */
  tint: readonly [h: number, s: number];
  light: ModeColors;
  dark: ModeColors;
  /** Scara categoriilor, de la cea mai vie la cea mai adanca. */
  ramp: Record<Mode, readonly [from: Hsl, to: Hsl]>;
  /**
   * Adevarat doar pentru tema originala: valorile ei sunt deja in
   * globals.css, deci nu scriem nimic peste ele. Asa „Classic" e garantat
   * identica cu aplicatia dinainte de teme.
   */
  incumbent?: true;
};

export const THEMES: Record<ThemeId, ThemeSpec> = {
  classic: {
    id: "classic",
    name: "Classic",
    tint: [240, 14],
    light: { accent: [14, 89, 53], accentText: [15, 85, 41], action: [210, 100, 45] },
    dark: { accent: [14, 92, 58], accentText: [14, 92, 68], action: [210, 100, 62] },
    ramp: {
      light: [[40, 92, 48], [350, 32, 25]],
      dark: [[40, 96, 74], [350, 30, 29]],
    },
    incumbent: true,
  },
  rose: {
    id: "rose",
    name: "Rose",
    tint: [340, 32],
    light: { accent: [338, 78, 54], accentText: [336, 74, 40], action: [334, 72, 42] },
    dark: { accent: [338, 86, 64], accentText: [338, 90, 76], action: [336, 88, 72] },
    ramp: {
      light: [[345, 90, 70], [325, 48, 26]],
      dark: [[345, 95, 80], [325, 45, 32]],
    },
  },
  lavender: {
    id: "lavender",
    name: "Lavender",
    tint: [260, 30],
    light: { accent: [262, 72, 58], accentText: [262, 58, 45], action: [258, 60, 50] },
    dark: { accent: [262, 84, 70], accentText: [262, 90, 80], action: [258, 90, 78] },
    ramp: {
      light: [[250, 88, 74], [272, 44, 28]],
      dark: [[250, 95, 82], [272, 42, 34]],
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    tint: [205, 30],
    light: { accent: [190, 88, 40], accentText: [194, 86, 29], action: [214, 88, 44] },
    dark: { accent: [188, 84, 52], accentText: [188, 80, 64], action: [212, 96, 68] },
    ramp: {
      light: [[186, 78, 56], [224, 60, 26]],
      dark: [[186, 82, 66], [224, 55, 34]],
    },
  },
  forest: {
    id: "forest",
    name: "Forest",
    tint: [140, 18],
    light: { accent: [150, 58, 36], accentText: [152, 64, 26], action: [158, 66, 28] },
    dark: { accent: [150, 56, 50], accentText: [150, 60, 62], action: [152, 60, 58] },
    ramp: {
      light: [[110, 45, 52], [170, 50, 22]],
      dark: [[110, 50, 64], [170, 45, 30]],
    },
  },
  graphite: {
    id: "graphite",
    name: "Graphite",
    tint: [222, 12],
    light: { accent: [222, 14, 30], accentText: [222, 16, 30], action: [222, 18, 26] },
    dark: { accent: [222, 16, 76], accentText: [222, 20, 80], action: [222, 22, 82] },
    ramp: {
      light: [[214, 36, 72], [226, 30, 22]],
      dark: [[214, 40, 80], [226, 26, 32]],
    },
  },
};

/** Culorile de accent propuse langa selectorul liber. */
export const ACCENT_SWATCHES = [
  { hex: "#f24b1a", name: "Signal orange" },
  { hex: "#e11d74", name: "Raspberry" },
  { hex: "#c026d3", name: "Magenta" },
  { hex: "#7c3aed", name: "Violet" },
  { hex: "#4f46e5", name: "Indigo" },
  { hex: "#0284c7", name: "Sky" },
  { hex: "#0d9488", name: "Teal" },
  { hex: "#16a34a", name: "Green" },
  { hex: "#d97706", name: "Amber" },
] as const;

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

// ── culoare ──────────────────────────────────────────────────────────────────

const INK: Hsl = [240, 8, 8];
const WHITE: Hsl = [0, 0, 100];

function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** `#rrggbb` (sau `#rgb`) → HSL. Intoarce null pentru orice altceva. */
export function hexToHsl(hex: string): Hsl | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function luminance(c: Hsl): number {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hslToRgb(c).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrastul WCAG dintre doua culori, intre 1 si 21. */
export function contrast(a: Hsl, b: Hsl): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Alb sau aproape-negru, oricare se citeste mai bine pe fundalul dat. */
function readableOn(bg: Hsl): Hsl {
  return contrast(WHITE, bg) >= contrast(INK, bg) ? WHITE : INK;
}

// ── gri-urile temei ──────────────────────────────────────────────────────────

type Neutrals = {
  background: Hsl;
  card: Hsl;
  secondary: Hsl;
  border: Hsl;
  mutedForeground: Hsl;
};

function neutrals([h, s]: readonly [number, number], mode: Mode): Neutrals {
  if (mode === "light") {
    return {
      background: [h, s, 97],
      card: WHITE,
      secondary: [h, Math.max(s - 6, 8), 95],
      border: [h, Math.max(s - 12, 8), 91],
      mutedForeground: [h, 6, 43],
    };
  }
  return {
    background: [h, 10, 8],
    card: [h, 10, 11],
    secondary: [h, 9, 16],
    border: [h, 9, 20],
    mutedForeground: [h, 8, 66],
  };
}

function ramp([from, to]: readonly [Hsl, Hsl], steps = 8): Hsl[] {
  // Nuanta pe drumul cel mai scurt din cerc: 40 → 350 trece prin 0, nu prin 180.
  let dh = to[0] - from[0];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [
      Math.round((((from[0] + dh * t) % 360) + 360) % 360),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ] as Hsl;
  });
}

// ── accentul ales liber ──────────────────────────────────────────────────────

/**
 * Accentul ales de utilizator, adus la cerintele temei.
 *
 * Omul alege o culoare, nu o pereche de valori testate. Daca alege galben,
 * galbenul ca text pe alb nu se citeste, asa ca varianta de text se
 * intuneca pana trece de 4,6:1 fata de fundal si fata de carduri. In dark se
 * lumineaza, din acelasi motiv. Culoarea de pe butoane si bife se pastreaza
 * cum a ales-o, iar textul de pe ea devine alb sau negru, dupa care se
 * citeste mai bine.
 */
function customAccent(base: Hsl, n: Neutrals, mode: Mode) {
  const [h, s, l] = base;
  const accent: Hsl = mode === "light" ? base : [h, s, Math.min(Math.max(l + 8, 55), 72)];
  const passes = (c: Hsl) => contrast(c, n.background) >= 4.6 && contrast(c, n.card) >= 4.6;
  let text: Hsl = [h, Math.min(s, 85), mode === "light" ? Math.min(l, 50) : Math.max(l, 60)];
  while (!passes(text) && text[2] > 5 && text[2] < 95) {
    text = [h, text[1], text[2] + (mode === "light" ? -1 : 1)];
  }
  return { accent, accentText: text, accentForeground: readableOn(accent) };
}

// ── CSS ──────────────────────────────────────────────────────────────────────

export type ThemeChoice = { preset: ThemeId; accent: string };

const fmt = ([h, s, l]: Hsl) => `${h} ${s}% ${l}%`;

/**
 * Variabilele CSS ale unei teme, pe moduri. Aceleasi chei in light si dark,
 * altfel o valoare setata doar pentru light ar ramane agatata si in dark.
 */
export function themeVars(choice: ThemeChoice): Record<Mode, Record<string, string>> {
  const spec = THEMES[choice.preset] ?? THEMES.classic;
  const custom = hexToHsl(choice.accent);
  const out = { light: {} as Record<string, string>, dark: {} as Record<string, string> };

  for (const mode of ["light", "dark"] as const) {
    const n = neutrals(spec.tint, mode);
    const vars = out[mode];

    if (!spec.incumbent) {
      const c = spec[mode];
      Object.assign(vars, {
        "--background": fmt(n.background),
        "--card": fmt(n.card),
        "--popover": fmt(n.card),
        "--secondary": fmt(n.secondary),
        "--muted": fmt(n.secondary),
        "--border": fmt(n.border),
        "--input": fmt(n.border),
        "--muted-foreground": fmt(n.mutedForeground),
        "--accent": fmt(c.accent),
        "--accent-foreground": fmt(readableOn(c.accent)),
        "--accent-text": fmt(c.accentText),
        "--action": fmt(c.action),
        "--action-foreground": fmt(readableOn(c.action)),
        "--ring": fmt(c.action),
      });
      ramp(spec.ramp[mode]).forEach((col, i) => {
        vars[`--cat-${i + 1}`] = fmt(col);
      });
    }

    if (custom) {
      const a = customAccent(custom, n, mode);
      vars["--accent"] = fmt(a.accent);
      vars["--accent-text"] = fmt(a.accentText);
      vars["--accent-foreground"] = fmt(a.accentForeground);
    }
  }
  return out;
}

/** Blocul CSS de pus dupa globals.css. Gol cand tema e cea de baza, neatinsa. */
export function themeCss(choice: ThemeChoice): string {
  const { light, dark } = themeVars(choice);
  const block = (sel: string, vars: Record<string, string>) =>
    Object.keys(vars).length === 0
      ? ""
      : `${sel}{${Object.entries(vars)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")}}`;
  // `.dark` dupa `:root`: in dark se potrivesc amandoua, cu aceeasi
  // specificitate, deci castiga ultima.
  return block(":root", light) + block(".dark", dark);
}

/** Culorile de afisat intr-o miniatura a temei, pentru modul dat. */
export function themePreview(id: ThemeId, mode: Mode) {
  const spec = THEMES[id];
  const n = neutrals(spec.tint, mode);
  // Classic foloseste valorile exacte din globals.css pentru fundal.
  const background: Hsl = spec.incumbent
    ? mode === "light"
      ? [240, 14, 97]
      : [240, 8, 8]
    : n.background;
  const card: Hsl = spec.incumbent ? (mode === "light" ? WHITE : [240, 8, 11]) : n.card;
  const hsl = (c: Hsl) => `hsl(${fmt(c)})`;
  return {
    background: hsl(background),
    card: hsl(card),
    border: hsl(n.border),
    accent: hsl(spec[mode].accent),
    accentSoft: `hsl(${fmt(spec[mode].accent)} / ${mode === "light" ? 0.12 : 0.18})`,
    action: hsl(spec[mode].action),
    actionForeground: hsl(readableOn(spec[mode].action)),
    ramp: ramp(spec.ramp[mode], 5).map(hsl),
  };
}

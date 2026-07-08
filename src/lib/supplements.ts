/**
 * Static supplement catalog for the household tracker. Composition and dosing
 * verified against manufacturer pages and NIH ODS / EFSA guidance (web
 * research run 2026-07); timing follows absorption evidence plus stack-level
 * de-conflicting (iron away from the mineral-heavy breakfast, zinc mid-
 * afternoon between iron and magnesium, sedatives spaced in the evening).
 * Logs live in the SupplementLog table keyed by (day, person, key).
 * Pure module — imported by both server and client.
 */

export type TimingKey = "morning" | "noon" | "evening" | "preworkout";

export type Supplement = {
  key: string;
  name: string;
  brand: string;
  /** What one "unit" is, e.g. "capsulă", "comprimat", "fiolă", "porție". */
  unit: string;
  /** Units per day per the label. */
  target: number;
  timing: TimingKey;
  timingNote: string;
  foodNote: string;
  composition: string;
  interactions: string[];
  cautions: string[];
  /** Counted in daily adherence (false = optional / training days only). */
  daily: boolean;
  /** Typically taken by one person (e.g. women's products). */
  suggestedFor?: "cip" | "axy";
  /** Contributions to cumulative-dose tracking, per FULL daily dose. */
  contributes?: Partial<{
    vitaminD_IU: number;
    zinc_mg: number;
    caffeine_mg: number;
    magnesium_mg: number;
    fiveHtp_mg: number;
    iron_mg: number;
  }>;
};

export const TIMINGS: Record<
  TimingKey,
  { label: string; emoji: string; hint: string }
> = {
  morning: { label: "Dimineața", emoji: "☀️", hint: "la micul dejun" },
  noon: { label: "Prânz / după-amiază", emoji: "🍽️", hint: "masa principală · zinc pe la 16:00" },
  evening: { label: "Seara", emoji: "🌙", hint: "la cină / înainte de culcare" },
  preworkout: { label: "Antrenament", emoji: "💪", hint: "în zilele de sport" },
};

export const SUPPLEMENTS: Supplement[] = [
  // ── Dimineața ────────────────────────────────────────────────────────────
  {
    key: "glutathione-youthessentials",
    name: "Glutation lipozomal",
    brand: "Youth Essentials",
    unit: "capsulă",
    target: 2,
    timing: "morning",
    timingNote:
      "Dimineața, pe stomacul gol (~30 min înainte de masă) — lipozomii trec mai ușor de digestie.",
    foodNote: "Pe stomacul gol, cu apă rece (nu cu băuturi fierbinți).",
    composition: "L-glutation lipozomal 200 mg / capsulă (doza zilnică 2 capsule = 400 mg), lecitină din floarea-soarelui.",
    interactions: ["Nu cu băuturi fierbinți sau alcool — degradează învelișul lipozomal."],
    cautions: [
      "Max 2 capsule/zi; nu în sarcină/alăptare (indicația producătorului).",
      "Întreabă medicul dacă urmezi chimioterapie sau iei nitrați/imunosupresoare.",
    ],
    daily: true,
  },
  {
    key: "probiotic-goodroutine",
    name: "Probiotic Synergize Your Gut",
    brand: "Good Routine (Secom)",
    unit: "capsulă",
    target: 1,
    timing: "morning",
    timingNote:
      "Dimineața, la micul dejun — mâncarea tamponează aciditatea și tulpinile ajung viabile în intestin.",
    foodNote: "La masă, cu un pahar de apă; nu cu băuturi fierbinți.",
    composition:
      "7 miliarde UFC / capsulă, 10 tulpini (L. acidophilus, rhamnosus, casei, paracasei, plantarum, salivarius, gasseri, B. breve, lactis, longum) + inulină 321 mg. Eliberare întârziată.",
    interactions: [
      "La ≥2–3h de antibiotice (dacă e cazul).",
      "Nu cu cafea/ceai fierbinte în același moment — căldura omoară tulpinile.",
    ],
    cautions: ["Poate da balonare la început (inulina); prudență la colon iritabil/SIBO."],
    daily: true,
  },
  {
    key: "centrum-women",
    name: "Centrum Women",
    brand: "Centrum (A–Zinc)",
    unit: "comprimat",
    target: 1,
    timing: "morning",
    timingNote:
      "La micul dejun — grăsimile ajută vitaminele A/D/E/K, iar fierul se tolerează mai bine cu mâncare.",
    foodNote: "Cu mâncare; cafeaua/ceaiul la 1–2h distanță (reduc absorbția mineralelor).",
    composition:
      "Multivitamine/minerale A–Zinc (per comprimat: D 400 UI, C 80 mg, calciu 320 mg, magneziu 100 mg, fier 10 mg, zinc 5 mg, K 24,5 µg, B-uri, seleniu, iod).",
    interactions: [
      "Nu simultan cu fierul separat sau zincul separat — calciul/mineralele le blochează; ține 2h distanță.",
      "Nu combina cu alte multivitamine în aceeași zi.",
    ],
    cautions: [
      "Conține vitamina K — aviz medical dacă iei anticoagulante (warfarină/Sintrom).",
      "Conține deja fier 10 mg și zinc 5 mg — intră în totalul zilnic.",
    ],
    daily: true,
    suggestedFor: "axy",
    contributes: { vitaminD_IU: 400, zinc_mg: 5, iron_mg: 10, magnesium_mg: 100 },
  },
  {
    key: "molekin-imuno",
    name: "Molekin Imuno",
    brand: "Zdrovit",
    unit: "comprimat",
    target: 1,
    timing: "morning",
    timingNote:
      "La micul dejun cu grăsimi — dar NU la aceeași masă cu Centrum sau cu fierul (zincul se blochează reciproc cu ele).",
    foodNote: "Cu o masă care conține grăsimi (pentru D3).",
    composition:
      "Vitamina C 1000 mg (eliberare treptată) + Vitamina D3 2000 UI + Zinc 10 mg / comprimat.",
    interactions: [
      "Nu odată cu fier, calciu/magneziu sau Centrum — separă cu ~2h.",
      "Nu în aceeași zi cu alte surse mari de D3 sau zinc (cumul peste limite).",
    ],
    cautions: [
      "E o sursă „plină\": 2000 UI D3 + 10 mg zinc — numără-le în totalul zilei.",
      "Prudență la istoric de pietre la rinichi (vitamina C 1000 mg).",
    ],
    daily: true,
    contributes: { vitaminD_IU: 2000, zinc_mg: 10 },
  },
  {
    key: "kollagen-doppelherz",
    name: "Kollagen 11.000 Plus",
    brand: "Doppelherz system",
    unit: "fiolă",
    target: 1,
    timing: "morning",
    timingNote:
      "Oricând, dar constant zilnic; dacă faci sport, ideal cu 30–60 min înainte de antrenament. Agită flaconul.",
    foodNote: "Indiferent; ideal la o masă (D3 se absoarbe cu grăsimi).",
    composition:
      "Per fiolă 25 ml: colagen hidrolizat bovin 11 g + condroitină 100 mg + vit. C 60 mg + D3 200 UI + cupru 0,3 mg + seleniu 16,5 µg.",
    interactions: [
      "Nu simultan cu doze mari de zinc — zincul blochează cuprul din produs; 2h distanță.",
    ],
    cautions: [
      "Condroitina poate potența anticoagulantele — aviz medical dacă iei.",
      "Conține zahăr/îndulcitori; origine bovină.",
    ],
    daily: true,
    contributes: { vitaminD_IU: 200 },
  },
  {
    key: "d3-gymbeam",
    name: "Vitamina D3 2000 IU",
    brand: "GymBeam",
    unit: "capsulă",
    target: 1,
    timing: "morning",
    timingNote:
      "La o masă cu grăsimi — absorbție cu ~30–50% mai bună. Alege O SINGURĂ sursă principală de D3 pe zi.",
    foodNote: "Cu mâncare grasă (ouă, avocado, ulei).",
    composition: "Colecalciferol 50 µg (2000 UI) / capsulă, în ulei de șofrănel.",
    interactions: [
      "NU cumula cu D3+K2 sau Molekin în aceeași zi — 2 produse = 4000 UI, fix limita.",
    ],
    cautions: [
      "Limita superioară: 4000 UI/zi din TOATE sursele (Omega-3, Centrum, colagen au și ele D3).",
    ],
    daily: true,
    contributes: { vitaminD_IU: 2000 },
  },
  {
    key: "d3k2-boost4life",
    name: "Vitamina D3 + K2",
    brand: "Boost4Life Premium",
    unit: "capsulă",
    target: 1,
    timing: "morning",
    timingNote:
      "La micul dejun cu grăsimi — K2 direcționează calciul spre oase. Alege O SINGURĂ sursă principală de D3 pe zi.",
    foodNote: "Cu mâncare (are ulei MCT inclus, dar masa ajută).",
    composition: "D3 2000 UI (50 µg) + K2 MK-7 75 µg + ulei MCT din cocos 400 mg / capsulă.",
    interactions: [
      "NU cumula cu D3 GymBeam sau Molekin în aceeași zi (total D3 peste limită).",
      "La 2h de fibre (psyllium) — scad absorbția vitaminelor liposolubile.",
    ],
    cautions: [
      "K2 reduce efectul anticoagulantelor antivitamina K (warfarină/Sintrom) — contraindicat fără aviz.",
    ],
    daily: true,
    contributes: { vitaminD_IU: 2000 },
  },

  // ── Prânz / după-amiază ─────────────────────────────────────────────────
  {
    key: "iron-boost4life",
    name: "Fier bisglicinat",
    brand: "Boost4Life Premium Iron",
    unit: "capsulă",
    target: 1,
    timing: "noon",
    timingNote:
      "La prânz — dimineața e ocupată de Centrum/Molekin/cafea, care îi blochează absorbția. Ia-l cu ceva bogat în vitamina C.",
    foodNote: "În timpul mesei (recomandarea producătorului), ideal cu vitamina C; fără lactate.",
    composition:
      "Fier bisglicinat 71,8 mg (fier elemental 14 mg, 100% VNR) + L-leucină 10 mg; capsulă vegetală.",
    interactions: [
      "Nu odată cu calciu, magneziu, zinc sau Centrum — minim 2h distanță.",
      "Cafea/ceai/lactate la 1–2h distanță — taninurile blochează fierul.",
      "La ~4h de levotiroxină (tiroidă) și antiacide.",
    ],
    cautions: [
      "Bărbații și oricine fără deficit confirmat (feritină) NU ar trebui să ia fier pe termen lung — risc de acumulare.",
      "Centrum are deja 10 mg fier — nu le cumula fără indicație medicală.",
    ],
    daily: true,
    suggestedFor: "axy",
    contributes: { iron_mg: 14 },
  },
  {
    key: "omega3-doppelherz",
    name: "Omega-3 Premium 1500",
    brand: "Doppelherz system",
    unit: "capsulă",
    target: 2,
    timing: "noon",
    timingNote:
      "La masa cea mai bogată — grăsimile cresc absorbția EPA/DHA de ~3×. Constanța contează.",
    foodNote: "Cu mâncare grasă, cu lichid, fără a mesteca.",
    composition:
      "Per 2 capsule: ulei de pește 1766 mg (omega-3 1500 mg: EPA 780 mg + DHA 495 mg) + D3 800 UI + vit. E 12 mg. Formă trigliceride.",
    interactions: [
      "Conține D3 800 UI — intră în totalul zilnic de vitamina D.",
      "Prudență cu anticoagulante/antiagregante (efect de subțiere a sângelui).",
    ],
    cautions: ["Alergie la pește = nu.", "Oprește înainte de operații (aviz medical)."],
    daily: true,
    contributes: { vitaminD_IU: 800 },
  },
  {
    key: "zinc-zenyth",
    name: "Zinc 25",
    brand: "Zenyth",
    unit: "capsulă",
    target: 1,
    timing: "noon",
    timingNote:
      "După-amiaza (~16:00) — la 2h după fierul/Centrum de la prânz și cu 2h înainte de magneziul de seară.",
    foodNote: "Pe stomacul gol dacă îl tolerezi; altfel cu o gustare ușoară, fără lactate.",
    composition: "Sulfat de zinc monohidrat 68,8 mg = zinc elemental 25 mg (250% VNR) / capsulă.",
    interactions: [
      "Nu odată cu fier, calciu sau magneziu — minim 2h distanță.",
      "NU în aceeași zi cu Molekin la aceeași persoană — 35–40 mg zinc, fix la limită.",
      "Cafea, lactate și cereale integrale în jurul dozei îi scad absorbția.",
    ],
    cautions: [
      "Limita superioară: 40 mg zinc/zi din toate sursele (Molekin 10 + Centrum 5 se adună).",
      "Cure lungi cu doze mari dau deficit de cupru — fă pauze.",
    ],
    daily: true,
    contributes: { zinc_mg: 25 },
  },

  // ── Seara ────────────────────────────────────────────────────────────────
  {
    key: "magtein-boost4life",
    name: "Magneziu L-Treonat (Magtein)",
    brand: "Boost4Life",
    unit: "capsulă",
    target: 3,
    timing: "evening",
    timingNote:
      "Seara, cu 1–2h înainte de culcare (sau împărțit: după-amiaza + seara). Doza completă = 3 capsule.",
    foodNote: "Indiferent de mese; cu o gustare dacă ai stomac sensibil.",
    composition:
      "Magtein® magneziu L-treonat 670 mg/capsulă (Mg elemental 48 mg); 3 capsule = 144 mg magneziu (38% VNR).",
    interactions: [
      "Nu odată cu fierul sau zincul — 2h distanță.",
      "La 2h+ de antibiotice (chinolone/tetracicline) și levotiroxină.",
    ],
    cautions: [
      "Limita din suplimente: 350 mg Mg/zi — Centrum aduce încă 100 mg.",
      "Evită la afecțiuni renale.",
    ],
    daily: true,
    contributes: { magnesium_mg: 144 },
  },
  {
    key: "ashwagandha-gymbeam",
    name: "Ashwagandha",
    brand: "GymBeam",
    unit: "capsulă",
    target: 1,
    timing: "evening",
    timingNote:
      "Seara, imediat după cină (NU în același moment cu 5-HTP — distanțează-le). Efectul apare după câteva săptămâni de constanță.",
    foodNote: "Indiferent; cu o masă ușoară dacă apare disconfort gastric.",
    composition:
      "Extract rădăcină Withania somnifera 25:1, 500 mg/capsulă, standardizat 5% withanolide (25 mg).",
    interactions: [
      "Nu simultan cu 5-HTP, melatonină, valeriană sau alcool — sedare aditivă.",
      "Evită cofeina seara — efect opus.",
    ],
    cautions: [
      "Interzis în sarcină/alăptare.",
      "Prudență la tiroidă (poate crește hormonii tiroidieni), boli autoimune, diabet/tensiune.",
      "Fă pauze periodice (ex. 6–8 săptămâni on, 2 off).",
    ],
    daily: true,
  },
  {
    key: "5htp-naturesway",
    name: "5-HTP (Nature's Way)",
    brand: "Nature's Way",
    unit: "tabletă",
    target: 1,
    timing: "evening",
    timingNote:
      "Cu 30–60 min înainte de culcare — precursor de serotonină/melatonină. Max 2 tablete/zi pe termen lung.",
    foodNote: "Cu mesele (recomandarea producătorului); învelișul enteric reduce greața.",
    composition:
      "Per tabletă: 5-HTP 50 mg (Griffonia) + B6 4 mg + C 120 mg, gastrorezistentă.",
    interactions: [
      "E ACELAȘI produs cu „5-HTP Secom\" (Secom e distribuitorul RO) — NU le lua împreună, niciodată.",
      "INTERZIS cu antidepresive (SSRI/IMAO/triciclice), triptani, sunătoare — sindrom serotoninergic.",
      "Nu simultan cu ashwagandha/melatonină — sedare aditivă; distanțează-le.",
    ],
    cautions: [
      "Max 2 tablete/zi pe termen lung — la doze mari B6 depășește limita EFSA (12 mg/zi).",
      "Nu în sarcină/alăptare; poate da somnolență — nu conduce după.",
    ],
    daily: false,
    contributes: { fiveHtp_mg: 50 },
  },
  {
    key: "5htp-secom",
    name: "5-HTP (Secom)",
    brand: "Secom",
    unit: "tabletă",
    target: 2,
    timing: "evening",
    timingNote:
      "Cu 30–60 min înainte de culcare. Doza uzuală = 2 tablete (100 mg 5-HTP).",
    foodNote: "La masă (recomandarea producătorului); forma gastrorezistentă reduce greața.",
    composition:
      "Per 2 tablete: 5-HTP 100 mg (Griffonia) + vit. C 120 mg + B6 8,3 mg, gastrorezistente.",
    interactions: [
      "E ACELAȘI produs cu „5-HTP Nature's Way\" — NU le lua împreună, niciodată.",
      "INTERZIS cu antidepresive (SSRI/IMAO/triciclice), triptani, sunătoare — sindrom serotoninergic.",
      "Evită cofeina în a doua parte a zilei — anulează efectul pe somn.",
    ],
    cautions: [
      "Max 2 tablete/zi pe termen lung (B6 cumulat ajunge la limita EFSA).",
      "Nu în sarcină/alăptare; poate da somnolență.",
    ],
    daily: false,
    contributes: { fiveHtp_mg: 100 },
  },

  // ── Antrenament ─────────────────────────────────────────────────────────
  {
    key: "preworkout-on",
    name: "Gold Standard Pre-Workout",
    brand: "Optimum Nutrition",
    unit: "porție",
    target: 1,
    timing: "preworkout",
    timingNote:
      "Cu 20–40 min înainte de antrenament. Are 175 mg cafeină — NU cu mai puțin de ~8h înainte de culcare.",
    foodNote: "În ~350 ml apă; nu pe stomac complet gol dacă ești sensibil la cofeină.",
    composition:
      "Per porție 11 g (EU): creatină monohidrat 3,4 g + beta-alanină 1,5 g + L-citrulină 750 mg + acetil-L-carnitină 375 mg + N-acetil-L-tirozină 250 mg + PerforMelon 250 mg + cafeină 175 mg + piperină 5 mg + B-uri (~200 UI D3).",
    interactions: [
      "Nu combina cu alte surse mari de cofeină — max 400 mg/zi total (2–3 cafele + porția = deja la limită).",
      "Fierul la 1–2h distanță — cofeina îi taie absorbția.",
      "Seara intră în conflict cu 5-HTP/ashwagandha/magneziul (stimulare vs. sedare).",
    ],
    cautions: [
      "Max 1 porție/zi; prudență la hipertensiune, aritmii, anxietate.",
      "Furnicăturile de la beta-alanină sunt normale și trecătoare.",
    ],
    daily: false,
    contributes: { caffeine_mg: 175, vitaminD_IU: 200 },
  },
  {
    key: "creatine-myprotein",
    name: "Impact Creatine",
    brand: "Myprotein (Berry Burst)",
    unit: "porție",
    target: 1,
    timing: "preworkout",
    timingNote:
      "ZILNIC, inclusiv în zilele fără sport — constanța contează, ora nu. Ușor avantaj după antrenament, cu o masă.",
    foodNote: "Indiferent; cu carbohidrați/proteine retenția e ușor mai bună. Bea multă apă.",
    composition: "Creatină monohidrat 3 g / porție (3–5 g/zi e doza sigură pe termen lung).",
    interactions: [
      "În zilele cu pre-workout NU mai e nevoie — acela are deja 3,4 g creatină.",
    ],
    cautions: [
      "Hidratare bună zilnic; evită la boli renale.",
      "Poate crește creatinina la analize fără afectare renală — spune medicului.",
    ],
    daily: true,
  },
];

export const SUPP_BY_KEY: Record<string, Supplement> = Object.fromEntries(
  SUPPLEMENTS.map((s) => [s.key, s]),
);

/** Bucharest-local yyyy-mm-dd for a Date. */
export function bucharestDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
}

/** Cumulative daily totals from a person's logs for one day. */
export function dailyTotals(counts: Record<string, number>) {
  const t = { vitaminD_IU: 0, zinc_mg: 0, caffeine_mg: 0, magnesium_mg: 0, fiveHtp_mg: 0, iron_mg: 0 };
  for (const s of SUPPLEMENTS) {
    const c = counts[s.key] ?? 0;
    if (c <= 0 || !s.contributes) continue;
    const frac = Math.min(c / s.target, 1);
    for (const [k, v] of Object.entries(s.contributes)) {
      t[k as keyof typeof t] += (v as number) * frac;
    }
  }
  return t;
}

export type SmartWarning = { level: "danger" | "warn" | "info"; text: string };

/** Stack-level warnings computed from what's ticked today for one person.
 * Rules mirror the verified research: D3 UL 4000 UI, zinc UL 40 mg, the two
 * identical 5-HTP products, iron vs minerals spacing, evening sedative stack,
 * creatine duplication. */
export function smartWarnings(counts: Record<string, number>): SmartWarning[] {
  const w: SmartWarning[] = [];
  const took = (k: string) => (counts[k] ?? 0) > 0;
  const t = dailyTotals(counts);

  if (took("5htp-naturesway") && took("5htp-secom")) {
    w.push({
      level: "danger",
      text: "Ai bifat AMBELE 5-HTP-uri azi — sunt același produs (Secom = Nature's Way distribuit în RO). Ia doar unul; împreună dublezi doza serotoninergică.",
    });
  }
  const d3Mains = ["d3-gymbeam", "d3k2-boost4life", "molekin-imuno"].filter(took).length;
  if (d3Mains >= 2) {
    w.push({
      level: "warn",
      text: `Ai ${d3Mains} surse principale de D3 azi (${Math.round(t.vitaminD_IU)} UI total) — două produse de 2000 UI ating deja limita de 4000 UI. Păstrează UNA singură.`,
    });
  } else if (t.vitaminD_IU > 4000) {
    w.push({
      level: "warn",
      text: `Vitamina D totală azi ≈ ${Math.round(t.vitaminD_IU)} UI — peste limita superioară de 4000 UI.`,
    });
  } else if (t.vitaminD_IU > 3000) {
    w.push({
      level: "info",
      text: `Vitamina D azi ≈ ${Math.round(t.vitaminD_IU)} UI (Omega-3, Centrum și colagenul aduc și ele) — aproape de limita de 4000 UI.`,
    });
  }
  if (took("zinc-zenyth") && took("molekin-imuno")) {
    w.push({
      level: "warn",
      text: `Zinc 25 + Molekin în aceeași zi = ${Math.round(t.zinc_mg)} mg zinc — fix la limita superioară de 40 mg. Alege doar unul azi (cronic dă deficit de cupru).`,
    });
  } else if (t.zinc_mg > 40) {
    w.push({ level: "warn", text: `Zinc total azi ≈ ${Math.round(t.zinc_mg)} mg — peste limita de 40 mg.` });
  }
  if (took("iron-boost4life") && (took("zinc-zenyth") || took("magtein-boost4life") || took("molekin-imuno") || took("centrum-women"))) {
    w.push({
      level: "info",
      text: "Fier + zinc/magneziu/multivitamine azi: ține-le la ≥2h distanță (fierul la prânz, zincul pe la 16, magneziul seara).",
    });
  }
  if (took("centrum-women") && took("iron-boost4life")) {
    w.push({
      level: "info",
      text: `Fier din două surse azi (Centrum 10 + Boost4Life 14 = ${Math.round(t.iron_mg)} mg) — ok doar cu deficit confirmat prin analize (feritină).`,
    });
  }
  if (took("ashwagandha-gymbeam") && (took("5htp-naturesway") || took("5htp-secom"))) {
    w.push({
      level: "info",
      text: "Ashwagandha + 5-HTP în aceeași seară: distanțează-le (ashwagandha după cină, 5-HTP la culcare) — sedare aditivă.",
    });
  }
  if (took("preworkout-on") && took("creatine-myprotein")) {
    w.push({
      level: "info",
      text: "Pre-workout-ul are deja 3,4 g creatină — porția separată nu mai e necesară azi (nu e periculos, doar inutil).",
    });
  }
  if (t.magnesium_mg > 350) {
    w.push({ level: "warn", text: `Magneziu din suplimente azi ≈ ${Math.round(t.magnesium_mg)} mg — peste limita de 350 mg.` });
  }
  return w;
}

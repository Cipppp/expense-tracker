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
  /** One-line contents summary shown on the card. */
  short: string;
  /** The 2–3 most important things it helps with (info sheet). */
  benefits: string[];
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
    short: "Glutation lipozomal 200 mg/caps",
    benefits: [
      "Antioxidantul „master” al corpului — protejează celulele de stresul oxidativ și de îmbătrânire.",
      "Susține ficatul și procesele naturale de detoxifiere.",
      "Susține imunitatea; la uz îndelungat poate îmbunătăți aspectul tenului.",
    ],
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
    suggestedFor: "axy",
    daily: true,
  },
  {
    key: "probiotic-goodroutine",
    name: "Probiotic Synergize Your Gut",
    brand: "Good Routine (Secom)",
    short: "7 mld. UFC · 10 tulpini + inulină",
    benefits: [
      "Echilibrează flora intestinală — digestie mai ușoară, mai puțină balonare.",
      "Susține imunitatea (o mare parte din sistemul imunitar e în intestin).",
      "Util după antibiotice sau perioade cu alimentație dezordonată; inulina hrănește bacteriile bune.",
    ],
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
    suggestedFor: "axy",
    daily: true,
  },
  {
    key: "centrum-women",
    name: "Centrum Women",
    brand: "Centrum (A–Zinc)",
    short: "A–Zinc: D 400 UI, Fe 10, Zn 5, Mg 100, Ca 320",
    benefits: [
      "Plasă de siguranță zilnică: acoperă bazele de vitamine și minerale la doze moderate, formulate pentru femei.",
      "Energie și reducerea oboselii (vitaminele B + fier).",
      "Piele, păr, unghii și oase (biotină, zinc, calciu, vitamina D).",
    ],
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
    key: "kollagen-doppelherz",
    name: "Kollagen 11.000 Plus",
    brand: "Doppelherz system",
    short: "Colagen 11 g + condroitină + C, D3, Cu, Se",
    benefits: [
      "Articulații și cartilaje mai mobile (colagen 11 g + condroitină).",
      "Piele mai elastică, păr și unghii mai puternice.",
      "Vitamina C din fiolă ajută corpul să-și producă propriul colagen.",
    ],
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
    suggestedFor: "axy",
    daily: true,
    contributes: { vitaminD_IU: 200 },
  },
  {
    key: "d3k2-boost4life",
    name: "Vitamina D3 + K2",
    brand: "Boost4Life Premium",
    short: "D3 2000 UI + K2 MK-7 75 µg + MCT",
    benefits: [
      "Imunitate și dispoziție — esențială mai ales din toamnă până în primăvară.",
      "Oase și dinți puternici: D3 absoarbe calciul, iar K2 îl direcționează în oase (nu în artere).",
      "Susține funcția musculară și nivelul normal de testosteron.",
    ],
    unit: "capsulă",
    target: 1,
    timing: "morning",
    timingNote:
      "La micul dejun cu grăsimi — K2 direcționează calciul spre oase. Alege O SINGURĂ sursă principală de D3 pe zi.",
    foodNote: "Cu mâncare (are ulei MCT inclus, dar masa ajută).",
    composition: "D3 2000 UI (50 µg) + K2 MK-7 75 µg + ulei MCT din cocos 400 mg / capsulă.",
    interactions: [
      "E sursa voastră principală de D3 — nu adăuga alte produse cu 2000 UI în aceeași zi.",
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
    short: "Fier elemental 14 mg (bisglicinat)",
    benefits: [
      "Combate oboseala, amețeala și paloarea din deficitul de fier (frecvent la menstruație).",
      "Esențial pentru hemoglobină — transportul oxigenului în corp.",
      "Forma bisglicinat e blândă cu stomacul și se absoarbe bine.",
    ],
    unit: "capsulă",
    target: 1,
    timing: "noon",
    timingNote:
      "La prânz — dimineața e ocupată de Centrum și cafea, care îi blochează absorbția. Ia-l cu ceva bogat în vitamina C.",
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
    short: "EPA 780 + DHA 495 mg + D3 800 UI / 2 caps",
    benefits: [
      "Inimă sănătoasă — EPA contribuie la trigliceride și tensiune normale.",
      "Creier, memorie și concentrare (DHA).",
      "Efect antiinflamator natural — recuperare, articulații, vedere.",
    ],
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
    suggestedFor: "cip",
    daily: true,
    contributes: { vitaminD_IU: 800 },
  },
  {
    key: "zinc-zenyth",
    name: "Zinc 25",
    brand: "Zenyth",
    short: "Zinc elemental 25 mg (sulfat)",
    benefits: [
      "Imunitate — poate scurta durata răcelilor.",
      "Piele curată (acnee), păr și unghii sănătoase; vindecarea rănilor.",
      "Susține nivelul normal de testosteron și fertilitatea.",
    ],
    unit: "capsulă",
    target: 1,
    timing: "noon",
    timingNote:
      "După-amiaza (~16:00) — la 2h după fierul/Centrum de la prânz și cu 2h înainte de magneziul de seară.",
    foodNote: "Pe stomacul gol dacă îl tolerezi; altfel cu o gustare ușoară, fără lactate.",
    composition: "Sulfat de zinc monohidrat 68,8 mg = zinc elemental 25 mg (250% VNR) / capsulă.",
    interactions: [
      "Nu odată cu fier, calciu sau magneziu — minim 2h distanță.",
      "Centrum are și el 5 mg zinc — totalul zilei rămâne ok (30 mg), dar nu adăuga alte surse.",
      "Cafea, lactate și cereale integrale în jurul dozei îi scad absorbția.",
    ],
    cautions: [
      "Limita superioară: 40 mg zinc/zi din toate sursele (Centrum aduce încă 5 mg).",
      "Cure lungi cu doze mari dau deficit de cupru — fă pauze.",
    ],
    suggestedFor: "axy",
    daily: true,
    contributes: { zinc_mg: 25 },
  },

  // ── Seara ────────────────────────────────────────────────────────────────
  {
    key: "magtein-boost4life",
    name: "Magneziu L-Treonat (Magtein)",
    brand: "Boost4Life",
    short: "Mg L-treonat · 144 mg Mg / 3 caps",
    benefits: [
      "Somn mai profund și relaxare — forma L-treonat ajunge eficient la creier.",
      "Memorie, focus și claritate mentală.",
      "Reduce oboseala și crampele musculare.",
    ],
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
    short: "Extract 500 mg · withanolide 25 mg",
    benefits: [
      "Adaptogen: scade cortizolul — mai puțin stres și anxietate.",
      "Somn mai odihnitor în timp.",
      "Susține testosteronul, forța și recuperarea la sport.",
    ],
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
    suggestedFor: "cip",
  },
  {
    // One physical bottle: Nature's Way front label, Secom (RO distributor)
    // back label — photographed both ways, merged into a single entry.
    key: "5htp-naturesway",
    name: "5-HTP",
    brand: "Nature's Way · Secom",
    short: "5-HTP 50 mg/tab + B6 + C · uzual 2 tab",
    benefits: [
      "Adormi mai ușor — precursor de serotonină, care se transformă în melatonină.",
      "Dispoziție mai bună, mai puțină anxietate.",
      "Poate tempera pofta de mâncare emoțională.",
    ],
    unit: "tabletă",
    target: 2,
    timing: "evening",
    timingNote:
      "Cu 30–60 min înainte de culcare — precursor de serotonină/melatonină. Doza uzuală = 2 tablete (100 mg).",
    foodNote: "Cu mesele (recomandarea producătorului); învelișul gastrorezistent reduce greața.",
    composition:
      "Per tabletă: 5-HTP 50 mg (Griffonia simplicifolia) + B6 ~4 mg + C 60 mg, gastrorezistentă. Flacon 30 tablete.",
    interactions: [
      "INTERZIS cu antidepresive (SSRI/IMAO/triciclice), triptani, sunătoare — sindrom serotoninergic.",
      "Nu simultan cu ashwagandha/melatonină — sedare aditivă; distanțează-le.",
      "Evită cofeina în a doua parte a zilei — anulează efectul pe somn.",
    ],
    cautions: [
      "Max 2 tablete/zi pe termen lung — la doze mari B6 depășește limita EFSA (12 mg/zi).",
      "Nu în sarcină/alăptare; poate da somnolență — nu conduce după.",
    ],
    suggestedFor: "axy",
    daily: false,
    contributes: { fiveHtp_mg: 100 },
  },

  // ── Antrenament ─────────────────────────────────────────────────────────
  {
    key: "preworkout-on",
    name: "Gold Standard Pre-Workout",
    brand: "Optimum Nutrition",
    short: "Creatină 3,4 g + beta-alanină + cafeină 175 mg",
    benefits: [
      "Energie și focus la antrenament (cafeină + tirozină).",
      "Rezistență și pump (beta-alanină + citrulină).",
      "Forță pe termen lung din creatina inclusă.",
    ],
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
    suggestedFor: "cip",
    daily: false,
    contributes: { caffeine_mg: 175, vitaminD_IU: 200 },
  },
  {
    key: "creatine-myprotein",
    name: "Impact Creatine",
    brand: "Myprotein (Berry Burst)",
    short: "Creatină monohidrat 3 g",
    benefits: [
      "Forță și putere — cel mai bine studiat supliment sportiv care există.",
      "Recuperare mai rapidă și creștere de masă musculară.",
      "Bonus: mici beneficii cognitive (memorie de lucru), mai ales la nesomn.",
    ],
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
    suggestedFor: "cip",
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
 * Rules mirror the verified research: D3 UL 4000 UI, zinc UL 40 mg, iron vs
 * minerals spacing, creatine duplication, magnesium UL. */
export function smartWarnings(counts: Record<string, number>): SmartWarning[] {
  const w: SmartWarning[] = [];
  const took = (k: string) => (counts[k] ?? 0) > 0;
  const t = dailyTotals(counts);

  if (t.vitaminD_IU > 4000) {
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
  if (t.zinc_mg > 40) {
    w.push({ level: "warn", text: `Zinc total azi ≈ ${Math.round(t.zinc_mg)} mg — peste limita de 40 mg.` });
  }
  if (took("iron-boost4life") && (took("zinc-zenyth") || took("magtein-boost4life") || took("centrum-women"))) {
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

import type { PersonKey } from "@/lib/chores";

/*
 * Meal plans for the two people in the house, and the nutrition math behind
 * the Meals page.
 *
 * Axy's plan is the one her nutritionist wrote (PDF, Nov 2026), transcribed as
 * is. Cip's plan is the same menu scaled for 1.68 m, 96 kg, five gym sessions
 * a week and a desk job: ~2,000 kcal and ~170 g protein.
 *
 * Every number is computed from grams × the per-100 g values below, never
 * typed in by hand, so a changed gram count can't leave a stale total behind.
 * All weights are raw, before cooking, as the plan says.
 */

export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };

type Food = {
  name: string;
  per100: Macros;
  /** For things eaten by the piece (an egg, a bar): what one piece weighs. */
  unit?: { one: string; many: string; grams: number };
  source: string;
};

const m = (kcal: number, protein: number, carbs: number, fat: number, fiber = 0): Macros => ({
  kcal,
  protein,
  carbs,
  fat,
  fiber,
});

const USDA = "USDA FoodData Central";
const EU = "valori tipice de pe etichete din UE";

export const FOODS = {
  // Proteine
  chickenBreast: { name: "piept de pui", per100: m(120, 22.5, 0, 2.6), source: USDA },
  porkTenderloin: { name: "mușchiuleț de porc", per100: m(120, 20.7, 0, 3.5), source: USDA },
  shrimp: { name: "creveți decorticați", per100: m(85, 20.1, 0, 0.5), source: USDA },
  egg: {
    name: "ou",
    per100: m(143, 12.6, 0.7, 9.5),
    unit: { one: "ou", many: "ouă", grams: 50 },
    source: `${USDA}; un ou M/L are ~50 g fără coajă`,
  },
  eggWhite: { name: "albuș", per100: m(52, 10.9, 0.7, 0.2), source: USDA },
  whey: { name: "pudră proteică", per100: m(400, 78, 7, 6), source: "whey concentrat, medie de etichete" },
  greekYogurt: { name: "iaurt grecesc 2%", per100: m(66, 8, 3.9, 2), source: "Eridanous Stragghisto 2% (Lidl); Olympus 2% are aproape la fel" },
  smokedChicken: { name: "piept de pui afumat Pikok", per100: m(109, 21, 1.8, 2), source: "Open Food Facts, poza etichetei" },
  chickenHam: { name: "șuncă din piept de pui Sissi", per100: m(94, 18, 2.2, 1.5), source: "eticheta de pe sezamo.ro" },
  proteinCheese: { name: "cașcaval proteic Milbona", per100: m(214, 31, 0.1, 10), source: "Open Food Facts, poza etichetei" },
  parmesan: { name: "parmezan", per100: m(392, 33, 0, 28), source: "etichetă Parmigiano Reggiano" },
  proteinPudding: {
    name: "budincă proteică Milbona",
    per100: m(76, 10, 5.2, 1.5),
    unit: { one: "budincă", many: "budinci", grams: 200 },
    source: "Open Food Facts, poza etichetei (ciocolată; vanilie 75 kcal)",
  },
  proteinBar: {
    name: "baton proteic Sportyfeel",
    per100: m(380, 50, 29.3, 11.4),
    unit: { one: "baton proteic", many: "batoane proteice", grams: 45 },
    source: "Open Food Facts, poza etichetei; carbohidrații includ 25 g polioli",
  },

  // Carbohidrați
  oatCream: { name: "cremă de ovăz The Rice Dealer", per100: m(392, 13, 68, 6.9, 8), source: "etichetă The Rice Dealer, vanilie (nu există variantă simplă)" },
  oats: { name: "fulgi de ovăz", per100: m(372, 13.5, 58.7, 7, 10), source: EU },
  pasta: { name: "paste", per100: m(359, 12.5, 71, 2, 3), source: "etichetă Barilla" },
  rice: { name: "orez alb", per100: m(365, 7.1, 80, 0.7, 1.3), source: USDA },
  potato: { name: "cartof", per100: m(77, 2, 17.5, 0.1, 2.1), source: USDA },
  tortilla: {
    name: "tortilla integrală Snack Day",
    per100: m(301, 9.3, 48, 6.3, 7.7),
    unit: { one: "tortilla", many: "tortilla", grams: 61.7 },
    source: "Open Food Facts, poza etichetei (pachet de 370 g, 6 bucăți)",
  },
  riceCake: { name: "rondele de orez expandat", per100: m(387, 8.2, 81.5, 2.8, 4.2), source: USDA },
  puffedQuinoa: { name: "quinoa expandată", per100: m(370, 11, 68, 4.5, 5.5), source: "estimat, media mărcilor de pe Open Food Facts" },
  breadcrumbs: { name: "pesmet", per100: m(395, 13.4, 72, 5.3, 4.5), source: USDA },

  // Fructe
  apple: { name: "măr", per100: m(52, 0.3, 13.8, 0.2, 2.4), source: USDA },
  banana: { name: "banană", per100: m(89, 1.1, 22.8, 0.3, 2.6), source: USDA },
  blueberries: { name: "afine", per100: m(57, 0.7, 14.5, 0.3, 2.4), source: USDA },

  // Legume
  mushrooms: { name: "ciuperci", per100: m(22, 3.1, 3.3, 0.3, 1), source: USDA },
  onion: { name: "ceapă", per100: m(40, 1.1, 9.3, 0.1, 1.7), source: USDA },
  redPepper: { name: "ardei capia", per100: m(31, 1, 6, 0.3, 2.1), source: USDA },
  tomato: { name: "roșii", per100: m(18, 0.9, 3.9, 0.2, 1.2), source: USDA },
  greenBeans: { name: "fasole verde", per100: m(31, 1.8, 7, 0.2, 2.7), source: USDA },
  lettuce: { name: "salată verde", per100: m(15, 1.4, 2.9, 0.2, 1.3), source: USDA },
  carrot: { name: "morcov", per100: m(41, 0.9, 9.6, 0.2, 2.8), source: USDA },
  greenOnion: { name: "ceapă verde", per100: m(32, 1.8, 7.3, 0.2, 2.6), source: USDA },
  garlic: { name: "usturoi", per100: m(149, 6.4, 33, 0.5, 2.1), source: USDA },
  herbs: { name: "mărar, pătrunjel, cimbru", per100: m(40, 3, 7, 0.8, 3), source: USDA },

  // Grăsimi și dulciuri
  butter: { name: "unt", per100: m(740, 0.7, 0.7, 82), source: "unt 82%, " + EU },
  milk: { name: "lapte 1,5%", per100: m(46, 3.4, 4.8, 1.5), source: EU },
  oliveOil: { name: "ulei de măsline", per100: m(884, 0, 0, 100), source: USDA },
  peanutButter: { name: "unt de arahide", per100: m(588, 25, 20, 50, 6), source: USDA },
  seedMix: { name: "semințe de susan și in", per100: m(553, 18, 26, 46, 19.5), source: `${USDA}, medie 50/50` },
  darkChocolate: { name: "ciocolată neagră 85%", per100: m(580, 12.5, 19, 46, 13), source: "etichetă Lindt 85%" },
  cocoa: { name: "cacao neîndulcită", per100: m(340, 20, 12, 11, 30), source: "cacao degresată, " + EU },
  erythritol: { name: "eritritol", per100: m(0, 0, 0, 0), source: "eritritolul nu se metabolizează" },
  bakingPowder: { name: "praf de copt", per100: m(53, 0, 28, 0, 0.2), source: USDA },
  kinderCard: {
    name: "Kinder Card",
    per100: m(510, 11.5, 55.9, 26.3),
    unit: { one: "Kinder Card (2 foi)", many: "Kinder Card", grams: 25.6 },
    source: "etichetă kinder.com/ro",
  },
  kinderPingui: {
    name: "Kinder Pingui",
    per100: m(450, 7, 37.8, 29.7),
    unit: { one: "Kinder Pingui", many: "Kinder Pingui", grams: 30 },
    source: "etichetă kinder.com/ro",
  },
  chocRiceCake: {
    name: "rondea de orez cu ciocolată Sondey",
    per100: m(487, 6.3, 61, 23),
    unit: { one: "rondea cu ciocolată", many: "rondele cu ciocolată", grams: 16.7 },
    source: "Open Food Facts, poza etichetei (ciocolată neagră, 6 bucăți la 100 g)",
  },
} satisfies Record<string, Food>;

export type FoodKey = keyof typeof FOODS;

/** An amount of one food, by weight or by pieces. `label` replaces the generated text. */
export type Ingredient =
  | { food: FoodKey; grams: number; label?: string }
  | { food: FoodKey; count: number; label?: string };

export type Recipe = {
  name: string;
  /** How many portions the ingredient list makes. */
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
};

export const RECIPES = {
  bananaBread: {
    name: "Banana bread",
    servings: 1,
    ingredients: [
      { food: "egg", count: 1 },
      { food: "eggWhite", grams: 70 },
      { food: "oats", grams: 30, label: "30 g fulgi sau cremă de ovăz" },
      { food: "greekYogurt", grams: 40 },
      { food: "bakingPowder", grams: 5 },
      { food: "banana", grams: 100, label: "100 g banană bine coaptă" },
      { food: "whey", grams: 10 },
    ],
    steps: ["Se amestecă totul la blender.", "Se coace 30 de minute la 175 °C."],
  },
  pancakes: {
    name: "Clătite proteice",
    servings: 1,
    ingredients: [
      { food: "whey", grams: 10 },
      { food: "oats", grams: 35 },
      { food: "banana", grams: 100 },
      { food: "egg", count: 2 },
    ],
    steps: [
      "Se amestecă banana cu ouăle.",
      "Se adaugă ovăzul și proteina.",
      "Se fac clătitele ca de obicei, cu un puf de ulei spray.",
    ],
  },
  fitCake: {
    name: "Prăjitură fit în straturi",
    servings: 1,
    ingredients: [
      { food: "puffedQuinoa", grams: 30 },
      { food: "cocoa", grams: 10 },
      { food: "proteinPudding", count: 1 },
      { food: "erythritol", grams: 15, label: "15 g eritritol, după gust" },
    ],
    steps: [
      "Se amestecă eritritolul cu cacaoa și 20–30 ml apă și se ține 30 de secunde la microunde. Pune mai puțină apă și completează: după ce adaugi quinoa nu trebuie să rămână lichid.",
      "Se adaugă quinoa, se amestecă și se lasă să se întărească (cam 30 de minute).",
      "Se pune budinca deasupra și se lasă la frigider peste noapte.",
    ],
  },
  mash: {
    name: "Piure de cartofi",
    servings: 6,
    ingredients: [
      { food: "potato", grams: 1000, label: "1 kg cartofi" },
      { food: "butter", grams: 100 },
      { food: "milk", grams: 100, label: "100 ml lapte (sau apă)" },
    ],
    steps: [
      "Cartofii curățați și tăiați se fierb acoperiți, cu o linguriță de sare, până intră furculița ușor.",
      "Se zdrobesc, se adaugă untul și laptele și se bat cu telul.",
    ],
  },
  meatballs: {
    name: "Chifteluțe din piept de pui",
    servings: 4,
    ingredients: [
      { food: "chickenBreast", grams: 500 },
      { food: "carrot", grams: 50, label: "1 morcov mic (~50 g)" },
      { food: "potato", grams: 100, label: "1 cartof mic (~100 g)" },
      { food: "greenOnion", grams: 30, label: "2 fire de ceapă verde" },
      { food: "garlic", grams: 6, label: "2 fire de usturoi verde sau 2 căței" },
      { food: "herbs", grams: 8, label: "1 lingură mărar, 1 lingură pătrunjel, o crenguță de cimbru" },
      { food: "egg", count: 1 },
      { food: "breadcrumbs", grams: 14, label: "2 linguri pesmet" },
      { food: "seedMix", grams: 40, label: "4–5 linguri semințe de susan și in" },
    ],
    steps: [
      "Puiul, morcovul, cartoful, ceapa și usturoiul se dau prin robot.",
      "Se adaugă verdețurile, oul bătut și pesmetul, apoi sare și piper.",
      "Se formează chifteluțe cu mâinile ude și se tăvălesc prin semințe.",
      "Se coc pe hârtie de copt, în cuptorul încins la 180 °C, până se rumenesc.",
    ],
  },
} satisfies Record<string, Recipe>;

export type RecipeKey = keyof typeof RECIPES;

export type Item = Ingredient | { recipe: RecipeKey; portions: number; label?: string };

export type MealKey = "breakfast" | "lunch" | "snack" | "dinner";

export const MEALS: { key: MealKey; label: string }[] = [
  { key: "breakfast", label: "Mic dejun" },
  { key: "lunch", label: "Prânz" },
  { key: "snack", label: "Gustare" },
  { key: "dinner", label: "Cină" },
];

/** Which small picture the dish gets on the page (mapped to an icon there). */
export type DishIcon =
  | "porridge" | "bread" | "egg" | "cake" | "bowl" | "pot" | "sandwich"
  | "cookie" | "fruit" | "shrimp" | "veg" | "cheese";

export type Variant = {
  key: string;
  title: string;
  icon: DishIcon;
  items: Item[];
  /** Things in the dish that don't count (spices, "după gust"). */
  extras?: string[];
  tip?: string;
};

export type Plan = {
  title: string;
  byline: string;
  target: { kcal: number; protein: number } | null;
  meals: Record<MealKey, Variant[]>;
  notes: string[];
};

const MUSHROOM_TIP =
  "Ceapa tocată mărunt se încălzește în ulei, fără să se prăjească, apoi se adaugă ciupercile și se gătesc sub capac. Puțin mărar deasupra.";

const OAT_TIP =
  "Se amestecă proteina cu crema de ovăz și 250 ml apă, direct în caserola de sticlă, și se ține 2,5 minute la microunde. Fructul se pune deasupra.";

const BASE_NOTES = [
  "Toate ingredientele se cântăresc crude, înainte de gătit.",
  "Carnea și pastele se gătesc la cuptor, la airfryer sau fierte.",
  "Unde nu scrie ulei și ai nevoie, un puf de ulei spray întins pe toată tigaia.",
  "Sare și piper după gust, fără să exagerezi. Condimente simple: fără amestecuri pentru pui sau cartofi, au zahăr.",
];

export const PLANS: Record<PersonKey, Plan> = {
  axy: {
    title: "Planul de la nutriționistă",
    byline: "Transcris din PDF. Gramajele sunt cele din plan; doar sfaturile de preparare sunt reformulate.",
    target: null,
    meals: {
      breakfast: [
        {
          key: "v1",
          title: "Cremă de ovăz cu măr",
          icon: "porridge",
          items: [
            { food: "oatCream", grams: 50 },
            { food: "whey", grams: 20 },
            { food: "apple", grams: 100 },
            { food: "peanutButter", grams: 20 },
          ],
          tip: OAT_TIP,
        },
        { key: "v2", title: "Banana bread", icon: "bread", items: [{ recipe: "bananaBread", portions: 1 }] },
        {
          key: "v3",
          title: "Clătite proteice cu afine",
          icon: "egg",
          items: [
            { recipe: "pancakes", portions: 1 },
            { food: "blueberries", grams: 50 },
          ],
        },
        { key: "v4", title: "Prăjitură fit", icon: "cake", items: [{ recipe: "fitCake", portions: 1 }] },
      ],
      lunch: [
        {
          key: "v1",
          title: "Pui cu piure",
          icon: "bowl",
          items: [
            { food: "chickenBreast", grams: 150 },
            { recipe: "mash", portions: 1 },
            { food: "kinderCard", count: 1 },
          ],
        },
        {
          key: "v2",
          title: "Porc cu ciuperci",
          icon: "pot",
          items: [
            { food: "porkTenderloin", grams: 180, label: "180 g mușchi de porc slab" },
            { food: "mushrooms", grams: 250 },
            { food: "onion", grams: 50 },
            { food: "oliveOil", grams: 5 },
            { food: "chocRiceCake", count: 2 },
          ],
          tip: MUSHROOM_TIP,
        },
        {
          key: "v3",
          title: "Sandviș cu pui afumat",
          icon: "sandwich",
          items: [
            { food: "tortilla", count: 1 },
            { food: "smokedChicken", grams: 150 },
            { food: "proteinCheese", grams: 25 },
            { food: "kinderPingui", count: 1 },
          ],
        },
      ],
      snack: [
        {
          key: "v1",
          title: "Ciocolată și banană",
          icon: "cookie",
          items: [
            { food: "darkChocolate", grams: 10 },
            { food: "banana", grams: 50 },
          ],
        },
        {
          key: "v2",
          title: "Ciocolată și afine",
          icon: "cookie",
          items: [
            { food: "darkChocolate", grams: 10 },
            { food: "blueberries", grams: 80 },
          ],
        },
        {
          key: "v3",
          title: "Unt de arahide și banană",
          icon: "fruit",
          items: [
            { food: "peanutButter", grams: 10 },
            { food: "banana", grams: 50 },
          ],
        },
        {
          key: "v4",
          title: "Unt de arahide și afine",
          icon: "fruit",
          items: [
            { food: "peanutButter", grams: 10 },
            { food: "blueberries", grams: 80 },
          ],
        },
      ],
      dinner: [
        {
          key: "v1",
          title: "Paste cu creveți",
          icon: "shrimp",
          items: [
            { food: "shrimp", grams: 175 },
            { food: "butter", grams: 10 },
            { food: "pasta", grams: 50 },
            { food: "redPepper", grams: 150, label: "150 g ardei capia copt" },
            { food: "greekYogurt", grams: 100 },
          ],
          extras: ["usturoi, după gust"],
          tip: "Sosul: ardeiul tăiat rondele, 10 minute la airfryer la 200 °C, apoi blenduit cu iaurtul și usturoiul.",
        },
        {
          key: "v2",
          title: "Chiftele de pui cu salată",
          icon: "veg",
          items: [
            { recipe: "meatballs", portions: 1 },
            { food: "tomato", grams: 200 },
            { food: "oliveOil", grams: 5 },
            { food: "riceCake", grams: 20 },
            { food: "proteinBar", count: 1 },
          ],
          tip: "Salata: roșii, uleiul și rondelele de orez expandat.",
        },
        {
          key: "v3",
          title: "Paste cu șuncă și ciuperci",
          icon: "cheese",
          items: [
            { food: "pasta", grams: 50 },
            { food: "chickenHam", grams: 180 },
            { food: "mushrooms", grams: 150 },
            { food: "greekYogurt", grams: 50 },
            { food: "parmesan", grams: 20 },
          ],
          extras: ["busuioc și usturoi, după gust"],
          tip: "Sosul: iaurtul cu parmezanul, busuiocul și usturoiul.",
        },
      ],
    },
    notes: [
      ...BASE_NOTES,
      "La gustare: o grăsime (10 g ciocolată sau 10 g unt de arahide) și un fruct (50 g banană sau 80 g afine). Dacă nutriționista a vrut doar una dintre ele, gustarea are ~50 kcal mai puțin.",
      "Urmărește dacă te balonezi sau ai sensibilitate la stomac după anumite mese.",
      "În fiecare sâmbătă, pe stomacul gol: poze, greutate și măsurători pentru nutriționistă.",
    ],
  },

  cip: {
    title: "Planul adaptat",
    byline: "Același meniu, cu porțiile scalate: 1,68 m, 96 kg, sală de 5 ori pe săptămână, job de birou.",
    target: { kcal: 2000, protein: 170 },
    meals: {
      breakfast: [
        {
          key: "v1",
          title: "Cremă de ovăz cu măr",
          icon: "porridge",
          items: [
            { food: "oatCream", grams: 60 },
            { food: "whey", grams: 35 },
            { food: "apple", grams: 100 },
            { food: "peanutButter", grams: 15 },
          ],
          tip: OAT_TIP,
        },
        {
          key: "v2",
          title: "Banana bread cu iaurt",
          icon: "bread",
          items: [
            { recipe: "bananaBread", portions: 1 },
            { food: "whey", grams: 10, label: "10 g pudră proteică în plus, în aluat" },
            { food: "greekYogurt", grams: 100 },
          ],
        },
        {
          key: "v3",
          title: "Clătite proteice cu afine",
          icon: "egg",
          items: [
            { recipe: "pancakes", portions: 1 },
            { food: "egg", count: 1, label: "1 ou în plus, în aluat" },
            { food: "whey", grams: 10, label: "10 g pudră proteică în plus, în aluat" },
            { food: "blueberries", grams: 50 },
          ],
        },
        {
          key: "v4",
          title: "Prăjitură fit cu iaurt",
          icon: "cake",
          items: [
            { recipe: "fitCake", portions: 1 },
            { food: "greekYogurt", grams: 150 },
            { food: "blueberries", grams: 80 },
          ],
        },
      ],
      lunch: [
        {
          key: "v1",
          title: "Pui cu piure și fasole verde",
          icon: "bowl",
          items: [
            { food: "chickenBreast", grams: 200 },
            { recipe: "mash", portions: 1 },
            { food: "greenBeans", grams: 200, label: "200 g fasole verde (sau 250 g broccoli)" },
            { food: "kinderCard", count: 1 },
          ],
        },
        {
          key: "v2",
          title: "Porc cu ciuperci și orez",
          icon: "pot",
          items: [
            { food: "porkTenderloin", grams: 220 },
            { food: "mushrooms", grams: 250 },
            { food: "onion", grams: 50 },
            { food: "oliveOil", grams: 5 },
            { food: "rice", grams: 30 },
            { food: "chocRiceCake", count: 2 },
          ],
          tip: MUSHROOM_TIP,
        },
        {
          key: "v3",
          title: "Sandviș cu pui",
          icon: "sandwich",
          items: [
            { food: "tortilla", count: 1 },
            { food: "chickenBreast", grams: 200, label: "200 g piept de pui gătit (sau afumat Pikok, nu zilnic)" },
            { food: "proteinCheese", grams: 25 },
            { food: "tomato", grams: 100 },
            { food: "lettuce", grams: 30 },
            { food: "kinderPingui", count: 1 },
          ],
        },
      ],
      snack: [
        {
          key: "v1",
          title: "Iaurt grecesc cu afine",
          icon: "fruit",
          items: [
            { food: "greekYogurt", grams: 200 },
            { food: "blueberries", grams: 80 },
          ],
        },
        {
          key: "v2",
          title: "Iaurt grecesc cu banană",
          icon: "fruit",
          items: [
            { food: "greekYogurt", grams: 200 },
            { food: "banana", grams: 50 },
          ],
        },
      ],
      dinner: [
        {
          key: "v1",
          title: "Paste cu creveți",
          icon: "shrimp",
          items: [
            { food: "shrimp", grams: 250 },
            { food: "butter", grams: 10 },
            { food: "pasta", grams: 70 },
            { food: "redPepper", grams: 150, label: "150 g ardei capia copt" },
            { food: "greekYogurt", grams: 100 },
          ],
          extras: ["usturoi, după gust"],
          tip: "Sosul: ardeiul tăiat rondele, 10 minute la airfryer la 200 °C, apoi blenduit cu iaurtul și usturoiul.",
        },
        {
          key: "v2",
          title: "Chiftele de pui cu salată",
          icon: "veg",
          items: [
            { recipe: "meatballs", portions: 1 },
            { food: "tomato", grams: 200 },
            { food: "oliveOil", grams: 5 },
            { food: "riceCake", grams: 20 },
            { food: "proteinBar", count: 1 },
          ],
          tip: "La fel ca în planul Axy.",
        },
        {
          key: "v3",
          title: "Paste cu șuncă și ciuperci",
          icon: "cheese",
          items: [
            { food: "pasta", grams: 70 },
            { food: "chickenHam", grams: 180, label: "180 g șuncă de pui Sissi (sau 200 g piept de pui, mai puțină sare)" },
            { food: "mushrooms", grams: 150 },
            { food: "greekYogurt", grams: 50 },
            { food: "parmesan", grams: 20 },
          ],
          extras: ["busuioc și usturoi, după gust"],
        },
      ],
    },
    notes: [
      ...BASE_NOTES,
      "Cântărește-te dimineața și urmărește media pe săptămână: ținta e −0,5 până la −0,8 kg pe săptămână.",
      "Slăbești mai repede sau n-ai energie la sală: +150 kcal pe zi. Greutatea și talia stau pe loc 2–3 săptămâni: −150 kcal.",
      "7–8 mii de pași pe zi, pe lângă sală.",
    ],
  },
};

/** Fruit, starch and vegetable swaps from the nutritionist, each line roughly equal. */
export const SWAPS: string[] = [
  "100 g afine = 120 g zmeură = 190 g pepene roșu = 65 g banană = 100 g kiwi = 130 g nectarină = 140 g piersică = 95 g gutui = 130 g grapefruit = 180 g căpșuni = 90 g mango",
  "180 g cartof = 40 g orez = 40 g paste integrale",
  "200 g fasole verde congelată = 250 g dovlecel = 150 g ardei roșu = 100 g mazăre = 200 g castravete cu coajă = 100 g sfeclă roșie = 200 g varză murată sau crudă = 250 g broccoli",
  "10 g unt de arahide = 10 g caju",
];

/* ------------------------------------------------------------------ math */

const ZERO: Macros = m(0, 0, 0, 0, 0);

function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

function scale(x: Macros, f: number): Macros {
  return { kcal: x.kcal * f, protein: x.protein * f, carbs: x.carbs * f, fat: x.fat * f, fiber: x.fiber * f };
}

export const sum = (xs: Macros[]): Macros => xs.reduce(add, ZERO);

export function ingredientGrams(i: Ingredient): number {
  if ("grams" in i) return i.grams;
  const unit = (FOODS[i.food] as Food).unit;
  if (!unit) throw new Error(`${i.food} has no piece weight; give it in grams`);
  return i.count * unit.grams;
}

export function ingredientMacros(i: Ingredient): Macros {
  return scale(FOODS[i.food].per100, ingredientGrams(i) / 100);
}

/** One portion of a recipe. */
export function recipeMacros(key: RecipeKey): Macros {
  const r: Recipe = RECIPES[key];
  return scale(sum(r.ingredients.map(ingredientMacros)), 1 / r.servings);
}

export function itemMacros(item: Item): Macros {
  if ("recipe" in item) return scale(recipeMacros(item.recipe), item.portions);
  return ingredientMacros(item);
}

export function variantMacros(v: Variant): Macros {
  return sum(v.items.map(itemMacros));
}

const fmtG = (g: number) => (Number.isInteger(g) ? String(g) : g.toLocaleString("ro-RO", { maximumFractionDigits: 1 }));

/** "50 g cremă de ovăz", "2 ouă", "1 porție de banana bread". */
export function itemLabel(item: Item): string {
  if (item.label) return item.label;
  if ("recipe" in item) {
    const name = RECIPES[item.recipe].name.toLowerCase();
    return item.portions === 1 ? `1 porție de ${name}` : `${fmtG(item.portions)} porții de ${name}`;
  }
  const f: Food = FOODS[item.food];
  if ("count" in item) {
    const u = f.unit!;
    return `${fmtG(item.count)} ${item.count === 1 ? u.one : u.many}`;
  }
  return `${fmtG(item.grams)} g ${f.name}`;
}

export function findVariant(person: PersonKey, meal: MealKey, key: string): Variant | undefined {
  return PLANS[person].meals[meal].find((v) => v.key === key);
}

export type Choices = Partial<Record<MealKey, string>>;

/** Totals for one day of choices; meals left empty count as nothing. */
export function dayMacros(person: PersonKey, choices: Choices): Macros {
  return sum(
    MEALS.flatMap(({ key }) => {
      const v = choices[key] ? findVariant(person, key, choices[key]!) : undefined;
      return v ? [variantMacros(v)] : [];
    }),
  );
}

/** Lowest and highest day the plan allows, one variant per meal. */
export function planRange(person: PersonKey): { min: Macros; max: Macros } {
  const pick = (better: (a: Macros, b: Macros) => boolean) =>
    sum(
      MEALS.map(({ key }) =>
        PLANS[person].meals[key].map(variantMacros).reduce((a, b) => (better(a, b) ? a : b)),
      ),
    );
  return { min: pick((a, b) => a.kcal <= b.kcal), max: pick((a, b) => a.kcal >= b.kcal) };
}

/* ----------------------------------------------------------------- dates */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s: string) => DAY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

/** The Monday of the week that contains `day`. */
export function mondayOf(day: string): string {
  const offset = (toDate(day).getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

export function weekOf(day: string): string[] {
  const mon = mondayOf(day);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

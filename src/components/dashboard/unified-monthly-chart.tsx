"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ronFromBani, type DisplayCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Trebuie sa fie acelasi sir ca in queries.ts — cheltuielile de pe firma. */
const COMPANY_CATEGORY = "Firmă";

export type MonthlyDatum = {
  /** Taxe chiar platite pentru luna asta, pe fel, in bani RON. */
  taxRon?: Record<string, number>;
  /** Obligatii fixe estimate pentru lunile inca neplatite, in bani RON. */
  taxForecastRon?: number;
  label: string;
  earnedUsd: number;     // cents
  spentRon: number;      // bani
  spentUsd: number;      // cents
  /** Partea din spent platita din contul firmei. */
  spentCompanyUsd?: number; // cents
  /** Incasarile lunii trecute minus taxele ei — bani de cheltuit luna asta. */
  availableUsd?: number; // cents
  /** Tot ce se datoreaza pentru luna asta, platit sau estimat. */
  taxOwedRon?: number;   // bani
  /** Dividende scoase in luna asta, si cat din ele au fost deduse. */
  dividendsRon?: number;          // bani
  dividendsPresumedRon?: number;  // bani
};

export type MonthlyCategoryDatum = {
  label: string;
  categories: Record<string, number>; // category → bani
};

type View = "taxes" | "categories" | "net";

/*
 * Culorile vin din variabilele temei, nu din hex-uri scrise aici: aceleasi
 * zece nuante isi schimba singure luminozitatea intre tema deschisa si cea
 * inchisa. Vechile hex-uri erau fixate pe fundal alb si pe negru se stingeau
 * toate intr-un maro comun.
 */
const C = (n: number) => `hsl(var(--chart-${n}))`;

/*
 * Categoriile merg pe o rampa dintr-o singura familie de culoare, de la cald
 * si deschis catre inchis. Ordinea din paleta e ordinea marimii, deci cea mai
 * mare categorie e si cea mai luminoasa: se vede care conduce fara sa cauti
 * in legenda.
 */
const CATEGORY_PALETTE = [1, 2, 3, 4, 5, 6, 7, 8].map(
  (n) => `hsl(var(--cat-${n}))`,
);

/*
 * Taxele merg pe aceeasi idee ca in "Spending categories" — o singura familie
 * de culoare, treapta dupa marime — dar pe o familie RECE, ca sa se vada din
 * prima ca esti pe alt tab, nu pe acelasi grafic cu alte cifre.
 */
const TAX_RAMP = [1, 2, 3, 4, 5, 6, 7].map((n) => `hsl(var(--tax-${n}))`);

const SERIES = {
  earned: "hsl(var(--series-earned))",
  spent: "hsl(var(--series-spent))",
  /** Partea de spent platita de firma — acelasi albastru ca in categorii. */
  company: "hsl(var(--chart-2))",
  available: "hsl(var(--series-available))",
};

/*
 * Felurile de taxa, exact cum apar in extrasul bancar. Cheile sunt cele din
 * TaxPayment.kind, ca sa nu existe o a doua taxonomie care sa iasa din pas.
 */
const TAX_LABELS: Record<string, string> = {
  bs_bas: "BS + BAS",
  cam: "CAM",
  micro: "Impozit micro",
  dividende: "Impozit dividende",
  venit: "Impozit venit",
  forecast: "De plată (estimat)",
  tva: "TVA",
  alte: "Alte obligații",
};
const TAX_ORDER = ["bs_bas", "cam", "micro", "venit", "dividende", "tva", "alte"];

export function UnifiedMonthlyChart({
  monthly,
  categories,
  fxRonToUsd,
  fxEurToUsd,
  startMonth,
  displayCurrency,
}: {
  monthly: MonthlyDatum[];
  categories: MonthlyCategoryDatum[];
  fxRonToUsd: number;
  fxEurToUsd: number;
  startMonth: number;
  displayCurrency: DisplayCurrency;
}) {
  const [view, setView] = useState<View>("net");

  /*
   * Graficele lucreaza in unitati majore (1415 RON, nu 141500 bani), asa ca
   * fac conversia aici, o data. Totul trece prin dolar: leul are curs catre
   * dolar, euro are curs catre dolar, deci leul in euro iese din amandoua.
   */
  // Stabile intre randari cat timp moneda si cursurile nu se schimba, ca sa
  // poata fi trecute ca atare in listele de dependente de mai jos — altfel
  // acolo scrie „moneda si cursurile”, ceea ce e acelasi lucru, dar pe ocolite.
  const ronToDisplay = useCallback(
    (ron: number) => {
      if (displayCurrency === "RON") return ron;
      const usd = ron * fxRonToUsd;
      return displayCurrency === "EUR" ? usd / fxEurToUsd : usd;
    },
    [displayCurrency, fxRonToUsd, fxEurToUsd],
  );
  const usdToDisplay = useCallback(
    (usd: number) => {
      if (displayCurrency === "USD") return usd;
      return displayCurrency === "EUR" ? usd / fxEurToUsd : usd / fxRonToUsd;
    },
    [displayCurrency, fxRonToUsd, fxEurToUsd],
  );
  const formatMoney = (v: number) => {
    if (displayCurrency === "USD")
      return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (displayCurrency === "EUR")
      return `€${v.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
    return `${v.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON`;
  };

  const slice = monthly.slice(startMonth - 1);
  const catSlice = categories.slice(startMonth - 1);

  /*
   * Taxe — ce s-a platit efectiv, pe luna acoperita, din extrasul firmei.
   *
   * Aici era o formula: CAM in fiecare luna, 1% micro in fiecare luna si 16%
   * dividende pe tot ce ramanea. Toate trei sunt false — CAM se plateste doar
   * cateva luni pe an, micro-ul e trimestrial, iar impozitul pe dividende se
   * datoreaza pe dividendele chiar distribuite. Pe iulie formula scotea 10.242
   * RON in loc de 7.325 cat s-a platit.
   */
  const taxesData = useMemo(
    () =>
      slice.map((m) => {
        const row: Record<string, string | number> = { label: m.label };
        for (const k of TAX_ORDER) {
          row[k] = round2(ronToDisplay((m.taxRon?.[k] ?? 0) / 100));
        }
        row.forecast = round2(ronToDisplay((m.taxForecastRon ?? 0) / 100));
        return row;
      }),
    [slice, ronToDisplay],
  );
  const { taxKeysPresent, taxColorMap } = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of slice) {
      for (const k of TAX_ORDER) totals[k] = (totals[k] ?? 0) + (m.taxRon?.[k] ?? 0);
    }
    const paid = TAX_ORDER.filter((k) => (totals[k] ?? 0) > 0);
    /*
     * Culoarea se da dupa marimea obligatiei pe tot anul, nu dupa ordinea din
     * stiva: cea mai mare ia tonul cel mai inchis, ca dungile marunte de
     * deasupra sa fie cele luminoase. Stiva ramane in TAX_ORDER, ca sa nu
     * sara segmentele de la o luna la alta.
     */
    const ranked = [...paid].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
    const colors: Record<string, string> = {};
    ranked.forEach((k, i) => {
      const step = Math.min(ranked.length, TAX_RAMP.length) - 1 - i;
      colors[k] = TAX_RAMP[Math.max(0, step)];
    });
    // Estimarea sta ultima in stiva, ca sa se citeasca limpede unde se
    // termina platit-ul si incepe de-plata.
    const withForecast = slice.some((m) => (m.taxForecastRon ?? 0) > 0)
      ? [...paid, "forecast"]
      : paid;
    return { taxKeysPresent: withForecast, taxColorMap: colors };
  }, [slice]);

  // Categories view — top 8 categories + "Other" bucket.
  const { catData, catKeys, catColorMap } = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of catSlice) {
      for (const [k, v] of Object.entries(m.categories)) {
        totals[k] = (totals[k] ?? 0) + v;
      }
    }
    const ranked = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const TOP = 8;
    const top = ranked.slice(0, TOP);
    const other = ranked.slice(TOP);
    /*
     * Galeata de rest se numeste "Other" — dar exista si o categorie reala cu
     * acelasi nume, iar cand amandoua ajung in grafic legenda arata "Other"
     * de doua ori si stiva incearca sa deseneze aceeasi cheie de doua ori.
     * Daca numele e deja luat, restul se aduna peste categoria existenta.
     */
    const overflowKey = "Other";
    const overflowCollides = top.includes(overflowKey);
    /*
     * Rampa se da invers: categoria cea mai mare primeste tonul cel mai
     * inchis, cea mai mica pe cel mai deschis. Un bloc de 18.836 RON se vede
     * oricum, dupa marime; o dunga de 298 RON se vede doar daca e cea mai
     * luminoasa culoare din stiva.
     */
    const colors: Record<string, string> = {};
    top.forEach((k, i) => {
      const step = Math.min(top.length, CATEGORY_PALETTE.length) - 1 - i;
      colors[k] = CATEGORY_PALETTE[Math.max(0, step)];
    });
    if (other.length > 0 && !overflowCollides) colors[overflowKey] = C(10);
    /*
     * Cheltuielile de pe firma ies din rampa calda si primesc albastru: nu
     * sunt "inca o categorie", sunt alt buzunar. Tot la spent, dar se vede.
     */
    if (colors[COMPANY_CATEGORY]) colors[COMPANY_CATEGORY] = C(2);
    const keys =
      other.length > 0 && !overflowCollides ? [...top, overflowKey] : top;
    const data = catSlice.map((m) => {
      const row: Record<string, number | string> = { label: m.label };
      for (const k of top) {
        row[k] = round2(ronToDisplay(ronFromBani(m.categories[k] ?? 0)));
      }
      if (other.length > 0) {
        let sum = 0;
        for (const k of other) sum += m.categories[k] ?? 0;
        const extra = round2(ronToDisplay(ronFromBani(sum)));
        row[overflowKey] =
          overflowCollides && typeof row[overflowKey] === "number"
            ? round2((row[overflowKey] as number) + extra)
            : extra;
      }
      return row;
    });
    return { catData: data, catKeys: keys, catColorMap: colors };
  }, [catSlice, ronToDisplay]);

  /*
   * Net view — incasat, cheltuit si cat a ramas.
   *
   * "Available" nu e o a treia cifra a lunii curente, ci restul lunii
   * TRECUTE: cat ti-a ramas din august dupa taxele lui august, adica ce ai
   * de cheltuit in septembrie. De aia bara e desenata punctat si de aia
   * tooltip-ul spune din ce luna vin banii.
   */
  const netData = useMemo(
    () =>
      slice.map((m, i) => ({
        label: m.label,
        earned: round2(usdToDisplay(m.earnedUsd / 100)),
        /*
         * "Spent" e o coloana impartita in doua: cat ai dat din buzunarul tau
         * si cat a platit firma. Totalul ramane acelasi, doar ca se vede din
         * ce cont a plecat — nu trebuie sa treci pe tab-ul de categorii ca sa
         * afli de ce a sarit o luna.
         */
        spentPersonal: round2(
          usdToDisplay((m.spentUsd - (m.spentCompanyUsd ?? 0)) / 100),
        ),
        spentCompany: round2(usdToDisplay((m.spentCompanyUsd ?? 0) / 100)),
        available: round2(usdToDisplay((m.availableUsd ?? 0) / 100)),
        from: i > 0 ? slice[i - 1].label : "",
      })),
    [slice, usdToDisplay],
  );

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="net">Încasat / cheltuit</TabsTrigger>
          <TabsTrigger value="categories">Categorii</TabsTrigger>
          <TabsTrigger value="taxes">Taxe</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="h-[300px] sm:h-[380px] w-full">
        {view === "taxes" && (
          <TaxesChart
            key="taxes"
            data={taxesData}
            keys={taxKeysPresent}
            colors={taxColorMap}
            fmt={formatMoney}
          />
        )}
        {view === "categories" && (
          <CategoriesChart
            key="categories"
            data={catData}
            keys={catKeys}
            colors={catColorMap}
            fmt={formatMoney}
          />
        )}
        {view === "net" && (
          <NetChart key="net" data={netData} fmt={formatMoney} />
        )}
      </div>
    </div>
  );
}

const baseAxis = {
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  stroke: "hsl(var(--muted-foreground))",
};

/*
 * Grila si axele stau in fundal, nu concureaza cu barele: linii punctate rare,
 * fara axa verticala, fara ticks. Numarul de pe axa Y e prescurtat la "13.5k"
 * ca sa incapa pe latimea fixa si sa nu sara graficul cand creste o luna.
 */
const baseGrid = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "2 5",
  strokeOpacity: 0.7,
  vertical: false,
};

const compactYAxis = {
  width: 46,
  tickMargin: 8,
  tickFormatter: (v: number) =>
    Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)),
};

const CHART_MARGIN = { top: 12, right: 4, left: 0, bottom: 0 };

/*
 * Bare drepte si late. Fara raza deloc: cu colturi rotunjite, o coloana de
 * 14px arata ca o pastila, nu ca o cantitate. In graficul cu trei serii,
 * `barGap={0}` le lipeste intre ele, asa ca fiecare luna citeste ca un bloc
 * compact, despartit clar de luna urmatoare.
 */
const BAR_RADIUS: [number, number, number, number] = [0, 0, 0, 0];
const BAR_MAX = 64;
/** Stivele au o singura coloana pe luna, deci isi permit sa fie mai groase. */
const STACK_GAP = "30%";

/**
 * Taie lunile goale de la coada. Cu decembrie desenat in octombrie, un sfert
 * din latime se duce pe aer, iar barele lunilor care chiar au date se subtiaza
 * degeaba. Lunile goale dinauntru raman — o luna fara incasari intre doua cu
 * incasari e o informatie, nu un spatiu liber.
 */
function trimTrailingEmpty<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
): T[] {
  let end = rows.length;
  while (
    end > 1 &&
    keys.every((k) => !rows[end - 1][k] || rows[end - 1][k] === 0)
  ) {
    end--;
  }
  return rows.slice(0, end);
}

/*
 * Bara estimata: gri, plina, cu contur punctat — exact ca „De plată (estimat)"
 * din tab-ul de taxe. Nu-si ia culoare proprie tocmai ca sa nu para inca o
 * categorie de bani, ci acelasi ban privit inainte sa plece.
 */
const ESTIMATE_STROKE = "hsl(var(--muted-foreground))";

const baseTooltipCursor = {
  fill: "hsl(var(--foreground))",
  fillOpacity: 0.05,
  radius: 8,
};

/** Barele cresc pe rand, nu toate odata — 700ms, decelerat. */
function barMotion(delay: number) {
  return {
    animationDuration: 700,
    animationBegin: delay,
    animationEasing: "ease-out" as const,
  };
}

type LegendItem = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};

/**
 * Selectia unei serii.
 *
 * Clic pe o intrare din legenda lasa in grafic doar seria aia — si, pentru ca
 * restul dispar, scara se recalculeaza pe ea. Asta e diferenta care conteaza:
 * "Groceries" inseamna 298 RON langa 18.836 de la "Other", deci intr-o stiva
 * comuna e o dunga de doi pixeli. Singura, umple graficul si i se vede forma
 * pe tot anul. Clic din nou pe aceeasi intrare aduce totul inapoi.
 */
function useSeriesSelect() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const select = (key: string) =>
    setSelected((prev) => (prev === key ? null : key));

  /** Cand nimic nu e selectat, hover-ul stinge restul — o previzualizare. */
  const opacityOf = (key: string) =>
    selected || !hovered || hovered === key ? 1 : 0.2;

  const isHidden = (key: string) => selected !== null && selected !== key;

  return { selected, select, hovered, setHovered, opacityOf, isHidden };
}

/**
 * Legenda proprie: deseneaza si pastila punctata a barei estimate (pe care
 * `iconType` din Recharts n-o are) si e in acelasi timp comutatorul seriilor.
 */
function ChartLegend({
  items,
  selected,
  onSelect,
  onHover,
}: {
  items: LegendItem[];
  selected?: string | null;
  onSelect?: (key: string) => void;
  onHover?: (key: string | null) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 pt-3 pl-0.5 text-[11px]"
      onMouseLeave={() => onHover?.(null)}
    >
      {items.map((it) => {
        const on = selected === it.key;
        const dimmed = selected !== null && selected !== undefined && !on;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect?.(it.key)}
            onMouseEnter={() => onHover?.(it.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px]",
              "transition-[background-color,border-color,color,opacity] duration-150 ease-expo",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              on
                ? "border-transparent bg-secondary text-foreground"
                : "border-transparent text-muted-foreground hover:bg-secondary/60",
              dimmed && "opacity-45",
            )}
            aria-pressed={on}
            title={on ? "Arată tot" : `Doar ${it.label}`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={
                it.dashed
                  ? { border: `1px dashed ${it.color}`, backgroundColor: "transparent" }
                  : { backgroundColor: it.color }
              }
            />
            {it.label}
          </button>
        );
      })}
      <span
        className={cn(
          "ml-1 text-[10px] text-muted-foreground/60 transition-opacity duration-200",
          selected ? "opacity-100" : "opacity-0",
        )}
      >
        clic din nou pentru tot
      </span>
    </div>
  );
}

/**
 * Custom Recharts tooltip. Hand-rendered (not just contentStyle) so we can:
 * - line up label / value in a clean two-column grid with tabular numbers
 * - relabel entries via a per-tooltip lookup
 * - optionally tack a summary row to the bottom (used for the tax total)
 */
type TooltipPayload = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
};
function ChartTooltip({
  active,
  payload,
  label,
  labels,
  colors,
  excludeFromTotal,
  totalLabel,
  hideZero,
  showShare,
  fmt,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  labels?: Record<string, string>;
  /** Culoare de afisat pentru un dataKey, cand cea din grafic nu se vede. */
  colors?: Record<string, string>;
  /** dataKeys to skip when computing the bottom-line total. Used to keep
   * "Net to owner" out of the tax total. */
  excludeFromTotal?: string[];
  /** Label for the total row. Falsy = no total row. */
  totalLabel?: string;
  /** Sari peste randurile pe zero. Pe luna mai nu are ce cauta un rand
   * "De plata (estimat) 0 RON" langa taxele chiar platite. */
  hideZero?: boolean;
  /** Adauga si cota din total langa fiecare rand. Util pe stive. */
  showShare?: boolean;
  fmt: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const numeric = payload.filter((p) => typeof p.value === "number");
  /*
   * Zerourile se ascund doar cand exista si altceva de aratat. Pe o luna in
   * care chiar totul e zero, filtrul lasa lista goala si tooltip-ul dispare cu
   * totul — iar "nimic" arata la fel ca un bug.
   */
  const nonZero = numeric.filter((p) => (p.value ?? 0) !== 0);
  const rows = hideZero && nonZero.length > 0 ? nonZero : numeric;
  if (rows.length === 0) return null;
  const total = rows
    .filter((p) => !excludeFromTotal?.includes(p.dataKey ?? p.name ?? ""))
    .reduce((a, p) => a + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-sm shadow-lg px-3.5 py-2.5 min-w-[180px]">
      {label && (
        <div className="font-display text-sm mb-2 text-foreground">{label}</div>
      )}
      <div className="space-y-1">
        {rows.map((p, i) => {
          const key = p.dataKey ?? p.name ?? String(i);
          const niceName = labels?.[key] ?? p.name ?? key;
          // Bara estimata are umplerea gri a fundalului: pe ea punctul din
          // tooltip ar fi invizibil, asa ca ii dam culoarea conturului.
          const dot = colors?.[key] ?? p.color;
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-4 text-[11px]"
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: dot }}
                />
                <span className="truncate" style={{ color: dot }}>
                  {niceName}
                </span>
              </span>
              <span className="inline-flex items-baseline gap-2 shrink-0">
                {showShare && total > 0 && (
                  <span className="tabular-nums text-muted-foreground/70 text-[10px]">
                    {Math.round(((p.value ?? 0) / total) * 100)}%
                  </span>
                )}
                <span className="tabular-nums text-foreground font-medium">
                  {fmt(p.value ?? 0)}
                </span>
              </span>
            </div>
          );
        })}
        {totalLabel && (!hideZero || total > 0) && (
          <>
            <div className="my-1.5 h-px bg-border" />
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="uppercase tracking-wider text-muted-foreground text-[10px]">
                {totalLabel}
              </span>
              <span className="tabular-nums text-foreground font-semibold">
                {fmt(total)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TaxesChart({
  data,
  keys,
  colors,
  fmt,
}: {
  data: Array<Record<string, string | number>>;
  /** Doar felurile de taxa care apar chiar in anul asta. */
  keys: string[];
  colors: Record<string, string>;
  fmt: (v: number) => string;
}) {
  const focus = useSeriesSelect();
  const visible = keys.filter((k) => !focus.isHidden(k));
  const rows = trimTrailingEmpty(data, keys);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={CHART_MARGIN} barCategoryGap={STACK_GAP}>
        <CartesianGrid {...baseGrid} />
        <XAxis dataKey="label" {...baseAxis} tickMargin={10} />
        <YAxis {...baseAxis} {...compactYAxis} />
        <Tooltip
          cursor={baseTooltipCursor}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as TooltipPayload[]}
              label={label as string}
              labels={TAX_LABELS}
              colors={{ forecast: ESTIMATE_STROKE }}
              totalLabel="Total plătit"
              excludeFromTotal={["forecast"]}
              hideZero
              fmt={fmt}
            />
          )}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          content={
            <ChartLegend
              items={keys.map((k) => ({
                key: k,
                label: TAX_LABELS[k] ?? k,
                color: k === "forecast" ? ESTIMATE_STROKE : colors[k] ?? C(10),
                dashed: k === "forecast",
              }))}
              selected={focus.selected}
              onSelect={focus.select}
              onHover={focus.setHovered}
            />
          }
        />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="t"
            hide={focus.isHidden(k)}
            onClick={() => focus.select(k)}
            cursor="pointer"
            fill={k === "forecast" ? "hsl(var(--secondary))" : colors[k]}
            fillOpacity={focus.opacityOf(k)}
            maxBarSize={BAR_MAX}
            // Estimarea sta ultima in stiva si e desenata punctat, ca sa nu
            // se citeasca la fel ca banii chiar plecati din cont.
            {...(k === "forecast"
              ? {
                  stroke: ESTIMATE_STROKE,
                  strokeOpacity: 0.75 * focus.opacityOf(k),
                  strokeDasharray: "4 3",
                  strokeWidth: 1,
                }
              : {})}
            radius={k === visible[visible.length - 1] ? BAR_RADIUS : undefined}
            {...barMotion(i * 45)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CategoriesChart({
  data,
  keys,
  colors,
  fmt,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  colors: Record<string, string>;
  fmt: (v: number) => string;
}) {
  const focus = useSeriesSelect();
  const visible = keys.filter((k) => !focus.isHidden(k));
  const rows = trimTrailingEmpty(data, keys);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={CHART_MARGIN} barCategoryGap={STACK_GAP}>
        <CartesianGrid {...baseGrid} />
        <XAxis dataKey="label" {...baseAxis} tickMargin={10} />
        <YAxis {...baseAxis} {...compactYAxis} />
        <Tooltip
          cursor={baseTooltipCursor}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as TooltipPayload[]}
              label={label as string}
              totalLabel="Total"
              hideZero
              showShare
              fmt={fmt}
            />
          )}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          content={
            <ChartLegend
              items={keys.map((k) => ({ key: k, label: k, color: colors[k] }))}
              selected={focus.selected}
              onSelect={focus.select}
              onHover={focus.setHovered}
            />
          }
        />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="c"
            hide={focus.isHidden(k)}
            onClick={() => focus.select(k)}
            cursor="pointer"
            fill={colors[k]}
            fillOpacity={focus.opacityOf(k)}
            maxBarSize={BAR_MAX}
            radius={k === visible[visible.length - 1] ? BAR_RADIUS : 0}
            {...barMotion(i * 45)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

type NetRow = {
  label: string;
  earned: number;
  spentPersonal: number;
  spentCompany: number;
  available: number;
  /** Luna din care provin banii disponibili — pentru tooltip. */
  from: string;
};

function NetChart({
  data,
  fmt,
}: {
  data: NetRow[];
  fmt: (v: number) => string;
}) {
  const hasAvailable = data.some((d) => d.available !== 0);
  const hasCompany = data.some((d) => d.spentCompany !== 0);
  const focus = useSeriesSelect();
  const rows = trimTrailingEmpty(data, [
    "earned",
    "spentPersonal",
    "spentCompany",
    "available",
  ]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={CHART_MARGIN} barCategoryGap="18%" barGap={0}>
        <CartesianGrid {...baseGrid} />
        <XAxis dataKey="label" {...baseAxis} tickMargin={10} />
        <YAxis {...baseAxis} {...compactYAxis} />
        <Tooltip
          cursor={baseTooltipCursor}
          content={({ active, payload, label }) => {
            const from = (payload?.[0]?.payload as NetRow | undefined)?.from;
            return (
              <ChartTooltip
                active={active}
                payload={payload as TooltipPayload[]}
                label={label as string}
                labels={{
                  earned: "Încasat",
                  spentPersonal: "Cheltuit — personal",
                  spentCompany: "Cheltuit — firmă",
                  available: from ? `Disponibil (din ${from})` : "Disponibil",
                }}
                colors={{ available: SERIES.available }}
                hideZero
                fmt={fmt}
              />
            );
          }}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          content={
            <ChartLegend
              items={[
                { key: "earned", label: "încasat", color: SERIES.earned },
                { key: "spentPersonal", label: "cheltuit", color: SERIES.spent },
                ...(hasCompany
                  ? [
                      {
                        key: "spentCompany",
                        label: "cheltuit — firmă",
                        color: SERIES.company,
                      },
                    ]
                  : []),
                ...(hasAvailable
                  ? [
                      {
                        key: "available",
                        label: "de cheltuit",
                        color: SERIES.available,
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
              selected={focus.selected}
              onSelect={focus.select}
              onHover={focus.setHovered}
            />
          }
        />
        <Bar
          dataKey="earned"
          hide={focus.isHidden("earned")}
          onClick={() => focus.select("earned")}
          cursor="pointer"
          fill={SERIES.earned}
          fillOpacity={focus.opacityOf("earned")}
          radius={BAR_RADIUS}
          maxBarSize={BAR_MAX}
          {...barMotion(0)}
        />
        <Bar
          dataKey="spentPersonal"
          stackId="spent"
          hide={focus.isHidden("spentPersonal")}
          onClick={() => focus.select("spentPersonal")}
          cursor="pointer"
          fill={SERIES.spent}
          fillOpacity={focus.opacityOf("spentPersonal")}
          radius={hasCompany ? undefined : BAR_RADIUS}
          maxBarSize={BAR_MAX}
          {...barMotion(90)}
        />
        {hasCompany && (
          <Bar
            dataKey="spentCompany"
            stackId="spent"
            hide={focus.isHidden("spentCompany")}
            onClick={() => focus.select("spentCompany")}
            cursor="pointer"
            fill={SERIES.company}
            fillOpacity={focus.opacityOf("spentCompany")}
            radius={BAR_RADIUS}
            maxBarSize={BAR_MAX}
            {...barMotion(120)}
          />
        )}
        {hasAvailable && (
          <Bar
            dataKey="available"
            hide={focus.isHidden("available")}
            onClick={() => focus.select("available")}
            cursor="pointer"
            /*
             * Verde-umbra, umplere abia prezenta, contur punctat: banii sunt
             * reali, dar nu au intrat inca in cont in luna asta — bara nu
             * trebuie sa arate la fel de solida ca incasarile.
             */
            fill={SERIES.available}
            fillOpacity={0.14 * focus.opacityOf("available")}
            stroke={SERIES.available}
            strokeOpacity={0.95 * focus.opacityOf("available")}
            strokeDasharray="4 3"
            strokeWidth={1}
            radius={BAR_RADIUS}
            maxBarSize={BAR_MAX}
            {...barMotion(180)}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

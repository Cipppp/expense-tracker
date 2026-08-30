"use client";

import { useMemo, useState } from "react";
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

export type MonthlyDatum = {
  /** Taxe chiar platite pentru luna asta, pe fel, in bani RON. */
  taxRon?: Record<string, number>;
  label: string;
  earnedUsd: number;     // cents
  spentRon: number;      // bani
  spentUsd: number;      // cents
};

export type MonthlyCategoryDatum = {
  label: string;
  categories: Record<string, number>; // category → bani
};

type View = "taxes" | "categories" | "net";

const CATEGORY_PALETTE = [
  "#c65c2a", // terracotta
  "#2f7a5c", // sage
  "#456d99", // dusty blue
  "#9b6b3f", // brown
  "#a8323f", // deep red
  "#7a4b8c", // plum
  "#566d2c", // olive
  "#3d8a8a", // teal
  "#b8853a", // amber
  "#525252", // slate
];

/*
 * Felurile de taxa, exact cum apar in extrasul bancar. Cheile sunt cele din
 * TaxPayment.kind, ca sa nu existe o a doua taxonomie care sa iasa din pas.
 */
const TAX_COLORS: Record<string, string> = {
  bs_bas: "#c65c2a",
  cam: "#9b6b3f",
  micro: "#a8323f",
  dividende: "#7a4b8c",
  venit: "#2f6f8f",
  tva: "#6b7f3a",
  alte: "#6b6875",
};

const TAX_LABELS: Record<string, string> = {
  bs_bas: "BS + BAS",
  cam: "CAM",
  micro: "Impozit micro",
  dividende: "Impozit dividende",
  venit: "Impozit venit",
  tva: "TVA",
  alte: "Alte obligații",
};
const TAX_ORDER = ["bs_bas", "cam", "micro", "venit", "dividende", "tva", "alte"];

export function UnifiedMonthlyChart({
  monthly,
  categories,
  fxRonToUsd,
  bsBasRon,
  camRon,
  microPct,
  dividendePct,
  startMonth,
  displayCurrency,
}: {
  monthly: MonthlyDatum[];
  categories: MonthlyCategoryDatum[];
  fxRonToUsd: number;
  bsBasRon: number;
  camRon: number;
  microPct: number;
  dividendePct: number;
  startMonth: number;
  displayCurrency: DisplayCurrency;
}) {
  const [view, setView] = useState<View>("net");

  // Convert any RON-major-unit value into the display currency's major
  // unit. We chart in major units (e.g., 1415 RON = 1415 or $319.08).
  const ronToDisplay = (ron: number) =>
    displayCurrency === "RON" ? ron : ron * fxRonToUsd;
  const usdToDisplay = (usd: number) =>
    displayCurrency === "USD" ? usd : usd / fxRonToUsd;
  const formatMoney = (v: number) =>
    displayCurrency === "USD"
      ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `${v.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON`;

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
        return row;
      }),
    [slice, displayCurrency, fxRonToUsd],
  );
  const taxKeysPresent = useMemo(
    () => TAX_ORDER.filter((k) => slice.some((m) => (m.taxRon?.[k] ?? 0) > 0)),
    [slice],
  );

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
    const colors: Record<string, string> = {};
    top.forEach((k, i) => {
      colors[k] = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    });
    if (other.length > 0) colors.Other = "#525252";
    const keys = other.length > 0 ? [...top, "Other"] : top;
    const data = catSlice.map((m) => {
      const row: Record<string, number | string> = { label: m.label };
      for (const k of top) {
        row[k] = round2(ronToDisplay(ronFromBani(m.categories[k] ?? 0)));
      }
      if (other.length > 0) {
        let sum = 0;
        for (const k of other) sum += m.categories[k] ?? 0;
        row.Other = round2(ronToDisplay(ronFromBani(sum)));
      }
      return row;
    });
    return { catData: data, catKeys: keys, catColorMap: colors };
  }, [catSlice, displayCurrency, fxRonToUsd]);

  // Net view — earned vs spent.
  const netData = useMemo(
    () =>
      slice.map((m) => ({
        label: m.label,
        earned: round2(usdToDisplay(m.earnedUsd / 100)),
        spent: round2(usdToDisplay(m.spentUsd / 100)),
      })),
    [slice, displayCurrency, fxRonToUsd],
  );

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="net">Earned vs spent</TabsTrigger>
          <TabsTrigger value="categories">Spending categories</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="h-[300px] sm:h-[380px] w-full">
        {view === "taxes" && (
          <TaxesChart key="taxes" data={taxesData} keys={taxKeysPresent} fmt={formatMoney} />
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

const baseTooltipCursor = {
  fill: "hsl(var(--secondary))",
  opacity: 0.4,
};

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
  excludeFromTotal,
  totalLabel,
  fmt,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  labels?: Record<string, string>;
  /** dataKeys to skip when computing the bottom-line total. Used to keep
   * "Net to owner" out of the tax total. */
  excludeFromTotal?: string[];
  /** Label for the total row. Falsy = no total row. */
  totalLabel?: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => typeof p.value === "number");
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
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-4 text-[11px]"
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate" style={{ color: p.color }}>
                  {niceName}
                </span>
              </span>
              <span className="tabular-nums text-foreground font-medium">
                {fmt(p.value ?? 0)}
              </span>
            </div>
          );
        })}
        {totalLabel && (
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
  fmt,
}: {
  data: Array<Record<string, string | number>>;
  /** Doar felurile de taxa care apar chiar in anul asta. */
  keys: string[];
  fmt: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="22%"
      >
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" vertical={false} />
        <XAxis dataKey="label" {...baseAxis} />
        <YAxis
          {...baseAxis}
          tickFormatter={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <Tooltip
          cursor={baseTooltipCursor}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as TooltipPayload[]}
              label={label as string}
              labels={TAX_LABELS}
              totalLabel="Total plătit"
              fmt={fmt}
            />
          )}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          formatter={(value) => TAX_LABELS[value as keyof typeof TAX_LABELS] ?? value}
        />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="t"
            fill={TAX_COLORS[k]}
            radius={i === keys.length - 1 ? [4, 4, 0, 0] : undefined}
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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="22%"
      >
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" vertical={false} />
        <XAxis dataKey="label" {...baseAxis} />
        <YAxis
          {...baseAxis}
          tickFormatter={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <Tooltip
          cursor={baseTooltipCursor}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as TooltipPayload[]}
              label={label as string}
              totalLabel="Total"
              fmt={fmt}
            />
          )}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
        />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="c"
            fill={colors[k]}
            radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function NetChart({
  data,
  fmt,
}: {
  data: Array<{ label: string; earned: number; spent: number }>;
  fmt: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="26%"
      >
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" vertical={false} />
        <XAxis dataKey="label" {...baseAxis} />
        <YAxis
          {...baseAxis}
          tickFormatter={(v) =>
            v >= 1000
              ? `${(v / 1000).toFixed(1)}k`
              : String(Math.round(v))
          }
        />
        <Tooltip
          cursor={baseTooltipCursor}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as TooltipPayload[]}
              label={label as string}
              labels={{ earned: "Earned", spent: "Spent" }}
              fmt={fmt}
            />
          )}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
        />
        <Bar dataKey="earned" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

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

const TAX_COLORS = {
  bsBas: "#c65c2a",
  cam: "#9b6b3f",
  micro: "#a8323f",
  dividende: "#7a4b8c",
  netOwner: "#2f7a5c",
};

const TAX_LABELS = {
  bsBas: "BS + BAS",
  cam: "CAM",
  micro: "Impozit micro (1%)",
  dividende: "Impozit dividende (16%)",
  netOwner: "Net to owner",
};

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

  // Taxes view — stacked breakdown per month.
  const taxesData = useMemo(() => {
    const bsBasMonthly = bsBasRon / 100;
    const camMonthly = camRon / 100;
    return slice.map((m) => {
      const revenueRon = m.earnedUsd / 100 / fxRonToUsd;
      const micro = revenueRon * microPct;
      const beforeDiv = Math.max(0, revenueRon - bsBasMonthly - camMonthly - micro);
      const dividende = beforeDiv * dividendePct;
      const netOwner = Math.max(0, beforeDiv - dividende);
      return {
        label: m.label,
        bsBas: round2(ronToDisplay(bsBasMonthly)),
        cam: round2(ronToDisplay(camMonthly)),
        micro: round2(ronToDisplay(micro)),
        dividende: round2(ronToDisplay(dividende)),
        netOwner: round2(ronToDisplay(netOwner)),
      };
    });
  }, [slice, fxRonToUsd, bsBasRon, camRon, microPct, dividendePct, displayCurrency]);

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
          <TaxesChart key="taxes" data={taxesData} fmt={formatMoney} />
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

const baseTooltip = {
  cursor: { fill: "hsl(var(--secondary))", opacity: 0.4 },
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    padding: "10px 12px",
  },
  labelStyle: {
    color: "hsl(var(--foreground))",
    fontFamily: "var(--font-display)",
    marginBottom: "6px",
    fontSize: "13px",
  },
};

function TaxesChart({
  data,
  fmt,
}: {
  data: Array<{
    label: string;
    bsBas: number;
    cam: number;
    micro: number;
    dividende: number;
    netOwner: number;
  }>;
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
          {...baseTooltip}
          formatter={(value: number, name) => [
            fmt(value),
            TAX_LABELS[name as keyof typeof TAX_LABELS] ?? name,
          ]}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          formatter={(value) => TAX_LABELS[value as keyof typeof TAX_LABELS] ?? value}
        />
        <Bar dataKey="bsBas" stackId="t" fill={TAX_COLORS.bsBas} />
        <Bar dataKey="cam" stackId="t" fill={TAX_COLORS.cam} />
        <Bar dataKey="micro" stackId="t" fill={TAX_COLORS.micro} />
        <Bar dataKey="dividende" stackId="t" fill={TAX_COLORS.dividende} />
        <Bar dataKey="netOwner" stackId="t" fill={TAX_COLORS.netOwner} radius={[4, 4, 0, 0]} />
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
          {...baseTooltip}
          formatter={(value: number, name) => [fmt(value), name]}
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
          {...baseTooltip}
          formatter={(value: number, name) => [
            fmt(value),
            name === "earned" ? "Earned" : "Spent",
          ]}
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

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
import { fmtRon, ronFromBani } from "@/lib/format";

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
}: {
  monthly: MonthlyDatum[];
  categories: MonthlyCategoryDatum[];
  fxRonToUsd: number;
  bsBasRon: number;
  camRon: number;
  microPct: number;
  dividendePct: number;
  startMonth: number;
}) {
  const [view, setView] = useState<View>("taxes");

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
        bsBas: round2(bsBasMonthly),
        cam: round2(camMonthly),
        micro: round2(micro),
        dividende: round2(dividende),
        netOwner: round2(netOwner),
      };
    });
  }, [slice, fxRonToUsd, bsBasRon, camRon, microPct, dividendePct]);

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
        row[k] = round2(ronFromBani(m.categories[k] ?? 0));
      }
      if (other.length > 0) {
        let sum = 0;
        for (const k of other) sum += m.categories[k] ?? 0;
        row.Other = round2(ronFromBani(sum));
      }
      return row;
    });
    return { catData: data, catKeys: keys, catColorMap: colors };
  }, [catSlice]);

  // Net view — earned vs spent.
  const netData = useMemo(
    () =>
      slice.map((m) => ({
        label: m.label,
        earned: round2(m.earnedUsd / 100),
        spent: round2(m.spentUsd / 100),
      })),
    [slice],
  );

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="categories">Spending categories</TabsTrigger>
          <TabsTrigger value="net">Earned vs spent</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={view === "taxes" ? taxesData : view === "categories" ? catData : netData}
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            barCategoryGap={view === "net" ? "26%" : "22%"}
          >
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="2 2"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--secondary))", opacity: 0.4 }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                padding: "10px 12px",
              }}
              labelStyle={{
                color: "hsl(var(--foreground))",
                fontFamily: "var(--font-display)",
                marginBottom: "6px",
                fontSize: "13px",
              }}
              formatter={(value: number, name) => {
                if (view === "net") {
                  return [`$${value.toLocaleString()}`, name === "earned" ? "Earned" : "Spent"];
                }
                if (view === "taxes") {
                  return [
                    `${value.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON`,
                    TAX_LABELS[name as keyof typeof TAX_LABELS] ?? name,
                  ];
                }
                return [
                  `${value.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON`,
                  name,
                ];
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="left"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) =>
                view === "taxes"
                  ? TAX_LABELS[value as keyof typeof TAX_LABELS] ?? value
                  : value
              }
            />

            {view === "taxes" && (
              <>
                <Bar dataKey="bsBas" stackId="t" fill={TAX_COLORS.bsBas} />
                <Bar dataKey="cam" stackId="t" fill={TAX_COLORS.cam} />
                <Bar dataKey="micro" stackId="t" fill={TAX_COLORS.micro} />
                <Bar dataKey="dividende" stackId="t" fill={TAX_COLORS.dividende} />
                <Bar
                  dataKey="netOwner"
                  stackId="t"
                  fill={TAX_COLORS.netOwner}
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}

            {view === "categories" &&
              catKeys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="c"
                  fill={catColorMap[k]}
                  radius={i === catKeys.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}

            {view === "net" && (
              <>
                <Bar dataKey="earned" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

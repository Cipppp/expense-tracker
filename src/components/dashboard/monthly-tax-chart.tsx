"use client";

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

type MonthlyDatum = {
  label: string;
  bsBas: number;
  cam: number;
  micro: number;
  dividende: number;
  netOwner: number;
};

/**
 * Per-month tax stack. For each month we compute:
 *   - BS + BAS (1,415 RON/mo fixed)
 *   - CAM (84 RON/mo fixed)
 *   - Impozit micro (1% × monthly revenue)
 *   - Impozit dividende (16% × (revenue − fixed taxes − micro)) ASSUMING
 *     the owner extracts EVERYTHING as dividends that month
 *   - Net to owner = revenue − (everything above)
 *
 * The chart shows months from `startMonth` onwards.
 */
export function MonthlyTaxChart({
  monthly,
  fxRonToUsd,
  bsBasRon,
  camRon,
  microPct,
  dividendePct,
  startMonth,
}: {
  monthly: Array<{ label: string; earnedUsd: number; spentUsd: number }>;
  fxRonToUsd: number;
  bsBasRon: number;  // bani
  camRon: number;    // bani
  microPct: number;
  dividendePct: number;
  startMonth: number; // 1-12, e.g. 4 for April
}) {
  const bsBasMonthly = bsBasRon / 100;
  const camMonthly = camRon / 100;

  // Slice to months from startMonth onwards (skip Jan-Mar if startMonth=4).
  const slice = monthly.slice(startMonth - 1);

  const data: MonthlyDatum[] = slice.map((m) => {
    const revenueRon = m.earnedUsd / 100 / fxRonToUsd;
    const micro = revenueRon * microPct;
    const beforeDividende = Math.max(0, revenueRon - bsBasMonthly - camMonthly - micro);
    const dividende = beforeDividende * dividendePct;
    const netOwner = Math.max(0, beforeDividende - dividende);
    return {
      label: m.label,
      bsBas: round2(bsBasMonthly),
      cam: round2(camMonthly),
      micro: round2(micro),
      dividende: round2(dividende),
      netOwner: round2(netOwner),
    };
  });

  return (
    <div className="space-y-4">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            barCategoryGap="20%"
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
              formatter={(value: number, name) => [
                `${value.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON`,
                LABELS[name as keyof typeof LABELS] ?? name,
              ]}
            />
            <Legend
              verticalAlign="bottom"
              align="left"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => LABELS[value as keyof typeof LABELS] ?? value}
            />
            <Bar dataKey="bsBas" stackId="tax" fill={COLORS.bsBas} radius={0} />
            <Bar dataKey="cam" stackId="tax" fill={COLORS.cam} radius={0} />
            <Bar dataKey="micro" stackId="tax" fill={COLORS.micro} radius={0} />
            <Bar dataKey="dividende" stackId="tax" fill={COLORS.dividende} radius={0} />
            <Bar
              dataKey="netOwner"
              stackId="tax"
              fill={COLORS.netOwner}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const COLORS = {
  bsBas: "#c65c2a",       // terracotta — primary contribution
  cam: "#9b6b3f",         // brown — work insurance
  micro: "#a8323f",       // deep red — revenue tax
  dividende: "#7a4b8c",   // plum — dividend tax
  netOwner: "#2f7a5c",    // sage — what the owner keeps
};

const LABELS = {
  bsBas: "BS + BAS",
  cam: "CAM",
  micro: "Impozit micro (1%)",
  dividende: "Impozit dividende (16%)",
  netOwner: "Net to owner",
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

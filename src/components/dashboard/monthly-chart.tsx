"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function MonthlyChart({
  data,
}: {
  data: Array<{ label: string; spentUsd: number; earnedUsd: number }>;
}) {
  // Recharts wants numbers in major units for axis labels.
  const chartData = data.map((d) => ({
    label: d.label,
    spent: Math.round(d.spentUsd / 100),
    earned: Math.round(d.earnedUsd / 100),
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" vertical={false} />
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
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{
              color: "hsl(var(--foreground))",
              fontFamily: "var(--font-display)",
              marginBottom: "4px",
            }}
            formatter={(value: number, name) => [
              `$${value.toLocaleString()}`,
              name === "spent" ? "Spent" : "Earned",
            ]}
          />
          <Bar dataKey="earned" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

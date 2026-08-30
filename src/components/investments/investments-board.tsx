"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "@/lib/icons";
import { fmtDisplay, ronBaniToDisplay, type DisplayCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Portfolio } from "@/lib/investments";

const PALETTE = [
  "hsl(var(--chart-2))", "hsl(var(--chart-1))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--action))",
];

type HoldingRow = {
  symbol: string; name: string; quantity: string; avgCost: string;
  currency: string; source: string;
};
type SavingsRow = { label: string; amount: string; currency: string };

export function InvestmentsBoard({
  portfolio, snapshots, displayCurrency, fxRonToUsd,
}: {
  portfolio: Portfolio;
  snapshots: Array<{ day: string; totalRon: number }>;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<null | "holdings" | "savings">(null);

  const fmt = (bani: number | null) =>
    bani === null
      ? "—"
      : fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  const num = (n: number | null, d = 2) =>
    n === null ? "—" : n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (n: number | null) => (n === null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

  const [holdings, setHoldings] = useState<HoldingRow[]>(() =>
    portfolio.holdings.map((h) => ({
      symbol: h.symbol, name: h.name ?? "", quantity: String(h.quantity),
      avgCost: h.avgCost === null ? "" : String(h.avgCost),
      currency: h.currency, source: h.source,
    })),
  );
  const [savings, setSavings] = useState<SavingsRow[]>(() =>
    portfolio.savings.map((s) => ({
      label: s.label, amount: String(s.amount), currency: s.currency,
    })),
  );

  function save(kind: "holdings" | "savings") {
    start(async () => {
      const rows =
        kind === "holdings"
          ? holdings
              .filter((h) => h.symbol.trim())
              .map((h) => ({
                symbol: h.symbol, name: h.name || null,
                quantity: Number(h.quantity) || 0,
                avgCost: h.avgCost === "" ? null : Number(h.avgCost),
                currency: h.currency || "USD", source: h.source || "manual",
              }))
          : savings
              .filter((s) => s.label.trim())
              .map((s) => ({
                label: s.label, amount: Number(s.amount) || 0,
                currency: s.currency || "RON",
              }));
      const res = await fetch("/api/investments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, rows }),
      });
      if (!res.ok) {
        toast.error("Couldn't save");
        return;
      }
      toast.success("Saved — revaluing at live prices");
      setEditing(null);
      router.refresh();
    });
  }

  const alloc = useMemo(
    () => portfolio.holdings.filter((h) => (h.valueRon ?? 0) > 0),
    [portfolio.holdings],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Positions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Quantities are yours to set; price, currency and the RON value
                are pulled live, so net worth moves with the market.
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => setEditing(editing === "holdings" ? null : "holdings")}
            >
              {editing === "holdings" ? "Cancel" : "Edit"}
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {editing === "holdings" ? (
              <Editor
                rows={holdings}
                onChange={setHoldings}
                pending={pending}
                onSave={() => save("holdings")}
                blank={{ symbol: "", name: "", quantity: "0", avgCost: "", currency: "USD", source: "manual" }}
                columns={[
                  { key: "symbol", label: "Symbol", placeholder: "MSFT", w: "w-28" },
                  { key: "source", label: "Where", placeholder: "IBKR", w: "w-24" },
                  { key: "quantity", label: "Qty", type: "number", w: "w-28" },
                  { key: "avgCost", label: "Avg cost", type: "number", w: "w-28" },
                  { key: "currency", label: "Cur", w: "w-20" },
                ]}
              />
            ) : portfolio.holdings.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No positions yet — hit Edit and add one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr>
                      {["Symbol", "Where", "Qty", "Price", "Today", "Value", "P&L"].map((h, i) => (
                        <th key={h} className={cn("eyebrow text-[10px] px-4 py-2.5 border-b border-border", i > 1 && "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((h) => (
                      <tr key={h.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-semibold">{h.symbol}</span>
                          {h.name ? <span className="text-muted-foreground"> {h.name}</span> : null}
                          {h.stale && (
                            <span className="ml-1.5 text-[10px] text-accent-text dark:text-accent">no price</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{h.source}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {num(h.quantity, h.quantity % 1 ? 4 : 0)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {num(h.price)} <span className="text-muted-foreground text-[11px]">{h.currency}</span>
                        </td>
                        <td className={cn("px-4 py-3 text-right tabular-nums",
                          h.changePct === null ? "" : h.changePct >= 0 ? "text-success" : "text-destructive")}>
                          {pct(h.changePct)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmt(h.valueRon)}
                          <div className="text-[11px] text-muted-foreground">
                            {(h.weight * 100).toFixed(1)}% of stocks
                          </div>
                        </td>
                        <td className={cn("px-4 py-3 text-right tabular-nums",
                          h.pnl === null ? "" : h.pnl >= 0 ? "text-success" : "text-destructive")}>
                          {h.pnl === null ? "—" : `${h.pnl >= 0 ? "+" : ""}${num(h.pnl)} ${h.currency}`}
                          {h.pnlPct !== null && (
                            <span className="text-muted-foreground text-[11px]"> {pct(h.pnlPct)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              What each position weighs.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            {alloc.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
            ) : (
              <Donut
                items={alloc.map((h, i) => ({
                  label: `${h.symbol} · ${h.source}`,
                  value: h.valueRon ?? 0,
                  color: PALETTE[i % PALETTE.length],
                }))}
                total={portfolio.stocksRon}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Savings &amp; accounts</CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Anything that isn&apos;t a tracked position: current accounts,
                deposits, pension, or cash sitting at a broker.
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => setEditing(editing === "savings" ? null : "savings")}
            >
              {editing === "savings" ? "Cancel" : "Edit"}
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {editing === "savings" ? (
              <Editor
                rows={savings}
                onChange={setSavings}
                pending={pending}
                onSave={() => save("savings")}
                blank={{ label: "", amount: "0", currency: "RON" }}
                columns={[
                  { key: "label", label: "Account", placeholder: "ING deposit", w: "flex-1" },
                  { key: "amount", label: "Amount", type: "number", w: "w-36" },
                  { key: "currency", label: "Cur", w: "w-20" },
                ]}
              />
            ) : portfolio.savings.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No accounts yet — hit Edit and add one.
              </p>
            ) : (
              <table className="w-full text-[13.5px]">
                <tbody>
                  {portfolio.savings.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{s.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {num(s.amount)} {s.currency}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums w-40">{fmt(s.valueRon)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trend</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              One point per day you open this page.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <Trend snapshots={snapshots} fmt={fmt} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- editor generic pe randuri ------------------------------------------ */
function Editor<T extends Record<string, string>>({
  rows, onChange, onSave, pending, blank, columns,
}: {
  rows: T[];
  onChange: (r: T[]) => void;
  onSave: () => void;
  pending: boolean;
  blank: T;
  columns: Array<{ key: keyof T & string; label: string; placeholder?: string; type?: string; w: string }>;
}) {
  const list = rows.length ? rows : [blank];
  const set = (i: number, k: string, v: string) => {
    const next = [...list];
    next[i] = { ...next[i], [k]: v };
    onChange(next);
  };
  return (
    <div className="p-4 space-y-2">
      <div className="hidden sm:flex gap-2 px-1">
        {columns.map((c) => (
          <div key={c.key} className={cn("eyebrow text-[10px]", c.w)}>{c.label}</div>
        ))}
        <div className="w-9" />
      </div>
      {list.map((r, i) => (
        <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          {columns.map((c) => (
            <Input
              key={c.key}
              className={c.w}
              type={c.type}
              step={c.type === "number" ? "any" : undefined}
              placeholder={c.placeholder ?? c.label}
              value={r[c.key] ?? ""}
              onChange={(e) => set(i, c.key, e.target.value)}
            />
          ))}
          <Button
            variant="ghost" size="icon" className="shrink-0"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            aria-label="Remove row"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => onChange([...list, blank])}>
          <Plus className="h-3.5 w-3.5" /> Add row
        </Button>
        <Button variant="accent" size="sm" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

/* --- inel de alocare ----------------------------------------------------- */
function Donut({
  items, total,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const R = 54, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-[140px] w-[140px] shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="17" />
        {items.map((it) => {
          const frac = Math.max(0, Math.min(1, it.value / (total || 1)));
          const len = frac * C;
          // Un segment care acopera tot cercul se deseneaza ca cerc plin: un
          // dasharray cu gap 0 se randeaza inconsistent intre motoare.
          const el =
            frac > 0.999 ? (
              <circle key={it.label} cx="70" cy="70" r={R} fill="none" stroke={it.color} strokeWidth="17" />
            ) : (
              <circle
                key={it.label} cx="70" cy="70" r={R} fill="none" stroke={it.color} strokeWidth="17"
                strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
                strokeDashoffset={(-off).toFixed(2)}
                transform="rotate(-90 70 70)"
              />
            );
          off += len;
          return el;
        })}
      </svg>
      <div className="flex-1 min-w-[150px] space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2.5 text-[12.5px]">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
            <span className="flex-1 truncate">{it.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {((it.value / (total || 1)) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Trend({
  snapshots, fmt,
}: {
  snapshots: Array<{ day: string; totalRon: number }>;
  fmt: (n: number | null) => string;
}) {
  if (snapshots.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        The chart appears once there are two daily snapshots.
      </p>
    );
  }
  const W = 320, H = 130, P = { t: 10, r: 6, b: 18, l: 6 };
  const ys = snapshots.map((s) => s.totalRon);
  const min = Math.min(...ys) * 0.995, max = Math.max(...ys) * 1.005;
  const X = (i: number) => P.l + (i / (snapshots.length - 1)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const line = ys.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const last = snapshots[snapshots.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <path
          d={`${line} L ${X(snapshots.length - 1).toFixed(1)} ${H - P.b} L ${X(0).toFixed(1)} ${H - P.b} Z`}
          fill="hsl(var(--action) / 0.12)"
        />
        <path d={line} fill="none" stroke="hsl(var(--action))" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{snapshots[0].day}</span>
        <span className="tabular-nums">{fmt(last.totalRon)}</span>
      </div>
    </div>
  );
}

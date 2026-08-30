"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown } from "@/lib/icons";
import { fmtDisplay, ronBaniToDisplay, type DisplayCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Portfolio, ValuedHolding } from "@/lib/investments";

const PALETTE = [
  "hsl(var(--chart-2))", "hsl(var(--chart-1))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--action))",
];

type SortKey = "value" | "symbol" | "today" | "pnl" | "weight";

export function InvestmentsBoard({
  portfolio, displayCurrency, fxRonToUsd,
}: {
  portfolio: Portfolio;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<null | "holdings" | "savings">(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("value");
  const [hover, setHover] = useState<string | null>(null);

  const fmt = (bani: number | null) =>
    bani === null
      ? "—"
      : fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  const num = (n: number | null, d = 2) =>
    n === null ? "—" : n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (n: number | null) => (n === null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
  const tone = (n: number | null | undefined) =>
    n == null ? "" : n >= 0 ? "text-success" : "text-destructive";

  const [holdings, setHoldings] = useState(() =>
    portfolio.holdings.map((h) => ({
      symbol: h.symbol, name: h.name ?? "", quantity: String(h.quantity),
      avgCost: h.avgCost === null ? "" : String(h.avgCost),
      currency: h.currency, source: h.source,
    })),
  );
  const [savings, setSavings] = useState(() =>
    portfolio.savings.map((s) => ({
      label: s.label, amount: String(s.amount), currency: s.currency,
    })),
  );

  function save(kind: "holdings" | "savings") {
    start(async () => {
      const rows =
        kind === "holdings"
          ? holdings.filter((h) => h.symbol.trim()).map((h) => ({
              symbol: h.symbol, name: h.name || null,
              quantity: Number(h.quantity) || 0,
              avgCost: h.avgCost === "" ? null : Number(h.avgCost),
              currency: h.currency || "USD", source: h.source || "manual",
            }))
          : savings.filter((s) => s.label.trim()).map((s) => ({
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

  const sorted = useMemo(() => {
    const c = [...portfolio.holdings];
    const by: Record<SortKey, (a: ValuedHolding, b: ValuedHolding) => number> = {
      value: (a, b) => (b.valueRon ?? 0) - (a.valueRon ?? 0),
      weight: (a, b) => b.weight - a.weight,
      symbol: (a, b) => a.symbol.localeCompare(b.symbol),
      today: (a, b) => (b.changePct ?? -999) - (a.changePct ?? -999),
      pnl: (a, b) => (b.pnlPct ?? -999) - (a.pnlPct ?? -999),
    };
    return c.sort(by[sort]);
  }, [portfolio.holdings, sort]);

  const alloc = sorted.filter((h) => (h.valueRon ?? 0) > 0);
  const colorOf = (id: string) =>
    PALETTE[alloc.findIndex((h) => h.id === id) % PALETTE.length];

  return (
    <div className="space-y-3 text-[12.5px]">
      {/* ---- rezumat dens ------------------------------------------------ */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
            <Stat label="Net worth" value={fmt(portfolio.totalRon)} big />
            <Stat
              label="Today"
              value={fmt(portfolio.dayChangeRon)}
              className={tone(portfolio.dayChangeRon)}
              hint={
                portfolio.stocksRon
                  ? pct((portfolio.dayChangeRon / portfolio.stocksRon) * 100)
                  : ""
              }
            />
            <Stat
              label="Unrealised P&L"
              value={fmt(portfolio.pnlRon)}
              className={tone(portfolio.pnlRon)}
              hint={portfolio.costRon ? pct((portfolio.pnlRon / portfolio.costRon) * 100) : ""}
            />
            <Stat label="Invested" value={fmt(portfolio.costRon)} hint="cost basis" />
            <Stat
              label="Savings"
              value={fmt(portfolio.savingsRon)}
              hint={`${portfolio.savings.length} account${portfolio.savings.length === 1 ? "" : "s"}`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        {/* ---- pozitii --------------------------------------------------- */}
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">Positions</span>
              <span className="text-[11px] text-muted-foreground">
                {portfolio.holdings.length} · live
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-7 rounded-md border border-border bg-background px-2 text-[11px]"
              >
                <option value="value">Sort: value</option>
                <option value="weight">Sort: weight</option>
                <option value="today">Sort: today</option>
                <option value="pnl">Sort: P&amp;L</option>
                <option value="symbol">Sort: symbol</option>
              </select>
              <Button
                variant="outline" size="sm" className="h-7 px-2.5 text-[11px]"
                onClick={() => setEditing(editing === "holdings" ? null : "holdings")}
              >
                {editing === "holdings" ? "Cancel" : "Edit"}
              </Button>
            </div>
          </div>

          {editing === "holdings" ? (
            <Editor
              rows={holdings} onChange={setHoldings} pending={pending}
              onSave={() => save("holdings")}
              blank={{ symbol: "", name: "", quantity: "0", avgCost: "", currency: "USD", source: "manual" }}
              columns={[
                { key: "symbol", label: "Symbol", placeholder: "MSFT", w: "w-28" },
                { key: "source", label: "Where", placeholder: "IBKR", w: "w-24" },
                { key: "quantity", label: "Qty", type: "number", w: "w-28" },
                { key: "avgCost", label: "Avg cost", type: "number", w: "w-28" },
                { key: "currency", label: "Cur", w: "w-[70px]" },
              ]}
            />
          ) : sorted.length === 0 ? (
            <p className="p-5 text-muted-foreground">No positions yet — hit Edit.</p>
          ) : (
            <div>
              {sorted.map((h) => {
                const isOpen = open === h.id;
                return (
                  <div
                    key={h.id}
                    onMouseEnter={() => setHover(h.id)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      hover === h.id && "bg-secondary/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : h.id)}
                      className="w-full grid grid-cols-12 items-center gap-2 px-4 py-2.5 text-left"
                    >
                      <div className="col-span-4 sm:col-span-3 flex items-center gap-2 min-w-0">
                        <span
                          className="h-6 w-1 rounded-full shrink-0"
                          style={{ background: colorOf(h.id) }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold leading-tight">
                            {h.symbol}
                            <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">
                              {h.source}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-muted-foreground truncate">
                            {h.name ?? h.exchange ?? ""}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 hidden sm:block">
                        <Spark data={h.series} up={(h.changePct ?? 0) >= 0} />
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-right tabular-nums">
                        <div>{num(h.price)}</div>
                        <div className={cn("text-[10.5px]", tone(h.changePct))}>
                          {pct(h.changePct)}
                        </div>
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-right tabular-nums">
                        <div>{fmt(h.valueRon)}</div>
                        <div className="text-[10.5px] text-muted-foreground">
                          {num(h.quantity, h.quantity % 1 ? 4 : 0)} @ {num(h.avgCost)}
                        </div>
                      </div>
                      <div className="col-span-2 text-right tabular-nums hidden sm:block">
                        <div className={tone(h.pnl)}>
                          {h.pnl === null ? "—" : `${h.pnl >= 0 ? "+" : ""}${num(h.pnl)}`}
                        </div>
                        <div className={cn("text-[10.5px]", tone(h.pnlPct))}>{pct(h.pnlPct)}</div>
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                        <span className="text-[10.5px] text-muted-foreground tabular-nums">
                          {(h.weight * 100).toFixed(1)}%
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform duration-300 ease-expo",
                            isOpen && "rotate-180",
                          )}
                        />
                      </div>
                    </button>

                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-expo",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                          <Range
                            label="Day range" low={h.dayLow} high={h.dayHigh}
                            at={h.price} currency={h.currency} num={num}
                          />
                          <Range
                            label="52-week range" low={h.weekLow52} high={h.weekHigh52}
                            at={h.price} currency={h.currency} num={num}
                          />
                          <Detail label="Market value" value={fmt(h.valueRon)} />
                          <Detail label="Cost basis" value={fmt(h.costRon)} />
                          <Detail
                            label="Today"
                            value={h.dayChange === null ? "—" : `${h.dayChange >= 0 ? "+" : ""}${num(h.dayChange)} ${h.currency}`}
                            className={tone(h.dayChange)}
                          />
                          <Detail label="Listed on" value={h.exchange ?? "—"} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ---- alocare -------------------------------------------------- */}
        <Card>
          <CardContent className="p-4">
            <div className="text-[13px] font-semibold mb-1">Allocation</div>
            <p className="text-[10.5px] text-muted-foreground mb-3">
              Hover a slice for the detail.
            </p>
            {alloc.length === 0 ? (
              <p className="text-muted-foreground">Nothing yet.</p>
            ) : (
              <Donut
                items={alloc.map((h) => ({
                  id: h.id, label: `${h.symbol} · ${h.source}`,
                  value: h.valueRon ?? 0, color: colorOf(h.id),
                  qty: h.quantity, price: h.price, currency: h.currency,
                  changePct: h.changePct, pnlPct: h.pnlPct,
                }))}
                total={portfolio.stocksRon}
                hover={hover}
                onHover={setHover}
                fmt={fmt}
                num={num}
                pct={pct}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- evolutie + economii ---------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[13px] font-semibold">Last month</span>
              <span className="text-[10.5px] text-muted-foreground">
                today&apos;s holdings valued at past prices
              </span>
            </div>
            <History data={portfolio.history} fmt={fmt} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold">Savings</span>
            <Button
              variant="outline" size="sm" className="h-7 px-2.5 text-[11px]"
              onClick={() => setEditing(editing === "savings" ? null : "savings")}
            >
              {editing === "savings" ? "Cancel" : "Edit"}
            </Button>
          </div>
          {editing === "savings" ? (
            <Editor
              rows={savings} onChange={setSavings} pending={pending}
              onSave={() => save("savings")}
              blank={{ label: "", amount: "0", currency: "RON" }}
              columns={[
                { key: "label", label: "Account", placeholder: "ING deposit", w: "flex-1 min-w-[120px]" },
                { key: "amount", label: "Amount", type: "number", w: "w-28" },
                { key: "currency", label: "Cur", w: "w-[70px]" },
              ]}
            />
          ) : portfolio.savings.length === 0 ? (
            <p className="p-5 text-muted-foreground">No accounts yet.</p>
          ) : (
            <div>
              {portfolio.savings.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border last:border-0">
                  <span className="truncate">{s.label}</span>
                  <span className="text-right shrink-0">
                    <span className="tabular-nums">{fmt(s.valueRon)}</span>
                    <span className="block text-[10.5px] text-muted-foreground tabular-nums">
                      {num(s.amount)} {s.currency}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Stat({
  label, value, hint, className, big,
}: {
  label: string; value: string; hint?: string; className?: string; big?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="eyebrow text-[10px]">{label}</div>
      <div
        className={cn(
          "metric mt-1.5 leading-none",
          big ? "text-[22px]" : "text-[17px]",
          className,
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className={cn("text-[10.5px] mt-1", className || "text-muted-foreground")}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums text-[11.5px]", className)}>{value}</span>
    </div>
  );
}

/** Bara de interval cu un marcaj unde sta pretul acum. */
function Range({
  label, low, high, at, currency, num,
}: {
  label: string; low: number | null; high: number | null; at: number | null;
  currency: string; num: (n: number | null, d?: number) => string;
}) {
  if (low === null || high === null || at === null || high <= low) {
    return <Detail label={label} value="—" />;
  }
  const pos = Math.max(0, Math.min(1, (at - low) / (high - low)));
  return (
    <div>
      <div className="flex justify-between text-[10.5px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {num(low)} – {num(high)} {currency}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-secondary mt-1.5">
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-action ring-2 ring-card"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
    </div>
  );
}

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const W = 78, H = 22;
  const d = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / (max - min || 1)) * (H - 3) - 1.5;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[22px]" preserveAspectRatio="none">
      <path
        d={d} fill="none" strokeWidth="1.5"
        stroke={up ? "hsl(var(--success))" : "hsl(var(--destructive))"}
      />
    </svg>
  );
}

type Slice = {
  id: string; label: string; value: number; color: string;
  qty: number; price: number | null; currency: string;
  changePct: number | null; pnlPct: number | null;
};

/**
 * Inelul de alocare, cu popup pe felie.
 *
 * Feliile sunt arce SVG, nu segmente de stroke: doar asa se poate calcula
 * unghiul de mijloc si aseza cartonasul in dreptul feliei, iar felia activa
 * se poate impinge putin in afara.
 */
function Donut({
  items, total, hover, onHover, fmt, num, pct,
}: {
  items: Slice[];
  total: number;
  hover: string | null;
  onHover: (id: string | null) => void;
  fmt: (n: number | null) => string;
  num: (n: number | null, d?: number) => string;
  pct: (n: number | null) => string;
}) {
  const CX = 100, CY = 100, R = 82, INNER = 50;
  let angle = -Math.PI / 2;
  const slices = items.map((it) => {
    const frac = Math.max(0, Math.min(1, it.value / (total || 1)));
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    return { it, a0, a1, mid: (a0 + a1) / 2, frac };
  });

  const active = slices.find((s) => s.it.id === hover) ?? null;
  const pt = (a: number, r: number) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];

  return (
    <div className="relative">
      <svg viewBox="0 0 200 200" className="w-full max-w-[260px] mx-auto block">
        {slices.map(({ it, a0, a1, frac }) => {
          const isActive = hover === it.id;
          // Felia activa iese putin din inel, pe bisectoarea ei.
          const push = isActive ? 5 : 0;
          const mid = (a0 + a1) / 2;
          const dx = Math.cos(mid) * push, dy = Math.sin(mid) * push;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
          const [ix1, iy1] = pt(a1, INNER), [ix0, iy0] = pt(a0, INNER);
          // Un singur segment care acopera tot cercul nu se poate desena ca
          // arc (start = final): se deseneaza ca doua inele concentrice.
          if (frac > 0.999) {
            return (
              <g key={it.id} onMouseEnter={() => onHover(it.id)} onMouseLeave={() => onHover(null)}>
                <circle cx={CX} cy={CY} r={(R + INNER) / 2} fill="none"
                        stroke={it.color} strokeWidth={R - INNER} />
              </g>
            );
          }
          return (
            <path
              key={it.id}
              d={`M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${INNER} ${INNER} 0 ${large} 0 ${ix0} ${iy0} Z`}
              fill={it.color}
              transform={`translate(${dx} ${dy})`}
              opacity={hover && !isActive ? 0.3 : 1}
              style={{ transition: "opacity .2s, transform .25s cubic-bezier(.16,1,.3,1)", cursor: "pointer" }}
              onMouseEnter={() => onHover(it.id)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
        {/* centrul: totalul, sau felia peste care stai */}
        <text x={CX} y={active ? CY - 6 : CY - 2} textAnchor="middle"
              className="fill-foreground" style={{ fontSize: active ? 13 : 15, fontWeight: 600 }}>
          {active ? `${(active.frac * 100).toFixed(1)}%` : fmt(total)}
        </text>
        {active && (
          <text x={CX} y={CY + 11} textAnchor="middle"
                className="fill-muted-foreground" style={{ fontSize: 9 }}>
            {active.it.label}
          </text>
        )}
      </svg>

      {/* popup-ul feliei */}
      {active && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2 z-10 pointer-events-none
                        rounded-lg border border-border bg-popover shadow-lg px-3 py-2 min-w-[160px]
                        animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: active.it.color }} />
            <span className="font-semibold text-[12px]">{active.it.label}</span>
          </div>
          <Line k="Value" v={fmt(active.it.value)} />
          <Line k="Weight" v={`${(active.frac * 100).toFixed(1)}%`} />
          <Line k="Qty" v={num(active.it.qty, active.it.qty % 1 ? 4 : 0)} />
          <Line k="Price" v={`${num(active.it.price)} ${active.it.currency}`} />
          <Line k="Today" v={pct(active.it.changePct)} />
          <Line k="P&L" v={pct(active.it.pnlPct)} />
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {slices.map(({ it, frac }) => (
          <div
            key={it.id}
            onMouseEnter={() => onHover(it.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "flex items-center gap-2 text-[11.5px] rounded px-1.5 py-0.5 -mx-1.5 transition-colors cursor-default",
              hover === it.id && "bg-secondary",
            )}
          >
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: it.color }} />
            <span className="flex-1 truncate">{it.label}</span>
            <span className="tabular-nums text-muted-foreground">{fmt(it.value)}</span>
            <span className="tabular-nums w-11 text-right">{(frac * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-[11px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

/**
 * Graficul pe ultima luna, cu cursor tras cu mouse-ul sau cu degetul.
 *
 * Punctul cel mai apropiat se cauta dupa pozitia X convertita in indice, nu
 * cautand prin toate punctele: seria e uniforma, deci e o inmultire, si merge
 * la fel de bine la 23 de puncte ca la 2300.
 */
function History({
  data, fmt,
}: {
  data: Array<{ day: string; valueRon: number }>;
  fmt: (n: number | null) => string;
}) {
  const [i, setI] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement | null>(null);

  if (data.length < 2) {
    return <p className="text-muted-foreground mt-2">Not enough price history yet.</p>;
  }

  const W = 700, H = 130, P = { t: 10, r: 4, b: 16, l: 4 };
  const ys = data.map((d) => d.valueRon);
  const min = Math.min(...ys), max = Math.max(...ys);
  const X = (k: number) => P.l + (k / (data.length - 1)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const line = ys.map((v, k) => `${k ? "L" : "M"}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");

  const first = ys[0];
  const shownIdx = i ?? ys.length - 1;
  const shown = ys[shownIdx];
  const change = first ? ((shown - first) / first) * 100 : 0;

  function track(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rel = (clientX - r.left) / r.width;          // 0..1 pe latimea desenata
    const inner = (rel * W - P.l) / (W - P.l - P.r);   // 0..1 in zona graficului
    setI(Math.max(0, Math.min(data.length - 1, Math.round(inner * (data.length - 1)))));
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5 min-h-[24px]">
        <span className="metric text-[19px]">{fmt(shown)}</span>
        <span className={cn("text-[11.5px]", change >= 0 ? "text-success" : "text-destructive")}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}% · {fmt(shown - first)}
        </span>
        <span className="text-[10.5px] text-muted-foreground ml-auto tabular-nums">
          {data[shownIdx].day}
        </span>
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={(e) => track(e.clientX)}
        onMouseLeave={() => setI(null)}
        onTouchStart={(e) => track(e.touches[0].clientX)}
        onTouchMove={(e) => track(e.touches[0].clientX)}
        onTouchEnd={() => setI(null)}
      >
        <path
          d={`${line} L ${X(data.length - 1).toFixed(1)} ${H - P.b} L ${X(0).toFixed(1)} ${H - P.b} Z`}
          fill="hsl(var(--action) / 0.12)"
        />
        <path d={line} fill="none" stroke="hsl(var(--action))" strokeWidth="1.75"
              vectorEffect="non-scaling-stroke" />
        {i !== null && (
          <g>
            <line
              x1={X(i)} x2={X(i)} y1={P.t} y2={H - P.b}
              stroke="hsl(var(--muted-foreground))" strokeWidth="1"
              strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={X(i)} cy={Y(ys[i])} r="3.5"
              fill="hsl(var(--action))" stroke="hsl(var(--card))" strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0].day}</span>
        <span>{data[data.length - 1].day}</span>
      </div>
    </div>
  );
}

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
    <div className="p-3 space-y-1.5">
      {list.map((r, i) => (
        <div key={i} className="flex flex-wrap sm:flex-nowrap gap-1.5 items-center">
          {columns.map((c) => (
            <Input
              key={c.key}
              className={cn(c.w, "h-8 text-[12px]")}
              type={c.type}
              step={c.type === "number" ? "any" : undefined}
              placeholder={c.placeholder ?? c.label}
              value={r[c.key] ?? ""}
              onChange={(e) => set(i, c.key, e.target.value)}
            />
          ))}
          <Button
            variant="ghost" size="icon" className="shrink-0 h-8 w-8"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            aria-label="Remove row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-1.5 pt-1.5">
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onChange([...list, blank])}>
          <Plus className="h-3 w-3" /> Add
        </Button>
        <Button variant="accent" size="sm" className="h-7 text-[11px]" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

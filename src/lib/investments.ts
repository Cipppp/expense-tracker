import "server-only";
import { db } from "@/lib/db";

/**
 * Evaluarea portofoliului.
 *
 * Cantitatile sunt stocate; preturile NU. Un pret salvat e vechi din secunda
 * urmatoare, deci se ia live la fiecare randare si valoarea se recalculeaza —
 * asa net worth-ul se misca odata cu piata fara nimic de sincronizat.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export type Quote = {
  price: number;
  currency: string;
  changePct: number | null;
};

/** Cotatie de la Yahoo. Fara cheie de API; null daca simbolul nu raspunde. */
export async function quote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 120 } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const m = j?.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;
    return {
      price: m.regularMarketPrice,
      currency: m.currency ?? "USD",
      changePct:
        typeof m.regularMarketChangePercent === "number"
          ? m.regularMarketChangePercent
          : null,
    };
  } catch {
    return null;
  }
}

/** Cursul oficial BNR — RON per unitate. BNR a mutat feed-ul pe curs.bnr.ro. */
export async function bnrRates(): Promise<{ date: string; rates: Record<string, number> }> {
  const res = await fetch("https://curs.bnr.ro/nbrfxrates.xml", {
    next: { revalidate: 60 * 60 * 6 },
  });
  const xml = await res.text();
  if (!xml.includes("<Cube")) throw new Error("BNR: feed fara date");
  const cube = xml.match(/<Cube\s+date="([^"]+)">([\s\S]*?)<\/Cube>/);
  const rates: Record<string, number> = { RON: 1 };
  if (cube) {
    const re = /<Rate\s+currency="([A-Z]{3})"(?:\s+multiplier="(\d+)")?\s*>([0-9.]+)<\/Rate>/g;
    let m;
    while ((m = re.exec(cube[2])) !== null) {
      rates[m[1]] = parseFloat(m[3]) / (m[2] ? parseInt(m[2], 10) : 1);
    }
  }
  return { date: cube ? cube[1] : "", rates };
}

export type ValuedHolding = {
  id: string;
  symbol: string;
  name: string | null;
  source: string;
  quantity: number;
  avgCost: number | null;
  currency: string;
  price: number | null;
  changePct: number | null;
  valueRon: number | null;   // bani
  pnl: number | null;        // in moneda listarii
  pnlPct: number | null;
  weight: number;            // pondere in actiuni, 0..1
  stale: boolean;
};

export type Portfolio = {
  holdings: ValuedHolding[];
  savings: Array<{
    id: string; label: string; amount: number; currency: string; valueRon: number | null;
  }>;
  stocksRon: number;
  savingsRon: number;
  totalRon: number;
  fxDate: string;
  warnings: string[];
};

export async function getPortfolio(): Promise<Portfolio> {
  const [rawHoldings, rawSavings] = await Promise.all([
    db.holding.findMany({ orderBy: [{ symbol: "asc" }, { source: "asc" }] }),
    db.savingsAccount.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] }),
  ]);

  const warnings: string[] = [];
  let fx: { date: string; rates: Record<string, number> };
  try {
    fx = await bnrRates();
  } catch (err) {
    warnings.push(`Curs BNR indisponibil: ${err instanceof Error ? err.message : "eroare"}`);
    fx = { date: "", rates: { RON: 1 } };
  }

  const toRon = (amount: number, currency: string): number | null => {
    // Londra coteaza in pence (GBp): 100 pence = 1 GBP, iar BNR n-are "GBp".
    if (currency === "GBp" || currency === "GBX") {
      const g = fx.rates.GBP;
      return g == null ? null : Math.round((amount / 100) * g * 100);
    }
    const r = fx.rates[currency];
    if (r == null) {
      warnings.push(`Fara curs BNR pentru ${currency}`);
      return null;
    }
    return Math.round(amount * r * 100);
  };

  const symbols = [...new Set(rawHoldings.map((h) => h.symbol))];
  const quotes = Object.fromEntries(
    await Promise.all(symbols.map(async (s) => [s, await quote(s)] as const)),
  ) as Record<string, Quote | null>;

  const valued = rawHoldings.map((h) => {
    const q = quotes[h.symbol];
    const currency = q?.currency ?? h.currency;
    const price = q?.price ?? null;
    const value = price === null ? null : price * h.quantity;
    const cost = h.avgCost ? h.avgCost * h.quantity : null;
    if (!q) warnings.push(`Fara pret pentru ${h.symbol}`);
    return {
      id: h.id, symbol: h.symbol, name: h.name, source: h.source,
      quantity: h.quantity, avgCost: h.avgCost, currency,
      price, changePct: q?.changePct ?? null,
      valueRon: value === null ? null : toRon(value, currency),
      pnl: value !== null && cost !== null ? value - cost : null,
      pnlPct: value !== null && cost ? ((value - cost) / cost) * 100 : null,
      weight: 0,
      stale: !q,
    };
  });

  const stocksRon = valued.reduce((a, h) => a + (h.valueRon ?? 0), 0);
  for (const h of valued) h.weight = stocksRon ? (h.valueRon ?? 0) / stocksRon : 0;

  const savings = rawSavings.map((s) => ({
    id: s.id, label: s.label, amount: s.amount, currency: s.currency,
    valueRon: toRon(s.amount, s.currency),
  }));
  const savingsRon = savings.reduce((a, s) => a + (s.valueRon ?? 0), 0);

  return {
    holdings: valued.sort((a, b) => (b.valueRon ?? 0) - (a.valueRon ?? 0)),
    savings,
    stocksRon,
    savingsRon,
    totalRon: stocksRon + savingsRon,
    fxDate: fx.date,
    warnings: [...new Set(warnings)],
  };
}

/** Un rand pe zi; ultimul castiga, ca graficul sa nu ramana pe valoarea de dimineata. */
export async function recordSnapshot(p: Portfolio) {
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Bucharest",
  });
  await db.netWorthSnapshot.upsert({
    where: { day },
    update: { stocksRon: p.stocksRon, savingsRon: p.savingsRon, totalRon: p.totalRon },
    create: { day, stocksRon: p.stocksRon, savingsRon: p.savingsRon, totalRon: p.totalRon },
  });
}

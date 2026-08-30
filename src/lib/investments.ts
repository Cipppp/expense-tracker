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
  prevClose: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  weekLow52: number | null;
  weekHigh52: number | null;
  name: string | null;
  exchange: string | null;
  /** Inchideri zilnice pe ultima luna, cu data lor. */
  series: Array<{ day: string; close: number }>;
};

/**
 * Cotatie de la Yahoo. Fara cheie de API; null daca simbolul nu raspunde.
 *
 * Un singur apel aduce si pretul, si intervalele, si seria pe o luna — nu are
 * rost sa cerem de trei ori acelasi lucru.
 */
export async function quote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 120 } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const r = j?.chart?.result?.[0];
    const m = r?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;

    const changePct =
      typeof m.regularMarketChangePercent === "number"
        ? m.regularMarketChangePercent
        : null;
    // Yahoo nu da mereu previousClose; se deduce din variatia zilei.
    const prevClose =
      typeof m.previousClose === "number"
        ? m.previousClose
        : changePct !== null && changePct !== -100
          ? m.regularMarketPrice / (1 + changePct / 100)
          : null;

    const stamps: number[] = r.timestamp ?? [];
    const closes: Array<number | null> = r.indicators?.quote?.[0]?.close ?? [];
    const series: Array<{ day: string; close: number }> = [];
    for (let i = 0; i < stamps.length; i++) {
      const c = closes[i];
      if (typeof c !== "number") continue;
      series.push({
        day: new Date(stamps[i] * 1000).toISOString().slice(0, 10),
        close: c,
      });
    }

    return {
      price: m.regularMarketPrice,
      currency: m.currency ?? "USD",
      changePct,
      prevClose,
      dayLow: m.regularMarketDayLow ?? null,
      dayHigh: m.regularMarketDayHigh ?? null,
      weekLow52: m.fiftyTwoWeekLow ?? null,
      weekHigh52: m.fiftyTwoWeekHigh ?? null,
      name: m.shortName ?? m.longName ?? null,
      exchange: m.fullExchangeName ?? m.exchangeName ?? null,
      series,
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
  exchange: string | null;
  source: string;
  quantity: number;
  avgCost: number | null;
  currency: string;
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  dayChange: number | null;      // in moneda listarii, pe toata pozitia
  dayLow: number | null;
  dayHigh: number | null;
  weekLow52: number | null;
  weekHigh52: number | null;
  valueRon: number | null;       // bani
  costRon: number | null;        // bani
  pnl: number | null;            // in moneda listarii
  pnlPct: number | null;
  weight: number;                // pondere in actiuni, 0..1
  series: number[];              // inchideri, pentru sparkline
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
  costRon: number;
  pnlRon: number;
  dayChangeRon: number;
  bySource: Array<{ source: string; valueRon: number; weight: number; count: number }>;
  /** USD per 1 RON, derivat din cursul BNR de azi. Vezi nota de la returnare. */
  usdPerRon: number | null;
  /** Valoarea portofoliului ACTUAL la preturile din trecut — vezi mai jos. */
  history: Array<{ day: string; valueRon: number }>;
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

  const rate = (currency: string): number | null => {
    // Londra coteaza in pence (GBp): 100 pence = 1 GBP, iar BNR n-are "GBp".
    if (currency === "GBp" || currency === "GBX") {
      const g = fx.rates.GBP;
      return g == null ? null : g / 100;
    }
    const r = fx.rates[currency];
    if (r == null) {
      warnings.push(`Fara curs BNR pentru ${currency}`);
      return null;
    }
    return r;
  };
  const toRon = (amount: number, currency: string): number | null => {
    const r = rate(currency);
    return r === null ? null : Math.round(amount * r * 100);
  };

  const symbols = [...new Set(rawHoldings.map((h) => h.symbol))];
  const quotes = Object.fromEntries(
    await Promise.all(symbols.map(async (s) => [s, await quote(s)] as const)),
  ) as Record<string, Quote | null>;

  const valued: ValuedHolding[] = rawHoldings.map((h) => {
    const q = quotes[h.symbol];
    const currency = q?.currency ?? h.currency;
    const price = q?.price ?? null;
    const value = price === null ? null : price * h.quantity;
    const cost = h.avgCost ? h.avgCost * h.quantity : null;
    if (!q) warnings.push(`Fara pret pentru ${h.symbol}`);
    return {
      id: h.id, symbol: h.symbol,
      name: q?.name ?? h.name, exchange: q?.exchange ?? null,
      source: h.source, quantity: h.quantity, avgCost: h.avgCost, currency,
      price, prevClose: q?.prevClose ?? null, changePct: q?.changePct ?? null,
      dayChange:
        price !== null && q?.prevClose != null
          ? (price - q.prevClose) * h.quantity
          : null,
      dayLow: q?.dayLow ?? null, dayHigh: q?.dayHigh ?? null,
      weekLow52: q?.weekLow52 ?? null, weekHigh52: q?.weekHigh52 ?? null,
      valueRon: value === null ? null : toRon(value, currency),
      costRon: cost === null ? null : toRon(cost, currency),
      pnl: value !== null && cost !== null ? value - cost : null,
      pnlPct: value !== null && cost ? ((value - cost) / cost) * 100 : null,
      weight: 0,
      series: (q?.series ?? []).map((p) => p.close),
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

  const bySourceMap = new Map<string, { valueRon: number; count: number }>();
  for (const h of valued) {
    const cur = bySourceMap.get(h.source) ?? { valueRon: 0, count: 0 };
    cur.valueRon += h.valueRon ?? 0;
    cur.count += 1;
    bySourceMap.set(h.source, cur);
  }

  /*
   * Istoric: portofoliul de ACUM evaluat la preturile din ultima luna.
   *
   * Nu e valoarea reala de atunci — nu stim ce aveai in cont acum trei
   * saptamani. E raspunsul la "cum s-ar fi miscat ce detin azi", care e ce
   * vrei de fapt sa vezi, si e disponibil imediat, spre deosebire de un
   * grafic care are nevoie de luni de snapshot-uri ca sa devina util.
   * Zilele lipsa dintr-o serie se completeaza cu ultima inchidere cunoscuta.
   */
  const allDays = [
    ...new Set(
      symbols.flatMap((s) => (quotes[s]?.series ?? []).map((p) => p.day)),
    ),
  ].sort();
  const history = allDays.map((day) => {
    let valueRon = 0;
    for (const h of rawHoldings) {
      const q = quotes[h.symbol];
      if (!q || q.series.length === 0) continue;
      let close: number | null = null;
      for (const p of q.series) {
        if (p.day <= day) close = p.close;
        else break;
      }
      if (close === null) close = q.series[0].close;
      const r = rate(q.currency);
      if (r === null) continue;
      valueRon += Math.round(close * h.quantity * r * 100);
    }
    return { day, valueRon };
  });

  return {
    holdings: valued.sort((a, b) => (b.valueRon ?? 0) - (a.valueRon ?? 0)),
    savings,
    stocksRon,
    savingsRon,
    totalRon: stocksRon + savingsRon,
    costRon: valued.reduce((a, h) => a + (h.costRon ?? 0), 0),
    pnlRon: valued.reduce(
      (a, h) => a + ((h.valueRon ?? 0) - (h.costRon ?? h.valueRon ?? 0)),
      0,
    ),
    dayChangeRon: valued.reduce((a, h) => {
      const r = rate(h.currency);
      return a + (h.dayChange !== null && r !== null ? Math.round(h.dayChange * r * 100) : 0);
    }, 0),
    bySource: [...bySourceMap.entries()]
      .map(([source, v]) => ({
        source, ...v,
        weight: stocksRon ? v.valueRon / stocksRon : 0,
      }))
      .sort((a, b) => b.valueRon - a.valueRon),
    history,
    fxDate: fx.date,
    /*
     * Cursul de afisare vine din ACELASI BNR ca evaluarea.
     *
     * Settings.fxRonToUsd e o valoare scrisa de mana si ramasa in urma
     * (0,2255, adica 4,4346 RON/USD, fata de 4,5171 azi). Cand o suma in USD
     * se converteste in RON cu BNR si inapoi in USD cu setarea, se intoarce
     * umflata cu 1,86%: 1.643,00 USD ajungea afisat ca 1.673,57 USD. Cu
     * inversul cursului BNR, dus-intorsul da exact suma initiala.
     */
    usdPerRon: fx.rates.USD ? 1 / fx.rates.USD : null,
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

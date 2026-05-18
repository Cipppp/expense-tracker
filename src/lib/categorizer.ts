/**
 * Categorize a transaction by substring-matching the merchant/description against
 * a list of keyword rules. Ported from Code.gs CATEGORY_KEYWORDS. Lower priority
 * number wins so generic catch-alls don't shadow specifics.
 */

export const DEFAULT_RULES: Array<{
  keyword: string;
  category: string;
  priority: number;
}> = [
  // Food delivery / restaurants
  { keyword: "wolt", category: "Food", priority: 10 },
  { keyword: "tazz", category: "Food", priority: 10 },
  { keyword: "glovo", category: "Food", priority: 10 },
  { keyword: "bolt food", category: "Food", priority: 10 },
  { keyword: "uber eats", category: "Food", priority: 10 },
  { keyword: "kfc", category: "Food", priority: 10 },
  { keyword: "mcdonald", category: "Food", priority: 10 },
  { keyword: "starbucks", category: "Food", priority: 10 },
  // Groceries
  { keyword: "lidl", category: "Groceries", priority: 10 },
  { keyword: "kaufland", category: "Groceries", priority: 10 },
  { keyword: "carrefour", category: "Groceries", priority: 10 },
  { keyword: "mega image", category: "Groceries", priority: 10 },
  { keyword: "auchan", category: "Groceries", priority: 10 },
  { keyword: "profi", category: "Groceries", priority: 10 },
  { keyword: "penny", category: "Groceries", priority: 10 },
  // Transport
  { keyword: "uber", category: "Transport", priority: 20 },
  { keyword: "bolt", category: "Transport", priority: 30 },
  { keyword: "blablacar", category: "Transport", priority: 20 },
  { keyword: "stb", category: "Transport", priority: 20 },
  { keyword: "metrorex", category: "Transport", priority: 20 },
  { keyword: "ratb", category: "Transport", priority: 20 },
  { keyword: "omv", category: "Transport", priority: 20 },
  { keyword: "petrom", category: "Transport", priority: 20 },
  { keyword: "rompetrol", category: "Transport", priority: 20 },
  // Health
  { keyword: "catena", category: "Health", priority: 20 },
  { keyword: "sensiblu", category: "Health", priority: 20 },
  { keyword: "help net", category: "Health", priority: 20 },
  { keyword: "regina maria", category: "Health", priority: 20 },
  { keyword: "medicover", category: "Health", priority: 20 },
  { keyword: "synevo", category: "Health", priority: 20 },
  // Bills / subscriptions
  { keyword: "digi", category: "Bills", priority: 20 },
  { keyword: "orange", category: "Bills", priority: 20 },
  { keyword: "vodafone", category: "Bills", priority: 20 },
  { keyword: "telekom", category: "Bills", priority: 20 },
  { keyword: "enel", category: "Bills", priority: 20 },
  { keyword: "engie", category: "Bills", priority: 20 },
  { keyword: "electrica", category: "Bills", priority: 20 },
  { keyword: "apa nova", category: "Bills", priority: 20 },
  { keyword: "netflix", category: "Subscriptions", priority: 20 },
  { keyword: "spotify", category: "Subscriptions", priority: 20 },
  { keyword: "youtube", category: "Subscriptions", priority: 20 },
  { keyword: "claude", category: "Subscriptions", priority: 20 },
  { keyword: "openai", category: "Subscriptions", priority: 20 },
  { keyword: "github", category: "Subscriptions", priority: 20 },
  { keyword: "aws", category: "Subscriptions", priority: 20 },
  { keyword: "google", category: "Subscriptions", priority: 20 },
  { keyword: "apple.com", category: "Subscriptions", priority: 20 },
  { keyword: "icloud", category: "Subscriptions", priority: 20 },
  // Transfers / savings (user's own accounts)
  { keyword: "transfer to ciprian", category: "Transfer", priority: 5 },
  { keyword: "to savings", category: "Savings", priority: 5 },
  { keyword: "vault", category: "Savings", priority: 5 },
  // Shopping
  { keyword: "emag", category: "Shopping", priority: 30 },
  { keyword: "altex", category: "Shopping", priority: 30 },
  { keyword: "decathlon", category: "Shopping", priority: 30 },
  { keyword: "ikea", category: "Shopping", priority: 30 },
  { keyword: "h&m", category: "Shopping", priority: 30 },
  { keyword: "zara", category: "Shopping", priority: 30 },
];

export type Rule = (typeof DEFAULT_RULES)[number];

export function categorize(description: string, rules: Rule[]): string {
  const text = description.toLowerCase();
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (text.includes(r.keyword.toLowerCase())) return r.category;
  }
  return "Other";
}

export function canonicalMerchant(description: string): string {
  // Strip noise, return a short key for grouping in TOP 5 charts.
  return description
    .toLowerCase()
    .replace(/[0-9*#]+/g, "")
    .replace(/\b(ro|bucharest|bucuresti|ploiesti|cluj|sector\s?\d?)\b/g, "")
    .replace(/[^a-z\s&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

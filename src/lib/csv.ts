/**
 * Revolut CSV parser. Ported from Code.gs `parseCSVLine_` + `importCsvText`.
 *
 * Revolut statement columns (as of 2026):
 *   Type, Product, Started Date, Completed Date, Description, Amount, Fee,
 *   Currency, State, Balance
 *
 * We only keep:
 *   - State == "COMPLETED"
 *   - Currency == "RON"
 *   - Amount < 0 (expenses) — refunds and inflows handled by `findInflow`
 */

export type RevolutRow = {
  type: string;
  product: string;
  startedDate: string;
  completedDate: string;
  description: string;
  amount: number;
  fee: number;
  currency: string;
  state: string;
  balance: string;
};

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseRevolutCsv(text: string): RevolutRow[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((s) => s.toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h === name.toLowerCase());

  const iType = idx("type");
  const iProduct = idx("product");
  const iStarted = idx("started date");
  const iCompleted = idx("completed date");
  const iDesc = idx("description");
  const iAmt = idx("amount");
  const iFee = idx("fee");
  const iCur = idx("currency");
  const iState = idx("state");
  const iBal = idx("balance");

  const rows: RevolutRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < header.length) continue;
    rows.push({
      type: fields[iType] ?? "",
      product: fields[iProduct] ?? "",
      startedDate: fields[iStarted] ?? "",
      completedDate: fields[iCompleted] ?? "",
      description: fields[iDesc] ?? "",
      amount: parseFloat(fields[iAmt] ?? "0") || 0,
      fee: parseFloat(fields[iFee] ?? "0") || 0,
      currency: fields[iCur] ?? "",
      state: fields[iState] ?? "",
      balance: fields[iBal] ?? "",
    });
  }
  return rows;
}

export function dayKey(iso: string): string {
  // Revolut format: "2026-05-12 09:14:32".
  return iso.slice(0, 10);
}

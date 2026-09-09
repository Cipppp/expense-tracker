import "server-only";

/**
 * Import extras ING Business (CSV) — contul firmei, nu cardul personal.
 *
 * Din acelasi fisier ies trei lucruri:
 *   - platile de taxe catre Trezorerie    → TaxPayment
 *   - dividendele si salariul asociatului → CompanyPayout
 *   - restul iesirilor                    → Expense, cu `source: "ing"`
 *
 * A treia categorie e tot ce a platit firma si nu e nici taxa, nici bani
 * catre asociat: Anthropic, AWS, avocatul, comisioanele. Sunt cheltuieli
 * adevarate si intra la "spent" ca oricare alta, dar raman marcate ca fiind
 * pe firma — de aia `source`, si de aia culoarea separata in grafic.
 *
 * Se pot incarca toate cele trei conturi (RON, EUR, USD). In practica taxele
 * si dividendele apar doar in cel de RON, dar fisierele in valuta trec fara
 * sa produca nimic, ca sa nu trebuiasca sa alegi tu care e care.
 */

import { db } from "@/lib/db";
import { getSettings, requireUserId } from "@/lib/queries";
import { baniFromRon, centsFromUsd, dateAtNoonUTC } from "@/lib/format";
import { DEFAULT_RULES, canonicalMerchant, categorize, type Rule } from "@/lib/categorizer";
import { parseIngCsv, type IngRow } from "@/lib/ing-csv";
import {
  ownerMatcher,
  parseIngExpenses,
  parseIngPayouts,
  parseIngTaxPayments,
} from "@/lib/tax-import";

export type IngImportSummary = {
  filename: string;
  kind: "ing";
  currency: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  taxesInserted: number;
  payoutsInserted: number;
  expensesInserted: number;
  /** Adevarat cand Settings.ownerNames e gol si n-am putut cauta dividende. */
  ownerUnset: boolean;
  insertedExamples: Array<{ date: string; description: string; amountRon: number }>;
};

function currencyOf(rows: IngRow[]): string {
  return rows[0]?.currency ?? "—";
}

export async function importIngCsv(
  filename: string,
  text: string,
): Promise<IngImportSummary> {
  const userId = await requireUserId();
  const rows = parseIngCsv(text);
  const settings = await getSettings();
  const isOwner = ownerMatcher(settings.ownerNames);
  const taxes = parseIngTaxPayments(rows);
  const payouts = parseIngPayouts(rows, isOwner);
  const expenses = parseIngExpenses(rows, isOwner);

  const taxResult = taxes.length
    ? await db.taxPayment.createMany({
        data: taxes.map((t) => ({
          userId,
          paidAt: t.paidAt,
          forPeriod: t.forPeriod,
          kind: t.kind,
          amountRon: t.amountRon,
          description: t.description,
          dedupKey: t.dedupKey,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  const payoutResult = payouts.length
    ? await db.companyPayout.createMany({
        data: payouts.map((p) => ({
          userId,
          paidAt: p.paidAt,
          forPeriod: p.forPeriod,
          kind: p.kind,
          amountRon: p.amountRon,
          description: p.description,
          presumed: p.presumed,
          dedupKey: p.dedupKey,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  /*
   * Cheltuielile firmei. Suma din extras e in moneda contului, iar Expense
   * tine si lei si dolari, deci convertim o data, la import, cu cursurile din
   * setari — la fel ca importul de Revolut, ca cele doua surse sa fie
   * comparabile in acelasi grafic.
   */
  const rulesRaw = await db.categoryRule.findMany();
  const catRules: Rule[] = rulesRaw.length
    ? rulesRaw.map((r) => ({
        keyword: r.keyword,
        category: r.category,
        priority: r.priority,
      }))
    : DEFAULT_RULES;
  const ronPerUnit = (currency: string) =>
    currency === "RON"
      ? 1
      : currency === "EUR"
        ? settings.fxEurToUsd / settings.fxRonToUsd
        : 1 / settings.fxRonToUsd;

  const expenseKeys = expenses.map((e) => e.dedupKey);
  const already = expenseKeys.length
    ? new Set(
        (
          await db.expense.findMany({
            where: { dedupKey: { in: expenseKeys } },
            select: { dedupKey: true },
          })
        ).map((e) => e.dedupKey),
      )
    : new Set<string>();

  const expenseRows = expenses
    .filter((e) => !already.has(e.dedupKey))
    .map((e) => {
      const ron = e.amount * ronPerUnit(e.currency);
      return {
        date: dateAtNoonUTC(e.date.toISOString().slice(0, 10)),
        description: e.description,
        category: categorize(e.description, catRules),
        amountRon: baniFromRon(ron),
        amountUsd: centsFromUsd(ron * settings.fxRonToUsd),
        fxRate: settings.fxRonToUsd,
        merchant: canonicalMerchant(e.description),
        source: "ing",
        dedupKey: e.dedupKey,
      };
    });

  const expenseResult = expenseRows.length
    ? await db.expense.createMany({
        data: expenseRows.map((r) => ({ ...r, userId })),
      })
    : { count: 0 };

  const inserted = taxResult.count + payoutResult.count + expenseResult.count;

  // Acelasi istoric ca la Revolut — altfel un import ING nu lasa nicio urma in
  // pagina si nu se mai stie care fisiere au fost trecute prin aplicatie.
  await db.importBatch.create({
    data: {
      userId: await requireUserId(),
      filename,
      rowsRead: rows.length,
      rowsInsert: inserted,
      rowsSkipped: Math.max(0, rows.length - inserted),
    },
  });

  return {
    filename,
    kind: "ing",
    currency: currencyOf(rows),
    rowsRead: rows.length,
    rowsInserted: inserted,
    rowsSkipped: rows.length - inserted,
    taxesInserted: taxResult.count,
    payoutsInserted: payoutResult.count,
    expensesInserted: expenseResult.count,
    ownerUnset: settings.ownerNames.trim() === "",
    insertedExamples: [...taxes, ...payouts].slice(0, 5).map((r) => ({
      date: r.paidAt.toISOString().slice(0, 10),
      description: r.description,
      amountRon: r.amountRon / 100,
    })),
  };
}

import { PrismaClient } from "@prisma/client";
const raw = new PrismaClient();

const UNITS = 4;
const PRICE = 218.26; // pretul din captura de azi; se corecteaza daca ai platit altfel

async function main() {
  const [h] = await raw.$queryRawUnsafe<any[]>(
    `SELECT id, quantity, "avgCost" FROM "Holding" WHERE symbol='NVDA' AND source='XTB'`,
  );
  const oldQty = h.quantity, oldAvg = h.avgCost;
  const newQty = oldQty + UNITS;
  // media ponderata: cost total vechi + cost nou, impartit la bucati
  const newAvg = (oldQty * oldAvg + UNITS * PRICE) / newQty;
  const cost = UNITS * PRICE;

  console.log(`NVDA·XTB  ${oldQty} @ ${oldAvg}  +  ${UNITS} @ ${PRICE}`);
  console.log(`       →  ${newQty} @ ${newAvg.toFixed(4)}   (cost ${cost.toFixed(2)} USD)`);

  await raw.$executeRawUnsafe(
    `UPDATE "Holding" SET quantity=$1, "avgCost"=$2, "updatedAt"=NOW() WHERE id=$3`,
    newQty, Number(newAvg.toFixed(4)), h.id,
  );

  const [cash] = await raw.$queryRawUnsafe<any[]>(
    `SELECT id, label, amount FROM "SavingsAccount" WHERE label LIKE 'XTB%'`,
  );
  const newCash = cash.amount - cost;
  await raw.$executeRawUnsafe(
    `UPDATE "SavingsAccount" SET amount=$1, "updatedAt"=NOW() WHERE id=$2`,
    Number(newCash.toFixed(2)), cash.id,
  );
  console.log(`cash XTB  ${cash.amount} → ${newCash.toFixed(2)} USD`);

  const after = await raw.$queryRawUnsafe<any[]>(
    `SELECT symbol, source, quantity, "avgCost" FROM "Holding" ORDER BY source, symbol`,
  );
  console.log("\npozitii acum:");
  for (const r of after) console.log(`  ${r.symbol.padEnd(5)} ${r.source.padEnd(5)} ${String(r.quantity).padStart(9)} @ ${r.avgCost}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });

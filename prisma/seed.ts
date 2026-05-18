import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES } from "../src/lib/categorizer";

const db = new PrismaClient();

async function main() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      fxRonToUsd: 0.2255,
      bsBasRon: 141500,
      camRon: 8400,
      microPct: 0.01,
      dividendePct: 0.16,
      redThresholdRon: 5000,
      startYear: 2026,
      startMonth: 4,
    },
  });

  await db.job.upsert({
    where: { name: "Main client" },
    update: {},
    create: { name: "Main client", rateUsd: 30, color: "#c65c2a" },
  });

  for (const r of DEFAULT_RULES) {
    await db.categoryRule.upsert({
      where: { keyword: r.keyword },
      update: { category: r.category, priority: r.priority },
      create: r,
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

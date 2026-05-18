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

  const starterClients = [
    { name: "Main client", rateUsd: 30, color: "#c65c2a" }, // terracotta
    { name: "Side project", rateUsd: 40, color: "#2f7a5c" }, // sage
    { name: "Internal", rateUsd: 25, color: "#456d99" }, // dusty blue
  ];
  for (const c of starterClients) {
    await db.job.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }

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

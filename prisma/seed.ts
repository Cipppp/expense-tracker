import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES } from "../src/lib/categorizer";

const db = new PrismaClient();

async function main() {
  /*
   * Seed-ul nu mai poate presupune ca exista "aplicatia": datele apartin unui
   * cont. Daca nu exista niciunul, nu inventam unul cu parola — se creeaza din
   * interfata, la /signup. Seed-ul umple doar contul existent.
   */
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    console.log("Niciun cont inca. Creeaza-l din aplicatie (/signup), apoi ruleaza iar seed-ul.");
    return;
  }
  const userId = user.id;

  await db.settings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
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
      where: { userId_name: { userId, name: c.name } },
      update: {},
      create: { ...c, userId },
    });
  }

  for (const r of DEFAULT_RULES) {
    await db.categoryRule.upsert({
      where: { userId_keyword: { userId, keyword: r.keyword } },
      update: { category: r.category, priority: r.priority },
      create: { ...r, userId },
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

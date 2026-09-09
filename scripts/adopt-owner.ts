/**
 * Dă un email și o parolă contului creat de migrarea multi-user.
 *
 * Migrarea nu poate face asta singură: SQL-ul nu are cum să hashuiască o
 * parolă, iar un cont cu parola goală ar fi mai rău decât niciun cont. Așa că
 * migrarea creează rândul `owner` cu parola goală — imposibil de folosit la
 * autentificare, pentru că `verifyPassword` refuză hash-urile invalide — și
 * scriptul ăsta îl completează.
 *
 *   npx tsx scripts/adopt-owner.ts --email tu@exemplu.ro --password "..."
 *
 * Fără `--password`, ia `ACCESS_PASSWORD` din mediu, ca trecerea de la parola
 * unică la conturi să nu-ți schimbe și parola.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const password = arg("password") ?? process.env.ACCESS_PASSWORD ?? "";

  if (!email || !email.includes("@")) {
    throw new Error("Lipsește --email (adresa cu care te vei autentifica).");
  }
  if (password.length < 10) {
    throw new Error(
      "Parola trebuie să aibă cel puțin 10 caractere. Dă --password sau setează ACCESS_PASSWORD.",
    );
  }

  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!owner) {
    throw new Error(
      "Niciun cont în baza de date. Rulează întâi migrarea, sau creează-ți contul din /signup.",
    );
  }

  const updated = await db.user.update({
    where: { id: owner.id },
    data: { email, passwordHash: await hashPassword(password) },
  });

  const counts = await Promise.all([
    db.expense.count({ where: { userId: owner.id } }),
    db.invoice.count({ where: { userId: owner.id } }),
    db.income.count({ where: { userId: owner.id } }),
  ]);

  console.log(`Contul ${updated.email} preia datele existente.`);
  console.log(
    `  ${counts[0]} cheltuieli · ${counts[1]} facturi · ${counts[2]} intrări de venit`,
  );
  console.log("Poți intra acum cu emailul și parola de mai sus.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });

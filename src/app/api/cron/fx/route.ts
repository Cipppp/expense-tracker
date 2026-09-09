import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bnrRates } from "@/lib/investments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cursurile, o dată pe zi, de la BNR.
 *
 * Erau două constante scrise de mână în Settings, pe care nu le împrospăta
 * nimic. Fiecare total în altă monedă de pe dashboard trecea prin ele, deci
 * după câteva luni „Earned YTD" în euro era greșit cu procente întregi, fără
 * ca ceva să arate că e greșit — cifra arăta la fel de sigură ca oricare alta.
 *
 * BNR publică RON per unitate; noi ținem inversul pentru leu și raportul
 * pentru euro, exact cum le folosesc conversiile.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fx = await bnrRates();
    const ronPerUsd = fx.rates.USD;
    const ronPerEur = fx.rates.EUR;
    if (!ronPerUsd || !ronPerEur) {
      return NextResponse.json(
        { error: "BNR nu a returnat USD/EUR", date: fx.date },
        { status: 502 },
      );
    }

    const next = {
      fxRonToUsd: 1 / ronPerUsd,      // câți dolari face un leu
      fxEurToUsd: ronPerEur / ronPerUsd, // câți dolari face un euro
    };

    /*
     * Cronul nu are sesiune, deci nu are „utilizatorul curent". Cursul BNR e
     * însă același pentru toată lumea, așa că trece prin toate conturile.
     */
    const users = await db.user.findMany({ select: { id: true } });
    for (const u of users) {
      await db.settings.upsert({
        where: { userId: u.id },
        update: next,
        create: { userId: u.id, ...next },
      });
    }

    return NextResponse.json({ ok: true, date: fx.date, users: users.length, after: next });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BNR indisponibil" },
      { status: 502 },
    );
  }
}

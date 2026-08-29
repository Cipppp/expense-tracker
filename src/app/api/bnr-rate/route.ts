import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * BNR moved the rate feeds to the `curs.bnr.ro` subdomain. The old
 * www.bnr.ro paths now 302 to the homepage, and because that redirect ends
 * in a 200 full of HTML, this route was failing with the useless "no rate
 * data in BNR feed" instead of a network error — invoices silently lost
 * their auto-filled rate. Verified 2026-08-30.
 */
const TODAY_URL = "https://curs.bnr.ro/nbrfxrates.xml";
const YEAR_URL = (year: number) =>
  `https://curs.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;

/**
 * Fetch the official BNR reference rate (RON per 1 unit of `currency`) for
 * the requested date. ANAF requires this exact rate for any non-RON invoice,
 * so we want it auto-filled. The endpoint also returns the published date so
 * the UI can warn the user when the requested date isn't actually published
 * yet (weekends / holidays — BNR rolls over to the previous business day).
 *
 * BNR XML shape:
 *   <Cube date="2026-05-20">
 *     <Rate currency="USD">4.4023</Rate>
 *     <Rate currency="EUR">5.0635</Rate>
 *     <Rate currency="JPY" multiplier="100">2.8523</Rate>
 *   </Cube>
 *
 * The multiplier attribute is per-unit-times — JPY is quoted per 100 yen,
 * but for EUR/USD it's per 1 unit, so we usually divide by multiplier (or 1).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const currency = (url.searchParams.get("currency") ?? "EUR").toUpperCase();
  const date = url.searchParams.get("date"); // yyyy-mm-dd, optional

  if (!/^(USD|EUR|RON|GBP|CHF|JPY)$/.test(currency)) {
    return NextResponse.json(
      { error: "unsupported currency" },
      { status: 400 },
    );
  }
  if (currency === "RON") {
    return NextResponse.json({ currency: "RON", rate: 1, date: null });
  }

  /*
   * Pick the right XML feed. ANY explicit date goes to that year's archive,
   * including the current year: the daily feed carries a single Cube, so a
   * back-dated invoice used to silently get TODAY's rate with fellBack=true.
   * That is not a cosmetic fallback — ANAF wants the rate of the invoice
   * date, and CP0022 (29.06, EUR 5.2430) would have been auto-filled with
   * 5.2584. The archive is published through the last business day, so it
   * answers every invoice date; only a no-date request uses the daily file.
   */
  const year = date ? parseInt(date.slice(0, 4), 10) : new Date().getFullYear();
  let xmlUrl = date ? YEAR_URL(year) : TODAY_URL;

  let xml: string;
  try {
    const res = await fetch(xmlUrl, {
      // Cache for 6h — BNR publishes once per business day around 13:00.
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `BNR feed returned ${res.status}` },
        { status: 502 },
      );
    }
    xml = await res.text();
    // A redirect to an HTML page still arrives as 200. Fail loudly here so
    // the next time BNR moves the feed the error names the real cause.
    if (!xml.includes("<Cube")) {
      return NextResponse.json(
        { error: `BNR feed at ${xmlUrl} returned no XML rate data (moved again?)` },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `BNR feed unreachable: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 },
    );
  }

  // Extract all <Cube date="..."> blocks. For the daily feed there's only
  // one Cube; for the year archive there are ~250. Find the latest cube
  // with date <= requested date (or just the only one for the daily feed).
  const cubeRe = /<Cube\s+date="([^"]+)">([\s\S]*?)<\/Cube>/g;
  const cubes: { date: string; body: string }[] = [];
  let m;
  while ((m = cubeRe.exec(xml)) !== null) {
    cubes.push({ date: m[1], body: m[2] });
  }
  if (cubes.length === 0) {
    return NextResponse.json(
      { error: "no rate data in BNR feed" },
      { status: 502 },
    );
  }

  // Pick the cube on or before the requested date (or the latest available).
  const target = date ?? cubes[cubes.length - 1].date;
  const valid = cubes.filter((c) => c.date <= target);
  let cube = valid.length > 0 ? valid[valid.length - 1] : cubes[0];

  // Today, asked before BNR publishes (~13:00): the archive may not have it
  // yet while the daily feed does. Try the daily feed before giving up.
  if (date && cube.date > target && xmlUrl !== TODAY_URL) {
    try {
      const res = await fetch(TODAY_URL, { next: { revalidate: 60 * 60 * 6 } });
      if (res.ok) {
        const daily = await res.text();
        const dm = /<Cube\s+date="([^"]+)">([\s\S]*?)<\/Cube>/.exec(daily);
        if (dm && dm[1] <= target) cube = { date: dm[1], body: dm[2] };
      }
    } catch {
      // keep the archive answer
    }
  }

  // Extract the requested currency's rate from this cube.
  const rateRe = new RegExp(
    `<Rate\\s+currency="${currency}"(?:\\s+multiplier="(\\d+)")?\\s*>([0-9.]+)<\\/Rate>`,
  );
  const rm = cube.body.match(rateRe);
  if (!rm) {
    return NextResponse.json(
      { error: `currency ${currency} not in BNR feed for ${cube.date}` },
      { status: 404 },
    );
  }
  const multiplier = rm[1] ? parseInt(rm[1], 10) : 1;
  const rate = parseFloat(rm[2]) / multiplier;

  return NextResponse.json({
    currency,
    rate,
    date: cube.date,
    requestedDate: date,
    fellBack: date !== null && date !== cube.date,
  });
}

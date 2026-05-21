import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TODAY_URL = "https://www.bnr.ro/nbrfxrates.xml";
const YEAR_URL = (year: number) =>
  `https://www.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;

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

  // Pick the right XML feed: today's daily file or a year archive.
  let xmlUrl = TODAY_URL;
  const year = date ? parseInt(date.slice(0, 4), 10) : new Date().getFullYear();
  const now = new Date();
  if (date && year < now.getFullYear()) xmlUrl = YEAR_URL(year);

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
  const cube = valid.length > 0 ? valid[valid.length - 1] : cubes[0];

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

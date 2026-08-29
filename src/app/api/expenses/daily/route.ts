import { NextResponse } from "next/server";
import { getDailyHeatmap } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Daily expense totals for one month, used by the dashboard spending heatmap
 * when you navigate away from the month rendered on the server.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      { error: "year and month are required (month 1-12)" },
      { status: 400 },
    );
  }

  const daily = await getDailyHeatmap(year, month);
  return NextResponse.json({ daily });
}

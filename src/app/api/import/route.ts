import { NextResponse } from "next/server";
import { importRevolutCsv } from "@/lib/import";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const summaries = [];
    for (const file of files) {
      const text = await file.text();
      summaries.push(await importRevolutCsv(file.name, text));
    }

    const totals = summaries.reduce(
      (acc, s) => ({
        rowsRead: acc.rowsRead + s.rowsRead,
        rowsInserted: acc.rowsInserted + s.rowsInserted,
        rowsSkipped: acc.rowsSkipped + s.rowsSkipped,
      }),
      { rowsRead: 0, rowsInserted: 0, rowsSkipped: 0 },
    );

    return NextResponse.json({ ok: true, totals, summaries });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}

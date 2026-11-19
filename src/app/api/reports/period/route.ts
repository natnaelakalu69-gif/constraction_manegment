import { NextResponse } from "next/server";
import { buildPeriodReport, isPeriod } from "@/server/services/reports";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawPeriod = params.get("period") ?? "daily";
  const date = params.get("date");

  if (!isPeriod(rawPeriod)) {
    return NextResponse.json({ error: "period must be daily, weekly, monthly or yearly." }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date query parameter is required (YYYY-MM-DD)." }, { status: 400 });
  }

  return NextResponse.json(await buildPeriodReport(rawPeriod, date));
}

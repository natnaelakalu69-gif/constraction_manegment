import { NextResponse } from "next/server";
import { buildExecutiveSummary } from "@/server/services/reports";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date query parameter is required (YYYY-MM-DD)." }, { status: 400 });
  }

  return NextResponse.json(await buildExecutiveSummary(date));
}

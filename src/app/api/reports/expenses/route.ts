import { NextResponse } from "next/server";
import { buildExpenseReport } from "@/server/services/expenses";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("projectId");
  const projectId = raw ? Number.parseInt(raw, 10) : undefined;
  if (raw && (!Number.isInteger(projectId) || projectId! <= 0)) {
    return NextResponse.json({ error: "projectId must be a positive integer." }, { status: 400 });
  }

  return NextResponse.json(await buildExpenseReport(projectId));
}

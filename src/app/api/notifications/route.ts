import { NextResponse } from "next/server";
import { getWorkspaceCompanyId } from "@/lib/workspace";
import { getNotifications } from "@/server/services/notifications";

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("date");
  if (requested && !/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  const date = requested ?? new Date().toISOString().slice(0, 10);
  const companyId = await getWorkspaceCompanyId();
  return NextResponse.json(await getNotifications(companyId, date));
}

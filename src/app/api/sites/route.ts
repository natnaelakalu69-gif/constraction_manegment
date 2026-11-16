import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";

export async function GET() {
  return NextResponse.json(await db.select().from(sites).orderBy(desc(sites.id)));
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.siteCode || !b.siteName || !b.location) return NextResponse.json({ error: "siteCode, siteName and location are required" }, { status: 400 });
  try {
    const [site] = await db.insert(sites).values({
      siteCode: String(b.siteCode), siteName: String(b.siteName),
      location: String(b.location), managerName: b.managerName ? String(b.managerName) : null,
      status: b.status ?? "ACTIVE",
    }).returning();
    return NextResponse.json(site, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Site code may already exist" }, { status: 409 });
  }
}
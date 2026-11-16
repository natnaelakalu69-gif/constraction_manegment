import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || user.passwordHash !== hashPassword(password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
}
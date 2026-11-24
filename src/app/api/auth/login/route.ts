import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const account = String(body.email ?? body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!account || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, account) });
  if (!user || user.passwordHash !== hashPassword(password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
}

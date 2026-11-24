import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";

const defaultUsername = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
const defaultPassword = process.env.ADMIN_PASSWORD ?? "12345678";
const defaultName = process.env.ADMIN_NAME ?? "Administrator";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const account = String(body.email ?? body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!account || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  try {
    let user = await db.query.users.findFirst({ where: eq(users.email, account) });

    // Vercel does not run the local seed script during deployment. Create the
    // documented default account on first use so a fresh production database
    // can sign in immediately.
    if (!user && account === defaultUsername && password === defaultPassword) {
      const [created] = await db
        .insert(users)
        .values({
          fullName: defaultName,
          email: defaultUsername,
          passwordHash: hashPassword(defaultPassword),
          role: "ADMIN",
        })
        .onConflictDoNothing()
        .returning();

      user =
        created ??
        (await db.query.users.findFirst({ where: eq(users.email, defaultUsername) }));
    }

    if (!user || user.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Sign-in failed:", error);
    return NextResponse.json(
      { error: "Sign-in is unavailable. Check the deployment database configuration." },
      { status: 503 },
    );
  }
}

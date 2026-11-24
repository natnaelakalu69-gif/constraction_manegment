import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifySessionToken,
} from "@/lib/session-token";

export { hashPassword };

export type SessionUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

export async function createSession(userId: number) {
  const token = await createSessionToken(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUserId() {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  return session?.userId ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return (
    (await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, fullName: true, email: true, role: true },
    })) ?? null
  );
}

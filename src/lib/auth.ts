import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "construction_session";

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function createSession(userId: number) {
  const value = Buffer.from(`${userId}:${Date.now()}:${process.env.SESSION_SECRET}`).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
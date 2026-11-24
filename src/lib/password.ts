import crypto from "node:crypto";

/**
 * Legacy password helper kept for compatibility with existing accounts.
 * A production system should use a slow password hash such as Argon2 or bcrypt.
 */
export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

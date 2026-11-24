import dotenv from "dotenv";
import crypto from "node:crypto";
import pg from "pg";

// Match Next.js env precedence: .env.local overrides .env.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const { Pool } = pg;

const username = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "12345678";
const fullName = process.env.ADMIN_NAME ?? "Administrator";
const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [username]);
  if (existing.rowCount > 0) {
    console.log(`User "${username}" already exists. No changes made.`);
  } else {
    await pool.query(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'ADMIN')",
      [fullName, username, passwordHash],
    );
    console.log(`Created admin user "${username}".`);
  }
  console.log(`Default password: ${password}`);
} finally {
  await pool.end();
}

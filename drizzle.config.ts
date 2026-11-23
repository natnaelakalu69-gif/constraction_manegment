import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local, so Drizzle should use the same configuration.
config({ path: ".env.local" });
config();

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/schema/**/*.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema/enterprise";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";

const WORKSPACE_NAME = "Company workspace";

/**
 * The current UI has no company switcher yet. All enterprise records belong to
 * the first company in the database; create a default one on first use so the
 * module pages work against a fresh database.
 */
export async function getWorkspaceCompanyId(): Promise<number> {
  const [existing] = await db.select({ id: companies.id }).from(companies).orderBy(asc(companies.id)).limit(1);
  if (existing) return existing.id;

  try {
    const [created] = await db.insert(companies).values({ name: WORKSPACE_NAME }).returning({ id: companies.id });
    return created.id;
  } catch (error) {
    // Another request may have created the default company at the same time.
    if (isUniqueConstraintViolation(error)) {
      const [raced] = await db.select({ id: companies.id }).from(companies).orderBy(asc(companies.id)).limit(1);
      if (raced) return raced.id;
    }
    throw error;
  }
}

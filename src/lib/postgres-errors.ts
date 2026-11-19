function hasPostgresCode(error: unknown, code: string): boolean {
  const seen = new Set<object>();
  let current: unknown = error;

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return hasPostgresCode(error, "23505");
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPostgresCode(error, "23503");
}

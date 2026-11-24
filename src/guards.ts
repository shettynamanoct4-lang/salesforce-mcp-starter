export const MAX_ROWS = Number(process.env.SF_MCP_MAX_ROWS ?? 200);

const FORBIDDEN = /\b(insert|update|delete|upsert|merge|undelete)\b/i;

/**
 * Ensures the query is a single SELECT and enforces a row cap.
 * Defense in depth: the REST query endpoint is read-only anyway, but we fail fast with a clear message.
 */
export function assertReadOnlySoql(query: string): string {
  const trimmed = query.trim().replace(/;+\s*$/, "");
  if (!/^select\s/i.test(trimmed)) {
    throw new Error("Only SELECT queries are allowed.");
  }
  if (FORBIDDEN.test(trimmed)) {
    throw new Error("Query contains a forbidden keyword.");
  }
  const limitMatch = trimmed.match(/\blimit\s+(\d+)\s*$/i);
  if (!limitMatch) {
    return `${trimmed} LIMIT ${MAX_ROWS}`;
  }
  if (Number(limitMatch[1]) > MAX_ROWS) {
    return trimmed.replace(/\blimit\s+\d+\s*$/i, `LIMIT ${MAX_ROWS}`);
  }
  return trimmed;
}

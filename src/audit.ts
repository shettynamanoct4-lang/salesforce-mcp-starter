/**
 * Structured audit trail. Written to stderr because stdout is reserved for the MCP protocol.
 */
export function audit(tool: string, args: Record<string, unknown>): void {
  process.stderr.write(
    JSON.stringify({ ts: new Date().toISOString(), event: "tool_call", tool, args }) + "\n",
  );
}

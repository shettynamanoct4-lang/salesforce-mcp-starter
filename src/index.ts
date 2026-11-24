#!/usr/bin/env node
/**
 * Read-only Salesforce MCP server.
 *
 * Exposes safe, typed tools that any MCP client (Claude Code, Cursor, VS Code) can call:
 *   - whoami            identity of the connected user
 *   - describe_object   fields, types, picklists of an sObject
 *   - run_soql          SELECT-only queries with an enforced row cap
 *   - get_record        one record by Id with selected fields
 *
 * Least privilege by design: no DML, no Apex execution, no metadata writes. All calls run as the
 * authenticated user, so Salesforce sharing and FLS still apply.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SalesforceClient } from "./salesforce.js";
import { assertReadOnlySoql, MAX_ROWS } from "./guards.js";
import { audit } from "./audit.js";

const sf = new SalesforceClient();
const server = new McpServer({ name: "salesforce-readonly", version: "1.0.0" });

const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

server.tool("whoami", "Returns the connected Salesforce user and org.", {}, async () => {
  audit("whoami", {});
  return asText(await sf.get("/services/oauth2/userinfo", true));
});

server.tool(
  "describe_object",
  "Describes an sObject: fields, types, required flags, picklist values and relationships.",
  { objectName: z.string().regex(/^[A-Za-z0-9_]+$/, "Invalid object API name") },
  async ({ objectName }) => {
    audit("describe_object", { objectName });
    const d = await sf.get(`/sobjects/${objectName}/describe`);
    return asText({
      name: d.name,
      label: d.label,
      fields: d.fields.map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable && !f.defaultedOnCreate,
        picklistValues: f.picklistValues?.filter((p: any) => p.active).map((p: any) => p.value),
        referenceTo: f.referenceTo,
      })),
    });
  },
);

server.tool(
  "run_soql",
  `Runs a read-only SOQL SELECT. Results are capped at ${MAX_ROWS} rows.`,
  { query: z.string().min(10) },
  async ({ query }) => {
    const safe = assertReadOnlySoql(query);
    audit("run_soql", { query: safe });
    const result = await sf.get(`/query?q=${encodeURIComponent(safe)}`);
    return asText({ totalSize: result.totalSize, records: result.records });
  },
);

server.tool(
  "get_record",
  "Gets a single record by Id with the requested fields.",
  {
    objectName: z.string().regex(/^[A-Za-z0-9_]+$/),
    recordId: z.string().regex(/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/, "Invalid Salesforce Id"),
    fields: z.array(z.string().regex(/^[A-Za-z0-9_.]+$/)).min(1).max(50),
  },
  async ({ objectName, recordId, fields }) => {
    audit("get_record", { objectName, recordId });
    return asText(await sf.get(`/sobjects/${objectName}/${recordId}?fields=${fields.join(",")}`));
  },
);

await server.connect(new StdioServerTransport());

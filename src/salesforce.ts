import { execFileSync } from "node:child_process";

const API_VERSION = process.env.SF_API_VERSION ?? "v62.0";

interface Session {
  instanceUrl: string;
  accessToken: string;
}

/**
 * Minimal Salesforce REST client. Reuses the Salesforce CLI session (`sf org display`) so no
 * credentials are stored by this server. Alternatively set SF_INSTANCE_URL + SF_ACCESS_TOKEN.
 */
export class SalesforceClient {
  private session?: Session;

  private resolveSession(): Session {
    if (this.session) return this.session;
    if (process.env.SF_INSTANCE_URL && process.env.SF_ACCESS_TOKEN) {
      this.session = { instanceUrl: process.env.SF_INSTANCE_URL, accessToken: process.env.SF_ACCESS_TOKEN };
      return this.session;
    }
    const args = ["org", "display", "--json"];
    if (process.env.SF_TARGET_ORG) args.push("--target-org", process.env.SF_TARGET_ORG);
    const out = JSON.parse(execFileSync("sf", args, { encoding: "utf8" }));
    this.session = { instanceUrl: out.result.instanceUrl, accessToken: out.result.accessToken };
    return this.session;
  }

  async get(path: string, absolute = false): Promise<any> {
    const { instanceUrl, accessToken } = this.resolveSession();
    const url = absolute ? `${instanceUrl}${path}` : `${instanceUrl}/services/data/${API_VERSION}${path}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Salesforce API ${res.status}: ${body.slice(0, 500)}`);
    }
    return res.json();
  }
}

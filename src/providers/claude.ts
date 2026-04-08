/**
 * Claude (Anthropic) usage provider
 * 
 * Note: Usage tracking not available - placeholder only
 */

import type { UsageData } from "../utils/format.ts";

export async function fetchClaudeUsage(): Promise<UsageData> {
  return {
    provider: "Claude",
    windows: [],
    extra: { "Status": "Usage tracking unavailable" },
  };
}

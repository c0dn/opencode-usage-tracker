/**
 * GitHub Copilot usage provider
 * 
 * Uses GitHub's internal Copilot API to get plan and quota info
 */

import type { UsageData } from "../utils/format.ts";
import { formatRelativeTime } from "../utils/format.ts";

const COPILOT_USER_ENDPOINT = "https://api.github.com/copilot_internal/user";

interface QuotaSnapshot {
  quota_id: string;
  remaining: number;
  entitlement: number;
  percent_remaining: number;
  unlimited: boolean;
  overage_count?: number;
  overage_permitted?: boolean;
}

interface CopilotUserResponse {
  login?: string;
  copilot_plan?: string;
  access_type_sku?: string;
  chat_enabled?: boolean;
  quota_reset_date?: string;
  quota_reset_date_utc?: string;
  quota_snapshots?: Record<string, QuotaSnapshot>;
}

export async function fetchCopilotUsage(accessToken: string): Promise<UsageData> {
  try {
    const response = await fetch(COPILOT_USER_ENDPOINT, {
      method: "GET",
      headers: {
        "Authorization": `token ${accessToken}`,
        "Accept": "application/json",
        "Editor-Version": "vscode/1.96.2",
        "X-Github-Api-Version": "2025-04-01",
        "User-Agent": "opencode-usage-tracker/1.0.0",
      },
    });
    
    if (!response.ok) {
      return {
        provider: "GitHub Copilot",
        windows: [],
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json() as CopilotUserResponse;
    
    const windows: UsageData["windows"] = [];
    const extra: Record<string, string> = {};
    
    // Parse quota_reset_date_utc for reset time
    let resetDate: Date | undefined;
    if (data.quota_reset_date_utc) {
      resetDate = new Date(data.quota_reset_date_utc);
    } else if (data.quota_reset_date) {
      resetDate = new Date(data.quota_reset_date + "T00:00:00Z");
    }
    
    const resetTimeStr = resetDate ? formatRelativeTime(resetDate) : undefined;
    
    // Process quota_snapshots
    if (data.quota_snapshots) {
      const premium = data.quota_snapshots["premium_interactions"];
      
      if (premium && !premium.unlimited && premium.entitlement > 0) {
        const used = premium.entitlement - premium.remaining;
        const usedPercent = (used / premium.entitlement) * 100;
        
        windows.push({
          label: "Premium",
          usedPercent,
          resetTime: resetTimeStr,
        });
        
        extra["Requests"] = `${used}/${premium.entitlement} used`;
        extra["Remaining"] = `${premium.remaining} requests`;
      }
      
      // Check for chat quota (if not unlimited)
      const chat = data.quota_snapshots["chat"];
      if (chat && !chat.unlimited && chat.entitlement > 0) {
        const used = chat.entitlement - chat.remaining;
        const usedPercent = (used / chat.entitlement) * 100;
        
        windows.push({
          label: "Chat",
          usedPercent,
        });
      }
    }
    
    // If no quota data, show as unlimited
    if (windows.length === 0) {
      extra["Status"] = "Unlimited";
    }
    
    // Determine plan type
    let planType = data.copilot_plan || "Free";
    if (data.access_type_sku === "free_educational_quota") {
      planType = "Education";
    } else if (planType === "individual") {
      planType = "Pro";
    }
    
    return {
      provider: "GitHub Copilot",
      planType,
      windows,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    };
    
  } catch (error) {
    return {
      provider: "GitHub Copilot",
      windows: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

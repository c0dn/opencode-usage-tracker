/**
 * OpenAI / Codex usage provider
 * 
 * API: https://chatgpt.com/backend-api/wham/usage
 * Auth: Bearer token with ChatGPT-Account-Id header
 */

import type { UsageData } from "../utils/format.ts";
import { formatRelativeTime } from "../utils/format.ts";

const CODEX_USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";

interface RateLimitWindow {
  used_percent: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  reset_at?: number;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit: {
    primary_window?: RateLimitWindow;
    secondary_window?: RateLimitWindow;
    [key: string]: RateLimitWindow | undefined;
  };
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: string;
  };
}

function getWindowLabel(key: string, window: RateLimitWindow): string {
  // Try to determine label from limit_window_seconds
  if (window.limit_window_seconds) {
    const hours = window.limit_window_seconds / 3600;
    if (hours <= 24) {
      return `${Math.round(hours)}h`;
    }
    const days = hours / 24;
    if (days === 7) {
      return "Weekly";
    }
    return `${Math.round(days)}d`;
  }
  
  // Fallback to key-based labels
  if (key === "primary_window") return "5h";
  if (key === "secondary_window") return "Weekly";
  
  return key.replace(/_/g, " ").replace(/window/i, "").trim() || "Usage";
}

function getResetTime(window: RateLimitWindow): Date | null {
  const now = new Date();
  
  if (window.reset_after_seconds) {
    return new Date(now.getTime() + window.reset_after_seconds * 1000);
  }
  
  if (window.reset_at) {
    // Check if timestamp is in milliseconds or seconds
    const timestamp = window.reset_at > 2_000_000_000_000 
      ? window.reset_at 
      : window.reset_at * 1000;
    return new Date(timestamp);
  }
  
  return null;
}

export async function fetchOpenAIUsage(
  accessToken: string, 
  accountId?: string
): Promise<UsageData> {
  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };
    
    if (accountId) {
      headers["ChatGPT-Account-Id"] = accountId;
    }
    
    const response = await fetch(CODEX_USAGE_ENDPOINT, {
      method: "GET",
      headers,
    });
    
    if (response.status === 401) {
      return {
        provider: "OpenAI/Codex",
        windows: [],
        error: "Token expired or invalid",
      };
    }
    
    if (response.status === 403) {
      return {
        provider: "OpenAI/Codex",
        windows: [],
        error: "Access denied (account ID may be required)",
      };
    }
    
    if (!response.ok) {
      return {
        provider: "OpenAI/Codex",
        windows: [],
        error: `HTTP ${response.status}`,
      };
    }
    
    const data = await response.json() as CodexUsageResponse;
    
    const windows: UsageData["windows"] = [];
    
    // Process rate limit windows
    // Sort by limit_window_seconds to show shorter windows first
    const windowEntries = Object.entries(data.rate_limit)
      .filter((entry): entry is [string, RateLimitWindow] => {
        const [, value] = entry;
        return value !== undefined && typeof value === "object" && "used_percent" in value;
      })
      .sort((a, b) => {
        const aSeconds = a[1].limit_window_seconds ?? Infinity;
        const bSeconds = b[1].limit_window_seconds ?? Infinity;
        return aSeconds - bSeconds;
      });
    
    // Take primary and secondary windows (usually 5h and weekly)
    const primaryWindow = windowEntries.find(([key]) => key === "primary_window")?.[1] 
      ?? windowEntries[0]?.[1];
    const secondaryWindow = windowEntries.find(([key]) => key === "secondary_window")?.[1]
      ?? windowEntries[1]?.[1];
    
    if (primaryWindow) {
      const resetDate = getResetTime(primaryWindow);
      windows.push({
        label: getWindowLabel("primary_window", primaryWindow),
        usedPercent: primaryWindow.used_percent,
        resetTime: resetDate ? formatRelativeTime(resetDate, { includeDate: false }) : undefined,
      });
    }
    
    if (secondaryWindow) {
      const resetDate = getResetTime(secondaryWindow);
      windows.push({
        label: getWindowLabel("secondary_window", secondaryWindow),
        usedPercent: secondaryWindow.used_percent,
        resetTime: resetDate ? formatRelativeTime(resetDate) : undefined,
      });
    }
    
    const extra: Record<string, string> = {};
    
    // Credits info
    if (data.credits) {
      if (data.credits.unlimited) {
        extra["Credits"] = "Unlimited";
      } else if (data.credits.balance) {
        const balance = parseFloat(data.credits.balance);
        if (!isNaN(balance)) {
          extra["Credits"] = `$${balance.toFixed(2)}`;
        }
      }
    }
    
    // Determine plan type
    let planType = data.plan_type;
    if (planType) {
      // Normalize plan type display
      planType = planType.charAt(0).toUpperCase() + planType.slice(1).toLowerCase();
    }
    
    return {
      provider: "OpenAI/Codex",
      planType,
      windows,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    };
    
  } catch (error) {
    return {
      provider: "OpenAI/Codex",
      windows: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

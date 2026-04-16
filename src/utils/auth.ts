/**
 * Auth utilities for reading tokens from OpenCode's auth.json
 */

import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export interface AuthTokens {
  copilot?: {
    accessToken: string;
  };
  openai?: OpenAIAuth;
}

export type OpenAIAuth = OpenAIChatGPTAuth | OpenAIApiKeyAuth;

export interface OpenAIChatGPTAuth {
  mode: "chatgpt";
  accessToken: string;
  accountId?: string;
}

export interface OpenAIApiKeyAuth {
  mode: "api";
  apiKey: string;
}

interface AuthJsonProvider {
  type?: string;
  access?: string;
  key?: string;
  accountId?: string;
  accessToken?: string;
  token?: string;
  groupId?: string;
  group_id?: string;
}

interface AuthJson {
  [key: string]: AuthJsonProvider | undefined;
}

/**
 * Get possible paths for OpenCode's auth.json
 */
function getAuthJsonPaths(): string[] {
  const home = homedir();
  const xdgDataHome = process.env.XDG_DATA_HOME;
  
  const paths: string[] = [];
  
  if (xdgDataHome) {
    paths.push(join(xdgDataHome, "opencode", "auth.json"));
  }
  
  paths.push(
    join(home, ".local", "share", "opencode", "auth.json"),
    join(home, "Library", "Application Support", "opencode", "auth.json"),
  );
  
  return paths;
}

/**
 * Read and parse auth.json from the first available path
 */
async function readAuthJson(): Promise<AuthJson | null> {
  const paths = getAuthJsonPaths();
  
  for (const path of paths) {
    try {
      const content = await readFile(path, "utf-8");
      return JSON.parse(content) as AuthJson;
    } catch {
      continue;
    }
  }
  
  return null;
}

/**
 * Get authentication tokens for all supported providers
 */
export async function getAuthTokens(): Promise<AuthTokens> {
  const authJson = await readAuthJson();
  
  if (!authJson) {
    return {};
  }
  
  const tokens: AuthTokens = {};
  
  // GitHub Copilot
  const copilot = authJson["copilot"] || authJson["github-copilot"];
  if (copilot) {
    const accessToken = copilot.access || copilot.accessToken || copilot.token;
    if (accessToken) {
      tokens.copilot = { accessToken };
    }
  }
  
  // OpenAI / Codex
  const openai = authJson["openai"] || authJson["chatgpt"];
  if (openai) {
    const authType = normalizeAuthType(openai.type);
    const accessToken = openai.access || openai.accessToken || openai.token;
    const apiKey = typeof openai.key === "string" ? openai.key.trim() : "";

    if (authType === "api" && apiKey) {
      tokens.openai = {
        mode: "api",
        apiKey,
      };
    } else if (accessToken) {
      tokens.openai = {
        mode: "chatgpt",
        accessToken,
        accountId: openai.accountId,
      };
    } else if (apiKey) {
      tokens.openai = {
        mode: "api",
        apiKey,
      };
    }
  }

  return tokens;
}

function normalizeAuthType(type?: string): string | undefined {
  const normalized = type?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

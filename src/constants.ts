export type ProviderName = "copilot" | "openai" | "kimi" | "all";
export type SingleProviderName = Exclude<ProviderName, "all">;

export const USAGE_COMMAND_SHOW = "plugin.usage.show";
export const USAGE_COMMAND_OPEN_PICKER = "plugin.usage.open";
export const USAGE_COMMAND_OPEN_ALL = "plugin.usage.open.all";
export const USAGE_COMMAND_OPEN_COPILOT = "plugin.usage.open.copilot";
export const USAGE_COMMAND_OPEN_OPENAI = "plugin.usage.open.openai";
export const USAGE_COMMAND_OPEN_KIMI = "plugin.usage.open.kimi";

export interface ProviderMetadata {
  id: SingleProviderName;
  label: string;
  command: {
    title: string;
    value: string;
  };
}

export const PROVIDER_METADATA: readonly ProviderMetadata[] = [
  {
    id: "openai",
    label: "OpenAI/Codex",
    command: {
      title: "Usage OpenAI",
      value: USAGE_COMMAND_OPEN_OPENAI,
    },
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    command: {
      title: "Usage Copilot",
      value: USAGE_COMMAND_OPEN_COPILOT,
    },
  },
  {
    id: "kimi",
    label: "Kimi for Coding",
    command: {
      title: "Usage Kimi",
      value: USAGE_COMMAND_OPEN_KIMI,
    },
  },
] as const;

export const PROVIDER_OPTIONS = [
  { title: "All Providers", value: "all" as const },
  ...PROVIDER_METADATA.map((provider): { title: string; value: ProviderName } => ({
    title: provider.label,
    value: provider.id,
  })),
];

const providerLabelById = Object.fromEntries(
  PROVIDER_METADATA.map((provider) => [provider.id, provider.label]),
) as Record<SingleProviderName, string>;

export function getProviderLabel(provider: ProviderName): string {
  if (provider === "all") {
    return "All Providers";
  }

  return providerLabelById[provider];
}

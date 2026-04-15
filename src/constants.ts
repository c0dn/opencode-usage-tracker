export type ProviderName = "copilot" | "openai" | "zai" | "all";

export const USAGE_COMMAND_SHOW = "plugin.usage.show";
export const USAGE_COMMAND_OPEN_PICKER = "plugin.usage.open";
export const USAGE_COMMAND_OPEN_ALL = "plugin.usage.open.all";
export const USAGE_COMMAND_OPEN_COPILOT = "plugin.usage.open.copilot";
export const USAGE_COMMAND_OPEN_OPENAI = "plugin.usage.open.openai";
export const USAGE_COMMAND_OPEN_ZAI = "plugin.usage.open.zai";

export type ProviderMetadata = {
  id: ProviderName;
  label: string;
  title: string;
  command: string;
  /**
   * Provider sort priority for combined result views (lower first).
   */
  resultOrder: number;
};

export type ProviderOption = {
  title: string;
  value: ProviderName;
};

export const PROVIDER_METADATA: readonly ProviderMetadata[] = [
  {
    id: "all",
    label: "All Providers",
    title: "Usage",
    command: USAGE_COMMAND_OPEN_ALL,
    resultOrder: Number.MAX_SAFE_INTEGER,
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    title: "Usage Copilot",
    command: USAGE_COMMAND_OPEN_COPILOT,
    resultOrder: 2,
  },
  {
    id: "openai",
    label: "OpenAI/Codex",
    title: "Usage OpenAI",
    command: USAGE_COMMAND_OPEN_OPENAI,
    resultOrder: 0,
  },
  {
    id: "zai",
    label: "Z.AI",
    title: "Usage Z.AI",
    command: USAGE_COMMAND_OPEN_ZAI,
    resultOrder: 1,
  },
];

export const PROVIDER_OPTIONS: ProviderOption[] = PROVIDER_METADATA.map((provider) => ({
  title: provider.label,
  value: provider.id,
}));

const PROVIDER_METADATA_BY_ID = Object.fromEntries(
  PROVIDER_METADATA.map((provider) => [provider.id, provider]),
) as Record<ProviderName, ProviderMetadata>;

export const PROVIDER_RESULT_ORDER = PROVIDER_METADATA
  .filter((provider): provider is ProviderMetadata & { id: Exclude<ProviderName, "all"> } => provider.id !== "all")
  .toSorted((a, b) => a.resultOrder - b.resultOrder)
  .map((provider) => provider.id);

export function getProviderMetadata(provider: ProviderName): ProviderMetadata {
  return PROVIDER_METADATA_BY_ID[provider];
}

export function getProviderLabel(provider: ProviderName): string {
  return getProviderMetadata(provider).label;
}

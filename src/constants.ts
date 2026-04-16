export type ProviderName = "copilot" | "openai" | "zai" | "all";

export type ConcreteProviderName = Exclude<ProviderName, "all">;

export type ProviderMetadata = {
  readonly id: ConcreteProviderName;
  readonly label: string;
  readonly command: {
    readonly title: string;
    readonly value: string;
  };
};

export const PROVIDER_METADATA: Record<ConcreteProviderName, ProviderMetadata> = {
  openai: {
    id: "openai",
    label: "OpenAI/Codex",
    command: {
      title: "Usage OpenAI",
      value: "plugin.usage.open.openai",
    },
  },
  copilot: {
    id: "copilot",
    label: "GitHub Copilot",
    command: {
      title: "Usage Copilot",
      value: "plugin.usage.open.copilot",
    },
  },
  zai: {
    id: "zai",
    label: "Z.AI",
    command: {
      title: "Usage Z.AI",
      value: "plugin.usage.open.zai",
    },
  },
};

export const PROVIDER_ORDER: readonly ConcreteProviderName[] = ["openai", "copilot", "zai"];

type ConcreteProviderLabels = Record<ConcreteProviderName, string>;

const concreteProviderLabels = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => [provider, PROVIDER_METADATA[provider].label]),
) as ConcreteProviderLabels;

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  all: "All Providers",
  ...concreteProviderLabels,
};

export const PROVIDER_OPTIONS = PROVIDER_ORDER.map((provider) => ({
  title: PROVIDER_METADATA[provider].label,
  value: provider,
}));

export const PROVIDER_COMMANDS = PROVIDER_ORDER.map((provider) => ({
  provider,
  title: PROVIDER_METADATA[provider].command.title,
  value: PROVIDER_METADATA[provider].command.value,
}));

export function getProviderLabel(provider: ProviderName): string {
  return provider === "all" ? PROVIDER_LABELS.all : PROVIDER_METADATA[provider].label;
}

export const USAGE_COMMAND_SHOW = "plugin.usage.show";
export const USAGE_COMMAND_OPEN_PICKER = "plugin.usage.open";
export const USAGE_COMMAND_OPEN_ALL = "plugin.usage.open.all";
export const USAGE_COMMAND_OPEN_COPILOT = PROVIDER_METADATA.copilot.command.value;
export const USAGE_COMMAND_OPEN_OPENAI = PROVIDER_METADATA.openai.command.value;
export const USAGE_COMMAND_OPEN_ZAI = PROVIDER_METADATA.zai.command.value;

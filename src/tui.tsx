/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import {
  USAGE_COMMAND_OPEN_PICKER,
  USAGE_COMMAND_OPEN_ALL,
  USAGE_COMMAND_OPEN_COPILOT,
  USAGE_COMMAND_OPEN_OPENAI,
  type ProviderName,
} from "./constants.ts";
import { buildUsageTable } from "./usage.ts";

const PLUGIN_ID = "opencode-usage-tracker";

type UsageOption = {
  title: string;
  value: ProviderName;
  description: string;
};

const PROVIDER_OPTIONS: UsageOption[] = [
  { title: "All Providers", value: "all", description: "Copilot and OpenAI summary" },
  { title: "GitHub Copilot", value: "copilot", description: "Copilot quota and reset windows" },
  { title: "OpenAI/Codex", value: "openai", description: "OpenAI usage windows and credits" },
];

function getProviderLabel(provider: ProviderName): string {
  switch (provider) {
    case "all":
      return "All Providers";
    case "copilot":
      return "GitHub Copilot";
    case "openai":
      return "OpenAI/Codex";
  }
}

function openResultDialog(
  api: Parameters<TuiPlugin>[0],
  title: string,
  message: string,
): void {
  const DialogAlert = api.ui.DialogAlert;
  api.ui.dialog.setSize("xlarge");
  api.ui.dialog.replace(() => <DialogAlert title={title} message={message} />);
}

function openProviderPicker(api: Parameters<TuiPlugin>[0]): void {
  const DialogSelect = api.ui.DialogSelect;
  api.ui.dialog.setSize("large");
  api.ui.dialog.replace(() => (
    <DialogSelect
      title="Usage Dashboard"
      placeholder="Choose provider"
      options={PROVIDER_OPTIONS}
      onSelect={(option) => {
        api.ui.dialog.clear();
        void openUsageDialog(api, option.value as ProviderName);
      }}
    />
  ));
}

async function openUsageDialog(
  api: Parameters<TuiPlugin>[0],
  provider: ProviderName,
): Promise<void> {
  api.ui.toast({
    title: "Usage Tracker",
    message: "Fetching usage data...",
    variant: "info",
    duration: 2000,
  });

  try {
    const table = await buildUsageTable(provider);
    const label = getProviderLabel(provider);
    const title = provider === "all" ? "Usage Dashboard" : `Usage Dashboard - ${label}`;
    openResultDialog(api, title, table);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    openResultDialog(api, "Usage Dashboard - Error", message);
  }
}

const tui: TuiPlugin = async (api) => {
  api.command.register(() => [
    {
      title: "Usage Dashboard",
      value: USAGE_COMMAND_OPEN_PICKER,
      category: "Plugin",
      onSelect: () => {
        openProviderPicker(api);
      },
    },
    {
      title: "Usage Dashboard (All)",
      value: USAGE_COMMAND_OPEN_ALL,
      category: "Plugin",
      hidden: true,
      onSelect: () => {
        void openUsageDialog(api, "all");
      },
    },
    {
      title: "Usage Dashboard (Copilot)",
      value: USAGE_COMMAND_OPEN_COPILOT,
      category: "Plugin",
      hidden: true,
      onSelect: () => {
        void openUsageDialog(api, "copilot");
      },
    },
    {
      title: "Usage Dashboard (OpenAI)",
      value: USAGE_COMMAND_OPEN_OPENAI,
      category: "Plugin",
      hidden: true,
      onSelect: () => {
        void openUsageDialog(api, "openai");
      },
    },
  ]);
};

const module: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
};

export default module;

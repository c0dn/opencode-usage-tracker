import { UsageTrackerPlugin } from "./plugin.ts";
import type { PluginModule } from "@opencode-ai/plugin";

const module: PluginModule & { id: string } = {
  id: "opencode-usage-tracker",
  server: UsageTrackerPlugin,
};

export default module;

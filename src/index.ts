/**
 * @vibecontrols/vibe-plugin-tool-graphiql
 *
 * GraphQL Playground (GraphiQL) embedded as an iframe within the
 * VibeControls agent. Stores per-vibe GraphQL endpoint configuration
 * and serves a static HTML UI that renders the GraphiQL React component.
 *
 * Registers:
 *   - Elysia routes: /api/graphiql/*  (REST API for config management)
 *   - Static UI:     src/ui/          (GraphiQL HTML served via staticDir)
 *
 * Migrated to consume `@vibecontrols/plugin-sdk` for the contract,
 * lifecycle, and telemetry helpers.
 */

import { join } from "node:path";

import {
  createLifecycleHooks,
  TelemetryEmitter,
  type HostServices,
  type ProfileContext,
  type VibePlugin,
  type VibePluginFactory,
} from "@vibecontrols/plugin-sdk";

export type { GraphiQLConfig } from "./types.js";

/**
 * Local extension of the SDK contract — `hasUI` and `ui.staticDir` are
 * agent-host extensions consumed by the plugin loader to mount static
 * assets. The SDK contract leaves these to the host implementation.
 */
interface PluginCapabilitiesV1 {
  restPaths: string[];
  wsTopics: string[];
  rpcMethods: string[];
}

interface PluginContributionV1 {
  mountPoint: string;
  id: string;
  title: string;
  icon?: string;
  order?: number;
  runtimes: Array<"iframe" | "in-process">;
  capabilities: PluginCapabilitiesV1;
}

type GraphiQLVibePlugin = VibePlugin & {
  hasUI?: boolean;
  publicPaths?: string[];
  ui?: {
    staticDir: string;
    title: string;
    icon?: string;
    capabilities?: PluginCapabilitiesV1;
    /**
     * PR-12 — declares this plugin's UI as a `vibe.detailTab`
     * contribution so it shows up in the Vibe detail page's tab strip
     * when the host's `vibes.tabs.graphiql-iframe` flag is on. The
     * existing inline GraphQL Playground tab in microfe-vibecontrols
     * is filtered out when the flag is on (PR-13).
     */
    contributions?: PluginContributionV1[];
  };
};

const PLUGIN_NAME = "graphiql";
const PLUGIN_VERSION = "2026.509.1";

export const createPlugin: VibePluginFactory = (
  _ctx: ProfileContext,
): VibePlugin => {
  const lifecycle = createLifecycleHooks({
    name: PLUGIN_NAME,
    telemetryEventName: "tool.ready",
    onInit: (hostServices: HostServices) => {
      const telemetry = new TelemetryEmitter(
        PLUGIN_NAME,
        PLUGIN_VERSION,
        hostServices,
      );
      telemetry.emitEvent("tool.ready", { provider: "graphiql" });
    },
  });

  const plugin: GraphiQLVibePlugin = {
    capabilities: {
      storage: "rw",
      subprocess: true,
      audit: true,
      telemetry: true,
    },
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: "GraphQL Playground (GraphiQL)",
    tags: ["frontend", "integration"],
    hasUI: true,
    apiPrefix: "/api/graphiql",
    ui: {
      staticDir: join(import.meta.dir, "ui"),
      title: "GraphQL Playground",
      icon: "Network",
      capabilities: {
        restPaths: [
          "/ui/graphiql",
          "/api/graphiql",
        ],
        wsTopics: [],
        rpcMethods: ["getContext"],
      },
      contributions: [
        {
          mountPoint: "vibe.detailTab",
          id: "plugin:graphiql",
          title: "GraphQL",
          icon: "Network",
          // Same order slot as the inline `graphqlPlayground` tab so
          // the strip looks identical to the user when the migration
          // flag flips on.
          order: 90,
          runtimes: ["iframe"],
          capabilities: {
            restPaths: [
              "/ui/graphiql",
              "/api/graphiql",
            ],
            wsTopics: [],
            rpcMethods: ["getContext"],
          },
        },
      ],
    },

    async onServerStart(app: unknown, hostServices: HostServices) {
      await lifecycle.onServerStart(app, hostServices);

      const elysiaApp = app as { use: (plugin: unknown) => unknown };

      // Register REST API routes
      const { createGraphiQLRoutes } = await import("./routes.js");
      elysiaApp.use(createGraphiQLRoutes(hostServices));

      process.stdout.write(
        "  Plugin 'graphiql' registered routes: /api/graphiql\n",
      );
    },

    onServerStop: lifecycle.onServerStop,
  };

  return plugin;
};

export default createPlugin;

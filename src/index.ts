/**
 * @vibecontrols/vibe-plugin-tool-graphiql
 *
 * GraphQL Playground (GraphiQL) embedded as an iframe within the
 * VibeControls agent. Stores per-vibe GraphQL endpoint configuration
 * and serves a static HTML UI that renders the GraphiQL React component.
 *
 * Registers:
 *   - Elysia routes: /api/plugins/graphiql/ui/*  (REST API for config management)
 *   - Static UI:     src/ui/                     (GraphiQL HTML served via staticDir)
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
const PLUGIN_VERSION = "2026.531.1";

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
    // P0-SEC-03 migration — `apiPrefix` stays at `/api/graphiql` so the
    // existing svc → agent server-to-server proxy (x-agent-api-key auth,
    // path `/api/profiles/<profile>/graphiql/...`) keeps working. The
    // browser-bound mirror is mounted at `/api/plugins/graphiql/ui` in
    // `onServerStart` so the iframe XHR (iframe-token authed) reaches
    // the same handlers under the agent's iframe-token allow-list
    // (`/api/plugins/<plugin>/ui[/...]`). Both mounts share the same
    // RoutesBuilder handler module — only the prefix differs.
    apiPrefix: "/api/graphiql",
    ui: {
      staticDir: join(import.meta.dir, "ui"),
      title: "GraphQL Playground",
      icon: "Network",
      capabilities: {
        restPaths: [
          "/ui/graphiql",
          "/api/plugins/graphiql/ui",
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
              "/api/plugins/graphiql/ui",
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

      // Register REST API routes. Two parallel mounts:
      //   - /api/graphiql/*            — server-to-server (svc proxy)
      //   - /api/plugins/graphiql/ui/* — browser iframe XHR (matches the
      //                                  agent's iframe-token allow-list)
      // Same handlers; only the mount prefix differs.
      const { createGraphiQLRoutes, createGraphiQLUIRoutes } = await import(
        "./routes.js"
      );
      elysiaApp.use(createGraphiQLRoutes(hostServices));
      elysiaApp.use(createGraphiQLUIRoutes(hostServices));

      process.stdout.write(
        "  Plugin 'graphiql' registered routes: /api/graphiql, /api/plugins/graphiql/ui\n",
      );
    },

    onServerStop: lifecycle.onServerStop,

    async onServerReady() {
      try {
        const sdkContext = (await import("@vibecontrols/plugin-sdk/context")) as {
          registerContextProvider?: (provider: {
            name: string;
            timeoutMs?: number;
            getContext: () => Promise<{
              pluginName: string;
              description?: string;
              data: Record<string, unknown>;
            }>;
          }) => void;
        };
        sdkContext.registerContextProvider?.({
          name: "tool-graphiql",
          timeoutMs: 500,
          async getContext() {
            return {
              pluginName: "tool-graphiql",
              description:
                "GraphiQL playground capability metadata for the LLM Context feature.",
              data: {
                pluginVersion: PLUGIN_VERSION,
                apiPrefix: "/api/plugins/graphiql/ui",
              },
            };
          },
        });
      } catch {
        // SDK doesn't support context — skip silently
      }
    },
  };

  return plugin;
};

export default createPlugin;

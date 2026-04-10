/**
 * @burdenoff/vibe-plugin-graphiql v1.0.0
 *
 * GraphQL Playground (GraphiQL) embedded as an iframe within the
 * VibeControls agent. Stores per-vibe GraphQL endpoint configuration
 * and serves a static HTML UI that renders the GraphiQL React component.
 *
 * Registers:
 *   - Elysia routes: /api/graphiql/*  (REST API for config management)
 *   - Static UI:     src/ui/          (GraphiQL HTML served via staticDir)
 *
 * Install: vibe plugin install @burdenoff/vibe-plugin-graphiql
 */

import { join } from "node:path";
import type { Elysia } from "elysia";
import type { HostServices, VibePlugin } from "./types.js";

// Re-export types for external consumers
export type {
  VibePlugin,
  HostServices,
  StorageProvider,
  EventBus,
  ServiceRegistry,
  GraphiQLConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

export const vibePlugin: VibePlugin = {
  name: "graphiql",
  version: "1.0.0",
  description: "GraphQL Playground (GraphiQL)",
  tags: ["frontend", "integration"],
  hasUI: true,
  apiPrefix: "/api/graphiql",
  ui: {
    staticDir: join(import.meta.dir, "ui"),
    title: "GraphQL Playground",
  },

  async onServerStart(app: Elysia, hostServices: HostServices) {
    // Register REST API routes
    const { createGraphiQLRoutes } = await import("./routes.js");
    app.use(createGraphiQLRoutes(hostServices));

    console.log(
      "  Plugin 'graphiql' registered routes: /api/graphiql",
    );
  },
};

export default vibePlugin;

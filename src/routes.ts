/**
 * REST API routes for the graphiql plugin.
 *
 * Prefix: /api/graphiql
 *
 * Routes:
 *   GET    /config/:vibeId  - Get GraphQL endpoint config for a vibe
 *   PUT    /config/:vibeId  - Save GraphQL endpoint config for a vibe
 *   DELETE /config/:vibeId  - Remove config for a vibe
 *
 * Built on `RoutesBuilder` from `@vibecontrols/plugin-sdk/routes` —
 * concerns like prefix and error handler fold through the SDK.
 */

import type { Elysia } from "elysia";

import { RoutesBuilder } from "@vibecontrols/plugin-sdk/routes";
import type { HostServices } from "@vibecontrols/plugin-sdk/contract";

import type { AgentStorageProvider, GraphiQLConfig } from "./types.js";

const STORAGE_NAMESPACE = "graphiql";

export function createGraphiQLRoutes(hostServices: HostServices): Elysia {
  // The agent's runtime storage exposes a `delete` returning Promise<boolean>;
  // narrow once at the boundary so the route handlers can branch on the
  // delete result for a clearer 404 response.
  const storage = hostServices.storage as unknown as AgentStorageProvider;

  const app = new RoutesBuilder("graphiql", hostServices)
    .withPrefix("/api/graphiql")
    .withErrorHandler()
    .build();

  const wired = app

    // GET /api/graphiql/config/:vibeId
    .get("/config/:vibeId", async ({ params, set }) => {
      const { vibeId } = params;

      const raw = await storage.get(STORAGE_NAMESPACE, `config:${vibeId}`);
      if (!raw) {
        set.status = 404;
        return { error: `No GraphiQL config found for vibe '${vibeId}'` };
      }

      try {
        const config: GraphiQLConfig = JSON.parse(raw);
        return { vibeId, config };
      } catch {
        set.status = 500;
        return { error: "Stored config is corrupted" };
      }
    })

    // PUT /api/graphiql/config/:vibeId
    .put("/config/:vibeId", async ({ params, body, set }) => {
      const { vibeId } = params;
      const payload = body as Partial<GraphiQLConfig> | null;

      if (!payload || typeof payload.graphqlUrl !== "string") {
        set.status = 400;
        return {
          error: "Request body must include 'graphqlUrl' (string)",
        };
      }

      const config: GraphiQLConfig = {
        graphqlUrl: payload.graphqlUrl,
        headers: payload.headers ?? undefined,
      };

      await storage.set(
        STORAGE_NAMESPACE,
        `config:${vibeId}`,
        JSON.stringify(config),
      );

      return { message: "Config saved", vibeId, config };
    })

    // DELETE /api/graphiql/config/:vibeId
    .delete("/config/:vibeId", async ({ params }) => {
      const { vibeId } = params;

      const deleted = await storage.delete(
        STORAGE_NAMESPACE,
        `config:${vibeId}`,
      );

      return {
        message: deleted
          ? "Config deleted"
          : "No config found (nothing to delete)",
        vibeId,
      };
    });

  return wired as unknown as Elysia;
}

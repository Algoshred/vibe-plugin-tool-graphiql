/**
 * Domain models for the vibe-plugin-tool-graphiql plugin.
 *
 * Plugin contract types (VibePlugin / HostServices / PluginCapabilities /
 * StorageProvider / ServiceRegistry / EventBus) are imported from
 * `@vibecontrols/plugin-sdk` — do NOT redeclare them here.
 *
 * The agent's runtime exposes a slightly richer storage surface (sync
 * `keys` listing) than the SDK's neutral StorageProvider; routes only
 * need string get/set/delete which both contracts provide.
 */

export interface AgentStorageProvider {
  get(namespace: string, key: string): Promise<string | null>;
  set(namespace: string, key: string, value: string): Promise<void>;
  delete(namespace: string, key: string): Promise<boolean>;
}

export interface GraphiQLConfig {
  /** The GraphQL endpoint URL to query */
  graphqlUrl: string;
  /** Optional custom headers to send with GraphQL requests */
  headers?: Record<string, string>;
}

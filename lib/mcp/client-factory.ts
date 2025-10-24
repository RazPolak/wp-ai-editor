import { WordPressMcpClient } from './wordpress-client';

/**
 * Cached MCP client instances (singleton pattern per environment)
 */
let cachedSandboxClient: WordPressMcpClient | null = null;
let cachedProductionClient: WordPressMcpClient | null = null;
let cachedRealSiteClient: WordPressMcpClient | null = null;

/**
 * Client environment type
 */
export type McpEnvironment = 'sandbox' | 'production' | 'real-site';

/**
 * Get or create WordPress MCP client for specified environment
 *
 * Uses singleton pattern to reuse the same connection across requests.
 * Reads credentials from environment variables based on environment type.
 *
 * @param environment - 'sandbox', 'production', or 'real-site'
 */
export async function getWordPressMcpClient(
  environment: McpEnvironment = 'sandbox'
): Promise<WordPressMcpClient> {
  // Return cached client if available
  if (environment === 'sandbox' && cachedSandboxClient) {
    return cachedSandboxClient;
  }
  if (environment === 'production' && cachedProductionClient) {
    return cachedProductionClient;
  }
  if (environment === 'real-site' && cachedRealSiteClient) {
    return cachedRealSiteClient;
  }

  // Load credentials based on environment
  const envPrefix =
    environment === 'production' ? 'WORDPRESS_PRODUCTION_MCP' :
    environment === 'real-site' ? 'WORDPRESS_REAL_SITE_MCP' :
    'WORDPRESS_MCP';

  const url = process.env[`${envPrefix}_URL`];
  const username = process.env[`${envPrefix}_USERNAME`];
  const password = process.env[`${envPrefix}_PASSWORD`];

  if (!url || !username || !password) {
    throw new Error(
      `Missing ${environment} WordPress MCP credentials. Set ${envPrefix}_URL, ` +
      `${envPrefix}_USERNAME, and ${envPrefix}_PASSWORD in .env.local`
    );
  }

  console.log(`[MCP] Creating new ${environment} WordPress MCP client...`);
  console.log(`[MCP] Connecting to: ${url}`);

  // Create and connect new client
  const client = new WordPressMcpClient({ url, username, password });

  try {
    await client.connect();

    // Cache client based on environment
    if (environment === 'sandbox') {
      cachedSandboxClient = client;
    } else if (environment === 'production') {
      cachedProductionClient = client;
    } else {
      cachedRealSiteClient = client;
    }

    return client;
  } catch (error) {
    console.error(`[MCP] Failed to connect to ${environment}:`, error);
    throw new Error(
      `Failed to connect to ${environment} WordPress MCP: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convenience function to get sandbox client (default behavior)
 */
export async function getSandboxMcpClient(): Promise<WordPressMcpClient> {
  return getWordPressMcpClient('sandbox');
}

/**
 * Get production WordPress MCP client
 */
export async function getProductionMcpClient(): Promise<WordPressMcpClient> {
  return getWordPressMcpClient('production');
}

/**
 * Get real site WordPress MCP client (port 8002)
 */
export async function getRealSiteMcpClient(): Promise<WordPressMcpClient> {
  return getWordPressMcpClient('real-site');
}

/**
 * Clear cached client connections
 * Useful for testing or when credentials change
 *
 * @param environment - Optional: specific environment to clear, or 'all'
 */
export function clearClientCache(environment?: McpEnvironment | 'all'): void {
  if (!environment || environment === 'all' || environment === 'sandbox') {
    if (cachedSandboxClient) {
      console.log('[MCP] Clearing sandbox client cache...');
      cachedSandboxClient.close();
      cachedSandboxClient = null;
    }
  }

  if (!environment || environment === 'all' || environment === 'production') {
    if (cachedProductionClient) {
      console.log('[MCP] Clearing production client cache...');
      cachedProductionClient.close();
      cachedProductionClient = null;
    }
  }

  if (!environment || environment === 'all' || environment === 'real-site') {
    if (cachedRealSiteClient) {
      console.log('[MCP] Clearing real-site client cache...');
      cachedRealSiteClient.close();
      cachedRealSiteClient = null;
    }
  }
}
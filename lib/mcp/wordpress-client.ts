import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  WordPressMcpClientOptions,
  McpToolCallResult,
  McpToolsListResponse
} from './types';

/**
 * WordPress MCP Client
 *
 * Handles authenticated HTTP communication with WordPress MCP adapter
 * using Streamable HTTP transport (modern MCP protocol).
 *
 * The WordPress MCP adapter only supports POST requests and returns 405 for GET.
 * StreamableHTTPClientTransport gracefully handles this by falling back to POST-only mode.
 */
export class WordPressMcpClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private options: WordPressMcpClientOptions;

  constructor(options: WordPressMcpClientOptions) {
    this.options = options;
  }

  /**
   * Connect to WordPress MCP server
   * Establishes authenticated Streamable HTTP connection
   *
   * The transport will attempt SSE streaming via GET (receives 405),
   * then gracefully fall back to POST-only mode for all communication.
   */
  async connect(): Promise<void> {
    const authHeader = `Basic ${Buffer.from(
      `${this.options.username}:${this.options.password}`
    ).toString('base64')}`;

    this.transport = new StreamableHTTPClientTransport(
      new URL(this.options.url),
      {
        requestInit: {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          }
        }
      }
    );

    this.client = new Client({
      name: 'vercel-ai-wordpress-agent',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    console.log('[MCP] ✓ Connected to WordPress MCP');
  }

  /**
   * Call a WordPress tool via MCP
   *
   * @param name - Tool name (e.g. 'wordpress-list-posts')
   *               IMPORTANT: MCP tool names use HYPHENS, not slashes.
   *               The MCP adapter automatically converts WordPress ability names
   *               from 'wordpress/list-posts' to 'wordpress-list-posts'
   * @param args - Tool arguments matching the tool's input schema
   * @returns Tool execution result
   * @throws Error if tool execution fails or returns WP_Error
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    console.log(`[MCP] Calling tool: ${name}`, JSON.stringify(args, null, 2));

    try {
      const result = await this.client.callTool({ name, arguments: args });

      // Handle WP_Error responses from WordPress
      if (result.isError) {
        console.error(`[MCP] ✗ Tool error:`, result.content);
        throw new Error(`WordPress Error: ${JSON.stringify(result.content)}`);
      }

      console.log(`[MCP] ✓ Tool executed successfully: ${name}`);
      return result as McpToolCallResult;

    } catch (error) {
      console.error(`[MCP] ✗ Tool execution failed:`, error);
      throw error;
    }
  }

  /**
   * List all available tools from WordPress MCP
   *
   * @returns List of available tools with their schemas
   */
  async listTools(): Promise<McpToolsListResponse> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const result = await this.client.listTools();
    console.log(`[MCP] Listed ${result.tools.length} tools from WordPress`);

    return result as McpToolsListResponse;
  }

  /**
   * Close the MCP connection
   * Should be called when shutting down the application
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      console.log('[MCP] Connection closed');
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}
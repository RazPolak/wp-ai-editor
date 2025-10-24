/**
 * MCP Tool Call Result
 * Represents the response from calling an MCP tool
 */
export interface McpToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}

/**
 * WordPress MCP Client Configuration
 */
export interface WordPressMcpClientOptions {
  url: string;
  username: string;
  password: string;
}

/**
 * MCP Tool Definition
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP Tools List Response
 */
export interface McpToolsListResponse {
  tools: McpTool[];
}
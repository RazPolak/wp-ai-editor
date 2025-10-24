import { tool } from 'ai';
import { getWordPressMcpClient, type McpEnvironment } from '../mcp/client-factory';
import {
  getPostSchema,
  listPostsSchema,
  createPostSchema,
  updatePostSchema,
  deletePostSchema,
  type GetPostInput,
  type ListPostsInput,
  type CreatePostInput,
  type UpdatePostInput,
  type DeletePostInput
} from './wordpress-schemas';

/**
 * Helper function to extract content from MCP tool call result
 * MCP returns content as an array of objects, we need to extract the actual data
 */
function extractContent(result: any): any {
  if (Array.isArray(result.content)) {
    const textContent = result.content.find((c: any) => c.type === 'text');
    if (textContent?.text) {
      try {
        // Try to parse as JSON
        return JSON.parse(textContent.text);
      } catch {
        // Return raw text if not JSON
        return textContent.text;
      }
    }
  }
  return result.content;
}

/**
 * Generic WordPress tool factory
 *
 * Creates a complete set of WordPress tools configured for a specific environment.
 * Uses lazy client resolution to leverage caching and avoid unnecessary connections.
 *
 * @param environment - Target WordPress environment ('sandbox' | 'production' | 'real-site')
 * @returns Tool set for the specified environment
 *
 * @example
 * ```typescript
 * // Create tools for different environments
 * const sandboxTools = createWordPressTools('sandbox');
 * const prodTools = createWordPressTools('production');
 * const realSiteTools = createWordPressTools('real-site');
 * ```
 */
export function createWordPressTools(environment: McpEnvironment = 'sandbox') {
  const envLabel =
    environment === 'sandbox' ? 'sandbox' :
    environment === 'production' ? 'production' : 'real site';

  return {
    'wordpress-get-post': tool({
      description: `Retrieves a WordPress post by ID from the ${envLabel} environment. Returns post details including title, content, status, author, and date.`,
      inputSchema: getPostSchema,
      execute: async (input: GetPostInput) => {
        const client = await getWordPressMcpClient(environment);
        const result = await client.callTool('wordpress-get-post', input);
        return extractContent(result);
      }
    }),

    'wordpress-list-posts': tool({
      description: `Lists WordPress posts with pagination from the ${envLabel} environment. Returns an array of posts with their IDs, titles, status, and dates.`,
      inputSchema: listPostsSchema,
      execute: async (input: ListPostsInput) => {
        const client = await getWordPressMcpClient(environment);
        const result = await client.callTool('wordpress-list-posts', input);
        return extractContent(result);
      }
    }),

    'wordpress-create-post': tool({
      description: `Creates a new WordPress post in the ${envLabel} environment. Returns the created post with its ID, title, content, status, and URL.`,
      inputSchema: createPostSchema,
      execute: async (input: CreatePostInput) => {
        const client = await getWordPressMcpClient(environment);
        const result = await client.callTool('wordpress-create-post', input);
        return extractContent(result);
      }
    }),

    'wordpress-update-post': tool({
      description: `Updates an existing WordPress post in the ${envLabel} environment. Only provided fields will be updated. Returns the updated post details.`,
      inputSchema: updatePostSchema,
      execute: async (input: UpdatePostInput) => {
        const client = await getWordPressMcpClient(environment);
        const result = await client.callTool('wordpress-update-post', input);
        return extractContent(result);
      }
    }),

    'wordpress-delete-post': tool({
      description: `Deletes a WordPress post from the ${envLabel} environment. By default moves to trash. Set force=true for permanent deletion.`,
      inputSchema: deletePostSchema,
      execute: async (input: DeletePostInput) => {
        const client = await getWordPressMcpClient(environment);
        const result = await client.callTool('wordpress-delete-post', input);
        return extractContent(result);
      }
    })
  };
}

/**
 * Default WordPress tools (sandbox environment)
 * Maintains backward compatibility with existing code
 */
export const wordpressTools = createWordPressTools('sandbox');
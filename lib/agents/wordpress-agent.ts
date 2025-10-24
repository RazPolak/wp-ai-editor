import { generateText, streamText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createWordPressTools } from '../tools/wordpress-tools';
import { changeTracker } from '../sync/change-tracker';
import { type McpEnvironment } from '../mcp/client-factory';

/**
 * Creates environment-specific system prompt
 */
function createSystemPrompt(environment: McpEnvironment): string {
  const envLabel =
    environment === 'sandbox' ? 'sandbox' :
    environment === 'production' ? 'production' : 'real site';

  return `You are a WordPress content management assistant working with the ${envLabel} environment. You can help users:
- List, read, create, update, and delete WordPress posts
- Manage post status (draft, pending, publish, private)
- Work with post content in HTML format

Guidelines:
- Always confirm destructive actions (delete, publish) before executing them
- When listing posts, present them in a clear, readable format
- For content creation, be helpful but let the user define the actual content
- Explain what you're doing and show the results clearly
- IMPORTANT: You are working with the ${envLabel.toUpperCase()} environment`;
}

/**
 * Get the configured AI model based on environment variables
 * Defaults to Claude if ANTHROPIC_API_KEY is set
 */
function getModel() {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'anthropic';

  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
    }
    return anthropic('claude-3-5-sonnet-20241022');
  }

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    }
    return openai('gpt-4-turbo');
  }

  throw new Error(`Unsupported AI_PROVIDER: ${provider}. Must be 'openai' or 'anthropic'`);
}

/**
 * Execute WordPress agent with text generation
 *
 * @param prompt - User's natural language request
 * @param environment - Target WordPress environment (defaults to 'sandbox')
 * @returns Complete agent response with tool calls
 *
 * @example
 * ```typescript
 * // Use default sandbox environment
 * await executeWordPressAgent('List all posts');
 *
 * // Use specific environment
 * await executeWordPressAgent('Create a post', 'production');
 * await executeWordPressAgent('List posts', 'real-site');
 * ```
 */
export async function executeWordPressAgent(
  prompt: string,
  environment: McpEnvironment = 'sandbox'
) {
  const model = getModel();
  const tools = createWordPressTools(environment);

  const result = await generateText({
    model,
    tools,
    system: createSystemPrompt(environment),
    prompt,
    // SDK 5: Enable multi-step tool execution with stopWhen
    stopWhen: stepCountIs(10)  // Allow up to 10 tool execution steps
  });

  // Track changes made during execution
  changeTracker.trackFromAgentResult(result);

  return result;
}

/**
 * Execute WordPress agent with streaming
 *
 * @param prompt - User's natural language request
 * @param environment - Target WordPress environment (defaults to 'sandbox')
 * @returns Streaming agent response
 *
 * @example
 * ```typescript
 * // Stream with production environment
 * const stream = await streamWordPressAgent('List posts', 'production');
 *
 * for await (const chunk of stream.textStream) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function streamWordPressAgent(
  prompt: string,
  environment: McpEnvironment = 'sandbox'
) {
  const model = getModel();
  const tools = createWordPressTools(environment);

  return await streamText({
    model,
    tools,
    system: createSystemPrompt(environment),
    prompt,
    // SDK 5: Enable multi-step tool execution with stopWhen
    stopWhen: stepCountIs(10)  // Allow up to 10 tool execution steps
  });
}
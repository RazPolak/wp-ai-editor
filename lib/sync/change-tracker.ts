import type { generateText } from 'ai';

/**
 * WordPress tool arguments union type
 * Covers all possible tool input types
 */
export type WordPressToolArgs =
  | { id: number }  // get-post
  | { per_page?: number; page?: number }  // list-posts
  | { title: string; content: string; status?: 'publish' | 'draft' | 'pending' | 'private' }  // create-post
  | { id: number; title?: string; content?: string; status?: 'publish' | 'draft' | 'pending' | 'private' }  // update-post
  | { id: number; force?: boolean };  // delete-post

/**
 * WordPress tool result union type
 * Covers all possible tool return types
 */
export type WordPressToolResult =
  | WordPressPost  // get-post, create-post, update-post
  | WordPressPostList  // list-posts
  | WordPressDeleteResult;  // delete-post

/**
 * WordPress post object
 */
export interface WordPressPost {
  id: number;
  title: string;
  content: string;
  status: string;
  author?: number;
  date?: string;
  url?: string;
}

/**
 * WordPress post list response
 */
export interface WordPressPostList {
  posts: WordPressPost[];
  total: number;
  page: number;
  per_page: number;
}

/**
 * WordPress delete result
 */
export interface WordPressDeleteResult {
  success: boolean;
  message: string;
  deleted_post: {
    id: number;
    title: string;
  };
}

/**
 * Represents a single change made by the AI agent
 */
export interface TrackedChange {
  /** Tool name that was called */
  toolName: string;

  /** Arguments passed to the tool (typed union) */
  args: WordPressToolArgs;

  /** Result returned by the tool (typed union) */
  result: WordPressToolResult | undefined;

  /** Timestamp when the change was made */
  timestamp: Date;

  /** Step number in the agent execution */
  stepIndex: number;
}

/**
 * SDK Extraction Layer
 * These types represent what we extract from the Vercel AI SDK
 * Decoupled from SDK internal types for maintainability
 */

/**
 * Extracted tool call from SDK (our domain representation)
 */
interface ExtractedToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;  // SDK v5 uses 'input' not 'args'
}

/**
 * Extracted tool result from SDK (our domain representation)
 */
interface ExtractedToolResult {
  toolCallId: string;
  output: unknown;  // SDK v5 uses 'output' not 'result'
}

/**
 * Extracted step data from SDK
 */
interface ExtractedStep {
  toolCalls: ExtractedToolCall[];
  toolResults: ExtractedToolResult[];
}

/**
 * Type guard: Validates if unknown value is a valid tool call
 */
function isValidToolCall(value: unknown): value is ExtractedToolCall {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.toolCallId === 'string' &&
    typeof obj.toolName === 'string' &&
    'input' in obj  // SDK v5 uses 'input' not 'args'
  );
}

/**
 * Type guard: Validates if unknown value is a valid tool result
 */
function isValidToolResult(value: unknown): value is ExtractedToolResult {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.toolCallId === 'string' &&
    'output' in obj  // SDK v5 uses 'output' property
  );
}

/**
 * Type guard: Validates if value matches WordPress tool args shape
 */
function isWordPressToolArgs(value: unknown): value is WordPressToolArgs {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  // WordPress tools have either 'id' or 'title/content'
  const hasId = typeof obj.id === 'number';
  const hasTitle = typeof obj.title === 'string';
  const hasContent = typeof obj.content === 'string';
  const hasPerPage = typeof obj.per_page === 'number' || obj.per_page === undefined;

  return hasId || (hasTitle && hasContent) || hasPerPage;
}

/**
 * Type guard: Validates if value matches WordPress tool result shape
 */
function isWordPressToolResult(value: unknown): value is WordPressToolResult {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Check for valid WordPress result patterns
  const isPost = typeof obj.id === 'number' && typeof obj.title === 'string';
  const isPostList = Array.isArray(obj.posts) && typeof obj.total === 'number';
  const isDeleteResult = typeof obj.success === 'boolean' && typeof obj.message === 'string';

  return isPost || isPostList || isDeleteResult;
}

/**
 * Safely extracts tool call data from SDK step
 * Uses runtime validation to ensure type safety
 *
 * @param sdkStep - Step from SDK result (unknown shape)
 * @returns Validated extracted step or null if invalid
 */
function extractStepData(sdkStep: unknown): ExtractedStep | null {
  if (typeof sdkStep !== 'object' || sdkStep === null) {
    return null;
  }

  const step = sdkStep as Record<string, unknown>;

  // Safely extract toolCalls
  const toolCalls: ExtractedToolCall[] = [];
  if (Array.isArray(step.toolCalls)) {
    for (const call of step.toolCalls) {
      if (isValidToolCall(call)) {
        toolCalls.push(call);
      }
    }
  }

  // Safely extract toolResults
  const toolResults: ExtractedToolResult[] = [];
  if (Array.isArray(step.toolResults)) {
    for (const result of step.toolResults) {
      if (isValidToolResult(result)) {
        toolResults.push(result);
      }
    }
  }

  return { toolCalls, toolResults };
}

/**
 * Change tracking session
 * In MVP: Single global session (no multi-user support)
 */
class ChangeTracker {
  private changes: TrackedChange[] = [];

  /**
   * Track a new change from AI agent tool call
   */
  trackChange(change: Omit<TrackedChange, 'timestamp'>): void {
    this.changes.push({
      ...change,
      timestamp: new Date()
    });

    console.log(`[ChangeTracker] Tracked ${change.toolName} (step ${change.stepIndex})`);
  }

  /**
   * Track multiple changes from Vercel AI SDK result
   * Extracts tool calls from result.steps with full type safety
   *
   * Strategy:
   * - Accept any generateText result type (generic)
   * - Extract data into our own domain types with runtime validation
   * - Validate WordPress-specific types before storing
   * - Handle errors gracefully with logging
   *
   * @param result - The result from generateText() with tool calls
   */
  trackFromAgentResult(
    result: { steps: unknown[] }
  ): void {
    const steps = result.steps;

    if (!steps || steps.length === 0) {
      console.log('[ChangeTracker] No tool calls to track');
      return;
    }

    let trackedCount = 0;
    let skippedCount = 0;

    steps.forEach((sdkStep, index: number) => {
      // Extract and validate step data using our extraction layer
      const extractedStep = extractStepData(sdkStep);

      if (!extractedStep) {
        console.warn(`[ChangeTracker] Invalid step data at index ${index}`);
        skippedCount++;
        return;
      }

      const { toolCalls, toolResults } = extractedStep;

      if (toolCalls.length === 0) {
        return; // No tool calls in this step
      }

      toolCalls.forEach((toolCall) => {
        // Find matching result for this tool call
        const toolResult = toolResults.find(
          (r) => r.toolCallId === toolCall.toolCallId
        );

        // Validate input before storing (SDK v5 uses 'input' not 'args')
        if (!isWordPressToolArgs(toolCall.input)) {
          console.warn(
            `[ChangeTracker] Invalid input for ${toolCall.toolName} (step ${index})`,
            toolCall.input
          );
          skippedCount++;
          return;
        }

        // Validate result if present (SDK v5 uses 'output' property)
        let validatedResult: WordPressToolResult | undefined;
        if (toolResult && toolResult.output !== undefined) {
          if (isWordPressToolResult(toolResult.output)) {
            validatedResult = toolResult.output;
          } else {
            console.warn(
              `[ChangeTracker] Invalid result for ${toolCall.toolName} (step ${index})`,
              toolResult.output
            );
          }
        }

        // Store validated change
        this.trackChange({
          toolName: toolCall.toolName,
          args: toolCall.input,  // Map SDK v5 'input' to our 'args'
          result: validatedResult,
          stepIndex: index
        });

        trackedCount++;
      });
    });

    console.log(
      `[ChangeTracker] Tracked ${trackedCount} changes, skipped ${skippedCount} invalid entries`
    );
    console.log(`[ChangeTracker] Total changes: ${this.changes.length}`);
  }

  /**
   * Get all tracked changes
   */
  getChanges(): ReadonlyArray<TrackedChange> {
    return [...this.changes];
  }

  /**
   * Clear all tracked changes
   * Called after successful sync
   */
  clearChanges(): void {
    const count = this.changes.length;
    this.changes = [];
    console.log(`[ChangeTracker] Cleared ${count} changes`);
  }

  /**
   * Get count of tracked changes
   */
  getChangeCount(): number {
    return this.changes.length;
  }

  /**
   * Check if there are any changes to sync
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }
}

/**
 * Global change tracker instance (MVP: single session)
 */
export const changeTracker = new ChangeTracker();
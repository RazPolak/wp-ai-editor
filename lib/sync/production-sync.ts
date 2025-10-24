import { getProductionMcpClient } from '../mcp/client-factory';
import type { McpToolCallResult } from '../mcp/types';
import type { TrackedChange, WordPressToolResult } from './change-tracker';

/**
 * Result of syncing a single change
 */
export interface SyncResult {
  change: TrackedChange;
  success: boolean;
  error?: string;
  productionResult?: McpToolCallResult;
  parsedResult?: WordPressToolResult;
}

/**
 * Overall sync operation result
 */
export interface SyncOperationResult {
  success: boolean;
  totalChanges: number;
  appliedChanges: number;
  failedChanges: number;
  results: SyncResult[];
  errors: string[];
}

/**
 * Production Sync Service
 * Applies tracked changes from sandbox to production
 */
export class ProductionSyncService {

  /**
   * Apply a single change to production
   */
  private async applySingleChange(change: TrackedChange): Promise<SyncResult> {
    try {
      console.log(`[Sync] Applying ${change.toolName} to production...`);

      const productionClient = await getProductionMcpClient();

      // Map tool name from sandbox to production
      // In MVP, tool names are identical
      const productionToolName = this.mapToolName(change.toolName);

      // Execute tool on production
      const result = await productionClient.callTool(productionToolName, change.args);

      // Parse the result
      let parsedResult: WordPressToolResult | undefined;
      try {
        const textContent = result.content.find((c) => c.type === 'text');
        if (textContent?.text) {
          parsedResult = JSON.parse(textContent.text) as WordPressToolResult;
        }
      } catch (parseError) {
        console.warn(`[Sync] Could not parse result for ${change.toolName}`, parseError);
      }

      console.log(`[Sync] ✓ Successfully applied ${change.toolName}`);

      return {
        change,
        success: true,
        productionResult: result,
        parsedResult
      };
    } catch (error) {
      console.error(`[Sync] ✗ Failed to apply ${change.toolName}:`, error);

      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map sandbox tool name to production tool name
   * In MVP, they are identical
   */
  private mapToolName(sandboxToolName: string): string {
    // Future: Could map different tool names or versions
    return sandboxToolName;
  }

  /**
   * Apply all tracked changes to production
   *
   * @param changes - Array of tracked changes from sandbox
   * @returns Result of sync operation
   */
  async applyChanges(changes: TrackedChange[]): Promise<SyncOperationResult> {
    console.log(`[Sync] Starting sync of ${changes.length} changes to production...`);

    const results: SyncResult[] = [];
    const errors: string[] = [];

    // Apply changes sequentially (order matters for creates → updates)
    for (const change of changes) {
      const result = await this.applySingleChange(change);
      results.push(result);

      if (!result.success) {
        errors.push(`${change.toolName}: ${result.error}`);
      }
    }

    const appliedChanges = results.filter(r => r.success).length;
    const failedChanges = results.filter(r => !r.success).length;

    console.log(`[Sync] Sync complete: ${appliedChanges} applied, ${failedChanges} failed`);

    return {
      success: failedChanges === 0,
      totalChanges: changes.length,
      appliedChanges,
      failedChanges,
      results,
      errors
    };
  }
}

/**
 * Global sync service instance
 */
export const productionSyncService = new ProductionSyncService();
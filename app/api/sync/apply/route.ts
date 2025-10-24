import { NextResponse } from 'next/server';
import { changeTracker } from '@/lib/sync/change-tracker';
import { productionSyncService } from '@/lib/sync/production-sync';

/**
 * POST /api/sync/apply
 *
 * Apply all tracked changes from sandbox to production
 * This is the "Save" button that deploys changes
 */
export async function POST() {
  try {
    // Get tracked changes
    const changes = changeTracker.getChanges();

    if (changes.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No changes to sync. Make changes in sandbox first.',
        totalChanges: 0,
        appliedChanges: 0
      });
    }

    console.log(`[API] Syncing ${changes.length} changes to production...`);

    // Apply changes to production
    const result = await productionSyncService.applyChanges([...changes]);

    // Clear tracked changes on success
    if (result.success) {
      changeTracker.clearChanges();
      console.log('[API] Sync successful, cleared tracked changes');
    } else {
      console.warn('[API] Sync had failures, keeping tracked changes');
    }

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Successfully synced ${result.appliedChanges} changes to production`
        : `Sync completed with ${result.failedChanges} failures`,
      totalChanges: result.totalChanges,
      appliedChanges: result.appliedChanges,
      failedChanges: result.failedChanges,
      errors: result.errors,
      // Include detailed results for debugging
      details: result.results.map(r => ({
        toolName: r.change.toolName,
        success: r.success,
        error: r.error
      }))
    }, {
      status: result.success ? 200 : 207  // 207 = Multi-Status (partial success)
    });

  } catch (error) {
    console.error('[API] Sync failed with exception:', error);

    return NextResponse.json({
      success: false,
      message: 'Sync failed with error',
      error: error instanceof Error ? error.message : 'Unknown error',
      totalChanges: 0,
      appliedChanges: 0,
      failedChanges: 0
    }, { status: 500 });
  }
}

/**
 * GET /api/sync/apply
 *
 * Preview what would be synced without actually syncing
 */
export async function GET() {
  const changes = changeTracker.getChanges();

  return NextResponse.json({
    message: 'Preview of changes that would be synced to production',
    changeCount: changes.length,
    changes: changes.map(c => ({
      toolName: c.toolName,
      args: c.args,
      timestamp: c.timestamp,
      stepIndex: c.stepIndex
    }))
  });
}
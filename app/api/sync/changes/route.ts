import { NextResponse } from 'next/server';
import { changeTracker } from '@/lib/sync/change-tracker';

/**
 * GET /api/sync/changes
 * Returns all tracked changes in the current session
 */
export async function GET() {
  return NextResponse.json({
    changes: changeTracker.getChanges(),
    count: changeTracker.getChangeCount(),
    hasChanges: changeTracker.hasChanges()
  });
}

/**
 * DELETE /api/sync/changes
 * Clear all tracked changes (for testing)
 */
export async function DELETE() {
  const count = changeTracker.getChangeCount();
  changeTracker.clearChanges();

  return NextResponse.json({
    message: `Cleared ${count} tracked changes`,
    remainingChanges: 0
  });
}
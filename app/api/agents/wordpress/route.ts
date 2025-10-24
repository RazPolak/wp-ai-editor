import { NextRequest, NextResponse } from 'next/server';
import { executeWordPressAgent } from '@/lib/agents/wordpress-agent';
import { changeTracker } from '@/lib/sync/change-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * WordPress Agent API Endpoint (Non-streaming)
 *
 * POST /api/agents/wordpress
 * Body: { prompt: string }
 *
 * Executes the WordPress agent with the given prompt and returns
 * the complete response including tool calls.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    console.log('[Agent] Processing prompt:', prompt);

    const result = await executeWordPressAgent(prompt);

    // SDK 5: response structure changed
    return NextResponse.json({
      text: result.text,
      toolCalls: result.steps.flatMap(s =>
        s.toolCalls?.map(tc => ({
          name: tc.toolName,
          args: 'args' in tc ? tc.args : {}  // SDK 5: handle DynamicToolCall vs TypedToolCall
        })) || []
      ),
      finishReason: result.finishReason,
      usage: result.usage,
      // Include tracked changes in response
      trackedChanges: {
        count: changeTracker.getChangeCount(),
        hasChanges: changeTracker.hasChanges()
      }
    });

  } catch (error) {
    console.error('[Agent] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
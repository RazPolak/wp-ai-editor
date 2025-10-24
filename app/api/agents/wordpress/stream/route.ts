import { NextRequest } from 'next/server';
import { streamWordPressAgent } from '@/lib/agents/wordpress-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * WordPress Agent API Endpoint (Streaming)
 *
 * POST /api/agents/wordpress/stream
 * Body: { prompt: string }
 *
 * Streams the WordPress agent response in real-time using
 * the Vercel AI SDK data stream protocol.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Agent Stream] Processing prompt:', prompt);

    const result = await streamWordPressAgent(prompt);

    // SDK 5: toDataStreamResponse renamed to toTextStreamResponse
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[Agent Stream] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
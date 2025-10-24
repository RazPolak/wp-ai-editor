import { NextResponse } from 'next/server';
import { getSandboxMcpClient, getProductionMcpClient } from '@/lib/mcp/client-factory';

/**
 * Health Check API Endpoint
 *
 * GET /api/health
 *
 * Verifies connection to both sandbox and production WordPress MCP instances
 * and lists available tools. Useful for debugging and monitoring.
 */
export async function GET() {
  try {
    // Check sandbox connection
    const sandboxClient = await getSandboxMcpClient();
    const sandboxTools = await sandboxClient.listTools();

    // Check production connection
    const productionClient = await getProductionMcpClient();
    const productionTools = await productionClient.listTools();

    return NextResponse.json({
      status: 'healthy',
      sandbox: {
        status: 'connected',
        tools_available: sandboxTools.tools.length,
        tool_names: sandboxTools.tools.map(t => t.name)
      },
      production: {
        status: 'connected',
        tools_available: productionTools.tools.length,
        tool_names: productionTools.tools.map(t => t.name)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
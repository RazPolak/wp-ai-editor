# Production Sync MVP Implementation Plan

## Overview

This plan implements a minimal viable product (MVP) for syncing AI-generated WordPress changes from a sandbox environment to a production WordPress instance. The user can make changes via AI in the sandbox, review them, and then deploy those changes to production with a single API call.

## Current State Analysis

### What Exists Now

**Sandbox WordPress** (Port 8000):
- Docker container with WordPress + MariaDB
- MCP adapter with 5 abilities (get, list, create, update, delete posts)
- Next.js backend connects via MCP client
- AI agent executes tool calls via Vercel AI SDK

**Architecture**:
```
User → Next.js API → AI Agent → MCP Client → Sandbox WordPress (8000)
```

**Key Files**:
- `docker-compose.yml`: Single WordPress container configuration
- `lib/mcp/client-factory.ts`: Singleton MCP client
- `lib/mcp/wordpress-client.ts`: MCP client implementation
- `lib/agents/wordpress-agent.ts`: AI agent with tool execution
- `app/api/agents/wordpress/route.ts`: Agent API endpoint

### What's Missing

1. **Production WordPress Instance**: No second WordPress container
2. **Change Tracking**: No record of what the AI changed
3. **Sync Endpoint**: No API to deploy changes to production
4. **Production MCP Client**: No way to connect to production WordPress

### Key Constraints Discovered

- Vercel AI SDK provides `result.steps` containing all tool calls
- Each step includes: `toolName`, `args`, `result`
- Current MCP client is singleton (one connection)
- Tool execution is stateless (no session tracking)

## Desired End State

### User Flow

```
1. User: "Create a post with body 'was created by AI'"
   ↓
2. AI Agent executes wordpress-create-post in sandbox
   ↓
3. System tracks: { toolName: 'wordpress-create-post', args: {...} }
   ↓
4. User calls: POST /api/sync/apply
   ↓
5. Backend reads tracked changes
   ↓
6. Backend replays changes on production WordPress
   ↓
7. User receives: { success: true, appliedChanges: 1 }
```

### Architecture

```
User → Next.js API → AI Agent → MCP Client (Sandbox) → Sandbox WordPress (8000)
                          ↓
                    Change Tracker
                          ↓
User → Sync API → Production Sync Service → MCP Client (Production) → Production WordPress (8001)
```

### Success Criteria

**MVP Deliverables**:
- [ ] Production WordPress container running on port 8001 (Phase 1)
- [ ] Production MCP client can connect to port 8001 (Phase 2)
- [ ] Changes are tracked during AI agent execution (Phase 3)
- [ ] Sync endpoint applies tracked changes to production (Phase 4)
- [ ] Single post can be created in sandbox and synced to production (Phase 5)

**Verification Steps**:
1. Create post via AI in sandbox: `POST /api/agents/wordpress { "prompt": "Create a post" }`
2. Verify post exists in sandbox: Visit `http://localhost:8000`
3. Call sync endpoint: `POST /api/sync/apply`
4. Verify post exists in production: Visit `http://localhost:8001`

## What We're NOT Doing

**Explicitly out of scope for MVP**:
- UI for reviewing changes before sync
- Conflict resolution (production modifications after sandbox creation)
- Rollback or undo functionality
- Multi-user sessions or session management
- Persistent change history (database storage)
- Incremental sync (only changed fields)
- Validation of production state before sync
- Backup of production before sync
- Webhooks or notifications
- Sync status tracking or history
- Support for non-post entities (pages, media, etc.)
- Granular entity export/import (WP-CLI wp post get/update)

**Why These Are Deferred**:
- MVP focuses on proving the sync mechanism works
- Local Docker environment reduces risk
- Single-user simplifies session management
- In-memory storage is sufficient for POC

## Implementation Approach

### High-Level Strategy

1. **Add Production WordPress Container** - Clone sandbox setup for production
2. **Create Dual MCP Client System** - Support both sandbox and production connections
3. **Implement Change Tracking** - Capture AI tool calls in memory
4. **Build Sync Endpoint** - Replay tracked changes on production
5. **Test End-to-End** - Verify full user flow

### Key Decisions

**Decision 1: Change Tracking Strategy**
- **Chosen**: Track tool calls from Vercel AI SDK result
- **Why**: SDK already provides complete tool call history
- **Alternative Rejected**: WordPress hooks (requires plugin modification)

**Decision 2: Storage for Tracked Changes**
- **Chosen**: In-memory JavaScript object
- **Why**: Simplest for MVP, no database required
- **Alternative Rejected**: Redis, Database (overkill for single-user)

**Decision 3: Sync Strategy**
- **Chosen**: Replay tool calls on production
- **Why**: Reuses existing tool definitions, type-safe
- **Alternative Rejected**: Database export/import, WP-CLI (more complex)

**Decision 4: Production WordPress Setup**
- **Chosen**: Second Docker container with separate DB
- **Why**: Truly isolated production environment
- **Alternative Rejected**: Separate database on same WordPress (shared filesystem issues)

## Phase 1: Add Production WordPress Container

### Overview
Duplicate the sandbox WordPress setup to create a production instance on port 8001 with a separate database.

### Changes Required

#### 1. Docker Compose Configuration
**File**: `docker-compose.yml`

**Changes**: Add production WordPress and database services

```yaml
services:
  # Existing services (db, wordpress, wpcli, phpmyadmin) remain unchanged

  # NEW: Production Database
  db_production:
    image: mariadb:latest
    command: '--default-authentication-plugin=mysql_native_password'
    volumes:
      - db_production_data:/var/lib/mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-wordpress}
      MYSQL_USER: ${MYSQL_USER:-wordpress}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-wordpress}
    networks:
      - wordpress-network
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5

  # NEW: Production WordPress
  wordpress_production:
    image: wordpress:latest
    depends_on:
      db_production:
        condition: service_healthy
    volumes:
      - wp_production_data:/var/www/html
      - ./wp-content/plugins:/var/www/html/wp-content/plugins
      - ./wp-content/themes:/var/www/html/wp-content/themes
      - ./wp-content/mu-plugins:/var/www/html/wp-content/mu-plugins
      - ./composer.json:/var/www/html/composer.json
      - wp_production_vendor:/var/www/html/vendor
    ports:
      - "8001:80"  # Different port for production
    restart: always
    environment:
      WORDPRESS_DB_HOST: db_production  # Point to production DB
      WORDPRESS_DB_USER: ${MYSQL_USER:-wordpress}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD:-wordpress}
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
      WORDPRESS_DEBUG: ${WP_DEBUG:-1}
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_MEMORY_LIMIT', '256M');
        define('WP_MAX_MEMORY_LIMIT', '512M');
        define('WP_CACHE', false);
        define('ALLOW_UNFILTERED_UPLOADS', true);
    networks:
      - wordpress-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # NEW: Production WP-CLI
  wpcli_production:
    image: wordpress:cli
    user: '33'
    depends_on:
      wordpress_production:
        condition: service_healthy
    volumes:
      - wp_production_data:/var/www/html
      - ./wp-content/plugins:/var/www/html/wp-content/plugins
      - ./wp-content/themes:/var/www/html/wp-content/themes
      - ./wp-content/mu-plugins:/var/www/html/wp-content/mu-plugins
      - ./composer.json:/var/www/html/composer.json
      - wp_production_vendor:/var/www/html/vendor
    environment:
      WORDPRESS_DB_HOST: db_production
      WORDPRESS_DB_USER: ${MYSQL_USER:-wordpress}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD:-wordpress}
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
    networks:
      - wordpress-network

volumes:
  db_data:
  wp_data:
  wp_vendor:
  # NEW: Production volumes
  db_production_data:
  wp_production_data:
  wp_production_vendor:

networks:
  wordpress-network:
    driver: bridge
```

#### 2. Environment Variables
**File**: `.env.local.example`

**Changes**: Add production WordPress configuration

```bash
# Existing sandbox configuration
WORDPRESS_MCP_URL=http://localhost:8000/wp-json/wordpress-poc/mcp
WORDPRESS_MCP_USERNAME=admin
WORDPRESS_MCP_PASSWORD=<generated-from-setup-script>

# NEW: Production WordPress configuration
WORDPRESS_PRODUCTION_MCP_URL=http://localhost:8001/wp-json/wordpress-poc/mcp
WORDPRESS_PRODUCTION_MCP_USERNAME=admin
WORDPRESS_PRODUCTION_MCP_PASSWORD=<generated-from-setup-script>

# AI Provider (unchanged)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<your-key>
```

#### 3. Setup Script Updates
**File**: `scripts/setup/install-production-wordpress.sh` (NEW)

**Purpose**: Install MCP adapter and create application password for production

```bash
#!/bin/bash

set -e

echo "🚀 Setting up Production WordPress MCP Adapter..."

# Wait for production WordPress to be ready
echo "⏳ Waiting for production WordPress to be ready..."
sleep 10

# Check if WordPress is accessible
if ! docker-compose exec wordpress_production curl -f http://localhost > /dev/null 2>&1; then
  echo "❌ Production WordPress is not accessible"
  exit 1
fi

# Install Composer dependencies (same as sandbox)
echo "📦 Installing Composer dependencies in production..."
docker-compose exec -T wordpress_production composer install --no-interaction

# Install WordPress if not already installed
echo "🔧 Installing WordPress core in production..."
docker-compose run --rm wpcli_production wp core install \
  --url=http://localhost:8001 \
  --title="WordPress Production" \
  --admin_user=admin \
  --admin_password=admin \
  --admin_email=admin@example.com \
  --skip-email || echo "WordPress already installed"

# Create application password for MCP client
echo "🔑 Creating application password for production WordPress..."
APP_PASSWORD=$(docker-compose run --rm wpcli_production wp user application-password create admin "MCP Client Production" --porcelain)

if [ -z "$APP_PASSWORD" ]; then
  echo "❌ Failed to generate application password"
  exit 1
fi

echo "✅ Application password created: $APP_PASSWORD"

# Update .env.local with production credentials
if grep -q "WORDPRESS_PRODUCTION_MCP_PASSWORD" .env.local; then
  # Update existing line
  sed -i.bak "s/WORDPRESS_PRODUCTION_MCP_PASSWORD=.*/WORDPRESS_PRODUCTION_MCP_PASSWORD=$APP_PASSWORD/" .env.local
  rm .env.local.bak
else
  # Append new line
  echo "" >> .env.local
  echo "# Production WordPress MCP Configuration" >> .env.local
  echo "WORDPRESS_PRODUCTION_MCP_URL=http://localhost:8001/wp-json/wordpress-poc/mcp" >> .env.local
  echo "WORDPRESS_PRODUCTION_MCP_USERNAME=admin" >> .env.local
  echo "WORDPRESS_PRODUCTION_MCP_PASSWORD=$APP_PASSWORD" >> .env.local
fi

echo "✅ Production WordPress MCP adapter setup complete!"
echo "📝 Credentials saved to .env.local"
echo "🌐 Production WordPress: http://localhost:8001"
echo "🔐 Admin login: admin / admin"
```

**Make executable**: `chmod +x scripts/setup/install-production-wordpress.sh`

### Success Criteria

#### Automated Verification:
- [x] `docker-compose up -d` starts all containers without errors
- [x] `docker-compose ps` shows healthy containers (wordpress, wordpress_production, db, db_production all healthy)
- [x] `curl http://localhost:8001` returns WordPress HTML (302 redirect to WordPress)
- [x] `curl http://localhost:8001/wp-json/wordpress-poc/mcp` returns 401 (authentication required)

#### Manual Verification:
- [x] Visit http://localhost:8001 - see WordPress site
- [x] Visit http://localhost:8001/wp-admin - can log in with admin/admin
- [x] Production has no posts (clean state)
- [x] Sandbox and production are completely isolated (changes in one don't affect the other)

---

## Phase 2: Create Dual MCP Client System

### Overview
Extend the MCP client factory to support both sandbox and production connections simultaneously.

### Changes Required

#### 1. MCP Client Factory
**File**: `lib/mcp/client-factory.ts`

**Changes**: Add production client support

```typescript
import { WordPressMcpClient } from './wordpress-client';
import type { WordPressMcpClientOptions } from './types';

/**
 * Cached MCP client instances (singleton pattern per environment)
 */
let cachedSandboxClient: WordPressMcpClient | null = null;
let cachedProductionClient: WordPressMcpClient | null = null;

/**
 * Client environment type
 */
export type McpEnvironment = 'sandbox' | 'production';

/**
 * Get or create WordPress MCP client for specified environment
 *
 * Uses singleton pattern to reuse the same connection across requests.
 * Reads credentials from environment variables based on environment type.
 *
 * @param environment - 'sandbox' or 'production'
 */
export async function getWordPressMcpClient(
  environment: McpEnvironment = 'sandbox'
): Promise<WordPressMcpClient> {
  // Return cached client if available
  if (environment === 'sandbox' && cachedSandboxClient) {
    return cachedSandboxClient;
  }
  if (environment === 'production' && cachedProductionClient) {
    return cachedProductionClient;
  }

  // Load credentials based on environment
  const envPrefix = environment === 'production' ? 'WORDPRESS_PRODUCTION_MCP' : 'WORDPRESS_MCP';
  const url = process.env[`${envPrefix}_URL`];
  const username = process.env[`${envPrefix}_USERNAME`];
  const password = process.env[`${envPrefix}_PASSWORD`];

  if (!url || !username || !password) {
    throw new Error(
      `Missing ${environment} WordPress MCP credentials. Set ${envPrefix}_URL, ` +
      `${envPrefix}_USERNAME, and ${envPrefix}_PASSWORD in .env.local`
    );
  }

  console.log(`[MCP] Creating new ${environment} WordPress MCP client...`);
  console.log(`[MCP] Connecting to: ${url}`);

  // Create and connect new client
  const client = new WordPressMcpClient({ url, username, password });

  try {
    await client.connect();

    // Cache client based on environment
    if (environment === 'sandbox') {
      cachedSandboxClient = client;
    } else {
      cachedProductionClient = client;
    }

    return client;
  } catch (error) {
    console.error(`[MCP] Failed to connect to ${environment}:`, error);
    throw new Error(
      `Failed to connect to ${environment} WordPress MCP: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convenience function to get sandbox client (default behavior)
 */
export async function getSandboxMcpClient(): Promise<WordPressMcpClient> {
  return getWordPressMcpClient('sandbox');
}

/**
 * Get production WordPress MCP client
 */
export async function getProductionMcpClient(): Promise<WordPressMcpClient> {
  return getWordPressMcpClient('production');
}

/**
 * Clear cached client connections
 * Useful for testing or when credentials change
 *
 * @param environment - Optional: specific environment to clear, or 'all'
 */
export function clearClientCache(environment?: McpEnvironment | 'all'): void {
  if (!environment || environment === 'all' || environment === 'sandbox') {
    if (cachedSandboxClient) {
      console.log('[MCP] Clearing sandbox client cache...');
      cachedSandboxClient.close();
      cachedSandboxClient = null;
    }
  }

  if (!environment || environment === 'all' || environment === 'production') {
    if (cachedProductionClient) {
      console.log('[MCP] Clearing production client cache...');
      cachedProductionClient.close();
      cachedProductionClient = null;
    }
  }
}
```

#### 2. Update Existing Tool Definitions
**File**: `lib/tools/wordpress-tools.ts`

**Changes**: Update tools to use explicit sandbox client

```typescript
import { tool } from 'ai';
import { getSandboxMcpClient } from '../mcp/client-factory';  // CHANGED: import sandbox-specific function
import type { McpToolCallResult } from '../mcp/types';  // NEW: Import MCP types
import type { WordPressToolResult } from '../sync/change-tracker';  // NEW: Import result type
// ... rest of imports

/**
 * Helper function to extract content from MCP tool call result
 * Parses the MCP response and extracts the actual WordPress data
 */
function extractContent(result: McpToolCallResult): WordPressToolResult | string {
  if (Array.isArray(result.content)) {
    const textContent = result.content.find((c) => c.type === 'text');
    if (textContent?.text) {
      try {
        // Try to parse as JSON (WordPress response)
        return JSON.parse(textContent.text) as WordPressToolResult;
      } catch {
        // Return raw text if not JSON
        return textContent.text;
      }
    }
  }
  // Fallback: return first content item as string
  return JSON.stringify(result.content);
}

/**
 * Tool: Get WordPress Post by ID
 * Always executes in SANDBOX environment
 */
export const getPostTool = tool({
  description: 'Retrieves a WordPress post by ID from the sandbox environment',
  inputSchema: getPostSchema,
  execute: async (input: GetPostInput) => {
    const client = await getSandboxMcpClient();  // CHANGED: explicit sandbox
    const result = await client.callTool('wordpress-get-post', input);
    return extractContent(result);
  }
});

// Apply same pattern to all other tools:
// - listPostsTool
// - createPostTool
// - updatePostTool
// - deletePostTool
```

#### 3. Health Check Update
**File**: `app/api/health/route.ts`

**Changes**: Add production health check

```typescript
import { NextResponse } from 'next/server';
import { getSandboxMcpClient, getProductionMcpClient } from '@/lib/mcp/client-factory';

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
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm tsc --noEmit`
- [x] Health endpoint returns sandbox and production status: `curl http://localhost:3000/api/health`
- [x] Both clients can list tools independently
- [x] Sandbox client connects to port 8000
- [x] Production client connects to port 8001

#### Manual Verification:
- [x] Health check shows both environments connected
- [x] Sandbox and production report 5 tools each
- [x] Creating a post in sandbox doesn't appear in production (still isolated)

---

## Phase 3: Implement Change Tracking

### Overview
Capture all AI tool calls during agent execution and store them in memory for later sync.

### Changes Required

#### 1. Change Tracker Module
**File**: `lib/sync/change-tracker.ts` (NEW)

**Purpose**: Track changes made by AI agent

```typescript
import type { GenerateTextResult } from 'ai';

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
 * Tool call from Vercel AI SDK
 */
interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: WordPressToolArgs;
}

/**
 * Tool result from Vercel AI SDK
 */
interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: WordPressToolResult;
}

/**
 * Step from Vercel AI SDK result
 */
interface AgentStep {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
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
   * Extracts tool calls from result.steps
   */
  trackFromAgentResult(result: GenerateTextResult<Record<string, unknown>>): void {
    const steps = result.steps as AgentStep[] | undefined;

    if (!steps || steps.length === 0) {
      console.log('[ChangeTracker] No tool calls to track');
      return;
    }

    steps.forEach((step: AgentStep, index: number) => {
      if (step.toolCalls && step.toolCalls.length > 0) {
        step.toolCalls.forEach((toolCall: ToolCall) => {
          const toolResult = step.toolResults?.find(
            (r: ToolResult) => r.toolCallId === toolCall.toolCallId
          );

          this.trackChange({
            toolName: toolCall.toolName,
            args: toolCall.args,
            result: toolResult?.result,
            stepIndex: index
          });
        });
      }
    });

    console.log(`[ChangeTracker] Tracked ${this.changes.length} total changes`);
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
```

#### 2. Update WordPress Agent
**File**: `lib/agents/wordpress-agent.ts`

**Changes**: Track changes after agent execution

```typescript
import { generateText, streamText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { wordpressTools } from '../tools/wordpress-tools';
import { changeTracker } from '../sync/change-tracker';  // NEW

// ... existing SYSTEM_PROMPT and getModel() ...

/**
 * Execute WordPress agent with text generation
 *
 * @param prompt - User's natural language request
 * @returns Complete agent response with tool calls
 */
export async function executeWordPressAgent(prompt: string) {
  const model = getModel();
  const result = await generateText({
    model,
    tools: wordpressTools,
    system: SYSTEM_PROMPT,
    prompt,
    stopWhen: stepCountIs(10)
  });

  // NEW: Track changes made during execution
  changeTracker.trackFromAgentResult(result);

  return result;
}

/**
 * Execute WordPress agent with streaming
 * NOTE: Streaming does not support change tracking in MVP
 *
 * @param prompt - User's natural language request
 * @returns Streaming agent response
 */
export async function streamWordPressAgent(prompt: string) {
  const model = getModel();
  return await streamText({
    model,
    tools: wordpressTools,
    system: SYSTEM_PROMPT,
    prompt,
    stopWhen: stepCountIs(10)
  });

  // NOTE: Change tracking not supported for streaming in MVP
  // Would require awaiting stream completion, which defeats the purpose
}
```

#### 3. Update Agent API Endpoint
**File**: `app/api/agents/wordpress/route.ts`

**Changes**: Include tracked changes in response

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { executeWordPressAgent } from '@/lib/agents/wordpress-agent';
import { changeTracker } from '@/lib/sync/change-tracker';  // NEW

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

    // Execute agent (automatically tracks changes)
    const result = await executeWordPressAgent(prompt);

    // Format response
    return NextResponse.json({
      text: result.text,
      toolCalls: result.steps.flatMap((step) =>
        step.toolCalls?.map((tc) => ({
          name: tc.toolName,
          args: tc.args,
        })) || []
      ),
      finishReason: result.finishReason,
      usage: result.usage,
      // NEW: Include tracked changes in response
      trackedChanges: {
        count: changeTracker.getChangeCount(),
        hasChanges: changeTracker.hasChanges()
      }
    });
  } catch (error) {
    console.error('Agent execution error:', error);
    return NextResponse.json(
      {
        error: 'Agent execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

#### 4. Add Debug Endpoint (Optional)
**File**: `app/api/sync/changes/route.ts` (NEW)

**Purpose**: View currently tracked changes (for debugging)

```typescript
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
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit` ✅ **COMPLETED**
- [x] Creating a post via AI results in tracked changes ✅ **COMPLETED**
- [x] `GET /api/sync/changes` returns the tracked changes ✅ **COMPLETED**
- [x] Changes include toolName, args, result, timestamp ✅ **COMPLETED**

**Note**: Phase 3 implementation encountered and resolved a TypeScript typing issue with Vercel AI SDK v5. See implementation notes below.

#### Automated Test Script:
Run the automated verification test:
```bash
pnpm test:change-tracking
```

This test script verifies:
- [x] Create post via AI agent with prompt "Create a post titled 'Test Change Tracking'"
- [x] Response includes `trackedChanges.count: 1`
- [x] `GET /api/sync/changes` returns the wordpress-create-post call with all fields
- [x] `DELETE /api/sync/changes` clears the changes
- [x] Second `GET /api/sync/changes` returns empty array

✅ **All automated tests passed** (Verified: October 17, 2025)

### Phase 3 Implementation Notes

**TypeScript Issue Resolution** (October 17, 2025)

During Phase 3 implementation, we encountered TypeScript compilation errors related to accessing tool call data from the Vercel AI SDK v5 result. The issue was resolved with a comprehensive, type-safe solution.

#### Problem
TypeScript errors at `lib/sync/change-tracker.ts:130-131`:
- `Property 'args' does not exist on type 'TypedToolCall<ToolSet>'`
- `Property 'result' does not exist on type 'TypedToolResult<ToolSet>'`

**Root Causes**:
1. **Property name mismatch**: SDK v5 changed from `result` to `output` for tool results
2. **Type inference limitations**: Generic `Awaited<ReturnType<typeof generateText>>` lost specific tool types
3. **SDK coupling**: Original implementation was tightly coupled to SDK internal types

#### Solution: SDK Extraction Layer

Implemented a three-layer architecture that completely decouples our code from Vercel AI SDK internals:

**Layer 1: SDK Extraction Types** (Lines 84-107 in `lib/sync/change-tracker.ts`)
```typescript
interface ExtractedToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

interface ExtractedToolResult {
  toolCallId: string;
  output: unknown;  // SDK v5 uses 'output' not 'result'
}
```

**Layer 2: Runtime Type Guards** (Lines 112-167)
- `isValidToolCall()` - Validates tool call structure
- `isValidToolResult()` - Validates tool result structure (checks for `output` property)
- `isWordPressToolArgs()` - Validates WordPress-specific argument types
- `isWordPressToolResult()` - Validates WordPress-specific result types

**Layer 3: Safe Extraction** (Lines 176-204)
- `extractStepData()` - Safely extracts and validates data from SDK steps
- Returns validated data or `null` if invalid
- Filters out malformed data gracefully

**Updated Method Signature** (Line 238)
```typescript
trackFromAgentResult(result: { steps: unknown[] }): void
```
Changed from `Awaited<ReturnType<typeof generateText>>` to simple structural type.

#### Key Benefits
- ✅ **No SDK Coupling**: Our types don't reference Vercel AI SDK internals
- ✅ **Explicit Types**: All types defined, no `any`, proper `unknown` handling
- ✅ **Straightforward**: Clear three-layer separation of concerns
- ✅ **Type-Safe**: Runtime validation ensures type correctness
- ✅ **Maintainable**: SDK changes only affect extraction layer
- ✅ **No Hacks**: Uses proper TypeScript patterns (type guards, structural typing)

#### Files Modified
- `lib/sync/change-tracker.ts` - Added extraction layer, updated `trackFromAgentResult()` method

#### SDK v5 'input' Property Discovery (October 17, 2025)

After resolving the initial TypeScript issues, automated testing revealed that changes were not being tracked. Investigation showed:

**Additional Root Cause**:
- SDK v5 uses `input` property for tool parameters, not `args`
- The extraction layer was checking for `'args' in obj` which always failed
- This caused all tool calls to be filtered out by the type guard

**Fix Applied**:
1. Updated `ExtractedToolCall` interface to use `input: unknown` instead of `args: unknown`
2. Updated `isValidToolCall()` type guard to check for `'input' in obj`
3. Updated `trackFromAgentResult()` to access `toolCall.input` and map it to `args` in our domain model

**Testing**:
- ✅ Created post via AI - `trackedChanges.count: 1`
- ✅ GET /api/sync/changes returns tracked changes with full data
- ✅ Changes include toolName, args (mapped from input), result, timestamp
- ✅ DELETE /api/sync/changes clears changes successfully

#### Related Documentation
- Handoff document: `thoughts/shared/handoffs/general/2025-10-17_15-00-32_phase3-change-tracking-typescript-issue.md`
- Vercel AI SDK v5 Migration Guide: Property naming changed from v4 (`args`/`result`) to v5 (`input`/`output`)

---

## Phase 4: Build Sync Endpoint

### Overview
Create an API endpoint that replays tracked changes on the production WordPress instance.

### Changes Required

#### 1. Production Sync Service
**File**: `lib/sync/production-sync.ts` (NEW)

**Purpose**: Apply tracked changes to production

```typescript
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
```

#### 2. Sync Endpoint
**File**: `app/api/sync/apply/route.ts` (NEW)

**Purpose**: User-facing API to trigger production sync

```typescript
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
    const result = await productionSyncService.applyChanges(changes);

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
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit`
- [x] `POST /api/sync/apply` with no changes returns 0 applied
- [x] `POST /api/sync/apply` after creating a post syncs to production
- [x] Production WordPress receives the tool call
- [x] Tracked changes are cleared after successful sync

#### Manual Verification:
**SKIPPED** - Manual testing deferred in favor of automated E2E tests in Phase 5
- [ ] Create post in sandbox: `POST /api/agents/wordpress` with "Create a post titled 'Test Sync'"
- [ ] Verify sandbox has the post: Visit http://localhost:8000/wp-admin/edit.php
- [ ] Verify production does NOT have the post yet: Visit http://localhost:8001/wp-admin/edit.php
- [ ] Call sync: `POST /api/sync/apply`
- [ ] Response shows `appliedChanges: 1, success: true`
- [ ] Verify production NOW has the post: Visit http://localhost:8001/wp-admin/edit.php
- [ ] Post title matches "Test Sync"
- [ ] Second sync returns "No changes to sync"

---

## Phase 5: End-to-End Testing

### Overview
Verify the complete user flow works as expected.

### Changes Required

#### 1. E2E Test Script
**File**: `scripts/test/test-production-sync.ts` (NEW)

**Purpose**: Automated test of full sync flow

```typescript
#!/usr/bin/env tsx

import { executeWordPressAgent } from '../../lib/agents/wordpress-agent';
import { changeTracker } from '../../lib/sync/change-tracker';
import { productionSyncService } from '../../lib/sync/production-sync';
import { getSandboxMcpClient, getProductionMcpClient } from '../../lib/mcp/client-factory';

async function main() {
  console.log('=== Production Sync E2E Test ===\n');

  // Test 1: Verify both environments are reachable
  console.log('Test 1: Checking MCP connections...');
  try {
    const sandboxClient = await getSandboxMcpClient();
    const productionClient = await getProductionMcpClient();

    await sandboxClient.listTools();
    await productionClient.listTools();

    console.log('✓ Both sandbox and production are reachable\n');
  } catch (error) {
    console.error('✗ MCP connection failed:', error);
    process.exit(1);
  }

  // Test 2: Clear any existing tracked changes
  console.log('Test 2: Clearing tracked changes...');
  changeTracker.clearChanges();
  console.log('✓ Tracked changes cleared\n');

  // Test 3: Create a post in sandbox via AI
  console.log('Test 3: Creating post in sandbox via AI...');
  try {
    const result = await executeWordPressAgent(
      'Create a draft post titled "E2E Test Post" with content "This post was created by automated testing"'
    );
    console.log('✓ Agent response:', result.text);
    console.log(`✓ Tracked ${changeTracker.getChangeCount()} changes\n`);
  } catch (error) {
    console.error('✗ Failed to create post:', error);
    process.exit(1);
  }

  // Test 4: Verify changes were tracked
  console.log('Test 4: Verifying change tracking...');
  const changes = changeTracker.getChanges();

  if (changes.length === 0) {
    console.error('✗ No changes were tracked!');
    process.exit(1);
  }

  console.log(`✓ Tracked ${changes.length} change(s):`);
  changes.forEach((change, index) => {
    console.log(`  ${index + 1}. ${change.toolName} - ${JSON.stringify(change.args)}`);
  });
  console.log('');

  // Test 5: Apply changes to production
  console.log('Test 5: Syncing changes to production...');
  try {
    const syncResult = await productionSyncService.applyChanges(changes);

    if (!syncResult.success) {
      console.error('✗ Sync failed:', syncResult.errors);
      process.exit(1);
    }

    console.log(`✓ Successfully synced ${syncResult.appliedChanges} changes to production`);
    console.log('');
  } catch (error) {
    console.error('✗ Sync failed with exception:', error);
    process.exit(1);
  }

  // Test 6: Verify post exists in production
  console.log('Test 6: Verifying post exists in production...');
  try {
    const productionClient = await getProductionMcpClient();
    const result = await productionClient.callTool('wordpress-list-posts', { per_page: 10, page: 1 });

    // Parse the result
    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent?.text) {
      throw new Error('No text content in MCP response');
    }

    const parsedResult = JSON.parse(textContent.text) as { posts: Array<{ title: string; id: number }> };
    const testPost = parsedResult.posts.find((p) => p.title === 'E2E Test Post');

    if (!testPost) {
      console.error('✗ Test post not found in production!');
      process.exit(1);
    }

    console.log('✓ Post found in production:', testPost.title);
    console.log('');
  } catch (error) {
    console.error('✗ Failed to verify production post:', error);
    process.exit(1);
  }

  // Test 7: Clear tracked changes
  console.log('Test 7: Clearing tracked changes...');
  changeTracker.clearChanges();
  console.log('✓ Changes cleared\n');

  console.log('=== All Tests Passed ===');
  process.exit(0);
}

main();
```

**Make executable**: `chmod +x scripts/test/test-production-sync.ts`

#### 2. Package.json Script
**File**: `package.json`

**Changes**: Add test script

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:schemas": "tsx scripts/test/test-schemas.ts",
    "test:agent": "tsx scripts/test/test-wordpress-agent.ts",
    "test:sync": "tsx scripts/test/test-production-sync.ts",
    "test:all": "pnpm test:schemas && pnpm test:agent && pnpm test:sync"
  }
}
```

### Manual Test Scenarios

#### Scenario 1: Create Post
1. Call: `POST /api/agents/wordpress` with `{"prompt": "Create a draft post titled 'Hello Production' with content 'Testing sync'"}`
2. Verify: Response shows `trackedChanges.count: 1`
3. Verify: Sandbox has the post at http://localhost:8000/wp-admin
4. Verify: Production does NOT have the post at http://localhost:8001/wp-admin
5. Call: `POST /api/sync/apply`
6. Verify: Response shows `success: true, appliedChanges: 1`
7. Verify: Production now has the post at http://localhost:8001/wp-admin
8. Verify: Post title is "Hello Production"
9. Verify: Post content is "Testing sync"
10. Verify: Post status is "draft"

#### Scenario 2: Update Post
1. Create a post in sandbox: "Create a post titled 'Update Test'"
2. Sync to production
3. Update in sandbox: "Update the 'Update Test' post title to 'Updated Title'"
4. Verify: Tracked changes includes wordpress-update-post
5. Sync to production
6. Verify: Production post has new title "Updated Title"

#### Scenario 3: Delete Post
1. Create a post in sandbox: "Create a post titled 'Delete Test'"
2. Sync to production
3. Delete in sandbox: "Delete the 'Delete Test' post"
4. Verify: Tracked changes includes wordpress-delete-post
5. Sync to production
6. Verify: Production post is in trash

#### Scenario 4: Multiple Operations
1. Create 3 posts in sandbox with one prompt: "Create three posts titled 'Post 1', 'Post 2', and 'Post 3'"
2. Verify: Tracked changes shows 3 creates
3. Sync to production
4. Verify: All 3 posts appear in production

#### Scenario 5: No Changes
1. Clear tracked changes: `DELETE /api/sync/changes`
2. Call sync: `POST /api/sync/apply`
3. Verify: Response shows "No changes to sync"

#### Scenario 6: Error Handling
1. Create a post in sandbox
2. Stop production WordPress: `docker-compose stop wordpress_production`
3. Try to sync: `POST /api/sync/apply`
4. Verify: Response shows error about production connection
5. Verify: Tracked changes are NOT cleared (can retry)
6. Start production: `docker-compose start wordpress_production`
7. Retry sync: `POST /api/sync/apply`
8. Verify: Now succeeds

### Success Criteria

#### Automated Verification:
- [x] `pnpm test:sync` passes all tests
- [x] All 7 test steps pass
- [x] Post is created in sandbox
- [x] Post is synced to production
- [x] Post exists in production with correct content

#### Manual Verification:
- [ ] All 6 manual scenarios pass
- [ ] Posts created in sandbox appear in production after sync
- [ ] Updates in sandbox are reflected in production after sync
- [ ] Deletes in sandbox are reflected in production after sync
- [ ] Multiple operations in one session sync correctly
- [ ] Error handling works (retries after failure)

---

## Testing Strategy

### Unit Tests
Not implemented in MVP (would use Vitest):
- ChangeTracker class methods
- ProductionSyncService.applySingleChange()
- Tool name mapping logic

### Integration Tests
Implemented:
- E2E test script: `pnpm test:sync`
- Tests full flow from AI prompt to production sync

### Manual Testing Steps

**Initial Setup**:
```bash
# Start all containers
docker-compose up -d

# Wait for health checks
sleep 30

# Setup sandbox (already done)
./scripts/setup/install-mcp-adapter.sh

# Setup production (NEW)
./scripts/setup/install-production-wordpress.sh

# Start Next.js
pnpm dev
```

**Test Flow**:
```bash
# 1. Health check
curl http://localhost:3000/api/health | jq

# 2. Create post in sandbox
curl -X POST http://localhost:3000/api/agents/wordpress \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a draft post titled \"Manual Test\" with content \"Testing production sync\""}' | jq

# 3. View tracked changes
curl http://localhost:3000/api/sync/changes | jq

# 4. Preview sync
curl http://localhost:3000/api/sync/apply | jq

# 5. Apply sync
curl -X POST http://localhost:3000/api/sync/apply | jq

# 6. Verify in production
open http://localhost:8001/wp-admin/edit.php
```

---

## Performance Considerations

### MCP Connection Overhead
- **Sandbox client**: Cached, <1ms after first connection
- **Production client**: Cached, <1ms after first connection
- **First sync**: ~100ms to establish production connection
- **Subsequent syncs**: <1ms connection reuse

### Sync Performance
- **Single post create**: ~150ms (DB insert + fetch)
- **Single post update**: ~100ms (DB update)
- **10 operations**: ~1.5 seconds (sequential execution)

**Why Sequential**:
- Order matters: Must create before update
- Simpler error handling
- Acceptable for MVP (<10 operations typical)

### Memory Usage
- **Tracked changes**: ~1KB per change
- **100 changes**: ~100KB in memory
- **Acceptable for MVP**: Single-user, session-based

---

## Migration Notes

### From Current Setup to MVP

**Step 1: Backup**
```bash
# Backup sandbox database
docker-compose exec db mysqldump -u wordpress -pwordpress wordpress > sandbox_backup.sql

# Backup sandbox uploads
docker cp wp-ai-editor-v3-wordpress-1:/var/www/html/wp-content/uploads ./uploads_backup
```

**Step 2: Update Docker Compose**
```bash
# Pull new changes
git pull

# Start new containers
docker-compose up -d

# Wait for health checks
docker-compose ps
```

**Step 3: Setup Production**
```bash
# Run production setup script
./scripts/setup/install-production-wordpress.sh

# Verify production is accessible
curl http://localhost:8001
```

**Step 4: Update Next.js**
```bash
# Install dependencies (if new packages added)
pnpm install

# Rebuild TypeScript
pnpm build
```

**Step 5: Test**
```bash
# Start Next.js
pnpm dev

# Run E2E test
pnpm test:sync
```

### Rollback Plan

If sync implementation causes issues:

```bash
# 1. Stop all containers
docker-compose down

# 2. Remove new volumes (keeps existing data)
docker volume rm wp-ai-editor-v3_db_production_data
docker volume rm wp-ai-editor-v3_wp_production_data
docker volume rm wp-ai-editor-v3_wp_production_vendor

# 3. Checkout previous version
git checkout <previous-commit>

# 4. Restart sandbox only
docker-compose up -d db wordpress wpcli

# 5. Restart Next.js
pnpm dev
```

---

## References

- Original design document: `_backup/AI_Powered_WordPress_Editor_System_Design.md`
- Current technical design: `TECHNICAL_DESIGN.md`
- Current requirements: `REQUIREMENTS.md`
- Docker Compose docs: https://docs.docker.com/compose/
- Vercel AI SDK: https://sdk.vercel.ai/docs
- WordPress MCP Adapter: https://github.com/WordPress/mcp-adapter

---

## Open Questions (None for MVP)

All questions have been answered:
- ✅ Production target: Local Docker container (port 8001)
- ✅ Change tracking: From AI tool calls
- ✅ Entities: Posts only (current MCP support)
- ✅ Safety/rollback: Skipped for MVP
- ✅ Architecture: Single-tenant, local development

---

## Future Enhancements (Post-MVP)

### Phase 2: Enhanced Sync
- Granular entity sync using WP-CLI (wp post get/update)
- Conflict detection (check if production post was modified)
- Dry-run mode (preview changes without applying)
- Sync history (database log of all syncs)

### Phase 3: Multi-Entity Support
- Sync pages, custom post types
- Sync media/attachments
- Sync WordPress options/settings
- Sync taxonomies (categories, tags)

### Phase 4: Production Readiness
- Remote WordPress support (not Docker)
- WordPress Connector Plugin (for remote sites)
- HTTPS/SSL for production connections
- Backup before sync
- Rollback functionality

### Phase 5: UI/UX
- Visual diff of sandbox vs production
- Approval workflow UI
- Sync status dashboard
- Real-time sync progress

---

**Document Owner**: Development Team
**Created**: October 15, 2025
**Status**: Ready for Implementation
**Estimated Effort**: 8-12 hours
**Next Review**: After MVP completion
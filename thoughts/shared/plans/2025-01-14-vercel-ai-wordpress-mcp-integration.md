# Vercel AI + WordPress MCP Integration Implementation Plan

**Date:** 2025-01-14
**Status:** In Progress
**Based On:** `thoughts/shared/plans/2025-01-13-vercel-ai-mcp-dynamic-discovery.md`

## Overview

Build a Next.js application using Vercel AI SDK that defines WordPress tool schemas explicitly in TypeScript, then executes them via WordPress MCP HTTP transport. This approach provides full type safety and clear documentation while leveraging MCP for execution.

## Objectives

1. Create type-safe WordPress tool definitions in Next.js using Zod schemas
2. Execute tools via MCP HTTP transport to WordPress
3. Expose AI agent through REST API endpoints
4. Provide CLI testing utilities
5. Maintain synchronization with WordPress abilities manually (explicit schemas)

## Current State Analysis

### What Exists
- WordPress MCP adapter running at `http://localhost:8000/wp-json/wordpress-poc/mcp`
- 5 registered WordPress abilities in `wp-content/mu-plugins/register-wordpress-abilities.php:17`:
  - `wordpress-get-post` (line 14)
  - `wordpress-list-posts` (line 69)
  - `wordpress-create-post` (line 131)
  - `wordpress-update-post` (line 202)
  - `wordpress-delete-post` (line 289)
- Authentication via application password in `.mcp-credentials`: `admin:z8ytpl6IRw74spjWHXS18KWq`
- Docker-based WordPress environment with persistent volumes

### What's Missing
- Next.js application structure
- Package dependencies (Vercel AI SDK, MCP SDK, Zod)
- TypeScript tool schema definitions
- MCP HTTP transport client
- Agent API routes
- Testing utilities

### Key Constraints
- WordPress runs on `http://localhost:8000` (HTTP only, no HTTPS)
- Authentication uses basic auth with application password
- Tool schemas must match WordPress ability input/output schemas exactly
- Must handle WP_Error responses gracefully
- Single WordPress instance (no multi-tenant support needed)

## Desired End State

A working Next.js application where:

1. WordPress tools are explicitly defined in TypeScript with Zod schemas
2. Tool execution routes through MCP client to WordPress
3. API route at `/api/agents/wordpress` exposes a Vercel AI agent
4. Streaming endpoint at `/api/agents/wordpress/stream` for real-time responses
5. Health check at `/api/health` verifies MCP connection
6. CLI script `pnpm test:agent` validates end-to-end functionality
7. TypeScript catches mismatched tool arguments at compile time

### Verification Checklist
- [ ] `pnpm dev` starts Next.js on port 3000 without errors
- [ ] `pnpm test:agent` executes successfully
- [ ] `curl http://localhost:3000/api/health` returns connected status
- [ ] POST to `/api/agents/wordpress` with prompt executes WordPress tools
- [ ] TypeScript compilation catches invalid tool parameters
- [ ] Created WordPress posts appear in admin panel

## What We're NOT Doing

- Full dynamic discovery (schemas are explicit in Next.js, not auto-generated)
- OAuth2 authentication (using basic auth only)
- Multi-tenant credential storage (single WordPress instance)
- MCP resources/prompts (only tools for this milestone)
- Production deployment configuration
- React UI interface (API-only for now)
- Automatic tool sync when WordPress changes (manual schema updates required)
- Hot reload of tool definitions without restart

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User/Client                                                  │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP POST with prompt
             ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js API Routes (Port 3000)                              │
│  - /api/agents/wordpress (generate text)                    │
│  - /api/agents/wordpress/stream (streaming)                 │
│  - /api/health (connection check)                           │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Uses Vercel AI SDK
             ▼
┌─────────────────────────────────────────────────────────────┐
│ WordPress Agent (lib/agents/wordpress-agent.ts)             │
│  - generateText() / streamText()                            │
│  - OpenAI GPT-4 Turbo model                                 │
│  - System prompt for WordPress operations                   │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Invokes tools
             ▼
┌─────────────────────────────────────────────────────────────┐
│ WordPress Tools (lib/tools/wordpress-tools.ts)              │
│  - wordpress-get-post                                        │
│  - wordpress-list-posts                                      │
│  - wordpress-create-post                                     │
│  - wordpress-update-post                                     │
│  - wordpress-delete-post                                     │
│                                                              │
│ Each tool has:                                               │
│  - Description (for LLM)                                     │
│  - Zod schema (type-safe parameters)                         │
│  - Execute function (calls MCP)                              │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Calls via MCP client
             ▼
┌─────────────────────────────────────────────────────────────┐
│ MCP Client (lib/mcp/wordpress-client.ts)                    │
│  - SSEClientTransport with HTTP                             │
│  - Basic authentication header                              │
│  - callTool(name, args) method                              │
│  - Singleton pattern (cached connection)                    │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP POST with Basic Auth
             ▼
┌─────────────────────────────────────────────────────────────┐
│ WordPress MCP Adapter (Port 8000)                           │
│  Endpoint: /wp-json/wordpress-poc/mcp                       │
│                                                              │
│  - RestTransport (HTTP handler)                             │
│  - McpServer instance                                        │
│  - Routes to ability handlers                               │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Executes registered abilities
             ▼
┌─────────────────────────────────────────────────────────────┐
│ WordPress Abilities API                                     │
│  (wp-content/mu-plugins/register-wordpress-abilities.php)   │
│                                                              │
│  Each ability has:                                           │
│   - Name (e.g. wordpress/get-post)                          │
│   - input_schema (JSON Schema)                              │
│   - output_schema (JSON Schema)                             │
│   - execute_callback (PHP function)                         │
│   - permission_callback                                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Calls WordPress core
             ▼
┌─────────────────────────────────────────────────────────────┐
│ WordPress Core Functions                                    │
│  - get_post()                                                │
│  - get_posts()                                               │
│  - wp_insert_post()                                          │
│  - wp_update_post()                                          │
│  - wp_delete_post()                                          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Project Setup & Dependencies
**Goal:** Initialize Next.js with required dependencies

**Tasks:**
1. Create `package.json` manually
2. Install dependencies: `ai`, `@ai-sdk/openai`, `@modelcontextprotocol/sdk`, `zod`, `dotenv`
3. Install dev dependencies: `@types/node`, `tsx`, `vitest`, TypeScript, Next.js
4. Create `.env.local` with WordPress MCP credentials and OpenAI key
5. Create `tsconfig.json` with proper compiler options
6. Update `.gitignore` for Next.js artifacts

**Success Criteria:**
- `pnpm install` completes without errors
- TypeScript compiles: `pnpm tsc --noEmit`
- Environment variables are accessible

### Phase 2: MCP HTTP Transport Layer
**Goal:** Build authenticated MCP client for WordPress

**Files to Create:**
- `lib/mcp/types.ts` - Type definitions for MCP responses
- `lib/mcp/wordpress-client.ts` - MCP client with SSE transport
- `lib/mcp/client-factory.ts` - Singleton factory pattern

**Key Features:**
- Basic authentication header injection
- Connection lifecycle management (connect/close)
- `callTool(name, args)` method
- WP_Error handling
- Connection caching (singleton)

**Success Criteria:**
- Client can connect to WordPress MCP
- `listTools()` returns 5 WordPress abilities
- `callTool()` successfully executes WordPress functions
- Authentication errors are caught

### Phase 3: Explicit Tool Schema Definitions
**Goal:** Define type-safe WordPress tool schemas

**Files to Create:**
- `lib/tools/wordpress-schemas.ts` - Zod schemas matching WordPress abilities
- `lib/tools/wordpress-tools.ts` - Vercel AI tool definitions

**Schemas to Define:**
1. `getPostSchema` - `{ id: number }` (required)
2. `listPostsSchema` - `{ per_page?: number, page?: number }` (optional with defaults)
3. `createPostSchema` - `{ title: string, content: string, status?: enum }` (title & content required)
4. `updatePostSchema` - `{ id: number, title?: string, content?: string, status?: enum }` (id required)
5. `deletePostSchema` - `{ id: number, force?: boolean }` (id required)

**Tool Definitions:**
Each tool uses `tool()` from Vercel AI SDK with:
- `description` - Clear explanation for LLM
- `parameters` - Zod schema
- `execute` - Async function calling MCP client

**Success Criteria:**
- All schemas match WordPress input_schema definitions
- TypeScript types are correctly inferred from Zod
- Schema descriptions are helpful for the LLM
- Each tool successfully calls corresponding MCP ability

### Phase 4: Agent Integration & API Routes
**Goal:** Create AI agent and expose via API

**Files to Create:**
- `lib/agents/wordpress-agent.ts` - Agent factory functions
- `app/api/agents/wordpress/route.ts` - Non-streaming endpoint
- `app/api/agents/wordpress/stream/route.ts` - Streaming endpoint
- `app/api/health/route.ts` - Health check

**Agent Configuration:**
- Model: OpenAI GPT-4 Turbo
- Tools: All 5 WordPress tools
- Max steps: 5 (for multi-step operations)
- System prompt: WordPress content management instructions

**API Routes:**
1. `POST /api/agents/wordpress` - Execute with `generateText()`
2. `POST /api/agents/wordpress/stream` - Stream with `streamText()`
3. `GET /api/health` - Verify MCP connection and list tools

**Success Criteria:**
- Agent successfully uses WordPress tools
- API returns proper JSON responses
- Streaming works with data stream protocol
- Health check shows 5 tools available

### Phase 5: Testing, CLI Scripts & Documentation
**Goal:** Validate functionality and document usage

**Files to Create:**
- `scripts/test-wordpress-agent.ts` - End-to-end CLI test
- `scripts/test-schemas.ts` - Schema validation test
- `README.md` - Updated with full integration docs
- `.env.local.example` - Environment template

**Tests to Implement:**
1. Schema validation (valid/invalid inputs)
2. MCP connection test
3. Tool execution test (list posts)
4. Agent conversation test (create post)
5. Error handling test

**Documentation Updates:**
- Architecture diagram
- Quick start guide
- API endpoint documentation
- Adding new tools guide
- Troubleshooting section

**Success Criteria:**
- `pnpm test:all` passes
- All curl examples in README work
- CLI test creates a WordPress post
- Documentation is clear and complete

## File Structure

```
wp-ai-editor-v3/
├── app/
│   ├── api/
│   │   ├── agents/
│   │   │   └── wordpress/
│   │   │       ├── route.ts          # Non-streaming agent endpoint
│   │   │       └── stream/
│   │   │           └── route.ts      # Streaming agent endpoint
│   │   └── health/
│   │       └── route.ts              # Health check endpoint
│   ├── layout.tsx                    # Root layout (minimal)
│   └── page.tsx                      # Home page (minimal)
├── lib/
│   ├── agents/
│   │   └── wordpress-agent.ts        # Vercel AI agent factory
│   ├── mcp/
│   │   ├── types.ts                  # MCP type definitions
│   │   ├── wordpress-client.ts       # MCP HTTP client
│   │   └── client-factory.ts         # Singleton factory
│   └── tools/
│       ├── wordpress-schemas.ts      # Zod schemas for all tools
│       └── wordpress-tools.ts        # Vercel AI tool definitions
├── scripts/
│   ├── test-wordpress-agent.ts       # End-to-end CLI test
│   └── test-schemas.ts               # Schema validation test
├── wp-content/                       # WordPress files (existing)
├── .env.local                        # Environment variables (gitignored)
├── .env.local.example                # Environment template
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── next.config.js                    # Next.js configuration
└── README.md                         # Updated documentation
```

## Tool Schema Mapping

Each WordPress ability schema must be replicated in TypeScript/Zod:

### wordpress-get-post
**WordPress (PHP):** `register-wordpress-abilities.php:17`
```php
'input_schema' => [
    'type' => 'object',
    'properties' => [
        'id' => ['type' => 'integer', 'description' => 'The post ID'],
    ],
    'required' => ['id'],
]
```

**Next.js (TypeScript):**
```typescript
export const getPostSchema = z.object({
  id: z.number().int().describe('The post ID to retrieve')
});
```

### wordpress-list-posts
**WordPress (PHP):** `register-wordpress-abilities.php:69`
```php
'input_schema' => [
    'type' => 'object',
    'properties' => [
        'per_page' => ['type' => 'integer', 'default' => 10],
        'page' => ['type' => 'integer', 'default' => 1],
    ],
]
```

**Next.js (TypeScript):**
```typescript
export const listPostsSchema = z.object({
  per_page: z.number().int().optional().default(10).describe('Number of posts per page'),
  page: z.number().int().optional().default(1).describe('Page number for pagination')
});
```

### wordpress-create-post
**WordPress (PHP):** `register-wordpress-abilities.php:131`
```php
'input_schema' => [
    'type' => 'object',
    'properties' => [
        'title' => ['type' => 'string'],
        'content' => ['type' => 'string'],
        'status' => ['type' => 'string', 'enum' => ['publish', 'draft', 'pending', 'private'], 'default' => 'draft'],
    ],
    'required' => ['title', 'content'],
]
```

**Next.js (TypeScript):**
```typescript
export const createPostSchema = z.object({
  title: z.string().describe('The post title'),
  content: z.string().describe('The post content (HTML allowed)'),
  status: z.enum(['publish', 'draft', 'pending', 'private'])
    .optional()
    .default('draft')
    .describe('The post status')
});
```

### wordpress-update-post
**WordPress (PHP):** `register-wordpress-abilities.php:202`
```php
'input_schema' => [
    'type' => 'object',
    'properties' => [
        'id' => ['type' => 'integer'],
        'title' => ['type' => 'string'],
        'content' => ['type' => 'string'],
        'status' => ['type' => 'string', 'enum' => [...]],
    ],
    'required' => ['id'],
]
```

**Next.js (TypeScript):**
```typescript
export const updatePostSchema = z.object({
  id: z.number().int().describe('The post ID to update'),
  title: z.string().optional().describe('The new post title'),
  content: z.string().optional().describe('The new post content'),
  status: z.enum(['publish', 'draft', 'pending', 'private'])
    .optional()
    .describe('The new post status')
});
```

### wordpress-delete-post
**WordPress (PHP):** `register-wordpress-abilities.php:289`
```php
'input_schema' => [
    'type' => 'object',
    'properties' => [
        'id' => ['type' => 'integer'],
        'force' => ['type' => 'boolean', 'default' => false],
    ],
    'required' => ['id'],
]
```

**Next.js (TypeScript):**
```typescript
export const deletePostSchema = z.object({
  id: z.number().int().describe('The post ID to delete'),
  force: z.boolean()
    .optional()
    .default(false)
    .describe('Whether to bypass trash and force permanent deletion')
});
```

## Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `WORDPRESS_MCP_URL` | WordPress MCP endpoint | Fixed: `http://localhost:8000/wp-json/wordpress-poc/mcp` |
| `WORDPRESS_MCP_USERNAME` | WordPress admin username | `.mcp-credentials:12` |
| `WORDPRESS_MCP_PASSWORD` | Application password | `.mcp-credentials:13` |
| `OPENAI_API_KEY` | OpenAI API key | User provides |

## Testing Strategy

### Automated Tests
1. **Schema Validation** (`scripts/test-schemas.ts`)
   - Valid inputs are accepted
   - Invalid inputs are rejected
   - Defaults work correctly
   - Enum validation works

2. **MCP Connection** (in `test-wordpress-agent.ts`)
   - Client connects successfully
   - Tools are discovered (5 expected)
   - Authentication works

3. **Tool Execution** (in `test-wordpress-agent.ts`)
   - wordpress-list-posts returns data
   - wordpress-create-post creates a draft
   - Results are properly formatted

### Manual Tests
1. Health check: `curl http://localhost:3000/api/health`
2. List posts: `curl -X POST http://localhost:3000/api/agents/wordpress -d '{"prompt":"List posts"}'`
3. Create post: `curl -X POST http://localhost:3000/api/agents/wordpress -d '{"prompt":"Create a test post"}'`
4. Verify in WordPress admin: `http://localhost:8000/wp-admin`
5. Test streaming: Use streaming endpoint
6. Test error handling: Invalid credentials, stopped WordPress

### Performance Benchmarks
- MCP connection: < 200ms (first time)
- Cached connection: < 1ms
- Tool execution: 50-200ms per call
- Full agent response: 2-5s (LLM dependent)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema mismatch between WordPress and Next.js | Runtime errors | Manual verification, comprehensive testing |
| WordPress MCP changes without Next.js update | Tools break | Documentation of manual sync process |
| Authentication failure | No tool execution | Clear error messages, health check endpoint |
| MCP SDK version incompatibility | Connection fails | Pin versions, test before upgrading |
| OpenAI rate limits | Agent failures | Graceful error handling, retry logic |

## Success Criteria

### Phase Completion
- [ ] Phase 1: Dependencies installed, TypeScript compiles
- [ ] Phase 2: MCP client connects to WordPress
- [ ] Phase 3: All 5 tool schemas defined and tested
- [ ] Phase 4: Agent API routes working
- [ ] Phase 5: Tests pass, documentation complete

### End-to-End Validation
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm test:all` passes all tests
- [ ] Health check shows 5 connected tools
- [ ] Agent creates a WordPress post via API
- [ ] Created post visible in WordPress admin
- [ ] Streaming endpoint works
- [ ] Documentation examples all work

## Future Enhancements (Out of Scope)

- Auto-generate schemas from WordPress MCP discovery
- React UI for agent interaction
- Support for MCP resources and prompts
- Multi-tenant WordPress connections
- Production deployment guide
- Automated WordPress ability sync detection
- Support for custom post types
- Media/attachment handling
- User and taxonomy management tools

## References

- Original plan: `thoughts/shared/plans/2025-01-13-vercel-ai-mcp-dynamic-discovery.md`
- WordPress abilities: `wp-content/mu-plugins/register-wordpress-abilities.php`
- WordPress MCP setup: `MCP-SETUP.md`
- System design: `AI_Powered_WordPress_Editor_System_Design.md`
- Vercel AI SDK: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- MCP Specification: https://spec.modelcontextprotocol.io/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
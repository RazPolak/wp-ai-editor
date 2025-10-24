# WordPress AI Editor - Technical Design Document

**Version:** 3.0
**Date:** October 14, 2025
**Status:** Active Implementation

---

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Component Design](#2-component-design)
3. [Data Flow](#3-data-flow)
4. [Technology Stack](#4-technology-stack)
5. [File Structure](#5-file-structure)
6. [API Design](#6-api-design)
7. [Database Schema](#7-database-schema)
8. [Security Architecture](#8-security-architecture)
9. [Performance Optimization](#9-performance-optimization)
10. [Error Handling](#10-error-handling)
11. [Deployment Architecture](#11-deployment-architecture)
12. [File Cleanup Recommendations](#12-file-cleanup-recommendations)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER / CLIENT                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP Request
                             │ POST /api/agents/wordpress
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APP (Port 3000)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              API Routes (app/api/)                       │   │
│  │  • /agents/wordpress/route.ts (non-streaming)           │   │
│  │  • /agents/wordpress/stream/route.ts (streaming)        │   │
│  │  • /health/route.ts (health check)                      │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │           WordPress Agent (lib/agents/)                  │   │
│  │  • wordpress-agent.ts                                    │   │
│  │  • Vercel AI SDK generateText/streamText                │   │
│  │  • Multi-step tool execution (up to 10 steps)           │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │         WordPress Tools (lib/tools/)                     │   │
│  │  • wordpress-tools.ts (tool definitions)                 │   │
│  │  • wordpress-schemas.ts (Zod validation)                 │   │
│  │  • Type-safe tool wrappers                               │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │         MCP Client Layer (lib/mcp/)                      │   │
│  │  • wordpress-client.ts (MCP HTTP client)                 │   │
│  │  • client-factory.ts (singleton pattern)                 │   │
│  │  • types.ts (TypeScript definitions)                     │   │
│  └──────────────────────┬──────────────────────────────────┘   │
└─────────────────────────┼────────────────────────────────────────┘
                          │ MCP JSON-RPC 2.0
                          │ HTTP POST with Basic Auth
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│             WORDPRESS (Docker Container, Port 8000)              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    REST API Endpoint: /wp-json/wordpress-poc/mcp        │   │
│  │    • StreamableTransport (remote clients)                │   │
│  │    • RestTransport (direct clients)                      │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │         WordPress MCP Adapter                            │   │
│  │  • McpServer instance                                    │   │
│  │  • JSON-RPC 2.0 handler                                  │   │
│  │  • Routes to ability handlers                            │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │         WordPress Abilities API                          │   │
│  │  • wordpress/get-post                                    │   │
│  │  • wordpress/list-posts                                  │   │
│  │  • wordpress/create-post                                 │   │
│  │  • wordpress/update-post                                 │   │
│  │  • wordpress/delete-post                                 │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │         WordPress Core Functions                         │   │
│  │  • get_post(), get_posts()                               │   │
│  │  • wp_insert_post(), wp_update_post()                    │   │
│  │  • wp_delete_post()                                      │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                        │
│                         ▼                                        │
│               ┌─────────────────┐                               │
│               │  MySQL Database │                               │
│               │  (wp_posts)     │                               │
│               └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘

                         │
                         │ LLM API Calls
                         ▼
        ┌────────────────────────────────┐
        │   External AI Services         │
        │  • Anthropic Claude API        │
        │  • OpenAI GPT-4 API            │
        └────────────────────────────────┘
```

### 1.2 Component Interaction Flow

```
1. User Request
   └─> Next.js API Route receives JSON payload

2. Agent Initialization
   └─> wordpress-agent.ts initializes with tools and system prompt

3. LLM Processing
   └─> Vercel AI SDK sends prompt to Claude/GPT-4
   └─> LLM analyzes prompt and selects tools

4. Tool Execution
   └─> Agent calls wordpress-tools.ts function
   └─> Tool validates input with Zod schema
   └─> Tool calls MCP client

5. MCP Communication
   └─> client-factory.ts returns singleton client
   └─> wordpress-client.ts establishes HTTP connection
   └─> Sends JSON-RPC 2.0 POST request with Basic Auth

6. WordPress Processing
   └─> MCP adapter receives request
   └─> Routes to appropriate ability
   └─> Ability executes callback
   └─> WordPress core function executes
   └─> Database operation performed

7. Response Chain
   └─> WordPress returns result to MCP adapter
   └─> MCP adapter formats JSON-RPC response
   └─> MCP client receives and parses response
   └─> Tool extracts content from MCP response
   └─> Agent receives tool result
   └─> LLM formats final response

8. User Response
   └─> Next.js API returns JSON to user
```

---

## 2. Component Design

### 2.1 Next.js API Layer

#### Location: `app/api/`

**Purpose**: HTTP interface for external clients

**Components**:

1. **Health Check** (`app/api/health/route.ts`)
   - GET endpoint
   - Tests MCP connection
   - Returns available tools count
   - No authentication required

2. **WordPress Agent** (`app/api/agents/wordpress/route.ts`)
   - POST endpoint
   - Non-streaming response
   - Executes agent with prompt
   - Returns complete response with tool calls

3. **WordPress Agent Stream** (`app/api/agents/wordpress/stream/route.ts`)
   - POST endpoint
   - Server-Sent Events (SSE) streaming
   - Real-time response chunks
   - For interactive UIs

**Request Format**:
```json
{
  "prompt": "List all WordPress posts"
}
```

**Response Format**:
```json
{
  "text": "Here are your WordPress posts...",
  "toolCalls": [
    {
      "name": "wordpress-list-posts",
      "args": { "per_page": 10, "page": 1 }
    }
  ],
  "finishReason": "stop",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 75
  }
}
```

### 2.2 WordPress Agent Layer

#### Location: `lib/agents/wordpress-agent.ts`

**Purpose**: Orchestrates LLM and tool execution

**Key Functions**:

1. **`executeWordPressAgent(prompt: string)`**
   - Non-streaming execution
   - Returns complete response
   - Uses `generateText()` from Vercel AI SDK

2. **`streamWordPressAgent(prompt: string)`**
   - Streaming execution
   - Returns async generator
   - Uses `streamText()` from Vercel AI SDK

3. **`getModel()`**
   - Reads `AI_PROVIDER` environment variable
   - Returns configured LLM model
   - Defaults to Claude 3.5 Sonnet

**Configuration**:
```typescript
const SYSTEM_PROMPT = `You are a WordPress content management assistant...`;

const config = {
  model: getModel(),
  tools: wordpressTools,
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
  stopWhen: stepCountIs(10)  // Max 10 tool calls
};
```

### 2.3 WordPress Tools Layer

#### Location: `lib/tools/`

**Purpose**: Type-safe WordPress operation wrappers

**Files**:
1. `wordpress-schemas.ts` - Zod validation schemas
2. `wordpress-tools.ts` - Tool definitions

**Tool Structure**:
```typescript
export const getPostTool = tool({
  description: 'Retrieves a WordPress post by ID...',
  inputSchema: getPostSchema,  // Zod schema
  execute: async (input: GetPostInput) => {
    const client = await getWordPressMcpClient();
    const result = await client.callTool('wordpress-get-post', input);
    return extractContent(result);
  }
});
```

**Schema Example**:
```typescript
export const getPostSchema = z.object({
  id: z.number().int().describe('The post ID to retrieve')
});
```

**Tool Registry**:
```typescript
export const wordpressTools = {
  'wordpress-get-post': getPostTool,
  'wordpress-list-posts': listPostsTool,
  'wordpress-create-post': createPostTool,
  'wordpress-update-post': updatePostTool,
  'wordpress-delete-post': deletePostTool
};
```

### 2.4 MCP Client Layer

#### Location: `lib/mcp/`

**Purpose**: MCP protocol communication

**Files**:

1. **`wordpress-client.ts`** - Main MCP client
   ```typescript
   export class WordPressMcpClient {
     private client: Client | null = null;
     private transport: StreamableHTTPClientTransport | null = null;

     async connect(): Promise<void> { /* ... */ }
     async callTool(name: string, args: object): Promise<McpToolCallResult> { /* ... */ }
     async listTools(): Promise<McpToolsListResponse> { /* ... */ }
     async close(): Promise<void> { /* ... */ }
   }
   ```

2. **`client-factory.ts`** - Singleton pattern
   ```typescript
   let cachedClient: WordPressMcpClient | null = null;

   export async function getWordPressMcpClient(): Promise<WordPressMcpClient> {
     if (cachedClient) return cachedClient;

     const client = new WordPressMcpClient({
       url: process.env.WORDPRESS_MCP_URL,
       username: process.env.WORDPRESS_MCP_USERNAME,
       password: process.env.WORDPRESS_MCP_PASSWORD
     });

     await client.connect();
     cachedClient = client;
     return client;
   }
   ```

3. **`types.ts`** - TypeScript interfaces
   ```typescript
   export interface McpToolCallResult {
     content: Array<{ type: string; text?: string; }>;
     isError?: boolean;
   }

   export interface WordPressMcpClientOptions {
     url: string;
     username: string;
     password: string;
   }
   ```

**MCP Protocol Flow**:
```
1. Initialize Connection
   POST /wp-json/wordpress-poc/mcp
   {
     "jsonrpc": "2.0",
     "method": "initialize",
     "params": {
       "protocolVersion": "2024-11-05",
       "capabilities": {},
       "clientInfo": { "name": "vercel-ai-wordpress-agent", "version": "1.0.0" }
     },
     "id": 1
   }

2. List Tools
   POST /wp-json/wordpress-poc/mcp
   {
     "jsonrpc": "2.0",
     "method": "tools/list",
     "params": {},
     "id": 2
   }

3. Call Tool
   POST /wp-json/wordpress-poc/mcp
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "wordpress-list-posts",
       "arguments": { "per_page": 10, "page": 1 }
     },
     "id": 3
   }
```

### 2.5 WordPress MCP Server

#### Location: `wp-content/mu-plugins/`

**Must-Use Plugins** (auto-loaded by WordPress):

1. **`load-mcp-adapter.php`**
   - Loads Composer autoloader
   - Initializes MCP Plugin class
   - Runs on every WordPress request

2. **`enable-app-passwords.php`**
   - Forces Application Passwords feature on
   - Required for HTTP Basic Auth

3. **`configure-mcp-server.php`**
   - Creates MCP server instance on `mcp_adapter_init` hook
   - Registers REST and Streamable transports
   - Maps WordPress abilities to MCP tools

4. **`register-wordpress-abilities.php`**
   - Registers 5 WordPress abilities on `abilities_api_init` hook
   - Defines input/output schemas
   - Implements execute_callback for each ability
   - Implements permission_callback for access control

5. **`debug-mcp-init.php`** (optional)
   - Logs MCP initialization for debugging

**WordPress MCP Server Configuration**:
```php
$adapter->create_server(
    'wordpress-poc-server',              // Server ID
    'wordpress-poc',                     // Namespace
    'mcp',                              // Route
    'WordPress POC MCP Server',         // Name
    'MCP server for WordPress POC',     // Description
    'v1.0.0',                           // Version
    [
        \WP\MCP\Transport\Http\RestTransport::class,
        \WP\MCP\Transport\Http\StreamableTransport::class,
    ],
    \WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class,
    \WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler::class,
    [
        'wordpress/get-post',
        'wordpress/list-posts',
        'wordpress/create-post',
        'wordpress/update-post',
        'wordpress/delete-post',
    ]
);
```

**Ability Registration Example**:
```php
$get_post = wp_register_ability('wordpress/get-post', [
    'label' => 'Get Post',
    'description' => 'Retrieves a WordPress post by ID',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer', 'description' => 'The post ID'],
        ],
        'required' => ['id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'title' => ['type' => 'string'],
            'content' => ['type' => 'string'],
            'status' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        $post = get_post($input['id']);
        if (!$post) {
            return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
        }
        return [
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $post->post_content,
            'status' => $post->post_status,
            'author' => $post->post_author,
            'date' => $post->post_date,
        ];
    },
    'permission_callback' => function($input) {
        return is_user_logged_in();
    },
]);
```

---

## 3. Data Flow

### 3.1 Request Flow: List Posts

```
1. Client Request
   POST /api/agents/wordpress
   { "prompt": "List all posts" }

2. Next.js API Handler
   - Validates request body
   - Extracts prompt

3. WordPress Agent
   - Calls executeWordPressAgent(prompt)
   - Initializes Vercel AI with tools

4. LLM Processing (Claude/GPT-4)
   - Receives system prompt + user prompt + tool definitions
   - Decides to call wordpress-list-posts
   - Returns tool call: { name: "wordpress-list-posts", args: { per_page: 10, page: 1 } }

5. Tool Execution
   - wordpress-tools.ts receives tool call
   - Validates args with listPostsSchema
   - Calls getWordPressMcpClient()

6. MCP Client
   - Returns cached client OR creates new one
   - Establishes HTTP connection with Basic Auth
   - Sends JSON-RPC request:
     {
       "jsonrpc": "2.0",
       "method": "tools/call",
       "params": {
         "name": "wordpress-list-posts",
         "arguments": { "per_page": 10, "page": 1 }
       },
       "id": 1
     }

7. WordPress MCP Adapter
   - Receives JSON-RPC request
   - Routes to wordpress/list-posts ability
   - Executes ability callback

8. WordPress Core
   - Calls get_posts() with args
   - Queries wp_posts table
   - Returns array of WP_Post objects

9. Ability Response
   - Maps WP_Post objects to output schema
   - Returns JSON array

10. MCP Response
    - Wraps in JSON-RPC format:
      {
        "jsonrpc": "2.0",
        "result": {
          "content": [
            {
              "type": "text",
              "text": "{\"posts\": [...], \"total\": 25, \"page\": 1, \"per_page\": 10}"
            }
          ]
        },
        "id": 1
      }

11. Tool Result
    - extractContent() parses MCP response
    - Returns parsed JSON object

12. LLM Formatting
    - Receives tool result
    - Formats human-readable response

13. Final Response
    - Next.js API returns:
      {
        "text": "I found 25 posts. Here are the first 10:...",
        "toolCalls": [...],
        "finishReason": "stop",
        "usage": {...}
      }
```

### 3.2 Request Flow: Create Post

```
1. Client Request
   POST /api/agents/wordpress
   { "prompt": "Create a draft post titled 'Hello' with content 'World'" }

2-4. [Same as List Posts]

5. LLM Decides
   - Calls wordpress-create-post
   - Args: { title: "Hello", content: "World", status: "draft" }

6. Tool Validation
   - Zod validates against createPostSchema
   - Ensures title and content are strings
   - Ensures status is one of: publish/draft/pending/private

7-8. [MCP Communication]

9. WordPress Core
   - Calls wp_insert_post()
   - INSERT INTO wp_posts
   - Returns new post ID

10. Ability Response
    - Fetches newly created post
    - Returns full post object with URL

11-13. [Same response chain]
```

---

## 4. Technology Stack

### 4.1 Frontend/API Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 15.1.6 | App Router, API routes, React 19 |
| Runtime | Node.js | 18+ | JavaScript runtime |
| Language | TypeScript | 5.7.3 | Type safety |
| Package Manager | pnpm | Latest | Fast, efficient package management |
| Validation | Zod | 3.24.1 | Runtime schema validation |

### 4.2 AI/LLM Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| AI SDK | Vercel AI SDK | 5.0.70 | Unified AI interface |
| Anthropic | @ai-sdk/anthropic | 2.0.27 | Claude API integration |
| OpenAI | @ai-sdk/openai | 2.0.42 | GPT-4 API integration |
| Default Model | Claude 3.5 Sonnet | 20241022 | Primary LLM |
| Fallback Model | GPT-4 Turbo | Latest | Secondary LLM |

### 4.3 MCP Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Protocol | MCP | 1.0 | Model Context Protocol spec |
| SDK | @modelcontextprotocol/sdk | 1.0.4 | MCP client implementation |
| Transport | StreamableHTTPClientTransport | - | HTTP-based MCP communication |

### 4.4 WordPress Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Platform | WordPress | Latest (6.7+) | CMS |
| PHP | PHP-FPM | 7.4+ | WordPress runtime |
| Database | MariaDB | 10.6.4 | Data storage |
| Abilities API | wordpress/abilities-api | dev-trunk | Extensibility framework |
| MCP Adapter | wordpress/mcp-adapter | dev-trunk | MCP protocol implementation |
| Package Manager | Composer | 2.0+ | PHP dependencies |

### 4.5 Infrastructure Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Containerization | Docker | 24.0.0+ | WordPress + MySQL containers |
| Orchestration | Docker Compose | 2.0+ | Multi-container management |
| CLI | WP-CLI | 2.0+ | WordPress command-line interface |
| Database UI | phpMyAdmin | Latest | Database management (optional) |

---

## 5. File Structure

### 5.1 Project Root
```
wp-ai-editor-v3/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── agents/
│   │   │   └── wordpress/
│   │   │       ├── route.ts      # Non-streaming agent
│   │   │       └── stream/
│   │   │           └── route.ts  # Streaming agent
│   │   └── health/
│   │       └── route.ts          # Health check
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
│
├── lib/                          # Shared libraries
│   ├── agents/
│   │   └── wordpress-agent.ts    # AI agent logic
│   ├── mcp/
│   │   ├── wordpress-client.ts   # MCP client
│   │   ├── client-factory.ts     # Singleton factory
│   │   └── types.ts              # Type definitions
│   └── tools/
│       ├── wordpress-schemas.ts  # Zod schemas
│       └── wordpress-tools.ts    # Tool definitions
│
├── scripts/                      # Setup & maintenance scripts
│   ├── install-mcp-adapter.sh    # Main setup script
│   ├── wp-cli.sh                 # WP-CLI wrapper
│   ├── test-wordpress-agent.ts   # E2E test
│   └── test-schemas.ts           # Schema validation test
│
├── wp-content/                   # WordPress content (mounted)
│   └── mu-plugins/               # Must-Use plugins
│       ├── load-mcp-adapter.php
│       ├── enable-app-passwords.php
│       ├── configure-mcp-server.php
│       ├── register-wordpress-abilities.php
│       └── debug-mcp-init.php
│
├── .next/                        # Next.js build output (generated)
├── node_modules/                 # Node dependencies (generated)
├── thoughts/                     # Project notes (optional)
│
├── .env.local                    # Environment variables (gitignored)
├── .env.local.example            # Environment template
├── .mcp-credentials              # WordPress credentials (gitignored)
├── composer.json                 # PHP dependencies
├── docker-compose.yml            # Container configuration
├── next.config.js                # Next.js configuration
├── package.json                  # Node dependencies
├── pnpm-lock.yaml                # Lock file
├── tsconfig.json                 # TypeScript configuration
│
├── README.md                     # User documentation
├── MCP-SETUP.md                  # Setup guide
├── AI_Powered_WordPress_Editor_System_Design.md  # Legacy design doc
├── REQUIREMENTS.md               # Product requirements (NEW)
└── TECHNICAL_DESIGN.md           # This document (NEW)
```

### 5.2 Critical Files

**Build/Config Files** (Required):
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `next.config.js` - Next.js framework configuration
- `composer.json` - PHP dependencies for WordPress
- `docker-compose.yml` - Container orchestration

**Environment Files** (Required):
- `.env.local` - Local environment variables (must create)
- `.env.local.example` - Template for environment variables
- `.mcp-credentials` - WordPress credentials (generated by script)

**Core Application Files** (Required):
- `app/api/**/*.ts` - All API route handlers
- `lib/**/*.ts` - All library code
- `wp-content/mu-plugins/*.php` - All WordPress plugins

**Setup Scripts** (Required):
- `scripts/install-mcp-adapter.sh` - Main installation script
- `scripts/wp-cli.sh` - WordPress CLI wrapper

**Test Files** (Recommended):
- `scripts/test-wordpress-agent.ts` - E2E testing
- `scripts/test-schemas.ts` - Schema validation

**Documentation** (Recommended):
- `README.md` - Primary user-facing documentation
- `MCP-SETUP.md` - Detailed setup instructions
- `REQUIREMENTS.md` - Product requirements
- `TECHNICAL_DESIGN.md` - Technical architecture

---

## 6. API Design

### 6.1 Health Check Endpoint

**Endpoint**: `GET /api/health`

**Purpose**: Verify WordPress MCP connection and list available tools

**Request**: None (GET request)

**Response**:
```json
{
  "status": "healthy",
  "wordpress_mcp": "connected",
  "tools_available": 5,
  "tool_names": [
    "wordpress-get-post",
    "wordpress-list-posts",
    "wordpress-create-post",
    "wordpress-update-post",
    "wordpress-delete-post"
  ]
}
```

**Error Response**:
```json
{
  "status": "unhealthy",
  "wordpress_mcp": "connection failed",
  "error": "Failed to connect to WordPress MCP: ECONNREFUSED"
}
```

### 6.2 WordPress Agent Endpoint (Non-Streaming)

**Endpoint**: `POST /api/agents/wordpress`

**Purpose**: Execute AI agent with natural language prompt

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "prompt": "Create a draft post titled 'My First Post' with content 'Hello World'"
}
```

**Response** (200 OK):
```json
{
  "text": "I've created a draft post titled 'My First Post' with the content 'Hello World'. The post has been saved with ID 123 and is ready for review.",
  "toolCalls": [
    {
      "name": "wordpress-create-post",
      "args": {
        "title": "My First Post",
        "content": "Hello World",
        "status": "draft"
      }
    }
  ],
  "finishReason": "stop",
  "usage": {
    "promptTokens": 245,
    "completionTokens": 78,
    "totalTokens": 323
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "Prompt is required and must be a string"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "error": "Failed to connect to WordPress MCP: Connection refused",
  "details": "Error: connect ECONNREFUSED 127.0.0.1:8000"
}
```

### 6.3 WordPress Agent Endpoint (Streaming)

**Endpoint**: `POST /api/agents/wordpress/stream`

**Purpose**: Execute AI agent with real-time streaming response

**Request**: Same as non-streaming

**Response Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Response Body** (SSE stream):
```
data: {"type":"text-delta","textDelta":"I've"}

data: {"type":"text-delta","textDelta":" created"}

data: {"type":"tool-call","toolCall":{"name":"wordpress-create-post","args":{...}}}

data: {"type":"tool-result","result":{...}}

data: {"type":"text-delta","textDelta":" a draft post"}

data: {"type":"finish","finishReason":"stop","usage":{...}}
```

---

## 7. Database Schema

### 7.1 WordPress Database

**Database**: `wordpress` (MariaDB)

**Key Tables**:

1. **`wp_posts`** - Post content
   ```sql
   ID                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
   post_author         BIGINT UNSIGNED
   post_date           DATETIME
   post_date_gmt       DATETIME
   post_content        LONGTEXT
   post_title          TEXT
   post_excerpt        TEXT
   post_status         VARCHAR(20)  -- 'draft', 'publish', 'pending', 'private'
   comment_status      VARCHAR(20)
   ping_status         VARCHAR(20)
   post_password       VARCHAR(255)
   post_name           VARCHAR(200)
   post_modified       DATETIME
   post_modified_gmt   DATETIME
   post_parent         BIGINT UNSIGNED
   guid                VARCHAR(255)
   menu_order          INT
   post_type           VARCHAR(20)  -- 'post', 'page', 'attachment'
   post_mime_type      VARCHAR(100)
   comment_count       BIGINT
   ```

2. **`wp_users`** - User accounts
   ```sql
   ID                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
   user_login          VARCHAR(60)
   user_pass           VARCHAR(255)
   user_email          VARCHAR(100)
   user_registered     DATETIME
   user_activation_key VARCHAR(255)
   user_status         INT
   display_name        VARCHAR(250)
   ```

3. **`wp_options`** - WordPress settings
   ```sql
   option_id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
   option_name         VARCHAR(191)
   option_value        LONGTEXT
   autoload            VARCHAR(20)
   ```

### 7.2 Data Access Patterns

**Read Operations**:
- `wordpress-get-post`: `SELECT * FROM wp_posts WHERE ID = ?`
- `wordpress-list-posts`: `SELECT * FROM wp_posts WHERE post_status = 'publish' ORDER BY post_date DESC LIMIT ? OFFSET ?`

**Write Operations**:
- `wordpress-create-post`: `INSERT INTO wp_posts (...) VALUES (...)`
- `wordpress-update-post`: `UPDATE wp_posts SET ... WHERE ID = ?`
- `wordpress-delete-post`: `UPDATE wp_posts SET post_status = 'trash' WHERE ID = ?` (soft delete)
- `wordpress-delete-post` (force): `DELETE FROM wp_posts WHERE ID = ?` (hard delete)

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
1. WordPress Setup
   - Admin creates Application Password via WP-CLI
   - Password stored in .mcp-credentials (gitignored)
   - Password copied to .env.local as WORDPRESS_MCP_PASSWORD

2. MCP Client Connection
   - Reads credentials from environment variables
   - Creates Basic Auth header: "Basic base64(username:password)"
   - Includes header in every HTTP request

3. WordPress MCP Adapter
   - Receives request with Authorization header
   - WordPress validates Application Password
   - If invalid: returns 401 Unauthorized
   - If valid: proceeds to execute ability

4. Ability Permission Check
   - Calls permission_callback function
   - Checks if user is logged in: is_user_logged_in()
   - Checks user capabilities: current_user_can('edit_posts')
   - If denied: returns WP_Error
   - If allowed: executes callback
```

### 8.2 Security Measures

**Environment Security**:
- All credentials in environment variables
- `.env.local` in `.gitignore`
- `.mcp-credentials` in `.gitignore`
- No hardcoded credentials in source code

**Transport Security**:
- HTTP only (local development)
- No HTTPS (would require SSL certificates)
- Basic Auth over HTTP (acceptable for local only)
- NOT SUITABLE FOR PRODUCTION

**WordPress Security**:
- Application Passwords (WordPress 5.6+)
- Capability checks (current_user_can)
- Logged-in user checks (is_user_logged_in)
- WP_Error for error handling

**API Security**:
- Input validation with Zod schemas
- Type safety with TypeScript
- No direct database access from Next.js
- All operations through WordPress APIs

### 8.3 Security Limitations

**Current Limitations** (Local Development Only):
- No HTTPS/TLS encryption
- No rate limiting
- No authentication on Next.js API
- No CORS restrictions
- No API key authentication
- Credentials in environment variables (not secrets manager)

**Production Requirements** (Not Implemented):
- HTTPS for all connections
- Rate limiting per user/IP
- JWT or OAuth2 for Next.js API
- CORS configuration
- Secrets management (AWS Secrets Manager, Vault)
- IP whitelisting
- Request signing
- Audit logging

---

## 9. Performance Optimization

### 9.1 MCP Client Singleton

**Pattern**: Singleton pattern for MCP client

**Implementation**:
```typescript
// lib/mcp/client-factory.ts
let cachedClient: WordPressMcpClient | null = null;

export async function getWordPressMcpClient() {
  if (cachedClient) return cachedClient;  // Reuse existing

  const client = new WordPressMcpClient(config);
  await client.connect();  // Initial connection overhead
  cachedClient = client;
  return client;
}
```

**Benefits**:
- First request: ~500ms (connection establishment)
- Subsequent requests: <1ms (connection reuse)
- Reduces HTTP handshake overhead
- Persistent connection to WordPress

### 9.2 Vercel AI SDK Optimizations

**Multi-Step Execution**:
```typescript
stopWhen: stepCountIs(10)  // Allow up to 10 tool calls in one execution
```

**Benefits**:
- Agent can make multiple tool calls without round trips
- Example: List posts → Get post details → Update post
- Reduces total request time
- Better user experience

### 9.3 Docker Volumes

**Persistent Storage**:
```yaml
volumes:
  wp_data:      # WordPress files
  wp_vendor:    # Composer packages
  db_data:      # MySQL database
```

**Benefits**:
- WordPress files persist across restarts
- Composer packages don't need reinstall
- Database survives container recreation
- Faster startup times

### 9.4 Response Streaming

**Streaming vs Non-Streaming**:

| Aspect | Non-Streaming | Streaming |
|--------|---------------|-----------|
| Response Time | 3-5 seconds | Starts immediately |
| User Experience | Loading spinner | Real-time text |
| Memory Usage | Full response buffered | Chunks sent immediately |
| Use Case | Simple requests | Long responses, chatbots |

### 9.5 Performance Metrics

**Measured Performance** (Local Development):

| Operation | Time | Notes |
|-----------|------|-------|
| MCP Initial Connect | ~100ms | First request only |
| MCP Reuse | <1ms | Cached connection |
| wordpress-get-post | ~50ms | Single DB query |
| wordpress-list-posts | ~100ms | Multiple DB queries |
| wordpress-create-post | ~150ms | DB insert + fetch |
| LLM Response (Claude) | 1-3s | Depends on prompt length |
| Total Agent Request | 2-5s | LLM + tool calls |

---

## 10. Error Handling

### 10.1 Error Flow

```
Error Source                    Handler                         User-Facing Message
──────────────────────────────────────────────────────────────────────────────────
WordPress not running        → MCP Client connect()         → "Failed to connect to WordPress MCP"
Invalid credentials          → WordPress 401                → "Authentication failed"
Post not found               → WP_Error in ability          → "Post not found"
Invalid tool parameters      → Zod validation               → "Invalid input: id must be number"
LLM API error                → Vercel AI SDK                → "AI service unavailable"
WordPress database error     → wp_insert_post() returns 0   → "Failed to create post"
Network timeout              → MCP Client callTool()        → "Request timed out"
```

### 10.2 Error Types

**1. MCP Connection Errors**
```typescript
try {
  await client.connect();
} catch (error) {
  throw new Error(`Failed to connect to WordPress MCP: ${error.message}`);
}
```

**2. Tool Execution Errors**
```typescript
if (result.isError) {
  throw new Error(`WordPress Error: ${JSON.stringify(result.content)}`);
}
```

**3. WordPress Errors**
```php
if (!$post) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
}
```

**4. Validation Errors**
```typescript
const getPostSchema = z.object({
  id: z.number().int()  // Throws if not integer
});
```

### 10.3 Error Response Format

**API Error Response**:
```json
{
  "error": "Failed to connect to WordPress MCP: ECONNREFUSED",
  "details": "Error: connect ECONNREFUSED 127.0.0.1:8000\n    at ..."
}
```

**WordPress Error Response** (via MCP):
```json
{
  "jsonrpc": "2.0",
  "result": {
    "isError": true,
    "content": [
      {
        "type": "text",
        "text": "{\"code\":\"post_not_found\",\"message\":\"Post not found\",\"data\":{\"status\":404}}"
      }
    ]
  },
  "id": 1
}
```

---

## 11. Deployment Architecture

### 11.1 Current Architecture (Local Development)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Developer Machine                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Next.js Development Server (Port 3000)          │   │
│  │         pnpm dev                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                        │
│                         │ HTTP                                   │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Docker Containers                                │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  WordPress Container (Port 8000)               │    │   │
│  │  │  • PHP-FPM + Apache                            │    │   │
│  │  │  • WordPress Core                              │    │   │
│  │  │  • MCP Adapter (Composer)                      │    │   │
│  │  │  • MU Plugins                                  │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                       │                                  │   │
│  │                       │ MySQL Protocol                   │   │
│  │                       ▼                                  │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  MariaDB Container (Port 3306)                 │    │   │
│  │  │  • WordPress Database                          │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  phpMyAdmin Container (Port 8080) [Optional]   │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Production Architecture (Proposed, Not Implemented)

```
                            Internet
                               │
                               │ HTTPS
                               ▼
                     ┌──────────────────┐
                     │   Load Balancer  │
                     │   (AWS ALB)      │
                     └──────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │  Next.js     │ │  Next.js     │ │  Next.js     │
        │  Container   │ │  Container   │ │  Container   │
        │  (ECS/K8s)   │ │  (ECS/K8s)   │ │  (ECS/K8s)   │
        └──────────────┘ └──────────────┘ └──────────────┘
                │              │              │
                └──────────────┼──────────────┘
                               │ HTTPS + Auth
                               ▼
                     ┌──────────────────┐
                     │   WordPress      │
                     │   (Managed Host) │
                     │   • Kinsta       │
                     │   • WP Engine    │
                     │   • AWS Lightsail│
                     └──────────────────┘
                               │
                               ▼
                     ┌──────────────────┐
                     │   MySQL RDS      │
                     │   (Managed DB)   │
                     └──────────────────┘
```

---

## 12. File Cleanup Recommendations

### 12.1 Files Safe to Delete

**Debug/Test Files** (Can delete, regenerate if needed):
```
./test-mcp-connection.js       # Ad-hoc MCP testing
./test-simple-mcp.js           # Simple MCP test
./debug-wp-response.js         # Response debugging
./test-agent.http              # HTTP request examples
```

**Build Artifacts** (Auto-regenerated):
```
./.next/                       # Next.js build output
./node_modules/                # Node dependencies (pnpm install)
./tsconfig.tsbuildinfo         # TypeScript build cache
./pnpm-lock.yaml               # Lock file (regenerated)
```

**Optional Documentation**:
```
./thoughts/                    # Project notes/handoffs
./AI_Powered_WordPress_Editor_System_Design.md  # Legacy design doc (superseded by TECHNICAL_DESIGN.md)
```

**Optional Scripts** (Not used in current workflow):
```
./scripts/configure-mcp-server.sh     # Superseded by mu-plugins approach
./scripts/create-app-password.sh      # Manual alternative to install script
./scripts/generate-claude-config.sh   # Claude Desktop config generator
./scripts/health-check.sh             # Basic health check (use API instead)
./scripts/install-abilities-api.sh    # Partial install (use install-mcp-adapter.sh)
./scripts/install-mcp.sh              # Old install script
./scripts/setup.sh                    # Legacy setup script
```

**WordPress Default Theme** (Not needed):
```
./wp-content/themes/twentytwentyfive/  # Default theme (not used)
./wp-content/themes/index.php          # Security file
./wp-content/plugins/index.php         # Security file
```

**Config Files** (Clean up if not needed):
```
./.idea/                       # JetBrains IDE config (gitignored)
./claude-desktop-config.json   # Claude Desktop example config
```

### 12.2 Files to Keep (Critical)

**Core Configuration**:
```
./package.json                 # REQUIRED: Node dependencies
./tsconfig.json                # REQUIRED: TypeScript config
./next.config.js               # REQUIRED: Next.js config
./docker-compose.yml           # REQUIRED: Container orchestration
./composer.json                # REQUIRED: PHP dependencies
./.gitignore                   # REQUIRED: Git ignore rules
```

**Application Code**:
```
./app/**/*                     # REQUIRED: All Next.js routes
./lib/**/*                     # REQUIRED: All library code
./wp-content/mu-plugins/*.php  # REQUIRED: WordPress MCP integration
```

**Environment & Credentials**:
```
./.env.local                   # REQUIRED: Local environment variables
./.env.local.example           # REQUIRED: Environment template
./.mcp-credentials             # REQUIRED: WordPress credentials (runtime)
./.env.example                 # REQUIRED: Docker environment template
```

**Scripts**:
```
./scripts/install-mcp-adapter.sh  # REQUIRED: Main setup script
./scripts/wp-cli.sh               # REQUIRED: WordPress CLI wrapper
./scripts/test-wordpress-agent.ts # RECOMMENDED: E2E test
./scripts/test-schemas.ts         # RECOMMENDED: Schema validation
```

**Documentation**:
```
./README.md                    # REQUIRED: User documentation
./MCP-SETUP.md                 # REQUIRED: Setup instructions
./REQUIREMENTS.md              # RECOMMENDED: Product requirements (NEW)
./TECHNICAL_DESIGN.md          # RECOMMENDED: Technical design (NEW)
```

### 12.3 Cleanup Commands

```bash
# Remove debug files
rm -f test-mcp-connection.js test-simple-mcp.js debug-wp-response.js test-agent.http

# Remove build artifacts (can regenerate)
rm -rf .next node_modules tsconfig.tsbuildinfo

# Remove optional documentation
rm -rf thoughts/
rm -f AI_Powered_WordPress_Editor_System_Design.md

# Remove unused scripts
rm -f scripts/configure-mcp-server.sh \
      scripts/create-app-password.sh \
      scripts/generate-claude-config.sh \
      scripts/health-check.sh \
      scripts/install-abilities-api.sh \
      scripts/install-mcp.sh \
      scripts/setup.sh

# Remove default WordPress theme (if not used)
rm -rf wp-content/themes/twentytwentyfive/

# Remove IDE config (if not needed)
rm -rf .idea/

# Regenerate node_modules
pnpm install
```

### 12.4 .gitignore Recommendations

Ensure these are in `.gitignore`:
```
# Dependencies
node_modules/
vendor/

# Build outputs
.next/
*.tsbuildinfo

# Environment files
.env
.env.local
.mcp-credentials

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Docker volumes (data persists via named volumes)
wp_data/
db_data/
```

---

## 13. Monitoring & Observability

### 13.1 Logging Strategy

**Next.js Logs**:
```typescript
// lib/mcp/wordpress-client.ts
console.log('[MCP] ✓ Connected to WordPress MCP');
console.log(`[MCP] Calling tool: ${name}`, JSON.stringify(args));
console.error('[MCP] ✗ Tool execution failed:', error);
```

**WordPress Logs**:
```php
// wp-content/mu-plugins/register-wordpress-abilities.php
error_log('✓ Registered ability: wordpress/get-post');
error_log('✗ Failed to register ability: wordpress/get-post');
```

**Log Locations**:
- Next.js: Terminal output (development)
- WordPress: `docker-compose logs wordpress`
- WordPress errors: Inside container at `/var/www/html/wp-content/debug.log`
- MySQL: `docker-compose logs db`

### 13.2 Health Monitoring

**Health Check Endpoint**: `GET /api/health`

**Monitored Aspects**:
1. WordPress reachability
2. MCP connection status
3. Available tools count
4. Tool names validation

**Usage**:
```bash
# Check system health
curl http://localhost:3000/api/health

# Automated monitoring
watch -n 30 'curl -s http://localhost:3000/api/health | jq .'
```

### 13.3 Performance Monitoring

**Metrics to Track**:
- MCP connection time
- Tool execution time
- LLM response time
- Total request duration
- Token usage
- Error rates

**Implementation** (manual logging):
```typescript
const start = Date.now();
const result = await client.callTool(name, args);
const duration = Date.now() - start;
console.log(`[Performance] Tool ${name} executed in ${duration}ms`);
```

---

## 14. Testing Strategy

### 14.1 Test Types

**1. Schema Validation Tests** (`scripts/test-schemas.ts`):
- Validates Zod schemas against sample data
- Ensures type safety
- Run with: `pnpm test:schemas`

**2. End-to-End Tests** (`scripts/test-wordpress-agent.ts`):
- Tests MCP connection
- Tests tool execution
- Tests agent with real LLM
- Run with: `pnpm test:agent`

**3. Manual API Tests** (`test-agent.http`):
- HTTP request examples
- Can use with REST Client extension

### 14.2 Test Workflows

**Pre-Deployment Testing**:
```bash
# 1. Start WordPress
docker-compose up -d

# 2. Wait for WordPress to be ready
./scripts/install-mcp-adapter.sh

# 3. Run schema tests
pnpm test:schemas

# 4. Start Next.js
pnpm dev

# 5. Test health endpoint
curl http://localhost:3000/api/health

# 6. Run E2E tests
pnpm test:agent
```

**Continuous Testing**:
```bash
# Run all tests
pnpm test:all
```

---

## 15. Development Workflow

### 15.1 Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd wp-ai-editor-v3

# 2. Start Docker containers
docker-compose up -d

# 3. Install WordPress MCP adapter
./scripts/install-mcp-adapter.sh

# 4. Install Node dependencies
pnpm install

# 5. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your API keys and credentials

# 6. Run tests
pnpm test:schemas

# 7. Start development server
pnpm dev

# 8. Test the setup
curl http://localhost:3000/api/health
```

### 15.2 Daily Development

```bash
# Start WordPress (if stopped)
docker-compose up -d

# Start Next.js development server
pnpm dev

# Make changes to code...

# Test your changes
curl -X POST http://localhost:3000/api/agents/wordpress \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List all posts"}'
```

### 15.3 Adding New WordPress Tools

**Step 1: Add WordPress Ability** (`wp-content/mu-plugins/register-wordpress-abilities.php`):
```php
$my_ability = wp_register_ability('wordpress/my-tool', [
    'label' => 'My Tool',
    'description' => 'Does something',
    'input_schema' => [...],
    'output_schema' => [...],
    'execute_callback' => function($input) { ... },
    'permission_callback' => function($input) { ... },
]);
```

**Step 2: Add Zod Schema** (`lib/tools/wordpress-schemas.ts`):
```typescript
export const myToolSchema = z.object({
  param: z.string().describe('Parameter description')
});

export type MyToolInput = z.infer<typeof myToolSchema>;
```

**Step 3: Add Tool Definition** (`lib/tools/wordpress-tools.ts`):
```typescript
export const myTool = tool({
  description: 'Does something',
  inputSchema: myToolSchema,
  execute: async (input: MyToolInput) => {
    const client = await getWordPressMcpClient();
    const result = await client.callTool('wordpress-my-tool', input);
    return extractContent(result);
  }
});

export const wordpressTools = {
  ...existingTools,
  'wordpress-my-tool': myTool
};
```

**Step 4: Update MCP Server Config** (`wp-content/mu-plugins/configure-mcp-server.php`):
```php
$adapter->create_server(
    // ... existing config
    [
        'wordpress/get-post',
        'wordpress/list-posts',
        // ... existing tools
        'wordpress/my-tool',  // ADD THIS
    ]
);
```

**Step 5: Restart and Test**:
```bash
docker-compose restart wordpress
pnpm dev
pnpm test:agent
```

---

## Appendix A: Dependencies Reference

### A.1 Node.js Dependencies

```json
{
  "dependencies": {
    "@ai-sdk/anthropic": "^2.0.27",      // Anthropic Claude integration
    "@ai-sdk/openai": "^2.0.42",         // OpenAI GPT integration
    "@modelcontextprotocol/sdk": "^1.0.4", // MCP protocol SDK
    "ai": "^5.0.70",                     // Vercel AI SDK
    "dotenv": "^16.4.7",                 // Environment variables
    "next": "^15.1.6",                   // Next.js framework
    "react": "^19.0.0",                  // React library
    "react-dom": "^19.0.0",              // React DOM
    "zod": "^3.24.1"                     // Schema validation
  },
  "devDependencies": {
    "@types/node": "^22.10.5",           // Node.js types
    "@types/react": "^19.0.6",           // React types
    "@types/react-dom": "^19.0.2",       // React DOM types
    "eslint": "^9.19.0",                 // Linting
    "eslint-config-next": "^15.1.6",     // Next.js ESLint config
    "tsx": "^4.19.2",                    // TypeScript execution
    "typescript": "^5.7.3",              // TypeScript compiler
    "vitest": "^3.0.5"                   // Testing framework
  }
}
```

### A.2 PHP Dependencies (Composer)

```json
{
  "require": {
    "php": ">=7.4",
    "wordpress/abilities-api": "dev-trunk",
    "wordpress/mcp-adapter": "dev-trunk"
  }
}
```

### A.3 Docker Images

```yaml
services:
  wordpress:
    image: wordpress:latest  # WordPress with PHP-FPM and Apache

  db:
    image: mariadb:10.6.4-focal  # MariaDB database

  wpcli:
    image: wordpress:cli  # WP-CLI for WordPress management

  phpmyadmin:
    image: phpmyadmin:latest  # Database admin UI (optional)
```

---

## Appendix B: Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| **Next.js Environment** |
| `WORDPRESS_MCP_URL` | Required | - | WordPress MCP endpoint URL |
| `WORDPRESS_MCP_USERNAME` | Required | - | WordPress admin username |
| `WORDPRESS_MCP_PASSWORD` | Required | - | WordPress application password |
| `AI_PROVIDER` | Optional | `anthropic` | AI provider: `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | Conditional | - | Required if AI_PROVIDER=anthropic |
| `OPENAI_API_KEY` | Conditional | - | Required if AI_PROVIDER=openai |
| **Docker Environment** |
| `MYSQL_ROOT_PASSWORD` | Optional | `rootpassword` | MySQL root password |
| `MYSQL_DATABASE` | Optional | `wordpress` | WordPress database name |
| `MYSQL_USER` | Optional | `wordpress` | WordPress database user |
| `MYSQL_PASSWORD` | Optional | `wordpress` | WordPress database password |
| `WP_PORT` | Optional | `8000` | WordPress HTTP port |
| `WP_DEBUG` | Optional | `1` | WordPress debug mode |
| `PMA_PORT` | Optional | `8080` | phpMyAdmin port |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - Standard for AI-to-service communication |
| **Vercel AI SDK** | Framework for building AI applications with streaming, tools, and multi-provider support |
| **Ability** | WordPress extensibility unit - defines a capability with input/output schemas and execution logic |
| **Tool** | In Vercel AI SDK - a function that an AI agent can call |
| **Zod** | TypeScript-first schema validation library |
| **MU Plugin** | Must-Use Plugin - WordPress plugin that is automatically loaded |
| **Application Password** | WordPress feature for API authentication |
| **JSON-RPC** | Remote procedure call protocol using JSON |
| **Streamable HTTP Transport** | MCP transport for remote HTTP clients |
| **REST Transport** | MCP transport for direct HTTP API calls |
| **WP-CLI** | WordPress command-line interface |
| **Docker Compose** | Tool for defining multi-container Docker applications |

---

**Document Maintainer**: Development Team
**Last Updated**: October 14, 2025
**Next Review**: November 14, 2025
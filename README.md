# WordPress AI Editor v3 - Vercel AI + MCP Integration

AI-powered WordPress content management using Vercel AI SDK and Model Context Protocol.

## Overview

This project integrates WordPress with Vercel AI SDK through the Model Context Protocol (MCP), enabling natural language WordPress content management with type-safe tool definitions.

## Architecture

```
Next.js App (Port 3000)
  ↓
Vercel AI SDK Agent (lib/agents/wordpress-agent.ts)
  ↓
Explicit Tool Definitions (lib/tools/wordpress-tools.ts)
  ↓
MCP HTTP Client (lib/mcp/wordpress-client.ts)
  ↓
WordPress MCP Adapter (http://localhost:8000/wp-json/wordpress-poc/mcp)
  ↓
WordPress Abilities API
  ↓
WordPress Core Functions
```

## Features

- **Type-Safe Tools**: Explicit TypeScript/Zod schemas for all WordPress operations
- **MCP Integration**: Execute WordPress tools via Model Context Protocol
- **AI Agent**: Vercel AI SDK agent with natural language interface
- **5 WordPress Tools**:
  - `wordpress-get-post` - Retrieve post by ID
  - `wordpress-list-posts` - List posts with pagination
  - `wordpress-create-post` - Create new posts
  - `wordpress-update-post` - Update existing posts
  - `wordpress-delete-post` - Delete posts

## Prerequisites

- Docker Desktop (24.0.0+)
- Node.js (18+) and pnpm
- OpenAI API key OR Anthropic API key (Claude)
- WordPress running via Docker (see Setup)

## Quick Start

### Option A: Real Site Mimic (Recommended for Testing)

For testing your AI agent with **realistic ecommerce data** (~250 products):

```bash
# One-command setup for realistic store
./scripts/setup/install-real-site.sh
```

This sets up a production-like WooCommerce store with:
- **~250 realistic products** with images and variations
- **WooCommerce + Storefront theme**
- **Pre-configured MCP adapter**
- **Accessible on port 8002**

**See [REAL-SITE-SETUP.md](./REAL-SITE-SETUP.md) for complete documentation.**

### Option B: Sandbox (Development)

### 1. Start WordPress and Install MCP Adapter

```bash
# Start WordPress and MySQL
docker-compose up -d

# Run one-shot installation script (handles everything automatically)
# This script will:
# - Install WordPress MCP adapter
# - Configure permalinks
# - Generate Application Password
# - Update .env.local with credentials
# - Test the MCP connection
./scripts/setup/install-mcp-adapter.sh
```

The script will output the generated credentials at the end. No manual configuration needed!

### 2. Setup Next.js Application

```bash
# Install dependencies
pnpm install

# Add your AI provider API key to .env.local
# (WordPress credentials are already configured by the script)
# For Anthropic (Claude):
echo 'AI_PROVIDER=anthropic' >> .env.local
echo 'ANTHROPIC_API_KEY=sk-ant-your-key-here' >> .env.local

# Or for OpenAI:
echo 'AI_PROVIDER=openai' >> .env.local
echo 'OPENAI_API_KEY=sk-your-key-here' >> .env.local

# Run schema tests
pnpm test:schemas

# Start dev server
pnpm dev
```

### 3. Test the Integration

```bash
# Check health
curl http://localhost:3000/api/health

# Test agent with streaming response
curl -X POST http://localhost:3000/api/agents/wordpress/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List all WordPress posts"}' \
  --no-buffer
```

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── agents/wordpress/       # Agent API routes
│   │   │   ├── route.ts            # Non-streaming endpoint
│   │   │   └── stream/route.ts     # Streaming endpoint
│   │   └── health/route.ts         # Health check
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Home page
├── lib/
│   ├── agents/
│   │   └── wordpress-agent.ts      # Vercel AI agent
│   ├── mcp/
│   │   ├── wordpress-client.ts     # MCP HTTP client
│   │   ├── client-factory.ts       # Client singleton
│   │   └── types.ts                # MCP type definitions
│   └── tools/
│       ├── wordpress-schemas.ts    # Zod schemas
│       └── wordpress-tools.ts      # Tool definitions
├── scripts/
│   ├── setup/
│   │   └── install-mcp-adapter.sh  # MCP adapter installation
│   ├── wordpress/
│   │   └── wp-cli.sh               # WordPress CLI wrapper
│   └── test/
│       ├── test-wordpress-agent.ts # End-to-end test
│       └── test-schemas.ts         # Schema validation
└── wp-content/
    └── mu-plugins/
        └── register-wordpress-abilities.php  # WordPress side
```

## Usage

### API Endpoints

#### POST /api/agents/wordpress
Execute WordPress agent with a prompt.

```bash
curl -X POST http://localhost:3000/api/agents/wordpress \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a new draft post titled \"My First AI Post\" with some sample content"
  }'
```

Response:
```json
{
  "text": "I've created a new draft post...",
  "toolCalls": [
    {"name": "wordpress-create-post", "args": {...}}
  ],
  "finishReason": "stop",
  "usage": {...}
}
```

#### POST /api/agents/wordpress/stream
Streaming version of the agent.

```bash
curl -X POST http://localhost:3000/api/agents/wordpress/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List all posts"}' \
  --no-buffer
```

#### GET /api/health
Check WordPress MCP connection status.

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "wordpress_mcp": "connected",
  "tools_available": 5,
  "tool_names": ["wordpress-get-post", "wordpress-list-posts", ...]
}
```

### CLI Testing

```bash
# Test schemas
pnpm test:schemas

# Test agent end-to-end (requires WordPress and OpenAI key)
pnpm test:agent

# Run all tests
pnpm test:all
```

## Adding New WordPress Tools

### 1. Add ability in WordPress
Edit `wp-content/mu-plugins/register-wordpress-abilities.php`:

```php
$my_ability = wp_register_ability('wordpress/my-tool', [
    'label' => 'My Tool',
    'description' => 'Does something useful',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'param' => ['type' => 'string', 'description' => 'A parameter'],
        ],
        'required' => ['param'],
    ],
    'execute_callback' => function($input) {
        // Your logic here
        return ['result' => 'success'];
    },
]);
```

### 2. Define schema in Next.js
Add to `lib/tools/wordpress-schemas.ts`:

```typescript
export const myToolSchema = z.object({
  param: z.string().describe('A parameter for the LLM')
});

export type MyToolInput = z.infer<typeof myToolSchema>;
```

### 3. Create tool definition
Add to `lib/tools/wordpress-tools.ts`:

```typescript
export const myTool = tool({
  description: 'Does something useful',
  parameters: myToolSchema,
  execute: async (input: MyToolInput) => {
    const client = await getWordPressMcpClient();
    const result = await client.callTool('wordpress-my-tool', input);
    return extractContent(result);
  }
});

// Add to exports
export const wordpressTools = {
  ...existing,
  'wordpress-my-tool': myTool
};
```

### 4. Restart and test
```bash
docker-compose restart wordpress
pnpm dev
pnpm test:agent
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WORDPRESS_MCP_URL` | WordPress MCP endpoint | `http://localhost:8000/wp-json/wordpress-poc/mcp` |
| `WORDPRESS_MCP_USERNAME` | WordPress username | `admin` |
| `WORDPRESS_MCP_PASSWORD` | Application password | From `.mcp-credentials` |
| `AI_PROVIDER` | AI provider to use | `anthropic` or `openai` (defaults to `anthropic`) |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) API key | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

## Troubleshooting

### WordPress not responding
```bash
docker-compose ps
docker-compose logs wordpress
docker-compose restart wordpress
```

### MCP connection failed / 401 Forbidden errors

The most common issue is missing or invalid Application Password. To fix:

```bash
# Re-run the setup script to regenerate credentials
./scripts/setup/install-mcp-adapter.sh

# Or manually regenerate Application Password:
./scripts/wordpress/wp-cli.sh user application-password create admin "MCP Client" --porcelain
# Then update WORDPRESS_MCP_PASSWORD in .env.local with the output

# Test the endpoint directly with your credentials:
curl -u "admin:YOUR_APP_PASSWORD" http://localhost:8000/wp-json/wordpress-poc/mcp \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

**Important:** After updating `.env.local`, restart the Next.js dev server to pick up new credentials.

### REST API returns HTML instead of JSON

This means permalinks aren't configured. Fix with:

```bash
./scripts/wordpress/wp-cli.sh option update permalink_structure "/%postname%/"
./scripts/wordpress/wp-cli.sh rewrite flush
```

### Tool execution errors
- Check WordPress logs: `docker-compose logs wordpress`
- Verify tool name matches WordPress ability name
- Ensure input schema matches WordPress input_schema
- Check `.env.local` has correct Application Password (not regular admin password)

### TypeScript errors
```bash
# Check compilation
pnpm tsc --noEmit

# Rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

### OpenAI API errors
- Verify `OPENAI_API_KEY` is set in `.env.local`
- Check API key is valid at https://platform.openai.com/api-keys
- Ensure you have credits/quota available

## Documentation

- **Real Site Mimic Setup**: `REAL-SITE-SETUP.md` - Realistic ecommerce testing environment
- **WordPress MCP Setup**: `MCP-SETUP.md`
- **System Design**: `AI_Powered_WordPress_Editor_System_Design.md`
- **Implementation Plan**: `thoughts/shared/plans/2025-01-14-vercel-ai-wordpress-mcp-integration.md`

## Performance

- **MCP Connection**: Singleton client, ~100ms initial connect, <1ms reuse
- **Tool Execution**: 50-200ms per WordPress tool call
- **Agent Response**: 2-5s total (depends on LLM + tool calls)
- **Memory**: ~50MB for Next.js + MCP client

## Known Limitations

- HTTP only (no HTTPS for local development)
- Single WordPress instance (no multi-tenant support)
- Manual schema sync (tool schemas must be updated manually when WordPress changes)
- No caching across restarts (in-memory only)

## License

[Your License]

## Related Projects

- [WordPress Abilities API](https://github.com/WordPress/abilities-api)
- [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
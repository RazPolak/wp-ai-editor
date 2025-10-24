# Plan: Integrate Vercel AI Agent with WordPress MCP via Dynamic Tool Discovery

## Objective
- Stand up a Vercel AI SDK agent that talks to the existing WordPress MCP adapter through fully dynamic tool discovery.
- Reuse the MCP-provided JSON schemas so the agent stays in sync with abilities registered in WordPress (`wp-content/mu-plugins/register-wordpress-abilities.php:17`).
- Deliver a maintainable Next.js integration that other teams can extend with additional MCP abilities without code changes.

## Current State
- WordPress MCP adapter is installed per `MCP-SETUP.md`.
- Abilities publish `input_schema` and `output_schema`, so `tools/list` already returns machine-readable specs.
- Vercel AI SDK exposes `experimental_createMCPClient` and transports such as `StreamableHTTPClientTransport` for HTTP endpoints.
- Environment variables and credentials are available via `.mcp-credentials`.

## Deliverables
- `lib/mcp/wordpress-client.ts`: authenticated HTTP transport wrapper that handles initialize/connect lifecycle and exposes `tools()` plus `callTool`.
- `lib/mcp/schema.ts`: JSON-Schema → Zod converter (minimum keywords: `type`, `properties`, `required`, `enum`, `default`, nested objects, arrays).
- Startup hook that caches discovered tools and converts them into Vercel AI tool definitions.
- API route (e.g. `app/api/agents/wordpress/route.ts`) that instantiates `generateText`/`createAgent` with the discovered tool map and chosen LLM.
- Smoke tests or scripts verifying discovery and a sample tool invocation.

## Milestones & Tasks
1. **Project Preparation**
   - Add dependencies: `pnpm add ai @ai-sdk/openai @modelcontextprotocol/sdk zod`.
   - Define required environment variables (`WORDPRESS_MCP_URL`, `WORDPRESS_MCP_USERNAME`, `WORDPRESS_MCP_PASSWORD`, `OPENAI_API_KEY`) and document loading order.

2. **MCP HTTP Transport**
   - Implement token/basic-auth header injection using application password from `.mcp-credentials`.
   - Instantiate `StreamableHTTPClientTransport` targeting `http://localhost:8000/wp-json/wordpress-poc/mcp`.
   - Wrap with retry + exponential backoff for transient HTTP failures and 401 recovery (refresh password).

3. **Dynamic Tool Discovery**
   - Call `experimental_createMCPClient({ transport })` to obtain `client`.
   - Invoke `await client.tools()`; persist the map in memory with lazy refresh and `client.close()` on shutdown.
   - Map each returned tool to Vercel AI `tool()` instances:
     - Build parameter schema from MCP tool `inputSchema`.
     - Attach description, examples, and provider metadata if present.
     - Executor calls `client.callTool(name, args)` and handles `WP_Error` responses gracefully.
   - Log and skip tools whose schemas use unsupported features (e.g., recursive refs). Emit telemetry so we can add support later.

4. **Agent Integration**
   - Create `createWordPressAgent()` factory that accepts a discovered tool map and plugs into `generateText` or `streamText`.
   - Expose REST endpoint at `/api/wordpress-agent` using Next.js App Router. Ensure streaming responses work with the CLI.
   - Optionally add React hook (`useChat`) wiring for local UI demos.

5. **Validation & Tooling**
   - CLI script `scripts/test-wordpress-agent.ts` that runs discovery and executes `wordpress-list-posts` to verify environment configuration.
   - Add integration test (Vitest) that mocks MCP responses and checks schema translation edge cases.
   - Update docs (`README.md`, `MCP-SETUP.md`) with instructions for starting the agent and environment setup.

6. **Observability & Resilience**
   - Implement structured logging around discovery and invocation (include tool name, duration, error codes).
   - Capture metrics for cache hits/misses and retry attempts.
   - Plan for hot reload: detect WordPress ability changes by comparing `tools/list` hash and rebuild tool map automatically.

## Risks & Mitigations
- **Schema Incompatibility**: Unknown JSON Schema keywords may break the converter. Mitigate with conservative fallbacks (`z.any()`) and logging.
- **Credential Drift**: Application password rotation causes 401s. Implement explicit error handling prompting regeneration.
- **Tool Name Collisions**: Multiple MCP servers could expose similarly named tools; namespace tool keys (`wordpress/…`) when merging.
- **Latency**: `tools()` call adds startup cost. Cache results and refresh asynchronously.

## Open Questions
- Do we need multi-tenant credential storage, or is a single WordPress instance sufficient for this milestone?
- Should we surface MCP resources/prompts alongside tools now, or defer until more use cases emerge?
- Is Claude/OpenAI the long-term model provider, or do we need abstraction for Anthropic/OpenRouter?

## Next Actions
1. Confirm `.mcp-credentials` format and decide how to load it into environment variables.
2. Prototype the HTTP transport and verify `client.tools()` works against local WordPress MCP.
3. Implement the JSON Schema converter with unit tests covering existing abilities.
4. Wire the agent route and smoke test via curl or Postman.

# WordPress AI Editor - Product Requirements Document

**Version:** 3.0
**Date:** October 14, 2025
**Status:** Active Development

---

## Executive Summary

This project is a proof-of-concept integration that bridges WordPress content management with AI language models through the Model Context Protocol (MCP). It enables natural language interactions with WordPress sites using Vercel AI SDK, allowing AI agents to perform CRUD operations on WordPress content.

---

## 1. Product Vision

### 1.1 Problem Statement
WordPress users need to perform content management tasks that are repetitive and require technical knowledge of WordPress interfaces. Traditional WordPress admin requires navigating through multiple screens, understanding post statuses, and manually inputting content.

### 1.2 Solution
An AI-powered interface that allows WordPress content management through natural language commands. Users can create, read, update, and delete WordPress content by describing what they want in plain English.

### 1.3 Success Criteria
- AI agent successfully communicates with WordPress via MCP
- Natural language commands correctly map to WordPress operations
- Type-safe tool definitions prevent runtime errors
- Response time under 5 seconds for typical operations
- 100% test coverage for core tool operations

---

## 2. Core Requirements

### 2.1 Functional Requirements

#### FR-1: WordPress Content Management via AI
**Priority:** P0 (Must Have)

The system MUST support natural language commands for:
- **Listing posts**: "Show me all posts" → calls `wordpress-list-posts`
- **Reading posts**: "Get post 123" → calls `wordpress-get-post`
- **Creating posts**: "Create a draft post titled X with content Y" → calls `wordpress-create-post`
- **Updating posts**: "Update post 123 with new title X" → calls `wordpress-update-post`
- **Deleting posts**: "Delete post 123" → calls `wordpress-delete-post`

#### FR-2: MCP Protocol Integration
**Priority:** P0 (Must Have)

The system MUST:
- Establish authenticated HTTP connection to WordPress MCP endpoint
- Use Streamable HTTP transport for MCP communication
- Handle JSON-RPC 2.0 protocol correctly
- Support MCP `initialize`, `tools/list`, and `tools/call` methods
- Handle WordPress WP_Error responses gracefully

#### FR-3: Type-Safe Tool Definitions
**Priority:** P0 (Must Have)

The system MUST:
- Define Zod schemas matching WordPress ability input schemas
- Validate all tool inputs before execution
- Provide TypeScript types for all tool parameters
- Keep schemas synchronized with WordPress PHP definitions

#### FR-4: Multi-Provider AI Support
**Priority:** P1 (Should Have)

The system MUST support:
- Anthropic Claude (default)
- OpenAI GPT-4
- Configurable via environment variable `AI_PROVIDER`

#### FR-5: API Endpoints
**Priority:** P0 (Must Have)

The system MUST provide:
- `POST /api/agents/wordpress` - Non-streaming agent execution
- `POST /api/agents/wordpress/stream` - Streaming agent execution
- `GET /api/health` - Health check and MCP connection status

### 2.2 Non-Functional Requirements

#### NFR-1: Performance
- MCP connection establishment: < 500ms
- Tool execution: < 2 seconds per operation
- Agent response (including LLM): < 5 seconds
- Support up to 10 sequential tool calls per agent execution

#### NFR-2: Reliability
- Graceful handling of WordPress downtime
- Retry logic for transient network failures
- Proper error messages for user-facing errors
- Logging for debugging

#### NFR-3: Security
- WordPress authentication via Application Passwords
- No credential storage in codebase
- Environment variable-based configuration
- Basic Auth over HTTP for local development only

#### NFR-4: Maintainability
- Separation of concerns (MCP client, tools, agent)
- Singleton pattern for MCP client to avoid connection overhead
- Comprehensive TypeScript types
- Self-documenting code with clear naming

---

## 3. WordPress Integration Requirements

### 3.1 WordPress Setup
**Priority:** P0 (Must Have)

The system REQUIRES:
- WordPress 6.0+ running via Docker
- PHP 7.4+ with Composer support
- MySQL/MariaDB database
- WordPress Abilities API (official)
- WordPress MCP Adapter (official)

### 3.2 WordPress Abilities
**Priority:** P0 (Must Have)

Five WordPress abilities MUST be registered:
1. `wordpress/get-post` - Retrieve single post by ID
2. `wordpress/list-posts` - List posts with pagination
3. `wordpress/create-post` - Create new post
4. `wordpress/update-post` - Update existing post
5. `wordpress/delete-post` - Delete post (trash or force)

Each ability MUST:
- Define JSON schema for inputs/outputs
- Implement `execute_callback` function
- Implement `permission_callback` for access control
- Handle WordPress errors via WP_Error

### 3.3 MCP Server Configuration
**Priority:** P0 (Must Have)

WordPress MCP server MUST be configured with:
- Server ID: `wordpress-poc-server`
- Namespace: `wordpress-poc`
- Route: `mcp` (endpoint: `/wp-json/wordpress-poc/mcp`)
- REST Transport for direct HTTP calls
- Streamable Transport for remote clients
- Error logging via ErrorLogMcpErrorHandler

---

## 4. Technical Stack

### 4.1 Frontend/API Layer
- **Framework**: Next.js 15.1.6 (App Router)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.7.3
- **Package Manager**: pnpm

### 4.2 AI Layer
- **SDK**: Vercel AI SDK 5.0.70
- **Providers**:
  - @ai-sdk/anthropic 2.0.27 (Claude)
  - @ai-sdk/openai 2.0.42 (GPT-4)
- **Validation**: Zod 3.24.1

### 4.3 MCP Layer
- **Protocol**: Model Context Protocol 1.0
- **SDK**: @modelcontextprotocol/sdk 1.0.4
- **Transport**: StreamableHTTPClientTransport

### 4.4 WordPress Layer
- **Platform**: WordPress (latest) via Docker
- **Database**: MariaDB 10.6.4
- **PHP**: 7.4+
- **Packages**:
  - wordpress/abilities-api (dev-trunk)
  - wordpress/mcp-adapter (dev-trunk)

---

## 5. User Workflows

### 5.1 Setup Workflow
1. Start Docker containers (WordPress + MySQL)
2. Run installation script to install MCP adapter
3. Configure environment variables
4. Start Next.js development server
5. Test health endpoint

### 5.2 Usage Workflow - List Posts
```
User → "List all WordPress posts"
  ↓
Next.js API → Vercel AI Agent
  ↓
Agent → LLM interprets prompt
  ↓
LLM → Selects wordpress-list-posts tool
  ↓
Tool → MCP Client calls WordPress
  ↓
WordPress → Returns posts via MCP
  ↓
Agent → Formats response for user
  ↓
User ← "Here are your posts: ..."
```

### 5.3 Usage Workflow - Create Post
```
User → "Create a draft post titled 'Hello' with content 'World'"
  ↓
Next.js API → Vercel AI Agent
  ↓
Agent → LLM interprets prompt
  ↓
LLM → Selects wordpress-create-post tool with params
  ↓
Tool → Validates input with Zod schema
  ↓
Tool → MCP Client calls WordPress
  ↓
WordPress → Creates post, returns ID
  ↓
Agent → "I've created draft post ID 123..."
  ↓
User ← Success confirmation
```

---

## 6. Out of Scope (Current Version)

The following are explicitly NOT implemented:
- Production deployment (local development only)
- HTTPS/SSL support
- User authentication/authorization in Next.js
- Multi-tenant WordPress support
- Frontend UI for chat interface
- WordPress media/attachments
- WordPress taxonomies (categories, tags)
- WordPress custom post types
- WordPress users management
- WordPress site settings
- Caching layer
- Rate limiting
- Monitoring/observability
- Automated testing CI/CD

---

## 7. Success Metrics

### 7.1 Technical Metrics
- MCP connection success rate: 99%+
- Tool execution success rate: 95%+
- Average response time: < 3 seconds
- Zero credential leaks
- Zero runtime type errors

### 7.2 Functionality Metrics
- All 5 WordPress tools operational
- Natural language understanding accuracy: 90%+
- Multi-step operations supported (up to 10 steps)
- Error messages are actionable

---

## 8. Dependencies

### 8.1 External Dependencies
- Docker Desktop 24.0.0+
- Node.js 18+
- pnpm package manager
- Anthropic API key OR OpenAI API key
- Internet connection for LLM API calls

### 8.2 Internal Dependencies
- WordPress must be running before Next.js starts
- MCP adapter must be installed in WordPress
- Application password must be generated
- Environment variables must be configured

---

## 9. Risks and Mitigations

### Risk 1: Schema Drift
**Problem**: WordPress ability schemas may change without updating Next.js schemas
**Mitigation**: Manual schema validation script (`pnpm test:schemas`)

### Risk 2: MCP Connection Failures
**Problem**: WordPress may be unreachable
**Mitigation**: Health check endpoint, clear error messages, retry logic

### Risk 3: LLM API Costs
**Problem**: Frequent API calls may incur high costs
**Mitigation**: Local development only, clear token usage logging

### Risk 4: WordPress Credentials
**Problem**: Application password may be committed accidentally
**Mitigation**: `.gitignore` includes `.env.local`, `.mcp-credentials`

---

## 10. Future Enhancements (Roadmap)

### Phase 2: Enhanced Content Management
- Support for WordPress pages
- Support for custom post types
- Media library integration
- Category and tag management

### Phase 3: Production Ready
- HTTPS support
- Production deployment guide
- Environment-specific configurations
- Rate limiting and quotas

### Phase 4: Advanced Features
- Batch operations
- Content search and filtering
- WordPress user management
- Site settings management
- Multi-site support

### Phase 5: UI/UX
- Web-based chat interface
- Real-time streaming responses
- Post preview
- Undo/redo operations

---

## 11. Testing Requirements

### 11.1 Manual Testing
- Health check returns correct status
- All 5 tools can be called successfully
- Error handling for non-existent posts
- Schema validation catches invalid inputs

### 11.2 Automated Testing
- Schema validation tests (`pnpm test:schemas`)
- End-to-end agent tests (`pnpm test:agent`)
- Connection tests
- Tool execution tests

### 11.3 Test Scenarios
1. List posts with pagination
2. Get specific post by ID
3. Create draft post
4. Update post title
5. Update post status (draft → publish)
6. Delete post (move to trash)
7. Force delete post
8. Handle non-existent post
9. Handle invalid parameters

---

## 12. Documentation Requirements

### 12.1 User Documentation
- README.md with quick start guide
- Setup instructions
- API endpoint documentation
- Troubleshooting guide

### 12.2 Developer Documentation
- Architecture overview
- Code structure explanation
- Adding new WordPress tools guide
- Environment variables reference

### 12.3 Operational Documentation
- Docker setup and management
- WordPress MCP adapter installation
- Health monitoring
- Log locations and debugging

---

## Appendix A: Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WORDPRESS_MCP_URL` | Yes | WordPress MCP endpoint | `http://localhost:8000/wp-json/wordpress-poc/mcp` |
| `WORDPRESS_MCP_USERNAME` | Yes | WordPress admin username | `admin` |
| `WORDPRESS_MCP_PASSWORD` | Yes | WordPress application password | `xxxx xxxx xxxx xxxx` |
| `AI_PROVIDER` | No | AI provider to use | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | Conditional | Claude API key | `sk-ant-...` |
| `OPENAI_API_KEY` | Conditional | OpenAI API key | `sk-...` |
| `WP_PORT` | No | WordPress port | `8000` |
| `MYSQL_ROOT_PASSWORD` | No | MySQL root password | Custom value |
| `MYSQL_PASSWORD` | No | MySQL wordpress user password | Custom value |

---

## Appendix B: WordPress Post Statuses

The system supports these WordPress post statuses:
- `draft` - Post is saved but not published
- `pending` - Post awaiting review
- `publish` - Post is live and publicly visible
- `private` - Post is published but only visible to logged-in users

---

## Appendix C: Known Limitations

1. **HTTP Only**: No HTTPS support (local development)
2. **Single Instance**: No multi-tenant support
3. **Manual Schema Sync**: Schemas must be updated manually
4. **No Caching**: Fresh data fetched every time
5. **Limited Content Types**: Posts only (no pages, CPTs)
6. **No Media**: Attachments not supported
7. **No Taxonomies**: Categories/tags not supported
8. **No Search**: Full-text search not implemented
9. **No Bulk Operations**: One operation at a time
10. **No Undo**: Destructive operations are permanent

---

**Document Owner**: Development Team
**Last Updated**: October 14, 2025
**Review Cycle**: Monthly
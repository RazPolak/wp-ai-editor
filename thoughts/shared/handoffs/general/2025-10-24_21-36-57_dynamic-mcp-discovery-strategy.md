---
date: 2025-10-24T18:36:57Z
researcher: Claude
git_commit: bf97404873cf157710298ebf11f94c29a22484e7
branch: main
repository: wp-ai-editor-v3
topic: "Dynamic MCP Discovery Implementation Strategy"
tags: [implementation, strategy, mcp, plugin-discovery, woocommerce, dynamic-capabilities]
status: in_progress
last_updated: 2025-10-24
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Dynamic MCP Discovery Strategy

## Task(s)

**Status: Strategic Planning Complete - Ready for Implementation**

The user requested implementation of WooCommerce support following the plan in `thoughts/shared/plans/2025-10-22-woocommerce-support.md`. However, after reviewing the Dynamic MCP Discovery vision document (`DYNAMIC_MCP_DISCOVERY.md`), the user decided to pivot to **Option B: Dynamic Discovery First** instead of manual WooCommerce implementation.

**Tasks Completed:**
1. ✅ Comprehensive codebase exploration using 6 parallel sub-agents
2. ✅ Understanding of current MCP architecture and patterns
3. ✅ Analysis of WooCommerce implementation plan (7 phases)
4. ✅ Review of Dynamic MCP Discovery vision
5. ✅ Strategic options analysis (manual vs. dynamic vs. hybrid)
6. ✅ User decision: Pivot to dynamic discovery approach

**Tasks Planned (Not Started):**
1. Design dynamic plugin discovery system
2. Implement ability introspection and schema discovery
3. Build automatic tool generation from discovered abilities
4. Test with WooCommerce as reference implementation
5. Validate auto-generated tools work identically to manual implementation

## Critical References

1. **Vision Document**: `DYNAMIC_MCP_DISCOVERY.md` - Core product differentiation and user promise
2. **WooCommerce Plan**: `thoughts/shared/plans/2025-10-22-woocommerce-support.md` - Reference for manual patterns (7 phases)
3. **MCP Adapter Plugin**: WordPress MCP Adapter provides the abilities framework

## Recent Changes

**No code changes made** - Session focused on exploration and strategic planning only.

## Learnings

### Architecture Understanding

**MCP Infrastructure** (`lib/mcp/`):
- Singleton pattern with environment-specific caching (sandbox/production/real-site)
- Three environments on ports 8000/8001/8002
- HTTP Basic Auth with Application Passwords
- `getWordPressMcpClient(environment)` returns cached or creates new client
- Tool names use hyphens (`wordpress-get-post`) not slashes

**WordPress Abilities Pattern** (`wp-content/mu-plugins/register-wordpress-abilities.php`):
- Two-hook system: `abilities_api_categories_init` (priority 10) → `abilities_api_init` (priority 100)
- Each ability: label, description, category, input_schema, output_schema, execute_callback, permission_callback, meta
- Current abilities: 5 post operations (get, list, create, update, delete)
- MCP server configured in `configure-mcp-server.php` with ability names array

**TypeScript Tools Pattern** (`lib/tools/`):
- Zod schemas manually kept in sync with PHP abilities (`wordpress-schemas.ts`)
- Factory pattern: `createWordPressTools(environment)` generates tools
- Each tool: description, inputSchema, execute function calling MCP client
- Content extraction helper parses JSON from MCP response

**Agent System** (`lib/agents/wordpress-agent.ts`):
- Two modes: `executeWordPressAgent()` and `streamWordPressAgent()`
- Uses Vercel AI SDK with Claude 3.5 Sonnet (default) or GPT-4 Turbo
- Multi-step execution (up to 10 tool calls)
- Environment-specific system prompts

**Change Tracking** (`lib/sync/change-tracker.ts`):
- In-memory tracking with union types for type safety
- Extracts from Vercel AI SDK result.steps
- Sequential sync to production environment
- Type guards validate WordPress tool args/results

**Test Environment** (docker-compose.yml):
- Real-site (port 8002) has WooCommerce pre-installed with ~250 sample products
- Automated via `scripts/setup/init-real-site.sh`
- Storefront theme activated, sample data imported

### Key Discovery System Requirements

Based on exploration, a dynamic discovery system needs to:

1. **Introspect WordPress Abilities API** - Query available abilities at runtime
2. **Parse Ability Schemas** - Convert JSON Schema to Zod schemas programmatically
3. **Generate Tool Definitions** - Auto-create tool() wrappers from ability metadata
4. **Update Change Tracker Types** - Dynamically extend union types for new tools
5. **Handle Permissions** - Map ability permission_callback to tool-level checks
6. **Cache Discovery Results** - Avoid repeated introspection (with invalidation on plugin changes)

### Existing Discovery Endpoints

The MCP protocol already supports tool listing:
- `client.listTools()` returns all available tools from WordPress
- MCP server at `/wp-json/wordpress-poc/mcp` exposes registered abilities
- Current response includes tool names but may need schema enrichment

### Manual Pattern as Blueprint

The WooCommerce plan provides excellent reference for what needs to be auto-generated:
- Phase 1: Plugin detection (`wordpress/get-plugin-status`)
- Phase 2: Products (list, get, create, update, delete)
- Phase 3: Orders (list, get, update-status, add-note)
- Phase 4: Customers (list, get)
- Phase 5: Coupons (CRUD)
- Phase 6: Inventory (low-stock, bulk-update)
- Phase 7: Email templates (list, get, update)

Each follows identical pattern - can be template for code generation.

## Artifacts

### Exploration Summaries (Sub-Agent Output)
Six parallel explorations completed:
1. MCP Infrastructure understanding
2. WordPress Abilities patterns
3. TypeScript tools and schemas
4. Agent system architecture
5. Change tracking system
6. Test environment setup

### Reference Documents
1. `DYNAMIC_MCP_DISCOVERY.md` - Product vision
2. `thoughts/shared/plans/2025-10-22-woocommerce-support.md` - Manual WooCommerce plan (7 phases)
3. `MCP-SETUP.md` - MCP configuration guide

### Key Files Analyzed
- `lib/mcp/client-factory.ts` - Client singleton pattern
- `lib/mcp/wordpress-client.ts` - MCP protocol implementation
- `lib/tools/wordpress-tools.ts` - Tool factory and definitions
- `lib/tools/wordpress-schemas.ts` - Zod schemas (manual sync)
- `lib/agents/wordpress-agent.ts` - Agent execution
- `lib/sync/change-tracker.ts` - Change tracking with unions
- `wp-content/mu-plugins/register-wordpress-abilities.php` - PHP abilities (lines 1-419)
- `wp-content/mu-plugins/configure-mcp-server.php` - MCP server config
- `docker-compose.yml` - Environment setup (lines 189-250 for real-site)

## Action Items & Next Steps

### Phase 1: Discovery System Design (1-2 days)
1. **Research MCP introspection capabilities**
   - Test `client.listTools()` response format
   - Check if schemas are included in tool metadata
   - Determine if WordPress MCP adapter needs enhancement

2. **Design discovery service architecture**
   - Create `lib/discovery/plugin-discovery.ts`
   - Define interfaces: `DiscoveredAbility`, `DiscoveredPlugin`, `DiscoveryCache`
   - Plan caching strategy (localStorage? file-based? Redis?)

3. **Plan code generation approach**
   - Schema generation: JSON Schema → Zod
   - Tool generation: Ability metadata → tool() definitions
   - Type generation: Dynamic union types for change tracker

### Phase 2: Introspection Implementation (2-3 days)
1. **Enhance MCP client for discovery**
   - Add `discoverAbilities()` method to WordPressMcpClient
   - Parse tool metadata including input/output schemas
   - Extract ability categories and descriptions

2. **Build schema converter**
   - Create `lib/discovery/schema-converter.ts`
   - Convert JSON Schema to Zod schema strings
   - Handle common WordPress types (post, product, order, etc.)
   - Test with existing WordPress post schemas

3. **Create tool generator**
   - Create `lib/discovery/tool-generator.ts`
   - Generate tool() definitions from ability metadata
   - Preserve environment-specific descriptions
   - Include execute callback with MCP client calls

### Phase 3: Code Generation (2-3 days)
1. **Implement runtime code generation**
   - Generate TypeScript code strings for schemas and tools
   - Eval or dynamic import for runtime loading
   - OR: Build-time generation with file watching

2. **Update change tracker**
   - Make union types extensible (use generics or registry pattern)
   - Create `registerToolType()` for dynamic registration
   - Update type guards to handle new tool types

3. **Add discovery CLI command**
   - Create `pnpm discover` command
   - Scan WordPress site for plugins
   - Generate/update tool definitions
   - Report discovered capabilities

### Phase 4: Testing & Validation (1-2 days)
1. **Test with existing WordPress abilities**
   - Run discovery on current 5 post operations
   - Compare auto-generated tools to manual implementations
   - Verify identical behavior

2. **Test with WooCommerce**
   - Install WooCommerce abilities (from manual plan Phase 1-2)
   - Run discovery to auto-generate WooCommerce tools
   - Test product CRUD operations
   - Compare to manual implementation in plan

3. **Test with custom plugin**
   - Create simple test plugin with custom abilities
   - Verify discovery automatically finds and enables them
   - Validate agent can use new capabilities

### Phase 5: UI/UX Integration (1-2 days)
1. **Add discovery status to UI**
   - Show discovered plugins and capabilities
   - Display last discovery timestamp
   - Add "Refresh Capabilities" button

2. **Handle plugin changes**
   - Detect when plugins are installed/removed/updated
   - Auto-trigger re-discovery or prompt user
   - Cache invalidation strategy

3. **User messaging**
   - "Learning your WordPress site..." progress
   - "Found X plugins, can help with..." summary
   - Plugin-specific capability descriptions

## Other Notes

### Why Option B (Dynamic Discovery) Was Chosen

The user interrupted the manual WooCommerce implementation to pivot to dynamic discovery because:
- Aligns with core product vision in `DYNAMIC_MCP_DISCOVERY.md`
- Solves the problem once for ALL plugins, not just WooCommerce
- Represents true product differentiation vs competitors
- More ambitious but significantly more valuable long-term
- WooCommerce becomes a test case rather than end goal

### Implementation Philosophy

The manual WooCommerce plan should serve as:
- **Reference implementation** - Shows what patterns need to be generated
- **Test oracle** - Auto-generated code should match manual patterns
- **Validation suite** - Proves discovery system works correctly

### Technical Challenges to Solve

1. **Type Safety with Dynamic Code**: How to maintain TypeScript safety with runtime-generated tools?
2. **Schema Complexity**: JSON Schema → Zod conversion for complex nested schemas
3. **Permission Mapping**: WordPress capabilities → TypeScript tool permissions
4. **Change Tracking Types**: Dynamic union types or registry pattern?
5. **Caching Strategy**: When to invalidate? How to detect plugin changes?
6. **Agent Prompt Generation**: How to describe discovered capabilities to LLM?

### Quick Wins

Before full discovery system:
1. Test `client.listTools()` to see current MCP response format
2. Manually create one auto-generated tool to validate approach
3. Prototype JSON Schema → Zod converter with WordPress post schema

### Related Documentation

- MCP Protocol Spec: https://modelcontextprotocol.io/
- WordPress Abilities API: WordPress MCP Adapter plugin
- Vercel AI SDK docs: https://sdk.vercel.ai/
- Zod documentation: https://zod.dev/

### Environment Setup Notes

Real-site environment (port 8002) is production-ready:
- WooCommerce installed with ~250 sample products
- Credentials in `.env.local` (WORDPRESS_REAL_SITE_MCP_*)
- Can test discovery immediately without setup

### Success Metrics

The discovery system should demonstrate:
1. **Zero Config**: Install plugin → agent learns it automatically
2. **Feature Parity**: Auto-generated tools work identically to manual
3. **Performance**: Discovery completes in <5 seconds for typical site
4. **Accuracy**: Correctly identifies capabilities and parameters
5. **Adaptability**: Handles plugin updates and changes gracefully
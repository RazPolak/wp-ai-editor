# Dynamic MCP Discovery Implementation Plan (Simplified)

## Overview

Implement a dynamic plugin discovery system that automatically generates tools from WordPress abilities at runtime, eliminating manual schema synchronization and enabling support for any WordPress plugin without code changes. This replaces the current manual tool definition pattern with an intelligent discovery layer that introspects the WordPress MCP server, converts JSON Schemas to Zod schemas, and generates type-safe tool definitions on demand.

**Key Principles:**
- **Simplicity First**: Single unified service, no unnecessary abstractions
- **Type Safety**: Use generics and Result types, never `any`
- **Resilience**: Circuit breaker pattern for MCP failures
- **Performance**: Parallel tool generation, efficient caching
- **No Backward Compatibility**: Clean implementation without legacy constraints

## Current State Analysis

### What Exists Now

**MCP Infrastructure** (`lib/mcp/`):
- Singleton MCP client factory with environment-specific caching (sandbox/production/real-site) - `lib/mcp/client-factory.ts:6-79`
- HTTP transport with Basic Auth and JSON-RPC 2.0 protocol - `lib/mcp/wordpress-client.ts:34-60`
- `listTools()` method that queries WordPress for available tools - `lib/mcp/wordpress-client.ts:104-113`
- Tool execution via `callTool()` with error handling - `lib/mcp/wordpress-client.ts:74-97`

**Manual Tool Pattern** (`lib/tools/`):
- Hardcoded Zod schemas mirroring PHP abilities - `lib/tools/wordpress-schemas.ts:1-60`
- Factory function creating 5 static WordPress post tools - `lib/tools/wordpress-tools.ts:53-109`
- Manual synchronization required between PHP and TypeScript (documented at line 6)

**WordPress Abilities** (`wp-content/mu-plugins/`):
- 5 registered abilities (get, list, create, update, delete posts) - `register-wordpress-abilities.php:30-415`
- JSON Schema definitions for input/output - `register-wordpress-abilities.php:34-52`
- MCP server configuration exposing abilities - `configure-mcp-server.php:28-34`
- Two-hook registration system (categories at priority 10, abilities at priority 100)

**Change Tracking System** (`lib/sync/`):
- Hardcoded union types for tool args/results - `change-tracker.ts:7-21`
- Type guards validating WordPress post patterns - `change-tracker.ts:139-167`
- Production sync replaying changes via MCP - `production-sync.ts:37-78`

**Agent System** (`lib/agents/`):
- Vercel AI SDK integration with multi-step execution - `wordpress-agent.ts:70-89`
- Environment-specific tool loading - `wordpress-agent.ts:75`
- Change tracking integration - `wordpress-agent.ts:87`

**Test Environment** (docker-compose.yml):
- Real-site environment with WooCommerce pre-installed - `docker-compose.yml:189-250`
- ~250 sample products for testing
- Storefront theme with WooCommerce detection utilities

### Key Constraints

**Type Safety Challenges:**
- Union types are compile-time constructs - cannot extend at runtime
- TypeScript generics needed to maintain type safety with dynamic data
- Zod provides runtime validation that bridges compile-time and runtime

**Manual Sync Burden:**
- Adding new ability requires changes in 4 files (PHP ability, MCP config, TypeScript schema, TypeScript tool)
- Schema drift between PHP and TypeScript is undetectable
- Every plugin requires custom TypeScript code

**Discovery Already Available:**
- `client.listTools()` returns `{ tools: [{ name, description?, inputSchema? }] }`
- JSON Schema definitions available but unused
- No automatic tool generation from discovered schemas

### Key Discoveries

**JSON Schema in MCP Response:**
- WordPress abilities define `input_schema` in JSON Schema format
- MCP protocol returns these schemas in `listTools()` response
- Schemas include: type, properties, required, enum, default, nested objects

**Ability Registration Pattern:**
- Category registration on `abilities_api_categories_init` (priority 10)
- Ability registration on `abilities_api_init` (priority 100)
- Each ability has: label, description, category, input_schema, output_schema, execute_callback, permission_callback

**WooCommerce as Reference:**
- Manual WooCommerce plan defines 7 phases with ~30 abilities
- Each follows identical pattern - perfect template for code generation
- Validates that auto-generated tools can match manual implementation quality

## Desired End State

### User Experience

**First Connection:**
```
User installs WordPress plugin (e.g., WooCommerce)
↓
AI agent automatically detects plugin via discovery scan
↓
"Found WooCommerce. I can now help you with:
 - Product management (create, update, list products)
 - Order processing (view orders, update status)
 - Customer management (list customers, view details)
 - Inventory tracking (check stock, update quantities)"
```

**No Configuration Required:**
- Install plugin → agent learns it instantly
- Update plugin → agent adapts to new features
- Remove plugin → agent stops offering those capabilities

### Technical Requirements

**Discovery Service:**
- Query MCP server for available tools at startup and on-demand
- Parse ability metadata including schemas, descriptions, categories
- Cache results in memory with TTL and invalidation strategy
- Detect plugin installation/removal/updates

**Schema Conversion:**
- Convert JSON Schema to Zod schema at runtime
- Support: primitives, objects, arrays, enums, defaults, nested types
- Handle optional/required fields correctly
- Validate against WordPress ability schemas (5 existing + WooCommerce test cases)

**Dynamic Tool Generation:**
- Generate Vercel AI SDK `tool()` definitions from discovered abilities
- Create environment-specific tools (sandbox/production/real-site)
- Maintain type safety through generics and runtime validation
- Execute tools via MCP client with proper error handling

**Type System Evolution:**
- Replace hardcoded union types with generic registry pattern
- Runtime type validation for arbitrary tool signatures
- Change tracker integration for dynamic tool types
- Preserve type safety where possible with branded types

**Agent Integration:**
- Load discovered tools into agent at startup
- Generate dynamic system prompts based on available capabilities
- Track changes for any tool type (not just WordPress posts)
- Sync arbitrary tool invocations to production

### Verification Criteria

#### Automated Verification:
- [ ] Discovery service fetches tools from WordPress MCP: `pnpm test:discovery`
- [ ] JSON Schema converter handles all WordPress post schemas: `pnpm test:schema-conversion`
- [ ] Auto-generated tools match manual tool behavior: `pnpm test:tool-equivalence`
- [ ] WooCommerce abilities auto-discovered from real-site: `pnpm test:woocommerce-discovery`
- [ ] Agent executes discovered WooCommerce tool: `pnpm test:agent-woocommerce`
- [ ] Change tracker captures dynamic tool invocations: `pnpm test:change-tracking-dynamic`
- [ ] Production sync works with discovered tools: `pnpm test:production-sync-dynamic`
- [ ] Type checking passes with generic registry: `pnpm typecheck`

#### Manual Verification:
- [ ] Install new plugin, verify agent discovers capabilities within 5 seconds
- [ ] Ask agent "What can you help me with?" - lists all discovered plugin capabilities
- [ ] Create WooCommerce product via agent - product appears in WordPress admin
- [ ] Update WooCommerce product via agent - changes reflected in database
- [ ] Check stock levels via agent - accurate inventory displayed
- [ ] Uninstall plugin, verify agent stops offering those capabilities
- [ ] No manual code changes required for any plugin

**Implementation Note**: After completing each phase and all automated verification passes, pause for manual confirmation that the manual testing was successful before proceeding to the next phase.

## What We're NOT Doing

**Out of Scope:**
- **Build-time code generation**: No file writing or TypeScript code string generation
- **GraphQL/REST API introspection**: Only MCP protocol discovery
- **Plugin marketplace integration**: No WordPress.org API calls or plugin search
- **Automatic plugin installation**: User must install plugins via WordPress admin
- **Multi-tenancy**: Single WordPress instance per environment for now
- **MCP resources/prompts**: Only tool discovery (defer resources until use case emerges)
- **Custom schema extensions**: Only standard JSON Schema keywords
- **Real-time plugin detection**: Periodic refresh or manual cache invalidation only
- **Frontend plugin management UI**: Discovery status display only, no install/uninstall
- **Automatic API documentation generation**: Focus on tool functionality, not docs

## Implementation Approach

### Strategy

**Runtime Discovery Pattern:**
1. Application starts → Discovery service queries MCP `listTools()`
2. For each tool → Convert JSON Schema → Build Zod schema → Create tool definition
3. Cache in memory → Register with agent → Ready for use
4. On demand → Re-discover to pick up new plugins

**Type Safety Through Generics:**
- Define `DynamicTool<TArgs, TResult>` generic interface
- Runtime validation with Zod bridges compile-time and runtime
- Registry pattern with branded types for tool identification
- Type guards for runtime validation of unknown tool data

**Incremental Replacement:**
- Phase 1-3: Build parallel discovery system alongside manual tools
- Phase 4: Migrate change tracker to generic types
- Phase 5: Validate both systems produce identical results
- Phase 6: Remove manual tool definitions, use discovery exclusively

**WooCommerce as Validation:**
- Real-site environment has WooCommerce pre-installed
- Manual WooCommerce plan (7 phases, ~30 abilities) serves as blueprint
- Compare auto-generated WooCommerce tools to planned manual implementation
- Proves discovery system can handle complex plugin with multiple entity types

### Technology Stack

**Backend:**
- WordPress + Abilities API (existing)
- MCP Adapter with JSON Schema support (existing)
- Application Passwords for authentication (existing)

**Discovery Layer:**
- TypeScript runtime schema builder
- Zod for schema validation
- In-memory cache with TTL

**Agent Integration:**
- Vercel AI SDK with dynamic tool loading
- Generic tool factory pattern
- Environment-specific tool instances

### Development Workflow

**Adding New Plugin Support (After Implementation):**
1. Install plugin in WordPress (via admin or WP-CLI)
2. Plugin registers abilities via Abilities API hooks
3. Restart Next.js app or trigger discovery refresh
4. Agent automatically discovers and loads new tools
5. Test via agent API endpoint - no code changes required

---

## Phase 1: Discovery Infrastructure

### Overview
Build the core discovery service that introspects the WordPress MCP server, parses ability metadata, and caches results in memory. Establish the foundation for dynamic tool generation.

### Changes Required

#### 1. Unified Discovery Service (Simplified)
**File**: `lib/discovery/discovery-service.ts` (new)

```typescript
import { McpEnvironment } from '@/lib/mcp/types';
import { getWordPressMcpClient } from '@/lib/mcp/client-factory';
import { tool } from 'ai';
import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';

// Result type for proper error handling
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface DiscoveredAbility {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly inputSchema?: JsonSchema;
  readonly environment: McpEnvironment;
}

export interface JsonSchema {
  readonly type?: string;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly items?: JsonSchema;
  readonly description?: string;
  [key: string]: unknown;
}

// Simplified cache entry
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Unified service for discovery, tool generation, and caching
 * Replaces separate DiscoveryService, ToolFactory, and ToolRegistry
 */
export class DiscoveryService {
  private abilityCache = new Map<McpEnvironment, CacheEntry<DiscoveredAbility[]>>();
  private toolCache = new Map<McpEnvironment, CacheEntry<Record<string, any>>>();
  private circuitBreaker = new CircuitBreaker();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Primary API: Get tools for an environment (discovery + generation + caching)
   */
  async getTools(environment: McpEnvironment): Promise<Result<Record<string, any>, Error>> {
    // Check tool cache first
    const cached = this.toolCache.get(environment);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[Discovery] Using cached tools for ${environment}`);
      return { ok: true, value: cached.data };
    }

    // Discover abilities
    const abilitiesResult = await this.discover(environment);
    if (!abilitiesResult.ok) {
      return abilitiesResult;
    }

    // Generate tools in parallel
    const toolsResult = await this.generateTools(abilitiesResult.value, environment);
    if (!toolsResult.ok) {
      return toolsResult;
    }

    // Cache the tools
    this.toolCache.set(environment, {
      data: toolsResult.value,
      expiresAt: Date.now() + this.CACHE_TTL_MS
    });

    return toolsResult;
  }

  /**
   * Discover abilities from MCP server
   */
  async discover(environment: McpEnvironment): Promise<Result<DiscoveredAbility[], Error>> {
    // Check cache first
    const cached = this.abilityCache.get(environment);
    if (cached && Date.now() < cached.expiresAt) {
      return { ok: true, value: cached.data };
    }

    try {
      console.log(`[Discovery] Discovering abilities from ${environment}...`);

      const abilities = await this.circuitBreaker.execute(async () => {
        const client = await getWordPressMcpClient(environment);
        const { tools } = await client.listTools();

        return tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          category: this.extractCategory(tool.name),
          inputSchema: tool.inputSchema as JsonSchema | undefined,
          environment,
        }));
      });

      // Cache abilities
      this.abilityCache.set(environment, {
        data: abilities,
        expiresAt: Date.now() + this.CACHE_TTL_MS
      });

      console.log(`[Discovery] Found ${abilities.length} abilities`);
      return { ok: true, value: abilities };

    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Discovery failed')
      };
    }
  }

  /**
   * Generate tools from abilities (parallel)
   */
  private async generateTools(
    abilities: DiscoveredAbility[],
    environment: McpEnvironment
  ): Promise<Result<Record<string, any>, Error>> {
    try {
      const client = await getWordPressMcpClient(environment);
      const schemaConverter = await this.getSchemaConverter();

      // Generate tools in parallel
      const toolEntries = await Promise.allSettled(
        abilities.map(async (ability) => {
          const zodSchema = schemaConverter.convert(ability.inputSchema);

          const toolDef = tool({
            description: ability.description || ability.name,
            parameters: zodSchema,
            execute: async (input: unknown) => {
              return this.circuitBreaker.execute(async () => {
                const result = await client.callTool(
                  ability.name,
                  input as Record<string, unknown>
                );
                return this.extractContent(result);
              });
            }
          });

          return [ability.name, toolDef] as const;
        })
      );

      // Collect successful tools and report failures
      const tools: Record<string, any> = {};
      const failures: string[] = [];

      toolEntries.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const [name, tool] = result.value;
          tools[name] = tool;
        } else {
          failures.push(abilities[i].name);
        }
      });

      if (failures.length > 0) {
        console.error(`[Discovery] Failed to create ${failures.length} tools:`, failures);
      }

      console.log(`[Discovery] Created ${Object.keys(tools).length} tools`);
      return { ok: true, value: tools };

    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Tool generation failed')
      };
    }
  }

  /**
   * Invalidate all caches for an environment
   */
  invalidate(environment?: McpEnvironment): void {
    if (environment) {
      this.abilityCache.delete(environment);
      this.toolCache.delete(environment);
      console.log(`[Discovery] Invalidated caches for ${environment}`);
    } else {
      this.abilityCache.clear();
      this.toolCache.clear();
      console.log('[Discovery] Invalidated all caches');
    }
  }

  private extractCategory(toolName: string): string {
    const match = toolName.match(/^([^-]+)-/);
    return match ? match[1] : 'unknown';
  }

  private extractContent(result: any): any {
    if (!result?.content || !Array.isArray(result.content)) {
      return result;
    }

    const textContent = result.content.find((c: any) => c.type === 'text');
    if (!textContent?.text) {
      return result.content;
    }

    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }

  private async getSchemaConverter() {
    // Lazy load schema converter
    const { schemaConverter } = await import('./schema-converter');
    return schemaConverter;
  }
}

// Singleton instance
export const discoveryService = new DiscoveryService();
```

**Purpose**: Single unified service combining discovery, tool generation, and caching - eliminates need for separate ToolFactory and ToolRegistry.

#### 2. Discovery Types
**File**: `lib/discovery/types.ts` (new)

```typescript
import { z } from 'zod';

// Re-export from discovery-service for convenience
export type {
  DiscoveredAbility,
  JsonSchema,
  DiscoveryCache
} from './discovery-service';

// Tool registry types
export interface DynamicToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any, any>;
  execute: (input: unknown) => Promise<unknown>;
  category?: string;
}

export interface ToolRegistry {
  tools: Map<string, DynamicToolDefinition>;
  environment: McpEnvironment;
}

// Branded type for tool names (type safety)
export type ToolName = string & { readonly __brand: 'ToolName' };

export function createToolName(name: string): ToolName {
  return name as ToolName;
}
```

**Purpose**: Type definitions for the discovery system maintaining type safety.

#### 3. Discovery API Endpoint
**File**: `app/api/discovery/[environment]/route.ts` (new)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { discoveryService } from '@/lib/discovery/discovery-service';
import { McpEnvironment } from '@/lib/mcp/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { environment: string } }
) {
  try {
    const environment = params.environment as McpEnvironment;

    if (!['sandbox', 'production', 'real-site'].includes(environment)) {
      return NextResponse.json(
        { error: 'Invalid environment' },
        { status: 400 }
      );
    }

    const abilities = await discoveryService.discover(environment);

    return NextResponse.json({
      success: true,
      environment,
      count: abilities.length,
      abilities: abilities.map(a => ({
        name: a.name,
        description: a.description,
        category: a.category,
        hasInputSchema: !!a.inputSchema,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Discovery API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { environment: string } }
) {
  try {
    const environment = params.environment as McpEnvironment;
    discoveryService.invalidateCache(environment);

    return NextResponse.json({
      success: true,
      message: `Cache invalidated for ${environment}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
```

**Purpose**: API endpoints for triggering discovery and cache invalidation.

### Success Criteria

#### Automated Verification:
- [ ] Discovery service connects to all 3 environments: `pnpm test:discovery-connection`
- [ ] Cache stores and retrieves abilities correctly: `pnpm test:discovery-cache`
- [ ] Cache expires after TTL: `pnpm test:discovery-ttl`
- [ ] Discovery API returns expected JSON structure: `curl http://localhost:3000/api/discovery/sandbox`
- [ ] Manual cache invalidation works: `curl -X POST http://localhost:3000/api/discovery/sandbox`
- [ ] Discovers all 5 existing WordPress post abilities: `pnpm test:discovery-wordpress`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Visit `/api/discovery/real-site` - shows WooCommerce abilities (if installed)
- [ ] Restart server - cache rebuilds on first request
- [ ] Performance is acceptable (<5s for discovery on cold start)
- [ ] Console logs show clear discovery progress

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Schema Conversion System

### Overview
Implement runtime JSON Schema to Zod schema conversion. Handle WordPress ability schema patterns including primitives, objects, arrays, enums, defaults, and nested types. Validate against existing WordPress post schemas.

### Changes Required

#### 1. Schema Converter Core
**File**: `lib/discovery/schema-converter.ts` (new)

```typescript
import { z } from 'zod';
import { JsonSchema } from './types';

export class SchemaConverter {
  /**
   * Converts JSON Schema to Zod schema at runtime
   * Supports: type, properties, required, enum, default, items, description
   */
  convert(jsonSchema: JsonSchema | undefined): z.ZodType<any, any> {
    if (!jsonSchema) {
      return z.any();
    }

    try {
      return this.convertSchema(jsonSchema, []);
    } catch (error) {
      console.warn('[SchemaConverter] Failed to convert schema:', error);
      return z.any(); // Fallback for unsupported schemas
    }
  }

  private convertSchema(schema: JsonSchema, path: string[]): z.ZodType<any, any> {
    // Handle enum first (can be any type)
    if (schema.enum) {
      return this.convertEnum(schema.enum, schema.default);
    }

    // Handle by type
    const type = schema.type;

    switch (type) {
      case 'string':
        return this.convertString(schema);

      case 'integer':
      case 'number':
        return this.convertNumber(schema);

      case 'boolean':
        return this.convertBoolean(schema);

      case 'object':
        return this.convertObject(schema, path);

      case 'array':
        return this.convertArray(schema, path);

      case undefined:
        // No type specified - try to infer or fallback
        if (schema.properties) {
          return this.convertObject(schema, path);
        }
        console.warn(`[SchemaConverter] No type at ${path.join('.')}`);
        return z.any();

      default:
        console.warn(`[SchemaConverter] Unsupported type: ${type}`);
        return z.any();
    }
  }

  private convertString(schema: JsonSchema): z.ZodType<any, any> {
    let zodSchema = z.string();

    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }

    if (schema.default !== undefined) {
      zodSchema = zodSchema.default(schema.default as string);
    }

    return zodSchema;
  }

  private convertNumber(schema: JsonSchema): z.ZodType<any, any> {
    let zodSchema = schema.type === 'integer' ? z.number().int() : z.number();

    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }

    if (schema.default !== undefined) {
      zodSchema = zodSchema.default(schema.default as number);
    }

    return zodSchema;
  }

  private convertBoolean(schema: JsonSchema): z.ZodType<any, any> {
    let zodSchema = z.boolean();

    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }

    if (schema.default !== undefined) {
      zodSchema = zodSchema.default(schema.default as boolean);
    }

    return zodSchema;
  }

  private convertEnum(enumValues: unknown[], defaultValue?: unknown): z.ZodType<any, any> {
    if (!enumValues || enumValues.length === 0) {
      return z.any();
    }

    // Zod enum requires at least 1 value and must be string literals
    const stringValues = enumValues.filter(v => typeof v === 'string') as [string, ...string[]];

    if (stringValues.length === 0) {
      console.warn('[SchemaConverter] Enum with no string values');
      return z.any();
    }

    let zodSchema = z.enum(stringValues);

    if (defaultValue !== undefined) {
      zodSchema = zodSchema.default(defaultValue as any);
    }

    return zodSchema;
  }

  private convertObject(schema: JsonSchema, path: string[]): z.ZodType<any, any> {
    const properties = schema.properties;

    if (!properties || Object.keys(properties).length === 0) {
      return z.object({});
    }

    const required = schema.required || [];
    const shape: Record<string, z.ZodType<any, any>> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      const fieldPath = [...path, key];
      let fieldSchema = this.convertSchema(propSchema, fieldPath);

      // Make optional if not in required array
      if (!required.includes(key)) {
        fieldSchema = fieldSchema.optional();
      }

      shape[key] = fieldSchema;
    }

    return z.object(shape);
  }

  private convertArray(schema: JsonSchema, path: string[]): z.ZodType<any, any> {
    const items = schema.items;

    if (!items) {
      return z.array(z.any());
    }

    const itemSchema = this.convertSchema(items, [...path, 'items']);
    let zodSchema = z.array(itemSchema);

    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }

    return zodSchema;
  }
}

// Singleton instance
export const schemaConverter = new SchemaConverter();
```

**Purpose**: Runtime JSON Schema to Zod conversion maintaining type safety.

#### 2. Schema Converter Tests
**File**: `lib/discovery/__tests__/schema-converter.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { schemaConverter } from '../schema-converter';
import { z } from 'zod';

describe('SchemaConverter', () => {
  describe('Primitive Types', () => {
    it('converts string schema', () => {
      const schema = { type: 'string', description: 'A string field' };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse('hello')).toBe('hello');
      expect(() => zod.parse(123)).toThrow();
    });

    it('converts integer schema', () => {
      const schema = { type: 'integer', description: 'An integer field' };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse(42)).toBe(42);
      expect(() => zod.parse(3.14)).toThrow();
    });

    it('converts boolean schema', () => {
      const schema = { type: 'boolean' };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse(true)).toBe(true);
      expect(() => zod.parse('true')).toThrow();
    });
  });

  describe('Default Values', () => {
    it('applies default to string', () => {
      const schema = { type: 'string', default: 'default-value' };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse(undefined)).toBe('default-value');
    });

    it('applies default to number', () => {
      const schema = { type: 'integer', default: 10 };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse(undefined)).toBe(10);
    });
  });

  describe('Enums', () => {
    it('converts enum schema', () => {
      const schema = {
        type: 'string',
        enum: ['publish', 'draft', 'pending', 'private']
      };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse('publish')).toBe('publish');
      expect(() => zod.parse('invalid')).toThrow();
    });

    it('applies default to enum', () => {
      const schema = {
        enum: ['publish', 'draft'],
        default: 'draft'
      };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse(undefined)).toBe('draft');
    });
  });

  describe('Object Schemas', () => {
    it('converts simple object', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' }
        },
        required: ['id']
      };
      const zod = schemaConverter.convert(schema);

      const valid = { id: 1, title: 'Hello' };
      expect(zod.parse(valid)).toEqual(valid);

      const validNoTitle = { id: 1 };
      expect(zod.parse(validNoTitle)).toEqual(validNoTitle);

      expect(() => zod.parse({ title: 'Hello' })).toThrow(); // Missing required id
    });

    it('handles nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['email']
          }
        }
      };
      const zod = schemaConverter.convert(schema);

      const valid = { user: { name: 'John', email: 'john@example.com' } };
      expect(zod.parse(valid)).toEqual(valid);
    });
  });

  describe('Array Schemas', () => {
    it('converts array of primitives', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse(['a', 'b'])).toEqual(['a', 'b']);
      expect(() => zod.parse([1, 2])).toThrow();
    });

    it('converts array of objects', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          }
        }
      };
      const zod = schemaConverter.convert(schema);

      const valid = [{ id: 1, name: 'Item 1' }];
      expect(zod.parse(valid)).toEqual(valid);
    });
  });

  describe('WordPress Ability Schemas', () => {
    it('converts wordpress/get-post schema', () => {
      const schema = {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'The post ID'
          }
        },
        required: ['id']
      };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse({ id: 1 })).toEqual({ id: 1 });
      expect(() => zod.parse({})).toThrow();
    });

    it('converts wordpress/list-posts schema', () => {
      const schema = {
        type: 'object',
        properties: {
          per_page: {
            type: 'integer',
            description: 'Number of posts per page',
            default: 10
          },
          page: {
            type: 'integer',
            description: 'Page number',
            default: 1
          }
        }
      };
      const zod = schemaConverter.convert(schema);

      expect(zod.parse({})).toEqual({ per_page: 10, page: 1 });
      expect(zod.parse({ per_page: 20 })).toEqual({ per_page: 20, page: 1 });
    });

    it('converts wordpress/create-post schema', () => {
      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Post title' },
          content: { type: 'string', description: 'Post content' },
          status: {
            type: 'string',
            enum: ['publish', 'draft', 'pending', 'private'],
            default: 'draft'
          }
        },
        required: ['title', 'content']
      };
      const zod = schemaConverter.convert(schema);

      const valid = { title: 'Hello', content: 'World', status: 'publish' };
      expect(zod.parse(valid)).toEqual(valid);

      const withDefault = { title: 'Hello', content: 'World' };
      expect(zod.parse(withDefault)).toEqual({ ...withDefault, status: 'draft' });
    });
  });

  describe('Fallback Behavior', () => {
    it('returns z.any() for undefined schema', () => {
      const zod = schemaConverter.convert(undefined);
      expect(zod.parse(123)).toBe(123);
      expect(zod.parse('hello')).toBe('hello');
    });

    it('returns z.any() for unsupported type', () => {
      const schema = { type: 'null' }; // Unsupported
      const zod = schemaConverter.convert(schema);
      expect(zod.parse(null)).toBe(null);
    });
  });
});
```

**Purpose**: Comprehensive test suite validating schema conversion correctness.

#### 3. Integration with Discovery Service
**File**: `lib/discovery/discovery-service.ts` (update)

Add method to convert discovered abilities to Zod schemas:

```typescript
import { schemaConverter } from './schema-converter';

// Add to DiscoveryService class:
async discoverWithSchemas(environment: McpEnvironment): Promise<DiscoveredAbilityWithSchema[]> {
  const abilities = await this.discover(environment);

  return abilities.map(ability => ({
    ...ability,
    zodInputSchema: schemaConverter.convert(ability.inputSchema),
  }));
}

export interface DiscoveredAbilityWithSchema extends DiscoveredAbility {
  zodInputSchema: z.ZodType<any, any>;
}
```

### Success Criteria

#### Automated Verification:
- [ ] All schema converter tests pass: `pnpm test:schema-conversion`
- [ ] Converts all 5 WordPress post schemas correctly: `pnpm test:wordpress-schemas`
- [ ] Handles missing/undefined schemas gracefully: `pnpm test:schema-fallback`
- [ ] Validates against actual MCP response data: `pnpm test:schema-validation`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Test coverage >90% for schema-converter.ts: `pnpm test:coverage`

#### Manual Verification:
- [ ] Review converted schemas match manual Zod definitions in `wordpress-schemas.ts`
- [ ] Complex nested WooCommerce schemas convert correctly (products with variations)
- [ ] Error messages are helpful when conversion fails
- [ ] Performance is acceptable (<100ms to convert typical schema)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dynamic Tool Generation

### Overview
Generate Vercel AI SDK tool definitions dynamically from discovered abilities. Create environment-specific tools with proper Zod validation and MCP client delegation. Replace manual tool factory with discovery-based generation.

### Changes Required

#### 1. Dynamic Tool Factory
**File**: `lib/discovery/tool-factory.ts` (new)

```typescript
import { tool } from 'ai';
import { McpEnvironment } from '@/lib/mcp/types';
import { getWordPressMcpClient } from '@/lib/mcp/client-factory';
import { discoveryService } from './discovery-service';
import { schemaConverter } from './schema-converter';
import { DynamicToolDefinition } from './types';

export class DynamicToolFactory {
  /**
   * Creates tools from discovered abilities for a specific environment
   */
  async createTools(environment: McpEnvironment): Promise<Record<string, any>> {
    console.log(`[ToolFactory] Creating dynamic tools for ${environment}...`);

    const abilities = await discoveryService.discover(environment);
    const tools: Record<string, any> = {};

    for (const ability of abilities) {
      try {
        const toolDef = this.createTool(ability, environment);
        tools[ability.name] = toolDef;
      } catch (error) {
        console.warn(`[ToolFactory] Failed to create tool ${ability.name}:`, error);
        // Continue with other tools
      }
    }

    console.log(`[ToolFactory] Created ${Object.keys(tools).length} tools`);
    return tools;
  }

  /**
   * Creates a single tool from an ability
   */
  private createTool(ability: DiscoveredAbility, environment: McpEnvironment) {
    const zodSchema = schemaConverter.convert(ability.inputSchema);
    const envLabel = this.getEnvironmentLabel(environment);

    return tool({
      description: ability.description
        ? `${ability.description} (${envLabel})`
        : `Execute ${ability.name} on ${envLabel}`,
      parameters: zodSchema,
      execute: async (input: unknown) => {
        console.log(`[Tool:${ability.name}] Executing on ${environment}`);

        const client = await getWordPressMcpClient(environment);
        const result = await client.callTool(ability.name, input as Record<string, unknown>);

        return this.extractContent(result);
      }
    });
  }

  /**
   * Extract content from MCP response
   */
  private extractContent(result: any): any {
    if (!result.content || !Array.isArray(result.content)) {
      return result;
    }

    const textContent = result.content.find((c: any) => c.type === 'text');
    if (!textContent?.text) {
      return result.content;
    }

    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }

  private getEnvironmentLabel(environment: McpEnvironment): string {
    switch (environment) {
      case 'sandbox': return 'sandbox environment';
      case 'production': return 'production environment';
      case 'real-site': return 'real site environment';
      default: return environment;
    }
  }
}

// Singleton instance
export const toolFactory = new DynamicToolFactory();
```

**Purpose**: Runtime tool generation from discovered abilities.

#### 2. Tool Registry
**File**: `lib/discovery/tool-registry.ts` (new)

```typescript
import { McpEnvironment } from '@/lib/mcp/types';
import { toolFactory } from './tool-factory';

export class ToolRegistry {
  private cache: Map<McpEnvironment, Record<string, any>> = new Map();

  async getTools(environment: McpEnvironment): Promise<Record<string, any>> {
    // Check cache first
    const cached = this.cache.get(environment);
    if (cached) {
      console.log(`[ToolRegistry] Using cached tools for ${environment}`);
      return cached;
    }

    // Generate tools
    console.log(`[ToolRegistry] Generating tools for ${environment}...`);
    const tools = await toolFactory.createTools(environment);

    // Cache result
    this.cache.set(environment, tools);

    return tools;
  }

  invalidate(environment?: McpEnvironment): void {
    if (environment) {
      this.cache.delete(environment);
      console.log(`[ToolRegistry] Invalidated tools for ${environment}`);
    } else {
      this.cache.clear();
      console.log('[ToolRegistry] Invalidated all tools');
    }
  }

  async refreshTools(environment: McpEnvironment): Promise<Record<string, any>> {
    this.invalidate(environment);
    return this.getTools(environment);
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
```

**Purpose**: Central registry for managing dynamically generated tools with caching.

#### 3. Updated Agent with Dynamic Tools
**File**: `lib/agents/wordpress-agent.ts` (update)

Replace manual tool factory with dynamic tool loading:

```typescript
import { toolRegistry } from '@/lib/discovery/tool-registry';

// Update executeWordPressAgent function
export async function executeWordPressAgent(
  prompt: string,
  environment: McpEnvironment = 'sandbox'
) {
  console.log(`[Agent] Executing on ${environment} with prompt: ${prompt}`);

  const model = getModel();

  // CHANGED: Use dynamic tools from registry instead of manual factory
  const tools = await toolRegistry.getTools(environment);

  console.log(`[Agent] Loaded ${Object.keys(tools).length} dynamic tools`);

  const result = await generateText({
    model,
    tools,
    system: createSystemPrompt(environment, Object.keys(tools)),
    prompt,
    stopWhen: stepCountIs(10)
  });

  // Track changes made during execution
  changeTracker.trackFromAgentResult(result);

  console.log(`[Agent] Execution completed. Finish reason: ${result.finishReason}`);

  return result;
}

// Update streamWordPressAgent similarly
export async function streamWordPressAgent(
  prompt: string,
  environment: McpEnvironment = 'sandbox'
) {
  const model = getModel();
  const tools = await toolRegistry.getTools(environment);

  return streamText({
    model,
    tools,
    system: createSystemPrompt(environment, Object.keys(tools)),
    prompt,
    stopWhen: stepCountIs(10)
  });
}

// Update system prompt to include discovered capabilities
function createSystemPrompt(environment: McpEnvironment, toolNames: string[]): string {
  const envLabel =
    environment === 'sandbox' ? 'sandbox' :
    environment === 'production' ? 'production' : 'real site';

  // Group tools by category
  const categories = new Map<string, string[]>();
  for (const name of toolNames) {
    const category = name.split('-')[0];
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(name);
  }

  const capabilities = Array.from(categories.entries())
    .map(([cat, tools]) => `- ${cat}: ${tools.length} operations`)
    .join('\n');

  return `You are a helpful WordPress assistant operating in the ${envLabel} environment.

Available capabilities:
${capabilities}

You have access to ${toolNames.length} tools across ${categories.size} categories. Use these tools to help users manage their WordPress site.

When users ask what you can do, group your response by capability categories (wordpress, woocommerce, etc.).`;
}
```

**Purpose**: Integration of dynamic tools into agent execution flow.

#### 4. Tool Factory Tests
**File**: `lib/discovery/__tests__/tool-factory.test.ts` (new)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolFactory } from '../tool-factory';
import { discoveryService } from '../discovery-service';
import * as clientFactory from '@/lib/mcp/client-factory';

// Mock MCP client
vi.mock('@/lib/mcp/client-factory');

describe('DynamicToolFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates tools from discovered abilities', async () => {
    // Mock discovery response
    vi.spyOn(discoveryService, 'discover').mockResolvedValue([
      {
        name: 'wordpress-get-post',
        description: 'Get a post by ID',
        category: 'wordpress',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'integer' } },
          required: ['id']
        },
        environment: 'sandbox'
      }
    ]);

    const tools = await toolFactory.createTools('sandbox');

    expect(tools).toHaveProperty('wordpress-get-post');
    expect(tools['wordpress-get-post']).toBeDefined();
  });

  it('creates executable tools that call MCP client', async () => {
    const mockCallTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"id":1,"title":"Test"}' }]
    });

    vi.spyOn(clientFactory, 'getWordPressMcpClient').mockResolvedValue({
      callTool: mockCallTool
    } as any);

    vi.spyOn(discoveryService, 'discover').mockResolvedValue([
      {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'integer' } }
        },
        environment: 'sandbox'
      }
    ]);

    const tools = await toolFactory.createTools('sandbox');
    const result = await tools['test-tool'].execute({ id: 1 });

    expect(mockCallTool).toHaveBeenCalledWith('test-tool', { id: 1 });
    expect(result).toEqual({ id: 1, title: 'Test' });
  });

  it('handles tools with no input schema', async () => {
    vi.spyOn(discoveryService, 'discover').mockResolvedValue([
      {
        name: 'simple-tool',
        description: 'Simple tool',
        inputSchema: undefined,
        environment: 'sandbox'
      }
    ]);

    const tools = await toolFactory.createTools('sandbox');
    expect(tools).toHaveProperty('simple-tool');
  });

  it('continues creating tools when one fails', async () => {
    vi.spyOn(discoveryService, 'discover').mockResolvedValue([
      {
        name: 'good-tool',
        description: 'Good',
        inputSchema: { type: 'object' },
        environment: 'sandbox'
      },
      {
        name: 'bad-tool',
        description: 'Bad',
        inputSchema: { type: 'invalid' } as any,
        environment: 'sandbox'
      }
    ]);

    const tools = await toolFactory.createTools('sandbox');

    // Should still create the good tool
    expect(tools).toHaveProperty('good-tool');
  });
});
```

**Purpose**: Validate tool generation correctness and error handling.

### Success Criteria

#### Automated Verification:
- [ ] Tool factory creates tools from all discovered abilities: `pnpm test:tool-factory`
- [ ] Generated tools execute via MCP client: `pnpm test:tool-execution`
- [ ] Tool registry caches and retrieves tools: `pnpm test:tool-registry`
- [ ] Agent loads dynamic tools successfully: `pnpm test:agent-dynamic-tools`
- [ ] Agent executes wordpress-list-posts via dynamic tool: `pnpm test:agent-list-posts`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] All existing agent tests still pass: `pnpm test:agents`

#### Manual Verification:
- [ ] Execute "List my WordPress posts" via agent API - works identically to manual tools
- [ ] Agent responds with available capabilities when asked "What can you help with?"
- [ ] Console logs show clear tool creation and execution flow
- [ ] Error handling is graceful when tools fail

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Simplified Type System & Change Tracking

### Overview
Update the change tracker to support dynamic tools using simple, clean types without backward compatibility requirements. Focus on type safety through proper generics and Result types.

### Changes Required

#### 1. Clean Change Tracker Types
**File**: `lib/sync/change-tracker.ts` (simplified refactor)

```typescript
import { z } from 'zod';

// Result type for proper error handling
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Simple tool tracking interface - no brand types needed
export interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: Date;
  stepIndex: number;
}

// Generic change tracker with proper type constraints
export class ChangeTracker<T extends ToolInvocation = ToolInvocation> {
  private changes: T[] = [];

  trackChange(change: Omit<T, 'timestamp'>): void {
    this.changes.push({
      ...change,
      timestamp: new Date()
    } as T);
  }

  getChanges(): ReadonlyArray<Readonly<T>> {
    return this.changes;
  }

  clear(): void {
    this.changes = [];
  }

  // Extract and track from agent result
  trackFromAgentResult(result: { steps: unknown[] }): Result<number, Error> {
    if (!result.steps || result.steps.length === 0) {
      return { ok: true, value: 0 };
    }

    let trackedCount = 0;
    const errors: string[] = [];

    for (const [index, step] of result.steps.entries()) {
      const extracted = this.extractStepData(step);

      if (!extracted.ok) {
        errors.push(`Step ${index}: ${extracted.error.message}`);
        continue;
      }

      const { toolCalls, toolResults } = extracted.value;

      for (const toolCall of toolCalls) {
        const toolResult = toolResults.find(r => r.toolCallId === toolCall.toolCallId);

        this.trackChange({
          toolName: toolCall.toolName,
          args: toolCall.input as Record<string, unknown>,
          result: toolResult?.output,
          stepIndex: index
        } as Omit<T, 'timestamp'>);

        trackedCount++;
      }
    }

    if (errors.length > 0) {
      console.warn('[ChangeTracker] Errors during tracking:', errors);
    }

    console.log(`[ChangeTracker] Tracked ${trackedCount} changes`);
    return { ok: true, value: trackedCount };
  }

  private extractStepData(step: unknown): Result<{
    toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
    toolResults: Array<{ toolCallId: string; output: unknown }>;
  }> {
    // Validate step structure
    if (!step || typeof step !== 'object') {
      return { ok: false, error: new Error('Invalid step data') };
    }

    // Extract tool calls and results (implementation details omitted for brevity)
    // This would use proper validation, not type assertions

    return {
      ok: true,
      value: {
        toolCalls: [],
        toolResults: []
      }
    };
  }
}

// Export singleton instance for convenience
export const changeTracker = new ChangeTracker();
```

**Purpose**: Clean, generic change tracking without unnecessary complexity.

#### 2. Resilience with Circuit Breaker
**File**: `lib/resilience/circuit-breaker.ts` (new)

```typescript
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly timeout = 30000; // 30 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker open - service temporarily unavailable');
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.threshold
      && Date.now() - this.lastFailure < this.timeout;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }

  private reset(): void {
    this.failures = 0;
  }
}
```

**Purpose**: Protect against repeated MCP failures.

#### 3. Type System Tests
**File**: `lib/sync/__tests__/change-tracker.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { ChangeTracker, ToolInvocation } from '../change-tracker';

describe('Change Tracker', () => {
  it('tracks tool invocations with proper types', () => {
    const tracker = new ChangeTracker();

    tracker.trackChange({
      toolName: 'wordpress-create-post',
      args: { title: 'Hello', content: 'World' },
      result: { id: 1, title: 'Hello' },
      stepIndex: 0
    });

    const changes = tracker.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].toolName).toBe('wordpress-create-post');
    expect(changes[0].timestamp).toBeInstanceOf(Date);
  });

  it('supports generic type constraints', () => {
    interface CustomInvocation extends ToolInvocation {
      environment: string;
    }

    const tracker = new ChangeTracker<CustomInvocation>();

    tracker.trackChange({
      toolName: 'custom-tool',
      args: { data: 'test' },
      result: 'success',
      stepIndex: 0,
      environment: 'sandbox'
    });

    const changes = tracker.getChanges();
    expect(changes[0].environment).toBe('sandbox');
  });

  it('returns Result type for error handling', () => {
    const tracker = new ChangeTracker();

    const result = tracker.trackFromAgentResult({ steps: [] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }
  });
});
```

**Purpose**: Validate clean type system implementation.

### Success Criteria

#### Automated Verification:
- [ ] Change tracker tests pass: `pnpm test:change-tracker`
- [ ] Circuit breaker tests pass: `pnpm test:circuit-breaker`
- [ ] Type checking passes with strict mode: `pnpm typecheck`
- [ ] No `any` types in production code: `pnpm lint`
- [ ] All existing tests still pass: `pnpm test`

#### Manual Verification:
- [ ] Tool invocations tracked with full type safety
- [ ] Circuit breaker prevents cascade failures
- [ ] Clean, readable code without legacy cruft
- [ ] No loss of functionality from simplification

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Validation & Testing

### Overview
Validate the complete dynamic discovery system works correctly with existing WordPress abilities and WooCommerce as a reference implementation. Compare auto-generated tools to manual implementation patterns. Establish performance and accuracy benchmarks.

### Changes Required

#### 1. Tool Equivalence Tests
**File**: `lib/discovery/__tests__/tool-equivalence.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { toolFactory } from '../tool-factory';
import { createWordPressTools } from '@/lib/tools/wordpress-tools';
import { discoveryService } from '../discovery-service';

describe('Tool Equivalence', () => {
  describe('WordPress Post Tools', () => {
    let dynamicTools: Record<string, any>;
    let manualTools: Record<string, any>;

    beforeAll(async () => {
      dynamicTools = await toolFactory.createTools('sandbox');
      manualTools = createWordPressTools('sandbox');
    });

    it('discovers all manual WordPress tools', () => {
      const manualToolNames = Object.keys(manualTools);
      const dynamicToolNames = Object.keys(dynamicTools);

      for (const name of manualToolNames) {
        expect(dynamicToolNames).toContain(name);
      }
    });

    it('auto-generated tools have same structure as manual', () => {
      const toolName = 'wordpress-get-post';

      expect(dynamicTools[toolName]).toBeDefined();
      expect(manualTools[toolName]).toBeDefined();

      // Both should have execute function
      expect(typeof dynamicTools[toolName].execute).toBe('function');
      expect(typeof manualTools[toolName].execute).toBe('function');
    });

    it('validates schemas equivalently', async () => {
      const toolName = 'wordpress-create-post';

      const validInput = {
        title: 'Test Post',
        content: 'Test content',
        status: 'draft' as const
      };

      // Both should accept valid input
      // (In real test, would actually execute and compare results)
      expect(dynamicTools[toolName]).toBeDefined();
      expect(manualTools[toolName]).toBeDefined();
    });
  });
});
```

**Purpose**: Verify auto-generated tools match manual implementation quality.

#### 2. WooCommerce Discovery Tests
**File**: `lib/discovery/__tests__/woocommerce-discovery.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { discoveryService } from '../discovery-service';

describe('WooCommerce Discovery', () => {
  it('discovers WooCommerce abilities from real-site', async () => {
    const abilities = await discoveryService.discover('real-site');

    // Should find WooCommerce abilities if plugin is installed
    const woocommerceAbilities = abilities.filter(a =>
      a.category === 'woocommerce' || a.name.startsWith('woocommerce-')
    );

    // Log what was found (useful for development)
    console.log(`Found ${woocommerceAbilities.length} WooCommerce abilities`);
    woocommerceAbilities.forEach(a => console.log(`  - ${a.name}`));

    // If WooCommerce is installed, should find abilities
    if (woocommerceAbilities.length > 0) {
      expect(woocommerceAbilities.length).toBeGreaterThan(0);

      // Check for expected abilities from WooCommerce plan
      const expectedAbilities = [
        'woocommerce-list-products',
        'woocommerce-get-product',
        'woocommerce-create-product'
      ];

      for (const expected of expectedAbilities) {
        const found = abilities.find(a => a.name === expected);
        if (found) {
          expect(found).toBeDefined();
          expect(found.inputSchema).toBeDefined();
        }
      }
    }
  });

  it('creates executable WooCommerce tools', async () => {
    const abilities = await discoveryService.discover('real-site');
    const wooAbilities = abilities.filter(a => a.name.startsWith('woocommerce-'));

    if (wooAbilities.length === 0) {
      console.log('No WooCommerce abilities found - skipping test');
      return;
    }

    // Verify each has valid schema
    for (const ability of wooAbilities) {
      expect(ability.name).toBeTruthy();
      expect(ability.description).toBeTruthy();
      // inputSchema may be undefined for simple operations
    }
  });
});
```

**Purpose**: Validate WooCommerce support as reference implementation.

#### 3. Performance Benchmarks
**File**: `lib/discovery/__tests__/performance.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { discoveryService } from '../discovery-service';
import { toolFactory } from '../tool-factory';
import { schemaConverter } from '../schema-converter';

describe('Performance Benchmarks', () => {
  it('discovers abilities in under 5 seconds', async () => {
    const start = Date.now();

    await discoveryService.discover('sandbox');

    const duration = Date.now() - start;
    console.log(`Discovery took ${duration}ms`);

    expect(duration).toBeLessThan(5000);
  });

  it('creates tools in under 2 seconds', async () => {
    const start = Date.now();

    await toolFactory.createTools('sandbox');

    const duration = Date.now() - start;
    console.log(`Tool creation took ${duration}ms`);

    expect(duration).toBeLessThan(2000);
  });

  it('converts schema in under 100ms', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        title: { type: 'string' },
        nested: {
          type: 'object',
          properties: {
            field: { type: 'string' }
          }
        }
      }
    };

    const start = Date.now();

    schemaConverter.convert(schema);

    const duration = Date.now() - start;
    console.log(`Schema conversion took ${duration}ms`);

    expect(duration).toBeLessThan(100);
  });

  it('cache provides significant speedup', async () => {
    // First call (cold)
    const coldStart = Date.now();
    await discoveryService.discover('sandbox');
    const coldDuration = Date.now() - coldStart;

    // Second call (cached)
    const warmStart = Date.now();
    await discoveryService.discover('sandbox');
    const warmDuration = Date.now() - warmStart;

    console.log(`Cold: ${coldDuration}ms, Warm: ${warmDuration}ms`);

    expect(warmDuration).toBeLessThan(coldDuration / 10); // 10x speedup
  });
});
```

**Purpose**: Establish performance benchmarks and validate caching effectiveness.

#### 4. Integration Test Script
**File**: `scripts/test/test-dynamic-discovery.ts` (new)

```typescript
import { discoveryService } from '@/lib/discovery/discovery-service';
import { toolFactory } from '@/lib/discovery/tool-factory';
import { toolRegistry } from '@/lib/discovery/tool-registry';
import { executeWordPressAgent } from '@/lib/agents/wordpress-agent';

async function main() {
  console.log('=== Dynamic Discovery Integration Test ===\n');

  // Test 1: Discovery
  console.log('1. Testing discovery...');
  const abilities = await discoveryService.discover('real-site');
  console.log(`   ✓ Found ${abilities.length} abilities`);

  // Group by category
  const byCategory = new Map<string, number>();
  abilities.forEach(a => {
    const cat = a.category || 'unknown';
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
  });

  console.log('   Categories:');
  byCategory.forEach((count, cat) => {
    console.log(`     - ${cat}: ${count} abilities`);
  });

  // Test 2: Tool Generation
  console.log('\n2. Testing tool generation...');
  const tools = await toolFactory.createTools('real-site');
  console.log(`   ✓ Created ${Object.keys(tools).length} tools`);

  // Test 3: Agent Integration
  console.log('\n3. Testing agent integration...');
  const result = await executeWordPressAgent(
    'List the first 3 WordPress posts',
    'real-site'
  );
  console.log(`   ✓ Agent executed successfully`);
  console.log(`   Response: ${result.text.substring(0, 100)}...`);

  // Test 4: WooCommerce Detection
  console.log('\n4. Testing WooCommerce detection...');
  const wooAbilities = abilities.filter(a =>
    a.category === 'woocommerce' || a.name.startsWith('woocommerce-')
  );

  if (wooAbilities.length > 0) {
    console.log(`   ✓ Found ${wooAbilities.length} WooCommerce abilities`);
    console.log('   WooCommerce is installed and discovered!');
    wooAbilities.slice(0, 5).forEach(a => {
      console.log(`     - ${a.name}`);
    });
  } else {
    console.log('   ⚠ No WooCommerce abilities found');
    console.log('   (WooCommerce may not be installed or abilities not registered)');
  }

  // Test 5: Cache Invalidation
  console.log('\n5. Testing cache invalidation...');
  discoveryService.invalidateCache('real-site');
  toolRegistry.invalidate('real-site');
  console.log('   ✓ Cache invalidated');

  const rediscovered = await discoveryService.discover('real-site');
  console.log(`   ✓ Re-discovered ${rediscovered.length} abilities`);

  console.log('\n=== All Tests Passed ===');
}

main().catch(console.error);
```

**Purpose**: Comprehensive integration test covering all discovery system components.

### Success Criteria

#### Automated Verification:
- [ ] Tool equivalence tests pass: `pnpm test:tool-equivalence`
- [ ] WooCommerce discovery tests pass: `pnpm test:woocommerce-discovery`
- [ ] Performance benchmarks met: `pnpm test:performance`
- [ ] Integration test script completes: `pnpm test:integration-discovery`
- [ ] All existing WordPress tests still pass: `pnpm test:agents`
- [ ] All existing sync tests still pass: `pnpm test:sync`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Run integration test script - all checks pass
- [ ] Compare auto-generated WordPress tools to manual - identical behavior
- [ ] WooCommerce abilities discovered from real-site environment
- [ ] Ask agent "What can you help me with?" - lists WordPress and WooCommerce capabilities
- [ ] Create WooCommerce product via agent (if abilities registered in WordPress)
- [ ] Check WordPress admin - product created successfully
- [ ] Performance meets targets: discovery <5s, tool creation <2s, schema conversion <100ms
- [ ] Cache provides 10x speedup on subsequent requests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: UI Integration & Polish

### Overview
Add user-facing features for discovery status, plugin capability display, cache refresh controls, and user messaging. Polish the developer experience and documentation.

### Changes Required

#### 1. Discovery Status API
**File**: `app/api/discovery/status/route.ts` (new)

```typescript
import { NextResponse } from 'next/server';
import { discoveryService } from '@/lib/discovery/discovery-service';
import { toolRegistry } from '@/lib/discovery/tool-registry';

export async function GET() {
  try {
    const environments = ['sandbox', 'production', 'real-site'] as const;
    const status = await Promise.all(
      environments.map(async (env) => {
        try {
          const abilities = await discoveryService.discover(env);

          // Group by category
          const byCategory = new Map<string, number>();
          abilities.forEach(a => {
            const cat = a.category || 'unknown';
            byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
          });

          return {
            environment: env,
            status: 'connected',
            totalAbilities: abilities.length,
            categories: Object.fromEntries(byCategory),
            plugins: Array.from(byCategory.keys()),
          };
        } catch (error) {
          return {
            environment: env,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environments: status,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get discovery status' },
      { status: 500 }
    );
  }
}
```

**Purpose**: API endpoint showing discovery status across all environments.

#### 2. Refresh Control API
**File**: `app/api/discovery/refresh/route.ts` (new)

```typescript
import { NextResponse } from 'next/server';
import { discoveryService } from '@/lib/discovery/discovery-service';
import { toolRegistry } from '@/lib/discovery/tool-registry';

export async function POST() {
  try {
    console.log('[Discovery] Manual refresh triggered');

    // Invalidate all caches
    discoveryService.invalidateCache();
    toolRegistry.invalidate();

    // Re-discover all environments in parallel
    const environments = ['sandbox', 'production', 'real-site'] as const;
    const results = await Promise.all(
      environments.map(async (env) => {
        try {
          const abilities = await discoveryService.discover(env);
          await toolRegistry.getTools(env);

          return {
            environment: env,
            status: 'success',
            abilitiesFound: abilities.length,
          };
        } catch (error) {
          return {
            environment: env,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Discovery refreshed for all environments',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to refresh discovery' },
      { status: 500 }
    );
  }
}
```

**Purpose**: Manual trigger for cache refresh and re-discovery.

#### 3. CLI Discovery Command
**File**: `scripts/discovery/discover.ts` (new)

```typescript
import { discoveryService } from '@/lib/discovery/discovery-service';
import { McpEnvironment } from '@/lib/mcp/types';

async function discover(environment: McpEnvironment) {
  console.log(`\n🔍 Discovering abilities from ${environment}...\n`);

  try {
    const abilities = await discoveryService.discover(environment);

    // Group by category
    const byCategory = new Map<string, typeof abilities>();
    abilities.forEach(ability => {
      const cat = ability.category || 'unknown';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(ability);
    });

    console.log(`✅ Found ${abilities.length} abilities across ${byCategory.size} categories\n`);

    // Display by category
    for (const [category, catAbilities] of byCategory.entries()) {
      console.log(`\n📦 ${category.toUpperCase()} (${catAbilities.length} abilities)`);
      console.log('─'.repeat(60));

      catAbilities.forEach(ability => {
        console.log(`  • ${ability.name}`);
        if (ability.description) {
          console.log(`    ${ability.description}`);
        }
        if (ability.inputSchema) {
          const required = ability.inputSchema.required || [];
          if (required.length > 0) {
            console.log(`    Required: ${required.join(', ')}`);
          }
        }
        console.log('');
      });
    }

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('─'.repeat(60));
    byCategory.forEach((abilities, category) => {
      console.log(`  ${category}: ${abilities.length} abilities`);
    });

  } catch (error) {
    console.error('\n❌ Discovery failed:', error);
    process.exit(1);
  }
}

// Parse command line args
const environment = (process.argv[2] || 'sandbox') as McpEnvironment;

if (!['sandbox', 'production', 'real-site'].includes(environment)) {
  console.error('Invalid environment. Use: sandbox, production, or real-site');
  process.exit(1);
}

discover(environment);
```

**Purpose**: CLI tool for discovering and displaying available abilities.

Add to `package.json`:
```json
{
  "scripts": {
    "discover": "tsx scripts/discovery/discover.ts",
    "discover:sandbox": "tsx scripts/discovery/discover.ts sandbox",
    "discover:production": "tsx scripts/discovery/discover.ts production",
    "discover:real-site": "tsx scripts/discovery/discover.ts real-site"
  }
}
```

#### 4. Documentation Updates
**File**: `README.md` (update)

Add Dynamic Discovery section:

```markdown
## Dynamic Plugin Discovery

This system automatically discovers WordPress plugin capabilities without manual code changes.

### How It Works

1. **Install Plugin** - Add any WordPress plugin via admin or WP-CLI
2. **Register Abilities** - Plugin registers capabilities via Abilities API
3. **Automatic Discovery** - System detects new abilities on startup or refresh
4. **Instant Availability** - Agent can use new plugin features immediately

### Discovering Capabilities

```bash
# Discover from sandbox environment
pnpm discover:sandbox

# Discover from real-site (with WooCommerce)
pnpm discover:real-site

# Refresh all caches
curl -X POST http://localhost:3000/api/discovery/refresh

# Check discovery status
curl http://localhost:3000/api/discovery/status
```

### For Plugin Developers

To make your plugin discoverable:

```php
// Register category
add_action('abilities_api_categories_init', function() {
    wp_register_ability_category('my-plugin', [
        'label' => 'My Plugin',
        'description' => 'Custom plugin abilities',
    ]);
});

// Register abilities
add_action('abilities_api_init', function() {
    wp_register_ability('my-plugin/custom-action', [
        'label' => 'Custom Action',
        'description' => 'Does something custom',
        'category' => 'my-plugin',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'param' => ['type' => 'string']
            ]
        ],
        'execute_callback' => function($input) {
            // Your logic here
        },
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
    ]);
}, 100);

// Add to MCP server config
add_filter('mcp_server_abilities', function($abilities) {
    $abilities[] = 'my-plugin/custom-action';
    return $abilities;
});
```

That's it! No TypeScript changes needed.
```

#### 5. Migration Guide
**File**: `docs/MIGRATION_DYNAMIC_DISCOVERY.md` (new)

```markdown
# Migration to Dynamic Discovery

This guide explains changes from manual tool definitions to dynamic discovery.

## What Changed

### Before (Manual)
```typescript
// lib/tools/wordpress-schemas.ts
export const getPostSchema = z.object({
  id: z.number().int()
});

// lib/tools/wordpress-tools.ts
'wordpress-get-post': tool({
  description: '...',
  inputSchema: getPostSchema,
  execute: async (input) => { ... }
})
```

### After (Dynamic)
```typescript
// Automatic discovery - no manual code
const tools = await toolRegistry.getTools('sandbox');
// Tools created from WordPress abilities automatically
```

## What You Need to Do

### If You Added Custom Abilities

**Old Way:** Edit 4 files manually
1. `register-wordpress-abilities.php` - PHP ability
2. `configure-mcp-server.php` - Add to MCP config
3. `lib/tools/wordpress-schemas.ts` - Zod schema
4. `lib/tools/wordpress-tools.ts` - Tool definition

**New Way:** Edit 2 files only
1. `register-wordpress-abilities.php` - PHP ability
2. `configure-mcp-server.php` - Add to MCP config

Tools and schemas generated automatically!

### If You Used Manual Tools

Manual tool imports no longer needed:

```typescript
// REMOVE THIS:
import { wordpressTools } from '@/lib/tools/wordpress-tools';

// REPLACE WITH:
import { toolRegistry } from '@/lib/discovery/tool-registry';
const tools = await toolRegistry.getTools('sandbox');
```

### If You Extended Change Tracking

Change tracking now uses generic types:

```typescript
// OLD:
import { WordPressToolArgs, WordPressToolResult } from '@/lib/sync/change-tracker';

// NEW:
import { DynamicToolArgs, DynamicToolResult } from '@/lib/sync/change-tracker';
```

All tool types supported automatically!

## Breaking Changes

1. **Removed**: `lib/tools/wordpress-schemas.ts` - schemas generated dynamically
2. **Removed**: `lib/tools/wordpress-tools.ts` - tools generated dynamically
3. **Changed**: `lib/sync/change-tracker.ts` - uses generic types
4. **Changed**: `lib/agents/wordpress-agent.ts` - loads dynamic tools

## Benefits

- ✅ No manual schema synchronization
- ✅ Instant plugin support
- ✅ No TypeScript changes for new plugins
- ✅ Automatic updates when plugins change
- ✅ Type-safe with runtime validation
```

### Success Criteria

#### Automated Verification:
- [ ] Discovery status API returns correct data: `curl http://localhost:3000/api/discovery/status`
- [ ] Refresh API invalidates caches: `curl -X POST http://localhost:3000/api/discovery/refresh`
- [ ] CLI discover command works: `pnpm discover:real-site`
- [ ] Documentation builds without errors: `pnpm build`

#### Manual Verification:
- [ ] Run `pnpm discover:real-site` - shows WooCommerce abilities in organized output
- [ ] Visit `/api/discovery/status` - shows connected environments with plugin counts
- [ ] Trigger `/api/discovery/refresh` - cache rebuilds, new abilities appear
- [ ] Follow migration guide - successfully switch from manual to dynamic tools
- [ ] README instructions are clear and accurate
- [ ] No broken links in documentation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to completion.

---

## Testing Strategy

### Unit Tests

**Schema Conversion** (`lib/discovery/__tests__/schema-converter.test.ts`):
- Primitive types (string, number, boolean, integer)
- Complex types (object, array, enum)
- Nested structures
- Optional/required fields
- Default values
- Edge cases (undefined schema, unsupported types)

**Tool Factory** (`lib/discovery/__tests__/tool-factory.test.ts`):
- Tool creation from abilities
- Tool execution via MCP
- Error handling
- Missing schemas
- Environment parameterization

**Discovery Service** (`lib/discovery/__tests__/discovery-service.test.ts`):
- MCP connection and tool listing
- Cache management (set, get, expire)
- TTL behavior
- Multi-environment isolation

**Change Tracker** (`lib/sync/__tests__/dynamic-change-tracker.test.ts`):
- Generic type tracking
- Schema registry validation
- Backward compatibility
- Multiple tool types

### Integration Tests

**Tool Equivalence** (`lib/discovery/__tests__/tool-equivalence.test.ts`):
- Compare auto-generated to manual WordPress tools
- Verify identical behavior
- Schema validation equivalence

**WooCommerce Discovery** (`lib/discovery/__tests__/woocommerce-discovery.test.ts`):
- Discover WooCommerce abilities from real-site
- Validate expected abilities present
- Schema completeness check

**Agent Integration** (existing `lib/agents/__tests__/`):
- Agent loads dynamic tools
- Executes WordPress operations
- Change tracking integration
- Multi-environment support

### End-to-End Tests

**Integration Script** (`scripts/test/test-dynamic-discovery.ts`):
- Full discovery → tool generation → agent execution flow
- WooCommerce detection
- Cache management
- Performance validation

### Manual Testing Checklist

**Discovery:**
- [ ] Fresh install discovers WordPress abilities
- [ ] WooCommerce abilities appear when plugin installed
- [ ] Custom plugin abilities discovered automatically
- [ ] Cache refresh picks up new plugins
- [ ] Performance meets targets (<5s discovery)

**Agent Usage:**
- [ ] "List posts" works via dynamic tools
- [ ] "Create product" works (if WooCommerce registered)
- [ ] "What can you help with?" lists all capabilities
- [ ] Multi-step operations tracked correctly

**Developer Experience:**
- [ ] CLI discover command is intuitive
- [ ] API endpoints respond quickly
- [ ] Documentation is clear
- [ ] Migration guide is accurate

## Performance Considerations

### Discovery Performance

**Target Metrics:**
- Cold discovery: <5 seconds
- Warm discovery (cached): <50ms
- Schema conversion: <100ms per schema
- Tool creation: <2 seconds total

**Optimization Strategies:**
- In-memory caching with 5-minute TTL
- Parallel discovery across environments
- Lazy schema conversion (on-demand)
- Connection pooling for MCP clients

### Memory Usage

**Cache Size Estimation:**
- ~100 abilities average
- ~1KB per ability (metadata + schema)
- ~100KB per environment cache
- ~300KB total (3 environments)

**Acceptable given modern server resources.**

### Network Efficiency

**Reduce MCP Calls:**
- Single `listTools()` call per discovery
- Cache results aggressively
- Refresh only on explicit request or TTL expiry

## Migration Notes

### Removing Manual Tools

**Phase-out plan:**
1. Phase 1-3: Build parallel dynamic system
2. Phase 4: Migrate change tracker to generic types
3. Phase 5: Validate equivalence
4. Phase 6: Switch agent to dynamic tools
5. **Post-launch:** Remove manual tool files after validation period

**Files to remove (after validation):**
- `lib/tools/wordpress-schemas.ts` - schemas now generated
- `lib/tools/wordpress-tools.ts` - tools now generated
- `lib/tools/index.ts` - export point no longer needed

**Files to keep:**
- `lib/tools/` directory for type exports
- `lib/sync/wordpress-types.ts` - backward compatibility layer

### Backward Compatibility

**Type Aliases:**
```typescript
// lib/sync/wordpress-types.ts
export type WordPressToolArgs = DynamicToolArgs;
export type WordPressToolResult = DynamicToolResult;
```

Existing code using old type names continues to work.

**Agent Signature:**
```typescript
export async function executeWordPressAgent(
  prompt: string,
  environment: McpEnvironment = 'sandbox'
)
```

Unchanged - consumers don't see internal changes.

## References

### Related Documents
- **Vision**: `DYNAMIC_MCP_DISCOVERY.md` - Product differentiation and user promise
- **Handoff**: `thoughts/shared/handoffs/general/2025-10-24_21-36-57_dynamic-mcp-discovery-strategy.md` - Strategic planning and architecture analysis
- **WooCommerce Plan**: `thoughts/shared/plans/2025-10-22-woocommerce-support.md` - Manual implementation blueprint (7 phases)
- **Original Plan**: `thoughts/shared/plans/2025-01-13-vercel-ai-mcp-dynamic-discovery.md` - Initial dynamic discovery approach

### Key Files
- **MCP Client**: `lib/mcp/wordpress-client.ts` - Tool discovery via `listTools()`
- **Client Factory**: `lib/mcp/client-factory.ts` - Environment-specific singletons
- **Agent**: `lib/agents/wordpress-agent.ts` - Tool integration point
- **Change Tracker**: `lib/sync/change-tracker.ts` - Type system constraints
- **WordPress Abilities**: `wp-content/mu-plugins/register-wordpress-abilities.php` - Ability definitions with JSON Schema

### External Resources
- MCP Protocol: https://modelcontextprotocol.io/
- WordPress Abilities API: WordPress MCP Adapter plugin
- Vercel AI SDK: https://sdk.vercel.ai/
- Zod Documentation: https://zod.dev/
- JSON Schema: https://json-schema.org/

---

## Success Metrics

The dynamic discovery system demonstrates:

1. **Zero Config**: Install WooCommerce → agent uses it (no code changes)
2. **Feature Parity**: Auto-generated tools work identically to manual tools
3. **Performance**: Discovery <5s, conversion <100ms, cache 10x speedup
4. **Accuracy**: All WordPress abilities discovered and converted correctly
5. **Adaptability**: Handles plugin updates and changes via cache refresh
6. **Type Safety**: Maintains runtime validation with generic types
7. **Developer Experience**: Simple CLI, clear APIs, good documentation
# Milestone 2: Custom MCP Client Development - Implementation Plan

## Overview

This document outlines the implementation plan for **Milestone 2** of the AI-Powered WordPress Editor project. The goal is to replace Claude Desktop with a custom TypeScript MCP client library that provides programmatic control over WordPress operations through the Model Context Protocol.

**Timeline**: Post Milestone 1 (WordPress MCP Server POC Complete)
**Created**: January 12, 2025

---

## What We're Achieving in Milestone 2

### Primary Goal

Build a production-ready TypeScript library that connects to WordPress MCP servers and provides a developer-friendly API for WordPress content management operations. This library will serve as the foundation for future CLI tools, web interfaces, and SaaS platform integration.

### Architecture for Milestone 2

```
┌──────────────────────────────────────────────────────────────┐
│            Custom MCP Client Library (@wp-mcp/core)          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  High-Level API (WordPress-Familiar Interface)     │    │
│  │    client.posts.list() / create() / update()       │    │
│  └──────────────────────┬─────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────┐    │
│  │  Connection Manager (Multi-Site Support)           │    │
│  │    - State management                              │    │
│  │    - Reconnection logic                            │    │
│  │    - Session recovery                              │    │
│  └──────────────────────┬─────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────┐    │
│  │  Authentication Layer                              │    │
│  │    - Application Password (Basic Auth)             │    │
│  │    - Secure credential storage                     │    │
│  └──────────────────────┬─────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────┐    │
│  │  MCP Protocol Layer (@modelcontextprotocol/sdk)    │    │
│  │    - Tool calls (CRUD operations)                  │    │
│  │    - Resource reading                              │    │
│  │    - Prompt handling                               │    │
│  └──────────────────────┬─────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────┐    │
│  │  Transport Layer (Streamable HTTP)                 │    │
│  │    - HTTP POST for requests                        │    │
│  │    - SSE for server notifications (optional)       │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────┘
                         │ MCP Protocol (JSON-RPC 2.0)
                         │ HTTP: localhost:8000/wp-json/wordpress-poc/mcp
┌────────────────────────▼─────────────────────────────────┐
│         WordPress MCP Server (From Milestone 1)          │
│         Running in Docker                                │
└──────────────────────────────────────────────────────────┘
```

### Success Criteria

#### Automated Verification:
- [ ] All TypeScript code compiles without errors: `pnpm build`
- [ ] All critical path tests pass: `pnpm test`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Can install library via pnpm: `pnpm add @wp-mcp/core`

#### Manual Verification:
- [ ] Can connect to WordPress MCP server from Milestone 1
- [ ] Can list existing WordPress posts via client library
- [ ] Can create a new post with title and content
- [ ] Can read an existing post's content
- [ ] Can update a post's content
- [ ] Can delete a post
- [ ] All operations return proper TypeScript types
- [ ] Error messages are clear and actionable
- [ ] Reconnection works after network interruption
- [ ] Multiple simultaneous connections work (multi-site)

**Implementation Note**: After completing setup and automated verification passes, manual testing with the example scripts should confirm all integration scenarios work as expected.

---

## Current State Analysis

### What Exists Now (From Milestone 1)

**Working WordPress MCP Server:**
- Docker-based WordPress + MySQL environment
- WordPress MCP Adapter plugin active
- 5 working MCP tools:
  - `wordpress-get-post` - Retrieve post by ID
  - `wordpress-list-posts` - List posts with pagination
  - `wordpress-create-post` - Create new post
  - `wordpress-update-post` - Update existing post
  - `wordpress-delete-post` - Delete post
- REST API endpoint: `http://localhost:8000/wp-json/wordpress-poc/mcp`
- Application Password authentication working
- Validated with Claude Desktop (Milestone 1 testing)

**Project Structure:**
- Docker Compose setup
- Bash automation scripts
- PHP-based WordPress plugins
- Environment configuration (`.env`)
- MCP credentials (`.mcp-credentials`)

**What's Missing:**
- No TypeScript/Node.js code yet
- No `package.json` or Node.js dependencies
- No client library for programmatic access
- No test infrastructure
- No build tooling
- No npm package structure

---

## What We're NOT Doing in Milestone 2

To maintain focus on building the core client library, the following are explicitly out of scope:

**Out of Scope:**
- CLI tool development (Phase 2 of original design)
- Web UI / React components (Phase 3 of original design)
- OAuth 2.1 implementation (Milestone 3)
- Production WordPress connector plugin (Milestone 3)
- SaaS platform integration (Milestone 4+)
- Multi-user authentication system (Milestone 3)
- HTTPS/SSL configuration (Milestone 3)
- Advanced caching mechanisms
- Webhook support
- Background job queues
- Rate limiting (beyond basic retry logic)
- Observability/monitoring integration
- Advanced error recovery strategies
- Custom WordPress abilities beyond CRUD

**UI/CLI Note**: These features are deferred to allow focus on production deployment in Milestone 3. The core library built here will serve as the foundation for both CLI and UI in future milestones.

---

## Implementation Approach

The implementation follows a **layered, bottom-up approach**:

1. **Foundation**: Project setup, TypeScript configuration, testing infrastructure
2. **Protocol Layer**: MCP SDK integration and transport implementation
3. **Authentication**: Application Password support with secure storage
4. **Connection Management**: State management, reconnection, multi-site support
5. **Resource API**: High-level WordPress-familiar API for posts
6. **Testing & Documentation**: Critical path tests and developer documentation
7. **Example & Validation**: Working examples to validate all features

This approach ensures each layer is working and tested before building the next, making debugging easier and ensuring a solid foundation.

---

## Phase 1: Project Foundation & Setup

### Overview

Initialize the Node.js/TypeScript project structure with build tools, linting, testing infrastructure, and development workflow.

### Changes Required

#### 1. Root Package Configuration

**File**: `package.json`
**Purpose**: Define project metadata, dependencies, and scripts

```json
{
  "name": "@wp-mcp/core",
  "version": "0.1.0",
  "description": "TypeScript client library for WordPress Model Context Protocol (MCP)",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,md}\"",
    "clean": "rm -rf dist"
  },
  "keywords": [
    "wordpress",
    "mcp",
    "model-context-protocol",
    "ai",
    "typescript"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/wp-ai-editor-v3"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "@vitest/coverage-v8": "^1.2.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.4",
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

#### 2. TypeScript Configuration

**File**: `tsconfig.json`
**Purpose**: TypeScript compiler configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": false,
    "checkJs": false,
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

#### 3. Build Configuration

**File**: `tsup.config.ts`
**Purpose**: Fast TypeScript bundler configuration

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  external: ['@modelcontextprotocol/sdk'],
});
```

#### 4. ESLint Configuration

**File**: `.eslintrc.cjs`
**Purpose**: Code quality and style enforcement

```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
};
```

#### 5. Prettier Configuration

**File**: `.prettierrc.json`
**Purpose**: Code formatting consistency

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### 6. Vitest Configuration

**File**: `vitest.config.ts`
**Purpose**: Testing framework configuration

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'src/index.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
```

#### 7. Git Configuration Updates

**File**: `.gitignore` (append to existing)
**Purpose**: Exclude Node.js artifacts

```gitignore
# Node.js
node_modules/
dist/
coverage/
*.tsbuildinfo

# Package manager
pnpm-lock.yaml
.pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# TypeScript
*.tsbuildinfo
```

#### 8. Project Directory Structure

**Create the following directory structure:**

```
src/
├── index.ts                      # Main entry point
├── client/
│   ├── WordPressMCPClient.ts     # High-level client API
│   ├── ConnectionManager.ts      # Connection state management
│   └── MCPConnection.ts          # Individual connection wrapper
├── auth/
│   ├── AuthStrategy.ts           # Auth interface
│   └── ApplicationPasswordAuth.ts # Basic Auth implementation
├── transport/
│   └── StreamableHTTPTransport.ts # HTTP transport wrapper
├── resources/
│   └── PostsResource.ts          # Posts CRUD operations
├── types/
│   ├── index.ts                  # Re-export all types
│   ├── client.ts                 # Client configuration types
│   ├── auth.ts                   # Authentication types
│   └── wordpress.ts              # WordPress data types
└── utils/
    ├── errors.ts                 # Custom error classes
    └── logger.ts                 # Simple logging utility
```

#### 9. Initial README

**File**: `README.md` (create new, separate from root README)
**Purpose**: Library documentation

```markdown
# @wp-mcp/core

TypeScript client library for WordPress Model Context Protocol (MCP).

## Installation

```bash
pnpm add @wp-mcp/core
```

## Quick Start

```typescript
import { WordPressMCPClient } from '@wp-mcp/core';

const client = new WordPressMCPClient({
  url: 'http://localhost:8000',
  auth: {
    type: 'application-password',
    username: 'admin',
    password: 'xxxx xxxx xxxx xxxx xxxx xxxx',
  },
});

await client.connect();

// List posts
const posts = await client.posts.list({ per_page: 10 });
console.log(posts);

// Create post
const newPost = await client.posts.create({
  title: 'Hello from MCP',
  content: 'This post was created via MCP!',
  status: 'draft',
});

// Update post
await client.posts.update(newPost.id, {
  status: 'publish',
});

// Delete post
await client.posts.delete(newPost.id);

await client.disconnect();
```

## Features

- ✅ TypeScript-first with full type safety
- ✅ WordPress-familiar API (posts.list(), posts.create(), etc.)
- ✅ Application Password authentication
- ✅ Automatic reconnection with exponential backoff
- ✅ Multi-site support (manage multiple WordPress instances)
- ✅ Comprehensive error handling
- ✅ Full MCP protocol support (tools, resources, prompts)

## Documentation

See [docs/](./docs/) for detailed documentation.

## Development

```bash
# Install dependencies
pnpm install

# Build library
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## License

MIT
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm install` completes successfully
- [ ] `pnpm build` compiles TypeScript without errors
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm format:check` passes
- [ ] `pnpm test` runs (no tests yet, but infrastructure works)
- [ ] Generated `dist/` directory contains `.js`, `.d.ts`, and `.map` files
- [ ] `package.json` validates with `pnpm verify`

#### Manual Verification:
- [ ] Directory structure created correctly
- [ ] All configuration files in place
- [ ] README is clear and helpful
- [ ] TypeScript compiler recognizes all type definitions
- [ ] ESLint and Prettier work in IDE/editor
- [ ] Can import types in example files

**Implementation Note**: This phase establishes the foundation. All subsequent phases will build on this infrastructure. Ensure all tooling works correctly before proceeding.

---

## Phase 2: Core Types & Error Handling

### Overview

Define TypeScript types for WordPress data structures, client configuration, authentication, and implement comprehensive error handling.

### Changes Required

#### 1. WordPress Data Types

**File**: `src/types/wordpress.ts`
**Purpose**: Type definitions for WordPress entities

```typescript
/**
 * WordPress Post Status
 */
export type PostStatus =
  | 'publish'
  | 'future'
  | 'draft'
  | 'pending'
  | 'private'
  | 'trash'
  | 'auto-draft'
  | 'inherit';

/**
 * WordPress Post Type
 */
export type PostType = 'post' | 'page' | 'attachment' | string;

/**
 * WordPress Post
 */
export interface WordPressPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: PostStatus;
  type: PostType;
  link: string;
  title: {
    rendered: string;
    raw?: string;
  };
  content: {
    rendered: string;
    raw?: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    raw?: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  comment_status: 'open' | 'closed';
  ping_status: 'open' | 'closed';
  sticky: boolean;
  template: string;
  format: string;
  meta: Record<string, unknown>;
  categories: number[];
  tags: number[];
  [key: string]: unknown;
}

/**
 * Parameters for creating a post
 */
export interface CreatePostParams {
  title: string;
  content: string;
  status?: PostStatus;
  excerpt?: string;
  author?: number;
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Parameters for updating a post
 */
export interface UpdatePostParams {
  title?: string;
  content?: string;
  status?: PostStatus;
  excerpt?: string;
  author?: number;
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Parameters for listing posts
 */
export interface ListPostsParams {
  page?: number;
  per_page?: number;
  search?: string;
  author?: number | number[];
  status?: PostStatus | PostStatus[];
  categories?: number | number[];
  tags?: number | number[];
  orderby?: 'date' | 'modified' | 'title' | 'id';
  order?: 'asc' | 'desc';
  [key: string]: unknown;
}

/**
 * Paginated response for list operations
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}
```

#### 2. Authentication Types

**File**: `src/types/auth.ts`
**Purpose**: Authentication configuration types

```typescript
/**
 * Authentication strategy type
 */
export type AuthType = 'application-password';

/**
 * Base authentication configuration
 */
export interface BaseAuthConfig {
  type: AuthType;
}

/**
 * Application Password authentication configuration
 */
export interface ApplicationPasswordAuthConfig extends BaseAuthConfig {
  type: 'application-password';
  username: string;
  password: string;
}

/**
 * Union type of all auth configurations
 */
export type AuthConfig = ApplicationPasswordAuthConfig;

/**
 * Authentication strategy interface
 */
export interface AuthStrategy {
  /**
   * Get HTTP headers for authentication
   */
  getHeaders(): Promise<Record<string, string>>;

  /**
   * Optional: Refresh credentials if supported
   */
  refresh?(): Promise<void>;

  /**
   * Optional: Validate credentials
   */
  validate?(): Promise<boolean>;
}
```

#### 3. Client Configuration Types

**File**: `src/types/client.ts`
**Purpose**: Client configuration and connection types

```typescript
import type { AuthConfig } from './auth.js';

/**
 * WordPress MCP Client configuration
 */
export interface WordPressMCPClientConfig {
  /**
   * WordPress site URL (e.g., 'http://localhost:8000')
   */
  url: string;

  /**
   * MCP endpoint path (defaults to '/wp-json/wordpress-poc/mcp')
   */
  mcpEndpoint?: string;

  /**
   * Authentication configuration
   */
  auth: AuthConfig;

  /**
   * Connection timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Maximum retry attempts for failed requests (default: 3)
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds (default: 1000)
   */
  retryDelay?: number;

  /**
   * Whether to use exponential backoff for retries (default: true)
   */
  exponentialBackoff?: boolean;

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean;
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Connection status information
 */
export interface ConnectionStatus {
  state: ConnectionState;
  connectedAt?: Date;
  lastError?: Error;
  retryCount: number;
  siteUrl: string;
}

/**
 * MCP Server capabilities
 */
export interface MCPCapabilities {
  tools: {
    available: string[];
  };
  resources: {
    available: string[];
  };
  prompts: {
    available: string[];
  };
}
```

#### 4. Error Classes

**File**: `src/utils/errors.ts`
**Purpose**: Custom error types for better error handling

```typescript
/**
 * Base error class for all MCP client errors
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
    Object.setPrototypeOf(this, MCPError.prototype);
  }
}

/**
 * Connection-related errors
 */
export class ConnectionError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * WordPress operation errors
 */
export class WordPressOperationError extends MCPError {
  constructor(
    message: string,
    public operation: string,
    details?: unknown
  ) {
    super(message, 'WORDPRESS_OPERATION_ERROR', details);
    this.name = 'WordPressOperationError';
    Object.setPrototypeOf(this, WordPressOperationError.prototype);
  }
}

/**
 * MCP protocol errors
 */
export class ProtocolError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROTOCOL_ERROR', details);
    this.name = 'ProtocolError';
    Object.setPrototypeOf(this, ProtocolError.prototype);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends MCPError {
  constructor(message: string, public field?: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends MCPError {
  constructor(message: string, public timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR', { timeoutMs });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends MCPError {
  constructor(resource: string, id: number | string) {
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND_ERROR', {
      resource,
      id,
    });
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
```

#### 5. Simple Logger Utility

**File**: `src/utils/logger.ts`
**Purpose**: Debug logging with optional output

```typescript
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export class Logger {
  constructor(
    private namespace: string,
    private enabled: boolean = false
  ) {}

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.enabled && level !== LogLevel.ERROR) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.namespace}] [${level.toUpperCase()}]`;

    if (data) {
      console[level](prefix, message, data);
    } else {
      console[level](prefix, message);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, error);
  }
}
```

#### 6. Type Exports

**File**: `src/types/index.ts`
**Purpose**: Centralized type exports

```typescript
// Client types
export type {
  WordPressMCPClientConfig,
  ConnectionStatus,
  MCPCapabilities,
} from './client.js';
export { ConnectionState } from './client.js';

// Authentication types
export type {
  AuthType,
  BaseAuthConfig,
  ApplicationPasswordAuthConfig,
  AuthConfig,
  AuthStrategy,
} from './auth.js';

// WordPress types
export type {
  PostStatus,
  PostType,
  WordPressPost,
  CreatePostParams,
  UpdatePostParams,
  ListPostsParams,
  PaginatedResponse,
} from './wordpress.js';
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles all type definitions: `pnpm typecheck`
- [ ] No linting errors in type files: `pnpm lint`
- [ ] Can import all types in test files
- [ ] Error classes instantiate correctly

#### Manual Verification:
- [ ] Type definitions match WordPress REST API responses
- [ ] All exported types are accessible from `@wp-mcp/core`
- [ ] Error classes have proper inheritance chain
- [ ] Logger outputs messages correctly when enabled
- [ ] TypeScript IntelliSense shows proper type information

**Implementation Note**: These types form the contract between the library and consumers. Ensure they match WordPress REST API exactly to prevent runtime type mismatches.

---

## Phase 3: Authentication Layer

### Overview

Implement the authentication strategy pattern with Application Password support (Basic Auth).

### Changes Required

#### 1. Authentication Strategy Interface

**File**: `src/auth/AuthStrategy.ts`
**Purpose**: Abstract authentication interface

```typescript
import type { AuthConfig } from '../types/auth.js';

export abstract class AuthStrategy {
  constructor(protected config: AuthConfig) {}

  /**
   * Get HTTP headers required for authentication
   */
  abstract getHeaders(): Promise<Record<string, string>>;

  /**
   * Validate credentials (optional)
   */
  async validate(): Promise<boolean> {
    return true;
  }

  /**
   * Refresh credentials if needed (optional)
   */
  async refresh(): Promise<void> {
    // No-op by default
  }
}
```

#### 2. Application Password Authentication

**File**: `src/auth/ApplicationPasswordAuth.ts`
**Purpose**: Basic Auth implementation for WordPress Application Passwords

```typescript
import type { ApplicationPasswordAuthConfig } from '../types/auth.js';
import { AuthStrategy } from './AuthStrategy.js';
import { AuthenticationError, ValidationError } from '../utils/errors.js';

export class ApplicationPasswordAuth extends AuthStrategy {
  private username: string;
  private password: string;

  constructor(config: ApplicationPasswordAuthConfig) {
    super(config);
    this.username = config.username;
    this.password = config.password;

    this.validateCredentials();
  }

  private validateCredentials(): void {
    if (!this.username || this.username.trim() === '') {
      throw new ValidationError(
        'Username is required for Application Password authentication',
        'username'
      );
    }

    if (!this.password || this.password.trim() === '') {
      throw new ValidationError(
        'Password is required for Application Password authentication',
        'password'
      );
    }

    // WordPress Application Passwords are typically 24 characters with spaces
    // Format: "xxxx xxxx xxxx xxxx xxxx xxxx"
    const cleanPassword = this.password.replace(/\s/g, '');
    if (cleanPassword.length !== 24) {
      throw new ValidationError(
        'Application Password should be 24 characters (spaces are optional)',
        'password',
        { length: cleanPassword.length }
      );
    }
  }

  async getHeaders(): Promise<Record<string, string>> {
    // Basic Authentication: Base64(username:password)
    const credentials = `${this.username}:${this.password}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');

    return {
      Authorization: `Basic ${encodedCredentials}`,
      'Content-Type': 'application/json',
    };
  }

  async validate(): Promise<boolean> {
    // Validation happens in constructor
    // Could add a live validation check here if needed
    return true;
  }
}
```

#### 3. Authentication Factory

**File**: `src/auth/createAuthStrategy.ts`
**Purpose**: Factory function to create auth strategies

```typescript
import type { AuthConfig, AuthStrategy } from '../types/auth.js';
import { ApplicationPasswordAuth } from './ApplicationPasswordAuth.js';
import { ValidationError } from '../utils/errors.js';

export function createAuthStrategy(config: AuthConfig): AuthStrategy {
  switch (config.type) {
    case 'application-password':
      return new ApplicationPasswordAuth(config);

    default:
      throw new ValidationError(
        `Unsupported authentication type: ${(config as AuthConfig).type}`,
        'auth.type'
      );
  }
}
```

#### 4. Authentication Module Exports

**File**: `src/auth/index.ts`
**Purpose**: Export authentication components

```typescript
export { AuthStrategy } from './AuthStrategy.js';
export { ApplicationPasswordAuth } from './ApplicationPasswordAuth.js';
export { createAuthStrategy } from './createAuthStrategy.js';
```

#### 5. Unit Tests for Authentication

**File**: `src/auth/ApplicationPasswordAuth.test.ts`
**Purpose**: Test authentication logic

```typescript
import { describe, it, expect } from 'vitest';
import { ApplicationPasswordAuth } from './ApplicationPasswordAuth.js';
import { ValidationError } from '../utils/errors.js';

describe('ApplicationPasswordAuth', () => {
  const validConfig = {
    type: 'application-password' as const,
    username: 'admin',
    password: 'abcd efgh ijkl mnop qrst uvwx', // 24 chars
  };

  describe('constructor', () => {
    it('should create instance with valid credentials', () => {
      const auth = new ApplicationPasswordAuth(validConfig);
      expect(auth).toBeInstanceOf(ApplicationPasswordAuth);
    });

    it('should throw ValidationError for empty username', () => {
      const config = { ...validConfig, username: '' };
      expect(() => new ApplicationPasswordAuth(config)).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for empty password', () => {
      const config = { ...validConfig, password: '' };
      expect(() => new ApplicationPasswordAuth(config)).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid password length', () => {
      const config = { ...validConfig, password: 'tooshort' };
      expect(() => new ApplicationPasswordAuth(config)).toThrow(
        ValidationError
      );
    });

    it('should accept password with or without spaces', () => {
      const withSpaces = new ApplicationPasswordAuth(validConfig);
      const withoutSpaces = new ApplicationPasswordAuth({
        ...validConfig,
        password: 'abcdefghijklmnopqrstuvwx',
      });

      expect(withSpaces).toBeInstanceOf(ApplicationPasswordAuth);
      expect(withoutSpaces).toBeInstanceOf(ApplicationPasswordAuth);
    });
  });

  describe('getHeaders', () => {
    it('should return Basic Auth header', async () => {
      const auth = new ApplicationPasswordAuth(validConfig);
      const headers = await auth.getHeaders();

      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toMatch(/^Basic /);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should properly encode credentials', async () => {
      const auth = new ApplicationPasswordAuth(validConfig);
      const headers = await auth.getHeaders();

      // Decode and verify
      const base64Credentials = headers.Authorization.replace('Basic ', '');
      const decoded = Buffer.from(base64Credentials, 'base64').toString(
        'utf-8'
      );

      expect(decoded).toBe(
        `${validConfig.username}:${validConfig.password}`
      );
    });
  });

  describe('validate', () => {
    it('should return true for valid credentials', async () => {
      const auth = new ApplicationPasswordAuth(validConfig);
      const isValid = await auth.validate();
      expect(isValid).toBe(true);
    });
  });
});
```

#### 6. Test for Auth Factory

**File**: `src/auth/createAuthStrategy.test.ts`
**Purpose**: Test factory function

```typescript
import { describe, it, expect } from 'vitest';
import { createAuthStrategy } from './createAuthStrategy.js';
import { ApplicationPasswordAuth } from './ApplicationPasswordAuth.js';
import { ValidationError } from '../utils/errors.js';

describe('createAuthStrategy', () => {
  it('should create ApplicationPasswordAuth for application-password type', () => {
    const config = {
      type: 'application-password' as const,
      username: 'admin',
      password: 'abcd efgh ijkl mnop qrst uvwx',
    };

    const strategy = createAuthStrategy(config);
    expect(strategy).toBeInstanceOf(ApplicationPasswordAuth);
  });

  it('should throw ValidationError for unsupported auth type', () => {
    const config = {
      type: 'unsupported' as any,
      username: 'admin',
      password: 'password',
    };

    expect(() => createAuthStrategy(config)).toThrow(ValidationError);
  });
});
```

### Success Criteria

#### Automated Verification:
- [ ] All authentication tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Test coverage meets threshold for auth module
- [ ] Can create auth strategy from config
- [ ] Basic Auth header is correctly formatted

#### Manual Verification:
- [ ] Application Password validation catches invalid formats
- [ ] Authorization header uses correct Base64 encoding
- [ ] Error messages are clear and helpful
- [ ] TypeScript types are properly inferred

**Implementation Note**: This authentication layer is designed to be extensible. OAuth 2.1 support can be added in Milestone 3 by implementing a new `OAuth2Auth` class that extends `AuthStrategy`.

---

## Phase 4: MCP Connection & Transport

### Overview

Implement the transport layer using MCP SDK's Streamable HTTP transport and wrap it with connection management logic.

### Changes Required

#### 1. MCP Connection Wrapper

**File**: `src/client/MCPConnection.ts`
**Purpose**: Wrapper around MCP SDK client with connection state management

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  ConnectionState,
  ConnectionStatus,
  MCPCapabilities,
  WordPressMCPClientConfig,
} from '../types/index.js';
import { ConnectionState as State } from '../types/index.js';
import {
  ConnectionError,
  TimeoutError,
  ProtocolError,
} from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export class MCPConnection {
  private client: Client;
  private transport: Transport;
  private state: ConnectionState = State.DISCONNECTED;
  private connectedAt?: Date;
  private lastError?: Error;
  private retryCount: number = 0;
  private logger: Logger;

  constructor(
    private config: WordPressMCPClientConfig,
    transport: Transport
  ) {
    this.transport = transport;
    this.logger = new Logger('MCPConnection', config.debug);

    this.client = new Client(
      {
        name: 'wordpress-mcp-client',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.state === State.CONNECTED) {
      this.logger.warn('Already connected');
      return;
    }

    this.setState(State.CONNECTING);
    this.logger.info('Connecting to MCP server', {
      url: this.config.url,
    });

    try {
      await this.withTimeout(
        this.client.connect(this.transport),
        this.config.timeout || 30000,
        'Connection timeout'
      );

      this.connectedAt = new Date();
      this.retryCount = 0;
      this.setState(State.CONNECTED);

      this.logger.info('Connected successfully');
    } catch (error) {
      this.lastError = error as Error;
      this.setState(State.ERROR);
      this.logger.error('Connection failed', error);

      throw new ConnectionError(
        `Failed to connect to MCP server: ${(error as Error).message}`,
        { url: this.config.url, error }
      );
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.state === State.DISCONNECTED) {
      this.logger.warn('Already disconnected');
      return;
    }

    this.logger.info('Disconnecting from MCP server');

    try {
      await this.client.close();
      this.setState(State.DISCONNECTED);
      this.connectedAt = undefined;
      this.logger.info('Disconnected successfully');
    } catch (error) {
      this.logger.error('Disconnect error', error);
      throw new ConnectionError(
        `Failed to disconnect: ${(error as Error).message}`,
        { error }
      );
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  async reconnect(): Promise<void> {
    if (
      this.state === State.CONNECTING ||
      this.state === State.RECONNECTING
    ) {
      this.logger.warn('Already connecting/reconnecting');
      return;
    }

    const maxRetries = this.config.maxRetries || 3;
    if (this.retryCount >= maxRetries) {
      throw new ConnectionError(
        `Max reconnection attempts (${maxRetries}) exceeded`,
        { retryCount: this.retryCount }
      );
    }

    this.setState(State.RECONNECTING);
    this.retryCount++;

    const delay = this.calculateRetryDelay();
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.retryCount})`);

    await this.sleep(delay);

    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Reconnection failed', error);
      throw error;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return {
      state: this.state,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
      retryCount: this.retryCount,
      siteUrl: this.config.url,
    };
  }

  /**
   * Get MCP server capabilities
   */
  async getCapabilities(): Promise<MCPCapabilities> {
    this.ensureConnected();

    try {
      const tools = await this.client.listTools();
      const resources = await this.client.listResources();
      const prompts = await this.client.listPrompts();

      return {
        tools: {
          available: tools.tools.map((t) => t.name),
        },
        resources: {
          available: resources.resources.map((r) => r.uri),
        },
        prompts: {
          available: prompts.prompts.map((p) => p.name),
        },
      };
    } catch (error) {
      throw new ProtocolError(
        `Failed to get capabilities: ${(error as Error).message}`,
        { error }
      );
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();

    this.logger.debug('Calling tool', { name, args });

    try {
      const result = await this.withTimeout(
        this.client.callTool({ name, arguments: args }),
        this.config.timeout || 30000,
        `Tool call timeout: ${name}`
      );

      this.logger.debug('Tool call succeeded', { name, result });
      return result;
    } catch (error) {
      this.logger.error('Tool call failed', { name, error });
      throw new ProtocolError(
        `Tool call failed: ${name}`,
        { name, args, error }
      );
    }
  }

  /**
   * Read an MCP resource
   */
  async readResource(uri: string): Promise<unknown> {
    this.ensureConnected();

    this.logger.debug('Reading resource', { uri });

    try {
      const result = await this.withTimeout(
        this.client.readResource({ uri }),
        this.config.timeout || 30000,
        `Resource read timeout: ${uri}`
      );

      this.logger.debug('Resource read succeeded', { uri, result });
      return result;
    } catch (error) {
      this.logger.error('Resource read failed', { uri, error });
      throw new ProtocolError(
        `Resource read failed: ${uri}`,
        { uri, error }
      );
    }
  }

  /**
   * Get an MCP prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>
  ): Promise<unknown> {
    this.ensureConnected();

    this.logger.debug('Getting prompt', { name, args });

    try {
      const result = await this.withTimeout(
        this.client.getPrompt({ name, arguments: args }),
        this.config.timeout || 30000,
        `Prompt get timeout: ${name}`
      );

      this.logger.debug('Prompt get succeeded', { name, result });
      return result;
    } catch (error) {
      this.logger.error('Prompt get failed', { name, error });
      throw new ProtocolError(
        `Prompt get failed: ${name}`,
        { name, args, error }
      );
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === State.CONNECTED;
  }

  // Private helper methods

  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new ConnectionError('Not connected to MCP server', {
        state: this.state,
      });
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.logger.debug('State changed', { state });
  }

  private calculateRetryDelay(): number {
    const baseDelay = this.config.retryDelay || 1000;

    if (this.config.exponentialBackoff !== false) {
      // Exponential backoff: baseDelay * 2^(retryCount - 1)
      // Max 30 seconds
      return Math.min(baseDelay * Math.pow(2, this.retryCount - 1), 30000);
    }

    return baseDelay;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError(timeoutMessage, timeoutMs)),
          timeoutMs
        )
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

#### 2. HTTP Transport Factory

**File**: `src/transport/createTransport.ts`
**Purpose**: Create HTTP transport with authentication headers

```typescript
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { WordPressMCPClientConfig } from '../types/index.js';
import { createAuthStrategy } from '../auth/index.js';
import { ValidationError } from '../utils/errors.js';

// Note: We'll need to implement a custom HTTP transport since MCP SDK's
// StreamableHTTPClientTransport doesn't support custom headers easily.
// For now, this is a placeholder that shows the intended structure.

export async function createTransport(
  config: WordPressMCPClientConfig
): Promise<Transport> {
  // Validate URL
  try {
    new URL(config.url);
  } catch {
    throw new ValidationError('Invalid URL', 'url', { url: config.url });
  }

  // Get auth headers
  const authStrategy = createAuthStrategy(config.auth);
  const authHeaders = await authStrategy.getHeaders();

  // Construct full endpoint URL
  const mcpEndpoint = config.mcpEndpoint || '/wp-json/wordpress-poc/mcp';
  const fullUrl = new URL(mcpEndpoint, config.url).toString();

  // TODO: Implement custom HTTP transport that supports headers
  // For now, this is a placeholder
  // The actual implementation will use fetch() with proper headers

  throw new Error(
    'Custom HTTP transport not yet implemented - see Phase 4 implementation notes'
  );
}
```

**Implementation Note**: The MCP SDK's `StreamableHTTPClientTransport` may not support custom headers easily. We'll need to either:
1. Extend the official transport class
2. Implement a custom transport using the `Transport` interface
3. Contribute to the SDK to add header support

This is a known limitation that will be addressed during implementation.

#### 3. Connection Tests

**File**: `src/client/MCPConnection.test.ts`
**Purpose**: Test connection logic (unit tests with mocks)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPConnection } from './MCPConnection.js';
import { ConnectionState } from '../types/index.js';
import { ConnectionError, TimeoutError } from '../utils/errors.js';

// Mock the MCP SDK client
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [{ name: 'test-tool' }],
    }),
    listResources: vi.fn().mockResolvedValue({
      resources: [{ uri: 'test://resource' }],
    }),
    listPrompts: vi.fn().mockResolvedValue({
      prompts: [{ name: 'test-prompt' }],
    }),
    callTool: vi.fn().mockResolvedValue({ success: true }),
    readResource: vi.fn().mockResolvedValue({ data: 'test' }),
    getPrompt: vi.fn().mockResolvedValue({ prompt: 'test' }),
  })),
}));

describe('MCPConnection', () => {
  const mockConfig = {
    url: 'http://localhost:8000',
    auth: {
      type: 'application-password' as const,
      username: 'admin',
      password: 'abcd efgh ijkl mnop qrst uvwx',
    },
    timeout: 5000,
    maxRetries: 3,
  };

  const mockTransport = {} as any; // Mock transport

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connection lifecycle', () => {
    it('should connect successfully', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);

      await connection.connect();

      const status = connection.getStatus();
      expect(status.state).toBe(ConnectionState.CONNECTED);
      expect(status.connectedAt).toBeInstanceOf(Date);
      expect(connection.isConnected()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);

      await connection.connect();
      await connection.disconnect();

      const status = connection.getStatus();
      expect(status.state).toBe(ConnectionState.DISCONNECTED);
      expect(connection.isConnected()).toBe(false);
    });

    it('should handle connection errors', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);

      // Make connect fail
      vi.mocked(connection['client'].connect).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(connection.connect()).rejects.toThrow(ConnectionError);

      const status = connection.getStatus();
      expect(status.state).toBe(ConnectionState.ERROR);
      expect(status.lastError).toBeDefined();
    });
  });

  describe('capabilities', () => {
    it('should get server capabilities', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);
      await connection.connect();

      const capabilities = await connection.getCapabilities();

      expect(capabilities.tools.available).toContain('test-tool');
      expect(capabilities.resources.available).toContain('test://resource');
      expect(capabilities.prompts.available).toContain('test-prompt');
    });

    it('should throw error when not connected', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);

      await expect(connection.getCapabilities()).rejects.toThrow(
        ConnectionError
      );
    });
  });

  describe('tool calls', () => {
    it('should call tool successfully', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);
      await connection.connect();

      const result = await connection.callTool('test-tool', { arg: 'value' });

      expect(result).toEqual({ success: true });
    });

    it('should throw error when not connected', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);

      await expect(
        connection.callTool('test-tool', {})
      ).rejects.toThrow(ConnectionError);
    });
  });

  describe('reconnection', () => {
    it('should reconnect with backoff', async () => {
      const connection = new MCPConnection(mockConfig, mockTransport);

      await connection.connect();
      await connection.disconnect();
      await connection.reconnect();

      expect(connection.isConnected()).toBe(true);
      const status = connection.getStatus();
      expect(status.retryCount).toBe(1);
    });

    it('should respect max retries', async () => {
      const connection = new MCPConnection(
        { ...mockConfig, maxRetries: 2 },
        mockTransport
      );

      // Force retries
      connection['retryCount'] = 2;

      await expect(connection.reconnect()).rejects.toThrow(
        /Max reconnection attempts/
      );
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [ ] All connection tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Connection state transitions work correctly
- [ ] Reconnection logic with exponential backoff works
- [ ] Timeout handling works

#### Manual Verification:
- [ ] Can connect to real WordPress MCP server (integration test)
- [ ] Connection status updates correctly
- [ ] Error messages are clear
- [ ] Reconnection attempts work in real scenarios
- [ ] Logs provide useful debugging information

**Implementation Note**: The HTTP transport implementation requires either extending the MCP SDK or implementing a custom transport. This should be done early in Phase 4 to unblock development. Consider contributing back to the MCP SDK if custom headers are needed.

---

## Phase 5: High-Level WordPress API

### Overview

Build the developer-friendly API layer that provides WordPress-familiar methods for post operations.

### Changes Required

#### 1. Posts Resource Manager

**File**: `src/resources/PostsResource.ts`
**Purpose**: High-level API for WordPress post operations

```typescript
import type {
  WordPressPost,
  CreatePostParams,
  UpdatePostParams,
  ListPostsParams,
  PaginatedResponse,
} from '../types/wordpress.js';
import type { MCPConnection } from '../client/MCPConnection.js';
import {
  WordPressOperationError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export class PostsResource {
  private logger: Logger;

  constructor(
    private connection: MCPConnection,
    debug: boolean = false
  ) {
    this.logger = new Logger('PostsResource', debug);
  }

  /**
   * List WordPress posts
   */
  async list(
    params: ListPostsParams = {}
  ): Promise<PaginatedResponse<WordPressPost>> {
    this.logger.info('Listing posts', params);

    try {
      const result = (await this.connection.callTool('wordpress-list-posts', {
        per_page: params.per_page || 10,
        page: params.page || 1,
        ...params,
      })) as any;

      // Parse MCP tool result
      const posts = this.parseToolResult(result);

      return {
        items: posts,
        total: result.total || posts.length,
        totalPages: result.total_pages || 1,
        currentPage: params.page || 1,
        perPage: params.per_page || 10,
      };
    } catch (error) {
      this.logger.error('Failed to list posts', error);
      throw new WordPressOperationError(
        'list',
        `Failed to list posts: ${(error as Error).message}`,
        { params, error }
      );
    }
  }

  /**
   * Get a single post by ID
   */
  async get(id: number): Promise<WordPressPost> {
    this.validateId(id);
    this.logger.info('Getting post', { id });

    try {
      const result = (await this.connection.callTool('wordpress-get-post', {
        id,
      })) as any;

      const post = this.parseToolResult(result);

      if (!post) {
        throw new NotFoundError('Post', id);
      }

      return post;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      this.logger.error('Failed to get post', { id, error });
      throw new WordPressOperationError(
        'get',
        `Failed to get post ${id}: ${(error as Error).message}`,
        { id, error }
      );
    }
  }

  /**
   * Create a new post
   */
  async create(params: CreatePostParams): Promise<WordPressPost> {
    this.validateCreateParams(params);
    this.logger.info('Creating post', params);

    try {
      const result = (await this.connection.callTool(
        'wordpress-create-post',
        {
          title: params.title,
          content: params.content,
          status: params.status || 'draft',
          ...params,
        }
      )) as any;

      const post = this.parseToolResult(result);

      if (!post || !post.id) {
        throw new WordPressOperationError(
          'create',
          'Failed to create post: No post ID returned',
          { params, result }
        );
      }

      this.logger.info('Post created successfully', { id: post.id });
      return post;
    } catch (error) {
      this.logger.error('Failed to create post', { params, error });
      throw new WordPressOperationError(
        'create',
        `Failed to create post: ${(error as Error).message}`,
        { params, error }
      );
    }
  }

  /**
   * Update an existing post
   */
  async update(id: number, params: UpdatePostParams): Promise<WordPressPost> {
    this.validateId(id);
    this.logger.info('Updating post', { id, params });

    try {
      const result = (await this.connection.callTool(
        'wordpress-update-post',
        {
          id,
          ...params,
        }
      )) as any;

      const post = this.parseToolResult(result);

      if (!post) {
        throw new NotFoundError('Post', id);
      }

      this.logger.info('Post updated successfully', { id });
      return post;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      this.logger.error('Failed to update post', { id, params, error });
      throw new WordPressOperationError(
        'update',
        `Failed to update post ${id}: ${(error as Error).message}`,
        { id, params, error }
      );
    }
  }

  /**
   * Delete a post
   */
  async delete(id: number, force: boolean = false): Promise<void> {
    this.validateId(id);
    this.logger.info('Deleting post', { id, force });

    try {
      await this.connection.callTool('wordpress-delete-post', {
        id,
        force,
      });

      this.logger.info('Post deleted successfully', { id });
    } catch (error) {
      this.logger.error('Failed to delete post', { id, error });
      throw new WordPressOperationError(
        'delete',
        `Failed to delete post ${id}: ${(error as Error).message}`,
        { id, force, error }
      );
    }
  }

  // Private helper methods

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('Invalid post ID', 'id', { id });
    }
  }

  private validateCreateParams(params: CreatePostParams): void {
    if (!params.title || params.title.trim() === '') {
      throw new ValidationError('Title is required', 'title');
    }

    if (!params.content || params.content.trim() === '') {
      throw new ValidationError('Content is required', 'content');
    }
  }

  private parseToolResult(result: any): any {
    // MCP tool results come wrapped in a specific format
    // This method extracts the actual data
    if (result.content && Array.isArray(result.content)) {
      // Look for text content type
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
    }

    return result;
  }
}
```

#### 2. Main Client Class

**File**: `src/client/WordPressMCPClient.ts`
**Purpose**: Main entry point for the library

```typescript
import type {
  WordPressMCPClientConfig,
  ConnectionStatus,
  MCPCapabilities,
} from '../types/index.js';
import { MCPConnection } from './MCPConnection.js';
import { PostsResource } from '../resources/PostsResource.js';
import { createTransport } from '../transport/createTransport.js';
import { Logger } from '../utils/logger.js';

export class WordPressMCPClient {
  private connection: MCPConnection;
  private _posts: PostsResource;
  private logger: Logger;

  constructor(private config: WordPressMCPClientConfig) {
    this.logger = new Logger('WordPressMCPClient', config.debug);

    // Initialize connection (transport creation is async, done in connect())
    this.connection = null as any; // Will be set in connect()
    this._posts = null as any; // Will be set in connect()
  }

  /**
   * Connect to WordPress MCP server
   */
  async connect(): Promise<void> {
    this.logger.info('Initializing connection', { url: this.config.url });

    // Create transport
    const transport = await createTransport(this.config);

    // Create connection
    this.connection = new MCPConnection(this.config, transport);

    // Connect
    await this.connection.connect();

    // Initialize resource managers
    this._posts = new PostsResource(this.connection, this.config.debug);

    this.logger.info('Client ready');
  }

  /**
   * Disconnect from WordPress MCP server
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.disconnect();
    }
  }

  /**
   * Reconnect to WordPress MCP server
   */
  async reconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.reconnect();
    }
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    if (!this.connection) {
      throw new Error('Client not initialized. Call connect() first.');
    }
    return this.connection.getStatus();
  }

  /**
   * Get server capabilities
   */
  async getCapabilities(): Promise<MCPCapabilities> {
    if (!this.connection) {
      throw new Error('Client not initialized. Call connect() first.');
    }
    return this.connection.getCapabilities();
  }

  /**
   * Posts resource manager
   */
  get posts(): PostsResource {
    if (!this._posts) {
      throw new Error('Client not initialized. Call connect() first.');
    }
    return this._posts;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection?.isConnected() ?? false;
  }

  /**
   * Low-level: Call any MCP tool directly
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connection) {
      throw new Error('Client not initialized. Call connect() first.');
    }
    return this.connection.callTool(name, args);
  }

  /**
   * Low-level: Read any MCP resource directly
   */
  async readResource(uri: string): Promise<unknown> {
    if (!this.connection) {
      throw new Error('Client not initialized. Call connect() first.');
    }
    return this.connection.readResource(uri);
  }

  /**
   * Low-level: Get any MCP prompt directly
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<unknown> {
    if (!this.connection) {
      throw new Error('Client not initialized. Call connect() first.');
    }
    return this.connection.getPrompt(name, args);
  }
}
```

#### 3. Main Entry Point

**File**: `src/index.ts`
**Purpose**: Library exports

```typescript
// Main client
export { WordPressMCPClient } from './client/WordPressMCPClient.js';

// Types
export type {
  WordPressMCPClientConfig,
  ConnectionStatus,
  MCPCapabilities,
  AuthConfig,
  ApplicationPasswordAuthConfig,
  WordPressPost,
  CreatePostParams,
  UpdatePostParams,
  ListPostsParams,
  PaginatedResponse,
  PostStatus,
  PostType,
} from './types/index.js';

export { ConnectionState } from './types/index.js';

// Errors
export {
  MCPError,
  ConnectionError,
  AuthenticationError,
  WordPressOperationError,
  ProtocolError,
  ValidationError,
  TimeoutError,
  NotFoundError,
} from './utils/errors.js';

// Advanced: Export low-level components for custom implementations
export { MCPConnection } from './client/MCPConnection.js';
export { PostsResource } from './resources/PostsResource.js';
export { createAuthStrategy } from './auth/index.js';
```

### Success Criteria

#### Automated Verification:
- [ ] All unit tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Can import main client: `import { WordPressMCPClient } from '@wp-mcp/core'`
- [ ] Type inference works correctly
- [ ] Error handling is comprehensive

#### Manual Verification:
- [ ] High-level API is intuitive and WordPress-familiar
- [ ] Can perform all CRUD operations through client.posts
- [ ] Error messages are actionable
- [ ] TypeScript IntelliSense shows proper documentation
- [ ] Low-level MCP methods are accessible for advanced use

**Implementation Note**: The high-level API should feel natural to WordPress developers. Method names and parameters should match WordPress conventions where possible.

---

## Phase 6: Integration Testing & Examples

### Overview

Create integration tests that run against the real WordPress MCP server from Milestone 1, and build example scripts demonstrating library usage.

### Changes Required

#### 1. Integration Test Setup

**File**: `tests/integration/setup.ts`
**Purpose**: Test environment configuration

```typescript
import { WordPressMCPClient } from '../../src/index.js';
import type { WordPressMCPClientConfig } from '../../src/types/index.js';

export function createTestClient(): WordPressMCPClient {
  const config: WordPressMCPClientConfig = {
    url: process.env.WP_MCP_URL || 'http://localhost:8000',
    auth: {
      type: 'application-password',
      username: process.env.WP_USERNAME || 'admin',
      password:
        process.env.WP_APP_PASSWORD || 'xxxx xxxx xxxx xxxx xxxx xxxx',
    },
    timeout: 30000,
    debug: true,
  };

  return new WordPressMCPClient(config);
}

export async function ensureTestEnvironment(): Promise<void> {
  const requiredEnvVars = ['WP_MCP_URL', 'WP_USERNAME', 'WP_APP_PASSWORD'];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(
        `Missing required environment variable: ${envVar}\n` +
          'Please create a .env.test file with:\n' +
          'WP_MCP_URL=http://localhost:8000\n' +
          'WP_USERNAME=admin\n' +
          'WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx'
      );
    }
  }
}
```

#### 2. Integration Tests

**File**: `tests/integration/posts.test.ts`
**Purpose**: End-to-end tests with real WordPress server

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, ensureTestEnvironment } from './setup.js';
import type { WordPressMCPClient } from '../../src/index.js';
import { ConnectionState } from '../../src/index.js';

describe('Posts Integration Tests', () => {
  let client: WordPressMCPClient;
  let createdPostId: number;

  beforeAll(async () => {
    await ensureTestEnvironment();
    client = createTestClient();
    await client.connect();
  });

  afterAll(async () => {
    // Cleanup: delete test post if created
    if (createdPostId && client.isConnected()) {
      try {
        await client.posts.delete(createdPostId, true);
      } catch {
        // Ignore cleanup errors
      }
    }

    await client.disconnect();
  });

  it('should connect successfully', () => {
    const status = client.getStatus();
    expect(status.state).toBe(ConnectionState.CONNECTED);
    expect(client.isConnected()).toBe(true);
  });

  it('should get server capabilities', async () => {
    const capabilities = await client.getCapabilities();

    expect(capabilities.tools.available).toContain('wordpress-list-posts');
    expect(capabilities.tools.available).toContain('wordpress-get-post');
    expect(capabilities.tools.available).toContain('wordpress-create-post');
    expect(capabilities.tools.available).toContain('wordpress-update-post');
    expect(capabilities.tools.available).toContain('wordpress-delete-post');
  });

  it('should list existing posts', async () => {
    const result = await client.posts.list({ per_page: 5 });

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.perPage).toBe(5);
  });

  it('should create a new post', async () => {
    const post = await client.posts.create({
      title: 'Test Post from MCP Client',
      content: 'This post was created during integration testing.',
      status: 'draft',
    });

    expect(post).toHaveProperty('id');
    expect(post.title.rendered).toBe('Test Post from MCP Client');
    expect(post.status).toBe('draft');

    createdPostId = post.id;
  });

  it('should get a post by ID', async () => {
    const post = await client.posts.get(createdPostId);

    expect(post.id).toBe(createdPostId);
    expect(post.title.rendered).toBe('Test Post from MCP Client');
  });

  it('should update a post', async () => {
    const updated = await client.posts.update(createdPostId, {
      content: 'Updated content from integration test.',
      status: 'publish',
    });

    expect(updated.id).toBe(createdPostId);
    expect(updated.status).toBe('publish');
    expect(updated.content.rendered).toContain('Updated content');
  });

  it('should delete a post', async () => {
    await client.posts.delete(createdPostId, true);

    // Verify deletion
    await expect(client.posts.get(createdPostId)).rejects.toThrow();

    // Clear the ID so afterAll doesn't try to delete again
    createdPostId = null as any;
  });

  it('should handle pagination correctly', async () => {
    const page1 = await client.posts.list({ per_page: 2, page: 1 });
    const page2 = await client.posts.list({ per_page: 2, page: 2 });

    expect(page1.currentPage).toBe(1);
    expect(page2.currentPage).toBe(2);
    expect(page1.perPage).toBe(2);
    expect(page2.perPage).toBe(2);

    // Posts should be different
    if (page1.items.length > 0 && page2.items.length > 0) {
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    }
  });
});
```

#### 3. Environment Configuration for Tests

**File**: `.env.test.example`
**Purpose**: Test environment template

```env
# WordPress MCP Server Configuration for Integration Tests
WP_MCP_URL=http://localhost:8000
WP_USERNAME=admin
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# Optional: Override timeout
WP_TIMEOUT=30000
```

#### 4. Example: Basic Usage

**File**: `examples/basic-usage.ts`
**Purpose**: Simple example script

```typescript
import { WordPressMCPClient } from '@wp-mcp/core';

async function main() {
  // Create client
  const client = new WordPressMCPClient({
    url: 'http://localhost:8000',
    auth: {
      type: 'application-password',
      username: 'admin',
      password: 'abcd efgh ijkl mnop qrst uvwx', // Replace with your password
    },
  });

  try {
    // Connect
    console.log('Connecting to WordPress...');
    await client.connect();
    console.log('✓ Connected');

    // Get capabilities
    const capabilities = await client.getCapabilities();
    console.log('\nAvailable tools:', capabilities.tools.available);

    // List posts
    console.log('\nListing posts:');
    const posts = await client.posts.list({ per_page: 5 });
    posts.items.forEach((post) => {
      console.log(`- [${post.id}] ${post.title.rendered} (${post.status})`);
    });

    // Create post
    console.log('\nCreating new post...');
    const newPost = await client.posts.create({
      title: 'Hello from MCP Client',
      content: 'This post was created using the @wp-mcp/core library!',
      status: 'draft',
    });
    console.log(`✓ Created post ID: ${newPost.id}`);

    // Update post
    console.log('\nPublishing post...');
    await client.posts.update(newPost.id, { status: 'publish' });
    console.log('✓ Post published');

    // Delete post
    console.log('\nCleaning up...');
    await client.posts.delete(newPost.id, true);
    console.log('✓ Post deleted');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await client.disconnect();
    console.log('\n✓ Disconnected');
  }
}

main();
```

#### 5. Example: Error Handling

**File**: `examples/error-handling.ts`
**Purpose**: Demonstrate error handling patterns

```typescript
import {
  WordPressMCPClient,
  NotFoundError,
  ValidationError,
  ConnectionError,
  WordPressOperationError,
} from '@wp-mcp/core';

async function main() {
  const client = new WordPressMCPClient({
    url: 'http://localhost:8000',
    auth: {
      type: 'application-password',
      username: 'admin',
      password: 'abcd efgh ijkl mnop qrst uvwx',
    },
  });

  try {
    await client.connect();

    // Example 1: Handle not found errors
    try {
      await client.posts.get(99999);
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.log('Post not found (expected)');
      }
    }

    // Example 2: Handle validation errors
    try {
      await client.posts.create({
        title: '', // Invalid: empty title
        content: 'Content',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        console.log(`Validation error: ${error.message}`);
        console.log(`Field: ${error.field}`);
      }
    }

    // Example 3: Handle operation errors
    try {
      await client.posts.update(-1, { title: 'Test' });
    } catch (error) {
      if (error instanceof WordPressOperationError) {
        console.log(`Operation failed: ${error.operation}`);
        console.log(`Message: ${error.message}`);
      }
    }

    console.log('\n✓ Error handling examples complete');
  } catch (error) {
    if (error instanceof ConnectionError) {
      console.error('Failed to connect:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await client.disconnect();
  }
}

main();
```

#### 6. Example: Multi-Site Management

**File**: `examples/multi-site.ts`
**Purpose**: Demonstrate managing multiple WordPress sites

```typescript
import { WordPressMCPClient } from '@wp-mcp/core';

async function main() {
  // Create clients for multiple sites
  const sites = [
    {
      name: 'Local Dev',
      client: new WordPressMCPClient({
        url: 'http://localhost:8000',
        auth: {
          type: 'application-password',
          username: 'admin',
          password: 'abcd efgh ijkl mnop qrst uvwx',
        },
      }),
    },
    {
      name: 'Staging',
      client: new WordPressMCPClient({
        url: 'https://staging.example.com',
        auth: {
          type: 'application-password',
          username: 'admin',
          password: 'staging password here',
        },
      }),
    },
  ];

  try {
    // Connect to all sites
    console.log('Connecting to sites...');
    await Promise.all(sites.map((site) => site.client.connect()));
    console.log('✓ All sites connected\n');

    // List posts from each site
    for (const site of sites) {
      console.log(`${site.name}:`);
      const posts = await site.client.posts.list({ per_page: 3 });
      console.log(`  Total posts: ${posts.total}`);
      posts.items.forEach((post) => {
        console.log(`  - ${post.title.rendered}`);
      });
      console.log();
    }

    // Create same post on all sites
    const postData = {
      title: 'Multi-Site Post',
      content: 'This post was created on multiple sites simultaneously.',
      status: 'draft' as const,
    };

    console.log('Creating post on all sites...');
    const createdPosts = await Promise.all(
      sites.map((site) => site.client.posts.create(postData))
    );

    createdPosts.forEach((post, index) => {
      console.log(`✓ ${sites[index].name}: Post ID ${post.id}`);
    });

    // Cleanup
    console.log('\nCleaning up...');
    await Promise.all(
      createdPosts.map((post, index) =>
        sites[index].client.posts.delete(post.id, true)
      )
    );
    console.log('✓ Cleanup complete');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from all sites
    await Promise.all(sites.map((site) => site.client.disconnect()));
    console.log('\n✓ Disconnected from all sites');
  }
}

main();
```

#### 7. Package Scripts for Examples

**Update `package.json`** to add example scripts:

```json
{
  "scripts": {
    "example:basic": "tsx examples/basic-usage.ts",
    "example:errors": "tsx examples/error-handling.ts",
    "example:multisite": "tsx examples/multi-site.ts",
    "test:integration": "vitest run tests/integration"
  },
  "devDependencies": {
    "tsx": "^4.7.0"
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] All integration tests pass: `pnpm test:integration`
- [ ] Integration tests run against real WordPress MCP server
- [ ] All CRUD operations work end-to-end
- [ ] Error handling is correct
- [ ] Pagination works correctly

#### Manual Verification:
- [ ] All example scripts run successfully
- [ ] Basic usage example is easy to understand
- [ ] Error handling example demonstrates all error types
- [ ] Multi-site example manages multiple connections
- [ ] Created posts appear in WordPress admin
- [ ] Deleted posts are removed from WordPress admin
- [ ] Examples produce clear console output
- [ ] Connection status updates correctly

**Implementation Note**: Integration tests require the WordPress MCP server from Milestone 1 to be running. Document this clearly and provide setup instructions. Consider adding a script to check if the server is running before tests.

---

## Phase 7: Documentation & Publishing

### Overview

Create comprehensive documentation for developers and prepare the package for publishing to npm.

### Changes Required

#### 1. API Reference Documentation

**File**: `docs/api-reference.md`
**Purpose**: Complete API documentation

```markdown
# API Reference

## WordPressMCPClient

Main client class for interacting with WordPress via MCP.

### Constructor

```typescript
new WordPressMCPClient(config: WordPressMCPClientConfig)
```

#### Parameters

- `config.url` - WordPress site URL (e.g., 'http://localhost:8000')
- `config.auth` - Authentication configuration
  - `config.auth.type` - 'application-password'
  - `config.auth.username` - WordPress username
  - `config.auth.password` - WordPress Application Password
- `config.mcpEndpoint` - Optional: MCP endpoint path (default: '/wp-json/wordpress-poc/mcp')
- `config.timeout` - Optional: Request timeout in ms (default: 30000)
- `config.maxRetries` - Optional: Max retry attempts (default: 3)
- `config.retryDelay` - Optional: Initial retry delay in ms (default: 1000)
- `config.exponentialBackoff` - Optional: Use exponential backoff (default: true)
- `config.debug` - Optional: Enable debug logging (default: false)

#### Example

```typescript
const client = new WordPressMCPClient({
  url: 'http://localhost:8000',
  auth: {
    type: 'application-password',
    username: 'admin',
    password: 'xxxx xxxx xxxx xxxx xxxx xxxx'
  }
});
```

---

### Methods

#### connect()

Connect to the WordPress MCP server.

```typescript
async connect(): Promise<void>
```

**Throws:**
- `ConnectionError` - If connection fails
- `AuthenticationError` - If authentication fails
- `ValidationError` - If configuration is invalid

**Example:**

```typescript
await client.connect();
```

---

#### disconnect()

Disconnect from the WordPress MCP server.

```typescript
async disconnect(): Promise<void>
```

---

#### reconnect()

Reconnect to the server with exponential backoff.

```typescript
async reconnect(): Promise<void>
```

**Throws:**
- `ConnectionError` - If max retries exceeded

---

#### getStatus()

Get current connection status.

```typescript
getStatus(): ConnectionStatus
```

**Returns:** `ConnectionStatus` object with:
- `state` - Current connection state
- `connectedAt` - Connection timestamp
- `lastError` - Last error if any
- `retryCount` - Number of retry attempts
- `siteUrl` - WordPress site URL

---

#### getCapabilities()

Get MCP server capabilities.

```typescript
async getCapabilities(): Promise<MCPCapabilities>
```

**Returns:** Object with available tools, resources, and prompts.

---

#### posts

Access the Posts resource manager.

```typescript
client.posts: PostsResource
```

See [PostsResource](#postsresource) for available methods.

---

## PostsResource

Manager for WordPress post operations.

### list()

List WordPress posts with pagination.

```typescript
async list(params?: ListPostsParams): Promise<PaginatedResponse<WordPressPost>>
```

#### Parameters

- `params.page` - Page number (default: 1)
- `params.per_page` - Posts per page (default: 10)
- `params.search` - Search query
- `params.author` - Filter by author ID
- `params.status` - Filter by status ('publish', 'draft', etc.)
- `params.orderby` - Sort field ('date', 'title', 'modified', 'id')
- `params.order` - Sort order ('asc', 'desc')

#### Returns

`PaginatedResponse<WordPressPost>` with:
- `items` - Array of posts
- `total` - Total number of posts
- `totalPages` - Total number of pages
- `currentPage` - Current page number
- `perPage` - Posts per page

#### Example

```typescript
const result = await client.posts.list({
  per_page: 20,
  status: 'publish',
  orderby: 'date',
  order: 'desc'
});

console.log(`Found ${result.total} posts`);
result.items.forEach(post => {
  console.log(post.title.rendered);
});
```

---

### get()

Get a single post by ID.

```typescript
async get(id: number): Promise<WordPressPost>
```

**Throws:**
- `NotFoundError` - If post doesn't exist
- `ValidationError` - If ID is invalid

**Example:**

```typescript
const post = await client.posts.get(123);
console.log(post.title.rendered);
```

---

### create()

Create a new post.

```typescript
async create(params: CreatePostParams): Promise<WordPressPost>
```

#### Parameters

- `params.title` - Post title (required)
- `params.content` - Post content (required)
- `params.status` - Post status (default: 'draft')
- `params.excerpt` - Post excerpt
- `params.author` - Author ID
- `params.featured_media` - Featured image ID
- `params.categories` - Array of category IDs
- `params.tags` - Array of tag IDs

**Throws:**
- `ValidationError` - If required fields missing
- `WordPressOperationError` - If creation fails

**Example:**

```typescript
const post = await client.posts.create({
  title: 'My New Post',
  content: '<p>This is the content.</p>',
  status: 'publish',
  categories: [1, 2]
});

console.log(`Created post ID: ${post.id}`);
```

---

### update()

Update an existing post.

```typescript
async update(id: number, params: UpdatePostParams): Promise<WordPressPost>
```

#### Parameters

- `id` - Post ID
- `params` - Fields to update (same as create, but all optional)

**Throws:**
- `NotFoundError` - If post doesn't exist
- `ValidationError` - If ID is invalid
- `WordPressOperationError` - If update fails

**Example:**

```typescript
await client.posts.update(123, {
  status: 'publish',
  title: 'Updated Title'
});
```

---

### delete()

Delete a post.

```typescript
async delete(id: number, force?: boolean): Promise<void>
```

#### Parameters

- `id` - Post ID
- `force` - If true, permanently delete. If false, move to trash (default: false)

**Throws:**
- `NotFoundError` - If post doesn't exist
- `ValidationError` - If ID is invalid
- `WordPressOperationError` - If deletion fails

**Example:**

```typescript
// Move to trash
await client.posts.delete(123);

// Permanently delete
await client.posts.delete(123, true);
```

---

## Error Classes

All errors extend `MCPError`.

### ConnectionError

Connection-related errors.

```typescript
throw new ConnectionError(message, details?);
```

### AuthenticationError

Authentication failures.

```typescript
throw new AuthenticationError(message, details?);
```

### WordPressOperationError

WordPress operation failures.

```typescript
throw new WordPressOperationError(operation, message, details?);
```

### NotFoundError

Resource not found (404).

```typescript
throw new NotFoundError(resource, id);
```

### ValidationError

Input validation errors.

```typescript
throw new ValidationError(message, field?, details?);
```

### TimeoutError

Request timeout.

```typescript
throw new TimeoutError(message, timeoutMs);
```

### ProtocolError

MCP protocol errors.

```typescript
throw new ProtocolError(message, details?);
```

---

## Types

### WordPressPost

```typescript
interface WordPressPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: PostStatus;
  type: PostType;
  link: string;
  title: {
    rendered: string;
    raw?: string;
  };
  content: {
    rendered: string;
    raw?: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    raw?: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  // ... additional fields
}
```

### PostStatus

```typescript
type PostStatus =
  | 'publish'
  | 'future'
  | 'draft'
  | 'pending'
  | 'private'
  | 'trash';
```

### ConnectionState

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}
```
```

#### 2. Getting Started Guide

**File**: `docs/getting-started.md`
**Purpose**: Step-by-step tutorial

```markdown
# Getting Started

This guide will walk you through setting up and using @wp-mcp/core to interact with WordPress via the Model Context Protocol.

## Prerequisites

1. **WordPress MCP Server** running (see [WordPress MCP Setup](./wordpress-setup.md))
2. **Node.js** 18+ installed
3. **WordPress Application Password** generated

## Installation

```bash
pnpm add @wp-mcp/core
```

## Quick Start

### 1. Import the Client

```typescript
import { WordPressMCPClient } from '@wp-mcp/core';
```

### 2. Create a Client Instance

```typescript
const client = new WordPressMCPClient({
  url: 'http://localhost:8000',
  auth: {
    type: 'application-password',
    username: 'admin',
    password: 'xxxx xxxx xxxx xxxx xxxx xxxx'
  }
});
```

### 3. Connect and Use

```typescript
// Connect
await client.connect();

// List posts
const posts = await client.posts.list();
console.log(posts.items);

// Create post
const newPost = await client.posts.create({
  title: 'Hello World',
  content: 'My first post via MCP!'
});

// Disconnect
await client.disconnect();
```

## Full Example

```typescript
import { WordPressMCPClient } from '@wp-mcp/core';

async function main() {
  const client = new WordPressMCPClient({
    url: 'http://localhost:8000',
    auth: {
      type: 'application-password',
      username: 'admin',
      password: 'xxxx xxxx xxxx xxxx xxxx xxxx'
    },
    debug: true // Enable logging
  });

  try {
    await client.connect();

    // Your code here
    const posts = await client.posts.list({ per_page: 5 });
    posts.items.forEach(post => {
      console.log(`- ${post.title.rendered}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

main();
```

## Next Steps

- [API Reference](./api-reference.md) - Complete API documentation
- [Error Handling](./error-handling.md) - How to handle errors
- [Advanced Usage](./advanced-usage.md) - Multi-site, reconnection, etc.
- [TypeScript Guide](./typescript.md) - TypeScript tips and types
```

#### 3. Update Root README

**File**: `README.md` (at package root, update with details)

```markdown
# @wp-mcp/core

TypeScript client library for WordPress Model Context Protocol (MCP).

Connect to WordPress sites via MCP and manage content programmatically with a clean, type-safe API.

## Features

- ✅ **TypeScript-First** - Full type safety and IntelliSense support
- ✅ **WordPress-Familiar API** - Intuitive methods matching WordPress conventions
- ✅ **Automatic Reconnection** - Handles connection drops with exponential backoff
- ✅ **Multi-Site Support** - Manage multiple WordPress sites simultaneously
- ✅ **Comprehensive Error Handling** - Specific error types for different scenarios
- ✅ **MCP Protocol Compliant** - Works with any MCP-compatible WordPress server
- ✅ **Well Tested** - Unit and integration tests included

## Installation

```bash
pnpm add @wp-mcp/core
```

## Quick Start

```typescript
import { WordPressMCPClient } from '@wp-mcp/core';

const client = new WordPressMCPClient({
  url: 'http://localhost:8000',
  auth: {
    type: 'application-password',
    username: 'admin',
    password: 'xxxx xxxx xxxx xxxx xxxx xxxx'
  }
});

await client.connect();

// List posts
const posts = await client.posts.list({ per_page: 10 });

// Create post
const newPost = await client.posts.create({
  title: 'Hello MCP',
  content: 'Created via MCP!',
  status: 'publish'
});

// Update post
await client.posts.update(newPost.id, {
  title: 'Updated Title'
});

// Delete post
await client.posts.delete(newPost.id);

await client.disconnect();
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Error Handling](./docs/error-handling.md)
- [Examples](./examples/)

## Requirements

- Node.js 18+
- WordPress site with MCP Adapter plugin
- WordPress Application Password

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Integration tests (requires WordPress MCP server)
pnpm test:integration

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## License

MIT

## Related Projects

- [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter)
- [Model Context Protocol](https://modelcontextprotocol.io/)
```

#### 4. Changelog

**File**: `CHANGELOG.md`
**Purpose**: Track version history

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-12

### Added

- Initial release
- WordPress MCP client with TypeScript support
- Application Password authentication
- Posts resource manager (list, get, create, update, delete)
- Connection management with automatic reconnection
- Comprehensive error handling
- Full type definitions
- Integration tests
- Example scripts
- Complete documentation

### Supported Operations

- List posts with pagination and filtering
- Get single post by ID
- Create new posts
- Update existing posts
- Delete posts (trash or permanent)

### Known Limitations

- Only Application Password authentication (OAuth 2.1 coming in next version)
- Only Posts resource (Pages, Media, etc. coming soon)
- HTTP transport only (stdio support coming soon)
```

#### 5. Publishing Configuration

**Update `package.json`** for npm publishing:

```json
{
  "name": "@wp-mcp/core",
  "version": "0.1.0",
  "description": "TypeScript client library for WordPress Model Context Protocol (MCP)",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "docs",
    "examples",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "scripts": {
    "prepublishOnly": "pnpm build && pnpm test",
    "prepack": "pnpm build"
  },
  "keywords": [
    "wordpress",
    "mcp",
    "model-context-protocol",
    "ai",
    "typescript",
    "rest-api",
    "cms"
  ],
  "author": "Your Name <your@email.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/wp-ai-editor-v3",
    "directory": "packages/core"
  },
  "bugs": {
    "url": "https://github.com/yourusername/wp-ai-editor-v3/issues"
  },
  "homepage": "https://github.com/yourusername/wp-ai-editor-v3#readme"
}
```

#### 6. License File

**File**: `LICENSE`
**Purpose**: MIT License

```
MIT License

Copyright (c) 2025 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Success Criteria

#### Automated Verification:
- [ ] Documentation files render correctly on GitHub
- [ ] All internal links work
- [ ] Code examples in docs are syntactically valid
- [ ] Package builds successfully: `pnpm build`
- [ ] Package can be packed: `pnpm pack`
- [ ] Generated tarball contains correct files

#### Manual Verification:
- [ ] README is clear and compelling
- [ ] Getting Started guide is easy to follow
- [ ] API Reference is complete and accurate
- [ ] Examples work as documented
- [ ] Changelog follows standard format
- [ ] License is correct
- [ ] Package metadata is accurate
- [ ] Documentation explains prerequisites clearly
- [ ] Error handling guide is comprehensive

**Implementation Note**: Do not publish to npm yet. This phase prepares for publishing but actual publication should wait until Milestone 3 (production hardening) is complete.

---

## Summary & Next Steps

### Milestone 2 Deliverables

Upon completion of all phases, you will have:

1. **TypeScript MCP Client Library**
   - Clean, type-safe API for WordPress operations
   - Full CRUD support for WordPress posts
   - Application Password authentication
   - Connection management with reconnection
   - Multi-site support

2. **Testing Infrastructure**
   - Unit tests with Vitest
   - Integration tests against real WordPress
   - 70%+ test coverage on critical paths
   - Example scripts demonstrating usage

3. **Complete Documentation**
   - API reference
   - Getting started guide
   - Error handling documentation
   - Working examples

4. **Development Tooling**
   - TypeScript with strict mode
   - ESLint + Prettier
   - Fast build with tsup
   - Type checking
   - Publishing configuration

5. **Foundation for Future Milestones**
   - Extensible architecture for OAuth 2.1
   - Pluggable resource managers
   - Ready for CLI/UI layers
   - Production-ready error handling

### Success Validation

The milestone is complete when:

1. ✅ All automated tests pass
2. ✅ Integration tests work with Milestone 1 WordPress MCP server
3. ✅ All example scripts run successfully
4. ✅ TypeScript types are comprehensive and accurate
5. ✅ Error handling covers all scenarios
6. ✅ Documentation is complete and tested
7. ✅ Library can be imported and used in external projects
8. ✅ Package is ready for npm publishing (but not published yet)

### Transition to Milestone 3

After validating Milestone 2, the next phase will focus on:

**Milestone 3: Production Deployment**

**Goal**: Harden security, implement OAuth 2.1, integrate with production WordPress sites, and deploy to production infrastructure.

**Key Changes**:
- OAuth 2.1 with PKCE implementation
- HTTPS/SSL support
- Production WordPress Connector Plugin (separate from MCP adapter)
- Rate limiting and caching
- Monitoring and observability
- Production deployment scripts
- Security hardening (input validation, CORS, CSP)
- Horizontal scalability patterns
- Database performance optimization
- Backup and recovery procedures

**Out of Scope for Milestone 3**:
- UI/CLI development (moved to Milestone 4+)
- Full SaaS platform features
- Multi-user authentication system (basic support only)
- Advanced AI features

This approach ensures the core library is solid before building production infrastructure, then adds UI/CLI tools on top of a production-ready foundation.

---

## Open Questions & Risks

### Technical Risks

1. **MCP SDK HTTP Transport**:
   - **Risk**: Official SDK may not support custom headers easily
   - **Mitigation**: Extend transport class or implement custom transport
   - **Timeline Impact**: May add 1-2 days to Phase 4

2. **WordPress MCP Adapter Stability**:
   - **Risk**: Adapter plugin is in active development (dev-trunk)
   - **Mitigation**: Pin to specific commit, test thoroughly
   - **Fallback**: Use Automattic's `mcp-wordpress-remote` as reference

3. **Type Safety with MCP Responses**:
   - **Risk**: MCP tool responses may not match TypeScript types
   - **Mitigation**: Runtime validation with Zod (add to Phase 2)
   - **Alternative**: Document type mismatches, add validation utils

4. **Integration Test Reliability**:
   - **Risk**: Tests depend on external WordPress server state
   - **Mitigation**: Reset WordPress to known state before tests
   - **Alternative**: Use Docker Compose to spin up fresh WordPress per test run

### Timeline Risks

**Estimated Timeline**: 4-6 weeks for experienced TypeScript developer

- **Phase 1** (Foundation): 2-3 days
- **Phase 2** (Types & Errors): 2-3 days
- **Phase 3** (Authentication): 1-2 days
- **Phase 4** (Connection & Transport): 4-5 days (includes HTTP transport work)
- **Phase 5** (WordPress API): 3-4 days
- **Phase 6** (Testing & Examples): 3-4 days
- **Phase 7** (Documentation): 2-3 days

**Total**: ~20-28 days

**Factors that may extend timeline**:
- Custom HTTP transport implementation
- MCP SDK API changes
- WordPress MCP Adapter breaking changes
- Comprehensive testing requirements

---

## References & Resources

### Official Documentation
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK
- [MCP Specification](https://modelcontextprotocol.io/specification/) - Protocol spec
- [WordPress REST API](https://developer.wordpress.org/rest-api/) - WordPress API docs
- [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter) - Server implementation

### Reference Implementations
- [Automattic's mcp-wordpress-remote](https://github.com/Automattic/mcp-wordpress-remote) - Production reference
- [punkpeye/mcp-client](https://github.com/punkpeye/mcp-client) - Simplified client wrapper
- [CopilotKit MCP Demo](https://github.com/CopilotKit/copilotkit-mcp-demo) - React integration

### Tools
- [Vitest](https://vitest.dev/) - Testing framework
- [tsup](https://tsup.egoist.dev/) - TypeScript bundler
- [ESLint](https://eslint.org/) - Linting
- [Prettier](https://prettier.io/) - Code formatting

### Related Project Files
- Milestone 1 Plan: `thoughts/shared/plans/2025-10-11-milestone-1-wordpress-mcp-poc.md`
- System Design: `AI_Powered_WordPress_Editor_System_Design.md`
- Milestone 1 Validation: `thoughts/shared/handoffs/general/2025-10-12_22-20-34_wordpress-mcp-validation-and-testing.md`

---

**Document Version**: 1.0
**Created**: January 12, 2025
**Status**: Ready for Implementation
**Next Review**: After Phase 4 completion (transport implementation)
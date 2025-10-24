# Client Onboarding with Complete Site Export - Implementation Plan

## Overview

Implement a complete client onboarding system that exports the user's entire WordPress site (content, media, settings) and provisions an isolated on-demand sandbox environment. This allows the AI editor to work with real client content in a safe, isolated environment before syncing changes back to production.

## Current State Analysis

### What We Have ✅
- **MCP Infrastructure**: WordPress MCP Adapter with Abilities API
- **Existing Abilities**: 5 core abilities (get-post, list-posts, create-post, update-post, delete-post)
- **Dual Environment**: Sandbox (port 8000) + Production (port 8001) Docker setup
- **Change Tracking**: In-memory change tracking and production sync (`lib/sync/`)
- **MCP Client**: HTTP-based MCP client with Application Password authentication (`lib/mcp/`)
- **Next.js App**: Basic API routes and structure
- **No Database**: Everything is in-memory (no persistence)
- **No Onboarding**: Manual Docker setup required

### Current Gaps ❌
- No multi-tenant client data storage (PostgreSQL needed)
- No user authentication/authorization system
- No export functionality (only basic CRUD)
- No media handling (only metadata operations)
- No background job processing
- No onboarding UI/flow
- No automated sandbox provisioning
- No client isolation (single shared WordPress)

## Desired End State

### User Experience
1. User visits onboarding page, provides WordPress site URL + Application Password
2. System validates credentials and starts export in background
3. User sees progress updates (exporting posts, media, settings...)
4. System provisions isolated sandbox Docker container with client's data
5. User receives notification when sandbox is ready (~5-15 minutes)
6. User can immediately use AI editor with their real content

### Technical Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Next.js SaaS (Vercel)                │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Onboarding UI + API Routes              │   │
│  │  • /onboarding - Connection form                │   │
│  │  • /api/onboarding/connect - Validate + start   │   │
│  │  • /api/onboarding/status - Progress polling    │   │
│  └─────────────────────────────────────────────────┘   │
│                        ↓                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │         PostgreSQL (Vercel Postgres)            │   │
│  │  • clients - Client site info                   │   │
│  │  • export_jobs - Background job tracking        │   │
│  │  • sandbox_instances - Docker container refs    │   │
│  └─────────────────────────────────────────────────┘   │
│                        ↓                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │         BullMQ Job Queue (Redis/Upstash)        │   │
│  │  • export-site - Export WordPress data          │   │
│  │  • download-media - Download media files        │   │
│  │  • provision-sandbox - Create Docker container  │   │
│  │  • import-content - Import to sandbox WP        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────────────────────────┐
         │   Client Production WordPress    │
         │   (HTTP/MCP + App Password)      │
         └──────────────────────────────────┘
                        ↓ (export data)
         ┌──────────────────────────────────┐
         │  Docker Host (Railway/Render)    │
         │                                   │
         │  ┌────────────────────────────┐  │
         │  │ Client A Sandbox Container │  │
         │  │ - WordPress (isolated DB)  │  │
         │  │ - Nginx (proxy fallback)   │  │
         │  │ - Client content + media   │  │
         │  └────────────────────────────┘  │
         │  ┌────────────────────────────┐  │
         │  │ Client B Sandbox Container │  │
         │  └────────────────────────────┘  │
         └──────────────────────────────────┘
```

### Verification Criteria
- User can complete onboarding in under 15 minutes for typical site (100 posts, 50 media)
- Exported data includes: posts, pages, media, categories, tags, site settings, plugin/theme info
- Each client has isolated sandbox Docker container with own database
- Media files are selectively downloaded (only referenced content)
- Missing media proxied from production as fallback
- Export job survives server restarts (persisted in PostgreSQL)
- Progress updates visible in real-time to user

## What We're NOT Doing

- **Not implementing user authentication** (NextAuth/Clerk) - Can be added later
- **Not supporting multi-user workspaces** initially - One client = one user for MVP
- **Not exporting theme/plugin files** - Only metadata (name, version, active status)
- **Not handling WordPress multisite** - Single site only for MVP
- **Not implementing undo/rollback** on production sync - Existing change tracker is sufficient
- **Not supporting custom Docker registries** - Use Docker Hub images
- **Not implementing real-time sync** - One-time export on onboarding, manual refresh later
- **Not handling WordPress updates** during export - Snapshot at point in time

---

## Phase 1: Database Schema & Client Data Model

### Overview
Set up PostgreSQL database with Drizzle ORM for multi-tenant client data storage, export job tracking, and sandbox instance management.

### Changes Required

#### 1. Database Setup & Drizzle ORM Configuration

**File**: `lib/db/schema.ts`
**Changes**: Create new file with Drizzle schema definitions

```typescript
import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Export job status enum
export const exportJobStatusEnum = pgEnum('export_job_status', [
  'pending',
  'validating',
  'exporting_content',
  'downloading_media',
  'provisioning_sandbox',
  'importing_content',
  'completed',
  'failed'
]);

// Clients table - stores connected WordPress sites
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteUrl: text('site_url').notNull().unique(),
  siteName: text('site_name'),

  // Encrypted credentials (using AES-256-GCM as per ARCHITECTURE_DECISION.md)
  mcpUrl: text('mcp_url').notNull(),
  mcpUsername: text('mcp_username').notNull(),
  mcpPasswordEncrypted: text('mcp_password_encrypted').notNull(), // Encrypted

  // Metadata
  wordpressVersion: text('wordpress_version'),
  phpVersion: text('php_version'),
  exportedAt: timestamp('exported_at'),

  // Status
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Export jobs table - tracks background export operations
export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),

  // Job status
  status: exportJobStatusEnum('status').default('pending').notNull(),
  currentStep: text('current_step'),
  progress: integer('progress').default(0), // 0-100

  // Export summary
  totalPosts: integer('total_posts').default(0),
  totalPages: integer('total_pages').default(0),
  totalMedia: integer('total_media').default(0),
  totalCategories: integer('total_categories').default(0),
  totalTags: integer('total_tags').default(0),

  // Export data (stored as JSON)
  exportData: jsonb('export_data'), // Exported WordPress data

  // Error tracking
  error: text('error'),
  errorDetails: jsonb('error_details'),

  // Timestamps
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sandbox instances table - tracks Docker containers
export const sandboxInstances = pgTable('sandbox_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),

  // Docker info
  containerId: text('container_id').unique(),
  containerName: text('container_name').unique(),
  port: integer('port').notNull(),

  // Database info
  dbName: text('db_name').notNull(),
  dbUser: text('db_user').notNull(),
  dbPasswordEncrypted: text('db_password_encrypted').notNull(),

  // MCP connection for sandbox
  sandboxMcpUrl: text('sandbox_mcp_url').notNull(),

  // Status
  status: text('status').notNull(), // 'provisioning', 'running', 'stopped', 'error'
  isActive: boolean('is_active').default(true),

  // Resource tracking
  mediaStorageMb: integer('media_storage_mb').default(0),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
});

// Media files table - tracks downloaded media
export const mediaFiles = pgTable('media_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),

  // WordPress media data
  wordpressMediaId: integer('wordpress_media_id').notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(), // e.g., "2024/01/image.jpg"
  fileSize: integer('file_size'), // bytes
  mimeType: text('mime_type'),

  // Storage info
  isDownloaded: boolean('is_downloaded').default(false),
  localPath: text('local_path'), // Path in Docker volume
  productionUrl: text('production_url').notNull(), // Fallback URL

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  exportJobs: many(exportJobs),
  sandboxInstances: many(sandboxInstances),
  mediaFiles: many(mediaFiles),
}));

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  client: one(clients, {
    fields: [exportJobs.clientId],
    references: [clients.id],
  }),
}));

export const sandboxInstancesRelations = relations(sandboxInstances, ({ one }) => ({
  client: one(clients, {
    fields: [sandboxInstances.clientId],
    references: [clients.id],
  }),
}));

export const mediaFilesRelations = relations(mediaFiles, ({ one }) => ({
  client: one(clients, {
    fields: [mediaFiles.clientId],
    references: [clients.id],
  }),
}));
```

**File**: `lib/db/index.ts`
**Changes**: Create new file for database connection

```typescript
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

// Create Drizzle instance
export const db = drizzle(sql, { schema });

// Export schema for use in queries
export * from './schema';
```

**File**: `lib/db/queries.ts`
**Changes**: Create new file with common database queries

```typescript
import { db, clients, exportJobs, sandboxInstances, mediaFiles } from './index';
import { eq, desc } from 'drizzle-orm';

export const clientQueries = {
  // Create new client
  async create(data: {
    siteUrl: string;
    siteName?: string;
    mcpUrl: string;
    mcpUsername: string;
    mcpPasswordEncrypted: string;
  }) {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  },

  // Get client by site URL
  async getBySiteUrl(siteUrl: string) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.siteUrl, siteUrl))
      .limit(1);
    return client;
  },

  // Get client by ID
  async getById(id: string) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return client;
  },

  // Update client
  async update(id: string, data: Partial<typeof clients.$inferInsert>) {
    const [updated] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updated;
  },
};

export const exportJobQueries = {
  // Create export job
  async create(clientId: string) {
    const [job] = await db
      .insert(exportJobs)
      .values({
        clientId,
        status: 'pending',
        startedAt: new Date(),
      })
      .returning();
    return job;
  },

  // Get job by ID
  async getById(id: string) {
    const [job] = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.id, id))
      .limit(1);
    return job;
  },

  // Update job status
  async updateStatus(
    id: string,
    status: string,
    updates?: {
      currentStep?: string;
      progress?: number;
      error?: string;
      errorDetails?: any;
    }
  ) {
    const [updated] = await db
      .update(exportJobs)
      .set({
        status: status as any,
        ...updates,
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      })
      .where(eq(exportJobs.id, id))
      .returning();
    return updated;
  },

  // Get latest job for client
  async getLatestForClient(clientId: string) {
    const [job] = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.clientId, clientId))
      .orderBy(desc(exportJobs.createdAt))
      .limit(1);
    return job;
  },
};

export const sandboxQueries = {
  // Create sandbox instance
  async create(data: {
    clientId: string;
    containerId: string;
    containerName: string;
    port: number;
    dbName: string;
    dbUser: string;
    dbPasswordEncrypted: string;
    sandboxMcpUrl: string;
  }) {
    const [instance] = await db
      .insert(sandboxInstances)
      .values({ ...data, status: 'provisioning' })
      .returning();
    return instance;
  },

  // Get sandbox by client ID
  async getByClientId(clientId: string) {
    const [instance] = await db
      .select()
      .from(sandboxInstances)
      .where(eq(sandboxInstances.clientId, clientId))
      .limit(1);
    return instance;
  },

  // Update sandbox status
  async updateStatus(id: string, status: string) {
    const [updated] = await db
      .update(sandboxInstances)
      .set({ status, lastAccessedAt: new Date() })
      .where(eq(sandboxInstances.id, id))
      .returning();
    return updated;
  },
};

export const mediaQueries = {
  // Bulk insert media files
  async bulkCreate(
    clientId: string,
    mediaItems: Array<{
      wordpressMediaId: number;
      fileName: string;
      filePath: string;
      fileSize?: number;
      mimeType?: string;
      productionUrl: string;
    }>
  ) {
    const values = mediaItems.map((item) => ({
      clientId,
      ...item,
    }));
    return await db.insert(mediaFiles).values(values).returning();
  },

  // Mark media as downloaded
  async markDownloaded(id: string, localPath: string) {
    const [updated] = await db
      .update(mediaFiles)
      .set({ isDownloaded: true, localPath })
      .where(eq(mediaFiles.id, id))
      .returning();
    return updated;
  },

  // Get media by client
  async getByClientId(clientId: string) {
    return await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.clientId, clientId));
  },
};
```

#### 2. Environment Variables & Configuration

**File**: `.env.local.example`
**Changes**: Add database and encryption configuration

```bash
# Existing WordPress MCP connections...
WORDPRESS_MCP_URL=http://localhost:8000/wp-json/wordpress-poc/mcp
WORDPRESS_MCP_USERNAME=admin
WORDPRESS_MCP_PASSWORD=your_app_password

# PostgreSQL Database (Vercel Postgres)
POSTGRES_URL="postgres://user:pass@host:5432/dbname"
POSTGRES_PRISMA_URL="postgres://user:pass@host:5432/dbname?pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://user:pass@host:5432/dbname"

# Encryption for credentials (AES-256-GCM)
ENCRYPTION_KEY="generate_with_openssl_rand_hex_32"  # 32 bytes hex

# Redis/Upstash for BullMQ
REDIS_URL="redis://:password@host:6379"

# Docker host for sandbox provisioning
DOCKER_HOST="unix:///var/run/docker.sock"  # Local development
# DOCKER_HOST="tcp://railway-docker-host:2376"  # Production

# Base URL for sandbox instances
SANDBOX_BASE_URL="http://localhost"  # Local
# SANDBOX_BASE_URL="https://sandboxes.yourdomain.com"  # Production
```

#### 3. Encryption Utilities

**File**: `lib/crypto/encryption.ts`
**Changes**: Create new file for credential encryption

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Generate encryption key (for setup)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

#### 4. Database Migrations

**File**: `drizzle.config.ts`
**Changes**: Create new file for Drizzle configuration

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL || '',
  },
} satisfies Config;
```

**File**: `package.json`
**Changes**: Add Drizzle scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:migrate": "tsx lib/db/migrate.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] Database migrations run successfully: `pnpm db:push`
- [ ] Schema is generated: `pnpm db:generate`
- [ ] TypeScript types are inferred correctly: `pnpm tsc --noEmit`
- [ ] Environment variables are loaded: Check `.env.local` exists with all required vars
- [ ] Encryption works: Run test script `tsx scripts/test/test-encryption.ts`

#### Manual Verification:
- [ ] Can connect to Vercel Postgres from local environment
- [ ] Can create a test client record with encrypted credentials
- [ ] Can query client data using Drizzle queries
- [ ] Drizzle Studio shows correct schema: `pnpm db:studio`
- [ ] Encrypted passwords cannot be read from database directly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Extended WordPress MCP Abilities for Export

### Overview
Add new WordPress MCP abilities to export complete site data beyond basic posts. This extends the existing abilities in `wp-content/mu-plugins/register-wordpress-abilities.php`.

### Changes Required

#### 1. Add Export Abilities to WordPress Plugin

**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add new export abilities after existing ones (after line 415)

```php
<?php
// Add these new abilities in the abilities_api_init hook (after line 415)

    // Register "list pages" ability
    $list_pages = wp_register_ability('wordpress/list-pages', [
        'label' => 'List Pages',
        'description' => 'Lists WordPress pages with pagination',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'per_page' => [
                    'type' => 'integer',
                    'description' => 'Number of pages per request',
                    'default' => 100,
                ],
                'page' => [
                    'type' => 'integer',
                    'description' => 'Page number',
                    'default' => 1,
                ],
            ],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'pages' => ['type' => 'array'],
                'total' => ['type' => 'integer'],
                'page' => ['type' => 'integer'],
                'per_page' => ['type' => 'integer'],
            ],
        ],
        'execute_callback' => function($input) {
            $per_page = $input['per_page'] ?? 100;
            $page = $input['page'] ?? 1;

            $args = [
                'post_type' => 'page',
                'posts_per_page' => $per_page,
                'paged' => $page,
                'post_status' => 'any',
            ];

            $pages = get_posts($args);
            $total = wp_count_posts('page');

            return [
                'pages' => array_map(function($page) {
                    return [
                        'id' => $page->ID,
                        'title' => $page->post_title,
                        'content' => $page->post_content,
                        'status' => $page->post_status,
                        'date' => $page->post_date,
                        'modified' => $page->post_modified,
                        'parent' => $page->post_parent,
                        'menu_order' => $page->menu_order,
                    ];
                }, $pages),
                'total' => (int) $total->publish + $total->draft + $total->pending + $total->private,
                'page' => $page,
                'per_page' => $per_page,
            ];
        },
        'permission_callback' => function($input) {
            return is_user_logged_in();
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($list_pages) {
        error_log('✓ Registered ability: wordpress/list-pages');
    }

    // Register "list media" ability
    $list_media = wp_register_ability('wordpress/list-media', [
        'label' => 'List Media',
        'description' => 'Lists WordPress media files with metadata',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'per_page' => [
                    'type' => 'integer',
                    'description' => 'Number of media items per request',
                    'default' => 100,
                ],
                'page' => [
                    'type' => 'integer',
                    'description' => 'Page number',
                    'default' => 1,
                ],
            ],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'media' => ['type' => 'array'],
                'total' => ['type' => 'integer'],
                'page' => ['type' => 'integer'],
                'per_page' => ['type' => 'integer'],
            ],
        ],
        'execute_callback' => function($input) {
            $per_page = $input['per_page'] ?? 100;
            $page = $input['page'] ?? 1;

            $args = [
                'post_type' => 'attachment',
                'posts_per_page' => $per_page,
                'paged' => $page,
                'post_status' => 'any',
            ];

            $attachments = get_posts($args);
            $total = wp_count_posts('attachment');

            return [
                'media' => array_map(function($attachment) {
                    $metadata = wp_get_attachment_metadata($attachment->ID);
                    return [
                        'id' => $attachment->ID,
                        'title' => $attachment->post_title,
                        'filename' => basename(get_attached_file($attachment->ID)),
                        'url' => wp_get_attachment_url($attachment->ID),
                        'mime_type' => $attachment->post_mime_type,
                        'file_path' => $metadata['file'] ?? '',
                        'file_size' => filesize(get_attached_file($attachment->ID)) ?: 0,
                        'width' => $metadata['width'] ?? null,
                        'height' => $metadata['height'] ?? null,
                        'alt_text' => get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
                        'date' => $attachment->post_date,
                    ];
                }, $attachments),
                'total' => (int) $total->inherit,
                'page' => $page,
                'per_page' => $per_page,
            ];
        },
        'permission_callback' => function($input) {
            return is_user_logged_in();
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($list_media) {
        error_log('✓ Registered ability: wordpress/list-media');
    }

    // Register "list categories" ability
    $list_categories = wp_register_ability('wordpress/list-categories', [
        'label' => 'List Categories',
        'description' => 'Lists all WordPress categories',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'categories' => ['type' => 'array'],
                'total' => ['type' => 'integer'],
            ],
        ],
        'execute_callback' => function($input) {
            $categories = get_categories(['hide_empty' => false]);

            return [
                'categories' => array_map(function($cat) {
                    return [
                        'id' => $cat->term_id,
                        'name' => $cat->name,
                        'slug' => $cat->slug,
                        'description' => $cat->description,
                        'parent' => $cat->parent,
                        'count' => $cat->count,
                    ];
                }, $categories),
                'total' => count($categories),
            ];
        },
        'permission_callback' => function($input) {
            return is_user_logged_in();
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($list_categories) {
        error_log('✓ Registered ability: wordpress/list-categories');
    }

    // Register "list tags" ability
    $list_tags = wp_register_ability('wordpress/list-tags', [
        'label' => 'List Tags',
        'description' => 'Lists all WordPress tags',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'tags' => ['type' => 'array'],
                'total' => ['type' => 'integer'],
            ],
        ],
        'execute_callback' => function($input) {
            $tags = get_tags(['hide_empty' => false]);

            return [
                'tags' => array_map(function($tag) {
                    return [
                        'id' => $tag->term_id,
                        'name' => $tag->name,
                        'slug' => $tag->slug,
                        'description' => $tag->description,
                        'count' => $tag->count,
                    ];
                }, $tags),
                'total' => count($tags),
            ];
        },
        'permission_callback' => function($input) {
            return is_user_logged_in();
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($list_tags) {
        error_log('✓ Registered ability: wordpress/list-tags');
    }

    // Register "get site options" ability
    $get_site_options = wp_register_ability('wordpress/get-site-options', [
        'label' => 'Get Site Options',
        'description' => 'Exports WordPress site configuration options',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'options' => ['type' => 'object'],
                'theme_mods' => ['type' => 'object'],
            ],
        ],
        'execute_callback' => function($input) {
            // Safe options to export (no passwords/secrets)
            $safe_options = [
                'blogname',
                'blogdescription',
                'siteurl',
                'home',
                'admin_email',
                'default_category',
                'default_post_format',
                'timezone_string',
                'date_format',
                'time_format',
                'start_of_week',
                'permalink_structure',
                'posts_per_page',
                'default_comment_status',
                'default_ping_status',
            ];

            $options = [];
            foreach ($safe_options as $option) {
                $options[$option] = get_option($option);
            }

            // Get theme mods for active theme
            $theme_mods = get_theme_mods();

            return [
                'options' => $options,
                'theme_mods' => $theme_mods ?: [],
            ];
        },
        'permission_callback' => function($input) {
            return current_user_can('manage_options');
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($get_site_options) {
        error_log('✓ Registered ability: wordpress/get-site-options');
    }

    // Register "get plugins list" ability
    $get_plugins_list = wp_register_ability('wordpress/get-plugins-list', [
        'label' => 'Get Plugins List',
        'description' => 'Lists installed and active plugins',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'plugins' => ['type' => 'array'],
                'active_plugins' => ['type' => 'array'],
            ],
        ],
        'execute_callback' => function($input) {
            if (!function_exists('get_plugins')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }

            $all_plugins = get_plugins();
            $active_plugins = get_option('active_plugins', []);

            $plugins_data = [];
            foreach ($all_plugins as $plugin_path => $plugin_info) {
                $plugins_data[] = [
                    'name' => $plugin_info['Name'],
                    'version' => $plugin_info['Version'],
                    'plugin_uri' => $plugin_info['PluginURI'] ?? '',
                    'author' => $plugin_info['Author'] ?? '',
                    'is_active' => in_array($plugin_path, $active_plugins),
                    'path' => $plugin_path,
                ];
            }

            return [
                'plugins' => $plugins_data,
                'active_plugins' => $active_plugins,
            ];
        },
        'permission_callback' => function($input) {
            return current_user_can('activate_plugins');
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($get_plugins_list) {
        error_log('✓ Registered ability: wordpress/get-plugins-list');
    }

    // Register "get theme config" ability
    $get_theme_config = wp_register_ability('wordpress/get-theme-config', [
        'label' => 'Get Theme Config',
        'description' => 'Exports active theme configuration',
        'category' => 'wordpress',
        'input_schema' => [
            'type' => 'object',
            'properties' => [],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'active_theme' => ['type' => 'object'],
                'theme_mods' => ['type' => 'object'],
                'custom_css' => ['type' => 'string'],
            ],
        ],
        'execute_callback' => function($input) {
            $theme = wp_get_theme();

            return [
                'active_theme' => [
                    'name' => $theme->get('Name'),
                    'version' => $theme->get('Version'),
                    'author' => $theme->get('Author'),
                    'template' => $theme->get_template(),
                    'stylesheet' => $theme->get_stylesheet(),
                    'theme_uri' => $theme->get('ThemeURI'),
                ],
                'theme_mods' => get_theme_mods() ?: [],
                'custom_css' => wp_get_custom_css(),
            ];
        },
        'permission_callback' => function($input) {
            return current_user_can('edit_theme_options');
        },
        'meta' => ['show_in_rest' => true],
    ]);

    if ($get_theme_config) {
        error_log('✓ Registered ability: wordpress/get-theme-config');
    }
```

#### 2. Update TypeScript Tool Schemas

**File**: `lib/tools/wordpress-schemas.ts`
**Changes**: Add schemas for new export abilities

```typescript
import { z } from 'zod';

// Existing schemas...

// List pages schema
export const listPagesSchema = z.object({
  per_page: z.number().int().optional().default(100),
  page: z.number().int().optional().default(1),
});

export type ListPagesInput = z.infer<typeof listPagesSchema>;

// List media schema
export const listMediaSchema = z.object({
  per_page: z.number().int().optional().default(100),
  page: z.number().int().optional().default(1),
});

export type ListMediaInput = z.infer<typeof listMediaSchema>;

// List categories schema (no input)
export const listCategoriesSchema = z.object({});
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

// List tags schema (no input)
export const listTagsSchema = z.object({});
export type ListTagsInput = z.infer<typeof listTagsSchema>;

// Get site options schema (no input)
export const getSiteOptionsSchema = z.object({});
export type GetSiteOptionsInput = z.infer<typeof getSiteOptionsSchema>;

// Get plugins list schema (no input)
export const getPluginsListSchema = z.object({});
export type GetPluginsListInput = z.infer<typeof getPluginsListSchema>;

// Get theme config schema (no input)
export const getThemeConfigSchema = z.object({});
export type GetThemeConfigInput = z.infer<typeof getThemeConfigSchema>;
```

#### 3. Create Export Orchestration Service

**File**: `lib/export/wordpress-exporter.ts`
**Changes**: Create new file for export orchestration

```typescript
import { WordPressMcpClient } from '../mcp/wordpress-client';

export interface ExportProgress {
  step: string;
  progress: number; // 0-100
  message: string;
}

export interface WordPressExportData {
  metadata: {
    site_url: string;
    site_name: string;
    wordpress_version?: string;
    export_date: string;
  };
  posts: any[];
  pages: any[];
  media: any[];
  categories: any[];
  tags: any[];
  options: any;
  plugins: any[];
  theme: any;
}

export class WordPressExporter {
  private client: WordPressMcpClient;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(
    client: WordPressMcpClient,
    onProgress?: (progress: ExportProgress) => void
  ) {
    this.client = client;
    this.onProgress = onProgress;
  }

  private reportProgress(step: string, progress: number, message: string) {
    if (this.onProgress) {
      this.onProgress({ step, progress, message });
    }
  }

  async export(): Promise<WordPressExportData> {
    const exportData: WordPressExportData = {
      metadata: {
        site_url: '',
        site_name: '',
        export_date: new Date().toISOString(),
      },
      posts: [],
      pages: [],
      media: [],
      categories: [],
      tags: [],
      options: {},
      plugins: [],
      theme: {},
    };

    try {
      // Step 1: Get site options (0-10%)
      this.reportProgress('options', 5, 'Exporting site settings...');
      const optionsResult = await this.client.callTool('wordpress/get-site-options', {});
      const optionsData = this.parseToolResult(optionsResult);
      exportData.options = optionsData.options || {};
      exportData.metadata.site_name = optionsData.options?.blogname || '';
      exportData.metadata.site_url = optionsData.options?.siteurl || '';

      // Step 2: Get plugins list (10-15%)
      this.reportProgress('plugins', 12, 'Exporting plugins configuration...');
      const pluginsResult = await this.client.callTool('wordpress/get-plugins-list', {});
      const pluginsData = this.parseToolResult(pluginsResult);
      exportData.plugins = pluginsData.plugins || [];

      // Step 3: Get theme config (15-20%)
      this.reportProgress('theme', 17, 'Exporting theme configuration...');
      const themeResult = await this.client.callTool('wordpress/get-theme-config', {});
      exportData.theme = this.parseToolResult(themeResult);

      // Step 4: Get categories (20-25%)
      this.reportProgress('categories', 22, 'Exporting categories...');
      const categoriesResult = await this.client.callTool('wordpress/list-categories', {});
      const categoriesData = this.parseToolResult(categoriesResult);
      exportData.categories = categoriesData.categories || [];

      // Step 5: Get tags (25-30%)
      this.reportProgress('tags', 27, 'Exporting tags...');
      const tagsResult = await this.client.callTool('wordpress/list-tags', {});
      const tagsData = this.parseToolResult(tagsResult);
      exportData.tags = tagsData.tags || [];

      // Step 6: Get posts with pagination (30-55%)
      this.reportProgress('posts', 32, 'Exporting posts...');
      exportData.posts = await this.exportPaginated(
        'wordpress/list-posts',
        'posts',
        30,
        55
      );

      // Step 7: Get pages with pagination (55-70%)
      this.reportProgress('pages', 57, 'Exporting pages...');
      exportData.pages = await this.exportPaginated(
        'wordpress/list-pages',
        'pages',
        55,
        70
      );

      // Step 8: Get media with pagination (70-100%)
      this.reportProgress('media', 72, 'Exporting media library...');
      exportData.media = await this.exportPaginated(
        'wordpress/list-media',
        'media',
        70,
        100
      );

      this.reportProgress('complete', 100, 'Export completed successfully');

      return exportData;
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async exportPaginated(
    toolName: string,
    resultKey: string,
    startProgress: number,
    endProgress: number
  ): Promise<any[]> {
    const allItems: any[] = [];
    let page = 1;
    let hasMore = true;

    // First request to get total
    const firstResult = await this.client.callTool(toolName, { per_page: 100, page: 1 });
    const firstData = this.parseToolResult(firstResult);
    allItems.push(...(firstData[resultKey] || []));

    const total = firstData.total || 0;
    const totalPages = Math.ceil(total / 100);

    // Fetch remaining pages
    while (page < totalPages) {
      page++;
      const progress = startProgress + ((page / totalPages) * (endProgress - startProgress));
      this.reportProgress(resultKey, Math.round(progress), `Exporting ${resultKey} (page ${page}/${totalPages})...`);

      const result = await this.client.callTool(toolName, { per_page: 100, page });
      const data = this.parseToolResult(result);
      allItems.push(...(data[resultKey] || []));
    }

    return allItems;
  }

  private parseToolResult(result: any): any {
    if (Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent?.text) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
    }
    return result.content || result;
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] WordPress abilities registered successfully: Check Docker logs `docker-compose logs wordpress | grep "Registered ability"`
- [ ] All 8 new abilities show up: `curl http://localhost:8000/wp-json/wordpress-poc/mcp/tools | jq '.tools | length'` (should be 13 total)
- [ ] TypeScript schemas compile: `pnpm tsc --noEmit`
- [ ] Export service instantiates: Run `tsx scripts/test/test-exporter.ts`

#### Manual Verification:
- [ ] Can call each new ability via MCP client and get expected data structure
- [ ] `wordpress/list-pages` returns pages with correct fields
- [ ] `wordpress/list-media` returns media with URLs and file paths
- [ ] `wordpress/list-categories` returns all categories
- [ ] `wordpress/list-tags` returns all tags
- [ ] `wordpress/get-site-options` returns site settings (no passwords)
- [ ] `wordpress/get-plugins-list` returns plugins with active status
- [ ] `wordpress/get-theme-config` returns active theme info
- [ ] Export orchestration completes for test site (100 posts, 50 media) in under 2 minutes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Media Export Service

### Overview
Implement selective media downloading based on content references, with storage tracking in PostgreSQL.

### Changes Required

#### 1. Content Parser for Media References

**File**: `lib/export/content-parser.ts`
**Changes**: Create new file to parse HTML content for media references

```typescript
import { JSDOM } from 'jsdom';

export interface MediaReference {
  wordpressMediaId?: number;
  url: string;
  type: 'featured' | 'content' | 'gallery';
  postId: number;
}

export class ContentParser {
  /**
   * Extract all media references from exported WordPress data
   */
  extractMediaReferences(
    posts: any[],
    pages: any[]
  ): MediaReference[] {
    const references: MediaReference[] = [];
    const allContent = [...posts, ...pages];

    for (const item of allContent) {
      // Extract featured image
      if (item.featured_media && item.featured_media !== 0) {
        references.push({
          wordpressMediaId: item.featured_media,
          url: '',
          type: 'featured',
          postId: item.id,
        });
      }

      // Parse content HTML for images
      if (item.content) {
        const content = typeof item.content === 'string'
          ? item.content
          : item.content.rendered || '';

        references.push(...this.parseHTMLForMedia(content, item.id));
      }
    }

    return references;
  }

  /**
   * Parse HTML content for img tags and extract media IDs/URLs
   */
  private parseHTMLForMedia(html: string, postId: number): MediaReference[] {
    const references: MediaReference[] = [];

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Find all img tags
      const images = document.querySelectorAll('img');

      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (!src) return;

        // Try to extract WordPress media ID from class (wp-image-123)
        const classes = img.getAttribute('class') || '';
        const match = classes.match(/wp-image-(\d+)/);

        if (match) {
          references.push({
            wordpressMediaId: parseInt(match[1], 10),
            url: src,
            type: 'content',
            postId,
          });
        } else {
          // No media ID, use URL
          references.push({
            url: src,
            type: 'content',
            postId,
          });
        }
      });

      // Find gallery blocks (WordPress Gutenberg)
      const galleries = document.querySelectorAll('.wp-block-gallery, .gallery');

      galleries.forEach((gallery) => {
        const galleryImages = gallery.querySelectorAll('img');
        galleryImages.forEach((img) => {
          const src = img.getAttribute('src');
          if (!src) return;

          const classes = img.getAttribute('class') || '';
          const match = classes.match(/wp-image-(\d+)/);

          references.push({
            wordpressMediaId: match ? parseInt(match[1], 10) : undefined,
            url: src,
            type: 'gallery',
            postId,
          });
        });
      });
    } catch (error) {
      console.error(`Error parsing HTML for post ${postId}:`, error);
    }

    return references;
  }

  /**
   * Deduplicate media references by WordPress media ID
   */
  deduplicateReferences(references: MediaReference[]): MediaReference[] {
    const seen = new Set<number>();
    const unique: MediaReference[] = [];

    for (const ref of references) {
      if (ref.wordpressMediaId) {
        if (!seen.has(ref.wordpressMediaId)) {
          seen.add(ref.wordpressMediaId);
          unique.push(ref);
        }
      } else {
        // Keep URL-only references (can't deduplicate reliably)
        unique.push(ref);
      }
    }

    return unique;
  }
}
```

#### 2. Media Downloader Service

**File**: `lib/export/media-downloader.ts`
**Changes**: Create new file for downloading media files

```typescript
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

export interface MediaDownloadResult {
  mediaId: number;
  success: boolean;
  localPath?: string;
  error?: string;
  fileSize?: number;
}

export interface MediaDownloadOptions {
  maxFileSize?: number; // bytes (default: 50MB)
  skipVideos?: boolean;
  skipFileTypes?: string[]; // mime types to skip
  concurrency?: number; // parallel downloads (default: 5)
}

export class MediaDownloader {
  private baseDir: string;
  private options: Required<MediaDownloadOptions>;

  constructor(baseDir: string, options: MediaDownloadOptions = {}) {
    this.baseDir = baseDir;
    this.options = {
      maxFileSize: options.maxFileSize ?? 50 * 1024 * 1024, // 50MB
      skipVideos: options.skipVideos ?? true,
      skipFileTypes: options.skipFileTypes ?? ['video/mp4', 'video/quicktime'],
      concurrency: options.concurrency ?? 5,
    };
  }

  /**
   * Download multiple media files with progress callback
   */
  async downloadMedia(
    mediaItems: Array<{
      id: number;
      url: string;
      filePath: string;
      fileSize?: number;
      mimeType?: string;
    }>,
    onProgress?: (completed: number, total: number, current?: string) => void
  ): Promise<MediaDownloadResult[]> {
    const results: MediaDownloadResult[] = [];
    const total = mediaItems.length;
    let completed = 0;

    // Filter out items to skip
    const itemsToDownload = mediaItems.filter((item) => {
      // Skip if file size exceeds limit
      if (item.fileSize && item.fileSize > this.options.maxFileSize) {
        console.log(`Skipping ${item.filePath}: exceeds size limit (${item.fileSize} bytes)`);
        results.push({
          mediaId: item.id,
          success: false,
          error: 'File size exceeds limit',
        });
        return false;
      }

      // Skip if mime type is in skip list
      if (item.mimeType && this.options.skipFileTypes.includes(item.mimeType)) {
        console.log(`Skipping ${item.filePath}: mime type ${item.mimeType} in skip list`);
        results.push({
          mediaId: item.id,
          success: false,
          error: 'File type skipped',
        });
        return false;
      }

      return true;
    });

    // Download in batches (concurrency limit)
    for (let i = 0; i < itemsToDownload.length; i += this.options.concurrency) {
      const batch = itemsToDownload.slice(i, i + this.options.concurrency);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          if (onProgress) {
            onProgress(completed, total, item.filePath);
          }

          const result = await this.downloadSingleFile(
            item.url,
            item.filePath,
            item.id
          );

          completed++;
          return result;
        })
      );

      results.push(...batchResults);
    }

    // Add skipped items to completed count
    completed = total;
    if (onProgress) {
      onProgress(completed, total);
    }

    return results;
  }

  /**
   * Download a single file with retry logic
   */
  private async downloadSingleFile(
    url: string,
    filePath: string,
    mediaId: number,
    retries: number = 3
  ): Promise<MediaDownloadResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Fetch the file
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get file buffer
        const buffer = await response.arrayBuffer();
        const fileSize = buffer.byteLength;

        // Check size limit
        if (fileSize > this.options.maxFileSize) {
          return {
            mediaId,
            success: false,
            error: `File size ${fileSize} exceeds limit ${this.options.maxFileSize}`,
          };
        }

        // Create directory structure
        const fullPath = path.join(this.baseDir, filePath);
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(fullPath, Buffer.from(buffer));

        return {
          mediaId,
          success: true,
          localPath: fullPath,
          fileSize,
        };

      } catch (error) {
        lastError = error as Error;

        // Exponential backoff
        if (attempt < retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      mediaId,
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Estimate total storage required
   */
  calculateStorageEstimate(mediaItems: Array<{ fileSize?: number }>): number {
    return mediaItems.reduce((total, item) => {
      return total + (item.fileSize || 0);
    }, 0);
  }
}
```

#### 3. Integrate Media Export into Orchestration

**File**: `lib/export/wordpress-exporter.ts`
**Changes**: Add media downloading step (add method after `export()`)

```typescript
import { ContentParser } from './content-parser';
import { MediaDownloader } from './media-downloader';

// Add to WordPressExporter class

  /**
   * Export and download media files
   */
  async exportWithMedia(
    outputDir: string,
    options?: {
      downloadMedia?: boolean;
      mediaOptions?: MediaDownloadOptions;
    }
  ): Promise<{
    exportData: WordPressExportData;
    mediaResults?: MediaDownloadResult[];
  }> {
    // Run standard export
    const exportData = await this.export();

    if (!options?.downloadMedia) {
      return { exportData };
    }

    // Parse content for media references
    this.reportProgress('media-parse', 72, 'Analyzing media references...');
    const parser = new ContentParser();
    const references = parser.extractMediaReferences(
      exportData.posts,
      exportData.pages
    );
    const uniqueReferences = parser.deduplicateReferences(references);

    // Filter media items that are referenced
    const referencedMediaIds = new Set(
      uniqueReferences.map((ref) => ref.wordpressMediaId).filter(Boolean) as number[]
    );

    const mediaToDownload = exportData.media.filter((item) =>
      referencedMediaIds.has(item.id)
    );

    this.reportProgress(
      'media-download',
      75,
      `Downloading ${mediaToDownload.length} referenced media files...`
    );

    // Download media
    const downloader = new MediaDownloader(outputDir, options.mediaOptions);
    const mediaResults = await downloader.downloadMedia(
      mediaToDownload.map((item) => ({
        id: item.id,
        url: item.url,
        filePath: item.file_path || item.filename,
        fileSize: item.file_size,
        mimeType: item.mime_type,
      })),
      (completed, total, current) => {
        const progress = 75 + Math.round((completed / total) * 25);
        this.reportProgress(
          'media-download',
          progress,
          `Downloading media: ${completed}/${total}${current ? ` (${current})` : ''}`
        );
      }
    );

    return { exportData, mediaResults };
  }
```

### Success Criteria

#### Automated Verification:
- [ ] Content parser extracts media IDs correctly: `pnpm test lib/export/content-parser.test.ts`
- [ ] Media downloader downloads files: `pnpm test lib/export/media-downloader.test.ts`
- [ ] Files are saved with correct directory structure: Check test output directory
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

#### Manual Verification:
- [ ] Test export with media downloads 10 sample media files successfully
- [ ] Downloaded files exist in correct path structure (YYYY/MM/filename.jpg)
- [ ] Large files (>50MB) are skipped as configured
- [ ] Video files are skipped if `skipVideos: true`
- [ ] Progress callback reports accurate status during download
- [ ] Failed downloads are logged with error details
- [ ] Total storage usage matches fileSize sum

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Background Job Queue with BullMQ

### Overview
Implement background job processing for long-running export operations using BullMQ with Redis/Upstash.

### Changes Required

#### 1. BullMQ Setup and Configuration

**File**: `lib/queue/connection.ts`
**Changes**: Create new file for Redis connection

```typescript
import { Redis } from 'ioredis';

// Create Redis connection for BullMQ
export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redisConnection.quit();
});
```

**File**: `lib/queue/queues.ts`
**Changes**: Create new file to define queues

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export interface ExportJobData {
  clientId: string;
  exportJobId: string;
  siteUrl: string;
  mcpUrl: string;
  mcpUsername: string;
  mcpPasswordEncrypted: string;
  options: {
    downloadMedia: boolean;
    mediaOptions?: {
      maxFileSize?: number;
      skipVideos?: boolean;
    };
  };
}

// Export queue
export const exportQueue = new Queue<ExportJobData>('export-wordpress-site', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // 7 days
    },
  },
});

// Sandbox provisioning queue
export interface ProvisionSandboxJobData {
  clientId: string;
  exportJobId: string;
  exportDataPath: string; // Path to exported data JSON
}

export const provisionQueue = new Queue<ProvisionSandboxJobData>('provision-sandbox', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
});
```

#### 2. Export Worker

**File**: `lib/queue/workers/export-worker.ts`
**Changes**: Create new file for export job processing

```typescript
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../connection';
import { ExportJobData } from '../queues';
import { WordPressMcpClient } from '../../mcp/wordpress-client';
import { WordPressExporter } from '../../export/wordpress-exporter';
import { exportJobQueries } from '../../db/queries';
import { decrypt } from '../../crypto/encryption';
import path from 'path';
import fs from 'fs/promises';

// Create worker
export const exportWorker = new Worker<ExportJobData>(
  'export-wordpress-site',
  async (job: Job<ExportJobData>) => {
    const { clientId, exportJobId, siteUrl, mcpUrl, mcpUsername, mcpPasswordEncrypted, options } = job.data;

    console.log(`[Export Worker] Starting export for client ${clientId}, job ${exportJobId}`);

    try {
      // Update job status
      await exportJobQueries.updateStatus(exportJobId, 'validating', {
        currentStep: 'Connecting to WordPress site...',
        progress: 0,
      });

      // Decrypt password
      const mcpPassword = decrypt(mcpPasswordEncrypted);

      // Create MCP client
      const client = new WordPressMcpClient({
        url: mcpUrl,
        username: mcpUsername,
        password: mcpPassword,
      });

      await client.connect();

      // Update status
      await exportJobQueries.updateStatus(exportJobId, 'exporting_content', {
        currentStep: 'Exporting WordPress content...',
        progress: 5,
      });

      // Create exporter with progress callback
      const exporter = new WordPressExporter(client, async (progress) => {
        await exportJobQueries.updateStatus(exportJobId, 'exporting_content', {
          currentStep: progress.message,
          progress: progress.progress,
        });

        // Update BullMQ job progress
        await job.updateProgress(progress.progress);
      });

      // Run export (with or without media)
      const outputDir = path.join(process.cwd(), 'exports', clientId);
      await fs.mkdir(outputDir, { recursive: true });

      const result = await exporter.exportWithMedia(outputDir, {
        downloadMedia: options.downloadMedia,
        mediaOptions: options.mediaOptions,
      });

      // Save export data as JSON
      const exportDataPath = path.join(outputDir, 'export-data.json');
      await fs.writeFile(exportDataPath, JSON.stringify(result.exportData, null, 2));

      // Update export job with results
      await exportJobQueries.updateStatus(exportJobId, 'completed', {
        currentStep: 'Export completed successfully',
        progress: 100,
      });

      // Update totals in database
      await exportJobQueries.update(exportJobId, {
        totalPosts: result.exportData.posts.length,
        totalPages: result.exportData.pages.length,
        totalMedia: result.exportData.media.length,
        totalCategories: result.exportData.categories.length,
        totalTags: result.exportData.tags.length,
        exportData: result.exportData as any,
      });

      console.log(`[Export Worker] Export completed for client ${clientId}`);

      // Return data for next job in flow
      return {
        success: true,
        exportDataPath,
        mediaDownloaded: options.downloadMedia,
        totalDownloaded: result.mediaResults?.filter((r) => r.success).length || 0,
      };

    } catch (error) {
      console.error(`[Export Worker] Export failed for client ${clientId}:`, error);

      // Update job status to failed
      await exportJobQueries.updateStatus(exportJobId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? { stack: error.stack } : {},
      });

      throw error; // Let BullMQ handle retry logic
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 exports concurrently
  }
);

// Worker event handlers
exportWorker.on('completed', (job) => {
  console.log(`[Export Worker] Job ${job.id} completed successfully`);
});

exportWorker.on('failed', (job, err) => {
  console.error(`[Export Worker] Job ${job?.id} failed:`, err.message);
});

exportWorker.on('error', (err) => {
  console.error('[Export Worker] Worker error:', err);
});

console.log('[Export Worker] Export worker started and listening for jobs');
```

#### 3. Worker Runner Script

**File**: `workers/index.ts`
**Changes**: Create new file to start all workers

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import { exportWorker } from '../lib/queue/workers/export-worker';

console.log('Starting BullMQ workers...');
console.log('Redis URL:', process.env.REDIS_URL?.replace(/:[^:@]+@/, ':****@'));

// Workers are already initialized and listening
// This script just keeps the process alive

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await exportWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await exportWorker.close();
  process.exit(0);
});

console.log('Workers are running. Press Ctrl+C to stop.');
```

#### 4. Add Queue to API Routes

**File**: `app/api/onboarding/connect/route.ts`
**Changes**: Create new API route to start onboarding

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { clientQueries, exportJobQueries } from '@/lib/db/queries';
import { encrypt } from '@/lib/crypto/encryption';
import { exportQueue } from '@/lib/queue/queues';
import { WordPressMcpClient } from '@/lib/mcp/wordpress-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteUrl, mcpUsername, mcpPassword } = body;

    // Validate inputs
    if (!siteUrl || !mcpUsername || !mcpPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: siteUrl, mcpUsername, mcpPassword' },
        { status: 400 }
      );
    }

    // Construct MCP URL
    const mcpUrl = `${siteUrl.replace(/\/$/, '')}/wp-json/wordpress-poc/mcp`;

    // Step 1: Validate connection
    try {
      const testClient = new WordPressMcpClient({
        url: mcpUrl,
        username: mcpUsername,
        password: mcpPassword,
      });
      await testClient.connect();
      await testClient.disconnect();
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to connect to WordPress site',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 401 }
      );
    }

    // Step 2: Check if client already exists
    let client = await clientQueries.getBySiteUrl(siteUrl);

    if (client) {
      // Update existing client
      const encryptedPassword = encrypt(mcpPassword);
      client = await clientQueries.update(client.id, {
        mcpUrl,
        mcpUsername,
        mcpPasswordEncrypted: encryptedPassword,
        isActive: true,
      });
    } else {
      // Create new client
      const encryptedPassword = encrypt(mcpPassword);
      client = await clientQueries.create({
        siteUrl,
        mcpUrl,
        mcpUsername,
        mcpPasswordEncrypted: encryptedPassword,
      });
    }

    // Step 3: Create export job
    const exportJob = await exportJobQueries.create(client.id);

    // Step 4: Queue export job
    await exportQueue.add('export', {
      clientId: client.id,
      exportJobId: exportJob.id,
      siteUrl,
      mcpUrl,
      mcpUsername,
      mcpPasswordEncrypted: client.mcpPasswordEncrypted,
      options: {
        downloadMedia: true,
        mediaOptions: {
          maxFileSize: 50 * 1024 * 1024, // 50MB
          skipVideos: true,
        },
      },
    });

    return NextResponse.json({
      success: true,
      clientId: client.id,
      exportJobId: exportJob.id,
      message: 'Export started. Check status at /api/onboarding/status/{exportJobId}',
    });

  } catch (error) {
    console.error('[Onboarding] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/onboarding/status/[jobId]/route.ts`
**Changes**: Create new API route for job status polling

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exportJobQueries } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    const job = await exportJobQueries.getById(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Export job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: job.id,
      clientId: job.clientId,
      status: job.status,
      currentStep: job.currentStep,
      progress: job.progress,
      error: job.error,
      totals: {
        posts: job.totalPosts,
        pages: job.totalPages,
        media: job.totalMedia,
        categories: job.totalCategories,
        tags: job.totalTags,
      },
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });

  } catch (error) {
    console.error('[Onboarding Status] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] Redis connection works: `node -e "require('./lib/queue/connection').redisConnection.ping().then(console.log)"`
- [ ] BullMQ queues initialize: `pnpm tsc --noEmit`
- [ ] Worker script runs: `tsx workers/index.ts` (should not crash)
- [ ] Export job can be queued: Run `tsx scripts/test/test-queue-export.ts`

#### Manual Verification:
- [ ] POST to `/api/onboarding/connect` with valid credentials returns jobId
- [ ] Job appears in BullMQ dashboard (if using Bull Board)
- [ ] Worker picks up job and starts processing
- [ ] GET `/api/onboarding/status/{jobId}` shows progress updates
- [ ] Job completes and status becomes "completed"
- [ ] Export data JSON file exists in `exports/{clientId}/export-data.json`
- [ ] Failed jobs retry automatically (test with invalid credentials)
- [ ] Worker survives crashes and reconnects to Redis

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Docker Sandbox Provisioning

### Overview
Automate on-demand Docker container provisioning for each client with isolated WordPress and MySQL instances.

### Changes Required

#### 1. Docker Management Service

**File**: `lib/docker/manager.ts`
**Changes**: Create new file for Docker operations

```typescript
import Docker from 'dockerode';
import { randomBytes } from 'crypto';

const docker = new Docker({
  socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock',
});

export interface SandboxConfig {
  clientId: string;
  port: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

export class DockerManager {
  /**
   * Provision new WordPress + MySQL sandbox for client
   */
  async provisionSandbox(clientId: string): Promise<SandboxConfig> {
    // Generate unique identifiers
    const containerSuffix = clientId.substring(0, 8);
    const port = await this.findAvailablePort();
    const dbName = `wp_${containerSuffix}`;
    const dbUser = `wp_user_${containerSuffix}`;
    const dbPassword = randomBytes(16).toString('hex');

    // Create network for client
    const networkName = `wp_network_${containerSuffix}`;
    let network;
    try {
      network = await docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
      });
      console.log(`Created network: ${networkName}`);
    } catch (error) {
      console.error('Failed to create network:', error);
      throw error;
    }

    // Create MySQL container
    const mysqlContainerName = `wp_mysql_${containerSuffix}`;
    let mysqlContainer;
    try {
      mysqlContainer = await docker.createContainer({
        Image: 'mysql:8.0',
        name: mysqlContainerName,
        Env: [
          `MYSQL_ROOT_PASSWORD=${dbPassword}`,
          `MYSQL_DATABASE=${dbName}`,
          `MYSQL_USER=${dbUser}`,
          `MYSQL_PASSWORD=${dbPassword}`,
        ],
        HostConfig: {
          NetworkMode: networkName,
        },
      });
      await mysqlContainer.start();
      console.log(`Started MySQL container: ${mysqlContainerName}`);
    } catch (error) {
      console.error('Failed to create MySQL container:', error);
      throw error;
    }

    // Wait for MySQL to be ready
    await this.waitForMySQL(mysqlContainer, 30000);

    // Create WordPress container
    const wpContainerName = `wp_sandbox_${containerSuffix}`;
    let wpContainer;
    try {
      wpContainer = await docker.createContainer({
        Image: 'wordpress:latest',
        name: wpContainerName,
        Env: [
          `WORDPRESS_DB_HOST=${mysqlContainerName}:3306`,
          `WORDPRESS_DB_NAME=${dbName}`,
          `WORDPRESS_DB_USER=${dbUser}`,
          `WORDPRESS_DB_PASSWORD=${dbPassword}`,
        ],
        ExposedPorts: {
          '80/tcp': {},
        },
        HostConfig: {
          NetworkMode: networkName,
          PortBindings: {
            '80/tcp': [{ HostPort: port.toString() }],
          },
          // Mount mu-plugins for MCP abilities
          Binds: [
            `${process.cwd()}/wp-content/mu-plugins:/var/www/html/wp-content/mu-plugins:ro`,
          ],
        },
      });
      await wpContainer.start();
      console.log(`Started WordPress container: ${wpContainerName} on port ${port}`);
    } catch (error) {
      console.error('Failed to create WordPress container:', error);
      throw error;
    }

    // Wait for WordPress to be ready
    await this.waitForWordPress(`http://localhost:${port}`, 60000);

    return {
      clientId,
      port,
      dbName,
      dbUser,
      dbPassword,
    };
  }

  /**
   * Find available port starting from 9000
   */
  private async findAvailablePort(startPort: number = 9000): Promise<number> {
    const containers = await docker.listContainers();
    const usedPorts = new Set<number>();

    for (const container of containers) {
      if (container.Ports) {
        for (const portMapping of container.Ports) {
          if (portMapping.PublicPort) {
            usedPorts.add(portMapping.PublicPort);
          }
        }
      }
    }

    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }

    return port;
  }

  /**
   * Wait for MySQL to be ready
   */
  private async waitForMySQL(
    container: Docker.Container,
    timeout: number
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const exec = await container.exec({
          Cmd: ['mysqladmin', 'ping', '-h', 'localhost'],
          AttachStdout: true,
          AttachStderr: true,
        });

        const stream = await exec.start({ hijack: true, stdin: false });

        // Wait for exec to complete
        await new Promise((resolve) => {
          stream.on('end', resolve);
        });

        const inspectResult = await exec.inspect();
        if (inspectResult.ExitCode === 0) {
          console.log('MySQL is ready');
          return;
        }
      } catch (error) {
        // Ignore errors, keep retrying
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('MySQL failed to start within timeout');
  }

  /**
   * Wait for WordPress to respond
   */
  private async waitForWordPress(url: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok || response.status === 302) {
          console.log('WordPress is ready');
          return;
        }
      } catch (error) {
        // Ignore errors, keep retrying
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('WordPress failed to start within timeout');
  }

  /**
   * Stop and remove sandbox containers
   */
  async destroySandbox(clientId: string): Promise<void> {
    const containerSuffix = clientId.substring(0, 8);
    const wpContainerName = `wp_sandbox_${containerSuffix}`;
    const mysqlContainerName = `wp_mysql_${containerSuffix}`;
    const networkName = `wp_network_${containerSuffix}`;

    try {
      // Stop and remove WordPress container
      const wpContainer = docker.getContainer(wpContainerName);
      await wpContainer.stop();
      await wpContainer.remove();
      console.log(`Removed WordPress container: ${wpContainerName}`);
    } catch (error) {
      console.warn(`Failed to remove WordPress container:`, error);
    }

    try {
      // Stop and remove MySQL container
      const mysqlContainer = docker.getContainer(mysqlContainerName);
      await mysqlContainer.stop();
      await mysqlContainer.remove();
      console.log(`Removed MySQL container: ${mysqlContainerName}`);
    } catch (error) {
      console.warn(`Failed to remove MySQL container:`, error);
    }

    try {
      // Remove network
      const network = docker.getNetwork(networkName);
      await network.remove();
      console.log(`Removed network: ${networkName}`);
    } catch (error) {
      console.warn(`Failed to remove network:`, error);
    }
  }

  /**
   * Get sandbox status
   */
  async getSandboxStatus(clientId: string): Promise<{
    running: boolean;
    containers: Array<{ name: string; status: string }>;
  }> {
    const containerSuffix = clientId.substring(0, 8);
    const containers = await docker.listContainers({ all: true });

    const clientContainers = containers.filter((c) =>
      c.Names.some((name) => name.includes(containerSuffix))
    );

    return {
      running: clientContainers.some((c) => c.State === 'running'),
      containers: clientContainers.map((c) => ({
        name: c.Names[0].replace('/', ''),
        status: c.State,
      })),
    };
  }
}
```

#### 2. WordPress Setup Automation

**File**: `lib/docker/wordpress-setup.ts`
**Changes**: Create new file to configure WordPress via wp-cli

```typescript
import Docker from 'dockerode';

const docker = new Docker({
  socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock',
});

export class WordPressSetup {
  /**
   * Configure WordPress instance (install, create user, enable MCP)
   */
  async setupWordPress(
    containerName: string,
    siteUrl: string,
    adminUser: string,
    adminPassword: string,
    adminEmail: string
  ): Promise<{ appPassword: string }> {
    const container = docker.getContainer(containerName);

    // Wait for WordPress files to be ready
    await this.waitForWordPressFiles(container);

    // Install WordPress
    await this.execWpCli(container, [
      'core',
      'install',
      `--url=${siteUrl}`,
      `--title=Sandbox WordPress`,
      `--admin_user=${adminUser}`,
      `--admin_password=${adminPassword}`,
      `--admin_email=${adminEmail}`,
      '--skip-email',
    ]);

    console.log('WordPress installed successfully');

    // Create Application Password for MCP
    const appPassword = await this.createApplicationPassword(
      container,
      adminUser,
      'MCP Adapter'
    );

    console.log('Application Password created');

    return { appPassword };
  }

  /**
   * Import WordPress data from export
   */
  async importData(
    containerName: string,
    exportDataPath: string
  ): Promise<void> {
    const container = docker.getContainer(containerName);

    // This is a placeholder - full implementation would:
    // 1. Copy export JSON to container
    // 2. Use wp-cli or custom script to import posts/pages/taxonomies
    // 3. Update GUIDs and URLs for sandbox environment

    console.log('TODO: Implement data import');
    // For Phase 5, we'll focus on container provisioning
    // Data import can be added in Phase 6
  }

  /**
   * Wait for WordPress files to exist
   */
  private async waitForWordPressFiles(
    container: Docker.Container,
    timeout: number = 60000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await this.execWpCli(container, ['core', 'version']);
        console.log('WordPress files are ready');
        return;
      } catch (error) {
        // Keep waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('WordPress files not found within timeout');
  }

  /**
   * Execute wp-cli command in container
   */
  private async execWpCli(
    container: Docker.Container,
    args: string[]
  ): Promise<string> {
    const exec = await container.exec({
      Cmd: ['wp', '--allow-root', ...args],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/var/www/html',
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';

      stream.on('data', (chunk) => {
        const str = chunk.toString('utf8');
        // Strip Docker stream headers (8 bytes)
        const cleaned = str.substring(8);
        output += cleaned;
      });

      stream.on('end', async () => {
        const inspectResult = await exec.inspect();
        if (inspectResult.ExitCode === 0) {
          resolve(output);
        } else {
          reject(new Error(`wp-cli command failed: ${output}`));
        }
      });

      stream.on('error', reject);
    });
  }

  /**
   * Create Application Password
   */
  private async createApplicationPassword(
    container: Docker.Container,
    username: string,
    appName: string
  ): Promise<string> {
    const output = await this.execWpCli(container, [
      'user',
      'application-password',
      'create',
      username,
      appName,
      '--porcelain',
    ]);

    // Extract password from output (format: "success UUID password")
    const parts = output.trim().split(' ');
    const password = parts[parts.length - 1];

    return password;
  }
}
```

#### 3. Provisioning Worker

**File**: `lib/queue/workers/provision-worker.ts`
**Changes**: Create new file for sandbox provisioning

```typescript
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../connection';
import { ProvisionSandboxJobData } from '../queues';
import { DockerManager } from '../../docker/manager';
import { WordPressSetup } from '../../docker/wordpress-setup';
import { sandboxQueries, clientQueries } from '../../db/queries';
import { encrypt } from '../../crypto/encryption';

export const provisionWorker = new Worker<ProvisionSandboxJobData>(
  'provision-sandbox',
  async (job: Job<ProvisionSandboxJobData>) => {
    const { clientId, exportJobId, exportDataPath } = job.data;

    console.log(`[Provision Worker] Starting provisioning for client ${clientId}`);

    const dockerManager = new DockerManager();
    const wpSetup = new WordPressSetup();

    try {
      // Step 1: Provision Docker containers
      job.updateProgress(10);
      const config = await dockerManager.provisionSandbox(clientId);

      console.log(`Sandbox provisioned on port ${config.port}`);

      // Step 2: Setup WordPress
      job.updateProgress(40);
      const sandboxUrl = `http://localhost:${config.port}`;
      const adminUser = 'admin';
      const adminPassword = encrypt(config.dbPassword); // Reuse DB password for WP admin

      const containerName = `wp_sandbox_${clientId.substring(0, 8)}`;
      const { appPassword } = await wpSetup.setupWordPress(
        containerName,
        sandboxUrl,
        adminUser,
        config.dbPassword, // Temporary password
        `admin@${clientId}.local`
      );

      console.log('WordPress setup complete');

      // Step 3: Save sandbox instance to database
      job.updateProgress(70);
      const mcpUrl = `${sandboxUrl}/wp-json/wordpress-poc/mcp`;

      await sandboxQueries.create({
        clientId,
        containerId: containerName,
        containerName,
        port: config.port,
        dbName: config.dbName,
        dbUser: config.dbUser,
        dbPasswordEncrypted: encrypt(config.dbPassword),
        sandboxMcpUrl: mcpUrl,
      });

      // Update sandbox status
      await sandboxQueries.updateStatus(containerName, 'running');

      // Step 4: Update client with sandbox MCP credentials
      job.updateProgress(90);
      await clientQueries.update(clientId, {
        // Store sandbox MCP credentials (different from production)
        // In a real implementation, you'd have separate fields for sandbox vs production
      });

      job.updateProgress(100);

      console.log(`[Provision Worker] Provisioning completed for client ${clientId}`);

      return {
        success: true,
        sandboxUrl,
        mcpUrl,
        port: config.port,
      };

    } catch (error) {
      console.error(`[Provision Worker] Provisioning failed for client ${clientId}:`, error);

      // Cleanup on failure
      try {
        await dockerManager.destroySandbox(clientId);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Only provision one sandbox at a time
  }
);

provisionWorker.on('completed', (job) => {
  console.log(`[Provision Worker] Job ${job.id} completed`);
});

provisionWorker.on('failed', (job, err) => {
  console.error(`[Provision Worker] Job ${job?.id} failed:`, err.message);
});

console.log('[Provision Worker] Provision worker started');
```

### Success Criteria

#### Automated Verification:
- [ ] Docker connection works: `node -e "require('dockerode')().ping().then(console.log)"`
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Provision worker starts: Add to `workers/index.ts` and run `tsx workers/index.ts`

#### Manual Verification:
- [ ] Can provision a new sandbox: Run `tsx scripts/test/test-provision-sandbox.ts`
- [ ] WordPress container starts and responds on assigned port
- [ ] MySQL container starts and WordPress can connect to it
- [ ] WordPress installation completes automatically
- [ ] Application Password is created successfully
- [ ] MCP endpoint is accessible: `curl http://localhost:{PORT}/wp-json/wordpress-poc/mcp`
- [ ] Sandbox status saved to database correctly
- [ ] Can destroy sandbox: Containers and network are removed
- [ ] Multiple sandboxes can run simultaneously on different ports

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Onboarding UI

### Overview
Build the user-facing onboarding interface with connection form, progress tracking, and completion flow.

### Changes Required

#### 1. Onboarding Page Component

**File**: `app/onboarding/page.tsx`
**Changes**: Create new file for onboarding UI

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<'connect' | 'progress' | 'complete'>('connect');
  const [formData, setFormData] = useState({
    siteUrl: '',
    mcpUsername: 'admin',
    mcpPassword: '',
  });
  const [jobId, setJobId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/onboarding/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      setJobId(data.exportJobId);
      setStep('progress');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'connect') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6">Connect Your WordPress Site</h1>

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WordPress Site URL
              </label>
              <input
                type="url"
                required
                placeholder="https://yoursite.com"
                value={formData.siteUrl}
                onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WordPress Username
              </label>
              <input
                type="text"
                required
                value={formData.mcpUsername}
                onChange={(e) => setFormData({ ...formData, mcpUsername: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application Password
              </label>
              <input
                type="password"
                required
                placeholder="xxxx xxxx xxxx xxxx"
                value={formData.mcpPassword}
                onChange={(e) => setFormData({ ...formData, mcpPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Create this in WordPress Users → Profile → Application Passwords
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Connecting...' : 'Connect & Start Export'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-semibold text-sm mb-2">What happens next?</h3>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• We'll export your WordPress content (posts, pages, media)</li>
              <li>• Create an isolated sandbox environment</li>
              <li>• This takes 5-15 minutes depending on your site size</li>
              <li>• You'll be notified when it's ready</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'progress') {
    return <ProgressTracker jobId={jobId} onComplete={() => setStep('complete')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Your Sandbox is Ready!</h1>
        <p className="text-gray-600 mb-6">
          Your WordPress site has been exported and your sandbox environment is provisioned.
        </p>
        <button
          onClick={() => router.push('/editor')}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Start Editing
        </button>
      </div>
    </div>
  );
}

// Progress Tracker Component
function ProgressTracker({ jobId, onComplete }: { jobId: string; onComplete: () => void }) {
  const [status, setStatus] = useState<any>(null);

  // Poll for status updates
  useState(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/onboarding/status/${jobId}`);
        const data = await response.json();
        setStatus(data);

        if (data.status === 'completed') {
          clearInterval(interval);
          setTimeout(onComplete, 1000);
        }

        if (data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  });

  if (!status) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">Exporting Your WordPress Site</h1>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{status.currentStep || 'Starting...'}</span>
            <span className="text-gray-500">{status.progress || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${status.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Status Details */}
        {status.totals && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Posts:</span>
              <span className="font-medium">{status.totals.posts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pages:</span>
              <span className="font-medium">{status.totals.pages}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Media Files:</span>
              <span className="font-medium">{status.totals.media}</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {status.status === 'failed' && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Export Failed</p>
            <p className="text-sm mt-1">{status.error}</p>
          </div>
        )}

        {/* Spinner */}
        {status.status !== 'failed' && status.status !== 'completed' && (
          <div className="mt-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 2. Update Home Page

**File**: `app/page.tsx`
**Changes**: Add link to onboarding

```typescript
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-xl p-12">
        <h1 className="text-4xl font-bold text-center mb-4">
          WordPress AI Editor
        </h1>
        <p className="text-lg text-gray-600 text-center mb-8">
          AI-powered content editing for your WordPress site
        </p>

        <div className="space-y-4">
          <Link
            href="/onboarding"
            className="block w-full bg-blue-600 text-white text-center py-3 px-6 rounded-lg hover:bg-blue-700 transition"
          >
            Get Started →
          </Link>

          <Link
            href="/editor"
            className="block w-full bg-gray-100 text-gray-700 text-center py-3 px-6 rounded-lg hover:bg-gray-200 transition"
          >
            Go to Editor (Existing Users)
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="font-semibold mb-1">Isolated Sandbox</h3>
            <p className="text-sm text-gray-600">
              Test changes safely before going live
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🤖</div>
            <h3 className="font-semibold mb-1">AI-Powered</h3>
            <p className="text-sm text-gray-600">
              Let AI help you write and edit content
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Fast Setup</h3>
            <p className="text-sm text-gray-600">
              Get started in under 15 minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Success Criteria

#### Automated Verification:
- [ ] Next.js builds successfully: `pnpm build`
- [ ] No TypeScript errors: `pnpm tsc --noEmit`
- [ ] Pages render without errors: `pnpm dev` and visit `/onboarding`

#### Manual Verification:
- [ ] Home page displays with "Get Started" button
- [ ] Onboarding page shows connection form
- [ ] Form validation works (required fields, URL format)
- [ ] Submitting valid credentials starts export job
- [ ] Progress page shows real-time updates
- [ ] Progress bar animates smoothly (0-100%)
- [ ] Export totals (posts, pages, media) display correctly
- [ ] Completion page shows success message
- [ ] "Start Editing" button navigates to editor
- [ ] Error states display properly (invalid credentials, connection failure)
- [ ] Mobile-responsive design looks good on phone

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests

**Key areas to test:**
- `lib/crypto/encryption.ts` - Encryption/decryption functions
- `lib/export/content-parser.ts` - Media reference extraction
- `lib/db/queries.ts` - Database query functions
- WordPress MCP abilities - Tool execution and validation

**Test files to create:**
- `lib/crypto/encryption.test.ts`
- `lib/export/content-parser.test.ts`
- `lib/db/queries.test.ts`

### Integration Tests

**End-to-end onboarding flow:**
1. Submit connection form
2. Export job starts
3. WordPress data exported successfully
4. Media files downloaded
5. Sandbox container provisioned
6. Completion status reached

**Test file**: `tests/integration/onboarding-e2e.test.ts`

### Manual Testing Steps

1. **Connection Validation:**
   - Test with valid WordPress credentials → Should succeed
   - Test with invalid credentials → Should show error
   - Test with unreachable URL → Should show error
   - Test with non-WordPress site → Should show error

2. **Export Process:**
   - Test with small site (10 posts, 5 media) → Should complete in <2 minutes
   - Test with medium site (100 posts, 50 media) → Should complete in 5-10 minutes
   - Test with large media files (50MB+) → Should skip correctly
   - Test with video files → Should skip if configured

3. **Sandbox Provisioning:**
   - Verify Docker containers start
   - Verify WordPress installation completes
   - Verify Application Password created
   - Verify MCP endpoint accessible

4. **UI Flow:**
   - Complete full onboarding flow
   - Verify progress updates in real-time
   - Verify completion page shows
   - Verify can access editor after completion

## Performance Considerations

### Export Performance
- **Pagination**: Fetch 100 items per request to balance speed vs memory
- **Parallel media downloads**: Download 5 files concurrently
- **Skip large files**: Default 50MB limit to avoid storage bloat

### Database Performance
- **Indexes**: Add indexes on frequently queried fields (clientId, status, siteUrl)
- **Connection pooling**: Use Drizzle with PgBouncer for Vercel Postgres
- **Query optimization**: Select only needed fields, avoid N+1 queries

### Docker Performance
- **Port allocation**: Sequential port assignment starting at 9000
- **Container limits**: Limit concurrent provisioning to 1 to avoid resource exhaustion
- **Health checks**: Wait for services to be ready before marking as complete

## Migration Notes

### From MVP to Production
1. **Add authentication**: Integrate NextAuth or Clerk for user management
2. **Add workspace support**: Allow multiple users per client
3. **Add billing**: Integrate Stripe for subscription management
4. **Add monitoring**: Set up Sentry for error tracking
5. **Add analytics**: Track onboarding completion rates, export times

### Database Migration
- Use Drizzle Kit for schema migrations: `pnpm db:generate && pnpm db:push`
- Backup production database before running migrations
- Test migrations on staging environment first

### Docker Host Migration
- Local development: Use Docker Desktop
- Production (Railway): Configure DOCKER_HOST with TCP socket
- Production (Render): Use Docker socket proxy for security

## References

- Architecture Decision: `/Users/razpolak/Documents/Code/wp-ai-editor-v3/ARCHITECTURE_DECISION.md`
- Technical Design: `/Users/razpolak/Documents/Code/wp-ai-editor-v3/TECHNICAL_DESIGN.md`
- Existing MCP Abilities: `/Users/razpolak/Documents/Code/wp-ai-editor-v3/wp-content/mu-plugins/register-wordpress-abilities.php`
- MCP Client: `/Users/razpolak/Documents/Code/wp-ai-editor-v3/lib/mcp/wordpress-client.ts`
- Change Tracking: `/Users/razpolak/Documents/Code/wp-ai-editor-v3/lib/sync/change-tracker.ts`

---

## Dependencies to Add

```json
{
  "dependencies": {
    "drizzle-orm": "^0.33.0",
    "@vercel/postgres": "^0.10.0",
    "ioredis": "^5.4.1",
    "bullmq": "^5.13.0",
    "dockerode": "^4.0.2",
    "jsdom": "^25.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0",
    "@types/dockerode": "^3.3.31",
    "@types/jsdom": "^21.1.7"
  }
}
```

Install: `pnpm add drizzle-orm @vercel/postgres ioredis bullmq dockerode jsdom && pnpm add -D drizzle-kit @types/dockerode @types/jsdom`

---

**Total Estimated Time**: 2-3 weeks for all phases

**Priority Order**:
1. Phase 1 (Database) - Foundation for everything
2. Phase 2 (MCP Abilities) - Extends existing infrastructure
3. Phase 4 (Background Jobs) - Enables async processing
4. Phase 3 (Media Export) - Can develop in parallel with Phase 4
5. Phase 5 (Docker) - Requires Phase 1-4 complete
6. Phase 6 (UI) - Final integration layer
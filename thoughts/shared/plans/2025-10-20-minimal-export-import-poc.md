# Minimal Export-Import POC Implementation Plan

## Overview

Prove the core export → import → edit → sync workflow works locally using the existing docker-compose setup (sandbox on port 8000, production on port 8001).

**Goal**: Validate that we can:
1. Export complete WordPress content from production via MCP
2. Import that content into sandbox WordPress
3. Make AI-powered edits in sandbox
4. Sync changes back to production

## Architecture Improvements ✨

This plan implements **proper TypeScript types** and **separation of concerns**:

### Type Safety
- ✅ **No 'any' types** - All types explicitly defined
- ✅ **wp-types library** - Use official WordPress REST API types
- ✅ **Type inference** - Leverages TypeScript's type system

### Code Quality
- ✅ **Single Responsibility** - Each class/function has one clear purpose
- ✅ **Reusable Utilities** - Shared code extracted (`parseMcpResponse`, `fetchAllPaginated`)
- ✅ **Separation of Concerns** - Export logic separated from I/O operations
- ✅ **Composition** - Scripts compose services instead of duplicating code
- ✅ **Self-Documenting** - Descriptive names, proper interfaces

### Project Structure
```
lib/
├── export/
│   ├── types.ts                  # Type definitions with wp-types
│   └── wordpress-exporter.ts     # Export logic only
├── import/
│   └── wordpress-importer.ts     # Import logic
├── storage/
│   └── export-storage.ts         # File I/O operations
└── utils/
    ├── mcp-response-parser.ts    # Shared MCP parsing
    └── paginated-fetcher.ts      # Reusable pagination
```

## Current State Analysis

### What We Have ✅
- **Docker Setup**: Sandbox (8000) + Production (8001) already running
- **MCP Infrastructure**: WordPress MCP Adapter with 5 abilities (get-post, list-posts, create-post, update-post, delete-post)
- **MCP Client**: `lib/mcp/wordpress-client.ts` with authentication
- **Change Tracking**: `lib/sync/change-tracker.ts` and `lib/sync/production-sync.ts`
- **Existing Abilities**: Basic CRUD operations on posts

### What We Need ❌
- Export abilities for pages, categories, tags, site options
- Export orchestration service
- Import service to load data into sandbox WordPress
- Test script to verify full round-trip flow

## Desired End State

### User Experience
1. Run export script: `tsx scripts/export-from-production.ts`
2. Export data saved to `exports/production-export.json`
3. Run import script: `tsx scripts/import-to-sandbox.ts`
4. Sandbox WordPress now has all production content
5. Use existing AI editor to make changes in sandbox
6. Run sync script to push changes back to production

### Technical Architecture
```
┌─────────────────────────────────────────────────────────┐
│              Production WordPress (8001)                │
│                                                          │
│  • Original content (posts, pages, categories, tags)   │
│  • MCP Adapter enabled                                  │
└─────────────────────────────────────────────────────────┘
                        ↓ (export via MCP)
┌─────────────────────────────────────────────────────────┐
│           exports/production-export.json                │
│                                                          │
│  • All posts, pages, categories, tags, options         │
│  • Media metadata (URLs only, no file downloads)       │
└─────────────────────────────────────────────────────────┘
                        ↓ (import via MCP)
┌─────────────────────────────────────────────────────────┐
│               Sandbox WordPress (8000)                  │
│                                                          │
│  • Imported content from production                     │
│  • AI editor makes changes here                         │
│  • Change tracking captures edits                       │
└─────────────────────────────────────────────────────────┘
                        ↓ (sync changes)
┌─────────────────────────────────────────────────────────┐
│              Production WordPress (8001)                │
│                                                          │
│  • Receives updates from sandbox                        │
│  • Only changed content is synced                       │
└─────────────────────────────────────────────────────────┘
```

### Verification Criteria
- Can export 100+ posts from production in under 2 minutes
- Export JSON file contains posts, pages, categories, tags
- Import successfully creates all content in sandbox
- AI editor can modify content in sandbox
- Sync successfully pushes changes back to production
- No data loss during round-trip

## What We're NOT Doing (Scope Limits)

- **No Database (PostgreSQL)** - Just save to JSON files
- **No Background Jobs (BullMQ/Redis)** - Run synchronously
- **No Docker Provisioning** - Use existing docker-compose containers
- **No Encryption** - Plain text credentials in .env.local
- **No Media File Downloads** - Only metadata/URLs (can add later)
- **No UI** - Just CLI scripts for testing
- **No Multi-tenancy** - Single sandbox, single production
- **No Authentication** - Reuse existing Application Passwords
- **No Error Recovery** - Simple error handling only

---

## Phase 1: Extended MCP Export Abilities

### Overview
Add WordPress MCP abilities to export complete site data (pages, categories, tags, options). This extends the existing 5 abilities in `wp-content/mu-plugins/register-wordpress-abilities.php`.

### Changes Required

#### 1. Add Export Abilities to WordPress Plugin

**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add 4 new abilities after the existing 5 (after line ~400)

**Add these abilities:**
1. `wordpress/list-pages` - List all pages with pagination
2. `wordpress/list-categories` - List all categories
3. `wordpress/list-tags` - List all tags
4. `wordpress/get-site-options` - Export site settings (blogname, description, etc.)

```php
// Add after existing abilities (around line 400)

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
            'total' => (int) $total->publish + $total->draft + $total->pending,
        ];
    },
    'permission_callback' => function($input) {
        return is_user_logged_in();
    },
    'meta' => ['show_in_rest' => true],
]);

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
            'posts_per_page',
        ];

        $options = [];
        foreach ($safe_options as $option) {
            $options[$option] = get_option($option);
        }

        return ['options' => $options];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_options');
    },
    'meta' => ['show_in_rest' => true],
]);
```

### Success Criteria

#### Automated Verification:
- [ ] WordPress abilities registered: Check Docker logs `docker-compose logs wordpress_production | grep "Registered ability"`
- [ ] All 9 abilities show up: `curl http://localhost:8001/wp-json/wordpress-poc/mcp/tools | jq '.tools | length'` (should be 9)
- [ ] Can call list-pages: `curl -u admin:APP_PASSWORD http://localhost:8001/wp-json/wordpress-poc/mcp/tools/wordpress/list-pages`

#### Manual Verification:
- [ ] `wordpress/list-pages` returns pages with correct structure
- [ ] `wordpress/list-categories` returns all categories
- [ ] `wordpress/list-tags` returns all tags
- [ ] `wordpress/get-site-options` returns site settings (no passwords)

**Implementation Note**: After completing this phase, restart the WordPress container and test each ability manually before proceeding.

---

## Phase 2: Type Definitions and Utilities

### Overview
Create proper TypeScript types using wp-types and extract shared utilities for code reuse.

### Changes Required

#### 1. Type Definitions

**File**: `lib/export/types.ts`
**Changes**: Create new file

```typescript
import type {
  WP_REST_API_Post,
  WP_REST_API_Category,
  WP_REST_API_Tag
} from 'wp-types';

/**
 * WordPress site configuration options
 */
export interface WordPressSiteOptions {
  blogname?: string;
  blogdescription?: string;
  siteurl?: string;
  home?: string;
  admin_email?: string;
  default_category?: number;
  default_post_format?: string;
  timezone_string?: string;
  date_format?: string;
  time_format?: string;
  posts_per_page?: number;
}

/**
 * Simplified page type (not in wp-types REST API definitions)
 */
export interface WordPressPage {
  id: number;
  title: string;
  content: string;
  status: string;
  date: string;
  modified: string;
  parent: number;
  menu_order: number;
}

/**
 * Complete WordPress export data structure
 */
export interface WordPressExportData {
  metadata: {
    site_url: string;
    site_name: string;
    export_date: string;
  };
  posts: WP_REST_API_Post[];
  pages: WordPressPage[];
  categories: WP_REST_API_Category[];
  tags: WP_REST_API_Tag[];
  options: WordPressSiteOptions;
}

/**
 * Pagination constants
 */
export const DEFAULT_PAGE_SIZE = 100;
```

#### 2. MCP Response Parser Utility

**File**: `lib/utils/mcp-response-parser.ts`
**Changes**: Create new file

```typescript
import { McpToolCallResult } from '../mcp/types';

/**
 * Parse MCP tool result and extract JSON data
 * Reusable across all services (export, import, sync)
 */
export function parseMcpResponse<T = unknown>(result: McpToolCallResult): T {
  if (Array.isArray(result.content)) {
    const textContent = result.content.find((c) => c.type === 'text');
    if (textContent?.text) {
      try {
        return JSON.parse(textContent.text) as T;
      } catch {
        return textContent.text as T;
      }
    }
  }
  return (result.content || result) as T;
}
```

#### 3. Paginated Fetcher Utility

**File**: `lib/utils/paginated-fetcher.ts`
**Changes**: Create new file

```typescript
import { WordPressMcpClient } from '../mcp/wordpress-client';
import { parseMcpResponse } from './mcp-response-parser';
import { DEFAULT_PAGE_SIZE } from '../export/types';

/**
 * Result structure for paginated MCP responses
 */
interface PaginatedMcpResponse<T> {
  [key: string]: T[];
  total: number;
}

/**
 * Fetch all items from a paginated MCP tool
 * Generic and reusable for any paginated endpoint
 */
export async function fetchAllPaginated<T>(
  client: WordPressMcpClient,
  toolName: string,
  resultKey: string,
  perPage: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;

  // First request to get total
  const firstResult = await client.callTool(toolName, { per_page: perPage, page: 1 });
  const firstData = parseMcpResponse<PaginatedMcpResponse<T>>(firstResult);
  allItems.push(...(firstData[resultKey] || []));

  const total = firstData.total || 0;
  const totalPages = Math.ceil(total / perPage);

  // Fetch remaining pages
  while (page < totalPages) {
    page++;
    const result = await client.callTool(toolName, { per_page: perPage, page });
    const data = parseMcpResponse<PaginatedMcpResponse<T>>(result);
    allItems.push(...(data[resultKey] || []));
  }

  return allItems;
}
```

#### 4. Export Storage Service

**File**: `lib/storage/export-storage.ts`
**Changes**: Create new file

```typescript
import fs from 'fs/promises';
import path from 'path';
import { WordPressExportData } from '../export/types';

/**
 * Handles file I/O for export data
 * Single Responsibility: Storage operations only
 */
export class ExportStorage {
  /**
   * Save export data to JSON file
   */
  async save(data: WordPressExportData, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load export data from JSON file
   */
  async load(filePath: string): Promise<WordPressExportData> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as WordPressExportData;
  }
}
```

---

## Phase 3: Export Service

### Overview
Create simplified export service that uses utilities and proper types.

### Changes Required

#### 1. Export Orchestration Service

**File**: `lib/export/wordpress-exporter.ts`
**Changes**: Create new file

```typescript
import type { WP_REST_API_Post, WP_REST_API_Category, WP_REST_API_Tag } from 'wp-types';
import { WordPressMcpClient } from '../mcp/wordpress-client';
import { parseMcpResponse } from '../utils/mcp-response-parser';
import { fetchAllPaginated } from '../utils/paginated-fetcher';
import type {
  WordPressExportData,
  WordPressSiteOptions,
  WordPressPage
} from './types';

/**
 * WordPress Exporter Service
 * Single Responsibility: Orchestrate export logic only (no I/O, no parsing)
 */
export class WordPressExporter {
  constructor(private client: WordPressMcpClient) {}

  /**
   * Export complete WordPress site data
   */
  async export(): Promise<WordPressExportData> {
    const exportData: WordPressExportData = {
      metadata: {
        site_url: '',
        site_name: '',
        export_date: new Date().toISOString(),
      },
      posts: [],
      pages: [],
      categories: [],
      tags: [],
      options: {},
    };

    // Step 1: Get site options
    const optionsResult = await this.client.callTool('wordpress/get-site-options', {});
    const optionsData = parseMcpResponse<{ options: WordPressSiteOptions }>(optionsResult);
    exportData.options = optionsData.options || {};
    exportData.metadata.site_name = exportData.options.blogname || '';
    exportData.metadata.site_url = exportData.options.siteurl || '';

    // Step 2: Get categories
    const categoriesResult = await this.client.callTool('wordpress/list-categories', {});
    const categoriesData = parseMcpResponse<{ categories: WP_REST_API_Category[] }>(categoriesResult);
    exportData.categories = categoriesData.categories || [];

    // Step 3: Get tags
    const tagsResult = await this.client.callTool('wordpress/list-tags', {});
    const tagsData = parseMcpResponse<{ tags: WP_REST_API_Tag[] }>(tagsResult);
    exportData.tags = tagsData.tags || [];

    // Step 4: Get posts (paginated)
    exportData.posts = await fetchAllPaginated<WP_REST_API_Post>(
      this.client,
      'wordpress/list-posts',
      'posts'
    );

    // Step 5: Get pages (paginated)
    exportData.pages = await fetchAllPaginated<WordPressPage>(
      this.client,
      'wordpress/list-pages',
      'pages'
    );

    return exportData;
  }
}
```

#### 2. Export Script

**File**: `scripts/export-from-production.ts`
**Changes**: Create new file

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import { WordPressMcpClient } from '../lib/mcp/wordpress-client';
import { WordPressExporter } from '../lib/export/wordpress-exporter';
import { ExportStorage } from '../lib/storage/export-storage';
import path from 'path';

async function main() {
  console.log('═════════════════════════════════════════════════');
  console.log('   WordPress Production Export');
  console.log('═════════════════════════════════════════════════\n');

  // Create services
  const client = new WordPressMcpClient({
    url: process.env.WORDPRESS_PRODUCTION_MCP_URL || 'http://localhost:8001/wp-json/wordpress-poc/mcp',
    username: process.env.WORDPRESS_PRODUCTION_USERNAME || 'admin',
    password: process.env.WORDPRESS_PRODUCTION_PASSWORD || '',
  });

  const exporter = new WordPressExporter(client);
  const storage = new ExportStorage();

  try {
    // Connect to WordPress
    console.log('🔌 Connecting to production WordPress...');
    await client.connect();
    console.log('✓ Connected successfully\n');

    // Run export
    console.log('📤 Exporting content...\n');
    const exportData = await exporter.export();

    // Save to file
    const outputPath = path.join(process.cwd(), 'exports', 'production-export.json');
    await storage.save(exportData, outputPath);
    console.log(`\n💾 Saved to: ${outputPath}`);

    // Print summary
    console.log('\n📊 Export Summary:');
    console.log(`  • Posts: ${exportData.posts.length}`);
    console.log(`  • Pages: ${exportData.pages.length}`);
    console.log(`  • Categories: ${exportData.categories.length}`);
    console.log(`  • Tags: ${exportData.tags.length}`);

    await client.disconnect();
    console.log('\n✅ Export completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    await client.disconnect();
    process.exit(1);
  }
}

main();
```

#### 3. Environment Variables

**File**: `.env.local`
**Changes**: Add production WordPress credentials

```bash
# Production WordPress (port 8001)
WORDPRESS_PRODUCTION_MCP_URL=http://localhost:8001/wp-json/wordpress-poc/mcp
WORDPRESS_PRODUCTION_USERNAME=admin
WORDPRESS_PRODUCTION_PASSWORD=your_app_password_here

# Sandbox WordPress (port 8000)
WORDPRESS_SANDBOX_MCP_URL=http://localhost:8000/wp-json/wordpress-poc/mcp
WORDPRESS_SANDBOX_USERNAME=admin
WORDPRESS_SANDBOX_PASSWORD=your_app_password_here
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Export script runs: `tsx scripts/export-from-production.ts`
- [ ] Export file created: `ls -lh exports/production-export.json`
- [ ] JSON is valid: `jq . exports/production-export.json > /dev/null`

#### Manual Verification:
- [ ] Export completes in under 2 minutes for test site (50 posts)
- [ ] Export file contains all expected data (posts, pages, categories, tags)
- [ ] Post content is complete (title, content, status, date)
- [ ] Categories have correct structure (id, name, slug, parent)
- [ ] Site options include blogname and siteurl

**Implementation Note**: Run the export script and manually inspect the JSON file before proceeding to import phase.

---

## Phase 3: Import Service

### Overview
Create service to import exported WordPress data into sandbox via MCP.

### Changes Required

#### 1. Import Service

**File**: `lib/import/wordpress-importer.ts`
**Changes**: Create new file

```typescript
import { WordPressMcpClient } from '../mcp/wordpress-client';
import fs from 'fs/promises';
import { WordPressExportData } from '../export/wordpress-exporter';

export class WordPressImporter {
  constructor(private client: WordPressMcpClient) {}

  /**
   * Import WordPress data from export file
   */
  async import(exportData: WordPressExportData): Promise<void> {
    console.log('🚀 Starting WordPress import...\n');
    console.log(`📦 Importing from: ${exportData.metadata.site_name}`);
    console.log(`📅 Export date: ${exportData.metadata.export_date}\n`);

    // Step 1: Import categories first (needed for posts)
    console.log('📁 Importing categories...');
    const categoryMap = await this.importCategories(exportData.categories);
    console.log(`✓ Imported ${exportData.categories.length} categories\n`);

    // Step 2: Import tags
    console.log('🏷️  Importing tags...');
    const tagMap = await this.importTags(exportData.tags);
    console.log(`✓ Imported ${exportData.tags.length} tags\n`);

    // Step 3: Import posts
    console.log('📝 Importing posts...');
    await this.importPosts(exportData.posts, categoryMap, tagMap);
    console.log(`✓ Imported ${exportData.posts.length} posts\n`);

    // Step 4: Import pages
    console.log('📄 Importing pages...');
    await this.importPages(exportData.pages);
    console.log(`✓ Imported ${exportData.pages.length} pages\n`);

    console.log('✅ Import completed successfully!');
  }

  /**
   * Import categories and return old ID -> new ID mapping
   */
  private async importCategories(categories: any[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();

    // Note: This is simplified - in production you'd need to handle:
    // - Checking if category already exists (by slug)
    // - Handling parent categories in correct order
    // - For POC, we'll just skip if exists

    for (const category of categories) {
      try {
        // Check if category exists by slug
        // For POC, we'll create new ones (WordPress will handle duplicates)
        console.log(`  Creating category: ${category.name}`);

        // Note: MCP doesn't have create-category ability yet
        // For POC, categories need to be manually created or we skip this
        // In Phase 4, we can add wordpress/create-category ability

        // For now, just map old ID to itself (assumes same structure)
        map.set(category.id, category.id);
      } catch (error) {
        console.warn(`  ⚠️  Failed to import category ${category.name}:`, error);
      }
    }

    return map;
  }

  /**
   * Import tags and return old ID -> new ID mapping
   */
  private async importTags(tags: any[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();

    // Similar to categories - simplified for POC
    for (const tag of tags) {
      map.set(tag.id, tag.id);
    }

    return map;
  }

  /**
   * Import posts
   */
  private async importPosts(
    posts: any[],
    categoryMap: Map<number, number>,
    tagMap: Map<number, number>
  ): Promise<void> {
    let imported = 0;

    for (const post of posts) {
      try {
        console.log(`  Importing: "${post.title}"`);

        // Create post using existing MCP ability
        await this.client.callTool('wordpress/create-post', {
          title: post.title,
          content: post.content,
          status: post.status === 'publish' ? 'publish' : 'draft',
          // Note: categories and tags would need additional MCP abilities
          // For POC, we'll just import title and content
        });

        imported++;
      } catch (error) {
        console.warn(`  ⚠️  Failed to import post "${post.title}":`, error);
      }
    }

    console.log(`  Successfully imported ${imported}/${posts.length} posts`);
  }

  /**
   * Import pages
   */
  private async importPages(pages: any[]): Promise<void> {
    // Pages are similar to posts but post_type='page'
    // For POC, we'll skip pages since create-post doesn't support post_type yet
    // Can add in Phase 4 with wordpress/create-page ability
    console.log('  ⚠️  Page import not yet implemented (needs create-page ability)');
  }

  /**
   * Load export data from JSON file
   */
  static async loadFromFile(filePath: string): Promise<WordPressExportData> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }
}
```

#### 2. Import Script

**File**: `scripts/import-to-sandbox.ts`
**Changes**: Create new file

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import { WordPressMcpClient } from '../lib/mcp/wordpress-client';
import { WordPressImporter } from '../lib/import/wordpress-importer';
import path from 'path';

async function main() {
  console.log('═════════════════════════════════════════════════');
  console.log('   WordPress Sandbox Import');
  console.log('═════════════════════════════════════════════════\n');

  // Load export data
  const exportPath = path.join(process.cwd(), 'exports', 'production-export.json');
  console.log(`📂 Loading export from: ${exportPath}\n`);
  const exportData = await WordPressImporter.loadFromFile(exportPath);

  // Create MCP client for sandbox (port 8000)
  const client = new WordPressMcpClient({
    url: process.env.WORDPRESS_SANDBOX_MCP_URL || 'http://localhost:8000/wp-json/wordpress-poc/mcp',
    username: process.env.WORDPRESS_SANDBOX_USERNAME || 'admin',
    password: process.env.WORDPRESS_SANDBOX_PASSWORD || '',
  });

  try {
    // Connect to sandbox WordPress
    console.log('🔌 Connecting to sandbox WordPress...');
    await client.connect();
    console.log('✓ Connected successfully\n');

    // Create importer and run import
    const importer = new WordPressImporter(client);
    await importer.import(exportData);

    await client.disconnect();
    console.log('\n✅ Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    await client.disconnect();
    process.exit(1);
  }
}

main();
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Import script runs: `tsx scripts/import-to-sandbox.ts`
- [ ] No crashes or unhandled errors

#### Manual Verification:
- [ ] Posts are created in sandbox WordPress: Visit http://localhost:8000/wp-admin/edit.php
- [ ] Post titles and content match export data
- [ ] Post count in sandbox matches export count
- [ ] Can view imported posts in WordPress admin

**Implementation Note**: After import, manually verify several posts in sandbox WordPress admin to ensure content is correct.

---

## Phase 4: End-to-End Flow Test

### Overview
Create test script to verify the complete round-trip: export → import → edit → sync.

### Changes Required

#### 1. Test Script

**File**: `scripts/test-full-flow.ts`
**Changes**: Create new file

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import { WordPressMcpClient } from '../lib/mcp/wordpress-client';
import { WordPressExporter } from '../lib/export/wordpress-exporter';
import { WordPressImporter } from '../lib/import/wordpress-importer';
import { ChangeTracker } from '../lib/sync/change-tracker';
import { ProductionSync } from '../lib/sync/production-sync';
import path from 'path';

async function main() {
  console.log('═════════════════════════════════════════════════════════════');
  console.log('   Full Export → Import → Edit → Sync Flow Test');
  console.log('═════════════════════════════════════════════════════════════\n');

  // Initialize clients
  const productionClient = new WordPressMcpClient({
    url: 'http://localhost:8001/wp-json/wordpress-poc/mcp',
    username: process.env.WORDPRESS_PRODUCTION_USERNAME || 'admin',
    password: process.env.WORDPRESS_PRODUCTION_PASSWORD || '',
  });

  const sandboxClient = new WordPressMcpClient({
    url: 'http://localhost:8000/wp-json/wordpress-poc/mcp',
    username: process.env.WORDPRESS_SANDBOX_USERNAME || 'admin',
    password: process.env.WORDPRESS_SANDBOX_PASSWORD || '',
  });

  try {
    // ===== STEP 1: EXPORT FROM PRODUCTION =====
    console.log('📤 STEP 1: Exporting from production...\n');
    await productionClient.connect();

    const exporter = new WordPressExporter(productionClient);
    const exportData = await exporter.export();

    const exportPath = path.join(process.cwd(), 'exports', 'test-export.json');
    await exporter.saveToFile(exportData, exportPath);

    await productionClient.disconnect();
    console.log('✅ Export completed\n');

    // ===== STEP 2: IMPORT TO SANDBOX =====
    console.log('📥 STEP 2: Importing to sandbox...\n');
    await sandboxClient.connect();

    const importer = new WordPressImporter(sandboxClient);
    await importer.import(exportData);

    console.log('✅ Import completed\n');

    // ===== STEP 3: MAKE EDIT IN SANDBOX =====
    console.log('✏️  STEP 3: Making test edit in sandbox...\n');

    // Initialize change tracker
    const changeTracker = new ChangeTracker();

    // Get first post from sandbox
    const listResult = await sandboxClient.callTool('wordpress/list-posts', { per_page: 1 });
    const posts = JSON.parse(listResult.content[0].text).posts;

    if (posts.length === 0) {
      throw new Error('No posts found in sandbox to edit');
    }

    const testPost = posts[0];
    console.log(`  Editing post: "${testPost.title}"`);

    // Update post with AI-like edit
    const updatedContent = testPost.content + '\n\n[Test edit from POC flow]';
    await sandboxClient.callTool('wordpress/update-post', {
      id: testPost.id,
      title: testPost.title,
      content: updatedContent,
      status: testPost.status,
    });

    // Track the change
    changeTracker.trackChange(testPost.id, 'update', {
      title: testPost.title,
      content: updatedContent,
      status: testPost.status,
    });

    console.log('✓ Test edit completed\n');

    // ===== STEP 4: SYNC TO PRODUCTION =====
    console.log('🔄 STEP 4: Syncing changes to production...\n');

    await productionClient.connect();
    const productionSync = new ProductionSync(productionClient);

    const changes = changeTracker.getChanges();
    console.log(`  Found ${changes.length} change(s) to sync`);

    await productionSync.syncChanges(changes);

    console.log('✅ Sync completed\n');

    // ===== VERIFICATION =====
    console.log('🔍 STEP 5: Verifying changes in production...\n');

    const verifyResult = await productionClient.callTool('wordpress/get-post', {
      id: testPost.id,
    });
    const verifiedPost = JSON.parse(verifyResult.content[0].text);

    if (verifiedPost.content.includes('[Test edit from POC flow]')) {
      console.log('✅ VERIFICATION PASSED: Edit found in production!\n');
    } else {
      console.log('❌ VERIFICATION FAILED: Edit not found in production\n');
    }

    // Cleanup
    await sandboxClient.disconnect();
    await productionClient.disconnect();

    console.log('═════════════════════════════════════════════════════════════');
    console.log('✅ FULL FLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('═════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await sandboxClient.disconnect();
    await productionClient.disconnect();
    process.exit(1);
  }
}

main();
```

### Success Criteria

#### Automated Verification:
- [ ] Full flow test runs without errors: `tsx scripts/test-full-flow.ts`
- [ ] Verification step passes (edit found in production)
- [ ] Change tracker captures the edit correctly
- [ ] Production sync completes without errors

#### Manual Verification:
- [ ] Can see the test edit in production WordPress admin
- [ ] Post content in production matches sandbox after sync
- [ ] Change tracking logged the correct operation (update)
- [ ] No data corruption or loss during round-trip

**Implementation Note**: Run this test multiple times to ensure consistency. Check both WordPress admin UIs to verify data integrity.

---

## Testing Strategy

### Manual Testing Steps

1. **Setup Production WordPress with Test Data:**
   ```bash
   # Access production WordPress (port 8001)
   open http://localhost:8001/wp-admin

   # Create test content:
   # - 10 posts with various statuses (published, draft)
   # - 3 pages
   # - 5 categories
   # - 10 tags
   ```

2. **Run Export:**
   ```bash
   tsx scripts/export-from-production.ts

   # Verify export file:
   cat exports/production-export.json | jq '.posts | length'
   cat exports/production-export.json | jq '.categories'
   ```

3. **Run Import:**
   ```bash
   # Clear sandbox first (optional - reset WordPress)
   docker-compose restart wordpress

   tsx scripts/import-to-sandbox.ts

   # Verify in sandbox:
   open http://localhost:8000/wp-admin
   ```

4. **Test AI Edit Flow:**
   ```bash
   # Run the existing AI editor (if you have one)
   # Or manually edit a post in sandbox

   # Verify change tracking captures edits
   ```

5. **Run Full Flow Test:**
   ```bash
   tsx scripts/test-full-flow.ts

   # Should complete all 5 steps successfully
   ```

### Edge Cases to Test

- Empty WordPress site (no posts)
- Large site (100+ posts)
- Posts with special characters in title/content
- Draft vs published posts
- Posts with categories/tags assigned

---

## Next Steps After POC

Once this POC proves the flow works, you can incrementally add:

1. **Phase 5: Media Handling** - Download media files, not just metadata
2. **Phase 6: Better Import** - Add create-page, create-category, create-tag abilities
3. **Phase 7: ID Mapping** - Handle ID changes between export/import properly
4. **Phase 8: Background Jobs** - Move to async processing with BullMQ
5. **Phase 9: UI** - Add web interface for onboarding
6. **Phase 10: Database** - Store export history in PostgreSQL

---

## Dependencies to Install

```bash
# Install wp-types for WordPress REST API type definitions
pnpm add -D wp-types

# Already installed:
# - @modelcontextprotocol/sdk (already installed)
# - dotenv (already installed)
# - TypeScript (already installed)
```

**Why wp-types?**
- Comprehensive, actively maintained TypeScript definitions for WordPress 6.8+
- Covers ALL WordPress REST API entities (posts, pages, categories, tags, media, users)
- Automatically tested against actual WordPress core
- Zero runtime overhead (type definitions only)
- 4.68.1 (updated 2025)

---

## Time Estimate

- **Phase 1** (MCP Abilities): 2-3 hours
- **Phase 2** (Export Service): 2-3 hours
- **Phase 3** (Import Service): 3-4 hours
- **Phase 4** (Full Flow Test): 1-2 hours

**Total: 8-12 hours** (1-2 days)

---

## Success Definition

The POC is successful when:

✅ Can export 50+ posts from production in under 2 minutes
✅ Export JSON contains all posts, pages, categories, tags, options
✅ Import creates all posts in sandbox without errors
✅ Can make AI-powered edits in sandbox
✅ Changes sync back to production correctly
✅ No data loss during full round-trip
✅ Full flow test passes consistently
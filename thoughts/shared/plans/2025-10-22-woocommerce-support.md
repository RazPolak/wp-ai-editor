# WooCommerce Support Implementation Plan

## Overview

Add comprehensive WooCommerce e-commerce capabilities to the WordPress AI agent system, enabling clients who use WooCommerce to manage their online store through natural language interactions. This includes product management, order processing, customer management, coupons, and inventory tracking.

## Current State Analysis

### What We Have ✅
- **MCP Infrastructure**: WordPress MCP Adapter with Abilities API working (`/wp-content/mu-plugins/`)
- **Existing Abilities**: 5 WordPress post operations (get, list, create, update, delete)
- **Multi-Environment Support**: Sandbox, production, and real-site environments
- **Agent System**: Vercel AI SDK with Claude/GPT-4 integration (`lib/agents/wordpress-agent.ts`)
- **Change Tracking**: In-memory change tracking for production sync (`lib/sync/change-tracker.ts`)
- **Tool Framework**: Zod schemas + tool definitions + MCP client (`lib/tools/`, `lib/mcp/`)
- **WooCommerce Installed**: Already available in real-site test environment (port 8002)
- **Detection Patterns**: Storefront theme has WooCommerce detection utilities (`wp-content/themes/storefront/inc/storefront-functions.php:8-14`)

### Current Gaps ❌
- No WooCommerce-specific abilities registered
- No plugin detection ability (can't verify WooCommerce is active)
- No e-commerce entities exposed to agent (products, orders, customers, coupons)
- No TypeScript schemas for WooCommerce entities
- No tool definitions for WooCommerce operations
- Agent doesn't know about e-commerce capabilities

### Key Discoveries

**WooCommerce Plugin Detection Pattern**
- File: `wp-content/themes/storefront/inc/storefront-functions.php:8-14`
- Uses `class_exists('WooCommerce')` to detect activation
- Pattern: `function storefront_is_woocommerce_activated() { return class_exists('WooCommerce'); }`

**WooCommerce REST API Capabilities**
- REST API v3 provides comprehensive endpoints
- Core entities: Products, Orders, Customers, Coupons
- Additional resources: Categories, Tags, Attributes, Variations, Shipping, Tax
- All support CRUD operations with pagination, filtering, and bulk updates

**Ability Registration Pattern**
- File: `wp-content/mu-plugins/register-wordpress-abilities.php:25-419`
- Hook: `abilities_api_init` with priority 100
- Format: `wp_register_ability('category/action', [...config])`
- Each ability has: label, description, category, input/output schemas, execute callback, permission callback

**MCP Server Configuration**
- File: `wp-content/mu-plugins/configure-mcp-server.php:27-34`
- Abilities array must include all registered ability names
- Format: Uses slashes (e.g., `'wordpress/get-post'`)

## Desired End State

### Agent Capabilities

Clients with WooCommerce will be able to use natural language to:

**Product Management**
- Create/update/delete products with details (name, description, price, SKU, stock)
- Manage product categories and tags
- Handle product variations (sizes, colors, etc.)
- Upload product images (via URL or reference)
- Set sale prices and schedules

**Order Management**
- List orders with filtering (status, date range, customer)
- View order details (items, totals, customer info)
- Update order status (processing, completed, refunded)
- Add order notes for internal tracking
- Process refunds (full or partial)

**Customer Management**
- List customers with purchase history
- View customer details (name, email, addresses, total spent)
- Update customer information
- See customer orders and downloads

**Coupon Management**
- Create discount codes (percentage or fixed amount)
- Set coupon restrictions (minimum spend, product categories)
- Update or deactivate coupons
- View coupon usage statistics

**Inventory Management**
- Check stock levels across products
- Update stock quantities
- Identify low-stock items
- Generate inventory reports

### Verification Criteria

**Functional Requirements**
- Agent can detect if WooCommerce is installed and active
- Agent can create a complete product with all attributes
- Agent can process an order status change (pending → processing → completed)
- Agent can create and apply a coupon code
- Agent can update inventory for multiple products
- Agent can retrieve customer purchase history
- All operations respect WordPress permissions (`manage_woocommerce`, `edit_shop_orders`, etc.)

**Technical Requirements**
- All WooCommerce abilities registered in `register-wordpress-abilities.php`
- Corresponding TypeScript schemas in `lib/tools/wordpress-schemas.ts`
- Tool definitions in `lib/tools/wordpress-tools.ts`
- MCP server configuration includes all WooCommerce abilities
- Change tracking captures WooCommerce operations for production sync
- Error handling for WooCommerce-specific errors (invalid SKU, out of stock, etc.)

## What We're NOT Doing

**Out of Scope for This Plan**
- **Payment Gateway Configuration**: Not handling Stripe/PayPal API keys or settings
- **Shipping Configuration**: Not managing shipping zones, methods, or rates
- **Tax Configuration**: Not handling tax rates, classes, or calculations (read-only acceptable)
- **WooCommerce Extensions**: Not supporting specialized plugins (Subscriptions, Bookings, Memberships)
- **Product Import/Export**: Not implementing CSV/XML product imports (use WP-CLI or existing tools)
- **Analytics & Reports**: Not creating custom analytics (basic reports only)
- **Frontend Customization**: Not modifying WooCommerce templates or checkout flow
- **Email Templates**: Not customizing WooCommerce notification emails
- **Inventory Sync**: Not integrating with external inventory systems
- **Multi-Currency**: Not handling currency conversion or multiple currencies

## Implementation Approach

### Strategy

**Progressive Enhancement Pattern**
1. Start with plugin detection (verify WooCommerce is available)
2. Add core entities one phase at a time (Products → Orders → Customers → Coupons → Inventory)
3. Each phase is independently testable and deployable
4. Follow existing patterns from WordPress post abilities
5. Leverage WordPress and WooCommerce permission systems

**Technology Stack**
- **Backend**: WordPress + WooCommerce plugin (PHP)
- **Abilities Layer**: WordPress Abilities API (`wp_register_ability`)
- **Protocol**: Model Context Protocol (MCP) over HTTP
- **Frontend**: TypeScript + Vercel AI SDK
- **Validation**: Zod schemas for runtime type safety
- **Authentication**: WordPress Application Passwords (existing)

**Development Workflow**
1. Write PHP ability in `register-wordpress-abilities.php`
2. Add ability name to MCP server config in `configure-mcp-server.php`
3. Define Zod schema in `lib/tools/wordpress-schemas.ts`
4. Create tool definition in `lib/tools/wordpress-tools.ts`
5. Test via agent API endpoint
6. Verify change tracking captures operation

---

## Phase 1: Plugin Detection & Infrastructure

### Overview
Add ability to detect WooCommerce installation and activation status. This is foundational for conditional capability exposure and intelligent agent behavior.

### Changes Required

#### 1. WooCommerce Detection Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add new ability after line 419 (after existing abilities)

```php
// WooCommerce Plugin Detection
$get_plugin_status = wp_register_ability('wordpress/get-plugin-status', [
    'label' => 'Get Plugin Status',
    'description' => 'Checks if a WordPress plugin is installed and active',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'plugin_slug' => [
                'type' => 'string',
                'description' => 'Plugin slug to check (e.g., "woocommerce")',
            ],
        ],
        'required' => ['plugin_slug'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'is_installed' => ['type' => 'boolean'],
            'is_active' => ['type' => 'boolean'],
            'version' => ['type' => 'string'],
            'name' => ['type' => 'string'],
            'plugin_uri' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        $plugin_slug = $input['plugin_slug'] ?? '';

        // Require plugin.php for get_plugins() and is_plugin_active()
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Get all plugins
        $all_plugins = get_plugins();

        // Find plugin by slug
        $plugin_data = null;
        $plugin_file = null;

        foreach ($all_plugins as $plugin_path => $plugin_info) {
            if (strpos($plugin_path, $plugin_slug . '/') === 0) {
                $plugin_data = $plugin_info;
                $plugin_file = $plugin_path;
                break;
            }
        }

        // Not installed
        if (!$plugin_data) {
            return [
                'is_installed' => false,
                'is_active' => false,
                'version' => null,
                'name' => null,
                'plugin_uri' => null,
            ];
        }

        // Installed - check if active
        $is_active = is_plugin_active($plugin_file);

        return [
            'is_installed' => true,
            'is_active' => $is_active,
            'version' => $plugin_data['Version'] ?? null,
            'name' => $plugin_data['Name'] ?? null,
            'plugin_uri' => $plugin_data['PluginURI'] ?? null,
        ];
    },
    'permission_callback' => function($input) {
        return is_user_logged_in();
    },
    'meta' => [
        'show_in_rest' => true,
    ],
]);

error_log('[ABILITIES] Registered wordpress/get-plugin-status ability');
```

#### 2. Update MCP Server Configuration
**File**: `wp-content/mu-plugins/configure-mcp-server.php`
**Changes**: Add new ability to array at line 34

```php
[
    'wordpress/get-post',
    'wordpress/list-posts',
    'wordpress/create-post',
    'wordpress/update-post',
    'wordpress/delete-post',
    'wordpress/get-plugin-status', // ADD THIS LINE
]
```

#### 3. TypeScript Schema Definition
**File**: `lib/tools/wordpress-schemas.ts`
**Changes**: Add schema after line 60

```typescript
// wordpress-get-plugin-status schema (register-wordpress-abilities.php:421)
export const getPluginStatusSchema = z.object({
  plugin_slug: z.string().describe('Plugin slug to check (e.g., "woocommerce")')
});

export type GetPluginStatusInput = z.infer<typeof getPluginStatusSchema>;

export interface GetPluginStatusOutput {
  is_installed: boolean;
  is_active: boolean;
  version: string | null;
  name: string | null;
  plugin_uri: string | null;
}
```

#### 4. Tool Definition
**File**: `lib/tools/wordpress-tools.ts`
**Changes**: Add tool inside `createWordPressTools()` return object around line 107

```typescript
'wordpress-get-plugin-status': tool({
  description: `Checks if a WordPress plugin is installed and active in the ${envLabel} environment.`,
  parameters: getPluginStatusSchema,
  execute: async (input: GetPluginStatusInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('wordpress-get-plugin-status', input);
    return extractContent(result);
  }
})
```

#### 5. Update Change Tracker Types
**File**: `lib/sync/change-tracker.ts`
**Changes**: Add new type to union around line 61

```typescript
export type WordPressToolArgs =
  | GetPostInput
  | ListPostsInput
  | CreatePostInput
  | UpdatePostInput
  | DeletePostInput
  | GetPluginStatusInput; // ADD THIS LINE

export type WordPressToolResult =
  | GetPostOutput
  | ListPostsOutput
  | CreatePostOutput
  | UpdatePostOutput
  | DeletePostOutput
  | GetPluginStatusOutput; // ADD THIS LINE
```

### Success Criteria

#### Automated Verification:
- [ ] PHP ability registration succeeds: Check logs for `[ABILITIES] Registered wordpress/get-plugin-status ability`
- [ ] MCP server includes new ability: `curl http://localhost:8000/wp-json/wordpress-poc/mcp -X POST -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'` includes `wordpress-get-plugin-status`
- [ ] TypeScript compiles without errors: `pnpm tsc --noEmit`
- [ ] Test WooCommerce detection: `pnpm test:wordpress -- --grep "plugin status"`

#### Manual Verification:
- [ ] Agent can detect WooCommerce: Ask "Is WooCommerce installed?" and get correct response
- [ ] Agent reports WooCommerce version correctly
- [ ] Agent gracefully handles non-existent plugin queries
- [ ] Change tracker does NOT capture plugin status checks (read-only operation)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Core Product Management

### Overview
Enable complete product lifecycle management (CRUD operations) including basic product properties. This is the foundation of WooCommerce functionality.

### Changes Required

#### 1. List Products Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after plugin detection ability

```php
// WooCommerce - List Products
$list_products = wp_register_ability('woocommerce/list-products', [
    'label' => 'List Products',
    'description' => 'Lists WooCommerce products with pagination and filtering',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'per_page' => [
                'type' => 'integer',
                'description' => 'Number of products per page (default: 10)',
                'default' => 10,
            ],
            'page' => [
                'type' => 'integer',
                'description' => 'Page number (default: 1)',
                'default' => 1,
            ],
            'status' => [
                'type' => 'string',
                'description' => 'Product status filter (publish, draft, pending)',
                'enum' => ['publish', 'draft', 'pending', 'any'],
                'default' => 'publish',
            ],
            'category' => [
                'type' => 'string',
                'description' => 'Filter by category slug',
            ],
            'search' => [
                'type' => 'string',
                'description' => 'Search term for product name or SKU',
            ],
        ],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'products' => ['type' => 'array'],
            'total' => ['type' => 'integer'],
            'pages' => ['type' => 'integer'],
            'current_page' => ['type' => 'integer'],
        ],
    ],
    'execute_callback' => function($input) {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            return new WP_Error(
                'woocommerce_not_active',
                'WooCommerce plugin is not active',
                ['status' => 400]
            );
        }

        $per_page = $input['per_page'] ?? 10;
        $page = $input['page'] ?? 1;
        $status = $input['status'] ?? 'publish';
        $category = $input['category'] ?? '';
        $search = $input['search'] ?? '';

        // Build query args
        $args = [
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => $status === 'any' ? ['publish', 'draft', 'pending'] : $status,
        ];

        // Add category filter
        if (!empty($category)) {
            $args['tax_query'] = [
                [
                    'taxonomy' => 'product_cat',
                    'field' => 'slug',
                    'terms' => $category,
                ],
            ];
        }

        // Add search
        if (!empty($search)) {
            $args['s'] = $search;
        }

        // Get products
        $query = new WP_Query($args);
        $products = [];

        foreach ($query->posts as $post) {
            $product = wc_get_product($post->ID);

            if (!$product) {
                continue;
            }

            $products[] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'slug' => $product->get_slug(),
                'sku' => $product->get_sku(),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'status' => $product->get_status(),
                'stock_status' => $product->get_stock_status(),
                'stock_quantity' => $product->get_stock_quantity(),
                'manage_stock' => $product->get_manage_stock(),
                'type' => $product->get_type(),
                'permalink' => $product->get_permalink(),
                'image_url' => wp_get_attachment_url($product->get_image_id()),
            ];
        }

        return [
            'products' => $products,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'current_page' => $page,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_products');
    },
    'meta' => [
        'show_in_rest' => true,
    ],
]);
```

#### 2. Get Product Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after list products ability

```php
// WooCommerce - Get Product
$get_product = wp_register_ability('woocommerce/get-product', [
    'label' => 'Get Product',
    'description' => 'Retrieves a WooCommerce product by ID',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => [
                'type' => 'integer',
                'description' => 'Product ID',
            ],
        ],
        'required' => ['id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'name' => ['type' => 'string'],
            'description' => ['type' => 'string'],
            'short_description' => ['type' => 'string'],
            'sku' => ['type' => 'string'],
            'price' => ['type' => 'string'],
            'regular_price' => ['type' => 'string'],
            'sale_price' => ['type' => 'string'],
            'status' => ['type' => 'string'],
            'stock_status' => ['type' => 'string'],
            'stock_quantity' => ['type' => 'integer'],
            'categories' => ['type' => 'array'],
            'tags' => ['type' => 'array'],
            'images' => ['type' => 'array'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $product_id = $input['id'] ?? 0;
        $product = wc_get_product($product_id);

        if (!$product) {
            return new WP_Error('product_not_found', 'Product not found', ['status' => 404]);
        }

        // Get categories
        $categories = [];
        $category_terms = get_the_terms($product_id, 'product_cat');
        if ($category_terms && !is_wp_error($category_terms)) {
            foreach ($category_terms as $term) {
                $categories[] = [
                    'id' => $term->term_id,
                    'name' => $term->name,
                    'slug' => $term->slug,
                ];
            }
        }

        // Get tags
        $tags = [];
        $tag_terms = get_the_terms($product_id, 'product_tag');
        if ($tag_terms && !is_wp_error($tag_terms)) {
            foreach ($tag_terms as $term) {
                $tags[] = [
                    'id' => $term->term_id,
                    'name' => $term->name,
                    'slug' => $term->slug,
                ];
            }
        }

        // Get images
        $images = [];
        $image_ids = $product->get_gallery_image_ids();
        array_unshift($image_ids, $product->get_image_id());

        foreach ($image_ids as $image_id) {
            if ($image_id) {
                $images[] = [
                    'id' => $image_id,
                    'url' => wp_get_attachment_url($image_id),
                    'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                ];
            }
        }

        return [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'status' => $product->get_status(),
            'stock_status' => $product->get_stock_status(),
            'stock_quantity' => $product->get_stock_quantity(),
            'manage_stock' => $product->get_manage_stock(),
            'type' => $product->get_type(),
            'permalink' => $product->get_permalink(),
            'categories' => $categories,
            'tags' => $tags,
            'images' => $images,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_products');
    },
    'meta' => [
        'show_in_rest' => true,
    ],
]);
```

#### 3. Create Product Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get product ability

```php
// WooCommerce - Create Product
$create_product = wp_register_ability('woocommerce/create-product', [
    'label' => 'Create Product',
    'description' => 'Creates a new WooCommerce product',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'name' => [
                'type' => 'string',
                'description' => 'Product name',
            ],
            'description' => [
                'type' => 'string',
                'description' => 'Product description (HTML allowed)',
            ],
            'short_description' => [
                'type' => 'string',
                'description' => 'Short description (HTML allowed)',
            ],
            'sku' => [
                'type' => 'string',
                'description' => 'Stock Keeping Unit (SKU)',
            ],
            'regular_price' => [
                'type' => 'string',
                'description' => 'Regular price (e.g., "19.99")',
            ],
            'sale_price' => [
                'type' => 'string',
                'description' => 'Sale price (e.g., "14.99")',
            ],
            'status' => [
                'type' => 'string',
                'description' => 'Product status',
                'enum' => ['publish', 'draft', 'pending'],
                'default' => 'draft',
            ],
            'manage_stock' => [
                'type' => 'boolean',
                'description' => 'Whether to manage stock',
                'default' => false,
            ],
            'stock_quantity' => [
                'type' => 'integer',
                'description' => 'Stock quantity (if manage_stock is true)',
            ],
            'categories' => [
                'type' => 'array',
                'description' => 'Array of category IDs',
                'items' => ['type' => 'integer'],
            ],
            'tags' => [
                'type' => 'array',
                'description' => 'Array of tag IDs',
                'items' => ['type' => 'integer'],
            ],
        ],
        'required' => ['name', 'regular_price'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'name' => ['type' => 'string'],
            'sku' => ['type' => 'string'],
            'status' => ['type' => 'string'],
            'permalink' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        // Create product object
        $product = new WC_Product_Simple();

        // Set basic properties
        $product->set_name($input['name']);

        if (isset($input['description'])) {
            $product->set_description($input['description']);
        }

        if (isset($input['short_description'])) {
            $product->set_short_description($input['short_description']);
        }

        if (isset($input['sku'])) {
            $product->set_sku($input['sku']);
        }

        $product->set_regular_price($input['regular_price']);

        if (isset($input['sale_price'])) {
            $product->set_sale_price($input['sale_price']);
        }

        $product->set_status($input['status'] ?? 'draft');

        // Stock management
        if (isset($input['manage_stock']) && $input['manage_stock']) {
            $product->set_manage_stock(true);

            if (isset($input['stock_quantity'])) {
                $product->set_stock_quantity($input['stock_quantity']);
            }
        }

        // Save product
        $product_id = $product->save();

        if (!$product_id) {
            return new WP_Error('product_creation_failed', 'Failed to create product', ['status' => 500]);
        }

        // Set categories
        if (isset($input['categories']) && is_array($input['categories'])) {
            wp_set_object_terms($product_id, $input['categories'], 'product_cat');
        }

        // Set tags
        if (isset($input['tags']) && is_array($input['tags'])) {
            wp_set_object_terms($product_id, $input['tags'], 'product_tag');
        }

        return [
            'id' => $product_id,
            'name' => $product->get_name(),
            'sku' => $product->get_sku(),
            'status' => $product->get_status(),
            'permalink' => $product->get_permalink(),
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_products');
    },
    'meta' => [
        'show_in_rest' => true,
    ],
]);
```

#### 4. Update Product Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after create product ability

```php
// WooCommerce - Update Product
$update_product = wp_register_ability('woocommerce/update-product', [
    'label' => 'Update Product',
    'description' => 'Updates an existing WooCommerce product',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => [
                'type' => 'integer',
                'description' => 'Product ID',
            ],
            'name' => ['type' => 'string'],
            'description' => ['type' => 'string'],
            'short_description' => ['type' => 'string'],
            'sku' => ['type' => 'string'],
            'regular_price' => ['type' => 'string'],
            'sale_price' => ['type' => 'string'],
            'status' => [
                'type' => 'string',
                'enum' => ['publish', 'draft', 'pending'],
            ],
            'manage_stock' => ['type' => 'boolean'],
            'stock_quantity' => ['type' => 'integer'],
            'categories' => [
                'type' => 'array',
                'items' => ['type' => 'integer'],
            ],
            'tags' => [
                'type' => 'array',
                'items' => ['type' => 'integer'],
            ],
        ],
        'required' => ['id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'name' => ['type' => 'string'],
            'status' => ['type' => 'string'],
            'permalink' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $product_id = $input['id'] ?? 0;
        $product = wc_get_product($product_id);

        if (!$product) {
            return new WP_Error('product_not_found', 'Product not found', ['status' => 404]);
        }

        // Update properties
        if (isset($input['name'])) {
            $product->set_name($input['name']);
        }

        if (isset($input['description'])) {
            $product->set_description($input['description']);
        }

        if (isset($input['short_description'])) {
            $product->set_short_description($input['short_description']);
        }

        if (isset($input['sku'])) {
            $product->set_sku($input['sku']);
        }

        if (isset($input['regular_price'])) {
            $product->set_regular_price($input['regular_price']);
        }

        if (isset($input['sale_price'])) {
            $product->set_sale_price($input['sale_price']);
        }

        if (isset($input['status'])) {
            $product->set_status($input['status']);
        }

        if (isset($input['manage_stock'])) {
            $product->set_manage_stock($input['manage_stock']);

            if ($input['manage_stock'] && isset($input['stock_quantity'])) {
                $product->set_stock_quantity($input['stock_quantity']);
            }
        }

        // Save product
        $product->save();

        // Update categories
        if (isset($input['categories'])) {
            wp_set_object_terms($product_id, $input['categories'], 'product_cat');
        }

        // Update tags
        if (isset($input['tags'])) {
            wp_set_object_terms($product_id, $input['tags'], 'product_tag');
        }

        return [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'status' => $product->get_status(),
            'permalink' => $product->get_permalink(),
        ];
    },
    'permission_callback' => function($input) {
        $product_id = $input['id'] ?? 0;
        return current_user_can('edit_product', $product_id);
    },
    'meta' => [
        'show_in_rest' => true,
    ],
]);
```

#### 5. Delete Product Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update product ability

```php
// WooCommerce - Delete Product
$delete_product = wp_register_ability('woocommerce/delete-product', [
    'label' => 'Delete Product',
    'description' => 'Deletes a WooCommerce product',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => [
                'type' => 'integer',
                'description' => 'Product ID',
            ],
            'force' => [
                'type' => 'boolean',
                'description' => 'Whether to permanently delete (true) or move to trash (false)',
                'default' => false,
            ],
        ],
        'required' => ['id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
            'deleted_product' => ['type' => 'object'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $product_id = $input['id'] ?? 0;
        $force = $input['force'] ?? false;

        $product = wc_get_product($product_id);

        if (!$product) {
            return new WP_Error('product_not_found', 'Product not found', ['status' => 404]);
        }

        $product_name = $product->get_name();

        // Delete product
        $deleted = $product->delete($force);

        if (!$deleted) {
            return new WP_Error('product_deletion_failed', 'Failed to delete product', ['status' => 500]);
        }

        return [
            'success' => true,
            'message' => $force ? 'Product permanently deleted' : 'Product moved to trash',
            'deleted_product' => [
                'id' => $product_id,
                'name' => $product_name,
            ],
        ];
    },
    'permission_callback' => function($input) {
        $product_id = $input['id'] ?? 0;
        return current_user_can('delete_product', $product_id);
    },
    'meta' => [
        'show_in_rest' => true,
    ],
]);
```

#### 6. Update MCP Server Configuration
**File**: `wp-content/mu-plugins/configure-mcp-server.php`
**Changes**: Add new abilities to array at line 34

```php
[
    'wordpress/get-post',
    'wordpress/list-posts',
    'wordpress/create-post',
    'wordpress/update-post',
    'wordpress/delete-post',
    'wordpress/get-plugin-status',
    'woocommerce/list-products',  // ADD THESE LINES
    'woocommerce/get-product',
    'woocommerce/create-product',
    'woocommerce/update-product',
    'woocommerce/delete-product',
]
```

#### 7. TypeScript Schemas
**File**: `lib/tools/wordpress-schemas.ts`
**Changes**: Add WooCommerce schemas

```typescript
// WooCommerce Product Schemas

export const listProductsSchema = z.object({
  per_page: z.number().int().optional().default(10).describe('Number of products per page'),
  page: z.number().int().optional().default(1).describe('Page number for pagination'),
  status: z.enum(['publish', 'draft', 'pending', 'any']).optional().default('publish').describe('Product status filter'),
  category: z.string().optional().describe('Filter by category slug'),
  search: z.string().optional().describe('Search term for product name or SKU')
});

export type ListProductsInput = z.infer<typeof listProductsSchema>;

export const getProductSchema = z.object({
  id: z.number().int().describe('The product ID to retrieve')
});

export type GetProductInput = z.infer<typeof getProductSchema>;

export const createProductSchema = z.object({
  name: z.string().describe('Product name'),
  description: z.string().optional().describe('Product description (HTML allowed)'),
  short_description: z.string().optional().describe('Short description (HTML allowed)'),
  sku: z.string().optional().describe('Stock Keeping Unit (SKU)'),
  regular_price: z.string().describe('Regular price (e.g., "19.99")'),
  sale_price: z.string().optional().describe('Sale price (e.g., "14.99")'),
  status: z.enum(['publish', 'draft', 'pending']).optional().default('draft').describe('Product status'),
  manage_stock: z.boolean().optional().default(false).describe('Whether to manage stock'),
  stock_quantity: z.number().int().optional().describe('Stock quantity (if manage_stock is true)'),
  categories: z.array(z.number().int()).optional().describe('Array of category IDs'),
  tags: z.array(z.number().int()).optional().describe('Array of tag IDs')
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  id: z.number().int().describe('Product ID'),
  name: z.string().optional().describe('Product name'),
  description: z.string().optional().describe('Product description'),
  short_description: z.string().optional().describe('Short description'),
  sku: z.string().optional().describe('SKU'),
  regular_price: z.string().optional().describe('Regular price'),
  sale_price: z.string().optional().describe('Sale price'),
  status: z.enum(['publish', 'draft', 'pending']).optional().describe('Product status'),
  manage_stock: z.boolean().optional().describe('Manage stock'),
  stock_quantity: z.number().int().optional().describe('Stock quantity'),
  categories: z.array(z.number().int()).optional().describe('Category IDs'),
  tags: z.array(z.number().int()).optional().describe('Tag IDs')
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const deleteProductSchema = z.object({
  id: z.number().int().describe('Product ID'),
  force: z.boolean().optional().default(false).describe('Permanently delete (true) or trash (false)')
});

export type DeleteProductInput = z.infer<typeof deleteProductSchema>;
```

#### 8. Tool Definitions
**File**: `lib/tools/wordpress-tools.ts`
**Changes**: Add WooCommerce tools to `createWordPressTools()` return object

```typescript
// WooCommerce Product Tools
'woocommerce-list-products': tool({
  description: `Lists WooCommerce products with pagination and filtering in the ${envLabel} environment.`,
  parameters: listProductsSchema,
  execute: async (input: ListProductsInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-list-products', input);
    return extractContent(result);
  }
}),

'woocommerce-get-product': tool({
  description: `Retrieves a WooCommerce product by ID in the ${envLabel} environment.`,
  parameters: getProductSchema,
  execute: async (input: GetProductInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-product', input);
    return extractContent(result);
  }
}),

'woocommerce-create-product': tool({
  description: `Creates a new WooCommerce product in the ${envLabel} environment.`,
  parameters: createProductSchema,
  execute: async (input: CreateProductInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-create-product', input);
    return extractContent(result);
  }
}),

'woocommerce-update-product': tool({
  description: `Updates an existing WooCommerce product in the ${envLabel} environment.`,
  parameters: updateProductSchema,
  execute: async (input: UpdateProductInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-update-product', input);
    return extractContent(result);
  }
}),

'woocommerce-delete-product': tool({
  description: `Deletes a WooCommerce product in the ${envLabel} environment.`,
  parameters: deleteProductSchema,
  execute: async (input: DeleteProductInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-delete-product', input);
    return extractContent(result);
  }
})
```

#### 9. Update Change Tracker Types
**File**: `lib/sync/change-tracker.ts`
**Changes**: Add WooCommerce types to unions

```typescript
export type WordPressToolArgs =
  | GetPostInput
  | ListPostsInput
  | CreatePostInput
  | UpdatePostInput
  | DeletePostInput
  | GetPluginStatusInput
  | ListProductsInput    // ADD THESE
  | GetProductInput
  | CreateProductInput
  | UpdateProductInput
  | DeleteProductInput;

export type WordPressToolResult =
  | GetPostOutput
  | ListPostsOutput
  | CreatePostOutput
  | UpdatePostOutput
  | DeletePostOutput
  | GetPluginStatusOutput
  | ListProductsOutput   // ADD THESE
  | GetProductOutput
  | CreateProductOutput
  | UpdateProductOutput
  | DeleteProductOutput;
```

### Success Criteria

#### Automated Verification:
- [ ] All PHP abilities register successfully: Check logs for `[ABILITIES] Registered woocommerce/*` messages
- [ ] MCP server lists all product abilities: `curl http://localhost:8002/wp-json/wordpress-poc/mcp` (real-site has WooCommerce)
- [ ] TypeScript compiles without errors: `pnpm tsc --noEmit`
- [ ] Create product test passes: `pnpm test:woocommerce -- --grep "create product"`
- [ ] Update product test passes: `pnpm test:woocommerce -- --grep "update product"`
- [ ] Delete product test passes: `pnpm test:woocommerce -- --grep "delete product"`

#### Manual Verification:
- [ ] Agent can list products: "Show me all products"
- [ ] Agent can create a product: "Create a product called 'Test Widget' for $29.99"
- [ ] Agent can update product price: "Update the price of product ID 123 to $24.99"
- [ ] Agent can delete product: "Delete product ID 123"
- [ ] Agent handles WooCommerce not active gracefully in sandbox (where WC is not installed)
- [ ] Change tracker captures product creation/updates for production sync
- [ ] Product categories and tags are correctly set

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Order Management

### Overview
Enable comprehensive order management including listing, viewing, status updates, order notes, and refund processing. Orders are the core transactional entity in WooCommerce.

### Changes Required

#### 1. List Orders Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after product abilities

```php
// WooCommerce - List Orders
$list_orders = wp_register_ability('woocommerce/list-orders', [
    'label' => 'List Orders',
    'description' => 'Lists WooCommerce orders with pagination and filtering',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'per_page' => [
                'type' => 'integer',
                'description' => 'Number of orders per page',
                'default' => 10,
            ],
            'page' => [
                'type' => 'integer',
                'description' => 'Page number',
                'default' => 1,
            ],
            'status' => [
                'type' => 'string',
                'description' => 'Order status filter',
                'enum' => ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'any'],
                'default' => 'any',
            ],
            'customer_id' => [
                'type' => 'integer',
                'description' => 'Filter by customer ID',
            ],
        ],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'orders' => ['type' => 'array'],
            'total' => ['type' => 'integer'],
            'pages' => ['type' => 'integer'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $args = [
            'limit' => $input['per_page'] ?? 10,
            'page' => $input['page'] ?? 1,
        ];

        if (isset($input['status']) && $input['status'] !== 'any') {
            $args['status'] = $input['status'];
        }

        if (isset($input['customer_id'])) {
            $args['customer_id'] = $input['customer_id'];
        }

        $orders = wc_get_orders($args);

        // Count total orders
        $count_args = $args;
        unset($count_args['limit'], $count_args['page']);
        $count_args['return'] = 'ids';
        $total = count(wc_get_orders($count_args));

        $orders_data = [];

        foreach ($orders as $order) {
            $orders_data[] = [
                'id' => $order->get_id(),
                'order_number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'total' => $order->get_total(),
                'currency' => $order->get_currency(),
                'customer_id' => $order->get_customer_id(),
                'customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'customer_email' => $order->get_billing_email(),
                'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
                'payment_method' => $order->get_payment_method_title(),
            ];
        }

        return [
            'orders' => $orders_data,
            'total' => $total,
            'pages' => ceil($total / ($input['per_page'] ?? 10)),
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_shop_orders');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 2. Get Order Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after list orders ability

```php
// WooCommerce - Get Order
$get_order = wp_register_ability('woocommerce/get-order', [
    'label' => 'Get Order',
    'description' => 'Retrieves a WooCommerce order by ID with full details',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => [
                'type' => 'integer',
                'description' => 'Order ID',
            ],
        ],
        'required' => ['id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'order_number' => ['type' => 'string'],
            'status' => ['type' => 'string'],
            'total' => ['type' => 'string'],
            'line_items' => ['type' => 'array'],
            'billing' => ['type' => 'object'],
            'shipping' => ['type' => 'object'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $order_id = $input['id'] ?? 0;
        $order = wc_get_order($order_id);

        if (!$order) {
            return new WP_Error('order_not_found', 'Order not found', ['status' => 404]);
        }

        // Get line items
        $line_items = [];
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            $line_items[] = [
                'id' => $item->get_id(),
                'product_id' => $item->get_product_id(),
                'product_name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => $item->get_total(),
                'sku' => $product ? $product->get_sku() : '',
            ];
        }

        return [
            'id' => $order->get_id(),
            'order_number' => $order->get_order_number(),
            'status' => $order->get_status(),
            'total' => $order->get_total(),
            'subtotal' => $order->get_subtotal(),
            'shipping_total' => $order->get_shipping_total(),
            'tax_total' => $order->get_total_tax(),
            'currency' => $order->get_currency(),
            'customer_id' => $order->get_customer_id(),
            'payment_method' => $order->get_payment_method_title(),
            'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
            'date_modified' => $order->get_date_modified()->date('Y-m-d H:i:s'),
            'line_items' => $line_items,
            'billing' => [
                'first_name' => $order->get_billing_first_name(),
                'last_name' => $order->get_billing_last_name(),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
                'address_1' => $order->get_billing_address_1(),
                'address_2' => $order->get_billing_address_2(),
                'city' => $order->get_billing_city(),
                'state' => $order->get_billing_state(),
                'postcode' => $order->get_billing_postcode(),
                'country' => $order->get_billing_country(),
            ],
            'shipping' => [
                'first_name' => $order->get_shipping_first_name(),
                'last_name' => $order->get_shipping_last_name(),
                'address_1' => $order->get_shipping_address_1(),
                'address_2' => $order->get_shipping_address_2(),
                'city' => $order->get_shipping_city(),
                'state' => $order->get_shipping_state(),
                'postcode' => $order->get_shipping_postcode(),
                'country' => $order->get_shipping_country(),
            ],
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_shop_orders');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 3. Update Order Status Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get order ability

```php
// WooCommerce - Update Order Status
$update_order_status = wp_register_ability('woocommerce/update-order-status', [
    'label' => 'Update Order Status',
    'description' => 'Updates the status of a WooCommerce order',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => [
                'type' => 'integer',
                'description' => 'Order ID',
            ],
            'status' => [
                'type' => 'string',
                'description' => 'New order status',
                'enum' => ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'],
            ],
            'note' => [
                'type' => 'string',
                'description' => 'Optional note to add to order',
            ],
        ],
        'required' => ['id', 'status'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'status' => ['type' => 'string'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $order_id = $input['id'] ?? 0;
        $order = wc_get_order($order_id);

        if (!$order) {
            return new WP_Error('order_not_found', 'Order not found', ['status' => 404]);
        }

        $new_status = $input['status'];

        // Update status
        $order->update_status($new_status, $input['note'] ?? '');

        return [
            'id' => $order->get_id(),
            'status' => $order->get_status(),
            'message' => "Order status updated to {$new_status}",
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_shop_orders');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 4. Add Order Note Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update order status ability

```php
// WooCommerce - Add Order Note
$add_order_note = wp_register_ability('woocommerce/add-order-note', [
    'label' => 'Add Order Note',
    'description' => 'Adds a note to a WooCommerce order',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'order_id' => [
                'type' => 'integer',
                'description' => 'Order ID',
            ],
            'note' => [
                'type' => 'string',
                'description' => 'Note content',
            ],
            'is_customer_note' => [
                'type' => 'boolean',
                'description' => 'Whether customer can see this note',
                'default' => false,
            ],
        ],
        'required' => ['order_id', 'note'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'note_id' => ['type' => 'integer'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $order_id = $input['order_id'] ?? 0;
        $order = wc_get_order($order_id);

        if (!$order) {
            return new WP_Error('order_not_found', 'Order not found', ['status' => 404]);
        }

        $note = $input['note'];
        $is_customer_note = $input['is_customer_note'] ?? false;

        // Add note
        $note_id = $order->add_order_note($note, $is_customer_note);

        return [
            'note_id' => $note_id,
            'message' => 'Order note added successfully',
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_shop_orders');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 5. Update MCP Server, Schemas, and Tools
Follow the same pattern as Phase 2:
- Add order abilities to MCP server config
- Create TypeScript schemas for order operations
- Add tool definitions
- Update change tracker types

### Success Criteria

#### Automated Verification:
- [ ] All order abilities register successfully
- [ ] MCP server lists all order abilities
- [ ] TypeScript compiles without errors
- [ ] List orders test passes: `pnpm test:woocommerce -- --grep "list orders"`
- [ ] Update order status test passes
- [ ] Add order note test passes

#### Manual Verification:
- [ ] Agent can list orders: "Show me all pending orders"
- [ ] Agent can view order details: "What's in order 123?"
- [ ] Agent can update order status: "Mark order 123 as completed"
- [ ] Agent can add order notes: "Add a note to order 123 saying shipped via FedEx"
- [ ] Change tracker captures order status changes
- [ ] Order status transitions trigger appropriate WooCommerce hooks (emails, etc.)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Customer Management

### Overview
Enable customer data management including listing, viewing customer details, purchase history, and customer updates.

### Changes Required

#### 1. List Customers Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add customer abilities following order abilities pattern

```php
// WooCommerce - List Customers
$list_customers = wp_register_ability('woocommerce/list-customers', [
    'label' => 'List Customers',
    'description' => 'Lists WooCommerce customers with pagination',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'per_page' => [
                'type' => 'integer',
                'description' => 'Number of customers per page',
                'default' => 10,
            ],
            'page' => [
                'type' => 'integer',
                'description' => 'Page number',
                'default' => 1,
            ],
            'search' => [
                'type' => 'string',
                'description' => 'Search by name or email',
            ],
        ],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'customers' => ['type' => 'array'],
            'total' => ['type' => 'integer'],
            'pages' => ['type' => 'integer'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $per_page = $input['per_page'] ?? 10;
        $page = $input['page'] ?? 1;

        $args = [
            'role' => 'customer',
            'number' => $per_page,
            'paged' => $page,
        ];

        if (isset($input['search'])) {
            $args['search'] = '*' . $input['search'] . '*';
            $args['search_columns'] = ['user_login', 'user_email', 'display_name'];
        }

        $user_query = new WP_User_Query($args);
        $customers = $user_query->get_results();

        $customers_data = [];

        foreach ($customers as $user) {
            $customer = new WC_Customer($user->ID);

            $customers_data[] = [
                'id' => $customer->get_id(),
                'email' => $customer->get_email(),
                'first_name' => $customer->get_first_name(),
                'last_name' => $customer->get_last_name(),
                'username' => $customer->get_username(),
                'orders_count' => $customer->get_order_count(),
                'total_spent' => $customer->get_total_spent(),
                'date_created' => $customer->get_date_created()->date('Y-m-d H:i:s'),
            ];
        }

        return [
            'customers' => $customers_data,
            'total' => $user_query->get_total(),
            'pages' => ceil($user_query->get_total() / $per_page),
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('list_users');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 2. Get Customer Details Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add get customer ability

```php
// WooCommerce - Get Customer
$get_customer = wp_register_ability('woocommerce/get-customer', [
    'label' => 'Get Customer',
    'description' => 'Retrieves detailed customer information',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => [
                'type' => 'integer',
                'description' => 'Customer ID',
            ],
        ],
        'required' => ['id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'integer'],
            'email' => ['type' => 'string'],
            'first_name' => ['type' => 'string'],
            'last_name' => ['type' => 'string'],
            'billing' => ['type' => 'object'],
            'shipping' => ['type' => 'object'],
            'orders_count' => ['type' => 'integer'],
            'total_spent' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $customer_id = $input['id'] ?? 0;
        $customer = new WC_Customer($customer_id);

        if (!$customer->get_id()) {
            return new WP_Error('customer_not_found', 'Customer not found', ['status' => 404]);
        }

        return [
            'id' => $customer->get_id(),
            'email' => $customer->get_email(),
            'first_name' => $customer->get_first_name(),
            'last_name' => $customer->get_last_name(),
            'username' => $customer->get_username(),
            'billing' => [
                'first_name' => $customer->get_billing_first_name(),
                'last_name' => $customer->get_billing_last_name(),
                'company' => $customer->get_billing_company(),
                'address_1' => $customer->get_billing_address_1(),
                'address_2' => $customer->get_billing_address_2(),
                'city' => $customer->get_billing_city(),
                'state' => $customer->get_billing_state(),
                'postcode' => $customer->get_billing_postcode(),
                'country' => $customer->get_billing_country(),
                'email' => $customer->get_billing_email(),
                'phone' => $customer->get_billing_phone(),
            ],
            'shipping' => [
                'first_name' => $customer->get_shipping_first_name(),
                'last_name' => $customer->get_shipping_last_name(),
                'company' => $customer->get_shipping_company(),
                'address_1' => $customer->get_shipping_address_1(),
                'address_2' => $customer->get_shipping_address_2(),
                'city' => $customer->get_shipping_city(),
                'state' => $customer->get_shipping_state(),
                'postcode' => $customer->get_shipping_postcode(),
                'country' => $customer->get_shipping_country(),
            ],
            'orders_count' => $customer->get_order_count(),
            'total_spent' => $customer->get_total_spent(),
            'date_created' => $customer->get_date_created()->date('Y-m-d H:i:s'),
            'date_modified' => $customer->get_date_modified()->date('Y-m-d H:i:s'),
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('list_users');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 3. Update MCP Server, Schemas, and Tools
Follow the established pattern for customer abilities.

### Success Criteria

#### Automated Verification:
- [ ] Customer abilities register successfully
- [ ] TypeScript compiles without errors
- [ ] List customers test passes
- [ ] Get customer test passes

#### Manual Verification:
- [ ] Agent can list customers: "Show me all customers"
- [ ] Agent can view customer details: "What are the details for customer 456?"
- [ ] Agent can search customers: "Find customers named John"
- [ ] Customer data displays correctly (addresses, order count, total spent)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Coupon Management

### Overview
Enable discount coupon creation and management for promotional campaigns.

### Changes Required

#### 1. List Coupons Ability
#### 2. Create Coupon Ability
#### 3. Update Coupon Ability
#### 4. Delete Coupon Ability

Follow the established pattern from previous phases. Coupons support:
- Discount types: percentage, fixed cart, fixed product
- Restrictions: minimum spend, product categories, usage limits
- Expiration dates

### Success Criteria

#### Automated Verification:
- [ ] Coupon abilities register successfully
- [ ] TypeScript compiles without errors
- [ ] Create coupon test passes
- [ ] Apply coupon test passes

#### Manual Verification:
- [ ] Agent can create percentage discount: "Create a 20% off coupon code SAVE20"
- [ ] Agent can create fixed discount: "Create a $10 off coupon for orders over $50"
- [ ] Agent can set coupon restrictions and expiration dates
- [ ] Coupons apply correctly in test orders

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Inventory Management

### Overview
Enable inventory tracking and stock management across products.

### Changes Required

#### 1. Get Low Stock Products Ability
```php
// List products with low stock
$get_low_stock = wp_register_ability('woocommerce/get-low-stock-products', [
    'label' => 'Get Low Stock Products',
    'description' => 'Lists products with low or out of stock inventory',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'threshold' => [
                'type' => 'integer',
                'description' => 'Stock threshold (default: 5)',
                'default' => 5,
            ],
        ],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'low_stock_products' => ['type' => 'array'],
            'out_of_stock_products' => ['type' => 'array'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $threshold = $input['threshold'] ?? 5;

        // Get low stock products
        $low_stock_args = [
            'post_type' => 'product',
            'posts_per_page' => -1,
            'meta_query' => [
                [
                    'key' => '_manage_stock',
                    'value' => 'yes',
                ],
                [
                    'key' => '_stock',
                    'value' => $threshold,
                    'type' => 'NUMERIC',
                    'compare' => '<=',
                ],
                [
                    'key' => '_stock',
                    'value' => 0,
                    'type' => 'NUMERIC',
                    'compare' => '>',
                ],
            ],
        ];

        $low_stock_query = new WP_Query($low_stock_args);
        $low_stock_products = [];

        foreach ($low_stock_query->posts as $post) {
            $product = wc_get_product($post->ID);
            $low_stock_products[] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'sku' => $product->get_sku(),
                'stock_quantity' => $product->get_stock_quantity(),
            ];
        }

        // Get out of stock products
        $out_of_stock_args = [
            'post_type' => 'product',
            'posts_per_page' => -1,
            'meta_query' => [
                [
                    'key' => '_stock_status',
                    'value' => 'outofstock',
                ],
            ],
        ];

        $out_of_stock_query = new WP_Query($out_of_stock_args);
        $out_of_stock_products = [];

        foreach ($out_of_stock_query->posts as $post) {
            $product = wc_get_product($post->ID);
            $out_of_stock_products[] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'sku' => $product->get_sku(),
                'stock_quantity' => $product->get_stock_quantity(),
            ];
        }

        return [
            'low_stock_products' => $low_stock_products,
            'out_of_stock_products' => $out_of_stock_products,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_products');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 2. Bulk Update Stock Ability
```php
// Bulk update stock quantities
$bulk_update_stock = wp_register_ability('woocommerce/bulk-update-stock', [
    'label' => 'Bulk Update Stock',
    'description' => 'Updates stock quantities for multiple products',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'products' => [
                'type' => 'array',
                'description' => 'Array of product updates',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'id' => ['type' => 'integer'],
                        'stock_quantity' => ['type' => 'integer'],
                    ],
                    'required' => ['id', 'stock_quantity'],
                ],
            ],
        ],
        'required' => ['products'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'updated' => ['type' => 'integer'],
            'failed' => ['type' => 'integer'],
            'results' => ['type' => 'array'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $products = $input['products'] ?? [];
        $updated = 0;
        $failed = 0;
        $results = [];

        foreach ($products as $product_data) {
            $product_id = $product_data['id'];
            $stock_quantity = $product_data['stock_quantity'];

            $product = wc_get_product($product_id);

            if (!$product) {
                $failed++;
                $results[] = [
                    'id' => $product_id,
                    'success' => false,
                    'message' => 'Product not found',
                ];
                continue;
            }

            $product->set_manage_stock(true);
            $product->set_stock_quantity($stock_quantity);
            $product->save();

            $updated++;
            $results[] = [
                'id' => $product_id,
                'success' => true,
                'message' => "Stock updated to {$stock_quantity}",
            ];
        }

        return [
            'updated' => $updated,
            'failed' => $failed,
            'results' => $results,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_products');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 3. Update MCP Server, Schemas, and Tools
Follow the established pattern for inventory abilities.

### Success Criteria

#### Automated Verification:
- [ ] Inventory abilities register successfully
- [ ] TypeScript compiles without errors
- [ ] Get low stock test passes
- [ ] Bulk update stock test passes

#### Manual Verification:
- [ ] Agent can identify low stock: "Show me products with less than 10 in stock"
- [ ] Agent can update stock: "Set the stock for product 123 to 50 units"
- [ ] Agent can bulk update: "Update stock for products 123, 456, 789 to 100, 200, 300"
- [ ] Stock changes are captured by change tracker for production sync

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 7: Email Templates

### Overview
Enable comprehensive email template customization including content modification, settings management, styling, and testing capabilities. This allows agents to customize WooCommerce transactional emails for branding and messaging.

### Changes Required

#### 1. List Email Templates Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after inventory abilities

```php
// WooCommerce - List Email Templates
$list_email_templates = wp_register_ability('woocommerce/list-email-templates', [
    'label' => 'List Email Templates',
    'description' => 'Lists all available WooCommerce email templates',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'templates' => ['type' => 'array'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $mailer = WC()->mailer();
        $emails = $mailer->get_emails();
        $templates = [];

        foreach ($emails as $email) {
            $templates[] = [
                'id' => $email->id,
                'title' => $email->title,
                'description' => $email->description,
                'enabled' => $email->enabled === 'yes',
                'subject' => $email->get_subject(),
                'heading' => $email->get_heading(),
                'email_type' => $email->get_email_type(),
                'template_html' => $email->template_html,
                'template_plain' => $email->template_plain,
            ];
        }

        return ['templates' => $templates];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 2. Get Email Template Content Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after list email templates

```php
// WooCommerce - Get Email Template
$get_email_template = wp_register_ability('woocommerce/get-email-template', [
    'label' => 'Get Email Template',
    'description' => 'Retrieves email template content',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => [
                'type' => 'string',
                'description' => 'Email template ID (e.g., "customer_completed_order")',
            ],
            'template_type' => [
                'type' => 'string',
                'description' => 'Template type: html or plain',
                'enum' => ['html', 'plain'],
                'default' => 'html',
            ],
        ],
        'required' => ['email_id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => ['type' => 'string'],
            'template_path' => ['type' => 'string'],
            'template_content' => ['type' => 'string'],
            'is_override' => ['type' => 'boolean'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $email_id = $input['email_id'] ?? '';
        $template_type = $input['template_type'] ?? 'html';

        // Get email object
        $mailer = WC()->mailer();
        $emails = $mailer->get_emails();

        $email = null;
        foreach ($emails as $e) {
            if ($e->id === $email_id) {
                $email = $e;
                break;
            }
        }

        if (!$email) {
            return new WP_Error('email_not_found', 'Email template not found', ['status' => 404]);
        }

        // Get template filename
        $template_name = $template_type === 'plain' ? $email->template_plain : $email->template_html;

        // Locate template (checks theme override first)
        $template_path = wc_locate_template($template_name);

        if (!file_exists($template_path)) {
            return new WP_Error('template_not_found', 'Template file not found', ['status' => 404]);
        }

        // Check if it's a theme override
        $theme_path = get_stylesheet_directory() . '/woocommerce/' . $template_name;
        $is_override = file_exists($theme_path);

        // Read template content
        $content = file_get_contents($template_path);

        return [
            'email_id' => $email_id,
            'template_path' => $template_path,
            'template_content' => $content,
            'is_override' => $is_override,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 3. Update Email Template Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get email template

```php
// WooCommerce - Update Email Template
$update_email_template = wp_register_ability('woocommerce/update-email-template', [
    'label' => 'Update Email Template',
    'description' => 'Updates email template content by creating theme override',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => [
                'type' => 'string',
                'description' => 'Email template ID',
            ],
            'template_type' => [
                'type' => 'string',
                'description' => 'Template type: html or plain',
                'enum' => ['html', 'plain'],
                'default' => 'html',
            ],
            'content' => [
                'type' => 'string',
                'description' => 'Template content',
            ],
        ],
        'required' => ['email_id', 'content'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
            'file_path' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $email_id = $input['email_id'] ?? '';
        $template_type = $input['template_type'] ?? 'html';
        $content = $input['content'] ?? '';

        // Get email object to find template name
        $mailer = WC()->mailer();
        $emails = $mailer->get_emails();

        $email = null;
        foreach ($emails as $e) {
            if ($e->id === $email_id) {
                $email = $e;
                break;
            }
        }

        if (!$email) {
            return new WP_Error('email_not_found', 'Email template not found', ['status' => 404]);
        }

        $template_name = $template_type === 'plain' ? $email->template_plain : $email->template_html;

        // Create theme override directory
        $theme_dir = get_stylesheet_directory() . '/woocommerce/' . dirname($template_name);
        if (!file_exists($theme_dir)) {
            wp_mkdir_p($theme_dir);
        }

        // Write template file
        $file_path = get_stylesheet_directory() . '/woocommerce/' . $template_name;
        $result = file_put_contents($file_path, $content);

        if ($result === false) {
            return new WP_Error('write_failed', 'Failed to write template file', ['status' => 500]);
        }

        return [
            'success' => true,
            'message' => 'Email template updated successfully',
            'file_path' => $file_path,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 4. Get Email Settings Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update email template

```php
// WooCommerce - Get Email Settings
$get_email_settings = wp_register_ability('woocommerce/get-email-settings', [
    'label' => 'Get Email Settings',
    'description' => 'Retrieves email configuration settings',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => [
                'type' => 'string',
                'description' => 'Email template ID',
            ],
        ],
        'required' => ['email_id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => ['type' => 'string'],
            'settings' => ['type' => 'object'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $email_id = $input['email_id'] ?? '';

        // Get email object
        $mailer = WC()->mailer();
        $emails = $mailer->get_emails();

        $email = null;
        foreach ($emails as $e) {
            if ($e->id === $email_id) {
                $email = $e;
                break;
            }
        }

        if (!$email) {
            return new WP_Error('email_not_found', 'Email template not found', ['status' => 404]);
        }

        return [
            'email_id' => $email_id,
            'settings' => [
                'enabled' => $email->enabled,
                'subject' => $email->get_subject(),
                'heading' => $email->get_heading(),
                'email_type' => $email->get_email_type(),
                'recipient' => $email->recipient ?? '',
                'additional_content' => $email->get_option('additional_content', ''),
            ],
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 5. Update Email Settings Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get email settings

```php
// WooCommerce - Update Email Settings
$update_email_settings = wp_register_ability('woocommerce/update-email-settings', [
    'label' => 'Update Email Settings',
    'description' => 'Updates email configuration settings',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => [
                'type' => 'string',
                'description' => 'Email template ID',
            ],
            'enabled' => [
                'type' => 'boolean',
                'description' => 'Enable/disable email',
            ],
            'subject' => [
                'type' => 'string',
                'description' => 'Email subject line',
            ],
            'heading' => [
                'type' => 'string',
                'description' => 'Email heading',
            ],
            'email_type' => [
                'type' => 'string',
                'description' => 'Email format',
                'enum' => ['plain', 'html', 'multipart'],
            ],
            'recipient' => [
                'type' => 'string',
                'description' => 'Email recipient(s) - comma separated',
            ],
            'additional_content' => [
                'type' => 'string',
                'description' => 'Additional email content',
            ],
        ],
        'required' => ['email_id'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $email_id = $input['email_id'] ?? '';

        // Get email object
        $mailer = WC()->mailer();
        $emails = $mailer->get_emails();

        $email = null;
        foreach ($emails as $e) {
            if ($e->id === $email_id) {
                $email = $e;
                break;
            }
        }

        if (!$email) {
            return new WP_Error('email_not_found', 'Email template not found', ['status' => 404]);
        }

        // Update settings
        $option_key = 'woocommerce_' . $email_id . '_settings';
        $settings = get_option($option_key, []);

        if (isset($input['enabled'])) {
            $settings['enabled'] = $input['enabled'] ? 'yes' : 'no';
        }

        if (isset($input['subject'])) {
            $settings['subject'] = $input['subject'];
        }

        if (isset($input['heading'])) {
            $settings['heading'] = $input['heading'];
        }

        if (isset($input['email_type'])) {
            $settings['email_type'] = $input['email_type'];
        }

        if (isset($input['recipient'])) {
            $settings['recipient'] = $input['recipient'];
        }

        if (isset($input['additional_content'])) {
            $settings['additional_content'] = $input['additional_content'];
        }

        update_option($option_key, $settings);

        return [
            'success' => true,
            'message' => 'Email settings updated successfully',
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 6. Send Test Email Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update email settings

```php
// WooCommerce - Send Test Email
$send_test_email = wp_register_ability('woocommerce/send-test-email', [
    'label' => 'Send Test Email',
    'description' => 'Sends a test email for preview and testing',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'email_id' => [
                'type' => 'string',
                'description' => 'Email template ID',
            ],
            'recipient' => [
                'type' => 'string',
                'description' => 'Test recipient email address',
            ],
        ],
        'required' => ['email_id', 'recipient'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $email_id = $input['email_id'] ?? '';
        $recipient = $input['recipient'] ?? '';

        if (!is_email($recipient)) {
            return new WP_Error('invalid_email', 'Invalid email address', ['status' => 400]);
        }

        // Get email object
        $mailer = WC()->mailer();
        $emails = $mailer->get_emails();

        $email = null;
        foreach ($emails as $e) {
            if ($e->id === $email_id) {
                $email = $e;
                break;
            }
        }

        if (!$email) {
            return new WP_Error('email_not_found', 'Email template not found', ['status' => 404]);
        }

        // Create a dummy order for testing (if email requires it)
        $orders = wc_get_orders(['limit' => 1, 'status' => 'completed']);
        $test_order = !empty($orders) ? $orders[0] : null;

        // Override recipient temporarily
        add_filter('woocommerce_email_recipient_' . $email_id, function() use ($recipient) {
            return $recipient;
        });

        // Trigger email
        if ($test_order) {
            $email->trigger($test_order->get_id(), $test_order);
        } else {
            // For emails that don't need order context
            $email->send($recipient, $email->get_subject(), $email->get_content(), '', []);
        }

        return [
            'success' => true,
            'message' => "Test email sent to {$recipient}",
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 7. Get Email Styles Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after send test email

```php
// WooCommerce - Get Email Styles
$get_email_styles = wp_register_ability('woocommerce/get-email-styles', [
    'label' => 'Get Email Styles',
    'description' => 'Retrieves custom email CSS styles',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'styles' => ['type' => 'string'],
            'has_override' => ['type' => 'boolean'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        // Check for theme override
        $override_path = get_stylesheet_directory() . '/woocommerce/emails/email-styles.php';
        $has_override = file_exists($override_path);

        // Get styles (checks theme override first)
        $template_path = wc_locate_template('emails/email-styles.php');

        if (!file_exists($template_path)) {
            return new WP_Error('template_not_found', 'Email styles template not found', ['status' => 404]);
        }

        // Capture output
        ob_start();
        include $template_path;
        $styles = ob_get_clean();

        return [
            'styles' => $styles,
            'has_override' => $has_override,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 8. Update Email Styles Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get email styles

```php
// WooCommerce - Update Email Styles
$update_email_styles = wp_register_ability('woocommerce/update-email-styles', [
    'label' => 'Update Email Styles',
    'description' => 'Updates custom email CSS styles',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'styles' => [
                'type' => 'string',
                'description' => 'CSS styles content',
            ],
        ],
        'required' => ['styles'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
            'file_path' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $styles = $input['styles'] ?? '';

        // Create theme override directory
        $theme_dir = get_stylesheet_directory() . '/woocommerce/emails';
        if (!file_exists($theme_dir)) {
            wp_mkdir_p($theme_dir);
        }

        // Write styles file
        $file_path = $theme_dir . '/email-styles.php';
        $result = file_put_contents($file_path, $styles);

        if ($result === false) {
            return new WP_Error('write_failed', 'Failed to write styles file', ['status' => 500]);
        }

        return [
            'success' => true,
            'message' => 'Email styles updated successfully',
            'file_path' => $file_path,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 9. Update MCP Server Configuration
**File**: `wp-content/mu-plugins/configure-mcp-server.php`
**Changes**: Add email abilities to array at line 34

```php
[
    // ... existing abilities ...
    'woocommerce/get-low-stock-products',
    'woocommerce/bulk-update-stock',
    'woocommerce/list-email-templates',     // ADD THESE LINES
    'woocommerce/get-email-template',
    'woocommerce/update-email-template',
    'woocommerce/get-email-settings',
    'woocommerce/update-email-settings',
    'woocommerce/send-test-email',
    'woocommerce/get-email-styles',
    'woocommerce/update-email-styles',
]
```

#### 10. TypeScript Schemas
**File**: `lib/tools/wordpress-schemas.ts`
**Changes**: Add email template schemas

```typescript
// WooCommerce Email Template Schemas

export const listEmailTemplatesSchema = z.object({});

export type ListEmailTemplatesInput = z.infer<typeof listEmailTemplatesSchema>;

export const getEmailTemplateSchema = z.object({
  email_id: z.string().describe('Email template ID (e.g., "customer_completed_order")'),
  template_type: z.enum(['html', 'plain']).optional().default('html').describe('Template type')
});

export type GetEmailTemplateInput = z.infer<typeof getEmailTemplateSchema>;

export const updateEmailTemplateSchema = z.object({
  email_id: z.string().describe('Email template ID'),
  template_type: z.enum(['html', 'plain']).optional().default('html').describe('Template type'),
  content: z.string().describe('Template content')
});

export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;

export const getEmailSettingsSchema = z.object({
  email_id: z.string().describe('Email template ID')
});

export type GetEmailSettingsInput = z.infer<typeof getEmailSettingsSchema>;

export const updateEmailSettingsSchema = z.object({
  email_id: z.string().describe('Email template ID'),
  enabled: z.boolean().optional().describe('Enable/disable email'),
  subject: z.string().optional().describe('Email subject line'),
  heading: z.string().optional().describe('Email heading'),
  email_type: z.enum(['plain', 'html', 'multipart']).optional().describe('Email format'),
  recipient: z.string().optional().describe('Email recipient(s) - comma separated'),
  additional_content: z.string().optional().describe('Additional email content')
});

export type UpdateEmailSettingsInput = z.infer<typeof updateEmailSettingsSchema>;

export const sendTestEmailSchema = z.object({
  email_id: z.string().describe('Email template ID'),
  recipient: z.string().email().describe('Test recipient email address')
});

export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;

export const getEmailStylesSchema = z.object({});

export type GetEmailStylesInput = z.infer<typeof getEmailStylesSchema>;

export const updateEmailStylesSchema = z.object({
  styles: z.string().describe('CSS styles content')
});

export type UpdateEmailStylesInput = z.infer<typeof updateEmailStylesSchema>;
```

#### 11. Tool Definitions
**File**: `lib/tools/wordpress-tools.ts`
**Changes**: Add email template tools

```typescript
// WooCommerce Email Template Tools
'woocommerce-list-email-templates': tool({
  description: `Lists all WooCommerce email templates in the ${envLabel} environment.`,
  parameters: listEmailTemplatesSchema,
  execute: async (input: ListEmailTemplatesInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-list-email-templates', input);
    return extractContent(result);
  }
}),

'woocommerce-get-email-template': tool({
  description: `Retrieves email template content in the ${envLabel} environment.`,
  parameters: getEmailTemplateSchema,
  execute: async (input: GetEmailTemplateInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-email-template', input);
    return extractContent(result);
  }
}),

'woocommerce-update-email-template': tool({
  description: `Updates email template content in the ${envLabel} environment.`,
  parameters: updateEmailTemplateSchema,
  execute: async (input: UpdateEmailTemplateInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-update-email-template', input);
    return extractContent(result);
  }
}),

'woocommerce-get-email-settings': tool({
  description: `Retrieves email settings in the ${envLabel} environment.`,
  parameters: getEmailSettingsSchema,
  execute: async (input: GetEmailSettingsInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-email-settings', input);
    return extractContent(result);
  }
}),

'woocommerce-update-email-settings': tool({
  description: `Updates email settings in the ${envLabel} environment.`,
  parameters: updateEmailSettingsSchema,
  execute: async (input: UpdateEmailSettingsInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-update-email-settings', input);
    return extractContent(result);
  }
}),

'woocommerce-send-test-email': tool({
  description: `Sends a test email in the ${envLabel} environment.`,
  parameters: sendTestEmailSchema,
  execute: async (input: SendTestEmailInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-send-test-email', input);
    return extractContent(result);
  }
}),

'woocommerce-get-email-styles': tool({
  description: `Retrieves email CSS styles in the ${envLabel} environment.`,
  parameters: getEmailStylesSchema,
  execute: async (input: GetEmailStylesInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-email-styles', input);
    return extractContent(result);
  }
}),

'woocommerce-update-email-styles': tool({
  description: `Updates email CSS styles in the ${envLabel} environment.`,
  parameters: updateEmailStylesSchema,
  execute: async (input: UpdateEmailStylesInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-update-email-styles', input);
    return extractContent(result);
  }
})
```

#### 12. Update Change Tracker Types
**File**: `lib/sync/change-tracker.ts`
**Changes**: Add email template types to unions

```typescript
export type WordPressToolArgs =
  | GetPostInput
  | ListPostsInput
  | CreatePostInput
  | UpdatePostInput
  | DeletePostInput
  | GetPluginStatusInput
  | ListProductsInput
  | GetProductInput
  | CreateProductInput
  | UpdateProductInput
  | DeleteProductInput
  | ListEmailTemplatesInput      // ADD THESE
  | GetEmailTemplateInput
  | UpdateEmailTemplateInput
  | GetEmailSettingsInput
  | UpdateEmailSettingsInput
  | SendTestEmailInput
  | GetEmailStylesInput
  | UpdateEmailStylesInput;

export type WordPressToolResult =
  | GetPostOutput
  | ListPostsOutput
  | CreatePostOutput
  | UpdatePostOutput
  | DeletePostOutput
  | GetPluginStatusOutput
  | ListProductsOutput
  | GetProductOutput
  | CreateProductOutput
  | UpdateProductOutput
  | DeleteProductOutput
  | ListEmailTemplatesOutput      // ADD THESE
  | GetEmailTemplateOutput
  | UpdateEmailTemplateOutput
  | GetEmailSettingsOutput
  | UpdateEmailSettingsOutput
  | SendTestEmailOutput
  | GetEmailStylesOutput
  | UpdateEmailStylesOutput;
```

### Success Criteria

#### Automated Verification:
- [ ] All email abilities register successfully: Check logs for `[ABILITIES] Registered woocommerce/*-email*` messages
- [ ] MCP server lists all email abilities: `curl http://localhost:8002/wp-json/wordpress-poc/mcp`
- [ ] TypeScript compiles without errors: `pnpm tsc --noEmit`
- [ ] List email templates test passes: `pnpm test:woocommerce -- --grep "email templates"`
- [ ] Update email settings test passes: `pnpm test:woocommerce -- --grep "email settings"`
- [ ] Send test email test passes: `pnpm test:woocommerce -- --grep "test email"`

#### Manual Verification:
- [ ] Agent can list all email templates: "Show me all WooCommerce email templates"
- [ ] Agent can view email template content: "Show me the completed order email template"
- [ ] Agent can modify email template: "Update the completed order email to include a thank you message"
- [ ] Agent can change email settings: "Disable the cancelled order email notification"
- [ ] Agent can update email subject: "Change the processing order email subject to include the order number"
- [ ] Agent can send test email: "Send a test completed order email to test@example.com"
- [ ] Agent can customize email CSS: "Make the email header background blue"
- [ ] Template overrides are created in theme directory (not plugin directory)
- [ ] Change tracker captures email template/settings modifications for production sync

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 8: Frontend Customization

### Overview
Enable comprehensive frontend customization including template modifications, display settings, and custom CSS management. This provides full control over WooCommerce storefront appearance and behavior.

### Changes Required

#### 1. Get Display Settings Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after email abilities

```php
// WooCommerce - Get Display Settings
$get_display_settings = wp_register_ability('woocommerce/get-display-settings', [
    'label' => 'Get Display Settings',
    'description' => 'Retrieves WooCommerce display and frontend settings',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'settings' => ['type' => 'object'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        return [
            'settings' => [
                'shop_page_id' => get_option('woocommerce_shop_page_id'),
                'cart_redirect_after_add' => get_option('woocommerce_cart_redirect_after_add'),
                'enable_ajax_add_to_cart' => get_option('woocommerce_enable_ajax_add_to_cart'),
                'placeholder_image' => get_option('woocommerce_placeholder_image'),
                'stock_format' => get_option('woocommerce_stock_format'),
                'hide_out_of_stock_items' => get_option('woocommerce_hide_out_of_stock_items'),
                'enable_reviews' => get_option('woocommerce_enable_reviews'),
                'review_rating_verification_required' => get_option('woocommerce_review_rating_verification_required'),
                'catalog_columns' => get_option('woocommerce_catalog_columns', 4),
                'catalog_rows' => get_option('woocommerce_catalog_rows', 4),
                'thumbnail_image_width' => get_option('woocommerce_thumbnail_image_width'),
                'thumbnail_image_height' => get_option('woocommerce_thumbnail_image_height'),
                'thumbnail_cropping' => get_option('woocommerce_thumbnail_cropping'),
                'single_image_width' => get_option('woocommerce_single_image_width'),
                'single_image_height' => get_option('woocommerce_single_image_height'),
            ],
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 2. Update Display Settings Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get display settings

```php
// WooCommerce - Update Display Settings
$update_display_settings = wp_register_ability('woocommerce/update-display-settings', [
    'label' => 'Update Display Settings',
    'description' => 'Updates WooCommerce display and frontend settings',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'shop_page_id' => ['type' => 'integer'],
            'cart_redirect_after_add' => ['type' => 'string'],
            'enable_ajax_add_to_cart' => ['type' => 'string'],
            'hide_out_of_stock_items' => ['type' => 'string'],
            'enable_reviews' => ['type' => 'string'],
            'review_rating_verification_required' => ['type' => 'string'],
            'catalog_columns' => ['type' => 'integer'],
            'catalog_rows' => ['type' => 'integer'],
        ],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $updated = [];

        if (isset($input['shop_page_id'])) {
            update_option('woocommerce_shop_page_id', $input['shop_page_id']);
            $updated[] = 'shop_page_id';
        }

        if (isset($input['cart_redirect_after_add'])) {
            update_option('woocommerce_cart_redirect_after_add', $input['cart_redirect_after_add']);
            $updated[] = 'cart_redirect_after_add';
        }

        if (isset($input['enable_ajax_add_to_cart'])) {
            update_option('woocommerce_enable_ajax_add_to_cart', $input['enable_ajax_add_to_cart']);
            $updated[] = 'enable_ajax_add_to_cart';
        }

        if (isset($input['hide_out_of_stock_items'])) {
            update_option('woocommerce_hide_out_of_stock_items', $input['hide_out_of_stock_items']);
            $updated[] = 'hide_out_of_stock_items';
        }

        if (isset($input['enable_reviews'])) {
            update_option('woocommerce_enable_reviews', $input['enable_reviews']);
            $updated[] = 'enable_reviews';
        }

        if (isset($input['review_rating_verification_required'])) {
            update_option('woocommerce_review_rating_verification_required', $input['review_rating_verification_required']);
            $updated[] = 'review_rating_verification_required';
        }

        if (isset($input['catalog_columns'])) {
            update_option('woocommerce_catalog_columns', $input['catalog_columns']);
            $updated[] = 'catalog_columns';
        }

        if (isset($input['catalog_rows'])) {
            update_option('woocommerce_catalog_rows', $input['catalog_rows']);
            $updated[] = 'catalog_rows';
        }

        return [
            'success' => true,
            'message' => 'Display settings updated: ' . implode(', ', $updated),
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 3. List Templates Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update display settings

```php
// WooCommerce - List Templates
$list_templates = wp_register_ability('woocommerce/list-templates', [
    'label' => 'List Templates',
    'description' => 'Lists available WooCommerce template files',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'category' => [
                'type' => 'string',
                'description' => 'Template category filter',
                'enum' => ['all', 'single-product', 'cart', 'checkout', 'loop', 'myaccount'],
                'default' => 'all',
            ],
        ],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'templates' => ['type' => 'array'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $category = $input['category'] ?? 'all';
        $plugin_path = WC()->plugin_path() . '/templates/';
        $templates = [];

        // Common template files to list
        $template_files = [
            'single-product.php',
            'archive-product.php',
            'content-product.php',
            'content-single-product.php',
            'cart/cart.php',
            'cart/mini-cart.php',
            'checkout/form-checkout.php',
            'checkout/payment.php',
            'loop/loop-start.php',
            'loop/loop-end.php',
            'single-product/title.php',
            'single-product/price.php',
            'single-product/add-to-cart/simple.php',
            'myaccount/my-account.php',
        ];

        foreach ($template_files as $template) {
            // Filter by category if specified
            if ($category !== 'all') {
                if (strpos($template, $category) === false) {
                    continue;
                }
            }

            $full_path = $plugin_path . $template;
            if (file_exists($full_path)) {
                $theme_override = get_stylesheet_directory() . '/woocommerce/' . $template;
                $has_override = file_exists($theme_override);

                $templates[] = [
                    'template_name' => $template,
                    'plugin_path' => $full_path,
                    'theme_path' => $theme_override,
                    'has_override' => $has_override,
                    'category' => dirname($template) === '.' ? 'root' : dirname($template),
                ];
            }
        }

        return ['templates' => $templates];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 4. Get Template Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after list templates

```php
// WooCommerce - Get Template
$get_template = wp_register_ability('woocommerce/get-template', [
    'label' => 'Get Template',
    'description' => 'Retrieves template file content',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'template_name' => [
                'type' => 'string',
                'description' => 'Template filename (e.g., "single-product.php", "cart/cart.php")',
            ],
        ],
        'required' => ['template_name'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'template_name' => ['type' => 'string'],
            'content' => ['type' => 'string'],
            'is_override' => ['type' => 'boolean'],
            'file_path' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $template_name = $input['template_name'] ?? '';

        // Locate template (checks theme override first)
        $template_path = wc_locate_template($template_name);

        if (!file_exists($template_path)) {
            return new WP_Error('template_not_found', 'Template not found', ['status' => 404]);
        }

        // Check if it's a theme override
        $theme_path = get_stylesheet_directory() . '/woocommerce/' . $template_name;
        $is_override = file_exists($theme_path);

        // Read template content
        $content = file_get_contents($template_path);

        return [
            'template_name' => $template_name,
            'content' => $content,
            'is_override' => $is_override,
            'file_path' => $template_path,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 5. Update Template Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get template

```php
// WooCommerce - Update Template
$update_template = wp_register_ability('woocommerce/update-template', [
    'label' => 'Update Template',
    'description' => 'Creates or updates template override in theme',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'template_name' => [
                'type' => 'string',
                'description' => 'Template filename',
            ],
            'content' => [
                'type' => 'string',
                'description' => 'Template content',
            ],
        ],
        'required' => ['template_name', 'content'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
            'file_path' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $template_name = $input['template_name'] ?? '';
        $content = $input['content'] ?? '';

        // Create theme override directory
        $theme_dir = get_stylesheet_directory() . '/woocommerce/' . dirname($template_name);
        if (!file_exists($theme_dir)) {
            wp_mkdir_p($theme_dir);
        }

        // Write template file
        $file_path = get_stylesheet_directory() . '/woocommerce/' . $template_name;
        $result = file_put_contents($file_path, $content);

        if ($result === false) {
            return new WP_Error('write_failed', 'Failed to write template file', ['status' => 500]);
        }

        return [
            'success' => true,
            'message' => 'Template override created successfully',
            'file_path' => $file_path,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 6. Delete Template Override Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update template

```php
// WooCommerce - Delete Template Override
$delete_template_override = wp_register_ability('woocommerce/delete-template-override', [
    'label' => 'Delete Template Override',
    'description' => 'Removes template override from theme (reverts to plugin default)',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'template_name' => [
                'type' => 'string',
                'description' => 'Template filename',
            ],
        ],
        'required' => ['template_name'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce plugin is not active', ['status' => 400]);
        }

        $template_name = $input['template_name'] ?? '';
        $file_path = get_stylesheet_directory() . '/woocommerce/' . $template_name;

        if (!file_exists($file_path)) {
            return new WP_Error('override_not_found', 'Template override does not exist', ['status' => 404]);
        }

        $result = unlink($file_path);

        if (!$result) {
            return new WP_Error('delete_failed', 'Failed to delete template override', ['status' => 500]);
        }

        return [
            'success' => true,
            'message' => 'Template override deleted successfully',
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('manage_woocommerce');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 7. Get Custom CSS Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after delete template override

```php
// WordPress - Get Custom CSS
$get_custom_css = wp_register_ability('wordpress/get-custom-css', [
    'label' => 'Get Custom CSS',
    'description' => 'Retrieves custom CSS for the active theme',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'css' => ['type' => 'string'],
            'stylesheet' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        $stylesheet = get_stylesheet();
        $css = wp_get_custom_css($stylesheet);

        return [
            'css' => $css,
            'stylesheet' => $stylesheet,
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_theme_options');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 8. Update Custom CSS Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after get custom CSS

```php
// WordPress - Update Custom CSS
$update_custom_css = wp_register_ability('wordpress/update-custom-css', [
    'label' => 'Update Custom CSS',
    'description' => 'Updates custom CSS for the active theme',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'css' => [
                'type' => 'string',
                'description' => 'CSS content',
            ],
        ],
        'required' => ['css'],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'success' => ['type' => 'boolean'],
            'message' => ['type' => 'string'],
        ],
    ],
    'execute_callback' => function($input) {
        $css = $input['css'] ?? '';
        $stylesheet = get_stylesheet();

        // Sanitize CSS
        $css = wp_strip_all_tags($css);

        // Update custom CSS
        $result = wp_update_custom_css_post($css, ['stylesheet' => $stylesheet]);

        if (is_wp_error($result)) {
            return $result;
        }

        return [
            'success' => true,
            'message' => 'Custom CSS updated successfully',
        ];
    },
    'permission_callback' => function($input) {
        return current_user_can('edit_theme_options');
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 9. Get CSS Selectors Reference Ability
**File**: `wp-content/mu-plugins/register-wordpress-abilities.php`
**Changes**: Add after update custom CSS

```php
// WooCommerce - Get CSS Selectors
$get_css_selectors = wp_register_ability('woocommerce/get-css-selectors', [
    'label' => 'Get CSS Selectors',
    'description' => 'Provides common WooCommerce CSS selectors for customization guidance',
    'category' => 'wordpress',
    'input_schema' => [
        'type' => 'object',
        'properties' => [],
    ],
    'output_schema' => [
        'type' => 'object',
        'properties' => [
            'selectors' => ['type' => 'array'],
        ],
    ],
    'execute_callback' => function($input) {
        $selectors = [
            [
                'category' => 'Product Page',
                'selectors' => [
                    '.woocommerce-product-gallery' => 'Product image gallery',
                    '.single-product .product_title' => 'Product title',
                    '.single-product .price' => 'Product price',
                    '.single-product .add_to_cart_button' => 'Add to cart button',
                    '.woocommerce-product-details__short-description' => 'Short description',
                    '.woocommerce-tabs' => 'Product tabs',
                ],
            ],
            [
                'category' => 'Shop/Archive',
                'selectors' => [
                    '.woocommerce-products-header' => 'Shop header',
                    '.products' => 'Product grid container',
                    '.product' => 'Individual product card',
                    '.woocommerce-loop-product__title' => 'Product title in loop',
                    '.woocommerce-loop-product__link' => 'Product link',
                    '.woocommerce-ordering' => 'Sort dropdown',
                ],
            ],
            [
                'category' => 'Cart',
                'selectors' => [
                    '.woocommerce-cart-form' => 'Cart form',
                    '.cart_item' => 'Cart line item',
                    '.cart_totals' => 'Cart totals section',
                    '.checkout-button' => 'Proceed to checkout button',
                ],
            ],
            [
                'category' => 'Checkout',
                'selectors' => [
                    '.woocommerce-checkout' => 'Checkout wrapper',
                    '.woocommerce-billing-fields' => 'Billing fields',
                    '.woocommerce-shipping-fields' => 'Shipping fields',
                    '#place_order' => 'Place order button',
                    '.woocommerce-checkout-review-order' => 'Order review',
                ],
            ],
            [
                'category' => 'Blocks (Modern)',
                'selectors' => [
                    '.wc-block-components-product-title' => 'Block product title',
                    '.wc-block-components-product-price' => 'Block product price',
                    '.wc-block-components-button' => 'Block button',
                    '.wc-block-grid' => 'Block product grid',
                ],
            ],
        ];

        return ['selectors' => $selectors];
    },
    'permission_callback' => function($input) {
        return is_user_logged_in();
    },
    'meta' => ['show_in_rest' => true],
]);
```

#### 10. Update MCP Server Configuration
**File**: `wp-content/mu-plugins/configure-mcp-server.php`
**Changes**: Add frontend customization abilities

```php
[
    // ... existing abilities ...
    'woocommerce/update-email-styles',
    'woocommerce/get-display-settings',      // ADD THESE LINES
    'woocommerce/update-display-settings',
    'woocommerce/list-templates',
    'woocommerce/get-template',
    'woocommerce/update-template',
    'woocommerce/delete-template-override',
    'wordpress/get-custom-css',
    'wordpress/update-custom-css',
    'woocommerce/get-css-selectors',
]
```

#### 11. TypeScript Schemas
**File**: `lib/tools/wordpress-schemas.ts`
**Changes**: Add frontend customization schemas

```typescript
// WooCommerce Frontend Customization Schemas

export const getDisplaySettingsSchema = z.object({});

export type GetDisplaySettingsInput = z.infer<typeof getDisplaySettingsSchema>;

export const updateDisplaySettingsSchema = z.object({
  shop_page_id: z.number().int().optional().describe('Shop page ID'),
  cart_redirect_after_add: z.string().optional().describe('Redirect after add to cart'),
  enable_ajax_add_to_cart: z.string().optional().describe('Enable AJAX add to cart'),
  hide_out_of_stock_items: z.string().optional().describe('Hide out of stock items'),
  enable_reviews: z.string().optional().describe('Enable product reviews'),
  review_rating_verification_required: z.string().optional().describe('Require verified purchase for reviews'),
  catalog_columns: z.number().int().optional().describe('Product catalog columns'),
  catalog_rows: z.number().int().optional().describe('Product catalog rows')
});

export type UpdateDisplaySettingsInput = z.infer<typeof updateDisplaySettingsSchema>;

export const listTemplatesSchema = z.object({
  category: z.enum(['all', 'single-product', 'cart', 'checkout', 'loop', 'myaccount']).optional().default('all').describe('Template category filter')
});

export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

export const getTemplateSchema = z.object({
  template_name: z.string().describe('Template filename (e.g., "single-product.php", "cart/cart.php")')
});

export type GetTemplateInput = z.infer<typeof getTemplateSchema>;

export const updateTemplateSchema = z.object({
  template_name: z.string().describe('Template filename'),
  content: z.string().describe('Template content')
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const deleteTemplateOverrideSchema = z.object({
  template_name: z.string().describe('Template filename')
});

export type DeleteTemplateOverrideInput = z.infer<typeof deleteTemplateOverrideSchema>;

export const getCustomCssSchema = z.object({});

export type GetCustomCssInput = z.infer<typeof getCustomCssSchema>;

export const updateCustomCssSchema = z.object({
  css: z.string().describe('CSS content')
});

export type UpdateCustomCssInput = z.infer<typeof updateCustomCssSchema>;

export const getCssSelectorsSchema = z.object({});

export type GetCssSelectorsInput = z.infer<typeof getCssSelectorsSchema>;
```

#### 12. Tool Definitions
**File**: `lib/tools/wordpress-tools.ts`
**Changes**: Add frontend customization tools

```typescript
// WooCommerce Frontend Customization Tools
'woocommerce-get-display-settings': tool({
  description: `Retrieves WooCommerce display settings in the ${envLabel} environment.`,
  parameters: getDisplaySettingsSchema,
  execute: async (input: GetDisplaySettingsInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-display-settings', input);
    return extractContent(result);
  }
}),

'woocommerce-update-display-settings': tool({
  description: `Updates WooCommerce display settings in the ${envLabel} environment.`,
  parameters: updateDisplaySettingsSchema,
  execute: async (input: UpdateDisplaySettingsInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-update-display-settings', input);
    return extractContent(result);
  }
}),

'woocommerce-list-templates': tool({
  description: `Lists WooCommerce templates in the ${envLabel} environment.`,
  parameters: listTemplatesSchema,
  execute: async (input: ListTemplatesInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-list-templates', input);
    return extractContent(result);
  }
}),

'woocommerce-get-template': tool({
  description: `Retrieves template content in the ${envLabel} environment.`,
  parameters: getTemplateSchema,
  execute: async (input: GetTemplateInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-template', input);
    return extractContent(result);
  }
}),

'woocommerce-update-template': tool({
  description: `Updates template content in the ${envLabel} environment.`,
  parameters: updateTemplateSchema,
  execute: async (input: UpdateTemplateInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-update-template', input);
    return extractContent(result);
  }
}),

'woocommerce-delete-template-override': tool({
  description: `Deletes template override in the ${envLabel} environment.`,
  parameters: deleteTemplateOverrideSchema,
  execute: async (input: DeleteTemplateOverrideInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-delete-template-override', input);
    return extractContent(result);
  }
}),

'wordpress-get-custom-css': tool({
  description: `Retrieves custom CSS in the ${envLabel} environment.`,
  parameters: getCustomCssSchema,
  execute: async (input: GetCustomCssInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('wordpress-get-custom-css', input);
    return extractContent(result);
  }
}),

'wordpress-update-custom-css': tool({
  description: `Updates custom CSS in the ${envLabel} environment.`,
  parameters: updateCustomCssSchema,
  execute: async (input: UpdateCustomCssInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('wordpress-update-custom-css', input);
    return extractContent(result);
  }
}),

'woocommerce-get-css-selectors': tool({
  description: `Retrieves common WooCommerce CSS selectors in the ${envLabel} environment.`,
  parameters: getCssSelectorsSchema,
  execute: async (input: GetCssSelectorsInput) => {
    const client = await getWordPressMcpClient(environment);
    const result = await client.callTool('woocommerce-get-css-selectors', input);
    return extractContent(result);
  }
})
```

#### 13. Update Change Tracker Types
**File**: `lib/sync/change-tracker.ts`
**Changes**: Add frontend customization types

```typescript
export type WordPressToolArgs =
  | GetPostInput
  | ListPostsInput
  | CreatePostInput
  | UpdatePostInput
  | DeletePostInput
  | GetPluginStatusInput
  | ListProductsInput
  | GetProductInput
  | CreateProductInput
  | UpdateProductInput
  | DeleteProductInput
  | ListEmailTemplatesInput
  | GetEmailTemplateInput
  | UpdateEmailTemplateInput
  | GetEmailSettingsInput
  | UpdateEmailSettingsInput
  | SendTestEmailInput
  | GetEmailStylesInput
  | UpdateEmailStylesInput
  | GetDisplaySettingsInput          // ADD THESE
  | UpdateDisplaySettingsInput
  | ListTemplatesInput
  | GetTemplateInput
  | UpdateTemplateInput
  | DeleteTemplateOverrideInput
  | GetCustomCssInput
  | UpdateCustomCssInput
  | GetCssSelectorsInput;

export type WordPressToolResult =
  | GetPostOutput
  | ListPostsOutput
  | CreatePostOutput
  | UpdatePostOutput
  | DeletePostOutput
  | GetPluginStatusOutput
  | ListProductsOutput
  | GetProductOutput
  | CreateProductOutput
  | UpdateProductOutput
  | DeleteProductOutput
  | ListEmailTemplatesOutput
  | GetEmailTemplateOutput
  | UpdateEmailTemplateOutput
  | GetEmailSettingsOutput
  | UpdateEmailSettingsOutput
  | SendTestEmailOutput
  | GetEmailStylesOutput
  | UpdateEmailStylesOutput
  | GetDisplaySettingsOutput          // ADD THESE
  | UpdateDisplaySettingsOutput
  | ListTemplatesOutput
  | GetTemplateOutput
  | UpdateTemplateOutput
  | DeleteTemplateOverrideOutput
  | GetCustomCssOutput
  | UpdateCustomCssOutput
  | GetCssSelectorsOutput;
```

### Success Criteria

#### Automated Verification:
- [ ] All frontend customization abilities register successfully
- [ ] MCP server lists all template/CSS abilities
- [ ] TypeScript compiles without errors: `pnpm tsc --noEmit`
- [ ] Display settings test passes: `pnpm test:woocommerce -- --grep "display settings"`
- [ ] Template operations test passes: `pnpm test:woocommerce -- --grep "templates"`
- [ ] Custom CSS test passes: `pnpm test:woocommerce -- --grep "custom css"`

#### Manual Verification:
- [ ] Agent can get display settings: "Show me the WooCommerce display settings"
- [ ] Agent can update settings: "Change products per page to 12"
- [ ] Agent can list templates: "Show me all WooCommerce templates"
- [ ] Agent can view template: "Show me the single product template"
- [ ] Agent can modify template: "Update the product title template to use H2 instead of H1"
- [ ] Agent can delete override: "Remove the cart template override"
- [ ] Agent can get custom CSS: "Show me the current custom CSS"
- [ ] Agent can add custom CSS: "Make all product titles blue"
- [ ] Agent can get CSS selectors: "What CSS selectors can I use for the cart page?"
- [ ] Template overrides are created in theme directory
- [ ] CSS is stored in WordPress database (not as file)
- [ ] Change tracker captures all template/CSS/settings modifications
- [ ] Changes sync correctly to production environment

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to final testing.

---

## Testing Strategy

### Unit Tests
Create test file: `scripts/test/test-woocommerce-abilities.ts`

```typescript
import { executeWordPressAgent } from '../../lib/agents/wordpress-agent';
import { changeTracker } from '../../lib/sync/change-tracker';

describe('WooCommerce Abilities', () => {
  beforeEach(() => {
    changeTracker.clearChanges();
  });

  test('detects WooCommerce plugin', async () => {
    const result = await executeWordPressAgent(
      'Check if WooCommerce is installed',
      'real-site' // WooCommerce is installed on real-site
    );

    expect(result.text).toContain('WooCommerce');
    expect(result.text).toContain('active');
  });

  test('creates a product', async () => {
    const result = await executeWordPressAgent(
      'Create a test product called "AI Widget" priced at $29.99',
      'real-site'
    );

    expect(result.text).toContain('AI Widget');
    expect(changeTracker.hasChanges()).toBe(true);
  });

  test('lists products', async () => {
    const result = await executeWordPressAgent(
      'Show me all products',
      'real-site'
    );

    expect(result.text).toContain('product');
  });

  test('updates product price', async () => {
    // First create a product
    const createResult = await executeWordPressAgent(
      'Create a product called "Test Product" for $10',
      'real-site'
    );

    // Extract product ID from response
    const productId = extractProductId(createResult.text);

    // Update the price
    const updateResult = await executeWordPressAgent(
      `Update product ${productId} price to $15`,
      'real-site'
    );

    expect(updateResult.text).toContain('15');
    expect(changeTracker.getChangeCount()).toBeGreaterThan(1);
  });

  test('lists orders', async () => {
    const result = await executeWordPressAgent(
      'Show me all orders',
      'real-site'
    );

    expect(result.text).toContain('order');
  });

  test('updates order status', async () => {
    const result = await executeWordPressAgent(
      'Mark order 123 as completed',
      'real-site'
    );

    expect(result.text).toContain('completed');
    expect(changeTracker.hasChanges()).toBe(true);
  });
});
```

### Integration Tests
Test full workflows:
1. Create product → Add to order → Process order → Refund
2. Create coupon → Apply to order → Verify discount
3. Update inventory → Check low stock → Restock

### Manual Testing Steps

#### E-commerce Workflow Test
1. "Create a product called 'Premium Widget' priced at $99.99 with SKU WIDGET-001"
2. "Set the stock quantity to 50 units"
3. "Create a 10% off coupon code SAVE10"
4. "Show me all pending orders"
5. "Mark order [ID] as processing"
6. "Add a note to order [ID] saying 'Shipped via UPS'"
7. "Show me all products with less than 10 in stock"
8. "Update the stock for Premium Widget to 100 units"

#### Multi-environment Test
1. Create product in sandbox (real-site environment)
2. Verify change tracker captured the operation
3. Sync to production (if production WooCommerce is set up)
4. Verify product exists in production

#### Permission Test
1. Test with admin user (should work)
2. Test with editor role (should fail for shop operations)
3. Verify appropriate error messages

## Performance Considerations

### Query Optimization
- Use WooCommerce's optimized `wc_get_products()` and `wc_get_orders()` functions instead of raw `WP_Query` when possible
- Limit pagination defaults to 10 items
- Add indexes to meta queries if performance issues arise

### Caching
- WooCommerce has built-in object caching for products and orders
- Consider transient caching for low-stock reports (15-minute TTL)

### Batch Operations
- Bulk stock updates process up to 100 products per request
- Use background jobs for larger bulk operations (future enhancement)

## Migration Notes

### Data Compatibility
- All WooCommerce data remains in WordPress database
- No additional database tables needed
- Compatible with WooCommerce 3.5+

### Backwards Compatibility
- Existing WordPress post abilities continue to work
- WooCommerce abilities are additive, not destructive
- If WooCommerce is not active, abilities return graceful errors

### Rollback Plan
If issues arise:
1. Remove WooCommerce abilities from `register-wordpress-abilities.php`
2. Remove from MCP server config
3. Restart WordPress: `docker-compose restart wordpress`
4. TypeScript/tool layer will continue to work with remaining abilities

## References

### Codebase Files
- Current WordPress abilities: `wp-content/mu-plugins/register-wordpress-abilities.php:25-419`
- Plugin detection pattern: `wp-content/themes/storefront/inc/storefront-functions.php:8-14`
- MCP client: `lib/mcp/wordpress-client.ts:18-130`
- Tool definitions: `lib/tools/wordpress-tools.ts:53-115`
- Change tracker: `lib/sync/change-tracker.ts:210-343`

### External Documentation
- WooCommerce REST API v3: https://woocommerce.github.io/woocommerce-rest-api-docs/v3.html
- WooCommerce Developer Docs: https://developer.woocommerce.com/docs/
- WordPress Abilities API: (internal to WordPress MCP Adapter)
- Model Context Protocol: https://modelcontextprotocol.io/

### Similar Implementations
- WordPress post abilities serve as the reference implementation
- Each WooCommerce entity follows the same five-ability pattern (list, get, create, update, delete)

---

## Summary

This plan adds comprehensive WooCommerce e-commerce capabilities to the WordPress AI agent system through six incremental phases:

1. **Plugin Detection** - Detect WooCommerce installation
2. **Product Management** - Full CRUD for products
3. **Order Management** - Order processing and status updates
4. **Customer Management** - Customer data and purchase history
5. **Coupon Management** - Discount codes and promotions
6. **Inventory Management** - Stock tracking and bulk updates

Each phase builds on established patterns, is independently deployable, and includes both automated and manual verification criteria. The implementation leverages existing MCP infrastructure, follows WordPress permission systems, and integrates with the change tracking system for production sync.

Total estimated implementation time: 5-7 days for all phases.
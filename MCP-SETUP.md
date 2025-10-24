# WordPress MCP Adapter - Production Setup

This document describes the production-ready setup for the official WordPress MCP Adapter integration.

## Overview

This project integrates the official WordPress MCP Adapter with the Abilities API to expose WordPress functionality via the Model Context Protocol (MCP). The setup is fully reproducible and survives container restarts.

## Architecture

```
Claude Desktop (MCP Client)
    ↓ HTTP POST with Basic Auth
/wp-json/wordpress-poc/mcp (RestTransport)
    ↓
McpServer Instance
    ↓ routes to handlers
Initialize/Tools/Resources/Prompts Handlers
    ↓ validates & executes
Registered Abilities (wordpress/get-post, wordpress/list-posts)
    ↓ execute_callback
WordPress Core Functions (get_post(), get_posts())
```

## Current Capabilities

### Available Tools

1. **wordpress-get-post** - Retrieves a WordPress post by ID
   - Input: `{"id": number}`
   - Output: Post object with ID, title, content, status, author, date

2. **wordpress-list-posts** - Lists WordPress posts with pagination
   - Input: `{"per_page": number, "page": number}`
   - Output: Array of post objects

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Port 8000 available on localhost

### Installation

1. **Start the containers:**
   ```bash
   docker-compose up -d
   ```

2. **Run the installation script:**
   ```bash
   ./scripts/setup/install-mcp-adapter.sh
   ```

   This script will:
   - Install Composer in the container
   - Install WordPress packages (mcp-adapter, abilities-api)
   - Create plugin symlinks
   - Verify the installation

3. **Generate application password (if needed):**
   ```bash
   ./scripts/wordpress/wp-cli.sh user application-password create admin "MCP Client" --porcelain
   ```

4. **Test the MCP endpoint:**
   ```bash
   # Get credentials from .mcp-credentials file
   curl -s -u "admin:YOUR_PASSWORD" http://localhost:8000/wp-json/wordpress-poc/mcp \
     -X POST -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | jq .
   ```

## File Structure

### Host Files (Persistent)

```
wp-ai-editor-v3/
├── composer.json                    # Composer dependencies
├── docker-compose.yml               # Container configuration with persistent volumes
├── .mcp-credentials                 # MCP endpoint credentials (gitignored)
├── wp-content/
│   └── mu-plugins/                  # Must-Use plugins (auto-loaded)
│       ├── load-mcp-adapter.php     # Loads Composer & initializes MCP Plugin
│       ├── enable-app-passwords.php # Enables Application Passwords for HTTP
│       ├── register-wordpress-abilities.php  # Registers WordPress abilities
│       ├── configure-mcp-server.php # Creates & configures MCP server
│       └── debug-mcp-init.php       # Debug logging (optional)
└── scripts/
    ├── setup/
    │   └── install-mcp-adapter.sh   # Automated installation script
    └── wordpress/
        └── wp-cli.sh                # WordPress CLI wrapper
```

### Container Volumes

- `wp_data:/var/www/html` - WordPress files (persistent)
- `wp_vendor:/var/www/html/vendor` - Composer packages (persistent, managed by named volume)
- `./wp-content/mu-plugins:/var/www/html/wp-content/mu-plugins` - MU plugins (mounted from host)
- `./composer.json:/var/www/html/composer.json` - Composer config (mounted from host)

## Configuration Details

### Composer Packages

The `composer.json` defines two VCS repositories:

```json
{
  "require": {
    "wordpress/abilities-api": "dev-trunk",
    "wordpress/mcp-adapter": "dev-trunk"
  },
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/WordPress/abilities-api.git"
    },
    {
      "type": "vcs",
      "url": "https://github.com/WordPress/mcp-adapter.git"
    }
  ]
}
```

### MCP Server Configuration

Location: `wp-content/mu-plugins/configure-mcp-server.php:12-31`

- **Server ID**: `wordpress-poc-server`
- **Namespace**: `wordpress-poc`
- **Route**: `mcp`
- **Transport**: `RestTransport` (HTTP REST API)
- **Error Handler**: `ErrorLogMcpErrorHandler`
- **Observability**: `NullMcpObservabilityHandler`

### Ability Naming Convention

The Abilities API enforces this regex: `/^[a-z0-9-]+\/[a-z0-9-]+$/`

Valid examples:
- ✅ `wordpress/get-post`
- ✅ `wordpress/list-posts`
- ❌ `wordpress/core/get-post` (too many slashes)

## Testing

### Manual Testing

```bash
# 1. Initialize MCP connection
curl -s -u "admin:PASSWORD" http://localhost:8000/wp-json/wordpress-poc/mcp \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | jq .

# 2. List available tools
curl -s -u "admin:PASSWORD" http://localhost:8000/wp-json/wordpress-poc/mcp \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' | jq .

# 3. Call a tool - list posts
curl -s -u "admin:PASSWORD" http://localhost:8000/wp-json/wordpress-poc/mcp \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"wordpress-list-posts","arguments":{"per_page":3}},"id":3}' | jq .

# 4. Call a tool - get specific post
curl -s -u "admin:PASSWORD" http://localhost:8000/wp-json/wordpress-poc/mcp \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"wordpress-get-post","arguments":{"id":1}},"id":4}' | jq .
```

### WP-CLI Testing

```bash
# List registered abilities
./scripts/wordpress/wp-cli.sh eval "print_r(array_map(fn(\$a) => \$a->get_name(), wp_get_abilities()));"

# Test ability execution directly
./scripts/wordpress/wp-cli.sh eval "\$a = wp_get_ability('wordpress/get-post'); var_dump(\$a->execute(['id' => 1]));"

# Check if Application Passwords are enabled
./scripts/wordpress/wp-cli.sh eval "echo wp_is_application_passwords_available() ? 'available' : 'not available';"
```

## Claude Desktop Integration

Create or update `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "wordpress": {
      "url": "http://localhost:8000/wp-json/wordpress-poc/mcp",
      "transport": {
        "type": "http",
        "method": "POST"
      },
      "auth": {
        "type": "basic",
        "username": "admin",
        "password": "YOUR_APPLICATION_PASSWORD"
      }
    }
  }
}
```

## Troubleshooting

### WordPress returns 500 errors

Check if vendor directory exists:
```bash
docker-compose exec wordpress ls -la /var/www/html/vendor/
```

If empty, run:
```bash
./scripts/setup/install-mcp-adapter.sh
```

### Application Passwords not working

Verify Application Passwords are enabled:
```bash
./scripts/wordpress/wp-cli.sh eval "echo wp_is_application_passwords_available() ? 'available' : 'not available';"
```

If not available, check that `wp-content/mu-plugins/enable-app-passwords.php` exists and restart:
```bash
docker-compose restart wordpress
```

### MCP endpoint returns 401

Regenerate application password:
```bash
./scripts/wordpress/wp-cli.sh user application-password create admin "MCP Client" --porcelain
```

Update `.mcp-credentials` with the new password.

### No abilities registered

Check MU plugins are loaded:
```bash
docker-compose exec wordpress ls -la /var/www/html/wp-content/mu-plugins/
```

Check debug log:
```bash
docker-compose exec wordpress tail -50 /var/www/html/wp-content/debug.log
```

## Maintenance

### Updating Packages

```bash
docker-compose exec wordpress composer update
docker-compose restart wordpress
```

### Backing Up Data

The WordPress database and uploads are in the `wp_data` volume. To backup:

```bash
docker-compose exec db mysqldump -u wordpress -pwordpress wordpress > backup.sql
```

### Recreating Containers

The setup is fully reproducible:

```bash
# Stop and remove containers
docker-compose down

# Start fresh
docker-compose up -d

# Reinstall packages
./scripts/setup/install-mcp-adapter.sh
```

## References

- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **WordPress Abilities API**: https://github.com/WordPress/abilities-api
- **WordPress MCP Adapter**: https://github.com/WordPress/mcp-adapter
- **WordPress AI Initiative**: https://make.wordpress.org/ai/

## Known Limitations

1. Only 2 abilities implemented (get-post, list-posts)
2. No CRUD operations (create, update, delete)
3. Resources and Prompts not yet configured
4. No automated tests
5. HTTP only (no HTTPS for local development)

## Next Steps

1. Add CRUD abilities (create-post, update-post, delete-post)
2. Register abilities as Resources and Prompts
3. Add comprehensive error handling
4. Implement automated tests
5. Add support for other WordPress content types (pages, custom post types)
6. Document Claude Desktop usage patterns

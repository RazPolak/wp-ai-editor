# Milestone 1: WordPress MCP POC - Implementation Plan

## Overview

This document outlines the implementation plan for **Milestone 1** of the AI-Powered WordPress Editor project. The goal is to establish a working proof-of-concept where an AI agent (Claude Desktop) can interact with a sandboxed WordPress environment using the official WordPress Model Context Protocol (MCP).

**Timeline**: POC Development Phase
**Last Updated**: October 11, 2025

---

## What We're Achieving in Milestone 1

### Primary Goal
Create a functional demonstration where Claude Desktop can perform WordPress operations through natural language commands by connecting to a local WordPress sandbox via the official WordPress MCP implementation.

### Architecture for Milestone 1

```
┌─────────────────────┐         ┌──────────────────────────┐         ┌─────────────────────┐
│   Claude Desktop    │ ◄─────► │   WordPress MCP Adapter  │ ◄─────► │  Docker WordPress   │
│   (MCP Client)      │   MCP   │   (WordPress Plugin)     │   WP    │   Sandbox           │
│                     │ Protocol│   + REST API Transport   │   API   │   + MySQL           │
└─────────────────────┘         └──────────────────────────┘         └─────────────────────┘
```

### Success Criteria

#### Automated Verification:
- [ ] Docker containers start successfully: `docker-compose up -d`
- [ ] WordPress accessible at `http://localhost:8000`
- [ ] WordPress MCP Adapter plugin installed and activated
- [ ] MCP server endpoint responds: `curl http://localhost:8000/wp-json/mcp/v1/capabilities`

#### Manual Verification:
- [ ] Claude Desktop successfully connects to WordPress MCP server
- [ ] Claude can list existing WordPress posts via natural language command
- [ ] Claude can create a new blog post with title and content
- [ ] Claude can read an existing post's content
- [ ] Claude can update a post's content
- [ ] All operations reflect correctly in WordPress admin dashboard

**Implementation Note**: After completing setup and automated verification passes, manual testing with Claude Desktop should confirm all interaction scenarios work as expected.

---

## Current State Analysis

### What Exists Now
- System design document (`AI_Powered_WordPress_Editor_System_Design.md`)
- Empty project directory (brand new codebase)
- Claude Desktop installed locally (assumed)

### What's Missing
- Docker WordPress environment
- WordPress MCP Adapter installation
- WordPress MCP server configuration
- Claude Desktop MCP configuration
- Documentation of the integration flow

### Key Technology Decisions

**WordPress MCP Implementation**: Official WordPress/mcp-adapter
- **Why**: This is the canonical implementation maintained by the WordPress core team
- **Architecture**: Bridges WordPress Abilities API to Model Context Protocol
- **Transport**: REST API transport (HTTP-based, easy for POC)

**WordPress Environment**: Docker + Docker Compose
- **Why**: Isolated, reproducible, easy to destroy/recreate
- **Base Image**: Official `wordpress:6.4-php8.1-apache`
- **Database**: MariaDB 10.6.4

**AI Agent**: Claude Desktop
- **Why**: Built-in MCP support, easy configuration
- **Future**: Can be replaced with custom agent implementation

---

## What We're NOT Doing in Milestone 1

To maintain focus on the POC, the following are explicitly out of scope:

- Production WordPress site integration
- SaaS platform frontend development
- Custom WordPress Connector Plugin
- Granular change tracking system
- Production synchronization logic
- Multi-user support or authentication system
- HTTPS/SSL configuration
- WordPress Multisite setup
- Automated backups
- Performance optimization
- Any UI beyond WordPress admin dashboard

---

## Implementation Approach

The implementation follows a **bottom-up approach**:

1. **Foundation**: Set up the WordPress sandbox environment
2. **Integration Layer**: Install and configure WordPress MCP capabilities
3. **Connection**: Configure Claude Desktop to connect to the MCP server
4. **Validation**: Test end-to-end workflows with natural language commands

This approach ensures each layer is working before building the next, making debugging easier.

---

## Phase 1: Docker WordPress Sandbox Setup

### Overview
Create a local WordPress development environment using Docker that includes WordPress core, MySQL database, WP-CLI access, and phpMyAdmin for debugging.

### Changes Required

#### 1. Docker Compose Configuration
**File**: `docker-compose.yml`
**Purpose**: Define the multi-container WordPress environment

```yaml
version: '3.8'

services:
  db:
    image: mariadb:10.6.4-focal
    command: '--default-authentication-plugin=mysql_native_password'
    volumes:
      - db_data:/var/lib/mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-wordpress}
      MYSQL_USER: ${MYSQL_USER:-wordpress}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-wordpress}
    networks:
      - wordpress-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  wordpress:
    image: wordpress:6.4-php8.1-apache
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - wp_data:/var/www/html
      - ./wp-content/plugins:/var/www/html/wp-content/plugins
      - ./wp-content/themes:/var/www/html/wp-content/themes
    ports:
      - "${WP_PORT:-8000}:80"
    restart: always
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: ${MYSQL_USER:-wordpress}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD:-wordpress}
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
      WORDPRESS_DEBUG: ${WP_DEBUG:-1}
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_MEMORY_LIMIT', '256M');
        define('WP_MAX_MEMORY_LIMIT', '512M');
        define('WP_CACHE', false);
        define('ALLOW_UNFILTERED_UPLOADS', true);
    networks:
      - wordpress-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  wpcli:
    image: wordpress:cli
    user: '33'  # www-data user
    depends_on:
      wordpress:
        condition: service_healthy
    volumes:
      - wp_data:/var/www/html
      - ./wp-content/plugins:/var/www/html/wp-content/plugins
      - ./wp-content/themes:/var/www/html/wp-content/themes
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: ${MYSQL_USER:-wordpress}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD:-wordpress}
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
    networks:
      - wordpress-network

  phpmyadmin:
    image: phpmyadmin:latest
    depends_on:
      - db
    ports:
      - "${PMA_PORT:-8080}:80"
    environment:
      PMA_HOST: db
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
    networks:
      - wordpress-network

volumes:
  db_data:
  wp_data:

networks:
  wordpress-network:
    driver: bridge
```

#### 2. Environment Configuration
**File**: `.env`
**Purpose**: Store environment-specific configuration

```env
# Database Configuration
MYSQL_ROOT_PASSWORD=secure_root_password
MYSQL_DATABASE=wordpress
MYSQL_USER=wordpress
MYSQL_PASSWORD=secure_wordpress_password

# WordPress Configuration
WP_PORT=8000
WP_DEBUG=1

# phpMyAdmin Configuration
PMA_PORT=8080

# WordPress Site Configuration
WP_SITE_URL=http://localhost:8000
WP_ADMIN_USER=admin
WP_ADMIN_PASSWORD=admin123
WP_ADMIN_EMAIL=admin@example.com
```

#### 3. Environment Template
**File**: `.env.example`
**Purpose**: Template for environment variables (safe to commit)

```env
# Copy this file to .env and fill in your values

# Database Configuration
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_DATABASE=wordpress
MYSQL_USER=wordpress
MYSQL_PASSWORD=your_wordpress_password

# WordPress Configuration
WP_PORT=8000
WP_DEBUG=1

# phpMyAdmin Configuration
PMA_PORT=8080

# WordPress Site Configuration
WP_SITE_URL=http://localhost:8000
WP_ADMIN_USER=admin
WP_ADMIN_PASSWORD=your_admin_password
WP_ADMIN_EMAIL=admin@example.com
```

#### 4. Git Ignore Configuration
**File**: `.gitignore`
**Purpose**: Exclude sensitive and generated files

```gitignore
# Environment variables
.env

# Docker volumes data
wp-content/
.data/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Node modules (for future use)
node_modules/

# Composer (for future use)
vendor/
```

#### 5. Setup Script
**File**: `scripts/setup.sh`
**Purpose**: Automated WordPress installation script

```bash
#!/bin/bash

set -e

echo "🚀 Starting WordPress Setup..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found. Please create one from .env.example"
    exit 1
fi

# Start Docker containers
echo "📦 Starting Docker containers..."
docker-compose up -d

# Wait for WordPress to be ready
echo "⏳ Waiting for WordPress to be ready..."
sleep 15

# Check if WordPress is already installed
INSTALLED=$(docker-compose run --rm wpcli wp core is-installed 2>&1 || echo "not-installed")

if [[ $INSTALLED == *"not-installed"* ]]; then
    echo "🔧 Installing WordPress..."
    docker-compose run --rm wpcli wp core install \
        --url="${WP_SITE_URL}" \
        --title="WordPress MCP POC" \
        --admin_user="${WP_ADMIN_USER}" \
        --admin_password="${WP_ADMIN_PASSWORD}" \
        --admin_email="${WP_ADMIN_EMAIL}" \
        --skip-email

    echo "✅ WordPress installed successfully!"
else
    echo "ℹ️  WordPress is already installed"
fi

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "📍 Access Points:"
echo "   WordPress:   ${WP_SITE_URL}"
echo "   Admin Panel: ${WP_SITE_URL}/wp-admin"
echo "   phpMyAdmin:  http://localhost:${PMA_PORT}"
echo ""
echo "🔑 Admin Credentials:"
echo "   Username: ${WP_ADMIN_USER}"
echo "   Password: ${WP_ADMIN_PASSWORD}"
echo ""
echo "🛠️  Useful Commands:"
echo "   docker-compose run --rm wpcli wp plugin list"
echo "   docker-compose run --rm wpcli wp post list"
echo "   docker-compose logs -f wordpress"
echo ""
```

#### 6. Quick Reference Script
**File**: `scripts/wp-cli.sh`
**Purpose**: Convenient WP-CLI wrapper

```bash
#!/bin/bash

# Wrapper script for WP-CLI commands
docker-compose run --rm wpcli wp "$@"
```

#### 7. README for Setup
**File**: `README.md`
**Purpose**: Quick start guide

```markdown
# WordPress MCP POC

Proof of Concept for AI-Powered WordPress Editor using Model Context Protocol.

## Prerequisites

- Docker Desktop installed and running
- Git
- Basic command line knowledge

## Quick Start

1. **Clone and setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your preferred values
   ```

2. **Start WordPress**:
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

3. **Access WordPress**:
   - WordPress: http://localhost:8000
   - Admin: http://localhost:8000/wp-admin
   - phpMyAdmin: http://localhost:8080

## Useful Commands

### WP-CLI Access
```bash
# Make the wrapper executable
chmod +x scripts/wp-cli.sh

# List plugins
./scripts/wp-cli.sh plugin list

# List posts
./scripts/wp-cli.sh post list

# Create a test post
./scripts/wp-cli.sh post create --post_title="Test Post" --post_content="Test content" --post_status=publish
```

### Docker Management
```bash
# View logs
docker-compose logs -f wordpress

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

## Project Structure

```
.
├── docker-compose.yml       # Docker services configuration
├── .env                     # Environment variables (not committed)
├── .env.example            # Environment template
├── scripts/
│   ├── setup.sh            # Automated setup script
│   └── wp-cli.sh           # WP-CLI wrapper
├── wp-content/             # WordPress themes and plugins (bind mounted)
└── thoughts/               # Documentation and plans
```

## Next Steps

After setup is complete, proceed to Phase 2: WordPress MCP Installation.
```

### Success Criteria

#### Automated Verification:
- [ ] `.env` file created from template
- [ ] Docker containers start: `docker-compose up -d`
- [ ] Database health check passes
- [ ] WordPress health check passes
- [ ] WordPress accessible: `curl http://localhost:8000`
- [ ] WP-CLI works: `./scripts/wp-cli.sh --info`
- [ ] Setup script completes without errors: `./scripts/setup.sh`

#### Manual Verification:
- [ ] Can access WordPress admin at http://localhost:8000/wp-admin
- [ ] Can log in with admin credentials from .env
- [ ] phpMyAdmin accessible at http://localhost:8080
- [ ] Can create a test post in WordPress admin
- [ ] Docker logs show no critical errors: `docker-compose logs`

---

## Phase 2: WordPress MCP Adapter Installation

### Overview
Install and configure the official WordPress MCP Adapter plugin, along with its dependency (WordPress Abilities API). This phase transforms the WordPress installation into an MCP-capable server.

### Changes Required

#### 1. WordPress Abilities API Installation Script
**File**: `scripts/install-abilities-api.sh`
**Purpose**: Install the WordPress Abilities API (required dependency)

```bash
#!/bin/bash

set -e

echo "📦 Installing WordPress Abilities API..."

# Check if composer is available in the container
COMPOSER_CHECK=$(docker-compose run --rm wpcli wp package list 2>&1 | grep -c "abilities-api" || echo "0")

if [ "$COMPOSER_CHECK" -eq "0" ]; then
    echo "Installing Abilities API via Composer in WordPress..."

    # Create composer.json in WordPress root if it doesn't exist
    docker-compose exec wordpress bash -c "cd /var/www/html && \
        if [ ! -f composer.json ]; then \
            composer init --name=wordpress/poc --type=project --no-interaction; \
        fi"

    # Require the abilities API package
    docker-compose exec wordpress bash -c "cd /var/www/html && \
        composer require wordpress/abilities-api:dev-main"

    # Ensure it's autoloaded in wp-config.php
    docker-compose run --rm wpcli wp config set WP_ABILITIES_AUTOLOAD true --raw

    echo "✅ WordPress Abilities API installed via Composer"
else
    echo "ℹ️  WordPress Abilities API is already installed"
fi
```

#### 2. MCP Adapter Installation Script
**File**: `scripts/install-mcp-adapter.sh`
**Purpose**: Download and install the WordPress MCP Adapter plugin

```bash
#!/bin/bash

set -e

echo "📦 Installing WordPress MCP Adapter..."

# Check if plugin is already installed
PLUGIN_CHECK=$(docker-compose run --rm wpcli wp plugin list --name=mcp-adapter --format=count 2>&1 || echo "0")

if [ "$PLUGIN_CHECK" -eq "0" ]; then
    echo "Downloading MCP Adapter plugin..."

    # Create plugins directory if it doesn't exist
    mkdir -p wp-content/plugins

    # Download the latest release from GitHub
    # Note: This URL should be updated when official releases are available
    docker-compose run --rm wpcli wp plugin install \
        "https://github.com/WordPress/mcp-adapter/archive/refs/heads/main.zip" \
        --activate

    echo "✅ WordPress MCP Adapter installed and activated"
else
    echo "ℹ️  WordPress MCP Adapter is already installed"

    # Make sure it's activated
    docker-compose run --rm wpcli wp plugin activate mcp-adapter
    echo "✅ WordPress MCP Adapter activated"
fi

# Verify installation
echo ""
echo "🔍 Verifying installation..."
docker-compose run --rm wpcli wp plugin list | grep mcp-adapter
```

#### 3. MCP Server Configuration Script
**File**: `scripts/configure-mcp-server.sh`
**Purpose**: Configure the MCP server within WordPress

```bash
#!/bin/bash

set -e

echo "⚙️  Configuring WordPress MCP Server..."

# Create a custom plugin to configure the MCP server
cat > wp-content/plugins/mcp-server-config.php << 'EOF'
<?php
/**
 * Plugin Name: MCP Server Configuration
 * Description: Configures the WordPress MCP server for POC
 * Version: 1.0.0
 * Author: POC Team
 */

// Configure MCP Server
add_action('mcp_adapter_init', function($adapter) {
    // Register MCP server with basic WordPress abilities
    $adapter->create_server(
        'wordpress-poc-server',
        'wordpress-poc',
        'mcp',
        'WordPress POC MCP Server',
        'MCP server for WordPress POC with basic content management abilities',
        'v1.0.0',
        ['RestTransport'],  // Using REST API transport
        'ErrorLogMcpErrorHandler',
        'NullMcpObservabilityHandler',
        [
            // Core WordPress abilities
            'wordpress/core/get-post',
            'wordpress/core/create-post',
            'wordpress/core/update-post',
            'wordpress/core/delete-post',
            'wordpress/core/list-posts',
            'wordpress/core/get-page',
            'wordpress/core/create-page',
            'wordpress/core/update-page',
            'wordpress/core/list-pages',
        ]
    );
}, 10, 1);

// Enable REST API for MCP
add_filter('rest_authentication_errors', function($result) {
    // Allow REST API access for MCP
    if (!empty($result)) {
        return $result;
    }
    return true;
});

// Add CORS headers for local development
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        return $value;
    });
}, 15);
EOF

# Activate the configuration plugin
docker-compose run --rm wpcli wp plugin activate mcp-server-config

echo "✅ MCP Server configured successfully"

# Verify REST API endpoint
echo ""
echo "🔍 Verifying MCP REST API endpoint..."
sleep 2
curl -s http://localhost:8000/wp-json/mcp/v1/capabilities || echo "⚠️  Endpoint not yet available (may need WordPress restart)"
```

#### 4. Application Password Setup Script
**File**: `scripts/create-app-password.sh`
**Purpose**: Create WordPress Application Password for MCP authentication

```bash
#!/bin/bash

set -e

echo "🔑 Creating Application Password for MCP..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

APP_NAME="Claude Desktop MCP"

# Create application password
APP_PASSWORD=$(docker-compose run --rm wpcli wp user application-password create \
    "${WP_ADMIN_USER}" \
    "${APP_NAME}" \
    --porcelain)

if [ -n "$APP_PASSWORD" ]; then
    echo ""
    echo "======================================"
    echo "✅ Application Password Created"
    echo "======================================"
    echo ""
    echo "Application Name: ${APP_NAME}"
    echo "Password: ${APP_PASSWORD}"
    echo ""
    echo "⚠️  IMPORTANT: Save this password securely!"
    echo "You'll need it to configure Claude Desktop."
    echo ""

    # Save to a secure file
    echo "Saving to .mcp-credentials (gitignored)..."
    cat > .mcp-credentials << EOF
# WordPress MCP Credentials
# Generated: $(date)

WordPress URL: http://localhost:8000
Admin Username: ${WP_ADMIN_USER}
Application Password: ${APP_PASSWORD}

# Use these credentials in Claude Desktop MCP configuration
EOF

    echo "✅ Credentials saved to .mcp-credentials"
else
    echo "❌ Failed to create application password"
    exit 1
fi
```

#### 5. Update .gitignore
**File**: `.gitignore` (append)

```gitignore
# MCP Credentials
.mcp-credentials
```

#### 6. Master Installation Script
**File**: `scripts/install-mcp.sh`
**Purpose**: Run all MCP installation steps in sequence

```bash
#!/bin/bash

set -e

echo "🚀 Installing WordPress MCP Stack..."
echo ""

# Ensure WordPress is running
if ! docker-compose ps | grep -q "wordpress.*Up"; then
    echo "❌ WordPress containers are not running. Please run ./scripts/setup.sh first"
    exit 1
fi

# Step 1: Install Abilities API
./scripts/install-abilities-api.sh
echo ""

# Step 2: Install MCP Adapter
./scripts/install-mcp-adapter.sh
echo ""

# Step 3: Configure MCP Server
./scripts/configure-mcp-server.sh
echo ""

# Step 4: Create Application Password
./scripts/create-app-password.sh
echo ""

echo "======================================"
echo "✅ MCP Installation Complete!"
echo "======================================"
echo ""
echo "Next Steps:"
echo "1. Review the credentials in .mcp-credentials"
echo "2. Configure Claude Desktop (see Phase 3 documentation)"
echo "3. Test the connection"
echo ""
```

### Success Criteria

#### Automated Verification:
- [ ] WordPress Abilities API installed successfully
- [ ] MCP Adapter plugin appears in plugin list: `./scripts/wp-cli.sh plugin list`
- [ ] MCP Adapter plugin is activated
- [ ] MCP Server configuration plugin created and activated
- [ ] Application password created successfully
- [ ] MCP REST API endpoint responds: `curl http://localhost:8000/wp-json/mcp/v1/capabilities`

#### Manual Verification:
- [ ] Can see MCP Adapter in WordPress admin plugins page
- [ ] REST API endpoint returns valid JSON response
- [ ] Application password saved to `.mcp-credentials` file
- [ ] No errors in WordPress debug log: `docker-compose logs wordpress`

---

## Phase 3: Claude Desktop MCP Configuration

### Overview
Configure Claude Desktop to connect to the WordPress MCP server using the Application Password authentication method.

### Changes Required

#### 1. Claude Desktop Configuration Documentation
**File**: `docs/claude-desktop-setup.md`
**Purpose**: Step-by-step guide for configuring Claude Desktop

```markdown
# Claude Desktop MCP Configuration

This guide walks through connecting Claude Desktop to your local WordPress MCP server.

## Prerequisites

- Claude Desktop installed (download from https://claude.ai/desktop)
- WordPress MCP server running (Phase 1 & 2 completed)
- Application Password credentials (from `.mcp-credentials` file)

## Configuration Steps

### 1. Locate Claude Desktop Configuration File

The configuration file location varies by operating system:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Add WordPress MCP Server Configuration

Open the configuration file in a text editor and add the WordPress MCP server configuration:

```json
{
  "mcpServers": {
    "wordpress-poc": {
      "command": "node",
      "args": [
        "-e",
        "const http = require('http'); const url = process.env.WP_API_URL; const auth = 'Basic ' + Buffer.from(process.env.WP_API_USERNAME + ':' + process.env.WP_API_PASSWORD).toString('base64'); const handler = (req, res) => { const options = { method: req.method, headers: { ...req.headers, 'Authorization': auth } }; const proxyReq = http.request(url + req.url, options, proxyRes => { res.writeHead(proxyRes.statusCode, proxyRes.headers); proxyRes.pipe(res); }); req.pipe(proxyReq); }; http.createServer(handler).listen(0, () => console.log('Ready'));"
      ],
      "env": {
        "WP_API_URL": "http://localhost:8000/wp-json/mcp/v1",
        "WP_API_USERNAME": "admin",
        "WP_API_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

### 3. Update Credentials

Replace the placeholder values in the configuration:

1. Open your `.mcp-credentials` file (in the project root)
2. Copy the Application Password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)
3. Update the `WP_API_PASSWORD` value in the configuration
4. Update `WP_API_USERNAME` if you changed the admin username

### 4. Restart Claude Desktop

Close and reopen Claude Desktop to load the new configuration.

### 5. Verify Connection

Start a new conversation in Claude Desktop and try:

```
Can you list the WordPress posts available?
```

If configured correctly, Claude should be able to query your WordPress installation.

## Troubleshooting

### "Unable to connect to MCP server"

1. **Check WordPress is running**:
   ```bash
   curl http://localhost:8000
   ```

2. **Verify MCP endpoint**:
   ```bash
   curl http://localhost:8000/wp-json/mcp/v1/capabilities
   ```

3. **Test authentication**:
   ```bash
   curl -u admin:YOUR_APP_PASSWORD http://localhost:8000/wp-json/mcp/v1/capabilities
   ```

### "Authentication failed"

- Verify the Application Password is correct (check `.mcp-credentials`)
- Ensure no extra spaces in the password
- Try regenerating the password: `./scripts/create-app-password.sh`

### MCP endpoint returns 404

- Ensure MCP Adapter plugin is activated
- Check WordPress debug logs: `docker-compose logs wordpress`
- Verify REST API is working: `curl http://localhost:8000/wp-json/`

## Testing the Connection

Once connected, you can test various WordPress operations through Claude Desktop:

### List Posts
```
Show me all the WordPress posts
```

### Create a Post
```
Create a new WordPress post titled "Hello from Claude" with content "This post was created via MCP!"
```

### Read a Post
```
Can you read the content of the post titled "Hello from Claude"?
```

### Update a Post
```
Update the "Hello from Claude" post to include a new paragraph about AI integration
```

## Next Steps

Once you've verified the connection works, you can:

1. Create more complex WordPress content via Claude
2. Test plugin management capabilities
3. Experiment with theme customization
4. Explore extending the MCP server with custom abilities
```

#### 2. Configuration Generator Script
**File**: `scripts/generate-claude-config.sh`
**Purpose**: Automatically generate Claude Desktop configuration snippet

```bash
#!/bin/bash

set -e

echo "🔧 Generating Claude Desktop Configuration..."
echo ""

# Check if credentials file exists
if [ ! -f .mcp-credentials ]; then
    echo "❌ .mcp-credentials file not found."
    echo "Please run ./scripts/create-app-password.sh first"
    exit 1
fi

# Extract credentials
WP_URL=$(grep "WordPress URL:" .mcp-credentials | cut -d: -f2- | xargs)
WP_USER=$(grep "Admin Username:" .mcp-credentials | cut -d: -f2 | xargs)
APP_PASS=$(grep "Application Password:" .mcp-credentials | cut -d: -f2 | xargs)

# Generate configuration
cat > claude-desktop-config.json << EOF
{
  "mcpServers": {
    "wordpress-poc": {
      "command": "npx",
      "args": [
        "-y",
        "@automattic/mcp-wordpress-remote"
      ],
      "env": {
        "WP_API_URL": "${WP_URL}",
        "WP_API_USERNAME": "${WP_USER}",
        "WP_API_PASSWORD": "${APP_PASS}",
        "OAUTH_ENABLED": "false"
      }
    }
  }
}
EOF

echo "✅ Configuration generated: claude-desktop-config.json"
echo ""
echo "======================================"
echo "📋 Claude Desktop Setup Instructions"
echo "======================================"
echo ""
echo "1. Locate your Claude Desktop config file:"
echo "   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "   Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
echo "   Linux:   ~/.config/Claude/claude_desktop_config.json"
echo ""
echo "2. Copy the contents of 'claude-desktop-config.json' into your Claude Desktop config"
echo "   (merge with existing config if you have other MCP servers)"
echo ""
echo "3. Restart Claude Desktop"
echo ""
echo "4. Test the connection by asking Claude:"
echo '   "Can you list the WordPress posts available?"'
echo ""

# Detect OS and offer to open config location
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    echo "💡 Tip: Opening Claude config directory..."
    open "$CONFIG_DIR" 2>/dev/null || echo "   (Could not auto-open. Please navigate manually)"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CONFIG_DIR="$HOME/.config/Claude"
    echo "💡 Config directory: $CONFIG_DIR"
fi
```

#### 3. Update .gitignore
**File**: `.gitignore` (append)

```gitignore
# Claude Desktop config (contains credentials)
claude-desktop-config.json
```

#### 4. Update README with Phase 3 Instructions
**File**: `README.md` (append new section)

```markdown
## Phase 3: Claude Desktop Configuration

After WordPress MCP is installed, configure Claude Desktop:

```bash
# Generate Claude Desktop configuration
./scripts/generate-claude-config.sh

# Follow the printed instructions to:
# 1. Locate your Claude Desktop config file
# 2. Copy the generated configuration
# 3. Restart Claude Desktop
```

Test the connection by asking Claude:
- "Can you list the WordPress posts available?"
- "Create a new post titled 'Test from Claude'"

See `docs/claude-desktop-setup.md` for detailed troubleshooting.
```

### Success Criteria

#### Automated Verification:
- [ ] Configuration generator script runs successfully: `./scripts/generate-claude-config.sh`
- [ ] `claude-desktop-config.json` file created with correct credentials
- [ ] Claude Desktop configuration file exists on system

#### Manual Verification:
- [ ] Claude Desktop successfully starts with new configuration
- [ ] No MCP connection errors in Claude Desktop
- [ ] Claude responds to "Can you list the WordPress posts available?"
- [ ] Claude can successfully create a test post
- [ ] Created post appears in WordPress admin dashboard
- [ ] Claude can read and describe existing post content
- [ ] Claude can update an existing post

**Implementation Note**: This is the final validation phase. All manual testing should confirm the full end-to-end workflow works as expected before considering Milestone 1 complete.

---

## Phase 4: Documentation and Testing Guide

### Overview
Create comprehensive documentation and testing procedures to validate the POC and guide future development.

### Changes Required

#### 1. Testing Guide
**File**: `docs/testing-guide.md`
**Purpose**: Comprehensive testing scenarios and validation

```markdown
# WordPress MCP POC Testing Guide

This guide provides structured testing scenarios to validate the WordPress MCP integration.

## Pre-Testing Checklist

Before running tests, ensure:

- [ ] All Docker containers are running: `docker-compose ps`
- [ ] WordPress is accessible: http://localhost:8000
- [ ] MCP endpoint responds: `curl http://localhost:8000/wp-json/mcp/v1/capabilities`
- [ ] Claude Desktop is running with WordPress MCP configured
- [ ] No errors in logs: `docker-compose logs | grep -i error`

## Test Scenarios

### Scenario 1: List Posts

**Objective**: Verify Claude can retrieve a list of WordPress posts.

**Steps**:
1. In Claude Desktop, send message: "List all WordPress posts"
2. Observe the response

**Expected Result**:
- Claude returns a list of posts with titles, IDs, and dates
- If no posts exist, Claude indicates the site is empty
- No error messages appear

**Validation**:
- Compare Claude's list with WordPress admin posts page
- Verify post count matches

---

### Scenario 2: Create New Post

**Objective**: Verify Claude can create a new blog post.

**Test Case 2.1: Simple Post**

**Steps**:
1. Send message: "Create a new WordPress post titled 'AI Generated Post' with content 'This post was created by Claude via MCP.'"
2. Wait for confirmation

**Expected Result**:
- Claude confirms post creation
- Provides post ID and URL
- Post is created with correct title and content

**Validation**:
1. Check WordPress admin: Posts → All Posts
2. Verify new post appears
3. Open post and verify content matches
4. Check post status (should be "Draft" or "Published" based on Claude's default)

**Test Case 2.2: Post with HTML Content**

**Steps**:
1. Send message: "Create a WordPress post titled 'Formatted Content' with this content: a heading 'Welcome', a paragraph with bold text 'This is bold', and a bullet list with three items."

**Expected Result**:
- Claude creates post with proper HTML formatting
- Content includes semantic HTML tags

**Validation**:
- View post in WordPress editor
- Verify HTML formatting is correct
- Preview post in browser to check rendering

---

### Scenario 3: Read Post Content

**Objective**: Verify Claude can retrieve and describe existing post content.

**Steps**:
1. Create a test post in WordPress admin with rich content (images, formatting)
2. In Claude, send: "Can you read the post titled '[Your Post Title]' and summarize it?"
3. Observe response

**Expected Result**:
- Claude retrieves the correct post
- Summarizes content accurately
- Mentions key elements (images, links, formatting)

**Validation**:
- Compare Claude's summary with actual post
- Verify no content is hallucinated

---

### Scenario 4: Update Existing Post

**Objective**: Verify Claude can modify existing post content.

**Test Case 4.1: Content Update**

**Steps**:
1. Note down an existing post title
2. Send: "Update the post '[Post Title]' by adding a new paragraph at the end: 'Updated by Claude MCP on [current date]'"
3. Wait for confirmation

**Expected Result**:
- Claude confirms update
- Post content includes new paragraph
- Original content remains intact

**Validation**:
1. Open post in WordPress editor
2. Verify new content is appended
3. Verify original content unchanged
4. Check post revision history

**Test Case 4.2: Title Update**

**Steps**:
1. Send: "Change the title of the post with ID [post-id] to 'Updated Title - MCP Test'"

**Expected Result**:
- Post title changes
- URL slug may or may not update (WordPress behavior)

**Validation**:
- Verify title change in admin
- Check post URL

---

### Scenario 5: Delete Post

**Objective**: Verify Claude can delete posts (if permissions allow).

**Steps**:
1. Create a test post: "This post will be deleted"
2. Note the post ID
3. Send: "Delete the WordPress post with ID [post-id]"

**Expected Result**:
- Claude confirms deletion
- Post moves to trash or is permanently deleted

**Validation**:
- Check WordPress admin Trash folder
- Verify post is no longer in published posts

---

### Scenario 6: Complex Workflow

**Objective**: Test multi-step operations in a single conversation.

**Steps**:
1. "Create three blog posts about different topics: one about technology, one about nature, and one about cooking"
2. Wait for completion
3. "Now list all the posts you just created"
4. "Update the cooking post to include a recipe section"
5. "Delete the technology post"

**Expected Result**:
- Claude handles all steps successfully
- Maintains context throughout conversation
- Each operation reflects correctly in WordPress

**Validation**:
- Verify final state matches expected outcome
- Check that Claude maintained context (e.g., remembered post IDs)

---

## Error Handling Tests

### Test: Invalid Post ID

**Steps**:
1. Send: "Show me the post with ID 99999"

**Expected Result**:
- Claude gracefully handles error
- Informs user that post doesn't exist
- Doesn't crash or produce errors

### Test: Malformed Request

**Steps**:
1. Send: "Create a post with no title or content"

**Expected Result**:
- Claude either asks for missing information
- Or creates post with default/empty values
- Provides helpful guidance

### Test: Permission Issues

**Steps**:
1. If possible, test with restricted user
2. Attempt operations beyond user's capabilities

**Expected Result**:
- Claude reports permission error clearly
- Doesn't expose sensitive error details

---

## Performance Tests

### Test: Large Content Creation

**Steps**:
1. "Create a WordPress post with 2000 words of content about climate change"

**Expected Result**:
- Claude successfully creates large post
- No timeout errors
- Content is complete

**Validation**:
- Check post word count matches request
- Verify no truncation occurred

### Test: Batch Operations

**Steps**:
1. "Create 10 posts with sequential titles: 'Post 1', 'Post 2', ... 'Post 10'"

**Expected Result**:
- All 10 posts created successfully
- Claude provides summary of operations

**Validation**:
- Count posts in WordPress admin
- Verify all titles are correct

---

## Troubleshooting Common Issues

### Issue: Claude doesn't respond to WordPress queries

**Diagnosis**:
```bash
# Check MCP endpoint
curl http://localhost:8000/wp-json/mcp/v1/capabilities

# Check Docker logs
docker-compose logs wordpress | tail -50

# Test authentication
curl -u admin:YOUR_APP_PASSWORD http://localhost:8000/wp-json/wp/v2/posts
```

### Issue: Operations succeed in Claude but don't appear in WordPress

**Diagnosis**:
- Clear WordPress cache
- Check post status (may be in draft/trash)
- Verify database: `docker-compose exec db mysql -u wordpress -p`

### Issue: Authentication errors

**Solutions**:
- Regenerate application password
- Verify credentials in Claude config
- Check WordPress user has necessary capabilities

---

## Test Results Template

Use this template to document test results:

```
Test Date: YYYY-MM-DD
Tester: [Name]
Environment: [Local Docker / Other]

| Scenario | Status | Notes |
|----------|--------|-------|
| List Posts | ✅/❌ | |
| Create Post | ✅/❌ | |
| Read Post | ✅/❌ | |
| Update Post | ✅/❌ | |
| Delete Post | ✅/❌ | |
| Complex Workflow | ✅/❌ | |
| Error Handling | ✅/❌ | |
| Performance | ✅/❌ | |

Overall Status: [PASS / FAIL / PARTIAL]

Issues Identified:
1. [Issue description]
2. [Issue description]

Next Steps:
- [Action item]
- [Action item]
```
```

#### 2. Troubleshooting Guide
**File**: `docs/troubleshooting.md`
**Purpose**: Common issues and solutions

```markdown
# Troubleshooting Guide

## Common Issues and Solutions

### Docker Issues

#### Issue: Containers won't start
```bash
# Check Docker is running
docker ps

# Check logs
docker-compose logs

# Try fresh start
docker-compose down -v
docker-compose up -d
```

#### Issue: Port already in use
```bash
# Change ports in .env
WP_PORT=8001  # Instead of 8000
PMA_PORT=8081  # Instead of 8080

# Restart containers
docker-compose down
docker-compose up -d
```

#### Issue: Permission errors
```bash
# Fix permissions on wp-content
sudo chown -R $(id -u):$(id -g) wp-content/

# Or run with proper user
docker-compose run --user $(id -u):$(id -g) wpcli wp plugin list
```

---

### WordPress Issues

#### Issue: "Error establishing database connection"

**Cause**: Database not ready when WordPress starts.

**Solution**:
```bash
# Wait longer for database
docker-compose down
docker-compose up -d db
sleep 10
docker-compose up -d wordpress
```

#### Issue: WordPress shows "Already Installed" error

**Cause**: WordPress already configured.

**Solution**:
- This is normal if re-running setup
- To truly start fresh: `docker-compose down -v`

#### Issue: wp-config.php not writable

**Cause**: Permission issues in Docker volume.

**Solution**:
```bash
docker-compose exec wordpress chmod 666 wp-config.php
```

---

### MCP Issues

#### Issue: MCP endpoint returns 404

**Diagnosis**:
```bash
# Check plugin is activated
./scripts/wp-cli.sh plugin list | grep mcp-adapter

# Check REST API works
curl http://localhost:8000/wp-json/

# Check MCP capabilities endpoint
curl http://localhost:8000/wp-json/mcp/v1/capabilities
```

**Solutions**:
1. Re-activate plugin: `./scripts/wp-cli.sh plugin activate mcp-adapter`
2. Flush rewrite rules: `./scripts/wp-cli.sh rewrite flush`
3. Check plugin installation: `./scripts/install-mcp-adapter.sh`

#### Issue: MCP authentication fails

**Symptoms**: 401 or 403 errors

**Diagnosis**:
```bash
# Test authentication manually
curl -u admin:YOUR_APP_PASSWORD \
  http://localhost:8000/wp-json/mcp/v1/capabilities
```

**Solutions**:
1. Regenerate application password: `./scripts/create-app-password.sh`
2. Check username matches: should be exact match (default: admin)
3. Verify password format: should have spaces like `xxxx xxxx xxxx`

#### Issue: CORS errors in browser

**Cause**: Browser security restrictions.

**Solution**: This shouldn't affect Claude Desktop, but if testing in browser:
- Use the MCP Server Configuration plugin (created in Phase 2)
- Or access directly from localhost

---

### Claude Desktop Issues

#### Issue: "MCP server not found"

**Cause**: Configuration file incorrect or Claude Desktop not restarted.

**Solution**:
1. Verify config file location
2. Check JSON syntax: use validator like jsonlint.com
3. Restart Claude Desktop completely (quit, not just close window)

#### Issue: Claude can't connect to WordPress

**Diagnosis**:
```bash
# 1. Verify WordPress is accessible from host
curl http://localhost:8000

# 2. Test MCP endpoint
curl http://localhost:8000/wp-json/mcp/v1/capabilities

# 3. Check Claude Desktop logs (if available)
# macOS: ~/Library/Logs/Claude/
# Windows: %APPDATA%\Claude\logs\
```

**Solutions**:
1. Ensure WordPress is running: `docker-compose ps`
2. Verify URL in Claude config matches WordPress URL
3. Try with IP instead of localhost: `http://127.0.0.1:8000`

#### Issue: Claude responds but operations don't work

**Symptoms**: Claude acknowledges commands but WordPress doesn't change.

**Diagnosis**:
- Check WordPress debug log: `docker-compose logs wordpress`
- Test direct REST API: `curl -u admin:PASS http://localhost:8000/wp-json/wp/v2/posts`

**Solutions**:
1. Verify MCP Adapter plugin is active
2. Check user permissions: `./scripts/wp-cli.sh user list`
3. Enable WordPress debug logging in .env: `WP_DEBUG=1`

---

### Network Issues

#### Issue: Can't access from another machine

**Cause**: WordPress configured for localhost only.

**Solution**:
```bash
# Update WordPress URLs
./scripts/wp-cli.sh option update home 'http://YOUR_IP:8000'
./scripts/wp-cli.sh option update siteurl 'http://YOUR_IP:8000'

# Update .env
WP_SITE_URL=http://YOUR_IP:8000
```

#### Issue: SSL/HTTPS errors

**Cause**: POC uses HTTP, not HTTPS.

**Solution**: For POC, this is acceptable. For production, you'll need:
- Reverse proxy (nginx/Traefik)
- SSL certificates
- Update WordPress URLs to https://

---

## Debugging Techniques

### Enable WordPress Debug Mode

Edit `.env`:
```env
WP_DEBUG=1
WORDPRESS_CONFIG_EXTRA: |
  define('WP_DEBUG', true);
  define('WP_DEBUG_LOG', true);
  define('WP_DEBUG_DISPLAY', false);
```

View logs:
```bash
docker-compose logs wordpress | grep -i error
./scripts/wp-cli.sh eval 'echo file_get_contents(WP_CONTENT_DIR . "/debug.log");'
```

### Monitor REST API Requests

```bash
# Watch WordPress access logs
docker-compose logs -f wordpress

# Filter for REST API calls
docker-compose logs -f wordpress | grep '/wp-json/'
```

### Test MCP Capabilities

```bash
# List available MCP capabilities
curl -u admin:YOUR_APP_PASSWORD \
  http://localhost:8000/wp-json/mcp/v1/capabilities | jq

# Test specific ability
curl -u admin:YOUR_APP_PASSWORD \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"ability":"wordpress/core/list-posts","params":{}}' \
  http://localhost:8000/wp-json/mcp/v1/execute
```

### Database Inspection

```bash
# Access MySQL
docker-compose exec db mysql -u wordpress -p

# Check posts table
mysql> USE wordpress;
mysql> SELECT ID, post_title, post_status FROM wp_posts WHERE post_type='post';
```

---

## Getting Help

### Check Documentation
- Main README: `README.md`
- Setup Guide: `docs/claude-desktop-setup.md`
- Testing Guide: `docs/testing-guide.md`

### Useful Commands
```bash
# Full system reset
docker-compose down -v && ./scripts/setup.sh && ./scripts/install-mcp.sh

# Check system status
docker-compose ps
./scripts/wp-cli.sh plugin list
curl http://localhost:8000/wp-json/mcp/v1/capabilities

# View all logs
docker-compose logs --tail=100
```

### Project Health Check Script
```bash
#!/bin/bash
echo "🏥 WordPress MCP Health Check"
echo ""
echo "Docker Containers:"
docker-compose ps
echo ""
echo "WordPress Status:"
curl -s http://localhost:8000 | head -n 1
echo ""
echo "MCP Endpoint:"
curl -s http://localhost:8000/wp-json/mcp/v1/capabilities | jq '.version' || echo "❌ Not responding"
echo ""
echo "Plugins:"
docker-compose run --rm wpcli wp plugin list
```

Save this as `scripts/health-check.sh` and run: `./scripts/health-check.sh`
```

#### 3. Architecture Documentation
**File**: `docs/architecture.md`
**Purpose**: Technical architecture documentation

```markdown
# Milestone 1 Architecture

## System Components

### 1. Docker Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                           │
│                  (wordpress-network)                         │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────┐  │
│  │  MariaDB │◄───│WordPress │◄───│  WP-CLI  │    │ PHP  │  │
│  │  10.6.4  │    │  6.4+    │    │  Image   │    │MyAdm│  │
│  │          │    │  PHP 8.1 │    │          │    │  in  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────┘  │
│       ▲               ▲                                      │
│       │               │                                      │
│   db_data         wp_data                                   │
│   volume          volume                                     │
└─────────────────────────────────────────────────────────────┘
       │               │
       ▼               ▼
   Port 3306       Port 8000
```

**Component Details**:

**MariaDB Container**:
- Image: `mariadb:10.6.4-focal`
- Purpose: WordPress database
- Storage: Named volume `db_data`
- Health check: MySQL ping
- Network: Internal only (no host port mapping)

**WordPress Container**:
- Image: `wordpress:6.4-php8.1-apache`
- Purpose: WordPress application server
- Storage:
  - Named volume `wp_data` for core files
  - Bind mount `./wp-content/plugins` for development
  - Bind mount `./wp-content/themes` for development
- Exposed Port: 8000 → 80
- Health check: HTTP GET on localhost

**WP-CLI Container**:
- Image: `wordpress:cli`
- Purpose: Command-line WordPress management
- Storage: Shared volumes with WordPress container
- User: UID 33 (www-data) for permission compatibility
- Usage: On-demand via `docker-compose run`

**phpMyAdmin Container** (optional):
- Image: `phpmyadmin:latest`
- Purpose: Database management UI
- Exposed Port: 8080 → 80

---

### 2. WordPress MCP Stack

```
┌─────────────────────────────────────────────────────────┐
│               WordPress Application                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │          WordPress Core + REST API              │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │                                   │
│  ┌───────────────────▼─────────────────────────────┐    │
│  │       WordPress Abilities API (Composer)        │    │
│  │  - Defines WordPress capabilities as "abilities"│    │
│  │  - Schema-based input/output validation        │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │                                   │
│  ┌───────────────────▼─────────────────────────────┐    │
│  │         WordPress MCP Adapter (Plugin)          │    │
│  │  - Bridges Abilities API ↔ MCP Protocol       │    │
│  │  - Implements REST API transport               │    │
│  │  - Handles authentication                       │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │                                   │
│  ┌───────────────────▼─────────────────────────────┐    │
│  │    MCP Server Config Plugin (Custom)            │    │
│  │  - Registers MCP server instance                │    │
│  │  - Defines available abilities                  │    │
│  │  - Configures CORS for development             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Data Flow**:

1. **Abilities API** provides WordPress operations as structured, schema-validated abilities
2. **MCP Adapter** translates between Abilities API and MCP protocol
3. **REST API Transport** exposes MCP capabilities over HTTP
4. **Custom Config Plugin** registers the server and abilities we want to expose

---

### 3. MCP Communication Flow

```
┌─────────────┐         HTTP/REST API          ┌──────────────┐
│   Claude    │ ◄─────────────────────────────►│  WordPress   │
│   Desktop   │                                 │  MCP Server  │
│             │  1. MCP Capability Discovery    │              │
│ [MCP Client]│  ────────────────────────────►  │   REST API   │
│             │                                 │   Endpoint   │
│             │  2. Available Abilities         │              │
│             │  ◄────────────────────────────  │ /wp-json/    │
│             │                                 │  mcp/v1/     │
│             │  3. Execute Ability Request     │              │
│             │  ────────────────────────────►  │              │
│             │     {                           │              │
│             │       ability: "create-post",   │              │
│             │       params: {...}             │              │
│             │     }                           │              │
│             │                                 │              │
│             │  4. Ability Execution Result    │              │
│             │  ◄────────────────────────────  │              │
│             │     {                           │              │
│             │       result: {...},            │              │
│             │       status: "success"         │              │
│             │     }                           │              │
└─────────────┘                                 └──────────────┘
```

**Authentication Flow**:

```
Claude Desktop Config
  ├─ WP_API_URL: http://localhost:8000/wp-json/mcp/v1
  ├─ WP_API_USERNAME: admin
  └─ WP_API_PASSWORD: xxxx xxxx xxxx (Application Password)
           │
           ▼
    HTTP Basic Auth Header
    Authorization: Basic base64(username:password)
           │
           ▼
    WordPress validates Application Password
           │
           ▼
    User capabilities checked
           │
           ▼
    Ability execution permitted/denied
```

---

### 4. File Structure

```
wp-ai-editor-v3/
├── docker-compose.yml              # Docker services definition
├── .env                            # Environment configuration (gitignored)
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
├── .mcp-credentials                # MCP credentials (gitignored)
├── claude-desktop-config.json      # Generated Claude config (gitignored)
│
├── scripts/                        # Automation scripts
│   ├── setup.sh                    # Initial WordPress setup
│   ├── install-abilities-api.sh    # Install Abilities API
│   ├── install-mcp-adapter.sh      # Install MCP Adapter
│   ├── configure-mcp-server.sh     # Configure MCP server
│   ├── create-app-password.sh      # Generate Application Password
│   ├── install-mcp.sh              # Master MCP installation
│   ├── generate-claude-config.sh   # Generate Claude config
│   ├── wp-cli.sh                   # WP-CLI wrapper
│   └── health-check.sh             # System health check
│
├── wp-content/                     # WordPress custom content (bind mounted)
│   ├── plugins/
│   │   └── mcp-server-config.php   # Custom MCP configuration plugin
│   └── themes/
│
├── docs/                           # Documentation
│   ├── claude-desktop-setup.md     # Claude Desktop configuration guide
│   ├── testing-guide.md            # Testing procedures
│   ├── troubleshooting.md          # Common issues and solutions
│   └── architecture.md             # This file
│
├── thoughts/                       # Project documentation
│   └── shared/
│       └── plans/
│           └── 2025-10-11-milestone-1-wordpress-mcp-poc.md
│
└── README.md                       # Main project documentation
```

---

## Technology Stack

### Infrastructure
- **Docker**: ^24.0.0
- **Docker Compose**: ^2.20.0

### WordPress Environment
- **WordPress**: 6.4+
- **PHP**: 8.1
- **Apache**: 2.4 (bundled in WordPress image)
- **MariaDB**: 10.6.4

### MCP Implementation
- **WordPress Abilities API**: dev-main (Composer)
- **WordPress MCP Adapter**: Latest from GitHub
- **Transport**: REST API (HTTP/HTTPS)

### Development Tools
- **WP-CLI**: Latest (via wordpress:cli image)
- **phpMyAdmin**: Latest (optional)

### AI Agent
- **Claude Desktop**: Latest version with MCP support

---

## Security Considerations

### POC Limitations (Not Production-Ready)

1. **HTTP Only**: No SSL/TLS encryption
2. **Weak Passwords**: Default passwords in .env.example
3. **Application Passwords**: Less secure than OAuth
4. **CORS Enabled**: Open CORS for development
5. **Debug Mode**: WordPress debug enabled

### Recommended for Production

1. **HTTPS**: Use reverse proxy with SSL certificates
2. **OAuth 2.1**: Replace Application Passwords
3. **Environment Secrets**: Use secret management (Vault, etc.)
4. **Network Isolation**: Restrict MCP endpoint access
5. **Rate Limiting**: Implement API rate limits
6. **Audit Logging**: Log all MCP operations

---

## Scalability & Performance

### Current Limitations (POC)

- Single Docker host (no clustering)
- No caching layer
- SQLite/file-based MCP transport limitations
- No load balancing

### Future Enhancements

1. **Caching**: Redis/Memcached for WordPress and MCP
2. **CDN**: CloudFlare/AWS CloudFront for assets
3. **Database**: Separate database host, read replicas
4. **Containerization**: Kubernetes for orchestration
5. **Queue System**: Background processing for heavy MCP operations

---

## Extension Points

The architecture is designed for easy extension:

### 1. Custom WordPress Abilities
Register new abilities via Abilities API:

```php
add_action('abilities_api_init', function($registry) {
    $registry->register_ability([
        'name' => 'custom/my-ability',
        'description' => 'Does something custom',
        'input_schema' => [/* JSON Schema */],
        'output_schema' => [/* JSON Schema */],
        'callback' => 'my_custom_callback'
    ]);
});
```

### 2. Alternative MCP Transports
Switch from REST API to WebSocket or gRPC:

```php
$adapter->create_server(
    'my-server',
    'namespace',
    'mcp',
    'Server Name',
    'Description',
    'v1.0.0',
    [WebSocketTransport::class],  // Different transport
    // ...
);
```

### 3. Custom Authentication
Replace Application Passwords with OAuth:

```json
{
  "env": {
    "OAUTH_ENABLED": "true",
    "OAUTH_CLIENT_ID": "...",
    "OAUTH_CLIENT_SECRET": "..."
  }
}
```

### 4. Replace Claude Desktop
Use MCP SDK to build custom client:

```javascript
import { MCPClient } from '@modelcontextprotocol/sdk';

const client = new MCPClient({
  serverUrl: 'http://localhost:8000/wp-json/mcp/v1',
  auth: { /* ... */ }
});

await client.executeAbility('wordpress/core/create-post', {
  title: 'New Post',
  content: 'Content here'
});
```

---

## Next Steps for Future Milestones

Based on this POC architecture, future development should focus on:

1. **SaaS Frontend**: Web UI for managing WordPress connections
2. **Connector Plugin**: Replace direct MCP access with connector plugin model
3. **Sandbox Orchestrator**: Automate sandbox creation/destruction
4. **Production Sync**: Granular change tracking and deployment
5. **Multi-User Support**: User management and permissions
6. **Security Hardening**: OAuth, HTTPS, audit logs
7. **Monitoring**: Observability and error tracking

See the main implementation plan for detailed future milestone planning.
```

#### 4. Update Main README
**File**: `README.md` (append comprehensive sections)

```markdown
## Complete Setup Guide

### Prerequisites Check
```bash
# Verify Docker
docker --version  # Should be 24.0.0+
docker-compose --version  # Should be 2.20.0+

# Verify Docker is running
docker ps
```

### Full Installation

```bash
# 1. Initial setup
cp .env.example .env
# Edit .env with your preferences

# 2. Start WordPress
chmod +x scripts/*.sh
./scripts/setup.sh

# 3. Install MCP stack
./scripts/install-mcp.sh

# 4. Generate Claude Desktop config
./scripts/generate-claude-config.sh

# 5. Configure Claude Desktop
# Follow printed instructions to update Claude Desktop config

# 6. Test the connection
# Open Claude Desktop and ask: "List my WordPress posts"
```

### System Health Check

```bash
# Run health check script
./scripts/health-check.sh

# Manual checks
curl http://localhost:8000  # WordPress
curl http://localhost:8000/wp-json/mcp/v1/capabilities  # MCP
docker-compose ps  # All containers should be "Up"
```

## Documentation

- **[Architecture](docs/architecture.md)**: Technical system architecture
- **[Claude Desktop Setup](docs/claude-desktop-setup.md)**: Configure Claude Desktop
- **[Testing Guide](docs/testing-guide.md)**: Comprehensive testing scenarios
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions

## Common Operations

### WordPress Management
```bash
# WP-CLI wrapper
./scripts/wp-cli.sh plugin list
./scripts/wp-cli.sh post list
./scripts/wp-cli.sh user list

# Create test content
./scripts/wp-cli.sh post create \
  --post_title="Sample Post" \
  --post_content="This is a test" \
  --post_status=publish

# Database backup
docker-compose exec db mysqldump -u wordpress -pwordpress wordpress > backup.sql
```

### Container Management
```bash
# View logs
docker-compose logs -f wordpress
docker-compose logs --tail=100

# Restart services
docker-compose restart

# Fresh start (destroys data)
docker-compose down -v
./scripts/setup.sh
./scripts/install-mcp.sh
```

### Debugging
```bash
# WordPress debug log
./scripts/wp-cli.sh eval 'error_log("Test message");'
docker-compose logs wordpress | grep "Test message"

# Test MCP endpoint
curl -u admin:$(grep "Application Password" .mcp-credentials | cut -d: -f2 | xargs) \
  http://localhost:8000/wp-json/mcp/v1/capabilities | jq
```

## Milestone 1 Success Criteria

This POC is complete when:

- [ ] WordPress runs in Docker
- [ ] MCP Adapter installed and configured
- [ ] Claude Desktop connects successfully
- [ ] Can create posts via Claude Desktop
- [ ] Can read existing posts via Claude Desktop
- [ ] Can update posts via Claude Desktop
- [ ] All operations reflect in WordPress admin
- [ ] Documentation is complete and tested

## Known Limitations (POC)

- HTTP only (no HTTPS)
- Application Password authentication (not OAuth)
- Single user support
- No production synchronization
- Local development only
- No automated backups

## Future Milestones

See `AI_Powered_WordPress_Editor_System_Design.md` for the full vision.

**Milestone 2** (Planned):
- Replace Claude Desktop with custom MCP client
- Implement proper SaaS authentication
- Add multi-site support

**Milestone 3** (Planned):
- Production WordPress connector plugin
- Sandbox orchestration
- Granular change tracking

**Milestone 4** (Planned):
- SaaS frontend
- User management
- Production deployment

## Contributing

This is a POC project. For questions or issues:

1. Check `docs/troubleshooting.md`
2. Review Docker logs: `docker-compose logs`
3. Run health check: `./scripts/health-check.sh`

## License

[Add your license information]
```

### Success Criteria

#### Automated Verification:
- [ ] All documentation files created successfully
- [ ] Health check script runs without errors: `./scripts/health-check.sh`
- [ ] README includes all sections and is properly formatted
- [ ] All markdown files have valid syntax

#### Manual Verification:
- [ ] Documentation is clear and easy to follow
- [ ] Testing guide covers all major scenarios
- [ ] Troubleshooting guide addresses common issues
- [ ] Architecture documentation accurately describes the system
- [ ] README provides a clear path from setup to testing
- [ ] All links in documentation work correctly

---

## Summary & Next Steps

### Milestone 1 Deliverables

Upon completion of all phases, you will have:

1. **Working WordPress Sandbox**
   - Docker-based WordPress + MySQL environment
   - WP-CLI integration for management
   - phpMyAdmin for database inspection

2. **WordPress MCP Integration**
   - WordPress Abilities API installed
   - MCP Adapter plugin active
   - Custom MCP server configuration
   - REST API endpoints exposed

3. **Claude Desktop Integration**
   - Claude Desktop configured to connect
   - Application Password authentication
   - Full CRUD operations on WordPress content

4. **Complete Documentation**
   - Setup guides
   - Testing procedures
   - Troubleshooting resources
   - Architecture documentation

5. **Automation Scripts**
   - One-command setup
   - MCP installation automation
   - Configuration generators
   - Health check utilities

### Success Validation

The milestone is complete when:

1. You can run `./scripts/setup.sh` on a fresh machine and get a working WordPress
2. You can run `./scripts/install-mcp.sh` and successfully configure MCP
3. You can open Claude Desktop and successfully:
   - List WordPress posts
   - Create a new post with custom title and content
   - Read an existing post
   - Update a post's content
   - All operations reflect correctly in WordPress admin

4. All documentation is complete and tested
5. A newcomer can follow the README and get the POC running

### Transition to Milestone 2

After validating Milestone 1, the next phase will focus on:

**Milestone 2: Custom MCP Client Development**

**Goal**: Replace Claude Desktop with a custom-built MCP client that provides:
- Programmatic control over MCP operations
- Custom UI for WordPress editing
- Foundation for SaaS integration

**Key Changes**:
- Build Node.js/TypeScript MCP client using `@modelcontextprotocol/sdk`
- Create simple web interface for testing
- Implement conversation context management
- Add operation queuing and error handling
- Document the MCP client API

**Out of Scope for Milestone 2**:
- Production WordPress integration (still sandbox only)
- Full SaaS platform
- Multi-user authentication
- Production synchronization

This approach allows incremental validation while building towards the full system architecture described in `AI_Powered_WordPress_Editor_System_Design.md`.

---

## Timeline Estimate

For a developer familiar with Docker and WordPress:

- **Phase 1** (Docker Setup): 2-3 hours
- **Phase 2** (MCP Installation): 3-4 hours
- **Phase 3** (Claude Desktop Config): 1-2 hours
- **Phase 4** (Documentation & Testing): 2-3 hours

**Total**: ~8-12 hours for complete Milestone 1

Factors that may extend timeline:
- Unfamiliar with Docker/WordPress
- Debugging environment-specific issues
- Official MCP Adapter API changes (still in development)
- Custom ability development

---

## Open Questions & Risks

### Questions to Resolve During Implementation

1. **WordPress Abilities API Installation**:
   - Is Composer the preferred method, or should we use a plugin zip?
   - What's the current stability of the Abilities API?

2. **MCP Adapter Maturity**:
   - What's the latest stable release?
   - Are there known bugs or limitations?
   - Is REST API transport production-ready?

3. **Claude Desktop MCP Support**:
   - What's the latest Claude Desktop version with MCP support?
   - Are there known issues with localhost connections?

### Technical Risks

1. **MCP Adapter is in Active Development**:
   - **Risk**: Breaking changes in MCP Adapter API
   - **Mitigation**: Pin specific commit/tag if needed; document version used
   - **Fallback**: Use Automattic's `@automattic/mcp-wordpress-remote` (more stable)

2. **WordPress Abilities API Not in Core**:
   - **Risk**: Composer installation complexity in Docker
   - **Mitigation**: Well-documented installation scripts; fallback to manual installation
   - **Future**: May be merged into WordPress core

3. **Application Password Security**:
   - **Risk**: Less secure than OAuth for POC
   - **Mitigation**: Acceptable for local development; document for Milestone 2 upgrade
   - **Note**: .mcp-credentials is gitignored

4. **Docker Performance on macOS**:
   - **Risk**: Slow I/O on bind mounts (wp-content)
   - **Mitigation**: Use named volumes for core files; bind mount only development directories
   - **Alternative**: Docker Desktop with VirtioFS enabled

### Dependency Risks

| Dependency | Version | Stability | Risk Level | Mitigation |
|------------|---------|-----------|------------|------------|
| Docker | 24.0+ | Stable | Low | Well-established |
| WordPress | 6.4+ | Stable | Low | LTS version |
| MariaDB | 10.6 | Stable | Low | Mature database |
| Abilities API | dev-main | Beta | Medium | Pin commit; may need updates |
| MCP Adapter | main branch | Alpha/Beta | High | Consider Automattic alternative |
| Claude Desktop | Latest | Stable (MCP feature) | Medium | Document version compatibility |

---

## References & Resources

### Official Documentation
- [WordPress MCP Adapter](https://github.com/WordPress/mcp-adapter)
- [WordPress Abilities API](https://github.com/WordPress/abilities-api)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Docker Hub: WordPress](https://hub.docker.com/_/wordpress)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/model-context-protocol)

### Community Resources
- [Automattic MCP WordPress Remote](https://github.com/Automattic/mcp-wordpress-remote)
- [InstaWP MCP Server](https://github.com/InstaWP/mcp-wp)
- [WordPress REST API Documentation](https://developer.wordpress.org/rest-api/)

### Related Project Files
- System Design: `AI_Powered_WordPress_Editor_System_Design.md`
- This Plan: `thoughts/shared/plans/2025-10-11-milestone-1-wordpress-mcp-poc.md`

---

**Document Version**: 1.0
**Created**: October 11, 2025
**Status**: Ready for Implementation
**Next Review**: After Phase 2 completion
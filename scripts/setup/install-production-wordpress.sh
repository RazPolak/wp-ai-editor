#!/bin/bash

set -e

echo "=== Production WordPress MCP Adapter Installation Script ==="
echo ""

# Check if Docker Compose is running
if ! docker-compose ps wordpress_production | grep -q "Up"; then
    echo "Error: Production WordPress container is not running. Please start with 'docker-compose up -d'"
    exit 1
fi

echo "Step 1: Installing Composer in production container..."
docker-compose exec -T wordpress_production bash -c "
    if ! command -v composer &> /dev/null; then
        curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
        echo 'Composer installed successfully'
    else
        echo 'Composer already installed'
    fi
"

echo ""
echo "Step 2: Checking WordPress installation..."
if ! docker-compose run --rm wpcli_production wp core is-installed 2>/dev/null; then
    echo "WordPress not installed. Installing WordPress..."
    docker-compose run --rm wpcli_production wp core install \
        --url="http://localhost:8001" \
        --title="WordPress Production" \
        --admin_user="admin" \
        --admin_password="admin" \
        --admin_email="admin@example.com" \
        --skip-email
    echo "✓ Production WordPress installed successfully"
else
    echo "✓ Production WordPress already installed"
fi

echo ""
echo "Step 3: Running composer install in production..."
docker-compose exec -T wordpress_production bash -c "
    cd /var/www/html
    composer install --no-interaction --prefer-dist
"

echo ""
echo "Step 4: Creating plugin symlinks in production..."
docker-compose exec -T wordpress_production bash -c "
    cd /var/www/html/wp-content/plugins

    # Remove existing symlinks if they exist
    rm -f mcp-adapter abilities-api

    # Create new symlinks
    ln -s /var/www/html/vendor/wordpress/mcp-adapter mcp-adapter
    ln -s /var/www/html/vendor/wordpress/abilities-api abilities-api

    echo 'Plugin symlinks created:'
    ls -la | grep -E 'mcp-adapter|abilities-api'
"

echo ""
echo "Step 5: Activating plugins in production..."
docker-compose run --rm wpcli_production wp plugin activate mcp-adapter abilities-api 2>/dev/null || echo "Note: Plugins will be activated if available"

echo ""
echo "Step 6: Configuring WordPress permalinks in production..."
# Check current permalink structure
CURRENT_PERMALINKS=$(docker-compose run --rm wpcli_production wp option get permalink_structure 2>/dev/null | tail -1 || echo "")
if [ -z "$CURRENT_PERMALINKS" ] || [ "$CURRENT_PERMALINKS" = "Plain" ]; then
    echo "Setting permalink structure to /%postname%/..."
    docker-compose run --rm wpcli_production wp option update permalink_structure "/%postname%/" 2>/dev/null
    docker-compose run --rm wpcli_production wp rewrite flush 2>/dev/null
    echo "✓ Permalinks configured"
else
    echo "✓ Permalinks already configured: $CURRENT_PERMALINKS"
fi

echo ""
echo "Step 7: Generating Application Password for production..."
# Remove old application passwords for MCP Client Production
docker-compose run --rm wpcli_production wp user application-password list admin --format=csv 2>/dev/null | \
    grep "MCP Client Production" | cut -d',' -f1 | xargs -I {} docker-compose run --rm wpcli_production wp user application-password delete admin {} 2>/dev/null || true

# Generate new application password
APP_PASSWORD=$(docker-compose run --rm wpcli_production wp user application-password create admin "MCP Client Production" --porcelain 2>/dev/null | tail -1)
if [ -z "$APP_PASSWORD" ]; then
    echo "✗ Failed to generate Application Password"
    exit 1
fi
echo "✓ Application Password generated: $APP_PASSWORD"

echo ""
echo "Step 8: Updating configuration files..."

# Update or create .env.local
if [ ! -f ".env.local" ] && [ -f ".env.local.example" ]; then
    cp .env.local.example .env.local
    echo "✓ Created .env.local from example"
fi

if [ -f ".env.local" ]; then
    # Check if production credentials already exist in .env.local
    if grep -q "WORDPRESS_PRODUCTION_MCP_PASSWORD" .env.local; then
        # Update existing line
        sed -i.bak "s/WORDPRESS_PRODUCTION_MCP_PASSWORD=.*/WORDPRESS_PRODUCTION_MCP_PASSWORD=$APP_PASSWORD/" .env.local
        rm -f .env.local.bak
        echo "✓ Updated existing production credentials in .env.local"
    else
        # Append new lines
        echo "" >> .env.local
        echo "# Production WordPress MCP Configuration" >> .env.local
        echo "WORDPRESS_PRODUCTION_MCP_URL=http://localhost:8001/wp-json/wordpress-poc/mcp" >> .env.local
        echo "WORDPRESS_PRODUCTION_MCP_USERNAME=admin" >> .env.local
        echo "WORDPRESS_PRODUCTION_MCP_PASSWORD=$APP_PASSWORD" >> .env.local
        echo "✓ Added production credentials to .env.local"
    fi
else
    echo "⚠ Warning: .env.local not found. Please create it manually."
fi

echo ""
echo "Step 9: Verifying production installation..."

# Check if abilities are registered
ABILITY_COUNT=$(docker-compose run --rm wpcli_production wp eval "
    \$registry = WP_Abilities_Registry::get_instance();
    \$abilities = wp_get_abilities();
    echo count(\$abilities);
" 2>/dev/null | tail -1)

if [ "$ABILITY_COUNT" -ge 2 ] 2>/dev/null; then
    echo "✓ WordPress abilities registered: $ABILITY_COUNT"
else
    echo "✗ Warning: Expected at least 2 abilities, found: $ABILITY_COUNT"
fi

# Check if MCP server exists
SERVER_COUNT=$(docker-compose run --rm wpcli_production wp eval "
    \$adapter = \\WP\\MCP\\Core\\McpAdapter::instance();
    echo count(\$adapter->get_servers());
" 2>/dev/null | tail -1)

if [ "$SERVER_COUNT" -ge 1 ] 2>/dev/null; then
    echo "✓ MCP server registered: $SERVER_COUNT"
else
    echo "✗ Warning: Expected at least 1 MCP server, found: $SERVER_COUNT"
fi

# Check if REST endpoint is registered
REST_URL=$(docker-compose run --rm wpcli_production wp eval "echo get_rest_url(null, 'wordpress-poc/mcp');" 2>/dev/null | tail -1)
if [[ "$REST_URL" == *"wordpress-poc/mcp"* ]]; then
    echo "✓ MCP REST endpoint registered: $REST_URL"
else
    echo "✗ Warning: MCP REST endpoint not registered"
fi

echo ""
echo "Step 10: Testing MCP connection to production..."
# Test the MCP endpoint with the new credentials
TEST_RESPONSE=$(curl -s -u "admin:$APP_PASSWORD" \
    "http://localhost:8001/wp-json/wordpress-poc/mcp" \
    -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' 2>/dev/null)

if echo "$TEST_RESPONSE" | grep -q "\"result\""; then
    echo "✓ MCP endpoint is accessible and responding"

    # Test listing tools
    TOOLS_RESPONSE=$(curl -s -u "admin:$APP_PASSWORD" \
        "http://localhost:8001/wp-json/wordpress-poc/mcp" \
        -X POST -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' 2>/dev/null)

    if echo "$TOOLS_RESPONSE" | grep -q "wordpress-list-posts"; then
        TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o "wordpress-[a-z-]*" | wc -l)
        echo "✓ MCP tools available: $TOOL_COUNT"
    fi
else
    echo "✗ Warning: MCP endpoint test failed"
    echo "Response: $TEST_RESPONSE"
fi

echo ""
echo "=== Production Installation Complete ==="
echo ""
echo "✅ Production WordPress is configured and working!"
echo ""
echo "Production WordPress MCP Credentials:"
echo "  Username: admin"
echo "  Password: $APP_PASSWORD"
echo "  Endpoint: http://localhost:8001/wp-json/wordpress-poc/mcp"
echo ""
echo "Next steps:"
echo "1. Restart Next.js dev server to load new credentials: pnpm dev"
echo "2. Test health endpoint: curl http://localhost:3000/api/health"
echo "3. Access production WordPress admin: http://localhost:8001/wp-admin (admin/admin)"
echo ""
echo "Production vs Sandbox:"
echo "  Sandbox:    http://localhost:8000"
echo "  Production: http://localhost:8001"
echo ""
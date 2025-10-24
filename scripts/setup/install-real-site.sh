#!/bin/bash

# Real Site Mimic Installation Script
# Run this from the host machine to set up the realistic ecommerce store

set -e

echo "=== Real Site Mimic Installation ==="
echo ""
echo "This script will:"
echo "  1. Start the Real Site Mimic WordPress instance (port 8002)"
echo "  2. Automatically install WooCommerce + Storefront theme"
echo "  3. Import ~250 realistic products from Glover dataset"
echo "  4. Configure MCP adapter for AI agent testing"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "✗ Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Start the real site services
echo "Step 1: Starting Real Site Mimic services..."
docker-compose up -d wordpress_real_site wpcli_real_site
echo "✓ Services started"

echo ""
echo "Step 2: Waiting for WordPress to be ready..."
for i in {1..60}; do
    if docker-compose exec -T wordpress_real_site curl -sf http://localhost > /dev/null 2>&1; then
        echo "✓ WordPress is ready"
        break
    fi
    echo "  Waiting for WordPress... ($i/60)"
    sleep 2
done

# Run the initialization script inside the WP-CLI container (which has wp command)
# Run as root to allow installing Composer and other system-level setup
echo ""
echo "Step 3: Running initialization script (this may take 5-10 minutes)..."
echo "  - Installing WordPress"
echo "  - Installing WooCommerce"
echo "  - Downloading ~250 product dataset"
echo "  - Importing products with images"
echo "  - Configuring MCP adapter"
echo ""

docker-compose run --rm --user=0 wpcli_real_site bash /usr/local/bin/init-real-site.sh

# Extract the MCP credentials
echo ""
echo "Step 4: Extracting MCP credentials..."
APP_PASSWORD=$(docker-compose run --rm wpcli_real_site wp user application-password list admin --format=csv --allow-root 2>/dev/null | \
    grep "MCP Client Real Site" | cut -d',' -f3 | head -1)

if [ -n "$APP_PASSWORD" ]; then
    echo "✓ MCP credentials retrieved"

    # Update .env.local
    if [ ! -f ".env.local" ] && [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo "✓ Created .env.local from example"
    fi

    if [ -f ".env.local" ]; then
        # Check if real site credentials already exist
        if grep -q "WORDPRESS_REAL_SITE_MCP_PASSWORD" .env.local; then
            # Update existing line
            sed -i.bak "s/WORDPRESS_REAL_SITE_MCP_PASSWORD=.*/WORDPRESS_REAL_SITE_MCP_PASSWORD=$APP_PASSWORD/" .env.local
            rm -f .env.local.bak
            echo "✓ Updated existing real site credentials in .env.local"
        else
            # Append new lines
            echo "" >> .env.local
            echo "# Real Site Mimic MCP Configuration" >> .env.local
            echo "WORDPRESS_REAL_SITE_MCP_URL=http://localhost:8002/wp-json/wordpress-poc/mcp" >> .env.local
            echo "WORDPRESS_REAL_SITE_MCP_USERNAME=admin" >> .env.local
            echo "WORDPRESS_REAL_SITE_MCP_PASSWORD=$APP_PASSWORD" >> .env.local
            echo "✓ Added real site credentials to .env.local"
        fi
    fi
fi

# Get product count
PRODUCT_COUNT=$(docker-compose run --rm wpcli_real_site wp post list --post_type=product --format=count --allow-root 2>/dev/null | tail -1)

echo ""
echo "=== Real Site Mimic Installation Complete ==="
echo ""
echo "✅ Your realistic ecommerce store is ready for AI agent testing!"
echo ""
echo "Store Statistics:"
echo "  Products imported: $PRODUCT_COUNT"
echo "  Theme: Storefront (official WooCommerce theme)"
echo "  Sample data: Glover Ventures large dataset"
echo ""
echo "Access Points:"
echo "  🌐 Frontend:    http://localhost:8002"
echo "  🔧 Admin:       http://localhost:8002/wp-admin (admin/admin)"
echo "  🤖 MCP Endpoint: http://localhost:8002/wp-json/wordpress-poc/mcp"
echo ""
echo "All WordPress Instances:"
echo "  Sandbox:     http://localhost:8000 (development/testing)"
echo "  Production:  http://localhost:8001 (staging)"
echo "  Real Site:   http://localhost:8002 (realistic ecommerce) ← NEW"
echo ""
echo "Next Steps:"
echo "1. Visit http://localhost:8002 to see your realistic store"
echo "2. Restart Next.js dev server to load new credentials: pnpm dev"
echo "3. Test your AI agent with prompts like:"
echo "   - 'List all products in the store'"
echo "   - 'Show me products under \$50'"
echo "   - 'Create a new product called...'"
echo ""
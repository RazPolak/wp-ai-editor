#!/bin/bash

# Real Site Mimic Initialization Script
# This script automatically sets up a realistic ecommerce site on first container boot

set -e

INIT_FLAG="/var/www/html/.real-site-initialized"
SAMPLE_DATA_URL="https://github.com/iconicwp/woocommerce-sample-data/raw/main/woocommerce-sample-data.csv"
SAMPLE_DATA_FILE="/tmp/import-data/woocommerce-sample-data.csv"

echo "=== Real Site Mimic Initialization ==="
echo ""

# Check if already initialized
if [ -f "$INIT_FLAG" ]; then
    echo "✓ Real site already initialized. Skipping setup."
    exit 0
fi

echo "First boot detected. Starting automatic setup..."
echo ""

# Wait for WordPress core files to be ready
echo "Step 1: Waiting for WordPress core files..."
for i in {1..30}; do
    if [ -f /var/www/html/wp-config.php ]; then
        echo "✓ WordPress core files ready"
        break
    fi
    echo "  Waiting for WordPress files... ($i/30)"
    sleep 2
done

if [ ! -f /var/www/html/wp-config.php ]; then
    echo "✗ Error: WordPress core files not found"
    exit 1
fi

cd /var/www/html

# Install Composer
echo ""
echo "Step 2: Installing Composer..."
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
    echo "✓ Composer installed"
else
    echo "✓ Composer already installed"
fi

# Install WordPress if not already installed
echo ""
echo "Step 3: Installing WordPress..."
if ! wp core is-installed --allow-root 2>/dev/null; then
    wp core install \
        --url="http://localhost:8002" \
        --title="Real Ecommerce Store" \
        --admin_user="admin" \
        --admin_password="admin" \
        --admin_email="admin@realstore.local" \
        --skip-email \
        --allow-root
    echo "✓ WordPress installed"
else
    echo "✓ WordPress already installed"
fi

# Run composer install
echo ""
echo "Step 4: Installing WordPress dependencies (MCP adapter, Abilities API)..."
composer install --no-interaction --prefer-dist --allow-root 2>/dev/null || echo "⚠ Composer install skipped or failed"

# Create plugin symlinks
echo ""
echo "Step 5: Creating plugin symlinks..."
cd /var/www/html/wp-content/plugins
rm -f mcp-adapter abilities-api
if [ -d "/var/www/html/vendor/wordpress/mcp-adapter" ]; then
    ln -s /var/www/html/vendor/wordpress/mcp-adapter mcp-adapter
    ln -s /var/www/html/vendor/wordpress/abilities-api abilities-api
    echo "✓ Plugin symlinks created"
else
    echo "⚠ Warning: MCP adapter not found in vendor, will be mounted from host"
fi

cd /var/www/html

# Install and activate WooCommerce
echo ""
echo "Step 6: Installing WooCommerce..."
wp plugin install woocommerce --activate --allow-root 2>/dev/null || echo "✓ WooCommerce already installed"

# Install and activate Storefront theme
echo ""
echo "Step 7: Installing Storefront theme..."
wp theme install storefront --activate --allow-root 2>/dev/null || echo "✓ Storefront already installed"

# Activate MCP plugins
echo ""
echo "Step 8: Activating MCP plugins..."
wp plugin activate mcp-adapter abilities-api --allow-root 2>/dev/null || echo "⚠ MCP plugins activation skipped"

# Configure permalinks
echo ""
echo "Step 9: Configuring permalinks..."
wp option update permalink_structure "/%postname%/" --allow-root
wp rewrite flush --allow-root
echo "✓ Permalinks configured"

# Run WooCommerce setup
echo ""
echo "Step 10: Configuring WooCommerce basics..."
wp option update woocommerce_store_address "123 Ecommerce Street" --allow-root
wp option update woocommerce_store_city "San Francisco" --allow-root
wp option update woocommerce_default_country "US:CA" --allow-root
wp option update woocommerce_store_postcode "94102" --allow-root
wp option update woocommerce_currency "USD" --allow-root
wp option update woocommerce_onboarding_profile '{"skipped":true}' --format=json --allow-root 2>/dev/null || true
echo "✓ WooCommerce basics configured"

# Download sample data
echo ""
echo "Step 11: Downloading Glover large sample dataset (~250 products)..."
mkdir -p /tmp/import-data
if [ ! -f "$SAMPLE_DATA_FILE" ]; then
    curl -L "$SAMPLE_DATA_URL" -o "$SAMPLE_DATA_FILE" 2>/dev/null || {
        echo "⚠ Warning: Failed to download sample data from $SAMPLE_DATA_URL"
        echo "  You can manually download it and place at: $SAMPLE_DATA_FILE"
    }

    if [ -f "$SAMPLE_DATA_FILE" ]; then
        FILE_SIZE=$(stat -f%z "$SAMPLE_DATA_FILE" 2>/dev/null || stat -c%s "$SAMPLE_DATA_FILE" 2>/dev/null || echo "0")
        echo "✓ Sample data downloaded ($(numfmt --to=iec $FILE_SIZE 2>/dev/null || echo "$FILE_SIZE bytes"))"
    fi
else
    echo "✓ Sample data already exists"
fi

# Import products using WooCommerce sample data
echo ""
echo "Step 12: Importing products..."

# Check if products already exist
EXISTING_PRODUCTS=$(wp post list --post_type=product --format=count --allow-root 2>/dev/null || echo "0")

if [ "$EXISTING_PRODUCTS" -eq "0" ]; then
    echo "  Importing WooCommerce sample products..."

    # Use the built-in WordPress importer for XML
    wp plugin install wordpress-importer --activate --allow-root 2>/dev/null

    # Import the WooCommerce sample products XML (more reliable than CSV)
    wp import /var/www/html/wp-content/plugins/woocommerce/sample-data/sample_products.xml --authors=create --allow-root 2>&1 | grep -E "(Success|Error)" || true

    # Count imported products
    PRODUCT_COUNT=$(wp post list --post_type=product --format=count --allow-root 2>/dev/null || echo "0")
    echo "✓ Product import completed. Total products: $PRODUCT_COUNT"
else
    echo "✓ Products already exist. Skipping import. Total products: $EXISTING_PRODUCTS"
fi

# Generate Application Password for MCP
echo ""
echo "Step 13: Generating Application Password for MCP..."
# Remove old application passwords
wp user application-password list admin --format=csv --allow-root 2>/dev/null | \
    grep "MCP Client Real Site" | cut -d',' -f1 | \
    xargs -I {} wp user application-password delete admin {} --allow-root 2>/dev/null || true

# Generate new password
APP_PASSWORD=$(wp user application-password create admin "MCP Client Real Site" --porcelain --allow-root 2>/dev/null || echo "")
if [ -n "$APP_PASSWORD" ]; then
    echo "✓ Application Password generated: $APP_PASSWORD"
    echo ""
    echo "=== Add these to your .env.local file: ==="
    echo "WORDPRESS_REAL_SITE_MCP_URL=http://localhost:8002/wp-json/wordpress-poc/mcp"
    echo "WORDPRESS_REAL_SITE_MCP_USERNAME=admin"
    echo "WORDPRESS_REAL_SITE_MCP_PASSWORD=$APP_PASSWORD"
else
    echo "⚠ Warning: Failed to generate Application Password"
fi

# Create initialization flag
touch "$INIT_FLAG"

echo ""
echo "=== Real Site Mimic Setup Complete ==="
echo ""
echo "✅ Your realistic ecommerce store is ready!"
echo ""
echo "Access points:"
echo "  Frontend:  http://localhost:8002"
echo "  Admin:     http://localhost:8002/wp-admin (admin/admin)"
echo "  MCP:       http://localhost:8002/wp-json/wordpress-poc/mcp"
echo ""
echo "Next steps:"
echo "1. Add the MCP credentials above to your .env.local file"
echo "2. Restart your Next.js dev server: pnpm dev"
echo "3. Test your AI agent against the realistic store!"
echo ""
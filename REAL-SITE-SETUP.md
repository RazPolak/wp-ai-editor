# Real Site Mimic - Realistic Ecommerce Testing Environment

A pre-configured WordPress + WooCommerce instance with ~250 realistic products for comprehensive AI agent testing.

## Overview

The **Real Site Mimic** is a separate Docker service that automatically sets up a production-like ecommerce store with:

- **WooCommerce** ecommerce plugin
- **Storefront** theme (official WooCommerce theme)
- **~250 realistic products** with images, categories, attributes
- **Variable and simple products** (over 2,000 SKUs)
- **MCP adapter** pre-configured for AI agent integration

## Why Use Real Site Mimic?

Testing your AI agent against a realistic store helps you:

1. **Test at scale** - ~250 products vs the default 25 sample products
2. **Validate complex queries** - Product variations, attributes, filtering
3. **Mimic production** - Real product names/descriptions for natural language testing
4. **Edge case discovery** - Variable products, out of stock items, sale prices
5. **Performance testing** - Understand agent behavior with production-like data volume

## Quick Start

### One-Command Setup

```bash
# Start and configure everything automatically
./scripts/setup/install-real-site.sh
```

This script will:
- Start the Real Site Mimic instance on port 8002
- Install WordPress, WooCommerce, and Storefront theme
- Download and import the Glover Ventures dataset (~250 products)
- Configure the MCP adapter for AI integration
- Update your `.env.local` with MCP credentials

**Setup time:** ~5-10 minutes (most time is downloading/importing products)

### Manual Setup

If you prefer manual control:

```bash
# Start the services
docker-compose up -d wordpress_real_site wpcli_real_site

# Wait for WordPress to be ready (check http://localhost:8002)
# The init script runs automatically on first boot

# Check initialization progress
docker-compose logs -f wordpress_real_site

# Get MCP credentials when ready
docker-compose run --rm wpcli_real_site wp user application-password list admin --allow-root
```

## Access Points

Once setup is complete:

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:8002 | - |
| Admin | http://localhost:8002/wp-admin | admin/admin |
| MCP Endpoint | http://localhost:8002/wp-json/wordpress-poc/mcp | Check `.env.local` |

## All WordPress Instances

Your project now has three WordPress environments:

| Instance | Port | Purpose | Products |
|----------|------|---------|----------|
| **Sandbox** | 8000 | Development/testing | Empty |
| **Production** | 8001 | Staging | Empty |
| **Real Site** | 8002 | Realistic testing | ~250 products |

## Dataset Details

**Source:** Glover Ventures Large Sample Dataset

**Contents:**
- ~200 variable products (2,000+ SKUs with color/size variations)
- ~50 simple products
- Real product data (sourced from Magento, minimal lorem ipsum)
- Product categories and attributes
- Product images
- Realistic pricing with sales prices

**Product Types:**
- Clothing with size/color variations
- Electronics
- Home goods
- Accessories

## Testing Your AI Agent

Example prompts to test against the real site:

```bash
# List all products
curl -X POST http://localhost:3000/api/agents/wordpress/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List all products in the store"}' \
  --no-buffer

# Filter by price
curl -X POST http://localhost:3000/api/agents/wordpress/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me all products under $50"}' \
  --no-buffer

# Search by attributes
curl -X POST http://localhost:3000/api/agents/wordpress/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find all blue t-shirts in size large"}' \
  --no-buffer

# Complex queries
curl -X POST http://localhost:3000/api/agents/wordpress/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What are the top 5 most expensive products on sale?"}' \
  --no-buffer
```

## Configuration

### Environment Variables

Add these to your `.env.local` (auto-added by install script):

```bash
WORDPRESS_REAL_SITE_MCP_URL=http://localhost:8002/wp-json/wordpress-poc/mcp
WORDPRESS_REAL_SITE_MCP_USERNAME=admin
WORDPRESS_REAL_SITE_MCP_PASSWORD=<generated-password>
```

### Docker Resources

The real site uses separate Docker volumes:
- `db_real_site_data` - Database
- `wp_real_site_data` - WordPress files
- `wp_real_site_vendor` - Composer dependencies

### WP-CLI Access

```bash
# Access WP-CLI for the real site
docker-compose run --rm wpcli_real_site wp <command> --allow-root

# Examples:
docker-compose run --rm wpcli_real_site wp post list --post_type=product --allow-root
docker-compose run --rm wpcli_real_site wp wc product list --allow-root
```

## Customization

### Adding More Products

1. Place CSV file in `./data/` directory
2. Import using WP-CLI:
```bash
docker-compose run --rm wpcli_real_site wp wc product import /tmp/import-data/your-file.csv --user=1 --allow-root
```

### Changing Theme

```bash
# Install a different theme
docker-compose run --rm wpcli_real_site wp theme install <theme-name> --activate --allow-root
```

### Resetting the Store

To start fresh:

```bash
# Remove volumes (this deletes all data)
docker-compose down -v

# Start again
./scripts/setup/install-real-site.sh
```

## Troubleshooting

### Products Not Imported

If you see 0 products after setup:

1. Check if sample data was downloaded:
```bash
ls -lh data/woocommerce-sample-data.csv
```

2. Manually download and import:
```bash
# Download
curl -L https://glover.us/large-sample-data-set.csv -o data/woocommerce-sample-data.csv

# Import
docker-compose run --rm wpcli_real_site wp wc product import /tmp/import-data/woocommerce-sample-data.csv --user=1 --allow-root
```

### Real Site Won't Start

```bash
# Check logs
docker-compose logs wordpress_real_site

# Restart services
docker-compose restart wordpress_real_site db_real_site
```

### MCP Connection Failed

1. Regenerate Application Password:
```bash
docker-compose run --rm wpcli_real_site wp user application-password create admin "MCP Client Real Site" --porcelain --allow-root
```

2. Update `.env.local` with new password
3. Restart Next.js dev server: `pnpm dev`

### Port 8002 Already in Use

Edit `docker-compose.yml` and change the port mapping:
```yaml
wordpress_real_site:
  ports:
    - "8003:80"  # Changed from 8002
```

## Performance Considerations

- **Initial setup:** 5-10 minutes (one-time)
- **Container startup:** ~30 seconds
- **Product queries:** Same as production
- **Disk space:** ~2GB for products + images
- **Memory:** ~512MB for WordPress container

## Architecture

```
┌─────────────────────────────────────────┐
│  docker-compose.yml                     │
│                                         │
│  ┌────────────────┐  ┌───────────────┐ │
│  │ db_real_site   │  │ wordpress_    │ │
│  │ (MariaDB)      │──│ real_site     │ │
│  │ Port: internal │  │ Port: 8002    │ │
│  └────────────────┘  └───────────────┘ │
│                            │            │
│                      Auto-runs on boot  │
│                            ↓            │
│                   init-real-site.sh     │
│                            │            │
│                      ┌─────┴─────┐     │
│                      │           │     │
│                  Download    Install   │
│                  Products   Plugins    │
│                      │           │     │
│                      └─────┬─────┘     │
│                            ↓            │
│                   Configured Store      │
│                   + MCP Adapter         │
└─────────────────────────────────────────┘
```

## Advanced Usage

### Custom Product Categories

```bash
# Create custom category
docker-compose run --rm wpcli_real_site wp wc product_cat create \
  --name="Custom Category" \
  --slug="custom" \
  --user=1 \
  --allow-root
```

### Bulk Update Products

```bash
# Put all products on sale
docker-compose run --rm wpcli_real_site wp wc product list --format=ids --allow-root | \
  xargs -I {} docker-compose run --rm wpcli_real_site wp wc product update {} --sale_price=29.99 --user=1 --allow-root
```

### Export Current State

```bash
# Export database
docker-compose exec db_real_site mysqldump -u wordpress -pwordpress wordpress > real-site-backup.sql

# Import later
docker-compose exec -T db_real_site mysql -u wordpress -pwordpress wordpress < real-site-backup.sql
```

## Related Documentation

- [Main README](./README.md) - Project overview
- [MCP Setup](./MCP-SETUP.md) - MCP adapter details
- [Glover Dataset](https://glover.us/blog/woocommerce-sample-data-set/) - Sample data source

## License

Same as main project.
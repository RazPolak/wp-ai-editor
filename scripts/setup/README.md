# Setup Scripts

Scripts for installing and configuring the WordPress AI Editor environment.

## Scripts

### `install-mcp-adapter.sh`

**Purpose**: Main installation script for WordPress MCP adapter

**Prerequisites**:
- Docker and Docker Compose installed
- WordPress container running (`docker-compose up -d`)

**What it does**:
1. Installs Composer in WordPress container
2. Runs `composer install` to install PHP dependencies:
   - `wordpress/mcp-adapter`
   - `wordpress/abilities-api`
3. Creates plugin symlinks in `wp-content/plugins/`
4. Verifies installation:
   - Checks WordPress abilities registration
   - Checks MCP server registration
   - Tests REST endpoint availability
5. Displays next steps for configuration

**Usage**:
```bash
./scripts/setup/install-mcp-adapter.sh
```

**Expected Output**:
```
=== WordPress MCP Adapter Installation Script ===

Step 1: Installing Composer in container...
✓ Composer installed successfully

Step 2: Running composer install...
✓ Dependencies installed

Step 3: Creating plugin symlinks...
✓ Plugin symlinks created

Step 4: Verifying installation...
✓ WordPress abilities registered: 5
✓ MCP server registered: 1
✓ MCP REST endpoint available

=== Installation Complete ===

Next steps:
1. Generate application password
2. Test MCP endpoint
3. Configure environment variables
```

**Troubleshooting**:

| Issue | Solution |
|-------|----------|
| "WordPress container is not running" | Run `docker-compose up -d` |
| "Composer install failed" | Check network connectivity, try again |
| "Abilities not registered" | Check `wp-content/mu-plugins/register-wordpress-abilities.php` |
| "MCP endpoint not found" | Restart WordPress: `docker-compose restart wordpress` |

**Environment Variables Used**:
- None (operates directly on Docker containers)

**Files Modified**:
- `/var/www/html/vendor/` (Composer packages)
- `/var/www/html/wp-content/plugins/mcp-adapter` (symlink)
- `/var/www/html/wp-content/plugins/abilities-api` (symlink)

**Dependencies**:
- Docker Compose
- curl (for verification)
- WordPress CLI wrapper (`scripts/wordpress/wp-cli.sh`)

**Related Documentation**:
- [Main README](../../README.md)
- [MCP Setup Guide](../../MCP-SETUP.md)
- [Technical Design](../../TECHNICAL_DESIGN.md#21-wordpress-mcp-server)
# WordPress Scripts

Utilities for interacting with WordPress via command line.

## Scripts

### `wp-cli.sh`

**Purpose**: Wrapper script for executing WP-CLI commands in Docker container

**Description**:
This script provides convenient access to WP-CLI (WordPress Command Line Interface) without needing to manually invoke docker-compose. All WP-CLI commands can be executed through this wrapper.

**Usage**:
```bash
./scripts/wordpress/wp-cli.sh <wp-cli-command> [args...]
```

**Examples**:

#### List all plugins
```bash
./scripts/wordpress/wp-cli.sh plugin list
```

#### List all posts
```bash
./scripts/wordpress/wp-cli.sh post list
```

#### Create a new post
```bash
./scripts/wordpress/wp-cli.sh post create \
  --post_title="Test Post" \
  --post_content="This is test content" \
  --post_status=publish
```

#### Generate application password
```bash
./scripts/wordpress/wp-cli.sh user application-password create admin "MCP Client" --porcelain
```

#### Check WordPress version
```bash
./scripts/wordpress/wp-cli.sh core version
```

#### Flush rewrite rules
```bash
./scripts/wordpress/wp-cli.sh rewrite flush
```

#### Export database
```bash
./scripts/wordpress/wp-cli.sh db export backup.sql
```

#### Run arbitrary PHP code
```bash
./scripts/wordpress/wp-cli.sh eval "echo get_bloginfo('name');"
```

## Common WP-CLI Commands

### Posts and Pages
```bash
# List posts
./scripts/wordpress/wp-cli.sh post list

# Get post details
./scripts/wordpress/wp-cli.sh post get 123

# Delete post
./scripts/wordpress/wp-cli.sh post delete 123

# List pages
./scripts/wordpress/wp-cli.sh post list --post_type=page
```

### Plugins
```bash
# List plugins
./scripts/wordpress/wp-cli.sh plugin list

# Activate plugin
./scripts/wordpress/wp-cli.sh plugin activate my-plugin

# Deactivate plugin
./scripts/wordpress/wp-cli.sh plugin deactivate my-plugin
```

### Users
```bash
# List users
./scripts/wordpress/wp-cli.sh user list

# Create user
./scripts/wordpress/wp-cli.sh user create bob bob@example.com --role=editor

# List application passwords
./scripts/wordpress/wp-cli.sh user application-password list admin
```

### Database
```bash
# Check database
./scripts/wordpress/wp-cli.sh db check

# Optimize database
./scripts/wordpress/wp-cli.sh db optimize

# Search and replace
./scripts/wordpress/wp-cli.sh search-replace 'old-url' 'new-url'
```

### Cache and Transients
```bash
# Flush cache
./scripts/wordpress/wp-cli.sh cache flush

# Delete transients
./scripts/wordpress/wp-cli.sh transient delete --all
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Error: Cannot connect to container" | Ensure WordPress container is running: `docker-compose ps` |
| "Command not found" | Verify WP-CLI is available in container: `docker-compose run --rm wpcli wp --version` |
| Permission errors | Script uses `--rm` flag, no persistence needed |

## Technical Details

**Implementation**:
```bash
#!/bin/bash
docker-compose run --rm wpcli wp "$@"
```

**Container Used**: `wpcli` service from docker-compose.yml

**Arguments**: All arguments are passed directly to `wp` command

**Exit Codes**: Returns the same exit code as the underlying `wp` command

## Related Resources

- [WP-CLI Official Documentation](https://wp-cli.org/)
- [WP-CLI Command Reference](https://developer.wordpress.org/cli/commands/)
- [Docker Compose Configuration](../../docker-compose.yml)
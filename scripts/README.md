# Scripts Directory

This directory contains all scripts for setting up, managing, and testing the WordPress AI Editor.

## Directory Structure

```
scripts/
├── setup/          # Installation and configuration scripts
├── wordpress/      # WordPress-specific utilities
├── test/           # Testing and validation scripts
└── README.md       # This file
```

## Quick Start

### Initial Setup
```bash
# 1. Start Docker containers
docker-compose up -d

# 2. Install WordPress MCP adapter
./scripts/setup/install-mcp-adapter.sh

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your API keys

# 4. Run tests
pnpm test:schemas
pnpm test:agent
```

## Script Categories

### Setup Scripts (`setup/`)
Scripts for initial installation and configuration.
See [setup/README.md](setup/README.md) for details.

### WordPress Scripts (`wordpress/`)
Utilities for interacting with WordPress.
See [wordpress/README.md](wordpress/README.md) for details.

### Test Scripts (`test/`)
Scripts for testing and validation.
See [test/README.md](test/README.md) for details.

## Common Tasks

### Run all tests
```bash
pnpm test:all
```

### Execute WordPress CLI commands
```bash
./scripts/wordpress/wp-cli.sh plugin list
./scripts/wordpress/wp-cli.sh post list
```

### Check system health
```bash
curl http://localhost:3000/api/health
```

## Troubleshooting

If scripts fail:
1. Ensure Docker containers are running: `docker-compose ps`
2. Check WordPress is accessible: `curl http://localhost:8000`
3. Verify MCP adapter is installed: `./scripts/wordpress/wp-cli.sh plugin list`
4. Check logs: `docker-compose logs wordpress`
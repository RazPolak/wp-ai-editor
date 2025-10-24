#!/bin/bash

# Wrapper script for WP-CLI commands
docker-compose run --rm wpcli wp "$@"

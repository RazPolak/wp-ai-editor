<?php
/**
 * Plugin Name: Configure MCP Server
 * Description: Configures the official WordPress MCP Adapter
 * Version: 1.0.0
 */

// Configure MCP Server when adapter initializes
add_action('mcp_adapter_init', function($adapter) {
    error_log('mcp_adapter_init hook fired - creating MCP server');
    
    try {
        // Create an MCP server with correct class names and ability names
        $adapter->create_server(
            'wordpress-poc-server',                                              // Server ID
            'wordpress-poc',                                                     // Namespace
            'mcp',                                                              // Route
            'WordPress POC MCP Server',                                         // Name
            'MCP server for WordPress POC with official adapter',               // Description
            'v1.0.0',                                                          // Version
            [
                \WP\MCP\Transport\Http\RestTransport::class,                    // REST transport (for direct clients)
                \WP\MCP\Transport\Http\StreamableTransport::class,              // Streamable HTTP transport (for remote clients like Claude Desktop)
            ],
            \WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class, // Error handler
            \WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler::class, // Observability
            [
                // Register WordPress abilities as MCP tools (single-slash names only!)
                'wordpress/get-post',
                'wordpress/list-posts',
                'wordpress/create-post',
                'wordpress/update-post',
                'wordpress/delete-post',
            ]
        );
        
        error_log('✓ MCP server created successfully');
    } catch (\Exception $e) {
        error_log('✗ Failed to create MCP server: ' . $e->getMessage());
    }
}, 10, 1);

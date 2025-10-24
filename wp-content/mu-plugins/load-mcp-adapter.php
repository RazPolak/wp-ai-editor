<?php
/**
 * Plugin Name: Load MCP Adapter
 * Description: Loads Composer autoloader and initializes official WordPress MCP Adapter
 * Version: 1.0.0
 */

// Load Composer autoloader only if it exists
$autoload_path = ABSPATH . 'vendor/autoload.php';
if (file_exists($autoload_path)) {
    require_once $autoload_path;

    // Initialize everything on the 'init' hook to ensure WordPress is fully loaded
    add_action('init', function() {
        // Initialize the Abilities API Registry (triggers abilities_api_init hook)
        if (class_exists('\WP_Abilities_Registry')) {
            error_log('[MU-PLUGIN] Initializing Abilities Registry');
            \WP_Abilities_Registry::get_instance();
            error_log('[MU-PLUGIN] Abilities Registry initialized - abilities_api_init fired');
        }

        // Manually initialize the MCP Adapter plugin
        // This is needed because symlinked plugins might not auto-initialize properly
        if (class_exists('\WP\MCP\Plugin')) {
            error_log('[MU-PLUGIN] Initializing MCP Plugin manually');
            \WP\MCP\Plugin::instance();
            error_log('[MU-PLUGIN] MCP Plugin initialized');
        }
    }, 1);  // Priority 1 to run early but after WordPress init
} else {
    error_log('[MU-PLUGIN] Composer autoloader not found. Run: ./scripts/install-mcp-adapter.sh');
}

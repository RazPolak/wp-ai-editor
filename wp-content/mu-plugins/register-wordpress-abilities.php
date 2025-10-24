<?php
/**
 * Plugin Name: Register WordPress Abilities
 * Description: Registers WordPress abilities for MCP Adapter
 * Version: 1.0.0
 */

// Step 1: Register the category on the categories_init hook
add_action('abilities_api_categories_init', function() {
    error_log('[ABILITIES] Registering WordPress category...');

    $category = wp_register_ability_category('wordpress', [
        'label' => 'WordPress',
        'description' => 'WordPress content management abilities',
    ]);

    if ($category) {
        error_log('[ABILITIES] ✓ Registered category: wordpress');
    } else {
        error_log('[ABILITIES] ✗ Failed to register category: wordpress');
    }
}, 10);

// Step 2: Register the abilities on the abilities_api_init hook
add_action('abilities_api_init', function() {
    error_log('[ABILITIES] Registering WordPress abilities...');

    // Register a simple "get post" ability
    // NOTE: Ability names can only have ONE slash (namespace/name)
    $get_post = wp_register_ability('wordpress/get-post', [
        'label' => 'Get Post',
        'description' => 'Retrieves a WordPress post by ID',
        'category' => 'wordpress',  // REQUIRED field
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'id' => [
                    'type' => 'integer',
                    'description' => 'The post ID',
                ],
            ],
            'required' => ['id'],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'id' => ['type' => 'integer'],
                'title' => ['type' => 'string'],
                'content' => ['type' => 'string'],
                'status' => ['type' => 'string'],
            ],
        ],
        'execute_callback' => function($input) {
            $post_id = $input['id'] ?? 0;
            $post = get_post($post_id);
            
            if (!$post) {
                return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
            }
            
            return [
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'status' => $post->post_status,
                'author' => $post->post_author,
                'date' => $post->post_date,
            ];
        },
        'permission_callback' => function($input) {
            // Allow logged-in users to read posts
            return is_user_logged_in();
        },
        'meta' => [
            'show_in_rest' => true,
        ],
    ]);
    
    if ($get_post) {
        error_log('✓ Registered ability: wordpress/get-post');
    } else {
        error_log('✗ Failed to register ability: wordpress/get-post');
        error_log('[DEBUG] Return value type: ' . gettype($get_post));
        error_log('[DEBUG] is_wp_error: ' . (is_wp_error($get_post) ? 'yes' : 'no'));
        if (is_wp_error($get_post)) {
            error_log('[DEBUG] WP_Error: ' . $get_post->get_error_message());
        }
    }
    
    // Register "list posts" ability
    $list_posts = wp_register_ability('wordpress/list-posts', [
        'label' => 'List Posts',
        'description' => 'Lists WordPress posts',
        'category' => 'wordpress',  // REQUIRED field
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'per_page' => [
                    'type' => 'integer',
                    'description' => 'Number of posts per page',
                    'default' => 10,
                ],
                'page' => [
                    'type' => 'integer',
                    'description' => 'Page number',
                    'default' => 1,
                ],
            ],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'posts' => [
                    'type' => 'array',
                    'description' => 'Array of WordPress posts',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'integer'],
                            'title' => ['type' => 'string'],
                            'status' => ['type' => 'string'],
                            'date' => ['type' => 'string'],
                        ],
                    ],
                ],
                'total' => [
                    'type' => 'integer',
                    'description' => 'Total number of published posts',
                ],
                'page' => [
                    'type' => 'integer',
                    'description' => 'Current page number',
                ],
                'per_page' => [
                    'type' => 'integer',
                    'description' => 'Number of posts per page',
                ],
            ],
            'required' => ['posts', 'total', 'page', 'per_page'],
        ],
        'execute_callback' => function($input) {
            $per_page = $input['per_page'] ?? 10;
            $page = $input['page'] ?? 1;

            $args = [
                'posts_per_page' => $per_page,
                'paged' => $page,
                'post_status' => 'publish',
            ];

            $posts = get_posts($args);
            $total = wp_count_posts()->publish;

            // Return object with posts array (MCP spec compliant)
            return [
                'posts' => array_map(function($post) {
                    return [
                        'id' => $post->ID,
                        'title' => $post->post_title,
                        'status' => $post->post_status,
                        'date' => $post->post_date,
                    ];
                }, $posts),
                'total' => (int) $total,
                'page' => $page,
                'per_page' => $per_page,
            ];
        },
        'permission_callback' => function($input) {
            return is_user_logged_in();
        },
        'meta' => [
            'show_in_rest' => true,
        ],
    ]);
    
    if ($list_posts) {
        error_log('✓ Registered ability: wordpress/list-posts');
    } else {
        error_log('✗ Failed to register ability: wordpress/list-posts');
    }

    // Register "create post" ability
    $create_post = wp_register_ability('wordpress/create-post', [
        'label' => 'Create Post',
        'description' => 'Creates a new WordPress post',
        'category' => 'wordpress',  // REQUIRED field
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'title' => [
                    'type' => 'string',
                    'description' => 'The post title',
                ],
                'content' => [
                    'type' => 'string',
                    'description' => 'The post content',
                ],
                'status' => [
                    'type' => 'string',
                    'description' => 'The post status (publish, draft, pending)',
                    'default' => 'draft',
                    'enum' => ['publish', 'draft', 'pending', 'private'],
                ],
            ],
            'required' => ['title', 'content'],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'id' => ['type' => 'integer'],
                'title' => ['type' => 'string'],
                'content' => ['type' => 'string'],
                'status' => ['type' => 'string'],
                'url' => ['type' => 'string'],
            ],
        ],
        'execute_callback' => function($input) {
            $post_data = [
                'post_title' => $input['title'] ?? '',
                'post_content' => $input['content'] ?? '',
                'post_status' => $input['status'] ?? 'draft',
                'post_type' => 'post',
            ];

            $post_id = wp_insert_post($post_data, true);

            if (is_wp_error($post_id)) {
                return new WP_Error('post_creation_failed', $post_id->get_error_message(), ['status' => 400]);
            }

            $post = get_post($post_id);
            return [
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'status' => $post->post_status,
                'url' => get_permalink($post->ID),
            ];
        },
        'permission_callback' => function($input) {
            return current_user_can('edit_posts');
        },
        'meta' => [
            'show_in_rest' => true,
        ],
    ]);

    if ($create_post) {
        error_log('✓ Registered ability: wordpress/create-post');
    } else {
        error_log('✗ Failed to register ability: wordpress/create-post');
    }

    // Register "update post" ability
    $update_post = wp_register_ability('wordpress/update-post', [
        'label' => 'Update Post',
        'description' => 'Updates an existing WordPress post',
        'category' => 'wordpress',  // REQUIRED field
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'id' => [
                    'type' => 'integer',
                    'description' => 'The post ID',
                ],
                'title' => [
                    'type' => 'string',
                    'description' => 'The post title',
                ],
                'content' => [
                    'type' => 'string',
                    'description' => 'The post content',
                ],
                'status' => [
                    'type' => 'string',
                    'description' => 'The post status',
                    'enum' => ['publish', 'draft', 'pending', 'private'],
                ],
            ],
            'required' => ['id'],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'id' => ['type' => 'integer'],
                'title' => ['type' => 'string'],
                'content' => ['type' => 'string'],
                'status' => ['type' => 'string'],
                'url' => ['type' => 'string'],
            ],
        ],
        'execute_callback' => function($input) {
            $post_id = $input['id'] ?? 0;

            // Check if post exists
            if (!get_post($post_id)) {
                return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
            }

            $post_data = ['ID' => $post_id];

            if (isset($input['title'])) {
                $post_data['post_title'] = $input['title'];
            }
            if (isset($input['content'])) {
                $post_data['post_content'] = $input['content'];
            }
            if (isset($input['status'])) {
                $post_data['post_status'] = $input['status'];
            }

            $result = wp_update_post($post_data, true);

            if (is_wp_error($result)) {
                return new WP_Error('post_update_failed', $result->get_error_message(), ['status' => 400]);
            }

            $post = get_post($post_id);
            return [
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'status' => $post->post_status,
                'url' => get_permalink($post->ID),
            ];
        },
        'permission_callback' => function($input) {
            $post_id = $input['id'] ?? 0;
            return current_user_can('edit_post', $post_id);
        },
        'meta' => [
            'show_in_rest' => true,
        ],
    ]);

    if ($update_post) {
        error_log('✓ Registered ability: wordpress/update-post');
    } else {
        error_log('✗ Failed to register ability: wordpress/update-post');
    }

    // Register "delete post" ability
    $delete_post = wp_register_ability('wordpress/delete-post', [
        'label' => 'Delete Post',
        'description' => 'Deletes a WordPress post',
        'category' => 'wordpress',  // REQUIRED field
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'id' => [
                    'type' => 'integer',
                    'description' => 'The post ID',
                ],
                'force' => [
                    'type' => 'boolean',
                    'description' => 'Whether to bypass trash and force deletion',
                    'default' => false,
                ],
            ],
            'required' => ['id'],
        ],
        'output_schema' => [
            'type' => 'object',
            'properties' => [
                'success' => ['type' => 'boolean'],
                'message' => ['type' => 'string'],
                'deleted_post' => [
                    'type' => 'object',
                    'properties' => [
                        'id' => ['type' => 'integer'],
                        'title' => ['type' => 'string'],
                    ],
                ],
            ],
        ],
        'execute_callback' => function($input) {
            $post_id = $input['id'] ?? 0;
            $force = $input['force'] ?? false;

            $post = get_post($post_id);
            if (!$post) {
                return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
            }

            $post_title = $post->post_title;
            $result = wp_delete_post($post_id, $force);

            if (!$result) {
                return new WP_Error('post_deletion_failed', 'Failed to delete post', ['status' => 400]);
            }

            return [
                'success' => true,
                'message' => $force ? 'Post permanently deleted' : 'Post moved to trash',
                'deleted_post' => [
                    'id' => $post_id,
                    'title' => $post_title,
                ],
            ];
        },
        'permission_callback' => function($input) {
            $post_id = $input['id'] ?? 0;
            return current_user_can('delete_post', $post_id);
        },
        'meta' => [
            'show_in_rest' => true,
        ],
    ]);

    if ($delete_post) {
        error_log('✓ Registered ability: wordpress/delete-post');
    } else {
        error_log('✗ Failed to register ability: wordpress/delete-post');
    }

    error_log('[ABILITIES] WordPress abilities registration complete');
    error_log('[ABILITIES] Total registered abilities: ' . count(wp_get_abilities()));
}, 100);  // Use priority 100 to run after other abilities_api_init callbacks

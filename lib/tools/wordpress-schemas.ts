import { z } from 'zod';

/**
 * WordPress Tool Schemas
 *
 * Explicit Zod schemas matching WordPress ability definitions in:
 * wp-content/mu-plugins/register-wordpress-abilities.php
 *
 * These schemas must be kept in sync with WordPress manually.
 */

// wordpress-get-post schema (register-wordpress-abilities.php:17)
export const getPostSchema = z.object({
  id: z.number().int().describe('The post ID to retrieve')
});

export type GetPostInput = z.infer<typeof getPostSchema>;

// wordpress-list-posts schema (register-wordpress-abilities.php:69)
export const listPostsSchema = z.object({
  per_page: z.number().int().optional().default(10).describe('Number of posts per page'),
  page: z.number().int().optional().default(1).describe('Page number for pagination')
});

export type ListPostsInput = z.infer<typeof listPostsSchema>;

// wordpress-create-post schema (register-wordpress-abilities.php:131)
export const createPostSchema = z.object({
  title: z.string().describe('The post title'),
  content: z.string().describe('The post content (HTML allowed)'),
  status: z.enum(['publish', 'draft', 'pending', 'private'])
    .optional()
    .default('draft')
    .describe('The post status')
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// wordpress-update-post schema (register-wordpress-abilities.php:202)
export const updatePostSchema = z.object({
  id: z.number().int().describe('The post ID to update'),
  title: z.string().optional().describe('The new post title'),
  content: z.string().optional().describe('The new post content (HTML allowed)'),
  status: z.enum(['publish', 'draft', 'pending', 'private'])
    .optional()
    .describe('The new post status')
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// wordpress-delete-post schema (register-wordpress-abilities.php:289)
export const deletePostSchema = z.object({
  id: z.number().int().describe('The post ID to delete'),
  force: z.boolean()
    .optional()
    .default(false)
    .describe('Whether to bypass trash and force permanent deletion')
});

export type DeletePostInput = z.infer<typeof deletePostSchema>;
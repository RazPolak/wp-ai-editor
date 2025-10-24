#!/usr/bin/env tsx

/**
 * Schema Validation Test Script
 * Tests all WordPress tool schemas with valid and invalid inputs
 */

import {
  getPostSchema,
  listPostsSchema,
  createPostSchema,
  updatePostSchema,
  deletePostSchema
} from '../lib/tools/wordpress-schemas';

console.log('=== WordPress Schema Validation ===\n');

// Define tests
const tests = [
  {
    name: 'getPostSchema',
    schema: getPostSchema,
    valid: { id: 1 },
    invalid: { id: 'not-a-number' as any }
  },
  {
    name: 'listPostsSchema',
    schema: listPostsSchema,
    valid: { per_page: 10, page: 1 },
    invalid: { per_page: 'invalid' as any }
  },
  {
    name: 'createPostSchema',
    schema: createPostSchema,
    valid: { title: 'Test', content: 'Content', status: 'draft' as const },
    invalid: { title: 'Test' } as any // missing required 'content'
  },
  {
    name: 'updatePostSchema',
    schema: updatePostSchema,
    valid: { id: 1, title: 'Updated' },
    invalid: { id: 'not-a-number' as any }
  },
  {
    name: 'deletePostSchema',
    schema: deletePostSchema,
    valid: { id: 1, force: false },
    invalid: { id: 'not-a-number' as any }
  }
];

let passed = 0;
let failed = 0;

// Run tests
tests.forEach(test => {
  // Test valid case
  try {
    test.schema.parse(test.valid);
    console.log(`✓ ${test.name}: valid input accepted`);
    passed++;
  } catch (error) {
    console.error(`✗ ${test.name}: valid input rejected`, error);
    failed++;
  }

  // Test invalid case
  try {
    test.schema.parse(test.invalid);
    console.error(`✗ ${test.name}: invalid input accepted`);
    failed++;
  } catch (error) {
    console.log(`✓ ${test.name}: invalid input rejected`);
    passed++;
  }
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
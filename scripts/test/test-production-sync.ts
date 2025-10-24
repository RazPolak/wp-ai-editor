#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { executeWordPressAgent } from '../../lib/agents/wordpress-agent';
import { changeTracker } from '../../lib/sync/change-tracker';
import { productionSyncService } from '../../lib/sync/production-sync';
import { getSandboxMcpClient, getProductionMcpClient } from '../../lib/mcp/client-factory';

/**
 * Test Configuration
 * Change these values to customize the test post
 */
const TEST_POST_TITLE = 'E2E POC';
const TEST_POST_CONTENT = 'This post was created by automated testing';
const TEST_POST_STATUS = 'publish'; // 'publish' or 'draft'

async function main() {
  console.log('=== Production Sync E2E Test ===\n');

  // Test 1: Verify both environments are reachable
  console.log('Test 1: Checking MCP connections...');
  try {
    const sandboxClient = await getSandboxMcpClient();
    const productionClient = await getProductionMcpClient();

    await sandboxClient.listTools();
    await productionClient.listTools();

    console.log('✓ Both sandbox and production are reachable\n');
  } catch (error) {
    console.error('✗ MCP connection failed:', error);
    process.exit(1);
  }

  // Test 2: Clear any existing tracked changes
  console.log('Test 2: Clearing tracked changes...');
  changeTracker.clearChanges();
  console.log('✓ Tracked changes cleared\n');

  // Test 3: Create a post in sandbox via AI
  console.log('Test 3: Creating post in sandbox via AI...');
  try {
    const statusWord = TEST_POST_STATUS === 'publish' ? 'published' : TEST_POST_STATUS;
    const result = await executeWordPressAgent(
      `Create a ${statusWord} post titled "${TEST_POST_TITLE}" with content "${TEST_POST_CONTENT}"`
    );
    console.log('✓ Agent response:', result.text);
    console.log(`✓ Tracked ${changeTracker.getChangeCount()} changes\n`);
  } catch (error) {
    console.error('✗ Failed to create post:', error);
    process.exit(1);
  }

  // Test 4: Verify changes were tracked
  console.log('Test 4: Verifying change tracking...');
  const changes = changeTracker.getChanges();

  if (changes.length === 0) {
    console.error('✗ No changes were tracked!');
    process.exit(1);
  }

  console.log(`✓ Tracked ${changes.length} change(s):`);
  changes.forEach((change, index) => {
    console.log(`  ${index + 1}. ${change.toolName} - ${JSON.stringify(change.args)}`);
  });
  console.log('');

  // Test 5: Apply changes to production
  console.log('Test 5: Syncing changes to production...');
  try {
    const syncResult = await productionSyncService.applyChanges(changes);

    if (!syncResult.success) {
      console.error('✗ Sync failed:', syncResult.errors);
      process.exit(1);
    }

    console.log(`✓ Successfully synced ${syncResult.appliedChanges} changes to production`);
    console.log('');
  } catch (error) {
    console.error('✗ Sync failed with exception:', error);
    process.exit(1);
  }

  // Test 6: Verify post exists in production
  console.log('Test 6: Verifying post exists in production...');
  try {
    const productionClient = await getProductionMcpClient();
    const result = await productionClient.callTool('wordpress-list-posts', { per_page: 100, page: 1 });

    // Parse the result
    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent?.text) {
      throw new Error('No text content in MCP response');
    }

    const parsedResult = JSON.parse(textContent.text) as { posts: Array<{ title: string; id: number }> };

    console.log(`  Found ${parsedResult.posts.length} posts in production`);
    console.log('  Post titles:', parsedResult.posts.map(p => p.title).join(', '));

    const testPost = parsedResult.posts.find((p) => p.title === TEST_POST_TITLE);

    if (!testPost) {
      console.error('✗ Test post not found in production!');
      console.error(`  Looking for: "${TEST_POST_TITLE}"`);
      console.error('  Available titles:', parsedResult.posts.map(p => `"${p.title}"`).join(', '));
      process.exit(1);
    }

    console.log('✓ Post found in production:', testPost.title);
    console.log('');
  } catch (error) {
    console.error('✗ Failed to verify production post:', error);
    process.exit(1);
  }

  // Test 7: Clear tracked changes
  console.log('Test 7: Clearing tracked changes...');
  changeTracker.clearChanges();
  console.log('✓ Changes cleared\n');

  console.log('=== All Tests Passed ===');
  process.exit(0);
}

main();
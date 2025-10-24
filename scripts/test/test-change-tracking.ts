#!/usr/bin/env tsx

/**
 * Phase 3 Change Tracking Test Script
 * Verifies that AI tool calls are tracked correctly
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function apiCall(method: string, path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  return { response, data };
}

async function main() {
  console.log('=== Phase 3: Change Tracking Test ===\n');

  // Test 1: Clear any existing tracked changes
  console.log('Test 1: Clearing existing tracked changes...');
  try {
    const { data } = await apiCall('DELETE', '/api/sync/changes');
    console.log(`✓ Cleared tracked changes: ${data.message}`);
    console.log('');
  } catch (error) {
    console.error('✗ Failed to clear changes:', error);
    process.exit(1);
  }

  // Test 2: Verify changes are cleared
  console.log('Test 2: Verifying changes are cleared...');
  try {
    const { data } = await apiCall('GET', '/api/sync/changes');
    if (data.count !== 0) {
      console.error('✗ Changes not cleared. Count:', data.count);
      process.exit(1);
    }
    console.log('✓ Confirmed: 0 tracked changes');
    console.log('');
  } catch (error) {
    console.error('✗ Failed to verify cleared changes:', error);
    process.exit(1);
  }

  // Test 3: Create post via AI agent
  console.log('Test 3: Creating post via AI agent...');
  try {
    const { response, data } = await apiCall('POST', '/api/agents/wordpress', {
      prompt: 'Create a post titled "Test Change Tracking" with content "This post tests change tracking"',
    });

    if (!response.ok) {
      console.error('✗ Agent API call failed:', data);
      process.exit(1);
    }

    console.log('✓ Agent response:', data.text);

    // Verify trackedChanges.count is 1
    if (!data.trackedChanges) {
      console.error('✗ Response missing trackedChanges field');
      process.exit(1);
    }

    if (data.trackedChanges.count !== 1) {
      console.error(`✗ Expected trackedChanges.count: 1, got: ${data.trackedChanges.count}`);
      process.exit(1);
    }

    console.log('✓ Verified: trackedChanges.count = 1');
    console.log('');
  } catch (error) {
    console.error('✗ Failed to create post:', error);
    process.exit(1);
  }

  // Test 4: Verify GET /api/sync/changes shows the tracked change
  console.log('Test 4: Verifying tracked changes are stored...');
  try {
    const { data } = await apiCall('GET', '/api/sync/changes');

    if (data.count !== 1) {
      console.error(`✗ Expected 1 tracked change, got: ${data.count}`);
      process.exit(1);
    }

    if (!data.changes || data.changes.length !== 1) {
      console.error('✗ Changes array is missing or empty');
      process.exit(1);
    }

    const change = data.changes[0];
    if (change.toolName !== 'wordpress-create-post') {
      console.error(`✗ Expected toolName 'wordpress-create-post', got: ${change.toolName}`);
      process.exit(1);
    }

    if (!change.args || !change.result || !change.timestamp) {
      console.error('✗ Change is missing required fields (args, result, or timestamp)');
      process.exit(1);
    }

    console.log('✓ Tracked change:', {
      toolName: change.toolName,
      args: change.args,
      timestamp: change.timestamp,
    });
    console.log('');
  } catch (error) {
    console.error('✗ Failed to verify tracked changes:', error);
    process.exit(1);
  }

  // Test 5: Clear tracked changes
  console.log('Test 5: Clearing tracked changes...');
  try {
    const { data } = await apiCall('DELETE', '/api/sync/changes');

    if (data.remainingChanges !== 0) {
      console.error(`✗ Expected 0 remaining changes, got: ${data.remainingChanges}`);
      process.exit(1);
    }

    console.log('✓ Cleared tracked changes');
    console.log('');
  } catch (error) {
    console.error('✗ Failed to clear changes:', error);
    process.exit(1);
  }

  // Test 6: Verify changes are cleared (second GET)
  console.log('Test 6: Verifying changes are cleared (final check)...');
  try {
    const { data } = await apiCall('GET', '/api/sync/changes');

    if (data.count !== 0) {
      console.error(`✗ Expected 0 tracked changes, got: ${data.count}`);
      process.exit(1);
    }

    if (data.changes.length !== 0) {
      console.error('✗ Changes array is not empty');
      process.exit(1);
    }

    console.log('✓ Confirmed: 0 tracked changes (empty array)');
    console.log('');
  } catch (error) {
    console.error('✗ Failed to verify cleared changes:', error);
    process.exit(1);
  }

  console.log('=== All Tests Passed ===');
  console.log('\nPhase 3 Change Tracking is working correctly!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
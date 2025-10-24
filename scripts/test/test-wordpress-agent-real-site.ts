#!/usr/bin/env tsx

/**
 * WordPress Agent End-to-End Test Script - Real Site Mimic
 * Tests agent execution against the real site mimic (port 8002)
 *
 * Required Environment Variables:
 * - WORDPRESS_REAL_SITE_MCP_URL (e.g., http://localhost:8002/wp-json/)
 * - WORDPRESS_REAL_SITE_MCP_USERNAME
 * - WORDPRESS_REAL_SITE_MCP_PASSWORD
 */

import dotenv from 'dotenv';
import {executeWordPressAgent} from '../../lib/agents/wordpress-agent';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('=== WordPress Agent Test - Real Site Mimic (Port 8002) ===\n');

    // Test 1: List Posts
    console.log('Test 1: Testing wordpress-list-posts on real site...');
    try {
        const result = await executeWordPressAgent(
            'List the first 3 WordPress posts. Just show their titles and IDs.',
            'real-site'
        );
        console.log('✓ Agent response:', result.text);
        const toolCalls = result.steps.flatMap(s => s.toolCalls?.map(tc => tc.toolName) || []);
        console.log('✓ Tools used:', toolCalls.join(', '));
        console.log('');
    } catch (error) {
        console.error('✗ Test failed:', error);
        console.error('Make sure WORDPRESS_REAL_SITE_MCP_* env vars are set and real site is running on port 8002');
        process.exit(1);
    }

    // Test 2: Create Post
    console.log('Test 2: Testing wordpress-create-post on real site...');
    try {
        const result = await executeWordPressAgent(
            'Create a post titled "Test Post from AI - Real Site" with content "This is a test post created by an AI agent on the real site mimic." Save it as published.',
            'real-site'
        );
        console.log('✓ Agent response:', result.text);
        console.log('');
    } catch (error) {
        console.error('✗ Test failed:', error);
        process.exit(1);
    }

    console.log('=== All Real Site Tests Passed ===');
    console.log('\nYou can verify the changes at: http://localhost:8002/wp-admin/');
    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
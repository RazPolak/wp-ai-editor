#!/usr/bin/env tsx

/**
 * WordPress Agent End-to-End Test Script
 * Tests MCP connection, tool discovery, and agent execution
 */

import 'dotenv/config';
import {executeWordPressAgent} from '../../lib/agents/wordpress-agent';
import {getWordPressMcpClient} from '../../lib/mcp/client-factory';
import {wordpressTools} from '../../lib/tools/wordpress-tools';

async function main() {
    console.log('=== WordPress MCP Agent Test ===\n');

    // Test 1: MCP Connection
    console.log('Test 1: Testing MCP connection...');
    try {
        const client = await getWordPressMcpClient();
        const {tools} = await client.listTools();
        console.log(`✓ Connected to WordPress MCP`);
        console.log(`✓ Available tools from WordPress: ${tools.map(t => t.name).join(', ')}\n`);
    } catch (error) {
        console.error('✗ Connection failed:', error);
        process.exit(1);
    }

    // Test 2: Tool Definitions
    console.log('Test 2: Checking tool definitions...');
    const toolNames = Object.keys(wordpressTools);
    console.log(`✓ Defined ${toolNames.length} tools in Next.js:`);
    toolNames.forEach(name => console.log(`  - ${name}`));
    console.log('');

    // Test 3: List Posts
    console.log('Test 3: Testing wordpress-list-posts...');
    try {
        const result = await executeWordPressAgent(
            'List the first 3 WordPress posts. Just show their titles and IDs.'
        );
        console.log('✓ Agent response:', result.text);
        const toolCalls = result.steps.flatMap(s => s.toolCalls?.map(tc => tc.toolName) || []);
        console.log('✓ Tools used:', toolCalls.join(', '));
        console.log('');
    } catch (error) {
        console.error('✗ Test failed:', error);
        process.exit(1);
    }

    // Test 4: Create Draft Post
    console.log('Test 4: Testing wordpress-create-post...');
    try {
        const result = await executeWordPressAgent(
            'Create a post titled "Test Post from AI" with content "This is a test post created by an AI agent." Save it as a published.'
        );
        console.log('✓ Agent response:', result.text);
        console.log('');
    } catch (error) {
        console.error('✗ Test failed:', error);
        process.exit(1);
    }

    console.log('=== All Tests Passed ===');
    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
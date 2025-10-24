# Test Scripts

Scripts for validating schemas, testing MCP connections, and running end-to-end agent tests.

## Scripts

### `test-schemas.ts`

**Purpose**: Validates all WordPress tool Zod schemas with valid and invalid inputs

**Prerequisites**:
- Node.js dependencies installed (`pnpm install`)
- TypeScript execution via tsx

**What it tests**:
1. `getPostSchema` - Validates post ID input
2. `listPostsSchema` - Validates pagination parameters
3. `createPostSchema` - Validates post creation with required fields
4. `updatePostSchema` - Validates post update parameters
5. `deletePostSchema` - Validates post deletion parameters

**Usage**:
```bash
pnpm test:schemas
# OR
tsx scripts/test/test-schemas.ts
```

**Expected Output**:
```
=== WordPress Schema Validation ===

✓ getPostSchema: valid input accepted
✓ getPostSchema: invalid input rejected
✓ listPostsSchema: valid input accepted
✓ listPostsSchema: invalid input rejected
✓ createPostSchema: valid input accepted
✓ createPostSchema: invalid input rejected
✓ updatePostSchema: valid input accepted
✓ updatePostSchema: invalid input rejected
✓ deletePostSchema: valid input accepted
✓ deletePostSchema: invalid input rejected

=== Results: 10 passed, 0 failed ===
```

**Exit Codes**:
- `0` - All tests passed
- `1` - One or more tests failed

**When to run**:
- After modifying schema definitions in `lib/tools/wordpress-schemas.ts`
- Before deploying changes
- As part of CI/CD pipeline

---

### `test-wordpress-agent.ts`

**Purpose**: End-to-end testing of MCP connection, tool execution, and AI agent

**Prerequisites**:
- WordPress container running (`docker-compose up -d`)
- MCP adapter installed (`scripts/setup/install-mcp-adapter.sh`)
- Environment variables configured (`.env.local`)
- AI provider API key (Anthropic or OpenAI)

**What it tests**:
1. **MCP Connection**: Verifies connection to WordPress MCP endpoint
2. **Tool Discovery**: Lists all available tools from WordPress
3. **Tool Definitions**: Verifies Next.js tool definitions match
4. **List Posts**: Tests natural language → wordpress-list-posts
5. **Create Post**: Tests natural language → wordpress-create-post

**Usage**:
```bash
pnpm test:agent
# OR
tsx scripts/test/test-wordpress-agent.ts
```

**Expected Output**:
```
=== WordPress MCP Agent Test ===

Test 1: Testing MCP connection...
✓ Connected to WordPress MCP
✓ Available tools: wordpress-get-post, wordpress-list-posts, wordpress-create-post, wordpress-update-post, wordpress-delete-post

Test 2: Checking tool definitions...
✓ Defined 5 tools in Next.js:
  - wordpress-get-post
  - wordpress-list-posts
  - wordpress-create-post
  - wordpress-update-post
  - wordpress-delete-post

Test 3: Testing wordpress-list-posts...
✓ Agent response: I found 3 posts in your WordPress site...
✓ Tools used: wordpress-list-posts

Test 4: Testing wordpress-create-post...
✓ Agent response: I've created a draft post titled "Test from AI Agent"...

=== All Tests Passed ===
```

**Exit Codes**:
- `0` - All tests passed
- `1` - One or more tests failed

**Common Failures**:

| Error | Cause | Solution |
|-------|-------|----------|
| "Failed to connect" | WordPress not running | `docker-compose up -d` |
| "Authentication failed" | Invalid credentials | Check `.env.local` credentials |
| "No tools available" | MCP adapter not installed | Run `scripts/setup/install-mcp-adapter.sh` |
| "AI service unavailable" | Invalid API key | Check `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` |
| "Tool execution failed" | WordPress error | Check `docker-compose logs wordpress` |

**Environment Variables Used**:
- `WORDPRESS_MCP_URL` - WordPress MCP endpoint
- `WORDPRESS_MCP_USERNAME` - WordPress admin username
- `WORDPRESS_MCP_PASSWORD` - WordPress application password
- `AI_PROVIDER` - AI provider (anthropic or openai)
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - AI API key

**When to run**:
- After installation
- After modifying agent or tool code
- Before deploying changes
- To verify system health

## Running All Tests

To run all tests sequentially:

```bash
pnpm test:all
```

This will run:
1. Schema validation tests
2. WordPress agent E2E tests

Both must pass for the command to exit with code 0.

## Test Development

### Adding New Schema Tests

Edit `test-schemas.ts` and add to the `tests` array:

```typescript
{
  name: 'myNewSchema',
  schema: myNewSchema,
  valid: { /* valid input */ },
  invalid: { /* invalid input */ }
}
```

### Adding New Agent Tests

Edit `test-wordpress-agent.ts` and add new test sections:

```typescript
// Test 5: New functionality
console.log('Test 5: Testing new feature...');
try {
  const result = await executeWordPressAgent('Your test prompt');
  console.log('✓ Test passed:', result.text);
} catch (error) {
  console.error('✗ Test failed:', error);
  process.exit(1);
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run tests
  run: |
    pnpm install
    docker-compose up -d
    sleep 10
    ./scripts/setup/install-mcp-adapter.sh
    pnpm test:all
```

### Pre-commit Hook

```bash
#!/bin/bash
pnpm test:schemas || exit 1
```

## Related Documentation

- [Schema Definitions](../../lib/tools/wordpress-schemas.ts)
- [WordPress Agent](../../lib/agents/wordpress-agent.ts)
- [WordPress Tools](../../lib/tools/wordpress-tools.ts)
- [Technical Design](../../TECHNICAL_DESIGN.md#14-testing-strategy)
export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>WordPress AI Editor</h1>
      <p>Vercel AI SDK + WordPress MCP Integration</p>

      <section style={{ marginTop: '2rem' }}>
        <h2>API Endpoints</h2>
        <ul>
          <li><code>GET /api/health</code> - Check WordPress MCP connection</li>
          <li><code>POST /api/agents/wordpress</code> - Execute WordPress agent</li>
          <li><code>POST /api/agents/wordpress/stream</code> - Streaming agent</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Testing</h2>
        <p>Run tests via CLI:</p>
        <pre style={{ background: '#f0f0f0', padding: '1rem', borderRadius: '4px' }}>
pnpm test:agent
        </pre>
      </section>
    </main>
  );
}
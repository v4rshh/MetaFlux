export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 720 }}>
      <h1>MetaFroge AI — Backend Runtime</h1>
      <p>Metadata-driven API runtime for Track A (AI App Generator).</p>
      <ul>
        <li>
          <code>GET /api/runtime/health</code> — health check
        </li>
        <li>
          <code>POST /api/runtime/validate</code> — validate app config JSON
        </li>
        <li>
          <code>POST /api/auth/register</code> — register user
        </li>
        <li>
          <code>POST /api/auth/login</code> — login
        </li>
        <li>
          <code>POST /api/apps</code> — create app from config (auth required)
        </li>
        <li>
          <code>GET /api/apps/:appId/schema</code> — entity schemas + generated routes
        </li>
        <li>
          <code>GET /api/apps/:appId/openapi</code> — OpenAPI 3.0 spec
        </li>
        <li>
          <code>POST /api/apps/:appId/workflows/:name/run</code> — run workflow manually
        </li>
        <li>
          <code>GET /api/runtime/openapi</code> — platform OpenAPI spec
        </li>
        <li>
          <code>CRUD /api/apps/:appId/entities/:entity</code> — dynamic records
        </li>
      </ul>
      <p>
        See <code>README.md</code> and <code>examples/task-manager.config.json</code>.
      </p>
    </main>
  );
}

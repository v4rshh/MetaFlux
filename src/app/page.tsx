export default function Home() {
  return (<main style={{
      padding: "40px",
      fontFamily: "Arial, sans-serif",
      maxWidth: "900px",
      margin: "auto"
    }}>
      <h1>MetaFlux — Backend Runtime</h1>
      <p style={{ fontSize: "18px" }}>
        AI-powered metadata driven backend platform for dynamic API generation.
      </p>
       <hr />
       <h2>Features</h2>

      <ul>
        <li>Authentication system with JWT</li>
        <li>Dynamic API generation</li>
        <li>Entity schema creation</li>
        <li>Workflow execution engine</li>
        <li>PostgreSQL + Prisma + Neon database</li>
        <li>OpenAPI documentation </li>
      </ul>

      <hr />
       <h2>API Endpoints</h2>

      <div style={{
        display:"flex",
        gap:"15px",
        flexWrap:"wrap"
      }}>

        <a
          href="/api/runtime/health"
          target="_blank"
          style={{
            padding:"10px 20px",
            border:"1px solid black",
            textDecoration:"none"
          }}
        >
          Runtime Health
        </a>

        <a
          href="/api/runtime/openapi"
          target="_blank"
          style={{
            padding:"10px 20px",
            border:"1px solid black",
            textDecoration:"none"
          }}
        >
          OpenAPI Spec
        </a>

      </div>

      <hr style={{margin:"40px 0"}} />

<h2>Tech Stack</h2>

<div
  style={{
    padding:"15px",
    border:"1px solid #ddd",
    borderRadius:"10px",
    marginBottom:"30px"
  }}
>
  <p>
    Next.js • TypeScript • Prisma • PostgreSQL • Neon • JWT • Vercel
  </p>
</div>

<hr style={{margin:"40px 0"}} />

<h2>Available APIs</h2>

<div
  style={{
    padding:"20px",
    border:"1px solid #ddd",
    borderRadius:"10px"
  }}
>
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
</div>


      <p>
        See <code>README.md</code> and <code>examples/task-manager.config.json</code>.
      </p>
    </main>
  );
}

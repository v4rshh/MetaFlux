# MetaFroge AI — Backend Runtime (Track A)

Metadata-driven backend that converts JSON app configuration into working APIs, database structure, and CRUD operations. Built for the **Backend Engineer** role on Track A (AI App Generator), inspired by platforms like [Base44](https://base44.com/).

## Stack

- **Next.js 15** API Routes
- **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **Zod** (dynamic validation)
- **JWT** authentication (user-scoped data)

## Architecture

```
JSON Config → Config Normalizer → Schema Manager → Prisma DB
                      ↓                ↓
               Dynamic Validator   API Route Generator
                      ↓
               CRUD Executor (user-scoped)
                      ↓
               Workflow Engine (triggers + steps)
```

### Core modules (`src/lib/runtime/`)

| Module | Responsibility |
|--------|----------------|
| `config-normalizer.ts` | Repairs missing/invalid config; coerces types; collects warnings |
| `schema-manager.ts` | Syncs entities/workflows to PostgreSQL |
| `validator.ts` | Per-entity Zod schemas from field metadata |
| `crud-executor.ts` | Create/read/update/delete with scope enforcement |
| `workflow-engine.ts` | Trigger matching, step execution, run history |
| `openapi.ts` | OpenAPI 3.0 spec generation from entities |
| `api-generator.ts` | REST route descriptors for discovery |
| `errors.ts` | Typed `RuntimeError` with HTTP status codes |

### Graceful degradation

The runtime **never crashes** on bad config. Instead it:

- Skips invalid entities/fields with warnings
- Defaults unknown field types to `string`
- Strips unknown request fields (reported in `_meta.strippedFields`)
- Returns `422` with structured `issues[]` for validation failures
- Includes `warnings[]` in successful responses when config was partial

### Data scoping

| Scope | Behavior |
|-------|----------|
| `user` | Records filtered by authenticated `userId` (default) |
| `owner` | Only app owner can access |
| `public` | No user filter (read/write still may require auth for mutations) |

## Quick start

```bash
cp .env.example .env
# Set DATABASE_URL (Neon/Railway/local Postgres) and JWT_SECRET

npm install
npx prisma db push
npm run dev
```

Server: `http://localhost:3000`

## API reference

### Auth

```http
POST /api/auth/register
{ "email": "you@example.com", "password": "secret123", "name": "You" }

POST /api/auth/login
{ "email": "you@example.com", "password": "secret123" }
```

Response includes `token`. Use header: `Authorization: Bearer <token>`

### Validate config (no DB write)

```http
POST /api/runtime/validate
Content-Type: application/json

{ "config": { ... } }
```

### Create app from config

```http
POST /api/apps
Authorization: Bearer <token>

{ "config": { "name": "Task Manager", "entities": [...] } }
```

### Sync schema after config change

```http
POST /api/apps/:appId/sync
Authorization: Bearer <token>

{ "config": { ...updated config... } }
```

### Dynamic CRUD

```http
GET    /api/apps/:appId/entities/:entity?page=1&limit=20
POST   /api/apps/:appId/entities/:entity
GET    /api/apps/:appId/entities/:entity/:recordId
PATCH  /api/apps/:appId/entities/:entity/:recordId
DELETE /api/apps/:appId/entities/:entity/:recordId
```

### Workflows

Workflows run automatically on `record.create` / `record.update` (async), or manually via API.

**Step types:** `log`, `notify`, `set_field`, `webhook` (unknown types are skipped with a warning in run logs).

```http
GET  /api/apps/:appId/workflows
GET  /api/apps/:appId/workflows/runs?workflow=on-done&limit=20
POST /api/apps/:appId/workflows/:name/run
{ "entity": "tasks", "record": { "id": "...", "status": "done" } }
```

### OpenAPI export

```http
GET /api/runtime/openapi          # platform routes (auth, validate, apps)
GET /api/apps/:appId/openapi      # app-specific CRUD + workflows
```

Import the `data.spec` object into Swagger UI, Postman, or codegen tools.

## Testing

```bash
# Unit tests (no database)
npm test

# Integration tests (requires DATABASE_URL + prisma db push)
npm run test:integration

# All tests
npm run test:all
```

Integration tests auto-skip when Postgres is unreachable. Use a dedicated test database URL in `.env`:

```
DATABASE_URL="postgresql://user:pass@localhost:5432/metafroge_test"
```

### Response shape

Success:

```json
{ "ok": true, "data": { ... }, "warnings": [], "meta": {} }
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": { "issues": [{ "field": "title", "code": "REQUIRED", "message": "..." }] }
  }
}
```

## Example config

See `examples/task-manager.config.json` — includes intentional invalid field type to demonstrate warning handling.

## Deployment

- **Vercel**: deploy Next.js app; set `DATABASE_URL` to [Neon](https://neon.tech) Postgres
- **Railway / Render**: run `npm run build && npm start`; run `prisma migrate deploy` in CI

## Evaluation alignment

| Criteria | Implementation |
|----------|----------------|
| API architecture | RESTful dynamic routes per entity; discovery via `/schema` |
| Schema design | Prisma core + JSON entity schemas synced from config |
| Validation | Zod built from normalized field definitions |
| Reliability | Typed errors, partial config support, stripped unknown fields |
| Edge cases | Missing fields, malformed JSON, unknown types, schema mismatch |
| Auth | JWT + `user`/`owner`/`public` entity scopes |

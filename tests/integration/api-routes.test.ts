import "./../setup-env";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { canConnect, createTestUser, resetTestData, prisma } from "../helpers/db";
import { normalizeAppConfig, normalizeAllEntities } from "@/lib/runtime/config-normalizer";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { generateOpenApiSpec } from "@/lib/runtime/openapi";
import { createAppFromConfig } from "@/lib/runtime/schema-manager";

const suiteSkip = process.env.DATABASE_URL
  ? undefined
  : "DATABASE_URL not set — copy .env.example to .env";

describe("api route generation with db", { skip: suiteSkip }, () => {
  let ready = false;

  before(async () => {
    if (!(await canConnect())) return;
    await resetTestData();
    ready = true;
  });

  after(async () => {
    if (!ready) return;
    await resetTestData();
    await prisma.$disconnect();
  });

  it("synced app exposes openapi paths for all entities", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const user = await createTestUser("-api");
    const config = normalizeAppConfig({
      name: "API Test",
      slug: `api-test-${Date.now()}`,
      entities: [
        { name: "notes", fields: [{ name: "body", type: "text" }] },
        { name: "tags", fields: ["name"] },
      ],
    });

    const { app } = await createAppFromConfig(user.id, config);
    const entities = normalizeAllEntities(config);
    const routes = generateApiRoutes(app.id, app.slug, entities);
    const spec = generateOpenApiSpec({
      appId: app.id,
      appName: app.name,
      baseUrl: "http://localhost:3000",
      entities,
      routes,
    });

    assert.ok(spec.paths[`/api/apps/${app.id}/entities/notes`]);
    assert.ok(spec.paths[`/api/apps/${app.id}/entities/tags`]);
    assert.ok(spec.paths[`/api/apps/${app.id}/workflows`]);
    assert.ok(spec.paths[`/api/apps/${app.id}/openapi`]);
  });
});

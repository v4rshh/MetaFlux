import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeAppConfig, normalizeAllEntities } from "@/lib/runtime/config-normalizer";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { generateOpenApiSpec } from "@/lib/runtime/openapi";

describe("openapi generator", () => {
  it("produces valid OpenAPI 3 paths for entities", () => {
    const config = normalizeAppConfig({
      name: "Demo",
      slug: "demo",
      entities: [{ name: "tasks", fields: [{ name: "title", type: "string" }] }],
    });
    const entities = normalizeAllEntities(config);
    const routes = generateApiRoutes("app1", "demo", entities);
    const spec = generateOpenApiSpec({
      appId: "app1",
      appName: "Demo",
      appSlug: "demo",
      baseUrl: "http://localhost:3000",
      entities,
      routes,
    });

    assert.equal(spec.openapi, "3.0.3");
    assert.ok(spec.paths["/api/apps/app1/entities/tasks"]);
    assert.ok(spec.components.schemas["Tasks"]);
  });
});

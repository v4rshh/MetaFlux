import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAppConfig,
  normalizeAllEntities,
} from "@/lib/runtime/config-normalizer";

describe("config normalizer", () => {
  it("handles missing fields and invalid types", () => {
    const config = normalizeAppConfig({
      entities: [
        {
          name: "items",
          fields: [
            "title",
            { name: "qty", type: "not_real" },
            null,
          ],
        },
      ],
    });

    assert.equal(config.entities.length, 1);

    const entities = normalizeAllEntities(config);
    const qty = entities[0].fields.find((f) => f.name === "qty");
    assert.equal(qty?.type, "string");
    const allWarnings = [
      ...config.warnings,
      ...entities.flatMap((e) => e.warnings),
    ];
    assert.ok(allWarnings.some((w) => w.code.includes("TYPE") || w.code.includes("FIELD")));
  });

  it("accepts entities as object map", () => {
    const config = normalizeAppConfig({
      name: "Map App",
      entities: {
        users: { fields: ["email"] },
      },
    });
    assert.equal(config.entities[0].name, "users");
  });
});

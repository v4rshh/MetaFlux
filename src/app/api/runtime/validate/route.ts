import { normalizeAppConfig, normalizeAllEntities } from "@/lib/runtime/config-normalizer";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";
import type { AppConfigInput } from "@/lib/runtime/types";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const configInput = (
      typeof body === "object" && body !== null && "config" in (body as object)
        ? (body as { config: unknown }).config
        : body
    ) as AppConfigInput;

    const config = normalizeAppConfig(configInput ?? {});
    const entities = normalizeAllEntities(config);
    const routes = generateApiRoutes("preview", config.slug, entities);

    const hasErrors = config.warnings.some((w) => w.severity === "error");
    const entityWarnings = entities.flatMap((e) => e.warnings);

    return jsonSuccess(
      {
        valid: !hasErrors,
        config,
        entities,
        routes,
      },
      {
        status: hasErrors ? 422 : 200,
        warnings: [...config.warnings, ...entityWarnings],
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

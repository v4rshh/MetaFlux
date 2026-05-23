import { requireAuth, getAppWithAccess } from "@/lib/auth/request";
import { syncAppSchema } from "@/lib/runtime/schema-manager";
import { listEntityDefinitions } from "@/lib/runtime/schema-manager";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";
import type { AppConfigInput } from "@/lib/runtime/types";

type Params = { params: Promise<{ appId: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { appId } = await params;
    const auth = await requireAuth(req);
    const { app, isOwner } = await getAppWithAccess(appId, auth);

    if (!isOwner) {
      throw new RuntimeError("FORBIDDEN", "Only the app owner can sync schema");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const configInput = (
      typeof body === "object" && body !== null && "config" in (body as object)
        ? (body as { config: AppConfigInput }).config
        : body
    ) as AppConfigInput;

    const result = await syncAppSchema(appId, configInput);
    const entities = await listEntityDefinitions(appId);
    const routes = generateApiRoutes(app.id, app.slug, entities);

    return jsonSuccess({ sync: result, entities, routes }, { warnings: result.warnings });
  } catch (err) {
    return handleRouteError(err);
  }
}

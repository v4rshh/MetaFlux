import { getAuthFromRequest, getAppWithAccess } from "@/lib/auth/request";
import { listEntityDefinitions } from "@/lib/runtime/schema-manager";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";

type Params = { params: Promise<{ appId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    const entities = await listEntityDefinitions(appId);
    const routes = generateApiRoutes(app.id, app.slug, entities);

    return jsonSuccess({ entities, routes });
  } catch (err) {
    return handleRouteError(err);
  }
}

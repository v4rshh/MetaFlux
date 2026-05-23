import { getAuthFromRequest, getAppWithAccess } from "@/lib/auth/request";
import { listEntityDefinitions } from "@/lib/runtime/schema-manager";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { generateOpenApiSpec, getBaseUrl } from "@/lib/runtime/openapi";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";

type Params = { params: Promise<{ appId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    const entities = await listEntityDefinitions(appId);
    const routes = generateApiRoutes(app.id, app.slug, entities);
    const spec = generateOpenApiSpec({
      appId: app.id,
      appName: app.name,
      appSlug: app.slug,
      baseUrl: getBaseUrl(req),
      entities,
      routes,
      includePlatformRoutes: false,
    });

    return jsonSuccess({ spec });
  } catch (err) {
    return handleRouteError(err);
  }
}

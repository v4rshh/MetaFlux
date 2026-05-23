import { generateOpenApiSpec, getBaseUrl } from "@/lib/runtime/openapi";
import { jsonSuccess } from "@/lib/api/response";

export async function GET(req: Request) {
  const spec = generateOpenApiSpec({
    appName: "MetaFroge AI Platform",
    baseUrl: getBaseUrl(req),
    entities: [],
    routes: [],
    includePlatformRoutes: true,
  });

  return jsonSuccess({ spec });
}

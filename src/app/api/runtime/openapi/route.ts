import { generateOpenApiSpec, getBaseUrl } from "@/lib/runtime/openapi";
import { jsonSuccess } from "@/lib/api/response";

export async function GET(req: Request) {
  const spec = generateOpenApiSpec({
    appName: "MetaFlux Platform",
    baseUrl: getBaseUrl(req),
    entities: [],
    routes: [],
    includePlatformRoutes: true,
  });

  return jsonSuccess({ spec });
}

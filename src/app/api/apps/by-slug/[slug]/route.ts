import { prisma } from "@/lib/db/prisma";
import { getAuthFromRequest } from "@/lib/auth/request";
import { listEntityDefinitions } from "@/lib/runtime/schema-manager";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const auth = await getAuthFromRequest(req);

    const app = await prisma.app.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        configVersion: true,
        ownerId: true,
      },
    });

    if (!app) {
      throw new RuntimeError("APP_NOT_FOUND", `App "${slug}" not found`);
    }

    const isOwner = auth.userId === app.ownerId;
    const entities = await listEntityDefinitions(app.id);
    const routes = generateApiRoutes(app.id, app.slug, entities);

    return jsonSuccess({ app, entities, routes, isOwner });
  } catch (err) {
    return handleRouteError(err);
  }
}

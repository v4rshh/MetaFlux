import { prisma } from "@/lib/db/prisma";
import { getAuthFromRequest } from "@/lib/auth/request";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

type Params = { params: Promise<{ appId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId } = await params;
    const auth = await getAuthFromRequest(req);

    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        config: true,
        configVersion: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!app) {
      throw new RuntimeError("APP_NOT_FOUND", `App ${appId} not found`);
    }

    const isOwner = auth.userId === app.ownerId;
    if (!isOwner && app.ownerId) {
      throw new RuntimeError("FORBIDDEN", "You do not have access to this app");
    }

    return jsonSuccess({ app, isOwner });
  } catch (err) {
    return handleRouteError(err);
  }
}

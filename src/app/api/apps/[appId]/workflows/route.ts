import { prisma } from "@/lib/db/prisma";
import { getAuthFromRequest, getAppWithAccess } from "@/lib/auth/request";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";

type Params = { params: Promise<{ appId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId } = await params;
    const auth = await getAuthFromRequest(req);
    await getAppWithAccess(appId, auth);

    const workflows = await prisma.workflowDefinition.findMany({
      where: { appId },
      select: {
        id: true,
        name: true,
        trigger: true,
        steps: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { runs: true } },
      },
      orderBy: { name: "asc" },
    });

    return jsonSuccess({ workflows });
  } catch (err) {
    return handleRouteError(err);
  }
}

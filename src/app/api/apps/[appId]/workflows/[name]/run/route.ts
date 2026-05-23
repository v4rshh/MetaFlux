import { requireAuth, getAppWithAccess } from "@/lib/auth/request";
import { runWorkflowByName } from "@/lib/runtime/workflow-engine";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

type Params = { params: Promise<{ appId: string; name: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { appId, name } = await params;
    const auth = await requireAuth(req);
    const { app } = await getAppWithAccess(appId, auth);

    let body: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      /* empty body ok for manual run */
    }

    const result = await runWorkflowByName(appId, name, {
      event: "manual",
      entity: typeof body.entity === "string" ? body.entity : undefined,
      record:
        body.record && typeof body.record === "object"
          ? (body.record as Record<string, unknown>)
          : undefined,
      auth: { userId: auth.userId, isOwner: auth.userId === app.ownerId },
    });

    if (!result.runId && result.status === "skipped") {
      throw new RuntimeError(
        "CONFIG_PARTIAL",
        "Workflow did not run (disabled or trigger mismatch)"
      );
    }

    return jsonSuccess({ run: result });
  } catch (err) {
    return handleRouteError(err);
  }
}

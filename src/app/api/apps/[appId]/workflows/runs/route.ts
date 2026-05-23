import { getAuthFromRequest, getAppWithAccess } from "@/lib/auth/request";
import { listWorkflowRuns } from "@/lib/runtime/workflow-engine";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";

type Params = { params: Promise<{ appId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId } = await params;
    const auth = await getAuthFromRequest(req);
    await getAppWithAccess(appId, auth);

    const url = new URL(req.url);
    const workflow = url.searchParams.get("workflow") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

    const runs = await listWorkflowRuns(appId, workflow, limit);

    return jsonSuccess({
      runs: runs.map((r) => ({
        id: r.id,
        workflow: r.workflow.name,
        status: r.status,
        event: r.event,
        input: r.input,
        logs: r.logs,
        output: r.output,
        error: r.error,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

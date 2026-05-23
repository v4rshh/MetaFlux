import { getAuthFromRequest, getAppWithAccess } from "@/lib/auth/request";
import {
  createRecord,
  listRecords,
} from "@/lib/runtime/crud-executor";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

type Params = { params: Promise<{ appId: string; entity: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId, entity } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

    const result = await listRecords(
      appId,
      entity,
      { userId: auth.userId, isOwner: auth.userId === app.ownerId },
      app.ownerId,
      { page, limit, order }
    );

    return jsonSuccess(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { appId, entity } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const record = await createRecord(
      appId,
      entity,
      body,
      { userId: auth.userId, isOwner: auth.userId === app.ownerId },
      app.ownerId
    );

    return jsonSuccess({ record }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

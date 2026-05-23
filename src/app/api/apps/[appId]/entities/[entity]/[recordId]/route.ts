import { getAuthFromRequest, getAppWithAccess } from "@/lib/auth/request";
import {
  getRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/runtime/crud-executor";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

type Params = {
  params: Promise<{ appId: string; entity: string; recordId: string }>;
};

export async function GET(req: Request, { params }: Params) {
  try {
    const { appId, entity, recordId } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    const record = await getRecord(
      appId,
      entity,
      recordId,
      { userId: auth.userId, isOwner: auth.userId === app.ownerId },
      app.ownerId
    );

    return jsonSuccess({ record });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { appId, entity, recordId } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const record = await updateRecord(
      appId,
      entity,
      recordId,
      body,
      { userId: auth.userId, isOwner: auth.userId === app.ownerId },
      app.ownerId
    );

    return jsonSuccess({ record });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { appId, entity, recordId } = await params;
    const auth = await getAuthFromRequest(req);
    const { app } = await getAppWithAccess(appId, auth);

    const result = await deleteRecord(
      appId,
      entity,
      recordId,
      { userId: auth.userId, isOwner: auth.userId === app.ownerId },
      app.ownerId
    );

    return jsonSuccess(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

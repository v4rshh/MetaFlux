import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { extractBearerToken, verifyToken } from "./jwt";
import type { AuthContext } from "@/lib/runtime/crud-executor";

export async function getAuthFromRequest(
  req?: Request
): Promise<AuthContext & { email?: string }> {
  let authHeader: string | null = null;

  if (req) {
    authHeader = req.headers.get("authorization");
  } else {
    const h = await headers();
    authHeader = h.get("authorization");
  }

  const token = extractBearerToken(authHeader);
  if (!token) return { userId: null };

  const payload = await verifyToken(token);
  return { userId: payload.sub, email: payload.email };
}

export async function requireAuth(req?: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth.userId) {
    const { RuntimeError } = await import("@/lib/runtime/errors");
    throw new RuntimeError("UNAUTHORIZED", "Authentication required");
  }
  return auth;
}

export async function getAppWithAccess(
  appId: string,
  auth: AuthContext
) {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { id: true, slug: true, name: true, ownerId: true, configVersion: true },
  });

  if (!app) {
    const { RuntimeError } = await import("@/lib/runtime/errors");
    throw new RuntimeError("APP_NOT_FOUND", `App ${appId} not found`);
  }

  const isOwner = !!auth.userId && auth.userId === app.ownerId;
  return { app, isOwner };
}

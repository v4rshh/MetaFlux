import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/request";
import { createAppFromConfig } from "@/lib/runtime/schema-manager";
import { listEntityDefinitions } from "@/lib/runtime/schema-manager";
import { generateApiRoutes } from "@/lib/runtime/api-generator";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";
import type { AppConfigInput } from "@/lib/runtime/types";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    const apps = await prisma.app.findMany({
      where: { ownerId: auth.userId! },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        configVersion: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { entities: true, records: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return jsonSuccess({ apps });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const payload = (body ?? {}) as {
      config?: AppConfigInput;
      slug?: string;
    };

    const configInput = payload.config ?? (body as AppConfigInput);
    const { app, config } = await createAppFromConfig(
      auth.userId!,
      configInput,
      typeof payload.slug === "string" ? payload.slug : undefined
    );

    const entities = await listEntityDefinitions(app.id);
    const routes = generateApiRoutes(app.id, app.slug, entities);

    return jsonSuccess(
      { app, routes },
      { status: 201, warnings: config.warnings }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

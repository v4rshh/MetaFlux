import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { RuntimeError } from "./errors";
import {
  normalizeAllEntities,
  normalizeAppConfig,
  normalizeEntitySchema,
} from "./config-normalizer";
import type { AppConfigInput, NormalizedAppConfig, NormalizedEntity } from "./types";

export interface SyncResult {
  appId: string;
  entitiesCreated: number;
  entitiesUpdated: number;
  workflowsCreated: number;
  workflowsUpdated: number;
  warnings: import("./types").ConfigWarning[];
}

export async function syncAppSchema(
  appId: string,
  configInput: AppConfigInput
): Promise<SyncResult> {
  const normalized = normalizeAppConfig(configInput);
  const entities = normalizeAllEntities(normalized);

  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) {
    throw new RuntimeError("APP_NOT_FOUND", `App ${appId} not found`);
  }

  let entitiesCreated = 0;
  let entitiesUpdated = 0;
  let workflowsCreated = 0;
  let workflowsUpdated = 0;

  const entityNames = new Set(entities.map((e) => e.name));

  for (const entity of entities) {
    const schemaJson = JSON.parse(
      JSON.stringify(entityToSchemaJson(entity))
    ) as Prisma.InputJsonValue;
    const existing = await prisma.entityDefinition.findUnique({
      where: { appId_name: { appId, name: entity.name } },
    });

    if (existing) {
      await prisma.entityDefinition.update({
        where: { id: existing.id },
        data: {
          label: entity.label,
          schema: schemaJson,
          relations: (entity.relations ?? undefined) as Prisma.InputJsonValue | undefined,
          scopes: { scope: entity.scope } as Prisma.InputJsonValue,
        },
      });
      entitiesUpdated++;
    } else {
      await prisma.entityDefinition.create({
        data: {
          appId,
          name: entity.name,
          label: entity.label,
          schema: schemaJson,
          relations: (entity.relations ?? undefined) as Prisma.InputJsonValue | undefined,
          scopes: { scope: entity.scope } as Prisma.InputJsonValue,
        },
      });
      entitiesCreated++;
    }
  }

  const stale = await prisma.entityDefinition.findMany({
    where: { appId, name: { notIn: [...entityNames] } },
  });
  for (const s of stale) {
    await prisma.entityDefinition.delete({ where: { id: s.id } });
  }

  for (const workflow of normalized.workflows) {
    const existing = await prisma.workflowDefinition.findUnique({
      where: { appId_name: { appId, name: workflow.name } },
    });
    const data = {
      trigger: (workflow.trigger ?? { type: "manual" }) as Prisma.InputJsonValue,
      steps: (workflow.steps ?? []) as Prisma.InputJsonValue,
      enabled: workflow.enabled ?? true,
    };

    if (existing) {
      await prisma.workflowDefinition.update({
        where: { id: existing.id },
        data,
      });
      workflowsUpdated++;
    } else {
      await prisma.workflowDefinition.create({
        data: { appId, name: workflow.name, ...data },
      });
      workflowsCreated++;
    }
  }

  await prisma.app.update({
    where: { id: appId },
    data: {
      config: JSON.parse(JSON.stringify(normalized)) as Prisma.InputJsonValue,
      configVersion: normalized.version,
      name: normalized.name,
    },
  });

  return {
    appId,
    entitiesCreated,
    entitiesUpdated,
    workflowsCreated,
    workflowsUpdated,
    warnings: normalized.warnings,
  };
}

function entityToSchemaJson(entity: NormalizedEntity) {
  return {
    fields: entity.fields.map(({ _source, _warnings, ...f }) => f),
    scope: entity.scope,
    warnings: entity.warnings,
  };
}

export async function getEntityDefinition(
  appId: string,
  entityName: string
): Promise<NormalizedEntity> {
  const def = await prisma.entityDefinition.findUnique({
    where: { appId_name: { appId, name: entityName } },
  });

  if (!def) {
    throw new RuntimeError(
      "ENTITY_NOT_FOUND",
      `Entity "${entityName}" is not defined for this app`
    );
  }

  const schema = def.schema as { fields?: unknown[]; scope?: string };
  return normalizeEntitySchema({
    name: def.name,
    label: def.label ?? def.name,
    fields: schema.fields ?? [],
    scope: (schema.scope as "public" | "user" | "owner") ?? "user",
    relations: (def.relations as Record<string, unknown>) ?? undefined,
  });
}

export async function listEntityDefinitions(
  appId: string
): Promise<NormalizedEntity[]> {
  const defs = await prisma.entityDefinition.findMany({
    where: { appId },
    orderBy: { name: "asc" },
  });

  return defs.map((def) => {
    const schema = def.schema as { fields?: unknown[]; scope?: string };
    return normalizeEntitySchema({
      name: def.name,
      label: def.label ?? def.name,
      fields: schema.fields ?? [],
      scope: (schema.scope as "public" | "user" | "owner") ?? "user",
    });
  });
}

export async function createAppFromConfig(
  ownerId: string,
  configInput: AppConfigInput,
  slugOverride?: string
) {
  const normalized = normalizeAppConfig(configInput);
  const slug = slugOverride ?? normalized.slug;

  const existing = await prisma.app.findUnique({ where: { slug } });
  if (existing) {
    throw new RuntimeError("DUPLICATE_SLUG", `App slug "${slug}" already exists`);
  }

  const app = await prisma.app.create({
    data: {
      slug,
      name: normalized.name,
      description: normalized.description,
      config: JSON.parse(JSON.stringify(normalized)) as Prisma.InputJsonValue,
      configVersion: normalized.version,
      ownerId,
    },
  });

  await syncAppSchema(app.id, configInput);

  return { app, config: normalized };
}

import { prisma } from "@/lib/db/prisma";
import { RuntimeError } from "./errors";
import { getEntityDefinition } from "./schema-manager";
import { validateRecordInput } from "./validator";
import type { NormalizedEntity } from "./types";

export interface AuthContext {
  userId: string | null;
  isOwner?: boolean;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

function applyScopeFilter(
  entity: NormalizedEntity,
  auth: AuthContext,
  appOwnerId: string
) {
  switch (entity.scope) {
    case "public":
      return {};
    case "owner":
      if (!auth.userId) {
        throw new RuntimeError("UNAUTHORIZED", "Authentication required");
      }
      if (!auth.isOwner && auth.userId !== appOwnerId) {
        throw new RuntimeError("FORBIDDEN", "Owner scope: access denied");
      }
      return {};
    case "user":
    default:
      if (!auth.userId) {
        throw new RuntimeError("UNAUTHORIZED", "Authentication required for this entity");
      }
      return { userId: auth.userId };
  }
}

export async function createRecord(
  appId: string,
  entityName: string,
  input: unknown,
  auth: AuthContext,
  appOwnerId: string
) {
  const entity = await getEntityDefinition(appId, entityName);
  const validation = validateRecordInput(entity, input, { operation: "create" });

  if (!validation.valid) {
    throw new RuntimeError("VALIDATION_FAILED", "Validation failed", {
      status: 422,
      details: { issues: validation.issues, stripped: validation.stripped },
    });
  }

  const entityDef = await prisma.entityDefinition.findUniqueOrThrow({
    where: { appId_name: { appId, name: entityName } },
  });

  const scopeFilter = applyScopeFilter(entity, auth, appOwnerId);
  const userId =
    entity.scope === "user" ? auth.userId : entity.scope === "owner" ? auth.userId : null;

  const record = await prisma.entityRecord.create({
    data: {
      appId,
      entityId: entityDef.id,
      userId: userId ?? undefined,
      data: validation.data as object,
    },
  });

  const formatted = formatRecord(record, validation.stripped, entity);
  void import("./workflow-engine").then(({ dispatchWorkflows }) =>
    dispatchWorkflows({
      appId,
      event: "record.create",
      entity: entityName,
      record: formatted,
      auth,
    })
  );

  return formatted;
}

export async function getRecord(
  appId: string,
  entityName: string,
  recordId: string,
  auth: AuthContext,
  appOwnerId: string
) {
  const entity = await getEntityDefinition(appId, entityName);
  const entityDef = await prisma.entityDefinition.findUniqueOrThrow({
    where: { appId_name: { appId, name: entityName } },
  });

  const scopeWhere = applyScopeFilter(entity, auth, appOwnerId);

  const record = await prisma.entityRecord.findFirst({
    where: { id: recordId, appId, entityId: entityDef.id, ...scopeWhere },
  });

  if (!record) {
    throw new RuntimeError("RECORD_NOT_FOUND", `Record ${recordId} not found`);
  }

  return formatRecord(record, [], entity);
}

export async function listRecords(
  appId: string,
  entityName: string,
  auth: AuthContext,
  appOwnerId: string,
  options: ListOptions = {}
) {
  const entity = await getEntityDefinition(appId, entityName);
  const entityDef = await prisma.entityDefinition.findUniqueOrThrow({
    where: { appId_name: { appId, name: entityName } },
  });

  const scopeWhere = applyScopeFilter(entity, auth, appOwnerId);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.entityRecord.findMany({
      where: { appId, entityId: entityDef.id, ...scopeWhere },
      orderBy: { createdAt: options.order === "asc" ? "asc" : "desc" },
      skip,
      take: limit,
    }),
    prisma.entityRecord.count({
      where: { appId, entityId: entityDef.id, ...scopeWhere },
    }),
  ]);

  return {
    items: records.map((r) => formatRecord(r, [], entity)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function updateRecord(
  appId: string,
  entityName: string,
  recordId: string,
  input: unknown,
  auth: AuthContext,
  appOwnerId: string
) {
  const entity = await getEntityDefinition(appId, entityName);
  const validation = validateRecordInput(entity, input, {
    operation: "update",
    partial: true,
  });

  if (!validation.valid) {
    throw new RuntimeError("VALIDATION_FAILED", "Validation failed", {
      status: 422,
      details: { issues: validation.issues, stripped: validation.stripped },
    });
  }

  const entityDef = await prisma.entityDefinition.findUniqueOrThrow({
    where: { appId_name: { appId, name: entityName } },
  });

  const scopeWhere = applyScopeFilter(entity, auth, appOwnerId);

  const existing = await prisma.entityRecord.findFirst({
    where: { id: recordId, appId, entityId: entityDef.id, ...scopeWhere },
  });

  if (!existing) {
    throw new RuntimeError("RECORD_NOT_FOUND", `Record ${recordId} not found`);
  }

  const previousFormatted = formatRecord(existing, [], entity);
  const merged = {
    ...(existing.data as Record<string, unknown>),
    ...validation.data,
  };

  const record = await prisma.entityRecord.update({
    where: { id: recordId },
    data: { data: merged as object },
  });

  const formatted = formatRecord(record, validation.stripped, entity);
  void import("./workflow-engine").then(({ dispatchWorkflows }) =>
    dispatchWorkflows({
      appId,
      event: "record.update",
      entity: entityName,
      record: formatted,
      previousRecord: previousFormatted,
      auth,
    })
  );

  return formatted;
}

export async function deleteRecord(
  appId: string,
  entityName: string,
  recordId: string,
  auth: AuthContext,
  appOwnerId: string
) {
  const entity = await getEntityDefinition(appId, entityName);
  const entityDef = await prisma.entityDefinition.findUniqueOrThrow({
    where: { appId_name: { appId, name: entityName } },
  });

  const scopeWhere = applyScopeFilter(entity, auth, appOwnerId);

  const existing = await prisma.entityRecord.findFirst({
    where: { id: recordId, appId, entityId: entityDef.id, ...scopeWhere },
  });

  if (!existing) {
    throw new RuntimeError("RECORD_NOT_FOUND", `Record ${recordId} not found`);
  }

  await prisma.entityRecord.delete({ where: { id: recordId } });
  return { deleted: true, id: recordId };
}

function formatRecord(
  record: {
    id: string;
    data: unknown;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  stripped: string[],
  entity: NormalizedEntity
) {
  const data = (record.data ?? {}) as Record<string, unknown>;
  return {
    id: record.id,
    ...data,
    _meta: {
      entity: entity.name,
      userId: record.userId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(stripped.length ? { strippedFields: stripped } : {}),
    },
  };
}

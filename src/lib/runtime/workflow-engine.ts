import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "./crud-executor";

export type WorkflowEvent = "record.create" | "record.update" | "manual";

export interface WorkflowDispatchContext {
  appId: string;
  event: WorkflowEvent;
  entity?: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  auth: AuthContext;
}

export interface StepLog {
  step: number;
  type: string;
  status: "ok" | "skipped" | "failed";
  message?: string;
  output?: unknown;
}

interface WorkflowTrigger {
  type?: string;
  entity?: string;
  field?: string;
  value?: unknown;
}

interface WorkflowStep {
  type?: string;
  config?: Record<string, unknown>;
  when?: { field?: string; equals?: unknown };
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function matchesTrigger(
  trigger: WorkflowTrigger,
  ctx: WorkflowDispatchContext
): boolean {
  const type = trigger.type ?? "manual";
  if (type === "manual") return ctx.event === "manual";
  if (ctx.event !== type) return false;
  if (trigger.entity && trigger.entity !== ctx.entity) return false;

  if (type === "record.update" && trigger.field !== undefined) {
    const current = ctx.record ? getNested(ctx.record, trigger.field) : undefined;
    if (trigger.value !== undefined && current !== trigger.value) return false;
    const prev = ctx.previousRecord
      ? getNested(ctx.previousRecord, trigger.field)
      : undefined;
    if (trigger.value !== undefined && prev === trigger.value) return false;
  }

  return true;
}

function stepConditionMet(
  step: WorkflowStep,
  ctx: WorkflowDispatchContext
): boolean {
  if (!step.when?.field) return true;
  const val = ctx.record ? getNested(ctx.record, step.when.field) : undefined;
  return val === step.when.equals;
}

async function executeStep(
  step: WorkflowStep,
  index: number,
  ctx: WorkflowDispatchContext
): Promise<StepLog> {
  const type = (step.type ?? "log").toLowerCase();
  const config = step.config ?? {};

  if (!stepConditionMet(step, ctx)) {
    return { step: index, type, status: "skipped", message: "Condition not met" };
  }

  try {
    switch (type) {
      case "log":
      case "notify": {
        const message =
          (config.message as string) ??
          `Workflow event ${ctx.event} on ${ctx.entity ?? "app"}`;
        if (process.env.NODE_ENV !== "test") {
          console.info(`[workflow] ${message}`);
        }
        return { step: index, type, status: "ok", message, output: { message } };
      }
      case "set_field": {
        const field = config.field as string;
        const value = config.value;
        if (!field || !ctx.record?.id || !ctx.entity) {
          return {
            step: index,
            type,
            status: "skipped",
            message: "set_field requires field, entity, and record id",
          };
        }
        const entityDef = await prisma.entityDefinition.findUnique({
          where: { appId_name: { appId: ctx.appId, name: ctx.entity } },
        });
        if (!entityDef) {
          return { step: index, type, status: "failed", message: "Entity not found" };
        }
        const existing = await prisma.entityRecord.findFirst({
          where: { id: String(ctx.record.id), appId: ctx.appId, entityId: entityDef.id },
        });
        if (!existing) {
          return { step: index, type, status: "failed", message: "Record not found" };
        }
        const data = {
          ...(existing.data as Record<string, unknown>),
          [field]: value,
        };
        await prisma.entityRecord.update({
          where: { id: existing.id },
          data: { data: data as object },
        });
        if (ctx.record) ctx.record[field] = value;
        return {
          step: index,
          type,
          status: "ok",
          message: `Set ${field}`,
          output: { field, value },
        };
      }
      case "webhook": {
        const url = config.url as string;
        if (!url || typeof url !== "string") {
          return { step: index, type, status: "skipped", message: "webhook missing url" };
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(url, {
            method: (config.method as string) ?? "POST",
            headers: {
              "Content-Type": "application/json",
              ...(config.headers as Record<string, string>),
            },
            body: JSON.stringify({
              event: ctx.event,
              entity: ctx.entity,
              record: ctx.record,
            }),
            signal: controller.signal,
          });
          return {
            step: index,
            type,
            status: res.ok ? "ok" : "failed",
            message: `HTTP ${res.status}`,
            output: { status: res.status },
          };
        } finally {
          clearTimeout(timeout);
        }
      }
      default:
        return {
          step: index,
          type,
          status: "skipped",
          message: `Unknown step type "${type}"`,
        };
    }
  } catch (err) {
    return {
      step: index,
      type,
      status: "failed",
      message: err instanceof Error ? err.message : "Step failed",
    };
  }
}

export async function runWorkflow(
  workflowId: string,
  ctx: WorkflowDispatchContext,
  options?: { bypassTrigger?: boolean }
): Promise<{ runId: string; status: string; logs: StepLog[] }> {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
  });

  if (!workflow || !workflow.enabled) {
    return { runId: "", status: "skipped", logs: [] };
  }

  const trigger = workflow.trigger as WorkflowTrigger;
  if (!options?.bypassTrigger && !matchesTrigger(trigger, ctx)) {
    return { runId: "", status: "skipped", logs: [] };
  }

  const steps = (Array.isArray(workflow.steps) ? workflow.steps : []) as WorkflowStep[];
  const run = await prisma.workflowRun.create({
    data: {
      appId: ctx.appId,
      workflowId: workflow.id,
      status: "running",
      event: ctx.event,
      input: {
        entity: ctx.entity,
        recordId: ctx.record?.id,
      } as Prisma.InputJsonValue,
      logs: [] as Prisma.InputJsonValue,
    },
  });

  const logs: StepLog[] = [];
  let status = "completed";
  let error: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const log = await executeStep(steps[i], i, ctx);
    logs.push(log);
    if (log.status === "failed") {
      status = "failed";
      error = log.message;
      break;
    }
  }

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status,
      logs: logs as unknown as Prisma.InputJsonValue,
      output: { stepsExecuted: logs.length } as Prisma.InputJsonValue,
      error,
      finishedAt: new Date(),
    },
  });

  return { runId: run.id, status, logs };
}

export async function dispatchWorkflows(ctx: WorkflowDispatchContext): Promise<void> {
  const workflows = await prisma.workflowDefinition.findMany({
    where: { appId: ctx.appId, enabled: true },
  });

  await Promise.all(
    workflows.map((w) =>
      runWorkflow(w.id, ctx).catch((err) => {
        console.error(`[workflow] ${w.name} failed:`, err);
      })
    )
  );
}

export async function runWorkflowByName(
  appId: string,
  name: string,
  ctx: Omit<WorkflowDispatchContext, "appId" | "event"> & { event?: WorkflowEvent }
): Promise<{ runId: string; status: string; logs: StepLog[] }> {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { appId_name: { appId, name } },
  });

  if (!workflow) {
    const { RuntimeError } = await import("./errors");
    throw new RuntimeError("ENTITY_NOT_FOUND", `Workflow "${name}" not found`);
  }

  const event = ctx.event ?? "manual";
  return runWorkflow(
    workflow.id,
    {
      appId,
      event,
      entity: ctx.entity,
      record: ctx.record,
      previousRecord: ctx.previousRecord,
      auth: ctx.auth,
    },
    { bypassTrigger: event === "manual" }
  );
}

export async function listWorkflowRuns(appId: string, workflowName?: string, limit = 20) {
  const where: { appId: string; workflowId?: string } = { appId };
  if (workflowName) {
    const wf = await prisma.workflowDefinition.findUnique({
      where: { appId_name: { appId, name: workflowName } },
    });
    if (wf) where.workflowId = wf.id;
  }

  return prisma.workflowRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { workflow: { select: { name: true } } },
  });
}

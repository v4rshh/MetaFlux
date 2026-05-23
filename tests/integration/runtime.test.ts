import "./../setup-env";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  canConnect,
  createTestUser,
  prisma,
  resetTestData,
  TASK_MANAGER_CONFIG,
} from "../helpers/db";
import { createAppFromConfig } from "@/lib/runtime/schema-manager";
import {
  createRecord,
  updateRecord,
  listRecords,
  deleteRecord,
} from "@/lib/runtime/crud-executor";
import { runWorkflowByName } from "@/lib/runtime/workflow-engine";
import { signToken } from "@/lib/auth/jwt";
import { RuntimeError } from "@/lib/runtime/errors";

const suiteSkip = process.env.DATABASE_URL
  ? undefined
  : "DATABASE_URL not set — copy .env.example to .env";

describe("runtime integration", { skip: suiteSkip }, () => {
  let ready = false;
  let userId = "";
  let appId = "";
  let token = "";

  before(async () => {
    if (!(await canConnect())) return;

    await resetTestData();
    const user = await createTestUser("-int");
    userId = user.id;
    token = await signToken({ sub: user.id, email: user.email });

    const { app } = await createAppFromConfig(userId, {
      ...TASK_MANAGER_CONFIG,
      slug: `int-test-${Date.now()}`,
    });
    appId = app.id;
    ready = true;
  });

  after(async () => {
    if (!ready) return;
    await resetTestData();
    await prisma.$disconnect();
  });

  it("creates and lists user-scoped records", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const auth = { userId, isOwner: true };
    const created = await createRecord(
      appId,
      "tasks",
      { title: "Write tests" },
      auth,
      userId
    );
    assert.equal(created.title, "Write tests");
    assert.equal(created.status, "todo");

    const list = await listRecords(appId, "tasks", auth, userId);
    assert.equal(list.items.length, 1);
  });

  it("rejects missing required fields", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const auth = { userId, isOwner: true };
    await assert.rejects(
      () => createRecord(appId, "tasks", {}, auth, userId),
      (err: unknown) => err instanceof RuntimeError && err.code === "VALIDATION_FAILED"
    );
  });

  it("isolates data between users", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const other = await createTestUser("-other");
    const list = await listRecords(
      appId,
      "tasks",
      { userId: other.id, isOwner: false },
      userId
    );
    assert.equal(list.items.length, 0);
  });

  it("runs workflow on record update trigger", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const auth = { userId, isOwner: true };
    const list = await listRecords(appId, "tasks", auth, userId);
    const id = list.items[0].id as string;

    await updateRecord(appId, "tasks", id, { status: "done" }, auth, userId);
    await new Promise((r) => setTimeout(r, 400));

    const runs = await prisma.workflowRun.findMany({
      where: { appId, status: "completed" },
      include: { workflow: true },
    });

    const doneRun = runs.find((r) => r.workflow.name === "on-done");
    assert.ok(doneRun, "expected on-done workflow run");
    const logs = doneRun!.logs as { type: string; status: string }[];
    assert.ok(logs.some((l) => l.type === "notify" && l.status === "ok"));
  });

  it("runs workflow manually via engine", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const result = await runWorkflowByName(appId, "on-done", {
      event: "manual",
      entity: "tasks",
      record: { id: "manual", status: "done" },
      auth: { userId, isOwner: true },
    });
    assert.ok(result.runId);
    assert.equal(result.status, "completed");
  });

  it("deletes a record", async (t) => {
    if (!ready) return t.skip("Database not reachable");

    const auth = { userId, isOwner: true };
    const list = await listRecords(appId, "tasks", auth, userId);
    const id = list.items[0].id as string;
    const result = await deleteRecord(appId, "tasks", id, auth, userId);
    assert.equal(result.deleted, true);
  });

  it("auth token is valid shape", (t) => {
    if (!ready) return t.skip("Database not reachable");
    assert.ok(token.length > 20);
  });
});

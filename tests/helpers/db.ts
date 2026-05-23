import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";

export const prisma = new PrismaClient();

export async function canConnect(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function resetTestData() {
  await prisma.workflowRun.deleteMany();
  await prisma.entityRecord.deleteMany();
  await prisma.entityDefinition.deleteMany();
  await prisma.workflowDefinition.deleteMany();
  await prisma.app.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@metafroge.test" } },
  });
}

export async function createTestUser(suffix = "") {
  const email = `user${suffix}@metafroge.test`;
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: await hashPassword("testpass123"),
      name: "Test User",
    },
    update: {},
  });
}

export const TASK_MANAGER_CONFIG = {
  name: "Task Manager Test",
  slug: `task-manager-test-${Date.now()}`,
  entities: [
    {
      name: "tasks",
      scope: "user",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "status", type: "enum", enum: ["todo", "done"], default: "todo" },
      ],
    },
  ],
  workflows: [
    {
      name: "on-done",
      trigger: { type: "record.update", entity: "tasks", field: "status", value: "done" },
      steps: [{ type: "notify", config: { message: "Task completed" } }],
    },
  ],
};

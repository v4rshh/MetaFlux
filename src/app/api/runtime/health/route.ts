import { prisma } from "@/lib/db/prisma";
import { jsonSuccess } from "@/lib/api/response";

export async function GET() {
  let db = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "connected";
  } catch {
    db = "disconnected";
  }

  return jsonSuccess({
    status: "ok",
    service: "metafroge-runtime",
    database: db,
    timestamp: new Date().toISOString(),
  });
}

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { jsonSuccess, handleRouteError, jsonError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const { email, password, name } = (body ?? {}) as Record<string, unknown>;

    if (typeof email !== "string" || !email.includes("@")) {
      throw new RuntimeError("VALIDATION_FAILED", "Valid email is required", {
        details: { field: "email" },
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      throw new RuntimeError("VALIDATION_FAILED", "Password must be at least 8 characters", {
        details: { field: "password" },
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return jsonError("DUPLICATE_SLUG", "Email already registered", 409);
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: await hashPassword(password),
        name: typeof name === "string" ? name : undefined,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const token = await signToken({ sub: user.id, email: user.email });

    return jsonSuccess(
      { user, token },
      { status: 201 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

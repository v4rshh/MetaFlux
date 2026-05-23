import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { jsonSuccess, handleRouteError } from "@/lib/api/response";
import { RuntimeError } from "@/lib/runtime/errors";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new RuntimeError("MALFORMED_INPUT", "Invalid JSON body");
    }

    const { email, password } = (body ?? {}) as Record<string, unknown>;

    if (typeof email !== "string" || typeof password !== "string") {
      throw new RuntimeError("VALIDATION_FAILED", "Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new RuntimeError("UNAUTHORIZED", "Invalid email or password");
    }

    const token = await signToken({ sub: user.id, email: user.email });

    return jsonSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

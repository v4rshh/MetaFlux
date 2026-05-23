import { SignJWT, jwtVerify } from "jose";
import { RuntimeError } from "@/lib/runtime/errors";

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(s);
};

export interface TokenPayload {
  sub: string;
  email: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET());
    const sub = payload.sub;
    const email = payload.email;
    if (!sub || typeof email !== "string") {
      throw new RuntimeError("UNAUTHORIZED", "Invalid token payload");
    }
    return { sub, email };
  } catch {
    throw new RuntimeError("UNAUTHORIZED", "Invalid or expired token");
  }
}

export function extractBearerToken(
  header: string | null
): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

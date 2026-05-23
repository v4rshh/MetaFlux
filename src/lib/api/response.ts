import { NextResponse } from "next/server";
import { isRuntimeError } from "@/lib/runtime/errors";

export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
  warnings?: unknown[];
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    warnings?: unknown[];
  };
}

export function jsonSuccess<T>(
  data: T,
  init?: { status?: number; warnings?: unknown[]; meta?: Record<string, unknown> }
) {
  const body: ApiSuccess<T> = { ok: true, data };
  if (init?.warnings?.length) body.warnings = init.warnings;
  if (init?.meta) body.meta = init.meta;
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function jsonError(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
  warnings?: unknown[]
) {
  const body: ApiFailure = {
    ok: false,
    error: { code, message, details, warnings },
  };
  return NextResponse.json(body, { status });
}

export function handleRouteError(err: unknown) {
  if (isRuntimeError(err)) {
    return jsonError(
      err.code,
      err.message,
      err.status,
      err.details,
      err.warnings
    );
  }
  console.error("[api]", err);
  return jsonError(
    "INTERNAL_ERROR",
    err instanceof Error ? err.message : "Unexpected error",
    500
  );
}

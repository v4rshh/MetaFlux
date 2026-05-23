export type RuntimeErrorCode =
  | "CONFIG_INVALID"
  | "CONFIG_PARTIAL"
  | "ENTITY_NOT_FOUND"
  | "RECORD_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "SCHEMA_MISMATCH"
  | "MALFORMED_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "APP_NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "INTERNAL_ERROR";

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly warnings?: unknown[];

  constructor(
    code: RuntimeErrorCode,
    message: string,
    options?: {
      status?: number;
      details?: unknown;
      warnings?: unknown[];
    }
  ) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.status = options?.status ?? statusForCode(code);
    this.details = options?.details;
    this.warnings = options?.warnings;
  }
}

function statusForCode(code: RuntimeErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "RECORD_NOT_FOUND":
    case "ENTITY_NOT_FOUND":
    case "APP_NOT_FOUND":
      return 404;
    case "DUPLICATE_SLUG":
      return 409;
    case "VALIDATION_FAILED":
    case "SCHEMA_MISMATCH":
    case "MALFORMED_INPUT":
    case "CONFIG_INVALID":
      return 422;
    case "CONFIG_PARTIAL":
      return 200;
    default:
      return 500;
  }
}

export function isRuntimeError(err: unknown): err is RuntimeError {
  return err instanceof RuntimeError;
}

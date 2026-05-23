import { z } from "zod";
import type { FieldDefinition, NormalizedEntity, ValidationIssue, ValidationResult } from "./types";

function zodForField(field: FieldDefinition): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "number":
      schema = z.coerce.number();
      if (field.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(field.validation.min);
      }
      if (field.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(field.validation.max);
      }
      break;
    case "boolean":
      schema = z.union([
        z.boolean(),
        z.literal("true").transform(() => true),
        z.literal("false").transform(() => false),
        z.literal(1).transform(() => true),
        z.literal(0).transform(() => false),
      ]);
      break;
    case "date":
    case "datetime":
      schema = z.union([z.string(), z.date()]).transform((v) =>
        v instanceof Date ? v.toISOString() : String(v)
      );
      break;
    case "email":
      schema = z.string().email();
      break;
    case "url":
      schema = z.string().url();
      break;
    case "json":
      schema = z.union([
        z.record(z.unknown()),
        z.array(z.unknown()),
        z.string().transform((s) => {
          try {
            return JSON.parse(s);
          } catch {
            return s;
          }
        }),
      ]);
      break;
    case "enum":
      if (field.enum?.length) {
        schema = z.enum(field.enum as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
    case "relation":
      schema = z.union([z.string(), z.number(), z.null()]);
      break;
    case "text":
    case "string":
    default: {
      let s = z.string();
      if (field.validation?.minLength !== undefined) {
        s = s.min(field.validation.minLength);
      }
      if (field.validation?.maxLength !== undefined) {
        s = s.max(field.validation.maxLength);
      }
      if (field.validation?.pattern) {
        try {
          s = s.regex(new RegExp(field.validation.pattern));
        } catch {
          /* invalid regex — skip */
        }
      }
      schema = s;
    }
  }

  if (!field.required) {
    schema = schema.optional().nullable();
  }

  if (field.default !== undefined) {
    schema = schema.default(field.default as never);
  }

  return schema;
}

export function buildEntityZodSchema(entity: NormalizedEntity): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const field of entity.fields) {
    if (field.name === "id") continue;
    shape[field.name] = zodForField(field);
  }

  return z.object(shape).passthrough();
}

export function validateRecordInput(
  entity: NormalizedEntity,
  input: unknown,
  options?: { partial?: boolean; operation?: "create" | "update" }
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const stripped: string[] = [];

  if (input === null || input === undefined) {
    if (options?.partial) {
      return { valid: true, data: {}, issues: [], stripped };
    }
    return {
      valid: false,
      data: {},
      issues: [{ field: "_body", code: "MALFORMED_INPUT", message: "Request body is required" }],
      stripped,
    };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      data: {},
      issues: [
        {
          field: "_body",
          code: "MALFORMED_INPUT",
          message: "Request body must be a JSON object",
        },
      ],
      stripped,
    };
  }

  const raw = input as Record<string, unknown>;
  const known = new Set(entity.fields.map((f) => f.name));
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) {
      stripped.push(key);
      continue;
    }
    if (key === "id" && options?.operation === "create") {
      stripped.push(key);
      continue;
    }
    data[key] = value;
  }

  const schema = buildEntityZodSchema(entity);
  const toValidate =
    options?.partial || options?.operation === "update"
      ? schema.partial()
      : schema;

  const parsed = toValidate.safeParse(data);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".") || "_root";
      issues.push({
        field,
        code: issue.code.toUpperCase(),
        message: issue.message,
      });
    }
  }

  const requiredOnCreate = entity.fields.filter(
    (f) => f.required && f.name !== "id" && f.default === undefined
  );
  if (options?.operation === "create" || !options?.partial) {
    for (const field of requiredOnCreate) {
      if (options?.operation === "update" && !(field.name in data)) continue;
      if (data[field.name] === undefined || data[field.name] === null) {
        if (!issues.some((i) => i.field === field.name)) {
          issues.push({
            field: field.name,
            code: "REQUIRED",
            message: `${field.label ?? field.name} is required`,
          });
        }
      }
    }
  }

  const resultData = parsed.success ? (parsed.data as Record<string, unknown>) : data;

  for (const field of entity.fields) {
    if (
      field.default !== undefined &&
      resultData[field.name] === undefined &&
      options?.operation === "create"
    ) {
      resultData[field.name] = field.default;
    }
  }

  return {
    valid: issues.length === 0,
    data: resultData,
    issues,
    stripped,
  };
}


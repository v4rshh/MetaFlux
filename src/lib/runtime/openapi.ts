import type { NormalizedEntity, FieldDefinition } from "./types";
import type { GeneratedRoute } from "./api-generator";

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers: { url: string; description?: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
  security: { bearerAuth: string[] }[];
}

function fieldToOpenApiSchema(field: FieldDefinition): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  switch (field.type) {
    case "number":
      base.type = "number";
      break;
    case "boolean":
      base.type = "boolean";
      break;
    case "enum":
      base.type = "string";
      if (field.enum?.length) base.enum = field.enum;
      break;
    case "date":
    case "datetime":
      base.type = "string";
      base.format = field.type === "date" ? "date" : "date-time";
      break;
    case "email":
      base.type = "string";
      base.format = "email";
      break;
    case "url":
      base.type = "string";
      base.format = "uri";
      break;
    case "json":
      base.type = "object";
      base.additionalProperties = true;
      break;
    case "text":
      base.type = "string";
      break;
    default:
      base.type = "string";
  }

  if (field.label) base.description = field.label;
  if (field.default !== undefined) base.default = field.default;
  if (!field.required) base.nullable = true;

  return base;
}

export function entityToOpenApiSchema(entity: NormalizedEntity): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    id: { type: "string", description: "Record ID" },
  };
  const required: string[] = [];

  for (const field of entity.fields) {
    if (field.name === "id") continue;
    properties[field.name] = fieldToOpenApiSchema(field);
    if (field.required) required.push(field.name);
  }

  properties._meta = {
    type: "object",
    properties: {
      entity: { type: "string" },
      userId: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  };

  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

function apiResponseSchema(inner: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      ok: { type: "boolean", enum: [true] },
      data: inner,
      warnings: { type: "array", items: { type: "object" } },
      meta: { type: "object" },
    },
  };
}

function errorResponseSchema() {
  return {
    type: "object",
    properties: {
      ok: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: { type: "object" },
          warnings: { type: "array" },
        },
      },
    },
  };
}

function op(
  summary: string,
  tags: string[],
  extra?: Record<string, unknown>
) {
  return {
    summary,
    tags,
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Success",
        content: { "application/json": { schema: apiResponseSchema({ type: "object" }) } },
      },
      "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema() } } },
      "422": { description: "Validation error", content: { "application/json": { schema: errorResponseSchema() } } },
    },
    ...extra,
  };
}

export function generateOpenApiSpec(options: {
  appId?: string;
  appName: string;
  appSlug?: string;
  baseUrl: string;
  entities: NormalizedEntity[];
  routes: GeneratedRoute[];
  includePlatformRoutes?: boolean;
}): OpenApiSpec {
  const schemas: Record<string, unknown> = {
    ApiSuccess: apiResponseSchema({ type: "object" }),
    ApiError: errorResponseSchema(),
    RegisterRequest: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
        name: { type: "string" },
      },
    },
    LoginRequest: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string" },
        password: { type: "string" },
      },
    },
  };

  for (const entity of options.entities) {
    const key = entity.name.charAt(0).toUpperCase() + entity.name.slice(1);
    schemas[key] = entityToOpenApiSchema(entity);
    schemas[`${key}List`] = {
      type: "object",
      properties: {
        items: { type: "array", items: { $ref: `#/components/schemas/${key}` } },
        pagination: {
          type: "object",
          properties: {
            page: { type: "integer" },
            limit: { type: "integer" },
            total: { type: "integer" },
            pages: { type: "integer" },
          },
        },
      },
    };
  }

  const paths: Record<string, Record<string, unknown>> = {};

  if (options.includePlatformRoutes !== false) {
    paths["/api/auth/register"] = {
      post: {
        summary: "Register user",
        tags: ["Auth"],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
        },
        responses: { "201": { description: "Created" } },
      },
    };
    paths["/api/auth/login"] = {
      post: {
        summary: "Login",
        tags: ["Auth"],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: { "200": { description: "OK" } },
      },
    };
    paths["/api/runtime/validate"] = {
      post: {
        summary: "Validate app config JSON",
        tags: ["Runtime"],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "OK" } },
      },
    };
    paths["/api/runtime/health"] = {
      get: { summary: "Health check", tags: ["Runtime"], responses: { "200": { description: "OK" } } },
    };
    paths["/api/apps"] = {
      get: op("List owned apps", ["Apps"]),
      post: {
        ...op("Create app from config", ["Apps"]),
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
      },
    };
  }

  if (options.appId) {
    const appBase = `/api/apps/${options.appId}`;
    const tag = options.appName;

    paths[appBase] = { get: op("Get app", [tag]) };
    paths[`${appBase}/schema`] = { get: op("Entity schemas", [tag]) };
    paths[`${appBase}/sync`] = {
      post: {
        ...op("Sync schema from config", [tag]),
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
      },
    };
    paths[`${appBase}/openapi`] = { get: op("OpenAPI spec for this app", [tag]) };
    paths[`${appBase}/workflows`] = { get: op("List workflows", [tag]) };
    paths[`${appBase}/workflows/{name}/run`] = {
      post: {
        ...op("Run workflow manually", [tag]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  record: { type: "object" },
                },
              },
            },
          },
        },
      },
    };
    paths[`${appBase}/workflows/runs`] = { get: op("List workflow runs", [tag]) };

    for (const entity of options.entities) {
      const schemaKey = entity.name.charAt(0).toUpperCase() + entity.name.slice(1);
      const entityPath = `${appBase}/entities/${entity.name}`;

      paths[entityPath] = {
        get: {
          ...op(`List ${entity.label}`, [tag, entity.name]),
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": {
              description: "List",
              content: {
                "application/json": {
                  schema: apiResponseSchema({ $ref: `#/components/schemas/${schemaKey}List` }),
                },
              },
            },
          },
        },
        post: {
          ...op(`Create ${entity.label}`, [tag, entity.name]),
          requestBody: {
            content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaKey}` } } },
          },
        },
      };

      paths[`${entityPath}/{recordId}`] = {
        get: {
          ...op(`Get ${entity.label}`, [tag, entity.name]),
          parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
        },
        patch: {
          ...op(`Update ${entity.label}`, [tag, entity.name]),
          parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaKey}` } } },
          },
        },
        delete: {
          ...op(`Delete ${entity.label}`, [tag, entity.name]),
          parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
        },
      };
    }
  }

  if (options.appSlug) {
    paths[`/api/apps/by-slug/${options.appSlug}`] = {
      get: op("Resolve app by slug", ["Apps"]),
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: `${options.appName} API`,
      version: "1.0.0",
      description: options.appId
        ? `Generated API for app ${options.appSlug ?? options.appId}`
        : "MetaFlux platform API",
    },
    servers: [{ url: options.baseUrl, description: "API server" }],
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

export function getBaseUrl(req?: Request): string {
  if (req) {
    const url = new URL(req.url);
    return url.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

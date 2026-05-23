import type { NormalizedEntity } from "./types";

export interface GeneratedRoute {
  method: string;
  path: string;
  description: string;
  entity?: string;
  operation: "list" | "create" | "read" | "update" | "delete" | "schema";
}

/**
 * Derives REST route descriptors from normalized entity definitions.
 * Used for OpenAPI-style discovery and frontend API clients.
 */
export function generateApiRoutes(
  appId: string,
  appSlug: string,
  entities: NormalizedEntity[]
): GeneratedRoute[] {
  const base = `/api/apps/${appId}`;
  const routes: GeneratedRoute[] = [
    {
      method: "GET",
      path: `${base}`,
      description: "Get app metadata",
      operation: "read",
    },
    {
      method: "GET",
      path: `${base}/schema`,
      description: "List entity schemas",
      operation: "schema",
    },
    {
      method: "POST",
      path: `${base}/sync`,
      description: "Sync database schema from config",
      operation: "schema",
    },
    {
      method: "GET",
      path: `${base}/openapi`,
      description: "OpenAPI 3.0 specification",
      operation: "schema",
    },
    {
      method: "GET",
      path: `${base}/workflows`,
      description: "List workflow definitions",
      operation: "schema",
    },
    {
      method: "POST",
      path: `${base}/workflows/:name/run`,
      description: "Run workflow manually",
      operation: "schema",
    },
    {
      method: "GET",
      path: `${base}/workflows/runs`,
      description: "List workflow execution history",
      operation: "schema",
    },
    {
      method: "GET",
      path: `/api/apps/by-slug/${appSlug}`,
      description: "Resolve app by slug",
      operation: "read",
    },
  ];

  for (const entity of entities) {
    const entityPath = `${base}/entities/${entity.name}`;
    routes.push(
      {
        method: "GET",
        path: entityPath,
        description: `List ${entity.label} records`,
        entity: entity.name,
        operation: "list",
      },
      {
        method: "POST",
        path: entityPath,
        description: `Create ${entity.label} record`,
        entity: entity.name,
        operation: "create",
      },
      {
        method: "GET",
        path: `${entityPath}/:id`,
        description: `Get ${entity.label} by id`,
        entity: entity.name,
        operation: "read",
      },
      {
        method: "PATCH",
        path: `${entityPath}/:id`,
        description: `Update ${entity.label}`,
        entity: entity.name,
        operation: "update",
      },
      {
        method: "DELETE",
        path: `${entityPath}/:id`,
        description: `Delete ${entity.label}`,
        entity: entity.name,
        operation: "delete",
      }
    );
  }

  return routes;
}

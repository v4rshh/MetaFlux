export type FieldType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "url"
  | "json"
  | "enum"
  | "relation";

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  enum?: string[];
  relation?: {
    entity: string;
    type?: "one" | "many";
  };
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  /** Original config preserved for debugging */
  _source?: unknown;
  _warnings?: string[];
}

export interface EntityDefinitionConfig {
  name: string;
  label?: string;
  fields?: unknown[];
  scope?: "public" | "user" | "owner";
  relations?: Record<string, unknown>;
}

export interface WorkflowStep {
  type: string;
  config?: Record<string, unknown>;
}

export interface WorkflowDefinitionConfig {
  name: string;
  trigger?: Record<string, unknown>;
  steps?: unknown[];
  enabled?: boolean;
}

export interface AppConfigInput {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  version?: unknown;
  entities?: unknown;
  workflows?: unknown;
  ui?: unknown;
  settings?: unknown;
}

export interface NormalizedAppConfig {
  name: string;
  slug: string;
  description?: string;
  version: number;
  entities: EntityDefinitionConfig[];
  workflows: WorkflowDefinitionConfig[];
  ui?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  warnings: ConfigWarning[];
}

export interface ConfigWarning {
  path: string;
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
}

export interface NormalizedEntity {
  name: string;
  label: string;
  fields: FieldDefinition[];
  scope: "public" | "user" | "owner";
  relations?: Record<string, unknown>;
  warnings: ConfigWarning[];
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  data: Record<string, unknown>;
  issues: ValidationIssue[];
  stripped: string[];
}

export type CrudOperation = "create" | "read" | "update" | "delete" | "list";

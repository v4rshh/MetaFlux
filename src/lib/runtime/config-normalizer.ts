import type {
  AppConfigInput,
  ConfigWarning,
  EntityDefinitionConfig,
  FieldDefinition,
  FieldType,
  NormalizedAppConfig,
  NormalizedEntity,
  WorkflowDefinitionConfig,
} from "./types";

const KNOWN_FIELD_TYPES = new Set<FieldType>([
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "email",
  "url",
  "json",
  "enum",
  "relation",
]);

const DEFAULT_FIELD_TYPE: FieldType = "string";

function warn(
  warnings: ConfigWarning[],
  path: string,
  code: string,
  message: string,
  severity: ConfigWarning["severity"] = "warn"
) {
  warnings.push({ path, code, message, severity });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "app";
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return fallback;
}

function normalizeField(
  raw: unknown,
  index: number,
  entityName: string,
  warnings: ConfigWarning[]
): FieldDefinition | null {
  const path = `entities.${entityName}.fields[${index}]`;

  if (raw === null || raw === undefined) {
    warn(warnings, path, "FIELD_NULL", "Skipped null field definition");
    return null;
  }

  if (typeof raw === "string") {
    return { name: raw, type: DEFAULT_FIELD_TYPE };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    warn(
      warnings,
      path,
      "FIELD_INVALID",
      "Field must be a string or object; skipped",
      "error"
    );
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const name = asString(obj.name ?? obj.key ?? obj.id, "");
  if (!name) {
    warn(warnings, path, "FIELD_NO_NAME", "Field missing name; skipped", "error");
    return null;
  }

  let type = asString(obj.type, DEFAULT_FIELD_TYPE).toLowerCase() as FieldType;
  if (!KNOWN_FIELD_TYPES.has(type)) {
    warn(
      warnings,
      `${path}.type`,
      "FIELD_UNKNOWN_TYPE",
      `Unknown type "${type}"; defaulting to string`
    );
    type = DEFAULT_FIELD_TYPE;
  }

  const field: FieldDefinition = {
    name,
    type,
    _source: raw,
    _warnings: [],
  };

  if (typeof obj.label === "string") field.label = obj.label;
  if (obj.required === true) field.required = true;
  if (obj.unique === true) field.unique = true;
  if (obj.default !== undefined) field.default = obj.default;

  if (type === "enum" && Array.isArray(obj.enum)) {
    field.enum = obj.enum
      .map((v) => (typeof v === "string" ? v : String(v)))
      .filter(Boolean);
    if (!field.enum.length) {
      warn(warnings, `${path}.enum`, "ENUM_EMPTY", "Enum field has no values");
    }
  } else if (type === "enum") {
    warn(warnings, `${path}.enum`, "ENUM_MISSING", "Enum type without enum values");
    field.enum = [];
  }

  if (type === "relation" && obj.relation && typeof obj.relation === "object") {
    const rel = obj.relation as Record<string, unknown>;
    const entity = asString(rel.entity ?? rel.to, "");
    if (!entity) {
      warn(warnings, `${path}.relation`, "RELATION_INVALID", "Relation missing target entity");
    } else {
      field.relation = {
        entity,
        type: rel.type === "many" ? "many" : "one",
      };
    }
  }

  if (obj.validation && typeof obj.validation === "object") {
    field.validation = obj.validation as FieldDefinition["validation"];
  }

  return field;
}

function normalizeEntity(
  raw: unknown,
  index: number,
  warnings: ConfigWarning[]
): EntityDefinitionConfig | null {
  const path = `entities[${index}]`;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warn(warnings, path, "ENTITY_INVALID", "Entity must be an object; skipped", "error");
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const name = asString(obj.name ?? obj.slug ?? obj.table, "");
  if (!name) {
    warn(warnings, path, "ENTITY_NO_NAME", "Entity missing name; skipped", "error");
    return null;
  }

  const entity: EntityDefinitionConfig = {
    name: slugify(name).replace(/-/g, "_") || `entity_${index}`,
    label: typeof obj.label === "string" ? obj.label : name,
  };

  const scope = asString(obj.scope, "user").toLowerCase();
  if (scope === "public" || scope === "user" || scope === "owner") {
    entity.scope = scope;
  } else {
    warn(warnings, `${path}.scope`, "SCOPE_UNKNOWN", `Unknown scope "${scope}"; using user`);
    entity.scope = "user";
  }

  if (Array.isArray(obj.fields)) {
    entity.fields = obj.fields;
  } else if (obj.fields && typeof obj.fields === "object") {
    entity.fields = Object.entries(obj.fields as Record<string, unknown>).map(
      ([key, val]) =>
        typeof val === "object" && val !== null
          ? { ...(val as object), name: key }
          : { name: key, type: val }
    );
  } else {
    entity.fields = [];
    warn(warnings, `${path}.fields`, "FIELDS_MISSING", "Entity has no fields defined");
  }

  if (obj.relations && typeof obj.relations === "object") {
    entity.relations = obj.relations as Record<string, unknown>;
  }

  return entity;
}

function normalizeWorkflow(
  raw: unknown,
  index: number,
  warnings: ConfigWarning[]
): WorkflowDefinitionConfig | null {
  const path = `workflows[${index}]`;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warn(warnings, path, "WORKFLOW_INVALID", "Workflow must be an object; skipped");
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const name = asString(obj.name, "");
  if (!name) {
    warn(warnings, path, "WORKFLOW_NO_NAME", "Workflow missing name; skipped");
    return null;
  }

  return {
    name: slugify(name),
    trigger:
      obj.trigger && typeof obj.trigger === "object"
        ? (obj.trigger as Record<string, unknown>)
        : { type: "manual" },
    steps: Array.isArray(obj.steps) ? obj.steps : [],
    enabled: obj.enabled !== false,
  };
}

export function normalizeAppConfig(input: AppConfigInput): NormalizedAppConfig {
  const warnings: ConfigWarning[] = [];

  const name = asString(input.name, "Untitled App");
  const slug = slugify(asString(input.slug, name));

  let version = 1;
  if (typeof input.version === "number" && input.version > 0) {
    version = Math.floor(input.version);
  } else if (typeof input.version === "string") {
    const parsed = parseInt(input.version, 10);
    if (!Number.isNaN(parsed) && parsed > 0) version = parsed;
    else warn(warnings, "version", "VERSION_INVALID", "Invalid version; using 1");
  }

  const entities: EntityDefinitionConfig[] = [];
  if (Array.isArray(input.entities)) {
    for (let i = 0; i < input.entities.length; i++) {
      const e = normalizeEntity(input.entities[i], i, warnings);
      if (e) entities.push(e);
    }
  } else if (input.entities && typeof input.entities === "object") {
    const map = input.entities as Record<string, unknown>;
    let i = 0;
    for (const [key, val] of Object.entries(map)) {
      const base =
        typeof val === "object" && val !== null
          ? { ...(val as object), name: key }
          : { name: key };
      const e = normalizeEntity(base, i++, warnings);
      if (e) entities.push(e);
    }
  } else if (input.entities !== undefined) {
    warn(warnings, "entities", "ENTITIES_INVALID", "Entities must be array or object");
  }

  const workflows: WorkflowDefinitionConfig[] = [];
  if (Array.isArray(input.workflows)) {
    for (let i = 0; i < input.workflows.length; i++) {
      const w = normalizeWorkflow(input.workflows[i], i, warnings);
      if (w) workflows.push(w);
    }
  } else if (input.workflows !== undefined) {
    warn(warnings, "workflows", "WORKFLOWS_INVALID", "Workflows must be an array");
  }

  const config: NormalizedAppConfig = {
    name,
    slug,
    description:
      typeof input.description === "string" ? input.description : undefined,
    version,
    entities,
    workflows,
    warnings,
  };

  if (input.ui && typeof input.ui === "object" && !Array.isArray(input.ui)) {
    config.ui = input.ui as Record<string, unknown>;
  } else if (input.ui !== undefined) {
    warn(warnings, "ui", "UI_INVALID", "UI config must be an object; ignored");
  }

  if (
    input.settings &&
    typeof input.settings === "object" &&
    !Array.isArray(input.settings)
  ) {
    config.settings = input.settings as Record<string, unknown>;
  }

  return config;
}

export function normalizeEntitySchema(
  entity: EntityDefinitionConfig
): NormalizedEntity {
  const warnings: ConfigWarning[] = [];
  const fields: FieldDefinition[] = [];
  const seen = new Set<string>();

  const rawFields = entity.fields ?? [];
  for (let i = 0; i < rawFields.length; i++) {
    const field = normalizeField(rawFields[i], i, entity.name, warnings);
    if (!field) continue;
    if (seen.has(field.name)) {
      warn(
        warnings,
        `entities.${entity.name}.fields`,
        "FIELD_DUPLICATE",
        `Duplicate field "${field.name}"; keeping first`
      );
      continue;
    }
    seen.add(field.name);
    fields.push(field);
  }

  if (!fields.some((f) => f.name === "id")) {
    fields.unshift({
      name: "id",
      type: "string",
      required: false,
      label: "ID",
    });
  }

  return {
    name: entity.name,
    label: entity.label ?? entity.name,
    fields,
    scope: entity.scope ?? "user",
    relations: entity.relations,
    warnings,
  };
}

export function normalizeAllEntities(
  config: NormalizedAppConfig
): NormalizedEntity[] {
  return config.entities.map(normalizeEntitySchema);
}

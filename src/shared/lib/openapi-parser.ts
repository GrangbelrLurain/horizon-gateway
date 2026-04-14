// ─── OpenAPI 3.x JSON parser ─────────────────────────────────────────────────
// Extracts endpoints, parameters, request body schemas, and generates examples.

// ── Raw OpenAPI types (subset) ──────────────────────────────────────────────

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject> };
}

export type PathItem = Partial<Record<HttpMethod, OperationObject>>;

export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head";

export const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "delete", "patch", "options", "head"];

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
}

export interface ParameterObject {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  schema?: SchemaObject;
  description?: string;
}

export interface RequestBodyObject {
  required?: boolean;
  content?: Record<string, MediaTypeObject>;
  description?: string;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, MediaTypeObject>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  enum?: unknown[];
  required?: string[];
  nullable?: boolean;
  description?: string;
  default?: unknown;
  example?: unknown;
  additionalProperties?: boolean | SchemaObject;
}

// ── Parsed output types ─────────────────────────────────────────────────────

export interface ParsedEndpoint {
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParam[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
}

export interface ParsedParam {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required: boolean;
  type: string;
  format?: string;
  description?: string;
  schema?: SchemaObject;
}

export interface ParsedRequestBody {
  contentType: string;
  required: boolean;
  schema: SchemaObject;
  example: unknown;
  description?: string;
}

export interface ParsedResponse {
  statusCode: string;
  description?: string;
}

export interface TagGroup {
  tag: string;
  endpoints: ParsedEndpoint[];
}

// ── $ref resolution ─────────────────────────────────────────────────────────

function resolveRef(ref: string, spec: OpenApiSpec): SchemaObject | undefined {
  // Only handle local refs: #/components/schemas/Foo
  const prefix = "#/components/schemas/";
  if (!ref.startsWith(prefix)) {
    return undefined;
  }
  const name = ref.slice(prefix.length);
  return spec.components?.schemas?.[name];
}

/**
 * Recursively resolve a schema, inlining $ref and allOf.
 * Uses a `seen` set to avoid infinite recursion on circular refs.
 */
export function resolveSchema(
  schema: SchemaObject | undefined,
  spec: OpenApiSpec,
  seen: Set<string> = new Set(),
): SchemaObject {
  if (!schema) {
    return { type: "object" };
  }

  // $ref
  if (schema.$ref) {
    if (seen.has(schema.$ref)) {
      return { type: "object", description: "(circular)" };
    }
    seen.add(schema.$ref);
    const resolved = resolveRef(schema.$ref, spec);
    return resolved ? resolveSchema(resolved, spec, seen) : { type: "object" };
  }

  // allOf → merge properties
  if (schema.allOf && schema.allOf.length > 0) {
    const merged: SchemaObject = { type: "object", properties: {}, required: [] };
    for (const sub of schema.allOf) {
      const resolved = resolveSchema(sub, spec, new Set(seen));
      if (resolved.properties) {
        merged.properties = { ...merged.properties, ...resolved.properties };
      }
      if (resolved.required) {
        merged.required = [...(merged.required ?? []), ...resolved.required];
      }
    }
    return merged;
  }

  return schema;
}

// ── Example generation ──────────────────────────────────────────────────────

/**
 * Generate an example value from a JSON Schema object.
 * Recursion-safe via `depth` limit.
 */
export function generateExample(schema: SchemaObject | undefined, spec: OpenApiSpec, depth = 0): unknown {
  if (!schema || depth > 5) {
    return null;
  }

  // Resolve refs first
  const resolved = resolveSchema(schema, spec);

  if (resolved.example !== undefined) {
    return resolved.example;
  }
  if (resolved.default !== undefined) {
    return resolved.default;
  }
  if (resolved.enum && resolved.enum.length > 0) {
    return resolved.enum[0];
  }

  switch (resolved.type) {
    case "string":
      if (resolved.format === "date-time") {
        return "2025-01-01T00:00:00Z";
      }
      if (resolved.format === "date") {
        return "2025-01-01";
      }
      if (resolved.format === "email") {
        return "user@example.com";
      }
      if (resolved.format === "uri" || resolved.format === "url") {
        return "https://example.com";
      }
      return "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      if (resolved.items) {
        return [generateExample(resolved.items, spec, depth + 1)];
      }
      return [];
    default:
      if (resolved.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(resolved.properties)) {
          obj[key] = generateExample(prop, spec, depth + 1);
        }
        return obj;
      }
      return {};
  }
}

// ── Main parse function ─────────────────────────────────────────────────────

function describeType(schema: SchemaObject | undefined): string {
  if (!schema) {
    return "any";
  }
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    return name ?? "object";
  }
  if (schema.type === "array") {
    return `${describeType(schema.items)}[]`;
  }
  return schema.format ? `${schema.type}(${schema.format})` : (schema.type ?? "any");
}

function parseParam(p: ParameterObject): ParsedParam {
  return {
    name: p.name,
    in: p.in,
    required: p.required ?? false,
    type: describeType(p.schema),
    format: p.schema?.format,
    description: p.description,
    schema: p.schema,
  };
}

function parseRequestBody(rb: RequestBodyObject, spec: OpenApiSpec): ParsedRequestBody | undefined {
  if (!rb.content) {
    return undefined;
  }
  // Prefer application/json
  const contentType = Object.keys(rb.content).find((ct) => ct.includes("json")) ?? Object.keys(rb.content)[0];
  if (!contentType) {
    return undefined;
  }
  const media = rb.content[contentType];
  if (!media?.schema) {
    return undefined;
  }

  const resolved = resolveSchema(media.schema, spec);
  return {
    contentType,
    required: rb.required ?? false,
    schema: resolved,
    example: generateExample(resolved, spec),
    description: rb.description,
  };
}

/**
 * Parse an OpenAPI 3.x JSON string into structured endpoints.
 */
export function parseOpenApiSpec(jsonStr: string): {
  spec: OpenApiSpec;
  endpoints: ParsedEndpoint[];
  tagGroups: TagGroup[];
} {
  const spec: OpenApiSpec = JSON.parse(jsonStr);

  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) {
        continue;
      }

      const parsed: ParsedEndpoint = {
        method,
        path,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tags: op.tags ?? ["Default"],
        parameters: (op.parameters ?? []).map(parseParam),
        requestBody: op.requestBody ? parseRequestBody(op.requestBody, spec) : undefined,
        responses: Object.entries(op.responses ?? {}).map(([code, r]) => ({
          statusCode: code,
          description: r.description,
        })),
      };
      endpoints.push(parsed);
    }
  }

  // Group by tag
  const tagMap = new Map<string, ParsedEndpoint[]>();
  for (const ep of endpoints) {
    for (const tag of ep.tags) {
      const list = tagMap.get(tag) ?? [];
      list.push(ep);
      tagMap.set(tag, list);
    }
  }

  const tagGroups: TagGroup[] = Array.from(tagMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, eps]) => ({ tag, endpoints: eps }));

  return { spec, endpoints, tagGroups };
}

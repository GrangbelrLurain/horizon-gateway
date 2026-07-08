import type { SchemaProperty } from "../ui/SchemaPropertiesEditor";

function inferType(val: unknown): SchemaProperty["type"] {
  if (typeof val === "number") {
    return Number.isInteger(val) ? "integer" : "number";
  }
  if (typeof val === "boolean") {
    return "boolean";
  }
  if (Array.isArray(val)) {
    return "array";
  }
  if (val === null) {
    return "string";
  }
  if (typeof val === "object") {
    return "object";
  }
  return "string";
}

/** Recursively build SchemaProperty[] from a JSON sample (overwrite mode). */
export function importPropertiesFromJson(json: unknown): SchemaProperty[] {
  if (!json || typeof json !== "object") {
    return [];
  }

  const parsedProps: SchemaProperty[] = [];

  const parseJsonToSchemaProperties = (jsonVal: unknown, currentParentId: string | undefined) => {
    if (!jsonVal || typeof jsonVal !== "object") {
      return;
    }

    let targetObj: Record<string, unknown> = jsonVal as Record<string, unknown>;

    if (Array.isArray(jsonVal)) {
      if (jsonVal.length > 0 && typeof jsonVal[0] === "object" && jsonVal[0] !== null) {
        targetObj = jsonVal[0] as Record<string, unknown>;
      } else {
        return;
      }
    }

    for (const [key, val] of Object.entries(targetObj)) {
      const propId = Math.random().toString(36).substring(2, 9);
      const type = inferType(val);

      parsedProps.push({
        id: propId,
        name: key,
        type,
        description: `Imported field: ${key}`,
        required: false,
        parentId: currentParentId,
      });

      if (type === "object" && val && typeof val === "object") {
        parseJsonToSchemaProperties(val, propId);
      } else if (type === "array" && Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        parseJsonToSchemaProperties(val[0], propId);
      }
    }
  };

  parseJsonToSchemaProperties(json, undefined);
  return parsedProps;
}

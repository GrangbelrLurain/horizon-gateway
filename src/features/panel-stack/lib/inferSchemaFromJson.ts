import type { SchemaProperty } from "@/features/sandbox";

function inferPropertyType(value: unknown): SchemaProperty["type"] {
  if (value === null || value === undefined) {
    return "string";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (typeof value === "object") {
    return "object";
  }
  return "string";
}

export function inferSchemaPropertiesFromJson(value: unknown, prefix = "p"): SchemaProperty[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).map(([name, fieldValue], index) => ({
    id: `${prefix}-${index}-${name}`,
    name,
    type: inferPropertyType(fieldValue),
    description: "",
    required: true,
  }));
}

export function pickHandoffPayload(handoff: {
  focus: "request" | "response" | "both";
  request: { body: string | null };
  response: { body: string | null };
}): string {
  if (handoff.focus === "request") {
    return handoff.request.body ?? "";
  }
  if (handoff.focus === "both") {
    const response = handoff.response.body ?? "";
    if (response.trim()) {
      return response;
    }
    return handoff.request.body ?? "";
  }
  return handoff.response.body ?? "";
}

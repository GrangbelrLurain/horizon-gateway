import type { ApiRequestFieldConfig, HeaderRow } from "@/entities/api-request";
import type { ApiRequestResult } from "@/shared/api";
import { atomWithWindowStorage } from "@/shared/lib/jotai/window-storage";
import type { ParsedEndpoint } from "@/shared/lib/openapi-parser";

export interface EndpointFormState {
  origin?: string;
  pathname?: string;
  paramValues: Record<string, string>;
  bodyText: string;
  /** @deprecated migrated to headers rows */
  headerText?: string;
  headers?: HeaderRow[];
  response: ApiRequestResult | null;
  error: string | null;
}

/** Global field edit permissions for API Schema request forms */
export const apiSchemaFieldOverridesAtom = atomWithWindowStorage<Partial<ApiRequestFieldConfig>>(
  "api_schema_field_overrides",
  {},
);

export const apiSchemaSelectedDomainIdAtom = atomWithWindowStorage<number | null>(
  "api_schema_selected_domain_id",
  null,
);
export const apiSchemaSearchAtom = atomWithWindowStorage<string>("api_schema_search", "");
export const apiSchemaSelectedEndpointAtom = atomWithWindowStorage<ParsedEndpoint | null>(
  "api_schema_selected_endpoint",
  null,
);

/**
 * Key format: `${domainId}:${method}:${path}`
 * We store all form states in a single atom with storage for full persistence.
 */
export const apiSchemaFormsAtom = atomWithWindowStorage<Record<string, EndpointFormState>>(
  "api_schema_endpoint_forms",
  {},
);

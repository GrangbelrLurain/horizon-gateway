import type { ApiRequestResult } from "@/shared/api";
import { atomWithWindowStorage } from "@/shared/lib/jotai/window-storage";
import type { ParsedEndpoint } from "@/shared/lib/openapi-parser";

export interface EndpointFormState {
  paramValues: Record<string, string>;
  bodyText: string;
  headerText: string;
  response: ApiRequestResult | null;
  error: string | null;
}

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

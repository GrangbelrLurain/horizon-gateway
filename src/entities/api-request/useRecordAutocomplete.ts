import { useSetAtom } from "jotai";
import { useCallback } from "react";
import type { ParsedEndpoint } from "@/shared/lib/openapi-parser";
import { collectDraftHeaders } from "./draft";
import {
  appendBodySuggestion,
  appendHeaderSuggestions,
  appendOriginSuggestion,
  appendParamSuggestion,
  appendPathnameForOrigin,
  appendPathnameSuggestion,
  autocompleteBodiesAtom,
  autocompleteHeadersAtom,
  autocompleteHeaderValuesAtom,
  autocompleteOriginsAtom,
  autocompleteParamValuesAtom,
  autocompletePathnamesAtom,
  autocompletePathnamesByOriginAtom,
  mergeExtractedFieldValues,
} from "./store";
import { extractAutocompleteValuesFromResponse, paramSuggestionKey } from "./suggestions";
import type { ApiRequestDraft } from "./types";

export interface RecordAutocompleteOptions {
  responseBody?: unknown;
  responseHeaders?: Record<string, string>;
}

export function useRecordApiRequestAutocomplete(endpoint?: ParsedEndpoint) {
  const setOrigins = useSetAtom(autocompleteOriginsAtom);
  const setPathnames = useSetAtom(autocompletePathnamesAtom);
  const setPathnamesByOrigin = useSetAtom(autocompletePathnamesByOriginAtom);
  const setBodies = useSetAtom(autocompleteBodiesAtom);
  const setParamValues = useSetAtom(autocompleteParamValuesAtom);
  const setHeaderKeys = useSetAtom(autocompleteHeadersAtom);
  const setHeaderValues = useSetAtom(autocompleteHeaderValuesAtom);

  return useCallback(
    (draft: ApiRequestDraft, options?: RecordAutocompleteOptions) => {
      setOrigins((prev) => appendOriginSuggestion(prev, draft.origin));
      setPathnames((prev) => appendPathnameSuggestion(prev, draft.pathname));
      setPathnamesByOrigin((prev) => appendPathnameForOrigin(prev, draft.origin, draft.pathname));
      setBodies((prev) => appendBodySuggestion(prev, draft.bodyText));

      setParamValues((prev) => {
        let next = prev;
        if (endpoint) {
          for (const param of endpoint.parameters) {
            const value = draft.paramValues[param.name];
            if (!value) {
              continue;
            }
            const scopedKey = paramSuggestionKey(param);
            next = appendParamSuggestion(next, scopedKey, value);
            next = appendParamSuggestion(next, param.name, value);
          }
        } else {
          for (const [name, value] of Object.entries(draft.paramValues)) {
            if (!value) {
              continue;
            }
            next = appendParamSuggestion(next, name, value);
            next = appendParamSuggestion(next, `query:${name}`, value);
          }
        }

        if (options?.responseBody !== undefined) {
          next = mergeExtractedFieldValues(next, extractAutocompleteValuesFromResponse(options.responseBody));
        }

        return next;
      });

      const headerRows = endpoint
        ? Object.entries(collectDraftHeaders(draft, endpoint)).map(([key, value]) => ({ key, value }))
        : draft.headers.filter((row) => row.key.trim() || row.value.trim());

      setHeaderKeys((prevKeys) => appendHeaderSuggestions(prevKeys, {}, headerRows).headerKeys);
      setHeaderValues((prevValues) => {
        let next = appendHeaderSuggestions([], prevValues, headerRows).headerValues;

        if (options?.responseHeaders) {
          const responseRows = Object.entries(options.responseHeaders).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          next = appendHeaderSuggestions([], next, responseRows).headerValues;
        }

        if (options?.responseBody !== undefined) {
          const fromBody = extractAutocompleteValuesFromResponse(options.responseBody);
          next = mergeExtractedFieldValues(next, fromBody);
        }

        return next;
      });
    },
    [
      endpoint,
      setBodies,
      setHeaderKeys,
      setHeaderValues,
      setOrigins,
      setParamValues,
      setPathnames,
      setPathnamesByOrigin,
    ],
  );
}

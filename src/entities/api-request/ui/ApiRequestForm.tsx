import { Plus, Trash2 } from "lucide-react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { ParsedEndpoint, ParsedParam } from "@/shared/lib/openapi-parser";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { buildRequestUrl } from "../draft";
import {
  bareFieldKey,
  buildParamSuggestions,
  filterSuggestions,
  mergeSuggestionLists,
  valuesForFieldKey,
} from "../suggestions";
import type {
  ApiRequestDraft,
  ApiRequestFieldConfig,
  ApiRequestFormLabels,
  ApiRequestSuggestionContext,
  FieldControl,
  HeaderRow,
} from "../types";
import { DEFAULT_FIELD_CONFIG, mergeFieldConfig } from "../types";
import { AutocompleteField } from "./AutocompleteField";
import { FieldPermissionsCard } from "./FieldPermissionsCard";
import { HeaderRowsField } from "./HeaderRowsField";

interface ApiRequestFormContextValue {
  draft: ApiRequestDraft;
  onChange: (updates: Partial<ApiRequestDraft>) => void;
  config: ApiRequestFieldConfig;
  suggestions: ApiRequestSuggestionContext;
  endpoint?: ParsedEndpoint;
  method?: string;
  labels: ApiRequestFormLabels;
  onConfigChange?: (field: keyof ApiRequestFieldConfig, control: Partial<FieldControl>) => void;
}

const ApiRequestFormContext = createContext<ApiRequestFormContextValue | null>(null);

function useApiRequestFormContext() {
  const ctx = useContext(ApiRequestFormContext);
  if (!ctx) {
    throw new Error("ApiRequestForm compound components must be used within ApiRequestForm");
  }
  return ctx;
}

export interface ApiRequestFormProps {
  draft: ApiRequestDraft;
  onChange: (updates: Partial<ApiRequestDraft>) => void;
  suggestions: ApiRequestSuggestionContext;
  config?: Partial<ApiRequestFieldConfig>;
  endpoint?: ParsedEndpoint;
  method?: string;
  labels?: ApiRequestFormLabels;
  onConfigChange?: (field: keyof ApiRequestFieldConfig, control: Partial<FieldControl>) => void;
  children: ReactNode;
  className?: string;
}

const DEFAULT_LABELS: ApiRequestFormLabels = {
  origin: "Origin",
  pathname: "Path",
};

export function ApiRequestForm({
  draft,
  onChange,
  suggestions,
  config,
  endpoint,
  method,
  labels = DEFAULT_LABELS,
  onConfigChange,
  children,
  className,
}: ApiRequestFormProps) {
  const mergedConfig = useMemo(() => mergeFieldConfig(DEFAULT_FIELD_CONFIG, config), [config]);

  return (
    <ApiRequestFormContext.Provider
      value={{ draft, onChange, config: mergedConfig, suggestions, endpoint, method, labels, onConfigChange }}
    >
      <div className={className}>{children}</div>
    </ApiRequestFormContext.Provider>
  );
}

export interface ApiRequestFormHeaderProps {
  method: string;
  summary?: string;
  actions?: ReactNode;
}

function ApiRequestFormHeader({ summary, actions }: ApiRequestFormHeaderProps) {
  const { draft, onChange, config, suggestions, endpoint, labels } = useApiRequestFormContext();
  const resolvedUrl = endpoint ? buildRequestUrl(draft, endpoint) : `${draft.origin}${draft.pathname}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 w-16 shrink-0">
            {labels.origin}
          </span>
          <AutocompleteField
            value={draft.origin}
            onChange={(origin) => onChange({ origin })}
            suggestions={suggestions.origins}
            control={config.origin}
            className="h-9 text-xs font-mono"
            placeholder="https://api.example.com"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 w-16 shrink-0">
            {labels.pathname}
          </span>
          <AutocompleteField
            value={draft.pathname}
            onChange={(pathname) => onChange({ pathname })}
            suggestions={suggestions.pathnames}
            control={config.pathname}
            className="h-9 text-xs font-mono"
            placeholder="/v1/users/{id}"
          />
        </div>
      </div>

      <p className="text-[10px] text-base-content/30 font-mono truncate bg-base-100/50 px-2 py-1 rounded border border-base-content/5">
        {resolvedUrl}
      </p>

      {summary && (
        <p className="text-sm font-medium text-base-content/60 border-t border-base-content/5 pt-3 leading-relaxed">
          {summary}
        </p>
      )}

      {actions && <div className="flex items-center justify-end gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export interface ApiRequestFormParamsProps {
  parameters: ParsedParam[];
  title: string;
}

function ApiRequestFormParams({ parameters, title }: ApiRequestFormParamsProps) {
  const { draft, onChange, config, suggestions } = useApiRequestFormContext();
  const editable = config.params.editable ?? true;

  if (!(config.params.visible ?? true) || parameters.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl">
      <h3 className="text-[10px] font-black text-base-content/40 mb-4 uppercase tracking-widest">{title}</h3>
      <div className="space-y-2">
        {parameters.map((param) => {
          const paramSuggestions = buildParamSuggestions(param, suggestions.paramValues);
          return (
            <div
              key={`${param.in}-${param.name}`}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-base-200/50 transition-colors"
            >
              <span
                className={`text-[9px] font-black uppercase w-12 text-center shrink-0 p-1 rounded border overflow-hidden ${
                  param.in === "path"
                    ? "text-warning bg-warning/10 border-warning/20"
                    : param.in === "header"
                      ? "text-info bg-info/10 border-info/20"
                      : "text-base-content/40 bg-base-200 border-base-300"
                }`}
              >
                {param.in}
              </span>
              <span
                className="text-xs font-bold text-base-content w-40 shrink-0 truncate tracking-tight"
                title={param.description ? `${param.name} — ${param.description}` : param.name}
              >
                {param.name}
                {param.required && <span className="text-error ml-0.5">*</span>}
              </span>
              <AutocompleteField
                value={draft.paramValues[param.name] ?? ""}
                onChange={(value) =>
                  onChange({
                    paramValues: { ...draft.paramValues, [param.name]: value },
                  })
                }
                suggestions={paramSuggestions}
                control={{ visible: true, editable }}
                placeholder={param.type}
                aria-label={param.name}
                className="h-8 text-xs font-bold tracking-tight bg-base-200 border-transparent focus:bg-base-100"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export interface ApiRequestFormBodyProps {
  title: string;
  contentType?: string;
}

function ApiRequestFormBody({ title, contentType }: ApiRequestFormBodyProps) {
  const { draft, onChange, config, suggestions } = useApiRequestFormContext();
  const bodySuggestions = useMemo(
    () => filterSuggestions(suggestions.bodies, draft.bodyText.slice(0, 80)),
    [suggestions.bodies, draft.bodyText],
  );
  const visible = config.body.visible ?? true;
  const editable = config.body.editable ?? true;

  if (!visible) {
    return null;
  }

  return (
    <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl space-y-3">
      <h3 className="text-[10px] font-black text-base-content/40 uppercase tracking-widest flex items-center justify-between">
        {title}
        {contentType && (
          <span className="text-[9px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
            {contentType}
          </span>
        )}
      </h3>
      <div className="relative">
        {editable ? (
          <>
            <textarea
              className="w-full border border-base-300 rounded-xl px-4 py-3 text-xs font-mono bg-base-200/50 focus:ring-2 focus:ring-primary focus:bg-base-100 focus:border-transparent outline-none resize-y min-h-[120px] transition-all shadow-inner text-base-content"
              value={draft.bodyText}
              onChange={(event) => onChange({ bodyText: event.target.value })}
              spellCheck={false}
            />
            {bodySuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bodySuggestions.slice(0, 4).map((snippet) => (
                  <button
                    key={snippet.slice(0, 40)}
                    type="button"
                    className="text-[10px] px-2 py-1 rounded-full border border-base-300 bg-base-200/60 hover:border-primary/40 hover:text-primary transition-colors font-mono max-w-full truncate"
                    onClick={() => onChange({ bodyText: snippet })}
                  >
                    {snippet.slice(0, 48)}
                    {snippet.length > 48 ? "…" : ""}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <pre className="w-full border border-base-300 rounded-xl px-4 py-3 text-xs font-mono bg-base-200/50 min-h-[120px] whitespace-pre-wrap break-all">
            {draft.bodyText || "—"}
          </pre>
        )}
      </div>
    </Card>
  );
}

export interface ApiRequestFormQueryParamsProps {
  title: string;
  labels: {
    add: string;
    key: string;
    value: string;
  };
}

function emptyQueryRow(): HeaderRow {
  return { key: "", value: "" };
}

function ApiRequestFormQueryParams({ title, labels }: ApiRequestFormQueryParamsProps) {
  const { draft, onChange, config, suggestions } = useApiRequestFormContext();
  const editable = config.params.editable ?? true;
  const rows = draft.queryParams ?? [emptyQueryRow()];

  const paramKeySuggestions = useMemo(
    () =>
      mergeSuggestionLists(
        Object.keys(suggestions.paramValues).map(bareFieldKey),
        rows.map((row) => row.key).filter(Boolean),
      ),
    [rows, suggestions.paramValues],
  );

  if (!(config.params.visible ?? true)) {
    return null;
  }

  const updateRow = (index: number, field: "key" | "value", value: string) => {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    onChange({ queryParams: next });
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, idx) => idx !== index);
    onChange({ queryParams: next.length > 0 ? next : [emptyQueryRow()] });
  };

  const addRow = () => {
    onChange({ queryParams: [...rows, emptyQueryRow()] });
  };

  return (
    <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl">
      <h3 className="text-[10px] font-black text-base-content/40 mb-3 uppercase tracking-widest">{title}</h3>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${index}-${row.key}`} className="flex gap-2 items-center">
            <AutocompleteField
              value={row.key}
              onChange={(value) => updateRow(index, "key", value)}
              suggestions={paramKeySuggestions}
              control={{ visible: true, editable }}
              placeholder={labels.key}
              className="flex-1 h-8 text-xs font-mono"
              containerClassName="relative flex-1 min-w-0"
            />
            <AutocompleteField
              value={row.value}
              onChange={(value) => updateRow(index, "value", value)}
              suggestions={mergeSuggestionLists(
                valuesForFieldKey(suggestions.paramValues, row.key),
                row.value ? [row.value] : [],
              )}
              control={{ visible: true, editable }}
              placeholder={labels.value}
              className="flex-1 h-8 text-xs font-mono"
              containerClassName="relative flex-1 min-w-0"
            />
            {editable && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-error"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        {editable && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 h-8" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" />
            {labels.add}
          </Button>
        )}
      </div>
    </Card>
  );
}

export interface ApiRequestFormHeadersProps {
  title: string;
  labels: {
    addHeader: string;
    key: string;
    value: string;
  };
}

function ApiRequestFormHeaders({ title, labels }: ApiRequestFormHeadersProps) {
  const { draft, onChange, config, suggestions } = useApiRequestFormContext();

  if (!(config.headers.visible ?? true)) {
    return null;
  }

  return (
    <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl">
      <h3 className="text-[10px] font-black text-base-content/40 mb-3 uppercase tracking-widest">{title}</h3>
      <HeaderRowsField
        rows={draft.headers}
        onChange={(headers) => onChange({ headers })}
        headerKeys={suggestions.headerKeys}
        headerValues={suggestions.headerValues}
        control={config.headers}
        labels={labels}
      />
    </Card>
  );
}

function ApiRequestFormWhen({ when, children }: { when: boolean; children: ReactNode }) {
  return when ? children : null;
}

function ApiRequestFormWhenMethod({ methods, children }: { methods: readonly string[]; children: ReactNode }) {
  const { method } = useApiRequestFormContext();
  const current = method?.toUpperCase() ?? "";
  const allowed = methods.map((item) => item.toUpperCase());
  if (!current || !allowed.includes(current)) {
    return null;
  }
  return children;
}

function ApiRequestFormFieldSettings({
  title,
  labels,
}: {
  title: string;
  labels: Record<keyof ApiRequestFieldConfig, string>;
}) {
  const { config, onConfigChange } = useApiRequestFormContext();
  if (!onConfigChange) {
    return null;
  }

  return <FieldPermissionsCard title={title} labels={labels} config={config} onConfigChange={onConfigChange} />;
}

ApiRequestForm.Header = ApiRequestFormHeader;
ApiRequestForm.Params = ApiRequestFormParams;
ApiRequestForm.QueryParams = ApiRequestFormQueryParams;
ApiRequestForm.Body = ApiRequestFormBody;
ApiRequestForm.Headers = ApiRequestFormHeaders;
ApiRequestForm.When = ApiRequestFormWhen;
ApiRequestForm.WhenMethod = ApiRequestFormWhenMethod;
ApiRequestForm.FieldSettings = ApiRequestFormFieldSettings;

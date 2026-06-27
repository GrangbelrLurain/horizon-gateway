export type FieldControl = {
  visible?: boolean;
  editable?: boolean;
};

export type ApiRequestFieldConfig = {
  method: FieldControl;
  origin: FieldControl;
  pathname: FieldControl;
  params: FieldControl;
  body: FieldControl;
  headers: FieldControl;
};

export const DEFAULT_FIELD_CONFIG: ApiRequestFieldConfig = {
  method: { visible: true, editable: false },
  origin: { visible: true, editable: true },
  pathname: { visible: true, editable: true },
  params: { visible: true, editable: true },
  body: { visible: true, editable: true },
  headers: { visible: true, editable: true },
};

/** OpenAPI 스키마 엔드포인트 — 스펙에 고정된 method/path는 readonly, 실행값만 편집 */
export const SCHEMA_FIELD_CONFIG: ApiRequestFieldConfig = {
  method: { visible: true, editable: false },
  origin: { visible: true, editable: true },
  pathname: { visible: true, editable: false },
  params: { visible: true, editable: true },
  body: { visible: true, editable: true },
  headers: { visible: true, editable: true },
};

/** API 클라이언트 — 요청을 처음부터 구성하므로 모든 필드 편집 가능 */
export const CLIENT_FIELD_CONFIG: ApiRequestFieldConfig = {
  method: { visible: true, editable: true },
  origin: { visible: true, editable: true },
  pathname: { visible: true, editable: true },
  params: { visible: true, editable: true },
  body: { visible: true, editable: true },
  headers: { visible: true, editable: true },
};

export const METHODS_WITH_BODY = ["POST", "PUT", "PATCH", "DELETE"] as const;

export interface ApiRequestFormLabels {
  origin: string;
  pathname: string;
}

export function mergeFieldConfig(
  base: ApiRequestFieldConfig,
  overrides?: Partial<ApiRequestFieldConfig>,
): ApiRequestFieldConfig {
  if (!overrides) {
    return base;
  }
  return {
    method: { ...base.method, ...overrides.method },
    origin: { ...base.origin, ...overrides.origin },
    pathname: { ...base.pathname, ...overrides.pathname },
    params: { ...base.params, ...overrides.params },
    body: { ...base.body, ...overrides.body },
    headers: { ...base.headers, ...overrides.headers },
  };
}

export interface HeaderRow {
  key: string;
  value: string;
}

export interface ApiRequestDraft {
  origin: string;
  pathname: string;
  paramValues: Record<string, string>;
  bodyText: string;
  headers: HeaderRow[];
  /** API 클라이언트용 자유 쿼리 파라미터 행 */
  queryParams?: HeaderRow[];
}

export interface ApiRequestSuggestionContext {
  origins: string[];
  pathnames: string[];
  paramValues: Record<string, string[]>;
  headerKeys: string[];
  headerValues: Record<string, string[]>;
  bodies: string[];
}

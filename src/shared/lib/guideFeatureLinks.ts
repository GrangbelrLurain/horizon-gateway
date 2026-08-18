export const GUIDE_FEATURE_ALIASES = [
  "api-client",
  "api-logs",
  "mocking",
  "json-schema",
  "schema-explorer",
  "pipeline",
  "crypto",
  "preview",
  "live-capture",
  "proxy-graph",
  "monitor",
  "server-logs",
  "policies",
  "logs",
  "schema",
  "local",
  "inject",
] as const;

export type GuideFeatureAlias = (typeof GUIDE_FEATURE_ALIASES)[number];

export const GUIDE_FEATURE_PANEL: Record<string, string> = {
  "api-client": "api-client",
  "api-logs": "api-logs",
  mocking: "mocking",
  "json-schema": "json-schema",
  "schema-explorer": "schema-explorer",
  pipeline: "pipeline",
  crypto: "crypto",
  preview: "preview",
  "live-capture": "live-capture",
  "proxy-graph": "proxy-graph",
  monitor: "monitor",
  "server-logs": "server-logs",
  policies: "policies",
  logs: "api/logs",
  schema: "api/schema",
  local: "proxy",
  inject: "debug",
};

export type GuideFeatureLang = "ko" | "en";

export interface GuideFeatureItem {
  alias: string;
  labels: Record<GuideFeatureLang, string>;
  description: Record<GuideFeatureLang, string>;
  keywords: string[];
  customMarkdown?: string;
}

export const GUIDE_FEATURE_CATALOG: Record<GuideFeatureAlias, GuideFeatureItem> = {
  "api-client": {
    alias: "api-client",
    labels: { ko: "API 클라이언트", en: "API Client" },
    description: { ko: "API 요청 및 테스트 도구", en: "API request & test tool" },
    keywords: ["api", "client", "request", "http", "curl", "postman"],
  },
  "api-logs": {
    alias: "api-logs",
    labels: { ko: "API 로그", en: "API Logs" },
    description: { ko: "전체 API 트래픽 로그 및 실시간 분석", en: "Captured API traffic logs" },
    keywords: ["log", "logs", "traffic", "요청", "응답", "네트워크"],
  },
  mocking: {
    alias: "mocking",
    labels: { ko: "API 모킹", en: "API Mocking" },
    description: { ko: "API 응답 조작 및 시나리오 모킹", en: "API mock rules & scenarios" },
    keywords: ["mock", "api mock", "시나리오", "fake", "stub", "모의"],
  },
  "json-schema": {
    alias: "json-schema",
    labels: { ko: "JSON 스키마", en: "JSON Schema" },
    description: { ko: "JSON Schema 저장소 및 검증", en: "JSON Schema repository" },
    keywords: ["json schema", "schema", "json", "타입"],
  },
  "schema-explorer": {
    alias: "schema-explorer",
    labels: { ko: "API 스키마", en: "API Schema" },
    description: { ko: "OpenAPI 및 API 스키마 탐색기", en: "OpenAPI & API schema explorer" },
    keywords: ["openapi", "swagger", "schema", "탐색기"],
  },
  pipeline: {
    alias: "pipeline",
    labels: { ko: "데이터 파이프라인", en: "Data Pipeline" },
    description: { ko: "API 데이터 변환 및 가공 파이프라인", en: "Data transformation pipeline" },
    keywords: ["pipeline", "transform", "변환", "파이프라인"],
  },
  crypto: {
    alias: "crypto",
    labels: { ko: "암복호화 유틸", en: "Crypto Utility" },
    description: { ko: "AES/RSA 암복호화, 해시, Base64/JWT", en: "Crypto, hashing, encoding" },
    keywords: ["crypto", "aes", "rsa", "jwt", "hash", "base64", "암호화"],
  },
  preview: {
    alias: "preview",
    labels: { ko: "UI 프리뷰", en: "UI Preview" },
    description: { ko: "TSX/JSX 실시간 컴포넌트 프리뷰", en: "Live TSX/JSX UI preview" },
    keywords: ["preview", "ui", "tsx", "jsx", "react", "렌더링"],
  },
  "live-capture": {
    alias: "live-capture",
    labels: { ko: "스크립트 인젝션", en: "Script Injection" },
    description: { ko: "브라우저 실시간 JS/CSS 인젝션 관리", en: "Live browser script injection" },
    keywords: ["injection", "inject", "script", "인젝션"],
  },
  "proxy-graph": {
    alias: "proxy-graph",
    labels: { ko: "프록시 연결 맵", en: "Proxy Graph" },
    description: { ko: "프록시 라우트 및 트래픽 연결 맵", en: "Proxy topology & traffic map" },
    keywords: ["graph", "proxy", "map", "연결", "토폴로지"],
  },
  monitor: {
    alias: "monitor",
    labels: { ko: "모니터링 관리", en: "Monitoring" },
    description: { ko: "도메인 상태 및 헬스체크 모니터링", en: "Domain health monitoring" },
    keywords: ["monitor", "health", "관제", "모니터링"],
  },
  "server-logs": {
    alias: "server-logs",
    labels: { ko: "서버 로그", en: "Server Logs" },
    description: { ko: "Horizon Gateway 백엔드 실시간 로그", en: "Backend server logs" },
    keywords: ["server", "backend", "logs", "서버"],
  },
  policies: {
    alias: "policies",
    labels: { ko: "UI/UX 가이드", en: "UI/UX Guide" },
    description: { ko: "서비스별 UI/UX 가이드 및 정책 관리", en: "UI/UX guide & policies" },
    keywords: ["policy", "guide", "가이드", "정책"],
  },
  logs: {
    alias: "logs",
    labels: { ko: "API 로그", en: "API logs" },
    description: { ko: "캡처된 API 요청/응답", en: "Captured API traffic" },
    keywords: ["log", "logs", "traffic", "요청", "응답", "네트워크"],
  },
  schema: {
    alias: "schema",
    labels: { ko: "스키마", en: "Schema" },
    description: { ko: "JSON 스키마", en: "JSON schemas" },
    keywords: ["json schema", "openapi", "타입", "type", "schema"],
  },
  local: {
    alias: "local",
    labels: { ko: "로컬 목적지", en: "Local destination" },
    description: { ko: "로컬 프록시 라우트", en: "Local proxy routes" },
    keywords: ["proxy", "prx", "로컬", "destination", "라우트", "route"],
  },
  inject: {
    alias: "inject",
    labels: { ko: "인젝션", en: "Injection" },
    description: { ko: "페이지 인젝션/가이드", en: "Page injection / guides" },
    keywords: ["debug", "inspect", "가이드", "injection", "badge"],
  },
};

export function isGuideFeatureAlias(value: string): value is GuideFeatureAlias {
  return (GUIDE_FEATURE_ALIASES as readonly string[]).includes(value as GuideFeatureAlias);
}

/** `hg://mocking` → `"mocking"`. Non-hg hrefs return null. */
export function hgLinkAlias(href: string): string | null {
  const lower = href.trim().toLowerCase();
  if (!lower.startsWith("hg://")) {
    return null;
  }
  return lower.slice("hg://".length).replace(/\/+$/, "");
}

export function guideFeatureMarkdown(alias: string, label: string, item?: GuideFeatureItem): string {
  if (item?.customMarkdown) {
    return item.customMarkdown;
  }
  return `[${label}](hg://${alias})`;
}

export function guideFeatureLabel(alias: GuideFeatureAlias, lang: GuideFeatureLang): string {
  return GUIDE_FEATURE_CATALOG[alias]?.labels[lang] ?? alias;
}

export interface GuideLinkTrigger {
  start: number;
  end: number;
  query: string;
  kind: "wiki" | "hg";
}

/** Obsidian-style `[[query` (primary) or pasted `hg://alias` (fallback). */
export function detectGuideLinkTrigger(value: string, cursor: number): GuideLinkTrigger | null {
  const before = value.slice(0, cursor);

  const wiki = /\[\[([^\]]{0,60})$/.exec(before);
  if (wiki) {
    return { start: cursor - wiki[0].length, end: cursor, query: wiki[1], kind: "wiki" };
  }

  const hg = /hg:\/\/([a-z0-9_./-]*)$/i.exec(before);
  if (hg) {
    return { start: cursor - hg[0].length, end: cursor, query: hg[1], kind: "hg" };
  }

  return null;
}

function itemHaystack(item: GuideFeatureItem): string {
  return [
    item.alias,
    item.labels.ko,
    item.labels.en,
    item.description.ko,
    item.description.en,
    item.customMarkdown || "",
    ...item.keywords,
  ]
    .join(" ")
    .toLowerCase();
}

export interface UnifiedDomainInfo {
  id?: number | string;
  host: string;
  name?: string;
}

export function buildUnifiedGuideSuggestions(params: {
  domains?: UnifiedDomainInfo[];
  currentHost?: string;
  lang?: GuideFeatureLang;
}): GuideFeatureItem[] {
  const results: GuideFeatureItem[] = [];

  // 1. Registered Domains
  if (params.domains && params.domains.length > 0) {
    for (const d of params.domains) {
      const host = d.host;
      if (!host) {
        continue;
      }
      const domainTarget = d.id != null ? `domain/${d.id}` : host;
      results.push({
        alias: domainTarget,
        labels: { ko: host, en: host },
        description: {
          ko: `도메인 바로가기${d.id != null ? ` (#${d.id})` : ""}`,
          en: `Domain shortcut${d.id != null ? ` (#${d.id})` : ""}`,
        },
        keywords: [host, "domain", "도메인", "host"],
        customMarkdown: `[${host}](hg://${domainTarget})`,
      });
      results.push({
        alias: `${domainTarget}/api/mocking`,
        labels: { ko: `${host} > API 모킹`, en: `${host} > API Mocking` },
        description: { ko: `${host} API 모킹 규칙 바로가기`, en: `${host} API mock rules` },
        keywords: [host, "mock", "api", "모킹"],
        customMarkdown: `[${host} > API 모킹](hg://${domainTarget}/api/mocking)`,
      });
      results.push({
        alias: `${domainTarget}/api/logs`,
        labels: { ko: `${host} > API 로그`, en: `${host} > API Logs` },
        description: { ko: `${host} API 트래픽 로그 바로가기`, en: `${host} API traffic logs` },
        keywords: [host, "logs", "traffic", "로그"],
        customMarkdown: `[${host} > API 로그](hg://${domainTarget}/api/logs)`,
      });
      results.push({
        alias: `${domainTarget}/api/schema`,
        labels: { ko: `${host} > API 스키마`, en: `${host} > API Schema` },
        description: { ko: `${host} OpenAPI / 스키마 바로가기`, en: `${host} API schemas` },
        keywords: [host, "schema", "openapi", "스키마"],
        customMarkdown: `[${host} > API 스키마](hg://${domainTarget}/api/schema)`,
      });
      results.push({
        alias: `${domainTarget}/proxy`,
        labels: { ko: `${host} > 프록시 라우트`, en: `${host} > Proxy Route` },
        description: { ko: `${host} 로컬 프록시 연결 바로가기`, en: `${host} Proxy routes` },
        keywords: [host, "proxy", "local", "프록시"],
        customMarkdown: `[${host} > 프록시](hg://${domainTarget}/proxy)`,
      });
    }
  }

  // 2. Current Host (if not already covered)
  if (params.currentHost && !params.domains?.some((d) => d.host === params.currentHost)) {
    const ch = params.currentHost;
    results.push({
      alias: ch,
      labels: { ko: ch, en: ch },
      description: { ko: "현재 도메인 바로가기", en: "Current domain shortcut" },
      keywords: [ch, "domain", "현재", "host"],
      customMarkdown: `[${ch}](hg://${ch})`,
    });
    results.push({
      alias: `${ch}/api/mocking`,
      labels: { ko: `${ch} > API 모킹`, en: `${ch} > API Mocking` },
      description: { ko: "현재 도메인 API 모킹 규칙", en: "Current domain mock rules" },
      keywords: [ch, "mock", "api", "모킹"],
      customMarkdown: `[${ch} > API 모킹](hg://${ch}/api/mocking)`,
    });
    results.push({
      alias: `${ch}/api/logs`,
      labels: { ko: `${ch} > API 로그`, en: `${ch} > API Logs` },
      description: { ko: "현재 도메인 API 트래픽 로그", en: "Current domain traffic logs" },
      keywords: [ch, "logs", "traffic", "로그"],
      customMarkdown: `[${ch} > API 로그](hg://${ch}/api/logs)`,
    });
  }

  // 3. Global 13 Tools & Features
  for (const alias of GUIDE_FEATURE_ALIASES) {
    results.push(GUIDE_FEATURE_CATALOG[alias]);
  }

  // 4. Markdown formatting snippets
  const mdSnippets: Array<{ label: string; markdown: string; detail: string }> = [
    { label: "# 제목 1 (H1)", markdown: "# ", detail: "Heading 1" },
    { label: "## 제목 2 (H2)", markdown: "## ", detail: "Heading 2" },
    { label: "### 제목 3 (H3)", markdown: "### ", detail: "Heading 3" },
    { label: "**굵게 (Bold)**", markdown: "**텍스트**", detail: "Bold markdown" },
    { label: "`인라인 코드`", markdown: "`코드`", detail: "Inline code" },
    { label: "```코드 블록```", markdown: "```\n코드\n```", detail: "Code block" },
    { label: "- 목록 항목 (List)", markdown: "- ", detail: "Unordered list" },
    { label: "1. 번호 목록 (Numbered)", markdown: "1. ", detail: "Ordered list" },
    { label: "[링크](url)", markdown: "[제목](https://)", detail: "Markdown link" },
  ];

  for (const s of mdSnippets) {
    results.push({
      alias: s.label,
      labels: { ko: s.label, en: s.label },
      description: { ko: s.detail, en: s.detail },
      keywords: ["markdown", "md", s.label],
      customMarkdown: s.markdown,
    });
  }

  return results;
}

export function filterGuideFeatureItems(query: string, customItems?: GuideFeatureItem[]): GuideFeatureItem[] {
  const q = query.trim().toLowerCase();
  const list =
    customItems && customItems.length > 0
      ? customItems
      : GUIDE_FEATURE_ALIASES.map((alias) => GUIDE_FEATURE_CATALOG[alias]);
  return list.filter((item) => {
    if (!q) {
      return true;
    }
    return itemHaystack(item).includes(q);
  });
}

/** Consume trailing `]` / `]]` left by auto-pair when replacing a `[[` token. */
export function guideLinkReplaceEnd(value: string, triggerEnd: number): number {
  if (value.slice(triggerEnd, triggerEnd + 2) === "]]") {
    return triggerEnd + 2;
  }
  if (value[triggerEnd] === "]") {
    return triggerEnd + 1;
  }
  return triggerEnd;
}

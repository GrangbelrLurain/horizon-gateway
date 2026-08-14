export const GUIDE_FEATURE_ALIASES = ["mocking", "logs", "schema", "local", "inject"] as const;

export type GuideFeatureAlias = (typeof GUIDE_FEATURE_ALIASES)[number];

export const GUIDE_FEATURE_PANEL = {
  mocking: "api/mocking",
  logs: "api/logs",
  schema: "api/schema",
  local: "proxy",
  inject: "debug",
} as const;

export type GuideFeatureLang = "ko" | "en";

export interface GuideFeatureItem {
  alias: GuideFeatureAlias;
  labels: Record<GuideFeatureLang, string>;
  description: Record<GuideFeatureLang, string>;
  keywords: string[];
}

export const GUIDE_FEATURE_CATALOG: Record<GuideFeatureAlias, GuideFeatureItem> = {
  mocking: {
    alias: "mocking",
    labels: { ko: "모킹", en: "Mocking" },
    description: { ko: "API 모킹 규칙", en: "API mock rules" },
    keywords: ["mock", "api mock", "시나리오", "fake", "stub", "모의"],
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
  return (GUIDE_FEATURE_ALIASES as readonly string[]).includes(value);
}

/** `hg://mocking` → `"mocking"`. Non-hg hrefs return null. */
export function hgLinkAlias(href: string): string | null {
  const lower = href.trim().toLowerCase();
  if (!lower.startsWith("hg://")) {
    return null;
  }
  return lower.slice("hg://".length).replace(/\/+$/, "");
}

export function guideFeatureMarkdown(alias: GuideFeatureAlias, label: string): string {
  return `[${label}](hg://${alias})`;
}

export function guideFeatureLabel(alias: GuideFeatureAlias, lang: GuideFeatureLang): string {
  return GUIDE_FEATURE_CATALOG[alias].labels[lang];
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

  const hg = /hg:\/\/([a-z]*)$/i.exec(before);
  if (hg) {
    return { start: cursor - hg[0].length, end: cursor, query: hg[1], kind: "hg" };
  }

  return null;
}

function itemHaystack(item: GuideFeatureItem): string {
  return [item.alias, item.labels.ko, item.labels.en, item.description.ko, item.description.en, ...item.keywords]
    .join(" ")
    .toLowerCase();
}

export function filterGuideFeatureItems(query: string): GuideFeatureItem[] {
  const q = query.trim().toLowerCase();
  return GUIDE_FEATURE_ALIASES.map((alias) => GUIDE_FEATURE_CATALOG[alias]).filter((item) => {
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

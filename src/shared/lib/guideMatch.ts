import { matchHostPattern, matchPathPattern } from "./pattern";

export type GuideMatchFields = {
  hostPattern?: string | null;
  domain?: string | null;
  pathPattern?: string | null;
  url?: string | null;
};

export type RegisteredHost = {
  host: string;
  groupId: number | null;
};

export type GuideHostCoverageStatus = "ok" | "none" | "gap";

export type GuideHostCoverage = {
  status: GuideHostCoverageStatus;
  matchedHosts: string[];
  unmatchedGroupHosts: string[];
};

/**
 * Apply a guide by hostPattern. `domain` is capture origin only —
 * used as a legacy fallback when hostPattern is empty.
 */
export function annotationMatchesHost(ann: GuideMatchFields, actualHost: string): boolean {
  const pattern = ann.hostPattern?.trim() ? ann.hostPattern : null;
  return matchHostPattern(pattern, pattern ? null : ann.domain, actualHost);
}

export function annotationMatchesPage(ann: GuideMatchFields, actualHost: string, actualPath: string): boolean {
  return annotationMatchesHost(ann, actualHost) && matchPathPattern(ann.pathPattern, ann.url, actualPath);
}

export function resolveGuideHostCoverage(ann: GuideMatchFields, registered: RegisteredHost[]): GuideHostCoverage {
  const unique = new Map<string, number | null>();
  for (const item of registered) {
    const host = item.host.trim().toLowerCase();
    if (!host) {
      continue;
    }
    if (!unique.has(host)) {
      unique.set(host, item.groupId);
    }
  }
  const hosts = [...unique.entries()].map(([host, groupId]) => ({ host, groupId }));
  if (hosts.length === 0) {
    return { status: "ok", matchedHosts: [], unmatchedGroupHosts: [] };
  }
  const matchedHosts = hosts.filter((item) => annotationMatchesHost(ann, item.host)).map((item) => item.host);

  if (matchedHosts.length === 0) {
    return { status: "none", matchedHosts: [], unmatchedGroupHosts: [] };
  }

  const matchedGroupIds = new Set(
    hosts
      .filter((item) => matchedHosts.includes(item.host) && item.groupId != null)
      .map((item) => item.groupId as number),
  );
  const unmatchedGroupHosts = hosts
    .filter((item) => item.groupId != null && matchedGroupIds.has(item.groupId) && !matchedHosts.includes(item.host))
    .map((item) => item.host);

  return {
    status: unmatchedGroupHosts.length > 0 ? "gap" : "ok",
    matchedHosts,
    unmatchedGroupHosts,
  };
}

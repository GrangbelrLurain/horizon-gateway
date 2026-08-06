/**
 * Build an Open Graph / meta description from the latest Keep a Changelog entry.
 * Example: "v2.6.8 — 중복 도메인 감지 및 병합 정책 모달, 도메인 설정 비교 뷰, …"
 */

const VERSION_HEADER = /^## \[v?([\d.]+)\]\s*-\s*\d{4}-\d{2}-\d{2}\s*$/m;
const BOLD_TITLE = /^\s*-\s+\*\*(.+?)\*\*/gm;
const MAX_LENGTH = 180;

export function buildChangelogShareDescription(
  md: string,
  fallback: string,
): string {
  const header = md.match(VERSION_HEADER);
  if (!header || header.index === undefined) {
    return fallback;
  }

  const version = header[1];
  const bodyStart = header.index + header[0].length;
  const nextHeader = md.slice(bodyStart).search(/^## \[/m);
  const body =
    nextHeader === -1 ? md.slice(bodyStart) : md.slice(bodyStart, bodyStart + nextHeader);

  const titles: string[] = [];
  for (const match of body.matchAll(BOLD_TITLE)) {
    titles.push(match[1].trim());
  }

  if (titles.length === 0) {
    return `v${version} — ${fallback}`;
  }

  const prefix = `v${version} — `;
  let description = prefix + titles.join(', ');

  if (description.length <= MAX_LENGTH) {
    return description;
  }

  // Keep as many full titles as fit, then ellipsis.
  const kept: string[] = [];
  for (const title of titles) {
    const candidate = prefix + [...kept, title].join(', ');
    if (candidate.length + 1 > MAX_LENGTH) {
      break;
    }
    kept.push(title);
  }

  if (kept.length === 0) {
    const truncated = titles[0].slice(0, MAX_LENGTH - prefix.length - 1);
    return `${prefix}${truncated}…`;
  }

  return `${prefix}${kept.join(', ')}…`;
}

import type { ChangelogItem } from "./changelogTypes";

type ChangeType = ChangelogItem["changes"][number]["type"];

const SECTION_TYPE: Record<string, ChangeType> = {
  added: "added",
  changed: "changed",
  fixed: "fixed",
  removed: "changed",
  deprecated: "changed",
  security: "fixed",
};

/**
 * Parse Keep a Changelog markdown into ChangelogItem[].
 * English-only source; callers may overlay localized titles.
 */
export function parseChangelogMarkdown(md: string): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  const versionHeader = /^## \[v?([\d.]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/gm;

  const headers: { version: string; date: string; start: number; headerEnd: number }[] = [];
  for (const match of md.matchAll(versionHeader)) {
    headers.push({
      version: match[1],
      date: match[2],
      start: match.index ?? 0,
      headerEnd: (match.index ?? 0) + match[0].length,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const nextStart = i + 1 < headers.length ? headers[i + 1].start : md.length;
    const body = md.slice(header.headerEnd, nextStart).trim();
    const changes = parseVersionBody(body);
    if (changes.length === 0) {
      continue;
    }
    items.push({
      version: header.version,
      date: header.date,
      changes,
    });
  }

  return items;
}

function parseVersionBody(body: string): ChangelogItem["changes"] {
  const changes: ChangelogItem["changes"] = [];
  let currentType: ChangeType = "changed";
  const lines = body.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const section = line.match(/^###\s+(.+)\s*$/);
    if (section) {
      const key = section[1].trim().toLowerCase();
      currentType = SECTION_TYPE[key] ?? "changed";
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (!bullet) {
      continue;
    }

    const content = bullet[1].trim();
    const titled = content.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (titled) {
      const titleText = titled[1].trim();
      const descriptionText = titled[2].trim();
      changes.push({
        type: currentType,
        title: { en: titleText },
        ...(descriptionText
          ? {
              description: { en: descriptionText },
            }
          : {}),
      });
      continue;
    }

    if (content) {
      changes.push({
        type: currentType,
        title: { en: content },
      });
    }
  }

  return changes;
}

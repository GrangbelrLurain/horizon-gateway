import rawKoChangelog from "@/../CHANGELOG.ko.md?raw";
import rawEnChangelog from "@/../CHANGELOG.md?raw";

export interface ChangelogItem {
  version: string;
  date: string;
  changes: {
    type: "added" | "changed" | "fixed" | "removed" | "deprecated" | "security";
    title: string;
    description?: string;
  }[];
}

/**
 * Parses raw Markdown changelog content into structured objects.
 */
export function parseChangelog(md: string): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  // Split by version header, e.g. "## [v" or "## ["
  const sections = md.split(/##\s+\[v?/i);

  // Skip the first section (header text before release notes start)
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split("\n");
    const firstLine = lines[0].trim();

    // Regex to match "version] - date" or "version] (date)"
    const headerMatch = firstLine.match(/^([0-9a-zA-Z.-]+)\]\s*(?:-\s*|\(\s*)([0-9a-zA-Z.\-\s]+)?/i);
    if (!headerMatch) {
      continue;
    }

    const version = headerMatch[1];
    const date = headerMatch[2] ? headerMatch[2].trim() : "";

    const changes: ChangelogItem["changes"] = [];
    let currentType: ChangelogItem["changes"][0]["type"] | null = null;

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) {
        continue;
      }

      // Detect bullet headers (e.g. ### Added, ### 변경 사항)
      if (line.startsWith("###")) {
        const typeStr = line.toLowerCase();
        if (typeStr.includes("add")) {
          currentType = "added";
        } else if (typeStr.includes("change")) {
          currentType = "changed";
        } else if (typeStr.includes("fix")) {
          currentType = "fixed";
        } else if (typeStr.includes("remove")) {
          currentType = "removed";
        } else if (typeStr.includes("deprecat")) {
          currentType = "deprecated";
        } else if (typeStr.includes("security")) {
          currentType = "security";
        } else {
          currentType = null;
        }
        continue;
      }

      // Detect list items (e.g. - **Title**: description)
      if (line.startsWith("-") || line.startsWith("*")) {
        if (!currentType) {
          continue;
        }

        const content = line.replace(/^[-*]\s+/, "").trim();
        const strongMatch = content.match(/^\*\*(.*?)\*\*[:\-\s]*(.*)/);

        if (strongMatch) {
          changes.push({
            type: currentType,
            title: strongMatch[1].trim(),
            description: strongMatch[2] ? strongMatch[2].trim() : undefined,
          });
        } else {
          changes.push({
            type: currentType,
            title: content,
          });
        }
      }
    }

    if (changes.length > 0) {
      items.push({
        version,
        date,
        changes,
      });
    }
  }

  return items;
}

// Extensible bilingual parser map
const PARSED_CHANGELOGS: Record<string, ChangelogItem[]> = {
  en: parseChangelog(rawEnChangelog),
  ko: parseChangelog(rawKoChangelog),
};

/**
 * Retrieves the parsed changelog history for the given language.
 * Falls back to "en" if translation is missing.
 */
export function getParsedChangelog(lang: string, fallback = "en"): ChangelogItem[] {
  if (lang in PARSED_CHANGELOGS) {
    return PARSED_CHANGELOGS[lang];
  }
  if (fallback in PARSED_CHANGELOGS) {
    return PARSED_CHANGELOGS[fallback];
  }
  return PARSED_CHANGELOGS[fallback] || [];
}

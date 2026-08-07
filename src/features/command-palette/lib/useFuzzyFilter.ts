import type { PaletteCommandDef, PaletteOption } from "../types";

interface CorpusLayer {
  text: string;
  weight: number;
}

function buildCorpus(cmd: PaletteCommandDef, lang: "ko" | "en"): CorpusLayer[] {
  const otherLang = lang === "ko" ? "en" : "ko";
  const meta = cmd.meta;
  const layers: CorpusLayer[] = [];

  if (meta.label[lang]) {
    layers.push({ text: meta.label[lang], weight: 100 });
  }
  if (meta.label[otherLang]) {
    layers.push({ text: meta.label[otherLang], weight: 80 });
  }

  const aliasesCurrent = meta.aliases?.[lang];
  if (aliasesCurrent) {
    for (const alias of aliasesCurrent) {
      layers.push({ text: alias, weight: 60 });
    }
  }

  const aliasesCommon = meta.aliases?.common;
  if (aliasesCommon) {
    for (const alias of aliasesCommon) {
      layers.push({ text: alias, weight: 50 });
    }
  }

  const aliasesOther = meta.aliases?.[otherLang];
  if (aliasesOther) {
    for (const alias of aliasesOther) {
      layers.push({ text: alias, weight: 40 });
    }
  }

  const descLang = meta.description?.[lang];
  if (descLang) {
    layers.push({ text: descLang, weight: 20 });
  }
  const descOther = meta.description?.[otherLang];
  if (descOther) {
    layers.push({ text: descOther, weight: 10 });
  }

  layers.push({ text: cmd.id, weight: 5 });

  return layers;
}

export function scoreCommand(cmd: PaletteCommandDef, query: string, lang: "ko" | "en"): number {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 1;
  }

  const corpus = buildCorpus(cmd, lang);
  let maxScore = 0;

  for (const { text, weight } of corpus) {
    const t = text.toLowerCase();
    if (t === q) {
      maxScore = Math.max(maxScore, weight * 2);
    } else if (t.startsWith(q)) {
      maxScore = Math.max(maxScore, weight * 1.5);
    } else if (t.includes(q)) {
      maxScore = Math.max(maxScore, weight * 1.0);
    } else {
      // Check word parts
      const parts = t.split(/\s+/);
      for (const part of parts) {
        if (part.startsWith(q)) {
          maxScore = Math.max(maxScore, weight * 1.2);
          break;
        }
      }
    }
  }

  return maxScore;
}

export function filterCommands(
  commands: PaletteCommandDef[],
  query: string,
  lang: "ko" | "en",
  recents: string[],
): PaletteCommandDef[] {
  if (!query.trim()) {
    // Sort by recent first, then by group order
    const groupOrder: Record<string, number> = {
      recent: 0,
      domains: 1,
      mocking: 2,
      actions: 3,
      team: 4,
      settings: 5,
    };
    return [...commands].sort((a, b) => {
      const aRecent = recents.indexOf(a.id);
      const bRecent = recents.indexOf(b.id);
      if (aRecent !== -1 && bRecent !== -1) {
        return aRecent - bRecent;
      }
      if (aRecent !== -1) {
        return -1;
      }
      if (bRecent !== -1) {
        return 1;
      }
      return (groupOrder[a.group] ?? 99) - (groupOrder[b.group] ?? 99);
    });
  }

  const scored = commands
    .map((cmd) => ({ cmd, score: scoreCommand(cmd, query, lang) }))
    .filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.map((item) => item.cmd);
}

export function filterOptions(options: PaletteOption[], query: string): PaletteOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return options;
  }

  return options.filter((opt) => {
    const l = opt.label.toLowerCase();
    const d = opt.description?.toLowerCase() || "";
    const k = opt.keywords?.join(" ").toLowerCase() || "";
    return l.includes(q) || d.includes(q) || k.includes(q);
  });
}

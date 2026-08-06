export function parsePartialJson(src: string): { data: unknown | null; truncated: boolean } {
  let clean = src.trim();
  let truncated = false;

  const truncIndex = clean.lastIndexOf("...(truncated)");
  if (truncIndex !== -1) {
    clean = clean.substring(0, truncIndex).trim();
    truncated = true;
  }

  try {
    return { data: JSON.parse(clean), truncated };
  } catch (_e) {}

  let s = clean;
  for (let attempt = 0; attempt < 25; attempt++) {
    const lastComma = s.lastIndexOf(",");
    const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    const cutPos = Math.max(lastComma, lastBrace);
    if (cutPos <= 0) {
      break;
    }

    s = s.substring(0, cutPos).trim();
    if (s.endsWith(",")) {
      s = s.slice(0, -1).trim();
    }

    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && s[i - 1] !== "\\") {
        inString = !inString;
      }
      if (!inString) {
        if (ch === "{") {
          openBraces++;
        } else if (ch === "}") {
          openBraces--;
        } else if (ch === "[") {
          openBrackets++;
        } else if (ch === "]") {
          openBrackets--;
        }
      }
    }

    let closing = "";
    for (let b = 0; b < Math.max(0, openBrackets); b++) {
      closing += "]";
    }
    for (let b = 0; b < Math.max(0, openBraces); b++) {
      closing += "}";
    }

    try {
      return { data: JSON.parse(s + closing), truncated: true };
    } catch (_e2) {}
  }

  return { data: null, truncated };
}

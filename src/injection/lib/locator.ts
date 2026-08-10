import type { Annotation, AnnotationLocator, LocatorValidation } from "@/shared/api";

export type LocatorResolveResult = {
  el: HTMLElement | null;
  index: number | null;
  counts: number[];
  validation: LocatorValidation;
};

const SEMANTIC_ROLES: Record<string, string> = {
  BUTTON: "button",
  A: "link",
  INPUT: "textbox",
  TEXTAREA: "textbox",
  SELECT: "combobox",
  IMG: "img",
  H1: "heading",
  H2: "heading",
  H3: "heading",
  NAV: "navigation",
  MAIN: "main",
  HEADER: "banner",
  FOOTER: "contentinfo",
};

function escapeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function accessibleName(el: Element): string {
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) {
    return aria;
  }
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean);
    if (parts.length) {
      return parts.join(" ");
    }
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const id = el.getAttribute("id");
    if (id) {
      const label = document.querySelector(`label[for="${escapeAttr(id)}"]`);
      const t = label?.textContent?.trim();
      if (t) {
        return t;
      }
    }
  }
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

function inferredRole(el: Element): string {
  const explicit = el.getAttribute("role")?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  return SEMANTIC_ROLES[el.tagName] || el.tagName.toLowerCase();
}

/** Build priority locators from a clicked DOM element. */
export function buildLocatorsFromElement(el: HTMLElement, cssSelector: string): AnnotationLocator[] {
  const locators: AnnotationLocator[] = [];
  const testid = el.getAttribute("data-testid") || el.getAttribute("data-qa");
  if (testid) {
    locators.push({ strategy: "testid", value: testid });
  }

  const role = inferredRole(el);
  const name = accessibleName(el);
  if (role && name && name.length <= 80) {
    locators.push({ strategy: "role", role, name });
  }

  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel && ariaLabel.length <= 80) {
    locators.push({ strategy: "label", value: ariaLabel });
  }

  const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  if (text && text.length >= 2 && text.length <= 60 && !locators.some((l) => l.strategy === "text")) {
    locators.push({ strategy: "text", value: text });
  }

  if (cssSelector) {
    locators.push({ strategy: "css", value: cssSelector });
  }

  return locators;
}

export function ensureLocators(annotation: Annotation): AnnotationLocator[] {
  if (annotation.locators && annotation.locators.length > 0) {
    return annotation.locators;
  }
  const locators: AnnotationLocator[] = [];
  if (annotation.selector) {
    locators.push({ strategy: "css", value: annotation.selector });
  }
  const text = (annotation.content || "").trim();
  if (text) {
    locators.push({ strategy: "text", value: text.slice(0, 80) });
  }
  return locators;
}

export function queryAll(locator: AnnotationLocator, hintTagName?: string): Element[] {
  try {
    switch (locator.strategy) {
      case "testid": {
        const v = locator.value?.trim();
        if (!v) {
          return [];
        }
        const escaped = escapeAttr(v);
        return Array.from(document.querySelectorAll(`[data-testid="${escaped}"], [data-qa="${escaped}"]`));
      }
      case "css": {
        const v = locator.value?.trim();
        if (!v) {
          return [];
        }
        return Array.from(document.querySelectorAll(v));
      }
      case "label": {
        const v = locator.value?.trim();
        if (!v) {
          return [];
        }
        const candidates = hintTagName
          ? Array.from(document.getElementsByTagName(hintTagName))
          : Array.from(document.querySelectorAll("button, a, input, textarea, select, [aria-label], [role]"));
        return candidates.filter((el) => {
          if (el.closest("#horizon-gateway-injection-container")) {
            return false;
          }
          return accessibleName(el) === v;
        });
      }
      case "text": {
        const v = locator.value?.trim();
        if (!v) {
          return [];
        }
        const candidates = hintTagName
          ? Array.from(document.getElementsByTagName(hintTagName))
          : Array.from(document.querySelectorAll("button, a, label, span, p, h1, h2, h3, li"));
        return candidates.filter((el) => {
          if (el.closest("#horizon-gateway-injection-container")) {
            return false;
          }
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          return t === v || (v.length >= 4 && t.includes(v));
        });
      }
      case "role": {
        const role = locator.role?.trim().toLowerCase();
        const name = locator.name?.trim();
        if (!role || !name) {
          return [];
        }
        const semanticTags = Object.entries(SEMANTIC_ROLES)
          .filter(([, r]) => r === role)
          .map(([tag]) => tag.toLowerCase());
        const selectorParts = [`[role="${escapeAttr(role)}"]`, ...semanticTags];
        const candidates = Array.from(document.querySelectorAll(selectorParts.join(",")));
        return candidates.filter((el) => {
          if (el.closest("#horizon-gateway-injection-container")) {
            return false;
          }
          return inferredRole(el) === role && accessibleName(el) === name;
        });
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export function validateLocators(annotation: Annotation): LocatorValidation {
  const locators = ensureLocators(annotation);
  const hint = annotation.tagName || undefined;
  const counts = locators.map((l) => queryAll(l, hint).length);
  const primaryMatches = counts[0] ?? 0;

  let resolvedBy: number | undefined;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 1) {
      resolvedBy = i;
      break;
    }
  }

  const fallbackMatches = counts.slice(1);
  let suggestPromoteTo: number | undefined;
  if (primaryMatches !== 1) {
    const uniqueFallbackIndexes = fallbackMatches.map((c, i) => (c === 1 ? i + 1 : -1)).filter((i) => i >= 0);
    if (uniqueFallbackIndexes.length === 1) {
      suggestPromoteTo = uniqueFallbackIndexes[0];
    }
  }

  let status: LocatorValidation["status"];
  if (primaryMatches === 1) {
    status = "ok";
  } else if (suggestPromoteTo != null) {
    status = "weak";
  } else if (counts.every((c) => c === 0)) {
    status = "broken";
  } else {
    status = "ambiguous";
  }

  return {
    status,
    checkedAt: Date.now(),
    primaryMatches,
    fallbackMatches,
    resolvedBy: resolvedBy ?? null,
    suggestPromoteTo: suggestPromoteTo ?? null,
  };
}

export function resolveAnnotation(annotation: Annotation): LocatorResolveResult {
  const locators = ensureLocators(annotation);
  const hint = annotation.tagName || undefined;
  const counts = locators.map((l) => queryAll(l, hint).length);
  const validation = validateLocators(annotation);

  let el: HTMLElement | null = null;
  let index: number | null = null;
  if (validation.resolvedBy != null) {
    index = validation.resolvedBy;
    const matches = queryAll(locators[index], hint);
    el = (matches[0] as HTMLElement) || null;
  }

  return { el, index, counts, validation };
}

/** Reorder locators so `promoteIndex` becomes primary; keep relative order of others. */
export function promoteLocator(locators: AnnotationLocator[], promoteIndex: number): AnnotationLocator[] {
  if (promoteIndex <= 0 || promoteIndex >= locators.length) {
    return [...locators];
  }
  const next = [...locators];
  const [picked] = next.splice(promoteIndex, 1);
  next.unshift(picked);
  return next;
}

export function denormalizedSelector(locators: AnnotationLocator[]): string {
  const css = locators.find((l) => l.strategy === "css");
  if (css?.value) {
    return css.value;
  }
  const testid = locators.find((l) => l.strategy === "testid");
  if (testid?.value) {
    return `[data-testid="${testid.value}"]`;
  }
  return "";
}

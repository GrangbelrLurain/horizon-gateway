/**
 * Enhanced CSS Selector Generator
 * Prioritizes IDs, stable attributes, and relative paths for maximum reliability.
 */
export function generateRobustSelector(el: HTMLElement): string {
  if (el.id && /^[a-zA-Z]/.test(el.id) && !/\d{5,}/.test(el.id)) {
    return `#${CSS.escape(el.id)}`;
  }

  const path: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();

    // 1. Check for stable ID
    if (current.id && /^[a-zA-Z]/.test(current.id) && !/\d{5,}/.test(current.id)) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break; // Found a stable anchor
    }

    // 2. Check for stable attributes
    const stableAttrs = ["data-testid", "data-qa", "name", "aria-label", "role"];
    let foundAttr = false;
    for (const attr of stableAttrs) {
      const val = current.getAttribute(attr);
      if (val) {
        selector += `[${attr}="${CSS.escape(val)}"]`;
        foundAttr = true;
        break;
      }
    }

    // 3. Fallback to nth-child if no stable attributes
    if (!foundAttr) {
      let index = 1;
      let sib = current.previousElementSibling;
      while (sib) {
        if (sib.nodeName === current.nodeName) {
          index++;
        }
        sib = sib.previousElementSibling;
      }
      if (index > 1 || current.nextElementSibling) {
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    if (current.nodeName.toLowerCase() === "html") {
      break;
    }
    current = current.parentElement;
  }

  return path.join(" > ");
}

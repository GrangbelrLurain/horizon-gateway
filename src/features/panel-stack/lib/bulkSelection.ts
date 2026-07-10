export interface BulkPointerModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function isModifierClick(mods: BulkPointerModifiers): boolean {
  return mods.shiftKey || mods.ctrlKey || mods.metaKey;
}

export function rangeIdsBetween(orderedIds: number[], anchorId: number, targetId: number): number[] {
  const fromIdx = orderedIds.indexOf(anchorId);
  const toIdx = orderedIds.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) {
    return [anchorId, targetId];
  }
  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  return orderedIds.slice(start, end + 1);
}

export function mergeRangeIntoSelection(prev: ReadonlySet<number>, rangeIds: number[]): Set<number> {
  const next = new Set(prev);
  for (const id of rangeIds) {
    next.add(id);
  }
  return next;
}

export function toggleInSelection(prev: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(prev);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function selectionFromIds(ids: number[]): Set<number> {
  return new Set(ids);
}

export function formatSelectedDomainUrls(
  orderedVisibleIds: number[],
  selectedIds: ReadonlySet<number>,
  idToUrl: Map<number, string>,
): string {
  const lines: string[] = [];
  for (const id of orderedVisibleIds) {
    if (!selectedIds.has(id)) {
      continue;
    }
    const url = idToUrl.get(id);
    if (url) {
      lines.push(url);
    }
  }
  return lines.join("\n");
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

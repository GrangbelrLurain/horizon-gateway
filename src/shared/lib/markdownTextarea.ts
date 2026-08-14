export const DEFAULT_INDENT = "  ";

export interface TextareaEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface MarkdownKeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
  keyCode?: number;
}

const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "`": "`",
};

const CLOSERS = new Set(Object.values(PAIRS));

export function isImeKey(e: MarkdownKeyEvent): boolean {
  return Boolean(e.isComposing || e.nativeEvent?.isComposing || e.key === "Process" || e.keyCode === 229);
}

export function detectIndentUnit(text: string): string {
  let tabs = 0;
  let spaces = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("\t")) {
      tabs += 1;
    } else if (line.startsWith("  ")) {
      spaces += 1;
    }
  }
  return tabs > spaces ? "\t" : DEFAULT_INDENT;
}

function lineStart(value: string, index: number): number {
  const at = value.lastIndexOf("\n", index - 1);
  return at === -1 ? 0 : at + 1;
}

function selectedBlockBounds(value: string, start: number, end: number): { from: number; to: number } {
  const from = lineStart(value, start);
  if (start === end) {
    const nl = value.indexOf("\n", end);
    return { from, to: nl === -1 ? value.length : nl };
  }
  let last = end;
  if (end > start && value[end - 1] === "\n") {
    last = end - 1;
  }
  const nl = value.indexOf("\n", last);
  return { from, to: nl === -1 ? value.length : nl };
}

function outdentLine(line: string, indent: string): { line: string; delta: number } {
  if (line.startsWith(indent)) {
    return { line: line.slice(indent.length), delta: -indent.length };
  }
  if (line.startsWith("\t")) {
    return { line: line.slice(1), delta: -1 };
  }
  let n = 0;
  const max = indent === "\t" ? 1 : indent.length;
  while (n < max && line[n] === " ") {
    n += 1;
  }
  return { line: line.slice(n), delta: -n };
}

function mapIndexThroughLines(
  pos: number,
  from: number,
  to: number,
  lineDeltas: { start: number; delta: number }[],
  blockDelta: number,
): number {
  if (pos < from) {
    return pos;
  }
  if (pos > to) {
    return pos + blockDelta;
  }
  const rel = pos - from;
  let acc = 0;
  for (const item of lineDeltas) {
    if (rel >= item.start) {
      acc += item.delta;
    }
  }
  return Math.max(from, pos + acc);
}

/** Indent/outdent at column 0 of each affected line. Never inserts at the caret. */
export function applyIndent(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
  indent: string = DEFAULT_INDENT,
): TextareaEdit {
  const { from, to } = selectedBlockBounds(value, start, end);
  const block = value.slice(from, to);
  const lines = block.split("\n");
  const lineDeltas: { start: number; delta: number }[] = [];
  let offset = 0;
  const nextLines: string[] = [];
  for (const line of lines) {
    if (outdent) {
      const result = outdentLine(line, indent);
      lineDeltas.push({ start: offset, delta: result.delta });
      nextLines.push(result.line);
    } else {
      lineDeltas.push({ start: offset, delta: indent.length });
      nextLines.push(indent + line);
    }
    offset += line.length + 1;
  }

  const newBlock = nextLines.join("\n");
  const blockDelta = newBlock.length - block.length;
  return {
    value: value.slice(0, from) + newBlock + value.slice(to),
    selectionStart: mapIndexThroughLines(start, from, to, lineDeltas, blockDelta),
    selectionEnd: mapIndexThroughLines(end, from, to, lineDeltas, blockDelta),
  };
}

function wrapPair(value: string, start: number, end: number, open: string, close: string): TextareaEdit {
  return {
    value: value.slice(0, start) + open + value.slice(start, end) + close + value.slice(end),
    selectionStart: start + open.length,
    selectionEnd: end + open.length,
  };
}

function insertPair(value: string, start: number, open: string, close: string): TextareaEdit {
  return {
    value: value.slice(0, start) + open + close + value.slice(start),
    selectionStart: start + open.length,
    selectionEnd: start + open.length,
  };
}

/** `[|]` + `[` → `[[|]]` so the wiki picker can open. */
function pairSquareBracket(value: string, start: number, end: number): TextareaEdit {
  if (start !== end) {
    return wrapPair(value, start, end, "[", "]");
  }
  if (value[start - 1] === "[" && value[start] === "]") {
    return {
      value: `${value.slice(0, start)}[${value.slice(start, start + 1)}]${value.slice(start + 1)}`,
      selectionStart: start + 1,
      selectionEnd: start + 1,
    };
  }
  return insertPair(value, start, "[", "]");
}

function pairOpener(value: string, start: number, end: number, open: string, close: string): TextareaEdit {
  if (start !== end) {
    return wrapPair(value, start, end, open, close);
  }
  if (open === "`" && value[start - 1] === "`") {
    return {
      value: value.slice(0, start) + open + value.slice(start),
      selectionStart: start + 1,
      selectionEnd: start + 1,
    };
  }
  return insertPair(value, start, open, close);
}

/**
 * Tab indent, Shift+Tab outdent, auto-pair `()[]{}` and `` ` ``, skip-over closers,
 * and delete empty pairs on Backspace. Returns null when the key should type normally.
 */
export function applyMarkdownTextareaKey(
  e: MarkdownKeyEvent,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextareaEdit | null {
  if (isImeKey(e) || e.ctrlKey || e.metaKey || e.altKey) {
    return null;
  }

  const start = selectionStart;
  const end = selectionEnd;

  if (e.key === "Tab") {
    return applyIndent(value, start, end, e.shiftKey, detectIndentUnit(value));
  }

  if (e.key === "Backspace" && start === end && start > 0) {
    const open = value[start - 1];
    const close = value[start];
    if (open && close && PAIRS[open] === close) {
      return {
        value: value.slice(0, start - 1) + value.slice(start + 1),
        selectionStart: start - 1,
        selectionEnd: start - 1,
      };
    }
    return null;
  }

  if (e.key.length === 1 && CLOSERS.has(e.key) && start === end && value[start] === e.key) {
    return {
      value,
      selectionStart: start + 1,
      selectionEnd: start + 1,
    };
  }

  if (e.key === "[") {
    return pairSquareBracket(value, start, end);
  }

  const close = PAIRS[e.key];
  if (close) {
    return pairOpener(value, start, end, e.key, close);
  }

  return null;
}

export function applyTextareaEdit(
  el: HTMLTextAreaElement | null,
  edit: TextareaEdit,
  onChange: (next: string) => void,
): void {
  onChange(edit.value);
  requestAnimationFrame(() => {
    if (!el) {
      return;
    }
    el.focus();
    el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  });
}

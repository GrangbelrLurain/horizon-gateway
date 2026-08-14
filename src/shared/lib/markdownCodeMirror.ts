import { addCursorAbove, addCursorBelow } from "@codemirror/commands";
import { EditorSelection, type EditorState } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";

type Command = (view: EditorView) => boolean;

const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "`": "`",
};

function charAt(state: EditorState, pos: number): string {
  if (pos < 0 || pos >= state.doc.length) {
    return "";
  }
  return state.doc.sliceString(pos, pos + 1);
}

function notComposing(run: Command): Command {
  return (view) => {
    if (view.composing) {
      return false;
    }
    return run(view);
  };
}

function pairChars(open: string, close: string): Command {
  return notComposing((view) => {
    const tr = view.state.changeByRange((range) => {
      if (!range.empty) {
        const selected = view.state.doc.sliceString(range.from, range.to);
        return {
          changes: { from: range.from, to: range.to, insert: open + selected + close },
          range: EditorSelection.range(range.from + open.length, range.to + open.length),
        };
      }
      if (open === "`" && charAt(view.state, range.from - 1) === "`") {
        return {
          changes: { from: range.from, insert: open },
          range: EditorSelection.cursor(range.from + 1),
        };
      }
      return {
        changes: { from: range.from, insert: open + close },
        range: EditorSelection.cursor(range.from + open.length),
      };
    });
    view.dispatch(tr);
    return true;
  });
}

const pairSquareBracket: Command = notComposing((view) => {
  const tr = view.state.changeByRange((range) => {
    if (!range.empty) {
      const selected = view.state.doc.sliceString(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: `[${selected}]` },
        range: EditorSelection.range(range.from + 1, range.to + 1),
      };
    }
    if (charAt(view.state, range.from - 1) === "[" && charAt(view.state, range.from) === "]") {
      return {
        changes: { from: range.from, to: range.from + 1, insert: "[]]" },
        range: EditorSelection.cursor(range.from + 1),
      };
    }
    return {
      changes: { from: range.from, insert: "[]" },
      range: EditorSelection.cursor(range.from + 1),
    };
  });
  view.dispatch(tr);
  return true;
});

function skipCloser(close: string): Command {
  return notComposing((view) => {
    const allSkip = view.state.selection.ranges.every(
      (range) => range.empty && charAt(view.state, range.from) === close,
    );
    if (!allSkip) {
      return false;
    }
    const tr = view.state.changeByRange((range) => ({
      range: EditorSelection.cursor(range.from + 1),
    }));
    view.dispatch(tr);
    return true;
  });
}

const deleteEmptyPair: Command = notComposing((view) => {
  const ranges = view.state.selection.ranges;
  if (
    !ranges.every((range) => {
      if (!range.empty) {
        return false;
      }
      const open = charAt(view.state, range.from - 1);
      const close = charAt(view.state, range.from);
      return Boolean(open && close && PAIRS[open] === close);
    })
  ) {
    return false;
  }
  const tr = view.state.changeByRange((range) => ({
    changes: { from: range.from - 1, to: range.from + 1, insert: "" },
    range: EditorSelection.cursor(range.from - 1),
  }));
  view.dispatch(tr);
  return true;
});

export function markdownEditorKeymap(): KeyBinding[] {
  return [
    { key: "(", run: pairChars("(", ")") },
    { key: "[", run: pairSquareBracket },
    { key: "{", run: pairChars("{", "}") },
    { key: "`", run: pairChars("`", "`") },
    { key: ")", run: skipCloser(")") },
    { key: "]", run: skipCloser("]") },
    { key: "}", run: skipCloser("}") },
    { key: "Backspace", run: deleteEmptyPair },
    { key: "Ctrl-ArrowUp", run: addCursorAbove, preventDefault: true },
    { key: "Ctrl-ArrowDown", run: addCursorBelow, preventDefault: true },
  ];
}

export function editorRoot(host: HTMLElement): Document | ShadowRoot {
  const node = host.getRootNode();
  return node instanceof ShadowRoot ? node : document;
}

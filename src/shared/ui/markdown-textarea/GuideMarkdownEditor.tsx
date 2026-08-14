import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import { placeholder as cmPlaceholder, drawSelection, EditorView, keymap } from "@codemirror/view";
import clsx from "clsx";
import { forwardRef, type KeyboardEvent, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import {
  detectGuideLinkTrigger,
  filterGuideFeatureItems,
  type GuideFeatureAlias,
  type GuideFeatureItem,
  type GuideFeatureLang,
  type GuideLinkTrigger,
  guideFeatureLabel,
  guideFeatureMarkdown,
  guideLinkReplaceEnd,
} from "@/shared/lib/guideFeatureLinks";
import { editorRoot, markdownEditorKeymap } from "@/shared/lib/markdownCodeMirror";
import { DEFAULT_INDENT, isImeKey } from "@/shared/lib/markdownTextarea";

export interface GuideMarkdownEditorHandle {
  insertAlias: (alias: GuideFeatureAlias, labelOverride?: string) => void;
  getValue: () => string;
}

function sameTrigger(a: GuideLinkTrigger | null, b: GuideLinkTrigger | null): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.start === b.start && a.end === b.end && a.query === b.query && a.kind === b.kind;
}

function hubTheme() {
  return EditorView.theme({
    "&": {
      height: "100%",
      minHeight: "0",
      maxHeight: "100%",
      fontSize: "12px",
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
      lineHeight: "1.625",
      height: "100%",
      minHeight: "0",
    },
    ".cm-content": {
      padding: "8px 12px",
      caretColor: "currentColor",
    },
    ".cm-line": { padding: "0" },
  });
}

function overlayTheme() {
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        minHeight: "0",
        maxHeight: "100%",
        fontSize: "12px",
        color: "#f8fafc",
        backgroundColor: "transparent",
        overflow: "hidden",
      },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "inherit",
        lineHeight: "1.5",
        height: "100%",
        minHeight: "0",
      },
      ".cm-content": {
        padding: "10px 12px",
        caretColor: "#f8fafc",
      },
      ".cm-line": { padding: "0" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f8fafc" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "rgba(59, 130, 246, 0.38)",
      },
      ".cm-activeLine": { backgroundColor: "transparent" },
    },
    { dark: true },
  );
}

export const GuideMarkdownEditor = forwardRef<
  GuideMarkdownEditorHandle,
  {
    id?: string;
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    lang?: GuideFeatureLang;
    variant?: "hub" | "overlay";
    className?: string;
  }
>(function MarkdownEditorInner({ id, value, onChange, placeholder, lang = "ko", variant = "hub", className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const syncingRef = useRef(false);
  const suggestOpenRef = useRef(false);
  const [suggest, setSuggest] = useState<GuideLinkTrigger | null>(null);
  const [highlight, setHighlight] = useState(0);

  valueRef.current = value;
  onChangeRef.current = onChange;

  const items = suggest ? filterGuideFeatureItems(suggest.query) : [];
  suggestOpenRef.current = Boolean(suggest && items.length > 0);

  const refreshFromViewRef = useRef((view: EditorView) => {
    const text = view.state.doc.toString();
    const head = view.state.selection.main.head;
    const next = detectGuideLinkTrigger(text, head);
    setSuggest((prev) => {
      if (sameTrigger(prev, next)) {
        return prev;
      }
      setHighlight(0);
      return next;
    });
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const overlay = variant === "overlay";
    const view = new EditorView({
      parent: host,
      root: editorRoot(host),
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          indentUnit.of(DEFAULT_INDENT),
          EditorState.tabSize.of(2),
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          overlay ? overlayTheme() : hubTheme(),
          EditorView.contentAttributes.of({
            ...(id ? { id } : {}),
            spellcheck: "true",
          }),
          Prec.highest(
            keymap.of([
              {
                key: "Tab",
                run: () => suggestOpenRef.current,
                shift: () => suggestOpenRef.current,
              },
              ...markdownEditorKeymap(),
            ]),
          ),
          keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !syncingRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              refreshFromViewRef.current(update.view);
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once per field instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, id, placeholder]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }
    syncingRef.current = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
    syncingRef.current = false;
  }, [value]);

  const replaceRange = (start: number, end: number, alias: GuideFeatureAlias, labelOverride?: string) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const label = labelOverride?.trim() || guideFeatureLabel(alias, lang);
    const snippet = guideFeatureMarkdown(alias, label);
    view.dispatch({
      changes: { from: start, to: end, insert: snippet },
      selection: EditorSelection.cursor(start + snippet.length),
      scrollIntoView: true,
    });
    view.focus();
    setSuggest(null);
  };

  const insertAlias = (alias: GuideFeatureAlias, labelOverride?: string) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const range = view.state.selection.main;
    const selected = view.state.doc.sliceString(range.from, range.to);
    replaceRange(range.from, range.to, alias, labelOverride ?? selected);
  };

  const pickItem = (item: GuideFeatureItem) => {
    if (!suggest) {
      return;
    }
    const view = viewRef.current;
    const text = view?.state.doc.toString() ?? "";
    replaceRange(suggest.start, guideLinkReplaceEnd(text, suggest.end), item.alias);
  };

  useImperativeHandle(ref, () => ({
    insertAlias,
    getValue: () => viewRef.current?.state.doc.toString() ?? valueRef.current,
  }));

  const onPickerKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isImeKey(e) || !suggest || items.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      const item = items[highlight] ?? items[0];
      if (item) {
        pickItem(item);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setSuggest(null);
    }
  };

  const overlay = variant === "overlay";

  return (
    <div
      className={overlay ? className : clsx("relative flex-1 min-h-0 overflow-hidden flex flex-col", className)}
      style={
        overlay
          ? {
              position: "relative",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }
          : undefined
      }
      onKeyDownCapture={onPickerKeyDownCapture}
    >
      <div
        className={
          overlay
            ? undefined
            : "h-full min-h-0 flex-1 overflow-hidden rounded-lg border border-base-content/20 bg-base-100"
        }
        style={
          overlay
            ? {
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }
            : undefined
        }
      >
        <div
          ref={hostRef}
          className={overlay ? undefined : "h-full w-full min-h-0 overflow-hidden"}
          style={{ height: "100%", minHeight: 0, overflow: "hidden" }}
        />
      </div>
      {suggest && items.length > 0 && (
        <div
          className={
            overlay
              ? undefined
              : "absolute z-30 left-0 right-0 bottom-0 max-h-[45%] overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
          }
          style={
            overlay
              ? {
                  position: "absolute",
                  zIndex: 30,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  maxHeight: "45%",
                  overflowY: "auto",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  background: "rgba(15, 23, 42, 0.98)",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
                }
              : undefined
          }
        >
          {items.map((item, index) => (
            <button
              key={item.alias}
              type="button"
              className={
                overlay
                  ? undefined
                  : clsx(
                      "w-full text-left px-3 py-1.5 text-[11px] hover:bg-base-200 flex items-center justify-between gap-2",
                      index === highlight && "bg-primary/10 text-primary font-bold",
                    )
              }
              style={
                overlay
                  ? {
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: "11px",
                      background: index === highlight ? "rgba(59, 130, 246, 0.22)" : "transparent",
                      color: index === highlight ? "#93c5fd" : "rgba(248, 250, 252, 0.92)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }
                  : undefined
              }
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pickItem(item)}
            >
              <span>
                <span style={{ display: "block" }}>{item.labels[lang]}</span>
                <span
                  className={overlay ? undefined : "block text-[10px] font-normal text-base-content/40"}
                  style={
                    overlay
                      ? { display: "block", fontSize: "10px", fontWeight: 400, color: "rgba(148, 163, 184, 0.85)" }
                      : undefined
                  }
                >
                  {item.description[lang]}
                </span>
              </span>
              <span
                className={overlay ? undefined : "font-mono text-[10px] text-base-content/40 shrink-0"}
                style={
                  overlay
                    ? { fontFamily: "monospace", fontSize: "10px", color: "rgba(148, 163, 184, 0.7)", flexShrink: 0 }
                    : undefined
                }
              >
                hg://{item.alias}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

GuideMarkdownEditor.displayName = "GuideMarkdownEditor";

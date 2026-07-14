import * as Babel from "@babel/standalone";
import Editor, { type Monaco } from "@monaco-editor/react";
import clsx from "clsx";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface SuggestionItem {
  label: string;
  insertText?: string;
  detail?: string;
}

interface TsCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  context?: Record<string, any>;
  customSuggestions?: SuggestionItem[];
  placeholder?: string;
  className?: string;
  rows?: number; // if rows === 1, it runs in single-line mode
  language?: "typescript" | "json" | "css" | "javascript";
  onEvaluate?: (result: any, error: string | null) => void;
  theme?: "horizon-gateway-light" | "horizon-gateway-dark";
}

// Generate TS declarations (.d.ts) from runtime context object
function generateTypeDefinitions(context: Record<string, any>): string {
  let dts = "";

  function getTypeName(val: any, indent = "  "): string {
    if (val === null) {
      return "null";
    }
    if (val === undefined) {
      return "undefined";
    }
    if (Array.isArray(val)) {
      if (val.length > 0) {
        return `Array<${getTypeName(val[0], indent)}>`;
      }
      return "Array<any>";
    }
    if (typeof val === "object") {
      let res = "{\n";
      for (const [k, v] of Object.entries(val)) {
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
        res += `${indent}${safeKey}: ${getTypeName(v, `${indent}  `)};\n`;
      }
      res += `${indent.slice(2)}}`;
      return res;
    }
    return typeof val;
  }

  for (const [key, value] of Object.entries(context)) {
    dts += `declare const ${key}: ${getTypeName(value)};\n`;
    if (key === "props") {
      dts += `declare type Props = typeof props;\n`;
      dts += `declare type PreviewProps = typeof props;\n`;
    }
  }

  return dts;
}

// Real-time TS Code Transpiler & Sandbox Evaluator
export function evaluateTsCode(code: string, context: Record<string, any> = {}): any {
  if (!code.trim()) {
    return null;
  }

  let cleanCode = code.trim();

  // If the code doesn't contain a return statement, wrap it to return the expression value
  if (!cleanCode.includes("return")) {
    if (cleanCode.includes("\n") || cleanCode.includes(";")) {
      const lines = cleanCode.split("\n");
      const lastLineIdx = lines.length - 1;
      const lastLine = lines[lastLineIdx].trim();
      if (
        lastLine &&
        !lastLine.startsWith("return") &&
        !lastLine.startsWith("const ") &&
        !lastLine.startsWith("let ") &&
        !lastLine.startsWith("var ")
      ) {
        lines[lastLineIdx] = `return (${lastLine});`;
      }
      cleanCode = lines.join("\n");
    } else {
      cleanCode = `return (${cleanCode});`;
    }
  }

  const wrappedCode = `
    function __evaluated_func() {
      ${cleanCode}
    }
    __evaluated_func();
  `;

  const compiled = Babel.transform(wrappedCode, {
    presets: [["react", { runtime: "classic" }], "typescript"],
    filename: "evaluate.tsx",
  }).code;

  if (!compiled) {
    throw new Error("컴파일 결과가 비어있습니다.");
  }

  const keys = Object.keys(context);
  const values = Object.values(context);
  const fn = new Function(...keys, compiled);

  return fn(...values);
}

export const TsCodeEditor: React.FC<TsCodeEditorProps> = ({
  value,
  onChange,
  context = {},
  customSuggestions = [],
  className,
  rows = 4,
  language = "typescript",
  onEvaluate,
  theme = "horizon-gateway-light",
}) => {
  const [editorKey] = useState(() => Math.random().toString(36).substring(2, 9));
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);
  const extraLibRef = useRef<any>(null);
  const customSuggestRef = useRef<any>(null);

  // Debounced evaluation
  useEffect(() => {
    if (!onEvaluate) {
      return;
    }
    const timer = setTimeout(() => {
      try {
        const res = evaluateTsCode(value, context);
        onEvaluate(res, null);
      } catch (err) {
        const error = err as Error;
        onEvaluate(null, error.message || String(err));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, context, onEvaluate]);

  // Inject types and suggestions into Monaco instance
  useEffect(() => {
    if (!monacoInstance) {
      return;
    }

    // 1. Inject dynamic typings (d.ts) for TypeScript autocomplete
    if (extraLibRef.current) {
      extraLibRef.current.dispose();
      extraLibRef.current = null;
    }

    const dts = generateTypeDefinitions(context);
    if (dts) {
      extraLibRef.current = monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
        dts,
        `ts:filename/horizon-gateway-context-${editorKey}.d.ts`,
      );
    }

    // 2. Inject custom suggestions (e.g. Schema fields or keyword shortcuts)
    if (customSuggestRef.current) {
      customSuggestRef.current.dispose();
      customSuggestRef.current = null;
    }

    if (customSuggestions.length > 0) {
      customSuggestRef.current = monacoInstance.languages.registerCompletionItemProvider(language, {
        provideCompletionItems: (model: any, position: any) => {
          const expectedUri =
            language === "typescript"
              ? `file:///preview_${editorKey}.tsx`
              : language === "javascript"
                ? `file:///preview_${editorKey}.jsx`
                : language === "json"
                  ? `file:///mock_${editorKey}.json`
                  : "";

          if (expectedUri && model.uri.toString() !== expectedUri) {
            return { suggestions: [] };
          }

          // Verify we are at the root level or typing a key, not inside a dot path
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          // If typing after a dot, let Monaco's TS service handle member autocompletion
          if (textUntilPosition.endsWith(".")) {
            return { suggestions: [] };
          }

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          return {
            suggestions: customSuggestions.map((item) => ({
              label: item.label,
              kind: monacoInstance.languages.CompletionItemKind.Field,
              documentation: item.detail,
              insertText: item.insertText || item.label,
              range,
            })),
          };
        },
      });
    }

    return () => {
      if (extraLibRef.current) {
        extraLibRef.current.dispose();
      }
      if (customSuggestRef.current) {
        customSuggestRef.current.dispose();
      }
    };
  }, [context, customSuggestions, monacoInstance, language, editorKey]);

  const handleEditorWillMount = (monaco: Monaco) => {
    setMonacoInstance(monaco);

    // Register premium horizon-gateway-dark theme
    monaco.editor.defineTheme("horizon-gateway-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "identifier", foreground: "9cdcfe" },
        { token: "identifier.js", foreground: "9cdcfe" },
        { token: "identifier.ts", foreground: "9cdcfe" },
        { token: "keyword", foreground: "569cd6" },
        { token: "string", foreground: "ce9178" },
        { token: "number", foreground: "b5cea8" },
        { token: "comment", foreground: "6a9955" },
        { token: "delimiter", foreground: "d4d4d4" },
        { token: "type", foreground: "4ec9b0" },
      ],
      colors: {
        "editor.background": "#18181b",
        "editor.foreground": "#d4d4d8",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#a1a1aa",
        "editor.lineHighlightBackground": "#27272a",
      },
    });

    // Register premium horizon-gateway-light theme
    monaco.editor.defineTheme("horizon-gateway-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "identifier", foreground: "0969da" },
        { token: "identifier.js", foreground: "0969da" },
        { token: "identifier.ts", foreground: "0969da" },
        { token: "keyword", foreground: "cf222e" },
        { token: "string", foreground: "0a3069" },
        { token: "number", foreground: "0550ae" },
        { token: "comment", foreground: "6e7781" },
        { token: "delimiter", foreground: "24292f" },
        { token: "type", foreground: "953800" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#24292f",
        "editorLineNumber.foreground": "#8c959f",
        "editorLineNumber.activeForeground": "#24292f",
        "editor.lineHighlightBackground": "#f6f8fa",
      },
    });

    // Setup TypeScript compiler configurations for JSX/TSX support
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: 1, // JsxEmit.React = 1
      target: 99, // ScriptTarget.Latest = 99
      allowNonTsExtensions: true,
      moduleResolution: 2, // ModuleResolutionKind.NodeJs = 2
    });

    // Disable syntax and semantic diagnostics to prevent false-positive red underlines in template expressions
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  };

  const isSingleLine = rows === 1;

  const handleEditorDidMount = (editor: any) => {
    if (isSingleLine) {
      // Force layout calculation on content change to ensure wordWrap updates e.contentHeight
      editor.onDidChangeModelContent(() => {
        editor.layout();
      });

      editor.onDidContentSizeChange((e: any) => {
        const contentHeight = e.contentHeight;
        // Restrict auto-grow height between 30px (1 line) and 120px (approx 5 lines)
        const newHeight = Math.max(30, Math.min(contentHeight, 120));
        const container = editor.getContainerDomNode();
        if (container?.parentElement) {
          container.parentElement.style.height = `${newHeight}px`;
        }
      });
    }
  };

  // Monaco Editor Options configuration
  const editorOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 11,
    fontFamily: "Fira Code, monospace, JetBrains Mono, Courier New",
    lineHeight: 18,
    renderLineHighlight: isSingleLine ? ("none" as const) : ("all" as const),
    scrollbar: isSingleLine
      ? { vertical: "hidden" as const, horizontal: "hidden" as const, handleMouseWheel: false }
      : { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    // Single-line inputs configuration adjustments
    lineNumbers: isSingleLine ? ("off" as const) : ("on" as const),
    glyphMargin: !isSingleLine,
    folding: !isSingleLine,
    lineDecorationsWidth: isSingleLine ? 0 : 10,
    lineNumbersMinChars: isSingleLine ? 0 : 3,
    wordWrap: "on" as const,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    padding: isSingleLine ? { top: 5, bottom: 5 } : { top: 8, bottom: 8 },
    // Prevent clipping of autocomplete popover by overflow parent containers
    fixedOverflowWidgets: true,
  };

  return (
    <div
      className={clsx(
        "border border-base-300 rounded-xl overflow-hidden bg-base-100 focus-within:border-primary/50 transition-all duration-150 w-full",
        isSingleLine ? "h-[30px]" : "h-full min-h-[120px]",
        className,
      )}
    >
      <Editor
        language={language}
        path={
          language === "typescript"
            ? `file:///preview_${editorKey}.tsx`
            : language === "javascript"
              ? `file:///preview_${editorKey}.jsx`
              : language === "json"
                ? `file:///mock_${editorKey}.json`
                : undefined
        }
        theme={theme === "horizon-gateway-light" ? "horizon-gateway-light" : "horizon-gateway-dark"}
        value={value}
        onChange={(val) => onChange(val || "")}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        options={editorOptions}
        className="w-full h-full"
      />
    </div>
  );
};

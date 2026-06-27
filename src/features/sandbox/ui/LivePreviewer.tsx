import * as Babel from "@babel/standalone";
import { useAtom } from "jotai";
import { AlertCircle, Play, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { livePreviewCodeAtom } from "@/entities/sandbox";

export interface LivePreviewerProps {
  initialData?: any;
  code?: string;
}

export function LivePreviewer({ initialData, code: propCode }: LivePreviewerProps) {
  const [localCode, setLocalCode] = useAtom(livePreviewCodeAtom);
  const code = propCode !== undefined ? propCode : localCode;
  const setCode = setLocalCode;

  const [mockDataStr, setMockDataStr] = useState(
    JSON.stringify(
      initialData || {
        title: "실시간 API 바인딩 결과",
        message: "이 데이터는 API 응답 또는 파이프라인에서 온 데이터입니다.",
        items: ["실시간 React 렌더링", "Tailwind CSS 스타일링 지원", "샌드박스 보안 격리"],
      },
      null,
      2,
    ),
  );

  const [compileError, setCompileError] = useState<string | null>(null);
  const [iframeSrcDoc, setIframeSrcDoc] = useState("");

  // Sync initialData changes from pipeline / API client
  useEffect(() => {
    if (initialData) {
      setMockDataStr(JSON.stringify(initialData, null, 2));
    }
  }, [initialData]);

  const handleRender = () => {
    setCompileError(null);
    try {
      // 1. Validate mock data JSON
      let parsedData = {};
      if (propCode !== undefined) {
        parsedData = initialData || {};
      } else {
        try {
          parsedData = JSON.parse(mockDataStr);
        } catch (e: any) {
          throw new Error(`JSON Mock Data 파싱 에러: ${e.message}`);
        }
      }

      // 2. Compile JSX/TSX code using Babel
      // Basic check for default export
      if (!code.includes("export default")) {
        throw new Error("컴포넌트에 'export default' 선언이 보이지 않습니다. Default export 컴포넌트가 필요합니다.");
      }

      // Replace export default with window.GeneratedComponent assignment
      let cleanCode = code
        .replace(/export\s+default\s+function\s+(\w+)/g, "function $1")
        .replace(/export\s+default\s+class\s+(\w+)/g, "class $1");

      if (cleanCode.includes("export default")) {
        // Handle export default anonymous function or variable reference
        cleanCode = cleanCode.replace(/export\s+default\s+/g, "window.GeneratedComponent = ");
      } else {
        // Extract default exported function name and assign at bottom
        const match = code.match(/export\s+default\s+function\s+(\w+)/);
        if (match?.[1]) {
          cleanCode += `\nwindow.GeneratedComponent = ${match[1]};`;
        } else {
          // Try arrow functions / variables
          const varMatch = code.match(/export\s+default\s+(\w+)/);
          if (varMatch?.[1]) {
            cleanCode += `\nwindow.GeneratedComponent = ${varMatch[1]};`;
          } else {
            throw new Error(
              "Default export 구문 파싱 실패. 'export default function MyComponent' 형태로 정의해주세요.",
            );
          }
        }
      }

      // Transpile using Babel
      const compiled = Babel.transform(cleanCode, {
        presets: ["react", "typescript"],
        filename: "preview.tsx",
      }).code;

      if (!compiled) {
        throw new Error("컴파일 결과가 비어있습니다.");
      }

      // 3. Construct srcDoc with react, react-dom and tailwind injection
      const srcDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <script src="https://unpkg.com/react@19/umd/react.development.js" crossorigin></script>
            <script src="https://unpkg.com/react-dom@19/umd/react-dom.development.js" crossorigin></script>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body {
                margin: 0;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: transparent;
              }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script>
              const React = window.React;
              const ReactDOM = window.ReactDOM;
              const data = ${JSON.stringify(parsedData)};

              try {
                // Execute transpiled user code
                ${compiled}

                // Mount React component
                const container = document.getElementById('root');
                const root = ReactDOM.createRoot(container);
                
                if (!window.GeneratedComponent) {
                  throw new Error("컴포넌트를 찾을 수 없습니다. 'export default function Preview' 형태의 선언이 존재하는지 확인해 주세요.");
                }
                
                root.render(React.createElement(window.GeneratedComponent, { data }));
              } catch (err) {
                document.getElementById('root').innerHTML = \`
                  <div style="color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px;">
                    <h4 style="margin: 0 0 8px 0; font-weight: bold;">렌더링 에러:</h4>
                    \${err.message}
                  </div>
                \`;
              }
            </script>
          </body>
        </html>
      `;

      setIframeSrcDoc(srcDoc);
    } catch (err: any) {
      setCompileError(err.message || "Compilation failed");
      setIframeSrcDoc("");
    }
  };

  // Trigger render on source code or data change
  useEffect(() => {
    handleRender();
  }, [handleRender]);

  // Conditionally render ONLY the preview iframe if code was passed as a prop
  if (propCode !== undefined) {
    return (
      <div className="w-full h-full relative bg-white">
        {compileError ? (
          <div className="absolute inset-0 p-4 bg-error/5 text-error font-mono text-xs overflow-auto flex flex-col space-y-2">
            <span className="font-bold flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> 컴파일 에러:
            </span>
            <pre className="whitespace-pre-wrap">{compileError}</pre>
          </div>
        ) : iframeSrcDoc ? (
          <iframe
            title="Live Render Sandbox"
            srcDoc={iframeSrcDoc}
            sandbox="allow-scripts"
            className="w-full h-full border-none bg-transparent"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-base-content/40 italic">
            코드 컴파일을 기다리는 중...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-[calc(100vh-14rem)] items-stretch">
      {/* Code Editors Panel (Left Side - 7 columns) */}
      <div className="lg:col-span-7 flex flex-col gap-4 h-full">
        {/* React Component Editor */}
        <div className="flex-1 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-2">
            <span className="font-semibold text-xs text-base-content/70 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> React Component (TSX/JSX)
            </span>
            <button className="btn btn-xs btn-primary flex items-center gap-1" onClick={handleRender}>
              <Play className="w-3 h-3" /> 실행 (Render)
            </button>
          </div>
          <textarea
            className="flex-1 font-mono text-xs p-3 bg-base-200 border border-base-300 rounded-lg focus:outline-none resize-none leading-relaxed text-base-content"
            placeholder="React Component code..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {/* Mock JSON Input */}
        <div className="h-[200px] card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-2">
            <span className="font-semibold text-xs text-base-content/70">Props 데이터 (JSON Mock Data)</span>
          </div>
          <textarea
            className="flex-1 font-mono text-xs p-2.5 bg-base-200 border border-base-300 rounded-lg focus:outline-none resize-none text-base-content"
            placeholder="{}"
            value={mockDataStr}
            onChange={(e) => setMockDataStr(e.target.value)}
          />
        </div>
      </div>

      {/* Live Preview Panel (Right Side - 5 columns) */}
      <div className="lg:col-span-5 card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col h-full">
        <h3 className="font-semibold text-lg text-base-content/85 mb-3 border-b border-base-200 pb-2 shrink-0">
          실시간 결과 (Live Preview)
        </h3>

        <div className="flex-1 bg-white border border-base-300 rounded-lg overflow-hidden relative">
          {compileError ? (
            <div className="absolute inset-0 p-4 bg-error/5 text-error font-mono text-xs overflow-auto flex flex-col space-y-2">
              <span className="font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> 컴파일 에러:
              </span>
              <pre className="whitespace-pre-wrap">{compileError}</pre>
            </div>
          ) : iframeSrcDoc ? (
            <iframe
              title="Live Render Sandbox"
              srcDoc={iframeSrcDoc}
              sandbox="allow-scripts"
              className="w-full h-full border-none bg-transparent"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-base-content/40 italic">
              코드 컴파일을 기다리는 중...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

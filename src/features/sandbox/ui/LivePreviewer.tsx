import * as Babel from "@babel/standalone";
import { useAtom } from "jotai";
import { AlertCircle, Check, Copy, Play, Plus, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type SavedComponent, savedComponentsAtom, selectedComponentIdAtom } from "@/entities/sandbox";

export interface LivePreviewerProps {
  initialData?: any;
  code?: string;
}

export function LivePreviewer({ initialData, code: propCode }: LivePreviewerProps) {
  // Standalone CRUD atoms
  const [savedComponents, setSavedComponents] = useAtom(savedComponentsAtom);
  const [selectedId, setSelectedId] = useAtom(selectedComponentIdAtom);

  const [searchQuery, setSearchQuery] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // Active selected component
  const activeComponent = useMemo(() => {
    return savedComponents.find((c) => c.id === selectedId) || savedComponents[0] || null;
  }, [savedComponents, selectedId]);

  // Sync selected component ID fallback
  useEffect(() => {
    if (activeComponent && activeComponent.id !== selectedId) {
      setSelectedId(activeComponent.id);
    }
  }, [activeComponent, selectedId, setSelectedId]);

  // Local editor states
  const [editedCode, setEditedCode] = useState("");
  const [editedMockData, setEditedMockData] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedDesc, setEditedDesc] = useState("");

  const [compileError, setCompileError] = useState<string | null>(null);
  const [iframeSrcDoc, setIframeSrcDoc] = useState("");

  // Sync editors when switching active component (only when standalone)
  useEffect(() => {
    if (propCode === undefined && activeComponent) {
      setEditedCode(activeComponent.code);
      setEditedMockData(activeComponent.mockData);
      setEditedName(activeComponent.name);
      setEditedDesc(activeComponent.description);
    }
  }, [activeComponent, propCode]);

  // Source inputs selector based on mode
  const codeToCompile = propCode !== undefined ? propCode : editedCode;

  // Filtered components list for search
  const filteredComponents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return savedComponents;
    }
    return savedComponents.filter(
      (c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query),
    );
  }, [savedComponents, searchQuery]);

  // Compile and load to iframe
  const handleRender = useCallback(() => {
    setCompileError(null);
    if (!codeToCompile) {
      setIframeSrcDoc("");
      return;
    }

    try {
      // 1. Validate mock data JSON
      let parsedData = {};
      if (propCode !== undefined) {
        parsedData = initialData || {};
      } else {
        try {
          parsedData = JSON.parse(editedMockData || "{}");
        } catch (e: any) {
          throw new Error(`JSON Mock Data 파싱 에러: ${e.message}`);
        }
      }

      // 2. Compile JSX/TSX code using Babel
      if (!codeToCompile.includes("export default")) {
        throw new Error("컴포넌트에 'export default' 선언이 보이지 않습니다. Default export 컴포넌트가 필요합니다.");
      }

      // Replace export default with window.GeneratedComponent assignment
      let cleanCode = codeToCompile
        .replace(/export\s+default\s+function\s+(\w+)/g, "function $1")
        .replace(/export\s+default\s+class\s+(\w+)/g, "class $1");

      if (cleanCode.includes("export default")) {
        // Handle export default anonymous function or variable reference
        cleanCode = cleanCode.replace(/export\s+default\s+/g, "window.GeneratedComponent = ");
      } else {
        // Extract default exported function name and assign at bottom
        const match = codeToCompile.match(/export\s+default\s+function\s+(\w+)/);
        if (match?.[1]) {
          cleanCode += `\nwindow.GeneratedComponent = ${match[1]};`;
        } else {
          // Try arrow functions / variables
          const varMatch = codeToCompile.match(/export\s+default\s+(\w+)/);
          if (varMatch?.[1]) {
            cleanCode += `\nwindow.GeneratedComponent = ${varMatch[1]};`;
          } else {
            throw new Error(
              "Default export 구문 파싱 실패. 'export default function MyComponent' 형태로 정의해주세요.",
            );
          }
        }
      }

      // Transpile using Babel with classic React runtime and CommonJS module support
      const compiled = Babel.transform(cleanCode, {
        presets: [["react", { runtime: "classic" }], "typescript"],
        plugins: ["transform-modules-commonjs"],
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
            <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
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
              // Set up CommonJS environment in global scope
              window.exports = {};
              window.module = { exports: window.exports };
              window.require = function(moduleName) {
                if (moduleName === 'react') return window.React;
                if (moduleName === 'react-dom') return window.ReactDOM;
                throw new Error('Module not found in sandbox: ' + moduleName);
              };

              const React = window.React;
              const ReactDOM = window.ReactDOM;
              const data = ${JSON.stringify(parsedData)};

              try {
                // Execute transpiled user code
                ${compiled}

                // Mount React component
                const container = document.getElementById('root');
                const root = ReactDOM.createRoot(container);
                
                const Component = window.GeneratedComponent || (window.exports && window.exports.default) || (window.module && window.module.exports);
                
                if (!Component) {
                  throw new Error("컴포넌트를 찾을 수 없습니다. 'export default function Preview' 형태의 선언이 존재하는지 확인해 주세요.");
                }
                
                // Pass json fields directly as root props
                const props = (typeof data === 'object' && data !== null && !Array.isArray(data))
                  ? data
                  : {};
                
                root.render(React.createElement(Component, props));
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
  }, [codeToCompile, propCode, editedMockData, initialData]);

  // Trigger render on source code or data change
  useEffect(() => {
    handleRender();
  }, [handleRender]);

  // CRUD handlers
  const handleCreateComponent = () => {
    const newId = `component_${Math.random().toString(36).substring(2, 9)}`;
    const newComponent: SavedComponent = {
      id: newId,
      name: `CustomComponent_${savedComponents.length + 1}`,
      description: "새로운 커스텀 React 컴포넌트",
      code: `import React from 'react';

export default function Preview({ message }) {
  const display = message || "안녕하세요! 새 컴포넌트입니다.";
  return (
    <div className="p-6 bg-base-100 border border-base-300 rounded-xl shadow-md text-center max-w-sm mx-auto">
      <h3 className="text-lg font-bold text-primary">커스텀 컴포넌트</h3>
      <p className="text-sm mt-2 text-base-content/70">{display}</p>
    </div>
  );
}`,
      mockData: `{
  "message": "안녕하세요! 새 컴포넌트입니다."
}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSavedComponents([...savedComponents, newComponent]);
    setSelectedId(newId);
  };

  const handleSaveComponent = () => {
    if (!activeComponent) {
      return;
    }

    const updated = savedComponents.map((c) => {
      if (c.id === activeComponent.id) {
        return {
          ...c,
          name: editedName.trim() || "UntitledComponent",
          description: editedDesc.trim(),
          code: editedCode,
          mockData: editedMockData,
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    setSavedComponents(updated);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDuplicateComponent = (c: SavedComponent, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `component_${Math.random().toString(36).substring(2, 9)}`;
    const duplicated: SavedComponent = {
      ...c,
      id: newId,
      name: `${c.name}_Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSavedComponents([...savedComponents, duplicated]);
    setSelectedId(newId);
  };

  const handleDeleteComponent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (savedComponents.length <= 1) {
      alert("최소 하나의 컴포넌트는 저장소에 유지되어야 합니다.");
      return;
    }
    if (confirm("이 컴포넌트를 스토리지에서 삭제하시겠습니까?")) {
      const updated = savedComponents.filter((c) => c.id !== id);
      setSavedComponents(updated);
      if (selectedId === id) {
        setSelectedId(updated[0].id);
      }
    }
  };

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
      {/* Component List Pane (Left Side - 3 columns) */}
      <div className="lg:col-span-3 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-3 gap-2 shrink-0">
          <span className="font-bold text-xs text-base-content/70 flex items-center gap-1">📂 저장된 컴포넌트</span>
          <button
            className="btn btn-xs btn-primary btn-outline flex items-center gap-1"
            onClick={handleCreateComponent}
          >
            <Plus className="w-3.5 h-3.5" /> 추가
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3 shrink-0">
          <Search className="w-3.5 h-3.5 text-base-content/40 absolute left-3 top-2.5" />
          <input
            type="text"
            className="input input-bordered input-sm w-full pl-8 text-xs focus:outline-none"
            placeholder="컴포넌트 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Component Items */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-none">
          {filteredComponents.map((c) => {
            const isActive = c.id === selectedId;
            return (
              <div
                key={c.id}
                className={`group p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-base-200 hover:bg-base-200/50 text-base-content/80"
                }`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="truncate flex-1 min-w-0 mr-2">
                  <div className="font-bold truncate">{c.name}</div>
                  <div className="text-[10px] text-base-content/50 truncate font-normal mt-0.5">
                    {c.description || "설명 없음"}
                  </div>
                </div>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    className="btn btn-ghost btn-xs p-0 w-6 h-6 hover:bg-base-300 text-base-content/60"
                    title="복제"
                    onClick={(e) => handleDuplicateComponent(c, e)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs p-0 w-6 h-6 hover:bg-error/15 text-error/70"
                    title="삭제"
                    onClick={(e) => handleDeleteComponent(c.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {filteredComponents.length === 0 && (
            <div className="text-center py-8 text-xs text-base-content/40 italic">저장된 컴포넌트가 없습니다.</div>
          )}
        </div>
      </div>

      {/* Code & Props Editors Panel (Middle - 5 columns) */}
      <div className="lg:col-span-5 flex flex-col h-full overflow-hidden">
        {/* Component Meta Panel */}
        <div className="bg-base-200/60 p-3 rounded-2xl border border-base-300 mb-3.5 flex flex-col gap-2 shrink-0">
          <div className="flex gap-2.5 items-end">
            <div className="flex-1">
              <label className="text-[9px] font-bold text-base-content/50 uppercase tracking-wider">컴포넌트명</label>
              <input
                type="text"
                className="input input-bordered input-xs font-bold w-full mt-0.5 text-xs focus:outline-none"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
            </div>
            <div>
              <button
                className={`btn btn-xs btn-primary flex items-center gap-1 font-bold ${justSaved ? "btn-success" : ""}`}
                onClick={handleSaveComponent}
                disabled={!activeComponent}
              >
                {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {justSaved ? "저장됨" : "저장"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-base-content/50 uppercase tracking-wider">설명</label>
            <input
              type="text"
              className="input input-bordered input-xs w-full mt-0.5 text-xs focus:outline-none"
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              placeholder="컴포넌트에 대한 설명을 적어주세요..."
            />
          </div>
        </div>

        {/* React Component Editor */}
        <div className="flex-1 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col min-h-[220px] overflow-hidden mb-3.5">
          <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-2 shrink-0">
            <span className="font-semibold text-xs text-base-content/70 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> React Component (TSX/JSX)
            </span>
            <button
              className="btn btn-xs btn-ghost btn-outline flex items-center gap-1 hover:bg-base-200"
              onClick={handleRender}
            >
              <Play className="w-3 h-3 text-primary" /> 실행 (Render)
            </button>
          </div>
          <textarea
            className="flex-1 font-mono text-[11px] p-3 bg-base-200 border border-base-300 rounded-xl focus:outline-none resize-none leading-relaxed text-base-content"
            placeholder="React Component code..."
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
          />
        </div>

        {/* Mock JSON Input */}
        <div className="h-[180px] card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col shrink-0">
          <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-2 shrink-0">
            <span className="font-semibold text-xs text-base-content/70">Props 데이터 (JSON Mock Data)</span>
          </div>
          <textarea
            className="flex-1 font-mono text-[11px] p-2.5 bg-base-200 border border-base-300 rounded-xl focus:outline-none resize-none text-base-content"
            placeholder="{}"
            value={editedMockData}
            onChange={(e) => setEditedMockData(e.target.value)}
          />
        </div>
      </div>

      {/* Live Preview Panel (Right Side - 4 columns) */}
      <div className="lg:col-span-4 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col h-full overflow-hidden">
        <h3 className="font-semibold text-xs text-base-content/70 mb-3 border-b border-base-200 pb-2 shrink-0">
          🖥️ 실시간 결과 (Live Preview)
        </h3>

        <div className="flex-1 bg-white border border-base-300 rounded-xl overflow-hidden relative">
          {compileError ? (
            <div className="absolute inset-0 p-4 bg-error/5 text-error font-mono text-[11px] overflow-auto flex flex-col space-y-2">
              <span className="font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> 컴파일 에러:
              </span>
              <pre className="whitespace-pre-wrap leading-relaxed">{compileError}</pre>
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

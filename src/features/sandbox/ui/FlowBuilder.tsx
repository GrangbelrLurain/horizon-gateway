import {
  addEdge,
  Background,
  type Connection,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  FileCode,
  Globe,
  HelpCircle,
  Lock,
  Play,
  Plus,
  Settings,
  Shuffle,
  Trash2,
  Tv,
} from "lucide-react";
import {
  activeFlowAtom,
  apiClientCurrentRequestAtom,
  apiClientHistoryAtom,
  CryptoNode,
  cryptoToolCurrentConfigAtom,
  executePipeline,
  type NodeExecutionResult,
  type PipelineEdge,
  type PipelineExecutionReport,
  type PipelineFlow,
  type PipelineNode,
  savedComponentsAtom,
  savedJsonSchemasAtom,
} from "@/entities/sandbox";
import { LivePreviewer } from "./LivePreviewer";

// ── Custom Node Components ──────────────────────────────────────────────────

// 1. API Node Component
function ApiNodeComponent({ data }: { data: any }) {
  const isRunning = data.isRunning;
  const isSuccess = data.isSuccess;
  const isError = data.isError;
  const elapsedMs = data.elapsedMs;

  return (
    <div
      className={`p-3 rounded-xl border bg-base-100 shadow-md min-w-[180px] transition-all ${
        isRunning
          ? "border-primary ring-2 ring-primary/20 animate-pulse"
          : isSuccess
            ? "border-success ring-1 ring-success/30"
            : isError
              ? "border-error ring-1 ring-error/30"
              : "border-base-300 hover:border-primary/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-primary" />
      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-base-200">
        <Globe className="w-4 h-4 text-success" />
        <span className="text-xs font-bold text-base-content/80">API Request</span>
      </div>
      <div className="space-y-1">
        <div className="text-[11px] font-bold font-mono">
          <span className="text-success mr-1">{data.config?.method || "GET"}</span>
          <span className="text-base-content/50 truncate max-w-[100px] inline-block align-bottom">
            {data.config?.url ? new URL(data.config.url).pathname : "/endpoint"}
          </span>
        </div>
        {elapsedMs && <div className="text-[9px] text-base-content/40">{elapsedMs}ms</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-primary" />
    </div>
  );
}

// 2. Crypto Node Component
function CryptoNodeComponent({ data }: { data: any }) {
  const isRunning = data.isRunning;
  const isSuccess = data.isSuccess;
  const isError = data.isError;

  return (
    <div
      className={`p-3 rounded-xl border bg-base-100 shadow-md min-w-[180px] transition-all ${
        isRunning
          ? "border-primary ring-2 ring-primary/20 animate-pulse"
          : isSuccess
            ? "border-success ring-1 ring-success/30"
            : isError
              ? "border-error ring-1 ring-error/30"
              : "border-base-300 hover:border-primary/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-primary" />
      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-base-200">
        <Lock className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-base-content/80">Crypto Tool</span>
      </div>
      <div className="text-[10px] font-mono font-bold text-primary/80 uppercase">
        {data.config?.action || "base64Encode"}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-primary" />
    </div>
  );
}

// 3. Schema Validation Node Component
function SchemaNodeComponent({ data }: { data: any }) {
  const isRunning = data.isRunning;
  const isSuccess = data.isSuccess;
  const isError = data.isError;

  return (
    <div
      className={`p-3 rounded-xl border bg-base-100 shadow-md min-w-[180px] transition-all ${
        isRunning
          ? "border-primary ring-2 ring-primary/20 animate-pulse"
          : isSuccess
            ? "border-success ring-1 ring-success/30"
            : isError
              ? "border-error ring-1 ring-error/30"
              : "border-base-300 hover:border-primary/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-primary" />
      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-base-200">
        <FileCode className="w-4 h-4 text-warning" />
        <span className="text-xs font-bold text-base-content/80">Schema Valid</span>
      </div>
      <div className="text-[10px] font-semibold text-base-content/60">Payload vs Schema</div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-primary" />
    </div>
  );
}

// 4. Preview Node Component
function PreviewNodeComponent({ data }: { data: any }) {
  const isRunning = data.isRunning;
  const isSuccess = data.isSuccess;
  const isError = data.isError;

  return (
    <div
      className={`p-3 rounded-xl border bg-base-100 shadow-md min-w-[180px] transition-all ${
        isRunning
          ? "border-primary ring-2 ring-primary/20 animate-pulse"
          : isSuccess
            ? "border-success ring-1 ring-success/30"
            : isError
              ? "border-error ring-1 ring-error/30"
              : "border-base-300 hover:border-primary/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-primary" />
      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-base-200">
        <Tv className="w-4 h-4 text-secondary" />
        <span className="text-xs font-bold text-base-content/80">UI Preview</span>
      </div>
      <div className="text-[10px] font-semibold text-base-content/60">React Live Preview</div>
    </div>
  );
}

// 5. Mapper Node Component
function MapperNodeComponent({ data }: { data: any }) {
  const isRunning = data.isRunning;
  const isSuccess = data.isSuccess;
  const isError = data.isError;

  return (
    <div
      className={`p-3 rounded-xl border bg-base-100 shadow-md min-w-[180px] transition-all ${
        isRunning
          ? "border-primary ring-2 ring-primary/20 animate-pulse"
          : isSuccess
            ? "border-success ring-1 ring-success/30"
            : isError
              ? "border-error ring-1 ring-error/30"
              : "border-base-300 hover:border-primary/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-primary" />
      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-base-200">
        <Shuffle className="w-4 h-4 text-info" />
        <span className="text-xs font-bold text-base-content/80">Data Mapper</span>
      </div>
      <div className="text-[10px] font-semibold text-base-content/60">
        {data.config?.mappings?.length || 0} mappings defined
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-primary" />
    </div>
  );
}

// Node registrations object for React Flow
const nodeTypes = {
  api: ApiNodeComponent as any,
  crypto: CryptoNodeComponent as any,
  schema: SchemaNodeComponent as any,
  preview: PreviewNodeComponent as any,
  mapper: MapperNodeComponent as any,
};

// ── Main FlowBuilder Component ──────────────────────────────────────────────

export interface FlowBuilderProps {
  onExportPreviewData?: (data: any) => void;
}

export function FlowBuilder({ onExportPreviewData }: FlowBuilderProps) {
  // Sync pipeline state with persistent Jotai atom
  const [persistedFlow, setPersistedFlow] = useAtom(activeFlowAtom);

  const apiClientCurrentRequest = useAtomValue(apiClientCurrentRequestAtom);
  const apiClientHistory = useAtomValue(apiClientHistoryAtom);
  const cryptoToolCurrentConfig = useAtomValue(cryptoToolCurrentConfigAtom);
  const savedJsonSchemas = useAtomValue(savedJsonSchemasAtom);
  const savedComponents = useAtomValue(savedComponentsAtom);

  // Map persisted data into React Flow state
  const initialNodes = useMemo(() => {
    if (!persistedFlow || !Array.isArray(persistedFlow.nodes)) {
      return [];
    }
    return persistedFlow.nodes.map((node) => {
      let parsedConfig: any = {};
      if (node.config) {
        if (typeof node.config === "string") {
          try {
            parsedConfig = JSON.parse(node.config);
          } catch (e) {
            console.error("Failed to parse node config", e);
          }
        } else {
          parsedConfig = node.config;
        }
      }
      return {
        id: node.id,
        type: node.type,
        position: (node as any).position || { x: Math.random() * 200 + 100, y: Math.random() * 150 + 100 },
        data: {
          label: node.label || "",
          config: parsedConfig,
          isRunning: false,
          isSuccess: false,
          isError: false,
          elapsedMs: null as number | null,
        },
      };
    });
  }, [persistedFlow]);

  const initialEdges = useMemo(() => {
    if (!persistedFlow || !Array.isArray(persistedFlow.edges)) {
      return [];
    }
    return persistedFlow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));
  }, [persistedFlow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Active configurations panel states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [report, setReport] = useState<PipelineExecutionReport | null>(null);

  // Save changes back to Jotai
  const saveFlowToStorage = (updatedNodes: any[], updatedEdges: any[]) => {
    const serializedNodes: PipelineNode[] = updatedNodes.map(
      (n) =>
        ({
          id: n.id,
          label: n.data.label,
          type: n.type as any,
          config: JSON.stringify(n.data.config),
          position: n.position,
        }) as any,
    );

    const serializedEdges: PipelineEdge[] = updatedEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    setPersistedFlow({
      nodes: serializedNodes,
      edges: serializedEdges,
    });
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(params, eds);
        saveFlowToStorage(nodes, newEdges);
        return newEdges;
      });
    },
    [setEdges, nodes, saveFlowToStorage],
  );

  const handleNodesChange = (changes: any) => {
    onNodesChange(changes);
    // Timeout to throttle state serialization
    setTimeout(() => {
      saveFlowToStorage(nodes, edges);
    }, 50);
  };

  const handleEdgesChange = (changes: any) => {
    onEdgesChange(changes);
    setTimeout(() => {
      saveFlowToStorage(nodes, edges);
    }, 50);
  };

  // Node Insertion
  const addNode = (type: "api" | "crypto" | "schema" | "preview" | "mapper") => {
    const id = `${type}_${Math.random().toString(36).substring(2, 9)}`;
    const label =
      type === "api"
        ? "API Request"
        : type === "crypto"
          ? "Crypto Node"
          : type === "schema"
            ? "Schema Node"
            : type === "mapper"
              ? "Mapper Node"
              : "UI Preview Node";

    let config: any = {};
    if (type === "api") {
      config = {
        method: "GET",
        url: "https://jsonplaceholder.typicode.com/posts/1",
        headers: {},
        body: "",
        errorPolicy: "fastFail",
      };
    } else if (type === "crypto") {
      config = {
        action: "base64Encode",
        payload: "{{api_node_id.body.some_field}}",
        key: "",
        iv: "",
        errorPolicy: "fastFail",
      };
    } else if (type === "schema") {
      config = { payload: "{{api_node_id.body}}", schema: "{}", errorPolicy: "fastFail" };
    } else if (type === "mapper") {
      config = {
        mappings: [{ targetKey: "title", sourceValue: "" }],
        errorPolicy: "fastFail",
      };
    } else {
      config = {
        code: `export default function Preview(props) {
  const hasProps = props && Object.keys(props).length > 0;
  const display = hasProps ? props : { text: "No input data" };
  return (
    <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-xl">
      <h3 className="font-bold text-secondary">React Live Preview</h3>
      <pre className="text-xs mt-2 font-mono">{JSON.stringify(display, null, 2)}</pre>
    </div>
  );
}`,
        errorPolicy: "continueOnError",
      };
    }

    const newNode = {
      id,
      type,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 150 + 100 },
      data: {
        label,
        config,
        isRunning: false,
        isSuccess: false,
        isError: false,
        elapsedMs: null,
      },
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    saveFlowToStorage(updatedNodes, edges);
    setSelectedNodeId(id);
  };

  // Node Removal
  const deleteSelectedNode = () => {
    if (!selectedNodeId) {
      return;
    }
    const updatedNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const updatedEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    saveFlowToStorage(updatedNodes, updatedEdges);
    setSelectedNodeId(null);
  };

  // Config Mutators
  const updateNodeConfig = (nodeId: string, updatedConfig: any) => {
    const updated = nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            config: updatedConfig,
          },
        };
      }
      return n;
    });
    setNodes(updated);
    saveFlowToStorage(updated, edges);
  };

  // Run Visual Flow
  const handleExecute = async () => {
    setExecuting(true);
    setReport(null);

    // Reset visual nodes states
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isRunning: false, isSuccess: false, isError: false, elapsedMs: null },
      })),
    );

    // Compile state to JSON structure
    const flow: PipelineFlow = {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.data.label,
        type: n.type as any,
        config: JSON.stringify(n.data.config),
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    };

    try {
      const res = await executePipeline(flow);
      setReport(res);

      // Render execution status visually on nodes
      setNodes((nds) =>
        nds.map((n) => {
          const runRes = res.results.find((r) => r.nodeId === n.id);
          if (runRes) {
            return {
              ...n,
              data: {
                ...n.data,
                isRunning: false,
                isSuccess: runRes.success,
                isError: !runRes.success,
                elapsedMs: runRes.elapsedMs,
              },
            };
          }
          return n;
        }),
      );
    } catch (e: any) {
      console.error(e);
    } finally {
      setExecuting(false);
    }
  };

  // Find active selected node object
  const activeNode = nodes.find((n) => n.id === selectedNodeId);

  // List of variables candidates from preceding nodes (for template mapping helper)
  const variableCandidates = useMemo(() => {
    return nodes
      .filter((n) => n.id !== selectedNodeId)
      .map((n) => {
        if (n.type === "api") {
          return { id: n.id, label: `${n.data.label} (${n.id})`, paths: ["body", "statusCode", "headers"] };
        } else if (n.type === "crypto") {
          return { id: n.id, label: `${n.data.label} (${n.id})`, paths: ["result"] };
        } else {
          return { id: n.id, label: `${n.data.label} (${n.id})`, paths: ["valid", "errors"] };
        }
      });
  }, [nodes, selectedNodeId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-[calc(100vh-14rem)] items-stretch">
      {/* Visual Canvas (Left Side - 8 columns) */}
      <div className="lg:col-span-8 card bg-base-100 border border-base-300 p-0 shadow-sm overflow-hidden flex flex-col h-full relative">
        {/* Canvas Toolbar */}
        <div className="flex items-center justify-between p-3 bg-base-200 border-b border-base-300 shrink-0 z-10">
          <div className="flex gap-2">
            <button className="btn btn-xs btn-outline btn-ghost flex items-center gap-1" onClick={() => addNode("api")}>
              <Plus className="w-3.5 h-3.5 text-success" /> API 노드
            </button>
            <button
              className="btn btn-xs btn-outline btn-ghost flex items-center gap-1"
              onClick={() => addNode("crypto")}
            >
              <Plus className="w-3.5 h-3.5 text-primary" /> Crypto 노드
            </button>
            <button
              className="btn btn-xs btn-outline btn-ghost flex items-center gap-1"
              onClick={() => addNode("schema")}
            >
              <Plus className="w-3.5 h-3.5 text-warning" /> Schema 노드
            </button>
            <button
              className="btn btn-xs btn-outline btn-ghost flex items-center gap-1"
              onClick={() => addNode("mapper")}
            >
              <Plus className="w-3.5 h-3.5 text-info" /> Mapper 노드
            </button>
            <button
              className="btn btn-xs btn-outline btn-ghost flex items-center gap-1"
              onClick={() => addNode("preview")}
            >
              <Plus className="w-3.5 h-3.5 text-secondary" /> Preview 노드
            </button>
          </div>

          <div className="flex gap-2">
            {selectedNodeId && (
              <button className="btn btn-xs btn-error btn-outline flex items-center gap-1" onClick={deleteSelectedNode}>
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            )}
            <button
              className={`btn btn-xs btn-primary flex items-center gap-1 ${executing ? "loading" : ""}`}
              onClick={handleExecute}
              disabled={executing || nodes.length === 0}
            >
              <Play className="w-3.5 h-3.5" /> {executing ? "실행 중..." : "파이프라인 실행"}
            </button>
          </div>
        </div>

        {/* React Flow Workspace */}
        <div className="flex-1 bg-base-200/50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Controls />
            <MiniMap style={{ height: 100, width: 140 }} zoomable pannable />
            <Background color="#cbd5e1" gap={16} />
          </ReactFlow>
        </div>

        {/* Execution Summary Overlay Banner */}
        {report && (
          <div className="absolute bottom-3 left-3 right-3 bg-base-100 border border-base-300 p-3 rounded-xl shadow-lg z-10 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              {report.success ? (
                <span className="text-success flex items-center gap-1 font-bold">
                  <CheckCircle className="w-4 h-4" /> 성공
                </span>
              ) : (
                <span className="text-error flex items-center gap-1 font-bold">
                  <AlertCircle className="w-4 h-4" /> 중단됨
                </span>
              )}
              <span className="text-base-content/50">|</span>총 시간:{" "}
              <strong className="text-primary">{report.elapsedMs}ms</strong>
              {report.error && (
                <>
                  <span className="text-base-content/50">|</span>
                  <span className="text-error font-medium truncate max-w-[300px]">{report.error}</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Node Config / Result Details Panel (Right Side - 4 columns) */}
      <div className="lg:col-span-4 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col h-full overflow-hidden">
        {activeNode ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="border-b border-base-200 pb-2 mb-3 shrink-0 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-base-content/50 uppercase">설정 (Properties)</span>
                <h4 className="font-bold text-sm text-base-content/85 truncate">{activeNode.data.label}</h4>
              </div>
              <span className="text-[10px] bg-base-200 px-2 py-0.5 rounded text-mono">{activeNode.id}</span>
            </div>

            {/* Config Fields */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Type-specific configs */}
              {activeNode.type === "api" && (
                <div className="space-y-3 text-xs">
                  {/* Import Request Config */}
                  <div className="flex flex-col gap-1.5 p-2 bg-base-200/50 rounded-lg mb-2">
                    <label className="font-bold text-[9px] text-base-content/50 uppercase">
                      설정 가져오기 (Import Request)
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        className="btn btn-[10px] h-7 min-h-7 btn-outline btn-primary flex-1 py-0 px-2"
                        onClick={() => {
                          if (apiClientCurrentRequest) {
                            updateNodeConfig(activeNode.id, {
                              ...activeNode.data.config,
                              method: apiClientCurrentRequest.method,
                              url: apiClientCurrentRequest.url,
                              headers: apiClientCurrentRequest.headers,
                              body: apiClientCurrentRequest.body,
                            });
                          }
                        }}
                      >
                        📥 현재 테스터 설정
                      </button>

                      {apiClientHistory.length > 0 && (
                        <select
                          className="select select-bordered select-xs text-[10px] h-7 min-h-7 flex-1"
                          defaultValue=""
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const item = apiClientHistory.find((h) => h.id === selectedId);
                            if (item) {
                              updateNodeConfig(activeNode.id, {
                                ...activeNode.data.config,
                                method: item.method,
                                url: item.url,
                                headers: item.headers,
                                body: item.body,
                              });
                            }
                            e.target.value = ""; // Reset
                          }}
                        >
                          <option value="" disabled>
                            📜 최근 히스토리...
                          </option>
                          {apiClientHistory.slice(0, 10).map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.method} {h.url.substring(0, 15)}...
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-base-content/75">Method</label>
                    <select
                      className="select select-bordered select-xs w-full text-xs font-bold"
                      value={activeNode.data.config.method || "GET"}
                      onChange={(e) =>
                        updateNodeConfig(activeNode.id, { ...activeNode.data.config, method: e.target.value })
                      }
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-base-content/75">요청 URL</label>
                    <input
                      type="text"
                      className="input input-bordered input-xs font-mono w-full"
                      value={activeNode.data.config.url || ""}
                      onChange={(e) =>
                        updateNodeConfig(activeNode.id, { ...activeNode.data.config, url: e.target.value })
                      }
                    />
                  </div>

                  {["POST", "PUT"].includes(activeNode.data.config.method) && (
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-base-content/75">Body</label>
                      <textarea
                        rows={4}
                        className="textarea textarea-bordered textarea-xs font-mono w-full"
                        placeholder='{"key": "{{some_node.result}}"}'
                        value={activeNode.data.config.body || ""}
                        onChange={(e) =>
                          updateNodeConfig(activeNode.id, { ...activeNode.data.config, body: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {activeNode.type === "crypto" && (
                <div className="space-y-3">
                  <div className="p-2 bg-base-200/50 rounded-lg">
                    <button
                      className="btn btn-[10px] h-7 min-h-7 btn-outline btn-primary w-full py-0 px-2"
                      onClick={() => {
                        if (cryptoToolCurrentConfig) {
                          updateNodeConfig(activeNode.id, {
                            ...activeNode.data.config,
                            action: cryptoToolCurrentConfig.action,
                            key: cryptoToolCurrentConfig.key,
                            iv: cryptoToolCurrentConfig.iv,
                          });
                        }
                      }}
                    >
                      📥 단독 암복호화 도구 설정 가져오기
                    </button>
                  </div>
                  <CryptoNode
                    isStandalone={false}
                    action={activeNode.data.config.action}
                    onChangeAction={(action) => updateNodeConfig(activeNode.id, { ...activeNode.data.config, action })}
                    payload={activeNode.data.config.payload}
                    onChangePayload={(payload) =>
                      updateNodeConfig(activeNode.id, { ...activeNode.data.config, payload })
                    }
                    secretKey={activeNode.data.config.key}
                    onChangeSecretKey={(key) => updateNodeConfig(activeNode.id, { ...activeNode.data.config, key })}
                    iv={activeNode.data.config.iv}
                    onChangeIv={(iv) => updateNodeConfig(activeNode.id, { ...activeNode.data.config, iv })}
                  />
                </div>
              )}

              {activeNode.type === "schema" && (
                <div className="space-y-3 text-xs">
                  <div className="flex flex-col gap-1.5 p-2 bg-base-200/50 rounded-lg">
                    <label className="font-semibold text-[10px] text-base-content/65 uppercase">
                      저장된 JSON 스키마에서 가져오기
                    </label>
                    <select
                      className="select select-bordered select-xs w-full text-xs font-bold focus:outline-none"
                      value=""
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const found = savedJsonSchemas.find((s) => s.id === selectedId);
                        if (found) {
                          updateNodeConfig(activeNode.id, {
                            ...activeNode.data.config,
                            schema: found.schemaText,
                          });
                        }
                      }}
                    >
                      <option value="">-- 스키마 선택 --</option>
                      {savedJsonSchemas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-base-content/75">Payload 데이터</label>
                    <textarea
                      rows={4}
                      className="textarea textarea-bordered textarea-xs font-mono w-full"
                      value={activeNode.data.config.payload || ""}
                      onChange={(e) =>
                        updateNodeConfig(activeNode.id, { ...activeNode.data.config, payload: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-base-content/75">검증할 JSON Schema</label>
                    <textarea
                      rows={6}
                      className="textarea textarea-bordered textarea-xs font-mono w-full"
                      value={activeNode.data.config.schema || ""}
                      onChange={(e) =>
                        updateNodeConfig(activeNode.id, { ...activeNode.data.config, schema: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {activeNode.type === "mapper" && (
                <div className="space-y-3 text-xs flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between shrink-0">
                    <label className="font-semibold text-base-content/75 flex items-center gap-1">
                      <Shuffle className="w-3.5 h-3.5 text-info" /> Mappings 정의 (Target ➔ Source)
                    </label>
                    <button
                      className="btn btn-xs btn-outline btn-primary flex items-center gap-1"
                      onClick={() => {
                        const currentMappings = activeNode.data.config.mappings || [];
                        updateNodeConfig(activeNode.id, {
                          ...activeNode.data.config,
                          mappings: [...currentMappings, { targetKey: "", sourceValue: "" }],
                        });
                      }}
                    >
                      <Plus className="w-3 h-3" /> 추가
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[350px]">
                    {((activeNode.data.config.mappings || []) as Array<{ targetKey: string; sourceValue: string }>).map(
                      (m, idx) => (
                        <div
                          key={idx}
                          className="flex gap-2 items-center p-2.5 bg-base-200/50 rounded-xl border border-base-300 relative group"
                        >
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <div>
                              <span className="text-[9px] font-bold text-base-content/50 uppercase tracking-wider">
                                Target Key (속성명)
                              </span>
                              <input
                                type="text"
                                className="input input-bordered input-xs w-full mt-0.5 focus:outline-none"
                                placeholder="e.g. title"
                                value={m.targetKey}
                                onChange={(e) => {
                                  const newMappings = [...(activeNode.data.config.mappings || [])];
                                  newMappings[idx] = { ...newMappings[idx], targetKey: e.target.value };
                                  updateNodeConfig(activeNode.id, { ...activeNode.data.config, mappings: newMappings });
                                }}
                              />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-base-content/50 uppercase tracking-wider">
                                Source Value (표현식)
                              </span>
                              <input
                                type="text"
                                className="input input-bordered input-xs w-full mt-0.5 focus:outline-none font-mono text-[10px]"
                                placeholder="e.g. {{api_1.body.title}}"
                                value={m.sourceValue}
                                onChange={(e) => {
                                  const newMappings = [...(activeNode.data.config.mappings || [])];
                                  newMappings[idx] = { ...newMappings[idx], sourceValue: e.target.value };
                                  updateNodeConfig(activeNode.id, { ...activeNode.data.config, mappings: newMappings });
                                }}
                              />
                            </div>
                          </div>
                          <button
                            className="btn btn-ghost btn-xs text-error/70 p-0 w-6 h-6 hover:bg-error/15 shrink-0 self-end mb-1"
                            onClick={() => {
                              const newMappings = (activeNode.data.config.mappings || []).filter(
                                (_: any, i: number) => i !== idx,
                              );
                              updateNodeConfig(activeNode.id, { ...activeNode.data.config, mappings: newMappings });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ),
                    )}
                    {(activeNode.data.config.mappings || []).length === 0 && (
                      <div className="text-center py-6 text-base-content/40 italic">
                        정의된 매핑이 없습니다. 상단의 추가 버튼을 눌러 속성을 매핑해 보세요.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeNode.type === "preview" && (
                <div className="space-y-3 text-xs flex flex-col h-full overflow-hidden">
                  <div className="grid grid-cols-2 gap-2 bg-base-200/50 p-2 rounded-xl shrink-0">
                    {/* Load from Saved Component Registry */}
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[10px] text-base-content/65 uppercase">
                        컴포넌트 불러오기
                      </label>
                      <select
                        className="select select-bordered select-xs w-full text-xs font-bold focus:outline-none"
                        defaultValue=""
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const found = savedComponents.find((c) => c.id === selectedId);
                          if (found) {
                            updateNodeConfig(activeNode.id, {
                              ...activeNode.data.config,
                              code: found.code,
                              schemaId: found.schemaId || "",
                            });
                          }
                          e.target.value = ""; // reset
                        }}
                      >
                        <option value="">-- 컴포넌트 선택 --</option>
                        {savedComponents.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* JSON Schema validation selection */}
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[10px] text-base-content/65 uppercase">
                        검증용 스키마 선택
                      </label>
                      <select
                        className="select select-bordered select-xs w-full text-xs font-bold focus:outline-none"
                        value={activeNode.data.config.schemaId || ""}
                        onChange={(e) => {
                          updateNodeConfig(activeNode.id, {
                            ...activeNode.data.config,
                            schemaId: e.target.value,
                          });
                        }}
                      >
                        <option value="">-- 스키마 미지정 --</option>
                        {savedJsonSchemas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <label className="font-semibold text-base-content/75">React 컴포넌트 소스코드</label>
                    <textarea
                      rows={8}
                      className="textarea textarea-bordered textarea-xs font-mono w-full focus:outline-none"
                      value={activeNode.data.config.code || ""}
                      onChange={(e) =>
                        updateNodeConfig(activeNode.id, { ...activeNode.data.config, code: e.target.value })
                      }
                    />
                  </div>

                  {/* Inline Live Previewer inside config panel */}
                  <div className="flex-1 min-h-[300px] border border-base-200 rounded-xl overflow-hidden flex flex-col mt-2">
                    <div className="bg-base-200/50 p-2 border-b border-base-200 text-[10px] font-bold text-base-content/60 flex items-center justify-between shrink-0">
                      <span>🖥️ 실시간 렌더링 결과 (Live Preview)</span>
                      <span className="badge badge-outline badge-xs text-primary">Dynamic Props</span>
                    </div>
                    <div className="flex-1 bg-white relative">
                      {(() => {
                        const incomingEdge = edges.find((e) => e.target === activeNode.id);
                        let previewData: any = null;

                        if (incomingEdge && report) {
                          const parentResult = report.results.find((r) => r.nodeId === incomingEdge.source);
                          if (parentResult?.success) {
                            try {
                              previewData = JSON.parse(parentResult.output);
                              if (previewData && previewData.result !== undefined) {
                                previewData = previewData.result;
                              }
                            } catch {
                              previewData = parentResult.output;
                            }
                          }
                        }

                        // Retrieve active JSON Schema raw text for validation warning
                        let schemaText = "";
                        if (activeNode.data.config.schemaId) {
                          const foundSchema = savedJsonSchemas.find((s) => s.id === activeNode.data.config.schemaId);
                          if (foundSchema) {
                            schemaText = foundSchema.schemaText;
                          }
                        }

                        return (
                          <LivePreviewer
                            key={activeNode.id + (report ? "_ran" : "")}
                            code={activeNode.data.config.code || ""}
                            initialData={previewData}
                            schemaText={schemaText}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Common Config: Error Policy */}
              <div className="flex flex-col gap-1 pt-2 border-t border-base-200">
                <label className="font-semibold text-xs text-base-content/75">에러 대응 정책 (Error Policy)</label>
                <select
                  className="select select-bordered select-xs w-full text-xs"
                  value={activeNode.data.config.errorPolicy || "fastFail"}
                  onChange={(e) =>
                    updateNodeConfig(activeNode.id, { ...activeNode.data.config, errorPolicy: e.target.value })
                  }
                >
                  <option value="fastFail">실패 시 즉시 중단 (Fast Fail)</option>
                  <option value="continueOnError">에러 발생 시에도 계속 실행</option>
                  <option value="retry">최대 3회 재시도 (Retry)</option>
                </select>
              </div>

              {/* Dynamic Mapping Guide Helper */}
              {variableCandidates.length > 0 && (
                <div className="pt-3 border-t border-base-200 space-y-2">
                  <label className="font-semibold text-xs text-base-content/75 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-primary" /> 변수 매핑 주소 복사
                  </label>
                  <div className="text-[10px] text-base-content/50 leading-relaxed mb-2">
                    이전 노드의 데이터를 매핑하려면 아래 주소 중 하나를 복사하여 필요한 필드에 입력하세요:
                  </div>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {variableCandidates.map((c) =>
                      c.paths.map((p) => {
                        const pathStr = `{{${c.id}.${p}}}`;
                        return (
                          <div
                            key={pathStr}
                            className="flex justify-between items-center bg-base-200 p-1.5 rounded text-mono text-[10px]"
                          >
                            <span className="text-primary truncate mr-2">{pathStr}</span>
                            <button
                              className="btn btn-[10px] btn-ghost btn-xs text-primary/80 uppercase hover:bg-base-300 font-bold"
                              onClick={() => navigator.clipboard.writeText(pathStr)}
                            >
                              복사
                            </button>
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              )}

              {/* Execution Result view */}
              {report && (
                <div className="pt-3 border-t border-base-200 space-y-2 text-xs">
                  <label className="font-semibold text-xs text-base-content/75">노드 실행 결과</label>
                  {(() => {
                    const nodeRes = report.results.find((r: NodeExecutionResult) => r.nodeId === activeNode.id);
                    if (!nodeRes) {
                      return <div className="text-base-content/40 italic">미실행</div>;
                    }
                    return (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span
                            className={`badge badge-xs font-bold ${nodeRes.success ? "badge-success text-success-content" : "badge-error text-error-content"}`}
                          >
                            {nodeRes.success ? "성공" : "실패"}
                          </span>
                          <span className="text-[10px] text-base-content/50">{nodeRes.elapsedMs}ms 소요</span>
                        </div>
                        {nodeRes.error && (
                          <div className="p-2 border border-error/20 bg-error/5 text-error rounded font-mono text-[10px]">
                            {nodeRes.error}
                          </div>
                        )}
                        {(() => {
                          let outputObj: any = null;
                          try {
                            outputObj = JSON.parse(nodeRes.output);
                          } catch {
                            outputObj = nodeRes.output;
                          }
                          if (outputObj === null || outputObj === "null") {
                            return null;
                          }

                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-base-content/50 uppercase">출력 JSON</span>
                                <div className="flex gap-1.5">
                                  {onExportPreviewData && (
                                    <button
                                      type="button"
                                      className="btn btn-[10px] btn-ghost btn-xs text-success flex items-center gap-0.5"
                                      onClick={() =>
                                        onExportPreviewData(outputObj.body || outputObj.result || outputObj)
                                      }
                                    >
                                      프리뷰로 내보내기 <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-[10px] btn-ghost btn-xs"
                                    onClick={() =>
                                      navigator.clipboard.writeText(
                                        typeof outputObj === "object"
                                          ? JSON.stringify(outputObj, null, 2)
                                          : String(outputObj),
                                      )
                                    }
                                  >
                                    복사
                                  </button>
                                </div>
                              </div>
                              <textarea
                                className="w-full p-2 bg-base-200 border border-base-300 rounded font-mono text-[10px] h-[150px] resize-none outline-none focus:outline-none focus:ring-0 text-success-content/80"
                                value={
                                  typeof outputObj === "object" ? JSON.stringify(outputObj, null, 2) : String(outputObj)
                                }
                                readOnly
                              />
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-base-content/40 italic text-sm">
            <Settings className="w-12 h-12 text-base-content/20 mb-3 animate-spin duration-3000" />
            작업 캔버스에서 노드를 선택하시면 속성 및 데이터 매핑 창이 활성화됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

export interface PipelineNode {
  id: string;
  label: string;
  type: "api" | "crypto" | "schema" | "preview" | "mapper" | "script";
  config: string;
  position?: { x: number; y: number };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}

export interface PipelineFlow {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  elapsedMs: number | null;
  output: string;
  error: string | null;
}

export interface PipelineExecutionReport {
  success: boolean;
  elapsedMs: number | null;
  results: NodeExecutionResult[];
  error: string | null;
}

/** 샌드박스 파이프라인 페이지에서 현재 편집 중인 단건 draft */
export interface SandboxActiveFlow {
  flow: PipelineFlow;
  /** 불러온 저장 파이프라인 id (없으면 null) */
  loadedFromId: string | null;
  /** 명시적 불러오기/새로 만들기 시에만 증가 — 캔버스 리셋 트리거 */
  revision: number;
  updatedAt: number;
}

/** 저장된 파이프라인 라이브러리 항목 */
export interface SavedPipeline {
  id: string;
  name: string;
  description: string;
  flow: PipelineFlow;
  createdAt: number;
  updatedAt: number;
}

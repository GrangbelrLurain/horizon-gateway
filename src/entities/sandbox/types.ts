export type CryptoAction =
  | "base64Encode"
  | "base64Decode"
  | "urlEncode"
  | "urlDecode"
  | "hexEncode"
  | "hexDecode"
  | "jwtDecode"
  | "aesEncrypt"
  | "aesDecrypt"
  | "sha256"
  | "hmacSha256";

export interface PipelineNode {
  id: string;
  label: string;
  type: "api" | "crypto" | "schema" | "preview";
  config: string;
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

export interface SchemaValidationResult {
  valid: boolean;
  errors: string | null;
}

export interface SavedComponent {
  id: string;
  name: string;
  description: string;
  code: string;
  mockData: string;
  createdAt: number;
  updatedAt: number;
}

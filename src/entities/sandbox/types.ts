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
  | "hmacSha256"
  | "custom";

export type {
  NodeExecutionResult,
  PipelineEdge,
  PipelineExecutionReport,
  PipelineFlow,
  PipelineNode,
} from "@/entities/pipeline";

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
  schemaId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedCryptoPreset {
  id: string;
  name: string;
  description: string;
  action: CryptoAction;
  payload: string;
  key: string;
  iv: string;
  code?: string;
  createdAt: number;
  updatedAt: number;
}

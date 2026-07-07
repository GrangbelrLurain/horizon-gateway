import { commands, unwrap } from "@/shared/api";
import type { CryptoAction, PipelineExecutionReport, PipelineFlow, SchemaValidationResult } from "./types";

export async function processCrypto(action: CryptoAction, payload: string, key?: string, iv?: string): Promise<string> {
  if (action === "custom") {
    throw new Error("Custom JS 스크립트는 백엔드에서 실행할 수 없습니다.");
  }
  const res = unwrap(
    await commands.processCrypto({
      action: action as any,
      payload,
      key: key || null,
      iv: iv || null,
    }),
  );
  if (!res.success) {
    throw new Error(res.message);
  }
  return res.data;
}

export async function validateJsonSchema(payload: string, schema: string): Promise<SchemaValidationResult> {
  const res = unwrap(
    await commands.validateJsonSchema({
      payload,
      schema,
    }),
  );
  if (res.data) {
    return res.data;
  }
  throw new Error(res.message);
}

export async function executePipeline(flow: PipelineFlow): Promise<PipelineExecutionReport> {
  const res = unwrap(await commands.executePipeline(flow));
  if (!res.success) {
    throw new Error(res.message);
  }
  return res.data;
}

export async function executePipelineApiNode(config: any): Promise<any> {
  const configJson = JSON.stringify(config);
  const res = unwrap(await commands.executePipelineApiNode(configJson));
  if (!res.success) {
    throw new Error(res.message);
  }
  return JSON.parse(res.data);
}

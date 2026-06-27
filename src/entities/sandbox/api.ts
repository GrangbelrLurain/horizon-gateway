import { commands, unwrap } from "@/shared/api";
import type { CryptoAction, PipelineExecutionReport, PipelineFlow, SchemaValidationResult } from "./types";

export async function processCrypto(action: CryptoAction, payload: string, key?: string, iv?: string): Promise<string> {
  const res = unwrap(
    await commands.processCrypto({
      action,
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

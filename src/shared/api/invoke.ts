import { invoke } from "@tauri-apps/api/core";
import type { ApiCommandMap } from "./commands";
import type { ApiResponse } from "./types";

/**
 * Command key에 해당하는 Request/Response 타입으로 invoke 호출.
 *
 * @example
 * const res = await invokeApi("get_domains");
 * const routes = await invokeApi("get_local_routes");
 * await invokeApi("add_local_route", { domain: "api.example.com", targetHost: "127.0.0.1", targetPort: 3000 });
 */
export async function invokeApi<C extends keyof ApiCommandMap & string>(
  cmd: C,
  request?: ApiCommandMap[C]["request"],
): Promise<ApiResponse<ApiCommandMap[C]["response"]>> {
  return invoke<ApiResponse<ApiCommandMap[C]["response"]>>(cmd, request as Record<string, unknown>);
}

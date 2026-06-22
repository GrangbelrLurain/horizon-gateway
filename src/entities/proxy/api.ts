import { commands, unwrap } from "@/shared/api";
import type { LocalRoute, ProxyStatus } from "./types";

export async function fetchLocalRoutes(): Promise<LocalRoute[]> {
  const res = unwrap(await commands.getLocalRoutes());
  return res.data ?? [];
}

export async function fetchProxyStatus(): Promise<ProxyStatus> {
  const res = unwrap(await commands.getProxyStatus());
  if (!res.success || !res.data) {
    return null;
  }
  const data = res.data;
  return {
    running: data.running ?? false,
    local_routing_enabled: data.local_routing_enabled ?? false,
    port: data.port ?? null,
    reverse_http_port: data.reverse_http_port ?? null,
    reverse_https_port: data.reverse_https_port ?? null,
  };
}

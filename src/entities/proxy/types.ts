export type { LocalRoute, ProxySettings, ProxyStatusPayload } from "@/shared/api";

export type ProxyStatus = {
  running: boolean;
  port?: number | null;
  reverse_http_port?: number | null;
  reverse_https_port?: number | null;
} | null;

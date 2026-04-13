/** Monitor settings per domain (check_enabled, interval). Status logs are excluded. */
export interface DomainMonitorExport {
  url: string;
  checkEnabled: boolean;
  intervalSecs: number;
}

/** Full app settings export payload (matches Rust SettingsExport). */
export interface SettingsExport {
  version: number;
  exportedAt: string;
  domains: { id: number; url: string }[];
  groups: { id: number; name: string }[];
  domainGroupLinks: { domain_id: number; group_id: number }[];
  localRoutes: {
    id: number;
    domain: string;
    target_host: string;
    target_port: number;
    enabled: boolean;
  }[];
  proxySettings: {
    dns_server: string | null;
    proxy_port: number;
    reverse_http_port?: number | null;
    reverse_https_port?: number | null;
    local_routing_enabled: boolean;
  };
  /** Monitor settings per domain. Status logs are excluded from export. */
  domainMonitor?: DomainMonitorExport[];
  /** @deprecated Use domainMonitor. Backward compat for old exports. */
  domainStatus?: DomainMonitorExport[];
}

import type { Domain, DomainGroupLink } from "@/entities/domain/types/domain";
import type { DomainGroup } from "@/entities/domain/types/domain_group";
import type { DomainMonitorWithUrl, DomainStatusLog } from "@/entities/domain/types/domain_monitor";
/**
 * Command별 Request/Response 타입 정의.
 * BE ApiResponse<T> 구조에 맞춤.
 * 모든 Command는 payload 객체 단위로 인자 전달.
 */
import type { Annotation } from "@/entities/domain/types/inspector";
import type {
  ApiLogEntry,
  ApiRequestResult,
  DomainApiLoggingLink,
  LocalRoute,
  ProxySettings,
  ProxyStatusPayload,
  SchemaDownloadResult,
} from "@/entities/proxy/types/local_route";
import type { SettingsExport } from "@/entities/settings/types/settings_export";

export interface ApiCommandMap {
  get_domains: { request?: undefined; response: Domain[] };
  get_domain_by_id: {
    request: { payload: { id: number } };
    response: Domain | null;
  };
  update_domain_by_id: {
    request: { payload: { id: number; url?: string } };
    response: Domain | null;
  };
  remove_domains: {
    request: { payload: { id: number } };
    response: Domain | null;
  };
  regist_domains: {
    request: { payload: { urls: string[]; groupId?: number } };
    response: Domain[];
  };
  import_domains: {
    request: { payload: { domains: Domain[] } };
    response: Domain[];
  };
  clear_all_domains: { request?: undefined; response: Domain[] };

  get_latest_status: { request?: undefined; response: DomainStatusLog[] };
  check_domain_status: { request?: undefined; response: DomainStatusLog[] };
  get_domain_status_logs: {
    request: { payload: { date: string } };
    response: DomainStatusLog[];
  };

  get_domain_monitor_list: { request?: undefined; response: DomainMonitorWithUrl[] };
  set_domain_monitor_check_enabled: {
    request: { payload: { domainIds: number[]; enabled: boolean } };
    response: boolean;
  };

  get_domain_group_links: { request?: undefined; response: DomainGroupLink[] };
  set_domain_groups: {
    request: { payload: { domainId: number; groupIds: number[] } };
    response: undefined;
  };
  set_group_domains: {
    request: { payload: { groupId: number; domainIds: number[] } };
    response: undefined;
  };
  get_domains_by_group: {
    request: { payload: { groupId: number } };
    response: Domain[];
  };
  get_groups_for_domain: {
    request: { payload: { domainId: number } };
    response: DomainGroup[];
  };
  create_group: {
    request: { payload: { name: string } };
    response: DomainGroup[];
  };
  get_groups: { request?: undefined; response: DomainGroup[] };
  delete_group: {
    request: { payload: { id: number } };
    response: DomainGroup[];
  };
  update_group: {
    request: { payload: { id: number; name: string } };
    response: DomainGroup[];
  };

  get_local_routes: { request?: undefined; response: LocalRoute[] };
  add_local_route: {
    request: {
      payload: {
        domain: string;
        targetHost: string;
        targetPort: number;
      };
    };
    response: LocalRoute;
  };
  update_local_route: {
    request: {
      payload: {
        id: number;
        domain?: string;
        targetHost?: string;
        targetPort?: number;
        enabled?: boolean;
      };
    };
    response: LocalRoute | null;
  };
  remove_local_route: {
    request: { payload: { id: number } };
    response: LocalRoute | null;
  };
  set_local_route_enabled: {
    request: { payload: { id: number; enabled: boolean } };
    response: LocalRoute | null;
  };

  get_proxy_status: { request?: undefined; response: ProxyStatusPayload };
  start_local_proxy: {
    request?: { payload?: { port?: number | null } };
    response: ProxyStatusPayload;
  };
  stop_local_proxy: { request?: undefined; response: ProxyStatusPayload };
  get_proxy_settings: { request?: undefined; response: ProxySettings };
  set_proxy_dns_server: {
    request: { payload: { dnsServer?: string | null } };
    response: ProxySettings;
  };
  set_proxy_port: {
    request: { payload: { port: number } };
    response: ProxySettings;
  };
  set_proxy_reverse_ports: {
    request: {
      payload: {
        reverseHttpPort?: number | null;
        reverseHttpsPort?: number | null;
      };
    };
    response: ProxySettings;
  };
  get_proxy_setup_url: { request?: undefined; response: string };
  get_proxy_auto_start_error: { request?: undefined; response: string | null };
  set_local_routing_enabled: {
    request: { payload: { enabled: boolean } };
    response: ProxyStatusPayload;
  };
  set_mocking_enabled: {
    request: { payload: { enabled: boolean } };
    response: import("@/entities/scenario/types/mocking").MockingSettings;
  };
  get_mocking_status: {
    request?: undefined;
    response: import("@/entities/scenario/types/mocking").MockingSettings;
  };

  export_all_settings: { request?: undefined; response: SettingsExport };
  import_all_settings: {
    request: { payload: SettingsExport };
    response: undefined;
  };
  save_root_ca: { request?: undefined; response: string };

  get_domain_api_logging_links: { request?: undefined; response: DomainApiLoggingLink[] };
  set_domain_api_logging: {
    request: {
      payload: {
        domainId: number;
        loggingEnabled: boolean;
        bodyEnabled: boolean;
        schemaUrl?: string | null;
      };
    };
    response: DomainApiLoggingLink[];
  };
  remove_domain_api_logging: {
    request: { payload: { domainId: number } };
    response: DomainApiLoggingLink[];
  };

  download_api_schema: {
    request: { payload: { domainId: number; url: string } };
    response: SchemaDownloadResult;
  };
  get_api_schema_content: {
    request: { payload: { domainId: number } };
    response: string | null;
  };

  send_api_request: {
    request: {
      payload: {
        method: string;
        url: string;
        headers?: Record<string, string>;
        body?: string | null;
      };
    };
    response: ApiRequestResult;
  };

  list_api_log_dates: { request?: undefined; response: string[] };
  get_api_logs: {
    request: {
      payload: {
        date: string;
        domainFilter?: string;
        methodFilter?: string;
        hostFilter?: string;
        exactMatch?: boolean;
      };
    };
    response: ApiLogEntry[];
  };
  clear_api_logs: {
    request: { payload: { date?: string } };
    response: undefined;
  };

  open_window: {
    request: {
      label: string;
      title: string;
      url: string;
      width: number;
      height: number;
    };
    response: undefined;
  };

  open_inspector_window: {
    request: {
      url: string;
      script?: string | null;
    };
    response: undefined;
  };

  open_annotation_dialog: {
    request: {
      selector: string;
      content: string;
      tagName: string;
      thumbnail: string;
    };
    response: undefined;
  };

  set_global_inspector_enabled: {
    request: { payload: boolean };
    response: undefined;
  };
  get_global_inspector_enabled: {
    request?: undefined;
    response: boolean;
  };

  get_annotations: {
    request?: undefined;
    response: Annotation[];
  };
  add_annotation: {
    request: { payload: Annotation };
    response: Annotation[];
  };
  update_annotation: {
    request: { payload: { id: string; role: string; description: string } };
    response: Annotation[];
  };
  delete_annotation: {
    request: { payload: { id: string } };
    response: Annotation[];
  };
  export_to_pdf: {
    request: {
      payload: {
        title: string;
        items: {
          role: string;
          description: string;
          domain: string;
          url: string;
          thumbnail: string;
        }[];
        path: string;
      };
    };
    response: string;
  };
}

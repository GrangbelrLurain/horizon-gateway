import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLoggingDomainsApi } from "../api/gateway";
import type { ApiTrafficLog } from "../types";

export function useTrafficLogs() {
  const [apiTrafficLogs, setApiTrafficLogs] = useState<ApiTrafficLog[]>([]);
  const [loggingDomains, setLoggingDomains] = useState<string[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [selectedLogDetail, setSelectedLogDetail] = useState<ApiTrafficLog | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"response" | "request" | "headers">("response");
  const loggingDomainsRef = useRef<string[]>([]);

  useEffect(() => {
    loggingDomainsRef.current = loggingDomains;

    if (loggingDomains.length === 0) {
      return;
    }
    const earlyLogs = (window as unknown as { __wt_api_traffic_logs?: ApiTrafficLog[] }).__wt_api_traffic_logs;
    if (!Array.isArray(earlyLogs) || earlyLogs.length === 0) {
      return;
    }
    setApiTrafficLogs((prev) => {
      const merged = [...prev];
      for (const item of earlyLogs) {
        try {
          const host = new URL(item.url, window.location.href).hostname.toLowerCase();
          const matched = loggingDomains.some((d) => {
            const dl = d.toLowerCase();
            return host === dl || host.endsWith(`.${dl}`);
          });
          if (
            matched &&
            !merged.some((m) => m.id === item.id || (m.url === item.url && m.timestamp === item.timestamp))
          ) {
            merged.push(item);
          }
        } catch (_e) {}
      }
      return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000);
    });
  }, [loggingDomains]);

  const fetchLoggingDomains = useCallback(() => {
    fetchLoggingDomainsApi()
      .then((data) => setLoggingDomains(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleTrafficLogEvent = (e: Event) => {
      const detail = (e as CustomEvent<ApiTrafficLog>).detail;
      if (detail) {
        const domains = loggingDomainsRef.current;
        if (domains.length === 0) {
          return;
        }
        try {
          const host = new URL(detail.url, window.location.href).hostname.toLowerCase();
          const matched = domains.some((d) => {
            const dl = d.toLowerCase();
            return host === dl || host.endsWith(`.${dl}`);
          });
          if (!matched) {
            return;
          }
        } catch (_e) {
          return;
        }
        setApiTrafficLogs((prev) => {
          if (prev.some((m) => m.id === detail.id)) {
            return prev;
          }
          return [detail, ...prev].slice(0, 1000);
        });
      }
    };
    window.addEventListener("wt:traffic-log", handleTrafficLogEvent);
    return () => window.removeEventListener("wt:traffic-log", handleTrafficLogEvent);
  }, []);

  return {
    apiTrafficLogs,
    setApiTrafficLogs,
    loggingDomains,
    logSearchQuery,
    setLogSearchQuery,
    selectedLogDetail,
    setSelectedLogDetail,
    activeDetailTab,
    setActiveDetailTab,
    fetchLoggingDomains,
  };
}

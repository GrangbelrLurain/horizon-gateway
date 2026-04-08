import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue } from "jotai";
import { AlertCircle, Globe, Loader2Icon, Plus, Server, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { globalDomainsAtom, globalLocalRoutesAtom } from "@/domain/global-data/store";
import { languageAtom } from "@/domain/i18n/store";
import type { ProxySettings, ProxyStatusPayload } from "@/entities/proxy/types/local_route";
import { invokeApi } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { SearchableInput } from "@/shared/ui/searchable-input";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { H1, P } from "@/shared/ui/typography/typography";
import { urlToHost } from "@/shared/utils/url";
import { en } from "./en";
import { ko } from "./ko";
import {
  proxyNewDomainAtom,
  proxyNewTargetHostAtom,
  proxyNewTargetPortAtom,
  proxyPortInputAtom,
  proxyReverseHttpPortInputAtom,
  proxyReverseHttpsPortInputAtom,
} from "./store";

export const Route = createFileRoute("/proxy/dashboard/")({
  component: ProxyPage,
});

function ProxyPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [routes, setRoutes] = useAtom(globalLocalRoutesAtom);
  const [domains, setDomains] = useAtom(globalDomainsAtom);
  const [proxyStatus, setProxyStatus] = useState<ProxyStatusPayload>({
    running: false,
    port: 0,
    reverse_http_port: null,
    reverse_https_port: null,
    local_routing_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [routingToggleLoading, setRoutingToggleLoading] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [manualStartLoading, setManualStartLoading] = useState(false);
  const [newDomain, setNewDomain] = useAtom(proxyNewDomainAtom);
  const [newTargetHost, setNewTargetHost] = useAtom(proxyNewTargetHostAtom);
  const [newTargetPort, setNewTargetPort] = useAtom(proxyNewTargetPortAtom);
  const [proxySettings, setProxySettings] = useState<ProxySettings | null>(null);
  const [proxyPortInput, setProxyPortInput] = useAtom(proxyPortInputAtom);
  const [proxyPortSaving, setProxyPortSaving] = useState(false);
  const [reverseHttpInput, setReverseHttpInput] = useAtom(proxyReverseHttpPortInputAtom);
  const [reverseHttpsInput, setReverseHttpsInput] = useAtom(proxyReverseHttpsPortInputAtom);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await invokeApi("get_local_routes");
      if (res.success) {
        setRoutes(res.data ?? []);
      }
    } catch (e) {
      console.error("get_local_routes:", e);
    } finally {
      setLoading(false);
    }
  }, [setRoutes]);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await invokeApi("get_domains");
      if (res.success) {
        setDomains(res.data ?? []);
      }
    } catch (e) {
      console.error("get_domains:", e);
    }
  }, [setDomains]);

  const fetchProxyStatusOnce = useCallback(async () => {
    try {
      const res = await invokeApi("get_proxy_status");
      if (res.success) {
        setProxyStatus(
          res.data ?? {
            running: false,
            port: 0,
            reverse_http_port: null,
            reverse_https_port: null,
            local_routing_enabled: true,
          },
        );
      }
    } catch (e) {
      console.error("get_proxy_status:", e);
    }
  }, []);

  const fetchProxySettings = useCallback(async () => {
    try {
      const res = await invokeApi("get_proxy_settings");
      if (res.success && res.data) {
        setProxySettings(res.data);
        setProxyPortInput(String(res.data.proxy_port));
        setReverseHttpInput(res.data.reverse_http_port != null ? String(res.data.reverse_http_port) : "");
        setReverseHttpsInput(res.data.reverse_https_port != null ? String(res.data.reverse_https_port) : "");
      }
    } catch (e) {
      console.error("get_proxy_settings:", e);
    }
  }, [setProxyPortInput, setReverseHttpInput, setReverseHttpsInput]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const domainSuggestions = useMemo(() => {
    const hosts = new Set<string>();
    for (const d of domains) {
      const h = urlToHost(d.url);
      if (h) {
        hosts.add(h);
      }
    }
    for (const r of routes) {
      if (r.domain) {
        hosts.add(r.domain);
      }
    }
    return Array.from(hosts).sort();
  }, [domains, routes]);

  const filteredDomainSuggestions = useMemo(() => {
    const q = newDomain.trim().toLowerCase();
    if (!q) {
      return domainSuggestions.slice(0, 12);
    }
    return domainSuggestions.filter((h) => h.toLowerCase().includes(q)).slice(0, 12);
  }, [domainSuggestions, newDomain]);

  useEffect(() => {
    fetchProxySettings();
  }, [fetchProxySettings]);

  useEffect(() => {
    void fetchProxyStatusOnce();

    // Query persisted auto-start error (survives even if event was missed)
    invokeApi("get_proxy_auto_start_error")
      .then((res) => {
        if (res.success && res.data) {
          setProxyError(res.data);
        }
      })
      .catch(() => {});

    const unlistenStatus = listen<ProxyStatusPayload>("proxy-status-changed", (ev) => {
      setProxyError(null); // clear error on success
      setProxyStatus(
        ev.payload ?? {
          running: false,
          port: 0,
          reverse_http_port: null,
          reverse_https_port: null,
          local_routing_enabled: true,
        },
      );
    });
    const unlistenError = listen<string>("proxy-auto-start-error", (ev) => {
      setProxyError(ev.payload ?? "Unknown error");
    });
    return () => {
      unlistenStatus.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [fetchProxyStatusOnce]);

  const handleToggleProxy = async (enabled: boolean) => {
    setManualStartLoading(true);
    setProxyError(null);
    try {
      if (enabled) {
        const res = await invokeApi("start_local_proxy", { payload: { port: null } });
        if (res.success && res.data) {
          setProxyStatus(res.data);
        }
      } else {
        const res = await invokeApi("stop_local_proxy");
        if (res.success && res.data) {
          setProxyStatus(res.data);
        }
      }
    } catch (e) {
      setProxyError(String(e));
    } finally {
      setManualStartLoading(false);
    }
  };

  const handleToggleLocalRouting = async () => {
    setRoutingToggleLoading(true);
    try {
      const newEnabled = !proxyStatus.local_routing_enabled;
      await invokeApi("set_local_routing_enabled", { payload: { enabled: newEnabled } });
    } catch (e) {
      console.error("set_local_routing_enabled:", e);
    } finally {
      setRoutingToggleLoading(false);
    }
  };

  const displayPort = proxyStatus.running ? proxyStatus.port : (proxySettings?.proxy_port ?? 8888);

  const handleSaveAllPorts = async () => {
    const port = Number(proxyPortInput);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return;
    }
    setProxyPortSaving(true);
    try {
      // Save proxy port
      const portRes = await invokeApi("set_proxy_port", { payload: { port } });
      if (portRes.success && portRes.data) {
        setProxySettings(portRes.data);
      }
      // Save reverse ports
      const http = reverseHttpInput.trim() ? Number(reverseHttpInput) : null;
      const https = reverseHttpsInput.trim() ? Number(reverseHttpsInput) : null;
      if (
        (http === null || (!Number.isNaN(http) && http >= 1 && http <= 65535)) &&
        (https === null || (!Number.isNaN(https) && https >= 1 && https <= 65535))
      ) {
        const revRes = await invokeApi("set_proxy_reverse_ports", {
          payload: {
            reverseHttpPort: http ?? undefined,
            reverseHttpsPort: https ?? undefined,
          },
        });
        if (revRes.success && revRes.data) {
          setProxySettings(revRes.data);
        }
      }
    } catch (e) {
      console.error("save ports:", e);
    } finally {
      setProxyPortSaving(false);
    }
  };

  const hasReversePort = Boolean(
    (proxyStatus.running && (proxyStatus.reverse_http_port ?? proxyStatus.reverse_https_port)) ||
      (proxySettings?.reverse_http_port ?? proxySettings?.reverse_https_port),
  );
  const setupPagePort =
    proxyStatus.reverse_http_port ??
    proxyStatus.reverse_https_port ??
    proxySettings?.reverse_http_port ??
    proxySettings?.reverse_https_port;

  const forwardProxyHowTo = useMemo(() => t.forwardProxyHowTo(displayPort), [t, displayPort]);
  const noSystemProxyHowTo = useMemo(() => t.noSystemProxyHowTo(setupPagePort || "8888"), [t, setupPagePort]);

  const navigate = useNavigate();
  const handleOpenSetupPage = () => navigate({ to: "/proxy/setup" });

  const handleAddRoute = async () => {
    const domain = newDomain.trim();
    const port = Number(newTargetPort);
    if (!domain || Number.isNaN(port) || port < 1 || port > 65535) {
      return;
    }
    try {
      await invokeApi("add_local_route", {
        payload: {
          domain,
          targetHost: newTargetHost.trim() || "127.0.0.1",
          targetPort: port,
        },
      });
      setNewDomain("");
      setNewTargetHost("127.0.0.1");
      setNewTargetPort("3000");
      await fetchRoutes();
    } catch (e) {
      console.error("add_local_route:", e);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await invokeApi("remove_local_route", { payload: { id } });
      await fetchRoutes();
    } catch (e) {
      console.error("remove_local_route:", e);
    }
  };

  const handleToggleEnabled = async (id: number, enabled: boolean) => {
    try {
      await invokeApi("set_local_route_enabled", { payload: { id, enabled } });
      await fetchRoutes();
    } catch (e) {
      console.error("set_local_route_enabled:", e);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <H1>{t.title}</H1>
          </div>
          <P className="text-base-content/60">{t.subtitle}</P>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusToggle
            label={proxyStatus.running ? t.running : t.off}
            checked={proxyStatus.running}
            onChange={handleToggleProxy}
            loading={manualStartLoading}
            icon={<Server className="w-3.5 h-3.5" />}
          />
          <StatusToggle
            label={t.localRouting}
            checked={proxyStatus.local_routing_enabled}
            onChange={handleToggleLocalRouting}
            loading={routingToggleLoading}
            disabled={!proxyStatus.running}
          />
        </div>
      </header>

      {proxyError && (
        <Card className="p-4 bg-error/10 border-error/20">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-error mb-1">{t.failedToStart}</h3>
              <p className="text-sm text-error font-mono break-all opacity-90">{proxyError}</p>
              <p className="text-xs text-error mt-2 opacity-80">{t.failedToStartDesc}</p>
            </div>
            <button type="button" onClick={() => setProxyError(null)} className="text-error/40 hover:text-error">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-6 flex flex-col">
        <h2 className="font-bold text-base-content mb-4">{t.portSettings}</h2>
        <p className="text-xs text-base-content/50 mb-3">{t.portSettingsDesc}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="proxy-listen-port" className="text-xs font-medium text-base-content/50">
              {t.forwardProxyPort}
            </label>
            <Input
              id="proxy-listen-port"
              type="number"
              min={1}
              max={65535}
              className="w-24 focus:ring-primary"
              value={proxyPortInput}
              onChange={(e) => setProxyPortInput(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reverse-http-port" className="text-xs font-medium text-base-content/50">
              {t.reverseHttpPort}
            </label>
            <Input
              id="reverse-http-port"
              type="number"
              min={1}
              max={65535}
              placeholder="8080"
              className="w-24"
              value={reverseHttpInput}
              onChange={(e) => setReverseHttpInput(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reverse-https-port" className="text-xs font-medium text-base-content/50">
              {t.reverseHttpsPort}
            </label>
            <Input
              id="reverse-https-port"
              type="number"
              min={1}
              max={65535}
              placeholder="8443"
              className="w-24"
              value={reverseHttpsInput}
              onChange={(e) => setReverseHttpsInput(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveAllPorts} disabled={proxyPortSaving}>
            {proxyPortSaving ? t.saving : t.save}
          </Button>
        </div>
      </Card>

      <Card className="p-4 bg-warning/10 border-warning/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-warning mb-1">{t.howToUse}</h3>
            <p className="text-sm text-warning opacity-90">{forwardProxyHowTo}</p>
            {hasReversePort && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm text-warning opacity-90">{noSystemProxyHowTo}</p>
                {proxyStatus.running && (
                  <Button variant="secondary" size="sm" onClick={handleOpenSetupPage}>
                    {t.openSetupPage}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6 flex flex-col">
        <h2 className="font-bold text-base-content mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t.addRoute}
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="proxy-route-domain" className="text-xs font-medium text-base-content/50">
              {t.domainHost}
            </label>
            <div className="relative">
              <SearchableInput
                value={newDomain}
                onChange={setNewDomain}
                suggestions={filteredDomainSuggestions}
                onSelect={() => {}}
              >
                <SearchableInput.Input
                  id="proxy-route-domain"
                  placeholder="api.example.com"
                  className="w-48 md:w-56 focus:ring-primary"
                />
                <SearchableInput.Dropdown />
              </SearchableInput>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="proxy-route-host" className="text-xs font-medium text-base-content/50">
              {t.targetHost}
            </label>
            <Input
              id="proxy-route-host"
              placeholder="127.0.0.1"
              className="w-32 focus:ring-primary"
              value={newTargetHost}
              onChange={(e) => setNewTargetHost(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="proxy-route-port" className="text-xs font-medium text-base-content/50">
              {t.targetPort}
            </label>
            <Input
              id="proxy-route-port"
              placeholder="3000"
              className="w-20 focus:ring-primary"
              value={newTargetPort}
              onChange={(e) => setNewTargetPort(e.target.value)}
            />
          </div>
          <Button variant="primary" size="sm" className="gap-2 flex items-center" onClick={handleAddRoute}>
            <Plus className="w-4 h-4" /> {t.add}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6 flex flex-col">
        <h2 className="font-bold text-base-content mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t.routes(routes.length)}
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2Icon className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : routes.length === 0 ? (
          <p className="text-base-content/40 text-sm py-6">{t.noRoutesYet}</p>
        ) : (
          <ul className="space-y-2">
            {routes.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/30 transition-colors"
              >
                <span
                  className="font-mono text-sm font-medium text-base-content truncate min-w-0 max-w-[200px] sm:max-w-xs"
                  title={r.domain}
                >
                  {r.domain}
                </span>
                <span className="text-base-content/20">→</span>
                <span className="text-sm text-base-content/60">
                  {r.target_host}:{r.target_port}
                </span>
                <button type="button" onClick={() => handleToggleEnabled(r.id, !r.enabled)} className="ml-auto">
                  <Badge variant={{ color: r.enabled ? "green" : "gray" }} className="cursor-pointer hover:opacity-80">
                    {r.enabled ? t.on : t.off}
                  </Badge>
                </button>
                <Button
                  variant="danger"
                  size="sm"
                  className="h-8 w-8 p-0 flex items-center justify-center"
                  onClick={() => handleRemove(r.id)}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

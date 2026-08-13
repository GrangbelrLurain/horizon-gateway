import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue } from "jotai";
import { Download, RefreshCw, Route, Server, ShieldAlert, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/entities/app";
import { proxyPortInputAtom, proxyReverseHttpPortInputAtom, proxyReverseHttpsPortInputAtom } from "@/entities/proxy";
import { UpdateBanner, useUpdateCheck } from "@/features/update";
import type {
  OsAppEntry,
  ProxySettings,
  ProxyStatusPayload,
  SettingsExport_Serialize,
  TransparentProxyStatus,
} from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { toastError, toastSuccess } from "@/shared/ui/toast";
import { settingsEn } from "../i18n/settings-en";
import { settingsKo } from "../i18n/settings-ko";

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="p-4 rounded-2xl border border-base-300 bg-base-100 shadow-sm space-y-3">
      <div>
        <p className="text-sm font-black text-base-content">{title}</p>
        {desc && <p className="text-xs text-base-content/60 mt-1 leading-relaxed">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsContent() {
  const [proxySettings, setProxySettings] = useState<ProxySettings | null>(null);
  const [dnsServerInput, setDnsServerInput] = useState("");
  const lang = useAtomValue(languageAtom);
  const { update, isChecking, error: updateError, checkForUpdates } = useUpdateCheck({ onMount: false });

  const [proxyStatus, setProxyStatus] = useState<ProxyStatusPayload>({
    running: false,
    port: 0,
    reverse_http_port: null,
    reverse_https_port: null,
    local_routing_enabled: true,
  });
  const [proxyPortInput, setProxyPortInput] = useAtom(proxyPortInputAtom);
  const [reverseHttpInput, setReverseHttpInput] = useAtom(proxyReverseHttpPortInputAtom);
  const [reverseHttpsInput, setReverseHttpsInput] = useAtom(proxyReverseHttpsPortInputAtom);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyPortSaving, setProxyPortSaving] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [transparentStatus, setTransparentStatus] = useState<TransparentProxyStatus>({
    running: false,
    targetPort: 0,
    activeConnections: 0,
    errorMessage: null,
    experimental: true,
    processAllowlist: [],
  });
  const [transparentLoading, setTransparentLoading] = useState(false);
  const [osApps, setOsApps] = useState<OsAppEntry[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [showAdvancedPort, setShowAdvancedPort] = useState(false);
  const [advancedPortInput, setAdvancedPortInput] = useState("");

  const t = lang === "ko" ? settingsKo : settingsEn;

  const fetchProxyStatus = useCallback(async () => {
    try {
      const res = await commands.getProxyStatus().then(unwrap);
      if (res.success && res.data) {
        setProxyStatus(res.data);
      }
    } catch (e) {
      console.error("get_proxy_status:", e);
    }
  }, []);

  const fetchTransparentStatus = useCallback(async () => {
    try {
      const res = await commands.getTransparentProxyStatus().then(unwrap);
      if (res.success && res.data) {
        setTransparentStatus(res.data);
        if (res.data.processAllowlist.length > 0) {
          setSelectedApps(res.data.processAllowlist);
        }
        if (res.data.targetPort > 0) {
          setAdvancedPortInput(String(res.data.targetPort));
        }
      }
    } catch (e) {
      console.error("get_transparent_proxy_status:", e);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const proxyRes = await commands.getProxySettings().then(unwrap);
      if (proxyRes.success && proxyRes.data) {
        setProxySettings(proxyRes.data);
        setDnsServerInput(proxyRes.data.dns_server ?? "");
        setProxyPortInput(String(proxyRes.data.proxy_port));
        setReverseHttpInput(proxyRes.data.reverse_http_port != null ? String(proxyRes.data.reverse_http_port) : "");
        setReverseHttpsInput(proxyRes.data.reverse_https_port != null ? String(proxyRes.data.reverse_https_port) : "");
      }
    } catch (e) {
      console.error("fetchSettings:", e);
    }
  }, [setProxyPortInput, setReverseHttpInput, setReverseHttpsInput]);

  useEffect(() => {
    fetchSettings();
    void fetchProxyStatus();
    void fetchTransparentStatus();

    const unlisten = listen<ProxyStatusPayload>("proxy-status-changed", (ev) => {
      setProxyStatus(ev.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchSettings, fetchProxyStatus, fetchTransparentStatus]);

  const handleToggleProxy = async (enabled: boolean) => {
    setProxyLoading(true);
    try {
      const res = enabled
        ? await commands.startLocalProxy(null).then(unwrap)
        : await commands.stopLocalProxy().then(unwrap);
      if (res.success && res.data) {
        setProxyStatus(res.data);
      }
      await notifyHubDataChanged("features");
      void fetchTransparentStatus();
    } catch (e) {
      console.error("toggle proxy:", e);
    } finally {
      setProxyLoading(false);
    }
  };

  const handleScanOsApps = async () => {
    setScanLoading(true);
    try {
      const res = await commands.scanOsApps().then(unwrap);
      if (res.success && res.data) {
        setOsApps(res.data);
        toastSuccess(res.message);
      }
    } catch (e) {
      console.error("scan_os_apps:", e);
      toastError(String(e));
    } finally {
      setScanLoading(false);
    }
  };

  const toggleSelectedApp = (name: string) => {
    setSelectedApps((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const parseAdvancedPort = (): number | null => {
    const trimmed = advancedPortInput.trim();
    if (!trimmed) {
      return null;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      return null;
    }
    return n;
  };

  const handleApplyTransparentApps = async () => {
    setTransparentLoading(true);
    try {
      const res = await commands
        .applyTransparentProxyApps({
          processNames: selectedApps,
          port: parseAdvancedPort(),
        })
        .then(unwrap);
      if (res.success && res.data) {
        setTransparentStatus(res.data);
        toastSuccess(res.message);
      }
    } catch (e) {
      console.error("apply_transparent_proxy_apps:", e);
      toastError(String(e));
      void fetchTransparentStatus();
    } finally {
      setTransparentLoading(false);
    }
  };

  const handleStopTransparent = async () => {
    setTransparentLoading(true);
    try {
      const res = await commands.stopTransparentProxy().then(unwrap);
      if (res.success && res.data) {
        setTransparentStatus(res.data);
        setSelectedApps([]);
        toastSuccess(res.message);
      }
    } catch (e) {
      console.error("stop transparent proxy:", e);
      toastError(String(e));
      void fetchTransparentStatus();
    } finally {
      setTransparentLoading(false);
    }
  };

  const handleToggleLocalRouting = async (enabled: boolean) => {
    setRoutingLoading(true);
    try {
      const res = await commands.setLocalRoutingEnabled({ enabled }).then(unwrap);
      if (res.success && res.data) {
        setProxyStatus(res.data);
      }
      await notifyHubDataChanged("features");
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error("toggle local routing:", e);
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleSaveAllPorts = async () => {
    const port = Number(proxyPortInput);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return;
    }
    setProxyPortSaving(true);
    try {
      const portRes = await commands.setProxyPort({ port }).then(unwrap);
      if (portRes.success && portRes.data) {
        setProxySettings(portRes.data);
      }
      const http = reverseHttpInput.trim() ? Number(reverseHttpInput) : null;
      const https = reverseHttpsInput.trim() ? Number(reverseHttpsInput) : null;
      if (
        (http === null || (!Number.isNaN(http) && http >= 1 && http <= 65535)) &&
        (https === null || (!Number.isNaN(https) && https >= 1 && https <= 65535))
      ) {
        const revRes = await commands
          .setProxyReversePorts({ reverseHttpPort: http, reverseHttpsPort: https })
          .then(unwrap);
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

  const handleSaveDnsServer = async () => {
    const value = dnsServerInput.trim() || null;
    try {
      const res = await commands.setProxyDnsServer({ dnsServer: value === "" ? null : value }).then(unwrap);
      if (res.success && res.data) {
        setProxySettings(res.data);
      }
    } catch (e) {
      console.error("set_proxy_dns_server:", e);
    }
  };

  const handleExport = async () => {
    try {
      const res = await commands.exportAllSettings().then(unwrap);
      if (!res.success || !res.data) {
        return;
      }
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [
          { name: "Horizon Gateway Bundle", extensions: ["hg.json"] },
          { name: "JSON", extensions: ["json"] },
        ],
        defaultPath: `horizon-gateway-${new Date().toISOString().slice(0, 10)}.hg.json`,
      });
      if (path) {
        await writeTextFile(path, JSON.stringify(res.data, null, 2));
        toastSuccess(t.alertExportSuccess);
      }
    } catch (e) {
      console.error("export_all_settings:", e);
      toastError(t.alertExportFail);
    }
  };

  const handleImport = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await open({
        filters: [
          { name: "Horizon Gateway Bundle", extensions: ["hg.json", "json"] },
          { name: "JSON", extensions: ["json"] },
        ],
        multiple: false,
      });
      if (path === null || Array.isArray(path)) {
        return;
      }
      const raw = await readTextFile(path);
      const parsed = JSON.parse(raw) as SettingsExport_Serialize & {
        data?: SettingsExport_Serialize;
        schemaVersion?: number;
      };
      // Support wrapped `{ schemaVersion, app, data }` or flat SettingsExport
      const data = (parsed.data && typeof parsed.data === "object" ? parsed.data : parsed) as SettingsExport_Serialize;
      if (typeof data.version !== "number" || !data.domains || !data.groups) {
        toastError(t.alertImportInvalid);
        return;
      }
      if (data.app && data.app !== "horizon-gateway") {
        toastError(t.alertImportInvalid);
        return;
      }
      const modeChoice = window.prompt(
        lang === "ko" ? "가져오기 모드를 입력하세요: replace 또는 merge" : "Enter import mode: replace or merge",
        "replace",
      );
      if (!modeChoice) {
        return;
      }
      const mode = modeChoice.trim().toLowerCase() === "merge" ? "merge" : "replace";
      await commands.importAllSettings(data, mode).then(unwrap);
      toastSuccess(t.alertImportSuccess);
      fetchSettings();
      await notifyHubDataChanged("domains");
    } catch (e) {
      console.error("import_all_settings:", e);
      toastError(t.alertImportFail);
    }
  };

  return (
    <div className="space-y-4">
      <Section title={t.proxyTitle} desc={t.proxyDesc}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-base-content/40">
            {proxyStatus.running ? `Port ${proxyStatus.port}` : t.proxyStopped}
          </p>
          <StatusToggle
            label={proxyStatus.running ? t.proxyRunning : t.proxyStopped}
            checked={proxyStatus.running}
            onChange={handleToggleProxy}
            loading={proxyLoading}
            icon={<Server className="w-3.5 h-3.5" />}
          />
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-base-300">
          <div className="min-w-0">
            <p className="text-xs font-bold text-base-content">{t.proxyLocalRoutingLabel}</p>
            <p className="text-[10px] text-base-content/50 mt-0.5 leading-relaxed">{t.proxyLocalRoutingDesc}</p>
          </div>
          <StatusToggle
            label={proxyStatus.local_routing_enabled ? t.proxyLocalRoutingOn : t.proxyLocalRoutingOff}
            checked={proxyStatus.local_routing_enabled}
            onChange={handleToggleLocalRouting}
            loading={routingLoading}
            icon={<Route className="w-3.5 h-3.5" />}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-base-300">
          <div className="flex flex-col gap-1">
            <label htmlFor="popup-proxy-port" className="text-[10px] font-bold text-base-content/40 uppercase">
              {t.proxyPortLabel}
            </label>
            <Input
              id="popup-proxy-port"
              type="number"
              min={1}
              max={65535}
              className="h-9 text-sm"
              value={proxyPortInput}
              onChange={(e) => setProxyPortInput(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="popup-reverse-http" className="text-[10px] font-bold text-base-content/40 uppercase">
              {t.proxyHttpLabel}
            </label>
            <Input
              id="popup-reverse-http"
              type="number"
              min={1}
              max={65535}
              placeholder="8080"
              className="h-9 text-sm"
              value={reverseHttpInput}
              onChange={(e) => setReverseHttpInput(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="popup-reverse-https" className="text-[10px] font-bold text-base-content/40 uppercase">
              {t.proxyHttpsLabel}
            </label>
            <Input
              id="popup-reverse-https"
              type="number"
              min={1}
              max={65535}
              placeholder="8443"
              className="h-9 text-sm"
              value={reverseHttpsInput}
              onChange={(e) => setReverseHttpsInput(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleSaveAllPorts} disabled={proxyPortSaving}>
            {proxyPortSaving ? t.proxySaving : t.proxySavePorts}
          </Button>
        </div>
      </Section>

      <Section title={t.transparentTitle} desc={t.transparentDesc}>
        <p className="text-[10px] text-warning font-bold flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          {t.transparentWarn}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-base-content/40 min-w-0">
            {transparentStatus.running
              ? `${t.transparentRunning} · :${transparentStatus.targetPort} · ${transparentStatus.processAllowlist.join(", ") || "—"}`
              : t.transparentStopped}
          </p>
          {transparentStatus.running && (
            <Button variant="secondary" size="sm" onClick={handleStopTransparent} disabled={transparentLoading}>
              {t.transparentStop}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleScanOsApps} disabled={scanLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${scanLoading ? "animate-spin" : ""}`} />
            {scanLoading ? t.transparentScanning : t.transparentScan}
          </Button>
          <span className="text-[10px] text-base-content/40">{t.transparentScanHint}</span>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-xl border border-base-300 divide-y divide-base-300">
          {(() => {
            const byName = new Map(osApps.map((a) => [a.name.toLowerCase(), a]));
            for (const name of selectedApps) {
              const key = name.toLowerCase();
              if (!byName.has(key)) {
                byName.set(key, { name, pids: [], instanceCount: 0 });
              }
            }
            const rows = [...byName.values()].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
            );
            if (rows.length === 0) {
              return <p className="text-xs text-base-content/40 px-3 py-4">{t.transparentAppsEmpty}</p>;
            }
            return rows.map((app) => {
              const checked = selectedApps.some((n) => n.toLowerCase() === app.name.toLowerCase());
              return (
                <label key={app.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-base-200/60">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={checked}
                    onChange={() => toggleSelectedApp(app.name)}
                  />
                  <span className="text-xs font-medium flex-1 truncate">{app.name}</span>
                  {app.instanceCount > 0 && (
                    <span className="text-[10px] text-base-content/40 shrink-0">
                      {app.instanceCount}
                      {t.transparentInstances}
                    </span>
                  )}
                </label>
              );
            });
          })()}
        </div>

        <button
          type="button"
          className="text-[10px] font-bold text-base-content/50 uppercase tracking-wide"
          onClick={() => setShowAdvancedPort((v) => !v)}
        >
          {t.transparentAdvanced}
          {showAdvancedPort ? " ▴" : " ▾"}
        </button>
        {showAdvancedPort && (
          <div className="flex flex-col gap-1">
            <label htmlFor="popup-tp-port" className="text-[10px] font-bold text-base-content/40 uppercase">
              {t.transparentPortLabel}
            </label>
            <Input
              id="popup-tp-port"
              type="number"
              min={1}
              max={65535}
              placeholder="8887"
              className="h-9 text-sm"
              value={advancedPortInput}
              onChange={(e) => setAdvancedPortInput(e.target.value)}
            />
            <p className="text-[10px] text-base-content/40">{t.transparentPortHint}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleApplyTransparentApps}
            disabled={transparentLoading || (!proxyStatus.running && selectedApps.length > 0)}
          >
            {transparentLoading ? t.transparentApplying : t.transparentApply}
          </Button>
        </div>
      </Section>

      <Section title={t.updateTitle} desc={t.updateDesc}>
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => checkForUpdates()}
            disabled={isChecking}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? t.updateChecking : t.updateCheckBtn}
          </Button>
          {updateError && <span className="text-xs text-error">{updateError}</span>}
          {!update && !isChecking && !updateError && (
            <span className="text-xs text-base-content/40">{t.updateClickToCheck}</span>
          )}
        </div>
        {update && <UpdateBanner update={update} onDismiss={undefined} />}
      </Section>

      <Section title={t.dnsTitle} desc={t.dnsDesc}>
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1 w-full">
            <label htmlFor="popup-dns" className="text-[10px] font-bold text-base-content/40 uppercase">
              {t.dnsLabel}
            </label>
            <Input
              id="popup-dns"
              placeholder={t.dnsPlaceholder}
              className="h-9 text-sm"
              value={dnsServerInput}
              onChange={(e) => setDnsServerInput(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveDnsServer} className="shrink-0">
            {t.dnsSave}
          </Button>
        </div>
        {proxySettings?.dns_server && (
          <p className="text-xs text-base-content/40">
            {t.dnsCurrent} <code className="bg-base-200 px-1 rounded">{proxySettings.dns_server}</code>
          </p>
        )}
      </Section>

      <Section title={t.backupTitle} desc={t.backupDesc}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> {t.backupExport}
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleImport}>
            <Upload className="w-3.5 h-3.5" /> {t.backupImport}
          </Button>
        </div>
      </Section>
    </div>
  );
}

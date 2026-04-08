import { createFileRoute } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue } from "jotai";
import { Download, RefreshCw, Server, Settings as SettingsIcon, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  proxyPortInputAtom,
  proxyReverseHttpPortInputAtom,
  proxyReverseHttpsPortInputAtom,
} from "@/domain/app-status/store";
import { languageAtom } from "@/domain/i18n/store";
import type { ProxySettings, ProxyStatusPayload } from "@/entities/proxy/types/local_route";
import type { SettingsExport } from "@/entities/settings/types/settings_export";
import { UpdateBanner, useUpdateCheck } from "@/features/update";
import { invokeApi } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { H1, P } from "@/shared/ui/typography/typography";

import { en } from "./en";
import { ko } from "./ko";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
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

  const t = lang === "ko" ? ko : en;

  const fetchProxyStatus = useCallback(async () => {
    try {
      const res = await invokeApi("get_proxy_status");
      if (res.success && res.data) {
        setProxyStatus(res.data);
      }
    } catch (e) {
      console.error("get_proxy_status:", e);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const proxyRes = await invokeApi("get_proxy_settings");
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

    const unlisten = listen<ProxyStatusPayload>("proxy-status-changed", (ev) => {
      setProxyStatus(ev.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchSettings, fetchProxyStatus]);

  const handleToggleProxy = async (enabled: boolean) => {
    setProxyLoading(true);
    try {
      if (enabled) {
        await invokeApi("start_local_proxy", { payload: { port: null } });
      } else {
        await invokeApi("stop_local_proxy");
      }
    } catch (e) {
      console.error("toggle proxy:", e);
    } finally {
      setProxyLoading(false);
    }
  };

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

  const handleSaveDnsServer = async () => {
    const value = dnsServerInput.trim() || null;
    try {
      const res = await invokeApi("set_proxy_dns_server", {
        payload: { dnsServer: value === "" ? null : value },
      });
      if (res.success && res.data) {
        setProxySettings(res.data);
      }
    } catch (e) {
      console.error("set_proxy_dns_server:", e);
    }
  };

  const handleExport = async () => {
    try {
      const res = await invokeApi("export_all_settings");
      if (!res.success || !res.data) {
        return;
      }
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `watchtower-settings-${new Date().toISOString().slice(0, 10)}.json`,
      });
      if (path) {
        await writeTextFile(path, JSON.stringify(res.data, null, 2));
        alert(t.alertExportSuccess);
      }
    } catch (e) {
      console.error("export_all_settings:", e);
      alert(t.alertExportFail);
    }
  };

  const handleImport = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (path === null || Array.isArray(path)) {
        return;
      }
      const raw = await readTextFile(path);
      const data = JSON.parse(raw) as SettingsExport;
      if (typeof data.version !== "number" || !data.domains || !data.groups) {
        alert(t.alertImportInvalid);
        return;
      }
      if (!confirm(t.alertImportConfirm)) {
        return;
      }
      await invokeApi("import_all_settings", { payload: data });
      alert(t.alertImportSuccess);
      fetchSettings();
    } catch (e) {
      console.error("import_all_settings:", e);
      alert(t.alertImportFail);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <header>
        <div className="flex items-center gap-3 mb-1 tablet:mb-2 text-primary">
          <div className="p-2 bg-primary/10 rounded-lg">
            <SettingsIcon className="w-5 h-5 tablet:w-6 tablet:h-6" />
          </div>
          <H1 className="text-2xl tablet:text-3xl font-black tracking-tight">{t.title}</H1>
        </div>
        <P className="text-base-content/60 text-xs tablet:text-sm">{t.subtitle}</P>
      </header>

      <Card className="p-4 tablet:p-6 flex flex-col">
        <div className="flex flex-col tablet:flex-row justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="font-bold text-base-content mb-1 tablet:text-lg">{t.proxyTitle}</h2>
            <p className="text-xs tablet:text-sm text-base-content/60">{t.proxyDesc}</p>
          </div>
          <StatusToggle
            label={proxyStatus.running ? t.proxyRunning : t.proxyStopped}
            checked={proxyStatus.running}
            onChange={handleToggleProxy}
            loading={proxyLoading}
            icon={<Server className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 tablet:grid-cols-3 gap-4 tablet:gap-6 pt-4 tablet:pt-6 border-t border-base-200">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="proxy-listen-port"
              className="text-[10px] tablet:text-xs font-bold text-base-content/40 uppercase tracking-wider"
            >
              {t.proxyPortLabel}
            </label>
            <Input
              id="proxy-listen-port"
              type="number"
              min={1}
              max={65535}
              className="w-full focus:ring-primary h-10"
              value={proxyPortInput}
              onChange={(e) => setProxyPortInput(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reverse-http-port"
              className="text-[10px] tablet:text-xs font-bold text-base-content/40 uppercase tracking-wider"
            >
              {t.proxyHttpLabel}
            </label>
            <Input
              id="reverse-http-port"
              type="number"
              min={1}
              max={65535}
              placeholder="8080"
              className="w-full h-10"
              value={reverseHttpInput}
              onChange={(e) => setReverseHttpInput(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reverse-https-port"
              className="text-[10px] tablet:text-xs font-bold text-base-content/40 uppercase tracking-wider"
            >
              {t.proxyHttpsLabel}
            </label>
            <Input
              id="reverse-https-port"
              type="number"
              min={1}
              max={65535}
              placeholder="8443"
              className="w-full h-10"
              value={reverseHttpsInput}
              onChange={(e) => setReverseHttpsInput(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleSaveAllPorts} disabled={proxyPortSaving}>
            {proxyPortSaving ? t.proxySaving : t.proxySavePorts}
          </Button>
        </div>
      </Card>

      <Card className="p-4 tablet:p-6 flex flex-col">
        <h2 className="font-bold text-base-content mb-2">{t.updateTitle}</h2>
        <p className="text-sm text-base-content/60 mb-4">{t.updateDesc}</p>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 flex items-center"
            onClick={() => checkForUpdates()}
            disabled={isChecking}
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? t.updateChecking : t.updateCheckBtn}
          </Button>
          {updateError && <span className="text-sm text-error">{updateError}</span>}
          {!update && !isChecking && !updateError && (
            <span className="text-sm text-base-content/40">{t.updateClickToCheck}</span>
          )}
        </div>
        {update && <UpdateBanner update={update} onDismiss={undefined} />}
      </Card>

      <Card className="p-4 tablet:p-6 flex flex-col">
        <h2 className="font-bold text-base-content mb-2">{t.dnsTitle}</h2>
        <p className="text-sm text-base-content/60 mb-4">
          {t.dnsDesc} <code className="bg-base-200 px-1 rounded">8.8.8.8</code> or{" "}
          <code className="bg-base-200 px-1 rounded">1.1.1.1:53</code>.
        </p>
        <div className="flex flex-col tablet:flex-row gap-4 items-end">
          <div className="flex flex-col gap-1.5 w-full tablet:w-auto">
            <label
              htmlFor="settings-dns-server"
              className="text-[10px] tablet:text-xs font-bold text-base-content/40 uppercase tracking-wider"
            >
              {t.dnsLabel}
            </label>
            <Input
              id="settings-dns-server"
              placeholder={t.dnsPlaceholder}
              className="w-full tablet:w-48 focus:ring-primary h-10"
              value={dnsServerInput}
              onChange={(e) => setDnsServerInput(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveDnsServer} className="w-full tablet:w-auto h-10">
            {t.dnsSave}
          </Button>
        </div>
        {proxySettings?.dns_server && (
          <p className="text-xs text-base-content/40 mt-2">
            {t.dnsCurrent} <code className="bg-base-200 px-1 rounded">{proxySettings.dns_server}</code>
          </p>
        )}
      </Card>

      <Card className="p-4 tablet:p-6 flex flex-col">
        <h2 className="font-bold text-base-content mb-2">{t.backupTitle}</h2>
        <p className="text-sm text-base-content/60 mb-4">{t.backupDesc}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" className="gap-2 flex items-center" onClick={handleExport}>
            <Download className="w-4 h-4" /> {t.backupExport}
          </Button>
          <Button variant="secondary" size="sm" className="gap-2 flex items-center" onClick={handleImport}>
            <Upload className="w-4 h-4" /> {t.backupImport}
          </Button>
        </div>
      </Card>
    </div>
  );
}

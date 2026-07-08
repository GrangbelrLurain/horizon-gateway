import { listen } from "@tauri-apps/api/event";
import { useAtomValue } from "jotai";
import { Download, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyServerWarning } from "@/entities/proxy";
import { openPopupWindow } from "@/features/popup-window";
import type { ProxyStatusPayload } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";

export function InfrastructureContent() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;
  const [proxyStatus, setProxyStatus] = useState<ProxyStatusPayload>({
    running: false,
    port: 0,
    reverse_http_port: null,
    reverse_https_port: null,
    local_routing_enabled: true,
  });
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await commands.getProxyStatus().then(unwrap);
      if (res.success && res.data) {
        setProxyStatus(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const unlisten = listen<ProxyStatusPayload>("proxy-status-changed", (ev) => {
      setProxyStatus(ev.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchStatus]);

  const toggleProxy = async () => {
    setLoading(true);
    try {
      if (proxyStatus.running) {
        await commands.stopLocalProxy().then(unwrap);
      } else {
        await commands.startLocalProxy(null).then(unwrap);
      }
      await fetchStatus();
      await notifyHubDataChanged("features");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCA = async () => {
    try {
      await commands.saveRootCa().then(unwrap);
    } catch (e) {
      if (e !== "Save cancelled") {
        console.error(e);
      }
    }
  };

  const port = proxyStatus.running ? proxyStatus.port : 0;
  const pacUrl = port > 0 ? `http://127.0.0.1:${port}/.watchtower/proxy.pac` : "";

  return (
    <div className="space-y-5">
      <ProxyServerWarning />

      <div className="p-4 rounded-2xl border border-base-300 bg-base-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-base-content">{t.infraProxy}</p>
            <p className="text-xs text-base-content/60 mt-1 leading-relaxed">{t.infraProxyDesc}</p>
            <p className="text-xs text-base-content/40 mt-1">
              {proxyStatus.running ? `Port ${proxyStatus.port}` : "Stopped"}
            </p>
          </div>
          <Button
            variant={proxyStatus.running ? "secondary" : "primary"}
            size="sm"
            onClick={toggleProxy}
            disabled={loading}
          >
            {proxyStatus.running ? t.infraStop : t.infraStart}
          </Button>
        </div>
      </div>

      {proxyStatus.running && (
        <>
          <div className="p-4 rounded-2xl border border-base-300 bg-base-100 shadow-sm space-y-3">
            <div>
              <p className="text-sm font-black text-base-content">{t.infraCert}</p>
              <p className="text-xs text-base-content/60 mt-1 leading-relaxed">{t.infraCertDesc}</p>
            </div>
            <Button variant="primary" size="sm" className="gap-1.5" onClick={handleSaveCA}>
              <Download className="w-3.5 h-3.5" />
              {t.infraCertSave}
            </Button>
          </div>

          <div className="p-4 rounded-2xl border border-base-300 bg-base-100 shadow-sm space-y-2">
            <div>
              <p className="text-sm font-black text-base-content">{t.infraPac}</p>
              <p className="text-xs text-base-content/60 mt-1 leading-relaxed">{t.infraPacDesc}</p>
            </div>
            <code className="block text-xs font-mono bg-base-200 p-3 rounded-lg break-all text-indigo-600 dark:text-indigo-400">
              {pacUrl || "—"}
            </code>
          </div>

          <div className="p-4 rounded-2xl border border-base-300 bg-base-100 shadow-sm space-y-3">
            <p className="text-sm font-black text-base-content">{t.infraMobile}</p>
            <p className="text-xs text-base-content/60">{t.infraMobileDesc}</p>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                void openPopupWindow("mobile");
              }}
            >
              <Smartphone className="w-3.5 h-3.5" />
              {t.infraMobileOpen}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

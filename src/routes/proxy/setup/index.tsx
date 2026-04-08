import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { ArrowLeft, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/domain/i18n/store";
import type { ProxyStatusPayload } from "@/entities/proxy/types/local_route";
import { invokeApi } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { ProxyServerWarning } from "@/shared/ui/proxy-server-warning/ProxyServerWarning";
import { H1, H2, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";

export const Route = createFileRoute("/proxy/setup/")({
  component: ProxySetupPage,
});

function ProxySetupPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [proxyStatus, setProxyStatus] = useState<ProxyStatusPayload>({
    running: false,
    port: 0,
    reverse_http_port: null,
    reverse_https_port: null,
    local_routing_enabled: true,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const statusRes = await invokeApi("get_proxy_status");
      if (statusRes?.success && statusRes.data) {
        setProxyStatus(statusRes.data);
      }
    } catch (e) {
      console.error("proxy setup fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const port = proxyStatus.running ? proxyStatus.port : 0;
  const pacUrl = port > 0 ? `http://127.0.0.1:${port}/.watchtower/proxy.pac` : "";

  const handleSaveRootCA = async () => {
    try {
      const res = await invokeApi("save_root_ca");
      if (res.success) {
        alert(t.certSaved);
      }
    } catch (e) {
      if (e !== "Save cancelled") {
        console.error("save_root_ca:", e);
        alert(t.certSaveFailed);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="animate-pulse">{t.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/proxy/dashboard" className="text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <H1>{t.title}</H1>
      </div>

      <ProxyServerWarning />

      {proxyStatus.running && (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* HTTPS Root CA */}
          <Card className="p-6">
            <H2 className="mb-4">{t.certTitle}</H2>
            <P className="text-slate-600 mb-6">{t.certDesc}</P>

            <div className="flex justify-center mb-8">
              <Button
                variant="primary"
                className="flex items-center gap-2 py-3 px-6 h-auto text-base"
                onClick={handleSaveRootCA}
                disabled={port === 0}
              >
                <Download className="w-5 h-5" />
                {t.saveCertBtn}
              </Button>
            </div>

            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-3">{t.installationStepsTitle}</h3>
              <ol className="list-decimal list-inside space-y-2 text-slate-700 text-sm">
                <li>{t.step1}</li>
                <li>{t.step2}</li>
                <li>{t.step3}</li>
                <li>{t.step4}</li>
                <li>{t.step5}</li>
                <li>{t.step6}</li>
                <li>{t.step7}</li>
              </ol>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <P className="text-slate-500 text-xs">{t.macosUsers}</P>
            </div>
          </Card>

          {/* PAC */}
          <Card className="p-6">
            <H2 className="mb-2">{t.pacTitle}</H2>
            <P className="text-slate-600 mb-3">{t.pacDesc}</P>
            <div className="bg-slate-100 rounded-lg p-4 font-mono text-sm break-all">{pacUrl || "—"}</div>
            <P className="text-slate-500 text-sm mt-3">
              {t.pacWindows}
              <br />
              {t.pacMacos}
            </P>
          </Card>

          {/* 수동 프록시 */}
          <Card className="p-6">
            <H2 className="mb-2">{t.manualTitle}</H2>
            <P className="text-slate-600 mb-2">{t.manualDesc}</P>
            <ul className="list-disc list-inside text-slate-600 space-y-1">
              <li>
                {t.manualAddress} <code className="bg-slate-100 px-1 rounded">127.0.0.1</code>
              </li>
              <li>
                {t.manualPort} <code className="bg-slate-100 px-1 rounded">{port}</code>
              </li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

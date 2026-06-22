import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { ArrowLeft, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/entities/app/i18n/store";
import type { ProxyStatusPayload } from "@/entities/proxy";
import { ProxyServerWarning } from "@/entities/proxy/ui/ProxyServerWarning";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
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
      const statusRes = await commands.getProxyStatus().then(unwrap);
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
      const res = await commands.saveRootCa().then(unwrap);
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
        <div className="flex items-center gap-2 text-base-content/40">
          <span className="animate-pulse">{t.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/proxy/dashboard" className="text-base-content/40 hover:text-base-content transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <H1 className="text-2xl tablet:text-3xl font-black text-base-content tracking-tight">{t.title}</H1>
      </div>

      <ProxyServerWarning />

      {proxyStatus.running && (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* HTTPS Root CA */}
          <Card className="p-6">
            <H2 className="mb-4 text-xl tablet:text-2xl font-black text-base-content tracking-tight">{t.certTitle}</H2>
            <P className="text-base-content/60 mb-6">{t.certDesc}</P>

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

            <div className="bg-base-200/50 p-5 rounded-xl border border-base-300">
              <h3 className="font-bold text-base-content mb-3 uppercase tracking-wider text-xs opacity-50">
                {t.installationStepsTitle}
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-base-content/80 text-sm">
                <li>{t.step1}</li>
                <li>{t.step2}</li>
                <li>{t.step3}</li>
                <li>{t.step4}</li>
                <li>{t.step5}</li>
                <li>{t.step6}</li>
                <li>{t.step7}</li>
              </ol>
            </div>

            <div className="mt-6 pt-4 border-t border-base-200">
              <P className="text-base-content/40 text-[10px] italic">{t.macosUsers}</P>
            </div>
          </Card>

          {/* PAC */}
          <Card className="p-6">
            <H2 className="mb-2 text-xl font-bold text-base-content">{t.pacTitle}</H2>
            <P className="text-base-content/60 mb-3">{t.pacDesc}</P>
            <div className="bg-base-200 rounded-lg p-4 font-mono text-xs tablet:text-sm break-all text-primary font-bold">
              {pacUrl || "—"}
            </div>
            <P className="text-base-content/40 text-xs tablet:text-sm mt-3 leading-relaxed">
              {t.pacWindows}
              <br />
              {t.pacMacos}
            </P>
          </Card>

          {/* 수동 프록시 */}
          <Card className="p-6">
            <H2 className="mb-2 text-xl font-bold text-base-content">{t.manualTitle}</H2>
            <P className="text-base-content/60 mb-2">{t.manualDesc}</P>
            <ul className="list-disc list-inside text-base-content/80 space-y-1 text-sm">
              <li>
                {t.manualAddress}{" "}
                <code className="bg-base-200 px-2 py-0.5 rounded text-primary font-bold">127.0.0.1</code>
              </li>
              <li>
                {t.manualPort} <code className="bg-base-200 px-2 py-0.5 rounded text-primary font-bold">{port}</code>
              </li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

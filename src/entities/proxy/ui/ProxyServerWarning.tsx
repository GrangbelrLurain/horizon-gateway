import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { AlertCircle, ArrowRight, Settings } from "lucide-react";
import { languageAtom } from "@/entities/app/i18n/store";
import { proxyRunningAtom } from "@/entities/app/status/store";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";

const ko = {
  title: "프록시 서버 필요",
  desc: "이 기능을 사용하려면 프록시 서버가 실행 중이어야 합니다. 프록시 서버는 데이터 수집과 라우팅의 핵심 엔진입니다.",
  action: "설정에서 서버 켜기",
};

const en = {
  title: "Proxy Server Required",
  desc: "The proxy server must be running to use this feature. The proxy is the core engine for data collection and routing.",
  action: "Turn on in Settings",
};

export function ProxyServerWarning() {
  const isRunning = useAtomValue(proxyRunningAtom);
  const lang = useAtomValue(languageAtom);
  const navigate = useNavigate();
  const t = lang === "ko" ? ko : en;

  if (isRunning !== false) {
    return null;
  }

  return (
    <Card className="p-12 border-warning/20 bg-warning/5 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-500 shadow-2xl shadow-warning/5">
      <div className="p-5 bg-warning/10 text-warning rounded-full ring-8 ring-warning/5">
        <AlertCircle className="w-16 h-16" />
      </div>
      <div className="max-w-md">
        <h2 className="text-2xl font-black mb-3 text-base-content tracking-tight">{t.title}</h2>
        <p className="text-base text-base-content/60 font-medium leading-relaxed">{t.desc}</p>
      </div>
      <Button
        variant="primary"
        size="lg"
        className="gap-3 px-10 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        onClick={() => navigate({ to: "/settings" })}
      >
        <Settings className="w-5 h-5" />
        {t.action}
        <ArrowRight className="w-5 h-5" />
      </Button>
    </Card>
  );
}

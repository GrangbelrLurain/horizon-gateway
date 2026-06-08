import { Link } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue } from "jotai";
import { AlertCircle, Camera, Check, ChevronRight, ExternalLink, Globe, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { proxyInspectorEnabledAtom, proxyRunningAtom } from "@/domain/app-status/store";
import { languageAtom } from "@/domain/i18n/store";
import type { Annotation, CapturedElement } from "@/entities/domain/types/inspector";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { H1, P } from "@/shared/ui/typography/typography";

export function InspectorPanel() {
  const lang = useAtomValue(languageAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);
  const [inspectorEnabled, setInspectorEnabled] = useAtom(proxyInspectorEnabledAtom);
  const [injectionDomains, setInjectionDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");

  const [captured, setCaptured] = useState<CapturedElement | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const t = {
    ko: {
      title: "인스펙터 & 설정",
      subtitle: "인젝션 정책을 설정하고 브라우저에서 새로운 UX 요소를 캡처합니다.",
      statusActive: "워치타워 프록시가 활성화되어 있습니다.",
      statusInactive: "프록시가 실행 중이 아닙니다. 인스펙터 기능을 사용하려면 프록시를 켜주세요.",
      capturedTitle: "새 정책 정의",
      rolePlaceholder: "요소 명칭 (예: 메인 로그인 버튼)",
      descPlaceholder: "기능 정의 및 UX 정책 내용을 입력하세요.",
      saveBtn: "정책 저장",
      selector: "CSS 선택자",
      injectionSettings: "인젝션 정책 설정",
      injectionEnabled: "인젝션 기능 활성화",
      injectionDisabled: "인젝션 기능 비활성화",
      injectionDomainsLabel: "대상 도메인 목록",
      injectionDomainsDesc:
        "도메인을 등록하면 해당 도메인에만 인젝션 스크립트가 삽입됩니다. 목록이 비어 있으면 모든 도메인에 적용됩니다.",
      addDomainPlaceholder: "example.com (엔터로 추가)",
      globalApply: "전체 도메인 적용 중",
      waitingCapture: "브라우저에서 캡처 대기 중...",
      waitingCaptureDesc: "인젝션이 활성화된 브라우저에서 Alt + 클릭으로 요소를 선택하세요.",
      saveSuccess: "정책이 성공적으로 저장되었습니다!",
      viewList: "정책 목록 보기",
    },
    en: {
      title: "Inspector & Settings",
      subtitle: "Configure injection policies and capture new UX elements from browser.",
      statusActive: "Watchtower Proxy is active.",
      statusInactive: "Proxy is not running. Please start the proxy to use the inspector.",
      capturedTitle: "Define New Policy",
      rolePlaceholder: "Element Title (e.g. Main Login Button)",
      descPlaceholder: "Enter functional definitions and UX policy details.",
      saveBtn: "Save Policy",
      selector: "CSS Selector",
      injectionSettings: "Injection Policy Settings",
      injectionEnabled: "Injection Enabled",
      injectionDisabled: "Injection Disabled",
      injectionDomainsLabel: "Target Domains",
      injectionDomainsDesc: "Register domains to limit injection. If the list is empty, it applies to all domains.",
      addDomainPlaceholder: "example.com (Press Enter)",
      globalApply: "Applied to all domains",
      waitingCapture: "Waiting for capture from browser...",
      waitingCaptureDesc: "Press Alt + Click on any element in the injected browser.",
      saveSuccess: "Policy saved successfully!",
      viewList: "View Policy List",
    },
  }[lang] || {
    title: "Inspector & Settings",
    subtitle: "Configure injection policies and capture new UX elements from browser.",
    statusActive: "Watchtower Proxy is active.",
    statusInactive: "Proxy is not running. Please start the proxy to use the inspector.",
    capturedTitle: "Define New Policy",
    rolePlaceholder: "Element Title (e.g. Main Login Button)",
    descPlaceholder: "Enter functional definitions and UX policy details.",
    saveBtn: "Save Policy",
    selector: "CSS Selector",
    injectionSettings: "Injection Policy Settings",
    injectionEnabled: "Injection Enabled",
    injectionDisabled: "Injection Disabled",
    injectionDomainsLabel: "Target Domains",
    injectionDomainsDesc: "Register domains to limit injection. If the list is empty, it applies to all domains.",
    addDomainPlaceholder: "example.com (Press Enter)",
    globalApply: "Applied to all domains",
    waitingCapture: "Waiting for capture from browser...",
    waitingCaptureDesc: "Press Alt + Click on any element in the injected browser.",
    saveSuccess: "Policy saved successfully!",
    viewList: "View Policy List",
  };

  useEffect(() => {
    commands
      .getInjectionDomains()
      .then(unwrap)
      .then((res) => {
        if (res.success && res.data) {
          setInjectionDomains(res.data);
        }
      });

    const unlisten = listen<CapturedElement>("annotation-dialog-requested", (event) => {
      setCaptured(event.payload);
      setRole("");
      setDescription("");
      setLastSavedId(null);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleToggleInspector = async (enabled: boolean) => {
    setInspectorEnabled(enabled);
    await commands.setGlobalInspectorEnabled(enabled).then(unwrap);
  };

  const handleAddDomain = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newDomain.trim()) {
      const updated = [...injectionDomains, newDomain.trim()];
      setInjectionDomains(updated);
      await commands.setInjectionDomains({ domains: updated }).then(unwrap);
      setNewDomain("");
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    const updated = injectionDomains.filter((d) => d !== domain);
    setInjectionDomains(updated);
    await commands.setInjectionDomains({ domains: updated }).then(unwrap);
  };

  const saveAnnotation = async () => {
    if (!captured) {
      return;
    }
    const newAnnotation: Annotation = {
      ...captured,
      id: Math.random().toString(36).substring(2, 9),
      role,
      description,
      timestamp: Date.now(),
    };

    const res = await commands.addAnnotation(newAnnotation).then(unwrap);
    if (res.success) {
      setLastSavedId(newAnnotation.id);
      setCaptured(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-4xl mx-auto">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-primary/20 rounded-xl text-primary">
            <Camera className="w-6 h-6" />
          </div>
          <H1 className="text-3xl font-black tracking-tight">{t.title}</H1>
        </div>
        <P className="text-base-content/60 ml-1">{t.subtitle}</P>
      </header>

      {/* 인젝션 설정 섹션 */}
      <Card className="p-6 border-none bg-base-100 shadow-sm ring-1 ring-base-300">
        <div className="flex flex-col tablet:flex-row justify-between items-start gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <ExternalLink className="w-5 h-5 text-primary" />
              {t.injectionSettings}
            </h2>
            <P className="text-sm text-base-content/60 leading-relaxed">{t.injectionDomainsDesc}</P>
          </div>
          <StatusToggle
            label={inspectorEnabled ? t.injectionEnabled : t.injectionDisabled}
            checked={!!inspectorEnabled}
            onChange={handleToggleInspector}
            icon={<Camera className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-base-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1">
                {t.injectionDomainsLabel}
              </label>
              {injectionDomains.length === 0 && (
                <span className="text-[10px] font-bold text-success uppercase tracking-widest px-2 py-0.5 bg-success/10 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> {t.globalApply}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {injectionDomains.map((domain) => (
                <div
                  key={domain}
                  className="group flex items-center gap-1.5 bg-base-200 hover:bg-base-300 px-3 py-1.5 rounded-xl border border-base-300 transition-colors"
                >
                  <Globe className="w-3 h-3 text-base-content/40" />
                  <span className="text-xs font-bold font-mono">{domain}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    className="p-0.5 hover:text-error transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={handleAddDomain}
                  placeholder={t.addDomainPlaceholder}
                  className="h-9 text-xs font-mono"
                />
                <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {!isProxyRunning && (
        <Card className="p-6 border-none bg-error/10 shadow-sm ring-1 ring-error/20">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-error/20 rounded-2xl text-error border border-error/20">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-xl text-error">{t.statusInactive}</h3>
              <P className="text-sm text-error/70 leading-relaxed">
                현재 워치타워 프록시가 비활성화되어 있어 브라우저에서 요소를 선택하거나 캡처할 수 없습니다. 설정
                페이지에서 프록시를 시작해 주세요.
              </P>
            </div>
          </div>
        </Card>
      )}

      {captured ? (
        <Card className="p-6 border-2 border-primary/50 animate-in zoom-in-95 duration-300 shadow-2xl bg-base-100 ring-4 ring-primary/5">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-primary">
              <Camera className="w-6 h-6" />
              {t.capturedTitle}
            </h2>
            <button
              type="button"
              onClick={() => setCaptured(null)}
              className="p-2 rounded-full hover:bg-base-200 text-base-content/40 hover:text-base-content transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-base-200/50 rounded-2xl overflow-hidden flex items-center justify-center p-6 border border-base-300/50 relative group">
              <img
                src={captured.thumbnail}
                alt="Captured element"
                className="max-w-full max-h-[320px] shadow-2xl rounded-lg"
              />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white font-bold flex items-center gap-2">
                <Globe className="w-3 h-3" />
                {captured.domain}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="captured-selector"
                  className="text-xs font-bold text-base-content/40 uppercase tracking-widest px-1"
                >
                  {t.selector}
                </label>
                <code
                  id="captured-selector"
                  className="text-[11px] bg-base-200 p-3 rounded-xl block break-all whitespace-pre-wrap font-mono border border-base-300/30 text-base-content/80"
                >
                  {captured.selector}
                </code>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  placeholder={t.rolePlaceholder}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="font-bold text-lg h-12"
                />
                <textarea
                  placeholder={t.descPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="textarea textarea-bordered w-full h-28 bg-base-200/30 focus:outline-primary rounded-xl"
                />
                <Button
                  variant="primary"
                  className="w-full h-12 gap-2 text-lg font-bold"
                  onClick={saveAnnotation}
                  disabled={!role}
                >
                  <Save className="w-5 h-5" />
                  {t.saveBtn}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {lastSavedId && (
            <Card className="p-6 bg-success/10 border-none ring-1 ring-success/20 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-success/20 rounded-lg text-success">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-success">{t.saveSuccess}</span>
                </div>
                <Link to="/ux/policies">
                  <Button variant="ghost" size="sm" className="gap-2 text-success hover:bg-success/10">
                    {t.viewList}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-base-300 rounded-3xl bg-base-100/50 text-base-content/20">
            <div className="relative mb-6">
              <Camera className="w-20 h-16 opacity-10" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full animate-ping opacity-20" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-base-content/40 mb-2">{t.waitingCapture}</h3>
            <P className="text-sm text-base-content/30">{t.waitingCaptureDesc}</P>
          </div>
        </div>
      )}
    </div>
  );
}

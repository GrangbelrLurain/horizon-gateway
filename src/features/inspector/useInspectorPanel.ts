import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languageAtom, proxyInspectorEnabledAtom, proxyRunningAtom } from "@/entities/app";
import type { Annotation, CapturedElement } from "@/entities/inspector";
import { commands, unwrap } from "@/shared/api";

const INSPECTOR_COPY = {
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
    statusActive: "Horizon Gateway Proxy is active.",
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
} as const;

export type InspectorPanelCopy = (typeof INSPECTOR_COPY)[keyof typeof INSPECTOR_COPY];

export function useInspectorPanel() {
  const lang = useAtomValue(languageAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);
  const [inspectorEnabled, setInspectorEnabled] = useAtom(proxyInspectorEnabledAtom);
  const [injectionDomains, setInjectionDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [captured, setCaptured] = useState<CapturedElement | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const t = useMemo(() => INSPECTOR_COPY[lang as keyof typeof INSPECTOR_COPY] ?? INSPECTOR_COPY.en, [lang]);

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

  const handleToggleInspector = useCallback(
    async (enabled: boolean) => {
      setInspectorEnabled(enabled);
      await commands.setGlobalInspectorEnabled(enabled).then(unwrap);
    },
    [setInspectorEnabled],
  );

  const handleAddDomain = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && newDomain.trim()) {
        const updated = [...injectionDomains, newDomain.trim()];
        setInjectionDomains(updated);
        await commands.setInjectionDomains({ domains: updated }).then(unwrap);
        setNewDomain("");
      }
    },
    [injectionDomains, newDomain],
  );

  const handleRemoveDomain = useCallback(
    async (domain: string) => {
      const updated = injectionDomains.filter((d) => d !== domain);
      setInjectionDomains(updated);
      await commands.setInjectionDomains({ domains: updated }).then(unwrap);
    },
    [injectionDomains],
  );

  const saveAnnotation = useCallback(async () => {
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
  }, [captured, role, description]);

  const dismissCapture = useCallback(() => setCaptured(null), []);

  return {
    t,
    isProxyRunning: !!isProxyRunning,
    inspectorEnabled: !!inspectorEnabled,
    injectionDomains,
    newDomain,
    captured,
    role,
    description,
    lastSavedId,
    onToggleInspector: handleToggleInspector,
    onNewDomainChange: setNewDomain,
    onAddDomain: handleAddDomain,
    onRemoveDomain: handleRemoveDomain,
    onRoleChange: setRole,
    onDescriptionChange: setDescription,
    onSaveAnnotation: saveAnnotation,
    onDismissCapture: dismissCapture,
  };
}

export type InspectorPanelState = ReturnType<typeof useInspectorPanel>;

import { useAtomValue } from "jotai";
import { Camera, FileText, Search } from "lucide-react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { Button } from "@/shared/ui/button/Button";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { Panel } from "./Panel";

interface DomainDebugPanelProps {
  domain: Domain;
  onClose: () => void;
}

export function DomainDebugPanel({ domain, onClose }: DomainDebugPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { getDomainHost } = useDomainHubData();
  const host = getDomainHost(domain);

  const items = [
    {
      icon: <Search className="w-4 h-4" />,
      label: t.debugInspector,
      desc: t.debugInspectorDesc,
      action: () => void openDetachedWindow("/proxy/inspector", t.debugInspector, 1100, 760),
    },
    {
      icon: <Camera className="w-4 h-4" />,
      label: t.debugLiveCapture,
      desc: t.debugLiveCaptureDesc,
      action: () =>
        void openDetachedWindow(
          `/ux/live-capture?url=${encodeURIComponent(domain.url)}`,
          `${host} — Live Capture`,
          1280,
          860,
        ),
    },
    {
      icon: <FileText className="w-4 h-4" />,
      label: t.debugPolicies,
      desc: t.debugPoliciesDesc,
      action: () => void openDetachedWindow("/ux/policies", t.debugPolicies, 1100, 760),
    },
  ];

  return (
    <Panel id="debug" title={t.debugTitle} subtitle={host} onClose={onClose} width="md">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="p-3 rounded-xl border border-base-300 bg-base-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50 shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black">{item.label}</p>
                <p className="text-[10px] text-base-content/50 mt-0.5">{item.desc}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full mt-3 text-xs" onClick={item.action}>
              {t.debugOpen}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

import { Check, Copy } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { JsonTreeView } from "@/shared/ui/json-tree-view";
import { SegmentedTabs, type TabItem } from "@/shared/ui/tabs";
import { formatHttpBody } from "../lib/formatHttpBody";

export interface ApiHttpMessageViewerLabels {
  body: string;
  headers: string;
  empty?: string;
}

export interface ApiHttpMessageViewerTab {
  id: string;
  label: string;
  panel: ReactNode;
}

export interface ApiHttpMessageViewerProps {
  title: string;
  headers: Record<string, string>;
  body: unknown;
  labels: ApiHttpMessageViewerLabels;
  metaBar?: ReactNode;
  actions?: ReactNode;
  additionalTabs?: ApiHttpMessageViewerTab[];
  heightClass?: string;
  bodyPanelHeightClass?: string;
  bodyTextClassName?: string;
  defaultTab?: string;
  enableCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
}

export function ApiHttpMessageViewer({
  title,
  headers,
  body,
  labels,
  metaBar,
  actions,
  additionalTabs = [],
  heightClass = "",
  bodyPanelHeightClass = "min-h-[280px] max-h-[50vh]",
  bodyTextClassName = "text-base-content/90",
  defaultTab = "body",
  enableCopy = false,
  copyLabel = "Copy",
  copiedLabel = "Copied!",
}: ApiHttpMessageViewerProps) {
  const tabIds = useMemo(() => ["body", "headers", ...additionalTabs.map((tab) => tab.id)], [additionalTabs]);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [copied, setCopied] = useState(false);

  const resolvedTab = tabIds.includes(activeTab) ? activeTab : "body";
  const formattedBody = useMemo(() => formatHttpBody(body), [body]);
  const headerCount = Object.keys(headers).length;

  const tabItems = useMemo<TabItem[]>(
    () => [
      { id: "body", label: labels.body },
      { id: "headers", label: labels.headers, badge: headerCount > 0 ? headerCount : undefined },
      ...additionalTabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
      })),
    ],
    [labels.body, labels.headers, headerCount, additionalTabs],
  );

  const handleCopyTab = async () => {
    let text = "";
    if (resolvedTab === "body") {
      text = formattedBody;
    } else if (resolvedTab === "headers") {
      text =
        headerCount > 0
          ? Object.entries(headers)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n")
          : "";
    }
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  return (
    <section className={`flex flex-col space-y-2 min-w-0 ${heightClass}`}>
      <div className="flex items-start justify-between gap-3 shrink-0">
        <h2 className="text-sm font-semibold text-base-content">{title}</h2>
        <div className="flex items-center gap-2 shrink-0">
          {enableCopy && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => void handleCopyTab()}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? copiedLabel : copyLabel}
            </Button>
          )}
          {actions}
        </div>
      </div>

      <Card className="p-0 flex flex-col min-w-0 flex-1 min-h-0 overflow-hidden">
        {metaBar}

        <div className="px-4 pt-2.5 pb-0.5 shrink-0">
          <SegmentedTabs value={resolvedTab} onChange={setActiveTab} items={tabItems} size="sm" />
        </div>

        <div
          className={`flex-1 p-3 font-mono text-xs [scrollbar-gutter:stable] overflow-y-auto overflow-x-auto ${bodyPanelHeightClass}`}
        >
          {resolvedTab === "body" && (
            <JsonTreeView
              data={body}
              rawString={formattedBody}
              emptyLabel={labels.empty || "(Empty Body)"}
              copyAllLabel={copyLabel}
              copiedAllLabel={copiedLabel}
              className={bodyTextClassName}
            />
          )}

          {resolvedTab === "headers" &&
            (headerCount > 0 ? (
              <table className="table table-xs w-full text-base-content/80 font-mono">
                <tbody>
                  {Object.entries(headers).map(([key, value]) => (
                    <tr key={key} className="border-base-300/40">
                      <td className="font-semibold text-primary/80 pr-4 align-top w-[150px]">{key}</td>
                      <td className="break-all">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-base-content/40 italic m-0">{labels.empty || "(Empty)"}</p>
            ))}

          {additionalTabs.map(
            (tab) =>
              resolvedTab === tab.id && (
                <div key={tab.id} className="font-sans">
                  {tab.panel}
                </div>
              ),
          )}
        </div>
      </Card>
    </section>
  );
}

import { type ReactNode, useMemo, useState } from "react";
import { Card } from "@/shared/ui/card/card";
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
}: ApiHttpMessageViewerProps) {
  const tabIds = useMemo(() => ["body", "headers", ...additionalTabs.map((tab) => tab.id)], [additionalTabs]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const resolvedTab = tabIds.includes(activeTab) ? activeTab : "body";
  const formattedBody = useMemo(() => formatHttpBody(body), [body]);
  const headerCount = Object.keys(headers).length;

  return (
    <Card className={`p-5 bg-base-100 border-base-300 shadow-sm flex flex-col min-w-0 ${heightClass}`}>
      <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
        <h3 className="font-semibold text-lg text-base-content/85">{title}</h3>
        {actions}
      </div>

      {metaBar}

      <div className="tabs tabs-lifted mb-2 shrink-0">
        <button
          type="button"
          className={`tab tab-sm font-medium ${resolvedTab === "body" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("body")}
        >
          {labels.body}
        </button>
        <button
          type="button"
          className={`tab tab-sm font-medium ${resolvedTab === "headers" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("headers")}
        >
          {labels.headers} ({headerCount})
        </button>
        {additionalTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab tab-sm font-medium ${resolvedTab === tab.id ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`bg-base-200 border border-base-300 rounded-b-lg p-3 font-mono text-xs [scrollbar-gutter:stable] overflow-y-auto overflow-x-auto ${bodyPanelHeightClass}`}
      >
        {resolvedTab === "body" && (
          <pre className={`m-0 whitespace-pre-wrap break-all leading-relaxed ${bodyTextClassName}`}>
            {formattedBody || labels.empty || "(Empty Body)"}
          </pre>
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
  );
}

import { ApiHttpMessageViewer, type ApiHttpMessageViewerProps } from "./ApiHttpMessageViewer";

export interface ApiRequestViewerProps
  extends Pick<
    ApiHttpMessageViewerProps,
    "headers" | "body" | "metaBar" | "actions" | "heightClass" | "bodyPanelHeightClass"
  > {
  title: string;
  labels: {
    body: string;
    headers: string;
    empty?: string;
  };
  enableCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
}

export function ApiRequestViewer({
  title,
  headers,
  body,
  labels,
  metaBar,
  actions,
  heightClass = "",
  bodyPanelHeightClass = "min-h-[240px] max-h-[40vh]",
  enableCopy,
  copyLabel,
  copiedLabel,
}: ApiRequestViewerProps) {
  return (
    <ApiHttpMessageViewer
      title={title}
      headers={headers}
      body={body}
      labels={labels}
      metaBar={metaBar}
      actions={actions}
      heightClass={heightClass}
      bodyPanelHeightClass={bodyPanelHeightClass}
      bodyTextClassName="text-base-content/85"
      enableCopy={enableCopy}
      copyLabel={copyLabel}
      copiedLabel={copiedLabel}
    />
  );
}

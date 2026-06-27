import { formatHttpBody } from "./formatHttpBody";

export interface ApiExchangeCopyInput {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null | undefined;
  response: {
    statusCode: number;
    headers: Record<string, string> | null | undefined;
    body: unknown;
    elapsedMs: number | null | undefined;
  };
}

function getMethodBgColor(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") {
    return "#0078d4";
  }
  if (m === "POST") {
    return "#107c41";
  }
  if (m === "PUT" || m === "PATCH") {
    return "#d83b01";
  }
  if (m === "DELETE") {
    return "#a80000";
  }
  return "#605e5c";
}

function getStatusColor(status: number | null | undefined): string {
  if (!status) {
    return "#605e5c";
  }
  if (status >= 500) {
    return "#a80000";
  }
  if (status >= 400) {
    return "#d83b01";
  }
  if (status >= 300) {
    return "#0078d4";
  }
  return "#107c41";
}

function formatHeadersPlain(headers: Record<string, string> | null | undefined): string {
  if (!headers || Object.keys(headers).length === 0) {
    return "No headers";
  }
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function formatHeadersHtml(headers: Record<string, string>): string {
  if (Object.keys(headers).length === 0) {
    return '<div style="font-size: 11px; color: #a19f9d; font-style: italic;">No headers</div>';
  }
  return Object.entries(headers)
    .map(
      ([key, value]) => `
        <div style="margin-bottom: 4px; font-family: monospace; font-size: 11px;">
          <strong style="color: #605e5c;">${key}:</strong> <span style="color: #323130; word-break: break-all;">${value}</span>
        </div>`,
    )
    .join("");
}

export function buildApiExchangeCardHtml(input: ApiExchangeCopyInput): string {
  const method = input.method.toUpperCase();
  const formattedReqBody = formatHttpBody(input.requestBody);
  const formattedResBody = formatHttpBody(input.response.body);
  const methodColor = getMethodBgColor(method);
  const statusColor = getStatusColor(input.response.statusCode);
  const reqHeadersHtml = formatHeadersHtml(input.requestHeaders);
  const resHeadersHtml = formatHeadersHtml(input.response.headers ?? {});

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #323130; max-width: 800px; border: 1px solid #edebe9; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
  <div style="padding: 12px 16px; background-color: #f3f2f1; border-bottom: 1px solid #edebe9;">
    <span style="display: inline-block; font-weight: bold; background-color: ${methodColor}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: monospace; margin-right: 8px;">${method}</span>
    <strong style="font-family: monospace; font-size: 12px; word-break: break-all;">${input.url}</strong>
  </div>
  
  <div style="padding: 8px 16px; background-color: #faf9f8; border-bottom: 1px solid #edebe9; font-size: 11px; color: #605e5c;">
    <strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; font-family: monospace;">${input.response.statusCode}</span>
    <span style="margin: 0 10px; color: #edebe9;">|</span>
    <strong>Time:</strong> <span style="font-family: monospace;">${input.response.elapsedMs ?? "-"}ms</span>
    <span style="margin: 0 10px; color: #edebe9;">|</span>
    <strong>Time Copied:</strong> <span style="font-family: monospace;">${new Date().toLocaleString()}</span>
  </div>

  <div style="padding: 16px;">
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Request Headers</h4>
    <div style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px;">
      ${reqHeadersHtml}
    </div>

    ${
      formattedReqBody
        ? `
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Request Body</h4>
    <pre style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #323130; margin-top: 0;">${formattedReqBody}</pre>
    `
        : ""
    }

    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Response Headers</h4>
    <div style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px;">
      ${resHeadersHtml}
    </div>

    ${
      formattedResBody
        ? `
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Response Body</h4>
    <pre style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #323130; margin-top: 0;">${formattedResBody}</pre>
    `
        : ""
    }
  </div>
</div>
`;
}

export function buildApiExchangePlainText(input: ApiExchangeCopyInput): string {
  const formattedReqBody = formatHttpBody(input.requestBody);
  const formattedResBody = formatHttpBody(input.response.body);

  return `METHOD: ${input.method.toUpperCase()}
URL: ${input.url}
Status: ${input.response.statusCode}
Time: ${input.response.elapsedMs ?? "-"}ms

[Request Headers]
${formatHeadersPlain(input.requestHeaders)}
${formattedReqBody ? `\n[Request Body]\n${formattedReqBody}\n` : ""}
[Response Headers]
${formatHeadersPlain(input.response.headers)}
${formattedResBody ? `\n[Response Body]\n${formattedResBody}\n` : ""}
`;
}

export function buildApiExchangeMarkdown(input: ApiExchangeCopyInput): string {
  const method = input.method.toUpperCase();
  const formattedReqBody = formatHttpBody(input.requestBody);
  const formattedResBody = formatHttpBody(input.response.body);
  const reqHeadersStr = formatHeadersPlain(input.requestHeaders);
  const resHeadersStr = formatHeadersPlain(input.response.headers);

  return [
    `### **[${method}]** \`${input.url}\``,
    `**Status:** \`${input.response.statusCode}\` | **Time:** \`${input.response.elapsedMs ?? "-"}ms\``,
    "",
    "#### **Request Headers**",
    "```http",
    reqHeadersStr,
    "```",
    ...(formattedReqBody ? ["", "#### **Request Body**", "```json", formattedReqBody, "```"] : []),
    "",
    "#### **Response Headers**",
    "```http",
    resHeadersStr,
    "```",
    ...(formattedResBody ? ["", "#### **Response Body**", "```json", formattedResBody, "```"] : []),
    "",
  ].join("\n");
}

export function buildApiExchangeMarkdownHtml(input: ApiExchangeCopyInput): string {
  const method = input.method.toUpperCase();
  const formattedReqBody = formatHttpBody(input.requestBody);
  const formattedResBody = formatHttpBody(input.response.body);
  const reqHeadersStr = formatHeadersPlain(input.requestHeaders);
  const resHeadersStr = formatHeadersPlain(input.response.headers);
  const methodColor = getMethodBgColor(method);

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #242424; max-width: 800px;">
  <div style="margin-bottom: 8px;">
    <span style="font-weight: bold; font-family: monospace; font-size: 12px; color: ${methodColor};">[${method}]</span> 
    <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 12px;">${input.url}</code>
  </div>
  <div style="font-size: 12px; color: #616161; margin-bottom: 16px;">
    <strong>Status:</strong> <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 11px;">${input.response.statusCode}</code>
    <span style="margin: 0 8px; color: #d2d2d2;">|</span>
    <strong>Time:</strong> <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 11px;">${input.response.elapsedMs ?? "-"}ms</code>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Request Headers</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${reqHeadersStr}</pre>
  </div>

  ${
    formattedReqBody
      ? `
  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Request Body</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${formattedReqBody}</pre>
  </div>
  `
      : ""
  }

  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Response Headers</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${resHeadersStr}</pre>
  </div>

  ${
    formattedResBody
      ? `
  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Response Body</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${formattedResBody}</pre>
  </div>
  `
      : ""
  }
</div>
`;
}

export async function copyRichTextToClipboard(html: string, plain: string): Promise<void> {
  const blobHtml = new Blob([html], { type: "text/html" });
  const blobText = new Blob([plain], { type: "text/plain" });
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": blobHtml,
      "text/plain": blobText,
    }),
  ]);
}

export async function copyApiExchangeAsCardHtml(input: ApiExchangeCopyInput): Promise<void> {
  const html = buildApiExchangeCardHtml(input);
  const plain = buildApiExchangePlainText(input);
  try {
    await copyRichTextToClipboard(html, plain);
  } catch {
    await navigator.clipboard.writeText(plain);
  }
}

export async function copyApiExchangeAsMarkdown(input: ApiExchangeCopyInput): Promise<void> {
  const markdown = buildApiExchangeMarkdown(input);
  const html = buildApiExchangeMarkdownHtml(input);
  try {
    await copyRichTextToClipboard(html, markdown);
  } catch {
    await navigator.clipboard.writeText(markdown);
  }
}

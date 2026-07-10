import type { ApiExchangeCopyInput } from "./copyApiExchange";
import { formatHttpBody } from "./formatHttpBody";

export type ApiExchangeHtmlExportLabels = ApiExchangeCopyInput["labels"] & {
  documentTitle: string;
  exportedAt: string;
  entryCount: (count: number) => string;
  tableOfContents: string;
  copyResponse: string;
  copyRequest: string;
  copyExchange: string;
  copyAllResponses: string;
  copied: string;
  generatedBy: string;
  jumpToEntry: string;
};

export type WtExportMeta = {
  method: string;
  url: string;
  status: number;
  time: string;
};

export type WtExportEntry = {
  method: string;
  url: string;
  status: number;
  time: string;
  reqHeaders: [string, string][];
  resHeaders: [string, string][];
  reqBody: string;
  resBody: string;
};

function toHeaderEntries(headers: Record<string, string> | null | undefined): [string, string][] {
  if (!headers) {
    return [];
  }
  return Object.entries(headers);
}

export function buildExportMeta(inputs: ApiExchangeCopyInput[]): WtExportMeta[] {
  return inputs.map((input) => ({
    method: input.method.toUpperCase(),
    url: input.url,
    status: input.response.statusCode ?? 0,
    time: input.timestamp ? new Date(input.timestamp).toLocaleString() : "",
  }));
}

export function buildExportEntry(input: ApiExchangeCopyInput): WtExportEntry {
  return {
    method: input.method.toUpperCase(),
    url: input.url,
    status: input.response.statusCode ?? 0,
    time: input.timestamp ? new Date(input.timestamp).toLocaleString() : "",
    reqHeaders: toHeaderEntries(input.requestHeaders),
    resHeaders: toHeaderEntries(input.response.headers),
    reqBody: formatHttpBody(input.requestBody),
    resBody: formatHttpBody(input.response.body),
  };
}

/** Safe for embedding inside <script type="application/json"> */
export function encodeJsonForScriptTag(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildEntryDataScriptTag(index: number, entry: WtExportEntry): string {
  return `<script type="application/json" id="wt-e-${index}">${encodeJsonForScriptTag(entry)}</script>\n`;
}

function buildTocItems(meta: WtExportMeta[], jumpLabel: string): string {
  return meta
    .map(
      (entry, index) => `
    <li>
      <a href="#wt-entry-${index}" data-index="${index}" title="${jumpLabel}">
        <span class="wt-toc-method">${entry.method}</span>
        <span class="wt-toc-status">${entry.status || "-"}</span>
        <span class="wt-toc-url"></span>
        ${entry.time ? `<span class="wt-toc-time"></span>` : ""}
      </a>
    </li>`,
    )
    .join("\n");
}

/**
 * HTML head through the data slot marker.
 * Full entry payloads are appended as individual JSON script tags (lazy-parsed).
 */
export function buildApiExchangesHtmlHead(meta: WtExportMeta[], labels: ApiExchangeHtmlExportLabels): string {
  const exportedAt = new Date().toLocaleString();
  const toc = buildTocItems(meta, labels.jumpToEntry);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${labels.documentTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #faf9f8;
      color: #323130;
      line-height: 1.5;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .wt-header {
      flex-shrink: 0;
      z-index: 10;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #edebe9;
      padding: 16px 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }
    .wt-header h1 { margin: 0; font-size: 18px; font-weight: 800; }
    .wt-meta { font-size: 12px; color: #605e5c; }
    .wt-layout {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 24px;
    }
    @media (max-width: 900px) {
      .wt-layout { grid-template-columns: 1fr; }
      .wt-toc { max-height: 180px; }
    }
    .wt-toc {
      background: #fff;
      border: 1px solid #edebe9;
      border-radius: 8px;
      padding: 16px;
      overflow-y: auto;
      min-height: 0;
    }
    .wt-toc h2 { margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #605e5c; }
    .wt-toc ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .wt-toc a {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 6px 8px;
      text-decoration: none;
      color: inherit;
      font-size: 11px;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
    }
    .wt-toc a:hover, .wt-toc a.active { background: #f3f2f1; border-color: #edebe9; }
    .wt-toc-method { font-weight: 800; font-family: monospace; color: #0078d4; }
    .wt-toc-status { font-weight: 700; font-family: monospace; color: #107c41; }
    .wt-toc-url { grid-column: 1 / -1; font-family: monospace; word-break: break-all; color: #323130; }
    .wt-toc-time { grid-column: 1 / -1; color: #a19f9d; font-size: 10px; }
    .wt-list {
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      position: relative;
      border: 1px solid #edebe9;
      border-radius: 8px;
      background: #fff;
    }
    .wt-list-inner { position: relative; width: 100%; }
    .wt-entry {
      position: absolute;
      left: 0;
      right: 0;
      padding: 16px 16px 8px;
      box-sizing: border-box;
    }
    .wt-entry pre {
      max-height: 280px;
      overflow: auto;
      overscroll-behavior: contain;
      background: #faf9f8;
      border: 1px solid #edebe9;
      border-radius: 4px;
      padding: 10px;
      margin: 0 0 16px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      color: #323130;
    }
    .wt-card {
      border: 1px solid #edebe9;
      border-radius: 6px;
      overflow: hidden;
      font-size: 13px;
    }
    .wt-card-head {
      padding: 12px 16px;
      background: #f3f2f1;
      border-bottom: 1px solid #edebe9;
    }
    .wt-method {
      display: inline-block;
      font-weight: 700;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      margin-right: 8px;
    }
    .wt-card-meta {
      padding: 8px 16px;
      background: #faf9f8;
      border-bottom: 1px solid #edebe9;
      font-size: 11px;
      color: #605e5c;
    }
    .wt-card-body { padding: 16px; }
    .wt-sec-title {
      margin: 0 0 6px;
      font-size: 11px;
      text-transform: uppercase;
      color: #605e5c;
      letter-spacing: 0.5px;
    }
    .wt-headers {
      background: #faf9f8;
      border: 1px solid #edebe9;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 16px;
      font-family: monospace;
      font-size: 11px;
    }
    .wt-headers div { margin-bottom: 4px; word-break: break-all; }
    .wt-headers strong { color: #605e5c; }
    .wt-copy-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    .wt-btn {
      border: 1px solid #c8c6c4;
      background: #fff;
      color: #323130;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    .wt-btn:hover { background: #f3f2f1; }
    .wt-btn-primary { background: #0078d4; border-color: #0078d4; color: #fff; }
    .wt-btn-primary:hover { background: #106ebe; }
    .wt-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #107c41;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 100;
    }
    .wt-toast.show { opacity: 1; }
    .wt-footer { flex-shrink: 0; text-align: center; padding: 12px 24px; font-size: 11px; color: #a19f9d; }
    .wt-loading { padding: 24px; color: #605e5c; font-size: 12px; font-weight: 700; }
  </style>
</head>
<body>
  <header class="wt-header">
    <div>
      <h1>${labels.documentTitle}</h1>
      <div class="wt-meta">${labels.exportedAt}: ${exportedAt} · ${labels.entryCount(meta.length)}</div>
    </div>
    <button type="button" class="wt-btn wt-btn-primary" id="wt-copy-all">${labels.copyAllResponses}</button>
  </header>

  <div class="wt-layout">
    <nav class="wt-toc" aria-label="${labels.tableOfContents}">
      <h2>${labels.tableOfContents}</h2>
      <ul id="wt-toc-list">${toc}</ul>
    </nav>
    <div class="wt-list" id="wt-list" aria-label="entries">
      <div class="wt-list-inner" id="wt-list-inner"></div>
    </div>
  </div>

  <div class="wt-toast" id="wt-toast" role="status"></div>
  <footer class="wt-footer">${labels.generatedBy}</footer>

  <script type="application/json" id="wt-meta">${encodeJsonForScriptTag(meta)}</script>
  <!-- ENTRY_DATA_START -->
`;
}

export function buildApiExchangesHtmlTail(labels: ApiExchangeHtmlExportLabels): string {
  const uiLabels = {
    requestHeaders: labels.requestHeaders ?? "Request Headers",
    requestBody: labels.requestBody ?? "Request Body",
    responseHeaders: labels.responseHeaders ?? "Response Headers",
    responseBody: labels.responseBody ?? "Response Body",
    copyResponse: labels.copyResponse,
    copyRequest: labels.copyRequest,
    copyExchange: labels.copyExchange,
    copied: labels.copied,
  };

  return `<!-- ENTRY_DATA_END -->
  <script>
    const WT_LABELS = ${encodeJsonForScriptTag(uiLabels)};
    const WT_META = JSON.parse(document.getElementById("wt-meta").textContent);
    const WT_EST_HEIGHT = 420;
    const WT_OVERSCAN = 1;
    const WT_CACHE_LIMIT = 12;

    const methodColors = { GET: "#0078d4", POST: "#107c41", PUT: "#d83b01", PATCH: "#d83b01", DELETE: "#a80000" };
    function statusColor(status) {
      if (!status) return "#605e5c";
      if (status >= 500) return "#a80000";
      if (status >= 400) return "#d83b01";
      if (status >= 300) return "#0078d4";
      return "#107c41";
    }

    function wtShowToast(message) {
      const el = document.getElementById("wt-toast");
      if (!el) return;
      el.textContent = message;
      el.classList.add("show");
      clearTimeout(window.__wtToastTimer);
      window.__wtToastTimer = setTimeout(function () { el.classList.remove("show"); }, 1600);
    }

    function wtCopyText(text) {
      if (!text) return;
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (document.execCommand("copy")) wtShowToast(WT_LABELS.copied);
      } catch (e) {
        console.error(e);
      }
      document.body.removeChild(textarea);
    }

    function formatHeadersPlain(pairs) {
      if (!pairs || !pairs.length) return "No headers";
      return pairs.map(function (p) { return p[0] + ": " + p[1]; }).join("\\n");
    }

    function buildCopyPayload(entry) {
      return {
        response: entry.resBody || "",
        request: [entry.reqBody || "", "[" + WT_LABELS.requestHeaders + "]\\n" + formatHeadersPlain(entry.reqHeaders)]
          .filter(Boolean).join("\\n"),
        exchange: [
          "METHOD: " + entry.method,
          "URL: " + entry.url,
          "Status: " + entry.status,
          "Time: " + (entry.time || ""),
          "",
          "[" + WT_LABELS.requestHeaders + "]",
          formatHeadersPlain(entry.reqHeaders),
          entry.reqBody ? "\\n[" + WT_LABELS.requestBody + "]\\n" + entry.reqBody + "\\n" : "",
          "[" + WT_LABELS.responseHeaders + "]",
          formatHeadersPlain(entry.resHeaders),
          entry.resBody ? "\\n[" + WT_LABELS.responseBody + "]\\n" + entry.resBody + "\\n" : ""
        ].join("\\n")
      };
    }

    // Lazy parse cache — never JSON.parse all entries at once
    const entryCache = new Map();
    const cacheOrder = [];

    function touchCache(index) {
      const pos = cacheOrder.indexOf(index);
      if (pos >= 0) cacheOrder.splice(pos, 1);
      cacheOrder.push(index);
      while (cacheOrder.length > WT_CACHE_LIMIT) {
        const drop = cacheOrder.shift();
        entryCache.delete(drop);
      }
    }

    function loadEntry(index) {
      if (entryCache.has(index)) {
        touchCache(index);
        return entryCache.get(index);
      }
      const node = document.getElementById("wt-e-" + index);
      if (!node) return null;
      var entry = null;
      try {
        entry = JSON.parse(node.textContent || "null");
      } catch (e) {
        console.error("Failed to parse entry", index, e);
        return null;
      }
      entryCache.set(index, entry);
      touchCache(index);
      return entry;
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null && text !== "") node.textContent = text;
      return node;
    }

    function renderHeaders(container, pairs) {
      const box = el("div", "wt-headers");
      if (!pairs || !pairs.length) {
        const empty = el("div", null, "No headers");
        empty.style.color = "#a19f9d";
        empty.style.fontStyle = "italic";
        box.appendChild(empty);
      } else {
        pairs.forEach(function (pair) {
          const row = el("div");
          row.appendChild(el("strong", null, pair[0] + ": "));
          row.appendChild(document.createTextNode(pair[1]));
          box.appendChild(row);
        });
      }
      container.appendChild(box);
    }

    function renderBodySection(container, title, body) {
      if (!body) return;
      container.appendChild(el("h4", "wt-sec-title", title));
      container.appendChild(el("pre", null, body));
    }

    function renderEntry(index) {
      const section = el("section", "wt-entry");
      section.id = "wt-entry-" + index;
      section.dataset.index = String(index);

      const entry = loadEntry(index);
      if (!entry) {
        section.appendChild(el("div", "wt-loading", "Failed to load entry #" + (index + 1)));
        return section;
      }

      const bar = el("div", "wt-copy-bar");
      const copy = buildCopyPayload(entry);
      function addBtn(label, field, primary) {
        const btn = el("button", primary ? "wt-btn wt-btn-primary" : "wt-btn", label);
        btn.type = "button";
        btn.onclick = function () { wtCopyText(copy[field] || ""); };
        bar.appendChild(btn);
      }
      addBtn(WT_LABELS.copyResponse, "response", true);
      addBtn(WT_LABELS.copyRequest, "request", false);
      addBtn(WT_LABELS.copyExchange, "exchange", false);
      section.appendChild(bar);

      const card = el("div", "wt-card");
      const head = el("div", "wt-card-head");
      const method = el("span", "wt-method", entry.method);
      method.style.backgroundColor = methodColors[entry.method] || "#605e5c";
      head.appendChild(method);
      const url = el("strong");
      url.style.fontFamily = "monospace";
      url.style.fontSize = "12px";
      url.style.wordBreak = "break-all";
      url.textContent = entry.url;
      head.appendChild(url);
      card.appendChild(head);

      const meta = el("div", "wt-card-meta");
      meta.appendChild(el("strong", null, "Status: "));
      const statusVal = el("span", null, String(entry.status || "-"));
      statusVal.style.color = statusColor(entry.status);
      statusVal.style.fontWeight = "700";
      statusVal.style.fontFamily = "monospace";
      meta.appendChild(statusVal);
      if (entry.time) {
        meta.appendChild(document.createTextNode("  |  "));
        meta.appendChild(el("strong", null, "Time: "));
        const time = el("span", null, entry.time);
        time.style.fontFamily = "monospace";
        meta.appendChild(time);
      }
      card.appendChild(meta);

      const body = el("div", "wt-card-body");
      body.appendChild(el("h4", "wt-sec-title", WT_LABELS.requestHeaders));
      renderHeaders(body, entry.reqHeaders);
      renderBodySection(body, WT_LABELS.requestBody, entry.reqBody);
      body.appendChild(el("h4", "wt-sec-title", WT_LABELS.responseHeaders));
      renderHeaders(body, entry.resHeaders);
      renderBodySection(body, WT_LABELS.responseBody, entry.resBody);
      card.appendChild(body);
      section.appendChild(card);
      return section;
    }

    const listEl = document.getElementById("wt-list");
    const innerEl = document.getElementById("wt-list-inner");
    const heights = WT_META.map(function () { return WT_EST_HEIGHT; });
    const mounted = new Map();

    function totalHeight() {
      var sum = 0;
      for (var i = 0; i < heights.length; i++) sum += heights[i];
      return sum;
    }
    function offsetAt(index) {
      var sum = 0;
      for (var i = 0; i < index; i++) sum += heights[i];
      return sum;
    }
    function findIndexAtOffset(offset) {
      var sum = 0;
      for (var i = 0; i < heights.length; i++) {
        sum += heights[i];
        if (sum > offset) return i;
      }
      return Math.max(0, heights.length - 1);
    }
    function measure(index, node) {
      var h = node.offsetHeight;
      if (h > 0 && Math.abs(h - heights[index]) > 1) {
        heights[index] = h;
        return true;
      }
      return false;
    }

    function renderVirtual() {
      if (!listEl || !innerEl) return;
      var scrollTop = listEl.scrollTop;
      var viewport = listEl.clientHeight || 600;
      var start = Math.max(0, findIndexAtOffset(scrollTop) - WT_OVERSCAN);
      var end = Math.min(WT_META.length - 1, findIndexAtOffset(scrollTop + viewport) + WT_OVERSCAN);

      innerEl.style.height = totalHeight() + "px";

      var keep = new Set();
      for (var i = start; i <= end; i++) keep.add(i);
      mounted.forEach(function (node, index) {
        if (!keep.has(index)) {
          node.remove();
          mounted.delete(index);
        }
      });

      var changed = false;
      for (var j = start; j <= end; j++) {
        var node = mounted.get(j);
        if (!node) {
          node = renderEntry(j);
          innerEl.appendChild(node);
          mounted.set(j, node);
        }
        node.style.top = offsetAt(j) + "px";
        if (measure(j, node)) changed = true;
      }
      if (changed) {
        innerEl.style.height = totalHeight() + "px";
        mounted.forEach(function (node, index) {
          node.style.top = offsetAt(index) + "px";
        });
      }
    }

    function wtScrollTo(index) {
      if (!listEl || index < 0 || index >= WT_META.length) return;
      listEl.scrollTop = offsetAt(index);
      renderVirtual();
      document.querySelectorAll("#wt-toc-list a").forEach(function (a) {
        a.classList.toggle("active", Number(a.getAttribute("data-index")) === index);
      });
    }

    function wtCopyAllResponses() {
      var parts = [];
      for (var i = 0; i < WT_META.length; i++) {
        var entry = loadEntry(i);
        if (entry && entry.resBody) parts.push(entry.resBody);
      }
      wtCopyText(parts.join("\\n\\n---\\n\\n"));
    }

    document.querySelectorAll("#wt-toc-list a").forEach(function (a) {
      var index = Number(a.getAttribute("data-index"));
      var meta = WT_META[index];
      if (!meta) return;
      var urlEl = a.querySelector(".wt-toc-url");
      if (urlEl) urlEl.textContent = meta.url;
      var timeEl = a.querySelector(".wt-toc-time");
      if (timeEl && meta.time) timeEl.textContent = meta.time;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        wtScrollTo(index);
      });
    });

    document.getElementById("wt-copy-all").addEventListener("click", wtCopyAllResponses);
    listEl.addEventListener("scroll", function () {
      window.requestAnimationFrame(renderVirtual);
    }, { passive: true });
    window.addEventListener("resize", function () {
      window.requestAnimationFrame(renderVirtual);
    });

    renderVirtual();
  </script>
</body>
</html>
`;
}

/** In-memory build (small exports / browser fallback). Prefer streaming write for large sets. */
export function buildApiExchangesHtmlDocument(
  inputs: ApiExchangeCopyInput[],
  labels: ApiExchangeHtmlExportLabels,
): string {
  const meta = buildExportMeta(inputs);
  let html = buildApiExchangesHtmlHead(meta, labels);
  for (let i = 0; i < inputs.length; i++) {
    html += buildEntryDataScriptTag(i, buildExportEntry(inputs[i]));
  }
  html += buildApiExchangesHtmlTail(labels);
  return html;
}

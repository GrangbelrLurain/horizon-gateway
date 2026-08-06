import { useEffect, useMemo, useState } from "react";
import { parsePartialJson } from "../lib/json";

export function JsonViewer({ src }: { src: string }) {
  const [parsed, setParsed] = useState<unknown | null>(null);
  const [isError, setIsError] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const res = parsePartialJson(src);
    if (res.data !== null) {
      setParsed(res.data);
      setIsTruncated(res.truncated);
      setIsError(false);
    } else {
      setIsError(true);
      setIsTruncated(res.truncated);
    }
  }, [src]);

  const formattedRawJson = useMemo(() => {
    if (parsed !== null) {
      try {
        return JSON.stringify(parsed, null, 2);
      } catch (_e) {
        return src;
      }
    }
    return src;
  }, [parsed, src]);

  if (isError || parsed === null) {
    return (
      <pre
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#38bdf8",
          fontSize: "11px",
          fontFamily: "monospace",
          overflowY: "auto",
          maxHeight: "340px",
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          userSelect: "text",
        }}
      >
        {src}
      </pre>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>
          💡 ▼/▶ 클릭하여 접기 · 마우스 드래그로 원하는 텍스트 부분 복사 가능
          {isTruncated && <span style={{ color: "#f59e0b", marginLeft: "6px" }}>(⚠️ 데이터 일부 생략됨)</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(formattedRawJson);
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 1500);
          }}
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "none",
            color: copiedAll ? "#10b981" : "#38bdf8",
            fontSize: "10px",
            padding: "2px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "700",
          }}
        >
          {copiedAll ? "✓ 전체 복사됨!" : "📋 전체 JSON 복사"}
        </button>
      </div>

      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          overflowY: "auto",
          maxHeight: "340px",
          fontFamily: "monospace",
          fontSize: "11px",
          lineHeight: "1.6",
          color: "#f3f4f6",
          userSelect: "text",
        }}
      >
        <TreeJsonNode value={parsed} isLast={true} depth={0} />
      </div>
    </div>
  );
}

function TreeJsonNode({
  keyName,
  value,
  isLast = true,
  depth = 0,
}: {
  keyName?: string;
  value: unknown;
  isLast?: boolean;
  depth?: number;
}) {
  const [folded, setFolded] = useState(depth >= 2);
  const [copiedNode, setCopiedNode] = useState(false);
  const comma = isLast ? "" : ",";
  const indentStr = "  ".repeat(depth);

  const renderKey =
    keyName !== undefined ? <span style={{ color: "#38bdf8", fontWeight: "600" }}>"{keyName}": </span> : null;

  const handleCopyThisNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      navigator.clipboard.writeText(textToCopy);
      setCopiedNode(true);
      setTimeout(() => setCopiedNode(false), 1200);
    } catch (_e) {}
  };

  if (value === null) {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#ef4444", fontWeight: "700" }}>null</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "boolean") {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#f59e0b", fontWeight: "700" }}>{value ? "true" : "false"}</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#f59e0b" }}>{value}</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "string") {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#a3e635" }}>"{value}"</span>
        {comma}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as object);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  if (entries.length === 0) {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#94a3b8" }}>
          {openBracket}
          {closeBracket}
        </span>
        {comma}
      </div>
    );
  }

  return (
    <div style={{ display: "block", userSelect: "text" }}>
      {/* Object Header Line */}
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        <button
          type="button"
          onClick={() => setFolded(!folded)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            userSelect: "none",
            color: "#cbd5e1",
            fontWeight: "700",
            fontSize: "10px",
            marginRight: "4px",
            width: "12px",
            display: "inline-block",
            textAlign: "center",
          }}
        >
          {folded ? "▶" : "▼"}
        </button>
        {renderKey}
        <span style={{ color: "#cbd5e1", fontWeight: "700" }}>{openBracket}</span>

        {/* Node Level Copy Button */}
        <button
          type="button"
          onClick={handleCopyThisNode}
          style={{
            background: "none",
            border: "none",
            padding: "0 4px",
            fontSize: "9px",
            color: copiedNode ? "#10b981" : "rgba(255,255,255,0.4)",
            cursor: "pointer",
            fontWeight: "600",
            marginLeft: "4px",
            userSelect: "none",
          }}
          title="이 노드 데이터 복사"
        >
          {copiedNode ? "✓ 복사됨" : "📋"}
        </button>

        {folded && (
          <span
            onClick={() => setFolded(false)}
            style={{
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
              marginLeft: "4px",
              userSelect: "text",
            }}
          >
            ... {closeBracket}
            {comma}
          </span>
        )}
      </div>

      {/* Children lines with distinct vertical guide line */}
      {!folded && (
        <div
          style={{
            paddingLeft: "16px",
            borderLeft: "1px dashed rgba(255, 255, 255, 0.15)",
            marginLeft: "5px",
            marginTop: "1px",
            marginBottom: "1px",
            display: "block",
            userSelect: "text",
          }}
        >
          {entries.map(([k, v], idx) => (
            <TreeJsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={v}
              isLast={idx === entries.length - 1}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {!folded && (
        <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
          <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
          <span style={{ color: "#cbd5e1", fontWeight: "700" }}>{closeBracket}</span>
          {comma}
        </div>
      )}
    </div>
  );
}

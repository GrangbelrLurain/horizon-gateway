export function HeadersViewer({ headers }: { headers?: Record<string, string> }) {
  if (!headers || Object.keys(headers).length === 0) {
    return (
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>헤더 정보가 없습니다.</div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)",
        overflowY: "auto",
        maxHeight: "220px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontFamily: "monospace",
        fontSize: "11px",
      }}
    >
      {Object.entries(headers).map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: "8px", wordBreak: "break-all" }}>
          <span style={{ color: "#38bdf8", fontWeight: "700", minWidth: "120px", flexShrink: 0 }}>{k}:</span>
          <span style={{ color: "rgba(255,255,255,0.85)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

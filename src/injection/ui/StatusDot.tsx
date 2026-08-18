export function StatusDot({ active, color, label }: { active: boolean; color: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        opacity: active ? 1 : 0.3,
        transition: "opacity 0.2s ease-in-out",
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: active ? `0 0 8px ${color}` : "none",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "9px", fontWeight: "800", color: "var(--wt-text-main)", letterSpacing: "0.2px" }}>
        {label}
      </span>
    </div>
  );
}

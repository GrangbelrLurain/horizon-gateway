import type { InjectionAppState } from "../hooks/useInjectionAppState";

type State = Pick<
  InjectionAppState,
  | "editingElement"
  | "setEditingElement"
  | "role"
  | "setRole"
  | "description"
  | "setDescription"
  | "isSaving"
  | "saveAnnotation"
>;

export function NewPolicyModal({ s }: { s: State }) {
  const editingElement = s.editingElement!;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          backgroundColor: "#1e293b",
          width: "400px",
          padding: "24px",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>New Policy</h3>
          <button
            type="button"
            onClick={() => s.setEditingElement(null)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: "20px",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "12px",
            borderRadius: "12px",
            fontSize: "10px",
            color: "rgba(255,255,255,0.5)",
            overflow: "hidden",
          }}
        >
          Selector: <code style={{ color: "#3b82f6", wordBreak: "break-all" }}>{editingElement.selector}</code>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="wt-s.role-input"
            style={{
              fontSize: "10px",
              fontWeight: "800",
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
            }}
          >
            Role / Title
          </label>
          <input
            id="wt-s.role-input"
            value={s.role}
            onChange={(e) => s.setRole(e.target.value)}
            placeholder="e.g. Primary Login Button"
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "10px",
              color: "white",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="wt-desc-input"
            style={{
              fontSize: "10px",
              fontWeight: "800",
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
            }}
          >
            Requirements
          </label>
          <textarea
            id="wt-desc-input"
            value={s.description}
            onChange={(e) => s.setDescription(e.target.value)}
            placeholder="Describe behavior..."
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "10px",
              color: "white",
              outline: "none",
              minHeight: "80px",
              resize: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={s.saveAnnotation}
          disabled={!s.role || s.isSaving}
          style={{
            backgroundColor: s.isSaving ? "#475569" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "12px",
            padding: "14px",
            fontWeight: "800",
            cursor: "pointer",
          }}
        >
          {s.isSaving ? "Saving..." : "Save Policy"}
        </button>
      </div>
    </div>
  );
}

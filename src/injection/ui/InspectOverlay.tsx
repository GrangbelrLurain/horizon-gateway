export function InspectOverlay({ hoveredElement }: { hoveredElement: HTMLElement }) {
  return (
    <div
      style={{
        position: "fixed",
        zIndex: 2147483646,
        border: "2px solid #3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        pointerEvents: "none",
        top: hoveredElement.getBoundingClientRect().top,
        left: hoveredElement.getBoundingClientRect().left,
        width: hoveredElement.getBoundingClientRect().width,
        height: hoveredElement.getBoundingClientRect().height,
        transition: "all 0.05s ease-out",
        borderRadius: "4px",
      }}
    />
  );
}

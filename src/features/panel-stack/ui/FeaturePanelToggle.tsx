import { Loader2 } from "lucide-react";

interface FeaturePanelToggleProps {
  label: string;
  checked: boolean;
  loading?: boolean;
  onChange: (enabled: boolean) => void;
}

export function FeaturePanelToggle({ label, checked, loading, onChange }: FeaturePanelToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200/40 border border-base-300 mb-4">
      <span className="text-xs font-bold text-base-content">{label}</span>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <input
          type="checkbox"
          className="toggle toggle-success toggle-sm"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}
    </div>
  );
}

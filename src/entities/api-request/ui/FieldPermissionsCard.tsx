import { Card } from "@/shared/ui/card/card";
import type { ApiRequestFieldConfig, FieldControl } from "../types";

export const FIELD_PERMISSION_KEYS: (keyof ApiRequestFieldConfig)[] = [
  "origin",
  "pathname",
  "params",
  "body",
  "headers",
];

export interface FieldPermissionsCardProps {
  title: string;
  labels: Record<keyof ApiRequestFieldConfig, string>;
  config: ApiRequestFieldConfig;
  onConfigChange: (field: keyof ApiRequestFieldConfig, control: Partial<FieldControl>) => void;
}

export function FieldPermissionsCard({ title, labels, config, onConfigChange }: FieldPermissionsCardProps) {
  return (
    <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl">
      <h3 className="text-[10px] font-black text-base-content/40 mb-3 uppercase tracking-widest">{title}</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {FIELD_PERMISSION_KEYS.map((field) => (
          <label key={field} className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-primary checkbox-xs"
              checked={config[field].editable ?? true}
              onChange={(event) => onConfigChange(field, { editable: event.target.checked })}
            />
            <span className="font-medium text-base-content/70">{labels[field]}</span>
          </label>
        ))}
      </div>
    </Card>
  );
}

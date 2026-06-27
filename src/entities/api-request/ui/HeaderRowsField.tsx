import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/shared/ui/button/Button";
import { filterSuggestions, valuesForFieldKey } from "../suggestions";
import type { FieldControl, HeaderRow } from "../types";
import { AutocompleteField } from "./AutocompleteField";

export interface HeaderRowsFieldProps {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  headerKeys: string[];
  headerValues: Record<string, string[]>;
  control?: FieldControl;
  labels: {
    addHeader: string;
    key: string;
    value: string;
  };
}

export function HeaderRowsField({ rows, onChange, headerKeys, headerValues, control, labels }: HeaderRowsFieldProps) {
  const visible = control?.visible ?? true;
  const editable = control?.editable ?? true;

  const keySuggestions = useMemo(() => filterSuggestions(headerKeys, ""), [headerKeys]);

  if (!visible) {
    return null;
  }

  const updateRow = (index: number, field: "key" | "value", value: string) => {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, idx) => idx !== index);
    onChange(next.length > 0 ? next : [{ key: "", value: "" }]);
  };

  const addRow = () => {
    onChange([...rows, { key: "", value: "" }]);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const valueSuggestions = filterSuggestions(valuesForFieldKey(headerValues, row.key), row.value);
        return (
          <div key={`${index}-${row.key}`} className="flex gap-2 items-center">
            <AutocompleteField
              value={row.key}
              onChange={(value) => updateRow(index, "key", value)}
              suggestions={keySuggestions}
              control={{ visible: true, editable }}
              placeholder={labels.key}
              className="flex-1 h-8 text-xs font-mono"
              containerClassName="relative flex-1 min-w-0"
            />
            <AutocompleteField
              value={row.value}
              onChange={(value) => updateRow(index, "value", value)}
              suggestions={valueSuggestions}
              control={{ visible: true, editable }}
              placeholder={labels.value}
              className="flex-1 h-8 text-xs font-mono"
              containerClassName="relative flex-1 min-w-0"
            />
            {editable && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-error"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      })}
      {editable && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 h-8" onClick={addRow}>
          <Plus className="w-3.5 h-3.5" />
          {labels.addHeader}
        </Button>
      )}
    </div>
  );
}

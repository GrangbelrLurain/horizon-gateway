import { useMemo } from "react";
import { SearchableInput } from "@/shared/ui/searchable-input";
import { filterSuggestions } from "../suggestions";
import type { FieldControl } from "../types";

export interface AutocompleteFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  control?: FieldControl;
  containerClassName?: string;
}

export function AutocompleteField({
  value,
  onChange,
  suggestions,
  control,
  containerClassName = "relative flex-1 min-w-0",
  disabled,
  ...inputProps
}: AutocompleteFieldProps) {
  const visible = control?.visible ?? true;
  const editable = control?.editable ?? true;

  const filtered = useMemo(() => filterSuggestions(suggestions, value), [suggestions, value]);

  if (!visible) {
    return null;
  }

  if (!editable) {
    return (
      <div className={containerClassName}>
        <div
          className={`input input-bordered input-sm w-full h-9 flex items-center text-xs font-mono bg-base-200/40 text-base-content/70 cursor-default select-text ${inputProps.className ?? ""}`}
          title={value}
        >
          <span className="truncate">{value || "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <SearchableInput value={value} onChange={onChange} suggestions={filtered} onSelect={onChange}>
        <SearchableInput.Input {...inputProps} disabled={disabled ?? !editable} readOnly={!editable} />
        {editable && <SearchableInput.Dropdown />}
      </SearchableInput>
    </div>
  );
}

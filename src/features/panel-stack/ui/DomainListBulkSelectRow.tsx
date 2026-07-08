import clsx from "clsx";
import { Globe } from "lucide-react";

interface DomainListBulkSelectRowProps {
  displayUrl: string;
  checked: boolean;
  onCheck: (checked: boolean) => void;
}

export function DomainListBulkSelectRow({ displayUrl, checked, onCheck }: DomainListBulkSelectRowProps) {
  return (
    <label
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors",
        checked ? "bg-primary/10 border-primary/25" : "border-transparent hover:bg-base-200",
      )}
    >
      <input
        type="checkbox"
        className="checkbox checkbox-xs checkbox-primary shrink-0"
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
      />
      <Globe className={clsx("w-3.5 h-3.5 shrink-0", checked ? "text-primary" : "text-base-content/30")} />
      <span className="text-xs font-bold truncate min-w-0 flex-1" title={displayUrl}>
        {displayUrl}
      </span>
    </label>
  );
}

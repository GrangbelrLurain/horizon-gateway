import { ExternalLink, FolderPlus, Globe, Pencil, Trash2 } from "lucide-react";
import type { Domain } from "@/entities/domain";
import type { DomainGroup } from "@/entities/domain-group";
import { Badge } from "@/shared/ui/badge/badge";
import { Card } from "@/shared/ui/card/card";

export interface GroupCardTranslations {
  noDomains: string;
  domainCount: (count: number) => string;
  moreCount: (count: number) => string;
}

export interface GroupCardProps {
  group: DomainGroup;
  domainPreview: Domain[];
  restCount: number;
  onOpenAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
  translations: GroupCardTranslations;
}

export function GroupCard({
  group,
  domainPreview,
  restCount,
  onOpenAssign,
  onEdit,
  onDelete,
  translations,
}: GroupCardProps) {
  const totalCount = domainPreview.length + restCount;

  return (
    <Card className="p-6 flex flex-col min-h-[220px] h-full border-base-300 hover:border-primary/40 transition-all group relative overflow-hidden bg-base-100 shadow-sm hover:shadow-xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />

      <div className="flex justify-between items-start relative z-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl transition-transform group-hover:scale-110">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="font-black text-base-content tracking-tight text-lg">{group.name}</h3>
          </div>
          <span className="text-[10px] text-base-content/30 font-black uppercase tracking-widest ml-11">
            # {group.id.toString().padStart(3, "0")}
          </span>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
          <button
            type="button"
            onClick={onEdit}
            className="p-2 text-base-content/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-base-content/40 hover:text-error hover:bg-error/10 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-6 pt-5 border-t border-base-300/50 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenAssign}
            className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl transition-all active:scale-95"
          >
            <Badge
              variant={{ color: "blue" }}
              className="cursor-pointer hover:bg-primary/20 transition-colors font-black uppercase tracking-tighter"
            >
              {translations.domainCount(totalCount)}
            </Badge>
          </button>
          <div className="text-[9px] font-black text-base-content/20 uppercase tracking-[0.2em]">
            REF-{group.id.toString().padStart(4, "0")}
          </div>
        </div>
        {totalCount > 0 ? (
          <ul className="space-y-2 mt-1">
            {domainPreview.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 group/link">
                <Globe className="w-3.5 h-3.5 text-base-content/20 shrink-0 group-hover/link:text-primary transition-colors" />
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-base-content/60 hover:text-primary truncate flex-1 font-medium tracking-tight"
                >
                  {d.url}
                </a>
                <ExternalLink className="w-3 h-3 text-base-content/10 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </li>
            ))}
            {restCount > 0 && (
              <li className="text-[10px] text-base-content/30 font-black uppercase tracking-widest pl-6 pt-1 border-base-300">
                + {translations.moreCount(restCount)}
              </li>
            )}
          </ul>
        ) : (
          <button
            type="button"
            onClick={onOpenAssign}
            className="text-left text-xs text-base-content/40 mt-1 hover:text-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary rounded-lg p-2 bg-base-200/50 border border-transparent hover:border-primary/20 font-bold italic"
          >
            {translations.noDomains}
          </button>
        )}
      </div>
    </Card>
  );
}

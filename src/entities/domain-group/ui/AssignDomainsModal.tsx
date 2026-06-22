import { Link } from "@tanstack/react-router";
import { Check, Globe, Loader2Icon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Domain } from "@/entities/domain";
import type { DomainGroup } from "@/entities/domain-group";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";

export interface AssignDomainsModalTranslations {
  title: (groupName: string) => string;
  desc: string;
  noDomainsText: string;
  addLink: string;
  first: string;
  stats: (total: number, selected: number) => string;
  selectAll: string;
  deselectAll: string;
  cancel: string;
  save: string;
  searchPlaceholder: string;
  filterAll: string;
  filterUnassigned: string;
  otherGroups: string;
  alreadyInGroup: string;
  noDomainsFound: string;
}

export interface DomainWithGroupMeta extends Domain {
  otherGroupNames: string[];
  isUnassigned: boolean;
}

export interface AssignDomainsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: DomainGroup | null;
  domains: DomainWithGroupMeta[];
  selectedIds: Set<number>;
  isSaving: boolean;
  onToggle: (domainId: number) => void;
  onSelectAll: (visibleIds: number[]) => void;
  onDeselectAll: (visibleIds: number[]) => void;
  onSave: () => void;
  translations: AssignDomainsModalTranslations;
}

export function AssignDomainsModal({
  isOpen,
  onClose,
  group,
  domains,
  selectedIds,
  isSaving,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onSave,
  translations,
}: AssignDomainsModalProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unassigned">("all");

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      const matchesSearch = d.url.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filterType === "all" || d.isUnassigned;
      return matchesSearch && matchesFilter;
    });
  }, [domains, search, filterType]);

  const visibleIds = useMemo(() => filteredDomains.map((d) => d.id), [filteredDomains]);
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header title={group ? translations.title(group.name) : ""} description={translations.desc} />
      <Modal.Body className="max-h-[500px] no-scrollbar flex flex-col gap-4">
        {domains.length === 0 ? (
          <p className="text-sm text-base-content/40 py-8 text-center font-medium italic">
            {translations.noDomainsText}{" "}
            <Link to="/domains/regist" className="text-primary hover:underline font-bold">
              {translations.addLink}
            </Link>{" "}
            {translations.first}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
                <Input
                  placeholder={translations.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 bg-base-200 border-none focus:bg-base-100"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    filterType === "all"
                      ? "bg-primary text-primary-content border-primary shadow-lg shadow-primary/20"
                      : "bg-base-200 text-base-content/40 border-transparent hover:bg-base-300"
                  }`}
                >
                  {translations.filterAll}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("unassigned")}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    filterType === "unassigned"
                      ? "bg-primary text-primary-content border-primary shadow-lg shadow-primary/20"
                      : "bg-base-200 text-base-content/40 border-transparent hover:bg-base-300"
                  }`}
                >
                  {translations.filterUnassigned}
                </button>
              </div>
            </div>

            <div className="flex gap-2 bg-base-200/50 p-2 rounded-2xl border border-base-300/50 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSelectAll(visibleIds)}
                className="text-[10px] font-black uppercase tracking-tighter h-8 px-4"
              >
                {translations.selectAll}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onDeselectAll(visibleIds)}
                className="text-[10px] font-black uppercase tracking-tighter h-8 px-4"
              >
                {translations.deselectAll}
              </Button>
              <div className="flex-1" />
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 self-center mr-2">
                {translations.stats(filteredDomains.length, selectedIds.size)}
              </span>
            </div>

            <ul className="space-y-2 overflow-y-auto pr-1">
              {filteredDomains.length === 0 ? (
                <li className="py-12 text-center opacity-30">
                  <Globe className="w-10 h-10 mx-auto mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest">{translations.noDomainsFound}</p>
                </li>
              ) : (
                filteredDomains.map((d) => {
                  const checked = selectedIds.has(d.id);
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => onToggle(d.id)}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all text-left group ${
                          checked
                            ? "bg-primary/5 border-primary/30"
                            : "bg-base-100 border-base-300 hover:bg-base-200 shadow-sm"
                        }`}
                      >
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-lg border transition-all shrink-0 ${
                            checked
                              ? "bg-primary border-primary text-primary-content"
                              : "bg-base-200 border-base-300 group-hover:border-primary/30"
                          }`}
                        >
                          {checked ? <Check className="w-4 h-4" /> : null}
                        </span>
                        <Globe
                          className={`w-5 h-5 shrink-0 transition-colors ${checked ? "text-primary" : "text-base-content/20"}`}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span
                            className={`text-sm font-mono truncate tracking-tight ${checked ? "text-base-content font-bold" : "text-base-content/60"}`}
                          >
                            {d.url}
                          </span>
                          {d.otherGroupNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {d.otherGroupNames.map((gn) => (
                                <span
                                  key={gn}
                                  className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-base-200 text-base-content/40"
                                >
                                  {gn}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} className="font-bold tracking-tight">
          {translations.cancel}
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={isSaving}
          className="font-black uppercase tracking-widest text-xs px-8 shadow-lg shadow-primary/20"
        >
          {isSaving ? <Loader2Icon className="w-4 h-4 animate-spin" /> : translations.save}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

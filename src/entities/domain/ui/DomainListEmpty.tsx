import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";

export interface DomainListEmptyTranslations {
  searchTitle: string;
  searchDesc: string;
  noDomainsTitle: string;
  noDomainsDesc: string;
  addDomainBtn: string;
}

export interface DomainListEmptyProps {
  searchQuery: string;
  translations: DomainListEmptyTranslations;
}

export function DomainListEmpty({ searchQuery, translations }: DomainListEmptyProps) {
  return (
    <div className="flex flex-col gap-6 justify-center items-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 transition-all">
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
        <Globe className="w-10 h-10 text-slate-200" />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-slate-800 text-lg">
          {searchQuery ? translations.searchTitle : translations.noDomainsTitle}
        </h3>
        <p className="text-slate-400 text-sm max-w-[250px] mx-auto mt-1">
          {searchQuery ? translations.searchDesc : translations.noDomainsDesc}
        </p>
      </div>
      {!searchQuery && (
        <Link to="/domains/regist">
          <Button variant="primary" className="shadow-lg shadow-blue-500/10">
            {translations.addDomainBtn}
          </Button>
        </Link>
      )}
    </div>
  );
}

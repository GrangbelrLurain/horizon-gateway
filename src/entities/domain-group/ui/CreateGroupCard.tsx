import { Loader2Icon, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";

export interface CreateGroupCardTranslations {
  title: string;
  placeholder: string;
  btn: string;
}

export interface CreateGroupCardProps {
  value: string;
  onChange: (value: string) => void;
  onCreate: () => void;
  isCreating: boolean;
  translations: CreateGroupCardTranslations;
}

export function CreateGroupCard({ value, onChange, onCreate, isCreating, translations }: CreateGroupCardProps) {
  return (
    <Card className="p-6 border-dashed border-2 bg-base-200/50 border-base-300 flex flex-col justify-between h-[200px] hover:bg-base-200 transition-all shadow-sm">
      <div>
        <h3 className="text-[11px] font-black text-base-content/40 mb-3 uppercase tracking-widest flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          {translations.title}
        </h3>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={translations.placeholder}
          className="w-full rounded-xl bg-base-100 border-base-300 focus:border-primary/50 font-bold tracking-tight"
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
      </div>
      <Button
        onClick={onCreate}
        disabled={isCreating || !value.trim()}
        variant="primary"
        className="w-full font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
      >
        {isCreating ? <Loader2Icon className="w-4 h-4 animate-spin" /> : translations.btn}
      </Button>
    </Card>
  );
}

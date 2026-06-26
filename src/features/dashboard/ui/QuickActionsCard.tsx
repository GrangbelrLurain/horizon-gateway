import { Link } from "@tanstack/react-router";
import { Card } from "@/shared/ui/card/card";
import type { QuickAction } from "../types";

interface QuickActionsCardProps {
  actions: QuickAction[];
  title: string;
}

export function QuickActionsCard({ actions, title }: QuickActionsCardProps) {
  return (
    <Card className="p-6 bg-base-100 shadow-sm border-base-200">
      <h2 className="font-black text-base-content mb-6 tracking-tight uppercase text-xs opacity-40">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {actions.map((action) => (
          <Link key={action.href} to={action.href}>
            <div className="flex flex-col gap-4 p-5 rounded-2xl border border-base-200 hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer h-full shadow-sm hover:shadow-md">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 ${action.color}`}
              >
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-base-content group-hover:text-primary transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-base-content/40 leading-relaxed mt-1 font-medium italic">
                  {action.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

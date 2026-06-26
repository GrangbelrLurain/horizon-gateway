import { Link } from "@tanstack/react-router";
import { Card } from "@/shared/ui/card/card";
import type { QuickStat } from "../types";

interface QuickStatsRowProps {
  stats: QuickStat[];
}

export function QuickStatsRow({ stats }: QuickStatsRowProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {stats.map((stat) => (
        <Link key={stat.href} to={stat.href}>
          <Card className="p-5 bg-base-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group cursor-pointer overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-center gap-4 relative z-10">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${stat.bg}`}
              >
                <div className={stat.color}>{stat.icon}</div>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-base-content leading-none tracking-tight">{stat.value}</p>
                <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider mt-1.5 truncate">
                  {stat.label}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

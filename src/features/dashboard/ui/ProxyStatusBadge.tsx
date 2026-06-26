import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { Server } from "lucide-react";

interface ProxyStatusBadgeProps {
  lang: "ko" | "en";
  proxyActive: boolean;
}

export function ProxyStatusBadge({ lang, proxyActive }: ProxyStatusBadgeProps) {
  return (
    <Link to="/proxy/dashboard">
      <div
        className={clsx(
          "flex items-center gap-3 px-4 py-2 rounded-full text-[10px] sm:text-xs font-black transition-all border shadow-lg shadow-black/5 cursor-pointer active:scale-95 h-10 select-none shrink-0",
          proxyActive
            ? "bg-success/10 text-success border-success/30 hover:bg-success/20 hover:border-success/40"
            : "bg-base-300 text-base-content/40 border-base-content/5 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 hover:bg-base-300/80 hover:border-base-300",
        )}
      >
        <Server
          className={clsx("w-3.5 h-3.5 transition-colors", proxyActive ? "text-success" : "text-base-content/20")}
        />
        <span className="uppercase tracking-widest whitespace-nowrap">
          {proxyActive
            ? lang === "ko"
              ? "프록시 활성"
              : "Proxy Active"
            : lang === "ko"
              ? "프록시 비활성"
              : "Proxy Inactive"}
        </span>
        <div
          className={clsx(
            "w-2 h-2 rounded-full",
            proxyActive ? "bg-success animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-base-content/20",
          )}
        />
      </div>
    </Link>
  );
}

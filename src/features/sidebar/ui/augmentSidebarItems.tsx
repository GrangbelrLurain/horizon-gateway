import clsx from "clsx";
import type { SidebarBadgeContext, SidebarItem } from "../types";

function SidebarBadge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "green" | "amber";
}) {
  return (
    <span
      className={clsx(
        "text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none",
        variant === "green" && "bg-green-500/20 text-green-400",
        variant === "amber" && "bg-amber-500/20 text-amber-400",
        variant === "default" && "bg-slate-700 text-slate-400",
      )}
    >
      {children}
    </span>
  );
}

function ProxyDot({ active, colorClass = "bg-green-500" }: { active: boolean | null; colorClass?: string }) {
  if (active === null) {
    return null;
  }
  return (
    <div
      className={clsx("w-1.5 h-1.5 rounded-full shrink-0", active ? `${colorClass} animate-pulse` : "bg-slate-600")}
    />
  );
}

export function augmentSidebarItems(items: SidebarItem[], pathname: string, ctx: SidebarBadgeContext): SidebarItem[] {
  return items.map((item) => {
    const isParentActive = pathname === item.href || item.children?.some((child) => pathname === child.href);

    if (item.href === "/domains/dashboard" && ctx.domainCount !== null) {
      return { ...item, badge: <SidebarBadge>{ctx.domainCount}</SidebarBadge> };
    }
    if (item.href === "/proxy/dashboard") {
      return {
        ...item,
        badge: !isParentActive ? <ProxyDot active={ctx.proxyActive} /> : undefined,
        children: item.children?.map((child) =>
          child.href === "/proxy/dashboard" ? { ...child, badge: <ProxyDot active={ctx.proxyActive} /> } : child,
        ),
      };
    }
    if (item.href === "/apis/dashboard") {
      return {
        ...item,
        badge: !isParentActive ? <ProxyDot active={ctx.mockingEnabled && ctx.proxyRunning} /> : undefined,
        children: item.children?.map((child) =>
          child.href === "/apis/mocking"
            ? { ...child, badge: <ProxyDot active={ctx.mockingEnabled && ctx.proxyRunning} /> }
            : child,
        ),
      };
    }
    if (item.href === "/ux/policies") {
      return {
        ...item,
        badge: !isParentActive ? <ProxyDot active={!!ctx.inspectorEnabled && !!ctx.proxyRunning} /> : undefined,
        children: item.children?.map((child) =>
          child.href === "/proxy/inspector"
            ? { ...child, badge: <ProxyDot active={!!ctx.inspectorEnabled && !!ctx.proxyRunning} /> }
            : child,
        ),
      };
    }
    return item;
  });
}

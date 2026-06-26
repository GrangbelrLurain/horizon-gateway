import { Link, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { ChevronRight, Settings, X } from "lucide-react";
import {
  domainCountAtom,
  getInitials,
  mobileSidebarOpenAtom,
  proxyActiveAtom,
  proxyInspectorEnabledAtom,
  proxyMockingEnabledAtom,
  proxyRunningAtom,
  userProfileAtom,
} from "@/entities/app";

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  children?: SidebarItem[];
  badge?: React.ReactNode;
}

interface SidebarProps {
  items: SidebarItem[];
}

/** Small badge pill for sidebar items */
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

/** Proxy active indicator dot */
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

export function Sidebar({ items }: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useAtomValue(userProfileAtom);
  const initials = getInitials(profile.name || "User");
  const domainCount = useAtomValue(domainCountAtom);
  const proxyActive = useAtomValue(proxyActiveAtom);
  const proxyRunning = useAtomValue(proxyRunningAtom);
  const mockingEnabled = useAtomValue(proxyMockingEnabledAtom);
  const inspectorEnabled = useAtomValue(proxyInspectorEnabledAtom);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useAtom(mobileSidebarOpenAtom);

  // Augment items with live badges
  const augmentedItems = items.map((item) => {
    const isParentActive = pathname === item.href || item.children?.some((child) => pathname === child.href);

    // Domains parent badge: show count
    if (item.href === "/domains/dashboard" && domainCount !== null) {
      return { ...item, badge: <SidebarBadge>{domainCount}</SidebarBadge> };
    }
    // Proxy parent badge: show active status dot
    if (item.href === "/proxy/dashboard") {
      return {
        ...item,
        badge: !isParentActive ? <ProxyDot active={proxyActive} /> : undefined,
        children: item.children?.map((child) =>
          child.href === "/proxy/dashboard" ? { ...child, badge: <ProxyDot active={proxyActive} /> } : child,
        ),
      };
    }
    // APIs parent badge: show dot if mocking is active
    if (item.href === "/apis/dashboard") {
      return {
        ...item,
        badge: !isParentActive ? <ProxyDot active={mockingEnabled && proxyRunning} /> : undefined,
        children: item.children?.map((child) =>
          child.href === "/apis/mocking"
            ? { ...child, badge: <ProxyDot active={mockingEnabled && proxyRunning} /> }
            : child,
        ),
      };
    }
    // UX Policies parent badge: show dot if inspector is active
    if (item.href === "/ux/policies") {
      return {
        ...item,
        badge: !isParentActive ? <ProxyDot active={!!inspectorEnabled && !!proxyRunning} /> : undefined,
        children: item.children?.map((child) =>
          child.href === "/proxy/inspector"
            ? { ...child, badge: <ProxyDot active={!!inspectorEnabled && !!proxyRunning} /> }
            : child,
        ),
      };
    }
    return item;
  });

  return (
    <>
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 tablet:hidden animate-in fade-in duration-300"
          onClick={() => setMobileSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setMobileSidebarOpen(false);
            }
          }}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={clsx(
          "flex flex-col gap-1 p-4 w-72 bg-slate-950 text-slate-300 border-r border-slate-800 shadow-2xl z-110 h-full shrink-0 transition-transform duration-300 ease-in-out",
          "fixed inset-y-0 left-0 tablet:relative tablet:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between tablet:hidden px-2 mb-4">
          <div className="flex items-center gap-2">
            <img src="/app-icon.svg" alt="" className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Watchtower</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 hidden tablet:block" />

        <nav className="flex flex-col gap-1 space-y-1 overflow-y-auto overflow-x-hidden flex-1 px-1">
          {augmentedItems.map((item) => {
            const isParentActive = pathname === item.href || item.children?.some((child) => pathname === child.href);

            return (
              <div key={item.href} className="flex flex-col">
                <Link
                  to={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={clsx(
                    "group flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 outline-none",
                    isParentActive
                      ? "bg-primary/15 text-primary font-black shadow-[0_0_15px_rgba(var(--p),0.1)]"
                      : "hover:bg-slate-900 hover:text-white",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={clsx(
                        "transition-transform duration-200 group-hover:scale-110",
                        isParentActive ? "text-primary" : "text-slate-500",
                      )}
                    >
                      {item.icon}
                    </div>
                    <span className="text-sm tracking-wide">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.badge}
                    {item.children && (
                      <ChevronRight
                        className={clsx(
                          "w-3.5 h-3.5 transition-transform duration-200",
                          isParentActive ? "rotate-90 text-primary" : "text-slate-600",
                        )}
                      />
                    )}
                  </div>
                </Link>

                {item.children && isParentActive && (
                  <div className="flex flex-col mt-1 ml-4 pl-4 border-l border-slate-800 space-y-1 animate-in slide-in-from-left-2 duration-300">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setMobileSidebarOpen(false)}
                          className={clsx(
                            "flex items-center justify-between gap-3 px-4 py-2 rounded-lg text-sm transition-all duration-200",
                            isActive
                              ? "text-white font-medium bg-slate-900"
                              : "text-slate-500 hover:text-slate-200 hover:translate-x-1",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                "w-1 h-1 rounded-full shrink-0",
                                isActive ? "bg-primary" : "bg-slate-700",
                              )}
                            />
                            {child.label}
                          </div>
                          {child.badge && <div className="shrink-0">{child.badge}</div>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto p-4 bg-slate-900/50 rounded-xl border border-slate-800/50 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/profile"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center gap-3 min-w-0 group/profile flex-1 outline-none"
            >
              <div
                className={clsx(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md group-hover/profile:scale-105 transition-transform",
                  profile.avatarColor,
                )}
              >
                {initials}
              </div>
              <div className="flex flex-col min-w-0 gap-1">
                <span className="text-sm font-bold text-white leading-none truncate group-hover/profile:text-primary transition-colors">
                  {profile.name || "Watchtower"}
                </span>
                <span className="text-[10px] font-medium text-slate-400 truncate">{profile.role || "User"}</span>
              </div>
            </Link>

            <Link
              to="/settings"
              onClick={() => setMobileSidebarOpen(false)}
              className={clsx(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all outline-none",
                pathname === "/settings"
                  ? "bg-primary/20 text-primary"
                  : "text-slate-500 hover:bg-slate-800 hover:text-white",
              )}
              title="Settings"
            >
              <Settings className="w-4 h-4 transition-transform duration-300 hover:rotate-90" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

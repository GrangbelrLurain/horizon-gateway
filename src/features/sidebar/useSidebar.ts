import { useRouterState } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
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
import type { SidebarBadgeContext, SidebarProfile } from "./types";

export function useSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useAtomValue(userProfileAtom);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useAtom(mobileSidebarOpenAtom);
  const domainCount = useAtomValue(domainCountAtom);
  const proxyActive = useAtomValue(proxyActiveAtom);
  const proxyRunning = useAtomValue(proxyRunningAtom);
  const mockingEnabled = useAtomValue(proxyMockingEnabledAtom);
  const inspectorEnabled = useAtomValue(proxyInspectorEnabledAtom);

  const badgeContext: SidebarBadgeContext = {
    domainCount,
    proxyActive,
    proxyRunning,
    mockingEnabled,
    inspectorEnabled,
  };

  const sidebarProfile: SidebarProfile = {
    name: profile.name || "Watchtower",
    role: profile.role || "User",
    avatarColor: profile.avatarColor,
  };

  return {
    pathname,
    profile: sidebarProfile,
    initials: getInitials(profile.name || "User"),
    mobileSidebarOpen,
    setMobileSidebarOpen,
    badgeContext,
  };
}

export type SidebarState = ReturnType<typeof useSidebar>;

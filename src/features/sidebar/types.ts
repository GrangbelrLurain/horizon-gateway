export interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  children?: SidebarItem[];
  badge?: React.ReactNode;
}

export interface SidebarBadgeContext {
  domainCount: number | null;
  proxyActive: boolean | null;
  proxyRunning: boolean | null;
  mockingEnabled: boolean | null;
  inspectorEnabled: boolean | null;
}

export interface SidebarProfile {
  name: string;
  role: string;
  avatarColor: string;
}

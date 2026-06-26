import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import {
  ActivityIcon,
  Camera,
  FileTextIcon,
  FlaskConical,
  GlobeIcon,
  History,
  HomeIcon,
  LayoutGrid,
  PlusIcon,
  ServerIcon,
  SettingsIcon,
  Smartphone,
  WifiIcon,
} from "lucide-react";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  languageAtom,
  proxyInspectorEnabledAtom,
  Titlebar,
  themeAtom,
  useAppBootstrap,
  userProfileAtom,
} from "@/entities/app";
import { CreateMockModal } from "@/entities/mocking";
import { Sidebar, useSidebar } from "@/features/sidebar";
import { UpdateBanner, useUpdateCheck } from "@/features/update";
import { UserProfileSetup } from "@/features/user-profile";
import { commands, unwrap } from "@/shared/api";
import { useIsDetached } from "@/shared/lib/tauri/useIsDetached";
import { createMockModalAtom } from "@/shared/store/modals";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { PromiseModal } from "@/shared/ui/modal/PromiseModal";
import { en } from "./root.en";
import { ko } from "./root.ko";

const RootLayout = () => {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;

  const [, setCreateMockModal] = useAtom(createMockModalAtom);

  // Global Message Listener (for Browser Injection & Cross-page actions)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WT_ACTION_CREATE_MOCK") {
        setCreateMockModal({
          isOpen: true,
          logData: event.data.payload.logData,
          onSuccess: event.data.payload.onSuccess,
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setCreateMockModal]);

  useAppBootstrap();

  const [inspectorEnabled, setInspectorEnabled] = useAtom(proxyInspectorEnabledAtom);

  const theme = useAtomValue(themeAtom);
  const userProfile = useAtomValue(userProfileAtom);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Handle dynamic primary color injection based on avatarColor
  useEffect(() => {
    const color = userProfile.avatarColor;

    // Gradient classes to solid Hex mapping
    const colorMap: Record<string, string> = {
      "bg-gradient-to-br from-indigo-500 to-purple-600": "#6366f1",
      "bg-gradient-to-br from-blue-500 to-cyan-400": "#3b82f6",
      "bg-gradient-to-br from-emerald-400 to-teal-600": "#34d399",
      "bg-gradient-to-br from-amber-400 to-orange-500": "#fbbf24",
      "bg-gradient-to-br from-rose-400 to-red-500": "#f43f5e",
      "bg-gradient-to-br from-fuchsia-500 to-pink-500": "#d946ef",
      "bg-slate-800": "#1e293b",
    };

    const targetHex = colorMap[color];

    if (targetHex) {
      // Find or create style tag
      let styleTag = document.getElementById("dynamic-theme");
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "dynamic-theme";
        document.head.appendChild(styleTag);
      }

      // Inject CSS variables for primary color and its content (text)
      // --p: primary color, --pc: primary content (text color on primary)
      styleTag.innerHTML = `
        :root {
          --p: ${targetHex} !important;
          --pc: #ffffff !important;
          --color-primary: ${targetHex} !important;
        }
      `;
    } else {
      const styleTag = document.getElementById("dynamic-theme");
      if (styleTag) {
        styleTag.remove();
      }
    }
  }, [userProfile.avatarColor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "i") {
        const newState = !inspectorEnabled;
        setInspectorEnabled(newState);
        commands.setGlobalInspectorEnabled(newState).then(unwrap);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectorEnabled, setInspectorEnabled]);

  const sidebarItems: ComponentProps<typeof Sidebar>["items"] = useMemo(
    () => [
      {
        label: t.home,
        icon: <HomeIcon className="w-4 h-4" />,
        href: "/",
      },
      {
        label: t.domains,
        icon: <GlobeIcon className="w-4 h-4" />,
        href: "/domains/dashboard",
        children: [
          {
            label: t.dashboard,
            icon: <LayoutGrid className="w-4 h-4" />,
            href: "/domains/dashboard",
          },
          {
            label: t.regist,
            icon: <PlusIcon className="w-4 h-4" />,
            href: "/domains/regist",
          },
          {
            label: t.groups,
            icon: <LayoutGrid className="w-4 h-4" />,
            href: "/domains/groups",
          },
        ],
      },
      {
        label: t.monitor,
        icon: <ActivityIcon className="w-4 h-4" />,
        href: "/monitor",
        children: [
          {
            label: t.dashboard,
            icon: <ActivityIcon className="w-4 h-4" />,
            href: "/monitor",
          },
          {
            label: t.logs,
            icon: <History className="w-4 h-4" />,
            href: "/monitor/logs",
          },
          {
            label: t.settings,
            icon: <SettingsIcon className="w-4 h-4" />,
            href: "/monitor/settings",
          },
        ],
      },
      {
        label: t.proxy,
        icon: <ServerIcon className="w-4 h-4" />,
        href: "/proxy/dashboard",
        children: [
          {
            label: t.dashboard,
            icon: <LayoutGrid className="w-4 h-4" />,
            href: "/proxy/dashboard",
          },
          {
            label: t.setup,
            icon: <SettingsIcon className="w-4 h-4" />,
            href: "/proxy/setup",
          },
          {
            label: t.mobileConnect,
            icon: <Smartphone className="w-4 h-4" />,
            href: "/proxy/mobile",
          },
        ],
      },
      {
        label: t.policy_group,
        icon: <FileTextIcon className="w-4 h-4" />,
        href: "/ux/policies",
        children: [
          {
            label: t.policy_list,
            icon: <FileTextIcon className="w-4 h-4" />,
            href: "/ux/policies",
          },
          {
            label: t.inspector,
            icon: <PlusIcon className="w-4 h-4" />,
            href: "/proxy/inspector",
          },
          {
            label: t.live_capture,
            icon: <Camera className="w-4 h-4" />,
            href: "/ux/live-capture",
          },
        ],
      },
      {
        label: t.apis,
        icon: <WifiIcon className="w-4 h-4" />,
        href: "/apis/dashboard",
        children: [
          {
            label: t.dashboard,
            icon: <WifiIcon className="w-4 h-4" />,
            href: "/apis/dashboard",
          },
          {
            label: t.settings,
            icon: <SettingsIcon className="w-4 h-4" />,
            href: "/apis/settings",
          },
          {
            label: t.mocking,
            icon: <FlaskConical className="w-4 h-4" />,
            href: "/apis/mocking",
          },
          {
            label: t.schema,
            icon: <FileTextIcon className="w-4 h-4" />,
            href: "/apis/schema",
          },
          {
            label: t.logs,
            icon: <History className="w-4 h-4" />,
            href: "/apis/logs",
          },
        ],
      },
      {
        label: t.server_logs,
        icon: <History className="w-4 h-4" />,
        href: "/server-logs",
      },
    ],
    [t],
  );
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });
  const { update } = useUpdateCheck({ onMount: true, delayMs: 3000 });
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const showUpdateBanner = update && !dismissedUpdate;

  const isDetached = useIsDetached();
  const sidebar = useSidebar();

  return (
    <div className="flex flex-col bg-base-200 h-screen w-full font-sans text-base-content selection:bg-primary/20 selection:text-primary overflow-hidden transition-colors duration-300">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Global Loading Overlay */}
        <AnimatePresence>{isLoading && <LoadingScreen key="global-loader" />}</AnimatePresence>

        {!isDetached && (
          <Sidebar
            items={sidebarItems}
            pathname={sidebar.pathname}
            profile={sidebar.profile}
            initials={sidebar.initials}
            mobileSidebarOpen={sidebar.mobileSidebarOpen}
            onMobileSidebarOpenChange={sidebar.setMobileSidebarOpen}
            badgeContext={sidebar.badgeContext}
          />
        )}
        <UserProfileSetup />

        <main
          className={clsx("flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]", isDetached && "p-0")}
        >
          <div
            className={clsx(
              "mx-auto",
              !isDetached ? "max-w-(--breakpoint-2xl) p-4 tablet:p-8 lg:p-10" : "w-full h-full p-4",
            )}
          >
            {showUpdateBanner && !isDetached && update && (
              <div className="mb-4">
                <UpdateBanner update={update} onDismiss={() => setDismissedUpdate(true)} />
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      <CreateMockModal />
      <PromiseModal />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </div>
  );
};

export const Route = createRootRoute({ component: RootLayout });

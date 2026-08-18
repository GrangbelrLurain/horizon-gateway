import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  activeCustomThemeAtom,
  applyThemeToDocument,
  backendUnavailableAtom,
  languageAtom,
  TelemetryProvider,
  Titlebar,
  useAppBootstrap,
  userProfileAtom,
} from "@/entities/app";
import { CreateMockModal } from "@/entities/mocking";
import { CommandPalette, commandPaletteOpenAtom } from "@/features/command-palette";
import { useHubHandoffSync } from "@/features/panel-stack";
import { DetachedWindowLayout, PopupWindowLayout } from "@/features/popup-window";
import { UpdateBanner, UpdateChangelogModal, UpdateToolbarBadge, useUpdateCheck } from "@/features/update";
import { UserProfileSetup } from "@/features/user-profile";
import { useShortcut } from "@/shared/lib/keyboard";
import { useIsDetachedWindow, useIsPopupWindow } from "@/shared/lib/tauri/useEmbedMode";
import { useIsDetached } from "@/shared/lib/tauri/useIsDetached";
import { createMockModalAtom } from "@/shared/store/modals";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { PromiseModal } from "@/shared/ui/modal/PromiseModal";
import { ToastHost } from "@/shared/ui/toast";

const RootLayout = () => {
  const [, setCreateMockModal] = useAtom(createMockModalAtom);

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
  useHubHandoffSync();

  const activeTheme = useAtomValue(activeCustomThemeAtom);
  const lang = useAtomValue(languageAtom);
  const userProfile = useAtomValue(userProfileAtom);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPopupWindow = useIsPopupWindow();
  const isDetachedWindow = useIsDetachedWindow();
  const isDetached = useIsDetached();
  const isHubPage = pathname === "/";

  useEffect(() => {
    if (activeTheme) {
      applyThemeToDocument(activeTheme);
    }
  }, [activeTheme]);

  useEffect(() => {
    const color = userProfile?.avatarColor;
    if (!color) {
      const styleTag = document.getElementById("dynamic-theme");
      if (styleTag) {
        styleTag.remove();
      }
      return;
    }
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
      let styleTag = document.getElementById("dynamic-theme");
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "dynamic-theme";
        document.head.appendChild(styleTag);
      }
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
  }, [userProfile?.avatarColor]);

  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [isPending]);

  const { update } = useUpdateCheck({ onMount: true, delayMs: 3000 });
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const showUpdateBanner = update && !dismissedUpdate;
  const backendUnavailable = useAtomValue(backendUnavailableAtom);

  const content = (
    <main
      className={clsx(
        "flex-1 overflow-hidden",
        isDetached && !isPopupWindow && !isDetachedWindow && "p-0",
        !isDetached &&
          !isHubPage &&
          !isPopupWindow &&
          !isDetachedWindow &&
          "overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
      )}
    >
      <div
        className={clsx(
          "h-full",
          !isDetached &&
            !isHubPage &&
            !isPopupWindow &&
            !isDetachedWindow &&
            "mx-auto max-w-(--breakpoint-2xl) p-5 tablet:p-8 lg:p-10 overflow-y-auto",
          (isHubPage || isPopupWindow || isDetachedWindow) && "h-full min-h-0",
        )}
      >
        {backendUnavailable && !isDetached && !isPopupWindow && !isDetachedWindow && (
          <div className="mb-4 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
            백엔드(serve)에 연결할 수 없습니다. 프록시·라우팅 기능이 동작하지 않을 수 있습니다.
            <span className="mt-1 block text-xs opacity-80">{backendUnavailable}</span>
          </div>
        )}
        {showUpdateBanner && !isDetached && !isHubPage && !isPopupWindow && !isDetachedWindow && update && (
          <div className="mb-4">
            <UpdateBanner update={update} onDismiss={() => setDismissedUpdate(true)} />
          </div>
        )}
        <Outlet />
      </div>
    </main>
  );

  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom);

  useShortcut({
    id: "open-command-palette",
    key: "p",
    ctrl: true,
    group: "palette",
    description: { ko: "명령어 팔레트 열기", en: "Open Command Palette" },
    handler: (e) => {
      e.preventDefault();
      setCommandPaletteOpen((prev) => !prev);
    },
  });

  const globalOverlays = (
    <>
      <CreateMockModal />
      <PromiseModal />
      <UserProfileSetup />
      <UpdateChangelogModal />
      <ToastHost lang={lang} />
      <TelemetryProvider />
      <CommandPalette />
    </>
  );

  if (isPopupWindow) {
    return (
      <ErrorBoundary fallbackTitle="Popup window error">
        <div className="h-screen w-full overflow-hidden bg-base-200 text-base-content font-sans transition-colors duration-300">
          <PopupWindowLayout>
            <AnimatePresence>{isLoading && <LoadingScreen key="global-loader" />}</AnimatePresence>
            {content}
          </PopupWindowLayout>
          {globalOverlays}
          {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
        </div>
      </ErrorBoundary>
    );
  }

  if (isDetachedWindow && pathname === "/") {
    return (
      <ErrorBoundary fallbackTitle="Detached window error">
        <div className="flex flex-col h-screen w-full overflow-hidden bg-base-200 text-base-content font-sans transition-colors duration-300">
          <AnimatePresence>{isLoading && <LoadingScreen key="global-loader" />}</AnimatePresence>
          {content}
          {globalOverlays}
          {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
        </div>
      </ErrorBoundary>
    );
  }

  if (isDetachedWindow) {
    return (
      <ErrorBoundary fallbackTitle="Detached window error">
        <div className="h-screen w-full overflow-hidden bg-base-200 text-base-content font-sans transition-colors duration-300">
          <DetachedWindowLayout>
            <AnimatePresence>{isLoading && <LoadingScreen key="global-loader" />}</AnimatePresence>
            {content}
          </DetachedWindowLayout>
          {globalOverlays}
          {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Horizon Gateway error">
      <div className="flex flex-col bg-base-200 h-screen w-full font-sans text-base-content selection:bg-primary/20 selection:text-primary overflow-hidden transition-colors duration-300">
        {!isHubPage && <Titlebar trailing={<UpdateToolbarBadge />} />}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence>{isLoading && <LoadingScreen key="global-loader" />}</AnimatePresence>
          {content}
        </div>

        {globalOverlays}
        {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
      </div>
    </ErrorBoundary>
  );
};

export const Route = createRootRoute({ component: RootLayout });

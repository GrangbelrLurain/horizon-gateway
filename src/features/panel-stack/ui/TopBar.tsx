import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { Gift, LogIn, Server, Settings, User } from "lucide-react";
import { useState } from "react";
import {
  getInitials,
  languageAtom,
  proxyRunningAtom,
  supabaseProfileAtom,
  supabaseSessionAtom,
  WindowControls,
} from "@/entities/app";
import { updateChangelogModalOpenAtom } from "@/features/update";
import { commands } from "@/shared/api";
import { supabase } from "@/shared/api/supabase";
import { Button } from "@/shared/ui/button/Button";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import type { HubSurfaceId } from "../types";
import { ToolsMenu } from "./ToolsMenu";

const appWindow = getCurrentWindow();

interface TopBarProps {
  onOpenInfrastructure: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenGlobalTool: (id: HubSurfaceId) => void;
}

export function TopBar({ onOpenInfrastructure, onOpenProfile, onOpenSettings, onOpenGlobalTool }: TopBarProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const proxyRunning = useAtomValue(proxyRunningAtom);

  const session = useAtomValue(supabaseSessionAtom);
  const profile = useAtomValue(supabaseProfileAtom);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const setChangelogOpen = useSetAtom(updateChangelogModalOpenAtom);

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: "horizon-gateway://auth-callback",
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        alert("Supabase OAuth Init Error: " + error.message);
        return;
      }
      if (data?.url) {
        await commands.openExternalUrl(data.url);
      } else {
        alert("OAuth URL generation failed: URL was empty.");
      }
    } catch (err: any) {
      alert("handleLogin Exception: " + err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex items-center h-10 border-b border-slate-800/50 bg-slate-950 shrink-0 select-none">
      <div className="flex items-center gap-3 px-3 min-w-0 shrink-0">
        <img
          src="/logo-text.svg"
          alt="Horizon Gateway"
          className="h-4 w-auto object-contain shrink-0 pointer-events-none"
        />
        <button
          type="button"
          data-tauri-drag-region={false}
          onClick={onOpenInfrastructure}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors",
            proxyRunning
              ? "bg-success/10 text-success border border-success/20"
              : "bg-slate-800 text-slate-400 border border-slate-700",
          )}
        >
          <Server className="w-3 h-3" />
          {proxyRunning ? t.proxyRunning : t.proxyStopped}
        </button>
      </div>

      <div
        data-tauri-drag-region
        onDoubleClick={() => appWindow.toggleMaximize()}
        className="flex-1 h-full min-w-[48px] cursor-default"
      />

      <div className="flex items-center gap-0.5 px-2 shrink-0">
        <ToolsMenu onOpenTool={onOpenGlobalTool} />
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setSettingsMenuOpen((v) => !v)}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.settings}</span>
          </Button>

          {settingsMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setSettingsMenuOpen(false)}
              />
              <div className="absolute right-0 top-9 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    onOpenInfrastructure();
                    setSettingsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Server className="w-3.5 h-3.5 text-primary" />
                  {t.infrastructure}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    setSettingsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  {t.settings}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChangelogOpen(true);
                    setSettingsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800/40"
                >
                  <Gift className="w-3.5 h-3.5 text-primary" />
                  {lang === "ko" ? "업데이트 내역" : "Changelog"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setProfileMenuOpen((v) => !v)}
          >
            {session ? (
              <div
                className={clsx(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-slate-700 text-white overflow-hidden border border-slate-650",
                  profile?.is_sponsor && "sponsor-glow",
                )}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(profile?.display_name || profile?.email || "U")}</span>
                )}
              </div>
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{session ? profile?.display_name || t.profile : t.profile}</span>
          </Button>

          {profileMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setProfileMenuOpen(false)}
              />
              <div className="absolute right-0 top-9 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {!session ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleLogin();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5 text-primary" />
                      {lang === "ko" ? "로그인" : "Login"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfile();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer border-t border-slate-800/40"
                    >
                      {lang === "ko" ? "프로필 설정" : "Profile Settings"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfile();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                      {lang === "ko" ? "프로필 설정" : "Profile Settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleLogout();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[10px] font-semibold text-red-400 hover:bg-slate-800 transition-colors cursor-pointer border-t border-slate-800/40"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <WindowControls />
    </div>
  );
}

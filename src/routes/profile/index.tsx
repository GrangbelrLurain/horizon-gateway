import { createFileRoute, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Heart, Lock, RefreshCw, Send, ShieldAlert, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  experimentalAiAutocompleteAtom,
  experimentalCustomThemeAtom,
  getInitials,
  installIdAtom,
  languageAtom,
  regenerateInstallId,
  supabaseProfileAtom,
  supabaseSessionAtom,
  telemetryEnabledAtom,
  userProfileAtom,
} from "@/entities/app";
import { commands } from "@/shared/api";
import { supabase } from "@/shared/api/supabase";
import { APP_VERSION, getOsLabel } from "@/shared/lib/appMeta";
import { useIsHubSurfaceEmbed } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useIsEmbeddedPage } from "@/shared/lib/tauri/useEmbedMode";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { toastError, toastSuccess } from "@/shared/ui/toast";
import { en } from "./en";
import { ko } from "./ko";

type FeedbackCategory = "bug" | "feature" | "question";

export const Route = createFileRoute("/profile/")({
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useAtom(userProfileAtom);
  const [lang, setLang] = useAtom(languageAtom);
  const t = lang === "ko" ? ko : en;
  const isEmbedded = useIsEmbeddedPage();
  const isHubEmbed = useIsHubSurfaceEmbed();
  const hideChrome = isEmbedded || isHubEmbed;

  const session = useAtomValue(supabaseSessionAtom);
  const [supaProfile, setSupaProfile] = useAtom(supabaseProfileAtom);
  const [aiAutocomplete, setAiAutocomplete] = useAtom(experimentalAiAutocompleteAtom);
  const [customTheme, setCustomTheme] = useAtom(experimentalCustomThemeAtom);

  const [feedback, setFeedback] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [telemetryEnabled, setTelemetryEnabled] = useAtom(telemetryEnabledAtom);
  const installId = useAtomValue(installIdAtom);

  const handleRegenerateInstallId = () => {
    regenerateInstallId();
    toastSuccess(t.telemetryRegenerated);
  };

  const handleSendFeedback = async () => {
    if (!feedback.trim()) {
      return;
    }
    setFeedbackSending(true);
    const { error } = await supabase.from("feedbacks").insert({
      profile_id: session?.user?.id || null,
      content: feedback.trim(),
      category: feedbackCategory,
      app_version: APP_VERSION,
      os: getOsLabel(),
      context: pathname || "profile",
      install_id: installId,
    });
    setFeedbackSending(false);
    if (!error) {
      setFeedback("");
      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 3000);
    } else {
      toastError(lang === "ko" ? `피드백 전송 실패: ${error.message}` : `Feedback failed to send: ${error.message}`);
    }
  };

  const githubSponsorsUrl = "https://github.com/sponsors/GrangbelrLurain";
  const handleOpenSponsors = async () => {
    await commands.openExternalUrl(githubSponsorsUrl);
  };

  const [tempName, setTempName] = useState(profile.name || "");
  const [tempRole, setTempRole] = useState(profile.role || "");
  const [tempLang, setTempLang] = useState(lang);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setTempLang(lang);
  }, [lang]);

  useEffect(() => {
    if (supaProfile?.display_name) {
      setTempName(supaProfile.display_name);
    }
  }, [supaProfile]);

  const initials = getInitials(tempName || "KY");

  const saveProfile = async () => {
    if (!tempName.trim()) {
      return;
    }
    const name = tempName.trim();
    setProfile({
      name,
      role: tempRole.trim() || "User",
      avatarColor: profile.avatarColor,
      isSetupComplete: true,
    });
    setLang(tempLang);

    if (session?.user?.id) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .update({ display_name: name })
          .eq("id", session.user.id)
          .select()
          .single();
        if (error) {
          throw error;
        }
        if (data) {
          setSupaProfile(data);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toastError(
          lang === "ko"
            ? `로컬 설정은 저장됐지만 팀 프로필 이름 동기화에 실패했습니다: ${message}`
            : `Local settings saved, but team profile name sync failed: ${message}`,
        );
        return;
      }
    }

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col gap-6 w-full min-w-0 animate-in fade-in duration-300 pb-20 px-4">
      {!hideChrome && (
        <header className="flex flex-col gap-1 border-b border-base-300 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-base-content flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <UserCircle2 className="w-5 h-5" />
            </div>
            {t.title}
          </h1>
          <p className="text-xs text-base-content/60 font-medium">{t.subtitle}</p>
        </header>
      )}

      {/* Main Profile Info Card */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-5 shadow-sm w-full">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
          {/* Avatar + Inputs + Language Selector */}
          <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
            <div className="w-14 h-14 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-xl font-black text-primary shadow-xs overflow-hidden shrink-0">
              {supaProfile?.avatar_url ? (
                <img src={supaProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
              {/* Name */}
              <div className="flex flex-col gap-1 w-48 min-w-[160px]">
                <label htmlFor="profile-name" className="text-[11px] font-semibold text-base-content/70">
                  {t.name}
                </label>
                <Input
                  id="profile-name"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  maxLength={20}
                  className="h-8 text-xs font-medium bg-base-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void saveProfile();
                    }
                  }}
                />
              </div>

              {/* Role */}
              <div className="flex flex-col gap-1 w-40 min-w-[140px]">
                <label htmlFor="profile-role" className="text-[11px] font-semibold text-base-content/70">
                  {t.role}
                </label>
                <Input
                  id="profile-role"
                  value={tempRole}
                  onChange={(e) => setTempRole(e.target.value)}
                  maxLength={30}
                  className="h-8 text-xs font-medium bg-base-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void saveProfile();
                    }
                  }}
                />
              </div>

              {/* Language Selector Inline */}
              <div className="flex flex-col gap-1 w-40 min-w-[130px]">
                <span className="text-[11px] font-semibold text-base-content/70">{t.language}</span>
                <div className="flex gap-1 bg-base-200 p-0.5 rounded-lg border border-base-300 h-8 items-center">
                  <button
                    type="button"
                    onClick={() => setTempLang("en")}
                    className={clsx(
                      "flex-1 h-6 rounded text-[11px] font-bold transition-all cursor-pointer",
                      tempLang === "en"
                        ? "bg-base-100 text-primary shadow-xs border border-base-300"
                        : "text-base-content/60 hover:text-base-content",
                    )}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempLang("ko")}
                    className={clsx(
                      "flex-1 h-6 rounded text-[11px] font-bold transition-all cursor-pointer",
                      tempLang === "ko"
                        ? "bg-base-100 text-primary shadow-xs border border-base-300"
                        : "text-base-content/60 hover:text-base-content",
                    )}
                  >
                    한국어
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Action */}
          <div className="flex items-center gap-3 shrink-0 self-end md:self-center pt-2 md:pt-0">
            {isSaved && <span className="text-xs font-bold text-success animate-in fade-in">{t.saved}</span>}
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveProfile()}
              disabled={!tempName.trim()}
              className="h-9 px-5 text-xs shadow-sm shrink-0"
            >
              {t.save}
            </Button>
          </div>
        </div>
      </div>

      {/* Support & Labs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* 1. 얼리어답터 실험실 (Labs) */}
        <div className="bg-base-100 rounded-2xl border border-base-300 p-6 shadow-sm flex flex-col gap-5 w-full">
          <h3 className="text-base font-bold text-base-content flex items-center gap-2">
            <span className="p-1 bg-yellow-500/10 text-yellow-500 rounded-lg text-sm">🧪</span>
            {lang === "ko" ? "얼리어답터 실험실" : "Early Access Labs"}
          </h3>

          {!supaProfile?.is_sponsor ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-base-200/50 rounded-xl border border-base-300 gap-3">
              <div className="p-2.5 bg-base-300 text-base-content/60 rounded-full">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-base-content">
                  {lang === "ko" ? "실험실 기능 잠김" : "Labs Feature Locked"}
                </h4>
                <p className="text-[11px] text-base-content/60 mt-1 max-w-xs leading-relaxed">
                  {lang === "ko"
                    ? "GitHub Sponsors를 통해 스폰서해 주시면 얼리어답터 실험실 기능이 잠금 해제됩니다."
                    : "Sponsor via GitHub Sponsors to unlock early access testing features."}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleOpenSponsors}
                className="gap-2 h-9 text-xs px-5 shadow-sm bg-rose-500 hover:bg-rose-600 border-none text-white font-bold"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                {lang === "ko" ? "GitHub Sponsors로 후원하고 해제" : "Sponsor & Unlock"}
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-start justify-between p-3.5 bg-base-200/50 rounded-xl border border-base-300">
                <div className="flex-1 pr-3">
                  <h4 className="font-bold text-xs text-base-content">
                    {lang === "ko" ? "실험 기능 A (AI 자동완성)" : "Feature A (AI Autocomplete)"}
                  </h4>
                  <p className="text-[11px] text-base-content/60 mt-0.5 leading-relaxed">
                    {lang === "ko"
                      ? "API 모킹 작성 시 스키마를 기반으로 AI가 자동완성을 제공합니다."
                      : "AI provides auto-completion based on schema when creating mock rules."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm cursor-pointer mt-0.5"
                  checked={aiAutocomplete}
                  onChange={(e) => setAiAutocomplete(e.target.checked)}
                />
              </div>

              <div className="flex items-start justify-between p-3.5 bg-base-200/50 rounded-xl border border-base-300">
                <div className="flex-1 pr-3">
                  <h4 className="font-bold text-xs text-base-content">
                    {lang === "ko" ? "실험 기능 B (커스텀 테마 실험)" : "Feature B (Custom Themes)"}
                  </h4>
                  <p className="text-[11px] text-base-content/60 mt-0.5 leading-relaxed">
                    {lang === "ko"
                      ? "앱 곳곳에 더욱 미려한 그라데이션 및 유리 모핑 효과를 적용합니다."
                      : "Apply gorgeous gradients and frosted glassmorphism across the app."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm cursor-pointer mt-0.5"
                  checked={customTheme}
                  onChange={(e) => setCustomTheme(e.target.checked)}
                />
              </div>

              <div className="mt-auto flex items-center gap-2 p-2.5 bg-yellow-500/10 text-yellow-600 rounded-xl border border-yellow-500/20 text-[10px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === "ko"
                    ? "주의: 실험 기능 활성화 중 문제 발생 시 해당 스위치를 끄면 즉시 복구됩니다."
                    : "Warning: If issues occur, toggle these off to immediately restore stability."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. 개발 피드백 제출 */}
        <div className="bg-base-100 rounded-2xl border border-base-300 p-6 shadow-sm flex flex-col gap-5 w-full">
          <h3 className="text-base font-bold text-base-content flex items-center gap-2">
            <span className="p-1 bg-primary/10 text-primary rounded-lg text-sm">💬</span>
            {lang === "ko" ? "개발 피드백 보내기" : "Send Feedback"}
          </h3>

          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-base-content/70">{t.feedbackCategory}</span>
              <div className="flex gap-2 bg-base-200 p-1 rounded-xl border border-base-300">
                {(
                  [
                    ["bug", t.categoryBug],
                    ["feature", t.categoryFeature],
                    ["question", t.categoryQuestion],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackCategory(value)}
                    className={clsx(
                      "flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      feedbackCategory === value
                        ? "bg-base-100 text-primary shadow-sm border border-base-300"
                        : "text-base-content/60 hover:text-base-content",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="textarea textarea-bordered bg-base-200 border-base-300 w-full flex-1 min-h-[100px] rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-primary text-base-content"
              placeholder={
                lang === "ko"
                  ? "오류 제보나 기능 건의사항을 편하게 남겨주세요."
                  : "Leave bug reports or feature suggestions here."
              }
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={1000}
            />

            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-[10px] text-base-content/40 font-semibold">
                {lang === "ko"
                  ? "* 피드백은 개발 DB에 즉시 저장됩니다."
                  : "* Feedbacks are saved directly to developer DB."}
              </span>

              <div className="flex items-center gap-2">
                {feedbackSent && (
                  <span className="text-xs font-bold text-success">{lang === "ko" ? "전송 완료!" : "Sent!"}</span>
                )}
                <Button
                  variant="primary"
                  onClick={handleSendFeedback}
                  disabled={!feedback.trim() || feedbackSending}
                  className="gap-1.5 h-9 px-5 text-xs shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  {feedbackSending ? (lang === "ko" ? "전송 중..." : "Sending...") : lang === "ko" ? "보내기" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry / Privacy */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-6 shadow-sm flex flex-col gap-3 w-full">
        <h3 className="text-base font-bold text-base-content flex items-center gap-2">
          <span className="p-1 bg-info/10 text-info rounded-lg text-sm">🔒</span>
          {t.telemetryTitle}
        </h3>
        <p className="text-xs text-base-content/60 leading-relaxed">{t.telemetryDesc}</p>

        <div className="flex items-center justify-between p-3.5 bg-base-200/50 rounded-xl border border-base-300 flex-wrap gap-3 mt-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm cursor-pointer"
              checked={telemetryEnabled}
              onChange={(e) => setTelemetryEnabled(e.target.checked)}
            />
            <span className="text-xs font-bold text-base-content">
              {telemetryEnabled ? t.telemetryToggleOn : t.telemetryToggleOff}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-base-content/40">{t.telemetryInstallId}</span>
            <code className="text-[11px] font-mono bg-base-300/50 px-2 py-1 rounded-lg text-base-content/70">
              {installId.slice(0, 13)}…
            </code>
            <Button variant="secondary" size="xs" className="gap-1 h-7 text-[11px]" onClick={handleRegenerateInstallId}>
              <RefreshCw className="w-3 h-3" />
              {t.telemetryRegenerate}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

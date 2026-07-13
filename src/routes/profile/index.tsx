import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Check, Heart, Lock, Send, ShieldAlert, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type AppTheme,
  AVATAR_COLORS,
  experimentalAiAutocompleteAtom,
  experimentalCustomThemeAtom,
  getInitials,
  languageAtom,
  supabaseProfileAtom,
  supabaseSessionAtom,
  themeAtom,
  userProfileAtom,
} from "@/entities/app";
import { commands } from "@/shared/api";
import { supabase } from "@/shared/api/supabase";
import { useIsHubSurfaceEmbed } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useIsEmbeddedPage } from "@/shared/lib/tauri/useEmbedMode";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { en } from "./en";
import { ko } from "./ko";

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
  const supaProfile = useAtomValue(supabaseProfileAtom);
  const [aiAutocomplete, setAiAutocomplete] = useAtom(experimentalAiAutocompleteAtom);
  const [customTheme, setCustomTheme] = useAtom(experimentalCustomThemeAtom);

  const [feedback, setFeedback] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleSendFeedback = async () => {
    if (!feedback.trim()) {
      return;
    }
    setFeedbackSending(true);
    const { error } = await supabase.from("feedbacks").insert({
      profile_id: session?.user?.id || null,
      content: feedback.trim(),
    });
    setFeedbackSending(false);
    if (!error) {
      setFeedback("");
      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 3000);
    } else {
      alert(lang === "ko" ? `피드백 전송 실패: ${error.message}` : `Feedback failed to send: ${error.message}`);
    }
  };

  const githubSponsorsUrl = "https://github.com/sponsors/GrangbelrLurain";
  const handleOpenSponsors = async () => {
    await commands.openExternalUrl(githubSponsorsUrl);
  };

  const [globalTheme, setGlobalTheme] = useAtom(themeAtom);

  const [tempName, setTempName] = useState(profile.name || "");
  const [tempRole, setTempRole] = useState(profile.role || "");
  const [tempColor, setTempColor] = useState(profile.avatarColor || AVATAR_COLORS[0]);
  const [tempLang, setTempLang] = useState(lang);
  const [tempTheme, setTempTheme] = useState<AppTheme>(globalTheme);
  const [isSaved, setIsSaved] = useState(false);

  // Sync tempLang with global lang if it changes elsewhere
  useEffect(() => {
    setTempLang(lang);
    setTempTheme(globalTheme);
  }, [lang, globalTheme]);

  useEffect(() => {
    if (supaProfile) {
      if (supaProfile.display_name) {
        setTempName(supaProfile.display_name);
      }
    }
  }, [supaProfile]);

  const initials = getInitials(tempName || "KY");

  const saveProfile = () => {
    if (!tempName.trim()) {
      return;
    }
    setProfile({
      name: tempName.trim(),
      role: tempRole.trim() || "User",
      avatarColor: tempColor,
      isSetupComplete: true,
    });
    setLang(tempLang);
    setGlobalTheme(tempTheme);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full animate-in fade-in duration-500 pb-20 px-4">
      {!hideChrome && (
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-base-content flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <UserCircle2 className="w-6 h-6" />
            </div>
            {t.title}
          </h1>
          <p className="text-base-content/60 font-medium">{t.subtitle}</p>
        </header>
      )}

      <div className="bg-base-100 rounded-3xl border border-base-200 shadow-sm flex flex-col md:flex-row min-h-[500px] shrink-0">
        {/* Left side: Avatar Preview Jumbo */}
        <div className="md:w-[320px] bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
          <div className={`absolute inset-0 opacity-20 ${tempColor}`} />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />

          <div className="relative z-10 flex flex-col items-center gap-6 w-full">
            <div
              className={clsx(
                "w-32 h-32 rounded-3xl border-[6px] border-white/10 flex items-center justify-center text-5xl font-black text-white shadow-2xl transition-all duration-500 rotate-3 hover:rotate-0 overflow-hidden",
                tempColor,
              )}
            >
              {supaProfile?.avatar_url ? (
                <img src={supaProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="text-center flex flex-col gap-1 w-full">
              <h2
                className="text-2xl font-bold text-white truncate px-2"
                title={tempName || supaProfile?.display_name || "Horizon Gateway"}
              >
                {tempName || supaProfile?.display_name || "Horizon Gateway"}
              </h2>
              <p className="text-sm font-medium text-slate-400 truncate px-2" title={tempRole}>
                {tempRole || "User"}
              </p>
            </div>
          </div>
        </div>

        {/* Right side: Edit Form */}
        <div className="flex flex-1 flex-col p-8 md:p-12 gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="profile-name"
                className="text-xs font-bold uppercase tracking-widest text-base-content/50"
              >
                {t.name}
              </label>
              <Input
                id="profile-name"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                className="h-12 text-base font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveProfile();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="profile-role"
                className="text-xs font-bold uppercase tracking-widest text-base-content/50"
              >
                {t.role}
              </label>
              <Input
                id="profile-role"
                value={tempRole}
                onChange={(e) => setTempRole(e.target.value)}
                maxLength={30}
                className="h-12 text-base font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveProfile();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-base-content/50">{t.avatarTheme}</span>
            <div className="flex items-center gap-3 flex-wrap bg-base-200 p-4 rounded-2xl border border-base-300">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTempColor(c)}
                  className={clsx(
                    "w-12 h-12 rounded-full border-4 transition-all hover:scale-110 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    c,
                    tempColor === c ? "border-base-content scale-110 shadow-lg" : "border-base-100 shadow-sm",
                  )}
                >
                  {tempColor === c && <Check className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-base-content/50">{t.language}</span>
              <div className="flex gap-2 bg-base-200 p-1.5 rounded-2xl border border-base-300">
                <button
                  type="button"
                  onClick={() => setTempLang("en")}
                  className={clsx(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                    tempLang === "en"
                      ? "bg-base-100 text-primary shadow-sm"
                      : "text-base-content/60 hover:text-base-content hover:bg-base-content/5",
                  )}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setTempLang("ko")}
                  className={clsx(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                    tempLang === "ko"
                      ? "bg-base-100 text-primary shadow-sm"
                      : "text-base-content/60 hover:text-base-content hover:bg-base-content/5",
                  )}
                >
                  한국어
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-base-content/50">{t.appTheme}</span>
              <div className="flex gap-2 bg-base-200 p-1.5 rounded-2xl border border-base-300">
                <button
                  type="button"
                  onClick={() => setTempTheme("watchtower-light")}
                  className={clsx(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                    tempTheme === "watchtower-light"
                      ? "bg-base-100 text-primary shadow-sm"
                      : "text-base-content/60 hover:text-base-content hover:bg-base-content/5",
                  )}
                >
                  {t.lightMode}
                </button>
                <button
                  type="button"
                  onClick={() => setTempTheme("watchtower-dark")}
                  className={clsx(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                    tempTheme === "watchtower-dark"
                      ? "bg-base-100 text-primary shadow-sm"
                      : "text-base-content/60 hover:text-base-content hover:bg-base-content/5",
                  )}
                >
                  {t.darkMode}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-base-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div
              className={clsx(
                "text-sm font-bold text-success transition-opacity duration-300",
                isSaved ? "opacity-100" : "opacity-0",
              )}
            >
              {t.saved}
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={saveProfile}
              disabled={!tempName.trim()}
              className="w-full md:w-auto h-12 px-8 text-base shadow-lg shadow-primary/20"
            >
              {t.save}
            </Button>
          </div>
        </div>
      </div>

      {/* Support & Labs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* 1. 얼리어답터 실험실 (Labs) */}
        <div className="bg-base-100 rounded-3xl border border-base-200 p-8 shadow-sm flex flex-col gap-6">
          <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
            <span className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg">🧪</span>
            {lang === "ko" ? "얼리어답터 실험실" : "Early Access Labs"}
          </h3>

          {!supaProfile?.is_sponsor ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-base-200/50 rounded-2xl border border-base-200 gap-4">
              <div className="p-3 bg-base-300 text-base-content/60 rounded-full">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-base-content">
                  {lang === "ko" ? "실험실 기능 잠김" : "Labs Feature Locked"}
                </h4>
                <p className="text-xs text-base-content/60 mt-1 max-w-xs leading-relaxed">
                  {lang === "ko"
                    ? "GitHub Sponsors를 통해 스폰서해 주시면 얼리어답터 실험실 기능이 잠금 해제됩니다."
                    : "Sponsor via GitHub Sponsors to unlock early access testing features."}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleOpenSponsors}
                className="gap-2 h-10 text-xs px-6 shadow-md bg-rose-500 hover:bg-rose-600 border-none text-white font-bold animate-pulse"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                {lang === "ko" ? "GitHub Sponsors로 후원하고 해제" : "Sponsor & Unlock"}
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-start justify-between p-4 bg-base-200/50 rounded-2xl border border-base-200">
                <div className="flex-1 pr-4">
                  <h4 className="font-bold text-sm text-base-content">
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
                  className="toggle toggle-primary toggle-sm cursor-pointer mt-1"
                  checked={aiAutocomplete}
                  onChange={(e) => setAiAutocomplete(e.target.checked)}
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-base-200/50 rounded-2xl border border-base-200">
                <div className="flex-1 pr-4">
                  <h4 className="font-bold text-sm text-base-content">
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
                  className="toggle toggle-primary toggle-sm cursor-pointer mt-1"
                  checked={customTheme}
                  onChange={(e) => setCustomTheme(e.target.checked)}
                />
              </div>

              <div className="mt-auto flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-600 rounded-xl border border-yellow-500/20 text-[10px] font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
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
        <div className="bg-base-100 rounded-3xl border border-base-200 p-8 shadow-sm flex flex-col gap-6">
          <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded-lg">💬</span>
            {lang === "ko" ? "개발 피드백 보내기" : "Send Feedback"}
          </h3>

          <div className="flex-1 flex flex-col gap-4">
            <textarea
              className="textarea textarea-bordered bg-base-200 border-base-300 w-full flex-1 min-h-[120px] rounded-2xl p-4 text-xs font-medium focus:outline-none focus:border-primary text-base-content"
              placeholder={
                lang === "ko"
                  ? "오류 제보나 기능 건의사항을 편하게 남겨주세요."
                  : "Leave bug reports or feature suggestions here."
              }
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={1000}
            />

            <div className="flex items-center justify-between mt-auto">
              <span className="text-[10px] text-base-content/40 font-semibold">
                {lang === "ko"
                  ? "* 피드백은 개발 DB에 즉시 저장됩니다."
                  : "* Feedbacks are saved directly to developer DB."}
              </span>

              <div className="flex items-center gap-3">
                {feedbackSent && (
                  <span className="text-xs font-bold text-success">{lang === "ko" ? "전송 완료!" : "Sent!"}</span>
                )}
                <Button
                  variant="primary"
                  onClick={handleSendFeedback}
                  disabled={!feedback.trim() || feedbackSending}
                  className="gap-1.5 h-10 px-6 text-xs shadow-md shadow-primary/10"
                >
                  <Send className="w-3.5 h-3.5" />
                  {feedbackSending ? (lang === "ko" ? "전송 중..." : "Sending...") : lang === "ko" ? "보내기" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

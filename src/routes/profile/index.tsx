import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtom } from "jotai";
import { Check, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { type AppTheme, AVATAR_COLORS, getInitials, languageAtom, themeAtom, userProfileAtom } from "@/entities/app";
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
    <div className="flex flex-col gap-8 pb-20 max-w-4xl mx-auto w-full animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-base-content flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <UserCircle2 className="w-6 h-6" />
          </div>
          {t.title}
        </h1>
        <p className="text-base-content/60 font-medium">{t.subtitle}</p>
      </header>

      <div className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[500px]">
        {/* Left side: Avatar Preview Jumbo */}
        <div className="md:w-[320px] bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
          <div className={`absolute inset-0 opacity-20 ${tempColor}`} />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />

          <div className="relative z-10 flex flex-col items-center gap-6 w-full">
            <div
              className={clsx(
                "w-32 h-32 rounded-3xl border-[6px] border-white/10 flex items-center justify-center text-5xl font-black text-white shadow-2xl transition-all duration-500 rotate-3 hover:rotate-0",
                tempColor,
              )}
            >
              {initials}
            </div>
            <div className="text-center flex flex-col gap-1 w-full">
              <h2 className="text-2xl font-bold text-white truncate px-2" title={tempName}>
                {tempName || "Watchtower"}
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
    </div>
  );
}

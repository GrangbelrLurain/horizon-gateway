import { useAtom, useAtomValue } from "jotai";
import { Download, Palette, RefreshCw, Type, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  activeCustomThemeAtom,
  applyThemeToDocument,
  BUILTIN_PRESETS,
  type BundledFontId,
  type CustomTheme,
  customThemesAtom,
  DEFAULT_DARK_THEME,
  exportThemeToJson,
  parseAndValidateThemeJson,
  themeAtom,
} from "@/entities/app";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { toastError, toastInfo, toastSuccess } from "@/shared/ui/toast";

const BUNDLED_FONTS: Array<{ id: BundledFontId; name: string; sample: string }> = [
  { id: "system", name: "System Default (OS)", sample: "Aa 가나다 123" },
  { id: "inter", name: "Inter (Modern UI)", sample: "Aa 가나다 123" },
  { id: "geist", name: "Geist (Clean)", sample: "Aa 가나다 123" },
  { id: "jetbrains-mono", name: "JetBrains Mono (Code)", sample: "const x = 42;" },
  { id: "noto-sans-kr", name: "Noto Sans KR (Korean)", sample: "Aa 가나다 123" },
];

const POPULAR_SYSTEM_FONTS = [
  "Pretendard",
  "NanumGothic",
  "NanumBarunGothic",
  "Malgun Gothic",
  "Apple SD Gothic Neo",
  "Segoe UI",
  "Roboto",
];

function ColorPickerBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-medium text-base-content/50 truncate">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded border-none cursor-pointer bg-transparent shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input input-xs input-bordered bg-base-100 font-mono text-[10px] w-full px-1 text-center"
        />
      </div>
    </label>
  );
}

export function ThemeEditorPanel({ lang }: { lang: "ko" | "en" }) {
  const [, setActiveThemeId] = useAtom(themeAtom);
  const [customThemes, setCustomThemes] = useAtom(customThemesAtom);
  const activeTheme = useAtomValue(activeCustomThemeAtom);
  const activeThemeRef = useRef(activeTheme);
  activeThemeRef.current = activeTheme;

  const [draft, setDraft] = useState<CustomTheme>(() => ({
    ...activeTheme,
    colors: {
      ...(activeTheme?.colors || {}),
      primaryContent: activeTheme?.colors?.primaryContent || (activeTheme?.base === "light" ? "#ffffff" : "#020617"),
      secondaryContent:
        activeTheme?.colors?.secondaryContent || (activeTheme?.base === "light" ? "#ffffff" : "#020617"),
      accentContent: activeTheme?.colors?.accentContent || (activeTheme?.base === "light" ? "#ffffff" : "#020617"),
    },
  }));
  const [fontQuery, setFontQuery] = useState("");

  useEffect(() => {
    if (!activeTheme) {
      return;
    }
    setDraft({
      ...activeTheme,
      colors: {
        ...(activeTheme.colors || {}),
        primaryContent: activeTheme.colors?.primaryContent || (activeTheme.base === "light" ? "#ffffff" : "#020617"),
        secondaryContent:
          activeTheme.colors?.secondaryContent || (activeTheme.base === "light" ? "#ffffff" : "#020617"),
        accentContent: activeTheme.colors?.accentContent || (activeTheme.base === "light" ? "#ffffff" : "#020617"),
      },
    });
  }, [activeTheme]);

  useEffect(() => {
    applyThemeToDocument(draft);
  }, [draft]);

  useEffect(() => {
    return () => {
      applyThemeToDocument(activeThemeRef.current);
    };
  }, []);

  const handleColorChange = (key: keyof CustomTheme["colors"], value: string) => {
    setDraft((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const handleSaveTheme = () => {
    const isBuiltin = BUILTIN_PRESETS.some((p) => p.id === draft.id);
    let themeToSave = draft;

    if (isBuiltin) {
      themeToSave = {
        ...draft,
        id: `custom-theme-${Date.now()}`,
        name: `${draft.name} (Custom)`,
      };
    }

    setCustomThemes((prev) => {
      const exists = prev.some((t) => t.id === themeToSave.id);
      if (exists) {
        return prev.map((t) => (t.id === themeToSave.id ? themeToSave : t));
      }
      return [...prev, themeToSave];
    });

    setActiveThemeId(themeToSave.id);
    toastSuccess(lang === "ko" ? "테마가 저장되었습니다." : "Theme saved successfully.");
  };

  const handleExportTheme = () => {
    const jsonStr = exportThemeToJson(draft);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.toLowerCase().replace(/\s+/g, "-")}.hgtheme.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess(lang === "ko" ? "테마 파일이 내보내졌습니다." : "Theme exported.");
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { theme, warning, error } = parseAndValidateThemeJson(content);
      if (error) {
        toastError(error);
        return;
      }
      if (theme) {
        setCustomThemes((prev) => [...prev.filter((t) => t.id !== theme.id), theme]);
        setActiveThemeId(theme.id);
        if (warning) {
          toastInfo(warning);
        } else {
          toastSuccess(lang === "ko" ? "테마를 성공적으로 불러왔습니다!" : "Theme imported successfully!");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetToDefault = () => {
    setDraft(DEFAULT_DARK_THEME);
    setActiveThemeId(DEFAULT_DARK_THEME.id);
    toastInfo(lang === "ko" ? "기본 테마로 복원되었습니다." : "Reset to default theme.");
  };

  return (
    <div className="flex flex-col gap-6 p-6 w-full min-w-0">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-base-300 pb-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-base-content">
            {lang === "ko" ? "커스텀 테마 & 폰트 에디터" : "Custom Theme & Typography Editor"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn btn-xs btn-ghost gap-1 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-info" />
            <span>{lang === "ko" ? "가져오기" : "Import"}</span>
            <input type="file" accept=".json,.hgtheme.json" className="hidden" onChange={handleImportTheme} />
          </label>
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={handleExportTheme}>
            <Download className="w-3.5 h-3.5 text-accent" />
            {lang === "ko" ? "내보내기" : "Export"}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={handleResetToDefault}>
            <RefreshCw className="w-3.5 h-3.5" />
            {lang === "ko" ? "초기화" : "Reset"}
          </Button>
          <Button variant="primary" size="sm" className="h-7 text-xs" onClick={handleSaveTheme}>
            {lang === "ko" ? "테마 저장" : "Save Theme"}
          </Button>
        </div>
      </div>

      {/* Preset / Custom Selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-base-content/70">
          {lang === "ko" ? "테마 선택:" : "Select Theme:"}
        </span>
        <select
          value={draft.id}
          onChange={(e) => {
            const targetId = e.target.value;
            const found = customThemes.find((t) => t.id === targetId) || BUILTIN_PRESETS.find((t) => t.id === targetId);
            if (found) {
              setDraft(found);
              setActiveThemeId(found.id);
            }
          }}
          className="select select-sm select-bordered bg-base-200 text-xs font-medium"
        >
          <optgroup label={lang === "ko" ? "기본 테마" : "Built-in Themes"}>
            {BUILTIN_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
          {customThemes.length > 0 && (
            <optgroup label={lang === "ko" ? "사용자 정의 테마" : "Custom Themes"}>
              {customThemes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={lang === "ko" ? "테마 이름..." : "Theme Name..."}
          className="input input-sm input-bordered bg-base-200 text-xs flex-1"
        />
      </div>

      {/* Colors Grid Grouped */}
      <section className="space-y-2 min-w-0">
        <h2 className="text-sm font-semibold text-base-content flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-primary" />
          {lang === "ko" ? "컬러 팔레트 그룹" : "Color Palette Groups"}
        </h2>

        <Card className="p-3 @min-[32rem]:p-4 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Primary Group */}
            <div className="flex flex-col gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-base-content flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: draft.colors.primary }} />
                Primary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ColorPickerBox
                  label={lang === "ko" ? "배경 (Bg)" : "Background"}
                  value={draft.colors.primary}
                  onChange={(v) => handleColorChange("primary", v)}
                />
                <ColorPickerBox
                  label={lang === "ko" ? "폰트 (Text)" : "Text Color"}
                  value={draft.colors.primaryContent || "#ffffff"}
                  onChange={(v) => handleColorChange("primaryContent", v)}
                />
              </div>
            </div>

            {/* Secondary Group */}
            <div className="flex flex-col gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-base-content flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: draft.colors.secondary }} />
                Secondary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ColorPickerBox
                  label={lang === "ko" ? "배경 (Bg)" : "Background"}
                  value={draft.colors.secondary}
                  onChange={(v) => handleColorChange("secondary", v)}
                />
                <ColorPickerBox
                  label={lang === "ko" ? "폰트 (Text)" : "Text Color"}
                  value={draft.colors.secondaryContent || "#ffffff"}
                  onChange={(v) => handleColorChange("secondaryContent", v)}
                />
              </div>
            </div>

            {/* Accent Group */}
            <div className="flex flex-col gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-base-content flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: draft.colors.accent }} />
                Accent
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ColorPickerBox
                  label={lang === "ko" ? "배경 (Bg)" : "Background"}
                  value={draft.colors.accent}
                  onChange={(v) => handleColorChange("accent", v)}
                />
                <ColorPickerBox
                  label={lang === "ko" ? "폰트 (Text)" : "Text Color"}
                  value={draft.colors.accentContent || "#ffffff"}
                  onChange={(v) => handleColorChange("accentContent", v)}
                />
              </div>
            </div>

            {/* Base & Surface Group */}
            <div className="flex flex-col gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-base-content flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full border border-base-content/40 shrink-0"
                  style={{ backgroundColor: draft.colors.base100 }}
                />
                {lang === "ko" ? "배경 및 텍스트" : "Base & Content"}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <ColorPickerBox
                  label={lang === "ko" ? "기본 텍스트" : "Content Text"}
                  value={draft.colors.content}
                  onChange={(v) => handleColorChange("content", v)}
                />
                <ColorPickerBox
                  label={lang === "ko" ? "패널 (100)" : "Panel (100)"}
                  value={draft.colors.base100}
                  onChange={(v) => handleColorChange("base100", v)}
                />
                <ColorPickerBox
                  label={lang === "ko" ? "앱 (200)" : "App (200)"}
                  value={draft.colors.base200}
                  onChange={(v) => handleColorChange("base200", v)}
                />
                <ColorPickerBox
                  label={lang === "ko" ? "구분선 (300)" : "Border (300)"}
                  value={draft.colors.base300}
                  onChange={(v) => handleColorChange("base300", v)}
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Typography Section */}
      <section className="space-y-2 min-w-0">
        <h2 className="text-sm font-semibold text-base-content flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-accent" />
          {lang === "ko" ? "타이포그래피 & 폰트" : "Typography & Fonts"}
        </h2>

        <Card className="p-3 @min-[32rem]:p-4 space-y-4 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bundled Fonts */}
            <div className="flex flex-col gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-base-content">
                {lang === "ko" ? "앱 번들 폰트" : "Bundled App Fonts"}
              </h3>
              <div className="flex flex-col gap-1">
                {BUNDLED_FONTS.map((font) => {
                  const isSelected =
                    draft.typography.fontSource.type === "bundled" && draft.typography.fontSource.id === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          typography: {
                            ...prev.typography,
                            fontSource: { type: "bundled", id: font.id },
                          },
                        }))
                      }
                      className={`flex items-center justify-between p-2 rounded-lg text-xs text-left transition-colors ${
                        isSelected
                          ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                          : "hover:bg-base-200 text-base-content/80"
                      }`}
                    >
                      <span>{font.name}</span>
                      <span className="font-mono text-[10px] opacity-60">{font.sample}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OS System Fonts */}
            <div className="flex flex-col gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-base-content">
                {lang === "ko" ? "내 컴퓨터 설치 폰트" : "Installed System Fonts"}
              </h3>
              <input
                type="text"
                value={fontQuery}
                onChange={(e) => setFontQuery(e.target.value)}
                placeholder={lang === "ko" ? "폰트 이름 검색 (예: Pretendard)..." : "Search font family name..."}
                className="input input-xs input-bordered bg-base-100 text-xs mb-1"
              />
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1">
                {POPULAR_SYSTEM_FONTS.filter(
                  (f) => !fontQuery || f.toLowerCase().includes(fontQuery.toLowerCase()),
                ).map((fontFamily) => {
                  const isSelected =
                    draft.typography.fontSource.type === "system" &&
                    draft.typography.fontSource.familyName === fontFamily;
                  return (
                    <button
                      key={fontFamily}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          typography: {
                            ...prev.typography,
                            fontSource: { type: "system", familyName: fontFamily },
                          },
                        }))
                      }
                      className={`flex items-center justify-between p-2 rounded-lg text-xs text-left transition-colors ${
                        isSelected
                          ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                          : "hover:bg-base-200 text-base-content/80"
                      }`}
                    >
                      <span>{fontFamily}</span>
                      <span style={{ fontFamily: `local("${fontFamily}"), sans-serif` }} className="text-xs">
                        Aa 가나다 123
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Font Size & Line Height Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-base-200">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-medium text-base-content/80">
                <span>{lang === "ko" ? "기본 폰트 크기" : "Base Font Size"}</span>
                <span className="font-mono">{draft.typography.baseFontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="18"
                step="1"
                value={draft.typography.baseFontSize}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    typography: { ...prev.typography, baseFontSize: Number(e.target.value) },
                  }))
                }
                className="range range-xs range-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-medium text-base-content/80">
                <span>{lang === "ko" ? "줄 간격 (Line Height)" : "Line Height"}</span>
                <span className="font-mono">{draft.typography.lineHeight}</span>
              </div>
              <input
                type="range"
                min="1.2"
                max="1.8"
                step="0.1"
                value={draft.typography.lineHeight}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    typography: { ...prev.typography, lineHeight: Number(e.target.value) },
                  }))
                }
                className="range range-xs range-accent"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* Live Preview Card */}
      <section className="space-y-2 min-w-0">
        <h2 className="text-sm font-semibold text-base-content">
          {lang === "ko" ? "실시간 미리보기" : "Live Preview"}
        </h2>
        <Card className="p-4 space-y-3 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm px-3"
              style={{
                backgroundColor: draft.colors.primary,
                color: draft.colors.primaryContent || "#ffffff",
                borderColor: draft.colors.primary,
              }}
            >
              Primary Button
            </button>
            <button
              type="button"
              className="btn btn-sm px-3"
              style={{
                backgroundColor: draft.colors.secondary,
                color: draft.colors.secondaryContent || "#ffffff",
                borderColor: draft.colors.secondary,
              }}
            >
              Secondary Button
            </button>
            <span
              className="badge badge-sm font-semibold"
              style={{
                backgroundColor: draft.colors.accent,
                color: draft.colors.accentContent || "#ffffff",
                borderColor: draft.colors.accent,
              }}
            >
              Accent Badge
            </span>
          </div>

          <div className="text-xs leading-relaxed space-y-1">
            <p className="font-semibold">{lang === "ko" ? "실시간 테마 적용 안내" : "Live Theme Preview"}</p>
            <p className="text-base-content/55">
              Horizon Gateway를 사용하면 API 프록시, 도메인 헬스체크, 네트워크 트래픽 캡처 및 테마 커스터마이징을 한
              곳에서 손쉽게 제어할 수 있습니다.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}

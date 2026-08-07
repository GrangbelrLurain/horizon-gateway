import { useAtomValue } from "jotai";
import { languageAtom } from "@/entities/app";
import { ThemeEditorPanel } from "@/features/theme-editor";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";

export function ChromeThemeSurface() {
  const lang = useAtomValue(languageAtom);
  return (
    <HubSurfaceEmbedProvider>
      <div className="p-4 overflow-y-auto h-full w-full">
        <ThemeEditorPanel lang={lang} />
      </div>
    </HubSurfaceEmbedProvider>
  );
}

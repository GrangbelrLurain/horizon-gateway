import { atomWithStorage } from "jotai/utils";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";

export type SupportedLanguage = "en" | "ko";

const getDefaultLanguage = (): SupportedLanguage => {
  if (typeof navigator !== "undefined") {
    return navigator.language.startsWith("ko") ? "ko" : "en";
  }
  return "en";
};

export const languageAtom = atomWithBroadcast<SupportedLanguage>(
  "watchtower-language",
  getDefaultLanguage(),
  atomWithStorage<SupportedLanguage>("watchtower-language", getDefaultLanguage()),
);

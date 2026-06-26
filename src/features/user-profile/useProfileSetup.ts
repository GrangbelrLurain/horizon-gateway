import { useAtom } from "jotai";
import { useCallback, useState } from "react";
import { AVATAR_COLORS, getInitials, languageAtom, userProfileAtom } from "@/entities/app";

export function useProfileSetup() {
  const [profile, setProfile] = useAtom(userProfileAtom);
  const [lang, setLang] = useAtom(languageAtom);

  const [tempName, setTempName] = useState(profile.name || "");
  const [tempRole, setTempRole] = useState(profile.role || "");
  const [tempColor, setTempColor] = useState(profile.avatarColor || AVATAR_COLORS[0]);

  const saveProfile = useCallback(() => {
    if (!tempName.trim()) {
      return;
    }
    setProfile({
      name: tempName.trim(),
      role: tempRole.trim() || "User",
      avatarColor: tempColor,
      isSetupComplete: true,
    });
  }, [setProfile, tempColor, tempName, tempRole]);

  return {
    isComplete: profile.isSetupComplete,
    tempName,
    tempRole,
    tempColor,
    lang,
    initials: getInitials(tempName || "KY"),
    onTempNameChange: setTempName,
    onTempRoleChange: setTempRole,
    onTempColorChange: setTempColor,
    onLangChange: setLang,
    onSave: saveProfile,
  };
}

export type ProfileSetupState = ReturnType<typeof useProfileSetup>;

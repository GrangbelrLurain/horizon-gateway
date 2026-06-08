import { useAtomValue, useSetAtom } from "jotai";
import { languageAtom } from "@/domain/i18n/store";
import { promiseModalAtom } from "@/shared/store/modals";

export function usePromiseModal() {
  const setModal = useSetAtom(promiseModalAtom);
  const lang = useAtomValue(languageAtom);

  const show = (config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "info" | "success" | "warning" | "danger";
  }) => {
    return new Promise<boolean>((resolve) => {
      setModal({
        ...config,
        resolve: (val) => {
          setModal(null);
          resolve(val);
        },
      });
    });
  };

  const alert = (title: string, message: string, type: "info" | "success" | "warning" | "danger" = "success") => {
    return show({
      title,
      message,
      confirmText: lang === "ko" ? "확인" : "OK",
      type,
    });
  };

  return { show, alert };
}

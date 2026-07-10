import { revealInFolder } from "./saveDownload";

type OfferRevealShow = (config: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "info" | "success" | "warning" | "danger";
}) => Promise<boolean>;

/**
 * After a successful save, ask whether to reveal the file in the OS folder.
 */
export async function offerRevealSavedDownload(options: {
  path: string;
  title: string;
  message: string;
  openFolderText: string;
  closeText: string;
  show: OfferRevealShow;
}): Promise<void> {
  const shouldOpen = await options.show({
    title: options.title,
    message: options.message,
    confirmText: options.openFolderText,
    cancelText: options.closeText,
    type: "success",
  });
  if (!shouldOpen) {
    return;
  }
  try {
    await revealInFolder(options.path);
  } catch (e) {
    console.error("revealInFolder:", e);
  }
}

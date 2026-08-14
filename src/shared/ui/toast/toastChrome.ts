export const toastChrome = {
  ko: {
    errorTitle: "오류",
    details: "상세",
    close: "닫기",
    copy: "복사",
    copied: "복사됨",
    message: "메시지",
    stack: "스택",
    body: "응답",
    requestId: "요청 ID",
    dismiss: "닫기",
  },
  en: {
    errorTitle: "Error",
    details: "Details",
    close: "Close",
    copy: "Copy",
    copied: "Copied",
    message: "Message",
    stack: "Stack",
    body: "Response",
    requestId: "Request ID",
    dismiss: "Dismiss",
  },
} as const;

export type ToastLang = keyof typeof toastChrome;

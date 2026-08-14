import html2canvas from "html2canvas";

const INJECTION_ROOT_ID = "horizon-gateway-injection-container";

function isInjectionNode(node: Element): boolean {
  if (node.id === INJECTION_ROOT_ID) {
    return true;
  }
  return Boolean(node.closest?.(`#${INJECTION_ROOT_ID}`));
}

export function capturePageMeta(): { url: string; domain: string } {
  return {
    url: window.location.href.split("/.horizon-gateway")[0],
    domain: window.location.host,
  };
}

/** Screenshot the resolved page element for hub/injection preview (webp data URL). */
export async function captureElementThumbnail(el: HTMLElement): Promise<string> {
  try {
    const canvas = await html2canvas(el, {
      useCORS: true,
      scale: 1,
      logging: false,
      backgroundColor: "#ffffff",
      ignoreElements: isInjectionNode,
    });
    return canvas.toDataURL("image/webp", 0.3);
  } catch {
    return "";
  }
}

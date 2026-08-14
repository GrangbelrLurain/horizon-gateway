/**
 * Lemon Squeezy paid checkout. Off in production (`!DEV`) unless explicitly enabled.
 *
 * - Local / `tauri dev`: on by default.
 * - Tauri release / production website: off.
 * - Re-enable a production build with `VITE_ENABLE_PAID_CHECKOUT=true`.
 * - Force off even in dev with `VITE_ENABLE_PAID_CHECKOUT=false`.
 */
export function isPaidCheckoutEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_PAID_CHECKOUT;
  if (flag === "true" || flag === "1") {
    return true;
  }
  if (flag === "false" || flag === "0") {
    return false;
  }
  return import.meta.env.DEV;
}

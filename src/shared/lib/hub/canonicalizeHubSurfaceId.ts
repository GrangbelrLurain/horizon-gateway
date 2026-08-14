/** Old infra surface id still appears in bookmarks and call sites. */
export function canonicalizeHubSurfaceId(id: string): string {
  return id === "chrome/infrastructure" ? "chrome/settings" : id;
}

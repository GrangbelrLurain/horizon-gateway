import { commands } from "@/bindings";

export { commands };
export type * from "@/bindings";

export function unwrap<T>(result: { status: "ok"; data: T } | { status: "error"; error: string }): T {
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}

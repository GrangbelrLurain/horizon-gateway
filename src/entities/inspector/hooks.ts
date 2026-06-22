import { useAtom } from "jotai";
import { fetchInspectorEnabled } from "./api";
import { inspectorEnabledAtom } from "./store";

export function useInspector() {
  const [enabled, setEnabled] = useAtom(inspectorEnabledAtom);
  return {
    enabled: enabled ?? false,
    setEnabled,
    refresh: async () => {
      const value = await fetchInspectorEnabled();
      setEnabled(value);
      return value;
    },
  };
}

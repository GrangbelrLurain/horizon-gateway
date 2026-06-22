import { useAtom } from "jotai";
import { fetchMockingEnabled } from "./api";
import { mockingEnabledAtom } from "./store";

export function useMocking() {
  const [enabled, setEnabled] = useAtom(mockingEnabledAtom);
  return {
    enabled: enabled ?? false,
    setEnabled,
    refresh: async () => {
      const value = await fetchMockingEnabled();
      setEnabled(value);
      return value;
    },
  };
}

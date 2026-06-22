import { useAtom, useAtomValue } from "jotai";
import { fetchDomains } from "./api";
import { domainsAtom } from "./store";

export function useDomains() {
  const [domains, setDomains] = useAtom(domainsAtom);
  return {
    domains,
    setDomains,
    count: domains.length,
    isEmpty: domains.length === 0,
    refresh: async () => {
      const data = await fetchDomains();
      setDomains(data);
      return data;
    },
  };
}

export function useDomainCount() {
  const domains = useAtomValue(domainsAtom);
  return domains.length;
}

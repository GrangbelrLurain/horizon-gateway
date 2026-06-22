import { useAtom } from "jotai";
import { fetchApiLoggingLinks } from "./api";
import { apiLoggingLinksAtom } from "./store";

export function useDomainApiLogging() {
  const [links, setLinks] = useAtom(apiLoggingLinksAtom);
  return {
    links,
    setLinks,
    count: links.length,
    refresh: async () => {
      const data = await fetchApiLoggingLinks();
      setLinks(data);
      return data;
    },
  };
}

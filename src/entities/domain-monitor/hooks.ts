import { useAtom } from "jotai";
import { fetchLatestStatus, fetchMonitorLinks } from "./api";
import { monitorLinksAtom, siteCheckAtom } from "./store";

export function useDomainMonitor() {
  const [monitorLinks, setMonitorLinks] = useAtom(monitorLinksAtom);
  const [siteCheck, setSiteCheck] = useAtom(siteCheckAtom);
  return {
    monitorLinks,
    siteCheck,
    setMonitorLinks,
    setSiteCheck,
    refresh: async () => {
      const [links, status] = await Promise.all([fetchMonitorLinks(), fetchLatestStatus()]);
      setMonitorLinks(links);
      setSiteCheck(status);
      return { monitorLinks: links, siteCheck: status };
    },
  };
}

import { useAtom } from "jotai";
import { fetchGroups, fetchLinks } from "./api";
import { groupsAtom, linksAtom } from "./store";

export function useDomainGroups() {
  const [groups, setGroups] = useAtom(groupsAtom);
  const [links, setLinks] = useAtom(linksAtom);
  return {
    groups,
    links,
    setGroups,
    setLinks,
    refresh: async () => {
      const [groupsData, linksData] = await Promise.all([fetchGroups(), fetchLinks()]);
      setGroups(groupsData);
      setLinks(linksData);
      return { groups: groupsData, links: linksData };
    },
  };
}

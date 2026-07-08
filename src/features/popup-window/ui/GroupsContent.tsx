import { useAtom, useAtomValue } from "jotai";
import { Grid, Loader2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/entities/domain";
import { domainsAtom } from "@/entities/domain";
import type { DomainGroup, DomainWithGroupMeta } from "@/entities/domain-group";
import {
  AssignDomainsModal,
  CreateGroupCard,
  EditGroupModal,
  GroupCard,
  groupsAtom,
  linksAtom,
} from "@/entities/domain-group";
import { useDomainHubData } from "@/entities/domain-hub";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { groupsEn } from "../i18n/groups-en";
import { groupsKo } from "../i18n/groups-ko";

const MAX_DOMAINS_PREVIEW = 3;

export function GroupsContent() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? groupsKo : groupsEn;
  const { loading } = useDomainHubData();
  const [groups, setGroups] = useAtom(groupsAtom);
  const [domains] = useAtom(domainsAtom);
  const [links, setLinks] = useAtom(linksAtom);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [assignModalGroup, setAssignModalGroup] = useState<DomainGroup | null>(null);
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<number>>(() => new Set());
  const [isSavingAssign, setIsSavingAssign] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState<DomainGroup | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const domainIdsByGroupId = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const l of links) {
      const arr = map.get(l.group_id) ?? [];
      arr.push(l.domain_id);
      map.set(l.group_id, arr);
    }
    return map;
  }, [links]);

  const fetchLinks = useCallback(async () => {
    try {
      const response = await commands.getDomainGroupLinks().then(unwrap);
      setLinks(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch links:", err);
    }
  }, [setLinks]);

  const getDomainsInGroup = useCallback(
    (groupId: number): Domain[] => {
      const ids = domainIdsByGroupId.get(groupId) ?? [];
      return ids.map((id) => domains.find((d) => d.id === id)).filter((d): d is Domain => d != null);
    },
    [domains, domainIdsByGroupId],
  );

  const allDomainsWithMeta = useMemo((): DomainWithGroupMeta[] => {
    if (!assignModalGroup) {
      return [];
    }
    return domains.map((d) => {
      const groupIds = links
        .filter((l) => l.domain_id === d.id && l.group_id !== assignModalGroup.id)
        .map((l) => l.group_id);
      const otherGroupNames = groupIds
        .map((gid) => groups.find((g) => g.id === gid)?.name)
        .filter((name): name is string => !!name);
      const isUnassigned = !links.some((l) => l.domain_id === d.id);
      return { ...d, otherGroupNames, isUnassigned };
    });
  }, [domains, links, groups, assignModalGroup]);

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      return;
    }
    setIsCreating(true);
    try {
      const response = await commands.createGroup({ name: newGroupName.trim() }).then(unwrap);
      if (response.success) {
        setGroups(response.data);
        setNewGroupName("");
        await notifyHubDataChanged("groups");
      }
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteGroup = async (id: number) => {
    try {
      const response = await commands.deleteGroup({ id }).then(unwrap);
      if (response.success) {
        setGroups(response.data);
        await fetchLinks();
        await notifyHubDataChanged("groups");
      }
      if (assignModalGroup?.id === id) {
        setAssignModalGroup(null);
      }
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  const updateGroupName = async (id: number, name: string) => {
    setIsUpdating(true);
    try {
      const response = await commands.updateGroup({ id, name }).then(unwrap);
      if (response.success) {
        setGroups(response.data);
        setEditGroup(null);
        await notifyHubDataChanged("groups");
      }
    } catch (err) {
      console.error("Failed to update group name:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const openAssignModal = (group: DomainGroup) => {
    setAssignModalGroup(group);
    const domainIds = domainIdsByGroupId.get(group.id) ?? [];
    setSelectedDomainIds(new Set(domainIds));
  };

  const closeAssignModal = () => {
    setAssignModalGroup(null);
    setSelectedDomainIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CreateGroupCard
          value={newGroupName}
          onChange={setNewGroupName}
          onCreate={createGroup}
          isCreating={isCreating}
          translations={{
            title: t.cardCreateTitle,
            placeholder: t.cardCreatePlaceholder,
            btn: t.cardCreateBtn,
          }}
        />

        {loading ? (
          <div className="flex items-center justify-center p-8 col-span-full">
            <Loader2Icon className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : (
          groups.map((group) => {
            const groupDomains = getDomainsInGroup(group.id);
            const preview = groupDomains.slice(0, MAX_DOMAINS_PREVIEW);
            const restCount = groupDomains.length - preview.length;
            return (
              <GroupCard
                key={group.id}
                group={group}
                domainPreview={preview}
                restCount={restCount}
                onOpenAssign={() => openAssignModal(group)}
                onEdit={() => setEditGroup(group)}
                onDelete={() => setDeleteGroupId(group.id)}
                translations={{
                  noDomains: t.cardNoDomains,
                  domainCount: t.cardDomainCount,
                  moreCount: t.cardMoreCount,
                }}
              />
            );
          })
        )}
      </div>

      {!loading && groups.length === 0 && (
        <div className="p-8 rounded-2xl border border-base-300 bg-base-100 text-center shadow-sm">
          <div className="w-12 h-12 bg-base-200 text-base-content/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Grid className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-base-content/70">{t.noGroupsYet}</p>
          <p className="text-xs text-base-content/40 mt-1">{t.noGroupsDesc}</p>
        </div>
      )}

      <AssignDomainsModal
        isOpen={assignModalGroup !== null}
        onClose={closeAssignModal}
        group={assignModalGroup}
        domains={allDomainsWithMeta}
        selectedIds={selectedDomainIds}
        isSaving={isSavingAssign}
        onToggle={(domainId) =>
          setSelectedDomainIds((prev) => {
            const next = new Set(prev);
            if (next.has(domainId)) {
              next.delete(domainId);
            } else {
              next.add(domainId);
            }
            return next;
          })
        }
        onSelectAll={(ids) => setSelectedDomainIds((prev) => new Set([...prev, ...ids]))}
        onDeselectAll={(ids) =>
          setSelectedDomainIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) {
              next.delete(id);
            }
            return next;
          })
        }
        onSave={async () => {
          if (!assignModalGroup) {
            return;
          }
          setIsSavingAssign(true);
          try {
            await commands
              .setGroupDomains({
                groupId: assignModalGroup.id,
                domainIds: Array.from(selectedDomainIds),
              })
              .then(unwrap);
            await fetchLinks();
            closeAssignModal();
            await notifyHubDataChanged("groups");
          } catch (err) {
            console.error("Failed to save domain assignments:", err);
          } finally {
            setIsSavingAssign(false);
          }
        }}
        translations={{
          title: t.assignModalTitle,
          desc: t.assignModalDesc,
          noDomainsText: t.assignModalNoDomainsText,
          addLink: t.assignModalAddLink,
          first: t.assignModalFirst,
          stats: t.assignModalStats,
          selectAll: t.assignModalSelectAll,
          deselectAll: t.assignModalDeselectAll,
          cancel: t.assignModalCancel,
          save: t.assignModalSave,
          searchPlaceholder: t.assignModalSearchPlaceholder,
          filterAll: t.assignModalFilterAll,
          filterUnassigned: t.assignModalFilterUnassigned,
          otherGroups: t.assignModalOtherGroups,
          alreadyInGroup: t.assignModalAlreadyInGroup,
          noDomainsFound: t.assignModalNoDomainsFound,
        }}
      />

      <ConfirmModal
        isOpen={deleteGroupId !== null}
        onClose={() => setDeleteGroupId(null)}
        onConfirm={() => deleteGroupId && deleteGroup(deleteGroupId)}
        title={t.confirmDeleteTitle}
        message={t.confirmDelete}
        confirmText={t.confirmDeleteAction}
        cancelText={t.assignModalCancel}
        type="danger"
      />

      <EditGroupModal
        isOpen={editGroup !== null}
        onClose={() => setEditGroup(null)}
        group={editGroup}
        onSave={updateGroupName}
        isSaving={isUpdating}
        translations={{
          title: t.editModalTitle,
          placeholder: t.cardCreatePlaceholder,
          cancel: t.assignModalCancel,
          save: t.assignModalSave,
        }}
      />
    </div>
  );
}

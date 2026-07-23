import { supabase } from "@/shared/api/supabase";
import type {
  ResourceKind,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceResource,
  WorkspaceRole,
} from "./types";

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase.from("workspaces").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(name: string, ownerId: string): Promise<Workspace> {
  const { data, error } = await supabase.from("workspaces").insert({ name, owner_id: ownerId }).select().single();
  if (error) {
    throw error;
  }
  // Owner is also granted a `workspace_members` row so member listings/RLS include them.
  // A DB trigger may also do this; upsert here is a safe no-op if it already exists.
  const { error: memberError } = await supabase
    .from("workspace_members")
    .upsert({ workspace_id: data.id, profile_id: ownerId, role: "owner" }, { onConflict: "workspace_id,profile_id" });
  if (memberError) {
    console.error("createWorkspace: failed to upsert owner membership:", memberError.message);
  }
  return data as Workspace;
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []) as WorkspaceMember[];
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  invitedBy: string,
  role: WorkspaceRole = "member",
): Promise<WorkspaceInvite> {
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: invitedBy,
      token,
      status: "pending",
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as WorkspaceInvite;
}

export async function listInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as WorkspaceInvite[];
}

export async function acceptInvite(token: string, profileId: string): Promise<WorkspaceMember> {
  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();
  if (inviteError || !invite) {
    throw inviteError ?? new Error("Invite not found or already used");
  }

  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .upsert(
      { workspace_id: invite.workspace_id, profile_id: profileId, role: invite.role },
      { onConflict: "workspace_id,profile_id" },
    )
    .select()
    .single();
  if (memberError) {
    throw memberError;
  }

  const { error: updateError } = await supabase
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);
  if (updateError) {
    console.error("acceptInvite: failed to mark invite accepted:", updateError.message);
  }

  return member as WorkspaceMember;
}

export async function pushResources(
  workspaceId: string,
  kind: ResourceKind,
  payload: unknown,
  updatedBy: string,
): Promise<WorkspaceResource> {
  const { data, error } = await supabase
    .from("workspace_resources")
    .upsert(
      {
        workspace_id: workspaceId,
        kind,
        payload,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,kind" },
    )
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as WorkspaceResource;
}

export async function pullResources(workspaceId: string, kind?: ResourceKind): Promise<WorkspaceResource[]> {
  let query = supabase.from("workspace_resources").select("*").eq("workspace_id", workspaceId);
  if (kind) {
    query = query.eq("kind", kind);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as WorkspaceResource[];
}

export type WorkspaceRole = "owner" | "admin" | "member";
export type WorkspaceStatus = "active" | "past_due" | "canceled";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

/** Sync payload kinds shared with the desktop `.hg.json` export format (see G4). */
export type ResourceKind = "domains" | "groups" | "domain_group_links" | "scenarios" | "mock_rules";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  seat_limit: number;
  status: WorkspaceStatus;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  invited_by: string;
  token: string;
  created_at: string;
}

export interface WorkspaceResource {
  id: string;
  workspace_id: string;
  kind: ResourceKind;
  payload: unknown;
  updated_by: string | null;
  updated_at: string;
}

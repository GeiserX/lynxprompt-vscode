/**
 * Blueprint types the extension pushes; each is a TemplateType of the server.
 * Blueprints read from the server carry any of its types, so they use string.
 */
export type BlueprintType =
  | "AGENTS_MD"
  | "CLAUDE_MD"
  | "CURSOR_RULES"
  | "COPILOT_INSTRUCTIONS"
  | "WINDSURF_RULES"
  | "CLINE_RULES"
  | "CODEX_MD"
  | "CUSTOM";

export type BlueprintTier = "SHORT" | "INTERMEDIATE" | "LONG" | "SUPERLONG";

export type BlueprintVisibility = "PRIVATE" | "TEAM" | "PUBLIC";

export interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  type: string;
  tier: BlueprintTier;
  category: string | null;
  tags: string[];
  visibility: BlueprintVisibility;
  downloads: number;
  favorites: number;
  content: string;
  content_checksum: string;
  repository_path: string | null;
  hierarchy_id: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlueprintListItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  tier: BlueprintTier;
  category: string | null;
  tags: string[];
  visibility: BlueprintVisibility;
  downloads: number;
  favorites: number;
  content_checksum: string;
  repository_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlueprintListResponse {
  blueprints: BlueprintListItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CreateBlueprintRequest {
  name: string;
  description?: string;
  type: string;
  tier?: BlueprintTier;
  category?: string;
  tags?: string[];
  visibility?: BlueprintVisibility;
  content: string;
  /** Workspace-relative path with "/" separators, so a pull writes the same file */
  repository_path?: string;
}

export interface UpdateBlueprintRequest {
  name?: string;
  description?: string;
  type?: BlueprintType;
  tier?: BlueprintTier;
  category?: string;
  tags?: string[];
  visibility?: BlueprintVisibility;
  content?: string;
  /** content_checksum last seen; the server answers 409 when the cloud copy changed since */
  expected_checksum?: string;
}

export interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface UserResponse {
  user: UserInfo;
}

export interface DeviceAuthInitResponse {
  session_id: string;
  auth_url: string;
  expires_at: string;
}

export interface DeviceAuthPollResponse {
  status: "pending" | "completed" | "expired";
  token?: string;
}

export interface HierarchyListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface LocalConfigFile {
  absolutePath: string;
  relativePath: string;
  type: string;
  linkedBlueprintId?: string;
  status: "synced" | "modified" | "untracked";
}

export interface LinkMapping {
  localPath: string;
  blueprintId: string;
  lastChecksum: string;
  /** The blueprint's content_checksum when this file last matched it */
  remoteChecksum?: string;
}

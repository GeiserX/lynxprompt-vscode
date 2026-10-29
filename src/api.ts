import * as vscode from "vscode";
import * as crypto from "crypto";
import {
  Blueprint,
  BlueprintListItem,
  BlueprintListResponse,
  CreateBlueprintRequest,
  UpdateBlueprintRequest,
  UserInfo,
  UserResponse,
  DeviceAuthInitResponse,
  DeviceAuthPollResponse,
  ApiError,
  HierarchyListItem,
} from "./types";
import { getBaseUrl } from "./utils/baseUrl";

/** A non-2xx answer from the API, with its HTTP status. */
export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * A PKCE pair for sign-in: the verifier stays in this process and only its
 * SHA-256 (the challenge) goes into the session the browser URL names, so
 * the session id alone is not enough to collect the token.
 */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export class LynxPromptApi {
  private _token: string | undefined;

  constructor(private readonly _secretStorage: vscode.SecretStorage) {}

  private getBaseUrl(): string {
    return getBaseUrl();
  }

  get token(): string | undefined {
    return this._token;
  }

  async loadToken(): Promise<string | undefined> {
    this._token = await this._secretStorage.get("lynxprompt.token");
    return this._token;
  }

  async setToken(token: string): Promise<void> {
    this._token = token;
    await this._secretStorage.store("lynxprompt.token", token);
  }

  async clearToken(): Promise<void> {
    this._token = undefined;
    await this._secretStorage.delete("lynxprompt.token");
  }

  get isAuthenticated(): boolean {
    return this._token !== undefined && this._token.length > 0;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    authenticated = true,
    extraHeaders: Record<string, string> = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "lynxprompt-vscode/0.1.0",
      ...extraHeaders,
    };

    if (authenticated) {
      if (!this._token) {
        throw new Error("Not authenticated. Please sign in first.");
      }
      headers["Authorization"] = `Bearer ${this._token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorBody = (await response.json()) as ApiError;
        errorMessage = errorBody.error || errorBody.details || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }

      if (response.status === 401) {
        await this.clearToken();
        await vscode.commands.executeCommand(
          "setContext",
          "lynxprompt.authenticated",
          false
        );
        throw new Error("Authentication expired. Please sign in again.");
      }

      throw new ApiRequestError(
        `API error (${response.status}): ${errorMessage}`,
        response.status
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // Auth endpoints
  async initDeviceAuth(codeChallenge: string): Promise<DeviceAuthInitResponse> {
    return this.request<DeviceAuthInitResponse>(
      "POST",
      "/api/cli-auth/init",
      { code_challenge: codeChallenge },
      false
    );
  }

  async pollDeviceAuth(
    sessionId: string,
    verifier: string
  ): Promise<DeviceAuthPollResponse> {
    return this.request<DeviceAuthPollResponse>(
      "GET",
      `/api/cli-auth/poll?session=${encodeURIComponent(sessionId)}`,
      undefined,
      false,
      { "X-CLI-Verifier": verifier }
    );
  }

  /**
   * Revoke the stored token on the server, so signing out ends it there too.
   * Best effort: sign-out clears the local copy whatever this returns.
   */
  async revokeToken(): Promise<void> {
    if (!this._token) {
      return;
    }
    try {
      // Direct fetch with a timeout: an unreachable server must not hold up sign-out
      await fetch(`${this.getBaseUrl()}/api/cli-auth/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this._token}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Offline, or the token is already invalid
    }
  }

  // User endpoints
  async getUser(): Promise<UserInfo> {
    const { user } = await this.request<UserResponse>("GET", "/api/v1/user");
    return user;
  }

  // Blueprint endpoints
  async listBlueprints(
    limit = 100,
    offset = 0,
    visibility?: string
  ): Promise<BlueprintListResponse> {
    let path = `/api/v1/blueprints?limit=${limit}&offset=${offset}`;
    if (visibility) {
      path += `&visibility=${encodeURIComponent(visibility)}`;
    }
    return this.request<BlueprintListResponse>("GET", path);
  }

  /** Every blueprint of the user, following has_more (the server caps a page at 100). */
  async listAllBlueprints(): Promise<BlueprintListItem[]> {
    const all: BlueprintListItem[] = [];
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await this.listBlueprints(limit, offset);
      all.push(...page.blueprints);
      if (!page.has_more || page.blueprints.length === 0) {
        return all;
      }
    }
  }

  async getBlueprint(id: string): Promise<Blueprint> {
    const response = await this.request<{ blueprint: Blueprint }>("GET", `/api/v1/blueprints/${encodeURIComponent(id)}`);
    return response.blueprint;
  }

  async createBlueprint(data: CreateBlueprintRequest): Promise<Blueprint> {
    const response = await this.request<{ blueprint: Blueprint }>("POST", "/api/v1/blueprints", data);
    return response.blueprint;
  }

  async updateBlueprint(
    id: string,
    data: UpdateBlueprintRequest
  ): Promise<Blueprint> {
    const response = await this.request<{ blueprint: Blueprint }>(
      "PUT",
      `/api/v1/blueprints/${encodeURIComponent(id)}`,
      data
    );
    return response.blueprint;
  }

  // Hierarchy endpoints

  /** Every hierarchy of the user, following has_more (the server caps a page at 100). */
  async listAllHierarchies(): Promise<HierarchyListItem[]> {
    const all: HierarchyListItem[] = [];
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await this.request<{ hierarchies: HierarchyListItem[]; has_more?: boolean }>(
        "GET",
        `/api/v1/hierarchies?limit=${limit}&offset=${offset}`
      );
      all.push(...page.hierarchies);
      if (!page.has_more || page.hierarchies.length === 0) {
        return all;
      }
    }
  }

  /** The hierarchy with this repository_root, created when missing. */
  async ensureHierarchy(name: string, repositoryRoot: string): Promise<HierarchyListItem> {
    const response = await this.request<{ hierarchy: HierarchyListItem }>(
      "POST",
      "/api/v1/hierarchies",
      { name, repository_root: repositoryRoot }
    );
    return response.hierarchy;
  }

  async deleteBlueprint(id: string): Promise<void> {
    return this.request<void>(
      "DELETE",
      `/api/v1/blueprints/${encodeURIComponent(id)}`
    );
  }
}

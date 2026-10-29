import * as vscode from "vscode";

export const DEFAULT_BASE_URL = "https://lynxprompt.geiser.cloud";

const LEGACY_BASE_URL = "https://lynxprompt.com";

/**
 * Normalize a configured base URL. The official instance moved from
 * lynxprompt.com to lynxprompt.geiser.cloud, so a saved setting that is
 * exactly the old official URL (with or without trailing slashes) points
 * at the new host. Any other custom URL is kept as is.
 */
export function resolveBaseUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  if (url === "" || url === LEGACY_BASE_URL) {
    return DEFAULT_BASE_URL;
  }
  return url;
}

export function getBaseUrl(): string {
  return resolveBaseUrl(
    vscode.workspace
      .getConfiguration("lynxprompt")
      .get<string>("apiUrl", DEFAULT_BASE_URL)
  );
}

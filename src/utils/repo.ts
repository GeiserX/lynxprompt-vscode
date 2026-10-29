import * as crypto from "crypto";

/**
 * The remote as one canonical https URL, so an SSH clone, an https clone and
 * a ".git" suffix name the same repository. Same rules as the CLI
 * (cli/src/utils/repo-identity.ts) and the GitHub Action:
 * - trim, drop trailing "/", drop a trailing ".git" (any case)
 * - scp style user@host:owner/repo -> https://host/owner/repo
 * - ssh://, git://, git+ssh://, http(s):// -> https://host/path, without credentials or port
 * - lowercase the host only; the path keeps its case
 * Anything else (a local path, file://) is returned trimmed and stripped only.
 */
export function normalizeRemote(remote: string): string {
  const trimmed = remote.trim().replace(/\/+$/, "").replace(/\.git$/i, "");

  const url = trimmed.match(/^(?:https?|ssh|git|git\+ssh|ssh\+git):\/\/([^/]*)(.*)$/i);
  if (url) {
    const authority = url[1];
    const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
    const host = hostPort.startsWith("[")
      ? hostPort.slice(0, hostPort.indexOf("]") + 1)
      : hostPort.replace(/:\d*$/, "");
    return `https://${host.toLowerCase()}/${url[2].replace(/^\/+/, "")}`;
  }

  // scp style: [user@]host:path, with no "://" and no slash before the colon
  const scp = trimmed.match(/^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/);
  if (scp) {
    return `https://${scp[1].toLowerCase()}/${scp[2].replace(/^\/+/, "")}`;
  }

  return trimmed;
}

function hashRoot(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").substring(0, 16);
}

/**
 * The repository_root keys of the hierarchy for a git config: `root` from the
 * normalized remote, `legacyRoot` from the raw remote as clients hashed it
 * before, so a hierarchy created under the old key keeps being used.
 * Undefined when the config names no remote.
 */
export function repositoryRoots(
  gitConfig: string
): { root: string; legacyRoot: string } | undefined {
  const remote = gitConfig.match(/url = (.+)/)?.[1].trim();
  if (!remote) {
    return undefined;
  }
  return { root: hashRoot(normalizeRemote(remote)), legacyRoot: hashRoot(remote) };
}

import * as vscode from "vscode";
import * as path from "path";
import * as crypto from "crypto";
import { LocalConfigFile, LinkMapping } from "../types";
import { pathToBlueprintType, RULE_FILE_GLOBS } from "./fileMapping";

/**
 * Glob patterns for known AI configuration files.
 * .cursorrules is deprecated -- Cursor uses .cursor/rules/*.mdc now.
 * Rules files only: a JSON or YAML tool config (.aider.conf.yml,
 * .continue/config.json) can hold API keys, so it is never offered for push.
 */
const CONFIG_GLOBS: string[] = [...new Set([
  "**/AGENTS.md",
  "**/CLAUDE.md",
  "**/.cursor/rules/*.mdc",
  "**/.cursor/rules/*.md",
  "**/.github/copilot-instructions.md",
  "**/copilot-instructions.md",
  "**/.windsurfrules",
  "**/.clinerules",
  "**/CODEX.md",
  ...RULE_FILE_GLOBS,
])];

/** Patterns to exclude from scanning */
const EXCLUDE_PATTERN = "**/node_modules/**";

export async function detectConfigFiles(
  linkMappings: Map<string, LinkMapping>
): Promise<LocalConfigFile[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const results: LocalConfigFile[] = [];
  const seenPaths = new Set<string>();

  for (const glob of CONFIG_GLOBS) {
    const uris = await vscode.workspace.findFiles(glob, EXCLUDE_PATTERN, 200);
    for (const uri of uris) {
      const absPath = uri.fsPath;
      if (seenPaths.has(absPath)) {
        continue;
      }
      seenPaths.add(absPath);

      const type = pathToBlueprintType(absPath);
      if (!type) {
        continue;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const relativePath = workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, absPath)
        : path.basename(absPath);

      const linkMapping = linkMappings.get(absPath);
      let status: LocalConfigFile["status"] = "untracked";

      if (linkMapping) {
        const currentChecksum = await computeFileChecksum(uri);
        status =
          currentChecksum === linkMapping.lastChecksum ? "synced" : "modified";
      }

      results.push({
        absolutePath: absPath,
        relativePath,
        type,
        linkedBlueprintId: linkMapping?.blueprintId,
        status,
      });
    }
  }

  // Sort: synced first, then modified, then untracked
  const order: Record<string, number> = { synced: 0, modified: 1, untracked: 2 };
  results.sort((a, b) => order[a.status] - order[b.status]);

  return results;
}

export async function computeFileChecksum(uri: vscode.Uri): Promise<string> {
  try {
    const data = await vscode.workspace.fs.readFile(uri);
    return crypto.createHash("sha256").update(data).digest("hex");
  } catch {
    return "";
  }
}

export function getConfigFileType(filePath: string): string | undefined {
  return pathToBlueprintType(filePath);
}

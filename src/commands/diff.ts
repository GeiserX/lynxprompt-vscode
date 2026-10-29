import * as vscode from "vscode";
import * as path from "path";
import { LynxPromptApi } from "../api";
import { BlueprintTreeItem } from "../views/blueprintTree";
import { LocalFileTreeItem } from "../views/localFilesTree";
import { LinkMapping } from "../types";
import { blueprintTypeToPath, resolveInside } from "../utils/fileMapping";

/** URI scheme of the cloud side of a diff, served from memory. */
export const CLOUD_SCHEME = "lynxprompt-cloud";

const cloudContent = new Map<string, string>();
let comparisons = 0;

export const cloudContentProvider: vscode.TextDocumentContentProvider = {
  provideTextDocumentContent: (uri) => cloudContent.get(uri.toString()) ?? "",
};

/** Drop the content of a closed cloud document. */
export function forgetCloudContent(uri: vscode.Uri): void {
  cloudContent.delete(uri.toString());
}

export async function diffBlueprint(
  api: LynxPromptApi,
  linkMappings: Map<string, LinkMapping>,
  item?: BlueprintTreeItem | LocalFileTreeItem | vscode.Uri
): Promise<void> {
  if (!api.isAuthenticated) {
    vscode.window.showErrorMessage("Please sign in to LynxPrompt first.");
    return;
  }

  let blueprintId: string | undefined;
  let localFilePath: string | undefined;

  if (item instanceof BlueprintTreeItem) {
    blueprintId = item.blueprint.id;
  } else if (item instanceof LocalFileTreeItem) {
    localFilePath = item.configFile.absolutePath;
    blueprintId = item.configFile.linkedBlueprintId;
  } else if (item instanceof vscode.Uri) {
    localFilePath = item.fsPath;
    const mapping = linkMappings.get(item.fsPath);
    if (mapping) {
      blueprintId = mapping.blueprintId;
    }
  }

  if (!blueprintId) {
    // Try to pick a blueprint
    const blueprints = await api.listAllBlueprints();
    if (blueprints.length === 0) {
      vscode.window.showInformationMessage("No blueprints available to compare.");
      return;
    }

    const picked = await vscode.window.showQuickPick(
      blueprints.map((bp) => ({
        label: bp.name,
        description: `${bp.type} - ${bp.visibility.toLowerCase()}`,
        blueprintId: bp.id,
        type: bp.type,
      })),
      { placeHolder: "Select a blueprint to compare" }
    );

    if (!picked) {
      return;
    }
    blueprintId = picked.blueprintId;
  }

  // Fetch blueprint
  const blueprint = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Fetching blueprint for comparison...",
    },
    async () => api.getBlueprint(blueprintId!)
  );

  // Find local file
  if (!localFilePath) {
    // Search for the matching local file based on blueprint type
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder open.");
      return;
    }

    // Check link mappings first
    for (const [localPath, mapping] of linkMappings) {
      if (mapping.blueprintId === blueprintId) {
        localFilePath = localPath;
        break;
      }
    }

    // Fallback: try the default path
    if (!localFilePath) {
      const relativePath =
        blueprint.repository_path ||
        blueprintTypeToPath(blueprint.type, blueprint.name, blueprint.content);
      for (const folder of workspaceFolders) {
        const candidatePath = resolveInside(folder.uri.fsPath, relativePath);
        if (!candidatePath) {
          continue;
        }
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(candidatePath));
          localFilePath = candidatePath;
          break;
        } catch {
          // File doesn't exist in this folder
        }
      }
    }
  }

  // The cloud side is a read-only virtual document: nothing is written into
  // the workspace, where a PRIVATE blueprint's content could get committed.
  // One URI per comparison, so an open diff keeps the snapshot it was opened with
  const ext = localFilePath ? path.extname(localFilePath) : ".md";
  const cloudUri = vscode.Uri.from({
    scheme: CLOUD_SCHEME,
    path: `/${++comparisons}/${blueprint.id}-cloud${ext}`,
  });
  cloudContent.set(cloudUri.toString(), blueprint.content);

  if (localFilePath) {
    const localUri = vscode.Uri.file(localFilePath);
    const localRelative = vscode.workspace.asRelativePath(localUri);

    await vscode.commands.executeCommand(
      "vscode.diff",
      localUri,
      cloudUri,
      `${localRelative} (Local) <-> ${blueprint.name} (Cloud)`
    );
  } else {
    // No local file -- just open the cloud content
    const doc = await vscode.workspace.openTextDocument(cloudUri);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
      `No local file found for "${blueprint.name}". Showing cloud version.`
    );
  }
}

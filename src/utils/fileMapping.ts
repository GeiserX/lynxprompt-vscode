import * as path from "path";
import {
  COMMAND_FILES,
  MCP_BLUEPRINT_TYPE,
  MCP_FILE,
  RULE_FILES,
  SKILL_BLUEPRINT_TYPE,
  SKILL_DIRECTORY,
  SUBAGENT_BLUEPRINT_TYPE,
  SUBAGENT_DIRECTORY,
  SUBAGENT_EXTENSION,
} from "./platformTable";

const FALLBACK_FILE = "ai-config.md";

/**
 * Maps a blueprint type to the relative file path where it should be written
 * in a workspace: the file LynxPrompt's shared platform table gives the type,
 * the same one `lynxp pull` writes and the web download names. A type with no
 * file of its own (CUSTOM, retired tools) goes to ai-config.md.
 */
export function blueprintTypeToPath(
  type: string,
  name?: string,
  content?: string
): string {
  if (type === SKILL_BLUEPRINT_TYPE) {
    return `${SKILL_DIRECTORY}/${slug(frontmatterName(content) || name || "") || "skill"}/SKILL.md`;
  }
  if (type === SUBAGENT_BLUEPRINT_TYPE) {
    return `${SUBAGENT_DIRECTORY}/${slug(frontmatterName(content) || name || "") || "agent"}${SUBAGENT_EXTENSION}`;
  }
  if (type === MCP_BLUEPRINT_TYPE) {
    return MCP_FILE;
  }
  const command = COMMAND_FILES[type];
  if (command) {
    return `${command.directory}/${slug(name || "") || "command"}${command.extension}`;
  }
  return RULE_FILES[type] ?? FALLBACK_FILE;
}

/** The `name` field of a leading YAML frontmatter block, if any. */
function frontmatterName(content?: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content ?? "");
  const line = match?.[1].split(/\r?\n/).find((l) => l.startsWith("name:"));
  return line?.slice("name:".length).trim().replace(/^["']|["']$/g, "") || undefined;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Detects the BlueprintType from a file path.
 */
export function pathToBlueprintType(filePath: string): string | undefined {
  const basename = path.basename(filePath);
  const normalized = filePath.replace(/\\/g, "/");

  if (basename === "AGENTS.md") {
    return "AGENTS_MD";
  }
  if (basename === "CLAUDE.md") {
    return "CLAUDE_MD";
  }
  if (
    normalized.includes(".cursor/rules/") &&
    (basename.endsWith(".mdc") || basename.endsWith(".md"))
  ) {
    return "CURSOR_RULES";
  }
  if (basename === "copilot-instructions.md") {
    return "COPILOT_INSTRUCTIONS";
  }
  if (basename === ".windsurfrules") {
    return "WINDSURF_RULES";
  }
  if (basename === ".clinerules") {
    return "CLINE_RULES";
  }
  // Aider's .aider.conf.yml and Continue's config.json are never picked up:
  // a JSON or YAML tool config can hold API keys, as the CLI's scan says
  if (basename === "CODEX.md") {
    return "CODEX_MD";
  }
  // Any other rules file the shared platform table writes (GEMINI.md,
  // .devin/rules/project.md, .clinerules/project.md...), so a pulled file is
  // listed and watched like the others
  for (const [type, file] of Object.entries(RULE_FILES)) {
    if (normalized === file || normalized.endsWith(`/${file}`)) {
      return type;
    }
  }

  return undefined;
}

/** Workspace globs for every rules file the shared platform table writes. */
export const RULE_FILE_GLOBS: string[] = [...new Set(Object.values(RULE_FILES))].map(
  (file) => `**/${file}`
);

/**
 * The absolute path of `relativePath` under `root`, or undefined when it
 * escapes the root (a "../" path, an absolute path). Paths from the server
 * (repository_path) go through this before anything is read or written.
 */
export function resolveInside(root: string, relativePath: string): string | undefined {
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(path.resolve(root), resolved);
  if (
    path.isAbsolute(relativePath) ||
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel)
  ) {
    return undefined;
  }
  return resolved;
}

/**
 * Returns a human-readable label for a blueprint type.
 */
export function blueprintTypeLabel(type: string): string {
  switch (type) {
    case "AGENTS_MD":
      return "AGENTS.md";
    case "CLAUDE_MD":
      return "CLAUDE.md";
    case "CURSOR_RULES":
      return "Cursor Rules";
    case "COPILOT_INSTRUCTIONS":
      return "Copilot Instructions";
    case "WINDSURF_RULES":
      return "Windsurf Rules";
    case "CLINE_RULES":
      return "Cline Rules";
    case "CODEX_MD":
      return "Codex";
    case "CUSTOM":
      return "Custom";
    default:
      return type;
  }
}

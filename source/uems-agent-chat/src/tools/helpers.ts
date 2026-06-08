/**
 * Shared helpers for UEMS LM tools.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Resolve repo paths from workspace folders, matching by name (case-insensitive).
 * Scans up to 3 levels deep from each workspace folder to handle structures like
 * `Code base/windows/uems_agent_framework/` where repos are nested under
 * platform directories.
 */
export function resolveRepoPaths(repoNames?: string[]): string[] {
  const folders = vscode.workspace.workspaceFolders ?? [];

  if (!repoNames || repoNames.length === 0) {
    // No filter — return all workspace folders
    return folders.map(f => f.uri.fsPath);
  }

  const normalized = repoNames.map(n => n.toLowerCase().replace(/\s+/g, '-'));
  const matched = new Set<string>();

  /**
   * Recursively scan directories up to `maxDepth` levels deep, matching
   * directory names against the normalized repo names.
   */
  function scanDir(dirPath: string, depth: number, maxDepth: number): void {
    if (depth > maxDepth) { return; }
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) { continue; }
        const childName = entry.name.toLowerCase().replace(/\s+/g, '-');
        const childPath = path.join(dirPath, entry.name);

        if (normalized.some(n => childName === n || childName.includes(n) || n.includes(childName))) {
          matched.add(childPath);
          // Don't recurse further once matched — this IS the repo
        } else {
          // Not a match — recurse deeper (e.g., "Code base" → "windows" → repos)
          scanDir(childPath, depth + 1, maxDepth);
        }
      }
    } catch {
      // Folder not readable — skip
    }
  }

  for (const folder of folders) {
    const folderName = folder.name.toLowerCase().replace(/\s+/g, '-');
    const folderPath = folder.uri.fsPath;

    // 1. Check the workspace folder itself
    if (normalized.some(n => folderName.includes(n) || n.includes(folderName))) {
      matched.add(folderPath);
      continue;
    }

    // 2. Scan up to 3 levels deep for matching repo directories
    //    Handles: Code base/<platform>/<repo_name>/ (3 levels)
    scanDir(folderPath, 1, 3);
  }

  return [...matched];
}

/**
 * Create a compact text-only tool result.
 * Uses compact JSON (no indentation) to minimize token consumption by the LLM.
 */
export function jsonResult(data: unknown): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(JSON.stringify(data)),
  ]);
}

/** Truncate a string to maxLen, appending '…' if truncated. */
export function truncate(text: string, maxLen = 120): string {
  if (text.length <= maxLen) { return text; }
  return text.slice(0, maxLen - 1) + '…';
}

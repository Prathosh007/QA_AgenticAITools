/**
 * Tool: uems_setup_workspace
 * Clone or fetch multiple repos and verify workspace readiness.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { cloneOrFetch, getRepoStatus, checkoutBranch, CloneResult } from '../core/git-ops';
import { getRepo, getRepos, Platform, RepoInfo } from '../core/repo-registry';
import { jsonResult } from './helpers';

interface SetupWorkspaceInput {
  repos?: string[];
  platform?: Platform;
  targetDir?: string;
  branch?: string;
}

export class SetupWorkspaceTool implements vscode.LanguageModelTool<SetupWorkspaceInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SetupWorkspaceInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repos: repoNames, platform = 'mac', targetDir, branch } = options.input;

    // Determine target directory
    const baseDir = targetDir
      ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      ?? undefined;

    if (!baseDir) {
      return jsonResult({ error: 'No workspace folder open and no targetDir specified.' });
    }

    // Resolve which repos to set up
    let reposToSetup: RepoInfo[];
    if (repoNames && repoNames.length > 0) {
      reposToSetup = repoNames
        .map(name => getRepo(name, platform))
        .filter((r): r is RepoInfo => r !== undefined);

      if (reposToSetup.length === 0) {
        return jsonResult({ error: `No matching repos found for: ${repoNames.join(', ')}` });
      }
    } else {
      // All repos for the platform
      reposToSetup = getRepos(platform);
    }

    // Clone or fetch each repo
    const results: Array<CloneResult & { repoName: string; status?: Awaited<ReturnType<typeof getRepoStatus>> }> = [];

    for (const repo of reposToSetup) {
      const repoDir = path.join(baseDir, repo.name);
      const cloneResult = await cloneOrFetch(repo.gitUrl, repoDir);

      let status;
      if (!cloneResult.error) {
        try {
          status = await getRepoStatus(cloneResult.repoPath);
        } catch {
          // Status check is best-effort
        }
      }

      results.push({ ...cloneResult, repoName: repo.name, status });
    }

    // Checkout branch if requested
    const checkoutResults: string[] = [];
    if (branch) {
      for (const r of results) {
        if (r.error) { continue; }
        const result = await checkoutBranch(r.repoPath, branch);
        if (result.success) {
          checkoutResults.push(`${r.repoName}:checked-out:${branch}`);
        } else {
          checkoutResults.push(`${r.repoName}:checkout-skipped:${result.error}`);
        }
      }
    }

    const cloned = results.filter(r => r.action === 'cloned' && !r.error);
    const fetched = results.filter(r => r.action === 'fetched' && !r.error);
    const errors = results.filter(r => r.error);

    // Compact: "repo:action:branch:clean" or "repo:error:message"
    const repoStatuses = results.map(r => {
      if (r.error) { return `${r.repoName}:error:${r.error}`; }
      const branch = r.status?.branch ?? '?';
      const clean = r.status?.clean ? 'clean' : 'dirty';
      return `${r.repoName}:${r.action}:${branch}:${clean}`;
    });

    return jsonResult({
      cloned: cloned.length,
      fetched: fetched.length,
      errors: errors.length,
      repos: repoStatuses,
      ...(checkoutResults.length > 0 && { checkout: checkoutResults }),
    });
  }
}

/**
 * Tool: uems_agent_diff_branches
 * Get the diff between two branches across one or more repos.
 */

import * as vscode from 'vscode';
import { getDiff } from '../core/git-ops';
import { resolveRepoPaths, jsonResult } from './helpers';

interface DiffBranchesInput {
  repos?: string[];
  sourceBranch: string;
  targetBranch: string;
  files?: string[];
}

export class DiffBranchesTool implements vscode.LanguageModelTool<DiffBranchesInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DiffBranchesInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repos, sourceBranch, targetBranch, files } = options.input;

    if (!sourceBranch || !targetBranch) {
      return jsonResult({ error: 'Both sourceBranch and targetBranch are required.' });
    }

    const repoPaths = resolveRepoPaths(repos);
    if (repoPaths.length === 0) {
      const hint = repos?.length ? repos.join(', ') : 'workspace';
      return jsonResult({ error: `No repos found matching: ${hint}` });
    }

    const results = await Promise.all(
      repoPaths.map(rp => getDiff(rp, sourceBranch, targetBranch, files)),
    );

    const ok = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    const summary = ok.map(r => ({
      repo: r.repo,
      filesChanged: r.totalFilesChanged,
      insertions: r.totalInsertions,
      deletions: r.totalDeletions,
      files: r.stats.map(s => s.file),
      ...(r.totalFilesChanged > 0 ? { diff: r.diff } : {}),
      ...(r.truncated ? { truncated: true } : {}),
    }));

    return jsonResult({
      source: sourceBranch,
      target: targetBranch,
      repos: summary,
      failed: failed.map(r => `${r.repo}: ${r.error}`),
    });
  }
}

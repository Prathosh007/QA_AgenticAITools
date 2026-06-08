/**
 * Tool: uems_create_branch
 * Create a branch from a tag or base branch across one or more repos.
 */

import * as vscode from 'vscode';
import { createBranch, validateBranchName, validateTag } from '../core/git-ops';
import { resolveRepoPaths, jsonResult } from './helpers';

interface CreateBranchInput {
  repos: string[];
  branchName: string;
  fromRef: string;
}

export class CreateBranchTool implements vscode.LanguageModelTool<CreateBranchInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateBranchInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repos, branchName, fromRef } = options.input;

    // Validate branch name
    const branchCheck = validateBranchName(branchName);
    if (!branchCheck.valid) {
      return jsonResult({ error: branchCheck.formatError });
    }

    const repoPaths = resolveRepoPaths(repos);
    if (repoPaths.length === 0) {
      return jsonResult({ error: `None of the specified repos found in workspace: ${repos.join(', ')}` });
    }

    // Validate tag format only if fromRef looks like a tag (contains digits and dots)
    if (/\d{2}\.\d{2}/.test(fromRef)) {
      const tagCheck = await validateTag(repoPaths[0], fromRef);
      if (!tagCheck.valid) {
        return jsonResult({
          error: tagCheck.formatError,
          suggestions: tagCheck.suggestions,
        });
      }
    }

    // Create branch in each repo
    const results = [];
    for (const repoPath of repoPaths) {
      const result = await createBranch(repoPath, branchName, fromRef);
      results.push(result);
    }

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return jsonResult({
      branch: branchName,
      from: fromRef,
      ok: succeeded.map(r => `${r.repo}:${r.sha?.slice(0, 8)}`),
      failed: failed.map(r => `${r.repo}:${r.error}`),
    });
  }
}

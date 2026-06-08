/**
 * Tool: uems_validate_tag
 * Validate a git tag format and check if it exists in a repo.
 */

import * as vscode from 'vscode';
import { validateTag } from '../core/git-ops';
import { resolveRepoPaths, jsonResult } from './helpers';

interface ValidateTagInput {
  repo: string;
  tag: string;
}

export class ValidateTagTool implements vscode.LanguageModelTool<ValidateTagInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ValidateTagInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repo, tag } = options.input;
    const repoPaths = resolveRepoPaths([repo]);

    if (repoPaths.length === 0) {
      return jsonResult({ error: `Repo "${repo}" not found in workspace folders.` });
    }

    const result = await validateTag(repoPaths[0], tag);
    return jsonResult(result);
  }
}

/**
 * Tool: uems_list_components
 * List classes, protocols, structs, enums, or XPC services in a repo.
 */

import * as vscode from 'vscode';
import { listComponents, ComponentInfo, Platform } from '../core/search-engine';
import { resolveRepoPaths, jsonResult } from './helpers';

interface ListComponentsInput {
  repo: string;
  types?: Array<ComponentInfo['type']>;
  platform?: Platform;
}

export class ListComponentsTool implements vscode.LanguageModelTool<ListComponentsInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ListComponentsInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repo, types, platform = 'mac' } = options.input;
    const repoPaths = resolveRepoPaths([repo]);

    if (repoPaths.length === 0) {
      return jsonResult({ error: `Repo "${repo}" not found in workspace folders.` });
    }

    const components = await listComponents(
      repoPaths[0],
      types ?? ['class', 'protocol', 'struct'],
      platform,
    );

    // Group by type → compact "name (file:line)" strings
    const grouped: Record<string, string[]> = {};
    for (const c of components) {
      if (!grouped[c.type]) { grouped[c.type] = []; }
      grouped[c.type].push(`${c.name} (${c.file}:${c.line})`);
    }

    return jsonResult({
      repo,
      platform,
      total: components.length,
      components: grouped,
    });
  }
}

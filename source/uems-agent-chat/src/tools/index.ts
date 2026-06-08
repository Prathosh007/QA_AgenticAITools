/**
 * UEMS LM Tools — barrel export and registration.
 *
 * Each tool is registered via vscode.lm.registerTool() so that
 * Copilot agents can discover and invoke them directly.
 */

import * as vscode from 'vscode';
import { SearchReposTool } from './search-repos';
import { ListComponentsTool } from './list-components';
import { FindWrapperTool } from './find-wrapper';
import { DependencyGraphTool } from './dependency-graph';
import { ValidateTagTool } from './validate-tag';
import { CreateBranchTool } from './create-branch';
import { SetupWorkspaceTool } from './setup-workspace';
import { LoadGuidelinesTool } from './load-guidelines';
import { LoadSkillsTool } from './load-skills';
import { DiffBranchesTool } from './diff-branches';

/**
 * Register all UEMS tools with the VS Code Language Model API.
 * @param outputChannel  Channel for logging.
 * @param repoDir  Path to the synced repo clone in global storage (for guidelines).
 * Returns disposables that should be added to context.subscriptions.
 */
export function registerUemsTools(outputChannel: vscode.OutputChannel, repoDir: string): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  const toolDefs: Array<{ id: string; tool: vscode.LanguageModelTool<unknown> }> = [
    // Phase 2: Codebase navigation
    { id: 'uems_agent_search_repos', tool: new SearchReposTool() },
    { id: 'uems_agent_list_components', tool: new ListComponentsTool() },
    { id: 'uems_agent_find_wrapper', tool: new FindWrapperTool() },
    { id: 'uems_agent_dependency_graph', tool: new DependencyGraphTool() },

    // Phase 4: Branch & repo management
    { id: 'uems_agent_validate_tag', tool: new ValidateTagTool() },
    { id: 'uems_agent_create_branch', tool: new CreateBranchTool() },
    { id: 'uems_agent_setup_workspace', tool: new SetupWorkspaceTool() },

    // Guidelines
    { id: 'uems_agent_load_guidelines', tool: new LoadGuidelinesTool(repoDir) },

    // Skills
    { id: 'uems_agent_load_skills', tool: new LoadSkillsTool(repoDir) },

    // Delta review
    { id: 'uems_agent_diff_branches', tool: new DiffBranchesTool() },
  ];

  for (const { id, tool } of toolDefs) {
    try {
      const disposable = vscode.lm.registerTool(id, tool);
      disposables.push(disposable);
      outputChannel.appendLine(`[UEMS Tools] Registered tool: ${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[UEMS Tools] Failed to register tool ${id}: ${msg}`);
    }
  }

  return disposables;
}

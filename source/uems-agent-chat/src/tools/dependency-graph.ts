/**
 * Tool: uems_dependency_graph
 * Get the dependency graph for a repo or the full platform.
 */

import * as vscode from 'vscode';
import { getDependencyGraph, getRepos, Platform } from '../core/repo-registry';
import { jsonResult } from './helpers';

interface DependencyGraphInput {
  repo?: string;
  platform?: Platform;
  direction?: 'up' | 'down' | 'both';
}

export class DependencyGraphTool implements vscode.LanguageModelTool<DependencyGraphInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DependencyGraphInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repo, platform = 'mac', direction = 'both' } = options.input;

    if (!repo) {
      // Full platform graph — compact: layer → repo names with deps
      const repos = getRepos(platform);
      const layers: Record<number, Record<string, string[]>> = {};
      for (const r of repos) {
        if (!layers[r.layer]) { layers[r.layer] = {}; }
        layers[r.layer][r.name] = r.dependencies;
      }
      return jsonResult({ platform, total: repos.length, layers });
    }

    const graph = getDependencyGraph(repo, platform);

    if (!graph.repo) {
      return jsonResult({ error: `Repo "${repo}" not found for platform "${platform}".` });
    }

    const result: Record<string, unknown> = {
      repo: graph.repo.name,
      layer: graph.repo.layer,
    };

    if (direction === 'up' || direction === 'both') {
      result.upstream = graph.upstream.map(r => `${r.name}(L${r.layer})`);
    }

    if (direction === 'down' || direction === 'both') {
      result.downstream = graph.downstream.map(r => `${r.name}(L${r.layer})`);
    }

    return jsonResult(result);
  }
}

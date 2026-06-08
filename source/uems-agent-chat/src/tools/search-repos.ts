/**
 * Tool: uems_search_repos
 * Search for code patterns across multiple workspace repos simultaneously.
 */

import * as vscode from 'vscode';
import { searchRepos, normalizeQuery } from '../core/search-engine';
import { resolveRepoPaths, jsonResult, truncate } from './helpers';
import { lookupRepoPlatform } from '../core/repo-registry';

interface SearchReposInput {
  query: string;
  repos?: string[];
  filePattern?: string;
  maxResults?: number;
  isRegex?: boolean;
}

export class SearchReposTool implements vscode.LanguageModelTool<SearchReposInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SearchReposInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { repos, filePattern, maxResults } = options.input;
    const repoPaths = resolveRepoPaths(repos);

    if (repoPaths.length === 0) {
      return jsonResult({ error: 'No matching repos found in workspace.' });
    }

    // Normalize multi-term queries: space, |, & separated terms → regex alternation
    const normalized = normalizeQuery(options.input.query, options.input.isRegex ?? false);

    const result = await searchRepos({
      query: normalized.query,
      repoPaths,
      filePattern,
      maxResults: maxResults ?? 200,
      isRegex: normalized.isRegex,
    });

    // Group by repo → compact "file:line:text" strings
    const grouped: Record<string, string[]> = {};
    for (const m of result.matches) {
      if (!grouped[m.repo]) { grouped[m.repo] = []; }
      grouped[m.repo].push(`${m.file}:${m.line}:${truncate(m.text.trim())}`);
    }

    // Attach platform metadata for each repo so the agent knows which platform
    // a .h / .swift / .go file belongs to without relying on file extension alone.
    const repoPlatforms: Record<string, string> = {};
    for (const repoName of Object.keys(grouped)) {
      const platform = lookupRepoPlatform(repoName);
      if (platform) { repoPlatforms[repoName] = platform; }
    }

    return jsonResult({
      total: result.matches.length,
      truncated: result.truncated,
      ...(Object.keys(repoPlatforms).length > 0 && { repoPlatforms }),
      results: grouped,
    });
  }
}

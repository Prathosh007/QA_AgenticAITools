/**
 * Repository metadata registry — pure data, no VS Code dependency.
 * Source of truth for repo URLs, dependency layers, and cross-repo impact.
 *
 * Repo data is loaded at runtime from the synced repo directory (source/common/repos.json).
 * Returns empty repos if sync hasn't occurred yet.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RepoInfo {
  name: string;
  gitUrl: string;
  layer: number;
  platform: 'mac' | 'linux' | 'windows' | 'cross-platform';
  dependencies: string[];
  description: string;
  isDeliverable: boolean;
}

export type Platform = 'mac' | 'linux' | 'windows' | 'cross-platform';

/** Path to the synced repo directory — set via initRepoRegistry(). */
let repoDir: string | undefined;

/** Cached platform repos — rebuilt when repoDir changes or on first access. */
let cachedPlatformRepos: Record<Platform, Record<string, RepoInfo>> | undefined;

/**
 * Initialize the repo registry with the synced repo directory.
 * Call once at extension activation. If sync updates repos.json later,
 * call again to reload.
 */
export function initRepoRegistry(syncedRepoDir: string): void {
  repoDir = syncedRepoDir;
  cachedPlatformRepos = undefined; // force reload on next access
}

/** Build RepoInfo records from the JSON data, injecting `name` and `platform` from keys. */
function loadPlatformRepos(platform: Platform, data: Record<string, unknown>): Record<string, RepoInfo> {
  const result: Record<string, RepoInfo> = {};
  for (const [key, value] of Object.entries(data)) {
    const entry = value as Record<string, unknown>;
    result[key] = {
      name: key,
      gitUrl: entry.gitUrl as string,
      layer: entry.layer as number,
      platform,
      dependencies: entry.dependencies as string[],
      description: entry.description as string,
      isDeliverable: entry.isDeliverable as boolean,
    };
  }
  return result;
}

/**
 * Load repo data from the synced path. Returns empty structure if sync hasn't occurred yet.
 */
function loadRepoData(): Record<string, unknown> {
  if (repoDir) {
    const syncedPath = path.join(repoDir, 'source', 'common', 'repos.json');
    try {
      if (fs.existsSync(syncedPath)) {
        const content = fs.readFileSync(syncedPath, 'utf-8');
        return JSON.parse(content) as Record<string, unknown>;
      }
    } catch {
      // Synced file unreadable — return empty
    }
  }
  return { 'cross-platform': {}, mac: {}, linux: {}, windows: {} };
}

function getPlatformRepos(): Record<Platform, Record<string, RepoInfo>> {
  if (!cachedPlatformRepos) {
    const data = loadRepoData();
    const crossPlatform = loadPlatformRepos('cross-platform', data['cross-platform'] as Record<string, unknown>);
    const result: Record<Platform, Record<string, RepoInfo>> = {
      mac: { ...crossPlatform, ...loadPlatformRepos('mac', data.mac as Record<string, unknown>) },
      linux: { ...crossPlatform, ...loadPlatformRepos('linux', data.linux as Record<string, unknown>) },
      windows: { ...crossPlatform, ...loadPlatformRepos('windows', data.windows as Record<string, unknown>) },
      'cross-platform': crossPlatform,
    };
    // Only cache if data was actually loaded — don't cache empty fallback
    // so the next call retries after sync delivers the file.
    const hasData = Object.keys(crossPlatform).length > 0;
    if (hasData) { cachedPlatformRepos = result; }
    return result;
  }
  return cachedPlatformRepos;
}

/** Get all repos for a platform. */
export function getRepos(platform: Platform): RepoInfo[] {
  return Object.values(getPlatformRepos()[platform] ?? {});
}

/** Get a specific repo by name (case-insensitive, normalizes hyphens and underscores). */
export function getRepo(name: string, platform: Platform): RepoInfo | undefined {
  const key = name.toLowerCase().replace(/[\s-]/g, '_');
  const repos = getPlatformRepos()[platform] ?? {};
  // Try exact match first, then normalized match
  return repos[name] ?? repos[key] ?? Object.values(repos).find(
    r => r.name.toLowerCase().replace(/[\s-]/g, '_') === key,
  );
}

/** Get all repos at a given dependency layer. */
export function getReposByLayer(layer: number, platform: Platform): RepoInfo[] {
  return getRepos(platform).filter(r => r.layer === layer);
}

/** Get upstream dependencies (repos this repo depends on), recursively. */
export function getUpstreamDeps(repoName: string, platform: Platform): RepoInfo[] {
  const repo = getRepo(repoName, platform);
  if (!repo) { return []; }

  const visited = new Set<string>();
  const result: RepoInfo[] = [];

  function walk(deps: string[]) {
    for (const depName of deps) {
      if (visited.has(depName)) { continue; }
      visited.add(depName);
      const dep = getRepo(depName, platform);
      if (dep) {
        result.push(dep);
        walk(dep.dependencies);
      }
    }
  }

  walk(repo.dependencies);
  return result.sort((a, b) => a.layer - b.layer);
}

/** Get downstream dependents (repos that depend on this repo). */
export function getDownstreamDeps(repoName: string, platform: Platform): RepoInfo[] {
  const key = repoName.toLowerCase().replace(/[\s-]/g, '_');
  return getRepos(platform).filter(r =>
    r.dependencies.some(d => d.toLowerCase().replace(/[\s-]/g, '_') === key)
  );
}

export interface DependencyGraph {
  layers: Record<number, RepoInfo[]>;
  upstream: RepoInfo[];
  downstream: RepoInfo[];
  repo: RepoInfo | undefined;
}

/**
 * Look up which platform a repo natively belongs to, checking specific platform
 * sections before cross-platform. Returns undefined if the repo is not registered.
 *
 * This works from the raw JSON so cross-platform repos don't get misattributed
 * as mac/linux/windows just because they're merged into those sets.
 */
export function lookupRepoPlatform(repoName: string): Platform | undefined {
  const data = loadRepoData();
  const normalized = repoName.toLowerCase().replace(/[\s-]/g, '_');
  const platforms: Platform[] = ['mac', 'linux', 'windows', 'cross-platform'];
  for (const p of platforms) {
    const key = p === 'cross-platform' ? 'cross-platform' : p;
    const section = data[key] as Record<string, unknown> | undefined;
    if (!section) { continue; }
    const found = Object.keys(section).find(
      k => k === repoName || k.toLowerCase().replace(/[\s-]/g, '_') === normalized,
    );
    if (found) { return p; }
  }
  return undefined;
}

/** Get the full dependency graph for a repo or all repos on a platform. */
export function getDependencyGraph(repoName: string | undefined, platform: Platform): DependencyGraph {
  const repos = getRepos(platform);
  const layers: Record<number, RepoInfo[]> = {};
  for (const r of repos) {
    if (!layers[r.layer]) { layers[r.layer] = []; }
    layers[r.layer].push(r);
  }

  const repo = repoName ? getRepo(repoName, platform) : undefined;
  const upstream = repo ? getUpstreamDeps(repo.name, platform) : [];
  const downstream = repo ? getDownstreamDeps(repo.name, platform) : [];

  return { layers, upstream, downstream, repo };
}

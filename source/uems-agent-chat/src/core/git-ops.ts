/**
 * Git operations — pure functions, no VS Code dependency.
 * Uses child_process to call git CLI. Can be used from extension or standalone.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT = 30_000;

export interface GitExecResult {
  stdout: string;
  stderr: string;
}

async function git(repoPath: string, args: string[]): Promise<GitExecResult> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: repoPath,
    timeout: GIT_TIMEOUT,
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
}

// ── Tag operations ──────────────────────────────────────────────

export interface TagValidation {
  tag: string;
  valid: boolean;
  exists: boolean;
  formatError?: string;
  suggestions: string[];
}

/**
 * Tag format: PRODUCTNAME_YY.MM.BUILD
 * e.g. AGENT_UTILS_26.05.01, UEMS_GO_COMPONENTS_26.03.01
 */
const TAG_PATTERN = /^[A-Z][A-Z0-9_]*_\d{2}\.\d{2}\.\d{2,3}$/;
const TAG_EXAMPLE = 'AGENT_UTILS_26.05.01';
const BARE_VERSION_PATTERN = /^\d{2}\.\d{2}\.\d{2,3}$/;

export async function validateTag(repoPath: string, tag: string): Promise<TagValidation> {
  const pattern = TAG_PATTERN;
  const example = TAG_EXAMPLE;
  const isBareVersion = BARE_VERSION_PATTERN.test(tag);
  const valid = isBareVersion || pattern.test(tag);
  let exists = false;
  let suggestions: string[] = [];

  if (!isBareVersion) {
    try {
      await git(repoPath, ['rev-parse', '--verify', `refs/tags/${tag}`]);
      exists = true;
    } catch {
      // Tag doesn't exist
    }
  }

  if (!exists) {
    try {
      // For bare versions (e.g. "26.11.01"), search with wildcards on both sides
      // For full tags, extract the product prefix and search by prefix
      let searchPattern: string;
      if (isBareVersion) {
        searchPattern = `*${tag}*`;
      } else {
        const parts = tag.split('_');
        const prefix = parts.length >= 3 ? parts.slice(0, -1).join('_') : tag.substring(0, Math.min(15, tag.length));
        searchPattern = `${prefix}*`;
      }
      const { stdout } = await git(repoPath, ['tag', '-l', searchPattern, '--sort=-version:refname']);
      suggestions = stdout.split('\n').filter(Boolean).slice(0, 5);
    } catch {
      // No suggestions available
    }
  }

  return {
    tag,
    valid,
    exists,
    formatError: valid ? undefined : `Tag "${tag}" does not match expected format: PRODUCTNAME_YY.MM.BUILD (e.g. ${example})`,
    suggestions,
  };
}

// ── Branch operations ───────────────────────────────────────────

/**
 * Branch naming convention from git-conventions.md:
 * feature/<topic>, bugfix/<topic>, hotfix/<topic>, release/<version>
 */
const BRANCH_PATTERN = /^(feature|bugfix|hotfix|release)\/[a-z0-9][a-z0-9._-]*$/;

export interface BranchValidation {
  branchName: string;
  valid: boolean;
  formatError?: string;
}

export function validateBranchName(branchName: string): BranchValidation {
  const valid = BRANCH_PATTERN.test(branchName);
  return {
    branchName,
    valid,
    formatError: valid ? undefined : `Branch "${branchName}" does not follow convention: feature/<topic>, bugfix/<topic>, hotfix/<topic>, or release/<version>. Use lowercase with hyphens.`,
  };
}

export interface BranchResult {
  repo: string;
  repoPath: string;
  success: boolean;
  sha?: string;
  error?: string;
}

export async function createBranch(
  repoPath: string,
  branchName: string,
  fromRef: string,
): Promise<BranchResult> {
  const repoName = path.basename(repoPath);
  try {
    // Verify the base ref exists
    await git(repoPath, ['rev-parse', '--verify', fromRef]);
    // Create and checkout
    await git(repoPath, ['checkout', '-b', branchName, fromRef]);
    const { stdout: sha } = await git(repoPath, ['rev-parse', 'HEAD']);
    return { repo: repoName, repoPath, success: true, sha };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { repo: repoName, repoPath, success: false, error: msg };
  }
}

// ── Repo status ─────────────────────────────────────────────────

export interface RepoStatus {
  repoPath: string;
  branch: string;
  clean: boolean;
  uncommittedFiles: string[];
}

export async function getRepoStatus(repoPath: string): Promise<RepoStatus> {
  const { stdout: branch } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const { stdout: status } = await git(repoPath, ['status', '--porcelain']);
  const uncommittedFiles = status.split('\n').filter(Boolean);
  return {
    repoPath,
    branch,
    clean: uncommittedFiles.length === 0,
    uncommittedFiles,
  };
}

// ── Checkout ────────────────────────────────────────────────────

export async function checkoutBranch(
  repoPath: string,
  branch: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if branch exists locally or as remote tracking branch
    try {
      await git(repoPath, ['rev-parse', '--verify', branch]);
    } catch {
      // Try remote
      try {
        await git(repoPath, ['rev-parse', '--verify', `origin/${branch}`]);
        // Create local tracking branch
        await git(repoPath, ['checkout', '-b', branch, `origin/${branch}`]);
        return { success: true };
      } catch {
        return { success: false, error: `Branch '${branch}' not found locally or in remote.` };
      }
    }
    await git(repoPath, ['checkout', branch]);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Clone / fetch ───────────────────────────────────────────────

export interface CloneResult {
  repoPath: string;
  action: 'cloned' | 'fetched' | 'already-exists';
  error?: string;
}

export async function cloneOrFetch(
  gitUrl: string,
  targetDir: string,
): Promise<CloneResult> {
  try {
    const stat = await fs.stat(targetDir).catch(() => null);
    if (stat?.isDirectory()) {
      // Check if it's a git repo
      try {
        await git(targetDir, ['rev-parse', '--is-inside-work-tree']);
        await git(targetDir, ['fetch', '--all', '--tags']);
        return { repoPath: targetDir, action: 'fetched' };
      } catch {
        // Directory exists but not a git repo
        return { repoPath: targetDir, action: 'already-exists', error: 'Directory exists but is not a git repository.' };
      }
    }

    // Clone
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await execFileAsync('git', ['clone', gitUrl, targetDir], { timeout: 120_000 });
    return { repoPath: targetDir, action: 'cloned' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { repoPath: targetDir, action: 'cloned', error: msg };
  }
}

// ── List tags ───────────────────────────────────────────────────

export async function listTags(repoPath: string, pattern?: string): Promise<string[]> {
  const args = ['tag', '-l', '--sort=-version:refname'];
  if (pattern) { args.splice(2, 0, pattern); }
  const { stdout } = await git(repoPath, args);
  return stdout.split('\n').filter(Boolean);
}

// ── List branches ───────────────────────────────────────────────

export async function listBranches(repoPath: string, remote = false): Promise<string[]> {
  const args = remote
    ? ['branch', '-r', '--format=%(refname:short)']
    : ['branch', '--format=%(refname:short)'];
  const { stdout } = await git(repoPath, args);
  return stdout.split('\n').filter(Boolean);
}
// ── Diff between branches ───────────────────────────────────

export interface DiffStat {
  file: string;
  insertions: number;
  deletions: number;
}

export interface BranchDiff {
  repo: string;
  repoPath: string;
  sourceBranch: string;
  targetBranch: string;
  stats: DiffStat[];
  totalInsertions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  diff: string;
  truncated?: boolean;
  error?: string;
}

/**
 * Get diff between two branches (target...source — changes in source not in target).
 * Returns both the unified diff and per-file stats.
 * Pass `files` to scope the diff to specific paths (for batched reviews).
 */
export async function getDiff(
  repoPath: string,
  sourceBranch: string,
  targetBranch: string,
  files?: string[],
): Promise<BranchDiff> {
  const repoName = path.basename(repoPath);
  const base: BranchDiff = {
    repo: repoName,
    repoPath,
    sourceBranch,
    targetBranch,
    stats: [],
    totalInsertions: 0,
    totalDeletions: 0,
    totalFilesChanged: 0,
    diff: '',
  };

  try {
    // Resolve refs — try as-is first, then origin/<ref> for remote branches
    const resolveRef = async (ref: string): Promise<string> => {
      try {
        await git(repoPath, ['rev-parse', '--verify', ref]);
        return ref;
      } catch {
        // Try remote-tracking branch
        const remoteRef = `origin/${ref}`;
        await git(repoPath, ['rev-parse', '--verify', remoteRef]);
        return remoteRef;
      }
    };

    const resolvedSource = await resolveRef(sourceBranch);
    const resolvedTarget = await resolveRef(targetBranch);

    // Build path filter args
    const pathArgs = files?.length ? ['--', ...files] : [];

    // Get numstat for per-file stats
    const { stdout: numstat } = await git(repoPath, [
      'diff', '--numstat', `${resolvedTarget}...${resolvedSource}`, ...pathArgs,
    ]);

    for (const line of numstat.split('\n').filter(Boolean)) {
      const [ins, del, file] = line.split('\t');
      const insertions = ins === '-' ? 0 : parseInt(ins, 10);
      const deletions = del === '-' ? 0 : parseInt(del, 10);
      base.stats.push({ file, insertions, deletions });
      base.totalInsertions += insertions;
      base.totalDeletions += deletions;
    }
    base.totalFilesChanged = base.stats.length;

    // Get unified diff
    const { stdout: rawDiff } = await git(repoPath, [
      'diff', `${resolvedTarget}...${resolvedSource}`, ...pathArgs,
    ]);

    const MAX_DIFF_BYTES = 512_000;
    if (rawDiff.length > MAX_DIFF_BYTES) {
      base.diff = rawDiff.slice(0, MAX_DIFF_BYTES);
      base.truncated = true;
    } else {
      base.diff = rawDiff;
    }

    return base;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, error: msg };
  }
}
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

/** Hardcoded sync config — not user-configurable */
const GIT_REPO_URL = 'https://git.csez.zohocorpin.com/uems/native/uems-ai-toolkit.git';
const GIT_BRANCH = 'master';
const GIT_SUB_PATHS = [
  'agents/orchestrator/agents',
  'agents/document-generator',
  'agents/delta-reviewer',
  'agents/testcase-generator',
  'guidelines',
  'skills',
  'source/common',
  'source/uems-agent-chat/releases',
];

export interface SyncResult {
  updated: boolean;
  filesUpdated: number;
  skipped?: boolean;
  error?: string;
}

interface SyncMeta {
  lastSyncTime: number;
  lastSyncVersion: string;
}

/**
 * Manages syncing agent `.md` files from a remote git repository
 * into the extension's bundled assets directory.
 */
export class AgentSyncManager {
  private readonly agentsDir: string;
  private readonly skillsDir: string;
  private readonly cloneDir: string;
  private readonly metaFile: string;
  private readonly outputChannel: vscode.OutputChannel;
  private syncing = false;

  /** Path to the synced repo clone in global storage (or workspace path in dev mode). */
  get repoDir(): string {
    if (this.isDevMode()) {
      const devPath = this.getDevRepoPath();
      if (devPath) { return devPath; }
    }
    return this.cloneDir;
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ) {
    this.agentsDir = path.join(context.extensionPath, 'assets', 'agents');
    this.skillsDir = path.join(context.extensionPath, 'assets', 'skills');
    this.cloneDir = path.join(context.globalStorageUri.fsPath, 'agent-repo');
    this.metaFile = path.join(context.globalStorageUri.fsPath, 'sync-meta.json');
    this.outputChannel = outputChannel;
  }

  /**
   * Sync agent files from the configured git repo.
   * @param force  If true, ignore cooldown and sync immediately (e.g. manual trigger).
   * Returns a result indicating whether files were updated.
   */
  async sync(force = false): Promise<SyncResult> {
    // In dev mode, skip remote sync — use local workspace files directly
    if (this.isDevMode()) {
      const devPath = this.getDevRepoPath();
      if (devPath) {
        this.log(`Dev mode active — using local repo at ${devPath}. Skipping remote sync.`);
        // Still copy agent files from local repo to assets/ so chatAgents picks them up
        return this.syncFromLocal(devPath);
      }
      this.log('Dev mode enabled but no uems-ai-toolkit workspace folder found. Falling back to remote sync.');
    }

    if (this.syncing) {
      this.log('Sync already in progress, skipping');
      return { updated: false, filesUpdated: 0 };
    }

    // Check cooldown unless forced
    if (!force) {
      const cooldownMs = this.getSyncIntervalMs();
      const meta = await this.readMeta();
      if (meta && (Date.now() - meta.lastSyncTime) < cooldownMs) {
        const minutesAgo = Math.round((Date.now() - meta.lastSyncTime) / 60_000);
        this.log(`Skipping sync — last synced ${minutesAgo}m ago (cooldown: ${Math.round(cooldownMs / 60_000)}m).`);
        return { updated: false, filesUpdated: 0, skipped: true };
      }
    }

    this.syncing = true;

    try {
      const repoUrl = GIT_REPO_URL;
      const branch = GIT_BRANCH;
      const subPaths = GIT_SUB_PATHS;

      if (!repoUrl) {
        this.log('No git repo URL configured.');
        return { updated: false, filesUpdated: 0, error: 'No repository URL configured.' };
      }

      // Verify git is available
      try {
        await execFileAsync('git', ['--version']);
      } catch {
        return { updated: false, filesUpdated: 0, error: 'Git is not installed or not in PATH.' };
      }

      // Ensure global storage directory exists
      await fs.mkdir(path.dirname(this.cloneDir), { recursive: true });

      // Clone or pull
      const repoExists = await this.directoryExists(this.cloneDir);
      if (repoExists) {
        await this.gitPull(branch);
      } else {
        await this.gitClone(repoUrl, branch);
      }

      // Scan all configured subdirectories for agent files
      const sourceDirs = subPaths.length > 0
        ? subPaths.map(p => path.join(this.cloneDir, p.replace(/^\//, '')))
        : [this.cloneDir];

      const remoteFiles: string[] = [];
      for (const dir of sourceDirs) {
        const found = await this.findAgentFiles(dir);
        this.log(`Scanned ${dir}: found ${found.length} agent file(s)`);
        remoteFiles.push(...found);
      }

      if (remoteFiles.length === 0) {
        this.log('No .agent.md files found in any configured path.');
        return { updated: false, filesUpdated: 0 };
      }

      // Compare and copy changed files
      let filesUpdated = 0;
      for (const remoteFile of remoteFiles) {
        const fileName = path.basename(remoteFile);
        const localFile = path.join(this.agentsDir, fileName);

        const remoteContent = await fs.readFile(remoteFile, 'utf-8');
        let localContent = '';
        try {
          localContent = await fs.readFile(localFile, 'utf-8');
        } catch {
          // File doesn't exist locally yet
        }

        if (remoteContent !== localContent) {
          await fs.mkdir(this.agentsDir, { recursive: true });
          await fs.writeFile(localFile, remoteContent, 'utf-8');
          this.log(`Updated: ${fileName}`);
          filesUpdated++;
        }
      }

      // Remove agent files that no longer exist in remote
      const remoteFileNames = new Set(remoteFiles.map(f => path.basename(f)));
      const localFiles = await this.findAgentFiles(this.agentsDir);
      for (const localFile of localFiles) {
        const fileName = path.basename(localFile);
        if (!remoteFileNames.has(fileName)) {
          await fs.rm(localFile);
          this.log(`Removed: ${fileName} (no longer in remote)`);
          filesUpdated++;
        }
      }

      // Sync skill directories (each skill is a folder with SKILL.md)
      const skillsSourceDir = path.join(this.cloneDir, 'skills');
      filesUpdated += await this.syncSkillDirs(skillsSourceDir, this.skillsDir);

      // Always reconcile package.json chatAgents and chatSkills with what's on disk
      await this.updatePackageJsonAgents();
      await this.updatePackageJsonSkills();

      if (filesUpdated > 0) {
        this.log(`Sync complete: ${filesUpdated} file(s) updated.`);
      } else {
        this.log('Sync complete: all files up to date.');
      }

      // Persist sync metadata
      await this.writeMeta({
        lastSyncTime: Date.now(),
        lastSyncVersion: this.context.extension.packageJSON.version as string
      });

      return { updated: filesUpdated > 0, filesUpdated };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Sync error: ${message}`);
      return { updated: false, filesUpdated: 0, error: message };
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Clone the repo using sparse checkout — only fetches the agents subdirectory.
   * This is dramatically faster for large repos.
   */
  private async gitClone(url: string, branch: string): Promise<void> {
    const subPaths = GIT_SUB_PATHS;

    this.log(`Cloning ${url} (branch: ${branch}, sparse paths: [${subPaths.join(', ') || '/'}])...`);

    // Ensure a clean directory exists for the clone
    await fs.rm(this.cloneDir, { recursive: true, force: true });
    await fs.mkdir(this.cloneDir, { recursive: true });

    // Init empty repo
    await execFileAsync('git', ['init'], { cwd: this.cloneDir, timeout: 10_000 });
    await execFileAsync('git', ['remote', 'add', 'origin', url], { cwd: this.cloneDir, timeout: 10_000 });

    // Enable sparse checkout so we only download the agent folders
    await execFileAsync('git', ['config', 'core.sparseCheckout', 'true'], { cwd: this.cloneDir, timeout: 10_000 });

    // Write sparse-checkout patterns — one line per path
    const sparsePatterns = subPaths.length > 0
      ? subPaths.map(p => `${p}/*`).join('\n')
      : '*.agent.md';
    const sparseFile = path.join(this.cloneDir, '.git', 'info', 'sparse-checkout');
    await fs.mkdir(path.dirname(sparseFile), { recursive: true });
    await fs.writeFile(sparseFile, sparsePatterns + '\n', 'utf-8');

    // Fetch only the latest commit of the target branch
    await execFileAsync('git', ['fetch', '--depth', '1', 'origin', branch], { cwd: this.cloneDir, timeout: 120_000 });
    await execFileAsync('git', ['checkout', branch], { cwd: this.cloneDir, timeout: 30_000 });

    this.log('Sparse clone complete.');
  }

  /**
   * Pull latest changes in the existing sparse clone.
   */
  private async gitPull(branch: string): Promise<void> {
    this.log(`Pulling latest (branch: ${branch})...`);
    try {
      // Update sparse-checkout patterns in case GIT_SUB_PATHS changed since last clone
      const subPaths = GIT_SUB_PATHS;
      const sparsePatterns = subPaths.length > 0
        ? subPaths.map(p => `${p}/*`).join('\n')
        : '*.agent.md';
      const sparseFile = path.join(this.cloneDir, '.git', 'info', 'sparse-checkout');
      await fs.writeFile(sparseFile, sparsePatterns + '\n', 'utf-8');

      await execFileAsync('git', ['fetch', '--depth', '1', 'origin', branch], { cwd: this.cloneDir, timeout: 60_000 });
      await execFileAsync('git', ['reset', '--hard', `origin/${branch}`], { cwd: this.cloneDir, timeout: 30_000 });
      this.log('Pull complete.');
    } catch (err: unknown) {
      // If pull fails, re-clone
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log(`Pull failed (${errMsg}), re-cloning...`);
      await fs.rm(this.cloneDir, { recursive: true, force: true });

      await this.gitClone(GIT_REPO_URL, branch);
    }
  }

  /**
   * Find all *.agent.md files in a directory.
   */
  private async findAgentFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter(e => e.isFile() && e.name.endsWith('.agent.md'))
        .map(e => path.join(dir, e.name));
    } catch {
      return [];
    }
  }

  /**
   * Find skill subdirectories (each containing a SKILL.md file).
   */
  private async findSkillDirs(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const skillDirs: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillFile = path.join(dir, entry.name, 'SKILL.md');
          try {
            await fs.access(skillFile);
            skillDirs.push(entry.name);
          } catch {
            // Not a valid skill directory — skip
          }
        }
      }
      return skillDirs;
    } catch {
      return [];
    }
  }

  /**
   * Sync skill directories from source to destination.
   * Each skill is a folder containing SKILL.md.
   */
  private async syncSkillDirs(sourceDir: string, destDir: string): Promise<number> {
    let filesUpdated = 0;
    const remoteSkills = await this.findSkillDirs(sourceDir);

    for (const skill of remoteSkills) {
      const srcFile = path.join(sourceDir, skill, 'SKILL.md');
      const destSkillDir = path.join(destDir, skill);
      const destFile = path.join(destSkillDir, 'SKILL.md');

      const srcContent = await fs.readFile(srcFile, 'utf-8');
      let destContent = '';
      try { destContent = await fs.readFile(destFile, 'utf-8'); } catch { /* new file */ }

      if (srcContent !== destContent) {
        await fs.mkdir(destSkillDir, { recursive: true });
        await fs.writeFile(destFile, srcContent, 'utf-8');
        this.log(`Updated skill: ${skill}/SKILL.md`);
        filesUpdated++;
      }
    }

    // Remove skills that no longer exist in remote
    const localSkills = await this.findSkillDirs(destDir);
    for (const skill of localSkills) {
      if (!remoteSkills.includes(skill)) {
        await fs.rm(path.join(destDir, skill), { recursive: true });
        this.log(`Removed skill: ${skill} (no longer in remote)`);
        filesUpdated++;
      }
    }

    return filesUpdated;
  }

  /**
   * After syncing new agent files, update the extension's package.json
   * chatAgents entries to include any new files or remove deleted ones.
   */
  private async updatePackageJsonAgents(): Promise<void> {
    try {
      const pkgPath = path.join(this.context.extensionPath, 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      const agentFiles = await this.findAgentFiles(this.agentsDir);
      const newChatAgents = agentFiles.map(f => ({
        path: `./assets/agents/${path.basename(f)}`
      }));

      // Only update if the list changed  
      const existingPaths = new Set(
        (pkg.contributes?.chatAgents || []).map((a: { path: string }) => a.path)
      );
      const newPaths = new Set(newChatAgents.map(a => a.path));

      const changed = existingPaths.size !== newPaths.size ||
        [...newPaths].some(p => !existingPaths.has(p));

      if (changed) {
        pkg.contributes.chatAgents = newChatAgents;
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        this.log('Updated package.json chatAgents entries.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log(`Warning: Could not update package.json: ${errMsg}`);
    }
  }

  /**
   * After syncing skill directories, update the extension's package.json
   * chatSkills entries to match what's on disk.
   */
  private async updatePackageJsonSkills(): Promise<void> {
    try {
      const pkgPath = path.join(this.context.extensionPath, 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      const skillNames = await this.findSkillDirs(this.skillsDir);
      const newChatSkills = skillNames.map(name => ({
        path: `./assets/skills/${name}/SKILL.md`,
      }));

      const existingPaths = new Set(
        (pkg.contributes?.chatSkills || []).map((s: { path: string }) => s.path),
      );
      const newPaths = new Set(newChatSkills.map(s => s.path));

      const changed = existingPaths.size !== newPaths.size ||
        [...newPaths].some(p => !existingPaths.has(p));

      if (changed) {
        pkg.contributes.chatSkills = newChatSkills;
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        this.log('Updated package.json chatSkills entries.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log(`Warning: Could not update package.json chatSkills: ${errMsg}`);
    }
  }

  /**
   * Check whether local agent files exist from a previous sync.
   */
  async hasLocalAgents(): Promise<boolean> {
    const files = await this.findAgentFiles(this.agentsDir);
    return files.length > 0;
  }

  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the configured sync interval in milliseconds.
   */
  private getSyncIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('uems-agent-chat');
    const hours = config.get<number>('syncIntervalHours', 24);
    return hours * 60 * 60 * 1000;
  }

  /**
   * Get the last sync timestamp (epoch ms), or null if never synced.
   */
  async getLastSyncTime(): Promise<number | null> {
    const meta = await this.readMeta();
    return meta?.lastSyncTime ?? null;
  }

  /**
   * Read sync metadata from disk.
   */
  private async readMeta(): Promise<SyncMeta | null> {
    try {
      const content = await fs.readFile(this.metaFile, 'utf-8');
      return JSON.parse(content) as SyncMeta;
    } catch {
      return null;
    }
  }

  /**
   * Write sync metadata to disk.
   */
  private async writeMeta(meta: SyncMeta): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.metaFile), { recursive: true });
      await fs.writeFile(this.metaFile, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Non-critical — just means next activation will re-sync
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Check if dev mode is enabled via settings.
   */
  private isDevMode(): boolean {
    const config = vscode.workspace.getConfiguration('uems-agent-chat');
    return config.get<boolean>('devMode', false);
  }

  /**
   * Resolve the local uems-ai-toolkit repo path for dev mode.
   * Uses the explicit setting if provided, otherwise auto-detects from workspace folders.
   */
  private getDevRepoPath(): string | undefined {
    const config = vscode.workspace.getConfiguration('uems-agent-chat');
    const explicit = config.get<string>('devRepoPath', '');
    if (explicit) { return explicit; }

    // Auto-detect: look for a workspace folder that contains guidelines/ and agents/
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const fsPath = folder.uri.fsPath;
      try {
        const hasGuidelines = existsSync(path.join(fsPath, 'guidelines'));
        const hasAgents = existsSync(path.join(fsPath, 'agents'));
        if (hasGuidelines && hasAgents) { return fsPath; }
      } catch {
        // skip
      }
    }
    return undefined;
  }

  /**
   * Sync agent files from a local repo directory instead of remote.
   * Copies .agent.md files from the local source paths to the assets directory.
   */
  private async syncFromLocal(localRepoDir: string): Promise<SyncResult> {
    try {
      const sourceDirs = GIT_SUB_PATHS.map(p => path.join(localRepoDir, p.replace(/^\//, '')));

      const localFiles: string[] = [];
      for (const dir of sourceDirs) {
        const found = await this.findAgentFiles(dir);
        this.log(`[Dev] Scanned ${dir}: found ${found.length} agent file(s)`);
        localFiles.push(...found);
      }

      let filesUpdated = 0;
      for (const srcFile of localFiles) {
        const fileName = path.basename(srcFile);
        const destFile = path.join(this.agentsDir, fileName);

        const srcContent = await fs.readFile(srcFile, 'utf-8');
        let destContent = '';
        try { destContent = await fs.readFile(destFile, 'utf-8'); } catch { /* new file */ }

        if (srcContent !== destContent) {
          await fs.mkdir(this.agentsDir, { recursive: true });
          await fs.writeFile(destFile, srcContent, 'utf-8');
          this.log(`[Dev] Updated: ${fileName}`);
          filesUpdated++;
        }
      }

      // Remove agent files not present in local source
      const localFileNames = new Set(localFiles.map(f => path.basename(f)));
      const assetFiles = await this.findAgentFiles(this.agentsDir);
      for (const assetFile of assetFiles) {
        const fileName = path.basename(assetFile);
        if (!localFileNames.has(fileName)) {
          await fs.rm(assetFile);
          this.log(`[Dev] Removed: ${fileName} (not in local source)`);
          filesUpdated++;
        }
      }

      // Sync skill directories from local source
      const skillsSourceDir = path.join(localRepoDir, 'skills');
      filesUpdated += await this.syncSkillDirs(skillsSourceDir, this.skillsDir);

      await this.updatePackageJsonAgents();
      await this.updatePackageJsonSkills();

      if (filesUpdated > 0) {
        this.log(`[Dev] Local sync complete: ${filesUpdated} file(s) updated.`);
      } else {
        this.log('[Dev] Local sync: all files up to date.');
      }

      return { updated: filesUpdated > 0, filesUpdated };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`[Dev] Local sync error: ${message}`);
      return { updated: false, filesUpdated: 0, error: message };
    }
  }
}

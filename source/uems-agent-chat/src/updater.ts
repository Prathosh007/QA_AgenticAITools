import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execFileAsync = promisify(execFile);

/**
 * Shape of the `latest.json` manifest stored in the git repo.
 *
 * Example:
 * ```json
 * {
 *   "version": "0.2.0",
 *   "vsixFile": "uems-agent-chat-0.2.0.vsix",
 *   "changelog": "- Added new planner agent\n- Bug fixes",
 *   "minVSCodeVersion": "1.108.0"
 * }
 * ```
 */
export interface VersionManifest {
  version: string;
  /** Filename of the .vsix in the same releases/ directory */
  vsixFile: string;
  changelog?: string;
  minVSCodeVersion?: string;
}

/**
 * Handles automatic extension self-update by checking a version manifest
 * in the same git repo used for agent sync.
 *
 * Flow:
 *   1. Read `latest.json` from the local sparse clone (populated by AgentSyncManager)
 *   2. Compare semver with the currently installed extension version
 *   3. If newer, copy the .vsix from the clone's releases/ directory
 *   4. Install it via `code --install-extension` and prompt to reload
 */
export class ExtensionUpdater {
  /** Path where `latest.json` is expected inside the sparse clone */
  static readonly MANIFEST_RELATIVE_PATH = 'source/uems-agent-chat/releases/latest.json';

  /** Directory containing the VSIX files alongside latest.json */
  static readonly RELEASES_RELATIVE_DIR = 'source/uems-agent-chat/releases';

  private readonly outputChannel: vscode.OutputChannel;
  private readonly currentVersion: string;
  private readonly cloneDir: string;
  private readonly downloadDir: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ) {
    this.outputChannel = outputChannel;
    this.currentVersion = context.extension.packageJSON.version as string;
    this.cloneDir = path.join(context.globalStorageUri.fsPath, 'agent-repo');
    this.downloadDir = path.join(context.globalStorageUri.fsPath, 'downloads');
  }

  /**
   * Check for a newer extension version and offer to install it.
   * Returns true if an update was installed (reload pending).
   *
   * @param options.suppressReload  If true, skip the "Reload Window" prompt
   *   after installing — the caller is responsible for prompting reload
   *   (useful when combining the reload prompt with other operations like sync).
   */
  async checkForUpdate(options?: { suppressReload?: boolean }): Promise<boolean> {
    try {
      const manifest = await this.readManifest();
      if (!manifest) {
        this.log('No version manifest found — skipping update check.');
        return false;
      }

      this.log(`Current version: ${this.currentVersion}, latest: ${manifest.version}`);

      if (!this.isNewer(manifest.version, this.currentVersion)) {
        this.log('Extension is up to date.');
        return false;
      }

      // Check VS Code version compatibility
      if (manifest.minVSCodeVersion && !this.meetsMinVSCode(manifest.minVSCodeVersion)) {
        this.log(`Update ${manifest.version} requires VS Code ${manifest.minVSCodeVersion}, skipping.`);
        return false;
      }

      // Verify the VSIX file exists in the clone
      const vsixSource = path.join(this.cloneDir, ExtensionUpdater.RELEASES_RELATIVE_DIR, manifest.vsixFile);
      try {
        await fs.access(vsixSource);
      } catch {
        this.log(`VSIX file not found in clone: ${vsixSource}`);
        return false;
      }

      // Ask user before proceeding
      const changelogSnippet = manifest.changelog
        ? `\n\nChangelog:\n${manifest.changelog}`
        : '';
      const choice = await vscode.window.showInformationMessage(
        `UEMS Agent Chat: Version ${manifest.version} is available (current: ${this.currentVersion}).${changelogSnippet}`,
        'Install Update',
        'Skip'
      );

      if (choice !== 'Install Update') {
        this.log('User skipped the update.');
        return false;
      }

      // Copy and install
      return await this.copyAndInstall(manifest, vsixSource, options?.suppressReload ?? false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`Update check failed: ${msg}`);
      return false;
    }
  }

  /**
   * Read the version manifest from the local sparse clone.
   */
  private async readManifest(): Promise<VersionManifest | null> {
    const manifestPath = path.join(this.cloneDir, ExtensionUpdater.MANIFEST_RELATIVE_PATH);
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as VersionManifest;
      if (!manifest.version || !manifest.vsixFile) {
        this.log('Manifest is missing required fields (version, vsixFile).');
        return null;
      }
      return manifest;
    } catch {
      // File doesn't exist yet — that's fine, no update available
      return null;
    }
  }

  /**
   * Copy the VSIX from the sparse clone and install it.
   */
  private async copyAndInstall(manifest: VersionManifest, vsixSource: string, suppressReload: boolean): Promise<boolean> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'UEMS Agent Chat',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: `Installing v${manifest.version}...` });

          // Copy VSIX to a temp location (install may fail if reading from sparse clone directly)
          await fs.mkdir(this.downloadDir, { recursive: true });
          const vsixPath = path.join(this.downloadDir, manifest.vsixFile);
          await fs.copyFile(vsixSource, vsixPath);
          this.log(`Copied VSIX to ${vsixPath}`);

          // Install the extension. Prefer the VS Code internal command (no CLI needed);
          // fall back to the `code` CLI with platform-aware executable name.
          let installError: unknown;
          try {
            await vscode.commands.executeCommand(
              'workbench.extensions.installExtension',
              vscode.Uri.file(vsixPath)
            );
            installError = null;
          } catch (err) {
            installError = err;
          }

          if (installError !== null) {
            // CLI fallback: on Windows the shell script is code.cmd, not code
            const codeCli = os.platform() === 'win32' ? 'code.cmd' : 'code';
            await execFileAsync(codeCli, ['--install-extension', vsixPath, '--force'], {
              timeout: 60_000,
              shell: true,
            });
          }
          this.log(`Installed VSIX v${manifest.version}`);

          // Clean up copied file
          await fs.rm(vsixPath, { force: true }).catch(() => { /* ignore */ });

          // Prompt reload unless caller handles it (e.g. combined sync + upgrade prompt)
          if (!suppressReload) {
            const reload = await vscode.window.showInformationMessage(
              `UEMS Agent Chat has been updated to v${manifest.version}. Reload to activate.`,
              'Reload Window'
            );
            if (reload === 'Reload Window') {
              await vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
          }

          return true;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.log(`Failed to install update: ${msg}`);
          vscode.window.showErrorMessage(`UEMS Agent Chat: Update failed — ${msg}`);
          return false;
        }
      }
    );
  }

  /**
   * Compare two semver strings. Returns true if `next` > `current`.
   */
  private isNewer(next: string, current: string): boolean {
    const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
    const [nMaj, nMin, nPat] = parse(next);
    const [cMaj, cMin, cPat] = parse(current);

    if (nMaj !== cMaj) { return nMaj > cMaj; }
    if (nMin !== cMin) { return nMin > cMin; }
    return nPat > cPat;
  }

  /**
   * Check whether the running VS Code meets the minimum version requirement.
   */
  private meetsMinVSCode(minVersion: string): boolean {
    return this.isNewer(vscode.version, minVersion) || vscode.version.startsWith(minVersion);
  }

  private log(message: string): void {
    const ts = new Date().toISOString();
    this.outputChannel.appendLine(`[${ts}] [Updater] ${message}`);
  }
}

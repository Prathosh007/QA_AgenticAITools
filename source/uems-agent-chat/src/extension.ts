import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentSyncManager } from './sync';
import { ExtensionUpdater } from './updater';
import { registerUemsTools } from './tools';
import { HttpBridge } from './http-bridge';
import { initRepoRegistry, getRepos } from './core/repo-registry';
import { runToolLoop } from './orchestrator';
import { cloneOrFetch } from './core/git-ops';

let syncManager: AgentSyncManager | undefined;
let syncTimer: ReturnType<typeof setInterval> | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;
let httpBridge: HttpBridge | undefined;

/**
 * Read the system prompt from an agent .md file, stripping the YAML frontmatter.
 */
async function loadAgentPrompt(extensionPath: string, filename: string): Promise<string> {
  const filePath = path.join(extensionPath, 'assets', 'agents', filename);
  const content = await fs.readFile(filePath, 'utf-8');
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

export async function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  outputChannel = vscode.window.createOutputChannel('UEMS Agent Chat');
  context.subscriptions.push(outputChannel);

  syncManager = new AgentSyncManager(context, outputChannel);

  // Ensure agent files exist before registering the participant.
  // On first install (no local agents), sync synchronously so the
  // handler never hits a missing file.  On subsequent activations do
  // a quiet background check that won't block startup.
  const hasAgents = await syncManager.hasLocalAgents();
  if (!hasAgents) {
    outputChannel.appendLine('[UEMS Agent Chat] No local agents found — syncing from git before registering participant...');
    await syncWithProgress();
  }

  // Register orchestrator chat participant with tool-calling support
  const orchestratorHandler: vscode.ChatRequestHandler = async (request, ctx, stream, token) => {
    try {
      const systemPrompt = await loadAgentPrompt(context.extensionPath, 'uems-agent-explorer.agent.md');
      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
      ];

      // Include conversation history so the model retains context across turns
      for (const turn of ctx.history) {
        if (turn instanceof vscode.ChatRequestTurn) {
          messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
        } else if (turn instanceof vscode.ChatResponseTurn) {
          const responseText = turn.response
            .filter((part): part is vscode.ChatResponseMarkdownPart => part instanceof vscode.ChatResponseMarkdownPart)
            .map((part) => part.value.value)
            .join('');
          if (responseText) {
            messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
          }
        }
      }

      messages.push(vscode.LanguageModelChatMessage.User(`query: ${request.prompt}`));

      // Use shared orchestrator tool loop
      await runToolLoop({
        messages,
        model: request.model,
        token,
        toolInvocationToken: request.toolInvocationToken,
        callbacks: {
          onText: (content) => stream.markdown(content),
          onToolStart: () => { /* Chat UI handles this natively */ },
          onToolEnd: () => { /* Chat UI handles this natively */ },
          onError: (message) => stream.markdown(`\n\n**Error:** ${message}`),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[Orchestrator error] ${msg}`);
      stream.markdown(`**Error:** ${msg}`);
    }
  };
  const participant = vscode.chat.createChatParticipant('uems-agent-chat.explorer', orchestratorHandler);
  context.subscriptions.push(participant);
  outputChannel.appendLine('[UEMS Agent Chat] Registered participant: uems-agent-chat.explorer');

  // Register UEMS LM tools
  initRepoRegistry(syncManager.repoDir);
  const toolDisposables = registerUemsTools(outputChannel, syncManager.repoDir);
  context.subscriptions.push(...toolDisposables);

  // Start HTTP bridge for external frontends (web app)
  const bridgeConfig = vscode.workspace.getConfiguration('uems-agent-chat');
  const bridgeEnabled = bridgeConfig.get<boolean>('httpBridge.enabled', false);
  const bridgePort = bridgeConfig.get<number>('httpBridge.port', 3111);

  if (bridgeEnabled) {
    // Bridge uses whichever folder VS Code was opened on — no workspace switching.
    httpBridge = new HttpBridge(outputChannel, context.extensionPath, syncManager.repoDir);
    httpBridge.start(bridgePort).catch((err) => {
      outputChannel.appendLine(`[HTTP Bridge] Failed to start: ${err.message}`);
    });
    context.subscriptions.push({ dispose: () => httpBridge?.stop() });
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('uems-agent-chat.syncAgents', async () => {
      await syncWithProgress();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('uems-agent-chat.openChat', async () => {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: '@UEMS-Agent ',
        isPartialQuery: true
      });
    })
  );

  // Check prerequisites: git + Copilot Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('uems-agent-chat.checkPrerequisites', async () => {
      const results: string[] = [];
      let allGood = true;

      // Check git
      try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync('git', ['--version']);
        results.push(`$(check) Git — ${stdout.trim()}`);
      } catch {
        results.push('$(error) Git — not found in PATH');
        allGood = false;
      }

      // Check Copilot Chat extension
      const copilot = vscode.extensions.getExtension('GitHub.copilot-chat');
      if (copilot) {
        results.push(`$(check) GitHub Copilot Chat — v${copilot.packageJSON?.version ?? 'installed'}`);
      } else {
        results.push('$(error) GitHub Copilot Chat — not installed');
        allGood = false;
      }

      if (allGood) {
        vscode.window.showInformationMessage(
          `UEMS Agent Chat: All prerequisites met.\n${results.join('\n')}`
        );
      } else {
        const action = await vscode.window.showWarningMessage(
          `UEMS Agent Chat: Missing prerequisites.\n${results.join('\n')}`,
          'Install Copilot Chat'
        );
        if (action === 'Install Copilot Chat') {
          await vscode.commands.executeCommand(
            'workbench.extensions.installExtension',
            'GitHub.copilot-chat'
          );
        }
      }
    })
  );

  // Setup workspace: clone repos for a platform
  context.subscriptions.push(
    vscode.commands.registerCommand('uems-agent-chat.setupWorkspace', async (args?: { platform?: string }) => {
      const platforms = ['mac', 'linux', 'windows'] as const;
      let platform = args?.platform;

      if (!platform || !platforms.includes(platform as typeof platforms[number])) {
        platform = await vscode.window.showQuickPick([...platforms], {
          placeHolder: 'Select your development platform',
          title: 'UEMS Agent Chat: Setup Workspace',
        });
      }

      if (!platform) { return; }

      // Pick a folder for repos
      const folders = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Repos Folder',
        title: `Clone ${platform} repos into…`,
      });

      if (!folders || folders.length === 0) { return; }
      const targetDir = folders[0].fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'UEMS Agent Chat',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: `Setting up ${platform} workspace…` });

          const repos = getRepos(platform as 'mac' | 'linux' | 'windows');
          let cloned = 0;
          let fetched = 0;
          let errors = 0;

          for (const repo of repos) {
            progress.report({ message: `Cloning ${repo.name} (${cloned + fetched + errors + 1}/${repos.length})…` });
            const result = await cloneOrFetch(repo.gitUrl, path.join(targetDir, repo.name));
            if (result.error) { errors++; }
            else if (result.action === 'cloned') { cloned++; }
            else { fetched++; }
          }

          const msg = `Workspace ready: ${cloned} cloned, ${fetched} fetched, ${errors} failed (${repos.length} total)`;
          if (errors > 0) {
            vscode.window.showWarningMessage(`UEMS Agent Chat: ${msg}`);
          } else {
            vscode.window.showInformationMessage(`UEMS Agent Chat: ${msg}`);
          }
        },
      );
    })
  );

  // Status bar item — shows last sync time, click for details
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  statusBarItem.command = 'uems-agent-chat.showSyncStatus';
  context.subscriptions.push(statusBarItem);
  await updateStatusBar();

  // Register the status popup command
  context.subscriptions.push(
    vscode.commands.registerCommand('uems-agent-chat.showSyncStatus', async () => {
      await showSyncStatusPopup();
    })
  );

  // Background sync — first-run sync already happened above if needed
  if (hasAgents) {
    syncQuietly();
  }

  // Schedule periodic sync
  schedulePeriodicSync(context);

  // Watch for config changes to reschedule sync
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('uems-agent-chat')) {
        schedulePeriodicSync(context);
      }
    })
  );

  outputChannel.appendLine('[UEMS Agent Chat] Extension activated');
}

/**
 * Sync with a VS Code progress notification (user-triggered).
 * Checks for extension self-update first, then syncs agent files.
 * Shows a single combined "Reload Window" prompt for both.
 */
async function syncWithProgress(): Promise<void> {
  if (!syncManager) { return; }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'UEMS Agent Chat',
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: 'Syncing agent files from remote...' });
      const result = await syncManager!.sync(true);
      // Re-init repo registry so it picks up newly synced repos.json
      initRepoRegistry(syncManager!.repoDir);

      // Check for extension self-update (latest.json is now fresh)
      let updateInstalled = false;
      const cfg = vscode.workspace.getConfiguration('uems-agent-chat');
      if (cfg.get<boolean>('autoUpdate', true)) {
        progress.report({ message: 'Checking for extension update...' });
        const updater = new ExtensionUpdater(extensionContext, outputChannel);
        updateInstalled = await updater.checkForUpdate({ suppressReload: true });
      }

      // Single combined reload prompt
      const needsReload = updateInstalled || result.updated;
      if (needsReload) {
        const parts: string[] = [];
        if (updateInstalled) { parts.push('extension updated'); }
        if (result.updated) { parts.push(`${result.filesUpdated} agent file(s) synced`); }
        const reload = await vscode.window.showInformationMessage(
          `UEMS Agent Chat: ${parts.join(', ')}. Reload window to apply changes.`,
          'Reload Window'
        );
        if (reload === 'Reload Window') {
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      } else if (result.error) {
        vscode.window.showErrorMessage(`UEMS Agent Chat: Sync failed — ${result.error}`);
      } else {
        vscode.window.showInformationMessage('UEMS Agent Chat: Agent files are up to date.');
      }
      await updateStatusBar();
    }
  );
}

/**
 * Sync silently in the background (periodic / on-activation).
 * Checks for extension self-update after sync, with a single combined reload prompt.
 */
async function syncQuietly(): Promise<void> {
  if (!syncManager) { return; }

  const result = await syncManager.sync();
  // Re-init repo registry so it picks up newly synced repos.json
  initRepoRegistry(syncManager.repoDir);
  await updateStatusBar();

  // Check for extension self-update (latest.json is now fresh)
  let updateInstalled = false;
  const cfg = vscode.workspace.getConfiguration('uems-agent-chat');
  if (cfg.get<boolean>('autoUpdate', true)) {
    const updater = new ExtensionUpdater(extensionContext, outputChannel);
    updateInstalled = await updater.checkForUpdate({ suppressReload: true });
  }

  // Single combined reload prompt
  const needsReload = updateInstalled || result.updated;
  if (needsReload) {
    const parts: string[] = [];
    if (updateInstalled) { parts.push('extension updated'); }
    if (result.updated) { parts.push(`${result.filesUpdated} agent file(s) synced`); }
    const reload = await vscode.window.showInformationMessage(
      `UEMS Agent Chat: ${parts.join(', ')}. Reload window to apply.`,
      'Reload Window',
      'Dismiss'
    );
    if (reload === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }
}

/**
 * Show a popup with sync status details and action options.
 */
async function showSyncStatusPopup(): Promise<void> {
  if (!syncManager) { return; }

  const lastSync = await syncManager.getLastSyncTime();
  const hasAgents = await syncManager.hasLocalAgents();

  const items: vscode.QuickPickItem[] = [];

  // Info header
  if (lastSync) {
    const date = new Date(lastSync).toLocaleString();
    const ago = formatTimeAgo(lastSync);
    items.push({ label: '$(clock) Last Synced', description: `${date} (${ago})`, kind: vscode.QuickPickItemKind.Default });
  } else {
    items.push({ label: '$(clock) Last Synced', description: 'Never', kind: vscode.QuickPickItemKind.Default });
  }

  items.push({ label: '$(package) Agents', description: hasAgents ? 'Installed' : 'Not installed' });

  // Separator
  items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

  // Actions
  const syncNow: vscode.QuickPickItem = { label: '$(sync) Sync Now', description: 'Fetch latest agents & guidelines from remote' };
  const openChat: vscode.QuickPickItem = { label: '$(comment-discussion) Open Chat', description: 'Open Copilot Chat with UEMS Agent' };
  const viewLogs: vscode.QuickPickItem = { label: '$(output) View Logs', description: 'Open UEMS Agent Chat output channel' };
  items.push(syncNow, openChat, viewLogs);

  const picked = await vscode.window.showQuickPick(items, {
    title: 'UEMS Agent Chat',
    placeHolder: 'Select an action',
  });

  if (picked === syncNow) {
    await syncWithProgress();
  } else if (picked === openChat) {
    await vscode.commands.executeCommand('uems-agent-chat.openChat');
  } else if (picked === viewLogs) {
    outputChannel.show();
  }
}

/**
 * Update the status bar item with last sync time.
 */
async function updateStatusBar(): Promise<void> {
  if (!statusBarItem || !syncManager) { return; }

  const lastSync = await syncManager.getLastSyncTime();
  if (lastSync) {
    const ago = formatTimeAgo(lastSync);
    statusBarItem.text = `$(octoface) UEMS Agent`;
    statusBarItem.tooltip = `UEMS Agent — Last synced: ${new Date(lastSync).toLocaleString()} (${ago})\nClick for options`;
  } else {
    statusBarItem.text = '$(octoface) UEMS Agent';
    statusBarItem.tooltip = 'UEMS Agent — Never synced\nClick for options';
  }
  statusBarItem.show();
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) { return 'just now'; }
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Schedule periodic sync based on the configured interval.
 */
function schedulePeriodicSync(context: vscode.ExtensionContext): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }

  const config = vscode.workspace.getConfiguration('uems-agent-chat');
  const autoSync = config.get<boolean>('autoSync', true);
  const intervalHours = config.get<number>('syncIntervalHours', 24);

  if (!autoSync) {
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  syncTimer = setInterval(() => {
    syncQuietly();
  }, intervalMs);

  // Ensure timer is cleaned up on deactivation
  context.subscriptions.push({ dispose: () => { if (syncTimer) { clearInterval(syncTimer); } } });
}

export function deactivate() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}

/**
 * Tool: uems_agent_load_guidelines
 * Load engineering guidelines, security standards, and coding conventions
 * from the synced guidelines store (global storage) instead of cloning the repo.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { jsonResult } from './helpers';

interface LoadGuidelinesInput {
  platform?: string;
  category?: string;
  files?: string[];
}

interface GuidelineFile {
  path: string;
  content: string;
}

export class LoadGuidelinesTool implements vscode.LanguageModelTool<LoadGuidelinesInput> {
  constructor(private readonly repoDir: string) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LoadGuidelinesInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const platform = options.input.platform ?? 'mac';
    const category = options.input.category ?? 'all';
    const fileFilter = options.input.files?.length ? new Set(options.input.files) : null;

    const guidelinesDir = path.join(this.repoDir, 'guidelines');
    const docStandardsDir = path.join(this.repoDir, 'agents', 'document-generator', 'doc-standards');
    const reviewStandardsDir = path.join(this.repoDir, 'agents', 'delta-reviewer', 'review-standards');

    const result: Record<string, GuidelineFile[]> = {};

    try {
      if (category === 'all' || category === 'common') {
        result.common = await this.readDir(path.join(guidelinesDir, 'common'), 'guidelines/common', fileFilter);
      }

      if (category === 'all' || category === 'platform') {
        const platformDir = path.join(guidelinesDir, platform);
        result.platform = await this.readDir(platformDir, `guidelines/${platform}`, fileFilter);
      }

      if (category === 'all' || category === 'doc-standards') {
        result['doc-standards'] = await this.readDir(docStandardsDir, 'agents/document-generator/doc-standards', fileFilter);
      }

      if (category === 'all' || category === 'review-standards') {
        result['review-standards'] = await this.readDir(reviewStandardsDir, 'agents/delta-reviewer/review-standards', fileFilter);
      }

      const totalFiles = Object.values(result).reduce((sum, files) => sum + files.length, 0);
      if (totalFiles === 0) {
        return jsonResult({
          error: 'No guideline files found. Run "UEMS Agent Chat: Sync Agent Files" first.',
        });
      }

      return jsonResult({ platform, category, files: result });
    } catch {
      return jsonResult({
        error: 'Guidelines not synced yet. Run "UEMS Agent Chat: Sync Agent Files" to fetch them.',
      });
    }
  }

  private async readDir(dir: string, label: string, fileFilter: Set<string> | null): Promise<GuidelineFile[]> {
    const files: GuidelineFile[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          if (fileFilter && !fileFilter.has(entry.name)) { continue; }
          const filePath = path.join(dir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          files.push({ path: `${label}/${entry.name}`, content });
        }
      }
    } catch {
      // Directory doesn't exist — skip
    }
    return files;
  }
}

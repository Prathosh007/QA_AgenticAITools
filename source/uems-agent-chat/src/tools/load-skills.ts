/**
 * Tool: uems_agent_load_skills
 * Load reusable skill procedures (SKILL.md files) from the synced skills store.
 * Skills are agent-specific procedures extracted from guidelines for focused loading.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { jsonResult } from './helpers';

interface LoadSkillsInput {
  files?: string[];
}

interface SkillFile {
  path: string;
  content: string;
}

export class LoadSkillsTool implements vscode.LanguageModelTool<LoadSkillsInput> {
  constructor(private readonly repoDir: string) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LoadSkillsInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const fileFilter = options.input.files?.length ? new Set(options.input.files) : null;
    const skillsDir = path.join(this.repoDir, 'skills');

    try {
      const skills = await this.readSkills(skillsDir, fileFilter);

      if (skills.length === 0) {
        return jsonResult({
          error: fileFilter
            ? `No matching skills found for: ${[...fileFilter].join(', ')}. Run "UEMS Agent Chat: Sync Agent Files" if skills are missing.`
            : 'No skill files found. Run "UEMS Agent Chat: Sync Agent Files" first.',
        });
      }

      return jsonResult({ skills });
    } catch {
      return jsonResult({
        error: 'Skills not synced yet. Run "UEMS Agent Chat: Sync Agent Files" to fetch them.',
      });
    }
  }

  private async readSkills(skillsDir: string, fileFilter: Set<string> | null): Promise<SkillFile[]> {
    const files: SkillFile[] = [];
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) { continue; }
      if (fileFilter && !fileFilter.has(entry.name)) { continue; }
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      try {
        const content = await fs.readFile(skillFile, 'utf-8');
        files.push({ path: `skills/${entry.name}/SKILL.md`, content });
      } catch {
        // Skill directory exists but no SKILL.md — skip
      }
    }
    return files;
  }
}

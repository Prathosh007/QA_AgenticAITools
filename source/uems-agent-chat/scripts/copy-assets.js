/**
 * Pre-build script: copies canonical agent and skill files from the repo root
 * into the extension's assets/ directory so they are bundled in the VSIX.
 *
 * This ensures agents and skills are available immediately on install,
 * without waiting for the first remote sync.
 *
 * Usage: node scripts/copy-assets.js
 */

const fs = require('fs');
const path = require('path');

// Resolve repo root (two levels up from source/uems-agent-chat/)
const extensionDir = __dirname.replace(/[\\/]scripts$/, '');
const repoRoot = path.resolve(extensionDir, '..', '..');

// Directories that contain .agent.md files (mirrors GIT_SUB_PATHS in sync.ts)
const AGENT_SOURCE_DIRS = [
  'agents/orchestrator/agents',
  'agents/document-generator',
  'agents/delta-reviewer',
  'agents/testcase-generator',
];

const SKILLS_SOURCE_DIR = path.join(repoRoot, 'skills');

const AGENTS_DEST = path.join(extensionDir, 'assets', 'agents');
const SKILLS_DEST = path.join(extensionDir, 'assets', 'skills');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyAgentFiles() {
  ensureDir(AGENTS_DEST);

  let count = 0;
  for (const relDir of AGENT_SOURCE_DIRS) {
    const srcDir = path.join(repoRoot, relDir);
    if (!fs.existsSync(srcDir)) {
      console.warn(`  ⚠ Agent source dir not found: ${relDir}`);
      continue;
    }

    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.agent.md'));
    for (const file of files) {
      const src = path.join(srcDir, file);
      const dest = path.join(AGENTS_DEST, file);
      fs.copyFileSync(src, dest);
      count++;
    }
  }
  console.log(`  ✔ Copied ${count} agent file(s) to assets/agents/`);
}

function copySkillFiles() {
  ensureDir(SKILLS_DEST);

  if (!fs.existsSync(SKILLS_SOURCE_DIR)) {
    console.warn('  ⚠ Skills source dir not found');
    return;
  }

  let count = 0;
  const entries = fs.readdirSync(SKILLS_SOURCE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) { continue; }
    const skillFile = path.join(SKILLS_SOURCE_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) { continue; }

    const destDir = path.join(SKILLS_DEST, entry.name);
    ensureDir(destDir);
    fs.copyFileSync(skillFile, path.join(destDir, 'SKILL.md'));
    count++;
  }
  console.log(`  ✔ Copied ${count} skill file(s) to assets/skills/`);
}

console.log('Copying agent & skill assets into extension bundle...');
copyAgentFiles();
copySkillFiles();
console.log('Done.');

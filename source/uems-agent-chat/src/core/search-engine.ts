/**
 * Multi-repo search engine — pure functions, no VS Code dependency.
 * Uses ripgrep (rg) when available, falls back to grep (macOS/Linux) or findstr (Windows).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface SearchMatch {
  repo: string;
  file: string;
  line: number;
  column: number;
  text: string;
  context?: string;
}

export interface SearchOptions {
  query: string;
  repoPaths: string[];
  filePattern?: string;
  caseInsensitive?: boolean;
  maxResults?: number;
  isRegex?: boolean;
}

export interface SearchResult {
  matches: SearchMatch[];
  truncated: boolean;
  error?: string;
}

async function findSearchTool(): Promise<'rg' | 'grep' | 'findstr'> {
  try {
    await execFileAsync('rg', ['--version']);
    return 'rg';
  } catch {
    // grep exists on macOS and Linux; Windows has findstr
    if (os.platform() === 'win32') {
      return 'findstr';
    }
    return 'grep';
  }
}

/** Normalize file paths to forward slashes for consistent output across platforms. */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

async function searchWithRipgrep(
  query: string,
  repoPath: string,
  filePattern?: string,
  caseInsensitive = true,
  maxResults = 100,
  isRegex = false,
): Promise<SearchMatch[]> {
  const repoName = path.basename(repoPath);
  const args = [
    '--json',
    '--max-count', String(maxResults),
    '-C', '1',  // 1 line of context
  ];

  if (caseInsensitive) { args.push('-i'); }
  if (!isRegex) { args.push('--fixed-strings'); }
  if (filePattern) { args.push('-g', filePattern); }

  args.push('--', query, repoPath);

  try {
    const { stdout } = await execFileAsync('rg', args, {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const matches: SearchMatch[] = [];
    for (const line of stdout.split('\n').filter(Boolean)) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'match') {
          const data = parsed.data;
          const filePath = normalizePath(path.relative(repoPath, data.path.text));
          for (const submatch of data.submatches) {
            matches.push({
              repo: repoName,
              file: filePath,
              line: data.line_number,
              column: submatch.start,
              text: data.lines.text.trimEnd(),
              context: undefined,
            });
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
    return matches;
  } catch {
    // rg returns exit code 1 when no match — not an error
    return [];
  }
}

async function searchWithGrep(
  query: string,
  repoPath: string,
  filePattern?: string,
  caseInsensitive = true,
  maxResults = 100,
  isRegex = false,
): Promise<SearchMatch[]> {
  const repoName = path.basename(repoPath);
  const args = ['-rn', '-m', String(maxResults)];

  if (caseInsensitive) { args.push('-i'); }
  if (isRegex) { args.push('-E'); }
  if (filePattern) {
    // Convert glob like *.{swift,h,m,mm} to multiple --include flags
    const match = filePattern.match(/^\*\.\{(.+)\}$/);
    if (match) {
      for (const ext of match[1].split(',')) {
        args.push('--include', `*.${ext.trim()}`);
      }
    } else {
      args.push('--include', filePattern);
    }
  }

  args.push('--', query, repoPath);

  try {
    const { stdout } = await execFileAsync('grep', args, {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return stdout.split('\n').filter(Boolean).map((line: string) => {
      // grep output: file:line:text
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (!match) { return null; }
      return {
        repo: repoName,
        file: normalizePath(path.relative(repoPath, match[1])),
        line: parseInt(match[2], 10),
        column: 0,
        text: match[3].trimEnd(),
      };
    }).filter((m: SearchMatch | null): m is SearchMatch => m !== null);
  } catch {
    return [];
  }
}

/** Windows fallback using findstr (limited — no regex, no file pattern filtering). */
async function searchWithFindstr(
  query: string,
  repoPath: string,
  _filePattern?: string,
  caseInsensitive = true,
  maxResults = 100,
): Promise<SearchMatch[]> {
  const repoName = path.basename(repoPath);
  const args = ['/S', '/N']; // /S = recursive, /N = line numbers

  if (caseInsensitive) { args.push('/I'); }

  args.push('/C:' + query); // /C: = literal string
  args.push(path.join(repoPath, '*'));

  try {
    const { stdout } = await execFileAsync('findstr', args, {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return stdout.split('\r\n').filter(Boolean).slice(0, maxResults).map((line: string) => {
      // findstr output: file:line:text
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (!match) { return null; }
      return {
        repo: repoName,
        file: normalizePath(path.relative(repoPath, match[1])),
        line: parseInt(match[2], 10),
        column: 0,
        text: match[3].trimEnd(),
      };
    }).filter((m: SearchMatch | null): m is SearchMatch => m !== null);
  } catch {
    return [];
  }
}

/**
 * Normalize a query that may contain multiple terms separated by spaces, pipes, or ampersands
 * into a single regex alternation pattern. Returns { query, isRegex } with isRegex=true when
 * multi-term splitting was applied.
 *
 * Examples:
 *   "PrintAccessLog InitializeAccessLog"  → "PrintAccessLog|InitializeAccessLog" (regex)
 *   "foo|bar|baz"                         → "foo|bar|baz" (regex)
 *   "foo & bar"                           → "foo|bar" (regex)
 *   "NSXPCConnection"                     → "NSXPCConnection" (unchanged)
 *   "foo bar"  with isRegex=true          → unchanged (user controls regex)
 */
export function normalizeQuery(query: string, isRegex: boolean): { query: string; isRegex: boolean } {
  // If user explicitly set isRegex, trust their query as-is
  if (isRegex) {
    return { query, isRegex: true };
  }

  const trimmed = query.trim();

  // Check for pipe-separated terms (e.g. "foo|bar|baz" or "foo\|bar\|baz")
  if (trimmed.includes('|')) {
    const terms = trimmed.split('|').map(t => stripBackslashes(t.trim())).filter(Boolean);
    if (terms.length > 1) {
      // Escape each term for regex safety, then join with |
      return { query: terms.map(escapeRegex).join('|'), isRegex: true };
    }
  }

  // Check for ampersand-separated terms (e.g. "foo & bar")
  if (trimmed.includes('&')) {
    const terms = trimmed.split('&').map(t => stripBackslashes(t.trim())).filter(Boolean);
    if (terms.length > 1) {
      return { query: terms.map(escapeRegex).join('|'), isRegex: true };
    }
  }

  // Check for space-separated terms — only when there are 2+ tokens that each
  // look like identifiers (CamelCase, snake_case, ALL_CAPS, etc.)
  const spaceTokens = trimmed.split(/\s+/).filter(Boolean);
  if (spaceTokens.length > 1 && spaceTokens.every(t => /^[A-Za-z_][A-Za-z0-9_]*$/.test(t))) {
    return { query: spaceTokens.map(escapeRegex).join('|'), isRegex: true };
  }

  // Single term or natural-language phrase — pass through as fixed string
  return { query: trimmed, isRegex: false };
}

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip leading and trailing backslashes from a token (e.g. "WriteEvent\" → "WriteEvent"). */
function stripBackslashes(s: string): string {
  return s.replace(/^\\+|\\+$/g, '');
}

/** Search across multiple repos. */
export async function searchRepos(options: SearchOptions): Promise<SearchResult> {
  const { query, repoPaths, filePattern, caseInsensitive = true, maxResults = 200, isRegex = false } = options;

  if (!query.trim()) {
    return { matches: [], truncated: false, error: 'Empty search query.' };
  }

  const tool = await findSearchTool();
  const allMatches: SearchMatch[] = [];
  const perRepoLimit = Math.ceil(maxResults / Math.max(repoPaths.length, 1));

  for (const repoPath of repoPaths) {
    let results: SearchMatch[];
    if (tool === 'rg') {
      results = await searchWithRipgrep(query, repoPath, filePattern, caseInsensitive, perRepoLimit, isRegex);
    } else if (tool === 'grep') {
      results = await searchWithGrep(query, repoPath, filePattern, caseInsensitive, perRepoLimit, isRegex);
    } else {
      results = await searchWithFindstr(query, repoPath, filePattern, caseInsensitive, perRepoLimit);
    }
    allMatches.push(...results);

    if (allMatches.length >= maxResults) { break; }
  }

  const truncated = allMatches.length > maxResults;
  return { matches: allMatches.slice(0, maxResults), truncated };
}

// ── Component listing ───────────────────────────────────────────

export interface ComponentInfo {
  name: string;
  type: 'class' | 'protocol' | 'struct' | 'enum' | 'xpc-service' | 'function';
  file: string;
  repo: string;
  line: number;
}

export type Platform = 'mac' | 'linux' | 'windows' | 'cross-platform';

/** File extension globs per platform. */
const PLATFORM_FILE_GLOBS: Record<Platform, string> = {
  mac: '*.{swift,h,m,mm,c}',
  linux: '*.{go,c,h,py,sh}',
  windows: '*.{c,cpp,h,hpp,cs}',
  'cross-platform': '*.{go,c,h,cpp,hpp,py,sh,swift,m,mm}',
};

/** Regex patterns for component discovery, per platform. */
const PLATFORM_PATTERNS: Record<Platform, Record<string, string>> = {
  mac: {
    'class': '(^|\\s)(class|@interface|@implementation)\\s+([A-Z][A-Za-z0-9_]+)',
    'protocol': '(^|\\s)(protocol|@protocol)\\s+([A-Z][A-Za-z0-9_]+)',
    'struct': '(^|\\s)(struct|typedef\\s+struct)\\s+([A-Z_][A-Za-z0-9_]+)',
    'enum': '(^|\\s)(enum|NS_ENUM\\s*\\(\\s*\\w+\\s*,)\\s+([A-Z][A-Za-z0-9_]+)',
    'xpc-service': 'NSXPCConnection|NSXPCInterface|NSXPCListener|xpc_connection',
    'function': '(^|\\s)(func\\s+([a-zA-Z][A-Za-z0-9_]+)|[a-zA-Z_][A-Za-z0-9_*\\s]+\\s+([a-zA-Z_][A-Za-z0-9_]+)\\s*\\([^)]*\\)\\s*\\{)',
  },
  linux: {
    'struct': '(^|\\s)type\\s+([A-Z][A-Za-z0-9_]+)\\s+struct',
    'interface': '(^|\\s)type\\s+([A-Z][A-Za-z0-9_]+)\\s+interface',
    'function': '(^|\\s)func\\s+([a-zA-Z][A-Za-z0-9_]+)',
  },
  windows: {
    'class': '(^|\\s)(class|struct)\\s+([A-Z][A-Za-z0-9_]+)',
    'struct': '(^|\\s)(typedef\\s+struct|struct)\\s+([A-Z_][A-Za-z0-9_]+)',
    'enum': '(^|\\s)(enum\\s+class|enum)\\s+([A-Z_][A-Za-z0-9_]+)',
    'function': '(^|[^a-zA-Z])([A-Z][A-Za-z0-9_]+)\\s*\\(',
    'com-interface': 'DECLARE_INTERFACE|MIDL_INTERFACE|IUnknown|IDispatch',
  },
  'cross-platform': {
    'class': '(^|\\s)(class|@interface|@implementation)\\s+([A-Z][A-Za-z0-9_]+)',
    'protocol': '(^|\\s)(protocol|@protocol)\\s+([A-Z][A-Za-z0-9_]+)',
    'struct': '(^|\\s)(struct|typedef\\s+struct|type\\s+[A-Z][A-Za-z0-9_]+\\s+struct)\\s+([A-Z_][A-Za-z0-9_]+)',
    'enum': '(^|\\s)(enum|NS_ENUM\\s*\\(\\s*\\w+\\s*,)\\s+([A-Z][A-Za-z0-9_]+)',
    'interface': '(^|\\s)type\\s+([A-Z][A-Za-z0-9_]+)\\s+interface',
    'function': '(^|\\s)(func\\s+([a-zA-Z][A-Za-z0-9_]+))',
    'xpc-service': 'NSXPCConnection|NSXPCInterface|NSXPCListener|xpc_connection',
  },
};

/** List components in a repo by type. Platform determines file extensions and patterns. */
export async function listComponents(
  repoPath: string,
  types: Array<ComponentInfo['type']> = ['class', 'protocol', 'struct'],
  platform: Platform = 'mac',
): Promise<ComponentInfo[]> {
  const repoName = path.basename(repoPath);
  const components: ComponentInfo[] = [];
  const tool = await findSearchTool();
  const patterns = PLATFORM_PATTERNS[platform] ?? PLATFORM_PATTERNS.mac;
  const fileGlob = PLATFORM_FILE_GLOBS[platform] ?? PLATFORM_FILE_GLOBS.mac;

  for (const type of types) {
    const pattern = patterns[type];
    if (!pattern) { continue; }

    let matches: SearchMatch[];
    if (tool === 'rg') {
      matches = await searchWithRipgrep(pattern, repoPath, fileGlob, false, 500, true);
    } else if (tool === 'grep') {
      matches = await searchWithGrep(pattern, repoPath, fileGlob, false, 500, true);
    } else {
      matches = await searchWithFindstr(pattern, repoPath, fileGlob, false, 500);
    }

    for (const m of matches) {
      // Extract the actual name from the match text
      const nameMatch = m.text.match(new RegExp(pattern));
      const name = nameMatch
        ? (nameMatch[3] ?? nameMatch[2] ?? m.text.trim())
        : m.text.trim();

      components.push({
        name: name.trim(),
        type,
        file: m.file,
        repo: repoName,
        line: m.line,
      });
    }
  }

  return components;
}

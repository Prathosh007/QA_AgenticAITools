<!-- audience: ai-agents -->
<!-- doc-type: guide -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Build Guide

> 🎯 **Audience:** AI agents and developers
> **Scope:** All projects
> **Read when:** Need to build, test, lint, or deploy any project.

Step-by-step build, test, and deployment instructions for all projects in the uems-ai-toolkit repository.

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 20.x+ | `node --version` |
| npm | 10.x+ | `npm --version` |
| Go | 1.23+ | `go version` |
| Git | 2.25+ | `git --version` |
| VS Code | 1.108.0+ | `code --version` |
| ripgrep (optional) | any | `rg --version` — used by search tools, falls back to grep |

---

## uems-agent-chat (VS Code Extension)

**Directory:** `source/uems-agent-chat/`
**Language:** TypeScript
**Build system:** esbuild (bundler) + tsc (type checker) + ESLint (linter)
**Output:** `dist/extension.js`

### Install Dependencies
```bash
cd source/uems-agent-chat
npm install
```

### Development Build (Watch Mode)
```bash
npm run watch
```
Runs both esbuild and tsc in parallel watch mode. Use this during development.

### Production Build
```bash
npm run compile
```
Runs type-check → lint → esbuild bundle. No minification.

### Production Package
```bash
npm run package
```
Runs type-check → lint → esbuild with `--production` flag (minified).

### Type-Check Only
```bash
npx tsc --noEmit
```

### Lint Only
```bash
npm run lint
```
Uses ESLint with TypeScript parser. Config in `eslint.config.mjs`.

### Build VSIX (Extension Package)
```bash
npm run build:vsix
```
Produces `releases/uems-agent-chat.vsix`. Requires `@vscode/vsce`.

### Run in VS Code
1. Open the `source/uems-agent-chat/` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Open Copilot Chat → select an agent

### Key Build Files
| File | Purpose |
|------|---------|
| `package.json` | Extension manifest + npm scripts |
| `esbuild.js` | Bundler config: CJS format, `src/extension.ts` entry, externals = `vscode` |
| `tsconfig.json` | TypeScript config: ES2022 target, Node module resolution |
| `eslint.config.mjs` | ESLint config with TypeScript plugin |

---

## uems-agent-web (Go Web Server)

**Directory:** `source/uems-agent-web/`
**Language:** Go
**Build system:** Makefile + `go build`
**Output:** `bin/uems-agent-web`

### Build
```bash
cd source/uems-agent-web
make build
```
Compiles `backend/server/main.go` → `bin/uems-agent-web` with version info injected via ldflags.

### Build & Run
```bash
make run
```
Builds and starts the server on port 443 (configurable via `UEMS_PORT`).

### Go Build Check
```bash
cd source/uems-agent-web/backend
go build ./...
```

### Go Lint
```bash
cd source/uems-agent-web/backend
go vet ./...
```

### Tidy Modules
```bash
cd source/uems-agent-web
make tidy
```

### Full Setup (One Command)
```bash
cd source/uems-agent-web
./setup.sh
```
Installs prerequisites (Go, ripgrep), clones repos, builds the server, and launches it.

### Docker Deployment
```bash
cd source/uems-agent-web
docker compose up
```

### Server Modes
| Mode | Flag | Description |
|------|------|-------------|
| Standalone (default) | `--mode standalone` | Full server: Copilot API proxy, Device Flow auth, MCP tools, frontend |
| Bridge | `--mode bridge --bridge-url <url>` | Proxies chat/tools to VS Code HTTP bridge |
| Stdio | `--mode stdio` | MCP over stdin/stdout, no HTTP server |

### Key Build Files
| File | Purpose |
|------|---------|
| `Makefile` | Build targets: `build`, `run`, `tidy`, `clean` |
| `backend/go.mod` | Go module definition + dependencies |
| `Dockerfile` | Container build for production deployment |
| `setup.sh` | One-command setup + launch script |

---

## Clean Builds

```bash
# VS Code extension
cd source/uems-agent-chat
rm -rf dist/ node_modules/
npm install && npm run compile

# Go web server
cd source/uems-agent-web
make clean && make build
```

---

## Verification Checklist

After any change, verify:
- [ ] `cd source/uems-agent-chat && npx tsc --noEmit` — no type errors
- [ ] `cd source/uems-agent-chat && npm run lint` — no lint errors
- [ ] `cd source/uems-agent-web/backend && go build ./...` — compiles
- [ ] `cd source/uems-agent-web/backend && go vet ./...` — no warnings

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](CODEBASE_MAP.md) |
| Common task walkthroughs | [`AGENT_GUIDE.md`](AGENT_GUIDE.md) |
| Coding conventions | [`CONVENTIONS.md`](../development/CONVENTIONS.md) |
| Extension architecture | [`uems-agent-chat/ARCHITECTURE.md`](../architecture/uems-agent-chat/ARCHITECTURE.md) |
| Web server architecture | [`uems-agent-web/ARCHITECTURE.md`](../architecture/uems-agent-web/ARCHITECTURE.md) |

---

*Last Updated: 2026-04-08*

#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# UEMS Agent Explorer — Setup Script
#
# Sets up the UEMS Agent Explorer server in either standalone or bridge mode.
#
# Modes:
#   standalone (default) — Fully standalone. Copilot API direct, local tools.
#                          No VS Code or extension needed.
#   bridge           — Proxies chat/tools to a VS Code HTTP bridge.
#                       Requires VS Code + uems-agent-chat extension.
#
# Usage:
#   ./setup.sh                          # standalone mode (default)
#   ./setup.sh --mode bridge            # bridge mode
#   ./setup.sh --non-interactive        # CI / headless
#   ./setup.sh --workspace ~/my-dir     # custom workspace
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours & helpers ─────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
info()  { echo -e "  ${BLUE}→${NC} $1"; }
header(){ echo ""; echo -e "${BOLD}[$1] $2${NC}"; }

errors=0
INTERACTIVE=true
WORKSPACE_DIR="$HOME/uems-agent-web"
BRIDGE_PORT=3111
WEB_PORT=443
SETUP_MODE="standalone"  # "standalone" or "bridge"
LLM_PROVIDER="copilot"   # "copilot" or "ollama"
OLLAMA_URL="http://localhost:11434"
CHAT_MODEL=""            # empty = use server default (claude-sonnet-4.6 / qwen3)
SUGGEST_MODEL=""         # empty = use server default (gpt-4.1 / qwen3)
REASONING_EFFORT="high"   # "low", "medium", "high"
LOG_FILE="$HOME/uems-agent-web/uems-agent.log"

# Zoho OAuth (optional — home-page access control)
ZOHO_CLIENT_ID="${ZOHO_CLIENT_ID:-}"
ZOHO_CLIENT_SECRET="${ZOHO_CLIENT_SECRET:-}"
ZOHO_ALLOWED_DOMAIN="${ZOHO_ALLOWED_DOMAIN:-}"
ZOHO_ACCOUNTS_URL="${ZOHO_ACCOUNTS_URL:-}"  # e.g. https://accounts.zoho.com (US) or https://accounts.zoho.in (India)

# TLS certificate (optional — defaults to self-signed)
TLS_CERT="${UEMS_TLS_CERT:-}"
TLS_KEY="${UEMS_TLS_KEY:-}"

# Resolve this script's directory (source/uems-agent-web/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPOS_JSON="$SCRIPT_DIR/../common/repos.json"
EXTENSION_ID="uems-agent.uems-agent-chat"

# ── Parse arguments ───────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case "$1" in
        --non-interactive) INTERACTIVE=false; shift ;;
        --workspace)       WORKSPACE_DIR="$2"; shift 2 ;;
        --bridge-port)     BRIDGE_PORT="$2"; shift 2 ;;
        --web-port)        WEB_PORT="$2"; shift 2 ;;
        --llm-provider)
            LLM_PROVIDER="$2"
            if [[ "$LLM_PROVIDER" != "copilot" && "$LLM_PROVIDER" != "ollama" ]]; then
                echo "Error: --llm-provider must be 'copilot' or 'ollama'"
                exit 1
            fi
            shift 2
            ;;
        --ollama-url)      OLLAMA_URL="$2"; shift 2 ;;
        --chat-model)      CHAT_MODEL="$2"; shift 2 ;;
        --suggest-model)   SUGGEST_MODEL="$2"; shift 2 ;;
        --reasoning-effort)
            REASONING_EFFORT="$2"
            if [[ "$REASONING_EFFORT" != "low" && "$REASONING_EFFORT" != "medium" && "$REASONING_EFFORT" != "high" ]]; then
                echo "Error: --reasoning-effort must be 'low', 'medium', or 'high'"
                exit 1
            fi
            shift 2
            ;;
        --log-file)        LOG_FILE="$2"; shift 2 ;;
        --zoho-client-id)     ZOHO_CLIENT_ID="$2"; shift 2 ;;
        --zoho-client-secret) ZOHO_CLIENT_SECRET="$2"; shift 2 ;;
        --zoho-allowed-domain) ZOHO_ALLOWED_DOMAIN="$2"; shift 2 ;;
        --zoho-accounts-url)  ZOHO_ACCOUNTS_URL="$2"; shift 2 ;;
        --tls-cert)        TLS_CERT="$2"; shift 2 ;;
        --tls-key)         TLS_KEY="$2"; shift 2 ;;
        --mode)
            SETUP_MODE="$2"
            if [[ "$SETUP_MODE" != "standalone" && "$SETUP_MODE" != "bridge" ]]; then
                echo "Error: --mode must be 'standalone' or 'bridge'"
                exit 1
            fi
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --mode <mode>         Setup mode: standalone (default) or bridge"
            echo "  --llm-provider <p>    LLM provider: copilot (default) or ollama"
            echo "  --ollama-url <url>    Ollama server URL (default: http://localhost:11434)"
            echo "  --chat-model <model>  Chat model override (default: claude-sonnet-4.6 / qwen3)"
            echo "  --suggest-model <m>   Suggestion model override (default: gpt-4.1 / qwen3)"
            echo "  --reasoning-effort <e> Reasoning effort: low (default), medium, high"
            echo "  --log-file <path>     Log file path (default: ~/uems-agent-web/uems-agent.log)"
            echo "  --zoho-client-id <id>       Zoho OAuth client ID (enables home-page auth)"
            echo "  --zoho-client-secret <sec>  Zoho OAuth client secret"
            echo "  --zoho-allowed-domain <dom> Only allow emails from this domain (e.g. zohocorp.com)"
            echo "  --zoho-accounts-url <url>   Zoho accounts base URL (default: https://accounts.zoho.in)"
            echo "                              Use https://accounts.zoho.com for US, https://accounts.zoho.eu for EU"
            echo "  --tls-cert <path>     Path to TLS certificate file (PEM). Defaults to self-signed."
            echo "  --tls-key <path>      Path to TLS private key file (PEM). Required with --tls-cert."
            echo "  --non-interactive     Skip prompts (auto-yes)"
            echo "  --workspace <dir>     Workspace directory (default: ~/uems-agent-web)"
            echo "  --bridge-port <port>  VS Code bridge port (default: 3111, bridge mode only)"
            echo "  --web-port <port>     Web server port (default: 443)"
            echo "  -h, --help            Show this help"
            echo ""
            echo "Modes:"
            echo "  standalone   Fully standalone — Copilot API direct, local tools."
            echo "           No VS Code or extension needed."
            echo "  bridge   Proxies chat/tools to VS Code HTTP bridge."
            echo "           Requires VS Code + uems-agent-chat extension."
            echo ""
            echo "LLM Providers:"
            echo "  copilot  GitHub Copilot API (requires GitHub auth)."
            echo "  ollama   Local Ollama instance (no auth needed)."
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

ask_yn() {
    if $INTERACTIVE; then
        read -rp "  $1 [y/N] " ans
        [[ "$ans" =~ ^[Yy]$ ]]
    else
        return 0  # auto-yes
    fi
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   UEMS Agent Explorer — Setup ($SETUP_MODE mode)   ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Mode:         ${BLUE}$SETUP_MODE${NC}"
echo -e "  LLM Provider: ${BLUE}$LLM_PROVIDER${NC}"
echo -e "  Workspace:    ${BLUE}$WORKSPACE_DIR${NC}"
if [[ "$SETUP_MODE" == "bridge" ]]; then
echo -e "  Bridge port:  ${BLUE}$BRIDGE_PORT${NC}"
fi
echo -e "  Web port:     ${BLUE}$WEB_PORT${NC}"

# ── Step counts ───────────────────────────────────────────────────
if [[ "$SETUP_MODE" == "bridge" ]]; then
    TOTAL_STEPS=8
else
    TOTAL_STEPS=5
fi
STEP=0
next_step() { STEP=$((STEP + 1)); }

# ── 1. Create workspace directory ─────────────────────────────────

next_step
header "$STEP/$TOTAL_STEPS" "Workspace Directory"

REPOS_DIR="$WORKSPACE_DIR/repos"

mkdir -p "$WORKSPACE_DIR"
mkdir -p "$REPOS_DIR"
pass "Created $WORKSPACE_DIR"

# ── 2. OS & package manager ──────────────────────────────────────

next_step
header "$STEP/$TOTAL_STEPS" "Operating System"

OS="$(uname -s)"
ARCH="$(uname -m)"
HAS_BREW=false

case "$OS" in
    Darwin)
        pass "macOS ($ARCH)"
        if command -v brew &>/dev/null; then
            HAS_BREW=true
            pass "Homebrew available"
        else
            warn "Homebrew not found — some auto-installs may be unavailable"
        fi
        ;;
    Linux)
        pass "Linux ($ARCH)"
        ;;
    *)
        warn "Untested OS: $OS"
        ;;
esac

# ── 3. Prerequisites ─────────────────────────────────────────────

next_step
header "$STEP/$TOTAL_STEPS" "Prerequisites"

install_if_missing() {
    local name="$1" check_cmd="$2" brew_pkg="${3:-$1}" apt_pkg="${4:-$1}"

    if eval "$check_cmd" &>/dev/null; then
        local ver
        ver=$($check_cmd --version 2>/dev/null | head -1 || echo "found")
        pass "$name ($ver)"
        return 0
    fi

    fail "$name not found"
    if $HAS_BREW; then
        if ask_yn "Install $name via Homebrew?"; then
            brew install "$brew_pkg"
            pass "$name installed"
            return 0
        fi
    elif command -v apt-get &>/dev/null; then
        if ask_yn "Install $name via apt?"; then
            sudo apt-get install -y "$apt_pkg"
            pass "$name installed"
            return 0
        fi
    fi
    info "Install manually: see README.md prerequisites"
    ((errors++))
    return 1
}

# Go
GO_CMD=""
if command -v go &>/dev/null; then
    GO_CMD="go"
elif [[ -x /usr/local/go/bin/go ]]; then
    GO_CMD="/usr/local/go/bin/go"
fi

if [[ -n "$GO_CMD" ]]; then
    GO_VERSION=$($GO_CMD version | awk '{print $3}' | sed 's/go//')
    GO_MINOR=$(echo "$GO_VERSION" | cut -d. -f2)
    if (( GO_MINOR >= 22 )); then
        pass "Go $GO_VERSION"
    else
        fail "Go $GO_VERSION (need >= 1.22)"
        ((errors++))
    fi
else
    fail "Go not found"
    if $HAS_BREW && ask_yn "Install Go via Homebrew?"; then
        brew install go
        GO_CMD="go"
        pass "Go installed"
    else
        info "Install from: https://go.dev/dl/"
        ((errors++))
    fi
fi

# ripgrep
install_if_missing "ripgrep" "command -v rg" "ripgrep" "ripgrep"

# Git
if command -v git &>/dev/null; then
    pass "Git $(git --version | awk '{print $3}')"
else
    fail "Git not found"
    info "Install: https://git-scm.com/downloads"
    ((errors++))
fi

# python3 (needed for repos.json parsing)
if command -v python3 &>/dev/null; then
    pass "Python3 $(python3 --version 2>&1 | awk '{print $2}')"
else
    fail "Python3 not found (needed to parse repos.json)"
    ((errors++))
fi

# Ollama (only when using ollama provider)
if [[ "$LLM_PROVIDER" == "ollama" ]]; then
    if curl -s --max-time 3 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
        MODEL_COUNT=$(curl -s --max-time 3 "$OLLAMA_URL/api/tags" 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo 0)
        pass "Ollama reachable at $OLLAMA_URL ($MODEL_COUNT models)"
    else
        fail "Ollama not reachable at $OLLAMA_URL"
        info "Start Ollama: ollama serve"
        info "Or set --ollama-url to point to your Ollama instance"
        ((errors++))
    fi
fi

# ── 4-6. VS Code + Extension + Bridge Config (bridge mode only) ──

if [[ "$SETUP_MODE" == "bridge" ]]; then

next_step
header "$STEP/$TOTAL_STEPS" "VS Code"

CODE_CMD=""
if command -v code &>/dev/null; then
    CODE_CMD="code"
elif [[ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]]; then
    CODE_CMD="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
fi

if [[ -n "$CODE_CMD" ]]; then
    VS_VERSION=$("$CODE_CMD" --version 2>/dev/null | head -1 || echo "unknown")
    pass "VS Code $VS_VERSION"
else
    fail "VS Code not found"
    if [[ "$OS" == "Darwin" ]] && $HAS_BREW; then
        if ask_yn "Install VS Code via Homebrew?"; then
            brew install --cask visual-studio-code
            CODE_CMD="code"
            pass "VS Code installed"
        else
            ((errors++))
        fi
    else
        info "Install from: https://code.visualstudio.com/"
        ((errors++))
    fi
fi

# ── 5. UEMS Agent Chat extension ─────────────────────────────────

next_step
header "$STEP/$TOTAL_STEPS" "VS Code Extension (uems-agent-chat)"

VSIX_PATH=""
# Check for VSIX in releases/ directory
if [[ -f "$SCRIPT_DIR/../uems-agent-chat/releases/uems-agent-chat.vsix" ]]; then
    VSIX_PATH="$SCRIPT_DIR/../uems-agent-chat/releases/uems-agent-chat.vsix"
elif [[ -f "$SCRIPT_DIR/releases/uems-agent-chat.vsix" ]]; then
    VSIX_PATH="$SCRIPT_DIR/releases/uems-agent-chat.vsix"
fi

if [[ -n "$CODE_CMD" ]]; then
    INSTALLED_EXT=$("$CODE_CMD" --list-extensions 2>/dev/null | grep -i "uems-agent" || true)

    if [[ -n "$INSTALLED_EXT" ]]; then
        pass "Extension already installed: $INSTALLED_EXT"
        # Check if update available
        if [[ -n "$VSIX_PATH" ]]; then
            if ask_yn "Update extension from local VSIX?"; then
                "$CODE_CMD" --install-extension "$VSIX_PATH" --force 2>/dev/null
                pass "Extension updated"
            fi
        fi
    else
        warn "Extension not installed"
        if [[ -n "$VSIX_PATH" ]]; then
            info "Found VSIX at: $VSIX_PATH"
            if ask_yn "Install extension from local VSIX?"; then
                "$CODE_CMD" --install-extension "$VSIX_PATH" 2>/dev/null
                pass "Extension installed"
            else
                ((errors++))
            fi
        else
            fail "No VSIX file found in releases/"
            info "Build it: cd source/uems-agent-chat && npx vsce package"
            ((errors++))
        fi
    fi
else
    warn "Skipping extension check (VS Code not available)"
fi

# ── 6. Configure VS Code settings for bridge mode ────────────────

next_step
header "$STEP/$TOTAL_STEPS" "VS Code Bridge Configuration"

# Write bridge settings to WORKSPACE-LOCAL .vscode/settings.json
# so only the bridge VS Code window gets bridge mode — other windows are unaffected.
VSCODE_WS_DIR="$REPOS_DIR/.vscode"
WS_SETTINGS_FILE="$VSCODE_WS_DIR/settings.json"
mkdir -p "$VSCODE_WS_DIR"

BRIDGE_SETTINGS_NEEDED=false

if [[ -f "$WS_SETTINGS_FILE" ]]; then
    if python3 -c "
import json, sys
with open('$WS_SETTINGS_FILE') as f:
    s = json.load(f)
enabled = s.get('uems-agent-chat.httpBridge.enabled', False)
port = s.get('uems-agent-chat.httpBridge.port', 3111)
if enabled and port == $BRIDGE_PORT:
    sys.exit(0)
else:
    sys.exit(1)
" 2>/dev/null; then
        pass "Bridge settings already configured (workspace-local)"
    else
        BRIDGE_SETTINGS_NEEDED=true
    fi
else
    BRIDGE_SETTINGS_NEEDED=true
fi

if $BRIDGE_SETTINGS_NEEDED; then
    if ask_yn "Configure VS Code bridge settings in workspace? (port $BRIDGE_PORT)"; then
        python3 -c "
import json, os

settings_file = '$WS_SETTINGS_FILE'
settings = {}
if os.path.isfile(settings_file):
    with open(settings_file) as f:
        try:
            settings = json.load(f)
        except json.JSONDecodeError:
            settings = {}

settings['uems-agent-chat.httpBridge.enabled'] = True
settings['uems-agent-chat.httpBridge.port'] = $BRIDGE_PORT
# No workspaceDir needed — VS Code is opened directly on the repos folder
settings.pop('uems-agent-chat.httpBridge.workspaceDir', None)

with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

print('Settings written successfully')
"
        pass "Bridge enabled in $WS_SETTINGS_FILE (port=$BRIDGE_PORT)"
    else
        warn "Skipped — you'll need to configure bridge settings manually"
        info "Create $WS_SETTINGS_FILE with:"
        info '  "uems-agent-chat.httpBridge.enabled": true'
        info "  \"uems-agent-chat.httpBridge.port\": $BRIDGE_PORT"
    fi
fi

# Clean bridge settings from global VS Code config (if leftover from previous setup)
GLOBAL_SETTINGS_DIR=""
case "$OS" in
    Darwin) GLOBAL_SETTINGS_DIR="$HOME/Library/Application Support/Code/User" ;;
    Linux)  GLOBAL_SETTINGS_DIR="$HOME/.config/Code/User" ;;
esac

if [[ -n "$GLOBAL_SETTINGS_DIR" && -f "$GLOBAL_SETTINGS_DIR/settings.json" ]]; then
    python3 -c "
import json, os, sys

settings_file = '$GLOBAL_SETTINGS_DIR/settings.json'
with open(settings_file) as f:
    settings = json.load(f)

changed = False
for key in ['uems-agent-chat.httpBridge.enabled', 'uems-agent-chat.httpBridge.port', 'uems-agent-chat.httpBridge.workspaceDir']:
    if key in settings:
        del settings[key]
        changed = True

if changed:
    with open(settings_file, 'w') as f:
        json.dump(settings, f, indent=2)
        f.write('\n')
    print('Cleaned bridge settings from global config')
" 2>/dev/null && pass "Removed bridge settings from global VS Code config" || true
fi

fi  # end bridge-only steps

# ── Clone repos ──────────────────────────────────────────────────

next_step
header "$STEP/$TOTAL_STEPS" "Clone UEMS Repositories"

if [[ ! -f "$REPOS_JSON" ]]; then
    fail "repos.json not found at $REPOS_JSON"
    ((errors++))
else
    REPO_COUNT=$(python3 -c "
import json
with open('$REPOS_JSON') as f:
    data = json.load(f)
count = sum(len(repos) for repos in data.values())
print(count)
" 2>/dev/null || echo 0)

    info "Found $REPO_COUNT repos in repos.json"

    # Copy repos.json to workspace for the web server to use
    cp "$REPOS_JSON" "$WORKSPACE_DIR/repos.json"
    pass "Copied repos.json to $WORKSPACE_DIR/repos.json"

    # Always use sync-repos.sh (handles clone + pull, tolerates failures)
    SYNC_SCRIPT="$SCRIPT_DIR/sync-repos.sh"
    if [[ ! -f "$SYNC_SCRIPT" ]]; then
        fail "sync-repos.sh not found at $SYNC_SCRIPT"
        ((errors++))
    else
        info "Cloning/syncing repos into $REPOS_DIR (failures are non-blocking)..."
        # Run with a 5-minute timeout so a hung clone doesn't block setup
        if command -v timeout &>/dev/null; then
            timeout 300 bash "$SYNC_SCRIPT" "$REPOS_DIR" "$REPOS_JSON" || true
        elif command -v gtimeout &>/dev/null; then
            gtimeout 300 bash "$SYNC_SCRIPT" "$REPOS_DIR" "$REPOS_JSON" || true
        else
            bash "$SYNC_SCRIPT" "$REPOS_DIR" "$REPOS_JSON" || true
        fi
        ACTUAL=$(find "$REPOS_DIR" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        pass "Repos directory has $ACTUAL repo(s)"
        if (( ACTUAL == 0 )); then
            warn "No repos were cloned — check git access credentials"
        fi
    fi
fi

# ── Build & start ─────────────────────────────────────────────────

next_step
header "$STEP/$TOTAL_STEPS" "Build & Launch"

GO_USE="${GO_CMD:-go}"

# Copy guidelines and prompts to workspace (so paths work cleanly)
if [[ -d "$REPO_ROOT/guidelines" ]]; then
    rm -rf "$WORKSPACE_DIR/guidelines"
    cp -r "$REPO_ROOT/guidelines" "$WORKSPACE_DIR/guidelines" 2>/dev/null || true
    pass "Copied guidelines to workspace"
fi
if [[ -d "$REPO_ROOT/skills" ]]; then
    rm -rf "$WORKSPACE_DIR/skills"
    cp -r "$REPO_ROOT/skills" "$WORKSPACE_DIR/skills" 2>/dev/null || true
    pass "Copied skills to workspace"
fi
if [[ -d "$REPO_ROOT/agents/orchestrator/agents" ]]; then
    mkdir -p "$WORKSPACE_DIR/prompts"
    cp -r "$REPO_ROOT/agents/orchestrator/agents/"*.md "$WORKSPACE_DIR/prompts/" 2>/dev/null || true
    pass "Copied agent prompts to workspace"
fi
if [[ -d "$REPO_ROOT/agents" ]]; then
    rm -rf "$WORKSPACE_DIR/agents"
    cp -r "$REPO_ROOT/agents" "$WORKSPACE_DIR/agents" 2>/dev/null || true
    pass "Copied agents to workspace"
fi
if [[ -f "$REPO_ROOT/README.md" ]]; then
    cp "$REPO_ROOT/README.md" "$WORKSPACE_DIR/README.md" 2>/dev/null || true
    pass "Copied README.md to workspace"
fi
if [[ -d "$REPO_ROOT/source/uems-agent-chat" ]]; then
    rm -rf "$WORKSPACE_DIR/source/uems-agent-chat"
    mkdir -p "$WORKSPACE_DIR/source/uems-agent-chat"
    # Copy markdown docs to mirror repo structure (enables relative links)
    find "$REPO_ROOT/source/uems-agent-chat" -name '*.md' -maxdepth 1 -exec cp {} "$WORKSPACE_DIR/source/uems-agent-chat/" \; 2>/dev/null || true
    # Copy releases directory (VSIX file for download)
    if [[ -d "$REPO_ROOT/source/uems-agent-chat/releases" ]]; then
        mkdir -p "$WORKSPACE_DIR/source/uems-agent-chat/releases"
        cp "$REPO_ROOT/source/uems-agent-chat/releases/"*.vsix "$WORKSPACE_DIR/source/uems-agent-chat/releases/" 2>/dev/null || true
        cp "$REPO_ROOT/source/uems-agent-chat/releases/"*.json "$WORKSPACE_DIR/source/uems-agent-chat/releases/" 2>/dev/null || true
    fi
    pass "Copied extension docs to workspace (source/uems-agent-chat/)"
fi

# Build
info "Building server..."
(cd "$SCRIPT_DIR/backend" && $GO_USE build -ldflags "-X main.version=bridge-setup -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" -o "$WORKSPACE_DIR/uems-agent-web" ./server)
pass "Server built → $WORKSPACE_DIR/uems-agent-web"

# Copy frontend
rm -rf "$WORKSPACE_DIR/frontend"
cp -r "$SCRIPT_DIR/frontend" "$WORKSPACE_DIR/frontend" 2>/dev/null || true
pass "Frontend copied"

# ── Summary ───────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────"

if (( errors > 0 )); then
    echo -e "${RED}${BOLD}Setup completed with $errors issue(s).${NC} Fix them and re-run."
    echo ""
    exit 1
fi

echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo -e "  ${BOLD}Workspace:${NC}  $WORKSPACE_DIR"
echo -e "  ${BOLD}Mode:${NC}       $SETUP_MODE"
echo ""

# ── Launch ────────────────────────────────────────────────────────

if [[ "$SETUP_MODE" == "bridge" ]]; then
    # Bridge mode: open VS Code, wait for bridge, then start server
    if [[ -n "${CODE_CMD:-}" ]]; then
        info "Opening VS Code with repos workspace..."
        "$CODE_CMD" "$REPOS_DIR" &
        pass "VS Code launched — the HTTP bridge will start automatically on port $BRIDGE_PORT"
        echo ""
        info "Waiting for VS Code bridge to become ready..."

        BRIDGE_URL="http://127.0.0.1:$BRIDGE_PORT"
        BRIDGE_READY=false
        for i in $(seq 1 30); do
            if curl -s --max-time 2 "$BRIDGE_URL/health" >/dev/null 2>&1; then
                BRIDGE_READY=true
                break
            fi
            echo -ne "  Waiting... ($i/30)\r"
            sleep 2
        done
        echo ""

        if $BRIDGE_READY; then
            pass "Bridge is ready at $BRIDGE_URL"
        else
            warn "Bridge not yet reachable at $BRIDGE_URL"
            info "Make sure VS Code has fully loaded and the extension is active"
            info "Check manually: curl $BRIDGE_URL/health"
            echo ""
            echo -e "  ${BOLD}Once the bridge is up, start the web server with:${NC}"
            echo ""
            echo "    $WORKSPACE_DIR/uems-agent-web \\"
            echo "        --mode bridge \\"
            echo "        --bridge-url http://127.0.0.1:$BRIDGE_PORT \\"
            echo "        --port $WEB_PORT \\"
            echo "        --public $WORKSPACE_DIR/frontend \\"
            echo "        --repo-data $WORKSPACE_DIR/repos.json \\"
            echo "        --repos $REPOS_DIR \\"
            echo "        --guidelines $WORKSPACE_DIR/guidelines \\"
            echo "        --skills $WORKSPACE_DIR/skills \\"
            echo "        --prompts $WORKSPACE_DIR/prompts"
            echo ""
            exit 0
        fi
    else
        warn "VS Code not available — start it manually and run:"
        echo ""
        echo "    $WORKSPACE_DIR/uems-agent-web \\"
        echo "        --mode bridge \\"
        echo "        --bridge-url http://127.0.0.1:$BRIDGE_PORT \\"
        echo "        --port $WEB_PORT \\"
        echo "        --public $WORKSPACE_DIR/frontend \\"
        echo "        --repo-data $WORKSPACE_DIR/repos.json \\"
        echo "        --repos $REPOS_DIR \\"
        echo "        --guidelines $WORKSPACE_DIR/guidelines \\"
        echo "        --skills $WORKSPACE_DIR/skills \\"
        echo "        --prompts $WORKSPACE_DIR/prompts"
        echo ""
        exit 0
    fi

    echo ""
    info "Starting web server in bridge mode..."
    echo ""
    echo -e "  ${BOLD}Web UI:${NC}    https://localhost:$WEB_PORT"
    echo -e "  ${BOLD}Bridge:${NC}    http://127.0.0.1:$BRIDGE_PORT"
    echo -e "  ${BOLD}Repos:${NC}     $REPOS_DIR"
    echo ""
    echo -e "  Press ${BOLD}Ctrl+C${NC} to stop the server."
    echo ""

    if [[ -n "$ZOHO_CLIENT_ID" ]]; then
        export ZOHO_CLIENT_ID
        export ZOHO_CLIENT_SECRET
        export ZOHO_ALLOWED_DOMAIN
        [[ -n "$ZOHO_ACCOUNTS_URL" ]] && export ZOHO_ACCOUNTS_URL
    fi

    exec "$WORKSPACE_DIR/uems-agent-web" \
        --mode bridge \
        --bridge-url "http://127.0.0.1:$BRIDGE_PORT" \
        --port "$WEB_PORT" \
        ${LOG_FILE:+--log-file "$LOG_FILE"} \
        ${TLS_CERT:+--tls-cert "$TLS_CERT"} \
        ${TLS_KEY:+--tls-key "$TLS_KEY"} \
        --public "$WORKSPACE_DIR/frontend" \
        --repo-data "$WORKSPACE_DIR/repos.json" \
        --repos "$REPOS_DIR" \
        --guidelines "$WORKSPACE_DIR/guidelines" \
        --skills "$WORKSPACE_DIR/skills" \
        --prompts "$WORKSPACE_DIR/prompts"
else
    # Standalone mode: start server directly (no VS Code needed)
    echo ""
    info "Starting web server in standalone mode ($LLM_PROVIDER)..."
    echo ""
    echo -e "  ${BOLD}Web UI:${NC}    https://localhost:$WEB_PORT"
    echo -e "  ${BOLD}LLM:${NC}       $LLM_PROVIDER"
    echo -e "  ${BOLD}Repos:${NC}     $REPOS_DIR"
    if [[ -n "$LOG_FILE" ]]; then
    echo -e "  ${BOLD}Log file:${NC}  $LOG_FILE"
    fi
    echo ""
    echo -e "  Press ${BOLD}Ctrl+C${NC} to stop the server."
    echo ""

    PROVIDER_ARGS=()
    if [[ "$LLM_PROVIDER" == "ollama" ]]; then
        export UEMS_LLM_PROVIDER=ollama
        export UEMS_OLLAMA_URL="$OLLAMA_URL"
    fi
    if [[ -n "$CHAT_MODEL" ]]; then
        export UEMS_CHAT_MODEL="$CHAT_MODEL"
    fi
    if [[ -n "$SUGGEST_MODEL" ]]; then
        export UEMS_SUGGEST_MODEL="$SUGGEST_MODEL"
    fi
    if [[ -n "$REASONING_EFFORT" ]]; then
        export UEMS_REASONING_EFFORT="$REASONING_EFFORT"
    fi
    if [[ -n "$LOG_FILE" ]]; then
        export UEMS_LOG_FILE="$LOG_FILE"
    fi
    if [[ -n "$ZOHO_CLIENT_ID" ]]; then
        export ZOHO_CLIENT_ID
        export ZOHO_CLIENT_SECRET
        export ZOHO_ALLOWED_DOMAIN
        [[ -n "$ZOHO_ACCOUNTS_URL" ]] && export ZOHO_ACCOUNTS_URL
    fi

    exec "$WORKSPACE_DIR/uems-agent-web" \
        --mode standalone \
        --port "$WEB_PORT" \
        ${LOG_FILE:+--log-file "$LOG_FILE"} \
        ${TLS_CERT:+--tls-cert "$TLS_CERT"} \
        ${TLS_KEY:+--tls-key "$TLS_KEY"} \
        --public "$WORKSPACE_DIR/frontend" \
        --repo-data "$WORKSPACE_DIR/repos.json" \
        --repos "$REPOS_DIR" \
        --guidelines "$WORKSPACE_DIR/guidelines" \
        --skills "$WORKSPACE_DIR/skills" \
        --prompts "$WORKSPACE_DIR/prompts"
fi

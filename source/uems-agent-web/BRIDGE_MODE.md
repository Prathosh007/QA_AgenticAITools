# Bridge Mode Deployment Guide

Bridge mode enables UEMS Agent Explorer to act as a thin frontend + auth layer that proxies chat and tool invocations to the UEMS Agent for VS Code extension running the HTTP bridge. This allows multiple web users to share a single VS Code instance for tool execution.

## Architecture

```
Browser → uems-agent-web (bridge mode)  → VS Code HTTP Bridge (uems-agent-chat)
            ├── /auth/*         (local)       ↕
            ├── /chat           (proxy) →  /chat
            ├── /api/tools      (proxy) →  /api/tools
            ├── /api/tool       (proxy) →  /api/tool
            ├── /health         (local)
            ├── /readyz         (local, also pings bridge /health)
            └── /*              (static frontend)
```

**What happens locally:** Auth (GitHub Device Flow), static file serving, health/readiness probes, metrics.

**What gets proxied:** Chat completions, tool listing, tool invocations — all forwarded to the VS Code HTTP bridge which handles the MCP tool loop server-side.

## Prerequisites

1. **VS Code** with the `uems-agent-chat` extension installed
2. The extension's HTTP bridge must be running (see below)
3. The web server binary (`uems-agent-web`)
4. Network connectivity between the web server and VS Code bridge

## Step 1: Enable the HTTP Bridge in VS Code

In the `uems-agent-chat` extension, the HTTP bridge is started automatically or via command:

1. Open VS Code with the extension installed
2. Run command: `UEMS Agent: Start HTTP Bridge`
3. The bridge starts on `http://127.0.0.1:3111` by default
4. Verify with: `curl http://127.0.0.1:3111/health`

The bridge port can be configured in VS Code settings:
```json
{
  "uems-agent-chat.httpBridge.port": 3111
}
```

## Step 2: Start the Web Server in Bridge Mode

```bash
# Build
make build

# Run in bridge mode
./bin/uems-agent-web \
  --mode bridge \
  --bridge-url http://127.0.0.1:3111 \
  --host 0.0.0.0 \
  --port 443 \
  --public frontend \
  --repo-data ../common/repos.json
```

Required flags:
- `--mode bridge` — enables bridge mode
- `--bridge-url <url>` — the VS Code HTTP bridge URL

Optional flags:
- `--host` — listen address (default: `localhost`)
- `--port` — listen port (default: `443`)
- `--public` — frontend static files directory
- `--tls-self-signed` — enable HTTPS with auto-generated cert
- `--tls-cert` / `--tls-key` — use your own TLS certificate

## Step 3: Verify

```bash
# Check the web server is running
curl https://localhost:443/health
# → {"status":"ok"}

# Check readiness (also pings bridge)
curl https://localhost:443/readyz
# → {"status":"ready"}

# Check mode
curl https://localhost:443/api/mode
# → {"mode":"bridge"}
```

## Docker Deployment

```bash
# Build
docker build -f source/uems-agent-web/Dockerfile -t uems-agent-web .

# Run in bridge mode (bridge URL must be reachable from container)
docker run -p 443:443 \
  -e UEMS_BRIDGE_URL=http://host.docker.internal:3111 \
  uems-agent-web \
  -mode bridge \
  -bridge-url http://host.docker.internal:3111 \
  -host 0.0.0.0
```

> **Note:** Use `host.docker.internal` on Docker Desktop (macOS/Windows) to reach the host machine where VS Code is running. On Linux, use `--network host` or the host's IP address.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UEMS_BRIDGE_URL` | (none) | VS Code HTTP bridge URL |
| `UEMS_REPO_DATA` | `../common/repos.json` | Path to repos.json |

## Troubleshooting

### `/readyz` returns "bridge unreachable"
- Verify the VS Code HTTP bridge is running: `curl <bridge-url>/health`
- Check network connectivity between web server and bridge
- If using Docker, ensure the bridge URL is reachable from inside the container

### Chat requests fail with 502/504
- The bridge may have restarted — check VS Code output panel
- The web server has retry logic (3 attempts with exponential backoff), but persistent failures mean the bridge is down

### Session continuity after bridge restart
- When the VS Code bridge restarts, existing bridge session IDs become invalid
- Users will need to start a new conversation (the frontend handles this gracefully)
- Existing conversations stored in localStorage are preserved

### Auth works but chat doesn't
- Auth is handled locally by the web server — it doesn't depend on the bridge
- Chat/tool endpoints are proxied — if these fail, it's a bridge connectivity issue
- Check: `curl -X POST https://localhost:443/chat -H 'Content-Type: application/json' -d '{"message":"test"}'`

## Security Considerations

- The bridge URL should only be accessible from the web server, not the public internet
- Use TLS (`--tls-self-signed` or `--tls-cert/--tls-key`) for the web-facing server
- Auth cookies have `HttpOnly` and `SameSite=Lax` flags; `Secure` is added automatically when TLS is active
- The bridge does not perform its own authentication — it trusts requests from the web server

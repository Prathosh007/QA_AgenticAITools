@echo off
:: start-web.cmd — Wrapper to start uems-agent-web with correct env vars
:: Called by start-servers.ps1

set UEMS_MODE=standalone
set PORT=443
set UEMS_TLS_SELF_SIGNED=true
set UEMS_TESTCASE_DB_URL=http://prathosh-14802-t:3000
set UEMS_PUBLIC_DIR=D:\AgentQA_Tools\source\uems-agent-web\frontend
set UEMS_REPO_DIR=D:\AgentQA_Tools\Code base

cd /d D:\AgentQA_Tools\source\uems-agent-web
bin\uems-agent-web.exe

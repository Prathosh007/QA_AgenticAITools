$base = 'D:\AgentQA_Tools\service-specific-master-key\Agent Code Diff'
$pairs = @(
  @('uems_agent_utils','origin/SSMK_26.20.01','UEMS_AGENT_UTILS_26.20.01'),
  @('uems_agent_framework','origin/SSMK_26.20.01','UEMS_AGENT_FRAMEWORK_26.20.01'),
  @('uems_ds','origin/SSMK_26.20.01','UEMS_DS_26.20.01'),
  @('uems_server_native','origin/SSMK_26.20.01','UEMS_SERVER_NATIVE_26.20.01'),
  @('dc_native','origin/SSMK_26.20.01','DC_NATIVE_26.20.01'),
  @('agent-utils','origin/service-specific-key-26.18','UEMS_MAC_AGENT_UTILS_26.18.01'),
  @('framework-ops-suite','origin/service-specific-key-26.20','UEMS_MAC_AGENT_FRAMEWORK_26.20.01')
)
foreach($p in $pairs){
  $repo=$p[0]; $src=$p[1]; $tgt=$p[2]
  Write-Host "=== $repo ($src vs $tgt) ===" -ForegroundColor Yellow
  Push-Location (Join-Path $base $repo)
  $srcOK = git rev-parse --verify $src 2>$null
  $tgtOK = git rev-parse --verify $tgt 2>$null
  if(-not $srcOK){ Write-Host "  SRC MISSING: $src" -ForegroundColor Red }
  if(-not $tgtOK){ Write-Host "  TGT MISSING: $tgt" -ForegroundColor Red }
  if($srcOK -and $tgtOK){
    $stat = git diff --shortstat $tgt $src
    Write-Host "  shortstat: $stat"
    $files = git diff --name-status $tgt $src
    Write-Host "  files changed: $($files.Count)"
  }
  Pop-Location
}

$base = 'D:\AgentQA_Tools\service-specific-master-key\Agent Code Diff'
$out  = 'D:\AgentQA_Tools\service-specific-master-key\_diffs'
New-Item -ItemType Directory -Force -Path $out | Out-Null
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
  Push-Location (Join-Path $base $repo)
  git diff --name-status $tgt $src > (Join-Path $out "$repo.names.txt")
  git log --oneline "$tgt..$src" > (Join-Path $out "$repo.commits.txt")
  git diff --stat $tgt $src > (Join-Path $out "$repo.stat.txt")
  git diff $tgt $src > (Join-Path $out "$repo.full.diff")
  Pop-Location
  Write-Host "Done: $repo"
}

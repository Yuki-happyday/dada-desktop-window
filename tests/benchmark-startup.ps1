param([Parameter(Mandatory=$true)][string]$ObsidianExecutable,[string]$Label='baseline',[int]$Runs=3,[switch]$Extension)
$ErrorActionPreference='Stop'
$vault=(Resolve-Path -LiteralPath "$PSScriptRoot/../../desktop-test-vault").Path
$profile=(Resolve-Path -LiteralPath "$PSScriptRoot/../../obsidian-test-profile").Path
for($i=1;$i -le $Runs;$i++){
 $plugins=@('editing-toolbar','homepage','dataview','dada-todo-list')
 if($Extension){$plugins+='dada-desktop-window'}
 [IO.File]::WriteAllText((Join-Path $vault '.obsidian/community-plugins.json'),($plugins|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 Copy-Item -LiteralPath "$PSScriptRoot/../../benchmark-workspace.json" -Destination (Join-Path $vault '.obsidian/workspace.json') -Force
 $dataFile=Join-Path $vault '.obsidian/plugins/dada-desktop-window/data.json'
 $data=Get-Content -LiteralPath $dataFile -Raw|ConvertFrom-Json
 $data.desktop.wasOpen=$true;$data.desktop.side=$null
 [IO.File]::WriteAllText($dataFile,($data|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 $started=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 $instance=Start-Process -FilePath $ObsidianExecutable -ArgumentList @(('--user-data-dir="'+$profile+'"'),'--remote-debugging-port=9335','--remote-debugging-address=127.0.0.1') -WindowStyle Hidden -PassThru -RedirectStandardOutput "$PSScriptRoot/../../startup-$Label-$i.stdout.log" -RedirectStandardError "$PSScriptRoot/../../startup-$Label-$i.stderr.log"
 & node "$PSScriptRoot/startup-probe.mjs" "$Label-$i" $started
 if($LASTEXITCODE -ne 0){throw 'Startup measurement failed'}
 if(!$instance.WaitForExit(10000)){throw 'Isolated app did not exit after measurement'}
}

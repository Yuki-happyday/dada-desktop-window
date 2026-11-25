$ErrorActionPreference='Stop'
function Probe([string]$body){
 $expression='(async()=>{if(!app.vault.adapter.basePath.endsWith("desktop-test-vault"))throw Error("Wrong vault");const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop;'+$body+'})()'
 $raw=& node "$PSScriptRoot/cdp.mjs" $expression
 if($LASTEXITCODE -ne 0){throw 'CDP probe failed'}
 return ($raw|ConvertFrom-Json)
}
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class EdgeInput {
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int X;public int Y;}
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
}
'@
$dpi=[EdgeInput]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$cursor=[EdgeInput+Point]::new();[EdgeInput]::GetCursorPos([ref]$cursor)|Out-Null
$results=[Collections.Generic.List[object]]::new()
try{
 Probe 'await d.open();return true;'|Out-Null
 foreach($side in @('left','right')){
  $params=Probe ('d.setSnapEnabled(true);d.setAutoHide(false);d.expand(true);d.setAlwaysOnTop(true);const a=d.screen.getPrimaryDisplay().workArea;d.native.setBounds({x:a.x+Math.round((a.width-405)/2),y:a.y+150,width:405,height:614});return true;')
  Start-Sleep -Milliseconds 350
  $drag=Probe ('const w=d.ownerWindow,c=d.native.getContentBounds(),b=d.native.getBounds(),a=d.display().workArea,side='+($side|ConvertTo-Json -Compress)+';const x=180,y=12,target=side==="left"?a.x-90:a.x+a.width-b.width+90;return {before:b,side,start:d.screen.dipToScreenPoint({x:c.x+x,y:c.y+y}),end:d.screen.dipToScreenPoint({x:c.x+x+target-b.x,y:c.y+y})};')
  [EdgeInput]::SetCursorPos($drag.start.x,$drag.start.y)|Out-Null
  Start-Sleep -Milliseconds 80
  [EdgeInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [EdgeInput]::SetCursorPos($drag.start.x+8,$drag.start.y)|Out-Null
  Start-Sleep -Milliseconds 80
  for($step=1;$step -le 10;$step++){
   [EdgeInput]::SetCursorPos([int]($drag.start.x+($drag.end.x-$drag.start.x)*$step/10),$drag.start.y)|Out-Null
   Start-Sleep -Milliseconds 50
  }
  [EdgeInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 450
  $result=Probe 'const b=d.native.getBounds(),a=d.display().workArea;return {version:p.manifest.version,side:d.side,bounds:b,leftGap:b.x-a.x,rightGap:a.x+a.width-b.x-b.width,dragging:d.dragging,saved:d.saved.bounds,polling:!!d.poll};'
  $results.Add($result);$result|ConvertTo-Json -Compress|Write-Output
  if($result.side -ne $side){throw "Failed to snap after dragging 90px past $side edge"}
  $gap=if($side -eq 'left'){$result.leftGap}else{$result.rightGap}
  if([Math]::Abs($gap) -gt 2){throw "Window did not align to $side edge"}
  if($result.polling){throw 'Hidden polling active while autoHide is off'}
 }
 $results|ConvertTo-Json -Depth 6|Set-Content -LiteralPath "$PSScriptRoot/../../past-edge-results.json" -Encoding utf8
}finally{
 [EdgeInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 [EdgeInput]::SetCursorPos($cursor.X,$cursor.Y)|Out-Null
 [EdgeInput]::SetThreadDpiAwarenessContext($dpi)|Out-Null
}

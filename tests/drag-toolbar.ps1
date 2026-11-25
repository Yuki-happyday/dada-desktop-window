$ErrorActionPreference = 'Stop'
function Invoke-DadaProbe([string]$body) {
    $expression = '(async()=>{if(!app.vault.adapter.basePath.endsWith("desktop-test-vault"))throw Error("Wrong vault");const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop,w=d.ownerWindow,r=d.leaf?.view.vueRoot;' + $body + '})()'
    $result = & node "$PSScriptRoot/cdp.mjs" $expression
    if ($LASTEXITCODE -ne 0) { throw 'Obsidian probe failed' }
    return ($result | ConvertFrom-Json)
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DadaToolbarDragTest {
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; }
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
'@
function Invoke-DadaClick([string]$label) {
    $body = 'const b=[...w.document.querySelectorAll(".dada-desktop-toolbar button")].find(b=>b.textContent===' + (ConvertTo-Json -InputObject $label -Compress) + ');const rect=b.getBoundingClientRect(),c=d.native.getContentBounds();return d.screen.dipToScreenPoint({x:Math.round(c.x+rect.x+rect.width/2),y:Math.round(c.y+rect.y+rect.height/2)});'
    $point = Invoke-DadaProbe $body
    [DadaToolbarDragTest]::SetCursorPos($point.x,$point.y) | Out-Null
    [DadaToolbarDragTest]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [DadaToolbarDragTest]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 180
}
function Invoke-DadaDrag([string]$region,[int]$dx,[int]$dy,[switch]$AllowSnap) {
    Invoke-DadaProbe 'd.expand(true);return true;'|Out-Null
    Start-Sleep -Milliseconds 250
    $body = 'const title=w.document.querySelector(".dada-desktop-toolbar strong"),range=w.document.createRange();range.selectNodeContents(title);const t=range.getBoundingClientRect(),b=title.getBoundingClientRect(),c=d.native.getContentBounds();const x=' + (ConvertTo-Json -InputObject $region -Compress) + '==="title"?t.x+t.width/2:b.right-12;const y=b.y+b.height/2;return {bounds:d.native.getBounds(),start:d.screen.dipToScreenPoint({x:Math.round(c.x+x),y:Math.round(c.y+y)}),end:d.screen.dipToScreenPoint({x:Math.round(c.x+x+' + $dx + '),y:Math.round(c.y+y+' + $dy + ')})};'
    $drag = Invoke-DadaProbe $body
    if ($region -eq 'upper') {
        $body='const b=w.document.querySelector(".titlebar").getBoundingClientRect(),c=d.native.getContentBounds();if(b.height<10)throw Error("No upper titlebar");const x=b.x+b.width/2,y=b.y+8;return {bounds:d.native.getBounds(),start:d.screen.dipToScreenPoint({x:Math.round(c.x+x),y:Math.round(c.y+y)}),end:d.screen.dipToScreenPoint({x:Math.round(c.x+x+'+$dx+'),y:Math.round(c.y+y+'+$dy+')})};'
        $drag=Invoke-DadaProbe $body
    }
    [DadaToolbarDragTest]::SetCursorPos($drag.start.x,$drag.start.y) | Out-Null
    Start-Sleep -Milliseconds 120
    [DadaToolbarDragTest]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 120
    try {
        # Start Windows' native move loop before the measured drag.
        [DadaToolbarDragTest]::SetCursorPos($drag.start.x+8,$drag.start.y) | Out-Null
        Start-Sleep -Milliseconds 120
        [DadaToolbarDragTest]::SetCursorPos($drag.start.x,$drag.start.y) | Out-Null
        Start-Sleep -Milliseconds 80
        for ($step=1; $step -le 8; $step++) {
            $x=[int]($drag.start.x+($drag.end.x-$drag.start.x)*$step/8)
            $y=[int]($drag.start.y+($drag.end.y-$drag.start.y)*$step/8)
            [DadaToolbarDragTest]::SetCursorPos($x,$y) | Out-Null
            Start-Sleep -Milliseconds 60
        }
    } finally { [DadaToolbarDragTest]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
    Start-Sleep -Milliseconds 350
    $after=Invoke-DadaProbe 'return d.native.getBounds();'
    # Windows may resize a window through Aero Snap when it reaches an edge.
    if ($AllowSnap -and [Math]::Abs($after.x) -gt 16) { throw 'Window did not reach the docking edge' }
    $restoredFromSnap=([Math]::Abs($after.width-$drag.bounds.width) -gt 8 -or [Math]::Abs($after.height-$drag.bounds.height) -gt 8)
    if (!$AllowSnap -and $restoredFromSnap -and $dx -gt 0 -and $after.x -le $drag.bounds.x+16) { throw 'Window did not move away from the snapped edge' }
    if (!$AllowSnap -and !$restoredFromSnap -and ([Math]::Abs(($after.x-$drag.bounds.x)-$dx) -gt 8 -or [Math]::Abs(($after.y-$drag.bounds.y)-$dy) -gt 8)) {
        throw "Drag failed for $region : before=$($drag.bounds | ConvertTo-Json -Compress), after=$($after | ConvertTo-Json -Compress)"
    }
}
$previousDpi=[DadaToolbarDragTest]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$originalCursor=[DadaToolbarDragTest+Point]::new()
[DadaToolbarDragTest]::GetCursorPos([ref]$originalCursor) | Out-Null
$checks=[System.Collections.Generic.List[string]]::new()
try {
    Invoke-DadaProbe 'await d.open();d.setSnapEnabled(true);d.setAutoHide(false);d.resetPosition();d.setAlwaysOnTop(true);return true;' | Out-Null
    Invoke-DadaProbe 'for(const name of ["menu","modal-container"]){const e=w.document.createElement("div");e.className=name;e.dataset.dragRegression="true";e.style.display="none";w.document.body.append(e);}return true;' | Out-Null
    Invoke-DadaDrag 'upper' -90 -50
    $checks.Add('PASS actual top edge of the native titlebar moves window')
    Invoke-DadaDrag 'title' 70 35
    $checks.Add('PASS actual title-text drag moves window')
    Invoke-DadaDrag 'blank' 70 35
    $checks.Add('PASS actual toolbar-blank drag moves window')
    $point=Invoke-DadaProbe 'const b=w.document.querySelector(".titlebar").getBoundingClientRect(),c=d.native.getContentBounds();return d.screen.dipToScreenPoint({x:Math.round(c.x+b.width/2),y:Math.round(c.y+20)});'
    for($toggle=0;$toggle -lt 2;$toggle++){
        [DadaToolbarDragTest]::SetCursorPos($point.x,$point.y)|Out-Null
        for($click=0;$click -lt 2;$click++){
            [DadaToolbarDragTest]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
            Start-Sleep -Milliseconds 50
            [DadaToolbarDragTest]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
            Start-Sleep -Milliseconds 60
        }
        Start-Sleep -Milliseconds 350
        $isMax=Invoke-DadaProbe 'return d.native.isMaximized();'
        if($isMax -ne ($toggle -eq 0)){throw 'Upper titlebar double-click did not toggle maximize/restore'}
        if($toggle -eq 0){$point=Invoke-DadaProbe 'const c=d.native.getContentBounds();return d.screen.dipToScreenPoint({x:c.x+Math.round(c.width/2),y:c.y+20});'}
    }
    $checks.Add('PASS upper titlebar double-click maximizes and restores')
    Invoke-DadaProbe 'd.resetPosition();return true;'|Out-Null
    Start-Sleep -Milliseconds 250
    $bounds=Invoke-DadaProbe 'return d.native.getBounds();'
    Invoke-DadaDrag 'upper' (-[int]$bounds.x+8) 0 -AllowSnap
    if ((Invoke-DadaProbe 'return d.side;') -ne 'left'){throw 'No left snap with autoHide disabled'}
    $right=Invoke-DadaProbe 'const a=d.display().workArea,b=d.native.getBounds();return a.x+a.width-b.width-b.x-8;'
    Invoke-DadaDrag 'upper' ([int]$right) 0
    if ((Invoke-DadaProbe 'return d.side;') -ne 'right'){throw 'No right snap with autoHide disabled'}
    Start-Sleep -Milliseconds 900
    if (!(Invoke-DadaProbe 'return d.state.mode==="expanded"&&d.native.isVisible()&&!d.poll;')){throw 'autoHide=false must stay visible without polling'}
    $checks.Add('PASS left/right snap works with autoHide disabled and stays visible without polling')
    Invoke-DadaProbe 'd.setSnapEnabled(false);return true;'|Out-Null
    $bounds=Invoke-DadaProbe 'return d.native.getBounds();'
    Invoke-DadaDrag 'upper' (-[int]$bounds.x+9) 0 -AllowSnap
    if (Invoke-DadaProbe 'return d.side;'){throw 'snapEnabled=false still snapped'}
    Invoke-DadaProbe 'd.setSnapEnabled(true);return true;'|Out-Null
    $checks.Add('PASS snapping has its own effective off switch')
    $checks.Add('PASS hidden host menu and modal elements do not disable dragging')
    Invoke-DadaClick '置顶'
    if (Invoke-DadaProbe 'return d.native.isAlwaysOnTop();') { throw 'Pin button did not toggle' }
    $checks.Add('PASS pin button remains clickable')
    Invoke-DadaClick '重置位置'
    $center=Invoke-DadaProbe 'const a=d.screen.getPrimaryDisplay().workArea,b=d.native.getBounds();return {actual:b.x,expected:Math.round(a.x+(a.width-900)/2)};'
    if ([Math]::Abs($center.actual-$center.expected) -gt 5) { throw 'Reset button did not reset position' }
    $checks.Add('PASS reset button remains clickable')
    Invoke-DadaProbe 'r.openNew();return true;' | Out-Null
    $region=Invoke-DadaProbe 'return w.getComputedStyle(w.document.querySelector(".modal-container")).webkitAppRegion;'
    if ($region -ne 'no-drag') { throw 'Toolbar drag remains active under editor overlay' }
    Invoke-DadaProbe 'w.document.querySelector(".tk-close").click();return true;' | Out-Null
    $checks.Add('PASS editor overlay disables toolbar dragging')
    Invoke-DadaClick '贴边隐藏'
    if (!(Invoke-DadaProbe 'return d.saved.autoHide;')) { throw 'Hide button did not enable docking' }
    $bounds=Invoke-DadaProbe 'return d.native.getBounds();'
    Invoke-DadaDrag 'title' (-[int]$bounds.x) 0 -AllowSnap
    $outside=Invoke-DadaProbe 'const a=d.screen.getPrimaryDisplay().workArea;return d.screen.dipToScreenPoint({x:a.x+a.width-50,y:a.y+50});'
    [DadaToolbarDragTest]::SetCursorPos($outside.x,$outside.y) | Out-Null
    Start-Sleep -Milliseconds 1500
    $edge=Invoke-DadaProbe 'if(d.state.mode!=="collapsed")throw Error("Did not hide after toolbar drag");const b=d.handle.getBounds();return d.screen.dipToScreenPoint({x:b.x+5,y:b.y+50});'
    [DadaToolbarDragTest]::SetCursorPos($edge.x,$edge.y) | Out-Null
    Start-Sleep -Milliseconds 550
    if (!(Invoke-DadaProbe 'return d.state.mode==="expanded"&&d.native.isVisible();')) { throw 'Hover did not reveal window' }
    Invoke-DadaDrag 'title' 150 0
    if ((Invoke-DadaProbe 'return d.side;') -eq 'left') { throw 'Window stayed docked after dragging away' }
    $checks.Add('PASS toolbar drag docks, hover reveals, and drag away undocks')
    Invoke-DadaClick '关闭'
    if (Invoke-DadaProbe 'return d.alive();') { throw 'Close button did not close window' }
    $checks.Add('PASS close button remains clickable')
    $checks | Write-Output
    $checks | ConvertTo-Json | Set-Content -LiteralPath "$PSScriptRoot/../../toolbar-drag-results.json" -Encoding utf8
} finally {
    [DadaToolbarDragTest]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
    [DadaToolbarDragTest]::SetCursorPos($originalCursor.X,$originalCursor.Y) | Out-Null
    [DadaToolbarDragTest]::SetThreadDpiAwarenessContext($previousDpi) | Out-Null
}

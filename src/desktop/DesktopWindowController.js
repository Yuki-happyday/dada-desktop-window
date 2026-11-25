import { Notice } from 'obsidian';
import { setInterval, clearInterval, setTimeout, clearTimeout } from 'node:timers';
import { clampBounds, dockSide, alignBounds, stripBounds, contains, nextDockState, needsReposition } from './dock.js';
import { DedicatedWindowContent } from './windowContent.js';

export class DesktopWindowController {
 constructor(plugin) {
  this.plugin=plugin; this.state={mode:'expanded'}; this.cleanups=[]; this.pending=null;
  this.disposed=false; this.side=null; this.buttonsDown=false; this.dragging=false;
 }
 get saved() { return this.plugin.settings.desktop; }
 alive() { try {return !!this.native && !this.native.isDestroyed();}catch{return false;} }
 remote() {
  const req=window.require;
  const electron=req('electron');
  return electron.remote || req('@electron/remote');
 }
 display(bounds) { return this.screen.getDisplayMatching(bounds||this.native.getBounds()); }
 async open({focus=true}={}) {
  if(this.disposed) return;
  if(this.pending) return this.pending;
  if(this.alive()) { this.expand(focus);return; }
  this.pending=this.create(focus).catch(e=>{this.release(false); new Notice('无法打开桌面日程：'+e.message); console.error('[Dada Desktop]',e);}).finally(()=>{this.pending=null;});
  return this.pending;
 }
 async create(focus) {
  this.quitting=false;
  this.plugin.prepare();
  const workspace=this.plugin.app.workspace;
  this.plugin.app.workspace.detachLeavesOfType(this.plugin.viewType);
  const mainLeaf=workspace.getMostRecentLeaf(workspace.rootSplit);
  const remote=this.remote(); this.screen=remote.screen;
  const area=this.saved.bounds ? this.screen.getDisplayMatching(this.saved.bounds).workArea : this.screen.getPrimaryDisplay().workArea;
  this.bounds=clampBounds(this.saved.bounds,area);
  this.leaf=this.plugin.app.workspace.openPopoutLeaf(this.bounds);
  await this.leaf.setViewState({type:this.plugin.viewType,active:false});
  await this.leaf.loadIfDeferred();
  this.leaf.setPinned(true);
  if(mainLeaf)workspace.setActiveLeaf(mainLeaf,{focus:false});
  if(this.disposed) {this.leaf.detach();return;}
  const win=this.leaf.view.containerEl.ownerDocument.defaultView;
  for(let n=0; !win.electronWindow && n<50;n++) await new Promise(r=>setTimeout(r,50));
  this.native=win.electronWindow ? remote.BrowserWindow.fromId(win.electronWindow.id) : null;
  if(!this.native) throw new Error('Obsidian 未提供窗口控制接口');
  this.ownerWindow=win;
  // Construct the UI once, in its final document.
  await this.leaf.view.mountInWindow();
  if(this.disposed||!this.alive()||this.leaf?.view.closed){this.release(false);return;}
  this.windowContent=new DedicatedWindowContent(workspace,this.leaf,this.plugin.viewType);
  const contentGuard=this.windowContent;this.cleanups.push(()=>contentGuard.dispose());
  this.native.setParentWindow(null);
  this.native.setBounds(this.bounds);
  this.native.setAlwaysOnTop(!!this.saved.alwaysOnTop);
  this.side=this.saved.snapEnabled===false?null:this.saved.side;
  if(this.side){this.bounds=alignBounds(this.bounds,area,this.side);this.native.setPosition(this.bounds.x,this.bounds.y);}
  this.native.webContents.setBackgroundThrottling(false);
  win.document.body.classList.add('dada-desktop-window');
  this.buildToolbar(win.document);
  const on=(target,event,fn)=>{target.on(event,fn);this.cleanups.push(()=>{if(!target.isDestroyed?.())target.removeListener(event,fn);});};
  const settle=()=>{if(this.settingBounds)return; this.lastMotion=Date.now(); clearTimeout(this.moveTimer); this.moveTimer=setTimeout(()=>this.settle(),220);};
  on(this.native,'move',settle); on(this.native,'resize',settle);
  on(this.native,'will-move',()=>{this.dragging=true;this.lastMotion=Date.now();});
  on(this.native,'moved',()=>{this.dragging=false;this.buttonsDown=false;this.lastMotion=Date.now();this.settle();});
  on(this.native,'will-resize',()=>{this.dragging=true;});
  on(this.native,'resized',()=>{this.dragging=false;this.settle();});
  on(this.native,'closed',()=>this.release(!this.quitting&&!this.disposed));
  const beforeQuit=()=>{this.quitting=true;this.persist();};
  remote.app.on('before-quit',beforeQuit);
  window.addEventListener('beforeunload',beforeQuit);
  this.cleanups.push(()=>{remote.app.removeListener('before-quit',beforeQuit);window.removeEventListener('beforeunload',beforeQuit);});
  const screenChanged=()=>{if(!this.alive())return; const a=this.display(this.bounds).workArea; this.bounds=alignBounds(this.bounds,a,this.side); this.settingBounds=true;this.native.setBounds(this.bounds);this.settingBounds=false;this.positionHandle();this.persist();};
  this.screen.on('display-removed',screenChanged);this.screen.on('display-metrics-changed',screenChanged);
  this.cleanups.push(()=>{this.screen.removeListener('display-removed',screenChanged);this.screen.removeListener('display-metrics-changed',screenChanged);});
  const listen=(target,event,fn)=>{target.addEventListener(event,fn,true);this.cleanups.push(()=>target.removeEventListener(event,fn,true));};
  listen(win,'pointerdown',()=>{this.buttonsDown=true;});
  listen(win,'pointerup',()=>{this.buttonsDown=false;});
  listen(win,'blur',()=>{this.buttonsDown=false;this.dragging=false;});
  listen(win,'dragstart',()=>{this.dragging=true;});
  listen(win,'dragend',()=>{this.dragging=false;this.buttonsDown=false;});
  listen(win,'drop',()=>{this.dragging=false;this.buttonsDown=false;});
  this.configSignature=JSON.stringify(this.plugin.dada()?.settings);
  listen(win,'focus',()=>{
   if(!this.plugin.dada()){this.release(false);return;}
   const signature=JSON.stringify(this.plugin.dada().settings);
   if(signature!==this.configSignature){this.configSignature=signature;this.plugin.prepare();this.leaf?.view.vueRoot?.$forceUpdate();this.leaf?.view.vueRoot?.reload();}
  });
  this.updatePolling();
  this.saved.wasOpen=true;
  this.persist(); this.expand(focus);this.settle();
 }
 buildToolbar(doc) {
  const host=this.leaf.view.contentEl;
  const bar=doc.createElement('div');bar.className='dada-desktop-toolbar';bar.title='按住标题或空白处拖动窗口 · '+this.plugin.manifest.version;
  const title=doc.createElement('strong');title.textContent='桌面日程';bar.append(title);
  const add=(label,title,fn)=>{const b=doc.createElement('button');b.textContent=label;b.title=title;b.onclick=fn;bar.append(b);return b;};
  this.pinButton=add('置顶','让日程显示在其他应用上方',()=>this.setAlwaysOnTop(!this.saved.alwaysOnTop));
  this.hideButton=add('贴边隐藏','拖到屏幕左右边缘后自动收起',()=>this.setAutoHide(this.saved.autoHide===false));
  add('重置位置','将窗口恢复到主屏幕中央',()=>this.resetPosition());
  add('关闭','关闭桌面日程',()=>this.native.close());
  host.prepend(bar);this.cleanups.push(()=>bar.remove());
  // Both rows use native OS dragging; interactive controls are no-drag regions.
  this.updateButtons();
 }
 updateButtons() {
  this.pinButton?.classList.toggle('is-active',!!this.saved.alwaysOnTop);
  this.pinButton?.setAttribute('aria-pressed',String(!!this.saved.alwaysOnTop));
  this.hideButton?.classList.toggle('is-active',this.saved.autoHide!==false);
  this.hideButton?.setAttribute('aria-pressed',String(this.saved.autoHide!==false));
  if(this.hideButton)this.hideButton.title=this.saved.autoHide===false?'自动隐藏已关闭，吸附仍可用；点击开启贴边收起':'自动隐藏已开启：贴边后离开收起，移入窄条展开';
 }
 setAlwaysOnTop(value) { this.saved.alwaysOnTop=value; if(this.alive())this.native.setAlwaysOnTop(value);this.updateButtons();this.plugin.saveSettings(); }
 setAutoHide(value) {
  this.saved.autoHide=value;this.expand(false);
  if(this.alive())this.settle();
  this.updatePolling();
  this.updateButtons();this.persist();
 }
 setSnapEnabled(value){
  this.saved.snapEnabled=value;this.expand(false);
  if(!value)this.side=null;else if(this.alive())this.settle();
  this.updatePolling();this.persist();
 }
 updatePolling(){
  clearInterval(this.poll);this.poll=null;
  if(!this.alive()||!this.side||this.saved.autoHide===false)return;
  this.poll=setInterval(()=>{try{this.tick();}catch(e){clearInterval(this.poll);this.poll=null;console.error('[Dada Desktop] 停靠失败',e);try{this.expand(false);}catch{}this.side=null;}},100);
 }
 settle() {
  if(!this.alive()||this.state.mode==='collapsed'||this.toolbarDragging)return;
  const bounds=this.native.getBounds(), area=this.display(bounds).workArea;
  if(this.buttonsDown||this.dragging)return;
  this.side=this.saved.snapEnabled===false || this.native.isMaximized() || this.native.isFullScreen()?null:dockSide(bounds,area);
  this.bounds=this.side?alignBounds(bounds,area,this.side):{...bounds};
  if(this.side && needsReposition(bounds,this.bounds)) {this.settingBounds=true;this.native.setPosition(this.bounds.x,this.bounds.y);this.settingBounds=false;}
  this.state={mode:'expanded'};this.updatePolling();this.persist();
 }
 busy() {
  const doc=this.ownerWindow.document, focus=doc.activeElement;
  return this.buttonsDown || this.dragging || Date.now()-(this.lastMotion||0)<400 ||
   [...doc.querySelectorAll('.modal-container, .menu, .tk-ctx, .tk-tl-pop')].some(el=>el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})&&el.getClientRects().length) ||
   !!(doc.hasFocus()&&focus && (focus.matches('input, textarea, select') || focus.isContentEditable));
 }
 tick() {
  if(!this.alive())return;
  if(!this.plugin.dada()) {this.release(false);new Notice('Dada 清单已停用，桌面日程已关闭。');return;}
  const point=this.screen.getCursorScreenPoint();
  const before=this.state.mode;
  this.state=nextDockState(this.state,{now:Date.now(),docked:!!this.side&&this.saved.autoHide!==false,
   inside:this.state.mode!=='collapsed'&&contains(this.native.getBounds(),point),
   strip:this.handle&&!this.handle.isDestroyed()&&this.handle.isVisible()&&contains(this.handle.getBounds(),point),
   busy:this.state.mode==='expanded'&&this.busy()});
  if(before!==this.state.mode) {
   if(this.state.mode==='collapsed')this.collapse();else this.expand(false);
  }
 }
 ensureHandle() {
  if(this.handle&&!this.handle.isDestroyed())return;
  const {BrowserWindow}=this.remote();
  this.handle=new BrowserWindow({width:10,height:120,frame:false,transparent:true,resizable:false,focusable:false,
   skipTaskbar:true,alwaysOnTop:true,show:false,hasShadow:false,
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  this.handle.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}div{height:100%;width:100%;border-radius:5px;background:#ae7044;box-sizing:border-box;border:1px solid #ffffff88;display:flex;align-items:center;justify-content:center;color:white;font:12px sans-serif;writing-mode:vertical-rl}</style><div title="移入展开桌面日程">日程</div>'));
  this.handle.on('closed',()=>{this.handle=null;if(!this.disposed&&this.state.mode==='collapsed')this.expand(false);});
 }
 positionHandle() {if(this.handle&&!this.handle.isDestroyed()&&this.side)this.handle.setBounds(stripBounds(this.bounds,this.display(this.bounds).workArea,this.side));}
 collapse() {
  if(!this.alive()||!this.side)return;
  this.ensureHandle();this.positionHandle();this.handle.showInactive();this.native.hide();
 }
 expand(focus=false) {
  this.state={mode:'expanded',outsideAt:null,hoverAt:null};
  if(this.handle&&!this.handle.isDestroyed())this.handle.hide();
  if(!this.alive())return;
  if(this.native.isMinimized())this.native.restore();
  this.native.setAlwaysOnTop(!!this.saved.alwaysOnTop);
  if(focus){this.native.show();this.native.focus();}else this.native.showInactive();
  this.lastMotion=Date.now();
 }
 resetPosition() {
  this.saved.side=null;this.side=null;this.saved.bounds=null;
  if(this.alive()){this.expand(true);this.bounds=clampBounds({},this.screen.getPrimaryDisplay().workArea);this.native.setBounds(this.bounds);}
  this.updatePolling();this.persist();
 }
 persist() {
  if(this.bounds)this.saved.bounds={...this.bounds};
  this.saved.side=this.side;
  this.plugin.saveSettings();
 }
 release(manual=false) {
  if(this.releasing)return;this.releasing=true;
  clearInterval(this.poll);clearTimeout(this.moveTimer);
  this.cleanups.splice(0).reverse().forEach(fn=>{try{fn();}catch{}});
  if(this.handle&&!this.handle.isDestroyed()){this.handle.removeAllListeners('closed');this.handle.destroy();}
  this.handle=null;
  const native=this.native;this.native=null;const leaf=this.leaf;this.leaf=null;
  if(native&&!native.isDestroyed())native.close();
  else if(leaf)try{leaf.detach();}catch{}
  this.state={mode:'expanded'};this.buttonsDown=false;this.dragging=false;
  if(manual){this.saved.wasOpen=false;this.plugin.saveSettings();}
  this.releasing=false;
 }
 dispose() {this.disposed=true;this.persist();this.release(false);}
}

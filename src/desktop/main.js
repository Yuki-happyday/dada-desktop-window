import { ItemView, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import * as hostObsidian from 'obsidian';
import { join } from 'node:path';
import { persistSettings,resolveSettings } from './settingsStore.js';
import { DesktopWindowController } from './DesktopWindowController.js';
import {restoreAfterOpening} from './windowContent.js';
import './desktop.css';
import {version as BUILD_VERSION} from '../../manifest.json';

const VIEW='dada-desktop-window-view';
class DesktopTodoView extends ItemView {
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;}
 getViewType(){return VIEW;}
 getDisplayText(){return 'Dada 桌面日程';}
 getIcon(){return 'calendar-check';}
 async onOpen(){
  this.closed=false;
  // A restored main-tab view also mounts lazily; popouts are mounted by their
  // controller after Obsidian has finished moving the leaf to its document.
  if(this.plugin.settings.openLocation==='main')this.app.workspace.onLayoutReady(()=>queueMicrotask(()=>{
   if(!this.closed&&!this.plugin.desktop.pending&&this.leaf.getContainer()===this.app.workspace.rootSplit)
    this.mountInWindow().catch(e=>new Notice('日程界面加载失败：'+e.message));
  }));
 }
 async mountInWindow(){
  if(this.mounted||this.closed)return;
  this.mounted=true;
  const ui=await this.plugin.ensureUi();
  if(!this.closed)this.cleanupUi=ui.mount(this.plugin,this);
 }
 async onClose(){this.closed=true;this.cleanupUi?.();this.cleanupUi=null;this.mounted=false;this.contentEl.empty();}
}
class DesktopSettings extends PluginSettingTab {
 display(){
  const p=this.plugin,c=this.containerEl;c.empty();
  c.createEl('h2',{text:'Dada 桌面日程'});
  c.createEl('p',{text:'独立扩展，不修改 Dada 本体。需要启用 Dada Todo List；任务位置、标签及配色沿用 Dada 设置。'});
  new Setting(c).setName('桌面日程').setDesc('Obsidian 最小化后仍可使用；完全退出时关闭。')
   .addButton(b=>b.setButtonText('打开桌面日程').setCta().onClick(()=>p.desktop.open()));
  new Setting(c).setName('日程打开位置').addDropdown(d=>d.addOption('main','Obsidian 内').addOption('desktop','桌面窗口')
   .setValue(p.settings.openLocation).onChange(async v=>{p.settings.openLocation=v;await p.saveSettings();}));
  new Setting(c).setName('始终置顶').addToggle(v=>v.setValue(p.settings.desktop.alwaysOnTop).onChange(v=>p.desktop.setAlwaysOnTop(v)));
  new Setting(c).setName('贴边吸附').setDesc('距屏幕左右边缘 16 像素内松手时对齐边缘；独立于隐藏开关。')
   .addToggle(v=>v.setValue(p.settings.desktop.snapEnabled!==false).onChange(v=>p.desktop.setSnapEnabled(v)));
  new Setting(c).setName('贴边隐藏').setDesc('拖到屏幕左右边缘，离开后收起；鼠标靠近窄条时展开。')
   .addToggle(v=>v.setValue(p.settings.desktop.autoHide!==false).onChange(v=>p.desktop.setAutoHide(v)));
  new Setting(c).setName('重置窗口位置').addButton(b=>b.setButtonText('重置到主屏幕').onClick(()=>p.desktop.resetPosition()));
  c.createEl('p',{text:'界面基于 Dada 0.12.2。更新 Dada 不会覆盖本扩展；新版界面功能和任务格式变化可能需要另行适配。'});
 }
}
export default class DadaDesktopPlugin extends Plugin {
 async onload(){
  this.manifest.version=BUILD_VERSION;
  const data=await this.loadData()||{};
  this.settings=resolveSettings(data);
  if(data.desktop?.edgeHideConfigured!==true)await this.saveSettings();
  this.viewType=VIEW;this.desktop=new DesktopWindowController(this);
  this.adapter={app:this.app,manifest:{id:'dada-todo-list',name:'Dada Todo List'},
   get settings(){return this.owner.dada()?.settings||{};},owner:this,
   setTagColor:(tag,color)=>this.dada()?.setTagColor(tag,color),
   saveSettings:()=>this.dada()?.saveSettings(),
   reloadOpenViews:()=>{this.reloadOpenViews();this.dada()?.reloadOpenViews();},
   registerHoverLinkSource:(...args)=>this.registerHoverLinkSource(...args),
   unregisterHoverLinkSource:(...args)=>this.unregisterHoverLinkSource(...args),
   registerDomEvent:(...args)=>this.registerDomEvent(...args)};
  this.registerView(VIEW,leaf=>new DesktopTodoView(leaf,this));
  this.addCommand({id:'open-desktop-schedule',name:'打开桌面日程',callback:()=>this.desktop.open()});
  this.addCommand({id:'open-schedule',name:'打开日程（按设置位置）',callback:()=>this.openSchedule()});
  this.addCommand({id:'reset-window-position',name:'重置桌面日程位置',callback:()=>this.desktop.resetPosition()});
  this.addRibbonIcon('calendar-check','Dada 桌面日程',()=>this.openSchedule());
  this.addSettingTab(new DesktopSettings(this.app,this));
  this.register(restoreAfterOpening(this.app,()=>{
   if(this.settings.desktop.wasOpen&&!this.desktop.alive()&&!this.desktop.pending)this.desktop.open({focus:false});
  }));
 }
 async ensureUi(){
  if(!this.uiPromise)this.uiPromise=(async()=>{
   const dir=this.manifest.dir||this.app.vault.configDir+'/plugins/'+this.manifest.id;
   const [source,css]=await Promise.all([this.app.vault.adapter.read(dir+'/ui.cjs'),this.app.vault.adapter.read(dir+'/ui.css')]);
   const module={exports:{}};
   // Load only this installed plugin's compiled UI. Obsidian is supplied by the
   // host loader; native Node resolution cannot resolve that virtual module.
   new Function('require','module','exports',source)(id=>id==='obsidian'?hostObsidian:window.require(id),module,module.exports);
   this.ui=module.exports;await this.ui.initialize(this,css);return this.ui;
  })().catch(e=>{this.uiPromise=null;throw e;});
  return this.uiPromise;
 }
 dada(){return this.app.plugins.getPlugin('dada-todo-list');}
 prepare(){
  const dada=this.dada();
  if(!dada?.settings)throw new Error('请先安装并启用 Dada Todo List');
  if(this.boundDada!==dada){
   this.boundDada=dada;
   dada.register(()=>{if(this.boundDada===dada&&!this.desktop.disposed){this.desktop.release(false);this.app.workspace.detachLeavesOfType(VIEW);}});
  }
  this.ui?.prepare(this);
 }
 async openSchedule(){
  if(this.settings.openLocation==='desktop')return this.desktop.open();
  try{this.prepare();this.desktop.release(true);const leaf=this.app.workspace.getLeavesOfType(VIEW).find(l=>l!==this.desktop.leaf)||this.app.workspace.getLeaf('tab');
   await leaf.setViewState({type:VIEW,active:true});await this.app.workspace.revealLeaf(leaf);await leaf.view.mountInWindow();
  }catch(e){new Notice(e.message);}
 }
 saveSettings(){
  try{
   const dir=this.manifest.dir || this.app.vault.configDir+'/plugins/'+this.manifest.id;
   persistSettings(join(this.app.vault.adapter.getBasePath(),dir,'data.json'),this.settings);
   this.saveQueue=Promise.resolve();
  }catch(e){console.error('[Dada Desktop] 保存设置失败',e);if(!this.settingsError){this.settingsError=true;new Notice('桌面日程设置保存失败：'+e.message);}}
  return this.saveQueue||Promise.resolve();
 }
 reloadOpenViews(){for(const leaf of this.app.workspace.getLeavesOfType(VIEW))leaf.view.vueRoot?.reload();}
 onunload(){this.desktop?.dispose();this.app.workspace.detachLeavesOfType(VIEW);this.ui?.dispose(this);}
}

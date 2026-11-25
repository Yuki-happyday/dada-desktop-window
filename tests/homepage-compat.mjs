import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {connect} from './cdp.mjs';
const c=await connect(),delay=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
try{
 const base=await c.evaluate('app.vault.adapter.basePath');assert(base.endsWith('desktop-test-vault'));
 const configPath=base+'/.obsidian/plugins/homepage/data.json';
 const before=createHash('sha256').update(await fs.readFile(configPath)).digest('hex');
 for(let n=0;n<100;n++){
  if(await c.evaluate('!!app.plugins.getPlugin("dada-desktop-window")?.desktop.alive()'))break;
  await delay(100);
 }
 const inspect=()=>c.evaluate('(()=>{const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop;const tabs=d.leaf.parent;return {version:p.manifest.version,homeReady:app.plugins.getPlugin("homepage").loaded,view:d.leaf.getViewState().type,current:tabs.children[tabs.currentTab]?.getViewState().type,tabCount:tabs.children.length,toolbarVisible:d.ownerWindow.document.querySelector(".dada-desktop-toolbar")?.checkVisibility(),mainHomepage:app.workspace.getLeavesOfType("markdown").some(l=>l.getContainer()===app.workspace.rootSplit&&l.getViewState().state?.file==="taskscalendar/calendar.md")};})()');
 const check=async name=>{const s=await inspect();assert.equal(s.homeReady,true);assert.equal(s.current,'dada-desktop-window-view',JSON.stringify(s));assert.equal(s.tabCount,1,JSON.stringify(s));assert.equal(s.toolbarVisible,true);assert.equal(s.mainHomepage,true);results.push(name);console.log('PASS '+name);};
 await check('startup keeps Homepage in main and restores a visible Dada-only window');
 await c.evaluate('(async()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop,h=app.plugins.getPlugin("homepage").homepage;h.computedValue=await h.computeValue();app.workspace.setActiveLeaf(d.leaf,{focus:false});const opened=await h.launchNote("Keep open notes");await new Promise(r=>setTimeout(r,100));if(opened.getContainer()!==app.workspace.rootSplit)throw Error("Homepage went into widget");return true;})()');
 await check('Homepage opening a new tab cannot cover Dada');
 await c.evaluate('(async()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;await d.leaf.setViewState({type:"markdown",state:{file:"taskscalendar/calendar.md"},active:true});return true;})()');await delay(100);
 await check('direct note replacement is routed to main without replacing Dada');
 const after=createHash('sha256').update(await fs.readFile(configPath)).digest('hex');assert.equal(after,before);
 console.log('PASS Homepage configuration remains unchanged');results.push('Homepage configuration remains unchanged');
 await fs.writeFile('../homepage-compat-results.json',JSON.stringify({snapshot:await inspect(),checks:results},null,2));
}finally{c.close();}

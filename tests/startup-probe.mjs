import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
const label=process.argv[2],started=Number(process.argv[3]);let c;
for(let n=0;n<200;n++){try{c=await connect();break;}catch{await new Promise(r=>setTimeout(r,50));}}
if(!c)throw Error('No isolated browser');
try{
 const observe='globalThis.__desktopLongTasks=[];new PerformanceObserver(list=>globalThis.__desktopLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:"longtask",buffered:true});true';
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:observe});await c.evaluate(observe);
 let snapshot;
 for(let n=0;n<300;n++){
  try{snapshot=await c.evaluate('(()=>{if(typeof app==="undefined"||!app.workspace.layoutReady||!app.plugins.getPlugin("homepage")?.loaded)return null;return {readyAt:Date.now(),title:document.title,extension:!!app.plugins.getPlugin("dada-desktop-window"),theme:app.vault.getConfig("cssTheme")};})()');if(snapshot)break;}catch{}
  await new Promise(r=>setTimeout(r,50));
 }
 if(!snapshot)throw Error('Main window did not become ready');
 snapshot.readyMs=snapshot.readyAt-started;
 if(snapshot.extension)for(let n=0;n<150;n++){
  if(await c.evaluate('!!app.plugins.getPlugin("dada-desktop-window")?.desktop.leaf?.view.vueRoot'))break;
  await new Promise(r=>setTimeout(r,100));
 }
 await new Promise(r=>setTimeout(r,1000));
 snapshot.layout=await c.evaluate('(()=>{const selectors=["#editingToolbarModalBar",".markdown-source-view",".tasksCalendar"],d=app.plugins.getPlugin("dada-desktop-window")?.desktop;return {items:selectors.map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return {s,count:document.querySelectorAll(s).length,width:r?.width,height:r?.height};}),bodyClasses:document.body.className,widgetVisible:!!d?.alive(),tasks:document.querySelectorAll(".tasksCalendar").length};})()');
 snapshot.runtime=await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window")?.desktop;return {mountCount:d?.leaf?.view.mountCount,polling:!!d?.poll,uiRoot:!!d?.leaf?.view.vueRoot,longTasks:(globalThis.__desktopLongTasks||[]).slice(-30)};})()');
 await fs.writeFile('../startup-'+label+'.json',JSON.stringify(snapshot,null,2));console.log(JSON.stringify({label,readyMs:snapshot.readyMs,widgetVisible:snapshot.layout.widgetVisible,runtime:snapshot.runtime}));
 await c.evaluate('window.electronWindow.showInactive();true');await new Promise(r=>setTimeout(r,250));
 const png=await c.evaluate('(async()=>{return (await window.electronWindow.webContents.capturePage()).toDataURL();})()');
 await fs.writeFile('../startup-'+label+'.png',Buffer.from(png.split(',')[1],'base64'));
 await c.evaluate('setTimeout(()=>electron.remote.app.quit(),100);true');
}finally{c.close();}

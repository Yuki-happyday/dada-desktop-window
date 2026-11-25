import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connect } from './cdp.mjs';
const c=await connect(),results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const run=async(name,fn)=>{await fn();results.push({name,passed:true});console.log('PASS '+name);};
try{
 assert((await c.evaluate('app.vault.adapter.basePath')).endsWith('desktop-test-vault'));
 await run('one window and top-level lifetime',async()=>{
  const r=await c.evaluate('(async()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;const id=d.native.id;await d.open();return {same:id===d.native.id,parent:d.native.getParentWindow()?.id||null,tasks:d.leaf.view.vueRoot.tasks.length};})()');
  assert.equal(r.same,true);assert.equal(r.parent,null);assert(r.tasks>=2);
 });
 await run('main window minimized, desktop remains visible',async()=>{
  await c.evaluate('window.electronWindow.minimize();true');await delay(350);
  const r=await c.evaluate('({main:window.electronWindow.isMinimized(),desktop:app.plugins.getPlugin("dada-desktop-window").desktop.native.isVisible()})');
  assert(r.main&&r.desktop);
  await c.evaluate('window.electronWindow.restore();true');
 });
 await run('always-on-top changes native window',async()=>{
  assert.equal(await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;d.setAlwaysOnTop(true);return d.native.isAlwaysOnTop();})()'),true);
  assert.equal(await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;d.setAlwaysOnTop(false);return d.native.isAlwaysOnTop();})()'),false);
 });
 await run('all seven task views render in desktop window',async()=>{
  for(const view of ['day','four','month','agenda','matrix','cl','all']){
   await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;d.leaf.view.vueRoot.switchView('+JSON.stringify(view)+');return true;})()');await delay(180);
   const text=await c.evaluate('app.plugins.getPlugin("dada-desktop-window").desktop.ownerWindow.document.body.innerText');
   assert(text.includes('桌面日程'));assert(!text.includes('TypeError'));
   assert.equal(await c.evaluate('app.plugins.getPlugin("dada-desktop-window").desktop.leaf.view.vueRoot.view'),view);
   const rootClass=await c.evaluate('app.plugins.getPlugin("dada-desktop-window").desktop.ownerWindow.document.querySelector(".tk-body").innerHTML');
   assert(!rootClass.includes('tk-view-leave-active'));assert(rootClass.length>100,'View body is empty: '+view);
  }
 });
 await run('task editor opens in desktop document',async()=>{
  await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;d.native.focus();d.leaf.view.vueRoot.openNew();return true;})()');await delay(200);
  const r=await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;return {desktop:d.ownerWindow.document.querySelectorAll(".modal-container").length,main:document.querySelectorAll(".modal-container").length,body:d.ownerWindow.document.body.innerText.slice(-1200)};})()');
  assert.equal(r.desktop,1,JSON.stringify(r));assert.equal(r.main,0);
  await c.evaluate('(()=>{const w=app.plugins.getPlugin("dada-desktop-window").desktop.ownerWindow;w.document.querySelector(".tk-close")?.click();return true;})()');
 });
 await delay(150);
 const png=await c.evaluate('(async()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;return (await d.native.webContents.capturePage()).toDataURL();})()');
 await fs.writeFile('../desktop-test-screenshot.png',Buffer.from(png.split(',')[1],'base64'));
 await fs.writeFile('../desktop-live-results.json',JSON.stringify(results,null,2));
}finally{c.close();}

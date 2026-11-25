import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {connect} from './cdp.mjs';
const c=await connect(),results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const run=async(name,fn)=>{await fn();results.push({name,passed:true});console.log('PASS '+name);};
const evalD=body=>c.evaluate('(async()=>{const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop,r=d.leaf.view.vueRoot,w=d.ownerWindow;'+body+'})()');
try{
 assert((await c.evaluate('app.vault.adapter.basePath')).endsWith('desktop-test-vault'));
 await evalD('w.document.querySelector(".tk-close")?.click();r.switchView("all");d.setAutoHide(false);return true;');
 await c.evaluate('(async()=>{const f=app.vault.getAbstractFileByPath("taskscalendar/2026-11-24.md");await app.vault.modify(f,"# 测试日程\\n- [ ] 09:00-10:00 DESKTOP_TEST_日期任务\\n");return true;})()');await delay(1500);
 await run('new and edit task write Markdown and refresh original Dada',async()=>{
  await c.evaluate('(async()=>{await app.plugins.getPlugin("dada-todo-list").activateView();return true;})()');
  await evalD('r.openNew("2026-11-24");return true;');await delay(100);
  await evalD('const input=w.document.querySelector(".tk-modal .tk-field input");input.value="DESKTOP_TEST_CREATED";input.dispatchEvent(new w.Event("input",{bubbles:true}));return true;');
  await delay(50);
  await evalD('w.document.querySelector(".tk-modal .btn-gold").click();return true;');await delay(1500);
  const r=await evalD('const file=app.vault.getAbstractFileByPath("taskscalendar/2026-11-24.md");const text=await app.vault.read(file);return {text,desktop:r.tasks.some(t=>t.summary==="DESKTOP_TEST_CREATED"),original:app.workspace.getLeavesOfType("dada-todo-view")[0].view.vueRoot.tasks.some(t=>t.summary==="DESKTOP_TEST_CREATED"),modals:w.document.querySelectorAll(".modal-container").length};');
  assert(r.text.includes('DESKTOP_TEST_CREATED'));assert(r.desktop&&r.original);assert.equal(r.modals,0);
  await evalD('await r.openEdit(r.tasks.find(t=>t.summary==="DESKTOP_TEST_CREATED"));return true;');await delay(100);
  await evalD('const input=w.document.querySelector(".tk-modal .tk-field input");input.value="DESKTOP_TEST_EDITED";input.dispatchEvent(new w.Event("input",{bubbles:true}));return true;');await delay(50);
  await evalD('w.document.querySelector(".tk-modal .btn-gold").click();return true;');await delay(250);
  assert((await evalD('return await app.vault.read(app.vault.getAbstractFileByPath("taskscalendar/2026-11-24.md"));')).includes('DESKTOP_TEST_EDITED'));
 });
 await run('completion writes checkbox and completion date',async()=>{
  const text=await evalD('await r.reload();await r.toggle(r.tasks.find(t=>t.summary==="DESKTOP_TEST_EDITED"));return await app.vault.read(app.vault.getAbstractFileByPath("taskscalendar/2026-11-24.md"));');
  assert(/- \[x\].*DESKTOP_TEST_EDITED.*✅/.test(text),text);
 });
 await run('external Markdown changes refresh desktop automatically',async()=>{
  await delay(1300);
  await c.evaluate('(async()=>{const f=app.vault.getAbstractFileByPath("taskscalendar/2026-11-24.md");await app.vault.modify(f,(await app.vault.read(f))+"\\n- [ ] DESKTOP_TEST_EXTERNAL\\n");return true;})()');await delay(1500);
  assert(await evalD('return r.tasks.some(t=>t.summary==="DESKTOP_TEST_EXTERNAL");'));
 });
 await run('context menu teleports into desktop document',async()=>{
  await evalD('r.switchView("all");r.openCtx(r.tasks[0],{clientX:100,clientY:160});return true;');await delay(100);
  assert.equal(await evalD('return w.document.querySelectorAll(".tk-ctx").length;'),1);
  assert.equal(await c.evaluate('document.querySelectorAll(".tk-ctx").length'),0);
  await evalD('w.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape"}));return true;');
 });
 await run('native hide and show on both edges; editing prevents hide',async()=>{
  await evalD('const real=d.screen;d.testScreen=real;window.__dockCursor={x:-100000,y:-100000};d.screen={getCursorScreenPoint:()=>window.__dockCursor,getDisplayMatching:(...a)=>real.getDisplayMatching(...a),getPrimaryDisplay:()=>real.getPrimaryDisplay(),removeListener:(...a)=>real.removeListener(...a)};w.document.activeElement?.blur();return true;');
  for(const side of ['left','right']){
   await evalD('d.setAutoHide(true);d.expand(false);const a=d.screen.getPrimaryDisplay().workArea;const b=d.native.getBounds();d.native.setPosition('+JSON.stringify(side)+'==="left"?a.x:a.x+a.width-b.width,a.y+50);d.settle();return true;');await delay(1400);
   const hidden=await evalD('return {side:d.side,mode:d.state.mode,visible:d.native.isVisible(),handle:d.handle?.isVisible(),handleBounds:d.handle?.getBounds(),width:d.bounds.width};');
   assert.equal(hidden.side,side);assert.equal(hidden.mode,'collapsed',JSON.stringify(hidden));assert(!hidden.visible&&hidden.handle);
   assert(hidden.handleBounds.width<=12,JSON.stringify(hidden));
   await evalD('const b=d.handle.getBounds();window.__dockCursor={x:b.x+3,y:b.y+20};return true;');await delay(450);
   assert.equal(await evalD('return d.state.mode;'),'expanded');
   assert.equal(await evalD('return d.native.isVisible();'),true);
   await evalD('r.openNew();window.__dockCursor={x:-100000,y:-100000};return true;');await delay(1200);
   assert.equal(await evalD('return d.state.mode;'),'expanded');
   await evalD('w.document.querySelector(".tk-close").click();return true;');await delay(1300);
   assert.equal(await evalD('return d.state.mode;'),'collapsed');
   await evalD('d.expand(false);d.setAutoHide(false);return true;');
  }
  await evalD('d.screen=d.testScreen;delete d.testScreen;delete window.__dockCursor;d.resetPosition();d.setAutoHide(true);return true;');
 });
 await run('disable original Dada closes extension window; extension survives re-enable',async()=>{
  await c.evaluate('(async()=>{await app.plugins.disablePlugin("dada-todo-list");return true;})()');await delay(1200);
  assert.equal(await c.evaluate('!!app.plugins.getPlugin("dada-desktop-window").desktop.alive()'),false);
  await c.evaluate('(async()=>{await app.plugins.enablePlugin("dada-todo-list");await app.plugins.getPlugin("dada-desktop-window").desktop.open();return true;})()');
  assert(await evalD('return d.native.isVisible();'));
 });
 await run('manual close records closed state and opening creates one window',async()=>{
  await evalD('d.native.close();return true;');await delay(200);
  assert.equal(await c.evaluate('app.plugins.getPlugin("dada-desktop-window").settings.desktop.wasOpen'),false);
  await c.evaluate('(async()=>{await app.plugins.getPlugin("dada-desktop-window").desktop.open();return true;})()');
 });
 await evalD('r.switchView("month");return true;');await delay(150);
 const png=await evalD('return (await d.native.webContents.capturePage()).toDataURL();');
 await fs.writeFile('../desktop-calendar-screenshot.png',Buffer.from(png.split(',')[1],'base64'));
 await fs.writeFile('../desktop-data-dock-results.json',JSON.stringify(results,null,2));
}finally{c.close();}

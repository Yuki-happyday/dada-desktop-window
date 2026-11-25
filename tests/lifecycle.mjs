import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {connect} from './cdp.mjs';
const c=await connect();const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 assert((await c.evaluate('app.vault.adapter.basePath')).endsWith('desktop-test-vault'));
 for(let n=0;n<150;n++){
  if(await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window")?.desktop;return !!d?.leaf?.view.vueRoot&&!d.pending;})()'))break;
  await delay(100);
 }
 const setup=process.argv[2]==='prepare'?'d.resetPosition();d.setAlwaysOnTop(true);d.leaf.view.vueRoot.switchView("agenda");':'';
 const result=await c.evaluate('(async()=>{const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop;if(!d.alive())throw Error("Window was not restored automatically");'+setup+'await p.saveQueue;return {bounds:d.native.getBounds(),view:d.leaf.view.vueRoot.view,pin:d.native.isAlwaysOnTop()};})()');
 if(process.argv[2]==='prepare'){
  await fs.writeFile('../desktop-restart-before.json',JSON.stringify(result,null,2));
  console.log('Prepared restart with saved window and agenda view');
 }else{
  const before=JSON.parse(await fs.readFile('../desktop-restart-before.json','utf8'));
  assert.equal(result.view,before.view);assert.equal(result.pin,before.pin);
  assert(Math.abs(result.bounds.width-before.bounds.width)<=6);
  console.log('PASS open window, selected view and pin survive app restart');
  await c.evaluate('(()=>{const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop;d.setAlwaysOnTop(false);d.setAutoHide(true);const area=d.screen.getPrimaryDisplay().workArea;d.native.setPosition(area.x,area.y+40);d.settle();d.collapse();return true;})()');
  await delay(100);
  const beforeCount=await c.evaluate('electron.remote.BrowserWindow.getAllWindows().length');
  await c.evaluate('(async()=>{await app.plugins.disablePlugin("dada-desktop-window");return true;})()');await delay(200);
  const after=await c.evaluate('({windows:electron.remote.BrowserWindow.getAllWindows().length,leaves:app.workspace.getLeavesOfType("dada-desktop-window-view").length})');
  assert.equal(after.leaves,0);assert.equal(beforeCount-after.windows,2);
  console.log('PASS disabling extension removes both native content and edge handle');
  await fs.writeFile('../desktop-lifecycle-results.json',JSON.stringify({restart:true,unload:true},null,2));
  await c.evaluate('(async()=>{await app.plugins.enablePlugin("dada-desktop-window");const p=app.plugins.getPlugin("dada-desktop-window");await p.desktop.open();p.desktop.resetPosition();p.desktop.setAlwaysOnTop(false);return true;})()');
 }
}finally{c.close();}

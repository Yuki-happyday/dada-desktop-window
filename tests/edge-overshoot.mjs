import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
const c=await connect(),delay=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
const run=body=>c.evaluate('(async()=>{if(!app.vault.adapter.basePath.endsWith("desktop-test-vault"))throw Error("Wrong vault");const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop;'+body+'})()');
try{
 await run('await d.open({focus:false});d.setSnapEnabled(true);return true;');
 for(const autoHide of [false,true])for(const width of [405,900])for(const side of ['left','right']){
  await run(`d.setAutoHide(${autoHide});d.expand(false);const a=d.screen.getPrimaryDisplay().workArea;d.native.setBounds({x:a.x+Math.round((a.width-${width})/2),y:a.y+150,width:${width},height:614});return true;`);
  await delay(350);
  await run(`const a=d.display().workArea,b=d.native.getBounds();d.native.setPosition(${JSON.stringify(side)}==='left'?a.x-90:a.x+a.width-b.width+90,a.y+150);return true;`);
  // Let the real BrowserWindow move event call settle; do not invoke it here.
  await delay(450);
  const state=await run('const b=d.native.getBounds(),a=d.display().workArea;return {version:p.manifest.version,side:d.side,bounds:b,saved:d.saved.bounds,area:a,polling:!!d.poll,autoHide:d.saved.autoHide};');
  assert.equal(state.side,side,JSON.stringify(state));
  const gap=side==='left'?state.bounds.x-state.area.x:state.area.x+state.area.width-state.bounds.x-state.bounds.width;
  assert(Math.abs(gap)<=2,JSON.stringify(state));assert.equal(state.polling,autoHide);
  results.push({width,side,autoHide,gap});
 }
 await run('d.setAutoHide(false);d.setSnapEnabled(false);d.expand(false);const a=d.display().workArea;d.native.setPosition(a.x-90,a.y+150);return true;');await delay(450);
 const off=await run('return {side:d.side,actual:d.native.getBounds(),saved:d.saved.bounds};');
 assert.equal(off.side,null);assert(Math.abs(off.actual.x-off.saved.x)<=2,JSON.stringify(off));
 await run('d.setSnapEnabled(true);d.resetPosition();return true;');
 await fs.writeFile('../edge-overshoot-results.json',JSON.stringify({checks:results,snapOffKeepsActualBounds:true},null,2));
 console.log(JSON.stringify({passed:results.length,cases:results,snapOffKeepsActualBounds:true}));
}finally{c.close();}

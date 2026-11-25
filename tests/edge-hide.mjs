import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
const c=await connect(),delay=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
const run=body=>c.evaluate('(async()=>{if(!app.vault.adapter.basePath.endsWith("desktop-test-vault"))throw Error("Wrong vault");const p=app.plugins.getPlugin("dada-desktop-window"),d=p.desktop;'+body+'})()');
try{
 await run('await d.open({focus:false});d.testScreen=d.screen;const real=d.screen;d.testCursor={x:-100000,y:-100000};d.screen={getCursorScreenPoint:()=>d.testCursor,getDisplayMatching:(...a)=>real.getDisplayMatching(...a),getPrimaryDisplay:()=>real.getPrimaryDisplay(),removeListener:(...a)=>real.removeListener(...a)};d.setSnapEnabled(true);d.setAutoHide(true);d.ownerWindow.document.activeElement?.blur();return true;');
 for(const side of ['left','right']){
  await run(`d.expand(false);d.testCursor={x:-100000,y:-100000};const a=d.screen.getPrimaryDisplay().workArea;d.native.setBounds({x:${JSON.stringify(side)}==='left'?a.x-90:a.x+a.width-405+90,y:a.y+150,width:405,height:614});return true;`);
  let hidden;
  for(let n=0;n<30;n++){
   await delay(100);
   hidden=await run('return {side:d.side,mode:d.state.mode,visible:d.native.isVisible(),handle:d.handle?.isVisible(),busy:d.busy(),motionAgo:Date.now()-d.lastMotion};');
   if(hidden.mode==='collapsed')break;
  }
  assert.equal(hidden.side,side);assert.equal(hidden.mode,'collapsed',JSON.stringify(hidden));assert.equal(hidden.visible,false);assert.equal(hidden.handle,true);
  await run('const b=d.handle.getBounds();d.testCursor={x:b.x+5,y:b.y+40};return true;');await delay(500);
  const expanded=await run('return {mode:d.state.mode,visible:d.native.isVisible(),handle:d.handle.isVisible()};');
  assert.equal(expanded.mode,'expanded');assert.equal(expanded.visible,true);assert.equal(expanded.handle,false);
  results.push({side,hidden,expanded});
 }
 await fs.writeFile('../edge-hide-results.json',JSON.stringify({cursor:'controlled test input',nativeWindows:true,checks:results},null,2));
 console.log('PASS native collapse and hover expansion after crossing left and right edges');
}finally{
 try{await run('if(d.testScreen){d.screen=d.testScreen;delete d.testScreen;delete d.testCursor;}d.expand(false);d.resetPosition();return true;');}finally{c.close();}
}

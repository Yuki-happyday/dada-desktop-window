import fs from 'node:fs/promises';import {connect} from './cdp.mjs';
const c=await connect();try{
 await c.send('Runtime.enable');
 for(const [view,name] of [['all','desktop-list'],['month','desktop-calendar']]){
  await c.evaluate('(()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;d.expand(true);d.leaf.view.vueRoot.switchView('+JSON.stringify(view)+');return true;})()');
  await new Promise(r=>setTimeout(r,200));
  const data=await c.evaluate('(async()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;return (await d.native.webContents.capturePage()).toDataURL();})()');
  await fs.writeFile('../'+name+'-final.png',Buffer.from(data.split(',')[1],'base64'));
 }
 const errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'));
 console.log(JSON.stringify({captured:2,errors:errors.length}));
 if(errors.length)console.log(JSON.stringify(errors.slice(-2)));
}finally{c.close();}

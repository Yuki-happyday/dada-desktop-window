import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
const c=await connect();
try{
 await c.evaluate('(async()=>{const p=app.plugins.getPlugin("dada-desktop-window");await p.desktop.open();p.desktop.resetPosition();p.desktop.leaf.view.vueRoot.switchView("agenda");return true;})()');
 await new Promise(r=>setTimeout(r,250));
 const image=await c.evaluate('(async()=>{const d=app.plugins.getPlugin("dada-desktop-window").desktop;if(!d.ownerWindow.document.querySelector(".dada-desktop-toolbar")?.checkVisibility())throw Error("Dada toolbar is hidden");return (await d.native.webContents.capturePage()).toDataURL();})()');
 await fs.writeFile('../../outputs/1.0.4-修复后Dada小窗.png',Buffer.from(image.split(',')[1],'base64'));
 console.log('Captured visible Dada window after Homepage compatibility checks.');
}finally{c.close();}

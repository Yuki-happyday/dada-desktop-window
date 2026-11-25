import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
const c=await connect();
try{
 assert((await c.evaluate('app.vault.adapter.basePath')).endsWith('desktop-test-vault'));
 const result=await c.evaluate(`(async()=>{
  const p=app.plugins.getPlugin('dada-desktop-window'),d=p.desktop;await d.open();d.setAutoHide(false);d.resetPosition();
  const w=d.ownerWindow,doc=w.document,root=d.leaf.view;
  await new Promise(r=>setTimeout(r,1200));
  const original=root.vueRoot.load;let reads=0;root.vueRoot.load=function(...args){reads++;return original.apply(this,args);};
  const dark=doc.body.classList.contains('theme-dark');
  for(let n=0;n<10;n++){doc.body.classList.toggle('is-focused');await new Promise(r=>setTimeout(r,20));}
  doc.body.classList.toggle('theme-dark',!dark);await new Promise(r=>setTimeout(r,50));doc.body.classList.toggle('theme-dark',dark);
  await new Promise(r=>setTimeout(r,100));root.vueRoot.load=original;
  const style=doc.querySelector('style[data-dada-desktop-ui]'),probe=doc.createElement('button');probe.className='btn la';probe.textContent='Unrelated button';doc.body.append(probe);
  const snapshot=()=>{const s=w.getComputedStyle(probe);return ['fontFamily','fontSize','height','display','position','padding','color'].map(k=>s[k]);};
  const before=snapshot();style.sheet.disabled=true;const after=snapshot();style.sheet.disabled=false;probe.remove();
  window.electronWindow.minimize();await new Promise(r=>setTimeout(r,150));
  const independentWhenMainMinimized=d.native.isVisible()&&!d.native.isMinimized();
  window.electronWindow.restore();window.electronWindow.showInactive();await new Promise(r=>setTimeout(r,150));
  const toolbar=[...document.querySelectorAll('#editingToolbarModalBar')].find(e=>e.checkVisibility());
  return {mountCount:root.mountCount,readsOnBodyClassChange:reads,polling:!!d.poll,independentWhenMainMinimized,unrelatedStylesUnchanged:JSON.stringify(before)===JSON.stringify(after),mainUiStyleCount:document.querySelectorAll('style[data-dada-desktop-ui]').length,mainToolbarHeight:toolbar?.getBoundingClientRect().height,popupErrors:doc.querySelector('.tk-error')?.textContent||''};
 })()`);
 assert.equal(result.mountCount,1);assert.equal(result.readsOnBodyClassChange,0);assert.equal(result.polling,false);
 assert.equal(result.independentWhenMainMinimized,true);assert.equal(result.unrelatedStylesUnchanged,true);assert.equal(result.mainUiStyleCount,0);assert(result.mainToolbarHeight>0&&result.mainToolbarHeight<60);
 console.log(JSON.stringify(result));await fs.writeFile('../stability-results.json',JSON.stringify(result,null,2));
}finally{c.close();}

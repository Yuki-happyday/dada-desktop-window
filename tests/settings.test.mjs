import test from 'node:test';import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,unlinkSync,rmdirSync } from 'node:fs';import {join} from 'node:path';
import {persistSettings,resolveSettings} from '../src/desktop/settingsStore.js';

test('confirmed edge-hide preference is applied once, preserving geometry and later choices',()=>{
 const old={openLocation:'desktop',desktop:{bounds:{x:1241,y:273,width:405,height:614},alwaysOnTop:false,wasOpen:true,autoHide:false,snapEnabled:true}};
 const migrated=resolveSettings(old);
 assert.equal(migrated.desktop.autoHide,true);assert.equal(migrated.desktop.snapEnabled,true);
 assert.deepEqual(migrated.desktop.bounds,old.desktop.bounds);assert.equal(migrated.desktop.wasOpen,true);
 assert.equal(old.desktop.autoHide,false);
 migrated.desktop.autoHide=false;migrated.desktop.snapEnabled=false;
 const reloaded=resolveSettings(migrated);
 assert.equal(reloaded.desktop.autoHide,false);assert.equal(reloaded.desktop.snapEnabled,false);
});
test('window settings are complete before save returns and failures keep the prior file',()=>{
 const dir=mkdtempSync(join(process.cwd(),'tests/.state-')),path=join(dir,'data.json');
 try{
  persistSettings(path,{desktop:{wasOpen:true,bounds:{width:900,height:700}}});
  assert.equal(JSON.parse(readFileSync(path,'utf8')).desktop.wasOpen,true);
  persistSettings(path,{desktop:{wasOpen:false}});
  assert.equal(JSON.parse(readFileSync(path,'utf8')).desktop.wasOpen,false);
  const invalid={};invalid.self=invalid;
  assert.throws(()=>persistSettings(path,invalid));
  assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),{desktop:{wasOpen:false}});
 }finally{unlinkSync(path);rmdirSync(dir);}
});

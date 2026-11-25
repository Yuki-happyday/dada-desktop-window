import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// This personal extension's 1.0.5 upgrade applies the user's confirmed request
// once. Later choices to turn snapping/hiding off must survive reloads.
export function resolveSettings(data={}){
 const settings={openLocation:data.openLocation==='main'?'main':'desktop',
  desktop:{bounds:null,side:null,alwaysOnTop:false,snapEnabled:true,autoHide:true,wasOpen:false,...data.desktop}};
 if(settings.desktop.edgeHideConfigured!==true)
  Object.assign(settings.desktop,{snapEnabled:true,autoHide:true,edgeHideConfigured:true});
 return settings;
}
// Small, synchronous, atomic writes also complete during application shutdown.
export function persistSettings(path,data){
 const json=JSON.stringify(data,null,2);
 mkdirSync(dirname(path),{recursive:true});
 const temporary=path+'.tmp';
 writeFileSync(temporary,json,'utf8');
 renameSync(temporary,path);
}

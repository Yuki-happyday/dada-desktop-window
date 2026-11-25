import {setTimeout,clearTimeout} from 'node:timers';

// Chain after Homepage's opening behavior. Never poll its private flags or make
// Obsidian await the desktop UI/resources.
export function restoreAfterOpening(app,restore) {
 let disposed=false,started=false,timer;
 const original=app.runOpeningBehavior;
 const schedule=()=>{clearTimeout(timer);if(!disposed)timer=setTimeout(()=>{if(!disposed)restore();},750);};
 const wrapper=async function(...args){
  started=true;clearTimeout(timer);
  try{return await original.apply(this,args);}finally{schedule();}
 };
 app.runOpeningBehavior=wrapper;
 app.workspace.onLayoutReady(()=>{
  // Also handles enabling the plugin in an already-open vault.
  if(!started)timer=setTimeout(()=>{if(!started&&!disposed)schedule();},2000);
 });
 return ()=>{disposed=true;clearTimeout(timer);if(app.runOpeningBehavior===wrapper)app.runOpeningBehavior=original;};
}

export function mainTabGroup(workspace) {
 const recent=workspace.getMostRecentLeaf(workspace.rootSplit);
 if(recent?.parent)return recent.parent;
 const find=node=>node?.type==='tabs'?node:(node?.children||[]).map(find).find(Boolean);
 return find(workspace.rootSplit)||workspace.createLeafInParent(workspace.rootSplit,0).parent;
}

// Route notes BEFORE constructing their editors. Never transplant editor DOM
// between documents: other plugins may retain references to the old document.
export class DedicatedWindowContent {
 constructor(workspace,leaf,viewType) {
  this.workspace=workspace;this.leaf=leaf;
  this.originalGetLeaf=workspace.getLeaf;
  this.originalSetViewState=leaf.setViewState;
  const destination=()=>{const tabs=mainTabGroup(workspace);return workspace.createLeafInParent(tabs,tabs.children.length);};
  const guard=this;
  this.getLeaf=function(mode,...rest){
   if(!guard.disposed&&workspace.activeLeaf?.getContainer()===leaf.getContainer()&&
      (mode===undefined||typeof mode==='boolean'||mode==='tab'))return destination();
   return guard.originalGetLeaf.call(this,mode,...rest);
  };
  workspace.getLeaf=this.getLeaf;
  this.redirect=(state,...rest)=>{
   if(this.disposed||state.type===viewType)return this.originalSetViewState.call(leaf,state,...rest);
   return destination().setViewState(state,...rest);
  };
  leaf.setViewState=this.redirect;
 }
 dispose(){
  this.disposed=true;
  if(this.workspace.getLeaf===this.getLeaf)this.workspace.getLeaf=this.originalGetLeaf;
  if(this.leaf.setViewState===this.redirect)this.leaf.setViewState=this.originalSetViewState;
 }
}

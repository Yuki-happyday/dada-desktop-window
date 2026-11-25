import test from 'node:test';
import assert from 'node:assert/strict';
import {DedicatedWindowContent,restoreAfterOpening} from '../src/desktop/windowContent.js';

function fixture(){
 const main={},popup={},tabs={children:[]};
 function leaf(root,state={type:'empty'}){return {getContainer:()=>root,getViewState:()=>state,async setViewState(next){state=next;},parent:tabs};}
 const mainLeaf=leaf(main),own=leaf(popup,{type:'dada'});tabs.children=[mainLeaf];
 const ws={rootSplit:main,activeLeaf:own,getMostRecentLeaf:()=>mainLeaf,getLeaf:()=>own,
  createLeafInParent(parent){const next=leaf(main);parent.children.push(next);return next;}};
 return {ws,own,tabs};
}
test('new-note requests route before constructing any popup editor; hooks restore on dispose',async()=>{
 const {ws,own}=fixture(),original=ws.getLeaf,guard=new DedicatedWindowContent(ws,own,'dada');
 const note=ws.getLeaf(true);assert.equal(note.getContainer(),ws.rootSplit);
 await note.setViewState({type:'markdown',state:{file:'calendar.md'}});
 assert.equal(own.getViewState().type,'dada');
 guard.dispose();assert.equal(ws.getLeaf,original);
});
test('direct replacement requests use native main-window leaf creation',async()=>{
 const {ws,own,tabs}=fixture(),guard=new DedicatedWindowContent(ws,own,'dada');
 await own.setViewState({type:'markdown',state:{file:'calendar.md'}});
 assert.equal(own.getViewState().type,'dada');assert.equal(tabs.children.at(-1).getViewState().state.file,'calendar.md');guard.dispose();
});
test('opening wrapper preserves async result, schedules without blocking, and restores cleanly',async()=>{
 let release,restored=0;const original=()=>new Promise(resolve=>release=resolve);
 const app={runOpeningBehavior:original,workspace:{onLayoutReady(){}}};
 const cleanup=restoreAfterOpening(app,()=>restored++),pending=app.runOpeningBehavior();
 assert.equal(restored,0);release('opened');assert.equal(await pending,'opened');assert.equal(restored,0);
 cleanup();assert.equal(app.runOpeningBehavior,original);
 await new Promise(r=>setTimeout(r,800));assert.equal(restored,0);
});

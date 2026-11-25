import test from 'node:test';
import assert from 'node:assert/strict';
import { clampBounds, dockSide, alignBounds, stripBounds, contains, nextDockState, needsReposition } from '../src/desktop/dock.js';
const area = {x:-1920,y:0,width:1920,height:1040};
test('restore onto available display, including negative coordinates and small screens', () => {
 assert.deepEqual(clampBounds({x:4000,y:-500,width:900,height:700}, area), {x:-900,y:0,width:900,height:700});
 assert.deepEqual(clampBounds({x:0,y:0,width:900,height:700},{x:0,y:0,width:640,height:480}),{x:0,y:0,width:640,height:480});
 assert.equal(clampBounds({x:NaN,width:Infinity},area).width,900);
 assert.equal(clampBounds(null,area).width,900);
});
test('snap only within 16px and align to the selected display', () => {
 assert.equal(dockSide({x:-1910,y:0,width:900,height:700},area),'left');
 assert.equal(dockSide({x:-916,y:0,width:900,height:700},area),'right');
 assert.equal(dockSide({x:-950,y:0,width:900,height:700},area),null);
 assert.equal(alignBounds({x:-950,y:0,width:900,height:700},area,'right').x,-900);
 assert.deepEqual(stripBounds({x:-900,y:50,width:900,height:700},area,'right'),{x:-10,y:340,width:10,height:120});
 assert(contains({x:0,y:0,width:10,height:120},{x:5,y:70}));
});
test('leave for 600ms, hover strip for 150ms, editing cancels hide', () => {
 let s={mode:'expanded'};
 s=nextDockState(s,{now:0,docked:true}); assert.equal(s.mode,'expanded');
 s=nextDockState(s,{now:599,docked:true}); assert.equal(s.mode,'expanded');
 s=nextDockState(s,{now:600,docked:true}); assert.equal(s.mode,'collapsed');
 s=nextDockState(s,{now:700,docked:true,strip:true});
 s=nextDockState(s,{now:849,docked:true,strip:true}); assert.equal(s.mode,'collapsed');
 s=nextDockState(s,{now:850,docked:true,strip:true}); assert.equal(s.mode,'expanded');
 s=nextDockState(s,{now:2000,docked:true,busy:true}); assert.equal(s.outsideAt,null);
 s=nextDockState(s,{now:2100,docked:false}); assert.equal(s.mode,'expanded');
});

test('narrow windows still snap after crossing either screen edge',()=>{
 for(const screen of [area,{x:0,y:0,width:1646,height:981}]){
  const width=405,height=614;
  for(const overshoot of [1,17,90,200]){
   const left={x:screen.x-overshoot,y:150,width,height};
   const right={x:screen.x+screen.width-width+overshoot,y:150,width,height};
   assert.equal(dockSide(left,screen),'left');assert.equal(alignBounds(left,screen,'left').x,screen.x);
   assert.equal(dockSide(right,screen),'right');assert.equal(alignBounds(right,screen,'right').x,screen.x+screen.width-width);
  }
  assert.equal(dockSide({x:screen.x+17,y:150,width,height},screen),null);
  assert.equal(dockSide({x:screen.x+screen.width-width-17,y:150,width,height},screen),null);
 }
});

test('fractional DPI frame rounding must not trigger an endless snap loop',()=>{
 assert.equal(needsReposition({x:10,y:10},{x:11,y:12}),false);
 assert.equal(needsReposition({x:10,y:10},{x:13,y:10}),true);
});

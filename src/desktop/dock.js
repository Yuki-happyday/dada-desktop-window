const finite = (v, d) => Number.isFinite(v) ? Math.round(v) : d;
export function clampBounds(value = {}, area) {
 value ||= {};
 const width = Math.min(area.width, Math.max(400, finite(value.width, 900)));
 const height = Math.min(area.height, Math.max(320, finite(value.height, 700)));
 return {x: Math.max(area.x, Math.min(area.x + area.width - width, finite(value.x, area.x + (area.width-width)/2))),
 y: Math.max(area.y, Math.min(area.y + area.height - height, finite(value.y, area.y + (area.height-height)/2))), width, height};
}
export function dockSide(bounds, area) {
 // A negative gap means the window has crossed the edge. It must still dock:
 // users commonly move the cursor to the edge with part of the window outside.
 const left=bounds.x-area.x, right=area.x+area.width-bounds.x-bounds.width;
 const nearLeft=left<=16,nearRight=right<=16;
 if(nearLeft&&nearRight)return Math.abs(left)<=Math.abs(right)?'left':'right';
 return nearLeft?'left':nearRight?'right':null;
}
export function alignBounds(bounds, area, side) {
 const next=clampBounds(bounds,area);
 if(side==='left') next.x=area.x;
 if(side==='right') next.x=area.x+area.width-next.width;
 return next;
}
export function stripBounds(bounds,area,side) {
 const height=Math.min(120,area.height);
 return {x:side==='left'?area.x:area.x+area.width-10,y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,bounds.y+(bounds.height-height)/2))),width:10,height};
}
export function contains(rect,p) { return p.x>=rect.x && p.y>=rect.y && p.x<rect.x+rect.width && p.y<rect.y+rect.height; }
export function nextDockState(state,{now,docked=false,inside=false,strip=false,busy=false}) {
 if(!docked) return {mode:'expanded',outsideAt:null,hoverAt:null};
 if(state.mode==='collapsed') {
  const hoverAt=strip?(state.hoverAt??now):null;
  return hoverAt!==null && now-hoverAt>=150 ? {mode:'expanded',outsideAt:null,hoverAt:null} : {...state,hoverAt};
 }
 const outsideAt=inside||busy?null:(state.outsideAt??now);
 return outsideAt!==null && now-outsideAt>=600 ? {mode:'collapsed',outsideAt:null,hoverAt:null} : {mode:'expanded',outsideAt,hoverAt:null};
}

// Windows at fractional DPI may report a one- or two-DIP frame offset.
export function needsReposition(current,target){return Math.abs(current.x-target.x)>2 || Math.abs(current.y-target.y)>2;}

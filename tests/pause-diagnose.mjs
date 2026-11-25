import {connect} from './cdp.mjs';
const c=await connect();
try{
 await c.send('Debugger.enable');
 await c.send('Debugger.pause');
 await new Promise(r=>setTimeout(r,300));
 const paused=c.events.find(e=>e.method==='Debugger.paused');
 console.log(JSON.stringify(paused?.params.callFrames.slice(0,12).map(f=>({fn:f.functionName,url:f.url,location:f.location})),null,2));
 await c.send('Debugger.resume');
}finally{c.close();}

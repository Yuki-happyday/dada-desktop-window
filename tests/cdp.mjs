import {pathToFileURL} from 'node:url';
export async function connect() {
 const targets=await (await fetch('http://127.0.0.1:9335/json/list')).json();
 const target=targets.find(t=>t.url==='app://obsidian.md/index.html');
 if(!target)throw new Error('Isolated Obsidian page missing');
 const socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 const events=[];
 socket.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.method)events.push(m);});
 let sequence=0;const pending=new Map();
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {resolve,reject,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const guard='if(typeof app!=="undefined"&&app.vault?.adapter?.basePath&&!app.vault.adapter.basePath.endsWith("desktop-test-vault"))throw Error("Refusing to run against a non-test vault");';
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression:guard+'\n'+expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 try{await evaluate('true');}catch(error){socket.close();throw error;}
 return {send,evaluate,events,close:()=>socket.close()};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href && process.argv[2]){const c=await connect();try{console.log(JSON.stringify(await c.evaluate(process.argv[2]),null,2));}finally{c.close();}}

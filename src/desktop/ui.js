import {createApp} from 'vue';
import TasksApp from '../core/views/TasksApp.vue';
import {initTasksApi} from '../core/api/tasks.js';
import {setColorScheme,setWeekStart,setTagColors} from '../core/composables/tasks-logic.js';
import {initI18n,t} from '../core/i18n/index.js';
import {tooltip} from '../core/directives/tooltip.js';
import {setupHoverPreview,teardownHoverPreview} from '../core/hoverPreview.js';
import 'line-awesome/dist/line-awesome/css/line-awesome.min.css';
import '../core/styles/tokens.css';
import '../core/styles/modals.css';
import '../core/styles/task-modal.css';

let stylesheet='';
const documents=new WeakMap();
export async function initialize(plugin,css){stylesheet=css;initTasksApi(plugin.adapter);await initI18n(plugin.app);}
export function prepare(plugin){
 const s=plugin.dada().settings;setColorScheme(s.colorScheme||'default');setWeekStart(s.weekStart??1);setTagColors(s.tagColors||{});
}
export function mount(plugin,view){
 prepare(plugin);
 const root=view.contentEl.createDiv('dada-todo-root dada-desktop-ui');root.style.height='100%';
 const doc=root.ownerDocument,win=doc.defaultView;
 let sheet=documents.get(doc);
 if(!sheet){const el=doc.createElement('style');el.dataset.dadaDesktopUi='';el.textContent=stylesheet;doc.head.append(el);sheet={el,users:0};documents.set(doc,sheet);}
 sheet.users++;
 const app=createApp(TasksApp);app.directive('tooltip',tooltip);
 Object.assign(app.config.globalProperties,{plugin:plugin.adapter,$t:t,$ownerWindow:win});
 app.provide('plugin',plugin.adapter);app.provide('t',t);app.provide('ownerBody',doc.body);
 view.vueRoot=app.mount(root);view.mountCount=(view.mountCount||0)+1;
 let dark=doc.body.classList.contains('theme-dark');
 const observer=new win.MutationObserver(()=>{
  const next=doc.body.classList.contains('theme-dark');
  if(next!==dark){dark=next;prepare(plugin);view.vueRoot?.$forceUpdate();}
 });observer.observe(doc.body,{attributes:true,attributeFilter:['class']});
 const hoverCleanups=[];
 setupHoverPreview({...plugin.adapter,manifest:plugin.manifest,registerDomEvent:(target,event,handler)=>{
  target.addEventListener(event,handler);hoverCleanups.push(()=>target.removeEventListener(event,handler));
 }},doc);
 return ()=>{observer.disconnect();hoverCleanups.forEach(fn=>fn());app.unmount();view.vueRoot=null;root.remove();if(!--sheet.users){sheet.el.remove();documents.delete(doc);}};
}
export function dispose(plugin){teardownHoverPreview({...plugin.adapter,manifest:plugin.manifest});}

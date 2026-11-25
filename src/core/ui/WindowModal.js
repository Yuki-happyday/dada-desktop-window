import { Modal } from 'obsidian';
// Open native modals in the document that initiated the action, even before
// Electron's asynchronous focus notification reaches Obsidian.
export class WindowModal extends Modal {
 constructor(app,ownerWindow){super(app);this.ownerWindow=ownerWindow;this.shouldAnimate=false;this.containerEl.addClass('dada-desktop-ui');}
 open(){
  const win=this.ownerWindow;
  if(win&&!win.closed)win.dispatchEvent(new win.Event('focus'));
  return super.open();
 }
}

import assert from 'node:assert/strict';
import test from 'node:test';
import Module, {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url);
test('cached schedule and unsent acknowledgments survive offline restart and account switches',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ups-test-'));
 class WC extends EventEmitter {constructor(){super();this.mainFrame={};}setWindowOpenHandler(){}send(){}}
 class Window extends EventEmitter {
  constructor(){super();this.webContents=new WC();this.dead=false;}
  isDestroyed(){return this.dead;}show(){}
  loadFile(){return Promise.resolve();}
  close(){this.emit('close');this.dead=true;this.emit('closed');}
 }
 const ipc=new EventEmitter();ipc.handle=()=>{};
 const fake={BrowserWindow:Window,ipcMain:ipc,powerMonitor:new EventEmitter(),screen:{getCursorScreenPoint:()=>({x:0,y:0}),getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1000,height:800}})}};
 const original=Module._load;Module._load=function(id,...args){return id==='electron'?fake:original.call(this,id,...args);};
 let factory;try{factory=require('../desktop/reminders.cjs');}finally{Module._load=original;}
 const app=()=>Object.assign(new EventEmitter(),{getPath:()=>root});
 const {malaysia}=require('../desktop/reminder-core.cjs'),now=malaysia(Date.now());
 const time=String(Math.floor(now.minute/60)).padStart(2,'0')+':'+String(now.minute%60).padStart(2,'0');
 const schedule={enabled:true,message:'Save work and turn off UPS',days:Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(d=>[d,time]))};
 let a=app(),service=factory({app:a,senderOK:()=>true});service.sync('user-a',schedule);assert.ok(service.window);
 a.emit('before-quit');ipc.removeAllListeners();
 a=app();service=factory({app:a,senderOK:()=>true});service.tick();assert.ok(service.window,'offline cached schedule should open');
 const win=service.window;ipc.emit('ups-action',{sender:win.webContents,senderFrame:win.webContents.mainFrame},'ack');
 assert.equal(service.pending.length,1);assert.equal(service.window,null);
 service.sync('user-b',null);service.sync('user-a',schedule);assert.equal(service.window,null,'same user must not repeat after switching accounts');
 a.emit('before-quit');ipc.removeAllListeners();
 a=app();service=factory({app:a,senderOK:()=>true});assert.equal(service.pending.length,1);service.tick();assert.equal(service.window,null);
 service.sync('',null);a.emit('before-quit');ipc.removeAllListeners();
 a=app();service=factory({app:a,senderOK:()=>true});service.tick();assert.equal(service.window,null,'sign-out clears active schedule');
 a.emit('before-quit');ipc.removeAllListeners();fs.rmSync(root,{recursive:true,force:true});
});

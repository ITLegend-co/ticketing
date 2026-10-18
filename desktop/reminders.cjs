const {BrowserWindow,ipcMain,screen,powerMonitor}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),crypto=require('node:crypto');
const {scheduleOK,due}=require('./reminder-core.cjs');
module.exports=function createReminders({app,senderOK,smoke=false}){
 const filename=path.join(app.getPath('userData'),'ups-reminders.json');
 let state={uid:'',schedule:null,done:{},pending:[],installationId:crypto.randomUUID()},popup=null,current=null,locked=false,closing=false;
 if(!smoke){try{const value=JSON.parse(fs.readFileSync(filename,'utf8'));if(value&&typeof value.uid==='string'&&Array.isArray(value.pending)&&value.done&&/^[a-f0-9-]{36}$/.test(value.installationId)){state=value;if(!scheduleOK(state.schedule))state.schedule=null;}}catch{}}
 function persist(){
  if(smoke)return;
  try{fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename+'.tmp',JSON.stringify(state),{mode:0o600});fs.renameSync(filename+'.tmp',filename);}catch(error){console.error('UPS reminder settings could not be saved:',error.code);}
 }
 function closePopup(){if(popup&&!popup.isDestroyed()){closing=true;popup.close();closing=false;}popup=null;current=null;}
 function bind(uid){
  if(state.uid!==uid){closePopup();state.uid=uid;state.schedule=null;state.done={};persist();}
 }
 function sync(uid,schedule){
  bind(uid);state.schedule=scheduleOK(schedule)?schedule:null;
  // A cloud schedule update invalidates any older popup.
  closePopup();persist();tick();
 }
 function record(ack){
  if(!current)return;
  const now=Date.now(),item=current;
  if(item.preview){closePopup();return;}
  if(ack){
   state.done[item.date]={acknowledgedAt:now};
   state.pending=state.pending.filter(a=>!(a.uid===state.uid&&a.date===item.date));
   state.pending.push({uid:state.uid,installationId:state.installationId,date:item.date,scheduledFor:item.scheduledFor,acknowledgedAt:now,hostname:os.hostname().slice(0,200)});
  }else{state.done[item.date]={snoozeUntil:now+10*60000};}
  persist();closePopup();
 }
 function open(item){
  if(popup)return;
  current=item;const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()),area=display.workArea;
  const width=Math.round(area.width*.6),height=Math.round(area.height*.6);
  popup=new BrowserWindow({x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),width,height,resizable:false,alwaysOnTop:true,autoHideMenuBar:true,title:'Mountain Torq — UPS Reminder',show:false,
   webPreferences:{preload:path.join(__dirname,'reminder-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  popup.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  popup.webContents.on('will-navigate',e=>e.preventDefault());
  popup.webContents.on('will-attach-webview',e=>e.preventDefault());
  popup.webContents.once('did-finish-load',()=>{if(popup&&!popup.isDestroyed()){popup.webContents.send('ups-message',{message:item.message});popup.show();}});
  popup.on('close',()=>{if(!closing&&current){if(!current.preview){state.done[current.date]={snoozeUntil:Date.now()+10*60000};persist();}}});
  popup.on('closed',()=>{popup=null;current=null;});
  popup.loadFile(path.join(__dirname,'reminder.html')).catch(()=>closePopup());
 }
 function tick(){
  if(popup||locked||!state.uid)return;
  const now=Date.now();state.pending=state.pending.filter(a=>a.acknowledgedAt>now-89*86400000).slice(-500);
  for(const date of Object.keys(state.done)){if(date<new Date(now-32*86400000).toISOString().slice(0,10))delete state.done[date];}
  const item=due(state.schedule,now,state.done);if(item)open(item);
 }
 function validUid(uid){return typeof uid==='string'&&/^[\w-]{1,128}$/.test(uid);}
 ipcMain.on('mt-reminder-bind',(event,uid)=>{if(senderOK(event)&&validUid(uid))bind(uid);});
 ipcMain.on('mt-reminder-sync',(event,data)=>{if(senderOK(event)&&data&&(data.uid===''||validUid(data.uid)))sync(data.uid,data.uid?data.schedule:null);});
 ipcMain.handle('mt-reminder-pending',(event,uid)=>senderOK(event)&&validUid(uid)?state.pending.filter(a=>a.uid===uid):[]);
 ipcMain.on('mt-reminder-delivered',(event,{uid,dates}={})=>{if(!senderOK(event)||!validUid(uid)||!Array.isArray(dates)||dates.length>500)return;state.pending=state.pending.filter(a=>a.uid!==uid||!dates.includes(a.date));persist();});
 ipcMain.on('ups-action',(event,action)=>{
  if(!popup||event.sender!==popup.webContents||event.senderFrame!==popup.webContents.mainFrame)return;
  if(action==='ack')record(true);else if(action==='snooze')record(false);
 });
 powerMonitor.on('lock-screen',()=>{locked=true;closePopup();});
 powerMonitor.on('unlock-screen',()=>{locked=false;tick();});
 powerMonitor.on('resume',()=>setTimeout(tick,2000));
 const timer=setInterval(tick,15000);if(!smoke)setTimeout(tick,5000);
 app.on('before-quit',()=>{clearInterval(timer);persist();closePopup();});
 return {get window(){return popup;},get pending(){return state.pending;},sync,bind,tick,preview:()=>open({preview:true,date:'2099-01-01',scheduledFor:'17:00',message:'Before you leave, please save your work, shut down your computer, and turn off your UPS.'})};
};

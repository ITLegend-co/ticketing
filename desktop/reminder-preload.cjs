const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('upsReminder',{
 onMessage:callback=>ipcRenderer.on('ups-message',(_event,data)=>callback(data)),
 acknowledge:()=>ipcRenderer.send('ups-action','ack'),
 snooze:()=>ipcRenderer.send('ups-action','snooze')
});

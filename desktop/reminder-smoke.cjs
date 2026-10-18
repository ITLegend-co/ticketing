const assert=require('node:assert/strict'),{screen}=require('electron');
const {setTimeout:pause}=require('node:timers/promises');
const {malaysia}=require('./reminder-core.cjs');
module.exports=async(reminders,log)=>{
 const now=malaysia(Date.now()),time=String(Math.floor(now.minute/60)).padStart(2,'0')+':'+String(now.minute%60).padStart(2,'0');
 const days={mon:'',tue:'',wed:'',thu:'',fri:'',sat:'',sun:''};days[now.day]=time;
 reminders.sync('smoke-user',{enabled:true,message:'Please switch off UPS <script>unsafe</script>',days});
 const w=reminders.window;assert.ok(w);
 for(let i=0;i<100;i++){if(!w.webContents.isLoading()&&await w.webContents.executeJavaScript("document.querySelector('#message')?.textContent.includes('unsafe')"))break;await pause(50);}
 assert.equal(w.isAlwaysOnTop(),true);
 const area=screen.getDisplayMatching(w.getBounds()).workArea;
 assert.equal(w.getBounds().width,Math.round(area.width*.6));assert.equal(w.getBounds().height,Math.round(area.height*.6));
 assert.equal(await w.webContents.executeJavaScript("document.querySelector('#message').textContent"),'Please switch off UPS <script>unsafe</script>');
 assert.equal(await w.webContents.executeJavaScript("document.querySelector('#message script') === null"),true);
 assert.equal(await w.webContents.executeJavaScript("document.querySelector('img').complete && document.querySelector('img').naturalWidth > 0"),true);
 await w.webContents.executeJavaScript("document.querySelector('#ack').click()");
 await pause(100);assert.equal(reminders.window,null);assert.equal(reminders.pending.length,1);
 reminders.tick();assert.equal(reminders.window,null);
 reminders.bind('another-user');reminders.tick();assert.equal(reminders.window,null);
 log('UPS reminder: correct 60% size, cat loaded, safe text, acknowledgment queued, no repeat and account isolation');
};

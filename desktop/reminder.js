window.upsReminder.onMessage(data=>{document.querySelector('#message').textContent=String(data.message||'Please turn off your UPS before leaving.');});
document.querySelector('#ack').addEventListener('click',()=>window.upsReminder.acknowledge());
document.querySelector('#snooze').addEventListener('click',()=>window.upsReminder.snooze());
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.upsReminder.snooze();});

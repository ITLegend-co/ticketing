const DAYS=['sun','mon','tue','wed','thu','fri','sat'];
const timeOK=v=>typeof v==='string'&&(v===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(v));
function scheduleOK(s){
 return !!s&&typeof s.enabled==='boolean'&&typeof s.message==='string'&&s.message.length>0&&s.message.length<=500&&s.days&&DAYS.every(d=>timeOK(s.days[d]));
}
function malaysia(now){
 const d=new Date(now+8*3600000);return {date:d.toISOString().slice(0,10),day:DAYS[d.getUTCDay()],minute:d.getUTCHours()*60+d.getUTCMinutes()};
}
function due(schedule,now,done){
 if(!scheduleOK(schedule)||!schedule.enabled)return null;
 const t=malaysia(now),at=schedule.days[t.day];if(!at)return null;
 const [h,m]=at.split(':').map(Number),delta=t.minute-(h*60+m);
 // Same-day catch-up only, up to one hour after the scheduled time.
 if(delta<0||delta>=60||done[t.date]?.acknowledgedAt||done[t.date]?.snoozeUntil>now)return null;
 return {date:t.date,scheduledFor:at,message:schedule.message};
}
module.exports={scheduleOK,malaysia,due};

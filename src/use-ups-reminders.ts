import { useEffect } from "react";
import { onValue, ref, runTransaction, serverTimestamp } from "firebase/database";
import { database } from "./firebase";
import type { ReminderSchedule, ReminderAck } from "./reminders";
export type PendingReminderAck = ReminderAck & {uid:string;installationId:string};
export type ReminderBridge = {
 bind:(uid:string)=>void;
 sync:(uid:string,schedule:ReminderSchedule|null)=>void;
 pending:(uid:string)=>Promise<PendingReminderAck[]>;
 delivered:(uid:string,dates:string[])=>void;
};
declare global { interface Window { mtReminders?: ReminderBridge; } }
export function useUpsReminders(uid:string, active:boolean, ready:boolean) {
 useEffect(()=>{
  const bridge=window.mtReminders;if(!bridge||!ready)return;
  if(!uid||!active){bridge.sync("",null);return;}
  bridge.bind(uid);
  let stopped=false,flushing=false;
  const unsubscribe=onValue(ref(database,"reminderSchedules/"+uid),s=>bridge.sync(uid,s.val()||null),()=>bridge.sync(uid,null));
  async function flush(){
   if(flushing||stopped)return;flushing=true;
   try {
    const pending=await bridge!.pending(uid);
    for(const ack of pending){
     if(stopped)break;
     const target=ref(database,"reminderAcks/"+uid+"/"+ack.installationId+"/"+ack.date);
     await runTransaction(target,current=>current===null?{date:ack.date,scheduledFor:ack.scheduledFor,acknowledgedAt:ack.acknowledgedAt,hostname:ack.hostname,receivedAt:serverTimestamp()}:undefined,{applyLocally:false});
     if(!stopped)bridge!.delivered(uid,[ack.date]);
    }
   } catch {} finally {flushing=false;}
  }
  void flush();const timer=window.setInterval(flush,15000);
  return()=>{stopped=true;unsubscribe();clearInterval(timer);};
 },[uid,active,ready]);
}

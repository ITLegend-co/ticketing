import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const {due,scheduleOK,malaysia}=createRequire(import.meta.url)('../desktop/reminder-core.cjs');
const schedule={enabled:true,message:'Turn off UPS',days:{mon:'17:00',tue:'17:00',wed:'17:00',thu:'17:00',fri:'17:00',sat:'13:00',sun:''}};
const at=s=>Date.parse(s);
test('Malaysia weekdays and Saturday use independent times and Sunday is disabled',()=>{
 assert.ok(due(schedule,at('2026-10-19T09:00:00Z'),{}));
 assert.equal(due(schedule,at('2026-10-19T08:59:59Z'),{}),null);
 assert.ok(due(schedule,at('2026-10-24T05:00:00Z'),{}));
 assert.equal(due(schedule,at('2026-10-24T09:00:00Z'),{}),null);
 assert.equal(due(schedule,at('2026-10-25T09:00:00Z'),{}),null);
 assert.equal(malaysia(at('2026-10-18T16:00:00Z')).date,'2026-10-19');
});
test('resume catch-up is bounded, snooze works and acknowledgment prevents repeats',()=>{
 const now=at('2026-10-19T09:20:00Z');
 assert.ok(due(schedule,now,{}));
 assert.equal(due(schedule,at('2026-10-19T10:00:00Z'),{}),null);
 assert.equal(due(schedule,now,{'2026-10-19':{acknowledgedAt:now-1000}}),null);
 assert.equal(due(schedule,now,{'2026-10-19':{snoozeUntil:now+1000}}),null);
 assert.ok(due(schedule,now,{'2026-10-19':{snoozeUntil:now-1000}}));
 assert.equal(due({...schedule,enabled:false},now,{}),null);
});
test('invalid schedules cannot run and individual weekdays can differ',()=>{
 assert.equal(scheduleOK({...schedule,days:{...schedule.days,mon:'25:00'}}),false);
 assert.equal(scheduleOK({...schedule,days:{}}),false);
 assert.ok(due({...schedule,days:{...schedule.days,tue:'16:30'}},at('2026-10-20T08:30:00Z'),{}));
});

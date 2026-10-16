import test from 'node:test';
import assert from 'node:assert/strict';
import {canViewMonitoring,deviceOnline,deviceAlerts} from '../src/monitoring.ts';
test('monitoring is visible only to intended roles and stale data is not online',()=>{
 for(const role of ['IT Admin','IT Technician','Management'])assert.ok(canViewMonitoring(role));
 for(const role of ['Employee','Device',''])assert.equal(canViewMonitoring(role),false);
 assert.equal(deviceOnline(undefined,500000),false);
 assert.equal(deviceOnline({at:1},500000),false);
 assert.equal(deviceOnline({at:499000},500000),true);
});
test('alerts distinguish missing reports, offline state and current hardware warnings',()=>{
 assert.deepEqual(deviceAlerts(undefined,1000000),['Awaiting first report']);
 assert.deepEqual(deviceAlerts({at:1},1000000),['Offline for over 10 minutes']);
 const r={at:1000000,cpu:95,memory:92,disks:[{name:'C:',usedPercent:95}],rebootPending:true,inventory:{diskHealth:'Warning',batteryHealth:50}};
 assert.equal(deviceAlerts(r,1000001).length,6);
});

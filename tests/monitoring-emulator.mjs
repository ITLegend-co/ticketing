import assert from 'node:assert/strict';
const base='http://127.0.0.1:9000';
const ns='demo-mtmonitor-default-rtdb';
const at=Date.now();
async function account(name) {
 const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:name+'@example.test',password:'Test-only-123!',returnSecureToken:true})});
 const v=await r.json();assert.ok(v.idToken,JSON.stringify(v));return {uid:v.localId,token:v.idToken};
}
async function db(method,path,body,token,owner=false) {
 return fetch(base+'/'+path+'.json?ns='+ns+(token?'&auth='+encodeURIComponent(token):''),{method,headers:{'Content-Type':'application/json',...(owner?{'Authorization':'Bearer owner'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const admin=await account('admin'),tech=await account('tech'),management=await account('manager'),employee=await account('employee'),device=await account('device'),other=await account('other');
const users=Object.fromEntries([[admin,'IT Admin'],[tech,'IT Technician'],[management,'Management'],[employee,'Employee']].map(([a,role])=>[a.uid,{role,status:'Active',name:role,email:role+'@test',department:'IT'}]));
assert.equal((await db('PUT','',{users},null,true)).status,200);
const registry={userId:employee.uid,name:'Pilot',location:'KK',department:'IT',active:true,speedTests:false,createdAt:at,enrolledBy:admin.uid};
assert.equal((await db('PUT','monitoringDevices/'+device.uid,registry,employee.token)).status,401);
assert.equal((await db('PUT','monitoringDevices/'+device.uid,registry,admin.token)).status,200);
assert.equal((await db('PATCH','monitoringDevices/'+device.uid,{userId:other.uid},admin.token)).status,401);
assert.equal((await db('PUT','monitoringDevices/'+other.uid,{...registry,userId:other.uid},admin.token)).status,401);
await db('PATCH','users/'+employee.uid,{status:'Suspended'},null,true);
assert.equal((await db('PATCH','monitoringDevices/'+device.uid,{speedTests:true},admin.token)).status,200);
assert.equal((await db('PUT','monitoringDevices/'+other.uid,registry,admin.token)).status,401);
await db('PATCH','users/'+employee.uid,{status:'Active'},null,true);
const reading={at,hostname:'TEST-PC',user:'test',cpu:12,memory:40,memoryGB:8,uptimeHours:1,rebootPending:false,disks:[{name:'C:',freeGB:10,totalGB:20,usedPercent:50}],inventory:{at,os:'Windows'}};
assert.equal((await db('PUT','monitoringCurrent/'+device.uid,reading,device.token)).status,200);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{at:Date.now(),cpu:20},device.token)).status,200);
const addressInfo={publicIPv4:'203.0.113.5',publicIPv6:'2001:db8::5',checkedAt:at,interfaces:[{adapter:'Ethernet',localIP:'192.168.1.20',macAddress:'00:11:22:33:44:55'},{adapter:'Wi-Fi',localIP:'192.168.1.21',macAddress:'00:11:22:33:44:66'}]};
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo},device.token)).status,200);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo:{...addressInfo,publicIPv6:'x'.repeat(46)}},device.token)).status,401);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo:{...addressInfo,unexpected:true}},device.token)).status,401);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo:{publicIPv4:'203.0.113.5',publicIPv6:'',checkedAt:at}},device.token)).status,200);

for(const person of [admin,tech,management]) assert.equal((await db('GET','monitoringCurrent',undefined,person.token)).status,200);
for(const person of [employee,device,other]) assert.equal((await db('GET','monitoringCurrent',undefined,person.token)).status,401);
assert.equal((await db('GET','monitoringCurrent',undefined)).status,401);
assert.equal((await db('PUT','monitoringCurrent/'+other.uid,reading,device.token)).status,401);
assert.equal((await db('PUT','monitoringCurrent/'+device.uid,{...reading,cpu:101},device.token)).status,401);
assert.equal((await db('PUT','monitoringHistory/'+device.uid+'/287',{at,cpu:10,memory:40},device.token)).status,200);
assert.equal((await db('PUT','monitoringHistory/'+device.uid+'/288',{at,cpu:10,memory:40},device.token)).status,401);
assert.equal((await db('GET','tickets',undefined,device.token)).status,401);
assert.equal((await db('PATCH','users/'+employee.uid,{role:'IT Admin'},device.token)).status,401);
assert.equal((await db('PATCH','monitoringDevices/'+device.uid,{active:false},tech.token)).status,401);
assert.equal((await db('PATCH','monitoringDevices/'+device.uid,{active:false},admin.token)).status,200);
assert.equal((await db('PUT','monitoringCurrent/'+device.uid,reading,device.token)).status,401);
await db('PATCH','users/'+management.uid,{status:'Suspended'},null,true);
assert.equal((await db('GET','monitoringCurrent',undefined,management.token)).status,401);


assert.equal((await db('PATCH','monitoringDevices/'+device.uid,{active:true},admin.token)).status,200);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo:{...addressInfo,publicIPv4:'x'.repeat(16)}},device.token)).status,401);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo:{publicIPv4:'',publicIPv6:'',checkedAt:at}},device.token)).status,200);
assert.equal((await db('PATCH','monitoringCurrent/'+device.uid,{addressInfo:{publicIP:'203.0.113.5',checkedAt:at}},device.token)).status,200);

// Delete is one atomic operation. Denied callers cannot partially delete a device.
const removal={['monitoringDevices/'+device.uid]:null,['monitoringCurrent/'+device.uid]:null,['monitoringHistory/'+device.uid]:null};
await db('PATCH','users/'+management.uid,{status:'Active'},null,true);
for(const person of [employee,tech,management,device]) {
 assert.equal((await db('PATCH','',removal,person.token)).status,401);
 assert.ok(await (await db('GET','monitoringDevices/'+device.uid,undefined,admin.token)).json());
}
await db('PATCH','users/'+admin.uid,{status:'Suspended'},null,true);
assert.equal((await db('PATCH','',removal,admin.token)).status,401);
await db('PATCH','users/'+admin.uid,{status:'Active'},null,true);
assert.equal((await db('PUT','monitoringCurrent/'+device.uid,reading,admin.token)).status,401);
assert.equal((await db('PUT','monitoringHistory/'+device.uid+'/0',{at,cpu:10,memory:10},admin.token)).status,401);
await db('PUT','monitoringDevices/'+other.uid,registry,admin.token);
assert.equal((await db('PATCH','',removal,admin.token)).status,200);
for(const node of ['monitoringDevices','monitoringCurrent','monitoringHistory']) {
 assert.equal(await (await db('GET',node+'/'+device.uid,undefined,admin.token)).json(),null);
}
assert.ok(await (await db('GET','monitoringDevices/'+other.uid,undefined,admin.token)).json());
assert.equal((await db('PUT','monitoringCurrent/'+device.uid,reading,device.token)).status,401);
assert.equal((await db('PUT','monitoringHistory/'+device.uid+'/0',{at,cpu:10,memory:10},device.token)).status,401);
console.log('Firebase emulator passed: role access, device isolation, revocation, atomic deletion, validation and ticket separation.');

const reminder={enabled:true,message:'Turn off UPS',days:{mon:'17:00',tue:'17:00',wed:'17:00',thu:'17:00',fri:'17:00',sat:'13:00',sun:''},updatedAt:Date.now(),updatedBy:admin.uid};
for(const person of [employee,tech,management,device]) assert.equal((await db('PUT','reminderSchedules/'+employee.uid,reminder,person.token)).status,401);
assert.equal((await db('PUT','reminderSchedules/'+employee.uid,reminder,admin.token)).status,200);
assert.equal((await db('GET','reminderSchedules/'+employee.uid,undefined,employee.token)).status,200);
assert.equal((await db('GET','reminderSchedules/'+employee.uid,undefined,tech.token)).status,401);
assert.equal((await db('GET','reminderSchedules',undefined,employee.token)).status,401);
assert.equal((await db('GET','reminderSchedules',undefined,admin.token)).status,200);
assert.equal((await db('PUT','reminderSchedules/'+employee.uid,{...reminder,days:{...reminder.days,sat:'25:00'}},admin.token)).status,401);
const ackPath='reminderAcks/'+employee.uid+'/12345678-1234-1234-1234-123456789012/2026-10-18';
const ack={date:'2026-10-18',scheduledFor:'17:00',acknowledgedAt:Date.now(),receivedAt:Date.now(),hostname:'TEST-PC'};
assert.equal((await db('PUT',ackPath,ack,tech.token)).status,401);
assert.equal((await db('PUT',ackPath,ack,employee.token)).status,200);
assert.equal((await db('PUT',ackPath,{...ack,hostname:'Changed'},employee.token)).status,401);
assert.equal((await db('GET','reminderAcks',undefined,admin.token)).status,200);
assert.equal((await db('GET',ackPath,undefined,tech.token)).status,401);
await db('PATCH','users/'+employee.uid,{status:'Suspended'},null,true);
assert.equal((await db('GET','reminderSchedules/'+employee.uid,undefined,employee.token)).status,401);
assert.equal((await db('PUT','reminderSchedules/'+employee.uid,reminder,admin.token)).status,401);
console.log('Reminder permissions passed: admin schedules, own-user reads, validation and append-only own acknowledgments.');

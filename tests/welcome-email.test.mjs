import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function service(role='IT Admin',status='Active') {
  const sent=[], properties=new Map();
  const ctx={HELP_DESK_URL:'https://example.com/',STAFF_DIRECTORY:'staff/',MAIL_SENDER:'it@example.com',
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
    GmailApp:{sendEmail:(...args)=>sent.push(args)}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),ctx);
  ctx.jsonRequest_=url=>url.includes('accounts:lookup')?{users:[{localId:'admin'}]}:url.includes('/admin.json')?{role,status}:{name:'New Person',email:'new@example.com',role:'Employee',status:'Active',mustChangePassword:true};
  ctx.registeredEmails_=()=>({newuser:'new@example.com'});ctx.checkMailSender_=()=>{};
  return {ctx,sent,properties};
}
const request={userId:'newuser',idToken:'valid-token',temporaryPassword:'Temporary-123!'};
test('welcome email resolves recipient and login link server-side and avoids duplicate retries',()=>{
  const {ctx,sent,properties}=service();
  ctx.sendWelcome_({...request,email:'attacker@example.com',loginLink:'https://wrong.example'});
  ctx.sendWelcome_(request);
  assert.equal(sent.length,1);assert.equal(sent[0][0],'new@example.com');
  assert.ok(sent[0][2].includes('https://example.com/?email=new%40example.com'));
  assert.ok(sent[0][2].includes(request.temporaryPassword));
  assert.ok(!JSON.stringify([...properties]).includes(request.temporaryPassword));
});
test('non-admins and suspended admins cannot send credentials',()=>{
  for(const [role,status] of [['Employee','Active'],['Management','Active'],['IT Technician','Active'],['IT Admin','Suspended']]){
    const {ctx,sent}=service(role,status);assert.throws(()=>ctx.sendWelcome_(request));assert.equal(sent.length,0);
  }
});
test('mail failure leaves no sent marker and can retry without recreating the account',()=>{
  const {ctx,properties}=service();ctx.GmailApp.sendEmail=()=>{throw Error('quota');};
  assert.throws(()=>ctx.sendWelcome_(request));assert.equal(properties.size,0);
});

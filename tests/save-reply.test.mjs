import test from 'node:test';
import assert from 'node:assert/strict';
import { saveReply, bounded } from '../src/save-reply.ts';
const args={base:'https://example.invalid',token:'token',uid:'tech',role:'IT Technician',requesterId:'staff',ticketId:'t',id:'n',note:{text:'Done'},fields:{status:'Resolved'},canEdit:true};
test('technician verifies assignment query then atomically saves status and reply',async()=>{
 let count=0;
 await saveReply(args,async(url,init)=>{
  count++; if(count===1){assert.equal(new URL(url).searchParams.get('orderBy'),'"technicianId"');assert.ok(init.signal);return Response.json({t:{updates:{}}});}
  assert.equal(init.method,'PATCH');assert.deepEqual(JSON.parse(init.body),{status:'Resolved','updates/n':{text:'Done'}});return Response.json(null);
 },true);
 assert.equal(count,2);
});
test('retry after lost acknowledgement recognizes existing reply without replaying status',async()=>{
 let count=0;await saveReply(args,async()=>{count++;return Response.json({t:{updates:{n:{text:'Done'}}}});},true);assert.equal(count,1);
});
test('staff uses owner query and writes only a new reply',async()=>{
 let count=0;await saveReply({...args,uid:'staff',role:'Employee',canEdit:false},async(url,init)=>{
  if(++count===1){assert.equal(new URL(url).searchParams.get('orderBy'),'"requesterId"');return Response.json({t:{}});}
  assert.equal(init.method,'PUT');assert.ok(url.includes('/updates/n.json'));assert.deepEqual(JSON.parse(init.body),args.note);return Response.json(null);
 },true);
});
test('offline replies make no network write and token refresh has a deadline',async()=>{
 await assert.rejects(saveReply(args,async()=>{throw Error('should not run');},false),/No internet/);
 await assert.rejects(bounded(new Promise(()=>{}),5),/timed out/);
});

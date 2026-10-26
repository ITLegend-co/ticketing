import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnce, deliver } from '../src/outbox-core.ts';
const ticket = { requesterId: 'owner', createdAt: 123, subject: 'Offline test' };
const make = () => ({ id: 'fixed-id', uid: 'owner', ticket, saved: false, attempted: false, photos: [{id:'photo-1',file:{name:'test.png'}}] });
test('conditional create never overwrites an existing updated ticket', async () => {
  await createOnce('https://example.invalid',ticket,async (_, options) => {
    assert.equal(options.headers['if-match'], 'null_etag');
    return new Response(JSON.stringify({...ticket,status:'Resolved'}),{status:412});
  }, true);
  await assert.rejects(createOnce('x',ticket,async()=>new Response(JSON.stringify({...ticket,requesterId:'other'}),{status:412})),/already used/);
});
test('access denied is kept as a failure, not marked sent',async()=>{
  await assert.rejects(createOnce('x',ticket,async()=>new Response('',{status:401})),/Access was denied/);
});
test('interrupted upload resumes the original ticket and retains photos',async()=>{
  const row=make();let persisted, creates=0, uploads=0, completed=0;
  const deps={active:()=>true,persist:async row=>{persisted=structuredClone(row)},create:async()=>{creates++},upload:async()=>{uploads++;throw new Error('offline')},complete:async()=>{completed++}};
  await assert.rejects(deliver(row,deps),/offline/);
  assert.equal(persisted.saved,true);assert.equal(persisted.photos[0].sent,undefined);assert.equal(completed,0);
  await deliver(structuredClone(persisted),{...deps,upload:async()=>{uploads++}});
  assert.equal(creates,1);assert.equal(uploads,2);assert.equal(completed,1);
});
test('a different signed-in account cannot send another account queue',async()=>{
  let calls=0;
  await deliver(make(),{active:()=>false,persist:async()=>calls++,create:async()=>calls++,upload:async()=>calls++,complete:async()=>calls++});
  assert.equal(calls,0);
});
test('lost create acknowledgement retains original ID for retry',async()=>{
  const row=make();let persisted;
  await assert.rejects(deliver(row,{active:()=>true,persist:async row=>{persisted=structuredClone(row)},create:async()=>{throw new Error('network')},upload:async()=>{},complete:async()=>{throw new Error('must not complete')}}));
  assert.equal(persisted.id,'fixed-id');assert.equal(persisted.attempted,true);assert.equal(persisted.saved,false);
});

test('normal staff can create without direct ticket read permission',async()=>{
  let writes=0;
  await createOnce('https://example.invalid',ticket,async(_,options)=>{
    writes++;
    if(options.headers['if-match'])return new Response('',{status:401});
    assert.equal(options.method,'PUT');
    assert.deepEqual(JSON.parse(options.body),ticket);
    return new Response('{}',{status:200});
  });
  assert.equal(writes,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { sendOnline } from '../src/send-online.ts';
test('offline submission never sends or queues',async()=>{
 let calls=0;await assert.rejects(sendOnline('x',{},false,async()=>{calls++;}),/No internet connection/);assert.equal(calls,0);
});
test('online write has no conditional read requirement',async()=>{
 await sendOnline('https://example.invalid',{subject:'test'},true,async(url,options)=>{
 assert.equal(options.method,'PUT');assert.equal(options.headers['if-match'],undefined);return new Response('null',{status:200});});
});
test('access and network errors are distinguished',async()=>{
 await assert.rejects(sendOnline('x',{},true,async()=>new Response('',{status:401})),/Access denied/);
 await assert.rejects(sendOnline('x',{},true,async()=>{throw new TypeError('network')}),/Delivery could not be confirmed/);
});

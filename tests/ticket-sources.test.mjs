import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeTicketSources } from '../src/ticket-sources.ts';
test('own and assigned subscriptions merge without duplicates and remove stale snapshots',()=>{
 const callbacks={}, results=[];let stopped=0;
 const stop=subscribeTicketSources(['own','assigned'],(source,next)=>{callbacks[source]=next;return()=>stopped++;},(rows,ready)=>results.push({rows,ready}),()=>{});
 callbacks.own({val:()=>({mine:{subject:'My issue'},both:{subject:'Both'}})});
 assert.equal(results.at(-1).ready,false);
 callbacks.assigned({val:()=>({work:{subject:'Staff issue'},both:{subject:'Both'}})});
 assert.equal(results.at(-1).ready,true);assert.equal(Object.keys(results.at(-1).rows).length,3);
 callbacks.assigned({val:()=>null});
 assert.deepEqual(Object.keys(results.at(-1).rows),['mine','both']);
 stop();assert.equal(stopped,2);
 const count=results.length;callbacks.own({val:()=>null});assert.equal(results.length,count);
});

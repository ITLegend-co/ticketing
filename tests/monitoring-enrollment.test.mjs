import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceAssignment } from '../src/monitoring-enrollment.ts';
const user={name:'  Full Staff Name  ',email:'staff@example.test',department:'IT',status:'Active'};
test('directory enrollment copies full name and department without inventing a location',()=>{
 assert.deepEqual(deviceAssignment('uid-a',user),{userId:'uid-a',name:'Full Staff Name',department:'IT',location:'Not recorded'});
 assert.equal(deviceAssignment('uid-b',{...user,location:' KP '}).location,'KP');
 assert.equal(deviceAssignment('uid-b',user).userId,'uid-b');
});
test('missing and inactive users are rejected before device account creation',()=>{
 for(const person of [null,undefined,{...user,status:'Suspended'},{...user,name:''},{...user,department:''}]) assert.throws(()=>deviceAssignment('uid-a',person));
 assert.throws(()=>deviceAssignment('',user));
});

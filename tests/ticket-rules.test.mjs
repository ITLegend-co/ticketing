import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
class Snapshot {
  constructor(value) { this.value = value; }
  val() { return this.value ?? null; }
  child(key) { return new Snapshot(this.value?.[key]); }
  exists() { return this.value != null; }
  isString() { return typeof this.value === 'string'; }
  isNumber() { return typeof this.value === 'number'; }
  hasChildren(keys) { return keys.every((key) => this.child(key).exists()); }
}
const people = {
  admin: { name: 'Admin', role: 'IT Admin', status: 'Active', department: 'IT' },
  tech: { name: 'Technician', role: 'IT Technician', status: 'Active', department: 'IT' },
  otherTech: { name: 'Other', role: 'IT Technician', status: 'Active' },
  employee: { name: 'Employee', role: 'Employee', status: 'Active', department: 'Operations' },
};
const pending = { subject: 'Request', description: 'Description', category: 'Hardware', priority: 'Unreviewed', status: 'Open', location: 'Office', impact: 'Single User', requesterId: 'employee', requester: 'Employee', department: 'Operations', technicianId: '', technician: '', createdAt: 1, updatedAt: 1, reviewedAt: 0, reviewedBy: '' };
const reviewed = { ...pending, priority: 'High', technicianId: 'tech', technician: 'Technician', reviewedAt: 2, reviewedBy: 'admin' };
const evaluate = (expression, uid, data, next, query = {}) => Function('auth','root','data','newData','query','$uid',`return (${expression});`)(uid ? { uid } : null, new Snapshot({ users: people }), new Snapshot(data), new Snapshot(next), query, uid);
const write = (uid, old, next) => evaluate(rules.tickets.$ticketId['.write'], uid, old, next);
const validate = (next) => evaluate(rules.tickets.$ticketId['.validate'], 'admin', pending, next);

test('employees can submit an unreviewed request but cannot choose priority or assignment', () => {
  assert.equal(write('employee', null, pending), true);
  assert.equal(write('employee', null, reviewed), false);
  assert.equal(write('employee', null, { ...pending, priority: 'High' }), false);
  assert.equal(write('employee', null, { ...pending, requesterId: 'admin' }), false);
});
test('admin review and assignment passes both write and validation rules', () => {
  assert.equal(write('admin', pending, reviewed), true);
  assert.equal(validate(reviewed), true);
  assert.equal(validate({ ...reviewed, technicianId: 'employee', technician: 'Employee' }), false);
  assert.equal(validate({ ...reviewed, priority: 'Unreviewed' }), false);
});
test('assigned technicians can update status but cannot change review or assignment', () => {
  assert.equal(write('tech', reviewed, { ...reviewed, status: 'In Progress', updatedAt: 3 }), true);
  assert.equal(write('otherTech', reviewed, { ...reviewed, status: 'In Progress' }), false);
  assert.equal(write('tech', reviewed, { ...reviewed, priority: 'Low' }), false);
  assert.equal(write('tech', pending, { ...pending, status: 'In Progress' }), false);
});
test('public reads are denied and user reads must query their own requests', () => {
  const rule = rules.tickets['.read'];
  assert.equal(evaluate(rule, null), false);
  assert.equal(evaluate(rule, 'employee'), false);
  assert.equal(evaluate(rule, 'employee', null, null, { orderByChild: 'requesterId', equalTo: 'employee' }), true);
  assert.equal(evaluate(rule, 'employee', null, null, { orderByChild: 'requesterId', equalTo: 'admin' }), false);
});
test('technicians must query requests assigned to themselves', () => {
  const rule = rules.tickets['.read'];
  assert.equal(evaluate(rule, 'tech'), false);
  assert.equal(evaluate(rule, 'tech', null, null, { orderByChild: 'technicianId', equalTo: 'tech' }), true);
  assert.equal(evaluate(rule, 'admin'), true);
});
test('only an active IT Admin can delete pending or reviewed submissions', () => {
  assert.equal(write('admin', pending, null), true);
  assert.equal(write('admin', reviewed, null), true);
  for (const role of ['employee', 'tech', 'otherTech']) assert.equal(write(role, reviewed, null), false);
  assert.equal(write(null, reviewed, null), false);
  people.admin.status = 'Suspended';
  assert.equal(write('admin', reviewed, null), false);
  people.admin.status = 'Active';
  assert.equal(write('admin', reviewed, { ...reviewed, requesterId: 'admin' }), false);
});


test('requesters can append an authenticated reply but cannot edit or delete notes', () => {
  const node = rules.tickets.$ticketId.updates.$updateId;
  const evaluateNote = (expression, uid, old, next, request = reviewed) => Function('auth', 'root', 'data', 'newData', '$ticketId', `return (${expression});`)(uid ? { uid } : null, new Snapshot({ users: people, tickets: { request } }), new Snapshot(old), new Snapshot(next), 'request');
  const note = { text: 'Please check again', author: 'Employee', authorId: 'employee', createdAt: 10 };
  assert.equal(evaluateNote(node['.write'], 'employee', null, note), true);
  assert.equal(evaluateNote(node['.validate'], 'employee', null, note), true);
  assert.equal(evaluateNote(node['.write'], 'otherTech', null, note), false);
  assert.equal(evaluateNote(node['.write'], null, null, note), false);
  assert.equal(evaluateNote(node['.write'], 'employee', note, { ...note, text: 'Edited' }), false);
  assert.equal(evaluateNote(node['.write'], 'employee', note, null), false);
  assert.equal(evaluateNote(node['.validate'], 'employee', null, { ...note, authorId: 'admin' }), false);
  assert.equal(evaluateNote(node['.validate'], 'employee', null, { ...note, author: 'Admin' }), false);
  assert.equal(evaluateNote(node['.validate'], 'employee', null, { ...note, text: 'x'.repeat(4001) }), false);
  assert.equal(write('employee', reviewed, { ...reviewed, status: 'Resolved' }), false);
});

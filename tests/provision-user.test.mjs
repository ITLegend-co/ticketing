import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const primaryApp = { name: '[DEFAULT]' };
const primaryAuth = { currentUser: { uid: 'administrator' } };
const database = { app: primaryApp };
const calls = [];
let role = 'IT Admin';
let status = 'Active';
let signupFailure;
let writeFailure;
let rollbackFailure;
let cleanupFailure;
let changeSession = false;
const memoryPersistence = { type: 'NONE' };

mock.module('firebase/app', { namedExports: {
  getApps: () => [primaryApp], getApp: () => primaryApp,
  initializeApp: (_config, name) => { const app = { name }; calls.push(['initializeApp', app]); return app; },
  deleteApp: async (app) => { calls.push(['deleteApp', app]); if (cleanupFailure) throw cleanupFailure; },
} });
mock.module('firebase/auth', { namedExports: {
  getAuth: (app) => app === primaryApp ? primaryAuth : { app },
  initializeAuth: (app, deps) => { calls.push(['initializeAuth', app, deps]); return { app }; },
  inMemoryPersistence: memoryPersistence,
  createUserWithEmailAndPassword: async (auth, email, password) => {
    calls.push(['createAuthUser', auth, email, password]);
    if (signupFailure) throw signupFailure;
    if (changeSession) primaryAuth.currentUser = { uid: 'other-administrator' };
    return { user: { uid: 'new-user' } };
  },
  deleteUser: async (user) => { calls.push(['deleteUser', user]); if (rollbackFailure) throw rollbackFailure; },
  signOut: async (auth) => { calls.push(['signOut', auth]); if (cleanupFailure) throw cleanupFailure; },
  sendPasswordResetEmail: async () => {},
} });
mock.module('firebase/database', { namedExports: {
  getDatabase: () => database,
  ref: (db, path) => ({ db, path }),
  get: async (target) => { calls.push(['get', target]); return { val: () => ({ role, status }) }; },
  set: async (target, value) => { calls.push(['set', target, value]); if (writeFailure) throw writeFailure; },
} });
const { provisionUser, generateTemporaryPassword } = await import('../src/firebase.ts');
const input = { name: ' Test User ', email: ' NEW@EXAMPLE.COM ', role: 'Employee', department: ' Operations ' };
const password = 'Example-temp-7!';

beforeEach(() => {
  calls.length = 0; role = 'IT Admin'; status = 'Active'; signupFailure = undefined;
  writeFailure = undefined; rollbackFailure = undefined; cleanupFailure = undefined; changeSession = false;
  primaryAuth.currentUser = { uid: 'administrator' };
});

test('creates login and profile using separate Auth and the administrator database session', async () => {
  assert.equal(await provisionUser(input, password), 'new-user');
  const creation = calls.find(([name]) => name === 'createAuthUser');
  assert.notEqual(creation[1], primaryAuth);
  assert.equal(creation[2], 'new@example.com');
  assert.equal(creation[3], password);
  const initialization = calls.find(([name]) => name === 'initializeAuth');
  assert.equal(initialization[2].persistence, memoryPersistence);
  const write = calls.find(([name]) => name === 'set');
  assert.equal(write[1].db, database);
  assert.equal(write[1].path, 'users/new-user');
  assert.deepEqual({ ...write[2], createdAt: 0 }, { name: 'Test User', email: 'new@example.com', role: 'Employee', department: 'Operations', status: 'Active', mustChangePassword: true, createdAt: 0 });
  assert.equal(primaryAuth.currentUser.uid, 'administrator');
  assert.ok(calls.some(([name]) => name === 'deleteApp'));
  assert.ok(calls.filter(([name]) => name === 'signOut').every(([, auth]) => auth !== primaryAuth));
});

test('non-admin and suspended accounts are rejected before an Auth account is created', async () => {
  for (const denied of [{ role: 'Employee', status: 'Active' }, { role: 'IT Admin', status: 'Suspended' }]) {
    role = denied.role; status = denied.status;
    await assert.rejects(provisionUser(input, password), /Only an active IT Administrator/);
  }
  assert.equal(calls.some(([name]) => name === 'createAuthUser'), false);
});

test('signed-out accounts and invalid form values do not create accounts', async () => {
  primaryAuth.currentUser = null;
  await assert.rejects(provisionUser(input, password), /Sign in as an administrator/);
  primaryAuth.currentUser = { uid: 'administrator' };
  await assert.rejects(provisionUser({ ...input, name: ' ' }, password), /Enter a name/);
  await assert.rejects(provisionUser({ ...input, role: 'Superuser' }, password), /valid role/);
  await assert.rejects(provisionUser(input, 'short'), /at least 8/);
  assert.equal(calls.some(([name]) => name === 'createAuthUser'), false);
});

test('duplicate email failure creates no profile and preserves the existing account', async () => {
  signupFailure = Object.assign(new Error('Duplicate email'), { code: 'auth/email-already-in-use' });
  await assert.rejects(provisionUser(input, password), { code: 'auth/email-already-in-use' });
  assert.equal(calls.some(([name]) => name === 'set' || name === 'deleteUser'), false);
  assert.ok(calls.some(([name]) => name === 'deleteApp'));
});

test('failed profile writes roll back only the new Auth account', async () => {
  writeFailure = Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
  await assert.rejects(provisionUser(input, password), /Permission denied/);
  assert.equal(calls.find(([name]) => name === 'deleteUser')[1].uid, 'new-user');
  assert.equal(primaryAuth.currentUser.uid, 'administrator');
});

test('a changed administrator session aborts the write and rolls back the account', async () => {
  changeSession = true;
  await assert.rejects(provisionUser(input, password), /session changed/);
  assert.equal(calls.some(([name]) => name === 'set'), false);
  assert.ok(calls.some(([name]) => name === 'deleteUser'));
});

test('cleanup errors do not misreport a successful creation', async () => {
  cleanupFailure = new Error('Cleanup failed');
  assert.equal(await provisionUser(input, password), 'new-user');
});

test('rollback failures explain how to finish setup without exposing the password', async () => {
  writeFailure = new Error('Write failed'); rollbackFailure = new Error('Rollback failed');
  await assert.rejects(provisionUser(input, password), (error) => {
    assert.match(error.message, /Link existing account/);
    assert.equal(error.message.includes(password), false);
    return true;
  });
});

test('generated passwords are distinct and include all required character classes', () => {
  const samples = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()));
  assert.equal(samples.size, 100);
  for (const value of samples) {
    assert.ok(value.length >= 20);
    for (const pattern of [/[A-Z]/, /[a-z]/, /[0-9]/, /[^a-zA-Z0-9]/]) assert.match(value, pattern);
  }
});

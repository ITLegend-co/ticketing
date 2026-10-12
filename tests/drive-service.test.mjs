import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const code = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
function service(profile, records, uid = 'employee') {
  const requests = [];
  const context = vm.createContext({
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({ url, options });
      const data = url.includes('identitytoolkit') ? { users: [{ localId: uid }] }
        : url.includes('/users/') ? profile : records;
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(data) };
    } },
    Utilities: { base64Decode: (text) => Array.from(Buffer.from(text, 'base64')) },
  });
  vm.runInContext(code, context);
  return { context, requests };
}
const own = { requesterId: 'employee', reviewedAt: 0, technicianId: '' };
const request = { idToken: 'test-token', ticketId: 'ticket-1' };

test('Drive service verifies identity and profile rather than trusting a supplied role', () => {
  const { context, requests } = service({ role: 'Employee', status: 'Active' }, { 'ticket-1': own });
  const access = context.authorize_({ ...request, role: 'IT Admin' });
  assert.equal(access.uid, 'employee');
  assert.equal(access.canUpload, true);
  assert.match(requests[0].url, /identitytoolkit.*accounts:lookup/);
  assert.equal(JSON.parse(requests[0].options.payload).idToken, 'test-token');
});
test('employees cannot access another persons attachment request', () => {
  const { context } = service({ role: 'Employee', status: 'Active' }, {});
  assert.throws(() => context.authorize_(request), /do not have access/);
});
test('suspended accounts are refused', () => {
  const { context } = service({ role: 'IT Admin', status: 'Suspended' }, own);
  assert.throws(() => context.authorize_(request), /active helpdesk access/);
});
test('IT people cannot view unreviewed tickets assigned to them', () => {
  const { context } = service({ role: 'IT Technician', status: 'Active' }, { 'ticket-1': { ...own, requesterId: 'other', technicianId: 'tech', reviewedAt: 0 } }, 'tech');
  assert.throws(() => context.authorize_(request), /do not have access/);
});
test('management can view but cannot upload', () => {
  const { context } = service({ role: 'Management', status: 'Active' }, own, 'manager');
  assert.equal(context.authorize_(request).canUpload, false);
  assert.throws(() => context.upload_({}, { canUpload: false }), /cannot add attachments/);
});
test('malformed request paths are rejected before accessing Firebase or Drive', () => {
  const { context, requests } = service({ role: 'IT Admin', status: 'Active' }, own);
  assert.throws(() => context.authorize_({ ...request, ticketId: '../users/admin' }), /Invalid request/);
  assert.equal(requests.length, 0);
});
test('a fake JPEG is rejected by file content checks', () => {
  const { context } = service({ role: 'IT Admin', status: 'Active' }, own);
  assert.throws(() => context.upload_({ base64: Buffer.from('<script>alert(1)</script>').toString('base64'), mime: 'image/jpeg' }, { canUpload: true }), /JPG, PNG, or WebP/);
});

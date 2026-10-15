import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPERATOR_DIRECTORY, canUpdateTicket, isOperatorPath, isStaffRole, portalLink } from '../src/portal.ts';

test('operator URL is recognized only at the configured directory', () => {
  assert.equal(isOperatorPath('/ticketing/'), false);
  assert.equal(isOperatorPath(`/ticketing/${OPERATOR_DIRECTORY}/`), true);
  assert.equal(isOperatorPath(`/ticketing/${OPERATOR_DIRECTORY}-other/`), false);
});
test('normal user links point to the request portal without passwords', () => {
  const url = new URL(portalLink('/ticketing/', 'https://example.com', 'Employee', 'user@example.com'));
  assert.equal(url.pathname, '/ticketing/');
  assert.equal(url.searchParams.get('email'), 'user@example.com');
  assert.equal(url.searchParams.has('password'), false);
});
test('staff links point to the operator directory', () => {
  for (const role of ['IT Admin', 'IT Technician', 'Management']) {
    assert.equal(isStaffRole(role), true);
    assert.equal(new URL(portalLink('/ticketing/', 'https://example.com', role, 'staff@example.com')).pathname, `/ticketing/${OPERATOR_DIRECTORY}/`);
  }
  assert.equal(isStaffRole('Employee'), false);
});
test('admins can review and reply before assignment; technicians must wait for review', () => {
  assert.equal(canUpdateTicket('IT Admin', 'admin', { reviewedAt: 0, technicianId: '' }), true);
  for (const role of ['Management', 'IT Technician', 'Employee']) assert.equal(canUpdateTicket(role, 'it-1', { reviewedAt: 0, technicianId: 'it-1' }), false);
});
test('only the admin or assigned IT person can work a reviewed request', () => {
  const ticket = { reviewedAt: 100, technicianId: 'it-1' };
  assert.equal(canUpdateTicket('IT Admin', 'admin', ticket), true);
  assert.equal(canUpdateTicket('IT Technician', 'it-1', ticket), true);
  assert.equal(canUpdateTicket('IT Technician', 'it-2', ticket), false);
  assert.equal(canUpdateTicket('Employee', 'it-1', ticket), false);
});

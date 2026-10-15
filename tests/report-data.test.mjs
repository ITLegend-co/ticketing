import test from 'node:test';
import assert from 'node:assert/strict';
import { reportTickets } from '../src/report-data.ts';
import { displayName } from '../src/display-name.ts';
test('report dates include both whole Malaysia days regardless of browser timezone', () => {
  const ticket = (id, date) => ({ id, createdAt: Date.parse(date) });
  const rows = [ticket('before','2026-10-13T15:59:59Z'),ticket('start','2026-10-13T16:00:00Z'),ticket('end','2026-10-15T15:59:59.999Z'),ticket('after','2026-10-15T16:00:00Z')];
  assert.deepEqual(reportTickets(rows.reverse(),'2026-10-14','2026-10-15').map(t=>t.id),['start','end']);
  assert.throws(()=>reportTickets(rows,'2026-10-15','2026-10-14'));
  assert.throws(()=>reportTickets(rows,'','2026-10-15'));
});
test('display aliases change names without changing unrelated names', () => {
  assert.equal(displayName('IT Admin'),'MT Adly');
  assert.equal(displayName('IT Verification'),'MT Adly');
  assert.equal(displayName('Other Admin'),'Other Admin');
});

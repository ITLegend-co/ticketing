import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const code = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../google-apps-script/Notifications.gs', import.meta.url), 'utf8');
const ticket = { subject: 'Printer issue', requesterId: 'employee', requester: 'Staff', technicianId: 'tech', technician: 'IT person', priority: 'High', reviewedAt: 1, status: 'Open', updates: {} };
const profiles = {
  employee: { role: 'Employee', status: 'Active', email: 'wrong-profile@example.com' },
  admin: { role: 'IT Admin', status: 'Active' }, tech: { role: 'IT Technician', status: 'Active' },
  suspended: { role: 'IT Admin', status: 'Suspended' }, manager: { role: 'Management', status: 'Active' },
};
const emails = { employee: 'requester@example.com', admin: 'admin@example.com', tech: 'tech@example.com', suspended: 'suspended@example.com' };
function service(previous = {}, current = { request: ticket }, options = {}) {
  let saved = JSON.stringify({ version: 1, tickets: previous, queue: [] });
  const properties = { HELPDESK_MAIL_STATE_FILE: 'state-file' };
  const sent = [], calls = [], triggers = [];
  const file = { setSharing() {}, getId: () => 'state-file', getBlob: () => ({ getDataAsString: () => saved }), setContent: value => { saved = value; } };
  const context = vm.createContext({ console: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] || null, setProperty: (name, value) => { properties[name] = value; }, deleteProperty: name => { delete properties[name]; } }) },
    ScriptApp: { getOAuthToken: () => 'owner-token', getProjectTriggers: () => triggers, newTrigger: handler => ({ timeBased: () => ({ everyMinutes: minutes => ({ create: () => triggers.push({ getHandlerFunction: () => handler, minutes }) }) }) }), deleteTrigger: trigger => triggers.splice(triggers.indexOf(trigger), 1) },
    GmailApp: { getAliases: () => options.aliases || ['itverif@mountaintorq.com'], sendEmail: (to, subject, body, settings) => {
      if (options.failAt === sent.length) throw new Error('SMTP unavailable');
      sent.push({ to, subject, body, settings });
    } },
    MailApp: { getRemainingDailyQuota: () => options.quota ?? 100 },
    DriveApp: { Access: { PRIVATE: 'private' }, Permission: { NONE: 'none' }, getFileById: () => file, createFile: (_, data) => { saved = data; return file; } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: { fetch: (url, settings) => {
      calls.push({ url, settings });
      const data = url.includes('identitytoolkit') ? { users: Object.entries(emails).map(([localId, email]) => ({ localId, email })) }
        : url.includes('/users.json') ? profiles : current;
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(data) };
    } },
  });
  vm.runInContext(code, context);
  return { context, sent, properties, calls, triggers, state: () => JSON.parse(saved) };
}

test('resolved tickets notify requester, all active admins and assigned IT using Auth emails', () => {
  const { context, sent, state, calls } = service({ request: ticket }, { request: { ...ticket, status: 'Resolved' } });
  context.pollTicketNotifications();
  assert.deepEqual(sent.map(mail => mail.to), ['requester@example.com', 'tech@example.com', 'admin@example.com']);
  assert.ok(sent.every(mail => mail.settings.from === 'itverif@mountaintorq.com' && mail.subject.includes('Ticket resolved')));
  assert.ok(calls.every(call => call.settings.headers.Authorization === 'Bearer owner-token'));
  assert.match(sent[0].body, /https:\/\/itlegend-co.github.io\/ticketing\/\?ticket=request/);
  assert.match(sent[1].body, /askjaslhrui3893478rehfsj38uhef\/\?ticket=request/);
  assert.equal(state().queue.length, 0);
});
test('repeated scans do not resend unchanged tickets', () => {
  const serviceState = service();
  serviceState.context.pollTicketNotifications();
  const count = serviceState.sent.length;
  delete serviceState.properties.HELPDESK_LAST_MAIL_POLL;
  serviceState.context.pollTicketNotifications();
  assert.equal(serviceState.sent.length, count);
});
test('quota exhaustion preserves the queue for the next scheduled attempt', () => {
  const { context, sent, state } = service({}, { request: ticket }, { quota: 0 });
  context.pollTicketNotifications();
  assert.equal(sent.length, 0);
  assert.equal(state().queue.length, 1);
});
test('partial send failure persists recipients already sent and retries only the rest', () => {
  const settings = { failAt: 1 };
  const { context, sent, state, properties } = service({}, { request: ticket }, settings);
  assert.throws(() => context.pollTicketNotifications(), /SMTP unavailable/);
  assert.deepEqual(state().queue[0].sent, ['requester@example.com']);
  settings.failAt = -1;
  delete properties.HELPDESK_LAST_MAIL_POLL;
  context.pollTicketNotifications();
  assert.deepEqual(sent.map(mail => mail.to), ['requester@example.com', 'tech@example.com', 'admin@example.com']);
  assert.equal(state().queue.length, 0);
});
test('setup creates a baseline without mailing historical tickets and is safe to rerun', () => {
  const { context, properties, state, triggers, sent } = service();
  delete properties.HELPDESK_MAIL_STATE_FILE;
  context.setupNotifications();
  context.setupNotifications();
  assert.equal(state().tickets.request.subject, ticket.subject);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].minutes, 5);
  assert.equal(sent.length, 0);
});
test('missing sender alias fails before any email is sent', () => {
  const { context, sent } = service({}, { request: ticket }, { aliases: ['other@example.com'] });
  assert.throws(() => context.setupNotifications(), /Add and verify/);
  assert.equal(sent.length, 0);
});
test('recipients are deduplicated, inactive users excluded and profile email ignored', () => {
  const { context } = service();
  const recipients = context.mailRecipients_({ ticket }, profiles, { ...emails, tech: emails.admin });
  assert.deepEqual(Array.from(recipients, person => person.email), ['requester@example.com', 'admin@example.com']);
});
test('new notes and priority changes trigger emails while unchanged notes do not', () => {
  const { context } = service();
  const event = context.mailChanges_({ request: ticket }, { request: { ...ticket, priority: 'Critical', updates: { note: { author: 'Staff', text: 'Still broken' } } } });
  assert.equal(event.length, 1);
  assert.match(event[0].text, /Critical/);
  assert.match(event[0].text, /Still broken/);
  assert.equal(context.mailChanges_({ request: ticket }, { request: ticket }).length, 0);
});
test('pause disables website-triggered sends as well as the timer', () => {
  const { context, sent } = service();
  context.stopNotifications();
  context.pollTicketNotifications();
  assert.equal(sent.length, 0);
});
test('stale queued assignment notifications do not go to an unassigned IT person', () => {
  const { context, sent } = service({ request: ticket }, { request: { ...ticket, technicianId: 'admin', technician: 'Admin' } });
  context.pollTicketNotifications();
  assert.deepEqual(sent.map(mail => mail.to), ['requester@example.com', 'admin@example.com']);
});

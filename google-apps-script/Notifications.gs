// Runs only as the script owner. No passwords or email recipients are accepted from the website.
const MAIL_SENDER = 'itverif@mountaintorq.com';
const HELP_DESK_URL = 'https://itlegend-co.github.io/ticketing/';
const STAFF_DIRECTORY = 'askjaslhrui3893478rehfsj38uhef/';
const FIREBASE_PROJECT = 'ticketing-a8461';
const MAIL_STATE_PROPERTY = 'HELPDESK_MAIL_STATE_FILE';

function ownerJson_(url, options) {
  const response = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options || {}, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
  }));
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Firebase owner access failed (HTTP ' + response.getResponseCode()
      + '). Use a Google account with Firebase Database read and Firebase Authentication read permissions on ticketing-a8461. Check the manifest scopes and enable the Identity Toolkit API for the Apps Script Google Cloud project if requested.');
  }
  return JSON.parse(response.getContentText());
}

function registeredEmails_(ids) {
  const result = {};
  for (let index = 0; index < ids.length; index += 100) {
    const response = ownerJson_('https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/accounts:lookup', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ localId: ids.slice(index, index + 100) }),
    });
    (response.users || []).forEach(function(user) {
      if (!user.disabled && typeof user.email === 'string' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(user.email)) result[user.localId] = user.email;
    });
  }
  return result;
}

function checkMailSender_() {
  if (GmailApp.getAliases().map(function(email) { return email.toLowerCase(); }).indexOf(MAIL_SENDER) === -1) {
    throw new Error('Add and verify ' + MAIL_SENDER + ' in Gmail Send mail as for the account running this script.');
  }
}

function mailSnapshot_(tickets) {
  const result = {};
  Object.keys(tickets || {}).forEach(function(id) {
    const ticket = tickets[id];
    result[id] = {
      subject: ticket.subject || '', requesterId: ticket.requesterId, requester: ticket.requester || '',
      technicianId: ticket.technicianId || '', technician: ticket.technician || '', priority: ticket.priority,
      status: ticket.status, reviewedAt: ticket.reviewedAt || 0,
      updates: Object.assign({}, ticket.updates || {}),
    };
  });
  return result;
}

function mailChanges_(previous, current) {
  const events = [];
  Object.keys(current).forEach(function(id) {
    const now = current[id], old = previous[id];
    const changes = [];
    if (!old) changes.push('Request submitted for IT Admin review.');
    else {
      if (now.technicianId !== old.technicianId || now.priority !== old.priority || !!now.reviewedAt !== !!old.reviewedAt) {
        changes.push('Priority: ' + now.priority + '. Assigned to: ' + (now.technician || 'Unassigned') + '.');
      }
      if (now.status !== old.status) changes.push('Status changed from ' + old.status + ' to ' + now.status + '.');
    }
    Object.keys(now.updates).forEach(function(noteId) {
      if (!old || !Object.prototype.hasOwnProperty.call(old.updates, noteId)) {
        const note = now.updates[noteId];
        changes.push((note.author || 'Helpdesk') + ': ' + String(note.text || '').slice(0, 4000));
      }
    });
    if (changes.length) events.push({ ticketId: id, ticket: now, kind: !old ? 'New request' : now.status === 'Resolved' && old.status !== 'Resolved' ? 'Ticket resolved' : 'Ticket updated', text: changes.join('\n\n'), sent: [] });
  });
  Object.keys(previous).forEach(function(id) {
    if (!Object.prototype.hasOwnProperty.call(current, id)) events.push({ ticketId: id, ticket: previous[id], kind: 'Ticket deleted', text: 'This ticket has been deleted by IT Admin.', sent: [] });
  });
  return events;
}

function mailRecipients_(event, profiles, emails) {
  const ids = [event.ticket.requesterId, event.ticket.technicianId];
  Object.keys(profiles).forEach(function(id) { if (profiles[id].role === 'IT Admin') ids.push(id); });
  const seen = {};
  return ids.filter(function(id) {
    if (!id || !profiles[id] || profiles[id].status !== 'Active' || !emails[id]) return false;
    const key = emails[id].toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).map(function(id) { return { uid: id, email: emails[id], role: profiles[id].role }; });
}

function mailTicketLink_(event, recipient) {
  // Requesters use the normal portal even if they are also IT staff.
  const staff = recipient.uid !== event.ticket.requesterId && ['IT Admin', 'IT Technician', 'Management'].indexOf(recipient.role) !== -1;
  return HELP_DESK_URL + (staff ? STAFF_DIRECTORY : '') + '?ticket=' + encodeURIComponent(event.ticketId);
}

function mailBody_(event, recipient) {
  const ticket = event.ticket;
  return event.kind + '\n\nTicket #' + event.ticketId.slice(-7) + ': ' + ticket.subject
    + '\nRequester: ' + ticket.requester + '\nStatus: ' + ticket.status
    + '\nPriority: ' + (ticket.reviewedAt ? ticket.priority : 'Awaiting review')
    + '\nAssigned to: ' + (ticket.technician || 'Unassigned')
    + '\n\n' + event.text + (event.kind === 'Ticket deleted' ? '\n\nThe deleted ticket can no longer be opened.'
      : '\n\nOpen ticket and reply on the website:\n' + mailTicketLink_(event, recipient)
        + '\n\nSign in with your registered helpdesk account. Replies to this email are not added to the ticket.')
    + '\n\nMountain Torq IT Helpdesk';
}

function loadMailState_() {
  const id = PropertiesService.getScriptProperties().getProperty(MAIL_STATE_PROPERTY);
  if (!id) throw new Error('Run setupNotifications once from the Apps Script editor first.');
  const file = DriveApp.getFileById(id);
  const state = JSON.parse(file.getBlob().getDataAsString());
  if (state.version !== 1 || !state.tickets || !Array.isArray(state.queue)) throw new Error('Notification state is invalid. Keep the state file and contact IT Admin.');
  return { file: file, state: state };
}

function writeMailState_(file, state) { file.setContent(JSON.stringify(state)); }

// Editor-only setup; never exposed through doPost. Safe to run again without clearing history.
function setupNotifications() {
  checkMailSender_();
  const properties = PropertiesService.getScriptProperties();
  const profiles = ownerJson_(DATABASE_URL + '/users.json') || {};
  const tickets = ownerJson_(DATABASE_URL + '/tickets.json') || {};
  registeredEmails_(Object.keys(profiles)); // Validate Auth access before starting the timer.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!properties.getProperty(MAIL_STATE_PROPERTY)) {
      // Baseline old tickets so enabling notifications does not email all historical tickets.
      const file = DriveApp.createFile('Mountain-Torq-helpdesk-mail-state.json', JSON.stringify({ version: 1, tickets: mailSnapshot_(tickets), queue: [] }), 'application/json');
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      properties.setProperty(MAIL_STATE_PROPERTY, file.getId());
    } else { loadMailState_(); }
    if (!ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === 'pollTicketNotifications'; })) {
      ScriptApp.newTrigger('pollTicketNotifications').timeBased().everyMinutes(5).create();
    }
  } finally { lock.releaseLock(); }
  console.log('Notifications configured. Existing tickets were not emailed. Create a new test request on the website.');
}

// The website can wake this worker after saving. A 5-minute trigger is the fallback.
function pollTicketNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    if (properties.getProperty('HELPDESK_MAIL_PAUSED') === 'true') return;
    checkMailSender_();
    const lastPoll = Number(properties.getProperty('HELPDESK_LAST_MAIL_POLL') || 0);
    if (Date.now() - lastPoll < 15000) return; // Avoid public endpoint calls causing repeated scans.
    properties.setProperty('HELPDESK_LAST_MAIL_POLL', String(Date.now()));
    const saved = loadMailState_(), state = saved.state;
    const profiles = ownerJson_(DATABASE_URL + '/users.json') || {};
    const current = mailSnapshot_(ownerJson_(DATABASE_URL + '/tickets.json') || {});
    const events = mailChanges_(state.tickets, current);
    state.queue = state.queue.concat(events);
    state.tickets = current;
    writeMailState_(saved.file, state); // Persist events before trying to send.
    if (!state.queue.length) return;
    const ids = new Set(Object.keys(profiles));
    const emails = registeredEmails_(Array.from(ids));
    let remaining = Math.min(20, MailApp.getRemainingDailyQuota());
    const started = Date.now();
    while (state.queue.length && remaining > 0 && Date.now() - started < 45000) {
      const event = state.queue[0];
      const recipients = mailRecipients_(event, profiles, emails);
      // Do not deliver an old assignment's details to someone who has lost access.
      const live = current[event.ticketId];
      const authorized = recipients.filter(function(person) {
        return event.kind === 'Ticket deleted' || (live && (person.uid === live.requesterId || profiles[person.uid].role === 'IT Admin'
          || (person.uid === live.technicianId && live.reviewedAt > 0)));
      });
      let complete = true;
      for (let index = 0; index < authorized.length; index++) {
        const recipient = authorized[index];
        const address = recipient.email.toLowerCase();
        if (event.sent.indexOf(address) !== -1) continue;
        if (remaining <= 0) { complete = false; break; }
        GmailApp.sendEmail(recipient.email,
          '[Mountain Torq IT Helpdesk] ' + event.kind + ' #' + event.ticketId.slice(-7) + ' — ' + String(event.ticket.subject).replace(/[\r\n]/g, ' ').slice(0, 120),
          mailBody_(event, recipient), { from: MAIL_SENDER, name: 'MT Adly', replyTo: MAIL_SENDER });
        event.sent.push(address);
        remaining--;
        writeMailState_(saved.file, state);
      }
      if (!complete) break;
      state.queue.shift();
      writeMailState_(saved.file, state);
    }
  } finally { lock.releaseLock(); }
}

function stopNotifications() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'pollTicketNotifications') ScriptApp.deleteTrigger(trigger);
  });
  PropertiesService.getScriptProperties().setProperty('HELPDESK_MAIL_PAUSED', 'true');
}

function resumeNotifications() {
  PropertiesService.getScriptProperties().deleteProperty('HELPDESK_MAIL_PAUSED');
  setupNotifications();
}

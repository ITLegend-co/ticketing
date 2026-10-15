// Deploy as a Web app: Execute as Me; access Anyone.
// Keep the Drive folder's General access set to Restricted.
const DRIVE_FOLDER_ID = '1aeiNJpRVmMijmhR7iaCIOA7Qj5BQv7c4';
const FIREBASE_API_KEY = 'AIzaSyCYw7zgHU2kxjf027_3sbR-76ba66yH9RY';
const DATABASE_URL = 'https://ticketing-a8461-default-rtdb.asia-southeast1.firebasedatabase.app';
const MAX_PHOTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

function doGet() {
  return ContentService.createTextOutput('Mountain Torq IT Helpdesk attachment service is running.');
}

function doPost(event) {
  try {
    const text = event && event.postData && event.postData.contents;
    if (!text || text.length > Math.ceil(MAX_BYTES * 4 / 3) + 20000) throw new Error('Upload is too large.');
    const request = JSON.parse(text);
    if (request.action === 'welcome') return output_(sendWelcome_(request));
    const access = authorize_(request);
    if (request.action === 'notify') {
      if (!access.canUpload) throw new Error('You cannot send request notifications.');
      pollTicketNotifications();
      return output_({ ok: true });
    }
    if (request.action === 'list') return output_({ ok: true, files: list_(access.ticketId) });
    if (request.action === 'upload') return output_({ ok: true, file: upload_(request, access) });
    if (request.action === 'download') return output_({ ok: true, file: download_(request, access) });
    throw new Error('Unknown action.');
  } catch (error) {
    return output_({ ok: false, error: error instanceof Error ? error.message : 'Attachment request failed.' });
  }
}

function output_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function jsonRequest_(url, options) {
  const response = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options || {}));
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('Sign-in or request access could not be verified.');
  return JSON.parse(response.getContentText());
}

function authorize_(request) {
  if (typeof request.idToken !== 'string' || request.idToken.length > 10000) throw new Error('Sign in to access attachments.');
  if (typeof request.ticketId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(request.ticketId)) throw new Error('Invalid request.');
  // accounts:lookup validates the Firebase token with this project's API key.
  const identity = jsonRequest_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: request.idToken }),
  });
  const uid = identity.users && identity.users[0] && identity.users[0].localId;
  if (!uid) throw new Error('Sign in again to access attachments.');
  const token = request.idToken;
  const profile = jsonRequest_(DATABASE_URL + '/users/' + encodeURIComponent(uid) + '.json?auth=' + encodeURIComponent(token));
  if (!profile || profile.status !== 'Active') throw new Error('This account does not have active helpdesk access.');
  let ticket;
  if (profile.role === 'IT Admin' || profile.role === 'Management') {
    ticket = jsonRequest_(DATABASE_URL + '/tickets/' + request.ticketId + '.json?auth=' + encodeURIComponent(token));
  } else {
    const field = profile.role === 'IT Technician' ? 'technicianId' : 'requesterId';
    const records = jsonRequest_(DATABASE_URL + '/tickets.json?auth=' + encodeURIComponent(token)
      + '&orderBy=' + encodeURIComponent(JSON.stringify(field)) + '&equalTo=' + encodeURIComponent(JSON.stringify(uid)));
    ticket = records && records[request.ticketId];
    // IT people can also view their own requests in the normal request portal.
    if (!ticket && profile.role === 'IT Technician') {
      const own = jsonRequest_(DATABASE_URL + '/tickets.json?auth=' + encodeURIComponent(token)
        + '&orderBy=' + encodeURIComponent(JSON.stringify('requesterId')) + '&equalTo=' + encodeURIComponent(JSON.stringify(uid)));
      ticket = own && own[request.ticketId];
    }
  }
  const allowed = ticket && (profile.role === 'IT Admin' || profile.role === 'Management' || ticket.requesterId === uid
    || (profile.role === 'IT Technician' && ticket.technicianId === uid && ticket.reviewedAt > 0));
  if (!allowed) throw new Error('You do not have access to this request.');
  return { uid: uid, ticketId: request.ticketId, canUpload: profile.role === 'IT Admin' || ticket.requesterId === uid
    || (profile.role === 'IT Technician' && ticket.technicianId === uid && ticket.reviewedAt > 0) };
}

function ticketFolder_(ticketId, create) {
  const parent = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const matches = parent.getFoldersByName('request-' + ticketId);
  if (matches.hasNext()) return matches.next();
  return create ? parent.createFolder('request-' + ticketId) : null;
}

function fileInfo_(file) {
  return { id: file.getId(), name: file.getName(), mime: file.getMimeType(), size: file.getSize(), createdAt: file.getDateCreated().getTime() };
}

function list_(ticketId) {
  const folder = ticketFolder_(ticketId, false);
  if (!folder) return [];
  const files = folder.getFiles();
  const result = [];
  while (files.hasNext()) {
    const file = files.next();
    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(file.getMimeType()) !== -1) result.push(fileInfo_(file));
  }
  return result.sort(function(a, b) { return a.createdAt - b.createdAt; });
}

function detectedMime_(bytes) {
  const b = bytes.map(function(value) { return value & 255; });
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every(function(value, i) { return b[i] === value; })) return 'image/png';
  if (b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return 'image/webp';
  return '';
}

function upload_(request, access) {
  if (!access.canUpload) throw new Error('You cannot add attachments to this request.');
  if (typeof request.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.base64)) throw new Error('Invalid photo.');
  const bytes = Utilities.base64Decode(request.base64);
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Each photo must be 5 MB or smaller.');
  const mime = detectedMime_(bytes);
  if (!mime || mime !== request.mime) throw new Error('Choose a JPG, PNG, or WebP photo.');
  const name = String(request.name || 'Photo').replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (list_(access.ticketId).length >= MAX_PHOTOS) throw new Error('A request can have up to 5 photos.');
    const file = ticketFolder_(access.ticketId, true).createFile(Utilities.newBlob(bytes, mime, name));
    // No public sharing links are created; viewing also goes through authorization.
    return fileInfo_(file);
  } finally { lock.releaseLock(); }
}

function download_(request, access) {
  const folder = ticketFolder_(access.ticketId, false);
  if (!folder || typeof request.fileId !== 'string') throw new Error('Photo not found.');
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getId() !== request.fileId) continue;
    if (file.getSize() > MAX_BYTES) throw new Error('This photo is too large to view.');
    const bytes = file.getBlob().getBytes();
    const mime = detectedMime_(bytes);
    if (!mime) throw new Error('Unsupported photo format.');
    return Object.assign(fileInfo_(file), { mime: mime, base64: Utilities.base64Encode(bytes) });
  }
  throw new Error('Photo not found.');
}

// Admin-only welcome email. Recipient and login URL are resolved server-side.
// Do not log or persist request contents: they contain a temporary password.
function sendWelcome_(request) {
  if (typeof request.idToken !== 'string' || request.idToken.length > 10000
      || typeof request.userId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(request.userId)
      || typeof request.temporaryPassword !== 'string' || request.temporaryPassword.length < 8 || request.temporaryPassword.length > 4096) throw new Error('Invalid welcome email request.');
  const identity = jsonRequest_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: request.idToken }),
  });
  const uid = identity.users && identity.users[0] && identity.users[0].localId;
  if (!uid) throw new Error('Sign in again.');
  const suffix = '.json?auth=' + encodeURIComponent(request.idToken);
  const admin = jsonRequest_(DATABASE_URL + '/users/' + encodeURIComponent(uid) + suffix);
  if (!admin || admin.role !== 'IT Admin' || admin.status !== 'Active') throw new Error('Only an active IT Admin can send welcome emails.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const marker = 'WELCOME_SENT_' + request.userId;
    if (properties.getProperty(marker)) return { ok: true, alreadySent: true };
    const profile = jsonRequest_(DATABASE_URL + '/users/' + encodeURIComponent(request.userId) + suffix);
    if (!profile || profile.status !== 'Active' || profile.mustChangePassword !== true) throw new Error('This account is not awaiting its first password change.');
    const email = registeredEmails_([request.userId])[request.userId];
    if (!email || email.toLowerCase() !== String(profile.email).toLowerCase()) throw new Error('Account email could not be verified.');
    const staff = ['IT Admin', 'IT Technician', 'Management'].indexOf(profile.role) !== -1;
    const link = HELP_DESK_URL + (staff ? STAFF_DIRECTORY : '') + '?email=' + encodeURIComponent(email);
    checkMailSender_();
    GmailApp.sendEmail(email, 'Your Mountain Torq IT Helpdesk account',
      'Hello ' + profile.name + ',\n\nYour helpdesk account is ready.\n\nLogin: ' + link
      + '\nEmail: ' + email + '\nTemporary password: ' + request.temporaryPassword
      + '\n\nYou will be asked to choose a new password when you sign in. Do not share this password.\n\nMT Adly\nMountain Torq IT Helpdesk',
      { from: MAIL_SENDER, name: 'MT Adly', replyTo: MAIL_SENDER });
    properties.setProperty(marker, String(Date.now()));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

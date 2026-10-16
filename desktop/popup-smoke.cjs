const assert = require('node:assert/strict');
const { setTimeout: pause } = require('node:timers/promises');
module.exports = async function smoke(popups, log) {
  const notice = { ticketId: 'smoke-ticket', owner: 'smoke-user', title: 'New ticket reply', body: '<b>Sample ticket</b> · In Progress' };
  popups.push(notice);
  const window = popups.window;
  for (let i = 0; i < 100; i++) {
    if (!window.webContents.isLoading() && await window.webContents.executeJavaScript('!!document.querySelector(".open")')) break;
    await pause(50);
  }
  assert.equal(window.isAlwaysOnTop(), true);
  assert.equal(await window.webContents.executeJavaScript('document.querySelector("article p").textContent'), notice.body);
  assert.equal(await window.webContents.executeJavaScript('document.querySelector("article b") === null'), true);
  popups.push({ ...notice, body: 'Updated status' });
  await pause(100);
  assert.equal(await window.webContents.executeJavaScript('document.querySelectorAll("article").length'), 1);
  // A revoked assignment must remove its popup immediately.
  popups.sync('smoke-user', new Set());
  await pause(100);
  assert.equal(popups.window, null);
  popups.push(notice);
  const second = popups.window;
  for (let i = 0; i < 100; i++) {
    if (!second.webContents.isLoading() && await second.webContents.executeJavaScript('!!document.querySelector(".open")')) break;
    await pause(50);
  }
  await second.webContents.executeJavaScript('document.querySelector(".open").click()');
  await pause(100);
  assert.equal(popups.window, null);
  log('Popup: rendered safely, coalesced updates, removed revoked ticket, Open ticket handled');
};

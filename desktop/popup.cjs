const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
module.exports = function createPopups(openTicket) {
  let window, ready = false;
  const pending = new Map();
  function valid(event) {
    try { return window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame; }
    catch { return false; }
  }
  function publish() {
    if (!window || window.isDestroyed()) return;
    if (!pending.size) { window.close(); return; }
    if (ready) { window.webContents.send('mt-popup-data', [...pending.values()].reverse()); window.showInactive(); }
  }
  function ensureWindow() {
    if (window && !window.isDestroyed()) return;
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const width = Math.min(390, area.width - 24), height = Math.min(380, area.height - 24);
    window = new BrowserWindow({
      width, height, x: area.x + area.width - width - 12, y: area.y + area.height - height - 12,
      title: 'Helpdesk updates', icon: path.join(__dirname, 'icon.png'),
      show: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, maximizable: false,
      minimizable: false, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'popup-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    ready = false;
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.on('closed', () => { window = null; ready = false; pending.clear(); });
    window.webContents.once('did-finish-load', () => { ready = true; publish(); });
    window.loadFile(path.join(__dirname, 'popup.html')).catch(() => { if (window && !window.isDestroyed()) window.close(); });
  }
  ipcMain.on('mt-popup-action', (event, action, id) => {
    if (!valid(event) || !['open', 'dismiss'].includes(action) || !pending.has(id)) return;
    const notice = pending.get(id);
    pending.delete(id);
    publish();
    if (action === 'open') openTicket(notice.ticketId, notice.owner);
  });
  return {
    push(notice) { pending.delete(notice.ticketId); pending.set(notice.ticketId, notice); ensureWindow(); publish(); },
    sync(owner, allowed) { for (const [id, notice] of pending) if (notice.owner !== owner || !allowed.has(id)) pending.delete(id); publish(); },
    clear() { pending.clear(); publish(); },
    get window() { return window; },
  };
};

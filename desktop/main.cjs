const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const smoke = process.argv.includes('--smoke-test');
function diagnostic(message) {
  if (smoke && process.env.MT_SMOKE_LOG) fs.appendFileSync(process.env.MT_SMOKE_LOG, String(message) + '\n');
}
if (smoke) {
  diagnostic('Main process started');
  process.on('uncaughtException', error => { diagnostic(error.stack); app.exit(5); });
  process.on('unhandledRejection', error => { diagnostic(error?.stack || error); app.exit(6); });
  setTimeout(() => { diagnostic('Startup timeout'); app.exit(2); }, 60000);
}
const HOME = 'https://itlegend-co.github.io/ticketing/askjaslhrui3893478rehfsj38uhef/';
const APP_ID = 'com.mountaintorq.ithelpdesk';
let win, tray, quitting = false, allowed = new Set(), account = '', retryTimer;
const popups = require('./popup.cjs')((id, owner) => {
  if (!quitting && account === owner && allowed.has(id) && win && !win.isDestroyed()) {
    show(); win.webContents.send('mt-ticket', id);
  }
});
function trusted(url) {
  try { const u = new URL(url); return u.origin === 'https://itlegend-co.github.io' && u.pathname.startsWith('/ticketing/'); } catch { return false; }
}
function senderOK(event) {
  if (quitting || !win || win.isDestroyed() || event.sender.isDestroyed()) return false;
  try {
    const frame = event.senderFrame;
    return event.sender === win.webContents && frame && frame === win.webContents.mainFrame && trusted(frame.url);
  } catch { return false; } // A renderer frame can disappear while a queued message is delivered.
}
function clearNotices() { popups.clear(); }
function show() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function load() { if (win && !win.isDestroyed()) win.loadURL(HOME).catch(() => {}); }
function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open helpdesk', click: show },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin,
      click: item => { app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }); trayMenu(); } },
    { label: 'Reload / reconnect', click: load },
    { type: 'separator' },
    { label: 'Quit (stop notifications)', click: () => app.quit() },
  ]));
}
app.setAppUserModelId(APP_ID);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', show);
  app.on('before-quit', () => { quitting = true; clearTimeout(retryTimer); clearNotices(); });
  app.on('window-all-closed', () => {});
  app.whenReady().then(() => {
    diagnostic('Electron ready');
    const icon = path.join(__dirname, 'icon.png');
    win = new BrowserWindow({ width: 1280, height: 850, minWidth: 700, minHeight: 540, title: 'Mountain Torq IT Helpdesk', icon,
      show: !process.argv.includes('--hidden'), autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, webSecurity: true } });
    diagnostic('Window created');
    win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (trusted(url)) win.loadURL(url).catch(() => {});
      else { try { const u = new URL(url); if (u.protocol === 'https:') shell.openExternal(url).catch(() => {}); } catch {} }
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    win.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) { account = ''; allowed.clear(); clearNotices(); } });
    win.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
      if (!mainFrame || code === -3 || quitting) return;
      win.loadFile(path.join(__dirname, 'offline.html')).catch(() => {});
      clearTimeout(retryTimer); retryTimer = setTimeout(load, 15000);
    });
    win.webContents.on('render-process-gone', () => { if (!quitting) { clearNotices(); retryTimer = setTimeout(load, 3000); } });
    diagnostic('Creating tray');
    tray = new Tray(nativeImage.createFromPath(icon)); tray.setToolTip('Mountain Torq IT Helpdesk — running'); tray.on('double-click', show); trayMenu();
    ipcMain.on('mt-access', (event, data) => {
      if (smoke) return; // The launch check owns a synthetic account; no live authentication fixture.
      if (!senderOK(event) || !data || typeof data.uid !== 'string' || !Array.isArray(data.ticketIds) || data.ticketIds.length > 20000) return;
      if (account !== data.uid) clearNotices();
      account = data.uid; allowed = new Set(data.ticketIds.filter(id => typeof id === 'string' && /^[\w-]{1,120}$/.test(id)));
      popups.sync(account, allowed);
    });
    ipcMain.on('mt-notify', (event, notice) => {
      if (!senderOK(event) || !account || !notice || !allowed.has(notice.ticketId)) return;
      if (typeof notice.title !== 'string' || typeof notice.body !== 'string') return;
      popups.push({ ticketId: notice.ticketId, owner: account, title: notice.title.slice(0,100), body: notice.body.slice(0,500) });
    });
    if (smoke) {
      const timeout = setTimeout(() => app.exit(2), 60000);
      win.webContents.on('did-finish-load', async () => {
        diagnostic('Loaded ' + win.webContents.getURL());
        if (!trusted(win.webContents.getURL())) return;
        try {
          const ok = await win.webContents.executeJavaScript('typeof window.mtDesktop?.notify === "function" && !!document.querySelector("#root")');
          diagnostic('Bridge check: ' + ok);
          if (!ok) { app.exit(3); return; }
          await win.webContents.executeJavaScript('window.mtDesktop.onTicket(id => { window.__smokeTicket = id; }); true');
          account = 'smoke-user'; allowed = new Set(['smoke-ticket']);
          await require('./popup-smoke.cjs')(popups, diagnostic);
          const opened = await win.webContents.executeJavaScript('window.__smokeTicket === "smoke-ticket"');
          if (!opened) throw new Error('Popup did not open its ticket');
          diagnostic('Open ticket routed to helpdesk');
          clearTimeout(timeout); app.exit(0);
        } catch (error) { diagnostic(error.stack); clearTimeout(timeout); app.exit(4); }
      });
    }
    diagnostic('Loading helpdesk');
    load();
  });
}

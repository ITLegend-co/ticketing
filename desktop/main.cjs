const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, nativeImage } = require('electron');
const path = require('node:path');
const HOME = 'https://itlegend-co.github.io/ticketing/askjaslhrui3893478rehfsj38uhef/';
const APP_ID = 'com.mountaintorq.ithelpdesk';
let win, tray, quitting = false, allowed = new Set(), account = '', retryTimer;
const notices = new Map();
function trusted(url) {
  try { const u = new URL(url); return u.origin === 'https://itlegend-co.github.io' && u.pathname.startsWith('/ticketing/'); } catch { return false; }
}
function senderOK(event) { return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && trusted(event.senderFrame.url); }
function clearNotices() { for (const n of notices.values()) n.close(); notices.clear(); }
function show() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function load() { if (win && !win.isDestroyed()) win.loadURL(HOME).catch(() => {}); }
function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open helpdesk', click: show },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
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
    const icon = path.join(__dirname, 'icon.png');
    win = new BrowserWindow({ width: 1280, height: 850, minWidth: 700, minHeight: 540, title: 'Mountain Torq IT Helpdesk', icon,
      show: !process.argv.includes('--hidden'), autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, webSecurity: true } });
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
    tray = new Tray(nativeImage.createFromPath(icon)); tray.setToolTip('Mountain Torq IT Helpdesk — running'); tray.on('double-click', show); trayMenu();
    ipcMain.on('mt-access', (event, data) => {
      if (!senderOK(event) || !data || typeof data.uid !== 'string' || !Array.isArray(data.ticketIds) || data.ticketIds.length > 20000) return;
      if (account !== data.uid) clearNotices();
      account = data.uid; allowed = new Set(data.ticketIds.filter(id => typeof id === 'string' && /^[\w-]{1,120}$/.test(id)));
      for (const [id, notice] of notices) if (!allowed.has(id)) { notice.close(); notices.delete(id); }
    });
    ipcMain.on('mt-notify', (event, notice) => {
      if (!senderOK(event) || !account || !notice || !allowed.has(notice.ticketId) || !Notification.isSupported()) return;
      if (typeof notice.title !== 'string' || typeof notice.body !== 'string') return;
      const id = notice.ticketId, owner = account;
      notices.get(id)?.close();
      const n = new Notification({ title: notice.title.slice(0,100), body: notice.body.slice(0,250), icon });
      notices.set(id, n);
      n.on('click', () => { if (account === owner && allowed.has(id)) { show(); win.webContents.send('mt-ticket', id); } });
      n.on('close', () => { if (notices.get(id) === n) notices.delete(id); });
      n.show();
    });
    load();
  });
}

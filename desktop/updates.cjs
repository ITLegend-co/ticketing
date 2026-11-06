// electron-updater verifies release metadata/checksums and caches interrupted downloads.
function createUpdater({app, dialog, engine = require('electron-updater').autoUpdater, changed = () => {}}) {
  let stopped = false, checking = false, downloading = false, ready = false, version = '', prompted = '';
  engine.autoDownload = true;
  engine.autoInstallOnAppQuit = true;
  engine.autoRunAppAfterInstall = true;
  engine.allowPrerelease = false;
  engine.allowDowngrade = false;
  engine.disableWebInstaller = true;
  const handlers = {
    'update-available': info => { downloading = true; version = info.version; changed(); },
    'download-progress': () => { downloading = true; },
    'error': () => { downloading = false; changed(); },
    'update-downloaded': info => {
      downloading = false; ready = true; version = info.version; changed();
      if (stopped || prompted === version) return;
      prompted = version;
      void offerRestart().catch(() => {});
    }
  };
  Object.entries(handlers).forEach(([event, handler]) => engine.on(event, handler));
  function install() { if (!stopped && ready) engine.quitAndInstall(true, true); }
  async function offerRestart() {
    const result = await dialog.showMessageBox({type:'info',title:'Update ready',
      message:'Helpdesk ' + version + ' is ready to install.',
      detail:'Save any unfinished work before restarting. Choose Later to keep working; the update will install when you quit Helpdesk from the tray. Closing the window keeps Helpdesk running.',
      buttons:['Restart and update','Later'],defaultId:1,cancelId:1,noLink:true});
    if (result.response === 0) install();
  }
  async function check(manual = false) {
    if (stopped || checking) return;
    if (ready) { if (manual) await offerRestart(); return; }
    if (downloading) {
      if (manual) await dialog.showMessageBox({type:'info',title:'Software updates',message:'The update is downloading in the background. You can keep working.'});
      return;
    }
    checking = true;
    try {
      const result = await engine.checkForUpdates();
      // The updater emits update-available before returning its download promise.
      if (result?.downloadPromise) void result.downloadPromise.catch(() => {});
      if (manual && !downloading && !ready && !stopped) await dialog.showMessageBox({type:'info',title:'Software updates',message:'You are using the latest available Windows version.'});
    } catch {
      if (manual && !stopped) await dialog.showMessageBox({type:'warning',title:'Software updates',message:'Could not check or download the update. Check your connection and try again.'});
    } finally { checking = false; }
  }
  const initial = setTimeout(() => check(), 15000);
  const interval = setInterval(() => check(), 6 * 60 * 60 * 1000);
  initial.unref?.(); interval.unref?.();
  return {check,install,get ready(){return ready;},stop(){stopped=true;clearTimeout(initial);clearInterval(interval);}};
}
module.exports = {createUpdater};

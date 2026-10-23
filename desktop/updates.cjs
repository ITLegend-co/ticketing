const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

function releaseUpdate(release, current) {
  if (!release || release.draft || release.prerelease) return null;
  const match = /^desktop-v(\d+)\.(\d+)\.(\d+)$/.exec(release.tag_name || '');
  const installed = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match || !installed) return null;
  const next = match.slice(1).map(Number), old = installed.slice(1).map(Number);
  if (![...next, ...old].every(Number.isSafeInteger)) return null;
  let newer = false;
  for (let i = 0; i < 3; i++) {
    if (next[i] !== old[i]) { newer = next[i] > old[i]; break; }
  }
  if (!newer) return null;
  const version = next.join('.');
  // Construct our own URL; never open a URL supplied in release metadata.
  const filename = 'Mountain-Torq-IT-Helpdesk-Setup-' + version + '.exe';
  if (!Array.isArray(release.assets) || !release.assets.some(a => a.name === filename && a.size > 1000000)) return null;
  return { version, url: 'https://github.com/ITLegend-co/ticketing/releases/tag/desktop-v' + version };
}
function fetchRelease() {
  return new Promise((resolve, reject) => {
    const request = https.get('https://api.github.com/repos/ITLegend-co/ticketing/releases/latest',
      {headers: {'User-Agent':'Mountain-Torq-Helpdesk', Accept:'application/vnd.github+json'}}, response => {
        if (response.statusCode !== 200) { response.resume(); reject(new Error('Release check unavailable')); return; }
        let bytes = 0, chunks = [];
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) { request.destroy(new Error('Release response too large')); return; }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); } });
      });
    const deadline = setTimeout(() => request.destroy(new Error('Release check timed out')), 15000);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', reject);
  });
}
function createUpdater({app, dialog, shell, fetchLatest = fetchRelease, now = Date.now}) {
  const statePath = path.join(app.getPath('userData'), 'update-notice.json');
  let busy = false, stopped = false, state = {};
  try { state = JSON.parse(fs.readFileSync(statePath,'utf8')) || {}; } catch {}
  async function check(manual = false) {
    if (busy || stopped) return;
    busy = true;
    try {
      const update = releaseUpdate(await fetchLatest(), app.getVersion());
      if (stopped) return;
      if (!update) {
        if (manual) await dialog.showMessageBox({type:'info',title:'Software updates',message:'You are using the latest available Windows version.'});
        return;
      }
      if (!manual && state.version === update.version && Number.isFinite(state.at) && now() - state.at < 86400000 && now() >= state.at) return;
      state = {version:update.version,at:now()};
      try { fs.writeFileSync(statePath,JSON.stringify(state)); } catch {}
      const result = await dialog.showMessageBox({
        type:'info',title:'Helpdesk update available',
        message:'Mountain Torq IT Helpdesk ' + update.version + ' is available.',
        detail:'Installed version: ' + app.getVersion() + '\nDownload the new installer, quit the helpdesk from the tray, then install it. For monitoring fixes, also use Repair / update monitoring after installation.',
        buttons:['Download update','Remind me later'],defaultId:0,cancelId:1,noLink:true
      });
      if (!stopped && result.response === 0) await shell.openExternal(update.url);
    } catch {
      if (manual && !stopped) await dialog.showMessageBox({type:'warning',title:'Software updates',message:'Could not check for updates. Check your internet connection and try again.'});
    } finally {busy = false;}
  }
  const initial = setTimeout(() => check(), 15000);
  const interval = setInterval(() => check(), 6 * 60 * 60 * 1000);
  initial.unref?.(); interval.unref?.();
  return {check,stop() {stopped=true;clearTimeout(initial);clearInterval(interval);}};
}
module.exports = {releaseUpdate,createUpdater};

const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { promisify } = require('node:util');
const run = promisify(execFile);
async function check({ app, dialog, execute = run, platform = process.platform, launch = require('./monitoring-launch.cjs') }) {
  if (platform !== 'win32') return;
  const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const versionFile = path.join(app.isPackaged ? process.resourcesPath : __dirname, 'monitoring', 'Version.ps1');
  const wanted = fs.readFileSync(versionFile, 'utf8').match(/\$CollectorVersion='(\d+)'/)[1];
  let installed = '';
  try { const result = await execute(path.join(system, 'reg.exe'), ['query', 'HKLM\\SOFTWARE\\MountainTorq\\Monitoring', '/v', 'Version', '/reg:64'], { windowsHide:true }); installed = result.stdout.match(/Version\s+REG_SZ\s+(\d+)/)?.[1] || ''; } catch {}
  if (Number(installed) >= Number(wanted)) return;
  // Older installations predate the version marker. Never enroll a new device automatically.
  let exists = !!installed;
  if (!exists) {
    try { exists = fs.statSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'MountainTorqMonitoring')).isDirectory(); }
    catch (error) { exists = error.code === 'EACCES' || error.code === 'EPERM'; }
  }
  if (!exists) {
    try { await execute(path.join(system, 'schtasks.exe'), ['/Query', '/TN', 'Mountain Torq Device Monitoring'], { windowsHide:true }); exists = true; } catch {}
  }
  if (!exists) return;
  const answer = await dialog.showMessageBox({ type:'info', title:'Device monitoring update',
    message:'The background monitoring collector needs an update.',
    detail:'Update the installed collector while keeping this computer’s enrollment. Windows will request administrator permission. If postponed, use Repair / update monitoring from the tray menu.',
    buttons:['Update monitoring','Later'], defaultId:0, cancelId:1 });
  if (answer.response === 0) launch(false, false, true);
}
module.exports = { check };

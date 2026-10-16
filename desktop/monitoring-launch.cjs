const { app, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
module.exports = function launch(remove = false) {
  if (process.platform !== 'win32') return;
  const script = path.join(app.isPackaged ? process.resourcesPath : __dirname, 'monitoring', 'Setup.ps1');
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  const argument = '-NoProfile -ExecutionPolicy Bypass -File "' + script + '"' + (remove ? ' -Remove' : '');
  const command = "try { Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList " + quote(argument) + " } catch { exit 1 }";
  const child = spawn(path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),
    ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')], {windowsHide:true,stdio:'ignore'});
  child.on('error', () => dialog.showErrorBox('Monitoring setup','Could not start Windows monitoring setup.'));
  child.on('exit', code => {if(code) dialog.showErrorBox('Monitoring setup','Setup was cancelled or could not start. Windows administrator permission is required.');});
};

const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mtPopup', {
  onData(callback) {
    const listener = (_event, notices) => callback(notices);
    ipcRenderer.on('mt-popup-data', listener);
  },
  open: id => ipcRenderer.send('mt-popup-action', 'open', id),
  dismiss: id => ipcRenderer.send('mt-popup-action', 'dismiss', id),
});

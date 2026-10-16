const { contextBridge, ipcRenderer } = require('electron');
if (location.origin === 'https://itlegend-co.github.io' && location.pathname.startsWith('/ticketing/')) {
  contextBridge.exposeInMainWorld('mtDesktop', {
    syncAccess: (uid, ticketIds) => ipcRenderer.send('mt-access', { uid, ticketIds }),
    notify: notice => ipcRenderer.send('mt-notify', notice),
    onTicket: callback => {
      const listener = (_event, id) => callback(id);
      ipcRenderer.on('mt-ticket', listener);
      return () => ipcRenderer.removeListener('mt-ticket', listener);
    },
  });
}

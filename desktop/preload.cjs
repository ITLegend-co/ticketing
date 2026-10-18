const { contextBridge, ipcRenderer } = require('electron');
if (location.origin === 'https://itlegend-co.github.io' && location.pathname.startsWith('/ticketing/')) {
  contextBridge.exposeInMainWorld('mtReminders', {
    bind: uid => ipcRenderer.send('mt-reminder-bind', uid),
    sync: (uid, schedule) => ipcRenderer.send('mt-reminder-sync', {uid, schedule}),
    pending: uid => ipcRenderer.invoke('mt-reminder-pending', uid),
    delivered: (uid, dates) => ipcRenderer.send('mt-reminder-delivered', {uid, dates}),
  });
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

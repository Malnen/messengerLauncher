const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("messengerIPC", {
    sendUnread: (count) => ipcRenderer.send("messenger-unread", count)
});
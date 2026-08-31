const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectPdf: () => ipcRenderer.invoke('select-pdf'),
  extractPrices: (pdfPath) => ipcRenderer.invoke('extract-prices', pdfPath),
  extractFromUrl: (pdfUrl) => ipcRenderer.invoke('extract-from-url', pdfUrl)
});

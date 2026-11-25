// Sandboxed preload: only uses ipcRenderer (allowed even when fs is not).
// Main process sends the full injection script as soon as this is ready.
const { ipcRenderer, webFrame } = require('electron');

ipcRenderer.on('lh-inject', function (event, script) {
  webFrame.executeJavaScript(script).then(function () {
    console.log('[LH preload] early injection done');
  }).catch(function (err) {
    console.error('[LH preload] injection failed', err);
  });
});

ipcRenderer.send('lh-preload-ready');

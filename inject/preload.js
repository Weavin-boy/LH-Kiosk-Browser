// Preload: inject addon overlay as early as possible
const { webFrame, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log('[LH preload]', msg);
}

try {
  const arg = process.argv.find(a => a.startsWith('--lh-payload='));
  if (!arg) {
    log('no --lh-payload argument');
  } else {
    const file = arg.slice('--lh-payload='.length);
    log('reading payload from ' + file);
    const raw = fs.readFileSync(file, 'utf8');
    const payload = JSON.parse(raw);
    log('payload has ' + (payload.addons || []).length + ' addons');

    const injectDir = __dirname;
    const runtimeCore = fs.readFileSync(path.join(injectDir, 'runtime-core.js'), 'utf8');
    const loader = fs.readFileSync(path.join(injectDir, 'loader.js'), 'utf8');

    const script =
      'window.__LH_PAYLOAD = ' + JSON.stringify(payload) + ';\n' +
      runtimeCore + '\n' +
      loader;

    webFrame.executeJavaScript(script)
      .then(() => log('injection completed'))
      .catch(err => console.error('[LH preload] injection failed', err));
  }
} catch (e) {
  console.error('[LH preload] error', e);
}

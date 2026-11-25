// Preload: inject addon overlay as early as possible (document start equivalent)
const { webFrame } = require('electron');
const fs = require('fs');
const path = require('path');

try {
  const payloadPath = process.argv.find(a => a.startsWith('--lh-payload='));
  if (!payloadPath) {
    console.log('[LH preload] no payload');
  } else {
    const file = payloadPath.slice('--lh-payload='.length);
    const raw = fs.readFileSync(file, 'utf8');
    const payload = JSON.parse(raw);

    const injectDir = path.join(__dirname);
    const runtimeCore = fs.readFileSync(path.join(injectDir, 'runtime-core.js'), 'utf8');
    const loader = fs.readFileSync(path.join(injectDir, 'loader.js'), 'utf8');

    // Set payload then run the scripts in the page context
    webFrame.executeJavaScript(
      'window.__LH_PAYLOAD = ' + JSON.stringify(payload) + ';\n' +
      runtimeCore + '\n' +
      loader
    ).then(() => {
      console.log('[LH preload] injection done, addons:', (payload.addons || []).length);
    }).catch(err => {
      console.error('[LH preload] injection failed', err);
    });
  }
} catch (e) {
  console.error('[LH preload] error', e);
}

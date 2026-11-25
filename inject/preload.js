// Early injection preload (sandbox/contextIsolation disabled in testing builds)
const { webFrame } = require('electron');
const fs = require('fs');
const path = require('path');

try {
  const arg = process.argv.find(function (a) { return a.indexOf('--lh-payload=') === 0; });
  if (!arg) {
    console.log('[LH preload] no payload arg');
  } else {
    const file = arg.slice('--lh-payload='.length);
    console.log('[LH preload] reading', file);
    const raw = fs.readFileSync(file, 'utf8');
    const payload = JSON.parse(raw);

    const injectDir = __dirname;
    const runtimeCore = fs.readFileSync(path.join(injectDir, 'runtime-core.js'), 'utf8');
    const loader = fs.readFileSync(path.join(injectDir, 'loader.js'), 'utf8');

    const script = 'window.__LH_PAYLOAD = ' + JSON.stringify(payload) + ';\n' + runtimeCore + '\n' + loader;

    webFrame.executeJavaScript(script).then(function () {
      console.log('[LH preload] early injection done');
    }).catch(function (err) {
      console.error('[LH preload] injection failed', err);
    });
  }
} catch (e) {
  console.error('[LH preload] error', e);
}

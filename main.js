const { app, BrowserWindow, Notification, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

if (app.isPackaged) {
  const portableDir = path.dirname(process.execPath);
  const dataDir = path.join(portableDir, 'data');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    app.setPath('userData', dataDir);
    app.setPath('sessionData', path.join(dataDir, 'session'));
    app.setPath('logs', path.join(dataDir, 'logs'));
    app.setPath('crashDumps', path.join(dataDir, 'crashDumps'));
  } catch (e) {
    console.error('Could not set portable data paths:', e);
  }
}

let mainWindow;
let lockedUrl = 'https://lasthavens.com/play';
let windowTitle = 'Lasthavens';
let allowExternalNavigation = false;
let addonsDir;
let injectionScript = null;

function getAddonsDir() {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), 'addons');
  }
  return path.join(__dirname, 'addons');
}

function ensureAddonsDir() {
  addonsDir = getAddonsDir();
  if (!fs.existsSync(addonsDir)) {
    fs.mkdirSync(addonsDir, { recursive: true });
  }
  return addonsDir;
}

function scanAddons() {
  const dir = ensureAddonsDir();
  const addons = [];
  if (!fs.existsSync(dir)) return addons;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = entry.name;
    const folderPath = path.join(dir, folder);
    const tocPath = path.join(folderPath, folder + '.toc');
    if (!fs.existsSync(tocPath)) continue;

    const files = {};
    function walk(current, relative = '') {
      const items = fs.readdirSync(current, { withFileTypes: true });
      for (const item of items) {
        const rel = relative ? relative + '/' + item.name : item.name;
        const full = path.join(current, item.name);
        if (item.isDirectory()) {
          walk(full, rel);
        } else {
          const buf = fs.readFileSync(full);
          files[rel] = buf.toString('base64');
        }
      }
    }
    walk(folderPath);

    addons.push({ folder, files });
  }
  console.log(`Found ${addons.length} local addon(s) in ${dir}`);
  return addons;
}

function buildInjectionScript(addons) {
  if (!addons.length) return null;
  const injectDir = path.join(__dirname, 'inject');
  const runtimeCore = fs.readFileSync(path.join(injectDir, 'runtime-core.js'), 'utf8');
  const loader = fs.readFileSync(path.join(injectDir, 'loader.js'), 'utf8');
  return 'window.__LH_PAYLOAD = ' + JSON.stringify({ addons }) + ';\n' + runtimeCore + '\n' + loader;
}

function isValidHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getRootDomain(hostname) {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const multiPartTlds = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
    'com.au', 'net.au', 'org.au',
    'co.jp', 'ne.jp', 'or.jp',
    'com.br', 'net.br', 'org.br',
    'co.nz', 'org.nz',
    'com.mx', 'org.mx',
    'co.za', 'org.za',
    'com.ar', 'org.ar',
    'co.in', 'net.in',
  ]);

  const lastTwo = parts.slice(-2).join('.');
  if (multiPartTlds.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function isAllowedUrl(url) {
  if (allowExternalNavigation) return true;
  try {
    const target = new URL(url);
    const locked = new URL(lockedUrl);
    if (target.protocol !== 'https:') return false;
    return getRootDomain(target.hostname) === getRootDomain(locked.hostname);
  } catch {
    return false;
  }
}

function loadConfig() {
  try {
    let configPath;
    if (app.isPackaged) {
      configPath = path.join(path.dirname(process.execPath), 'config.json');
    } else {
      configPath = path.join(__dirname, 'config.json');
    }

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const candidate = config.url || lockedUrl;
      if (isValidHttpsUrl(candidate)) {
        lockedUrl = candidate;
      } else {
        console.error('config.json url must be a valid https:// URL, using default');
      }
      windowTitle = config.title || windowTitle;
      allowExternalNavigation = config.allowExternalNavigation === true;
      console.log('Loaded config from', configPath, { lockedUrl, windowTitle, allowExternalNavigation });
    } else {
      console.log('No config.json found at', configPath, '- using defaults');
    }
  } catch (err) {
    console.error('Failed to load config.json, using defaults:', err.message);
  }
}

function downloadFavicon(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return resolve(null);
      }
    } catch {
      return resolve(null);
    }

    const req = https.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      let size = 0;
      const maxBytes = 1024 * 1024;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          return resolve(null);
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          const img = nativeImage.createFromBuffer(Buffer.concat(chunks));
          resolve(img.isEmpty() ? null : img);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function takeScreenshot() {
  if (!mainWindow) return;
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();

    await new Promise((r) => setTimeout(r, 150));

    const image = await mainWindow.webContents.capturePage();
    if (image.isEmpty()) {
      throw new Error('Captured image is empty');
    }

    let screenshotsDir;
    if (app.isPackaged) {
      screenshotsDir = path.join(path.dirname(process.execPath), 'screenshots');
    } else {
      screenshotsDir = path.join(__dirname, 'screenshots');
    }
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filePath = path.join(screenshotsDir, filename);

    fs.writeFileSync(filePath, image.toPNG());
    console.log('Screenshot saved to', filePath);

    if (Notification.isSupported()) {
      new Notification({
        title: 'Screenshot saved',
        body: `Saved to:\n${filePath}`,
      }).show();
    }
  } catch (err) {
    console.error('Screenshot failed:', err);
    if (Notification.isSupported()) {
      new Notification({
        title: 'Screenshot failed',
        body: err.message || String(err),
      }).show();
    }
  }
}

function injectAddons(webContents) {
  if (!injectionScript) return;
  webContents.executeJavaScript(injectionScript).then(() => {
    console.log('[LH] addon injection executed');
  }).catch(err => {
    console.error('[LH] addon injection failed:', err);
  });
}

function createWindow() {
  const addons = scanAddons();
  injectionScript = buildInjectionScript(addons);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: windowTitle,
    autoHideMenuBar: true,
    menuBarVisible: false,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: true,
      enableBlinkFeatures: 'Gamepad',
    },
  });

  mainWindow.setMenu(null);

  // Open DevTools automatically (testing)
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.on('did-start-loading', () => {
    injectAddons(mainWindow.webContents);
  });

  mainWindow.webContents.on('dom-ready', () => {
    injectAddons(mainWindow.webContents);
  });

  mainWindow.loadURL(lockedUrl);

  mainWindow.webContents.on('page-favicon-updated', async (event, favicons) => {
    if (favicons && favicons.length > 0) {
      const icon = await downloadFavicon(favicons[0]);
      if (icon) {
        mainWindow.setIcon(icon);
        console.log('Set window icon from favicon');
      }
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      console.log('Blocked navigation to:', url);
    }
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('will-frame-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const { key, control, alt, meta, shift } = input;

    if ((control || meta) && shift && key.toLowerCase() === 'i') {
      event.preventDefault();
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    }

    if (key === 'F11') {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
      return;
    }

    if (key === 'F12') {
      event.preventDefault();
      takeScreenshot();
      return;
    }

    if (key === 'F1' || key === 'F3') {
      return;
    }

    if (control || meta || alt || shift) {
      return;
    }

    const blocked =
      key === 'F5' ||
      key === 'F6' ||
      key === 'F7' ||
      key === 'F8' ||
      key === 'F9' ||
      key === 'F10';

    if (blocked) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        if (window.__lockedBrowserGamepad) return;
        window.__lockedBrowserGamepad = true;

        let lastButtons = [];
        function pollGamepad() {
          const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
          for (const gp of gamepads) {
            if (!gp) continue;
            const buttons = gp.buttons.map(b => b.pressed);
            if (buttons[0] && !lastButtons[0]) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', keyCode: 123, bubbles: true }));
            }
            if ((buttons[1] || buttons[9]) && !(lastButtons[1] || lastButtons[9])) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', keyCode: 122, bubbles: true }));
            }
            lastButtons = buttons;
          }
          requestAnimationFrame(pollGamepad);
        }
        window.addEventListener('gamepadconnected', () => console.log('Gamepad connected'));
        pollGamepad();

        let rightButtonDown = false;

        document.addEventListener('mousedown', (e) => {
          if (e.button === 2) {
            rightButtonDown = true;
            e.preventDefault();
            const target = (e.target && e.target.requestPointerLock) ? e.target : document.body;
            if (target && target.requestPointerLock) {
              target.requestPointerLock().catch(() => {
                document.body.requestPointerLock().catch(() => {});
              });
            }
          }
        }, true);

        document.addEventListener('mouseup', (e) => {
          if (e.button === 2 && rightButtonDown) {
            rightButtonDown = false;
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
          }
        }, true);

        document.addEventListener('contextmenu', (e) => {
          e.preventDefault();
        }, true);

        window.addEventListener('blur', () => {
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          rightButtonDown = false;
        });
      })();
    `).catch(err => console.error('Failed to inject scripts:', err));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  loadConfig();
  ensureAddonsDir();

  const allowedPermissions = new Set([
    'clipboard-read',
    'clipboard-sanitized-write',
    'pointerLock',
    'keyboardLock',
  ]);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details && details.requestingUrl;
    const ok = allowedPermissions.has(permission) && isAllowedUrl(requestingUrl);
    callback(ok);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return allowedPermissions.has(permission) && isAllowedUrl(requestingOrigin);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

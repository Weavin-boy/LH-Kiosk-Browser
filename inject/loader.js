// Injected after runtime-core.js. Expects window.__LH_PAYLOAD = { addons: [{ folder, files: { relPath: base64 } }] }
(function () {
  if (window.__lhAddonsInjected) return;
  window.__lhAddonsInjected = true;

  const payload = window.__LH_PAYLOAD || { addons: [] };
  if (!payload.addons.length) return;

  const install = globalThis.LHInstallOverlay;
  const NativeWorker = Worker;

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  const files = {};
  const folders = payload.addons.map(function (a) { return a.folder; });

  for (const a of payload.addons) {
    for (const [rel, b64] of Object.entries(a.files)) {
      const bytes = base64ToBytes(b64);
      const virtual = "Interface/AddOns/" + a.folder + "/" + rel;
      files[virtual] = {
        size: bytes.length,
        url: URL.createObjectURL(new Blob([bytes])),
      };
    }
  }

  // Worker patch (same pattern as the Chrome extension)
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      if (!options || options.name !== "em-pthread") {
        super(url, options);
        return;
      }
      const original = new URL(String(url), location.href).href;
      const source =
        "const queue=[];function boot(e){if(!e.data||!e.data.__lhBoot){queue.push(e);return}" +
        "removeEventListener('message',boot);(" + install.toString() + ")(e.data.files," +
        JSON.stringify(original) + ");importScripts(" + JSON.stringify(original) +
        ");for(const event of queue)dispatchEvent(new MessageEvent('message',{data:event.data}));}" +
        "addEventListener('message',boot);";

      super(URL.createObjectURL(new Blob([source], { type: "application/javascript" })), options);
      this.postMessage({ __lhBoot: true, files: files, spans: [] });
    }
  };

  install(files, location.href);
  console.log("[LH] Local addons prepared:", folders);
})();

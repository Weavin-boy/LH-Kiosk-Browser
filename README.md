# LH-Kiosk-Browser

A simple kiosk-style browser locked to Lasthavens.

It shows only the title bar and stays on Lasthavens (or the same domain, including subdomains).

**I have no association with Lasthavens.** This is an independent community project.

Forked/adapted from [simple-kiosk-browser](https://github.com/Weavin-boy/simple-kiosk-browser).

## Local Addons

The app supports local WoW 3.3.5a addons. The injection code is based on the [Lasthavens Addon Manager](https://github.com/Jamba777/lasthavens-addon-manager) Chrome extension by Jamba777. Credit to them for the overlay technique.

### How to add addons
1. Unzip the app.
2. Open the `addons` folder next to the executable (it is created for you).
3. Put each addon in its own folder. The folder must contain a matching `.toc` file.
   - Example: `addons/GTFO/GTFO.toc` (and the rest of the addon files)
   - Example: `addons/_NPCScan/_NPCScan.toc`
4. Restart the app. The addons are loaded automatically.

See `addons/README.txt` for a short reminder.

## What it does
- No address bar, tabs, or extra buttons
- Starts on https://lasthavens.com/play
- Window title: Lasthavens
- Navigation is limited to the lasthavens.com domain (subdomains are allowed)
- Set `"allowExternalNavigation": true` in `config.json` to allow leaving the domain
- F11 = fullscreen
- F12 = screenshot (saved next to the app)
- Ctrl/Cmd + C / V / X / A work
- Right-click and drag locks the mouse (useful for games)
- Unzip and run — no install needed

## config.json
```json
{
  "url": "https://lasthavens.com/play",
  "title": "Lasthavens",
  "allowExternalNavigation": false
}
```
- `url` — starting page (must be https://)
- `title` — window title
- `allowExternalNavigation` — set to `true` to allow navigation to other domains (default: false)

## Build it yourself
1. Install Node.js
2. Clone and run:
   ```bash
   git clone https://github.com/Weavin-boy/LH-Kiosk-Browser.git
   cd LH-Kiosk-Browser
   npm install
   npm start
   ```
3. To build the portable Windows version:
   ```bash
   npm run build:win
   ```
   Output is in `dist/win-unpacked/`.

## Notes
By default, navigation is limited to the root domain in `config.json` (subdomains are allowed). Set `allowExternalNavigation` to `true` to turn this off. Modifier keys still work so games can use them. F11 and F12 only work while the window is focused.

Cookies and screenshots are stored next to the app (unencrypted). The app does not update itself.

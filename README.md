# Lasthavens Kiosk Browser

A simple kiosk-style browser locked to Lasthavens.

It shows only the title bar and stays on Lasthavens (or the same domain, including subdomains).

Forked/adapted from [simple-kiosk-browser](https://github.com/Weavin-boy/simple-kiosk-browser).

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
   git clone https://github.com/Weavin-boy/lasthavens-kiosk-browser.git
   cd lasthavens-kiosk-browser
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

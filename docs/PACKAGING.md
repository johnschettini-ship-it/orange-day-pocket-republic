# Packaging — v1.3 Full Week Ship

## Ship format
**Web zip** — no Electron/Steam required.

### Include
- `index.html`, `style.css`, `data.js`, `game.js`
- `assets/**` (all PNGs)
- `README.md`, `CREDITS.md`
- `docs/STORE.md`, `docs/ENDINGS.md`, `docs/PLAYTEST-CHECKLIST.md`, `docs/LAUNCH.md`

### Exclude
- `.agents/`, `.grok/`, `tools/`, `smoke.js`, `node_modules`, editor junk

### Build zip (PowerShell)

```powershell
cd "C:\Users\19082\Documents\Game Projects\Pocket Republic"
Compress-Archive -Path index.html,style.css,data.js,game.js,assets,README.md,CREDITS.md,docs\STORE.md,docs\ENDINGS.md,docs\PLAYTEST-CHECKLIST.md,docs\LAUNCH.md -DestinationPath "releases/OrangeDay-PocketRepublic-v1.3.zip" -Force
```

## Pre-ship visual check (do this before every zip)
`node smoke.js` only proves game logic — it can't see layout. Before packaging:
1. Open `index.html` (or the local server) in a browser.
2. Resize/devtools to a narrow viewport (~375px wide, e.g. an iPhone SE preset).
3. Confirm: no horizontal scrollbar, canvas border fully visible on both edges, hint text not cut off.

This exists because v1.3's `main{width:min(1000px,100vw)}` silently clipped 16px off the right edge on every screen under ~1030px wide (canvas border, PWR button, hint text) for an unknown stretch of the project's life — smoke stayed green the whole time. Fixed via `calc(100vw - 32px)` in `style.css`, but nothing catches the *next* regression of this kind except eyes on a narrow viewport.

## Stack decision
**Keep browser/Canvas vanilla JS.** Content in `data.js`; runtime in `game.js`. Load order: `data.js` then `game.js`.

## Version stamp
Title / README / results show **`v1.3`** · **Full Week Ship**.

## Prior zips (archive)
- `OrangeDay-LongTermDraft-1.zip` · `v1.0` · `v1.1` · `v1.2`

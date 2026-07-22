# Orange Day — Sprite Assets

Stardew-style **pixel art PNGs** with transparent backgrounds for the Town Hall Plaza prototype.

## Regenerate

```powershell
python tools/gen_sprites.py
```

## Layout

| Folder | Contents |
|--------|----------|
| `player/` | Tiny, Lexa, Mandate, Bernie, Leon, Donny — idle + walk frames |
| `npc/` | Plaza NPCs (clerk, barista, etc.) |
| `props/` | Buildings / landmarks matching zone ids |
| `voters/` | Faction icons (party-follower style) |
| `tiles/` | Grass, path, plaza tiles |
| `items/` | Campaign button pickup |
| `ui/` | Title mascot + **key art** |
| `clutter/` | Benches, signs, posters, pigeons, lamps, bins, flowers |

## Runtime

`game.js` loads these paths, draws with `imageSmoothingEnabled = false`, and **falls back to procedural shapes** if a file is missing.

## Visual passes

- v0.1 — base sprites  
- polish — 4-way walk, balloons, ambient  
- **look pass** — richer faces, plaza clutter, title key art

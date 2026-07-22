# Achievement & Milestone boards — store mapping

Use this when wiring **Steam**, **Google Play Games**, or **Apple Game Center**.

## Layers

| Layer | Purpose | Storage |
|-------|---------|---------|
| **Public Achievements** | Store board / trophy list | `localStorage orangeDay_achieve_v1` |
| **Milestones** | Internal progression; unlock cast | `localStorage orangeDay_meta_v1` |

In-game: **G** opens boards · **Tab** switches Achievements ↔ Milestones.

## Character unlock path (milestones) — main roster

| Character | Milestone | Requirement |
|-----------|-----------|-------------|
| Tiny Orange Man | Open the Plaza | Always free |
| Rally Queen | First Election Night | Clear 1 week |
| Mayor Mandate | Street Cred Season | Clear week with **Grassroots** |
| Bernie Beans | Half the Town | 6 voters in one week |
| Leon Rocket | Full Roll Call | 12 voters in one week |
| Buck Bootstraps | Money Machine Season | Clear week with **Money** |
| (all main) | Seasoned Operator | Clear 3 weeks |

## Secret cast (easter eggs — not shown until unlocked)

| Character | Easter egg |
|-----------|------------|
| **Pip the Civic** | Peck plaza **pigeons ×3** in a week |
| **Mae Memo** | Read **Town Board 10×** (account total) |
| **Canapé Carl** | Complete **Donor Gala** once |
| **Cardboard Casey** | **Booth photo op ×3** (account total) |

Secrets never appear as locked cards — they materialize on the select grid only after the egg.

## Steam / store achievement IDs

| Game id | API name (`apiName`) | Title | Tier |
|---------|----------------------|-------|------|
| first_voter | ACH_FIRST_VOTER | First Voter | bronze |
| half_dex | ACH_HALF_DEX | Half the Codex | bronze |
| full_dex | ACH_FULL_DEX | Full Voter Dex | gold |
| tool | ACH_TOOL | Multitool Owner | bronze |
| power_max | ACH_POWER_MAX | Power Tree Max | silver |
| debate | ACH_DEBATE | Debate Champ | silver |
| scandal | ACH_SCANDAL | Leak Season | bronze |
| march | ACH_MARCH | March Feet | bronze |
| gala | ACH_GALA | Gala Guest | bronze |
| coalition | ACH_COALITION | Full Bloc | silver |
| week_clear | ACH_WEEK_CLEAR | Election Week Cleared | silver |
| ending_e1 | ACH_ENDING_E1 | Ending: Civic Darling | gold |
| ending_e4 | ACH_ENDING_E4 | Ending: Money Machine | gold |
| five_star | ACH_FIVE_STAR | Five Achievements | bronze |
| grifted | ACH_GRIFTED | Grift Recognized | silver |
| synergy | ACH_SYNERGY | Synergy Delivered | silver |
| first_milestone | ACH_FIRST_MS | Cast Call | bronze |
| full_cast | ACH_FULL_CAST | Full Cast | gold |
| three_weeks | ACH_THREE_WEEKS | Three Seasons | silver |
| no_steal | ACH_NO_STEAL | Tight Ship | silver |

Source of truth: `data.js` → `ACHIEVEMENT_DEFS` + `MILESTONES`.

## Export hook (future)

```js
// Browser console / native bridge later
ORANGE_DAY.qa.meta          // account meta
// On unlockAchieve, emit store API:
// Steam: SteamUserStats.SetAchievement(apiName)
// Play: Games.Achievements.unlock(apiName)
```

Do **not** rename `id` / `apiName` after ship — store dashboards freeze them.

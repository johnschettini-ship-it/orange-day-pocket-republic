# Playtest checklist — Seasonal Civic Career (`v1.4`)

Use this for a human career pass. Run `node smoke.js` first and expect **GO**.

## Setup and controls

1. Hard refresh (**Ctrl+F5**) and start a new campaign.
2. Confirm the title/build label says **Seasonal Civic Career / v1.4**.
3. Test keyboard, touch, and a connected gamepad on a chapter decision:
   move the choice both directions, confirm it, and verify only the highlighted
   choice resolves.
4. Confirm music starts after the first input and changes at the next chapter.

## Seasonal identity

| # | Check | Pass? |
|---|---|---|
| SE1 | Start season is shown before play; palette, weather, sport, and music agree | |
| SE2 | Winter has short daylight and snow/ice; spring has rain/flood watch | |
| SE3 | Summer has long daylight and heat/thunder; fall has wind/cold rain | |
| SE4 | Weather changes play (movement/time/readiness), not only the HUD label | |
| SE5 | Chapter clock changes with season and chapter type | |
| SE6 | NPC small talk mentions the current season/chapter and changes after advancing | |

## Seven-chapter career

For every row, play the mission in the world before resolving its decision.

| Chapter | Playable gate | Pass? | Notes |
|---|---|---|---|
| Election Week | Recruit/permit campaign loop reaches Election Night | | |
| Festival & Parade | Complete parade route and mascot rescue interactions | | |
| Championship | Complete the season-appropriate sports venue task | | |
| Weather Emergency | Complete evacuation/rescue interactions under adverse weather | | |
| Rescue & Recovery | Deliver supplies and repair a damaged location | | |
| Budget Reckoning | Complete hearing/ledger interactions | | |
| Reelection | Complete closing campaign task and reach the career result | | |

## Decisions and consequences

| # | Check | Pass? |
|---|---|---|
| C1 | A successful mission and a failed mission produce different loyalty totals | |
| C2 | Decision preview identifies affected groups; result reports gains and losses | |
| C3 | Readiness/infrastructure/promise state changes mission outcome where relevant | |
| C4 | District repairs remain visible in the following chapter | |
| C5 | Save mid-chapter; Continue restores season, chapter, mission, loyalty, and city state | |
| C6 | Reload cannot claim the same mission reward twice | |
| C7 | Chapter exit summarizes outcome; next intro carries consequences forward | |

## Office loss and comeback

| # | Check | Pass? |
|---|---|---|
| L1 | Lose reelection: save remains active and role becomes **Opposition Organizer** | |
| L2 | Opposition chapter remains playable and can gain loyalty | |
| L3 | Complete the comeback condition: role returns to an in-office civic role | |
| L4 | Loss and comeback survive save/reload | |
| L5 | Career can reach a clear legacy ending after either route | |

## Accessibility and soft-lock watch

- Keyboard, touch, and gamepad-equivalent chapter actions select the same choices.
- Decision copy and loyalty deltas remain readable at large text scale.
- No chapter advances before its required mission is complete.
- Failed missions still provide a path forward.
- Weather never traps the player behind geometry or makes a task unreachable.
- No blank canvas, uncaught console error, save desync, or unrelated localStorage wipe.
- No real politician names, slogans, logos, or likenesses; satire stays local and fictional.

## Sign-off

| Field | Value |
|---|---|
| Build | v1.4 |
| Tester | |
| Date | |
| Browser / controller | |
| Season / route | |
| Result | GO / NO-GO |
| P0/P1 issues | |
| Notes | |

Only `orange-director` marks the phase **GO**. Log the human result in
`.agents/playtest-log.md`.

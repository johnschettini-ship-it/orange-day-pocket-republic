# Playtest checklist — Long-Term Draft 1 (`v1.3-draft`)

Use this for a **human full-week** pass. Headless `node smoke.js` already covers systems; this covers feel, readability, and soft-locks.

## Setup
1. Open `index.html` (or local server) after hard refresh (**Ctrl+F5**).  
2. Confirm title shows **Long-Term Draft 1** / **v1.3-draft**.  
3. Optional: `node smoke.js` → expect **GO**.

## Title & meta
| # | Check | Pass? |
|---|--------|-------|
| T1 | Title, New Week, Continue, Options, Credits readable | |
| T2 | Save slots **1 / 2 / 3** switch on title; Continue uses active slot | |
| T3 | **G** opens Achievement Gallery; **H** opens Glossary; Esc closes | |
| T4 | Best ending line appears after one strong week (gallery) | |
| T5 | Options: SFX/Music, text size, reduce flash, day length | |

## Day 1 tutorial
| # | Check | Pass? |
|---|--------|-------|
| D1 | Toast tips fire once (board, E, Q, home, gates, codex) | |
| D2 | Tips do not spam every day after first run | |
| D3 | Board shows crisis + civic rule | |

## Full week (one character)
Pick any character; prefer **Tiny** first, then one of **Rally Queen / Donny**.

| Day | Gate / beat | Pass? | Notes |
|-----|-------------|-------|-------|
| 1 | Plaza only; Media locked | | |
| 2 | →MEDIA opens; Media Alley usable | | |
| 3 | →CAMPUS opens | | |
| 4 | →DONOR opens | | |
| 2–5 | Setpieces: Debate · Leak · March · Gala (as scheduled) | | |
| 7 | HOME sleep → **Election Night** results + ending | | |

## Systems
| # | Check | Pass? |
|---|--------|-------|
| S1 | Recruit ≥3 blocs; codex **C** marks seen | |
| S2 | Rival spat can lower loyalty (recruit rivals) | |
| S3 | Coalition label on evening/results | |
| S4 | Power **Q** works; vend upgrade once | |
| S5 | Mid-day save → Continue restores coins/voters/day | |
| S6 | Slot 1 and slot 2 keep separate runs | |
| S7 | Soft NG+: strong week → next New Week shows start ¢ bonus | |

## Satire hygiene
| # | Check | Pass? |
|---|--------|-------|
| H1 | No real politician names / slogans / logos | |
| H2 | **Mayor Mandate** reads local mayor, not presidential | |
| H3 | **Leon Rocket** reads tech inventor, not presidential | |
| H4 | **Rally Queen** never “AOC” or real-person branding | |

## Soft-lock watch
- Cannot sleep with required day end path  
- District gate stuck closed after unlock day  
- Save load desync (wrong character / day)  
- Blank canvas or uncaught console errors  

## Sign-off
| Field | Value |
|-------|--------|
| Build | v1.3-draft |
| Tester | |
| Date | |
| Browser | |
| Result | GO / NO-GO |
| P0/P1 issues | |
| Notes | |

Log a short summary into `.agents/playtest-log.md` when done.

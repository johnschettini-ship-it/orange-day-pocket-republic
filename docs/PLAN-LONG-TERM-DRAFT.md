# Orange Day: Pocket Republic — Long-Term Draft Plan

**Goal:** First **full long-term draft** — complete playable election-week game with maintainable agent ops, shippable zip, and room for 2.0 without rewrites.

**Baseline:** v1.2 (data.js + game.js, achievements, 7-day week)  
**Draft tag:** `long-term-draft-1` / build `v1.3-draft`

## Definition of “full long-term draft”

| Pillar | Requirement |
|--------|-------------|
| Play | Full 7-day week, 4 districts, 6 chars, 12 voters, setpieces, endings |
| Systems | Axes, coalitions, powers, crises, board rules, NG+, achievements |
| UX | Tutorial tips, glossary, achievement gallery, multi-slot save |
| Ops | Expanded agent roster, QA gates, playtest checklist |
| Ship | Zip includes data.js + game.js + assets + docs |

## Workstreams (parallel-friendly)

### W1 — Agent ops (10× capacity)
Deploy specialized agents for ongoing draft maintenance (see `.agents/ROSTER-FULL.md` + `.grok/agents/*`).

### W2 — Player-facing draft features (1.3)
- Multi-slot save (1–3)  
- Achievement gallery  
- First-week tutorial tips  
- In-game glossary  
- Best-ending memory  
- Build stamp `v1.3-draft`  

### W3 — Content stability
- No new districts in draft-1  
- Balance only for soft-locks  
- Satire hygiene pass  

### W4 — Package
- `releases/OrangeDay-LongTermDraft-1.zip`  
- Update LAUNCH / STORE for draft label  

## Exit GO (draft-1 → promoted to **v1.3 ship**)
- [x] Agent roster expanded + roster doc (27 agents · ROSTER-FULL · DEPLOYED)  
- [x] Multi-slot save + gallery + tips + glossary + best ending  
- [x] Smoke green (`phase13:*` + `phase14:*` + prior matrix)  
- [x] Draft zip `releases/OrangeDay-LongTermDraft-1.zip`  
- [x] PLAYTEST checklist + README/LAUNCH/STORE stamps  
- [x] Structured soft-lock / balance / satire audit logged (`.agents/playtest-log.md`)  
- [x] Promoted ship zip `releases/OrangeDay-PocketRepublic-v1.3.zip`  
- [ ] Optional human visual feel week (checklist — non-blocker)

## After v1.3 (2.0 track)
- Deeper hand art / walk polish (beyond identity props + title art)  
- Optional new district  
- ES modules if needed  
- Steam only if demand

## Mobile app-store track (long-term, decided 2026-07-22)
- Pilot build is mobile-ready (touch dock + pause menu + responsive layout); web stays the primary ship.
- Long-term: wrap web build (Capacitor or similar) → App Store / Play Store.
- Real-money microtransactions (ad time, BoE lunch, etc.) via **native store IAP only** — stores take 15–30% and forbid custom checkout.
- At port time, reword the current in-game fake "$X.99 REAL MONEY" satire so app review doesn't read it as a broken/deceptive purchase flow (keep the joke, make the fiction explicit).
- Satire stays archetype-only per AGENTS.md — also what keeps app review clean for political content.
- GitHub Pages hosting prohibits commerce — any real-money version moves hosts (stores or itch.io).  

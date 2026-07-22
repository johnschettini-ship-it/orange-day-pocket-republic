# Orange Day: Pocket Republic

**Cozy satirical civic life-sim** — **Full Week Ship** (`v1.3`).

A tiny orange citizen wakes up in Pocket Republic. The town runs on errands, voter coalitions, campaign nonsense, and oversized props. All characters are **fictional parody archetypes** — no real names, likenesses, slogans, or logos.

## Play

Open `index.html` in a modern browser (Chrome, Edge, Firefox).

Or from this folder:

```bash
# optional local server
npx --yes serve .
# or: python -m http.server 8765
```

### QA smoke

```bash
node --check game.js
node smoke.js
```

Expect **GO** on a clean tree.

### Controls

| Input | Action |
|--------|--------|
| **WASD** / Arrows | Move |
| **E** / Space | Interact |
| **Q** | Character power (or buy tool/power upgrade at vending) |
| **Tab** | Toggle objectives panel |
| **C** | Voter codex |
| **G** | Achievement gallery |
| **H** | Glossary |
| **O** | Options |
| **I** | Credits |
| **Esc** | Pause / close overlay |
| **Enter** | Confirm menus |
| **1 / 2 / 3** | Save slots on title (with Continue) |

Touch: virtual stick + E / PWR buttons on coarse pointers. Gamepad: stick · A interact · X power · Start pause.

## Current scope (v1.3 Full Week Ship)

| Feature | Included |
|---------|----------|
| Week | Full **7-day** election week → Election Night |
| Districts | Plaza · Media Alley · Campus Green · Donor Heights |
| Characters | **6** playable (Tiny, Rally Queen, Mayor Mandate, Bernie Beans, Leon Rocket, Buck Bootstraps) |
| Voters | **12** blocs · codex · rival spats · coalitions |
| Systems | Axes (Street/Donor/Heat), crises, board rules, setpieces, powers, NG+, achievements |
| UX | Day-1 tips · glossary · achievement gallery · **3 save slots** · best-ending memory |
| Ship | Zip + smoke gate + agent ops |

### Day-one objectives (still the core loop)

1. Deliver the lost permit to Town Hall  
2. Collect 3 campaign buttons  
3. Fix the broken coffee cart  
4. Recruit voter groups  
5. Return home before night  

### Characters

1. **Tiny Orange Man** — Squeeze (tunnels / gaps)  
2. **Rally Queen** — Rally Cry (recruit boost)  
3. **Mayor Mandate** — City Order (**local mayor only** — not a presidential run)  
4. **Bernie Beans** — Solidarity / labor focus  
5. **Leon Rocket** — Gadgets (**tech inventor** — not presidential)  
6. **Buck Bootstraps** — Bootstraps-memoir convert / donor pivots (**archetype only** — not a real person)  

### Voter groups (12)

Crypto Bros · Liberal Wine Moms · Student Activists · Union Workers · Suburban Moderates · Chaos Influencers · Lawn Guardians · Policy Nerds · Budget Hawks · Patriots · Conspiracy Cafe · Mega Donors  

## Tone & satire rules

- Funny, colorful, cozy, slightly mysterious  
- Short, sharp dialogue  
- Targets **behavior, bureaucracy, wealth, media cycles, campaign theater** — not real people  
- Playful systems satire, not mean-spirited attack content  

## Stack

Static **HTML5 Canvas** + vanilla JS/CSS + **PNG sprites** in `assets/`. No build step.

| Module | Role |
|--------|------|
| `data.js` | Content tables |
| `game.js` | Runtime |

Regenerate sprites with `python tools/gen_sprites.py` if needed.

## Roadmap

| Doc | Purpose |
|-----|---------|
| [`docs/PLAN-LONG-TERM-DRAFT.md`](docs/PLAN-LONG-TERM-DRAFT.md) | **Active** draft-1 plan |
| [`docs/PLAN-1.0.md`](docs/PLAN-1.0.md) | Phases A→E to 1.0 |
| [`docs/PLAN-1.1.md`](docs/PLAN-1.1.md) / [`PLAN-1.2.md`](docs/PLAN-1.2.md) | Prior patches |
| [`docs/PLAYTEST-CHECKLIST.md`](docs/PLAYTEST-CHECKLIST.md) | Human full-week pass |
| [`docs/ENDINGS.md`](docs/ENDINGS.md) · [`STYLE.md`](docs/STYLE.md) · [`PRESS.md`](docs/PRESS.md) · [`STORE.md`](docs/STORE.md) | Support docs |
| [`CREDITS.md`](CREDITS.md) | Credits |

**Current build:** **v1.3** · **Full Week Ship**  
**Orders:** [`.agents/game-directive-v1.3.md`](.agents/game-directive-v1.3.md)  
**Release zip:** `releases/OrangeDay-PocketRepublic-v1.3.zip`  
**Prior draft zip:** `releases/OrangeDay-LongTermDraft-1.zip`

### Play notes (v1.3)

- **7-day election week** → Election Night results  
- **4 districts** with day gates (Media D2 · Campus D3 · Donors D4) — Campus is **Day 3**, not Day 2  
- **Rotating daily objectives** (Day 1 plaza errands → later setpiece days → Election Eve)  
- **Setpieces:** Debate · Scandal Leak · Union March · Donor Gala  
- **Civic grift gags:** Paver Pete (potholes never fixed) · Board of Ed lunch · Ad Desk (fake “$X.99 REAL MONEY” satire — no real purchases)  
- **Save slots 1–3** on title · Continue per slot  
- **G** gallery · **H** glossary · day-1 tutorial tips  
- **O** options · **L** day length · soft NG+ banked start coins  
- Touch dock + high-DPI canvas · mid-day micro-events · endings E6–E9  

### QA

```bash
node smoke.js
node tools/playtest_auto.js
```

## Agents (AI / multi-session)

**27 spawnable agents** in `.grok/agents/` (~10× the original 7). See [`.agents/ROSTER-FULL.md`](.agents/ROSTER-FULL.md) and [`.agents/DEPLOYED.md`](.agents/DEPLOYED.md).

Core: `orange-director` · `orange-gameplay` · `orange-voters` · `orange-world` · `orange-narrative` · `orange-ui` · `orange-qa`  

Plus balance, setpieces, endings, tutorial, codex, audio, a11y, save, characters, districts, draft, store, press, package, satire, playtest, meta, data, runtime, integration.

Work from the **Pocket Republic** folder so agents and `AGENTS.md` load.

---

*Orange Day: Pocket Republic* — full long-term draft first, expansions second.

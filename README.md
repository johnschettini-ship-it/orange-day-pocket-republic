# Orange Day: Pocket Republic

**Cozy satirical civic adventure** — persistent seasonal campaign scope (`v1.4`).

A tiny orange citizen enters local politics in Pocket Republic, then lives with the city they helped create. Campaign, govern, respond to community events, keep promises, lose or gain loyalty, and return to the voters. All characters are **fictional parody archetypes**—no real names, likenesses, slogans, campaign logos, or defamatory claims.

## Play

Open `index.html` in a modern browser (Chrome, Edge, or Firefox).

Or run a local server from this folder:

```powershell
python -m http.server 8765
```

Then open `http://localhost:8765/`.

## Controls

| Input | Action |
|---|---|
| **WASD** / Arrows | Move |
| **E** / Space | Interact |
| **Q** | Character power (or buy an upgrade at vending) |
| **Tab** | Objectives and chapter duties |
| **C** | Voter codex and loyalty |
| **J** | Conversation journal |
| **G** | Achievement gallery |
| **H** | Glossary |
| **O** | Options |
| **I** | Credits |
| **Esc** | Pause / close overlay |
| **Enter** | Confirm menus |
| **1 / 2 / 3** | Select save slot on the title screen |

Touch uses the virtual stick and E / PWR buttons. Gamepad uses the stick, A to interact, X for power, and Start to pause.

## Persistent civic career

A save is a continuing local civic career rather than a single disposable election.

1. Campaign through the opening election week.
2. Govern through festivals, sports, weather, rescue, recovery, and budget chapters.
3. Make decisions whose outcomes change voter-bloc and NPC loyalty.
4. Carry promises, relationships, rival influence, infrastructure, and district condition into later chapters.
5. Face reelection—or continue as an opposition organizer and build a comeback after losing office.

Winning office is not the only way forward. A loss changes the player's role and available story arcs; it does not erase the city or end the save.

## Seasons and civic calendar

New campaigns begin in winter, spring, summer, or fall. The season changes town art, weather, music, events, daylight, and the rhythm of each playable day.

| Season | Calendar highlights | Time and world feel |
|---|---|---|
| **Winter** | Hockey, basketball, winter games bid, shelters and snow response | Short daylight, longer indoor evenings, ice and snow |
| **Spring** | Baseball opening season, flooding, cleanup and renewal | Days lengthen, rain and blossoms reshape routes |
| **Summer** | World Civic Summer Games bid, parades, festivals and heat response | Long days, busy nights, heat and large crowds |
| **Fall** | Football, harvest events, budget season and election pressure | Days shorten, leaves fall, stadium and parade traffic grows |

Pocket Republic uses fictional event branding such as the **World Civic Summer Games**. It does not use real sports-event logos or protected political branding.

Day length is part of the play loop. Exploration and festival chapters can run into the evening; emergencies use shorter, higher-pressure windows; infrastructure upgrades can save time; poor preparation can create closures and delays.

## Chapters

The intended civic-career arc is:

1. **Election Week** — recruit coalitions and win a local mandate.
2. **Festival and Parade** — plan routes, build community participation, and handle public-safety surprises.
3. **Championship Season** — manage traffic, fans, funding disputes, and local sports loyalties.
4. **Storm Emergency** — prepare shelters, navigate blocked streets, and choose response priorities.
5. **Rescue and Recovery** — evacuate residents, deliver supplies, and decide how rebuilding is funded.
6. **Budget Reckoning** — defend tradeoffs, fulfill promises, and face competing civic needs.
7. **Reelection or Comeback** — run on the city's record from office or organize from outside it.

Every chapter opens with a seasonal establishing scene, date, forecast, headline, civic calendar, current duties, unresolved promises, rival activity, and its own procedural music. It closes with an outcome montage showing loyalty changes, district consequences, promises kept or broken, expenses, NPC reactions, and the next chapter preview.

## Loyalty and decisions

Important NPCs and all 12 voter blocs remember the player's choices. Loyalty changes according to:

- the decision selected;
- preparation and response time;
- playable mission performance;
- district condition and available resources;
- earlier promises and relationships;
- which neighborhoods received help first;
- whether help was effective or merely good publicity.

Choices are intended to create competing benefits rather than one obvious correct answer. Loyal groups may volunteer, reveal shortcuts, or assist during emergencies. Neglected groups may protest, leak information, obstruct plans, or support a rival.

## Living town

The plaza and districts evolve across the campaign. Repaired roads, decorations, stadium work, storm damage, new businesses, neglected parks, protest art, and donor monuments remain visible when appropriate. NPCs receive continuing story arcs and seasonal conversations, including Clara Catwell's expanding collection of cat stories.

Playable characters unlocked during a chapter become available on later runs. They may also appear as advisers, allies, rivals, or alternate candidates in the current civic universe.

## Music

The game uses procedural Web Audio themes rather than bundled music tracks. Each season and chapter has a distinct arrangement, with variations for districts, emergencies, recovery, festivals, and civic finales. Browsers require the player to interact once before audio can begin.

## Current content foundation

| Feature | Foundation |
|---|---|
| World | Plaza, Media Alley, Campus Green, Donor Heights |
| Characters | Tiny Orange Man, Rally Queen, Mayor Mandate, Bernie Beans, Leon Rocket, Buck Bootstraps |
| Voters | 12 blocs with coalitions, rivalries, codex entries, and persistent loyalty |
| Systems | Street / Donor / Heat axes, crises, powers, achievements, saves, chapter consequences |
| Presentation | Canvas world, responsive controls, touch dock, procedural audio |

## Tone and satire rules

- Funny, colorful, cozy, and slightly mysterious.
- Humor targets systems: bureaucracy, wealth theater, media cycles, internet tribes, campaign spectacle, and civic absurdity.
- Playful, never cruel.
- All offices and campaigns are local civic roles.
- Mayor Mandate is local city hall only.
- Leon Rocket is a fictional inventor/tech local.
- Rally Queen is a fictional organizer archetype.
- Buck Bootstraps is a fictional memoir/convert archetype.

## Project structure

| Path | Role |
|---|---|
| `index.html` | Browser shell, canvas, touch dock |
| `style.css` | Page chrome |
| `data.js` | Characters, voters, events, dialogue, and other content |
| `game.js` | Runtime state, systems, rendering, and input |
| `smoke.js` | Headless QA matrix |
| `docs/PLAN-LONG-TERM-DRAFT.md` | Active v1.4 seasonal-career plan |

No framework or build step is required.

## Developer checks

```powershell
node --check data.js
node --check game.js
node smoke.js
```

See [`docs/PLAN-LONG-TERM-DRAFT.md`](docs/PLAN-LONG-TERM-DRAFT.md) for the active implementation scope and completion gates.


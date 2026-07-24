# Orange Day: Pocket Republic — Persistent Seasonal Civic Career Plan

**Target:** v1.4
**Working label:** Seasonal Civic Career
**Foundation:** v1.3 Full Week Ship
**Status:** Active implementation scope; completion requires the gates below.

## Product goal

Expand the seven-day election into the opening chapter of a persistent civic adventure. The player campaigns, governs, experiences a living seasonal calendar, makes decisions with lasting loyalty consequences, and returns to voters with a visible record.

One election week remains a compact 20–45 minute play unit. A complete seasonal career should support roughly 2–3 hours of connected play without requiring one long session.

## Non-negotiable satire and safety

- All characters remain fictional parody archetypes.
- No real politician names, exact likenesses, real slogans, real campaign logos, or defamatory claims.
- Humor targets bureaucracy, wealth theater, media cycles, internet tribes, campaign spectacle, and civic absurdity.
- Tone stays funny, cozy, colorful, slightly mysterious, playful, and not cruel.
- Every office and campaign is local civic government.
- Mayor Mandate is local city hall only.
- Leon Rocket is an inventor/tech local, Rally Queen an organizer archetype, and Buck Bootstraps a memoir/convert archetype.
- International sports storylines use fictional branding, including **World Civic Summer Games**; do not use real event marks or symbols.

## Core career loop

```text
Campaign → govern → face an event → make tradeoffs → resolve a playable mission
→ update loyalty and the town → report consequences → enter the next chapter
→ seek reelection or organize a comeback
```

The save persists through victory and defeat. Losing office changes the role, duties, allies, and routes available; it does not force a reset.

## Persistent campaign state

Persist only state that creates readable consequences:

- selected season, calendar date, chapter, day, and role;
- current office or opposition status;
- voter-bloc and important-NPC loyalty;
- district condition, infrastructure, and emergency readiness;
- coalition strength and rival influence;
- promises made, fulfilled, broken, or deferred;
- visible civic changes and unresolved damage;
- resources, public trust, Street / Donor / Heat, and notable achievements;
- heard dialogue and continuing NPC story beats;
- unlocked playable characters, advisers, allies, and alternate candidates.

Use `orangeDay_*` localStorage keys only. Never wipe unrelated storage. Existing v1.3 saves should load through an explicit migration/defaulting seam.

## Seasons

Each new career begins with a chosen or randomized season. Season affects art direction, weather, daylight, calendar events, dialogue, traversal pressure, and music.

| Season | Signature calendar | Environmental play | Time rhythm |
|---|---|---|---|
| Winter | Hockey, basketball, winter games bid | Snow, ice, shelters, heating and road response | Short daylight; longer indoor evenings |
| Spring | Baseball opening season, civic cleanup | Rain, flooding, blossoms, mud and construction | Daylight grows across chapters |
| Summer | World Civic Summer Games bid, festivals, parades | Heat, tourism, crowded parks, nighttime events | Long daylight and active nights |
| Fall | Football, harvest events, budget season | Leaves, stadium traffic, early cold and election pressure | Daylight shrinks across chapters |

Season is not a cosmetic filter. At least one event, one route or timing condition, one dialogue thread, and one musical arrangement per chapter must reflect it.

## Chapter arc

### 1. Election Week

- Seven-day local campaign and Election Night.
- Introduce voter blocs, rivals, promises, districts, powers, and loyalty.
- Unlock the core cast across the week, with harder achievements preserved for replay.
- Exit into office or opposition rather than a terminal results screen.

### 2. Festival and Parade

- Choose a route, permits, budget, floats, vendors, volunteers, and crowd-safety priorities.
- Include a playable disruption or rescue, such as a runaway mascot or missing attendee.
- Continue NPC stories and expose early consequences from Election Week.

### 3. Championship Season

- Align the sport with the season: winter indoor sports, spring baseball, summer civic games, fall football.
- Handle traffic, concessions, endorsements, fan rivalries, public-space access, and funding disputes.
- Avoid real league, team, athlete, or event branding.

### 4. Storm Emergency

- Forecast and preparation phase followed by blocked routes, outages, shelters, and limited time.
- Let prior infrastructure and emergency-readiness choices materially alter the mission.
- Force competing neighborhood priorities without presenting one universally correct choice.

### 5. Rescue and Recovery

- Timed searches, evacuations, supply delivery, volunteer coordination, and rebuilding.
- Keep damage and repairs visible in later chapters.
- Let funding sources create different loyalty, Donor, Budget, and Heat consequences.

### 6. Budget Reckoning

- Reconcile promises, emergency spending, services, infrastructure, sports, and festival commitments.
- Give coalitions and NPCs demands based on their history with the player.
- Make the public record legible before reelection.

### 7. Reelection or Comeback

- In office: defend the city's condition and promises.
- Out of office: organize residents, investigate city hall, assist during crises, and build a comeback coalition.
- Endings evaluate civic legacy, relationships, and district outcomes—not vote total alone.

## Chapter intro and exit contract

Every chapter begins with:

- seasonal establishing view and date;
- forecast and daylight window;
- newspaper headline and civic calendar;
- current role and responsibilities;
- unresolved promises and district conditions;
- rival activity;
- a distinct procedural music theme;
- clear primary and optional objectives.

Every chapter ends with:

- a short outcome montage;
- loyalty gained and lost, with understandable reasons;
- promises fulfilled, broken, or carried forward;
- district, infrastructure, and resource changes;
- NPC and rival reactions;
- civic record and role update;
- save checkpoint;
- preview of the next chapter.

Transitions must allow the town to change visually: decorations, repairs, damage, construction, weather residue, public art, protests, businesses, and monuments.

## Loyalty and decision arcs

Track voter-bloc and important-NPC loyalty on a clear 0–100 scale.

| Range | Relationship state | Typical consequence |
|---:|---|---|
| 75–100 | Devoted | Volunteers, information, emergency help, or a strong campaign bonus |
| 50–74 | Supportive | Reliable backing, but expects visible results |
| 25–49 | Uncertain | Persuadable and vulnerable to rivals |
| 1–24 | Hostile | Protests, leaks, delays, or active opposition |
| 0 | Broken | Leaves the coalition or joins an opposition arc |

Decision results should combine:

- the selected policy or response;
- preparation completed before the event;
- response time and playable performance;
- resources and district condition;
- relationships and coalition support;
- earlier promises;
- who received help first;
- whether the outcome actually worked.

Surface the reason for every material loyalty change. Avoid arbitrary hidden punishment and avoid a single morality meter.

## Variable day length

Day length follows both the calendar and the chapter loop:

- winter daylight ends early, while indoor evening activities remain available;
- spring days lengthen as the career advances;
- summer supports long days, night festivals, heat, fatigue, and crowds;
- fall days shorten as budget and election pressure rise;
- exploration and festival chapters receive broader schedules;
- crises and rescues use shorter, higher-pressure windows;
- sports and parade days may extend into evening;
- infrastructure improvements create shortcuts or reduce delays;
- poor preparation creates closures, detours, and slower objectives.

Keep Short, Normal, and Long accessibility options. Seasonal timing must scale within those choices rather than override them.

## Procedural music

Continue using Web Audio so the game remains asset-light. Audio begins only after a player gesture.

Required identities:

- winter: bell-like tones, soft pads, muted percussion;
- spring: bright rhythmic figures and light woodwind-like synthesis;
- summer: energetic percussion, brass-like leads, and nighttime festival variants;
- fall: warm bass, marching percussion, and stadium motifs;
- emergencies: reduced pulse that intensifies with danger;
- recovery: slower arrangement of the town theme;
- finales: arrangement influenced by the strongest coalition and civic outcome.

Each chapter needs an intro cue, exploration loop, tension state, resolution cue, and exit variation. Transitions should crossfade or resolve cleanly without stacking audio nodes.

## NPC and dialogue expansion

- Give every recurring NPC seasonal observations, chapter-specific concerns, outcome reactions, and memory of important player choices.
- Continue heard-line tracking to reduce repetition.
- Preserve task-specific dialogue priority, while keeping optional conversation available where practical.
- Expand Clara Catwell as an example of a full recurring arc: distinct cat stories, community involvement, crisis reactions, and later consequences.
- Record useful recent conversations in the journal so gameplay guidance is not lost.

## Role progression

Supported roles:

- candidate;
- council member;
- committee chair;
- acting mayor during emergencies;
- mayor;
- opposition organizer after defeat;
- community advocate outside government.

Role changes should affect duties, access, dialogue, and decisions while retaining familiar movement and interaction controls.

## Controls and accessibility

Retain the established control vocabulary:

- WASD / arrows move;
- E / Space interacts;
- Q uses character power;
- Tab opens objectives and chapter duties;
- C opens voter loyalty and codex;
- J opens recent conversations;
- Esc pauses or closes overlays;
- Enter confirms;
- touch and gamepad remain fully supported.

Add new actions through contextual interactions and overlays before adding new dedicated keys. Preserve keyboard-only navigation, readable contrast, reduced-motion support where available, scalable audio, and Short / Normal / Long timing.

## Implementation seams

- `data.js`: seasons, calendars, chapters, decisions, loyalty effects, NPC dialogue, and copy.
- `game.js`: persistent career state, migration, role/chapter transitions, event resolution, timing, audio, drawing, and input.
- Keep behavior and content separated where practical.
- Prefer small pure helpers for calendar selection, loyalty calculation, consequence summaries, and chapter transitions.
- Expose deterministic QA seams through `window.ORANGE_DAY.qa`.
- No framework or bundler is required for the playable ship.

## v1.4 staged delivery

### Phase A — Career foundation

- Save migration and persistent career schema.
- Season selection/randomization.
- Role, chapter, calendar, loyalty, promise, district, and infrastructure state.
- Chapter intro/exit scaffolding.

### Phase B — First vertical slice

- Spring chapter: **Opening Day and the Flood Warning**.
- Baseball civic event, changing weather, variable daylight, rescue objective, loyalty tradeoffs, town-state change, and distinct music.
- Full intro → playable day → decision → consequence → exit → next chapter loop.

### Phase C — Full chapter arc

- Festival/Parade, Championship, Storm, Recovery, Budget, and Reelection/Comeback.
- Office and opposition routes.
- Continuing NPC arcs and visible town evolution.

### Phase D — Seasonal breadth

- Winter, summer, and fall calendars.
- Seasonal sports, weather, traversal, dialogue, visuals, and procedural arrangements.
- Equivalent consequence depth across all four seasons.

### Phase E — Balance, access, and ship

- Loyalty pacing, day-length tuning, save compatibility, touch/gamepad, readability, audio balance, and full-career endings.
- Player-facing documentation, release package, and human seasonal-career playtest.

## Completion gates

The v1.4 goal is complete only when:

- [ ] A save can progress beyond Election Night without resetting the city.
- [ ] Winning and losing both open playable follow-on roles.
- [ ] All seven chapter types have clear intros, playable objectives, decisions, exits, and persistent consequences.
- [ ] Winter, spring, summer, and fall each change calendar events, daylight, weather, dialogue, visuals, and music.
- [ ] Sports align with season and use fictional branding.
- [ ] Loyalty changes are persistent, explained, and affected by decisions plus performance.
- [ ] District condition, infrastructure, promises, rivals, and NPC relationships affect later chapters.
- [ ] Day length adapts to season and chapter while respecting player timing options.
- [ ] Distinct procedural music states transition safely after browser audio unlock.
- [ ] NPC dialogue evolves by season, chapter, and remembered outcomes without excessive repetition.
- [ ] Keyboard, touch, and gamepad can complete the full career.
- [ ] Existing saves migrate safely and storage remains scoped to `orangeDay_*`.
- [ ] Automated syntax/smoke checks pass for the new matrix.
- [ ] A human playtest completes at least one full seasonal career, including an office route and a comeback route.
- [ ] Only `orange-director` records the final phase GO.

## Out of scope for v1.4

- Real-world politicians, parties, leagues, teams, athletes, or sports-event branding.
- National or presidential framing.
- Framework migration or mandatory build tooling.
- Real-money purchases.
- Endless procedural simulation without authored chapter arcs.
- Four entirely separate games; seasons share systems and content seams.

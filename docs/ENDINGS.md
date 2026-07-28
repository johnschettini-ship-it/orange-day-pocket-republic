# Orange Day: Pocket Republic — Ending Routes (Phase C)

Five primary endings. Axes: **Street Cred (St)** · **Donor Trust (Do)** · **Press Heat (Ht)**.

| ID | Title | How to reach |
|----|-------|----------------|
| **E1** | Civic Darling | St ≥ 45, Ht ≤ 22, active **Grassroots** or **Policy Bloc** |
| **E2** | Quiet Operator | St ≥ 28, Do ≥ 28, Ht < 28, few scandals, prefer **Policy Bloc**; or balanced mid scores |
| **E3** | Spectacle Mandate | Ht ≥ 38 + **Chaos Ticket** |
| **E4** | Money Machine Mayor | Do ≥ 42 + **Money Machine** |
| **E5** | Needs a Recount | Low St+Do, ≥3 late nights, or <2 voter groups; default fallback |
| **E6** | Lawn Peace (1.1) | Lawn Guardians in party, St ≥ 35, Ht ≤ 25, zero late nights |
| **E7** | Perfect Week Adjacent (1.1) | ≥3 setpieces, ≥8 voters, St+Do ≥ 55 |
| **E8** | Scandal Magnet (1.1) | High scandal count or Ht ≥ 45 with low Street |
| **E9** | Policy Sweep (1.1) | Policy Bloc + power rank ≥ 2 + solid dual axes |

## Tips

- **Grassroots:** Students + Union + Wine (any 2 of 3)  
- **Money Machine:** Crypto + Donors + Moderates  
- **Chaos Ticket:** Chaos + Conspiracy + Patriots  
- **Policy Bloc:** Budget + Moderates + Policy Nerds  

Late nights and rival spats add scandal pressure toward E5 / Heat.

Setpieces (Debate, Scandal Leak, March, Gala) shift axes but do not hard-lock endings.

## Civic Legacy (v1.4 — career-level ending)

E1-E9 above resolve a single election week. A v1.4 seasonal career keeps going past
Election Night through six more chapters (Festival, Championship, Storm, Recovery,
Budget, Reelection) and closes with a **Civic Legacy** screen instead of a single
week's vote total.

The Legacy screen (`drawLegacy()` in game.js) summarizes the whole career rather
than picking from a fixed ID list, since the meaningful variance is continuous:

| Field | Meaning |
|---|---|
| **Final Route** | Incumbent (won/held office into Reelection) or Opposition Comeback (organized back after a loss) |
| **City Loyalty** | Average of all 12 voter-bloc + families/business/fans/street loyalty at career's end |
| **Infrastructure** | Accumulated repairs/upgrades across every chapter |
| **Promises Kept / Broken** | Tally of every chapter decision's `promise` outcome |
| **Elections Won / Lost** | `campaign.electionWins` / `campaign.electionLosses` across the whole career |
| **Strongest Coalition** | Whichever of donors/fans/business/street/families ends with the highest loyalty |

There is no single "best" Civic Legacy ending — a low-loyalty Incumbent and a
high-loyalty Opposition Comeback are both legitimate closes, in keeping with the
existing rule that endings evaluate civic record and relationships rather than one
vote total.

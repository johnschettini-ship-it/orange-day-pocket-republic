(function (global) {
"use strict";
// Orange Day content data (v1.2 module split) — do not put runtime state here

const CHARACTERS = [
  {
    id: "tiny",
    name: "Tiny Orange Man",
    short: "Tiny",
    color: "#ff8c28",
    accent: "#ffd080",
    silhouette: "round",
    blurb: "Default errand runner. Slip through gaps and climb oversized props.",
    power: "Squeeze",
    powerDesc: "Q near tunnels and tiny gaps to slip through.",
    weakness: "Low crowd influence. Slower voter recruitment.",
    best: "Exploration · delivery · secrets",
    recruitMod: 0.75,
    speed: 118,
    powerKey: "squeeze",
  },
  {
    id: "alex",
    name: "Rally Queen",
    short: "Rally",
    color: "#3ecf8e",
    accent: "#a8ffe0",
    silhouette: "tall",
    blurb: "Local organizer archetype—stages, petitions, crowd energy. Not a national ticket.",
    power: "Rally Cry",
    powerDesc: "Q to pulse a rally. Nearby voters join more easily.",
    weakness: "Stamina dips when big crowds ignore you.",
    best: "Organizing · stage · crowds",
    recruitMod: 1.45,
    speed: 112,
    powerKey: "rally",
  },
  {
    id: "mayor",
    name: "Mayor Mandate",
    short: "Mandate",
    color: "#5b8def",
    accent: "#c8dcff",
    silhouette: "square",
    blurb: "City-hall reform archetype. Local ordinances only—never a presidential run.",
    power: "City Order",
    powerDesc: "Q once: unlock the office or discount the upgrade.",
    weakness: "Overusing rules raises bureaucracy drag.",
    best: "Permits · systems · policy",
    recruitMod: 1.1,
    speed: 105,
    powerKey: "order",
  },
  {
    id: "bernie",
    name: "Bernie Beans",
    short: "Beans",
    color: "#c45c4a",
    accent: "#f0d0c0",
    silhouette: "tall",
    blurb: "Grumpy fairness crusader. Turns excess coins into town buffs.",
    power: "Redistribution",
    powerDesc: "Q: spend ¢ for a short townwide Street buff.",
    weakness: "Slow unless powered by coffee (fix the cart).",
    best: "Fairness · unions · shared buffs",
    recruitMod: 1.2,
    speed: 98,
    powerKey: "redistribute",
  },
  {
    id: "leon",
    name: "Leon Rocket",
    short: "Rocket",
    color: "#60c8e8",
    accent: "#e0f8ff",
    silhouette: "tall",
    blurb: "Eccentric garage inventor—rockets and gadgets, not ballots for president.",
    power: "Launch Mode",
    powerDesc: "Q: rocket dash — speed burst and rooftop hops.",
    weakness: "Crashes can raise Press Heat.",
    best: "Speed · tech · risky shortcuts",
    recruitMod: 1.0,
    speed: 125,
    powerKey: "launch",
  },
  {
    id: "donny",
    name: "Buck Bootstraps",
    short: "Bootstraps",
    color: "#e8c040",
    accent: "#fff0c0",
    silhouette: "square",
    blurb: "Bootstraps memoir author. Pivots positions with heartfelt sincerity.",
    power: "Pivot",
    powerDesc: "Q: publicly reverse a stance — donor cash spike, Heat risk.",
    weakness: "Fact-checkers keep replaying the old clips (Heat).",
    best: "Reinvention · loyalty · donor cash",
    recruitMod: 0.95,
    speed: 108,
    powerKey: "brand",
  },
  // ── Secret cast (hidden until easter-egg unlock; never shown locked) ──
  {
    id: "pip",
    name: "Pip the Civic",
    short: "Pip",
    color: "#b8b8c8",
    accent: "#e8e8f0",
    silhouette: "round",
    blurb: "Plaza pigeon who filed for citizenship. Coos policy.",
    power: "Scatter",
    powerDesc: "Q: burst of feathers — brief speed + Conspiracy whisper.",
    weakness: "Breadcrumbs are a conflict of interest.",
    best: "Secrets · alleys · crumbs",
    recruitMod: 0.9,
    speed: 130,
    powerKey: "scatter",
    secret: true,
    easterEgg: "Peck the plaza pigeons three times in a week.",
  },
  {
    id: "mae",
    name: "Mae Memo",
    short: "Mae",
    color: "#e8d060",
    accent: "#fff8d0",
    silhouette: "square",
    blurb: "Living sticky note from Town Board. Peels, sticks, never expires.",
    power: "Post-It",
    powerDesc: "Q: slap a memo — free board tip refresh + mild Street.",
    weakness: "Rain is an existential threat.",
    best: "Bureaucracy · reminders · thrift",
    recruitMod: 1.05,
    speed: 100,
    powerKey: "postit",
    secret: true,
    easterEgg: "Read the Town Board 10 times (account total).",
  },
  {
    id: "canape",
    name: "Canapé Carl",
    short: "Canapé",
    color: "#e8a0c0",
    accent: "#ffe0f0",
    silhouette: "tall",
    blurb: "Gala hors d'oeuvre that gained sentience and a donor list.",
    power: "Passed Tray",
    powerDesc: "Q: circulate snacks — coins up, Heat up, Donors notice.",
    weakness: "Goes cold after twenty minutes.",
    best: "Galas · spectacle · empty calories",
    recruitMod: 1.0,
    speed: 110,
    powerKey: "tray",
    secret: true,
    easterEgg: "Survive the Donor Gala setpiece once.",
  },
  {
    id: "casey",
    name: "Cardboard Casey",
    short: "Casey",
    color: "#c8a878",
    accent: "#f0e0c0",
    silhouette: "square",
    blurb: "Campaign cutout that stepped off the booth after enough photo ops.",
    power: "Flat Rally",
    powerDesc: "Q: face-forward pose — recruit pulse near booth/stage.",
    weakness: "Strong wind. Also depth perception.",
    best: "Photos · booths · shallow crowds",
    recruitMod: 1.25,
    speed: 95,
    powerKey: "flat",
    secret: true,
    easterEgg: "Do the booth photo op three times (account total).",
  },
];

// favorNeed = how many dedicated task pings before a recruit roll is even allowed.
// Soft blocs: 2. Stubborn late-game / moneyed: 3. One-shot errands (crate/permit): 1.
const VOTER_GROUPS = [
  {
    id: "crypto",
    name: "Crypto Bros",
    icon: "₿",
    color: "#f0c040",
    mood: "wired",
    bonus: "+coin from tech/vending tasks",
    preferred: ["tiny", "mayor"],
    rival: "budget",
    passive: { coinMult: 1.15 },
    favorNeed: 2,
    recruitHint: "Buy from VEND twice (they only respect spend).",
  },
  {
    id: "wine",
    name: "Liberal Wine Moms",
    icon: "🍷",
    color: "#d46aa8",
    mood: "concerned",
    bonus: "+rep from community tasks",
    preferred: ["alex", "mayor"],
    rival: "patriots",
    passive: { repMult: 1.2 },
    favorNeed: 2,
    recruitHint: "Fix coffee AND chat at the park. Two wholesome errands.",
  },
  {
    id: "students",
    name: "Student Activists",
    icon: "✊",
    color: "#5ecf7a",
    mood: "fired-up",
    bonus: "Cheaper stamina on protest-style tasks",
    preferred: ["alex"],
    rival: "donors",
    passive: { recruitBoost: 0.15 },
    favorNeed: 2,
    recruitHint: "Rally (Q) at STAGE and/or win the Plaza Debate.",
  },
  {
    id: "union",
    name: "Union Workers",
    icon: "🔧",
    color: "#e07040",
    mood: "steady",
    bonus: "Move heavy objects & repairs faster",
    preferred: ["mayor", "alex"],
    rival: "donors",
    passive: { repairBoost: true },
    favorNeed: 1,
    recruitHint: "Help Flo shove the oversized CRATE. No shortcuts.",
  },
  {
    id: "moderates",
    name: "Suburban Moderates",
    icon: "🏡",
    color: "#7aa8c8",
    mood: "cautious",
    bonus: "Stabilize rep after chaos",
    preferred: ["mayor", "tiny"],
    rival: "chaos",
    passive: { repShield: 2 },
    favorNeed: 1,
    recruitHint: "Deliver the lost permit to Town Hall. Cleanly.",
  },
  {
    id: "chaos",
    name: "Chaos Influencers",
    icon: "📡",
    color: "#c060ff",
    mood: "viral",
    bonus: "Amp attention & viral coin spikes",
    preferred: ["tiny", "alex"],
    rival: "moderates",
    passive: { viral: true },
    favorNeed: 2,
    recruitHint: "Cause a scene at the BOOTH twice (spectacle tax).",
  },
  {
    id: "donors",
    name: "Corporate Donors",
    icon: "💼",
    color: "#5a8aaa",
    mood: "calculating",
    bonus: "Large coin rewards and shop discounts",
    preferred: ["mayor", "tiny"],
    rival: "students",
    passive: { shopDiscount: 0.15, donorBias: true },
    favorNeed: 3,
    recruitHint: "Bleed coins: VEND buys, Ad Desk, Pitch Pavilion, or Gala.",
  },
  {
    id: "conspiracy",
    name: "Conspiracy Podcasters",
    icon: "🎙️",
    color: "#8a6a40",
    mood: "suspicious",
    bonus: "Reveal rumors; sometimes false leads",
    preferred: ["tiny", "bernie"],
    rival: "budget",
    passive: { rumor: true },
    favorNeed: 2,
    recruitHint: "Alley + tunnel secrets, or expose Paver Pete (4 payments).",
  },
  {
    id: "budget",
    name: "Budget Watchers",
    icon: "📊",
    color: "#6a8a6a",
    mood: "austere",
    bonus: "Lower upgrade costs",
    preferred: ["mayor", "bernie"],
    rival: "crypto",
    passive: { cheapUpgrades: true },
    favorNeed: 2,
    recruitHint: "Check BOARD twice and buy the thrifty VEND tool upgrade.",
  },
  {
    id: "patriots",
    name: "Die-Hard Patriots",
    icon: "🦅",
    color: "#c04040",
    mood: "fiery",
    bonus: "Rally energy and intimidation",
    preferred: ["donny", "leon"],
    rival: "wine",
    passive: { intimidate: true },
    favorNeed: 3,
    recruitHint: "Media Alley spectacle: Anchor, Ad Desk, booth heat.",
  },
  {
    id: "policy",
    name: "Policy Nerds",
    icon: "📎",
    color: "#7080a0",
    mood: "precise",
    bonus: "Permit and town-hall objectives",
    preferred: ["mayor", "alex"],
    rival: "conspiracy",
    passive: { policy: true },
    favorNeed: 3,
    recruitHint: "Permit delivered + Board of Ed lunch + petition paperwork.",
  },
  {
    id: "lawn",
    name: "Retired Lawn Guardians",
    icon: "🌿",
    color: "#70a060",
    mood: "watchful",
    bonus: "Report issues; stabilize neighborhoods",
    preferred: ["bernie", "mayor"],
    rival: "chaos",
    passive: { stabilize: true },
    favorNeed: 2,
    recruitHint: "Visit PARK twice without high Heat chaos.",
  },
];

// Phase C districts
const DISTRICTS = [
  { id: "plaza", name: "Town Hall Plaza", unlockDay: 1, color: "#ffb347" },
  { id: "media", name: "Media Alley", unlockDay: 2, color: "#c060ff" },
  { id: "campus", name: "Campus Green", unlockDay: 3, color: "#5ecf7a" },
  { id: "donor", name: "Donor Heights", unlockDay: 4, color: "#e8c040" },
];

// Named coalitions (Phase B) — match 2 of 3 for partial, 3 of 3 for full
const COALITIONS = [
  {
    id: "grassroots",
    name: "Grassroots Coalition",
    members: ["students", "union", "wine"],
    bonus: "Faster repairs · +Street Cred gains",
    drawback: "Shops cost more",
    color: "#5ecf7a",
  },
  {
    id: "money",
    name: "Money Machine",
    members: ["crypto", "donors", "moderates"],
    bonus: "More coins · better shop prices",
    drawback: "Scandal risk (+Press Heat)",
    color: "#f0c040",
  },
  {
    id: "chaos_ticket",
    name: "Chaos Ticket",
    members: ["chaos", "conspiracy", "patriots"],
    bonus: "Viral coin spikes · bold checks",
    drawback: "Random plaza noise",
    color: "#c060ff",
  },
  {
    id: "policy",
    name: "Policy Bloc",
    members: ["budget", "moderates", "policy"],
    bonus: "Cheaper upgrades · permit ease",
    drawback: "Slower voter recruitment",
    color: "#7aa8c8",
  },
];

// Daily civic rule cards — 7-day cycle (+ 1.1 extras cycled in)
const BOARD_RULES = [
  { id: "open_mic", title: "Open Mic Day", blurb: "Stage energy high. Recruit near STAGE improves.", recruitNearStage: 0.2 },
  { id: "austerity", title: "Austerity Memo", blurb: "Upgrades cheaper; coin pickups thinner.", upgradeMult: 0.85, coinMult: 0.9 },
  { id: "press_pool", title: "Press Pool Roaming", blurb: "Cameras everywhere. Heat rises faster.", heatMult: 1.5 },
  { id: "union_friendly", title: "Labor Listening Hour", blurb: "Repair and heavy lifts pay better Street.", streetBoost: 1.2 },
  { id: "donor_day", title: "Donor Courtyard Open", blurb: "Donor Heights buzz. Coin mult up; Heat risk.", coinMult: 1.15, heatMult: 1.2 },
  { id: "quiet_hours", title: "Quiet Hours Ordinance", blurb: "Chaos quieter. Recruit slower; Heat dampened.", recruitNearStage: -0.05, heatMult: 0.7 },
  { id: "election_eve", title: "Election Eve Watch", blurb: "Everything counts double toward endings.", coinMult: 1.1, heatMult: 1.2 },
  // 1.1 seasonal / micro rules (appear when day wraps past 7 or mixed in by index)
  { id: "farmers_market", title: "Farmers Market", blurb: "Park energy up. Street gains feel juicier.", streetBoost: 1.25, coinMult: 1.05 },
  { id: "pothole_week", title: "Pothole Week", blurb: "Repairs matter. Coffee/cart fixes pay more Street.", streetBoost: 1.3 },
  { id: "influencer_influx", title: "Influencer Influx", blurb: "Viral odds up; Heat creeps faster.", heatMult: 1.35, coinMult: 1.1 },
];

// Mid-day micro-events (1.1) — toast + small axis/coin nudge once per day max
const MICRO_EVENTS = [
  { id: "duck_caucus", text: "Park ducks form a caucus. +1 Street for noticing.", axes: { street: 1 } },
  { id: "lost_mic", text: "Someone drops a mic. You return it. +1 Donor goodwill.", axes: { donor: 1 } },
  { id: "viral_clip", text: "A clip of you goes mildly viral. +2 Heat, +3¢.", axes: { heat: 2 }, coins: 3 },
  { id: "budget_memo", text: "Anonymous budget memo praises thrift. +1 Donor.", axes: { donor: 1 } },
  { id: "lawn_tip", text: "A Lawn Guardian tips you off. Codex whisper.", axes: { street: 1 } },
];

// ─── Meta progression: milestones unlock cast ─────────────────
// Internal tracker (not Steam API). Completing a milestone unlocks characters.
// Starter is always free so the first week is always playable.
const MILESTONES = [
  {
    id: "ms_open_plaza",
    name: "Open the Plaza",
    desc: "Always free — Tiny starts unlocked.",
    unlocks: ["tiny"],
    auto: true,
  },
  // ── First-week path variety (easier paths listed first for hints) ──
  {
    id: "ms_crowd_pulse",
    name: "Crowd Pulse",
    desc: "Recruit 3 voter blocs in one week (often mid–first week).",
    unlocks: ["alex"],
    need: { maxVotersOneWeek: 3 },
  },
  {
    id: "ms_first_week",
    name: "First Election Night",
    desc: "Finish Election Week once (any ending).",
    // Deliberately NOT leon — his only fast path is the hard one
    // (ms_full_dex, all 12 blocs in a week). A 1-week freebie here would
    // make Full Roll Call pointless. He still has the guaranteed slow path
    // via ms_veteran (3 weeks cleared) so nobody's permanently locked out.
    unlocks: ["alex", "mayor"],
    need: { weeksCleared: 1 },
  },
  {
    id: "ms_permit_path",
    name: "Clean Permit",
    desc: "Deliver a Town Hall permit once (policy path).",
    unlocks: ["mayor"],
    need: { permits: 1 },
  },
  {
    id: "ms_stage_debut",
    name: "Stage Debut",
    desc: "Win the Plaza Debate once (organizer path).",
    unlocks: ["mayor"],
    need: { debatesWon: 1 },
  },
  {
    id: "ms_street_week",
    name: "Street Cred Season",
    desc: "Clear a week while holding a Grassroots coalition on Election Night.",
    unlocks: ["mayor"],
    need: { weeksCleared: 1, coalition: "grassroots" },
  },
  {
    id: "ms_march_path",
    name: "March Feet Path",
    desc: "Join the Union March once (street path).",
    unlocks: ["bernie"],
    need: { marches: 1 },
  },
  {
    id: "ms_half_map",
    name: "Half the Town",
    desc: "Recruit 6 voter blocs in a single week.",
    unlocks: ["bernie"],
    need: { maxVotersOneWeek: 6 },
  },
  {
    id: "ms_full_dex",
    name: "Full Roll Call",
    desc: "Recruit all 12 voter blocs in one week.",
    unlocks: ["leon"],
    need: { maxVotersOneWeek: 12 },
  },
  {
    id: "ms_money_week",
    name: "Money Machine Season",
    desc: "Clear a week while holding a Money Machine coalition.",
    unlocks: ["donny"],
    need: { weeksCleared: 1, coalition: "money" },
  },
  {
    id: "ms_veteran",
    name: "Seasoned Operator",
    desc: "Clear 3 election weeks (any paths).",
    unlocks: ["alex", "mayor", "bernie", "leon", "donny"],
    need: { weeksCleared: 3 },
  },
  // Secret cast — tracked as milestones once easter eggs fire (hidden until then)
  {
    id: "ms_secret_pip",
    name: "Citizen Pigeon",
    desc: "Easter egg: peck plaza pigeons ×3 in a week.",
    unlocks: ["pip"],
    secret: true,
    need: { easter: { pigeon: true } },
  },
  {
    id: "ms_secret_mae",
    name: "Sticky Sovereignty",
    desc: "Easter egg: read Town Board 10 times total.",
    unlocks: ["mae"],
    secret: true,
    need: { easter: { boardReads: 10 } },
  },
  {
    id: "ms_secret_canape",
    name: "Hors d'Oeuvre Rights",
    desc: "Easter egg: complete the Donor Gala once.",
    unlocks: ["canape"],
    secret: true,
    need: { easter: { gala: true } },
  },
  {
    id: "ms_secret_casey",
    name: "Cutout Consciousness",
    desc: "Easter egg: booth photo op ×3 (account total).",
    unlocks: ["casey"],
    secret: true,
    need: { easter: { photos: 3 } },
  },
];

// Public achievement board — store-ready catalog (Steam / Play / App Store map)
// apiName = stable ID for store dashboards; keep IDs short and stable forever.
const ACHIEVEMENT_DEFS = [
  { id: "first_voter", apiName: "ACH_FIRST_VOTER", title: "First Voter", desc: "Recruit your first voter bloc.", icon: "★", tier: "bronze" },
  { id: "half_dex", apiName: "ACH_HALF_DEX", title: "Half the Codex", desc: "Recruit 6 voter blocs in one week.", icon: "📖", tier: "bronze" },
  { id: "full_dex", apiName: "ACH_FULL_DEX", title: "Full Voter Dex", desc: "Recruit all 12 voter blocs in one week.", icon: "📚", tier: "gold" },
  { id: "tool", apiName: "ACH_TOOL", title: "Multitool Owner", desc: "Buy the Pocket Multitool upgrade.", icon: "🔧", tier: "bronze" },
  { id: "power_max", apiName: "ACH_POWER_MAX", title: "Power Tree Max", desc: "Max a character power to rank 3.", icon: "⚡", tier: "silver" },
  { id: "debate", apiName: "ACH_DEBATE", title: "Debate Champ", desc: "Win the Plaza Debate.", icon: "🎤", tier: "silver" },
  { id: "scandal", apiName: "ACH_SCANDAL", title: "Leak Season", desc: "Run the Scandal Leak setpiece.", icon: "📰", tier: "bronze" },
  { id: "march", apiName: "ACH_MARCH", title: "March Feet", desc: "Join the Union March.", icon: "✊", tier: "bronze" },
  { id: "gala", apiName: "ACH_GALA", title: "Gala Guest", desc: "Work the Donor Gala.", icon: "🥂", tier: "bronze" },
  { id: "coalition", apiName: "ACH_COALITION", title: "Full Bloc", desc: "Form a full-strength coalition.", icon: "🤝", tier: "silver" },
  { id: "week_clear", apiName: "ACH_WEEK_CLEAR", title: "Election Week Cleared", desc: "Reach Election Night.", icon: "🗳️", tier: "silver" },
  { id: "ending_e1", apiName: "ACH_ENDING_E1", title: "Ending: Civic Darling", desc: "Finish with the Civic Darling ending.", icon: "🏛", tier: "gold" },
  { id: "ending_e4", apiName: "ACH_ENDING_E4", title: "Ending: Money Machine", desc: "Finish with the Money Machine ending.", icon: "💰", tier: "gold" },
  { id: "five_star", apiName: "ACH_FIVE_STAR", title: "Five Achievements", desc: "Unlock any five achievements.", icon: "⭐", tier: "bronze" },
  { id: "grifted", apiName: "ACH_GRIFTED", title: "Grift Recognized", desc: "Expose Paver Pete's pothole scam.", icon: "🕳", tier: "silver" },
  { id: "synergy", apiName: "ACH_SYNERGY", title: "Synergy Delivered", desc: "Buy three Consultant Cole memos.", icon: "📎", tier: "silver" },
  { id: "first_milestone", apiName: "ACH_FIRST_MS", title: "Cast Call", desc: "Unlock a second playable character.", icon: "🎭", tier: "bronze" },
  { id: "full_cast", apiName: "ACH_FULL_CAST", title: "Full Cast", desc: "Unlock every main-roster character.", icon: "🎬", tier: "gold" },
  { id: "three_weeks", apiName: "ACH_THREE_WEEKS", title: "Three Seasons", desc: "Clear three election weeks.", icon: "📅", tier: "silver" },
  { id: "no_steal", apiName: "ACH_NO_STEAL", title: "Tight Ship", desc: "Clear a week with zero rival poaches.", icon: "🛡", tier: "silver" },
  { id: "secret_one", apiName: "ACH_SECRET_ONE", title: "Hidden Citizen", desc: "Unlock any secret character via easter egg.", icon: "🥚", tier: "silver" },
  { id: "secret_all", apiName: "ACH_SECRET_ALL", title: "Deep Cut Cast", desc: "Unlock all four secret characters.", icon: "🗝", tier: "gold" },
];

// Civic Texture Pack — morning headline ticker (flavor only, zero balance)
const HEADLINES = [
  "Fountain closed for 'vibes assessment.'",
  "Town Board loses third sticky note this week.",
  "Local pigeons form PAC; refuse to disclose donors.",
  "Coffee cart declared critical infrastructure.",
  "Oversized mailbox still oversized; study pending.",
  "Consultant invoices city for word 'synergy.'",
  "Debate stage: one mic working, one philosophically working.",
  "Campus petition table runs out of pens, not opinions.",
  "Media Alley traffic jammed by exclusive 'no comment.'",
  "Donor Heights valet confuses campaign for wedding.",
  "Pothole named after committee that failed to fill it.",
  "Election Eve: everyone claims they were undecided.",
  "Budget Owl seen nodding at thrift, not at fun.",
  "Alley shortcut 'definitely not haunted,' says clerk.",
  "Free buttons still cost your dignity, interns confirm.",
];

const POWER_RANK_COST = [0, 18, 36, 55]; // v1.0: reachable within a week

// Rotating day-by-day objectives — each day of the 7-day week gets its own
// short list instead of repeating Day 1 forever. Day 1 stays the fixed
// tutorial (README's stated "core loop"). Days 2-6 pair a lighter recruit
// quota with that day's already-scheduled setpiece (debate/scandal/march/
// gala) or district beat, so the panel always points at something the day
// actually offers. Baseline recruit targets are staggered 3+2+2+2+1+1+0.
// IMPORTANT: daily "voters" progress RESETS each morning (new recruits only).
// Runtime clamps target to remaining uncommitted blocs so overachievers
// aren't sent on impossible scavenger hunts on Day 3+.
const DAILY_OBJECTIVES = {
  1: [
    { id: "permit", label: "Deliver lost permit to Town Hall", short: "Deliver permit", target: 1 },
    { id: "buttons", label: "Collect 3 campaign buttons", short: "3 campaign buttons", target: 3 },
    { id: "coffee", label: "Fix the broken coffee cart", short: "Fix coffee cart", target: 1 },
    { id: "voters", label: "Recruit 3 new voter groups today", short: "3 new voters today", target: 3 },
    { id: "home", label: "Return home before night", short: "Home before night", target: 1 },
  ],
  2: [
    { id: "voters", label: "Recruit 2 new voter groups today", short: "2 new voters today", target: 2 },
    { id: "debate", label: "Take the Plaza Debate (Civic Stage)", short: "Plaza Debate", target: 1 },
    { id: "home", label: "Return home before night", short: "Home before night", target: 1 },
  ],
  3: [
    { id: "voters", label: "Recruit 2 new voter groups today", short: "2 new voters today", target: 2 },
    { id: "scandal", label: "Check the Leak Desk (Media Alley)", short: "Leak Desk", target: 1 },
    { id: "home", label: "Return home before night", short: "Home before night", target: 1 },
  ],
  4: [
    { id: "voters", label: "Recruit 2 new voter groups today", short: "2 new voters today", target: 2 },
    { id: "march", label: "Join the Union March (Campus Green)", short: "Union March", target: 1 },
    { id: "home", label: "Return home before night", short: "Home before night", target: 1 },
  ],
  5: [
    { id: "voters", label: "Recruit 1 new voter group today", short: "1 new voter today", target: 1 },
    { id: "gala", label: "Work the Donor Gala (Donor Heights)", short: "Donor Gala", target: 1 },
    { id: "home", label: "Return home before night", short: "Home before night", target: 1 },
  ],
  6: [
    { id: "voters", label: "Recruit 1 new voter group today", short: "1 new voter today", target: 1 },
    { id: "media", label: "Ride out the Spin Storm (Media Alley)", short: "Spin Storm", target: 1 },
    { id: "home", label: "Return home before night", short: "Home before night", target: 1 },
  ],
  7: [{ id: "home", label: "Survive Election Eve — sleep to count the vote", short: "Election Eve", target: 1 }],
};

// Days 2-6's middle "flavor" objective (debate/scandal/march/gala/media)
// used to be nailed to the fixed day shown above. It now gets reshuffled
// onto a different day each new game — runtime picks a fresh permutation
// per resetRun() respecting each event's minDay (its home district's
// unlock day, so e.g. the Donor Gala can never land before Donor Heights
// itself is reachable). The day-2..6 recruit targets in DAILY_OBJECTIVES
// above stay fixed to the day number regardless of which event lands
// there — only the flavor slot rotates.
const ROTATABLE_DAY_EVENTS = {
  debate: { minDay: 2, label: "Take the Plaza Debate (Civic Stage)", short: "Plaza Debate" },
  scandal: { minDay: 2, label: "Check the Leak Desk (Media Alley)", short: "Leak Desk" },
  media: { minDay: 2, label: "Ride out the Spin Storm (Media Alley)", short: "Spin Storm" },
  march: { minDay: 3, label: "Join the Union March (Campus Green)", short: "Union March" },
  gala: { minDay: 4, label: "Work the Donor Gala (Donor Heights)", short: "Donor Gala" },
};

// Phase C crises (7-day election week). debateDay/scandalDay/marchDay/
// galaDay used to live here as static per-day flags — they're now computed
// at runtime from the reshuffled ROTATABLE_DAY_EVENTS map instead (see
// game.js getCrisis()), so a fresh game doesn't always put the debate on
// day 2, the gala on day 5, etc. Title/blurb/economics stay fixed per day
// regardless of which event rotates in.
const CRISES = [
  { day: 1, id: "permit_panic", title: "PERMIT PANIC", blurb: "Lost paperwork clogs the plaza.", coinMult: 1.1, recruitMod: 0, buttonCost: 4, upgradeMult: 1 },
  { day: 2, id: "button_market", title: "BUTTON BLACK MARKET", blurb: "Merch scarce; debates heat up.", coinMult: 1, recruitMod: 0.05, buttonCost: 6, upgradeMult: 1 },
  { day: 3, id: "caffeine_collapse", title: "CAFFEINE COLLAPSE", blurb: "Fix the cart; democracy runs on drip.", coinMult: 1.05, recruitMod: 0, buttonCost: 4, upgradeMult: 0.9 },
  { day: 4, id: "march_monday", title: "MARCH MONDAY", blurb: "Campus stirs. Union energy rises.", coinMult: 1, recruitMod: 0.08, buttonCost: 4, upgradeMult: 1 },
  { day: 5, id: "gala_glow", title: "GALA GLOW", blurb: "Donor Heights sparkles. Velvet ropes.", coinMult: 1.15, recruitMod: 0, buttonCost: 5, upgradeMult: 1.05 },
  { day: 6, id: "spin_storm", title: "SPIN STORM", blurb: "Media Alley floods the feeds.", coinMult: 1.05, recruitMod: 0.05, buttonCost: 5, upgradeMult: 1, heatMult: 1.3 },
  { day: 7, id: "election_eve", title: "ELECTION EVE", blurb: "Last day before the count. Everything matters.", coinMult: 1.1, recruitMod: 0.05, buttonCost: 4, upgradeMult: 0.95 },
];

// Stitched multi-district map (Phase C)
const MAP_W = 2200;
const MAP_H = 1100;

const ZONES = [
  // —— Town Hall Plaza (existing) ——
  { id: "home", name: "Tiny Home", x: 70, y: 90, w: 110, h: 90, color: "#c4783a", label: "HOME", district: "plaza" },
  { id: "board", name: "Town Board", x: 220, y: 70, w: 100, h: 70, color: "#6b5a3a", label: "BOARD", district: "plaza" },
  { id: "mayor", name: "Mayor's Office", x: 380, y: 50, w: 160, h: 110, color: "#4a6a9a", label: "MAYOR", district: "plaza" },
  { id: "locked", name: "Locked Office", x: 560, y: 55, w: 90, h: 90, color: "#3a3a55", label: "LOCKED", district: "plaza" },
  { id: "coffee", name: "Coffee Cart", x: 90, y: 260, w: 100, h: 80, color: "#8b5a3a", label: "COFFEE", district: "plaza" },
  { id: "mailbox", name: "Oversized Mailbox", x: 250, y: 240, w: 120, h: 110, color: "#3a6a8a", label: "MAIL", district: "plaza" },
  { id: "vending", name: "Vending Machine", x: 430, y: 250, w: 90, h: 100, color: "#5a7a5a", label: "VEND", district: "plaza" },
  { id: "alley", name: "Alley Shortcut", x: 580, y: 230, w: 70, h: 140, color: "#2a2a38", label: "ALLEY", district: "plaza" },
  { id: "stage", name: "Civic Stage", x: 720, y: 80, w: 160, h: 100, color: "#9a4a6a", label: "STAGE", district: "plaza" },
  { id: "booth", name: "Campaign Booth", x: 720, y: 230, w: 130, h: 90, color: "#c04040", label: "BOOTH", district: "plaza" },
  { id: "park", name: "Small Park", x: 880, y: 200, w: 140, h: 160, color: "#3a8a50", label: "PARK", district: "plaza" },
  { id: "tunnel", name: "Hidden Tunnel", x: 90, y: 420, w: 80, h: 50, color: "#1a2830", label: "TUNNEL", district: "plaza" },
  { id: "plaza", name: "Fountain Plaza", x: 380, y: 420, w: 200, h: 140, color: "#5a8aaa", label: "PLAZA", district: "plaza" },
  { id: "crate", name: "Oversized Crate", x: 250, y: 400, w: 90, h: 70, color: "#8a6a40", label: "CRATE", district: "plaza" },
  { id: "boelunch", name: "Board of Ed Lunch Table", x: 380, y: 190, w: 90, h: 50, color: "#7a6a30", label: "LUNCH", district: "plaza" },
  // gates from plaza
  { id: "gate_media", name: "Gate → Media", x: 1000, y: 300, w: 70, h: 80, color: "#6a3080", label: "→MEDIA", district: "plaza", transit: "media" },
  { id: "gate_campus", name: "Gate → Campus", x: 480, y: 620, w: 90, h: 60, color: "#308050", label: "→CAMPUS", district: "plaza", transit: "campus" },
  // —— Media Alley (east) ——
  { id: "studio", name: "Spin Studio", x: 1280, y: 120, w: 140, h: 100, color: "#7a40a0", label: "STUDIO", district: "media" },
  { id: "cameras", name: "Camera Nest", x: 1480, y: 200, w: 110, h: 90, color: "#5a3070", label: "CAMS", district: "media" },
  { id: "leakdesk", name: "Leak Desk", x: 1350, y: 360, w: 120, h: 80, color: "#904060", label: "LEAK", district: "media" },
  { id: "addesk", name: "Ad Sales Desk", x: 1550, y: 360, w: 110, h: 80, color: "#a05880", label: "AD $", district: "media" },
  { id: "gate_plaza_m", name: "Gate → Plaza", x: 1120, y: 300, w: 70, h: 80, color: "#c4783a", label: "→PLAZA", district: "media", transit: "plaza" },
  { id: "gate_donor_m", name: "Gate → Donors", x: 1680, y: 180, w: 70, h: 70, color: "#c0a030", label: "→DONOR", district: "media", transit: "donor" },
  // —— Campus Green (south) ——
  { id: "quad", name: "Campus Quad", x: 400, y: 780, w: 180, h: 120, color: "#3a9a50", label: "QUAD", district: "campus" },
  { id: "petition", name: "Petition Table", x: 220, y: 820, w: 100, h: 70, color: "#50b070", label: "PETITION", district: "campus" },
  { id: "march", name: "March Route", x: 640, y: 800, w: 140, h: 90, color: "#e07040", label: "MARCH", district: "campus" },
  { id: "gate_plaza_c", name: "Gate → Plaza", x: 480, y: 700, w: 90, h: 50, color: "#c4783a", label: "→PLAZA", district: "campus", transit: "plaza" },
  // —— Donor Heights (northeast) ——
  { id: "velvet", name: "Velvet Rope", x: 1750, y: 80, w: 100, h: 70, color: "#a08030", label: "ROPE", district: "donor" },
  { id: "gala", name: "Gala Ballroom", x: 1900, y: 120, w: 160, h: 110, color: "#d4b040", label: "GALA", district: "donor" },
  { id: "pitch", name: "Pitch Pavilion", x: 1800, y: 280, w: 130, h: 90, color: "#c0a050", label: "PITCH", district: "donor" },
  { id: "gate_media_d", name: "Gate → Media", x: 1680, y: 100, w: 60, h: 60, color: "#6a3080", label: "→MEDIA", district: "donor", transit: "media" },
];

const DISTRICT_SPAWNS = {
  plaza: { x: 120, y: 140 },
  media: { x: 1250, y: 280 },
  campus: { x: 480, y: 760 },
  donor: { x: 1820, y: 200 },
};

const WALLS = [
  // outer fence soft bounds handled by clamp; internal blockers
  { x: 560, y: 55, w: 90, h: 20 }, // locked front until opened
];

// Decorative plaza clutter (drawn + Y-sorted feel; non-blocking)
const CLUTTER = [
  { key: "clutter/bench", x: 160, y: 200, w: 56, h: 32 },
  { key: "clutter/bench", x: 620, y: 400, w: 56, h: 32 },
  { key: "clutter/bench", x: 920, y: 360, w: 52, h: 30 },
  { key: "clutter/sign", x: 340, y: 175, w: 28, h: 44 },
  { key: "clutter/sign", x: 680, y: 200, w: 28, h: 44 },
  { key: "clutter/poster", x: 200, y: 155, w: 26, h: 32 },
  { key: "clutter/poster", x: 540, y: 200, w: 26, h: 32 },
  { key: "clutter/poster", x: 760, y: 195, w: 26, h: 32 },
  { key: "clutter/lamp", x: 300, y: 160, w: 22, h: 52 },
  { key: "clutter/lamp", x: 700, y: 360, w: 22, h: 52 },
  { key: "clutter/lamp", x: 500, y: 400, w: 22, h: 52 },
  { key: "clutter/bin", x: 400, y: 210, w: 26, h: 34 },
  { key: "clutter/bin", x: 820, y: 280, w: 26, h: 34 },
  { key: "clutter/flower", x: 140, y: 350, w: 22, h: 26 },
  { key: "clutter/flower", x: 960, y: 300, w: 22, h: 26 },
  { key: "clutter/flower", x: 480, y: 520, w: 22, h: 26 },
  { key: "clutter/newspaper", x: 370, y: 390, w: 28, h: 18 },
  { key: "clutter/newspaper", x: 600, y: 470, w: 28, h: 18 },
  { key: "clutter/pigeon", x: 420, y: 455, w: 24, h: 20, bob: true },
  { key: "clutter/pigeon", x: 780, y: 320, w: 24, h: 20, bob: true },
  { key: "clutter/pigeon", x: 250, y: 210, w: 22, h: 18, bob: true },
  { key: "clutter/pigeon", x: 900, y: 250, w: 22, h: 18, bob: true },
];

const NPCS = [
  {
    id: "clerk",
    name: "Permit Clerk Pip",
    x: 450,
    y: 120,
    color: "#d0c8a0",
    home: "mayor",
    lines: {
      default: "Lost permits find their way home. Usually.",
      permit: "That's the missing civic stamp! You're a municipal hero.",
      done: "Town Hall is slightly less cursed today. Slightly.",
    },
    dayLines: ["The permit blew toward the Oversized Mailbox.", "New district forms arrived. Same old triplicate.", "Scandal paperwork uses the red stamp.", "March permits are filed under 'loud walking.'", "Gala permits somehow approve themselves.", "Spin storms create excellent filing weather.", "Election forms close when the evening bell rings."],
  },
  {
    id: "barista",
    name: "Barista Bean",
    x: 140,
    y: 300,
    color: "#a07050",
    home: "coffee",
    lines: {
      default: "Cart's broken. Democracy runs on caffeine, kid.",
      fix: "You fixed it! Free drip of civic courage.",
      done: "Steaming. Literally and politically.",
    },
    dayLines: ["Fix the cart and coffee can cool your composure.", "Media people order foam and call it strategy.", "Campus runs on petitions and questionable espresso.", "Marchers get the union roast.", "Donors ask whether the beans have a portfolio.", "Bad headlines need strong coffee.", "Election day is decaf only in theory."],
  },
  {
    id: "vendor",
    name: "Vend-o-Rama",
    x: 475,
    y: 300,
    color: "#70a070",
    home: "vending",
    lines: {
      default: "INSERT COINS · DISPENSE BUTTONS · NO REFUNDS",
      buy: "Clunk. A shiny campaign button appears. Artisanal.",
    },
    dayLines: ["Buttons turn coins into attention.", "Media Alley prefers shiny inventory.", "Students trade buttons like tiny manifestos.", "March crowds notice matching colors.", "Donors call buttons wearable assets.", "The machine now dispenses emergency spin.", "Last call for commemorative democracy."],
  },
  {
    id: "paver",
    name: "Paver Pete",
    x: 740,
    y: 430,
    color: "#8a8a95",
    home: "plaza",
    lines: {
      default: "These potholes? Criminal. 10¢ and my guys get right on it.",
      broke: "No coins, no asphalt dreams. Come back with 10¢.",
      excuses: ["Supply chain. Nothing moves.", "Permit's pending. Any decade now.", "My asphalt guy's cousin has the truck.", "We did a study. The study needs a study."],
      exposed: "Look, the potholes are a JOURNEY, not a destination.",
    },
    dayLines: ["Day-one asphalt special. Results not included.", "Media vans make excellent pothole detectors.", "Students keep naming the holes after deans.", "March route upgrade? Ten coins, naturally.", "Donor limos have premium suspension.", "A spin storm counts as resurfacing.", "Vote first. Road quality remains undecided."],
  },
  {
    id: "consultant",
    name: "Consultant Cole",
    x: 520,
    y: 160,
    color: "#9a90b0",
    home: "mayor",
    lines: {
      default: "I can optimize your civic narrative. Retainer: 15¢. Memo guaranteed.",
      broke: "No 15¢, no synergy. That's the framework.",
      sold: [
        "Memo: 'Synergy.' Invoice attached. You're welcome.",
        "Memo: 'Leverage stakeholders.' Bolded twice for impact.",
        "Memo: 'Circle back offline.' Revolutionary.",
        "Memo: 'Thought leadership.' (It's empty. That's the point.)",
      ],
      exposed: "Between us? The memo was pre-written. Still counts as delivery.",
    },
    dayLines: ["A clean permit plays well with Moderates.", "Media loves a memo with three nouns.", "Students distrust synergy. Use smaller words.", "Unions prefer action to decks.", "Donors adore a confident invoice.", "During a spin storm, say 'framework' slowly.", "Results night needs a transition committee."],
  },
  // Neighborhood antagonists — time wasters & emotion pressure
  {
    id: "catlady",
    name: "Clara Catwell",
    x: 860,
    y: 340,
    color: "#d0a0c0",
    home: "park",
    role: "timewaster",
    lines: {
      monologues: [
        ["Oh honey—do you like cats? Of course you like cats.", "Mr. Whiskers is the HOA president. Spiritually.", "He fined a squirrel for unauthorized acorn storage.", "The squirrel appealed. He sat on the paperwork.", "The neighborhood has never been safer."],
        ["Juniper became a crossing guard last spring.", "She stared until every bicycle stopped.", "City Hall said she lacked a reflective vest.", "So I knitted one. They called it unauthorized signage.", "She still works Tuesdays. Payment is tuna."],
        ["The city won't fund my cat café. Bureaucracy hates joy.", "They wanted food, pet, and chair licenses.", "The chairs passed. The cats refused interviews.", "Pickles knocked the inspector's clipboard into the soup.", "Our file now says 'memorable.' Progress!"],
        ["Marmalade got locked inside the library overnight.", "By morning every mystery novel was on the floor.", "The librarian called it vandalism. I call it criticism.", "Marmalade prefers detectives who are cats.", "We're petitioning for a new shelf. Sit down."],
        ["I filed a permit for a community litter box.", "They said the plaza isn't zoned for ceremonial sand.", "Mr. Whiskers attended in a tiny necktie.", "The zoning board still voted no.", "We're appealing on grounds of insufficient dignity."],
        ["Duchess organized a neighborhood watch last night.", "She watched a paper bag for three hours.", "Karen reported the bag for loitering.", "Doug tried to borrow it. Duchess invoked eminent domain.", "The bag is now in witness protection."],
        ["Chairman Meow once ran for local office.", "His platform: naps, snacks, fewer vacuum cleaners.", "He carried the laundry-room district unanimously.", "A laser-pointer scandal ended the administration.", "History is cruel. Do you have a red dot?"],
      ],
      done: "Fine. Go. Tomorrow I'll tell you about the gazebo incident.",
    },
  },
  {
    id: "karen",
    name: "Karen from HOA",
    x: 340,
    y: 200,
    color: "#e8c0a0",
    home: "board",
    role: "anxiety",
    lines: {
      default: "Excuse me—who authorized that fountain splash radius?",
      rants: [
        "That poster is 2 inches too low. I'm documenting everything.",
        "Someone's pigeon is loitering. I'm calling code enforcement.",
        "Your campaign button is a public nuisance. Smile for my phone.",
        "I pay taxes. I demand a receipt for democracy.",
      ],
    },
    dayLines: ["The fountain splash radius violates three bylaws.", "Your Media Alley posture lacks approval.", "Petitions need matching clipboards.", "Marching is just loitering in formation.", "Gala flowers exceed the tasteful-height limit.", "Your spin is audible after quiet hours.", "Ballot lines must respect lawn boundaries."],
  },
  {
    id: "drunk",
    name: "Doug After-Hours",
    x: 600,
    y: 480,
    color: "#8a7060",
    home: "plaza",
    role: "thief",
    lines: {
      default: "Hey pal—civic brotherhood. Spot a citizen a few coins?",
      steal: "Thanks for the contribution to my campaign. What campaign? Exactly.",
      broke: "You're broke too? Solidarity. Still taking emotional donations.",
      empty: "Already got my cut today. Democracy is a buffet.",
    },
    dayLines: ["Keep five coins tucked away for emergencies.", "Media folks drop change when cameras roll.", "Campus has snacks if you look organized.", "March crowds share everything except passwords.", "Gala pockets jingle louder than plaza pockets.", "Spin storms make wallets hard to track.", "Election night contributions are emotionally binding."],
  },
  {
    id: "mover",
    name: "Foreman Flo",
    x: 295,
    y: 430,
    color: "#e08050",
    home: "crate",
    lines: {
      default: "This crate is an entire zoning dispute. Help me shove it?",
      help: "Teamwork! Union strength is not a metaphor today.",
      done: "Path's clear. Remember who moved the city.",
    },
    dayLines: ["Move the crate and labor remembers.", "Camera crews never lift their own cases.", "Campus needs hands before hashtags.", "The march route opens when people pitch in.", "Donor furniture is heavy with symbolism.", "Bad news travels fast; crates do not.", "We move ballot boxes together or not at all."],
  },
  {
    id: "stagehand",
    name: "Stagehand Sky",
    x: 800,
    y: 140,
    color: "#e090b0",
    home: "stage",
    lines: {
      default: "Mic check for democracy? Anyone?",
      rally: "That rally hit. Students are nodding like it's a syllabus.",
    },
    dayLines: ["The stage is quiet. Rally power wakes it.", "A debate lands better than three slogans.", "Students follow energy, then ask questions.", "March day needs a microphone and a spine.", "Gala acoustics make every promise expensive.", "Spin storms reward short honest sentences.", "Final rally: make the crowd feel included."],
  },
  {
    id: "boothie",
    name: "Booth Intern Brynn",
    x: 780,
    y: 275,
    color: "#f07070",
    home: "booth",
    lines: {
      default: "Free buttons if you pose with the cardboard candidate.",
      chaos: "That was… content. The algorithm will feast.",
    },
    dayLines: ["First photo each day earns attention and heat.", "Cameras love a clean district entrance.", "Campus photos need handmade signs.", "March pictures work best with actual marchers.", "Gala lighting forgives almost anything.", "Today the algorithm rewards panic.", "Election-night cardboard never blinks."],
  },
  {
    id: "parkgoer",
    name: "Park Regular Pat",
    x: 950,
    y: 280,
    color: "#80c090",
    home: "park",
    lines: {
      default: "Quiet green space. Please don't legislate the ducks.",
      wine: "You brought actual kindness. The wine-moms approve.",
    },
    dayLines: ["The park cools composure. Benches are free.", "Quiet voters notice who visits twice.", "Students picnic where speeches cannot reach.", "After a march, reconcile before grudges harden.", "Gala heat looks silly from a park bench.", "Kindness survives a spin storm.", "Calm coalitions hold together on election day."],
  },
  {
    id: "watchdog",
    name: "Budget Owl",
    x: 270,
    y: 105,
    color: "#c0a060",
    home: "board",
    lines: {
      default: "Read the board. Then question the board. Then rest.",
    },
    dayLines: ["Day one: the board is already lying by omission.", "New districts mean new expenses. Read every objective.", "Scandals cost less when caught early.", "Midweek: loyalty is a budget line item.", "Gala receipts reveal civic priorities.", "A spin storm hides numbers in adjectives.", "Election eve: count twice, trust once."],
  },
  {
    id: "anchor",
    name: "Anchor Remy",
    x: 1340,
    y: 180,
    color: "#c080e0",
    home: "studio",
    lines: { default: "Live in five. Make it punchy. Make it vague." },
    dayLines: ["The plaza is the story until a camera arrives.", "Media Alley opens—bring a narrative or become one.", "Leak season. Don't trip over your own soundbite.", "March footage needs a clear point of view.", "The gala wants sparkle; voters want answers.", "Spin storm: every errand is content.", "Results are facts wearing television makeup."],
  },
  {
    id: "leaker",
    name: "Source Q",
    x: 1400,
    y: 400,
    color: "#a06070",
    home: "leakdesk",
    lines: { default: "I have documents. Also vibes. Mostly vibes." },
    dayLines: ["Nothing leaks on day one except the fountain.", "Media doors open; documents begin migrating.", "Scandal-ready. Interact for a LEAK setpiece when the board says so.", "March organizers keep better notes than City Hall.", "Gala photos need a villain. Don't volunteer.", "Spin storms bury facts; logs remember them.", "My final source is a pigeon with boundaries."],
  },
  {
    id: "ra",
    name: "RA Jules",
    x: 480,
    y: 840,
    color: "#60d080",
    home: "quad",
    lines: { default: "Quad rules: no drones, no donor balloons, yes petitions." },
    dayLines: ["Campus is watching the plaza from three group chats.", "A good debate can recruit students before campus opens.", "Campus is open. Petition hard, sleep harder.", "March day—the route wants feet.", "Students can smell gala catering from here.", "Spin cannot outrun a screenshot.", "Students vote with feet and group chats."],
  },
  {
    id: "host",
    name: "Host Celeste",
    x: 1960,
    y: 180,
    color: "#e8d080",
    home: "gala",
    lines: { default: "Invitation optional. Confidence mandatory." },
    dayLines: ["The guest list begins as a rumor.", "Media mentions create invitations.", "Marches make donors check the curtains.", "Donor Heights unlocks. Smile with your tax policy.", "Gala night. Branding optional. Heat inevitable.", "A spin storm pairs nicely with sparkling water.", "They count ballots; we count canapés."],
  },
];

// Context dialogue is deliberately shallow: runtime selects a shared context line,
// then an NPC-specific insight. Missing keys safely fall back to `default`.
const NPC_CONTEXT_LINES = {
  season: {
    winter: "Short daylight makes every warm, open door count.",
    spring: "Rain exposes old drains and new promises.",
    summer: "Long evenings bring crowds, heat, and second chances.",
    fall: "The leaves turn before the budget does.",
  },
  chapter: {
    election: "Listen now; governing makes these conversations more expensive.",
    festival: "A parade route is a map of who gets included.",
    championship: "The final score never includes traffic or cleanup.",
    storm: "Preparation is policy with the cameras turned off.",
    recovery: "Repair order tells the city whose normal matters.",
    budget: "Every line item has a neighbor behind it.",
    reelection: "People remember outcomes longer than closing slogans.",
  },
  loyalty: {
    low: "Trust is low. Show up, help, and skip the speech.",
    high: "You've earned trust; don't spend it like loose change.",
  },
  outcome: {
    success: "Good result. Now make sure the benefit lasts.",
    failure: "Bad result, but accountability is still a useful next move.",
  },
};

const NPC_CONTEXT_INSIGHTS = {
  clerk: { chapter: "Permits are boring until a shelter, parade, or repair needs one.", success: "The forms held. I may frame a duplicate.", failure: "The paperwork failed people; fix the process, not the headline." },
  barista: { chapter: "Coffee hears every neighborhood before City Hall does.", success: "Folks are trading hopeful rumors over refills.", failure: "The room is upset. Listening is free; refills are not." },
  vendor: { chapter: "Supplies reveal priorities faster than slogans.", success: "CLUNK: PRACTICAL RESULTS DISPENSED.", failure: "OUT OF STOCK: EXCUSES. TRY RESTITUTION." },
  paver: { chapter: "Weather, crowds, and rescue trucks all find the same ignored potholes.", success: "Fine, the repair worked. Please act surprised.", failure: "That shortcut became a long public meeting." },
  consultant: { chapter: "A civic career is seven chapters and one invoice.", success: "Memo: measurable outcome. Disturbingly effective.", failure: "Memo: apologize plainly. I cannot trademark it." },
  catlady: { chapter: "Mr. Whiskers tracks civic progress from three windows and a disputed shed.", success: "The cats approve. Juniper slow-blinked twice.", failure: "Marmalade says failure is just a nap before the next attempt." },
  karen: { chapter: "Seasonal decorations remain subject to tasteful-height review.", success: "Adequate. I have reduced my complaint to two pages.", failure: "I documented the outcome in portrait and landscape." },
  drunk: { chapter: "A long campaign needs safe rides, warm shelters, and fewer heroic shortcuts.", success: "You did good, pal. That's rarer than exact change.", failure: "Own it, repair it, and keep moving." },
  mover: { chapter: "Every chapter has something heavy that speeches cannot move.", success: "People pulled together. Remember every pair of hands.", failure: "We reset, lift together, and leave nobody under the crate." },
  stagehand: { chapter: "Different season, same rule: test the mic before the crowd arrives.", success: "That ending earned its applause.", failure: "Missed cue. Reset the stage and tell the truth." },
  boothie: { chapter: "Festivals, games, storms—the camera always crops out somebody.", success: "Great footage. Better that the result was real.", failure: "The clip is rough. The follow-up can still be useful." },
  parkgoer: { chapter: "The park measures seasons in shade, mud, snow, and who still visits.", success: "The ducks remain neutral, but the neighbors noticed.", failure: "Sit, breathe, then repair one honest thing." },
  watchdog: { chapter: "Track promises, spending, readiness, and who waited longest.", success: "The numbers support cautious applause.", failure: "Publish the miss before somebody leaks it." },
  anchor: { chapter: "The civic calendar keeps producing live television.", success: "Results lead tonight. Commentary can wait.", failure: "The failure is news; the response becomes the story." },
  leaker: { chapter: "Seasonal folders leak exactly like ordinary folders.", success: "Documents suggest competence. Suspicious, but welcome.", failure: "The logs remember who knew what and when." },
  ra: { chapter: "Students arrive for sports and stay for decisions that affect rent and transit.", success: "Campus group chats have upgraded you to 'possibly useful.'", failure: "Students forgive mistakes faster than cover-ups." },
  host: { chapter: "Every season has a gala; recovery calls theirs a fundraiser.", success: "A durable result is this year's exclusive accessory.", failure: "Accountability is underdressed, but let it in." },
};

NPCS.forEach((npc) => {
  npc.contextLines = { defaults: NPC_CONTEXT_LINES, ...NPC_CONTEXT_INSIGHTS[npc.id] };
});

// Pickup / button spots (spread across districts)
const BUTTON_SPOTS = [
  { x: 760, y: 260, taken: false },
  { x: 500, y: 480, taken: false },
  { x: 200, y: 180, taken: false },
  { x: 900, y: 120, taken: false },
  { x: 1450, y: 250, taken: false },
  { x: 500, y: 850, taken: false },
  { x: 1920, y: 220, taken: false },
];

// Persistent civic-career content. Runtime owns progress; this is immutable copy/config.
const CAMPAIGN_SEASONS = {
  winter: {
    name: "Winter Lights",
    startMonth: "January",
    palette: ["#18243d", "#d9f3ff", "#ffc857"],
    weather: ["clear", "snow", "ice"],
    daylight: [0.72, 0.76, 0.8],
    sport: "Civic Ice Cup",
    opening: "Snow muffles the plaza while gym lights promise a loud season.",
    music: "winter_bells",
  },
  spring: {
    name: "Spring Renewal",
    startMonth: "April",
    palette: ["#315c4b", "#a8e6b0", "#ffd6e0"],
    weather: ["rain", "clear", "flood-watch"],
    daylight: [0.92, 1, 1.08],
    sport: "Orange League Opening Day",
    opening: "Fresh banners rise beside puddles, blossoms, and unfinished drainage work.",
    music: "spring_stroll",
  },
  summer: {
    name: "Summer Streets",
    startMonth: "July",
    palette: ["#164e63", "#ffe08a", "#ff7b54"],
    weather: ["clear", "heat", "thunder"],
    daylight: [1.18, 1.14, 1.08],
    sport: "World Civic Summer Games",
    opening: "Long evenings bring tourists, track meets, and one ambitious hosting bid.",
    music: "summer_brass",
  },
  fall: {
    name: "Autumn Campaign",
    startMonth: "October",
    palette: ["#40291f", "#e58b3a", "#f2d06b"],
    weather: ["clear", "wind", "cold-rain"],
    daylight: [1, 0.9, 0.8],
    sport: "Pocket Bowl Football",
    opening: "Leaves cross the plaza as marching bands compete with campaign megaphones.",
    music: "fall_march",
  },
};

const CAMPAIGN_CHAPTERS = [
  {
    id: "election",
    name: "Election Week",
    role: "Candidate",
    days: 7,
    dayLength: "standard",
    intro: "Earn a place at the table without promising the table to everybody.",
    exit: "Ballots settle the race; every promise follows the winner home.",
    event: "campaign",
    music: "campaign_plaza",
    mission: { zoneId: "plaza", objective: "Recruit 3 voter blocs", threshold: 3, metric: "recruitedBlocs", reward: { loyalty: 5, coins: 10 } },
    decisions: [
      { id: "open_calendar", prompt: "Publish the campaign calendar?", options: [
        { text: "Publish everything", loyalty: { policy: 6, donors: -3 }, promise: "open-calendar" },
        { text: "Keep planning private", loyalty: { donors: 3, policy: -5 }, heat: 2 },
      ] },
    ],
  },
  {
    id: "festival",
    name: "Festival & Parade",
    role: "Council Member",
    days: 5,
    dayLength: "long-evening",
    intro: "Floats, food carts, and three groups have booked the same intersection.",
    exit: "The confetti clears, revealing who felt celebrated and who cleaned up.",
    event: "parade-rescue",
    music: "festival_route",
    mission: { zoneId: "plaza", objective: "Guide 4 parade groups through the route", threshold: 4, metric: "paradeGroups", reward: { loyalty: 6, infrastructure: 2 } },
    decisions: [
      { id: "parade_route", prompt: "Where should the parade turn?", options: [
        { text: "Main Street merchants", loyalty: { business: 7, street: -3 }, district: { market: 4 } },
        { text: "Neighborhood loop", loyalty: { street: 7, business: -2 }, district: { plaza: 3 } },
      ] },
      { id: "lost_mascot", prompt: "A runaway mascot traps a child on a float.", options: [
        { text: "Lead the rescue", loyalty: { families: 8 }, time: -18, rescue: true },
        { text: "Call the parade crew", loyalty: { policy: 3, families: -5 }, heat: 3 },
      ] },
    ],
  },
  {
    id: "championship",
    name: "Championship Season",
    role: "Committee Chair",
    days: 6,
    dayLength: "event-night",
    intro: "The home team wants a trophy; residents mostly want their driveways back.",
    exit: "The scoreboard fades while the stadium bill remains brightly illuminated.",
    eventBySeason: { winter: "ice-cup", spring: "baseball", summer: "summer-games-bid", fall: "football" },
    music: "stadium_night",
    mission: { zoneId: "quad", objective: "Resolve 3 event-night problems", threshold: 3, metric: "eventProblems", reward: { loyalty: 6, coins: 12 } },
    decisions: [
      { id: "venue_money", prompt: "How should the event be funded?", options: [
        { text: "Public repairs first", loyalty: { budget: 7, fans: -3 }, infrastructure: 6 },
        { text: "Sponsor spectacle", loyalty: { fans: 7, donors: 5, budget: -6 }, heat: 4 },
      ] },
    ],
  },
  {
    id: "storm",
    name: "Weather Emergency",
    role: "Acting Mayor",
    days: 4,
    dayLength: "short-crisis",
    intro: "The forecast turns red. Preparation is about to become visible.",
    exit: "The storm passes; the rescue map becomes tomorrow's accountability map.",
    eventBySeason: { winter: "blizzard", spring: "river-flood", summer: "heat-and-thunder", fall: "windstorm" },
    music: "emergency_pulse",
    mission: { zoneId: "park", objective: "Evacuate 5 residents before conditions peak", threshold: 5, metric: "rescuedResidents", reward: { loyalty: 8, readiness: 5 } },
    decisions: [
      { id: "evacuation", prompt: "Who receives the first evacuation buses?", options: [
        { text: "Highest physical risk", loyalty: { families: 7, business: -3 }, rescue: true },
        { text: "Largest shelter hub", loyalty: { policy: 4, families: -3 }, readiness: 5 },
        { text: "Accept donor helicopters", loyalty: { donors: 7, budget: -4 }, heat: 5, rescue: true },
      ] },
    ],
  },
  {
    id: "recovery",
    name: "Rescue & Recovery",
    role: "Civic Leader",
    days: 6,
    dayLength: "adaptive-damage",
    intro: "Volunteers arrive before contracts, cameras, or a shared definition of fixed.",
    exit: "Repairs remain on the map, along with the neighborhoods still waiting.",
    event: "supply-and-rebuild",
    music: "recovery_theme",
    mission: { zoneId: "vending", objective: "Deliver 6 recovery supplies", threshold: 6, metric: "suppliesDelivered", reward: { loyalty: 7, infrastructure: 6 } },
    decisions: [
      { id: "rebuild", prompt: "What gets rebuilt first?", options: [
        { text: "Homes and shelters", loyalty: { families: 8, donors: -2 }, infrastructure: 5 },
        { text: "Shops and transit", loyalty: { business: 7, street: 3 }, infrastructure: 6 },
        { text: "Independent audit", loyalty: { budget: 8, policy: 4 }, time: -12 },
      ] },
    ],
  },
  {
    id: "budget",
    name: "Budget Reckoning",
    role: "Mayor or Opposition Organizer",
    days: 5,
    dayLength: "hearing-schedule",
    intro: "Every successful rescue has submitted an invoice and a competing anecdote.",
    exit: "The ledger closes; alliances recalculate what loyalty is worth.",
    event: "public-hearings",
    music: "budget_clock",
    mission: { zoneId: "mayor", objective: "Hear 4 neighborhood delegations", threshold: 4, metric: "hearingsCompleted", reward: { loyalty: 5, budget: 6 } },
    decisions: [
      { id: "budget_gap", prompt: "Close the recovery budget gap.", options: [
        { text: "Progressive civic fee", loyalty: { street: 5, donors: -7, budget: 3 } },
        { text: "Trim public events", loyalty: { budget: 7, fans: -6, business: -2 } },
        { text: "Issue repair bonds", loyalty: { policy: 5, budget: -3 }, infrastructure: 7 },
      ] },
    ],
  },
  {
    id: "reelection",
    name: "Reelection",
    role: "Incumbent or Challenger",
    days: 7,
    dayLength: "seasonal-finale",
    intro: "The city remembers outcomes more clearly than speeches, but speeches brought signs.",
    exit: "Win or lose, the same city opens tomorrow with a different civic role.",
    event: "legacy-vote",
    music: "legacy_finale",
    mission: { zoneId: "stage", objective: "Secure 6 loyal blocs", threshold: 6, metric: "loyalBlocs", reward: { loyalty: 8, legacy: 1 } },
    decisions: [
      { id: "closing_case", prompt: "What defines the closing argument?", options: [
        { text: "Promises kept", loyalty: { policy: 6 }, requires: "fulfilled-promises" },
        { text: "City repaired", loyalty: { street: 6, families: 4 }, requires: "infrastructure" },
        { text: "A loyal coalition", loyalty: { donors: 3, fans: 3, business: 3 }, requires: "coalition" },
      ] },
    ],
  },
];

global.ORANGE_DATA = {
  CHARACTERS,
  VOTER_GROUPS,
  DISTRICTS,
  COALITIONS,
  BOARD_RULES,
  MICRO_EVENTS,
  HEADLINES,
  MILESTONES,
  ACHIEVEMENT_DEFS,
  POWER_RANK_COST,
  DAILY_OBJECTIVES,
  ROTATABLE_DAY_EVENTS,
  CRISES,
  MAP_W,
  MAP_H,
  ZONES,
  DISTRICT_SPAWNS,
  CLUTTER,
  NPCS,
  BUTTON_SPOTS,
  CAMPAIGN_SEASONS,
  CAMPAIGN_CHAPTERS,
};
})(typeof window !== "undefined" ? window : globalThis);

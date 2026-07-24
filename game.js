/* Orange Day: Pocket Republic — Town Hall Plaza prototype
   Cozy satirical civic life-sim · fictional parody archetypes only */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const touchEl = document.getElementById("touch");
  const IS_COARSE = (typeof window.matchMedia === "function" && window.matchMedia("(pointer:coarse)").matches) || "ontouchstart" in window;
  // Crisp rendering on high-DPI screens: scale the backing store, keep all
  // draw/click code in logical 960x540 space via W/H.
  const DPR = Math.min(Math.max(1, (typeof window.devicePixelRatio === "number" && window.devicePixelRatio) || 1), 3);
  if (DPR > 1 && typeof ctx.scale === "function") {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.scale(DPR, DPR);
  }

  // ─── Constants ───────────────────────────────────────────────
  let DAY_SECONDS = 150; // tuned in beginDay; full week stays playable
  const NIGHT_AT = 0.88;
  const PLAYER_R = 12;
  const INTERACT_R = 42;
  const UPGRADE_COST = 22; // v1.0 balance: slightly cheaper first tool
  const MAX_DAYS = 7; // full election week
  const SAVE_KEY = "orangeDay_save_v1";
  // v1.3: longer normal/long clocks so a human week breathes
  const DAY_LENGTHS = { short: 100, normal: 150, long: 200 };
  let dayLengthMode = "normal"; // short | normal | long
  let DAY_SECONDS_BASE = DAY_LENGTHS.normal;

  // ─── Sprite assets (Stardew-like pixel PNGs) ──────────────────
  const ASSET_URLS = Object.create(null);
  function regAsset(key, url) {
    ASSET_URLS[key] = url;
  }
  ["tiny", "alex", "mayor", "bernie", "leon", "donny", "pip", "mae", "canape", "casey"].forEach((id) => {
    regAsset(`player/${id}_idle`, `assets/player/${id}_idle.png`);
    regAsset(`player/${id}_walk_0`, `assets/player/${id}_walk_0.png`);
    regAsset(`player/${id}_walk_1`, `assets/player/${id}_walk_1.png`);
    ["down", "up", "side"].forEach((dir) => {
      regAsset(`player/${id}_${dir}_idle`, `assets/player/${id}_${dir}_idle.png`);
      for (let f = 0; f < 4; f++) {
        regAsset(`player/${id}_${dir}_${f}`, `assets/player/${id}_${dir}_${f}.png`);
      }
    });
    for (let f = 0; f < 4; f++) {
      regAsset(`player/${id}_walk_${f}`, `assets/player/${id}_walk_${f}.png`);
    }
  });
  ["clerk", "barista", "vendor", "mover", "stagehand", "boothie", "parkgoer", "watchdog", "paver", "consultant", "catlady", "karen", "drunk"].forEach((id) => {
    regAsset(`npc/${id}`, `assets/npc/${id}.png`);
  });
  ["crypto", "wine", "students", "union", "moderates", "chaos", "donors", "conspiracy", "budget", "patriots", "policy", "lawn"].forEach((id) => {
    regAsset(`voters/${id}`, `assets/voters/${id}.png`);
  });
  ["home", "board", "mayor", "locked", "coffee", "mailbox", "vending", "alley", "stage", "booth", "park", "tunnel", "plaza", "crate"].forEach((id) => {
    regAsset(`props/${id}`, `assets/props/${id}.png`);
  });
  ["grass", "path", "plaza", "water"].forEach((id) => {
    regAsset(`tiles/${id}`, `assets/tiles/${id}.png`);
  });
  regAsset("items/campaign_button", "assets/items/campaign_button.png");
  regAsset("ui/title_mascot", "assets/ui/title_mascot.png");
  regAsset("ui/key_art", "assets/ui/key_art.png");
  regAsset("ui/panel", "assets/ui/panel.png");
  ["bench", "sign", "poster", "pigeon", "lamp", "bin", "flower", "newspaper"].forEach((id) => {
    regAsset(`clutter/${id}`, `assets/clutter/${id}.png`);
  });

  const assets = Object.create(null);
  let assetsReady = false;
  let assetsLoaded = 0;
  const assetTotal = Object.keys(ASSET_URLS).length;

  function loadAssets() {
    if (typeof Image === "undefined") {
      assetsReady = false;
      return;
    }
    Object.keys(ASSET_URLS).forEach((key) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        assetsLoaded++;
        if (assetsLoaded >= assetTotal) assetsReady = true;
      };
      img.onerror = () => {
        assetsLoaded++;
        if (assetsLoaded >= assetTotal) assetsReady = true;
      };
      img.src = ASSET_URLS[key];
      assets[key] = img;
    });
  }

  function spr(key) {
    const im = assets[key];
    return im && im.complete && im.naturalWidth > 0 ? im : null;
  }

  function drawSprite(key, x, y, w, h) {
    const im = spr(key);
    if (!im) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, x, y, w, h);
    return true;
  }

  function drawSpriteCentered(key, cx, cy, w, h) {
    return drawSprite(key, cx - w / 2, cy - h / 2, w, h);
  }

  // Procedural soundtrack (Web Audio only — no external samples)
  // Themes: intro · title · select · play (per-district) · evening · results
  let audioCtx = null;
  let sfxVol = 0.7;
  let musicVol = 0.35;
  let sfxOn = true;
  let musicOn = true;
  let musicNodes = null; // { master, ac, pad, padGain, theme }
  let musicTheme = null;
  let musicStep = 0;
  let musicAcc = 0;
  let musicBar = 0;
  let musicSyncKey = ""; // avoid re-ramping gain every frame
  let textScale = 1; // 1 or 1.15 (D6)
  let reduceFlash = false;
  let showOptions = false;
  let showCredits = false;
  const BUILD_ID = "v1.4";
  const DRAFT_LABEL = "Seasonal Civic Career";
  let ngPlusBonus = 0; // soft NG+ coins from last strong week
  const SETTINGS_KEY = "orangeDay_settings_v1";
  const ACHIEVE_KEY = "orangeDay_achieve_v1";
  const META_KEY = "orangeDay_meta_v1";
  const TIPS_KEY = "orangeDay_tips_v1";
  const BEST_KEY = "orangeDay_best_v1";
  const SLOT_PREFIX = "orangeDay_slot_";
  let achievements = {}; // id -> unlocked (public board)
  let tipsSeen = {};
  let bestEnding = null; // { id, title, character }
  let saveSlot = 1; // 1..3
  let showGallery = false;
  let galleryTab = "achieve"; // achieve | milestones
  let showGlossary = false;
  // Meta progression (account-wide) — unlocks cast via milestones
  let meta = {
    weeksCleared: 0,
    maxVotersOneWeek: 0,
    endingsSeen: {},
    coalitionsWon: {}, // coalition id -> times finished week with it
    milestones: {}, // id -> true
    // Tiny (Orange Squeeze) is the only free starter. The other 5 main
    // characters unlock via milestones (data.js MILESTONES `unlocks`), and
    // the 4 secret cast unlock via easter eggs — 6 main + 4 secret = 10.
    unlockedChars: { tiny: true },
    charsPlayed: {},
    weeksNoSteal: 0,
    debatesWon: 0, // account: plaza debate wins (unlock path)
    permits: 0, // account: clean permit deliveries
    marches: 0, // account: union marches joined
    easter: { pigeon: false, boardReads: 0, gala: false, photos: 0 },
  };

  function mainRoster() {
    return CHARACTERS.filter((c) => !c.secret);
  }
  function secretRoster() {
    return CHARACTERS.filter((c) => c.secret);
  }
  /** Select grid: main cast always (locked or not) + secrets only if unlocked */
  function selectRoster() {
    const main = mainRoster();
    const secrets = secretRoster().filter((c) => isCharUnlocked(c.id));
    return main.concat(secrets);
  }
  let tipQueue = [];
  let tipT = 0;

  function ensureAudio() {
    if (typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined") return null;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function sfx(kind) {
    if (!sfxOn) return;
    try {
      const ac = ensureAudio();
      if (!ac) return;
      const t0 = ac.currentTime;
      const peak = 0.055 * sfxVol;
      // Multi-voice stings for big moments
      if (kind === "burst") {
        // Composure burst — descending minor triad
        [220, 261, 311].forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(f, t0 + i * 0.04);
          o.frequency.exponentialRampToValueAtTime(f * 0.55, t0 + 0.35 + i * 0.04);
          o.connect(g);
          g.connect(ac.destination);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(peak * 0.9, t0 + 0.02 + i * 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4 + i * 0.05);
          o.start(t0 + i * 0.04);
          o.stop(t0 + 0.45 + i * 0.05);
        });
        return;
      }
      if (kind === "fanfare") {
        // Election night / milestone — ascending open fifths
        [392, 523, 659, 784].forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(f, t0 + i * 0.09);
          o.connect(g);
          g.connect(ac.destination);
          g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
          g.gain.exponentialRampToValueAtTime(peak * 0.85, t0 + i * 0.09 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.28);
          o.start(t0 + i * 0.09);
          o.stop(t0 + i * 0.09 + 0.32);
        });
        return;
      }
      if (kind === "chime") {
        // Soft title / unlock chime
        [523, 659, 784].forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = "sine";
          o.frequency.value = f;
          o.connect(g);
          g.connect(ac.destination);
          const at = t0 + i * 0.07;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(peak * 0.7, at + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
          o.start(at);
          o.stop(at + 0.4);
        });
        return;
      }
      const tones = {
        blip: [520, 0.05, "square"],
        ok: [660, 0.07, "triangle"],
        coin: [880, 0.06, "square"],
        power: [400, 0.1, "sawtooth"],
        recruit: [523, 0.08, "triangle"],
        warn: [220, 0.12, "square"],
        sleep: [392, 0.18, "sine"],
        debate: [330, 0.12, "triangle"],
        day: [440, 0.12, "sine"],
        stamp: [180, 0.08, "square"],
        sting: [523, 0.18, "triangle"],
        district: [349, 0.12, "sine"],
      };
      const [freq, dur, type] = tones[kind] || tones.blip;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      o.connect(g);
      g.connect(ac.destination);
      if (kind === "ok" || kind === "recruit") o.frequency.exponentialRampToValueAtTime(freq * 1.35, t0 + dur);
      if (kind === "coin") o.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
      if (kind === "debate" || kind === "sting") o.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + dur);
      if (kind === "district") o.frequency.exponentialRampToValueAtTime(freq * 1.25, t0 + dur);
      if (kind === "sleep") o.frequency.exponentialRampToValueAtTime(freq * 0.7, t0 + dur);
      if (kind === "day") {
        // Morning interval — fifth up
        o.frequency.setValueAtTime(freq, t0);
        o.frequency.setValueAtTime(freq * 1.5, t0 + dur * 0.45);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (_) {
      /* ignore */
    }
  }

  /** Theme master gain targets (before musicVol). */
  function themeMasterLevel(theme) {
    const base = {
      intro: 0.22,
      title: 0.25,
      select: 0.21,
      play: 0.24,
      evening: 0.2,
      results: 0.27,
    };
    let lv = (base[theme] || 0.045) * musicVol;
    if (state === "pause" && theme === "play") lv *= 0.45; // duck under pause menu
    return lv;
  }

  function desiredMusicTheme() {
    if (!musicOn) return null;
    if (state === "intro") return "intro";
    if (state === "title") return "title";
    if (state === "select") return "select";
    if (state === "chapter") return chapterPhase === "decision" ? "evening" : "select";
    if (state === "evening") return "evening";
    if (state === "results") return "results";
    if (state === "play" || state === "pause") return "play";
    return null;
  }

  function startMusic(theme) {
    if (!musicOn) return;
    const want = theme || desiredMusicTheme() || "play";
    try {
      const ac = ensureAudio();
      if (!ac) return;
      // Soft crossfade: kill previous graph
      if (musicNodes) {
        try {
          const old = musicNodes;
          old.master.gain.cancelScheduledValues(ac.currentTime);
          old.master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.18);
          if (old.pad) {
            try {
              old.pad.stop(ac.currentTime + 0.2);
            } catch (_) {}
          }
          setTimeout(() => {
            try {
              old.master.disconnect();
            } catch (_) {}
          }, 250);
        } catch (_) {}
        musicNodes = null;
      }
      const master = ac.createGain();
      master.gain.value = 0.0001;
      master.connect(ac.destination);
      master.gain.linearRampToValueAtTime(themeMasterLevel(want), ac.currentTime + 0.45);

      // Warm bass pad (root) — sustained sine under melody
      const pad = ac.createOscillator();
      const padGain = ac.createGain();
      pad.type = "sine";
      const roots = {
        intro: 131,
        title: 147,
        select: 165,
        play: 131,
        evening: 110,
        results: 147,
      };
      pad.frequency.value = roots[want] || 131;
      padGain.gain.value = 0.0001;
      pad.connect(padGain);
      padGain.connect(master);
      padGain.gain.linearRampToValueAtTime(0.35, ac.currentTime + 0.8);
      pad.start();

      musicNodes = { master, ac, pad, padGain, theme: want };
      musicTheme = want;
      musicStep = 0;
      musicAcc = 0;
      musicBar = 0;
    } catch (_) {
      musicNodes = null;
      musicTheme = null;
    }
  }

  function stopMusic() {
    if (!musicNodes) {
      musicTheme = null;
      return;
    }
    try {
      const { master, ac, pad } = musicNodes;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.35);
      if (pad) {
        try {
          pad.stop(ac.currentTime + 0.4);
        } catch (_) {}
      }
      setTimeout(() => {
        try {
          master.disconnect();
        } catch (_) {}
      }, 450);
    } catch (_) {}
    musicNodes = null;
    musicTheme = null;
    musicSyncKey = "";
  }

  /** Keep theme + master level in sync with game state. */
  function syncMusic() {
    const want = desiredMusicTheme();
    if (!want) {
      if (musicNodes) stopMusic();
      musicSyncKey = "";
      return;
    }
    if (!musicNodes || musicTheme !== want) {
      startMusic(want);
      musicSyncKey = want + "|" + state + "|" + (currentDistrict || "") + "|" + campaignMusicKey() + "|" + musicVol;
      return;
    }
    const key = want + "|" + state + "|" + (want === "play" ? currentDistrict || "" : "") + "|" + campaignMusicKey() + "|" + musicVol;
    if (key === musicSyncKey) return;
    musicSyncKey = key;
    // Live duck / volume / district pad when something actually changed
    try {
      const { master, ac, pad, padGain } = musicNodes;
      const target = themeMasterLevel(want);
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.linearRampToValueAtTime(target, ac.currentTime + 0.15);
      if (want === "play" && pad) {
        const distRoots = { plaza: 131, media: 139, campus: 147, donor: 123 };
        const r = distRoots[currentDistrict] || 131;
        pad.frequency.setTargetAtTime(r, ac.currentTime, 0.25);
        if (padGain) padGain.gain.setTargetAtTime(0.32, ac.currentTime, 0.2);
      }
    } catch (_) {}
  }

  function tickMusic(dt) {
    if (!musicOn || !musicNodes) return;
    const theme = musicTheme || "play";
    try {
      const specs = {
        intro: { pace: 0.28, scale: [262, 294, 330, 392, 440], pattern: [0, 2, 4, 2, 3, 4, 5, 4], type: "sine", peak: 0.09, len: 0.22 },
        title: { pace: 0.26, scale: [294, 330, 370, 392, 440, 494], pattern: [0, 2, 4, 5, 4, 2, 3, 0, 4, 2], type: "triangle", peak: 0.1, len: 0.2 },
        select: { pace: 0.2, scale: [330, 370, 392, 440, 494, 523], pattern: [0, 1, 2, 4, 2, 1, 3, 5], type: "triangle", peak: 0.09, len: 0.14 },
        evening: { pace: 0.32, scale: [220, 247, 262, 294, 330, 349], pattern: [0, 2, 3, 2, 4, 3, 2, 0], type: "sine", peak: 0.08, len: 0.28 },
        results: { pace: 0.22, scale: [262, 330, 392, 440, 523, 659], pattern: [0, 2, 4, 5, 4, 2, 3, 5, 4, 2, 0, 0], type: "triangle", peak: 0.11, len: 0.18 },
      };
      let spec = specs[theme];
      if (theme === "play") {
        const distPace =
          currentDistrict === "media" ? 0.15 : currentDistrict === "donor" ? 0.17 : currentDistrict === "campus" ? 0.19 : 0.22;
        const scales = {
          plaza: [262, 294, 330, 349, 392, 440],
          media: [277, 311, 370, 415, 466, 554],
          campus: [294, 330, 370, 392, 440, 494],
          donor: [247, 294, 330, 370, 440, 523],
        };
        const patterns = {
          plaza: [0, 2, 4, 2, 5, 4, 3, 0],
          media: [0, 3, 5, 3, 4, 1, 5, 2],
          campus: [0, 2, 3, 5, 4, 2, 1, 0],
          donor: [0, 4, 2, 5, 3, 4, 1, 0],
        };
        const d = currentDistrict || "plaza";
        const seasonShift = { winter: 0.84, spring: 1.06, summer: 1.18, fall: 0.94 }[(campaign && campaign.season) || ""] || 1;
        const chapterShift = 1 + (((campaign && campaign.chapter) || 0) % 4) * 0.025;
        spec = {
          pace: distPace,
          scale: (scales[d] || scales.plaza).map((note) => note * seasonShift * chapterShift),
          pattern: patterns[d] || patterns.plaza,
          type: d === "media" ? "triangle" : d === "donor" ? "triangle" : "sine",
          peak: 0.1 * (d === "plaza" ? 1 : 1.12),
          len: 0.16,
        };
      }
      if (!spec) return;
      musicAcc += dt;
      if (musicAcc < spec.pace) return;
      musicAcc = 0;
      const ac = musicNodes.ac;
      const idx = patternIndex(spec.pattern, musicStep);
      musicStep++;
      musicBar++;
      const note = spec.scale[idx % spec.scale.length];
      // Occasional harmony (every 4th step) — major third
      const voices = musicBar % 4 === 0 ? [1, 5 / 4] : [1];
      const t0 = ac.currentTime;
      voices.forEach((mult, vi) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = spec.type;
        o.frequency.value = note * mult;
        o.connect(g);
        g.connect(musicNodes.master);
        // Master already scales by musicVol; note peak is relative
        const p = Math.max(0.0002, spec.peak * (vi ? 0.38 : 1) * 0.55);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(p, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.len);
        o.start(t0);
        o.stop(t0 + spec.len + 0.02);
      });
    } catch (_) {}
  }

  function patternIndex(pattern, step) {
    return pattern[step % pattern.length];
  }

  function font(size, weight) {
    const s = Math.round(size * textScale);
    return (weight ? weight + " " : "") + s + "px Segoe UI,sans-serif";
  }

  loadAssets();

  // ─── Data ────────────────────────────────────────────────────
  // ─── Data from data.js (v1.2 module split) ───────────────────
  const _D =
    (typeof window !== "undefined" && window.ORANGE_DATA) ||
    (typeof globalThis !== "undefined" && globalThis.ORANGE_DATA) ||
    {};
  const CHARACTERS = _D.CHARACTERS;
  const VOTER_GROUPS = _D.VOTER_GROUPS;
  const DISTRICTS = _D.DISTRICTS;
  const COALITIONS = _D.COALITIONS;
  const BOARD_RULES = _D.BOARD_RULES;
  const MICRO_EVENTS = _D.MICRO_EVENTS;
  const HEADLINES = _D.HEADLINES || [
    "Fountain closed for 'vibes assessment.'",
    "Town Board loses another sticky note.",
  ];
  const MILESTONES = _D.MILESTONES || [];
  const ACHIEVEMENT_DEFS = _D.ACHIEVEMENT_DEFS || [];
  const POWER_RANK_COST = _D.POWER_RANK_COST;
  const DAILY_OBJECTIVES = _D.DAILY_OBJECTIVES;
  const ROTATABLE_DAY_EVENTS = _D.ROTATABLE_DAY_EVENTS;
  const CRISES = _D.CRISES;
  const MAP_W = _D.MAP_W;
  const MAP_H = _D.MAP_H;
  const ZONES = _D.ZONES;
  const DISTRICT_SPAWNS = _D.DISTRICT_SPAWNS;
  const CLUTTER = _D.CLUTTER;
  const NPCS = _D.NPCS;
  const BUTTON_SPOTS = _D.BUTTON_SPOTS;
  const CAMPAIGN_SEASONS = _D.CAMPAIGN_SEASONS || {};
  const CAMPAIGN_CHAPTERS = _D.CAMPAIGN_CHAPTERS || [];
  if (!CHARACTERS || !ZONES) {
    console.error("ORANGE_DATA missing — load data.js before game.js");
  }


  // ─── State ───────────────────────────────────────────────────
  const keys = Object.create(null);
  let touchMove = { x: 0, y: 0 };
  let state = "intro"; // intro | title | select | chapter | play | pause | evening | results
  let introT = 0; // seconds into cold-open
  const INTRO_DUR = 5.5; // auto-advance to title
  let charIdx = 0;
  let selected = null;
  let player = null;
  let cam = { x: 0, y: 0 };
  let time = 0; // 0..1 day progress
  let daySec = 0;
  let dayIndex = 1; // 1..MAX_DAYS
  let coins = 0;
  let rep = 0; // legacy aggregate from axes
  let axes = { street: 0, donor: 0, heat: 0 };
  let powerRank = 0; // 0..3 Phase B power tree
  let spatCount = 0;
  let anger = 0; // 0–100 composure / burst meter (bureaucracy + antagonists)
  let dialogue = null; // { lines:[], i, npcId, onDone, angerPer }
  let karenDay = 0;
  let drunkDay = 0;
  let catLadyDay = 0;
  let camPunch = 0;
  let redistribT = 0;
  let launchT = 0;
  let brandT = 0;
  let potholePaid = 0; // Paver Pete's grift counter
  let consultantPaid = 0; // Consultant Cole synergy memos
  let coleDay = 0; // once-per-day Cole invoice
  let boeDay = 0, adDay = 0; // once-per-day "microtransaction" gags
  let currentDistrict = "plaza";
  let setpieces = { debate: false, scandal: false, march: false, gala: false };
  let scandals = []; // scrapbook strings
  let codexSeen = {}; // voter id -> true once recruited or viewed
  let showCodex = false;
  let lateNights = 0;
  let msg = "";
  let msgT = 0;
  let toastQueue = []; // sequential toasts — no more clobbering mid-errand
  let pendingBurst = null; // defer anger burst until dialogue ends
  let log = [];
  let conversationLog = [];
  let heardNpcLines = {};
  let showConversations = false;
  let objProg = {};
  let voters = []; // recruited group ids
  let voterLoyalty = {};
  let voterFavor = {}; // id -> task pings toward favorNeed (must grind errands to recruit)
  // Week-has-teeth layer (light meta — does not rewrite axes/coalitions)
  let rivalPressure = 0; // 0–8; rises if you ignore unlocked districts
  let rivalStealsWeek = 0; // cap steals so roster can't be gutted
  let rivalStoleToday = false;
  let districtsVisitedToday = { plaza: true };
  let recruitsToday = 0; // successful new joins this calendar day
  let boardTipId = null; // daily uncommitted bloc sticky on BOARD
  const RIVAL_NAME = "Rival Campaign (Generic)"; // fictional archetype, no real people
  // Civic Texture Pack
  let dayHeadline = "";
  let photoDay = 0; // booth photo-op once/day
  let pigeonPecks = 0; // 3 → conspiracy whisper
  let pigeonDoneWeek = false;
  let fountainToyDay = 0; // Tiny crawl once/day
  let beansCoffeeDay = 0; // Bernie free drip once/day
  let micChain = []; // Rally: recent talk timestamps for human-mic
  let coalFanfareId = null; // coalition id that already got fanfare this week
  let coalPerkDay = 0; // day number while one-day coin/button perk active
  let reconDay = 0; // spat reconciliation once/day
  let hasPermit = false;
  let permitDelivered = false;
  let coffeeFixed = false;
  let crateMoved = false;
  let buttons = 0;
  let upgraded = false;
  let toolLevel = 0;
  let lockedOpen = false;
  let orderUsed = false;
  let orderMode = null; // 'door' | 'discount'
  let rallyT = 0;
  let squeezeActive = false;
  let inTunnel = false;
  let homeReady = false;
  let dayEnded = false;
  let debateDone = false;
  let debateWon = false;
  let floaters = [];
  let particles = [];
  let balloons = []; // {x,y,text,life,max}
  let ambient = [];
  let interactFlash = 0;
  let showObj = true;
  let footDustT = 0;
  let selectHover = 0;
  let results = null;
  let evening = null; // evening report payload
  let animT = 0;
  let lastInteract = 0;
  let seedFlags = {};
  let titleFocus = "new"; // new | continue
  let campaign = null;
  let chapterPhase = "intro"; // intro | decision | exit
  let chapterDecisionIndex = 0;
  let chapterChoice = 0;
  let chapterMission = null;
  const chapterPad = { up: false, down: false, confirm: false };

  const CHAPTER_MISSIONS = {
    election: { label: "Recover the permit and face the civic stage", steps: ["mailbox", "mayor", "stage"], readiness: 0 },
    festival: { label: "Prepare the route and find the mascot", steps: ["stage", "park"], readiness: 0 },
    championship: { label: "Ready the venue and welcome the crowd", steps: ["stage", "booth"], readiness: 0 },
    storm: { label: "Stock supplies, open shelter, evacuate home", steps: ["coffee", "park", "home"], readiness: 4 },
    recovery: { label: "Deliver supplies and approve repairs", steps: ["park", "crate", "mayor"], readiness: 2 },
    budget: { label: "Hear residents and file the civic budget", steps: ["board", "mayor"], readiness: 0 },
    reelection: { label: "Present the record and return to voters", steps: ["booth", "stage", "home"], readiness: 0 },
  };

  function calendarSeason() {
    const m = new Date().getMonth();
    return m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "fall";
  }

  function newCampaign(season) {
    const key = CAMPAIGN_SEASONS[season] ? season : calendarSeason();
    const loyalty = {};
    VOTER_GROUPS.forEach((v) => (loyalty[v.id] = 50));
    ["families", "business", "fans", "street"].forEach((id) => (loyalty[id] = 50));
    return {
      season: key,
      chapter: 0,
      loyalty,
      infrastructure: 0,
      readiness: 0,
      rescues: 0,
      promises: {},
      districts: {},
      decisions: [],
      weeks: 0,
      electionWins: 0,
      electionLosses: 0,
      inOffice: true,
      complete: false,
    };
  }

  function campaignChapter() {
    return CAMPAIGN_CHAPTERS[(campaign && campaign.chapter) || 0] || CAMPAIGN_CHAPTERS[0] || null;
  }

  function campaignSeason() {
    return CAMPAIGN_SEASONS[(campaign && campaign.season) || calendarSeason()] || {};
  }

  function campaignMaxDays() {
    const chapter = campaignChapter();
    return chapter ? chapter.days || MAX_DAYS : MAX_DAYS;
  }

  function campaignMusicKey() {
    const chapter = campaignChapter();
    const season = campaignSeason();
    return (chapter && chapter.music) || season.music || "campaign_plaza";
  }

  function campaignView() {
    const chapter = campaignChapter();
    return campaign && {
      season: campaign.season,
      chapterIndex: campaign.chapter,
      chapterId: chapter && chapter.id,
      role: campaign.inOffice ? (chapter && chapter.role) : "Opposition Organizer",
      inOffice: campaign.inOffice,
      status: campaign.complete ? "complete" : "active",
      loyalty: { ...campaign.loyalty },
      infrastructure: campaign.infrastructure,
      readiness: campaign.readiness,
      rescues: campaign.rescues,
      eventHistory: campaign.decisions.slice(),
      mission: chapterMissionView(),
    };
  }

  function chapterMissionView() {
    return chapterMission && {
      chapter: chapterMission.chapter,
      id: chapterMission.id,
      label: chapterMission.label,
      steps: chapterMission.steps.slice(),
      target: chapterMission.steps.length,
      progress: chapterMission.progress,
      completed: chapterMission.completed,
      success: chapterMission.success,
      failed: chapterMission.failed,
      finishedDay: chapterMission.finishedDay,
    };
  }

  function initChapterMission() {
    const chapter = campaignChapter();
    const spec = chapter && CHAPTER_MISSIONS[chapter.id];
    chapterMission = spec ? {
      chapter: chapter.id,
      id: `${chapter.id}-fieldwork`,
      label: spec.label,
      steps: spec.steps.slice(),
      readiness: spec.readiness,
      progress: 0,
      completed: false,
      success: null,
      failed: false,
      finishedDay: null,
    } : null;
    return chapterMissionView();
  }

  function progressChapterMission(zoneId) {
    if (!chapterMission || chapterMission.completed || chapterMission.failed) return false;
    if (chapterMission.steps[chapterMission.progress] !== zoneId) return false;
    chapterMission.progress += 1;
    chapterMission.completed = chapterMission.progress >= chapterMission.steps.length;
    if (chapterMission.completed) {
      chapterMission.finishedDay = dayIndex;
      toast(`Chapter mission complete: ${chapterMission.label}.`);
      pushLog(`Completed ${chapterMission.label}.`);
      if (campaign) campaign.readiness += 1;
    } else {
      toast(`Mission ${chapterMission.progress}/${chapterMission.steps.length}: next stop ${chapterMission.steps[chapterMission.progress].toUpperCase()}.`);
    }
    return true;
  }

  function finalizeChapterMission() {
    if (!chapterMission) return null;
    if (chapterMission.success != null) return chapterMissionView();
    const preparation = (campaign ? campaign.readiness : 0) + Math.floor((campaign ? campaign.infrastructure : 0) / 6);
    const onTime = chapterMission.finishedDay != null && chapterMission.finishedDay <= campaignMaxDays();
    chapterMission.success = chapterMission.completed && onTime && preparation >= chapterMission.readiness;
    chapterMission.failed = !chapterMission.success;
    if (campaign) {
      adjustCampaignLoyalty("families", chapterMission.success ? 4 : -5);
      adjustCampaignLoyalty("policy", chapterMission.success ? 3 : -4);
      if (chapterMission.success) campaign.infrastructure += 1;
    }
    return chapterMissionView();
  }

  function currentCampaignWeather() {
    const season = campaignSeason();
    const names = season.weather || ["clear"];
    const name = names[(dayIndex - 1) % names.length] || "clear";
    const harsh = /snow|ice|rain|flood|heat|thunder|wind/.test(name);
    const protection = Math.min(0.18, ((campaign && campaign.readiness) || 0) * 0.015 + ((campaign && campaign.infrastructure) || 0) * 0.005);
    return { name, movement: harsh ? Math.min(1, 0.78 + protection) : 1, time: harsh ? Math.min(1, 0.88 + protection) : 1 };
  }

  function setCampaignDaySeconds() {
    DAY_SECONDS_BASE = DAY_LENGTHS[dayLengthMode] || DAY_LENGTHS.normal;
    const season = campaignSeason();
    const daylight = season.daylight || [1];
    const seasonMult = daylight[Math.min(daylight.length - 1, Math.floor(((campaign && campaign.chapter) || 0) / 2))] || 1;
    const chapter = campaignChapter();
    const chapterMult =
      chapter && chapter.dayLength === "short-crisis" ? 0.72 :
      chapter && (chapter.dayLength === "long-evening" || chapter.dayLength === "event-night") ? 1.18 :
      chapter && chapter.dayLength === "adaptive-damage" ? clamp(1.12 - ((campaign && campaign.infrastructure) || 0) * 0.01, 0.82, 1.12) : 1;
    const civicCapacity = 1 + Math.min(0.12, ((campaign && campaign.infrastructure) || 0) * 0.006);
    const kept = campaign ? Object.values(campaign.promises || {}).filter((v) => v === "kept").length : 0;
    const broken = campaign ? Object.values(campaign.promises || {}).filter((v) => v === "broken").length : 0;
    const promiseTrust = clamp(1 + kept * 0.01 - broken * 0.02, 0.9, 1.08);
    DAY_SECONDS = Math.round(DAY_SECONDS_BASE * seasonMult * chapterMult * civicCapacity * promiseTrust * currentCampaignWeather().time);
    return DAY_SECONDS;
  }

  let eventDayMap = {}; // event id -> day (2-6), reshuffled each new game by shuffleDayEvents()

  /**
   * Assign debate/scandal/media/march/gala to a fresh, random permutation of
   * days 2-6 each new game, respecting each event's minDay (its home
   * district's unlock day). Most-constrained-first: gala (minDay 4) picks
   * from {4,5,6} before march (minDay 3) picks from what's left, so neither
   * can ever get boxed out by an earlier, less-constrained pick.
   */
  function shuffleDayEvents() {
    let remaining = [2, 3, 4, 5, 6];
    function takeRandom(minDay) {
      const eligible = remaining.filter((d) => d >= minDay);
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];
      remaining = remaining.filter((d) => d !== chosen);
      return chosen;
    }
    const order = Object.keys(ROTATABLE_DAY_EVENTS).sort((a, b) => ROTATABLE_DAY_EVENTS[b].minDay - ROTATABLE_DAY_EVENTS[a].minDay);
    const map = {};
    order.forEach((id) => {
      map[id] = takeRandom(ROTATABLE_DAY_EVENTS[id].minDay);
    });
    eventDayMap = map;
  }

  function eventIdForDay(day) {
    return Object.keys(eventDayMap).find((id) => eventDayMap[id] === day) || null;
  }

  function getCrisis() {
    const base = CRISES.find((c) => c.day === dayIndex) || CRISES[0];
    const eventId = eventIdForDay(dayIndex);
    return {
      ...base,
      debateDay: eventId === "debate",
      scandalDay: eventId === "scandal",
      marchDay: eventId === "march",
      galaDay: eventId === "gala",
    };
  }

  function districtUnlocked(id) {
    const d = DISTRICTS.find((x) => x.id === id);
    return d ? dayIndex >= d.unlockDay : false;
  }

  function travelTo(districtId) {
    if (!districtUnlocked(districtId)) {
      const d = DISTRICTS.find((x) => x.id === districtId);
      toast(`${d ? d.name : "That district"} unlocks on day ${d ? d.unlockDay : "?"}.`);
      sfx("warn");
      return false;
    }
    const sp = DISTRICT_SPAWNS[districtId];
    if (!sp || !player) return false;
    const prev = currentDistrict;
    currentDistrict = districtId;
    districtsVisitedToday[districtId] = true;
    // Showing up cools the rival a notch (light)
    if (districtId !== "plaza" && rivalPressure > 0) rivalPressure = Math.max(0, rivalPressure - 1);
    player.x = sp.x;
    player.y = sp.y;
    const d = DISTRICTS.find((x) => x.id === districtId);
    banner(d ? d.name : districtId, d ? d.color : "#fff", 1.6);
    toast(`Arrived: ${d ? d.name : districtId}`);
    sfx(prev !== districtId ? "district" : "ok");
    pushLog(`Traveled to ${d ? d.name : districtId}.`);
    saveGame();
    return true;
  }

  function spawnAmbient() {
    ambient = [];
    for (let i = 0; i < 18; i++) {
      ambient.push({
        x: Math.random() * MAP_W,
        y: Math.random() * MAP_H,
        vx: 8 + Math.random() * 18,
        vy: -6 - Math.random() * 10,
        life: Math.random(),
        kind: Math.random() < 0.5 ? "leaf" : "pollen",
      });
    }
  }

  function resetPlayerPos() {
    player = {
      x: 120,
      y: 140,
      vx: 0,
      vy: 0,
      facing: 1,
      dir: "down",
      bob: 0,
      moving: false,
      walkFrame: 0,
      blinkT: 0,
      blinkOn: false,
    };
  }

  /** Fresh run from character select */
  function resetRun(char, keepCampaign = false) {
    if (!keepCampaign || !campaign) campaign = newCampaign();
    // Fresh game (not a chapter-to-chapter continuation within the same
    // campaign) gets a new debate/scandal/march/gala/media day arrangement
    // — otherwise Day 2 is always the debate, every single playthrough.
    if (!keepCampaign) shuffleDayEvents();
    selected = char;
    dayIndex = 1;
    coins = 12 + (ngPlusBonus || 0); // v1.3: slightly friendlier start + soft NG+
    rep = 0;
    axes = { street: 0, donor: 0, heat: 0 };
    powerRank = 0;
    spatCount = 0;
    anger = 0;
    dialogue = null;
    pendingBurst = null;
    toastQueue = [];
    karenDay = 0;
    drunkDay = 0;
    catLadyDay = 0;
    camPunch = 0;
    redistribT = 0;
    launchT = 0;
    brandT = 0;
    potholePaid = 0;
    consultantPaid = 0;
    coleDay = 0;
    boeDay = 0;
    adDay = 0;
    currentDistrict = "plaza";
    setpieces = { debate: false, scandal: false, march: false, gala: false };
    scandals = [];
    codexSeen = {};
    showCodex = false;
    lateNights = 0;
    voters = [];
    voterLoyalty = {};
    voterFavor = {};
    rivalPressure = 0;
    rivalStealsWeek = 0;
    rivalStoleToday = false;
    districtsVisitedToday = { plaza: true };
    recruitsToday = 0;
    boardTipId = null;
    dayHeadline = "";
    photoDay = 0;
    pigeonPecks = 0;
    pigeonDoneWeek = false;
    fountainToyDay = 0;
    beansCoffeeDay = 0;
    micChain = [];
    coalFanfareId = null;
    coalPerkDay = 0;
    reconDay = 0;
    upgraded = false;
    toolLevel = 0;
    lockedOpen = false;
    debateDone = false;
    debateWon = false;
    results = null;
    evening = null;
    log = ngPlusBonus ? ["Soft NG+: +" + ngPlusBonus + "¢ from last strong week."] : [];
    conversationLog = [];
    heardNpcLines = {};
    showConversations = false;
    initChapterMission();
    beginDay(true);
  }

  /** Start or resume a calendar day (keeps meta progress) */
  function beginDay(isNewRun) {
    setCampaignDaySeconds();
    resetPlayerPos();
    currentDistrict = "plaza";
    spawnAmbient();
    balloons = [];
    floaters = [];
    particles = [];
    time = 0;
    daySec = 0;
    dayEnded = false;
    launchT = 0;
    brandT = 0;
    // allow one micro-event per day
    if (seedFlags) seedFlags.microToday = false;
    orderUsed = false;
    orderMode = null;
    rallyT = 0;
    squeezeActive = false;
    inTunnel = false;
    homeReady = false;
    hasPermit = false;
    permitDelivered = false;
    coffeeFixed = false;
    crateMoved = false;
    buttons = 0;
    // tool upgrade persists; locked door stays if already open this run
    objProg = {}; // each id defaults to 0 via the ||0 reads in setObj/objDone
    BUTTON_SPOTS.forEach((b) => (b.taken = false));
    // reset crate position
    const crate = getZone("crate");
    if (crate) crate.x = 250;
    // locked zone visual if still locked
    const locked = ZONES.find((z) => z.id === "locked" || z.id === "unlocked");
    if (locked && !lockedOpen) {
      locked.id = "locked";
      locked.label = "LOCKED";
      locked.color = "#3a3a55";
    }
    seedFlags = { permitAtMail: true };
    districtsVisitedToday = { plaza: true };
    recruitsToday = 0;
    rivalStoleToday = false;
    boardTipId = pickBoardTipId();
    dayHeadline = HEADLINES[(dayIndex * 3 + (selected ? selected.id.length : 0)) % HEADLINES.length];
    photoDay = 0; // reset daily flags that should re-arm
    fountainToyDay = 0;
    beansCoffeeDay = 0;
    reconDay = 0;
    micChain = [];
    if (coalPerkDay && coalPerkDay !== dayIndex) coalPerkDay = 0;
    const crisis = getCrisis();
    const rule = getBoardRule();
    const unlockedToday = DISTRICTS.filter((d) => d.id !== "plaza" && d.unlockDay === dayIndex).map((d) => d.name);
    // Don't spoiler total week length in the morning blurb — just "today"
    let morning = `Day ${dayIndex}: ${crisis.title} · Rule: ${rule.title}`;
    if (unlockedToday.length) morning += ` · Opens: ${unlockedToday.join(", ")}`;
    msg = morning + (dayHeadline ? "  ·  📰 " + dayHeadline : "");
    msgT = unlockedToday.length ? 5.8 : 5.0;
    if (isNewRun) log = [];
    pushLog(`Morning — Day ${dayIndex}. Crisis: ${crisis.title}. Rule: ${rule.title}.`);
    if (dayHeadline) pushLog("Headline: " + dayHeadline);
    if (unlockedToday.length) pushLog("District open: " + unlockedToday.join(", ") + ".");
    if (boardTipId) {
      const tipG = VOTER_GROUPS.find((v) => v.id === boardTipId);
      if (tipG) pushLog(`Board sticky: ${tipG.name} — ${tipG.recruitHint}`);
    }
    // Policy bloc permit ease: free small progress chance
    const coal = activeCoalition();
    if (coal && coal.id === "policy" && Math.random() < 0.4) {
      seedFlags.permitAtMail = true;
      pushLog("Policy Bloc: a clerk left the permit path obvious.");
    }
    // Only seed on a true New Week so Continue / mid-day loads don't re-queue tips
    if (isNewRun) seedTutorialTips();
    sfx("day");
    // Music theme follows state via syncMusic() in update
    saveGame();
  }

  function serializeRun() {
    return {
      v: 2,
      campaign: campaign ? JSON.parse(JSON.stringify(campaign)) : null,
      chapterMission: chapterMission ? JSON.parse(JSON.stringify(chapterMission)) : null,
      dayIndex,
      coins,
      rep,
      axes: { ...axes },
      powerRank,
      spatCount,
      anger,
      currentDistrict,
      setpieces: { ...setpieces },
      scandals: scandals.slice(),
      codexSeen: { ...codexSeen },
      lateNights,
      voters: voters.slice(),
      voterLoyalty: { ...voterLoyalty },
      voterFavor: { ...voterFavor },
      upgraded,
      toolLevel,
      lockedOpen,
      debateDone,
      debateWon,
      charId: selected && selected.id,
      log: log.slice(0, 12),
      conversationLog: conversationLog.slice(0, 24),
      heardNpcLines: { ...heardNpcLines },
      midDay: state === "play" && !dayEnded,
      time,
      daySec,
      objProg: { ...objProg },
      hasPermit,
      permitDelivered,
      coffeeFixed,
      crateMoved,
      buttons,
      orderUsed,
      orderMode,
      player: player ? { x: player.x, y: player.y, facing: player.facing, dir: player.dir } : null,
      seedFlags: { ...seedFlags },
      buttonTaken: BUTTON_SPOTS.map((b) => b.taken),
      sfxOn,
      musicOn,
      sfxVol,
      musicVol,
      textScale,
      reduceFlash,
      dayLengthMode,
      ngPlusBonus,
      potholePaid,
      consultantPaid,
      coleDay,
      boeDay,
      adDay,
      rivalPressure,
      rivalStealsWeek,
      boardTipId,
      recruitsToday,
    };
  }

  function slotKey(n) {
    return SLOT_PREFIX + (n || saveSlot);
  }

  function saveGame() {
    if (!selected) return false;
    try {
      if (typeof localStorage === "undefined") return false;
      const payload = JSON.stringify(serializeRun());
      localStorage.setItem(SAVE_KEY, payload); // legacy continue
      localStorage.setItem(slotKey(saveSlot), payload);
      return true;
    } catch (_) {
      return false;
    }
  }

  function parseSaveRaw(raw) {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data && data.charId && data.dayIndex ? data : null;
    } catch (_) {
      return null;
    }
  }

  function hasSave(slot) {
    try {
      if (typeof localStorage === "undefined") return false;
      // Explicit slot: that key only (no legacy fallback — empty slots stay empty).
      if (slot != null) return !!parseSaveRaw(localStorage.getItem(slotKey(slot)));
      // No arg: any slot 1–3, else legacy continue key.
      for (let s = 1; s <= 3; s++) {
        if (parseSaveRaw(localStorage.getItem(slotKey(s)))) return true;
      }
      return !!parseSaveRaw(localStorage.getItem(SAVE_KEY));
    } catch (_) {
      return false;
    }
  }

  /** Preview meta for title save cards (null if empty). */
  function getSaveMeta(slot) {
    try {
      if (typeof localStorage === "undefined") return null;
      const data = parseSaveRaw(localStorage.getItem(slotKey(slot)));
      if (!data) return null;
      const char = CHARACTERS.find((c) => c.id === data.charId);
      const distId = data.currentDistrict || "plaza";
      const dist = DISTRICTS.find((d) => d.id === distId);
      const nVoters = Array.isArray(data.voters) ? data.voters.length : 0;
      return {
        slot,
        charId: data.charId,
        charName: char ? char.name : data.charId || "Citizen",
        charShort: char ? char.short : "?",
        charColor: char ? char.color : "#ff8c28",
        dayIndex: data.dayIndex | 0,
        coins: data.coins | 0,
        voters: nVoters,
        district: dist ? dist.name : "Plaza",
        midDay: !!data.midDay,
        axes: data.axes || null,
      };
    } catch (_) {
      return null;
    }
  }

  let titleSaveCards = []; // hit targets for full save cards

  function loadGame(slot) {
    try {
      if (typeof localStorage === "undefined") return false;
      if (slot != null) saveSlot = slot;
      let raw = localStorage.getItem(slotKey(saveSlot));
      // Migrate legacy once into the active slot if that slot is empty.
      if (!raw) {
        const legacy = localStorage.getItem(SAVE_KEY);
        if (legacy && parseSaveRaw(legacy)) {
          raw = legacy;
          try {
            localStorage.setItem(slotKey(saveSlot), legacy);
          } catch (_) {}
        }
      }
      if (!raw) return false;
      const data = JSON.parse(raw);
      campaign = data.campaign || newCampaign();
      chapterMission = data.chapterMission || null;
      if (!chapterMission) initChapterMission();
      const char = CHARACTERS.find((c) => c.id === data.charId);
      if (!char) return false;
      selected = char;
      charIdx = CHARACTERS.indexOf(char);
      dayIndex = clamp(data.dayIndex || 1, 1, campaignMaxDays());
      coins = data.coins | 0;
      axes = data.axes || { street: data.rep || 0, donor: Math.floor((data.rep || 0) * 0.5), heat: 0 };
      rep = data.rep | 0;
      powerRank = clamp(data.powerRank | 0, 0, 3);
      spatCount = data.spatCount | 0;
      anger = clamp(data.anger | 0, 0, 100);
      currentDistrict = data.currentDistrict || "plaza";
      setpieces = data.setpieces || { debate: false, scandal: false, march: false, gala: false };
      scandals = Array.isArray(data.scandals) ? data.scandals.slice() : [];
      codexSeen = data.codexSeen || {};
      lateNights = data.lateNights | 0;
      voters = Array.isArray(data.voters) ? data.voters.slice() : [];
      voters.forEach((id) => {
        codexSeen[id] = true;
      });
      voterLoyalty = data.voterLoyalty || {};
      voterFavor = data.voterFavor || {};
      // Recruited blocs count as fully favored
      voters.forEach((id) => {
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (g) voterFavor[id] = favorNeedOf(g);
      });
      upgraded = !!data.upgraded;
      toolLevel = data.toolLevel | 0;
      lockedOpen = !!data.lockedOpen;
      debateDone = !!data.debateDone;
      debateWon = !!data.debateWon;
      log = Array.isArray(data.log) ? data.log.slice() : [];
      conversationLog = Array.isArray(data.conversationLog) ? data.conversationLog.slice() : [];
      heardNpcLines = data.heardNpcLines || {};
      sfxOn = data.sfxOn !== false;
      musicOn = data.musicOn !== false;
      if (typeof data.sfxVol === "number") sfxVol = data.sfxVol;
      if (typeof data.musicVol === "number") musicVol = data.musicVol;
      if (data.textScale === 1 || data.textScale === 1.15) textScale = data.textScale;
      reduceFlash = !!data.reduceFlash;
      if (data.dayLengthMode && DAY_LENGTHS[data.dayLengthMode]) dayLengthMode = data.dayLengthMode;
      if (typeof data.ngPlusBonus === "number") ngPlusBonus = data.ngPlusBonus;
      potholePaid = data.potholePaid | 0;
      consultantPaid = data.consultantPaid | 0;
      coleDay = data.coleDay | 0;
      boeDay = data.boeDay | 0;
      adDay = data.adDay | 0;
      rivalPressure = clamp(data.rivalPressure | 0, 0, 8);
      rivalStealsWeek = data.rivalStealsWeek | 0;
      if (data.voterFavor) voterFavor = data.voterFavor;
      boardTipId = data.boardTipId || boardTipId;
      recruitsToday = data.recruitsToday | 0;

      if (data.midDay) {
        beginDay(false);
        // restore mid-day
        time = data.time || 0;
        daySec = data.daySec || 0;
        objProg = data.objProg || objProg;
        hasPermit = !!data.hasPermit;
        permitDelivered = !!data.permitDelivered;
        coffeeFixed = !!data.coffeeFixed;
        crateMoved = !!data.crateMoved;
        buttons = data.buttons | 0;
        orderUsed = !!data.orderUsed;
        orderMode = data.orderMode || null;
        seedFlags = data.seedFlags || { permitAtMail: !hasPermit && !permitDelivered };
        if (Array.isArray(data.buttonTaken)) {
          BUTTON_SPOTS.forEach((b, i) => {
            b.taken = !!data.buttonTaken[i];
          });
        }
        if (crateMoved) {
          const crate = getZone("crate");
          if (crate) crate.x = 340;
        }
        if (lockedOpen) {
          const locked = ZONES.find((z) => z.id === "locked" || z.id === "unlocked");
          if (locked) {
            locked.id = "unlocked";
            locked.label = "OPEN";
            locked.color = "#5a7a9a";
          }
        }
        if (data.player) {
          player.x = data.player.x;
          player.y = data.player.y;
          player.facing = data.player.facing || 1;
          player.dir = data.player.dir || "down";
        }
        toast(`Continued Day ${dayIndex}. Crisis: ${getCrisis().title}.`);
      } else {
        // saved at evening or start — begin current day fresh morning of dayIndex
        beginDay(false);
        toast(`Continued — morning of Day ${dayIndex}.`);
      }
      state = "play";
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Wipe a save file. Pass slot 1–3, or omit for the active saveSlot.
   * Also clears legacy SAVE_KEY when wiping the active slot.
   */
  function clearSave(slot) {
    const s = slot != null ? slot | 0 : saveSlot;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(slotKey(s));
        if (s === saveSlot) localStorage.removeItem(SAVE_KEY);
      }
    } catch (_) {}
  }

  // Title: second-press confirm for overwrite / delete (slot + action + timestamp)
  let titlePending = null;

  function titlePendingFresh(action, slot) {
    return (
      titlePending &&
      titlePending.action === action &&
      titlePending.slot === slot &&
      performance.now() - titlePending.t < 4000
    );
  }

  /** Start a new week in this file. Filled slots need a second confirm (N again). */
  function requestNewInSlot(slot) {
    const s = slot != null ? slot | 0 : saveSlot;
    saveSlot = s;
    if (!hasSave(s)) {
      titlePending = null;
      titleFocus = "new";
      state = "select";
      toast("New week — File " + s + ". Pick a citizen.");
      sfx("ok");
      return true;
    }
    if (titlePendingFresh("new", s)) {
      titlePending = null;
      titleFocus = "new";
      state = "select";
      toast("New week in File " + s + " — overwrites when you start.");
      sfx("ok");
      return true;
    }
    titlePending = { action: "new", slot: s, t: performance.now() };
    toast("File " + s + " has a save. Press N again to start NEW (overwrites).");
    sfx("warn");
    return false;
  }

  /** Delete a save file. Needs a second Del/Backspace confirm when filled. */
  function requestDeleteSlot(slot) {
    const s = slot != null ? slot | 0 : saveSlot;
    saveSlot = s;
    if (!hasSave(s)) {
      titlePending = null;
      toast("File " + s + " is already empty.");
      sfx("blip");
      return false;
    }
    if (titlePendingFresh("delete", s)) {
      titlePending = null;
      clearSave(s);
      titleFocus = "new";
      toast("File " + s + " deleted. Ready for a new week.");
      sfx("sleep");
      return true;
    }
    titlePending = { action: "delete", slot: s, t: performance.now() };
    toast("Delete File " + s + "? Press Del / Backspace again to confirm.");
    sfx("warn");
    return false;
  }

  /** Continue a filled slot, or new if empty. */
  function activateTitleSlot(slot) {
    const s = slot != null ? slot | 0 : saveSlot;
    saveSlot = s;
    titlePending = null;
    ensureAudio();
    if (hasSave(s)) {
      titleFocus = "continue";
      if (!loadGame(s)) {
        titleFocus = "new";
        state = "select";
      }
    } else {
      titleFocus = "new";
      state = "select";
    }
  }

  function queueTip(id, text) {
    if (tipsSeen[id]) return;
    tipQueue.push({ id, text });
  }

  function pumpTips(dt) {
    if (tipT > 0) {
      tipT -= dt;
      return;
    }
    if (!tipQueue.length || state !== "play") return;
    const t = tipQueue.shift();
    tipsSeen[t.id] = true;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(TIPS_KEY, JSON.stringify(tipsSeen));
    } catch (_) {}
    toast("Tip: " + t.text, 4.5);
    sfx("blip");
    tipT = 0.8;
  }

  function seedTutorialTips() {
    if (dayIndex !== 1) return;
    queueTip("board", "Check the Town BOARD for today's crisis and civic rule.");
    queueTip("e", "Press E near people and buildings to interact.");
    queueTip("q", "Q uses your power. At the VEND, Q also buys tool/power upgrades.");
    queueTip("home", "After midday (or when objectives are done), sleep at HOME to end the day.");
    queueTip("gates", "District gates unlock later: Media D2 · Campus D3 · Donors D4.");
    queueTip("codex", "C = voter codex · G = achievements · H = glossary · O = options.");
    queueTip("slots", "Title: 1–3 pick File · Enter continue · N new (overwrite) · Del erase.");
    queueTip("favor", "Voters need ERRANDS (favor), not small talk. Check codex hints.");
    queueTip("composure", "💢 Composure: Karen, Doug & Clara raise it. Park bench or coffee cools it — bursting scatters ¢.");
    queueTip("texture", "Peck pigeons · booth photo · park can cool spats for 8¢.");
  }

  // ─── Helpers ─────────────────────────────────────────────────
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function dist(ax, ay, bx, by) {
    const dx = ax - bx,
      dy = ay - by;
    return Math.hypot(dx, dy);
  }
  function zoneCenter(z) {
    return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
  }
  function getZone(id) {
    return ZONES.find((z) => z.id === id);
  }
  function inZone(px, py, z, pad = 8) {
    return px > z.x - pad && px < z.x + z.w + pad && py > z.y - pad && py < z.y + z.h + pad;
  }
  function nearPoint(px, py, x, y, r = INTERACT_R) {
    return dist(px, py, x, y) < r;
  }
  /**
   * Queue toasts so mid-errand pings don't wipe achievements / monologue lines.
   * opts.now = show immediately (dialogue lines); still preserves queued rest.
   */
  function toast(t, sec = 3, opts) {
    if (!t) return;
    const s = sec == null ? 3 : sec;
    if (opts && opts.now) {
      msg = t;
      msgT = s;
      return;
    }
    // Free slot — show now
    if (msgT <= 0.12 || !msg) {
      msg = t;
      msgT = s;
      return;
    }
    // Dedup current + tail of queue
    if (msg === t) return;
    const tail = toastQueue.length ? toastQueue[toastQueue.length - 1] : null;
    if (tail && tail.t === t) return;
    if (toastQueue.length >= 6) toastQueue.shift();
    toastQueue.push({ t, sec: s });
  }

  function drainToastQueue() {
    if (msgT > 0 && msg) return;
    if (!toastQueue.length) {
      if (msgT <= 0) msg = "";
      return;
    }
    const next = toastQueue.shift();
    msg = next.t;
    msgT = next.sec;
  }
  function balloon(x, y, text, sec = 2.4) {
    // Keep bubbles short so they don't cover half the plaza
    let t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length > 36) t = t.slice(0, 34) + "…";
    balloons.push({ x, y, text: t, life: sec, max: sec });
    if (balloons.length > 6) balloons.shift();
  }
  function canSleepAtHome() {
    return allMainDone() || time >= NIGHT_AT * 0.82 || daySec > DAY_SECONDS * 0.5;
  }
  function pushLog(t) {
    log.unshift(t);
    if (log.length > 8) log.pop();
  }
  function rememberNpcLine(n, line) {
    if (!n || !line) return;
    const key = n.id + "|" + line;
    if (heardNpcLines[key]) return;
    heardNpcLines[key] = true;
    const entry = `Day ${dayIndex} · ${n.name}: ${line}`;
    conversationLog.unshift(entry);
    if (conversationLog.length > 24) conversationLog.pop();
    pushLog(entry);
  }
  function floatText(x, y, text, color = "#fff") {
    floaters.push({ x, y, text, color, life: 1.4 });
  }
  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80 - 20,
        life: 0.5 + Math.random() * 0.5,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }
  function activeCoalition() {
    let best = null;
    let bestCount = 0;
    for (const c of COALITIONS) {
      const n = c.members.filter((id) => voters.includes(id)).length;
      if (n >= 2 && n > bestCount) {
        best = c;
        bestCount = n;
      } else if (n >= 2 && n === bestCount && c.members.every((id) => voters.includes(id))) {
        best = c;
      }
    }
    // prefer full 3-of-3
    for (const c of COALITIONS) {
      if (c.members.every((id) => voters.includes(id))) return { ...c, strength: 3 };
    }
    return best ? { ...best, strength: bestCount } : null;
  }

  function getBoardRule() {
    // Mix classic 7 with 1.1 extras so weeks feel less identical
    const idx = (dayIndex - 1 + (dayIndex > 4 ? 2 : 0)) % BOARD_RULES.length;
    return BOARD_RULES[idx];
  }

  function addAnger(n, reason) {
    if (!n) return;
    const prev = anger;
    anger = clamp((anger || 0) + n, 0, 100);
    if (n > 0 && player) {
      floatText(player.x + 18, player.y - 48, (n > 0 ? "+" : "") + n + " 💢", n > 0 ? "#e06060" : "#80e0a0");
    }
    if (prev < 100 && anger >= 100) {
      // Never steal mid-monologue — fire after Clara (etc.) finishes
      if (dialogue) {
        pendingBurst = reason || "tension";
      } else {
        burstAnger(reason);
      }
    }
  }

  function calmAnger(n, reason) {
    if (!n) return;
    anger = clamp((anger || 0) - Math.abs(n), 0, 100);
    if (anger < 100) pendingBurst = null;
    if (player) floatText(player.x - 18, player.y - 48, "−" + Math.abs(n) + " 💢", "#80e0a0");
  }

  function burstAnger(reason) {
    pendingBurst = null;
    anger = 28;
    // Coin floor: never wipe you below ~5¢ (day-1 especially brutal otherwise)
    const maxSteal = Math.max(0, coins - 5);
    const want = 6 + Math.floor(Math.random() * 5); // 6–10
    const lost = Math.min(maxSteal, want);
    coins = Math.max(0, coins - lost);
    addAxes({ heat: 5, street: -3 });
    punch(0.45);
    banner("COMPOSE YOURSELF", "#e04040", 2.5);
    toast(
      "You BURST. " +
        (lost ? lost + "¢ scatter (kept a few). " : "Empty pockets — still look wild. ") +
        "Heat spikes. Park / coffee cools you.",
      4,
      { now: true }
    );
    pushLog("Anger burst" + (reason ? " after " + reason : "") + ". Lost " + lost + "¢.");
    sfx("burst");
    scandals.push("Public outburst day " + dayIndex);
  }

  function startDialogue(npcId, lines, opts) {
    if (!lines || !lines.length) return;
    const n = NPCS.find((x) => x.id === npcId);
    dialogue = {
      npcId,
      lines: lines.slice(),
      i: 0,
      angerPer: (opts && opts.angerPer) || 0,
      timePer: (opts && opts.timePer) || 0, // daySec waste per bubble
      onDone: opts && opts.onDone,
    };
    showDialogueLine();
  }

  function showDialogueLine() {
    if (!dialogue) return;
    const n = NPCS.find((x) => x.id === dialogue.npcId);
    const line = dialogue.lines[dialogue.i];
    if (!line) {
      endDialogue();
      return;
    }
    const name = n ? n.name : "???";
    rememberNpcLine(n, line);
    toast(name + ": " + line, 4.5, { now: true });
    if (n) balloon(n.x, n.y - 40, line.length > 42 ? line.slice(0, 40) + "…" : line, 3.2);
    sfx("blip");
    if (dialogue.angerPer) addAnger(dialogue.angerPer, name);
    if (dialogue.timePer) {
      daySec = Math.min(DAY_SECONDS * 0.95, daySec + dialogue.timePer);
      time = clamp(daySec / DAY_SECONDS, 0, 1);
    }
  }

  function advanceDialogue() {
    if (!dialogue) return false;
    dialogue.i++;
    if (dialogue.i >= dialogue.lines.length) {
      endDialogue();
      return true;
    }
    showDialogueLine();
    return true;
  }

  function endDialogue() {
    if (!dialogue) return;
    const cb = dialogue.onDone;
    const npcId = dialogue.npcId;
    dialogue = null;
    if (typeof cb === "function") cb();
    else if (npcId === "catlady") toast("Clara finally pauses. You escape. Time and patience: gone.");
    // Deferred burst fires only after the monologue fully ends
    if (pendingBurst || anger >= 100) {
      const r = pendingBurst || "after monologue";
      pendingBurst = null;
      if (anger >= 100) burstAnger(r);
    }
  }

  function addCoins(n, reason) {
    let mult = getCrisis().coinMult || 1;
    const rule = getBoardRule();
    if (rule.coinMult) mult *= rule.coinMult;
    const coal = activeCoalition();
    if (voters.includes("crypto") || (coal && coal.id === "money")) mult *= 1.12;
    if (voters.includes("donors")) mult *= 1.08;
    if ((voters.includes("chaos") || (coal && coal.id === "chaos_ticket")) && Math.random() < 0.35) {
      n = Math.ceil(n * 1.5);
      floatText(player.x, player.y - 30, "VIRAL!", "#c060ff");
      addAxes({ heat: 1 });
    }
    if (coal && coal.id === "grassroots" && reason === "shop") mult *= 0.9; // shops worse
    if (coal && coal.id === "money" && reason === "shop") mult *= 1.05;
    if (orderMode === "discount" && reason === "upgrade") mult = 1;
    const gain = Math.round(n * mult);
    coins += gain;
    floatText(player.x, player.y - 18, `+${gain}¢`, "#ffd060");
    if (gain > 0) sfx("coin");
    // Money Machine scandal drip
    if (coal && coal.id === "money" && gain >= 5 && Math.random() < 0.2) addAxes({ heat: 1 });
  }

  /** Phase B: three reputation axes */
  function addAxes({ street = 0, donor = 0, heat = 0 } = {}) {
    let sm = 1,
      dm = 1,
      hm = getBoardRule().heatMult || 1;
    if (voters.includes("wine")) sm *= 1.15;
    if (voters.includes("donors")) dm *= 1.15;
    const coal = activeCoalition();
    if (coal && coal.id === "grassroots" && street > 0) sm *= 1.2;
    if (coal && coal.id === "money" && donor > 0) dm *= 1.15;
    if (voters.includes("moderates") && (street < 0 || heat > 0)) {
      street = street < 0 ? street + 1 : street;
      heat = Math.max(0, heat - 1);
    }
    const ds = Math.round(street * sm);
    const dd = Math.round(donor * dm);
    const dh = Math.round(heat * hm);
    axes.street = clamp((axes.street || 0) + ds, 0, 100);
    axes.donor = clamp((axes.donor || 0) + dd, 0, 100);
    axes.heat = clamp((axes.heat || 0) + dh, 0, 100);
    // legacy aggregate for older UI bits
    rep = Math.round((axes.street + axes.donor - axes.heat * 0.5) / 1.5);
    if (ds) floatText(player.x, player.y - 28, `${ds >= 0 ? "+" : ""}${ds} Street`, "#80e0a0");
    if (dd) floatText(player.x + 20, player.y - 36, `${dd >= 0 ? "+" : ""}${dd} Donor`, "#80c0e0");
    if (dh) floatText(player.x - 20, player.y - 36, `${dh >= 0 ? "+" : ""}${dh} Heat`, "#e080a0");
  }

  function addRep(n) {
    // Map generic rep to Street primarily (community) with light Heat if negative
    if (n >= 0) addAxes({ street: n, donor: Math.floor(n * 0.25) });
    else addAxes({ street: n, heat: Math.ceil(-n * 0.5) });
  }
  function remainingVoterCount() {
    return VOTER_GROUPS.filter((v) => !voters.includes(v.id)).length;
  }

  function pickBoardTipId() {
    const open = VOTER_GROUPS.filter((v) => !voters.includes(v.id));
    if (!open.length) return null;
    // Prefer least-favored (hardest / most neglected)
    open.sort((a, b) => favorOf(a.id) - favorOf(b.id) || (b.favorNeed | 0) - (a.favorNeed | 0));
    return open[0].id;
  }

  function atRiskVoters() {
    return voters.filter((id) => (voterLoyalty[id] || 50) < 40);
  }

  function applyLoyaltyEndOfDay() {
    // Mild drift — not a death spiral. Spat already hurt; this is maintenance.
    const notes = [];
    for (const id of voters.slice()) {
      const g = VOTER_GROUPS.find((v) => v.id === id);
      let d = Math.floor(Math.random() * 4) - 1; // -1..+2
      // Heat-sensitive blocs get a small hit if Press Heat is spicy
      if ((axes.heat || 0) >= 38 && g && (g.id === "lawn" || g.id === "wine" || g.id === "moderates" || g.id === "policy")) {
        d -= 2;
      }
      // Chaos likes heat a little
      if ((axes.heat || 0) >= 40 && g && g.id === "chaos") d += 1;
      // Preferred character retains slightly
      if (g && selected && g.preferred && g.preferred.includes(selected.id)) d += 1;
      voterLoyalty[id] = clamp((voterLoyalty[id] || 50) + d, 8, 100);
      if (voterLoyalty[id] < 40) notes.push(id);
    }
    return notes;
  }

  /**
   * Light rival pressure. Caps: +1/day neglect, -1 when you travel out of plaza,
   * steal at most 1/day and 2/week, only from loyalty < 28 when roster ≥ 5.
   * Does not touch axes/coalitions math — only membership.
   */
  function applyRivalEndOfDay() {
    let note = null;
    // Neglect: unlocked districts you never stepped into
    let neglected = 0;
    for (const d of DISTRICTS) {
      if (d.id === "plaza") continue;
      if (dayIndex >= d.unlockDay && !districtsVisitedToday[d.id]) neglected++;
    }
    if (neglected >= 2 && dayIndex >= 2) {
      rivalPressure = clamp(rivalPressure + 1, 0, 8);
    } else if (neglected === 0 && dayIndex >= 2) {
      rivalPressure = Math.max(0, rivalPressure - 1);
    }

    // Steal attempt — rare, soft
    if (
      !rivalStoleToday &&
      rivalStealsWeek < 2 &&
      rivalPressure >= 4 &&
      voters.length >= 5 &&
      dayIndex >= 3
    ) {
      const weak = voters
        .map((id) => ({ id, L: voterLoyalty[id] || 50 }))
        .filter((x) => x.L < 28)
        .sort((a, b) => a.L - b.L);
      if (weak.length) {
        const steal = weak[0].id;
        const g = VOTER_GROUPS.find((v) => v.id === steal);
        voters = voters.filter((id) => id !== steal);
        delete voterLoyalty[steal];
        // leave a breadcrumb of favor so reclaim is possible
        voterFavor[steal] = Math.max(0, (favorNeedOf(g) || 2) - 1);
        rivalStoleToday = true;
        rivalStealsWeek++;
        rivalPressure = Math.max(0, rivalPressure - 2);
        scandals.push("Rival nicked " + (g ? g.name : steal));
        note = {
          stolen: steal,
          name: g ? g.name : steal,
        };
        pushLog(`${RIVAL_NAME} poached ${note.name} (loyalty too soft).`);
        sfx("warn");
      }
    }
    return note;
  }

  /**
   * Daily objectives with adaptive voter targets.
   * "Recruit N more" = N *new* recruits *today* (objProg resets each morning).
   * Total coalition size does NOT carry into the daily progress bar.
   * If you front-loaded the roster, target shrinks to remaining uncommitted
   * blocs (or auto-clears when none are left) so Day 3+ isn't a scavenger hunt.
   */
  function currentObjectives() {
    // Days 2-6's middle "flavor" slot swaps in whichever event
    // shuffleDayEvents() assigned to this day — the DAILY_OBJECTIVES table
    // entry underneath still supplies that day's fixed voters-target/home,
    // just not its old fixed debate/scandal/march/gala/media id.
    const staticDay = DAILY_OBJECTIVES[dayIndex] || DAILY_OBJECTIVES[1];
    const eventId = dayIndex >= 2 && dayIndex <= 6 ? eventIdForDay(dayIndex) : null;
    const base =
      eventId && ROTATABLE_DAY_EVENTS[eventId]
        ? staticDay.map((o) =>
            ROTATABLE_DAY_EVENTS[o.id]
              ? { id: eventId, label: ROTATABLE_DAY_EVENTS[eventId].label, short: ROTATABLE_DAY_EVENTS[eventId].short, target: 1 }
              : o
          )
        : staticDay;
    const left = remainingVoterCount();
    return base.map((o) => {
      if (o.id !== "voters") return { ...o };
      const want = o.target | 0;
      const target = Math.min(want, left);
      if (target <= 0) {
        return {
          id: "voters",
          label: "Coalition full — all blocs courted (hold the line)",
          short: "Coalition full",
          target: 0,
          adaptive: true,
        };
      }
      if (target < want) {
        return {
          id: "voters",
          label: `Recruit the last ${target} uncommitted bloc${target === 1 ? "" : "s"}`,
          short: `Last ${target} voter${target === 1 ? "" : "s"}`,
          target,
          adaptive: true,
        };
      }
      // Data already says "new … today" — only rewrite legacy "more voter…" copy
      let label = o.label || "";
      let short = o.short || "";
      if (/more voter/i.test(label)) {
        label = label
          .replace(/more voter groups/i, "new voter groups today")
          .replace(/more voter group/i, "new voter group today");
      }
      if (/more voter/i.test(short)) {
        short = short.replace(/more voters?/i, "new today");
      }
      return { ...o, label, short, target };
    });
  }
  function setObj(id, v) {
    const o = currentObjectives().find((x) => x.id === id);
    if (!o) return;
    if (o.target === 0) {
      objProg[id] = 0;
      return;
    }
    objProg[id] = Math.min(o.target, v);
  }
  function bumpObj(id, d = 1) {
    setObj(id, (objProg[id] || 0) + d);
  }
  function objDone(id) {
    const o = currentObjectives().find((x) => x.id === id);
    if (!o) return false;
    if (o.target === 0) return true; // coalition already full
    return (objProg[id] || 0) >= o.target;
  }
  function allMainDone() {
    return currentObjectives()
      .filter((o) => o.id !== "home")
      .every((o) => objDone(o.id));
  }
  function favorNeedOf(group) {
    return Math.max(1, (group && group.favorNeed) | 0 || 2);
  }

  function favorOf(id) {
    return voterFavor[id] | 0;
  }

  /**
   * Earn a task ping toward a bloc. Completing favorNeed unlocks a recruit
   * roll (or auto-joins if autoJoin). No more free "talk once" coalition.
   */
  function bumpFavor(groupId, amount = 1, opts = {}) {
    if (voters.includes(groupId)) return false;
    const g = VOTER_GROUPS.find((v) => v.id === groupId);
    if (!g) return false;
    const need = favorNeedOf(g);
    const before = favorOf(groupId);
    if (before >= need && !opts.forceRoll) return false;
    voterFavor[groupId] = Math.min(need, before + Math.max(1, amount | 0));
    codexSeen[groupId] = true;
    const fav = favorOf(groupId);
    if (fav < need) {
      // Quiet mid-progress: float always; toast only first ping or almost-ready
      floatText(player.x, player.y - 36, `${g.icon || ""} ${fav}/${need}`, g.color);
      const almost = fav >= need - 1;
      const firstPing = before === 0;
      if (firstPing || almost || need <= 2) {
        toast(
          almost
            ? `${g.name}: favor ${fav}/${need} — ready after one more errand`
            : `${g.name}: favor ${fav}/${need}`
        );
      }
      sfx("blip");
      return false;
    }
    // Threshold met — attempt join (force for one-shot hard errands like crate/permit)
    return tryRecruit(groupId, !!opts.autoJoin);
  }

  function recruitChance(group) {
    // Harder baseline: even after errands, not a free win
    let base = 0.38 * (selected.recruitMod || 1);
    base += getCrisis().recruitMod || 0;
    const coal = activeCoalition();
    if (coal && coal.id === "policy") base -= 0.1;
    if (group.preferred.includes(selected.id)) base += 0.18;
    if (voters.includes("students")) base += 0.06;
    if (rallyT > 0 && selected.powerKey === "rally") base += 0.12 + powerRank * 0.05;
    if (selected.powerKey === "squeeze" && group.id !== "crypto") base -= 0.05;
    if (group.rival && voters.includes(group.rival)) base -= 0.18;
    const rule = getBoardRule();
    if (rule.recruitNearStage && player) {
      const st = getZone("stage");
      if (st && inZone(player.x, player.y, st, 50)) base += (rule.recruitNearStage || 0) * 0.7;
    }
    // Slight bonus for over-grinding favor past need (capped at need so N/A) — prefer character fit
    return clamp(base, 0.1, 0.82);
  }

  function triggerRivalSpat(newId) {
    const g = VOTER_GROUPS.find((v) => v.id === newId);
    if (!g || !g.rival || !voters.includes(g.rival)) return;
    const rival = VOTER_GROUPS.find((v) => v.id === g.rival);
    voterLoyalty[g.rival] = Math.max(15, (voterLoyalty[g.rival] || 50) - 14);
    voterLoyalty[newId] = Math.max(20, (voterLoyalty[newId] || 50) - 6);
    addAxes({ heat: 2, street: -1 });
    spatCount = (spatCount || 0) + 1;
    banner(`SPAT: ${g.name} vs ${rival ? rival.name : "rivals"}!`, g.color, 2.2);
    sfx("warn");
    pushLog(`Rival spat: ${g.name} vs ${rival ? rival.name : g.rival}.`);
    toast(`${g.name} clash with ${rival ? rival.name : "rivals"} in the plaza. Park + 8¢ can cool it later.`);
  }

  /** Texture pack: pay 8¢ at park (or park talk) to heal half a spat once/day */
  function trySpatReconciliation(fromPark) {
    if (spatCount <= 0) {
      if (fromPark) toast("No active spat to cool. Peace is expensive only when broken.");
      return false;
    }
    if (reconDay === dayIndex) {
      toast("Reconciliation already filed today. Bureaucracy limits forgiveness.");
      return false;
    }
    if (coins < 8) {
      toast("Need 8¢ for a peace offering (coffee + apology sticky).");
      sfx("warn");
      return false;
    }
    coins -= 8;
    reconDay = dayIndex;
    spatCount = Math.max(0, spatCount - 1);
    // Heal the two lowest-loyalty recruited blocs a bit
    const soft = voters
      .map((id) => ({ id, L: voterLoyalty[id] || 50 }))
      .sort((a, b) => a.L - b.L)
      .slice(0, 2);
    soft.forEach((x) => {
      voterLoyalty[x.id] = clamp((voterLoyalty[x.id] || 50) + 8, 8, 100);
    });
    addAxes({ street: 1, heat: -1 });
    floatText(player.x, player.y - 22, "-8¢ peace", "#80e0a0");
    toast("Spat cooled. Soft blocs recover a little loyalty. Heat eases.");
    pushLog("Reconciliation: paid 8¢, spatCount now " + spatCount + ".");
    sfx("ok");
    return true;
  }

  function maybeCoalitionFanfare() {
    const c = activeCoalition();
    if (!c || c.strength < 2) return;
    if (coalFanfareId === c.id) return;
    coalFanfareId = c.id;
    coalPerkDay = dayIndex;
    banner(c.name.toUpperCase() + " FORMS!", c.color || "#ffb347", 2.4);
    toast(`${c.name} locks in! Today only: cheaper buttons (−1¢) & a swagger tax refund (+2¢ on recruit).`);
    pushLog("Coalition fanfare: " + c.name + " (one-day perk).");
    sfx("sting");
    punch(0.2);
  }

  function banner(text, color, sec = 2) {
    floaters.push({ x: player ? player.x : W / 2, y: player ? player.y - 55 : 100, text, color: color || "#ffd080", life: sec });
  }

  function punch(amount) {
    if (reduceFlash) return;
    camPunch = Math.max(camPunch, amount);
  }

  // Recruiting too many blocs that lean the same way starts backfiring —
  // "if you sway voters too much, the result swings to the opposition."
  // Cap = a coalition's official 3-member core + this bonus, so the
  // existing 2-of-3/3-of-3 coalition BONUS strategy (which rewards
  // committing to exactly 3) is never itself punished — only genuine
  // over-extension beyond it is.
  const ALIGNMENT_CAP_BONUS = 2;

  /** A bloc "leans" a coalition if it's one of that coalition's official 3
   *  members, or (for the newer expansion blocs) explicitly tagged via
   *  coalitionLean. Plural because "moderates" is an official member of
   *  BOTH Money and Policy in the base data — using .find() here (first
   *  match only) would silently drop that second membership. Coalition-less
   *  blocs (e.g. Lawn Guardians) return [] and never trigger the cap. */
  function coalitionLeansOf(groupId) {
    const g = VOTER_GROUPS.find((v) => v.id === groupId);
    const leans = COALITIONS.filter((c) => c.members.includes(groupId)).map((c) => c.id);
    if (g && g.coalitionLean && !leans.includes(g.coalitionLean)) leans.push(g.coalitionLean);
    return leans;
  }
  function coalitionLeanOf(groupId) {
    return coalitionLeansOf(groupId)[0] || null;
  }
  function alignmentCapFor(coalitionId) {
    const c = COALITIONS.find((x) => x.id === coalitionId);
    return (c ? c.members.length : 3) + ALIGNMENT_CAP_BONUS;
  }
  function alignmentCountFor(coalitionId) {
    return voters.filter((id) => coalitionLeansOf(id).includes(coalitionId)).length;
  }
  function wouldTriggerAlignmentBacklash(groupId) {
    return coalitionLeansOf(groupId).some((lean) => alignmentCountFor(lean) >= alignmentCapFor(lean));
  }

  function tryRecruit(groupId, force = false) {
    if (voters.includes(groupId)) {
      return false;
    }
    const g = VOTER_GROUPS.find((v) => v.id === groupId);
    if (!g) return false;
    const need = favorNeedOf(g);
    const fav = favorOf(groupId);
    // Task gate: no free joins from ambient chat unless force (setpiece / QA)
    if (!force && fav < need) {
      toast(`${g.name} want errands first (${fav}/${need}). ${g.recruitHint}`);
      codexSeen[groupId] = true;
      sfx("warn");
      return false;
    }
    const chance = force ? 1 : recruitChance(g);
    if (Math.random() > chance && !force) {
      // Failed roll after grinding — lose a favor so they stay annoying
      voterFavor[groupId] = Math.max(0, fav - 1);
      toast(`${g.name} still need convincing. Favor now ${voterFavor[groupId]}/${need}. Keep grinding.`);
      addAxes({ street: -1, heat: 1 });
      sfx("warn");
      return false;
    }
    // Overreach: they were ready to join, but you've swayed this lean too
    // far already — the excess swings to the opposition instead of you.
    // force=true (setpieces/QA) bypasses this, same as the two gates above.
    if (!force && wouldTriggerAlignmentBacklash(groupId)) {
      // Name the SPECIFIC lean that's actually over cap — a dual-lean bloc
      // like moderates could be fine on one side and over on the other.
      const lean = coalitionLeansOf(groupId).find((l) => alignmentCountFor(l) >= alignmentCapFor(l));
      const coal = COALITIONS.find((c) => c.id === lean);
      const coalName = coal ? coal.name : "one lean";
      addAxes({ street: -3, heat: 3 });
      banner("OVERREACH", "#e04040", 2);
      toast(`${g.name} leans too hard ${coalName} for the room — the opposition picks up the slack.`);
      pushLog(`Overreach: ${g.name} swung to the opposition (already ${alignmentCountFor(lean)} ${coalName} blocs).`);
      codexSeen[groupId] = true;
      sfx("warn");
      return false;
    }
    voters.push(groupId);
    codexSeen[groupId] = true;
    voterFavor[groupId] = need;
    voterLoyalty[groupId] = 55 + Math.floor(Math.random() * 20);
    if (g.preferred.includes(selected.id)) voterLoyalty[groupId] += 12;
    recruitsToday = (recruitsToday | 0) + 1;
    bumpObj("voters", 1);
    addAxes({ street: 3, donor: g.id === "donors" || g.id === "crypto" ? 3 : 1, heat: g.id === "chaos" || g.id === "conspiracy" ? 2 : 0 });
    let joinCoins = 3;
    if (coalPerkDay === dayIndex) joinCoins += 2; // fanfare perk
    addCoins(joinCoins);
    burst(player.x, player.y, g.color, 16);
    floatText(player.x, player.y - 40, `+${g.name}!`, g.color);
    balloon(player.x, player.y - 50, g.name + " joined!", 2);
    banner(activeCoalition() ? activeCoalition().name : "New ally!", g.color, 1.8);
    sfx("recruit");
    punch(0.25);
    pushLog(`Recruited ${g.name} after errands (${need} favor). Loyalty ${voterLoyalty[groupId]}.`);
    toast(`Coalition grows: ${g.name} joined!`);
    if (g.rival && voters.includes(g.rival)) triggerRivalSpat(groupId);
    maybeCoalitionFanfare();
    checkAchievements();
    return true;
  }

  function coalitionLabel() {
    const c = activeCoalition();
    if (c) return c.strength >= 3 ? c.name : c.name + " (loose)";
    if (voters.length >= 3) return "Makeshift Bloc";
    if (voters.length === 0) return "No Coalition";
    return "Loose Allies";
  }

  function civicOutcome() {
    const street = axes.street || 0;
    const donor = axes.donor || 0;
    const heat = axes.heat || 0;
    const coal = activeCoalition();
    const scandalN = scandals.length + spatCount + lateNights;
    const setN = Object.values(setpieces || {}).filter(Boolean).length;
    // E1 Civic Darling
    if (street >= 45 && heat <= 22 && coal && (coal.id === "grassroots" || coal.id === "policy")) {
      return { id: "E1", title: "Civic Darling", blurb: "Street high, Heat low, principled bloc. Pocket Republic hums your tune." };
    }
    // E4 Money Machine Mayor
    if (donor >= 42 && coal && coal.id === "money") {
      return { id: "E4", title: "Money Machine Mayor", blurb: "Donor Trust soars. Velvet ropes part — invoices follow." };
    }
    // E3 Spectacle Mandate
    if (heat >= 38 && coal && coal.id === "chaos_ticket") {
      return { id: "E3", title: "Spectacle Mandate", blurb: "Press Heat is the platform. Viral wins, unstable sidewalks." };
    }
    // E2 Quiet Operator
    if (street >= 28 && donor >= 28 && heat < 28 && scandalN < 4 && coal && coal.id === "policy") {
      return { id: "E2", title: "Quiet Operator", blurb: "Balanced axes, Policy Bloc, few scandals. Boring on purpose." };
    }
    if (street >= 30 && donor >= 25 && heat < 32 && scandalN < 5) {
      return { id: "E2b", title: "Quiet Operator", blurb: "Balanced enough. The plaza survives another cycle." };
    }
    // 1.1 extras
    if (voters.includes("lawn") && street >= 35 && heat <= 25 && lateNights === 0) {
      return { id: "E6", title: "Lawn Peace", blurb: "Guardians approve. Quiet streets, trimmed hedges, soft mandate." };
    }
    if (setN >= 3 && voters.length >= 8 && street + donor >= 55) {
      return { id: "E7", title: "Perfect Week Adjacent", blurb: "Setpieces cleared, codex fat, axes healthy. Historians take notes." };
    }
    if (scandalN >= 6 || (heat >= 45 && street < 20)) {
      return { id: "E8", title: "Scandal Magnet", blurb: "The feed never slept. Neither did the controversy." };
    }
    if (coal && coal.id === "policy" && donor >= 30 && street >= 30 && powerRank >= 2) {
      return { id: "E9", title: "Policy Sweep", blurb: "Procedures won. Binder energy carried the week." };
    }
    // E5 Needs a Recount
    if (street + donor < 25 || lateNights >= 3 || voters.length < 2) {
      return { id: "E5", title: "Needs a Recount", blurb: "Axes flat, late nights, thin loyalty. Try another orange." };
    }
    if (street + donor + voters.length * 4 + (upgraded ? 5 : 0) + (debateWon ? 8 : 0) >= 50) {
      return { id: "E2c", title: "Solid Operator", blurb: "Errands done, coalitions managed. Messy, but standing." };
    }
    return { id: "E5", title: "Needs a Recount", blurb: "The count is murky. Democracy is a long game." };
  }

  function maybeMicroEvent() {
    if (seedFlags.microToday || state !== "play" || !player) return;
    if (time < 0.35 || time > 0.75) return;
    if (Math.random() > 0.012) return; // rare tick
    seedFlags.microToday = true;
    const ev = MICRO_EVENTS[Math.floor(Math.random() * MICRO_EVENTS.length)];
    if (ev.axes) addAxes(ev.axes);
    if (ev.coins) addCoins(ev.coins);
    toast("Event: " + ev.text);
    pushLog("Micro-event: " + ev.id);
    sfx("blip");
  }

  // ─── Interaction ─────────────────────────────────────────────
  function nearestInteractable() {
    const list = [];
    for (const n of NPCS) {
      list.push({ type: "npc", ref: n, d: dist(player.x, player.y, n.x, n.y) });
    }
    for (const z of ZONES) {
      const c = zoneCenter(z);
      list.push({ type: "zone", ref: z, d: dist(player.x, player.y, c.x, c.y) });
    }
    for (const b of BUTTON_SPOTS) {
      if (!b.taken) list.push({ type: "button", ref: b, d: dist(player.x, player.y, b.x, b.y) });
    }
    // Texture: peckable pigeons from clutter
    for (const cl of CLUTTER) {
      if (cl.key && String(cl.key).indexOf("pigeon") >= 0) {
        list.push({ type: "pigeon", ref: cl, d: dist(player.x, player.y, cl.x, cl.y) });
      }
    }
    list.sort((a, b) => a.d - b.d);
    return list[0] && list[0].d < INTERACT_R ? list[0] : null;
  }

  function interact() {
    if (state !== "play" || dayEnded) return;
    // Forced monologue: only advance dialogue (time waster)
    if (dialogue) {
      const nowD = performance.now();
      if (nowD - lastInteract < 220) return;
      lastInteract = nowD;
      advanceDialogue();
      return;
    }
    const now = performance.now();
    if (now - lastInteract < 280) return;
    lastInteract = now;
    interactFlash = 0.2;

    const hit = nearestInteractable();
    if (!hit) {
      toast("Nothing to poke. Try a building, NPC, or shiny button.");
      return;
    }

    if (hit.type === "button") {
      hit.ref.taken = true;
      buttons++;
      bumpObj("buttons", 1);
      addCoins(2);
      addRep(1);
      burst(hit.ref.x, hit.ref.y, "#ff6060", 12);
      toast(`Campaign button ${buttons}/3 pocketed.`);
      pushLog("Found a campaign button. It says BELIEVE (in vibes).");
      return;
    }

    if (hit.type === "pigeon") {
      interactPigeon(hit.ref);
      return;
    }

    if (hit.type === "npc") {
      talkNpc(hit.ref);
      noteMicChainTalk();
      return;
    }

    if (hit.type === "zone") {
      useZone(hit.ref);
      progressChapterMission(hit.ref.id);
    }
  }

  function noteMicChainTalk() {
    // Rally Queen toy: 3 talks within ~18s near activity → student favor
    if (!selected || selected.id !== "alex") return;
    const now = performance.now();
    micChain.push(now);
    micChain = micChain.filter((t) => now - t < 18000);
    if (micChain.length >= 3) {
      micChain = [];
      bumpFavor("students", 1);
      banner("HUMAN MIC", "#3ecf8e", 1.5);
      toast("Human mic chain! Three conversations — Students notice.");
      pushLog("Rally Queen human-mic chain complete.");
    }
  }

  function interactPigeon(cl) {
    if (pigeonDoneWeek) {
      toast("The pigeons have already filed their report. Coo.");
      return;
    }
    pigeonPecks++;
    sfx("blip");
    if (pigeonPecks < 3) {
      toast(`Pigeon side-eye (${pigeonPecks}/3). It knows something.`);
      balloon(cl.x, cl.y - 20, "coo?", 1.2);
      return;
    }
    pigeonDoneWeek = true;
    pigeonPecks = 3;
    addAxes({ heat: 1 });
    bumpFavor("conspiracy", 1);
    toast("Pigeon drops a crumb of 'intel.' Conspiracy Podcasters interested.");
    pushLog("Pigeon conspiracy (3 pecks) — favor toward Conspiracy.");
    burst(cl.x, cl.y, "#c0c0d0", 10);
    sfx("ok");
    noteEaster("pigeon", true); // secret: Pip the Civic
  }

  function npcContextLine(id, opts = {}) {
    const n = NPCS.find((npc) => npc.id === id);
    const c = n && n.contextLines;
    if (!c) return "";
    const defs = c.defaults || {};
    const chapterId = opts.chapter || (campaignChapter() && campaignChapter().id);
    const seasonId = opts.season || (campaign && campaign.season);
    const outcome = opts.outcome;
    return (
      (outcome && c[outcome]) ||
      (outcome && defs.outcome && defs.outcome[outcome]) ||
      c.chapter ||
      (defs.chapter && defs.chapter[chapterId]) ||
      (defs.season && defs.season[seasonId]) ||
      ""
    );
  }

  function attemptCampaignComeback() {
    if (!campaign) return null;
    const values = Object.values(campaign.loyalty || {});
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    if (!campaign.inOffice && average >= 45) {
      campaign.inOffice = true;
      campaign.electionWins += 1;
      pushLog("Civic comeback: organizing rebuilt a governing majority.");
      saveGame();
    }
    return campaignView();
  }

  function talkNpc(n) {
    const campaignLines = () => {
      const c = n.contextLines;
      if (!c || !campaign) return [];
      const defs = c.defaults || {};
      const chapter = campaignChapter();
      const loyaltyValues = Object.values(campaign.loyalty || {});
      const avg = loyaltyValues.length ? loyaltyValues.reduce((a, b) => a + b, 0) / loyaltyValues.length : 50;
      const outcome = chapterMission && chapterMission.success != null ? (chapterMission.success ? "success" : "failure") : null;
      return [
        outcome && c[outcome],
        outcome && defs.outcome && defs.outcome[outcome],
        c.chapter,
        defs.chapter && chapter && defs.chapter[chapter.id],
        defs.season && defs.season[campaign.season],
        defs.loyalty && defs.loyalty[avg < 40 ? "low" : avg > 65 ? "high" : ""],
      ].filter(Boolean);
    };
    const dayLine = (fallback) => {
      const contextual = campaignLines().find((line) => !heardNpcLines[n.id + "|" + line]);
      if (contextual) return contextual;
      const daily = Array.isArray(n.dayLines) ? n.dayLines[(dayIndex - 1) % n.dayLines.length] : n.dayLines && n.dayLines[dayIndex];
      if (daily && !heardNpcLines[n.id + "|" + daily]) return daily;
      const alternatives = [fallback].concat((n.lines && n.lines.rants) || []).filter(Boolean);
      return alternatives.find((line) => !heardNpcLines[n.id + "|" + line]) || daily || fallback;
    };
    const say = (line) => {
      rememberNpcLine(n, line);
      toast(line);
      balloon(n.x, n.y - 38, line, 2.8);
      const context = campaignLines().find((text) => text !== line && !heardNpcLines[n.id + "|" + text]);
      if (context) {
        rememberNpcLine(n, context);
        toast(`${n.name}: ${context}`, 4);
      }
      sfx("blip");
    };

    // ── Neighborhood antagonists (day-1 mercy: teach, don't maim) ──
    const day1Soft = dayIndex === 1;
    if (n.id === "catlady") {
      if (dialogue) return;
      if (catLadyDay === dayIndex) {
        say(n.lines.done || "Mr. Whiskers says you're busy. He judges.");
        addAnger(day1Soft ? 1 : 2, "Clara");
        return;
      }
      catLadyDay = dayIndex;
      const stories = n.lines.monologues || [n.lines.monologue || [n.lines.default]];
      const context = campaignLines().find((text) => !heardNpcLines[n.id + "|" + text]);
      const story = stories[(dayIndex - 1) % stories.length].slice();
      if (context) story.unshift(context);
      startDialogue("catlady", story, {
        angerPer: day1Soft ? 1 : 3,
        timePer: DAY_SECONDS * (day1Soft ? 0.015 : 0.025),
        onDone: () => {
          addAnger(day1Soft ? 2 : 4, "Clara monologue");
          toast(
            day1Soft
              ? "Clara pauses. Lesson learned: 💢 composure rises near her."
              : "Clara finally pauses. You escape. Time and patience: gone."
          );
        },
      });
      return;
    }
    if (n.id === "karen") {
      if (karenDay === dayIndex) {
        say("I'm still documenting. Don't make me write your name in all caps.");
        addAnger(day1Soft ? 2 : 4, "Karen encore");
        return;
      }
      karenDay = dayIndex;
      const rant = dayLine((n.lines.rants && n.lines.rants[Math.floor(Math.random() * n.lines.rants.length)]) || n.lines.default);
      say(rant);
      const karAnger = day1Soft ? 6 : 12;
      addAnger(karAnger, "HOA Karen");
      addAxes({ heat: day1Soft ? 0 : 1, street: day1Soft ? 0 : -1 });
      toast(day1Soft ? "HOA energy. Composure climbs — park cools it later." : "Anxiety spikes. Composure meter climbs.");
      pushLog("Karen complained. Anger +" + karAnger + ".");
      return;
    }
    if (n.id === "drunk") {
      if (drunkDay === dayIndex) {
        say(n.lines.empty);
        addAnger(day1Soft ? 1 : 2, "Doug");
        return;
      }
      drunkDay = dayIndex;
      if (coins <= 0) {
        say(n.lines.broke);
        addAnger(day1Soft ? 3 : 5, "Doug (broke)");
        return;
      }
      // Day-1: light lift, leave ~5¢ floor. Later: 5–15 but still floor at 5.
      const floor = 5;
      const want = day1Soft ? 2 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 11);
      const steal = Math.min(Math.max(0, coins - floor), want);
      coins -= steal;
      floatText(player.x, player.y - 24, "−" + steal + "¢", "#ff6060");
      say(steal ? n.lines.steal : n.lines.empty || n.lines.broke);
      addAnger(day1Soft ? 5 : 10, "Doug theft");
      addAxes({ heat: day1Soft ? 0 : 1 });
      toast(
        steal
          ? "Doug lifts " + steal + "¢" + (day1Soft ? " (day-one mercy)." : ". Your composure frays.")
          : "Doug digs for change — you're already thin. Composure still frays."
      );
      pushLog("Doug After-Hours stole " + steal + "¢.");
      sfx("warn");
      return;
    }

    // Day-gated flavor (C7)
    if (n.dayLines && n.dayLines[dayIndex] && Math.random() < 0.85) {
      // fall through after optional beat — show day line once per chat if no special quest
    }
    if (n.id === "clerk") {
      if (permitDelivered) {
        say(n.lines.done);
        return;
      }
      if (hasPermit) {
        hasPermit = false;
        permitDelivered = true;
        bumpObj("permit", 1);
        addRep(6);
        addCoins(8);
        burst(n.x, n.y, "#5b8def", 16);
        say(n.lines.permit);
        sfx("ok");
        pushLog("Permit delivered to Town Hall. Bureaucracy smiles (rare).");
        addAnger(dayIndex === 1 ? 2 : 5, "permit desk");
        // One clean permit run earns Moderates (and a policy ping)
        bumpFavor("moderates", 1, { autoJoin: true });
        bumpFavor("policy", 1);
        bumpFavor("zoning", 1);
        // Account meta: unlock path for Mayor Mandate
        meta.permits = (meta.permits || 0) + 1;
        saveMeta();
        evaluateMilestones(true);
        return;
      }
      say(dayLine(n.lines.default));
      return;
    }

    if (n.id === "barista") {
      if (coffeeFixed) {
        // Bernie Beans toy: free drip once/day after cart fixed
        if (selected && selected.id === "bernie" && beansCoffeeDay !== dayIndex) {
          beansCoffeeDay = dayIndex;
          addAxes({ street: 1 });
          say("On the house for fairness crusaders. Don't tell management.");
          toast("Free drip! +1 Street. Beans smiles once.");
          sfx("ok");
          return;
        }
        say(n.lines.done);
        addCoins(1);
        bumpFavor("wine", 1); // second ping after fix — still have to visit park
        return;
      }
      coffeeFixed = true;
      bumpObj("coffee", 1);
      addRep(5);
      addCoins(6);
      burst(n.x, n.y, "#c08040", 14);
      say(n.lines.fix);
      sfx("ok");
      pushLog("Coffee cart restored. Civic metabolism online.");
      calmAnger(8, "coffee");
      bumpFavor("wine", 1);
      return;
    }

    if (n.id === "vendor") {
      const price = buttonPrice();
      if (coins < price) {
        say(`NEED ${price}¢ FOR BUTTON LOOT.`);
        sfx("warn");
        return;
      }
      coins -= price;
      if (buttons < 3) {
        buttons++;
        bumpObj("buttons", 1);
        say(n.lines.buy);
      } else {
        addCoins(2);
        say("Mystery snack. Refund glitch.");
      }
      // Spending is the errand — not free coalition
      bumpFavor("crypto", 1);
      if (price >= 5) bumpFavor("donors", 1);
      return;
    }

    if (n.id === "paver") {
      if (coins < 10) {
        say(n.lines.broke);
        sfx("warn");
        return;
      }
      coins -= 10;
      potholePaid++;
      floatText(player.x, player.y - 20, "-10¢", "#ff8080");
      addAnger(5, "pothole grift");
      if (potholePaid <= 3) {
        say(potholePaid === 1 ? n.lines.default : n.lines.excuses[(potholePaid - 2) % n.lines.excuses.length]);
        pushLog(`Paid Paver Pete 10¢ for pothole repair (total: ${potholePaid * 10}¢). Potholes: unchanged.`);
        if (potholePaid === 3) bumpFavor("conspiracy", 1); // they're watching the grift
      } else {
        say(n.lines.exposed);
        addAxes({ street: -1 });
        pushLog("Paver Pete's potholes remain load-bearing. Conspiracy Cafe nods knowingly.");
        bumpFavor("conspiracy", 1, { autoJoin: favorOf("conspiracy") + 1 >= 2 });
        unlockAchieve("grifted", "Grift Recognized");
      }
      sfx("blip");
      return;
    }

    if (n.id === "consultant") {
      if (coleDay === dayIndex) {
        say("Invoice already filed today. Synergy has a cooldown.");
        return;
      }
      if (coins < 15) {
        say(n.lines.broke);
        sfx("warn");
        return;
      }
      coins -= 15;
      coleDay = dayIndex;
      consultantPaid++;
      floatText(player.x, player.y - 20, "-15¢", "#ff8080");
      const line = n.lines.sold[(consultantPaid - 1) % n.lines.sold.length];
      say(line);
      addAxes({ donor: 1, heat: consultantPaid >= 3 ? 1 : 0 });
      addAnger(8, "Cole invoice");
      pushLog(`Paid Consultant Cole 15¢ for a memo (#${consultantPaid}). Content: synergy-adjacent.`);
      // Policy nerds hate empty memos; donors weirdly love them
      bumpFavor("donors", 1);
      if (consultantPaid >= 3) {
        say(n.lines.exposed);
        unlockAchieve("synergy", "Synergy Delivered");
      }
      sfx("coin");
      return;
    }

    if (n.id === "mover") {
      if (crateMoved) {
        say(n.lines.done);
        return;
      }
      crateMoved = true;
      getZone("crate").x = 340;
      addRep(4);
      addCoins(7);
      burst(n.x, n.y, "#e07040", 12);
      say(n.lines.help);
      sfx("ok");
      pushLog("Oversized crate relocated. Gravity remains undefeated.");
      // Hard errand = full union join
      bumpFavor("union", 1, { autoJoin: true });
      return;
    }

    if (n.id === "stagehand") {
      // Phase A setpiece: Plaza Debate (crisis day 2, or any day after 1 if flagged)
      if (getCrisis().debateDay && !debateDone) {
        runPlazaDebate();
        return;
      }
      if (!voters.includes("students")) {
        if (selected.powerKey === "rally" || rallyT > 0) {
          bumpFavor("students", 1);
          say(n.lines.rally || "They noticed the rally energy. Come back after Debate or another push.");
        } else {
          say("Crowd scrolls past. Hit Q (Rally) near the stage, or run the Plaza Debate.");
          sfx("warn");
        }
      } else if (debateDone) {
        say(debateWon ? "That debate still echoes. Nicely done." : "Stage is quieter after the dust-up.");
      } else {
        say("Students already swarm your banner.");
      }
      return;
    }

    if (n.id === "boothie") {
      // Texture: first talk of the day = photo op; further talks = spectacle grind
      if (photoDay !== dayIndex) {
        photoDay = dayIndex;
        addCoins(2);
        addAxes({ heat: 1 });
        addRep(1);
        burst(n.x, n.y, "#fff0a0", 18);
        banner("PHOTO OP", "#ffb347", 1.4);
        say("Smile! Free buttons if you pose with the cardboard candidate. Flash!");
        toast("Photo op! +2¢, +1 Heat. The intern tags you unironically.");
        pushLog("Booth photo op — Heat +1, coins +2.");
        bumpFavor("chaos", 1);
        bumpFavor("memelords", 1);
        noteEaster("photos", 1); // secret: Cardboard Casey at 3
        // Bootstraps toy: clarify prior statement at booth
        if (selected && selected.id === "donny") {
          bumpFavor("donors", 1);
          if (voters.includes("wine")) {
            voterLoyalty.wine = Math.max(12, (voterLoyalty.wine || 50) - 6);
            toast("Pivot clip drops. Donors warm; Wine Moms side-eye.");
          }
        }
        sfx("ok");
        return;
      }
      addRep(selected.id === "tiny" ? 1 : 2);
      addCoins(2);
      addAxes({ heat: 1 });
      bumpFavor("chaos", 1);
      bumpFavor("patriots", 1);
      say(dayLine(n.lines.chaos || n.lines.default));
      if (voters.includes("wine")) {
        voterLoyalty.wine = Math.max(15, (voterLoyalty.wine || 50) - 8);
        pushLog("Wine Moms side-eye the spectacle.");
      }
      if (buttons < 3 && Math.random() < 0.4) {
        buttons++;
        bumpObj("buttons", 1);
      }
      // Rally mic-chain progress
      noteMicChainTalk();
      return;
    }

    if (n.id === "parkgoer") {
      addRep(2);
      bumpFavor("wine", 1);
      if ((axes.heat || 0) < 25) bumpFavor("lawn", 1);
      else toast("Lawn Guardians side-eye your Heat. Cool off before park rounds count.");
      say(dayLine(n.lines.wine || n.lines.default));
      // Spat recon available at park
      if (spatCount > 0 && reconDay !== dayIndex) {
        toast("Tip: E again or pay 8¢ here to cool a spat (reconciliation).");
      }
      noteMicChainTalk();
      return;
    }

    if (n.id === "watchdog") {
      showObj = true;
      if (n.dayLines) say(dayLine(n.lines.default));
      else if (!hasPermit && !permitDelivered) say("LOST PERMIT near the Oversized Mailbox.");
      else say(n.lines.default);
      // Board thrice is the austere errand path
      if (dayIndex >= 1) bumpFavor("budget", 1);
      bumpFavor("watch", 1);
      return;
    }

    if (n.id === "anchor") {
      bumpObj("media", 1);
      if (n.dayLines) say(dayLine(n.lines.default));
      else say(n.lines.default);
      bumpFavor("patriots", 1);
      bumpFavor("chaos", 1);
      return;
    }

    if (n.id === "leaker") {
      if (getCrisis().scandalDay && !setpieces.scandal) {
        runScandalLeak();
        return;
      }
      if (n.dayLines) say(dayLine(n.lines.default));
      else say(n.lines.default);
      bumpFavor("conspiracy", 1);
      return;
    }

    if (n.id === "ra") {
      if (getCrisis().marchDay && !setpieces.march) {
        runUnionMarch();
        return;
      }
      if (n.dayLines) say(dayLine(n.lines.default));
      else say(n.lines.default);
      bumpFavor("students", 1);
      bumpFavor("lawn", 1);
      return;
    }

    if (n.id === "host") {
      if (getCrisis().galaDay && !setpieces.gala) {
        runDonorGala();
        return;
      }
      if (n.dayLines) say(dayLine(n.lines.default));
      else say(n.lines.default);
      bumpFavor("donors", 1);
      bumpFavor("developers", 1);
      return;
    }

    say(dayLine(n.lines.default || "…"));
  }

  function runScandalLeak() {
    setpieces.scandal = true;
    bumpObj("scandal", 1);
    scandals.push("Day " + dayIndex + ": Scandal Leak");
    sfx("sting");
    punch(0.35);
    const spin = selected.id === "donny" || selected.id === "leon" || voters.includes("chaos");
    if (spin && Math.random() < 0.55 + powerRank * 0.05) {
      addAxes({ heat: 4, street: 2, donor: 1 });
      addCoins(8);
      banner("LEAK SPUN", "#c060ff", 2);
      toast("Scandal Leak: you spin it. Heat up, but you look clever.");
      pushLog("Spun a scandal leak into coverage.");
    } else {
      addAxes({ heat: 5, street: -2, donor: -1 });
      banner("LEAK HITS", "#e06080", 2);
      toast("Scandal Leak: the story sticks. Heat soars.");
      pushLog("Took a scandal hit from Media Alley.");
    }
    // Leak is a real errand — big conspiracy favor, join if fully warmed
    bumpFavor("conspiracy", 2, { autoJoin: true });
    saveGame();
  }

  function runUnionMarch() {
    setpieces.march = true;
    bumpObj("march", 1);
    sfx("sting");
    punch(0.3);
    const strong = voters.includes("union") || selected.id === "bernie" || selected.id === "alex";
    if (strong) {
      addAxes({ street: 6, donor: -1, heat: 1 });
      addCoins(7);
      banner("MARCH SUCCESS", "#e07040", 2);
      toast("Union March: the route holds. Street Cred surges.");
      bumpFavor("union", 1, { autoJoin: true });
      bumpFavor("students", 1);
    } else {
      addAxes({ street: 2, heat: 2 });
      banner("MARCH MUDDY", "#c09070", 2);
      toast("Union March: muddy message, still feet on pavement.");
      bumpFavor("union", 1);
    }
    pushLog("Campus Union March resolved.");
    meta.marches = (meta.marches || 0) + 1;
    saveMeta();
    evaluateMilestones(true);
    saveGame();
  }

  function runDonorGala() {
    setpieces.gala = true;
    bumpObj("gala", 1);
    scandals.push("Day " + dayIndex + ": Gala optics");
    sfx("sting");
    punch(0.25);
    const flash = selected.id === "donny" || voters.includes("donors") || brandT > 0;
    if (flash) {
      addAxes({ donor: 7, heat: 3, street: -1 });
      addCoins(12);
      banner("GALA WIN", "#e8c040", 2);
      toast("Donor Gala: you own the room. Donor Trust spikes; Heat follows.");
      bumpFavor("donors", 2, { autoJoin: true });
      bumpFavor("patriots", 1);
    } else {
      addAxes({ donor: 3, heat: 2 });
      addCoins(5);
      banner("GALA RSVP", "#c0a060", 2);
      toast("Donor Gala: you survive the canapés. Mild Donor bump.");
      bumpFavor("donors", 1);
    }
    pushLog("Donor Gala night logged.");
    noteEaster("gala", true); // secret: Canapé Carl
    saveGame();
  }

  function useZone(z) {
    // District transit gates
    if (z.transit) {
      travelTo(z.transit);
      return;
    }
    // District-locked interactions
    if (z.district && z.district !== "plaza" && !districtUnlocked(z.district)) {
      toast("District locked. Check the day unlock schedule.");
      return;
    }

    if (z.id === "home") {
      if (canSleepAtHome()) {
        sfx("sleep");
        endDay(true);
        return;
      }
      balloon(player.x, player.y - 40, "Too early…", 1.5);
      toast("Home sweet micro-home. Finish more errands, or come back later in the day.");
      if (time >= 0.7) toast("Evening's coming — you can sleep soon (E at HOME).");
      return;
    }

    if (z.id === "board") {
      showObj = true;
      const c = getCrisis();
      const rule = getBoardRule();
      toast(`DAY ${dayIndex}: ${c.title} · RULE: ${rule.title}`);
      pushLog(`Board: ${c.title} / ${rule.title}.`);
      if (dayHeadline) toast("📰 " + dayHeadline);
      toast(rule.blurb);
      // Mandate toy: Q not needed — stamp form with City Order near board, or E stamp if mayor
      if (selected && selected.id === "mayor" && !seedFlags.mandateStamp) {
        seedFlags.mandateStamp = true;
        if (coins >= 2) {
          coins -= 2;
          floatText(player.x, player.y - 18, "-2¢ fee", "#ff8080");
        }
        bumpFavor("policy", 1);
        toast("City stamp applied. Policy Nerds notice the triplicate.");
        pushLog("Mandate stamped a form at the board.");
      }
      if (!hasPermit && !permitDelivered) {
        toast("Sticky note: Permit near MAILBOX.");
      }
      if (c.debateDay && !debateDone) {
        toast("Poster: PLAZA DEBATE — Civic Stage.");
      }
      const coal = activeCoalition();
      if (coal) toast(`Active bloc: ${coal.name} — ${coal.bonus}`);
      // Daily sticky: one uncommitted bloc + how to annoy them into joining
      if (!boardTipId || voters.includes(boardTipId)) boardTipId = pickBoardTipId();
      if (boardTipId) {
        const tipG = VOTER_GROUPS.find((v) => v.id === boardTipId);
        if (tipG) {
          const fav = favorOf(tipG.id);
          const need = favorNeedOf(tipG);
          toast(`📌 STICKY: ${tipG.name} (${fav}/${need} favor) — ${tipG.recruitHint}`);
          pushLog(`Board tip: ${tipG.name} · ${tipG.recruitHint}`);
        }
      } else {
        toast("📌 STICKY: Coalition full. Hold the line — rival is watching neglect.");
      }
      if (rivalPressure >= 3) {
        toast(`Rival pressure ${rivalPressure}/8 — visit unlocked districts or risk a soft poach.`);
      }
      // Budget Watchers respect people who read the board (annoying, intentional)
      bumpFavor("budget", 1);
      noteEaster("boardReads", 1); // secret: Mae Memo at 10
      addAnger(4, "board bureaucracy");
      return;
    }

    if (z.id === "mayor") {
      if (hasPermit) {
        // also allow drop-off at office zone without NPC if close
        const clerk = NPCS.find((n) => n.id === "clerk");
        if (dist(player.x, player.y, clerk.x, clerk.y) < 60) {
          talkNpc(clerk);
          return;
        }
      }
      toast("Mayor's office lobby. Smells like toner and optimism.");
      if (selected.id === "mayor") {
        toast("Staff salute. 'Mandate protocol active,' someone whispers.");
        addRep(1);
      }
      return;
    }

    if (z.id === "locked") {
      if (lockedOpen) {
        addCoins(10);
        addRep(3);
        toast("Locked office stash: emergency coins & a golden stapler.");
        burst(player.x, player.y, "#ffd060", 10);
        // only once
        z.id = "unlocked";
        z.label = "OPEN";
        z.color = "#5a7a9a";
        return;
      }
      if (selected.powerKey === "order" && !orderUsed) {
        toast("City Order ready (Q): open this door, or discount the upgrade.");
        return;
      }
      toast("Locked. Needs a City Order, a key rumor, or main-character energy.");
      return;
    }

    if (z.id === "mailbox") {
      // Rocket toy: crash-landing into mailbox
      if (selected && selected.id === "leon" && launchT > 0 && !seedFlags.rocketMail) {
        seedFlags.rocketMail = true;
        addAxes({ heat: 2 });
        addCoins(2);
        burst(player.x, player.y, "#60c8e8", 16);
        toast("Rocket-mailbox collision! Cameras love it. +2 Heat, +2¢.");
        pushLog("Leon crashed into the mailbox. Heat +2.");
        sfx("sting");
      }
      if (seedFlags.permitAtMail && !hasPermit && !permitDelivered) {
        seedFlags.permitAtMail = false;
        hasPermit = true;
        addRep(2);
        burst(player.x, player.y, "#ffd080", 12);
        toast("You climb the oversized mailbox and find the LOST PERMIT!");
        pushLog("Recovered lost permit from the mailbox. Tiny triumph.");
        if (selected.powerKey === "squeeze") {
          addCoins(2);
          floatText(player.x, player.y - 20, "SQUEEZE BONUS", "#ff8c28");
        }
        return;
      }
      toast(hasPermit ? "Mailbox conquered. Deliver the permit to Town Hall." : "An apartment-sized mailbox. Echoes of lost mail.");
      return;
    }

    if (z.id === "coffee") {
      talkNpc(NPCS.find((n) => n.id === "barista"));
      return;
    }

    if (z.id === "vending") {
      // upgrade shop also lives here after coffee or always
      if (!upgraded && coins >= upgradePrice()) {
        // prompt via toast — interact again buys if holding shift? Better: dedicated
        toast(`Vending: buttons (4¢) · TOOL UPGRADE (${upgradePrice()}¢) — press Q near machine to buy upgrade.`);
      } else if (upgraded) {
        toast("Vending: tool upgraded. Also sells regret.");
      } else {
        toast(`Need ${upgradePrice()}¢ for first tool upgrade. Buttons cost 4¢.`);
      }
      talkNpc(NPCS.find((n) => n.id === "vendor"));
      return;
    }

    if (z.id === "alley") {
      player.x = 700;
      player.y = 400;
      toast("Alley shortcut! You emerge near the plaza, slightly stickier.");
      burst(player.x, player.y, "#888", 8);
      bumpFavor("conspiracy", 1);
      return;
    }

    if (z.id === "stage") {
      talkNpc(NPCS.find((n) => n.id === "stagehand"));
      return;
    }

    if (z.id === "booth") {
      talkNpc(NPCS.find((n) => n.id === "boothie"));
      return;
    }

    if (z.id === "boelunch") {
      if (boeDay === dayIndex) {
        toast("The Board of Education is still expensing dessert. One lunch per day.");
        return;
      }
      if (coins < 12) {
        toast("Board of Ed lunch: $2.99 REAL MONEY* (*12¢ petty cash). You have neither.");
        sfx("warn");
        return;
      }
      coins -= 12;
      boeDay = dayIndex;
      addAxes({ donor: 1 });
      floatText(player.x, player.y - 20, "-12¢", "#ff8080");
      toast("MICROTRANSACTION: Board of Ed lunch — $2.99 REAL MONEY... card declined (campaign finance law). 12¢ petty cash it is.");
      pushLog("Took the Board of Education to lunch. They ordered the salmon. Policy discussed: none.");
      burst(player.x, player.y, "#d0c060", 12);
      bumpFavor("policy", 1);
      addAnger(6, "BoE lunch");
      sfx("ok");
      return;
    }

    if (z.id === "addesk") {
      if (adDay === dayIndex) {
        toast("Your ad is already running between two weather reports. One buy per day.");
        return;
      }
      if (coins < 20) {
        toast("30s of ad time: $4.99 REAL MONEY* (*20¢ petty cash). Come back richer.");
        sfx("warn");
        return;
      }
      coins -= 20;
      adDay = dayIndex;
      addAxes({ donor: 2, heat: 1 });
      floatText(player.x, player.y - 20, "-20¢", "#ff8080");
      toast("MICROTRANSACTION: 30s ad buy — $4.99 REAL MONEY... payment processor laughed. 20¢ petty cash. Your ad airs at 3am.");
      pushLog("Bought 30 seconds of ad time. The jingle is already stuck in four demographics.");
      burst(player.x, player.y, "#e080c0", 14);
      bumpFavor("patriots", 1);
      bumpFavor("donors", 1);
      addAnger(5, "ad buy");
      sfx("ok");
      return;
    }

    if (z.id === "park") {
      calmAnger(6, "park air");
      // Reconciliation: park + 8¢ cools a spat (texture pack fairness valve)
      if (spatCount > 0 && reconDay !== dayIndex && coins >= 8) {
        if (trySpatReconciliation(true)) return;
      }
      talkNpc(NPCS.find((n) => n.id === "parkgoer"));
      return;
    }

    if (z.id === "plaza") {
      // Tiny toy: fountain crawl once/day
      if (selected && selected.id === "tiny" && fountainToyDay !== dayIndex) {
        fountainToyDay = dayIndex;
        addCoins(3);
        bumpFavor("conspiracy", 1);
        burst(player.x, player.y, "#ff8c28", 12);
        toast("Fountain crawl! +3¢ and a damp rumor.");
        pushLog("Tiny fountain crawl — conspiracy favor + coins.");
        sfx("ok");
        return;
      }
      toast("Fountain Plaza. Toss a coin (2¢) for luck?");
      if (coins >= 2 && Math.random() < 0.5) {
        coins -= 2;
        addRep(3);
        toast("Wish accepted. The fountain gurgles approvingly.");
      }
      return;
    }

    if (z.id === "tunnel") {
      if (selected.powerKey === "squeeze" || squeezeActive || toolLevel > 0) {
        inTunnel = !inTunnel;
        if (inTunnel) {
          player.x = 520;
          player.y = 500;
          toast("Squeeze tunnel! You pop out under the fountain plaza.");
          addCoins(3);
          addRep(2);
          if (!seedFlags.tunnelLoot) {
            seedFlags.tunnelLoot = true;
            if (buttons < 3) {
              buttons++;
              setObj("buttons", buttons);
            }
            toast("Tunnel stash: a dusty campaign button.");
          }
          bumpFavor("conspiracy", 1);
        } else {
          player.x = 130;
          player.y = 450;
          toast("Back through the tunnel.");
        }
        burst(player.x, player.y, "#ff8c28", 10);
      } else {
        toast("Too tight. Tiny Orange Man's Squeeze (or a tool upgrade) needed.");
      }
      return;
    }

    if (z.id === "crate") {
      talkNpc(NPCS.find((n) => n.id === "mover"));
      return;
    }

    // Media / campus / donor hubs
    if (z.id === "studio" || z.id === "cameras") {
      const a = NPCS.find((n) => n.id === "anchor");
      if (a) talkNpc(a);
      else toast(z.name);
      return;
    }
    if (z.id === "leakdesk") {
      const a = NPCS.find((n) => n.id === "leaker");
      if (a) talkNpc(a);
      return;
    }
    if (z.id === "quad" || z.id === "petition") {
      const a = NPCS.find((n) => n.id === "ra");
      if (a) talkNpc(a);
      if (z.id === "petition") {
        bumpFavor("students", 1);
        bumpFavor("policy", 1);
        toast("You fill out a triplicate petition. Joy.");
      }
      return;
    }
    if (z.id === "march") {
      if (getCrisis().marchDay && !setpieces.march) runUnionMarch();
      else toast("March route. Quiet for now.");
      return;
    }
    if (z.id === "gala" || z.id === "velvet" || z.id === "pitch") {
      const a = NPCS.find((n) => n.id === "host");
      if (getCrisis().galaDay && !setpieces.gala && z.id === "gala") runDonorGala();
      else if (a) talkNpc(a);
      else toast(z.name);
      if (z.id === "pitch") {
        if (coins >= 15) {
          coins -= 5;
          floatText(player.x, player.y - 20, "-5¢ pitch fee", "#ff8080");
          bumpFavor("donors", 1);
          toast("Pitch fee paid. Donors pretend to listen.");
        } else {
          toast("Pitch Pavilion: need 15¢ liquid to look serious.");
          sfx("warn");
        }
      }
      return;
    }

    toast(z.name + ".");
  }

  function upgradePrice() {
    let p = UPGRADE_COST;
    p = Math.floor(p * (getCrisis().upgradeMult || 1));
    const rule = getBoardRule();
    if (rule.upgradeMult) p = Math.floor(p * rule.upgradeMult);
    if (orderMode === "discount") p = Math.floor(p * 0.8);
    if (voters.includes("moderates") || voters.includes("budget")) p = Math.max(12, p - 3);
    const coal = activeCoalition();
    if (coal && coal.id === "policy") p = Math.max(12, Math.floor(p * 0.85));
    if (coal && coal.id === "grassroots") p = Math.floor(p * 1.1);
    if (voters.includes("donors")) p = Math.max(12, Math.floor(p * 0.92));
    return p;
  }

  function buttonPrice() {
    let p = getCrisis().buttonCost || 4;
    const coal = activeCoalition();
    if (coal && coal.id === "grassroots") p += 1;
    if (coal && coal.id === "money") p = Math.max(2, p - 1);
    if (voters.includes("donors")) p = Math.max(2, p - 1);
    // Texture: one-day coalition form perk
    if (coalPerkDay === dayIndex) p = Math.max(2, p - 1);
    return p;
  }

  function powerUpgradeCost() {
    if (powerRank >= 3) return 0;
    let c = POWER_RANK_COST[powerRank + 1] || 99;
    if (voters.includes("budget")) c = Math.floor(c * 0.85);
    return c;
  }

  function buyUpgrade() {
    // Phase B: tool first, then power ranks at same machine
    if (!upgraded) {
      const price = upgradePrice();
      if (coins < price) {
        toast(`Need ${price}¢ for the Pocket Multitool.`);
        return;
      }
      coins -= price;
      upgraded = true;
      toolLevel = 1;
      addAxes({ street: 2, donor: 1 });
      burst(player.x, player.y, "#80d0ff", 16);
      sfx("ok");
      banner("TOOL +1", "#80d0ff", 1.5);
      toast("Pocket Multitool +1! Tunnel access & errand swagger.");
      pushLog("Purchased tool upgrade.");
      // Budget Watchers like thrift — still only a favor ping
      bumpFavor("budget", 1);
      saveGame();
      return;
    }
    if (powerRank >= 3) {
      toast("Power tree maxed for this week.");
      return;
    }
    const pc = powerUpgradeCost();
    if (coins < pc) {
      toast(`Need ${pc}¢ to rank up ${selected.power} (${powerRank}→${powerRank + 1}).`);
      return;
    }
    coins -= pc;
    powerRank += 1;
    addAxes({ street: 1, donor: 1 });
    burst(player.x, player.y, selected.color, 14);
    sfx("ok");
    banner(`${selected.power} RANK ${powerRank}`, selected.accent, 1.8);
    toast(`${selected.power} ranked up to ${powerRank}/3!`);
    pushLog(`Power rank ${powerRank}: ${selected.power}`);
    punch(0.3);
    checkAchievements();
    saveGame();
  }

  function usePower() {
    if (state !== "play" || !selected) return;
    const pk = selected.powerKey;
    sfx("power");
    punch(0.15);

    if (pk === "squeeze") {
      squeezeActive = true;
      const dur = 4000 + powerRank * 1500;
      balloon(player.x, player.y - 40, powerRank ? `Squeeze r${powerRank}!` : "Squeeze!", 1.2);
      toast("Squeeze engaged — tiny gaps and tunnels welcome you.");
      const t = getZone("tunnel");
      if (inZone(player.x, player.y, t, 20 + powerRank * 8)) useZone(t);
      setTimeout(() => {
        squeezeActive = false;
      }, dur);
      return;
    }

    if (pk === "rally") {
      if (rallyT > 0) {
        toast("Rally still echoing…");
        return;
      }
      rallyT = 5 + powerRank * 2;
      burst(player.x, player.y, selected.color, 20 + powerRank * 4);
      balloon(player.x, player.y - 44, "Rally!", 1.4);
      banner("RALLY CRY", selected.color, 1.5);
      toast("Rally Cry! Nearby hearts open a little.");
      addAxes({ street: 1 + powerRank });
      // Must rally near stage for student favor
      const st = getZone("stage");
      if (st && inZone(player.x, player.y, st, 70)) bumpFavor("students", 1);
      return;
    }

    if (pk === "order") {
      const maxOrders = 1 + (powerRank >= 2 ? 1 : 0);
      if (orderUsed && powerRank < 2) {
        toast("Bureaucracy meter: one City Order per day (rank 2+ allows a second).");
        return;
      }
      if (orderUsed && powerRank >= 2 && orderMode) {
        // second use only if first was used and rank high — track with orderUsed as count
      }
      const board = getZone("board");
      // Mandate toy: stamp near board
      if (board && inZone(player.x, player.y, board, 40) && !seedFlags.mandateQStamp) {
        seedFlags.mandateQStamp = true;
        orderUsed = true;
        if (coins >= 2) coins -= 2;
        bumpFavor("policy", 1);
        toast("City Order: Form stamped at Board. Policy Nerds stir.");
        pushLog("Mandate Q-stamp at board.");
        addAxes({ street: 1, donor: 1 });
        sfx("ok");
        return;
      }
      const locked = getZone("locked") || getZone("unlocked");
      if (locked && locked.id === "locked" && inZone(player.x, player.y, locked, 30)) {
        orderUsed = true;
        orderMode = "door";
        lockedOpen = true;
        locked.color = "#5a7a9a";
        locked.label = "OPEN";
        toast("City Order: Unlock Auxiliary Office.");
        pushLog("City Order opened the locked office.");
        addAxes({ donor: 2, street: 1 });
        burst(locked.x + locked.w / 2, locked.y + locked.h / 2, "#5b8def", 14);
      } else {
        orderUsed = true;
        orderMode = "discount";
        toast("City Order: Vendor Price Relief (−20% upgrades).");
        pushLog("City Order discounted upgrades.");
        addAxes({ donor: 2 });
      }
      return;
    }

    if (pk === "redistribute") {
      if (redistribT > 0) {
        toast("Redistribution still in effect…");
        return;
      }
      const cost = Math.max(5, 8 - powerRank);
      if (coins < cost) {
        toast(`Need ${cost}¢ to redistribute.`);
        sfx("warn");
        return;
      }
      coins -= cost;
      redistribT = 8 + powerRank * 3;
      addAxes({ street: 3 + powerRank, donor: -1, heat: -1 });
      burst(player.x, player.y, "#c45c4a", 18);
      banner("REDISTRIBUTION", "#c45c4a", 2);
      toast(`Redistribution! Town buff ${Math.floor(redistribT)}s — Street up, Heat down.`);
      bumpFavor("union", 1);
      bumpFavor("budget", 1);
      return;
    }

    if (pk === "launch") {
      if (launchT > 0) {
        toast("Thrusters cooling…");
        return;
      }
      launchT = 4 + powerRank;
      const dx = player.facing || 1;
      player.x = clamp(player.x + dx * (80 + powerRank * 25), 24, MAP_W - 24);
      player.y = clamp(player.y - 40 - powerRank * 10, 24, MAP_H - 24);
      burst(player.x, player.y, "#60c8e8", 16);
      banner("LAUNCH MODE", "#60c8e8", 1.2);
      toast("Launch Mode! Rocket dash.");
      if (Math.random() < 0.25 + powerRank * 0.05) {
        addAxes({ heat: 1 });
        toast("Rough landing. Cameras love a crash.");
      }
      addAxes({ donor: 1 });
      // Spectacle only warms crypto; still need VEND spends
      bumpFavor("crypto", 1);
      return;
    }

    if (pk === "brand") {
      if (brandT > 0) {
        toast("You just pivoted. Let this stance breathe a second.");
        return;
      }
      brandT = 6 + powerRank;
      addCoins(6 + powerRank * 3);
      addAxes({ donor: 2 + powerRank, heat: 1 + (powerRank > 1 ? 1 : 0), street: -1 });
      burst(player.x, player.y, "#e8c040", 20);
      banner("PIVOT", "#e8c040", 1.5);
      toast("Pivot! Donors swoon; Heat ticks up.");
      bumpFavor("donors", 1);
      bumpFavor("patriots", 1);
      bumpFavor("chaos", 1);
      return;
    }

    // Secret cast powers (easter-egg characters)
    if (pk === "scatter") {
      launchT = 3 + powerRank;
      const ang = Math.random() * Math.PI * 2;
      player.x = clamp(player.x + Math.cos(ang) * 50, 24, MAP_W - 24);
      player.y = clamp(player.y + Math.sin(ang) * 40, 24, MAP_H - 24);
      burst(player.x, player.y, "#c0c0d0", 18);
      banner("SCATTER", "#b8b8c8", 1.2);
      toast("Feathers everywhere! Speed burst + conspiracy coo.");
      bumpFavor("conspiracy", 1);
      return;
    }
    if (pk === "postit") {
      boardTipId = pickBoardTipId();
      addAxes({ street: 1 });
      banner("POST-IT", "#e8d060", 1.3);
      toast(boardTipId ? "Memo refreshed. Check the Board sticky." : "Memo: coalition already full. Nice problem.");
      bumpFavor("budget", 1);
      bumpFavor("policy", 1);
      sfx("ok");
      return;
    }
    if (pk === "tray") {
      if (brandT > 0) {
        toast("Tray still circulating…");
        return;
      }
      brandT = 5 + powerRank;
      addCoins(5 + powerRank * 2);
      addAxes({ donor: 2, heat: 2, street: -1 });
      burst(player.x, player.y, "#e8a0c0", 16);
      banner("PASSED TRAY", "#e8a0c0", 1.4);
      toast("Canapés deployed. Donors nibble; Heat rises.");
      bumpFavor("donors", 1);
      return;
    }
    if (pk === "flat") {
      if (rallyT > 0) {
        toast("Still posing…");
        return;
      }
      rallyT = 4 + powerRank * 2;
      burst(player.x, player.y, "#c8a878", 14);
      banner("FLAT RALLY", "#c8a878", 1.3);
      toast("Cardboard face-forward! Nearby hearts confuse you for policy.");
      addAxes({ street: 1, heat: 1 });
      const st = getZone("stage");
      const bo = getZone("booth");
      if ((st && inZone(player.x, player.y, st, 80)) || (bo && inZone(player.x, player.y, bo, 80))) {
        bumpFavor("chaos", 1);
        bumpFavor("students", 1);
      }
      return;
    }
  }

  function runPlazaDebate() {
    debateDone = true;
    setpieces.debate = true;
    sfx("debate");
    // Strength from voters + character
    let score = 0.35;
    if (selected.id === "alex") score += 0.25;
    if (selected.id === "mayor") score += 0.15;
    if (voters.includes("students")) score += 0.15;
    if (voters.includes("moderates")) score += 0.1;
    if (voters.includes("wine")) score += 0.08;
    if (voters.includes("chaos")) score += 0.05;
    if (rallyT > 0) score += 0.1;
    score += Math.random() * 0.15;
    debateWon = score >= 0.55;
    setObj("debate", 1);
    burst(player.x, player.y, debateWon ? "#80e0a0" : "#e08080", 18);
    if (debateWon) {
      addRep(8);
      addCoins(10);
      balloon(player.x, player.y - 44, "Debate win!", 2.5);
      toast("Plaza Debate: You land the line. The crowd actually listens.");
      pushLog("Won the Plaza Debate. Press Heat and Street Cred rise (rep).");
      // Debate is the student errand climax
      bumpFavor("students", 2, { autoJoin: true });
      bumpFavor("moderates", 1);
      meta.debatesWon = (meta.debatesWon || 0) + 1;
      saveMeta();
      evaluateMilestones(true);
    } else {
      addRep(2);
      addCoins(3);
      balloon(player.x, player.y - 44, "Messy debate", 2.5);
      toast("Plaza Debate: You fumble a metaphor. Still, you showed up.");
      pushLog("Debate was messy. A few polite claps.");
      bumpFavor("students", 1);
    }
    saveGame();
  }

  function adjustCampaignLoyalty(id, delta) {
    if (!campaign) campaign = newCampaign();
    campaign.loyalty[id] = clamp((campaign.loyalty[id] == null ? 50 : campaign.loyalty[id]) + (delta || 0), 0, 100);
    return campaign.loyalty[id];
  }

  function resolveCampaignEvent(eventId, choiceIndex = 0, success = true) {
    const chapter = campaignChapter();
    const decision = chapter && (chapter.decisions || []).find((d) => d.id === eventId);
    if (!decision) return false;
    const idx = clamp(choiceIndex | 0, 0, Math.max(0, decision.options.length - 1));
    const option = decision.options[idx];
    const scale = success === false ? -0.5 : 1;
    Object.entries(option.loyalty || {}).forEach(([id, delta]) => adjustCampaignLoyalty(id, Math.round(delta * scale)));
    if (option.infrastructure) campaign.infrastructure = Math.max(0, campaign.infrastructure + Math.round(option.infrastructure * scale));
    if (option.readiness) campaign.readiness = Math.max(0, campaign.readiness + Math.round(option.readiness * scale));
    if (option.rescue && success !== false) campaign.rescues += 1;
    if (option.promise) campaign.promises[option.promise] = success !== false ? "kept" : "broken";
    Object.entries(option.district || {}).forEach(([id, delta]) => {
      campaign.districts[id] = (campaign.districts[id] || 0) + Math.round(delta * scale);
    });
    if (option.heat) addAxes({ heat: Math.round(option.heat * scale) });
    campaign.decisions.push({
      chapter: chapter.id,
      event: eventId,
      choice: idx,
      text: option.text,
      success: success !== false,
    });
    const loyaltyReport = Object.entries(option.loyalty || {})
      .map(([id, delta]) => `${id} ${Math.round(delta * scale) >= 0 ? "+" : ""}${Math.round(delta * scale)}`)
      .join(", ");
    const report = `${chapter.name}: ${option.text}${loyaltyReport ? ` (${loyaltyReport})` : ""}.`;
    pushLog(report);
    toast(report, 4.5);
    saveGame();
    return true;
  }

  function recordCampaignWeek(outcome) {
    if (!campaign) return;
    campaign.weeks += 1;
    voters.forEach((id) => adjustCampaignLoyalty(id, Math.round(((voterLoyalty[id] || 50) - 50) / 8)));
    const average = Object.values(campaign.loyalty).reduce((sum, n) => sum + n, 0) / Math.max(1, Object.keys(campaign.loyalty).length);
    const won = average >= 38 && (!outcome || outcome.id !== "E5");
    const wasInOffice = campaign.inOffice;
    if (won) campaign.electionWins += 1;
    else campaign.electionLosses += 1;
    campaign.inOffice = won;
    if (won && !wasInOffice) {
      banner("CIVIC COMEBACK", "#80e0a0", 2.5);
      toast("Your organizing rebuilt enough loyalty to return to office.");
      pushLog("Civic comeback: opposition organizing became a governing majority.");
    } else if (!won && wasInOffice) {
      toast("You lose office, but the campaign continues from the opposition.");
      pushLog("Lost office; continued as Opposition Organizer.");
    }
  }

  function beginChapterIntro() {
    chapterPhase = "intro";
    chapterDecisionIndex = 0;
    chapterChoice = 0;
    state = "chapter";
    stopMusic();
  }

  function chapterControl(action) {
    if (state !== "chapter") return { phase: chapterPhase, choice: chapterChoice, decisionIndex: chapterDecisionIndex, state };
    const chapter = campaignChapter();
    const decision = chapter && (chapter.decisions || [])[chapterDecisionIndex];
    const n = decision ? decision.options.length : 0;
    if (chapterPhase === "decision" && n && action === "up") chapterChoice = (chapterChoice + n - 1) % n;
    else if (chapterPhase === "decision" && n && action === "down") chapterChoice = (chapterChoice + 1) % n;
    else if (action === "confirm") advanceCampaignChapter();
    return { phase: chapterPhase, choice: chapterChoice, decisionIndex: chapterDecisionIndex, state };
  }

  function pollChapterGamepad() {
    if (state !== "chapter" || typeof navigator === "undefined" || !navigator.getGamepads) return;
    try {
      const pad = Array.from(navigator.getGamepads()).find(Boolean);
      if (!pad) return;
      const up = !!(pad.buttons[12] && pad.buttons[12].pressed) || (pad.axes[1] || 0) < -0.55;
      const down = !!(pad.buttons[13] && pad.buttons[13].pressed) || (pad.axes[1] || 0) > 0.55;
      const confirm = !!(pad.buttons[0] && pad.buttons[0].pressed);
      if (up && !chapterPad.up) chapterControl("up");
      if (down && !chapterPad.down) chapterControl("down");
      if (confirm && !chapterPad.confirm) chapterControl("confirm");
      chapterPad.up = up;
      chapterPad.down = down;
      chapterPad.confirm = confirm;
    } catch (_) {}
  }

  function advanceCampaignChapter() {
    if (!campaign) return false;
    if (chapterPhase === "intro") {
      state = "play";
      syncMusic();
      return true;
    }
    const chapter = campaignChapter();
    const decisions = (chapter && chapter.decisions) || [];
    if (chapterPhase === "decision" && chapterDecisionIndex < decisions.length) {
      const missionResult = chapterMission && chapterMission.success;
      resolveCampaignEvent(decisions[chapterDecisionIndex].id, chapterChoice, missionResult !== false);
      chapterDecisionIndex += 1;
      chapterChoice = 0;
      if (chapterDecisionIndex < decisions.length) return true;
      chapterPhase = "exit";
      return true;
    }
    if (chapterPhase === "exit") {
      if (campaign.chapter >= CAMPAIGN_CHAPTERS.length - 1) {
        campaign.complete = true;
        saveGame();
        state = "title";
        return true;
      }
      campaign.chapter += 1;
      const char = selected;
      resetRun(char, true);
      beginChapterIntro();
      saveGame();
      return true;
    }
    return false;
  }

  function endDay(voluntary) {
    if (dayEnded) return;
    dayEnded = true;
    floaters = [];
    balloons = [];
    sfx("sleep");
    let homeOk = false;
    if (voluntary && inZone(player.x, player.y, getZone("home"), 20)) {
      setObj("home", 1);
      homeOk = true;
      toast("You make it home. Night drapes Pocket Republic in soft neon.");
    } else if (time >= NIGHT_AT) {
      if (inZone(player.x, player.y, getZone("home"), 40)) {
        setObj("home", 1);
        homeOk = true;
      } else {
        addAxes({ street: -2, heat: 2 });
        lateNights += 1;
        scandals.push("Late night day " + dayIndex);
        pushLog("Caught out after dark. Sidewalk judges silently.");
        toast("Night falls mid-map. A little scandalous.");
      }
    } else if (voluntary) {
      setObj("home", 1);
      homeOk = true;
    }
    // Sleep cools the nerves a bit
    calmAnger(18, "sleep");
    // loyalty maintenance (mild) + light rival pressure
    const riskIds = applyLoyaltyEndOfDay();
    const rivalNote = applyRivalEndOfDay();
    const crisis = getCrisis();
    const daySummary = {
      day: dayIndex,
      crisis: crisis.title,
      rule: getBoardRule().title,
      coins,
      rep,
      axes: { ...axes },
      powerRank,
      spatCount,
      voters: voters.slice(),
      loyalty: { ...voterLoyalty },
      coalition: coalitionLabel(),
      objectives: currentObjectives().map((o) => ({
        label: o.label,
        done: objDone(o.id),
        prog: o.id === "voters" ? recruitsToday : objProg[o.id] || 0,
        target: o.target,
        // evening clarity: show true new-today count for recruit row
      })),
      homeOk,
      debateDone,
      debateWon,
      upgraded,
      recruitsToday,
      atRisk: riskIds.slice(),
      rivalPressure,
      rivalNote,
      boardTipId,
      remaining: remainingVoterCount(),
    };
    evening = daySummary;
    if (rivalNote) {
      toast(`${RIVAL_NAME} poached ${rivalNote.name}. Win them back with errands.`);
    } else if (riskIds.length) {
      toast(`Loyalty soft: ${riskIds.length} bloc(s) at risk. Watch Heat / spats.`);
    }
    // mid-day flag false for save — evening continues to next morning
    state = "evening";
    // persist as end-of-day (not mid-day)
    try {
      if (typeof localStorage !== "undefined" && selected) {
        const data = serializeRun();
        data.midDay = false;
        // after evening, next load should be morning of dayIndex (or results after last)
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      }
    } catch (_) {}
  }

  function finishEvening() {
    if (!evening) {
      state = "play";
      return;
    }
    if (dayIndex >= campaignMaxDays()) {
      // Election Night → final results
      const outcome = civicOutcome();
      results = {
        coins,
        rep,
        axes: { ...axes },
        powerRank,
        spatCount,
        lateNights,
        scandals: scandals.slice(),
        setpieces: { ...setpieces },
        voters: voters.slice(),
        loyalty: { ...voterLoyalty },
        coalition: coalitionLabel(),
        outcome,
        objectives: evening.objectives,
        upgraded,
        character: selected.name,
        days: campaignMaxDays(),
        debateWon,
        electionNight: true,
        codexCount: Object.keys(codexSeen).length,
        // Texture pack: shareable run summary
        summary: {
          headline: dayHeadline,
          recruits: voters.length,
          steals: rivalStealsWeek,
          coleMemos: consultantPaid,
          petePays: potholePaid,
          pigeons: pigeonDoneWeek,
          spatCount,
          rivalPressure,
          coalition: coalitionLabel(),
          ending: outcome && outcome.title,
          character: selected.name,
          charId: selected.id,
        },
      };
      // 1.1 soft NG+: bank a small start bonus if week was strong
      const score = (axes.street || 0) + (axes.donor || 0) + voters.length * 3 + (debateWon ? 5 : 0);
      ngPlusBonus = score >= 60 ? 6 : score >= 40 ? 3 : 0;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("orangeDay_ngPlus", String(ngPlusBonus));
        }
      } catch (_) {}
      checkAchievements();
      if (dayIndex >= campaignMaxDays()) unlockAchieve("week_clear", "Civic Chapter Cleared");
      if (outcome && outcome.id === "E1") unlockAchieve("ending_e1", "Ending: Civic Darling");
      if (outcome && outcome.id === "E4") unlockAchieve("ending_e4", "Ending: Money Machine");
      // Account meta + cast unlocks (milestones)
      const coalObj = activeCoalition();
      recordWeekClear(outcome, coalitionLabel(), coalObj ? coalObj.id : null);
      recordCampaignWeek(outcome);
      finalizeChapterMission();
      // remember best ending (by axis sum)
      try {
        const score = (axes.street || 0) + (axes.donor || 0) - (axes.heat || 0) * 0.5 + voters.length;
        const prev = bestEnding && bestEnding.score != null ? bestEnding.score : -999;
        if (score >= prev) {
          bestEnding = {
            id: outcome.id,
            title: outcome.title,
            character: selected.name,
            score,
            coalition: coalitionLabel(),
          };
          if (typeof localStorage !== "undefined") localStorage.setItem(BEST_KEY, JSON.stringify(bestEnding));
        }
      } catch (_) {}
      evening = null;
      state = "results";
      saveGame();
      sfx("fanfare");
      banner("ELECTION NIGHT", "#ffb347", 2.5);
      return;
    }
    dayIndex += 1;
    evening = null;
    beginDay(false);
    state = "play";
    toast(`Dawn of Day ${dayIndex}. ${getCrisis().title}.`);
  }

  // ─── Update ──────────────────────────────────────────────────
  function update(dt) {
    animT += dt;
    syncMusic();
    tickMusic(dt);
    if (msgT > 0) {
      msgT -= dt;
      if (msgT <= 0) drainToastQueue();
    } else {
      drainToastQueue();
    }
    interactFlash = Math.max(0, interactFlash - dt);
    rallyT = Math.max(0, rallyT - dt);
    pollChapterGamepad();

    // Cat Lady auto-ambush: walk near her once/day → stuck monologue
    // Day 1: wait until mid-morning so first errands aren't ambushed
    if (state === "play" && !dialogue && !dayEnded && player && catLadyDay !== dayIndex) {
      if (!(dayIndex === 1 && time < 0.32)) {
        const cl = NPCS.find((n) => n.id === "catlady");
        if (cl && dist(player.x, player.y, cl.x, cl.y) < 52) {
          talkNpc(cl);
        }
      }
    }

    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      f.y -= 22 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = balloons.length - 1; i >= 0; i--) {
      balloons[i].life -= dt;
      balloons[i].y -= 6 * dt;
      if (balloons[i].life <= 0) balloons.splice(i, 1);
    }
    for (const a of ambient) {
      a.x += a.vx * dt * (0.4 + Math.sin(animT + a.y) * 0.2);
      a.y += a.vy * dt * 0.15;
      a.life += dt * 0.2;
      if (a.x > MAP_W + 20) a.x = -10;
      if (a.y < -20) a.y = MAP_H + 10;
    }

    if (state !== "play") return;
    // Stuck in monologue — E advances bubbles; no walking away mid-rant
    if (dialogue) {
      if (player) player.moving = false;
      return;
    }

    daySec += dt;
    time = clamp(daySec / DAY_SECONDS, 0, 1);
    if (time >= NIGHT_AT && !dayEnded) {
      if (time >= 0.98) endDay(false);
    }
    redistribT = Math.max(0, redistribT - dt);
    launchT = Math.max(0, launchT - dt);
    brandT = Math.max(0, brandT - dt);
    camPunch = Math.max(0, camPunch - dt);
    if (launchT > 0) {
      // residual speed while thrusters warm
    }
    // Chaos ticket random noise
    const coalNoise = activeCoalition();
    if (coalNoise && coalNoise.id === "chaos_ticket" && Math.random() < dt * 0.04) {
      addAxes({ heat: 1 });
      if (Math.random() < 0.3) toast("Chaos Ticket: a rumor goes viral for no reason.");
    }
    maybeMicroEvent();
    pumpTips(dt);

    // movement (keyboard + touch + gamepad)
    let mx = 0,
      my = 0;
    if (keys["w"] || keys["ArrowUp"]) my -= 1;
    if (keys["s"] || keys["ArrowDown"]) my += 1;
    if (keys["a"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["d"] || keys["ArrowRight"]) mx += 1;
    mx += touchMove.x;
    my += touchMove.y;
    try {
      const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p) continue;
        const dead = 0.25;
        if (Math.abs(p.axes[0]) > dead) mx += p.axes[0];
        if (Math.abs(p.axes[1]) > dead) my += p.axes[1];
        // d-pad buttons 12-15 common
        if (p.buttons[12] && p.buttons[12].pressed) my -= 1;
        if (p.buttons[13] && p.buttons[13].pressed) my += 1;
        if (p.buttons[14] && p.buttons[14].pressed) mx -= 1;
        if (p.buttons[15] && p.buttons[15].pressed) mx += 1;
        // A / South = 0 interact, X / West = 2 power, Start = 9 pause
        if (p.buttons[0] && p.buttons[0].pressed && !p._a) {
          p._a = true;
          interact();
        } else if (p.buttons[0] && !p.buttons[0].pressed) p._a = false;
        if (p.buttons[2] && p.buttons[2].pressed && !p._x) {
          p._x = true;
          const v = getZone("vending");
          if (v && inZone(player.x, player.y, v, 24) && (!upgraded || powerRank < 3)) buyUpgrade();
          else usePower();
        } else if (p.buttons[2] && !p.buttons[2].pressed) p._x = false;
        if (p.buttons[9] && p.buttons[9].pressed && !p._st) {
          p._st = true;
          state = state === "pause" ? "play" : "pause";
        } else if (p.buttons[9] && !p.buttons[9].pressed) p._st = false;
      }
    } catch (_) {}
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
      // 4-way facing: prefer vertical when stronger, else side
      if (Math.abs(my) > Math.abs(mx) * 0.85) {
        player.dir = my < 0 ? "up" : "down";
      } else if (mx) {
        player.dir = "side";
        player.facing = mx > 0 ? 1 : -1;
      }
    }
    let spd = selected.speed * (toolLevel > 0 ? 1.08 : 1);
    spd *= currentCampaignWeather().movement;
    const districtCondition = campaign && (campaign.districts[currentDistrict] || (currentDistrict === "plaza" && campaign.districts.market) || 0);
    spd *= clamp(1 + districtCondition * 0.01, 0.85, 1.15);
    if (selected.id === "mayor" && orderUsed) spd *= 0.95;
    if (rallyT > 0 && selected.id === "alex") spd *= 1.1 + powerRank * 0.03;
    if (selected.id === "bernie") spd *= coffeeFixed || redistribT > 0 ? 1.12 : 0.9;
    if (redistribT > 0) spd *= 1.05;
    if (launchT > 0) spd *= 1.45;
    const nx = clamp(player.x + mx * spd * dt, 24, MAP_W - 24);
    const ny = clamp(player.y + my * spd * dt, 24, MAP_H - 24);
    const tryDistrict = (x, y) => {
      if (x >= 1650 && y < 420) return "donor";
      if (x >= 1100) return "media";
      if (y >= 680) return "campus";
      return "plaza";
    };
    const nd = tryDistrict(nx, ny);
    if (districtUnlocked(nd)) {
      player.x = nx;
      player.y = ny;
      if (nd !== currentDistrict) currentDistrict = nd;
    } else if (districtUnlocked(tryDistrict(nx, player.y))) {
      player.x = nx;
    } else if (districtUnlocked(tryDistrict(player.x, ny))) {
      player.y = ny;
    }
    player.moving = !!(mx || my);
    player.bob += dt * 8 * (player.moving ? 1 : 0.3);
    if (player.moving) {
      player.walkFrame += dt * 10;
      player.blinkOn = false;
      footDustT -= dt;
      if (footDustT <= 0) {
        footDustT = 0.12;
        particles.push({
          x: player.x + (Math.random() - 0.5) * 8,
          y: player.y + 10,
          vx: (Math.random() - 0.5) * 20,
          vy: -10 - Math.random() * 15,
          life: 0.35,
          color: "rgba(200,180,120,0.5)",
          r: 2,
        });
      }
    } else {
      player.walkFrame = 0;
      player.blinkT = (player.blinkT || 0) + dt;
      if (player.blinkT > 2.4) {
        player.blinkOn = true;
        if (player.blinkT > 2.55) {
          player.blinkOn = false;
          player.blinkT = 0;
        }
      }
    }

    // soft collision with locked door block
    if (!lockedOpen) {
      const L = { x: 560, y: 55, w: 90, h: 90 };
      if (player.x > L.x && player.x < L.x + L.w && player.y > L.y && player.y < L.y + L.h) {
        // push out
        const cx = L.x + L.w / 2;
        const cy = L.y + L.h / 2;
        if (Math.abs(player.x - cx) > Math.abs(player.y - cy)) {
          player.x = player.x < cx ? L.x - 2 : L.x + L.w + 2;
        } else {
          player.y = player.y < cy ? L.y - 2 : L.y + L.h + 2;
        }
      }
    }

    cam.x = clamp(player.x - W / 2, 0, MAP_W - W);
    cam.y = clamp(player.y - H / 2, 0, MAP_H - H);
  }

  // ─── Draw ────────────────────────────────────────────────────
  function dayColor() {
    // morning → noon → golden → night
    if (time < 0.25) return { sky: "#87b8e0", ground: "#6a9a58", tint: "rgba(255,220,160,0.08)" };
    if (time < 0.55) return { sky: "#6aa8d8", ground: "#5a9a50", tint: "rgba(255,255,255,0.04)" };
    if (time < 0.75) return { sky: "#e0a060", ground: "#6a8a48", tint: "rgba(255,160,60,0.12)" };
    if (time < NIGHT_AT) return { sky: "#c07090", ground: "#4a6a40", tint: "rgba(120,60,100,0.18)" };
    return { sky: "#1a1838", ground: "#2a3a30", tint: "rgba(20,20,50,0.35)" };
  }

  function drawRounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTiledGround() {
    const grass = spr("tiles/grass");
    const path = spr("tiles/path");
    const tile = 32;
    if (grass) {
      ctx.imageSmoothingEnabled = false;
      for (let x = 0; x < MAP_W; x += tile) {
        for (let y = 0; y < MAP_H; y += tile) {
          ctx.drawImage(grass, x, y, tile, tile);
        }
      }
    } else {
      ctx.fillStyle = dayColor().ground;
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    }
    // paths
    const pathRects = [
      [100, 180, 900, 28],
      [340, 60, 28, 500],
      [100, 380, 700, 22],
      [700, 200, 24, 200],
    ];
    for (const [px, py, pw, ph] of pathRects) {
      if (path) {
        for (let x = px; x < px + pw; x += tile) {
          for (let y = py; y < py + ph; y += tile) {
            ctx.drawImage(path, x, y, Math.min(tile, px + pw - x), Math.min(tile, py + ph - y));
          }
        }
      } else {
        ctx.fillStyle = "#c8b898";
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }

  function drawWorld() {
    const d = dayColor();
    // sky fill beyond map
    ctx.fillStyle = d.sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const shake = camPunch > 0 ? (Math.random() - 0.5) * 10 * camPunch : 0;
    ctx.translate(-cam.x + shake, -cam.y + shake * 0.6);

    drawTiledGround();

    // District region washes
    const regions = [
      { id: "media", x: 1100, y: 0, w: 1100, h: 600, col: "rgba(100,40,140,0.08)" },
      { id: "campus", x: 0, y: 680, w: 1100, h: 420, col: "rgba(40,120,60,0.1)" },
      { id: "donor", x: 1650, y: 0, w: 550, h: 400, col: "rgba(160,130,40,0.1)" },
    ];
    for (const r of regions) {
      if (!districtUnlocked(r.id)) {
        ctx.fillStyle = "rgba(20,15,30,0.45)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = "rgba(200,180,220,0.5)";
        ctx.font = "bold 18px Segoe UI,sans-serif";
        ctx.textAlign = "center";
        const d = DISTRICTS.find((x) => x.id === r.id);
        ctx.fillText(`🔒 ${d ? d.name : r.id} — Day ${d ? d.unlockDay : "?"}`, r.x + r.w / 2, r.y + r.h / 2);
      } else {
        ctx.fillStyle = r.col;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }

    // ambient pollen / leaves (behind props)
    for (const a of ambient) {
      ctx.globalAlpha = 0.35 + Math.sin(a.life * 4) * 0.15;
      ctx.fillStyle = a.kind === "leaf" ? "#c8e060" : "#ffe8a0";
      ctx.beginPath();
      ctx.ellipse(a.x, a.y, a.kind === "leaf" ? 4 : 2, 2, a.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // zones (buildings — drawn before actors)
    for (const z of ZONES) {
      drawZone(z);
    }

    // plaza clutter (benches, signs, pigeons, etc.)
    for (const c of CLUTTER) {
      const by = c.bob ? Math.sin(animT * 3 + c.x * 0.02) * 2 : 0;
      if (!drawSprite(c.key, c.x, c.y + by, c.w, c.h)) {
        ctx.fillStyle = "rgba(200,180,120,0.5)";
        ctx.fillRect(c.x, c.y, c.w, c.h);
      }
    }

    // buttons
    for (const b of BUTTON_SPOTS) {
      if (b.taken) continue;
      const by = b.y + Math.sin(animT * 4 + b.x) * 3;
      if (!drawSpriteCentered("items/campaign_button", b.x, by, 24, 24)) {
        ctx.save();
        ctx.translate(b.x, by);
        ctx.fillStyle = "#e04040";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // sparkle
      if (Math.sin(animT * 6 + b.x) > 0.7) {
        ctx.fillStyle = "rgba(255,255,200,0.8)";
        ctx.fillRect(b.x + 6, by - 8, 3, 3);
      }
    }

    // Y-sort NPCs + player for depth
    const actors = NPCS.map((n) => ({ type: "npc", ref: n, y: n.y }));
    if (player) actors.push({ type: "player", y: player.y });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.type === "npc") drawNpc(a.ref);
      else drawPlayerBody();
    }
    drawPlayerFx(); // auras + [E] after bodies

    // follower voter icons (party trail)
    if (player) {
      voters.forEach((id, i) => {
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (!g) return;
        const ang = animT * 1.5 + i * ((Math.PI * 2) / Math.max(voters.length, 1));
        const fx = player.x + Math.cos(ang) * (30 + i * 3);
        const fy = player.y + Math.sin(ang) * (18 + i * 2) + 10;
        if (!drawSpriteCentered("voters/" + id, fx, fy, 24, 24)) {
          ctx.beginPath();
          ctx.fillStyle = g.color;
          ctx.arc(fx, fy, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // particles & floaters
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = "bold 13px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // talk balloons
    for (const b of balloons) {
      drawBalloon(b);
    }

    // home sleep prompt sparkle
    if (player && canSleepAtHome()) {
      const h = getZone("home");
      if (h && inZone(player.x, player.y, h, 30)) {
        ctx.fillStyle = `rgba(255,230,120,${0.5 + Math.sin(animT * 6) * 0.3})`;
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Zzz  E to sleep", h.x + h.w / 2, h.y - 6);
      }
    }

    ctx.restore();

    // day tint
    ctx.fillStyle = d.tint;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBalloon(b) {
    const alpha = clamp(b.life / Math.min(0.4, b.max) , 0, 1);
    // fade in first 0.15 and out last 0.4
    const a = b.life < 0.4 ? b.life / 0.4 : b.life > b.max - 0.15 ? (b.max - b.life) / 0.15 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = "bold 11px Segoe UI,sans-serif";
    const tw = Math.min(200, ctx.measureText(b.text).width + 16);
    const th = 22;
    const x = b.x - tw / 2;
    const y = b.y - th;
    ctx.fillStyle = "rgba(255,252,245,0.95)";
    drawRounded(x, y, tw, th, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,30,50,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.moveTo(b.x - 5, y + th);
    ctx.lineTo(b.x, y + th + 7);
    ctx.lineTo(b.x + 5, y + th);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a2038";
    ctx.textAlign = "center";
    ctx.fillText(b.text, b.x, y + 15);
    ctx.globalAlpha = 1;
  }

  function propKeyForZone(z) {
    if (z.id === "unlocked") return "props/locked";
    // reuse plaza prop art for new district hubs when dedicated art missing
    const aliases = {
      studio: "props/stage",
      cameras: "props/booth",
      leakdesk: "props/board",
      quad: "props/park",
      petition: "props/board",
      march: "props/stage",
      velvet: "props/booth",
      gala: "props/mayor",
      pitch: "props/vending",
      gate_media: "props/alley",
      gate_campus: "props/alley",
      gate_plaza_m: "props/alley",
      gate_plaza_c: "props/alley",
      gate_donor_m: "props/alley",
      gate_media_d: "props/alley",
    };
    if (aliases[z.id]) return aliases[z.id];
    return "props/" + z.id;
  }

  function drawZone(z) {
    const bob = Math.sin(animT * 2 + z.x * 0.01) * 1.5;
    ctx.save();
    ctx.translate(0, bob);

    const key = propKeyForZone(z);
    const drawn = drawSprite(key, z.x - 4, z.y - 8, z.w + 8, z.h + 12);

    if (!drawn) {
      // procedural fallback
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      drawRounded(z.x + 4, z.y + z.h - 6, z.w, 12, 6);
      ctx.fill();
      const grd = ctx.createLinearGradient(z.x, z.y, z.x, z.y + z.h);
      grd.addColorStop(0, shade(z.color, 1.15));
      grd.addColorStop(1, shade(z.color, 0.75));
      ctx.fillStyle = grd;
      drawRounded(z.x, z.y, z.w, z.h, 10);
      ctx.fill();
    }

    // coffee broken X overlay
    if (z.id === "coffee" && !coffeeFixed) {
      ctx.strokeStyle = "#f44";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(z.x + 20, z.y + 20);
      ctx.lineTo(z.x + z.w - 20, z.y + z.h - 20);
      ctx.moveTo(z.x + z.w - 20, z.y + 20);
      ctx.lineTo(z.x + 20, z.y + z.h - 20);
      ctx.stroke();
    }

    // label
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    drawRounded(z.x + 6, z.y + z.h - 18, z.w - 12, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h - 6);

    // interact hint ring if near
    if (player && dist(player.x, player.y, z.x + z.w / 2, z.y + z.h / 2) < INTERACT_R + 10) {
      ctx.strokeStyle = "rgba(255,200,80,0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      drawRounded(z.x - 4, z.y - 4, z.w + 8, z.h + 8, 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function shade(hex, m) {
    const n = parseInt(hex.slice(1), 16);
    let r = ((n >> 16) & 255) * m;
    let g = ((n >> 8) & 255) * m;
    let b = (n & 255) * m;
    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function drawNpc(n) {
    // crowd sway (Phase D)
    const bounce = Math.sin(animT * 2.2 + n.x * 0.05) * 2.5 + Math.sin(animT * 3.1 + n.y) * 0.8;
    const key = "npc/" + n.id;
    const w = 48,
      h = 60;
    if (!drawSprite(key, n.x - w / 2, n.y - h + 10 + bounce, w, h)) {
      ctx.save();
      ctx.translate(n.x, n.y + bounce);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 10, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n.color;
      drawRounded(-12, -22, 24, 28, 8);
      ctx.fill();
      ctx.fillStyle = "#ffe8d0";
      ctx.beginPath();
      ctx.arc(0, -18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(n.name.split(" ").pop(), n.x, n.y + 18 + bounce);
  }

  function playerSpriteKey() {
    if (!selected || !player) return null;
    const id = selected.id;
    const dir = player.dir || "down";
    if (player.moving) {
      // Prefer true 4-frame walk (1.1); fallback to 2-frame or idle-insert cycle
      const phase = Math.floor(player.walkFrame) % 4;
      const k4 = `player/${id}_${dir}_${phase}`;
      if (spr(k4)) return k4;
      const k2 = `player/${id}_${dir}_${phase % 2}`;
      if (spr(k2)) return k2;
      if (phase === 0 || phase === 2) {
        const f = phase === 0 ? 0 : 1;
        if (spr(`player/${id}_walk_${f}`)) return `player/${id}_walk_${f}`;
      }
      const idle = `player/${id}_${dir}_idle`;
      if (spr(idle)) return idle;
      return `player/${id}_idle`;
    }
    const k = `player/${id}_${dir}_idle`;
    if (spr(k)) return k;
    return `player/${id}_idle`;
  }

  function drawPlayerBody() {
    if (!player || !selected) return;
    const bob = Math.sin(player.bob) * 2;
    const pw = 52,
      ph = 64;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    // flip only for side-facing left
    const flip = player.dir === "side" ? player.facing : 1;
    ctx.scale(flip, 1);

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const key = playerSpriteKey();
    // idle blink: slight vertical squash on head region via scale
    if (player.blinkOn && !player.moving) {
      ctx.scale(1, 0.92);
    }
    const drawn = key && drawSprite(key, -pw / 2, -ph + 16, pw, ph);

    if (!drawn) {
      ctx.fillStyle = selected.color;
      drawRounded(-10, -28, 20, 36, 8);
      ctx.fill();
      ctx.fillStyle = selected.accent;
      ctx.beginPath();
      ctx.arc(0, -32, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.fillRect(-5, -34, 3, 4);
      ctx.fillRect(2, -34, 3, 4);
    }
    ctx.restore();
  }

  function drawPlayerFx() {
    if (!player || !selected) return;
    const bob = Math.sin(player.bob) * 2;
    if (rallyT > 0) {
      ctx.strokeStyle = `rgba(100,255,160,${0.4 + Math.sin(animT * 10) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y + bob - 10, 28 + Math.sin(animT * 8) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (squeezeActive) {
      ctx.strokeStyle = "rgba(255,160,60,0.7)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(player.x, player.y + bob - 8, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const hit = nearestInteractable();
    if (hit) {
      const hx = hit.type === "zone" ? hit.ref.x + hit.ref.w / 2 : hit.ref.x;
      const hy = (hit.type === "zone" ? hit.ref.y : hit.ref.y) - 28;
      const pulse = 0.65 + Math.sin(animT * 8) * 0.2 + interactFlash;
      ctx.fillStyle = `rgba(255,220,80,${pulse})`;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("[E]", hx, hy);
    }
  }

  function drawAngerMeter() {
    if (!player || state !== "play") return;
    const a = clamp(anger || 0, 0, 100);
    const bw = 36,
      bh = 5;
    const x = player.x - bw / 2;
    const y = player.y - 58 + Math.sin(player.bob || 0) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    drawRounded(x - 1, y - 1, bw + 2, bh + 2, 3);
    ctx.fill();
    // green → yellow → red
    const t = a / 100;
    const r = Math.floor(80 + t * 175);
    const g = Math.floor(200 - t * 160);
    const b = 70;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    drawRounded(x, y, Math.max(2, (bw * a) / 100), bh, 2);
    ctx.fill();
    if (a >= 70) {
      ctx.fillStyle = a >= 90 ? "#ff6060" : "#ffb080";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(a >= 90 ? "!" : "…", player.x, y - 4);
    }
  }

  function drawPlayer() {
    drawPlayerBody();
    drawAngerMeter();
    drawPlayerFx();
  }

  function drawHUD() {
    // top bar
    const barH = 58;
    ctx.fillStyle = "rgba(20,12,30,0.82)";
    ctx.fillRect(0, 0, W, barH);
    ctx.fillStyle = "rgba(255,140,40,0.35)";
    ctx.fillRect(0, barH - 2, W, 2);

    // Calendar: only past + today (no full-week spoiler strip of empty future days)
    const calY = barH + 4;
    const calW = 28;
    const shown = dayIndex; // reveal length by living it
    const calStart = W / 2 - (shown * (calW + 4)) / 2;
    for (let d = 1; d <= shown; d++) {
      const x = calStart + (d - 1) * (calW + 4);
      const cur = d === dayIndex;
      ctx.fillStyle = cur ? "rgba(255,140,40,0.85)" : "rgba(80,120,90,0.7)";
      drawRounded(x, calY, calW, 18, 4);
      ctx.fill();
      ctx.fillStyle = cur ? "#1a1020" : "#c8d8c8";
      ctx.font = font(10, "bold");
      ctx.textAlign = "center";
      ctx.fillText(String(d), x + calW / 2, calY + 13);
    }
    if (dayIndex >= campaignMaxDays()) {
      ctx.fillStyle = "#ffb347";
      ctx.font = font(9, "bold");
      ctx.fillText("EVE", calStart + shown * (calW + 4) + 8, calY + 13);
    }
    // Texture: morning headline ticker under calendar. Anchored left-of-
    // center with a capped width so it can't reach the top-right campaign
    // status box (drawSeasonWeather) regardless of scroll phase or headline
    // length — it used to span nearly the full canvas width (W-80) centered
    // near screen-middle and would render straight through that box.
    if (dayHeadline) {
      ctx.fillStyle = "rgba(255,200,120,0.75)";
      ctx.font = font(10);
      ctx.textAlign = "center";
      const scroll = (animT * 28) % (dayHeadline.length * 7 + 200);
      fitText("📰 " + dayHeadline, W * 0.4 - scroll * 0.15, calY + 32, 380, "center");
    }

    if (!selected) return;

    // character chip (sprite portrait)
    if (!drawSprite(`player/${selected.id}_down_idle`, 10, 4, 36, 44) && !drawSprite(`player/${selected.id}_idle`, 10, 4, 36, 44)) {
      ctx.fillStyle = selected.color;
      ctx.beginPath();
      ctx.arc(28, 26, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px Segoe UI,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(selected.short, 52, 20);
    ctx.font = "10px Segoe UI,sans-serif";
    ctx.fillStyle = "#c8b8d8";
    ctx.fillText(selected.power + (powerRank ? " r" + powerRank : ""), 52, 34);
    const dist = DISTRICTS.find((d) => d.id === currentDistrict);
    ctx.fillStyle = dist ? dist.color : "#aaa";
    fitText(dist ? dist.name : "Plaza", 52, 46, 120, "left");

    // stats: full axis names (room next to character chip) + coins
    const axX = 158;
    const axValX = 252;
    ctx.font = "bold 11px Cascadia Mono,monospace";
    const axRows = [
      { label: "Street", val: axes.street | 0, col: "#80e0a0", y: 18 },
      { label: "Donor", val: axes.donor | 0, col: "#80c0e0", y: 32 },
      { label: "Heat", val: axes.heat | 0, col: "#e080a0", y: 46 },
    ];
    axRows.forEach((r) => {
      ctx.textAlign = "left";
      ctx.fillStyle = r.col;
      ctx.fillText(r.label, axX, r.y);
      ctx.textAlign = "right";
      ctx.fillText(String(r.val), axValX, r.y);
    });
    ctx.textAlign = "right";
    ctx.font = "bold 14px Cascadia Mono,monospace";
    ctx.fillStyle = "#ffd060";
    ctx.fillText(`${coins}¢`, 292, 24);

    // day index chip — full "Day N" (no week-length spoiler)
    ctx.fillStyle = "rgba(255,160,60,0.25)";
    drawRounded(302, 10, 68, 32, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd090";
    ctx.font = "bold 13px Cascadia Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Day ${dayIndex}`, 336, 30);

    // day meter
    const meterX = 380,
      meterW = 170;
    ctx.fillStyle = "#443058";
    drawRounded(meterX, 16, meterW, 18, 8);
    ctx.fill();
    const dcol = time < 0.55 ? "#ffd060" : time < NIGHT_AT ? "#ff8060" : "#8090ff";
    ctx.fillStyle = dcol;
    drawRounded(meterX, 16, meterW * time, 18, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const tod = time < 0.3 ? "Morning" : time < 0.55 ? "Midday" : time < 0.75 ? "Afternoon" : time < NIGHT_AT ? "Evening" : "Night";
    const crisisShort = getCrisis().title.split(" ")[0];
    ctx.fillText(`${tod} · ${crisisShort}`, meterX + meterW / 2, 29);

    // voters — always numerical (icons when recruited)
    const vCount = voters.length;
    ctx.textAlign = "left";
    ctx.font = "bold 12px Cascadia Mono,monospace";
    ctx.fillStyle = vCount ? "#d8d0e8" : "#a098b0";
    ctx.fillText(`Voters: ${vCount}/12`, 568, 24);
    voters.forEach((id, i) => {
      if (i >= 6) return; // cap icons so we don't overrun Tool price
      const g = VOTER_GROUPS.find((v) => v.id === id);
      if (!g) return;
      if (!drawSprite("voters/" + id, 568 + i * 22, 30, 18, 18)) {
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(577 + i * 22, 39, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (vCount > 6) {
      ctx.fillStyle = "#a098b0";
      ctx.font = "10px sans-serif";
      ctx.fillText("+" + (vCount - 6), 568 + 6 * 22, 42);
    }

    // upgrade / power rank
    ctx.textAlign = "right";
    ctx.fillStyle = upgraded ? "#80e0ff" : "#ffb070";
    ctx.font = "bold 11px sans-serif";
    if (!upgraded) ctx.fillText(`Tool ${upgradePrice()}¢`, W - 16, 22);
    else if (powerRank < 3) ctx.fillText(`Pwr ${powerRank}/3 · ${powerUpgradeCost()}¢`, W - 16, 22);
    else ctx.fillText("Pwr MAX", W - 16, 22);
    const coalHud = activeCoalition();
    if (coalHud) {
      ctx.fillStyle = coalHud.color;
      fitText(coalHud.name, W - 16, 38, 200, "right");
    }

    // objectives panel
    if (showObj) {
      const inCampaign = !!campaign;
      const chapter = inCampaign ? campaignChapter() : null;
      // DAILY_OBJECTIVES below is written entirely around Election Week's
      // narrative (permit/coffee/debate/scandal/march/gala) — only show it
      // where that's still true. Every other chapter gets the compact
      // mission panel instead, which is the only objective-shaped UI those
      // chapters had until now.
      const showDailyDetail = !inCampaign || (chapter && chapter.id === "election");
      const ox = 12,
        ow = 300;
      let oy = 64;

      if (inCampaign && chapterMission && chapter) {
        const mh = chapterMission.completed ? 40 : 54;
        ctx.fillStyle = "rgba(20,16,34,0.82)";
        drawRounded(ox, oy, ow, mh, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(160,200,255,0.45)";
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillStyle = "#a8d0ff";
        ctx.font = "bold 12px Segoe UI,sans-serif";
        fitText(`${chapter.name} — Chapter Mission`, ox + 12, oy + 18, ow - 24, "left");
        ctx.font = "11px Segoe UI,sans-serif";
        ctx.fillStyle = chapterMission.completed ? "#6d6" : "#e8d8f0";
        const missionMark = chapterMission.completed ? "✓" : "○";
        fitText(
          `${missionMark} ${chapterMission.label}  ${chapterMission.progress}/${chapterMission.steps.length}`,
          ox + 12,
          oy + 36,
          ow - 24,
          "left"
        );
        if (!chapterMission.completed) {
          ctx.fillStyle = "#ffd090";
          fitText(`Next: ${chapterMission.steps[chapterMission.progress].toUpperCase()}`, ox + 12, oy + 50, ow - 24, "left");
        }
        oy += mh + 8;
      }

      if (showDailyDetail) {
        const objs = currentObjectives();
        const rows = objs.length;
        const oh = 28 + rows * 20;
        ctx.fillStyle = "rgba(20,12,30,0.78)";
        drawRounded(ox, oy, ow, oh, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,160,60,0.4)";
        ctx.stroke();
        ctx.fillStyle = "#ffb347";
        ctx.font = "bold 12px Segoe UI,sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Day ${dayIndex} Objectives  (Tab)`, ox + 12, oy + 18);
        objs.forEach((o, i) => {
          const done = objDone(o.id);
          const p = o.target === 0 ? 0 : objProg[o.id] || 0;
          ctx.fillStyle = done ? "#6d6" : "#e8d8f0";
          ctx.font = "11px Segoe UI,sans-serif";
          const mark = done ? "✓" : "○";
          const label = o.short || o.label;
          const prog = o.target === 0 ? "✓" : `${p}/${o.target}`;
          fitText(`${mark} ${label}  ${prog}`, ox + 12, oy + 40 + i * 20, ow - 24, "left");
        });
        // Uncommitted blocs — the "I can't find voters" fix
        const leftN = remainingVoterCount();
        const hintY = oy + 40 + objs.length * 20 + 4;
        if (leftN > 0 && leftN <= 6) {
          const miss = VOTER_GROUPS.filter((v) => !voters.includes(v.id)).slice(0, 2);
          ctx.fillStyle = "#a8d0ff";
          ctx.font = "10px Segoe UI,sans-serif";
          fitText(
            `Still open (${leftN}): ${miss.map((v) => v.name.split(" ")[0]).join(", ")}${leftN > 2 ? "…" : ""} · C codex`,
            ox + 12,
            hintY,
            ow - 24,
            "left"
          );
        } else if (leftN === 0) {
          ctx.fillStyle = "#80e0a0";
          ctx.font = "10px Segoe UI,sans-serif";
          fitText("All 12 blocs courted — recruit obj auto-clears.", ox + 12, hintY, ow - 24, "left");
        }
        // crisis + debate hint under objectives
        const extraY = hintY + 16;
        ctx.fillStyle = "#ffb070";
        ctx.font = "10px Segoe UI,sans-serif";
        fitText(`Crisis: ${getCrisis().title}`, ox + 12, extraY, ow - 24, "left");
        ctx.fillStyle = "#c0b0e0";
        fitText(`Rule: ${getBoardRule().title}`, ox + 12, extraY + 14, ow - 24, "left");
        if (getCrisis().debateDay && !debateDone) {
          ctx.fillStyle = "#e0a0ff";
          fitText("○ Plaza Debate at STAGE", ox + 12, extraY + 28, ow - 24, "left");
        } else if (debateDone) {
          ctx.fillStyle = debateWon ? "#8d8" : "#daa";
          fitText(debateWon ? "✓ Debate won" : "✓ Debate attempted", ox + 12, extraY + 28, ow - 24, "left");
        }
        const coal = activeCoalition();
        if (coal) {
          ctx.fillStyle = coal.color;
          fitText(coal.name, ox + 12, extraY + 42, ow - 24, "left");
        }
      }
    }

    // Codex panel (C)
    if (showCodex) {
      const cx = W - 320,
        cy = 86,
        cw = 300,
        ch = 400;
      ctx.fillStyle = "rgba(18,12,28,0.92)";
      drawRounded(cx, cy, cw, ch, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,180,80,0.5)";
      ctx.stroke();
      ctx.fillStyle = "#ffb347";
      ctx.font = "bold 13px Segoe UI,sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Voter Codex  (C)", cx + 12, cy + 22);
      ctx.fillStyle = "#a090b8";
      ctx.font = "11px Segoe UI,sans-serif";
      ctx.fillText(`${Object.keys(codexSeen).length}/12 known · scandals ${scandals.length}`, cx + 12, cy + 40);
      VOTER_GROUPS.forEach((g, i) => {
        const known = !!codexSeen[g.id] || voters.includes(g.id) || favorOf(g.id) > 0;
        const y = cy + 58 + i * 26;
        ctx.fillStyle = known ? g.color : "#555";
        ctx.font = "12px Segoe UI,sans-serif";
        fitText(known ? `${g.icon} ${g.name}` : "??? · ???", cx + 12, y, 170, "left");
        if (voters.includes(g.id)) {
          const L = voterLoyalty[g.id] || 0;
          ctx.fillStyle = L < 40 ? "#e08080" : "#8d8";
          ctx.fillText(L < 40 ? "⚠" + L : "IN", cx + 248, y);
        } else if (known) {
          const need = favorNeedOf(g);
          const fav = favorOf(g.id);
          ctx.fillStyle = fav >= need ? "#ffd080" : "#a090b8";
          ctx.font = "11px Cascadia Mono,monospace";
          ctx.fillText(`${fav}/${need}`, cx + 230, y);
        }
      });
      ctx.fillStyle = "#8878a8";
      ctx.font = "10px sans-serif";
      const tipG = boardTipId && VOTER_GROUPS.find((v) => v.id === boardTipId);
      fitText(
        tipG
          ? `Board tip: ${tipG.name} · Favor=errands · ⚠=loyalty soft`
          : "Favor=errands · IN/⚠=joined · Rival poaches soft loyalty",
        cx + 12,
        cy + ch - 16,
        cw - 24,
        "left"
      );
    }

    // toast — word-wrapped; larger on touch screens where the canvas shrinks
    if (msgT > 0 && msg) {
      ctx.globalAlpha = clamp(msgT > 0.3 ? 1 : msgT / 0.3, 0, 1);
      const fs = IS_COARSE ? 20 : 14;
      const lineH = fs + 6;
      ctx.font = (IS_COARSE ? "600 " : "") + fs + "px Segoe UI,sans-serif";
      const maxTextW = (IS_COARSE ? W - 80 : 720) - 48;
      const words = String(msg).split(" ");
      const lines = [];
      let line = "";
      for (const wd of words) {
        const test = line ? line + " " + wd : wd;
        if (line && ctx.measureText(test).width > maxTextW) {
          lines.push(line);
          line = wd;
          if (lines.length === 3) break;
        } else {
          line = test;
        }
      }
      if (line && lines.length < 3) lines.push(line);
      let widest = 0;
      for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
      const tw = Math.max(180, widest + 48);
      const th = lines.length * lineH + 22;
      const tx = W / 2 - tw / 2;
      const ty = H - 40 - th;
      ctx.fillStyle = "rgba(25,14,36,0.92)";
      drawRounded(tx, ty, tw, th, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,160,60,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff8e8";
      ctx.textAlign = "center";
      lines.forEach((l, i) => {
        ctx.fillText(l, W / 2, ty + 15 + fs * 0.5 + i * lineH);
      });
      ctx.globalAlpha = 1;
    }

    // near-night warning
    if (time >= NIGHT_AT - 0.08 && time < NIGHT_AT) {
      ctx.fillStyle = "rgba(255,80,80,0.85)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠ Night soon — return HOME!", W / 2, H - 86);
    }

    // inventory chips
    ctx.textAlign = "left";
    ctx.font = "11px monospace";
    ctx.fillStyle = "#ccc";
    let inv = [];
    if (hasPermit) inv.push("📜 Permit");
    if (buttons) inv.push(`🔘×${buttons}`);
    if (toolLevel) inv.push("🔧+");
    if (inv.length) ctx.fillText(inv.join("  "), 12, H - 12);
  }

  function drawSeasonWeather() {
    if (!campaign) return;
    const season = campaignSeason();
    const weather = currentCampaignWeather().name;
    const tint = { winter: "rgba(170,220,255,0.07)", spring: "rgba(150,255,190,0.05)", summer: "rgba(255,210,90,0.06)", fall: "rgba(220,110,45,0.07)" }[campaign.season];
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 58, W, H - 58);
    }
    const districtCondition = campaign.districts[currentDistrict] || (currentDistrict === "plaza" && campaign.districts.market) || 0;
    if (districtCondition) {
      ctx.fillStyle = districtCondition > 0 ? "rgba(90,220,130,0.16)" : "rgba(220,80,80,0.16)";
      ctx.fillRect(0, 58, W, H - 58);
    }
    // One shared, dynamically-sized box for every top-right status line —
    // previously the mission/condition lines had no backing at all (bare
    // text drawn straight onto the game world), and the box only ever
    // covered the season/weather line's fixed height regardless of how
    // many lines actually render.
    const rows = [{ text: `${season.name} · ${weather} · ${campaignChapter().name}`, color: (season.palette && season.palette[2]) || "#fff" }];
    if (chapterMission && !chapterMission.completed) {
      rows.push({ text: `MISSION ${chapterMission.progress}/${chapterMission.steps.length}: ${chapterMission.label}`, color: "#ffd090" });
    }
    if (districtCondition) {
      rows.push({
        text: `${currentDistrict.toUpperCase()} CONDITION ${districtCondition > 0 ? "+" : ""}${districtCondition}`,
        color: districtCondition > 0 ? "#9af0b0" : "#f0a0a0",
      });
    }
    const boxW = 210,
      boxH = 14 + rows.length * 17,
      boxX = W - boxW - 14,
      boxY = 62;
    ctx.fillStyle = "rgba(20,12,30,0.78)";
    drawRounded(boxX, boxY, boxW, boxH, 7);
    ctx.fill();
    ctx.font = font(10, "bold");
    rows.forEach((row, i) => {
      ctx.fillStyle = row.color;
      fitText(row.text, W - 22, boxY + 15 + i * 17, boxW - 16, "right");
    });
  }

  function skipIntro() {
    if (state !== "intro") return;
    state = "title";
    introT = INTRO_DUR;
    ensureAudio();
    sfx("ok");
  }

  /** In-engine cold open — always works (no external mp4). Slow zoom on key art. */
  function drawIntro(dt) {
    introT += dt || 1 / 60;
    const t = clamp(introT / INTRO_DUR, 0, 1);
    // ease-out
    const e = 1 - Math.pow(1 - t, 2.2);
    const zoom = 1.0 + 0.14 * e;

    // night backdrop
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#120820");
    g.addColorStop(0.5, "#1a1840");
    g.addColorStop(1, "#101828");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const baseW = 560,
      baseH = 320;
    const drawW = baseW * zoom,
      drawH = baseH * zoom;
    const dx = W / 2 - drawW / 2,
      dy = H / 2 - drawH / 2 - 10;
    ctx.save();
    // soft vignette frame
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    drawRounded(dx - 8, dy - 8, drawW + 16, drawH + 16, 14);
    ctx.fill();
    if (!drawSprite("ui/key_art", dx, dy, drawW, drawH)) {
      if (!drawSprite("ui/title_mascot", W / 2 - 40, H / 2 - 50, 80, 100)) {
        ctx.fillStyle = "#ff8c28";
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Fade in title near the end
    const titleA = clamp((t - 0.45) / 0.35, 0, 1);
    if (titleA > 0) {
      ctx.globalAlpha = titleA;
      ctx.fillStyle = "rgba(20,12,30,0.55)";
      drawRounded(W / 2 - 200, H - 150, 400, 70, 12);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 34px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Orange Day", W / 2, H - 118);
      ctx.fillStyle = "#ffb347";
      ctx.font = "700 20px Segoe UI,sans-serif";
      ctx.fillText("Pocket Republic", W / 2, H - 92);
      ctx.globalAlpha = 1;
    }

    // Skip cue
    const skipA = 0.35 + 0.35 * Math.sin(introT * 3);
    ctx.globalAlpha = clamp(skipA, 0.25, 0.85);
    ctx.fillStyle = "#c8b8d8";
    ctx.font = "12px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Click / Enter to skip", W / 2, H - 28);
    ctx.globalAlpha = 1;

    if (introT >= INTRO_DUR) {
      state = "title";
    }
  }

  function drawTitle() {
    // deep civic night sky
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1a0f30");
    g.addColorStop(0.45, "#1a2848");
    g.addColorStop(1, "#102018");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft orbs
    for (let i = 0; i < 10; i++) {
      const x = (Math.sin(animT * 0.35 + i) * 0.5 + 0.5) * W;
      const y = (Math.cos(animT * 0.28 + i * 1.2) * 0.5 + 0.5) * H * 0.7;
      ctx.fillStyle = `rgba(255,140,40,${0.05 + (i % 3) * 0.02})`;
      ctx.beginPath();
      ctx.arc(x, y, 24 + i * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // key art panel
    const bob = Math.sin(animT * 1.5) * 2;
    const artW = 480;
    const artH = 220;
    const artX = W / 2 - artW / 2;
    const artY = 28 + bob;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    drawRounded(artX - 6, artY - 6, artW + 12, artH + 12, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,160,60,0.55)";
    ctx.lineWidth = 3;
    drawRounded(artX - 6, artY - 6, artW + 12, artH + 12, 16);
    ctx.stroke();

    if (!drawSprite("ui/key_art", artX, artY, artW, artH)) {
      // fallback composition
      if (!drawSprite("ui/title_mascot", W / 2 - 48, 100 + bob, 96, 120)) {
        ctx.fillStyle = "#ff8c28";
        ctx.beginPath();
        ctx.arc(W / 2, 160, 50, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Compact wordmark under key art
    ctx.fillStyle = "rgba(20,12,30,0.55)";
    drawRounded(W / 2 - 170, 248, 340, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 26px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Orange Day", W / 2, 270);
    ctx.fillStyle = "#ffb347";
    ctx.font = "700 16px Segoe UI,sans-serif";
    ctx.fillText("Pocket Republic", W / 2, 290);

    // Quiet build chip
    ctx.fillStyle = "rgba(20,12,30,0.45)";
    drawRounded(W / 2 - 48, 8, 96, 18, 8);
    ctx.fill();
    ctx.fillStyle = "#a090b8";
    ctx.font = "bold 10px Cascadia Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText(BUILD_ID, W / 2, 21);

    // Full save cards (3) — no S1/S2 chips
    titleSaveCards = [];
    const cardW = 288,
      cardH = 118,
      gap = 14;
    const totalW = 3 * cardW + 2 * gap;
    const startX = (W - totalW) / 2;
    const cardY = 318;

    for (let s = 1; s <= 3; s++) {
      const x = startX + (s - 1) * (cardW + gap);
      const meta = getSaveMeta(s);
      const on = saveSlot === s;
      titleSaveCards.push({ slot: s, x, y: cardY, w: cardW, h: cardH, empty: !meta });

      ctx.fillStyle = on ? "rgba(50,32,70,0.96)" : "rgba(28,20,48,0.92)";
      drawRounded(x, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = on ? "#ff9a3c" : meta ? "rgba(120,100,160,0.55)" : "rgba(70,55,100,0.5)";
      ctx.lineWidth = on ? 3 : 1.5;
      drawRounded(x, cardY, cardW, cardH, 12);
      ctx.stroke();

      // Hit targets for New / Del on selected filled cards (set below)
      let btnNew = null,
        btnDel = null;

      if (meta) {
        // Portrait
        const px = x + 14,
          py = cardY + 18;
        if (
          !drawSprite(`player/${meta.charId}_down_idle`, px, py, 44, 54) &&
          !drawSprite(`player/${meta.charId}_idle`, px, py, 44, 54)
        ) {
          ctx.fillStyle = meta.charColor;
          ctx.beginPath();
          ctx.arc(px + 22, py + 26, 20, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Segoe UI,sans-serif";
        fitText(meta.charName, x + 68, cardY + 32, cardW - 84, "left");
        ctx.fillStyle = "#ffb347";
        ctx.font = "bold 12px Segoe UI,sans-serif";
        ctx.fillText("Day " + meta.dayIndex + (meta.midDay ? " · mid" : ""), x + 68, cardY + 50);
        ctx.fillStyle = "#c8b8d8";
        ctx.font = "11px Segoe UI,sans-serif";
        fitText(meta.district, x + 68, cardY + 68, cardW - 84, "left");
        ctx.fillStyle = "#ffd060";
        ctx.font = "bold 11px Cascadia Mono,monospace";
        ctx.fillText(meta.coins + "¢", x + 68, cardY + 86);
        ctx.fillStyle = "#a0d0a8";
        ctx.fillText(meta.voters + "v", x + 120, cardY + 86);

        if (on) {
          // Action strip: Continue | New | Del
          const by = cardY + cardH - 28;
          const bw = 78,
            bh = 20,
            bgap = 6;
          const bx0 = x + 10;
          const actions = [
            { id: "go", label: "Enter", x: bx0, color: "#ff9a3c" },
            { id: "new", label: "N new", x: bx0 + bw + bgap, color: "#80c0e0" },
            { id: "del", label: "Del", x: bx0 + 2 * (bw + bgap), color: "#e08080" },
          ];
          actions.forEach((a) => {
            ctx.fillStyle = "rgba(15,10,25,0.75)";
            drawRounded(a.x, by, bw, bh, 6);
            ctx.fill();
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 1.2;
            drawRounded(a.x, by, bw, bh, 6);
            ctx.stroke();
            ctx.fillStyle = a.color;
            ctx.font = "bold 11px Segoe UI,sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(a.label, a.x + bw / 2, by + 14);
            if (a.id === "new") btnNew = { x: a.x, y: by, w: bw, h: bh };
            if (a.id === "del") btnDel = { x: a.x, y: by, w: bw, h: bh };
          });
          // Pending confirm pulse
          if (titlePending && titlePending.slot === s && performance.now() - titlePending.t < 4000) {
            ctx.fillStyle = titlePending.action === "delete" ? "#e08080" : "#80c0e0";
            ctx.font = "bold 10px Segoe UI,sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(titlePending.action === "delete" ? "Del again!" : "N again!", x + cardW - 10, cardY + 16);
          }
        }
      } else {
        ctx.textAlign = "center";
        ctx.fillStyle = "#6a5a88";
        ctx.font = "13px Segoe UI,sans-serif";
        ctx.fillText("Empty", x + cardW / 2, cardY + 48);
        ctx.fillStyle = on ? "#ffb347" : "#8878a8";
        ctx.font = "bold 14px Segoe UI,sans-serif";
        ctx.fillText("Start new", x + cardW / 2, cardY + 74);
        if (on) {
          ctx.fillStyle = "#c8b8d8";
          ctx.font = "11px Segoe UI,sans-serif";
          ctx.fillText("Enter or N", x + cardW / 2, cardY + 96);
        }
      }

      // Store card + optional buttons for click hits
      titleSaveCards[titleSaveCards.length - 1].btnNew = btnNew;
      titleSaveCards[titleSaveCards.length - 1].btnDel = btnDel;
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#6a5a88";
    ctx.font = "11px Segoe UI,sans-serif";
    ctx.fillText("1–3 file · Enter continue · N new · Del erase", W / 2, 528);
  }

  let optionsBars = [];

  function drawOptions() {
    ctx.fillStyle = "rgba(10,8,20,0.78)";
    ctx.fillRect(0, 0, W, H);
    const lines = [
      "__music_bar__",
      `  bed: intro · title · select · districts · evening · results`,
      "__sfx_bar__",
      `Text size: ${textScale > 1 ? "LARGE" : "NORMAL"}  (T)`,
      `Reduce flash: ${reduceFlash ? "ON" : "OFF"}  (F)`,
      `Day length: ${dayLengthMode.toUpperCase()}  (L cycles short/normal/long)`,
      "",
      "Gamepad: stick move · A interact · X power · Start pause",
      "Keyboard: WASD · E · Q · Tab · C codex · J journal",
      "",
      "Language: English",
      `Build ${BUILD_ID} · web Canvas (no engine port)`,
      ngPlusBonus ? `Soft NG+ ready: +${ngPlusBonus}¢ next new week` : "Soft NG+: win a strong week to bank start ¢",
      `Achievements: ${Object.keys(achievements).length} unlocked`,
      "I — credits",
      "Esc / O — close",
    ];
    // Panel size follows the actual content instead of a fixed 380px box —
    // that box was already 22px too short for 16 lines at NORMAL text, and
    // LARGE (1.15x) text made the overflow visibly cut off the last lines.
    const headerH = 72; // space for the "Options" title above line 1
    const bottomPad = 20;
    const lineH = Math.round(22 * textScale);
    const panelW = 440;
    const panelH = Math.min(H - 24, headerH + lines.length * lineH + bottomPad);
    const panelX = W / 2 - panelW / 2;
    const panelY = Math.max(12, (H - panelH) / 2);
    ctx.fillStyle = "rgba(30,20,50,0.95)";
    drawRounded(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(panelX, panelY, panelW, panelH, 14);
    ctx.stroke();
    ctx.fillStyle = "#ffb347";
    ctx.font = font(22, "bold");
    ctx.textAlign = "center";
    ctx.fillText("Options", W / 2, panelY + 40);
    optionsBars = [];
    const barW = 110,
      barH = 10,
      barX = panelX + panelW - 24 - 40 - barW;
    function drawVolBar(id, on, vol, label, key, y) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#c8b8d8";
      ctx.font = font(14);
      ctx.fillText(`${label}: ${on ? "ON" : "OFF"}  (${key})`, panelX + 24, y);
      const barY = y - Math.round(11 * textScale);
      ctx.fillStyle = "#443058";
      drawRounded(barX, barY, barW, barH, 5);
      ctx.fill();
      ctx.fillStyle = on ? "#ffb347" : "#665";
      drawRounded(barX, barY, Math.max(4, barW * clamp(vol, 0, 1)), barH, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,160,60,0.4)";
      ctx.lineWidth = 1;
      drawRounded(barX, barY, barW, barH, 5);
      ctx.stroke();
      ctx.fillStyle = "#c8b8d8";
      ctx.font = font(11);
      ctx.textAlign = "left";
      ctx.fillText(`${Math.round(vol * 100)}%`, barX + barW + 8, y);
      optionsBars.push({ id, x: barX, y: barY - 8, w: barW, h: barH + 16 });
    }
    ctx.fillStyle = "#c8b8d8";
    ctx.font = font(14);
    lines.forEach((line, i) => {
      const y = panelY + headerH + i * lineH;
      if (line === "__music_bar__") drawVolBar("music", musicOn, musicVol, "Music", "M", y);
      else if (line === "__sfx_bar__") drawVolBar("sfx", sfxOn, sfxVol, "SFX", "S", y);
      else {
        ctx.textAlign = "center";
        ctx.fillStyle = "#c8b8d8";
        ctx.font = font(14);
        ctx.fillText(line, W / 2, y);
      }
    });
  }

  function drawChapter() {
    const chapter = campaignChapter();
    const season = campaignSeason();
    const palette = season.palette || ["#201530", "#ffb347", "#ffffff"];
    ctx.fillStyle = palette[0] || "#201530";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(18,12,30,0.9)";
    drawRounded(90, 45, W - 180, H - 90, 18);
    ctx.fill();
    ctx.strokeStyle = palette[2] || "#ffb347";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = palette[1] || "#ffb347";
    ctx.font = font(15, "bold");
    ctx.fillText(`${season.name || "Civic Season"} · Chapter ${(campaign && campaign.chapter + 1) || 1}/${CAMPAIGN_CHAPTERS.length}`, W / 2, 82);
    ctx.fillStyle = "#fff";
    ctx.font = font(28, "bold");
    ctx.fillText(chapter ? chapter.name : "Civic Career", W / 2, 120);
    ctx.fillStyle = "#c8b8d8";
    ctx.font = font(14);
    ctx.fillText(chapter ? `${campaign && campaign.inOffice ? chapter.role : "Opposition Organizer"} · ${chapter.days} days · ${season.sport || ""}` : "", W / 2, 148);

    if (chapterPhase === "decision") {
      const decision = chapter && (chapter.decisions || [])[chapterDecisionIndex];
      ctx.fillStyle = "#ffe0a0";
      ctx.font = font(17, "bold");
      ctx.fillText(decision ? decision.prompt : "The city waits for a decision.", W / 2, 205);
      (decision ? decision.options : []).forEach((option, i) => {
        const y = 245 + i * 58;
        ctx.fillStyle = i === chapterChoice ? "rgba(255,154,60,0.3)" : "rgba(255,255,255,0.06)";
        drawRounded(170, y, W - 340, 44, 9);
        ctx.fill();
        ctx.strokeStyle = i === chapterChoice ? "#ffb347" : "#554566";
        ctx.stroke();
        ctx.fillStyle = i === chapterChoice ? "#fff" : "#c8b8d8";
        ctx.font = font(13, i === chapterChoice ? "bold" : "");
        ctx.fillText(option.text, W / 2, y + 17);
        const effects = Object.entries(option.loyalty || {})
          .map(([id, delta]) => `${id} ${delta >= 0 ? "+" : ""}${delta}`)
          .concat(option.infrastructure ? [`infrastructure +${option.infrastructure}`] : [])
          .concat(option.readiness ? [`readiness +${option.readiness}`] : [])
          .join(" · ");
        ctx.fillStyle = i === chapterChoice ? "#ffd8a0" : "#8f80a8";
        ctx.font = font(10);
        fitText(effects || "Outcome depends on mission performance", W / 2, y + 35, W - 380, "center");
      });
      ctx.fillStyle = "#8f80a8";
      ctx.font = font(11);
      ctx.fillText(`Decision ${chapterDecisionIndex + 1}/${Math.max(1, (chapter.decisions || []).length)} · arrows/tap + Enter`, W / 2, 480);
    } else {
      ctx.fillStyle = "#e8d8f0";
      ctx.font = font(17);
      wrapText(chapter ? (chapterPhase === "exit" ? chapter.exit : chapter.intro) : season.opening, W / 2, 205, 650, 28, 5, "center");
      const loyalty = Object.values((campaign && campaign.loyalty) || {});
      const avg = loyalty.length ? Math.round(loyalty.reduce((a, b) => a + b, 0) / loyalty.length) : 50;
      ctx.fillStyle = "#a8d8b0";
      ctx.font = font(13, "bold");
      ctx.fillText(`City loyalty ${avg}/100 · Infrastructure ${campaign ? campaign.infrastructure : 0} · Rescues ${campaign ? campaign.rescues : 0}`, W / 2, 375);
      ctx.fillStyle = "#ffb347";
      ctx.font = font(14, "bold");
      ctx.fillText(chapterPhase === "exit" ? "Continue civic career" : "Begin chapter", W / 2, 440);
      ctx.fillStyle = "#8878a8";
      ctx.font = font(11);
      ctx.fillText("Enter / tap", W / 2, 466);
    }
  }

  function drawConversations() {
    ctx.fillStyle = "rgba(10,8,20,0.86)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(30,20,50,0.97)";
    drawRounded(110, 45, W - 220, H - 90, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffb347";
    ctx.font = font(20, "bold");
    ctx.textAlign = "left";
    ctx.fillText("Conversation Journal", 140, 82);
    ctx.fillStyle = "#a090b8";
    ctx.font = font(11);
    ctx.fillText("Newest first · J / Esc closes", 140, 103);
    const entries = conversationLog.slice(0, 10);
    if (!entries.length) {
      ctx.fillStyle = "#c8b8d8";
      ctx.font = font(14);
      ctx.fillText("Talk to a neighbor and their story will appear here.", 140, 145);
      return;
    }
    entries.forEach((entry, i) => {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,160,60,0.055)";
      drawRounded(132, 118 + i * 36, W - 264, 30, 6);
      ctx.fill();
      ctx.fillStyle = "#eee6f4";
      ctx.font = font(11);
      fitText(entry, 144, 138 + i * 36, W - 290, "left");
    });
  }

  function drawGallery() {
    ctx.fillStyle = "rgba(10,8,20,0.85)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(30,20,50,0.96)";
    drawRounded(W / 2 - 360, 28, 720, 490, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(W / 2 - 360, 28, 720, 490, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb347";
    ctx.font = font(20, "bold");
    ctx.fillText("Boards · G", W / 2, 58);

    // Tabs: public achievements vs internal milestones
    const tabs = [
      { id: "achieve", label: "Public Achievements" },
      { id: "miles", label: "Milestones (cast unlocks)" },
    ];
    tabs.forEach((tab, ti) => {
      const on = galleryTab === tab.id || (tab.id === "achieve" && galleryTab === "achieve");
      const tx = W / 2 - 200 + ti * 220;
      ctx.fillStyle = galleryTab === tab.id ? "rgba(255,154,60,0.25)" : "rgba(40,30,60,0.8)";
      drawRounded(tx, 72, 200, 28, 8);
      ctx.fill();
      ctx.fillStyle = galleryTab === tab.id ? "#ffb347" : "#a090b8";
      ctx.font = font(12, "bold");
      ctx.fillText(tab.label, tx + 100, 91);
    });

    ctx.textAlign = "left";
    if (galleryTab === "miles") {
      ctx.fillStyle = "#c8b8d8";
      ctx.font = font(12);
      const nMainMs = mainRoster().filter((c) => isCharUnlocked(c.id)).length;
      const nSecretMs = secretRoster().filter((c) => isCharUnlocked(c.id)).length;
      ctx.fillText(
        `Weeks cleared: ${meta.weeksCleared || 0} · Best voters/week: ${meta.maxVotersOneWeek || 0} · Cast: ${nMainMs}/6 main · ${nSecretMs}/4 secret`,
        W / 2 - 330,
        120
      );
      const visibleMs = MILESTONES.filter((ms) => !ms.secret || meta.milestones[ms.id] || (ms.unlocks || []).some((id) => meta.unlockedChars[id]));
      visibleMs.forEach((ms, i) => {
        const on = !!meta.milestones[ms.id] || !!ms.auto;
        const y = 148 + i * 36;
        if (y > 470) return;
        ctx.fillStyle = on ? "rgba(40,80,55,0.5)" : ms.secret ? "rgba(60,40,80,0.55)" : "rgba(40,30,50,0.55)";
        drawRounded(W / 2 - 330, y - 14, 660, 32, 8);
        ctx.fill();
        ctx.fillStyle = on ? "#80e0a0" : "#8878a8";
        ctx.font = font(13, "bold");
        ctx.fillText((on ? "✓ " : "○ ") + (ms.secret ? "✦ " : "") + ms.name, W / 2 - 318, y + 2);
        ctx.fillStyle = on ? "#c8d8c8" : "#666";
        ctx.font = font(10);
        const unlockNames = (ms.unlocks || [])
          .map((id) => {
            const c = CHARACTERS.find((x) => x.id === id);
            return c ? c.short : id;
          })
          .join(", ");
        fitText(ms.desc + (unlockNames ? "  →  " + unlockNames : ""), W / 2 - 318, y + 16, 640, "left");
      });
      ctx.textAlign = "center";
      ctx.fillStyle = "#8878a8";
      ctx.font = font(11);
      ctx.fillText("Tab / click tabs · Esc/G close · milestones unlock cast for new weeks", W / 2, 500);
    } else {
      // Public store-ready board
      const list = ACHIEVEMENT_DEFS.length
        ? ACHIEVEMENT_DEFS
        : [
            { id: "first_voter", title: "First Voter", desc: "", tier: "bronze" },
          ];
      const unlockedN = list.filter((a) => achievements[a.id]).length;
      ctx.fillStyle = "#a090b8";
      ctx.font = font(12);
      ctx.fillText(`Store board · ${unlockedN}/${list.length} · IDs ready for Steam / Play / App Store`, W / 2 - 330, 120);
      list.forEach((a, i) => {
        const on = !!achievements[a.id];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = W / 2 - 330 + col * 340;
        const y = 140 + row * 34;
        ctx.fillStyle = on ? "rgba(50,90,60,0.45)" : "rgba(35,28,50,0.55)";
        drawRounded(x, y - 12, 328, 30, 6);
        ctx.fill();
        ctx.fillStyle = on ? "#ffd060" : "#555";
        ctx.font = font(13, "bold");
        fitText((on ? "★ " : "○ ") + (a.icon || "") + " " + a.title, x + 8, y + 4, 200, "left");
        ctx.fillStyle = on ? "#a8c8a8" : "#555";
        ctx.font = font(10);
        fitText(a.tier || "", x + 220, y + 4, 90, "left");
      });
      ctx.textAlign = "center";
      ctx.fillStyle = "#8878a8";
      ctx.font = font(11);
      ctx.fillText("Public board for store pages · Tab for milestones · Esc/G close", W / 2, 500);
      if (bestEnding) {
        ctx.fillStyle = "#ffd080";
        ctx.fillText(`Best ending: ${bestEnding.title} (${bestEnding.character})`, W / 2, 478);
      }
    }
  }

  function drawGlossary() {
    ctx.fillStyle = "rgba(10,8,20,0.85)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(30,20,50,0.96)";
    drawRounded(W / 2 - 300, 50, 600, 440, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(W / 2 - 300, 50, 600, 440, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb347";
    ctx.font = font(20, "bold");
    ctx.fillText("Glossary · H", W / 2, 85);
    ctx.fillStyle = "#c8b8d8";
    ctx.font = font(13);
    ctx.textAlign = "left";
    const lines = [
      "Street Cred — community trust; Grassroots loves this.",
      "Donor Trust — moneyed access; Money Machine fuel.",
      "Press Heat — scandal/viral risk; Chaos thrives here.",
      "Coalition — 2 of 3 matching voter blocs for bonuses.",
      "Rival spat — recruiting enemies of each other lowers loyalty.",
      "Board rule — daily civic memo that tweaks prices/recruit.",
      "Crisis — daily headline; changes button costs, etc.",
      "Setpieces — Debate, Leak, March, Gala on specific days.",
      "Districts unlock: Media D2 · Campus D3 · Donors D4.",
      "Mayor Mandate / Leon Rocket are local/tech — not presidential.",
      "Soft NG+ — strong weeks bank start coins next New Week.",
      "Save files 1–3: Enter continue · N new (overwrite) · Del erase.",
      "Daily recruit goals reset each morning (new joins only).",
      "If few blocs remain, the daily target shrinks automatically.",
      "Blocs need FAVOR from annoying errands — chat alone won't convert them.",
      "Failed pitches after favor can cost a favor point. Grind again.",
      "Park + 8¢ cools a spat. Pigeons ×3 whisper. Booth photo once/day.",
      "Coalition form day: cheaper buttons + recruit tip. Headlines are flavor.",
      "Composure 💢 meter fills from bureaucracy & neighbors. At 100 you BURST.",
      "Clara Catwell monologues (E to click through). Karen raises anxiety. Doug steals ¢.",
      "Park and coffee cool the meter. Don't explode on Election Eve.",
    ];
    lines.forEach((line, i) => {
      ctx.fillText("· " + line, W / 2 - 270, 120 + i * 26);
    });
    ctx.textAlign = "center";
    ctx.fillStyle = "#8878a8";
    ctx.fillText("Esc / H — close", W / 2, 460);
  }

  function drawCredits() {
    ctx.fillStyle = "rgba(10,8,20,0.85)";
    ctx.fillRect(0, 0, W, H);
    const lines = [
      "Cozy satirical civic life-sim",
      "",
      "Design, systems, writing, art pipeline, code",
      "Project author + AI-assisted sessions",
      "",
      "Fictional parody archetypes only",
      "No real names, likenesses, slogans, or logos",
      "Mayor & inventor = local/tech — not presidential",
      "",
      "HTML5 Canvas · vanilla JS · Web Audio",
      "Pixel sprites via tools/gen_sprites.py",
      "",
      "Thank you for playing the election week.",
      "",
      "Esc / I — close",
    ];
    // Same fix as Options/Pause: panel size and line spacing follow actual
    // content and textScale instead of a fixed box — the fixed 20px line
    // gap didn't grow with LARGE (1.15x) text, so adjacent lines' taller
    // glyphs visually collided (e.g. "Project author..." overlapping the
    // line above it).
    const headerH = 115; // space for title + subtitle above line 1
    const bottomPad = 20;
    const lineH = Math.round(20 * textScale);
    const panelW = 520;
    const panelH = Math.min(H - 24, headerH + lines.length * lineH + bottomPad);
    const panelX = W / 2 - panelW / 2;
    const panelY = Math.max(12, (H - panelH) / 2);
    ctx.fillStyle = "rgba(30,20,50,0.96)";
    drawRounded(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(panelX, panelY, panelW, panelH, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb347";
    ctx.font = font(22, "bold");
    ctx.fillText("Credits · " + BUILD_ID, W / 2, panelY + 40);
    ctx.fillStyle = "#fff";
    ctx.font = font(16, "bold");
    ctx.fillText("Orange Day: Pocket Republic", W / 2, panelY + 80);
    ctx.fillStyle = "#c8b8d8";
    ctx.font = font(13);
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, panelY + headerH + i * lineH);
    });
  }

  function drawEvening() {
    ctx.fillStyle = "#100818";
    ctx.fillRect(0, 0, W, H);
    const e = evening;
    if (!e) return;

    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 28px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Evening Report — Day ${e.day}`, W / 2, 48);

    ctx.fillStyle = "#c8b8d8";
    ctx.font = "14px Segoe UI,sans-serif";
    ctx.fillText(`Crisis: ${e.crisis}${e.rule ? " · " + e.rule : ""}`, W / 2, 78);

    // stat cards + axes
    const cards = [
      { label: "Coins", val: e.coins + "¢", col: "#ffd060" },
      { label: "Street", val: String((e.axes && e.axes.street) || 0), col: "#80e0a0" },
      { label: "Donor", val: String((e.axes && e.axes.donor) || 0), col: "#80c0e0" },
      { label: "Heat", val: String((e.axes && e.axes.heat) || 0), col: "#e080a0" },
      { label: "Coalition", val: e.coalition, col: "#c080ff" },
    ];
    cards.forEach((c, i) => {
      const x = 40 + i * 180;
      ctx.fillStyle = "rgba(40,30,60,0.9)";
      drawRounded(x, 100, 170, 64, 10);
      ctx.fill();
      ctx.fillStyle = "#a090b8";
      ctx.font = "11px Segoe UI,sans-serif";
      ctx.fillText(c.label, x + 85, 122);
      ctx.fillStyle = c.col;
      ctx.font = "bold 13px Segoe UI,sans-serif";
      fitText(String(c.val), x + 85, 146, 150, "center");
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 14px Segoe UI,sans-serif";
    ctx.fillText("Today's objectives", 80, 220);
    (e.objectives || []).forEach((o, i) => {
      ctx.fillStyle = o.done ? "#6d6" : "#e88";
      ctx.font = "13px Segoe UI,sans-serif";
      const prog =
        o.target === 0
          ? ""
          : o.id === "voters"
            ? ` · new today ${e.recruitsToday | 0}/${o.target}`
            : o.prog != null
              ? ` · ${o.prog}/${o.target}`
              : "";
      fitText(`${o.done ? "✓" : "✗"} ${o.label}${prog}`, 80, 248 + i * 22, 420, "left");
    });
    // Meta clarity strip under objectives
    ctx.fillStyle = "#a8c0e0";
    ctx.font = "11px Segoe UI,sans-serif";
    fitText(
      `New joins today: ${e.recruitsToday | 0} · Uncommitted left: ${e.remaining != null ? e.remaining : "—"} · Rival ${e.rivalPressure | 0}/8`,
      80,
      248 + Math.max(3, (e.objectives || []).length) * 22 + 8,
      420,
      "left"
    );
    if (e.rivalNote) {
      ctx.fillStyle = "#e080a0";
      fitText(`Poached: ${e.rivalNote.name} — reclaim with errands`, 80, 248 + Math.max(3, (e.objectives || []).length) * 22 + 26, 420, "left");
    }

    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 14px Segoe UI,sans-serif";
    ctx.fillText("Voters (loyalty)", 560, 220);
    if (!e.voters.length) {
      ctx.fillStyle = "#888";
      ctx.font = "13px sans-serif";
      ctx.fillText("None yet", 560, 248);
    } else {
      e.voters.forEach((id, i) => {
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (!g) return;
        const L = e.loyalty[id] || 0;
        const risk = L < 40;
        ctx.fillStyle = risk ? "#e09090" : g.color;
        ctx.font = "13px Segoe UI,sans-serif";
        fitText(`${g.icon} ${g.name} · ${L}${risk ? " ⚠" : ""}`, 560, 248 + i * 20, 340, "left");
      });
    }
    if (e.atRisk && e.atRisk.length) {
      // Was a fixed y=430 regardless of how many voters are in the list
      // above it — with 9+ recruited (up to 12 max) the list grows tall
      // enough to run straight into this line.
      const atRiskY = 248 + Math.max(1, e.voters.length) * 20 + 14;
      ctx.fillStyle = "#e0a080";
      ctx.font = "11px Segoe UI,sans-serif";
      fitText(`At risk (<40 loyalty): ${e.atRisk.length} — Heat & spats matter`, 560, atRiskY, 340, "left");
    }

    if (e.debateDone) {
      ctx.fillStyle = e.debateWon ? "#8d8" : "#da8";
      ctx.font = "12px Segoe UI,sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(e.debateWon ? "Plaza Debate: WIN" : "Plaza Debate: messy but present", 80, 430);
    }

    const last = e.day >= campaignMaxDays();
    ctx.fillStyle = "rgba(255,140,40,0.95)";
    drawRounded(W / 2 - 160, 460, 320, 50, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1020";
    ctx.font = "bold 17px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(last ? "Election Night Results (Enter)" : "Sleep → Next Morning (Enter)", W / 2, 492);
  }

  /** Word-wrap; returns y after last line. maxLines truncates with … */
  function wrapText(text, x, y, maxW, lineH, maxLines = 99, align = "left") {
    const words = String(text || "")
      .split(/\s+/)
      .filter(Boolean);
    let line = "";
    const built = [];
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        built.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) built.push(line);

    // If a single word is wider than maxW, hard-trim it
    for (let i = 0; i < built.length; i++) {
      let s = built[i];
      if (ctx.measureText(s).width > maxW) {
        while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
        built[i] = s + "…";
      }
    }

    const show = built.slice(0, maxLines);
    if (built.length > maxLines && show.length) {
      let last = show[show.length - 1];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      show[show.length - 1] = last + "…";
    }

    ctx.textAlign = align;
    let yy = y;
    for (const s of show) {
      ctx.fillText(s, x, yy);
      yy += lineH;
    }
    return yy;
  }

  /** Single-line text that ellipsizes to maxW */
  function fitText(text, x, y, maxW, align = "left") {
    ctx.textAlign = align;
    let s = String(text || "");
    if (ctx.measureText(s).width <= maxW) {
      ctx.fillText(s, x, y);
      return;
    }
    while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    ctx.fillText(s + "…", x, y);
  }

  function drawSelect() {
    ctx.fillStyle = "#1a1430";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 24px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Choose your civic avatar", W / 2, 40);
    ctx.fillStyle = "#a090b8";
    ctx.font = "12px Segoe UI,sans-serif";
    const roster = selectRoster();
    if (charIdx >= roster.length) charIdx = 0;
    const nMain = mainRoster().filter((c) => isCharUnlocked(c.id)).length;
    const nSec = secretRoster().filter((c) => isCharUnlocked(c.id)).length;
    ctx.fillText(
      `← → · Enter · main ${nMain}/6` + (nSec ? ` · secrets ${nSec}/4` : "") + ` · G milestones`,
      W / 2,
      62
    );

    const cols = 3;
    const cardW = 280;
    const cardH = 200;
    const gap = 16;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (W - totalW) / 2;
    const y0 = 70;

    roster.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = y0 + row * (cardH + gap);
      const sel = i === charIdx;
      const unlocked = isCharUnlocked(c.id);
      // secrets only appear when unlocked — treat as always unlocked here
      const showUnlocked = unlocked || !!c.secret;
      const pad = 12;
      const innerW = cardW - pad * 2;

      ctx.fillStyle = !showUnlocked
        ? "rgba(20,16,30,0.92)"
        : sel
          ? c.secret
            ? "rgba(180,120,255,0.18)"
            : "rgba(255,140,40,0.2)"
          : "rgba(40,30,60,0.92)";
      drawRounded(x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = sel ? (c.secret ? "#c080ff" : "#ff9a3c") : showUnlocked ? "#4a3a68" : "#333048";
      ctx.lineWidth = sel ? 3 : 1;
      ctx.stroke();

      ctx.save();
      drawRounded(x, y, cardW, cardH, 12);
      ctx.clip();

      const ab = Math.sin(animT * 3 + i) * 2;
      if (showUnlocked) {
        if (
          !drawSprite(`player/${c.id}_down_idle`, x + 12, y + 24 + ab, 56, 70) &&
          !drawSprite(`player/${c.id}_idle`, x + 12, y + 24 + ab, 56, 70)
        ) {
          ctx.fillStyle = c.color;
          ctx.beginPath();
          ctx.arc(x + 40, y + 55, 24, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#2a2438";
        ctx.beginPath();
        ctx.arc(x + 40, y + 55, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#665";
        ctx.font = "bold 22px Segoe UI,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🔒", x + 40, y + 62);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = showUnlocked ? "#fff" : "#777";
      ctx.font = "bold 14px Segoe UI,sans-serif";
      fitText(showUnlocked ? c.name + (c.secret ? " ✦" : "") : "???", x + 80, y + 42, innerW - 70, "left");
      if (showUnlocked) {
        ctx.fillStyle = c.accent;
        ctx.font = "bold 11px Segoe UI,sans-serif";
        fitText(c.power, x + 80, y + 60, innerW - 70, "left");
        ctx.fillStyle = "#c8b8d8";
        ctx.font = "11px Segoe UI,sans-serif";
        wrapText(c.blurb, x + 80, y + 80, innerW - 70, 14, 3, "left");
        ctx.fillStyle = "#e0a0a0";
        ctx.font = "10px Segoe UI,sans-serif";
        wrapText("Weak: " + c.weakness, x + pad, y + cardH - 28, innerW, 13, 2, "left");
      } else {
        ctx.fillStyle = "#9988aa";
        ctx.font = "11px Segoe UI,sans-serif";
        wrapText(charUnlockHint(c.id).replace(/^🔒\s*/, ""), x + 80, y + 70, innerW - 70, 14, 4, "left");
      }

      ctx.restore();
    });

    ctx.fillStyle = "#8878a8";
    ctx.font = "12px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    const cur = roster[charIdx];
    if (cur && !isCharUnlocked(cur.id) && !cur.secret) {
      ctx.fillStyle = "#e0a080";
      ctx.fillText(charUnlockHint(cur.id) + " · G for milestone board", W / 2, H - 18);
    } else {
      ctx.fillText("Enter to start · secrets appear only after easter eggs", W / 2, H - 18);
    }
  }

  let pauseButtons = [];
  const PAUSE_ITEMS = [
    { id: "resume", label: "Resume", hint: "Esc" },
    { id: "save", label: "Save", hint: "S" },
    { id: "load", label: "Load", hint: "L" },
    { id: "restart", label: "Restart run", hint: "R" },
    { id: "quit", label: "Quit to Main Menu", hint: "Q" },
    { id: "options", label: "Options", hint: "O" },
    { id: "gallery", label: "Achievement Gallery", hint: "G" },
    { id: "journal", label: "Conversation Journal", hint: "J" },
    { id: "glossary", label: "Glossary", hint: "H" },
    { id: "credits", label: "Credits", hint: "I" },
  ];

  function pauseAction(id) {
    if (id === "resume") state = "play";
    else if (id === "save") toast(saveGame() ? "Saved." : "Save failed.");
    else if (id === "load") toast(loadGame() ? "Loaded." : "No save to load.");
    else if (id === "restart") {
      clearSave();
      state = "select";
    } else if (id === "quit") {
      saveGame();
      state = "title";
      titleFocus = hasSave(saveSlot) ? "continue" : "new";
    } else if (id === "options") showOptions = true;
    else if (id === "gallery") showGallery = true;
    else if (id === "journal") showConversations = true;
    else if (id === "glossary") showGlossary = true;
    else if (id === "credits") showCredits = true;
  }

  function drawPause() {
    ctx.fillStyle = "rgba(10,8,20,0.72)";
    ctx.fillRect(0, 0, W, H);

    // Panel size follows PAUSE_ITEMS.length instead of a value hand-tuned
    // for whatever the list's length happened to be at the time — the fixed
    // 424px box was sized for 8 items and silently overflowed the moment a
    // 9th was added; a fixed panelY=70 then overflowed again at 10 items.
    // Capped height + recentering (matching Options/Credits) means this
    // can't recur no matter how long PAUSE_ITEMS grows.
    const headerH = 60,
      btnH0 = 36,
      gap0 = 6,
      footerH = 30;
    const panelW = 380,
      panelX = W / 2 - panelW / 2,
      panelH = Math.min(H - 24, headerH + PAUSE_ITEMS.length * btnH0 + (PAUSE_ITEMS.length - 1) * gap0 + footerH),
      panelY = Math.max(12, (H - panelH) / 2);
    ctx.fillStyle = "rgba(30,20,50,0.95)";
    drawRounded(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(panelX, panelY, panelW, panelH, 14);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = font(26, "bold");
    ctx.textAlign = "center";
    ctx.fillText("Paused", W / 2, panelY + 38);

    pauseButtons = [];
    const btnW = panelW - 48,
      btnX = panelX + 24,
      btnH = btnH0,
      gap = gap0;
    let by = panelY + headerH;
    PAUSE_ITEMS.forEach((it) => {
      ctx.fillStyle = "rgba(255,154,60,0.12)";
      drawRounded(btnX, by, btnW, btnH, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,154,60,0.5)";
      ctx.lineWidth = 1;
      drawRounded(btnX, by, btnW, btnH, 8);
      ctx.stroke();
      ctx.fillStyle = "#ffe8c0";
      ctx.font = font(15, "600");
      ctx.textAlign = "left";
      ctx.fillText(it.label, btnX + 16, by + btnH / 2 + 5);
      ctx.fillStyle = "#c8b8d8";
      ctx.font = font(12);
      ctx.textAlign = "right";
      ctx.fillText(it.hint, btnX + btnW - 14, by + btnH / 2 + 4);
      pauseButtons.push({ id: it.id, x: btnX, y: by, w: btnW, h: btnH });
      by += btnH + gap;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#8a7898";
    ctx.font = font(11);
    ctx.fillText("Sleep at HOME · election season · " + BUILD_ID, W / 2, panelY + panelH - 14);
  }

  function drawResults() {
    ctx.fillStyle = "#140e24";
    ctx.fillRect(0, 0, W, H);

    const r = results;
    if (!r) return;
    const s = r.summary || {};
    const isNight = !!r.electionNight;

    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 26px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isNight ? "Election Night — Run Summary" : "End of Day — Pocket Republic", W / 2, 42);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Segoe UI,sans-serif";
    fitText(r.outcome.title, W / 2, 78, 800, "center");
    ctx.fillStyle = "#c8b8d8";
    ctx.font = "14px Segoe UI,sans-serif";
    wrapText(r.outcome.blurb, W / 2, 100, 700, 18, 3, "center");

    const cards = [
      { label: "Character", val: r.character, col: "#ff8c28" },
      { label: "Coins", val: r.coins + "¢", col: "#ffd060" },
      { label: "Street / Donor / Heat", val: `${(r.axes && r.axes.street) | 0} / ${(r.axes && r.axes.donor) | 0} / ${(r.axes && r.axes.heat) | 0}`, col: "#80e0a0" },
      { label: "Coalition", val: r.coalition, col: "#c080ff" },
    ];
    const cardW = 200;
    const gap = 16;
    const total = cards.length * cardW + (cards.length - 1) * gap;
    const startX = (W - total) / 2;
    cards.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = "rgba(40,30,60,0.9)";
      drawRounded(x, 150, cardW, 72, 10);
      ctx.fill();
      ctx.fillStyle = "#a090b8";
      ctx.font = "11px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(c.label, x + cardW / 2, 172);
      ctx.fillStyle = c.col;
      ctx.font = "bold 13px Segoe UI,sans-serif";
      fitText(String(c.val), x + cardW / 2, 200, cardW - 16, "center");
    });

    if (isNight && s) {
      // Shareable texture summary card
      ctx.fillStyle = "rgba(30,20,50,0.95)";
      drawRounded(80, 240, W - 160, 200, 12);
      ctx.fill();
      ctx.strokeStyle = "#ff9a3c";
      ctx.lineWidth = 2;
      drawRounded(80, 240, W - 160, 200, 12);
      ctx.stroke();
      ctx.fillStyle = "#ffb347";
      ctx.font = "bold 15px Segoe UI,sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Week Card", 100, 268);
      ctx.fillStyle = "#e8d8f0";
      ctx.font = "13px Segoe UI,sans-serif";
      const lines = [
        `${s.character || r.character} · ${s.ending || (r.outcome && r.outcome.title) || "—"}`,
        `Bloc: ${s.coalition || r.coalition} · Voters: ${s.recruits != null ? s.recruits : (r.voters || []).length}/12 · Codex ${r.codexCount || 0}`,
        `Rival steals: ${s.steals | 0} · Spats: ${s.spatCount | 0} · Pressure: ${s.rivalPressure | 0}/8`,
        `Grift: Pete×${s.petePays | 0} · Cole memos×${s.coleMemos | 0} · Pigeons: ${s.pigeons ? "yes" : "no"}`,
        s.headline ? `📰 ${s.headline}` : "📰 (no headline logged)",
      ];
      lines.forEach((line, i) => fitText(line, 100, 298 + i * 24, W - 200, "left"));
      ctx.fillStyle = "#8878a8";
      ctx.font = "11px Cascadia Mono,monospace";
      ctx.fillText(BUILD_ID + " · screenshot this card · fictional archetypes only", 100, 420);
    } else {
      // Day results (non-election)
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffb347";
      ctx.font = "bold 14px Segoe UI,sans-serif";
      ctx.fillText("Objectives", 80, 270);
      (r.objectives || []).forEach((o, i) => {
        ctx.fillStyle = o.done ? "#6d6" : "#e88";
        ctx.font = "13px Segoe UI,sans-serif";
        fitText(`${o.done ? "✓" : "✗"} ${o.label}`, 80, 295 + i * 22, 400, "left");
      });
      ctx.fillStyle = "#ffb347";
      ctx.font = "bold 14px Segoe UI,sans-serif";
      ctx.fillText("Voter Coalition", 520, 270);
      if (!r.voters.length) {
        ctx.fillStyle = "#888";
        ctx.fillText("No groups recruited", 520, 295);
      } else {
        r.voters.forEach((id, i) => {
          const g = VOTER_GROUPS.find((v) => v.id === id);
          if (!g) return;
          ctx.fillStyle = g.color;
          fitText(`${g.icon} ${g.name}  · loyalty ${r.loyalty[id] || 0}`, 520, 295 + i * 22, 360, "left");
        });
      }
    }

    ctx.fillStyle = "rgba(255,140,40,0.9)";
    drawRounded(W / 2 - 130, 460, 260, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1020";
    ctx.font = "bold 16px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(campaign && !campaign.complete ? "Chapter Decisions (Enter)" : "Title Screen (Enter)", W / 2, 488);
    ctx.fillStyle = "#6a5a88";
    ctx.font = "11px Cascadia Mono,monospace";
    const achN = Object.keys(achievements).length;
    ctx.fillStyle = "#6a5a88";
    ctx.font = "11px Cascadia Mono,monospace";
    ctx.fillText("I credits · O options · ★" + achN + " · " + BUILD_ID, W / 2, 532);
  }

  function frame(dt) {
    if (state === "intro") drawIntro(dt);
    else if (state === "title") drawTitle();
    else if (state === "select") drawSelect();
    else if (state === "chapter") drawChapter();
    else if (state === "evening") drawEvening();
    else if (state === "results") drawResults();
    else {
      drawWorld();
      drawSeasonWeather();
      drawHUD();
      if (state === "pause") drawPause();
    }
    if (showOptions) drawOptions();
    if (showCredits) drawCredits();
    if (showGallery) drawGallery();
    if (showGlossary) drawGlossary();
    if (showConversations) drawConversations();
  }

  // ─── Input ───────────────────────────────────────────────────
  window.addEventListener("pointerdown", ensureAudio, { once: true, passive: true });
  window.addEventListener("keydown", (e) => {
    ensureAudio();
    keys[e.key] = true;
    keys[e.key.toLowerCase()] = true;

    if (state === "intro") {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        ensureAudio(); // unlock Web Audio on first gesture
        skipIntro();
        e.preventDefault();
      } else {
        // Any key starts the cold-open bed after browser gesture unlock
        ensureAudio();
      }
      return;
    }
    if (state === "chapter") {
      const chapter = campaignChapter();
      const decision = chapter && (chapter.decisions || [])[chapterDecisionIndex];
      if (chapterPhase === "decision" && decision) {
        const n = decision.options.length;
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") chapterChoice = (chapterChoice + n - 1) % n;
        else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") chapterChoice = (chapterChoice + 1) % n;
      }
      if (e.key === "Enter" || e.key === " ") advanceCampaignChapter();
      e.preventDefault();
      return;
    }

    // Global overlays
    if (e.key === "o" || e.key === "O") {
      showOptions = !showOptions;
      if (showOptions) {
        showCredits = false;
        showGallery = false;
        showGlossary = false;
      }
      e.preventDefault();
    }
    if (e.key === "i" || e.key === "I") {
      showCredits = !showCredits;
      if (showCredits) {
        showOptions = false;
        showGallery = false;
        showGlossary = false;
      }
      e.preventDefault();
    }
    if (e.key === "g" || e.key === "G") {
      if (state === "play" || state === "title" || state === "pause" || state === "results" || state === "select") {
        showGallery = !showGallery;
        if (showGallery) {
          showOptions = false;
          showCredits = false;
          showGlossary = false;
          showCodex = false;
          galleryTab = "achieve";
        }
        e.preventDefault();
      }
    }
    if (e.key === "h" || e.key === "H") {
      if (state === "play" || state === "title" || state === "pause") {
        showGlossary = !showGlossary;
        if (showGlossary) {
          showOptions = false;
          showCredits = false;
          showGallery = false;
          showCodex = false;
        }
        e.preventDefault();
      }
    }
    if (e.key === "j" || e.key === "J") {
      showConversations = !showConversations;
      if (showConversations) {
        showOptions = false;
        showCredits = false;
        showGallery = false;
        showGlossary = false;
        showCodex = false;
      }
      e.preventDefault();
      return;
    }
    if (showConversations) {
      if (e.key === "Escape") showConversations = false;
      e.preventDefault();
      return;
    }
    if (showGallery || showGlossary) {
      if (e.key === "Escape") {
        showGallery = false;
        showGlossary = false;
        e.preventDefault();
      }
      if (showGallery && (e.key === "Tab" || e.key === "m" || e.key === "M")) {
        galleryTab = galleryTab === "achieve" ? "miles" : "achieve";
        e.preventDefault();
      }
      return;
    }
    if (showCredits) {
      if (e.key === "Escape" || e.key === "i" || e.key === "I") {
        showCredits = false;
        e.preventDefault();
      }
      return;
    }
    if (showOptions) {
      if (e.key === "Escape") {
        showOptions = false;
        e.preventDefault();
        return;
      }
      if (e.key === "i" || e.key === "I") {
        showOptions = false;
        showCredits = true;
        e.preventDefault();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        musicOn = !musicOn;
        if (!musicOn) stopMusic();
        else {
          ensureAudio();
          syncMusic();
        }
      }
      if (e.key === "s" || e.key === "S") sfxOn = !sfxOn;
      if (e.key === "t" || e.key === "T") textScale = textScale > 1 ? 1 : 1.15;
      if (e.key === "f" || e.key === "F") reduceFlash = !reduceFlash;
      if (e.key === "l" || e.key === "L") {
        dayLengthMode = dayLengthMode === "short" ? "normal" : dayLengthMode === "normal" ? "long" : "short";
        DAY_SECONDS_BASE = DAY_LENGTHS[dayLengthMode];
        toast("Day length: " + dayLengthMode);
        saveSettings();
      }
      if (e.key === "[") {
        musicVol = clamp(musicVol - 0.1, 0, 1);
        syncMusic();
        saveSettings();
      }
      if (e.key === "]") {
        musicVol = clamp(musicVol + 0.1, 0, 1);
        syncMusic();
        saveSettings();
      }
      if (e.key === ";") {
        sfxVol = clamp(sfxVol - 0.1, 0, 1);
        saveSettings();
      }
      if (e.key === "'") {
        sfxVol = clamp(sfxVol + 0.1, 0, 1);
        saveSettings();
      }
      if (e.key === "m" || e.key === "M" || e.key === "s" || e.key === "S" || e.key === "t" || e.key === "T" || e.key === "f" || e.key === "F") {
        // toggles above already ran — persist
        saveSettings();
      }
      e.preventDefault();
      return;
    }

    if (state === "title") {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        saveSlot = saveSlot <= 1 ? 3 : saveSlot - 1;
        titlePending = null;
        titleFocus = hasSave(saveSlot) ? "continue" : "new";
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        saveSlot = saveSlot >= 3 ? 1 : saveSlot + 1;
        titlePending = null;
        titleFocus = hasSave(saveSlot) ? "continue" : "new";
      }
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        saveSlot = parseInt(e.key, 10);
        titlePending = null;
        titleFocus = hasSave(saveSlot) ? "continue" : "new";
      }
      // N = new game in selected file (double-tap confirms overwrite)
      if (e.key === "n" || e.key === "N") {
        ensureAudio();
        requestNewInSlot(saveSlot);
        e.preventDefault();
      }
      // Delete / Backspace = erase selected file (double-tap confirms)
      if (e.key === "Delete" || e.key === "Backspace") {
        ensureAudio();
        requestDeleteSlot(saveSlot);
        e.preventDefault();
      }
      if (e.key === "m" || e.key === "M") {
        musicOn = !musicOn;
        if (!musicOn) stopMusic();
        else {
          ensureAudio();
          syncMusic();
        }
        toast(musicOn ? "Music on" : "Music off");
        saveSettings();
      }
      if (e.key === "s" || e.key === "S") {
        sfxOn = !sfxOn;
        toast(sfxOn ? "SFX on" : "SFX off");
        saveSettings();
      }
    }
    if (e.key === "Enter" || e.key === " ") {
      if (state === "title") {
        // Enter always continues (or starts empty) — never silent-overwrite
        activateTitleSlot(saveSlot);
        e.preventDefault();
      } else if (state === "select") {
        const roster = selectRoster();
        if (charIdx >= roster.length) charIdx = 0;
        const pick = roster[charIdx];
        if (!pick || !isCharUnlocked(pick.id)) {
          toast(pick ? charUnlockHint(pick.id) : "Pick a citizen.");
          sfx("warn");
          e.preventDefault();
        } else {
          resetRun(pick);
          beginChapterIntro();
          toast(`${campaignSeason().name}: ${campaignSeason().opening}`);
          e.preventDefault();
        }
      } else if (state === "evening") {
        finishEvening();
        e.preventDefault();
      } else if (state === "results") {
        chapterPhase = "decision";
        chapterDecisionIndex = 0;
        chapterChoice = 0;
        state = "chapter";
        e.preventDefault();
      } else if (state === "play" && e.key === " ") {
        interact();
        e.preventDefault();
      }
    }
    if (state === "select") {
      const roster = selectRoster();
      const n = Math.max(1, roster.length);
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") charIdx = (charIdx + n - 1) % n;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") charIdx = (charIdx + 1) % n;
    }
    if (state === "play") {
      if (e.key === "e" || e.key === "E") interact();
      if (e.key === "q" || e.key === "Q") {
        const v = getZone("vending");
        if (v && inZone(player.x, player.y, v, 24) && !upgraded && coins >= upgradePrice()) {
          buyUpgrade();
        } else {
          usePower();
        }
      }
      if (e.key === "Tab") {
        showObj = !showObj;
        showCodex = false;
        e.preventDefault();
      }
      if (e.key === "c" || e.key === "C") {
        showCodex = !showCodex;
        if (showCodex) showObj = false;
        e.preventDefault();
      }
      if (e.key === "Escape") {
        if (showCodex) showCodex = false;
        else state = "pause";
      }
      if (e.key === "m" || e.key === "M") {
        musicOn = !musicOn;
        if (!musicOn) stopMusic();
        else {
          ensureAudio();
          syncMusic();
        }
      }
    } else if (state === "pause") {
      if (e.key === "Escape") pauseAction("resume");
      else if (e.key === "s" || e.key === "S") pauseAction("save");
      else if (e.key === "l" || e.key === "L") pauseAction("load");
      else if (e.key === "r" || e.key === "R") pauseAction("restart");
      else if (e.key === "q" || e.key === "Q") pauseAction("quit");
      else if (e.key === "o" || e.key === "O") pauseAction("options");
      else if (e.key === "g" || e.key === "G") pauseAction("gallery");
      else if (e.key === "h" || e.key === "H") pauseAction("glossary");
      else if (e.key === "i" || e.key === "I") pauseAction("credits");
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    keys[e.key.toLowerCase()] = false;
  });

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = W / Math.max(1, rect.width);
    const sy = H / Math.max(1, rect.height);
    const src = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e;
    return {
      mx: (src.clientX - rect.left) * sx,
      my: (src.clientY - rect.top) * sy,
    };
  }

  function hitPauseAt(mx, my) {
    // Ensure button rects exist even if pause opened mid-frame before first draw
    if (!pauseButtons.length && state === "pause") drawPause();
    return pauseButtons.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
  }

  function handleCanvasPointer(e, fromTouch) {
    canvas.focus?.();
    const { mx, my } = canvasPoint(e);

    if (state === "intro") {
      skipIntro();
      if (fromTouch && e.cancelable) e.preventDefault();
      return true;
    }
    if (state === "chapter") {
      const chapter = campaignChapter();
      const decision = chapter && (chapter.decisions || [])[chapterDecisionIndex];
      if (chapterPhase === "decision" && decision) {
        const top = 245;
        const row = Math.floor((my - top) / 58);
        if (row >= 0 && row < decision.options.length) chapterChoice = row;
      }
      advanceCampaignChapter();
      if (fromTouch && e.cancelable) e.preventDefault();
      return true;
    }

    if (showGallery) {
      // Left tab achievements, right tab milestones
      if (my >= 70 && my <= 105) {
        galleryTab = mx < W / 2 ? "achieve" : "miles";
      } else {
        showGallery = false;
      }
      if (fromTouch && e.cancelable) e.preventDefault();
      return true;
    }
    if (showOptions) {
      const bar = optionsBars.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
      if (bar) {
        const frac = clamp((mx - bar.x) / bar.w, 0, 1);
        if (bar.id === "music") {
          musicVol = frac;
          syncMusic();
        } else {
          sfxVol = frac;
        }
        saveSettings();
        if (fromTouch && e.cancelable) e.preventDefault();
        return true;
      }
    }
    if (showOptions || showGlossary || showCredits) {
      showOptions = showGlossary = showCredits = false;
      if (fromTouch && e.cancelable) e.preventDefault();
      return true;
    }
    if (state === "pause") {
      const hit = hitPauseAt(mx, my);
      if (hit) {
        pauseAction(hit.id);
        if (fromTouch && e.cancelable) e.preventDefault();
        return true;
      }
      return true; // swallow background taps while paused
    }

    if (state === "title") {
      ensureAudio();
      // Prefer hit on a full save card
      const card = titleSaveCards.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
      if (card) {
        // Action buttons on selected filled file
        if (card.btnNew && mx >= card.btnNew.x && mx <= card.btnNew.x + card.btnNew.w && my >= card.btnNew.y && my <= card.btnNew.y + card.btnNew.h) {
          saveSlot = card.slot;
          requestNewInSlot(card.slot);
          return true;
        }
        if (card.btnDel && mx >= card.btnDel.x && mx <= card.btnDel.x + card.btnDel.w && my >= card.btnDel.y && my <= card.btnDel.y + card.btnDel.h) {
          saveSlot = card.slot;
          requestDeleteSlot(card.slot);
          return true;
        }
        // First click on a different card = select only; same filled card again = continue
        if (saveSlot === card.slot && hasSave(card.slot)) {
          activateTitleSlot(card.slot);
        } else if (!hasSave(card.slot)) {
          saveSlot = card.slot;
          titlePending = null;
          titleFocus = "new";
          state = "select";
        } else {
          saveSlot = card.slot;
          titlePending = null;
          titleFocus = "continue";
          toast("File " + card.slot + " selected — Enter continue · N new · Del erase");
          sfx("blip");
        }
        return true;
      }
      // Click elsewhere: activate selected card (continue or new)
      activateTitleSlot(saveSlot);
      return true;
    }
    if (state === "select") {
      const roster = selectRoster();
      const cols = 3,
        cardW = 280,
        cardH = 200,
        gap = 16,
        y0 = 70;
      const totalW = cols * cardW + (cols - 1) * gap;
      const startX = (W - totalW) / 2;
      roster.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gap);
        const y = y0 + row * (cardH + gap);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
          charIdx = i;
          if (!isCharUnlocked(c.id)) {
            toast(charUnlockHint(c.id));
            sfx("warn");
          } else {
            resetRun(c);
            beginChapterIntro();
            toast(`${campaignSeason().name}: ${campaignSeason().opening}`);
          }
        }
      });
      return true;
    }
    if (state === "evening") {
      finishEvening();
      return true;
    }
    if (state === "results") {
      chapterPhase = "decision";
      chapterDecisionIndex = 0;
      chapterChoice = 0;
      state = "chapter";
      return true;
    }
    return false;
  }

  canvas.addEventListener("click", (e) => {
    handleCanvasPointer(e, false);
  });
  // Mobile: touchend is more reliable than synthetic click for in-canvas pause buttons
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (state === "pause" || showOptions || showGallery || showGlossary || showCredits) {
        handleCanvasPointer(e, true);
      }
    },
    { passive: false }
  );

  // Touch
  function setupTouch() {
    const coarse = window.matchMedia("(pointer:coarse)").matches || "ontouchstart" in window;
    if (coarse) touchEl.classList.add("on");
    const pad = touchEl.querySelector(".pad.move");
    const knob = pad.querySelector(".knob");
    let active = false,
      cx = 0,
      cy = 0,
      maxR = 50;

    function setKnob(dx, dy) {
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.min(1, maxR / len);
      const kx = dx * c,
        ky = dy * c;
      knob.style.transform = `translate(${kx}px,${ky}px)`;
      touchMove.x = (dx / maxR) * c;
      touchMove.y = (dy / maxR) * c;
      if (Math.hypot(touchMove.x, touchMove.y) > 1) {
        const l = Math.hypot(touchMove.x, touchMove.y);
        touchMove.x /= l;
        touchMove.y /= l;
      }
    }
    pad.addEventListener(
      "pointerdown",
      (e) => {
        active = true;
        pad.setPointerCapture(e.pointerId);
        const r = pad.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        maxR = r.width * 0.35;
        setKnob(e.clientX - cx, e.clientY - cy);
      },
      { passive: true }
    );
    pad.addEventListener(
      "pointermove",
      (e) => {
        if (!active) return;
        setKnob(e.clientX - cx, e.clientY - cy);
      },
      { passive: true }
    );
    const end = () => {
      active = false;
      touchMove.x = 0;
      touchMove.y = 0;
      knob.style.transform = "translate(0,0)";
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);

    touchEl.querySelector('[data-act="interact"]').addEventListener("click", () => interact());
    touchEl.querySelector('[data-act="power"]').addEventListener("click", () => {
      if (state !== "play") return;
      const v = getZone("vending");
      if (v && player && inZone(player.x, player.y, v, 24) && !upgraded && coins >= upgradePrice()) buyUpgrade();
      else usePower();
    });
    touchEl.querySelector('[data-act="obj"]').addEventListener("click", () => {
      if (state !== "play") return;
      showObj = !showObj;
      showCodex = false;
    });
    touchEl.querySelector('[data-act="menu"]').addEventListener("click", () => {
      if (state === "play") state = "pause";
      else if (state === "pause") pauseAction("resume");
    });
  }
  setupTouch();

  // ─── Loop ────────────────────────────────────────────────────
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function loadSettings() {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.sfxOn === "boolean") sfxOn = s.sfxOn;
        if (typeof s.musicOn === "boolean") musicOn = s.musicOn;
        if (typeof s.sfxVol === "number") sfxVol = s.sfxVol;
        if (typeof s.musicVol === "number") musicVol = s.musicVol;
        if (s.textScale === 1 || s.textScale === 1.15) textScale = s.textScale;
        reduceFlash = !!s.reduceFlash;
        if (s.dayLengthMode && DAY_LENGTHS[s.dayLengthMode]) {
          dayLengthMode = s.dayLengthMode;
          DAY_SECONDS_BASE = DAY_LENGTHS[dayLengthMode];
        }
      }
      const n = parseInt(localStorage.getItem("orangeDay_ngPlus") || "0", 10);
      if (n > 0) ngPlusBonus = n;
      const a = localStorage.getItem(ACHIEVE_KEY);
      if (a) achievements = JSON.parse(a) || {};
      const tips = localStorage.getItem(TIPS_KEY);
      if (tips) tipsSeen = JSON.parse(tips) || {};
      const best = localStorage.getItem(BEST_KEY);
      if (best) bestEnding = JSON.parse(best);
    } catch (_) {}
  }

  function saveSettings() {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          sfxOn,
          musicOn,
          sfxVol,
          musicVol,
          textScale,
          reduceFlash,
          dayLengthMode,
        })
      );
    } catch (_) {}
  }

  function saveMeta() {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (_) {}
  }

  function loadMeta() {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(META_KEY);
      if (raw) {
        const m = JSON.parse(raw);
        meta = Object.assign(meta, m || {});
      }
      if (!meta.unlockedChars) meta.unlockedChars = { tiny: true };
      meta.unlockedChars.tiny = true;
      // Auto milestones
      MILESTONES.forEach((ms) => {
        if (ms.auto) {
          meta.milestones[ms.id] = true;
          (ms.unlocks || []).forEach((id) => {
            meta.unlockedChars[id] = true;
          });
        }
      });
      evaluateMilestones(false);
    } catch (_) {}
  }

  function isCharUnlocked(id) {
    return !!(meta.unlockedChars && meta.unlockedChars[id]);
  }

  function charUnlockHint(id) {
    if (isCharUnlocked(id)) return "";
    // Prefer first unfinished non-secret path listed in data (easier paths first)
    const paths = MILESTONES.filter((m) => (m.unlocks || []).includes(id) && !m.auto && !m.secret);
    const open = paths.find((m) => !meta.milestones[m.id]) || paths[0];
    return open ? "🔒 " + open.desc : "🔒 Locked";
  }

  function evaluateMilestones(announce) {
    let newly = [];
    MILESTONES.forEach((ms) => {
      if (meta.milestones[ms.id]) return;
      if (ms.auto) {
        meta.milestones[ms.id] = true;
        return;
      }
      const n = ms.need || {};
      let ok = true;
      if (n.weeksCleared != null && (meta.weeksCleared || 0) < n.weeksCleared) ok = false;
      if (n.maxVotersOneWeek != null && (meta.maxVotersOneWeek || 0) < n.maxVotersOneWeek) ok = false;
      if (n.debatesWon != null && (meta.debatesWon || 0) < n.debatesWon) ok = false;
      if (n.permits != null && (meta.permits || 0) < n.permits) ok = false;
      if (n.marches != null && (meta.marches || 0) < n.marches) ok = false;
      if (n.coalition) {
        const times = (meta.coalitionsWon && meta.coalitionsWon[n.coalition]) || 0;
        if (times < 1) ok = false;
      }
      if (n.easter) {
        meta.easter = meta.easter || {};
        if (n.easter.pigeon && !meta.easter.pigeon) ok = false;
        if (n.easter.gala && !meta.easter.gala) ok = false;
        if (n.easter.boardReads != null && (meta.easter.boardReads || 0) < n.easter.boardReads) ok = false;
        if (n.easter.photos != null && (meta.easter.photos || 0) < n.easter.photos) ok = false;
      }
      if (!ok) return;
      meta.milestones[ms.id] = true;
      (ms.unlocks || []).forEach((cid) => {
        if (!meta.unlockedChars[cid]) {
          meta.unlockedChars[cid] = true;
          newly.push({ char: cid, ms: ms.name });
        } else {
          meta.unlockedChars[cid] = true;
        }
      });
      if (announce) {
        banner("MILESTONE: " + ms.name, "#80e0ff", 2.4);
        toast("Milestone: " + ms.name);
      }
    });
    // Public achievements tied to progression
    const mainUnlocked = mainRoster().filter((c) => meta.unlockedChars[c.id]).length;
    const secretUnlocked = secretRoster().filter((c) => meta.unlockedChars[c.id]).length;
    if (mainUnlocked >= 2) unlockAchieve("first_milestone", "Cast Call");
    if (mainUnlocked >= 6) unlockAchieve("full_cast", "Full Cast");
    if (secretUnlocked >= 1) unlockAchieve("secret_one", "Hidden Citizen");
    if (secretUnlocked >= 4) unlockAchieve("secret_all", "Deep Cut Cast");
    if ((meta.weeksCleared || 0) >= 3) unlockAchieve("three_weeks", "Three Seasons");
    saveMeta();
    if (announce && newly.length) {
      newly.forEach((n) => {
        const c = CHARACTERS.find((x) => x.id === n.char);
        const secret = c && c.secret;
        toast((secret ? "Secret unlock: " : "Unlocked: ") + (c ? c.name : n.char) + "!");
      });
      sfx("sting");
    }
    return newly;
  }

  /** Flag an easter progress bit/counter then re-check secret milestones. */
  function noteEaster(key, value) {
    meta.easter = meta.easter || { pigeon: false, boardReads: 0, gala: false, photos: 0 };
    if (key === "boardReads" || key === "photos") {
      meta.easter[key] = (meta.easter[key] || 0) + (typeof value === "number" ? value : 1);
    } else {
      meta.easter[key] = value === undefined ? true : value;
    }
    saveMeta();
    evaluateMilestones(true);
  }

  /** Call at Election Night — advances account meta without rewriting run balance. */
  function recordWeekClear(outcome, coalLabel, coalId) {
    meta.weeksCleared = (meta.weeksCleared || 0) + 1;
    meta.maxVotersOneWeek = Math.max(meta.maxVotersOneWeek || 0, voters.length);
    if (outcome && outcome.id) {
      meta.endingsSeen = meta.endingsSeen || {};
      meta.endingsSeen[outcome.id] = true;
    }
    if (coalId) {
      meta.coalitionsWon = meta.coalitionsWon || {};
      meta.coalitionsWon[coalId] = (meta.coalitionsWon[coalId] || 0) + 1;
    }
    if (selected) {
      meta.charsPlayed = meta.charsPlayed || {};
      meta.charsPlayed[selected.id] = true;
    }
    if ((rivalStealsWeek || 0) === 0) {
      meta.weeksNoSteal = (meta.weeksNoSteal || 0) + 1;
      unlockAchieve("no_steal", "Tight Ship");
    }
    evaluateMilestones(true);
    saveMeta();
  }

  function unlockAchieve(id, label) {
    if (achievements[id]) return;
    achievements[id] = true;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(ACHIEVE_KEY, JSON.stringify(achievements));
    } catch (_) {}
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === id);
    const title = (def && def.title) || label || id;
    banner("★ " + title, "#ffd060", 2.5);
    toast("Achievement: " + title);
    sfx("chime");
  }

  function checkAchievements() {
    if (voters.length >= 1) unlockAchieve("first_voter", "First Voter");
    if (voters.length >= 6) unlockAchieve("half_dex", "Half the Codex");
    if (voters.length >= 12) unlockAchieve("full_dex", "Full Voter Dex");
    if (upgraded) unlockAchieve("tool", "Multitool Owner");
    if (powerRank >= 3) unlockAchieve("power_max", "Power Tree Max");
    if (debateWon) unlockAchieve("debate", "Debate Champ");
    if (setpieces.scandal) unlockAchieve("scandal", "Leak Season");
    if (setpieces.march) unlockAchieve("march", "March Feet");
    if (setpieces.gala) unlockAchieve("gala", "Gala Guest");
    const c = activeCoalition();
    if (c && c.strength >= 3) unlockAchieve("coalition", "Full Bloc: " + c.name);
    if (Object.keys(achievements).length >= 5) unlockAchieve("five_star", "Five Achievements");
    // Mid-run voter milestones feed meta for unlocks without waiting for election
    if (voters.length > (meta.maxVotersOneWeek || 0)) {
      meta.maxVotersOneWeek = voters.length;
      evaluateMilestones(true);
    }
  }

  loadSettings();
  loadMeta();

  // Expose debug + QA hooks (browser console / smoke.js)
  window.ORANGE_DAY = {
    get state() {
      return {
        mode: state,
        dayIndex,
        maxDays: campaignMaxDays(),
        crisis: getCrisis().id,
        coins,
        rep,
        voters: voters.slice(),
        time,
        daySec,
        objProg: { ...objProg },
        selected: selected && selected.id,
        hasPermit,
        permitDelivered,
        coffeeFixed,
        crateMoved,
        buttons,
        upgraded,
        toolLevel,
        lockedOpen,
        orderUsed,
        orderMode,
        dayEnded,
        debateDone,
        debateWon,
        axes: { ...axes },
        powerRank,
        spatCount,
        anger,
        dialogue: !!dialogue,
        conversationCount: conversationLog.length,
        showConversations,
        audioState: audioCtx ? audioCtx.state : "not-started",
        musicActive: !!musicNodes,
        musicGain: musicNodes ? musicNodes.master.gain.value : 0,
        campaign: campaignView(),
        coalition: coalitionLabel(),
        boardRule: getBoardRule().id,
        evening: !!evening,
        results: results && {
          coalition: results.coalition,
          outcome: results.outcome && results.outcome.title,
          days: results.days,
        },
      };
    },
    /** Headless / console QA helpers — do not use in player docs as required controls */
    qa: {
      // Reads the exact same gate the real select-screen Enter/click confirm
      // uses (game.js ~5439) — unlike startCharacter(), this has no bypass,
      // so it actually proves whether a real player could pick this id.
      isCharUnlocked(id) {
        return isCharUnlocked(id);
      },
      startCharacter(i) {
        charIdx = ((i % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
        // QA bypass: unlock all cast for automated routes
        CHARACTERS.forEach((c) => {
          meta.unlockedChars[c.id] = true;
        });
        resetRun(CHARACTERS[charIdx]);
        state = "play";
        return selected.id;
      },
      startCampaign(season) {
        campaign = newCampaign(season);
        initChapterMission();
        setCampaignDaySeconds();
        return campaignView();
      },
      advanceChapter() {
        if (campaign.chapter >= CAMPAIGN_CHAPTERS.length - 1) campaign.complete = true;
        else campaign.chapter += 1;
        initChapterMission();
        setCampaignDaySeconds();
        return campaignView();
      },
      resolveCampaignEvent,
      adjustLoyalty: adjustCampaignLoyalty,
      get chapterMission() {
        return chapterMissionView();
      },
      missionAction(zoneId) {
        return progressChapterMission(zoneId);
      },
      finalizeMission() {
        return finalizeChapterMission();
      },
      setCampaignStats(values = {}) {
        if (!campaign) campaign = newCampaign();
        if (values.readiness != null) campaign.readiness = Math.max(0, values.readiness | 0);
        if (values.infrastructure != null) campaign.infrastructure = Math.max(0, values.infrastructure | 0);
        if (values.promises) campaign.promises = { ...values.promises };
        setCampaignDaySeconds();
        return campaignView();
      },
      get weather() {
        return currentCampaignWeather();
      },
      chapterControl(action, phase) {
        if (phase) chapterPhase = phase;
        state = "chapter";
        return chapterControl(action);
      },
      loseElection() {
        campaign.inOffice = false;
        campaign.electionLosses += 1;
        return campaignView();
      },
      attemptComeback: attemptCampaignComeback,
      npcContextLine,
      get campaign() {
        return campaignView();
      },
      get chapterIntro() {
        const chapter = campaignChapter();
        return (chapter && chapter.intro) || "";
      },
      get chapterExit() {
        const chapter = campaignChapter();
        return (chapter && chapter.exit) || "";
      },
      get seasonDaySeconds() {
        return DAY_SECONDS;
      },
      get musicTheme() {
        return campaignMusicKey();
      },
      unlockAllChars() {
        CHARACTERS.forEach((c) => {
          meta.unlockedChars[c.id] = true;
        });
        saveMeta();
      },
      get meta() {
        return JSON.parse(JSON.stringify(meta));
      },
      recordWeekClear,
      activeCoalition,
      addAxes,
      triggerRivalSpat,
      teleport(x, y) {
        if (!player) return false;
        player.x = x;
        player.y = y;
        return true;
      },
      zoneCenter(id) {
        const z = getZone(id);
        return z ? zoneCenter(z) : null;
      },
      interact,
      power: usePower,
      buyUpgrade,
      setCoins(n) {
        coins = n;
      },
      advanceSeconds(sec) {
        daySec += sec;
        time = clamp(daySec / DAY_SECONDS, 0, 1);
      },
      endDay,
      finishEvening,
      saveGame,
      loadGame,
      clearSave,
      requestNewInSlot,
      requestDeleteSlot,
      hasSave,
      getCrisis,
      runPlazaDebate,
      objDone,
      allMainDone,
      forceRecruit(id) {
        // QA: full-fill favor then force join
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (g) voterFavor[id] = favorNeedOf(g);
        return tryRecruit(id, true);
      },
      /** Unforced recruit attempt — the only way to actually reach the
       *  alignment-cap gate, since force=true (forceRecruit) bypasses it. */
      attemptRecruit(id) {
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (g) voterFavor[id] = favorNeedOf(g);
        return tryRecruit(id, false);
      },
      coalitionLeanOf,
      coalitionLeansOf,
      alignmentCapFor,
      alignmentCountFor,
      wouldTriggerAlignmentBacklash,
      bumpFavor,
      getFavor(id) {
        return favorOf(id);
      },
      getHeadline() {
        return dayHeadline;
      },
      trySpatReconciliation,
      maybeCoalitionFanfare,
      setDay(n) {
        dayIndex = clamp(n, 1, MAX_DAYS);
      },
      /** Force a specific event-to-day arrangement for deterministic tests
       *  (real play always uses shuffleDayEvents()'s random permutation). */
      setEventDayMap(map) {
        eventDayMap = { ...map };
      },
      get eventDayMap() {
        return { ...eventDayMap };
      },
      travelTo,
      districtUnlocked,
      runScandalLeak,
      runUnionMarch,
      runDonorGala,
      civicOutcome,
      get build() {
        return BUILD_ID;
      },
      setTextScale(v) {
        textScale = v > 1 ? 1.15 : 1;
      },
      setReduceFlash(v) {
        reduceFlash = !!v;
      },
      setDayLength(mode) {
        if (DAY_LENGTHS[mode]) {
          dayLengthMode = mode;
          DAY_SECONDS_BASE = DAY_LENGTHS[mode];
        }
      },
      get dayLengthMode() {
        return dayLengthMode;
      },
      maybeMicroEvent,
      currentObjectives,
      remainingVoterCount,
      openPause() {
        if (state === "play") state = "pause";
        drawPause();
        return state;
      },
      get pauseButtons() {
        return pauseButtons.map((b) => ({ ...b }));
      },
      hitPause(mx, my) {
        if (state !== "pause") return null;
        if (!pauseButtons.length) drawPause();
        const hit = pauseButtons.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
        return hit ? hit.id : null;
      },
      pauseAction,
      openOptions() {
        showOptions = true;
        drawOptions();
        return showOptions;
      },
      get optionsBars() {
        return optionsBars.map((b) => ({ ...b }));
      },
      get musicVol() {
        return musicVol;
      },
      get sfxVol() {
        return sfxVol;
      },
      /** Mirrors the real click handler's volume-bar branch: hit-test + set. */
      clickOptionsBar(mx, my) {
        if (!showOptions) return null;
        if (!optionsBars.length) drawOptions();
        const bar = optionsBars.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
        if (!bar) return null;
        const frac = clamp((mx - bar.x) / bar.w, 0, 1);
        if (bar.id === "music") {
          musicVol = frac;
          syncMusic();
        } else {
          sfxVol = frac;
        }
        saveSettings();
        return bar.id;
      },
      get draftLabel() {
        return DRAFT_LABEL;
      },
      get saveSlot() {
        return saveSlot;
      },
      setSaveSlot(n) {
        const s = clamp(n | 0, 1, 3);
        saveSlot = s;
        return saveSlot;
      },
      get tipsSeenCount() {
        return Object.keys(tipsSeen).length;
      },
      seedTips() {
        seedTutorialTips();
        return tipQueue.length;
      },
      get tipQueueLen() {
        return tipQueue.length;
      },
      resetTips() {
        tipsSeen = {};
        tipQueue = [];
        tipT = 0;
        try {
          if (typeof localStorage !== "undefined") localStorage.removeItem(TIPS_KEY);
        } catch (_) {}
      },
      get bestEnding() {
        return bestEnding ? { ...bestEnding } : null;
      },
      recordBestEnding(id, title, character, score) {
        bestEnding = { id, title, character, score: score | 0 };
        try {
          if (typeof localStorage !== "undefined") localStorage.setItem(BEST_KEY, JSON.stringify(bestEnding));
        } catch (_) {}
        return bestEnding;
      },
    },
  };
})();

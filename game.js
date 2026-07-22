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
  ["tiny", "alex", "mayor", "bernie", "leon", "donny"].forEach((id) => {
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
  ["clerk", "barista", "vendor", "mover", "stagehand", "boothie", "parkgoer", "watchdog"].forEach((id) => {
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

  // Soft UI beeps + light music bed (no external audio files)
  let audioCtx = null;
  let sfxVol = 0.7;
  let musicVol = 0.35;
  let sfxOn = true;
  let musicOn = true;
  let musicNodes = null;
  let musicStep = 0;
  let musicAcc = 0;
  let textScale = 1; // 1 or 1.15 (D6)
  let reduceFlash = false;
  let showOptions = false;
  let showCredits = false;
  const BUILD_ID = "v1.3";
  const DRAFT_LABEL = "Full Week Ship";
  let ngPlusBonus = 0; // soft NG+ coins from last strong week
  const SETTINGS_KEY = "orangeDay_settings_v1";
  const ACHIEVE_KEY = "orangeDay_achieve_v1";
  const TIPS_KEY = "orangeDay_tips_v1";
  const BEST_KEY = "orangeDay_best_v1";
  const SLOT_PREFIX = "orangeDay_slot_";
  let achievements = {}; // id -> unlocked
  let tipsSeen = {};
  let bestEnding = null; // { id, title, character }
  let saveSlot = 1; // 1..3
  let showGallery = false;
  let showGlossary = false;
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
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g);
      g.connect(ac.destination);
      const tones = {
        blip: [520, 0.05, "square"],
        ok: [660, 0.07, "triangle"],
        coin: [880, 0.06, "square"],
        power: [400, 0.1, "sawtooth"],
        recruit: [523, 0.08, "triangle"],
        warn: [220, 0.12, "square"],
        sleep: [392, 0.15, "sine"],
        debate: [330, 0.12, "triangle"],
        day: [440, 0.1, "sine"],
        stamp: [180, 0.08, "square"],
        sting: [523, 0.18, "triangle"],
        district: [349, 0.12, "sine"],
      };
      const [freq, dur, type] = tones[kind] || tones.blip;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (kind === "ok" || kind === "recruit") o.frequency.exponentialRampToValueAtTime(freq * 1.35, t0 + dur);
      if (kind === "coin") o.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
      if (kind === "debate" || kind === "sting") o.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + dur);
      if (kind === "district") o.frequency.exponentialRampToValueAtTime(freq * 1.25, t0 + dur);
      const peak = 0.05 * sfxVol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (_) {
      /* ignore */
    }
  }

  function startMusic() {
    if (!musicOn || musicNodes) return;
    try {
      const ac = ensureAudio();
      if (!ac) return;
      const master = ac.createGain();
      master.gain.value = 0.0001;
      master.connect(ac.destination);
      master.gain.linearRampToValueAtTime(0.04 * musicVol, ac.currentTime + 0.5);
      musicNodes = { master, ac };
      musicStep = 0;
      musicAcc = 0;
    } catch (_) {
      musicNodes = null;
    }
  }

  function stopMusic() {
    if (!musicNodes) return;
    try {
      const { master, ac } = musicNodes;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.3);
      setTimeout(() => {
        try {
          master.disconnect();
        } catch (_) {}
      }, 400);
    } catch (_) {}
    musicNodes = null;
  }

  function tickMusic(dt) {
    if (!musicOn || !musicNodes || state !== "play") return;
    try {
      // District intensity: faster / brighter patterns off-plaza
      const distPace =
        currentDistrict === "media" ? 0.16 : currentDistrict === "donor" ? 0.18 : currentDistrict === "campus" ? 0.2 : 0.22;
      musicAcc += dt;
      if (musicAcc < distPace) return;
      musicAcc = 0;
      const ac = musicNodes.ac;
      const scales = {
        plaza: [262, 294, 330, 349, 392, 440],
        media: [277, 311, 370, 415, 466, 554],
        campus: [294, 330, 370, 392, 440, 494],
        donor: [247, 294, 330, 370, 440, 523],
      };
      const scale = scales[currentDistrict] || scales.plaza;
      const pattern = [0, 2, 4, 2, 5, 4, 3, 0];
      const note = scale[pattern[musicStep % pattern.length] % scale.length];
      musicStep++;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = currentDistrict === "media" ? "triangle" : "sine";
      o.frequency.value = note;
      o.connect(g);
      g.connect(musicNodes.master);
      const t0 = ac.currentTime;
      const peak = 0.1 * musicVol * (currentDistrict === "plaza" ? 1 : 1.15);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0);
      o.stop(t0 + 0.18);
    } catch (_) {}
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
  const POWER_RANK_COST = _D.POWER_RANK_COST;
  const OBJECTIVES = _D.OBJECTIVES;
  const CRISES = _D.CRISES;
  const MAP_W = _D.MAP_W;
  const MAP_H = _D.MAP_H;
  const ZONES = _D.ZONES;
  const DISTRICT_SPAWNS = _D.DISTRICT_SPAWNS;
  const CLUTTER = _D.CLUTTER;
  const NPCS = _D.NPCS;
  const BUTTON_SPOTS = _D.BUTTON_SPOTS;
  if (!CHARACTERS || !ZONES) {
    console.error("ORANGE_DATA missing — load data.js before game.js");
  }


  // ─── State ───────────────────────────────────────────────────
  const keys = Object.create(null);
  let touchMove = { x: 0, y: 0 };
  let state = "title"; // title | select | play | pause | evening | results
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
  let camPunch = 0;
  let redistribT = 0;
  let launchT = 0;
  let brandT = 0;
  let potholePaid = 0; // Paver Pete's grift counter
  let boeDay = 0, adDay = 0; // once-per-day "microtransaction" gags
  let currentDistrict = "plaza";
  let setpieces = { debate: false, scandal: false, march: false, gala: false };
  let scandals = []; // scrapbook strings
  let codexSeen = {}; // voter id -> true once recruited or viewed
  let showCodex = false;
  let lateNights = 0;
  let msg = "";
  let msgT = 0;
  let log = [];
  let objProg = {};
  let voters = []; // recruited group ids
  let voterLoyalty = {};
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

  function getCrisis() {
    return CRISES.find((c) => c.day === dayIndex) || CRISES[0];
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
  function resetRun(char) {
    selected = char;
    dayIndex = 1;
    coins = 12 + (ngPlusBonus || 0); // v1.3: slightly friendlier start + soft NG+
    rep = 0;
    axes = { street: 0, donor: 0, heat: 0 };
    powerRank = 0;
    spatCount = 0;
    camPunch = 0;
    redistribT = 0;
    launchT = 0;
    brandT = 0;
    potholePaid = 0;
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
    upgraded = false;
    toolLevel = 0;
    lockedOpen = false;
    debateDone = false;
    debateWon = false;
    results = null;
    evening = null;
    log = ngPlusBonus ? ["Soft NG+: +" + ngPlusBonus + "¢ from last strong week."] : [];
    beginDay(true);
  }

  /** Start or resume a calendar day (keeps meta progress) */
  function beginDay(isNewRun) {
    DAY_SECONDS_BASE = DAY_LENGTHS[dayLengthMode] || DAY_LENGTHS.normal;
    DAY_SECONDS = DAY_SECONDS_BASE;
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
    objProg = { permit: 0, buttons: 0, coffee: 0, voters: 0, home: 0, debate: 0 };
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
    const crisis = getCrisis();
    const rule = getBoardRule();
    const morning = `Day ${dayIndex}/${MAX_DAYS}: ${crisis.title} · Rule: ${rule.title}`;
    msg = morning;
    msgT = 4.5;
    if (isNewRun) log = [];
    pushLog(`Morning — Day ${dayIndex}. Crisis: ${crisis.title}. Rule: ${rule.title}.`);
    // Policy bloc permit ease: free small progress chance
    const coal = activeCoalition();
    if (coal && coal.id === "policy" && Math.random() < 0.4) {
      seedFlags.permitAtMail = true;
      pushLog("Policy Bloc: a clerk left the permit path obvious.");
    }
    // Only seed on a true New Week so Continue / mid-day loads don't re-queue tips
    if (isNewRun) seedTutorialTips();
    sfx("day");
    startMusic();
    saveGame();
  }

  function serializeRun() {
    return {
      v: 2,
      dayIndex,
      coins,
      rep,
      axes: { ...axes },
      powerRank,
      spatCount,
      currentDistrict,
      setpieces: { ...setpieces },
      scandals: scandals.slice(),
      codexSeen: { ...codexSeen },
      lateNights,
      voters: voters.slice(),
      voterLoyalty: { ...voterLoyalty },
      upgraded,
      toolLevel,
      lockedOpen,
      debateDone,
      debateWon,
      charId: selected && selected.id,
      log: log.slice(0, 12),
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
      boeDay,
      adDay,
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

  function hasSave(slot) {
    try {
      if (typeof localStorage === "undefined") return false;
      const raw = localStorage.getItem(slot != null ? slotKey(slot) : SAVE_KEY) || localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return !!(data && data.charId && data.dayIndex);
    } catch (_) {
      return false;
    }
  }

  function loadGame(slot) {
    try {
      if (typeof localStorage === "undefined") return false;
      if (slot != null) saveSlot = slot;
      const raw = localStorage.getItem(slotKey(saveSlot)) || localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const char = CHARACTERS.find((c) => c.id === data.charId);
      if (!char) return false;
      selected = char;
      charIdx = CHARACTERS.indexOf(char);
      dayIndex = clamp(data.dayIndex || 1, 1, MAX_DAYS);
      coins = data.coins | 0;
      axes = data.axes || { street: data.rep || 0, donor: Math.floor((data.rep || 0) * 0.5), heat: 0 };
      rep = data.rep | 0;
      powerRank = clamp(data.powerRank | 0, 0, 3);
      spatCount = data.spatCount | 0;
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
      upgraded = !!data.upgraded;
      toolLevel = data.toolLevel | 0;
      lockedOpen = !!data.lockedOpen;
      debateDone = !!data.debateDone;
      debateWon = !!data.debateWon;
      log = Array.isArray(data.log) ? data.log.slice() : [];
      sfxOn = data.sfxOn !== false;
      musicOn = data.musicOn !== false;
      if (typeof data.sfxVol === "number") sfxVol = data.sfxVol;
      if (typeof data.musicVol === "number") musicVol = data.musicVol;
      if (data.textScale === 1 || data.textScale === 1.15) textScale = data.textScale;
      reduceFlash = !!data.reduceFlash;
      if (data.dayLengthMode && DAY_LENGTHS[data.dayLengthMode]) dayLengthMode = data.dayLengthMode;
      if (typeof data.ngPlusBonus === "number") ngPlusBonus = data.ngPlusBonus;
      potholePaid = data.potholePaid | 0;
      boeDay = data.boeDay | 0;
      adDay = data.adDay | 0;

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
      startMusic();
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearSave() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(slotKey(saveSlot));
      }
    } catch (_) {}
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
    queueTip("slots", "Title screen: keys 1/2/3 pick a save slot before Continue.");
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
  function toast(t, sec = 3) {
    msg = t;
    msgT = sec;
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
  function setObj(id, v) {
    const o = OBJECTIVES.find((x) => x.id === id);
    if (!o) return;
    objProg[id] = Math.min(o.target, v);
  }
  function bumpObj(id, d = 1) {
    setObj(id, (objProg[id] || 0) + d);
  }
  function objDone(id) {
    const o = OBJECTIVES.find((x) => x.id === id);
    return o && (objProg[id] || 0) >= o.target;
  }
  function allMainDone() {
    return ["permit", "buttons", "coffee", "voters"].every(objDone);
  }
  function recruitChance(group) {
    let base = 0.55 * (selected.recruitMod || 1);
    base += getCrisis().recruitMod || 0;
    const coal = activeCoalition();
    if (coal && coal.id === "policy") base -= 0.12;
    if (group.preferred.includes(selected.id)) base += 0.25;
    if (voters.includes("students")) base += 0.1;
    if (rallyT > 0 && selected.powerKey === "rally") base += 0.2 + powerRank * 0.08;
    if (selected.powerKey === "squeeze" && group.id !== "crypto") base -= 0.05;
    if (group.rival && voters.includes(group.rival)) base -= 0.2;
    // board rule: open mic near stage
    const rule = getBoardRule();
    if (rule.recruitNearStage && player) {
      const st = getZone("stage");
      if (st && inZone(player.x, player.y, st, 50)) base += rule.recruitNearStage;
    }
    return clamp(base, 0.12, 0.95);
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
    toast(`${g.name} clash with ${rival ? rival.name : "rivals"} in the plaza.`);
  }

  function banner(text, color, sec = 2) {
    floaters.push({ x: player ? player.x : W / 2, y: player ? player.y - 55 : 100, text, color: color || "#ffd080", life: sec });
  }

  function punch(amount) {
    if (reduceFlash) return;
    camPunch = Math.max(camPunch, amount);
  }

  function tryRecruit(groupId, force = false) {
    if (voters.includes(groupId)) {
      toast("Already in your coalition.");
      return false;
    }
    const g = VOTER_GROUPS.find((v) => v.id === groupId);
    if (!g) return false;
    const chance = force ? 1 : recruitChance(g);
    if (Math.random() > chance && !force) {
      toast(`${g.name} hesitate. Try again or use your power.`);
      addAxes({ street: -1 });
      return false;
    }
    voters.push(groupId);
    codexSeen[groupId] = true;
    voterLoyalty[groupId] = 60 + Math.floor(Math.random() * 25);
    if (g.preferred.includes(selected.id)) voterLoyalty[groupId] += 15;
    bumpObj("voters", 1);
    addAxes({ street: 3, donor: g.id === "donors" || g.id === "crypto" ? 3 : 1, heat: g.id === "chaos" || g.id === "conspiracy" ? 2 : 0 });
    addCoins(3);
    burst(player.x, player.y, g.color, 16);
    floatText(player.x, player.y - 40, `+${g.name}!`, g.color);
    balloon(player.x, player.y - 50, g.name + " joined!", 2);
    banner(activeCoalition() ? activeCoalition().name : "New ally!", g.color, 1.8);
    sfx("recruit");
    punch(0.25);
    pushLog(`Recruited ${g.name}. Loyalty ${voterLoyalty[groupId]}.`);
    toast(`Coalition grows: ${g.name} joined!`);
    if (g.rival && voters.includes(g.rival)) triggerRivalSpat(groupId);
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
    list.sort((a, b) => a.d - b.d);
    return list[0] && list[0].d < INTERACT_R ? list[0] : null;
  }

  function interact() {
    if (state !== "play" || dayEnded) return;
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

    if (hit.type === "npc") {
      talkNpc(hit.ref);
      return;
    }

    if (hit.type === "zone") {
      useZone(hit.ref);
    }
  }

  function talkNpc(n) {
    const say = (line) => {
      toast(line);
      balloon(n.x, n.y - 38, line, 2.8);
      sfx("blip");
    };
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
        tryRecruit("moderates", selected.id === "mayor" || Math.random() < 0.55);
        return;
      }
      say(n.lines.default);
      return;
    }

    if (n.id === "barista") {
      if (coffeeFixed) {
        say(n.lines.done);
        addCoins(1);
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
      if (!voters.includes("wine") && Math.random() < 0.5) tryRecruit("wine");
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
      if (!voters.includes("crypto")) {
        const ok = tryRecruit("crypto");
        if (!ok) say(n.lines.default);
      } else if (!voters.includes("donors") && coins >= 12) {
        tryRecruit("donors", selected.id === "mayor" || Math.random() < 0.5);
        say("A suit materializes. Corporate Donors like the clink of coins.");
      } else {
        say("Crypto Bros nod like it's an oracle.");
      }
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
      if (potholePaid <= 3) {
        say(potholePaid === 1 ? n.lines.default : n.lines.excuses[(potholePaid - 2) % n.lines.excuses.length]);
        pushLog(`Paid Paver Pete 10¢ for pothole repair (total: ${potholePaid * 10}¢). Potholes: unchanged.`);
      } else {
        say(n.lines.exposed);
        addAxes({ street: -1 });
        pushLog("Paver Pete's potholes remain load-bearing. Conspiracy Cafe nods knowingly.");
        if (!voters.includes("conspiracy") && Math.random() < 0.6) tryRecruit("conspiracy");
        unlockAchieve("grifted", "Grift Recognized");
      }
      sfx("blip");
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
      tryRecruit("union", true);
      return;
    }

    if (n.id === "stagehand") {
      // Phase A setpiece: Plaza Debate (crisis day 2, or any day after 1 if flagged)
      if (getCrisis().debateDay && !debateDone) {
        runPlazaDebate();
        return;
      }
      if (!voters.includes("students")) {
        if (selected.powerKey === "rally" || rallyT > 0 || Math.random() < recruitChance(VOTER_GROUPS.find((v) => v.id === "students"))) {
          tryRecruit("students", selected.id === "alex");
          say(n.lines.rally);
        } else {
          say("Crowd scrolls past. Try Rally Cry (Q).");
        }
      } else if (debateDone) {
        say(debateWon ? "That debate still echoes. Nicely done." : "Stage is quieter after the dust-up.");
      } else {
        say("Students already swarm your banner.");
      }
      return;
    }

    if (n.id === "boothie") {
      if (!voters.includes("chaos")) {
        addRep(selected.id === "tiny" ? 1 : 2);
        addCoins(3);
        tryRecruit("chaos", Math.random() < 0.7 || selected.id === "tiny");
        say(n.lines.chaos);
        if (voters.includes("wine")) {
          voterLoyalty.wine = Math.max(15, (voterLoyalty.wine || 50) - 10);
          addRep(-2);
          pushLog("Wine Moms side-eye the spectacle.");
        }
      } else {
        if (buttons < 3) {
          buttons++;
          bumpObj("buttons", 1);
          say("Another button. Artisanal.");
        } else {
          say(n.lines.default);
        }
      }
      return;
    }

    if (n.id === "parkgoer") {
      if (!voters.includes("wine")) {
        addRep(2);
        tryRecruit("wine", selected.id === "alex" || selected.id === "mayor" || Math.random() < 0.6);
        say(voters.includes("wine") ? n.lines.wine : n.lines.default);
      } else {
        say(n.lines.default);
      }
      return;
    }

    if (n.id === "watchdog") {
      showObj = true;
      if (n.dayLines && n.dayLines[dayIndex]) say(n.dayLines[dayIndex]);
      else if (!hasPermit && !permitDelivered) say("LOST PERMIT near the Oversized Mailbox.");
      else say(n.lines.default);
      if (!voters.includes("budget") && dayIndex >= 2) tryRecruit("budget", Math.random() < 0.4);
      if (!voters.includes("policy") && permitDelivered) tryRecruit("policy", selected.id === "mayor" || Math.random() < 0.35);
      return;
    }

    if (n.id === "anchor") {
      if (n.dayLines && n.dayLines[dayIndex]) say(n.dayLines[dayIndex]);
      else say(n.lines.default);
      if (!voters.includes("chaos") && Math.random() < 0.4) tryRecruit("chaos");
      if (!voters.includes("patriots") && Math.random() < 0.3) tryRecruit("patriots");
      return;
    }

    if (n.id === "leaker") {
      if (getCrisis().scandalDay && !setpieces.scandal) {
        runScandalLeak();
        return;
      }
      if (n.dayLines && n.dayLines[dayIndex]) say(n.dayLines[dayIndex]);
      else say(n.lines.default);
      if (!voters.includes("conspiracy")) tryRecruit("conspiracy", Math.random() < 0.5);
      return;
    }

    if (n.id === "ra") {
      if (getCrisis().marchDay && !setpieces.march) {
        runUnionMarch();
        return;
      }
      if (n.dayLines && n.dayLines[dayIndex]) say(n.dayLines[dayIndex]);
      else say(n.lines.default);
      if (!voters.includes("students")) tryRecruit("students", selected.id === "alex" || Math.random() < 0.45);
      if (!voters.includes("lawn") && Math.random() < 0.35) tryRecruit("lawn");
      return;
    }

    if (n.id === "host") {
      if (getCrisis().galaDay && !setpieces.gala) {
        runDonorGala();
        return;
      }
      if (n.dayLines && n.dayLines[dayIndex]) say(n.dayLines[dayIndex]);
      else say(n.lines.default);
      if (!voters.includes("donors")) tryRecruit("donors", selected.id === "donny" || Math.random() < 0.5);
      return;
    }

    if (n.dayLines && n.dayLines[dayIndex]) say(n.dayLines[dayIndex]);
    else say(n.lines.default || "…");
  }

  function runScandalLeak() {
    setpieces.scandal = true;
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
    if (!voters.includes("conspiracy")) tryRecruit("conspiracy", true);
    saveGame();
  }

  function runUnionMarch() {
    setpieces.march = true;
    sfx("sting");
    punch(0.3);
    const strong = voters.includes("union") || selected.id === "bernie" || selected.id === "alex";
    if (strong) {
      addAxes({ street: 6, donor: -1, heat: 1 });
      addCoins(7);
      banner("MARCH SUCCESS", "#e07040", 2);
      toast("Union March: the route holds. Street Cred surges.");
      tryRecruit("union", true);
      if (!voters.includes("students")) tryRecruit("students");
    } else {
      addAxes({ street: 2, heat: 2 });
      banner("MARCH MUDDY", "#c09070", 2);
      toast("Union March: muddy message, still feet on pavement.");
      if (!voters.includes("union")) tryRecruit("union", Math.random() < 0.5);
    }
    pushLog("Campus Union March resolved.");
    saveGame();
  }

  function runDonorGala() {
    setpieces.gala = true;
    scandals.push("Day " + dayIndex + ": Gala optics");
    sfx("sting");
    punch(0.25);
    const flash = selected.id === "donny" || voters.includes("donors") || brandT > 0;
    if (flash) {
      addAxes({ donor: 7, heat: 3, street: -1 });
      addCoins(12);
      banner("GALA WIN", "#e8c040", 2);
      toast("Donor Gala: you own the room. Donor Trust spikes; Heat follows.");
      tryRecruit("donors", true);
      if (!voters.includes("patriots") && Math.random() < 0.4) tryRecruit("patriots");
    } else {
      addAxes({ donor: 3, heat: 2 });
      addCoins(5);
      banner("GALA RSVP", "#c0a060", 2);
      toast("Donor Gala: you survive the canapés. Mild Donor bump.");
      if (!voters.includes("donors")) tryRecruit("donors", Math.random() < 0.55);
    }
    pushLog("Donor Gala night logged.");
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
      toast(rule.blurb);
      if (!hasPermit && !permitDelivered) {
        toast("Sticky note: Permit near MAILBOX.");
      }
      if (c.debateDay && !debateDone) {
        toast("Poster: PLAZA DEBATE — Civic Stage.");
      }
      const coal = activeCoalition();
      if (coal) toast(`Active bloc: ${coal.name} — ${coal.bonus}`);
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
      if (!voters.includes("conspiracy") && Math.random() < 0.55) {
        tryRecruit("conspiracy", selected.id === "tiny" || selected.id === "bernie");
      }
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
      if (!voters.includes("policy") && Math.random() < 0.6) tryRecruit("policy", selected.id === "mayor" || selected.id === "donny");
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
      if (!voters.includes("moderates") && Math.random() < 0.5) tryRecruit("moderates");
      if (!voters.includes("patriots") && Math.random() < 0.35) tryRecruit("patriots");
      sfx("ok");
      return;
    }

    if (z.id === "park") {
      talkNpc(NPCS.find((n) => n.id === "parkgoer"));
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

    if (z.id === "plaza") {
      toast("Fountain Plaza. Toss a coin (2¢) for luck?");
      if (coins >= 2 && Math.random() < 0.5) {
        coins -= 2;
        addRep(3);
        toast("Wish accepted. The fountain gurgles approvingly.");
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
      if (z.id === "petition" && !voters.includes("students")) tryRecruit("students", Math.random() < 0.5);
      if (z.id === "petition" && !voters.includes("policy") && Math.random() < 0.35) tryRecruit("policy");
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
      if (z.id === "pitch" && !voters.includes("donors") && coins >= 10) tryRecruit("donors", Math.random() < 0.4);
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
      if (voters.includes("budget") && !voters.includes("budget")) {
        /* no-op */
      }
      // Budget Watchers like thrift
      if (Math.random() < 0.45) tryRecruit("budget", selected.id === "mayor" || selected.id === "bernie");
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
      if (!voters.includes("union") && Math.random() < 0.4 + powerRank * 0.1) tryRecruit("union", true);
      if (!voters.includes("budget") && Math.random() < 0.3) tryRecruit("budget");
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
      if (!voters.includes("crypto") && Math.random() < 0.35) tryRecruit("crypto");
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
      if (!voters.includes("donors") && Math.random() < 0.4) tryRecruit("donors");
      if (!voters.includes("patriots") && Math.random() < 0.3) tryRecruit("patriots", selected.id === "donny");
      if (!voters.includes("chaos") && Math.random() < 0.25) tryRecruit("chaos");
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
      if (!voters.includes("students")) tryRecruit("students", selected.id === "alex");
      if (!voters.includes("moderates") && Math.random() < 0.5) tryRecruit("moderates");
    } else {
      addRep(2);
      addCoins(3);
      balloon(player.x, player.y - 44, "Messy debate", 2.5);
      toast("Plaza Debate: You fumble a metaphor. Still, you showed up.");
      pushLog("Debate was messy. A few polite claps.");
    }
    saveGame();
  }

  function endDay(voluntary) {
    if (dayEnded) return;
    dayEnded = true;
    stopMusic();
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
    // loyalty drift
    for (const id of voters) {
      voterLoyalty[id] = clamp((voterLoyalty[id] || 50) + Math.floor(Math.random() * 10 - 3), 10, 100);
    }
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
      objectives: OBJECTIVES.map((o) => ({
        label: o.label,
        done: objDone(o.id),
        prog: objProg[o.id] || 0,
        target: o.target,
      })),
      homeOk,
      debateDone,
      debateWon,
      upgraded,
    };
    evening = daySummary;
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
    if (dayIndex >= MAX_DAYS) {
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
        days: MAX_DAYS,
        debateWon,
        electionNight: true,
        codexCount: Object.keys(codexSeen).length,
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
      if (dayIndex >= MAX_DAYS) unlockAchieve("week_clear", "Election Week Cleared");
      if (outcome && outcome.id === "E1") unlockAchieve("ending_e1", "Ending: Civic Darling");
      if (outcome && outcome.id === "E4") unlockAchieve("ending_e4", "Ending: Money Machine");
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
      clearSave();
      sfx("ok");
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
    tickMusic(dt);
    if (msgT > 0) msgT -= dt;
    interactFlash = Math.max(0, interactFlash - dt);
    rallyT = Math.max(0, rallyT - dt);

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

  function drawPlayer() {
    drawPlayerBody();
    drawPlayerFx();
  }

  function drawHUD() {
    // top bar
    const barH = 58;
    ctx.fillStyle = "rgba(20,12,30,0.82)";
    ctx.fillRect(0, 0, W, barH);
    ctx.fillStyle = "rgba(255,140,40,0.35)";
    ctx.fillRect(0, barH - 2, W, 2);

    // Calendar strip (D3) — days 1..7
    const calY = barH + 4;
    const calW = 28;
    const calStart = W / 2 - (MAX_DAYS * (calW + 4)) / 2;
    for (let d = 1; d <= MAX_DAYS; d++) {
      const x = calStart + (d - 1) * (calW + 4);
      const cur = d === dayIndex;
      ctx.fillStyle = cur ? "rgba(255,140,40,0.85)" : d < dayIndex ? "rgba(80,120,90,0.7)" : "rgba(40,30,55,0.75)";
      drawRounded(x, calY, calW, 18, 4);
      ctx.fill();
      ctx.fillStyle = cur ? "#1a1020" : "#ddd";
      ctx.font = font(10, "bold");
      ctx.textAlign = "center";
      ctx.fillText(String(d), x + calW / 2, calY + 13);
    }
    if (dayIndex >= MAX_DAYS) {
      ctx.fillStyle = "#ffb347";
      ctx.font = font(9, "bold");
      ctx.fillText("EVE", calStart + MAX_DAYS * (calW + 4) + 18, calY + 13);
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

    // stats
    ctx.textAlign = "left";
    ctx.font = "bold 14px Cascadia Mono,monospace";
    ctx.fillStyle = "#ffd060";
    ctx.fillText(`${coins}¢`, 200, 24);
    // axes (Phase B)
    ctx.font = "bold 10px Cascadia Mono,monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#80e0a0";
    ctx.fillText(`St ${axes.street | 0}`, 188, 18);
    ctx.fillStyle = "#80c0e0";
    ctx.fillText(`Do ${axes.donor | 0}`, 188, 30);
    ctx.fillStyle = "#e080a0";
    ctx.fillText(`Ht ${axes.heat | 0}`, 188, 42);

    // day index chip
    ctx.fillStyle = "rgba(255,160,60,0.25)";
    drawRounded(268, 10, 52, 32, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd090";
    ctx.font = "bold 12px Cascadia Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText(`D${dayIndex}/${MAX_DAYS}`, 294, 30);

    // day meter
    ctx.fillStyle = "#443058";
    drawRounded(330, 16, 200, 18, 8);
    ctx.fill();
    const dcol = time < 0.55 ? "#ffd060" : time < NIGHT_AT ? "#ff8060" : "#8090ff";
    ctx.fillStyle = dcol;
    drawRounded(330, 16, 200 * time, 18, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const tod = time < 0.3 ? "Morning" : time < 0.55 ? "Midday" : time < 0.75 ? "Afternoon" : time < NIGHT_AT ? "Evening" : "Night";
    const crisisShort = getCrisis().title.split(" ")[0];
    ctx.fillText(`${tod} · ${crisisShort}`, 430, 29);

    // voters
    ctx.textAlign = "left";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#ddd";
    ctx.fillText("Voters:", 550, 22);
    voters.forEach((id, i) => {
      const g = VOTER_GROUPS.find((v) => v.id === id);
      if (!g) return;
      if (!drawSprite("voters/" + id, 592 + i * 26, 22, 22, 22)) {
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(604 + i * 26, 34, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (!voters.length) {
      ctx.fillStyle = "#8878a0";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("none yet", 600, 36);
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
      const ox = 12,
        oy = 64,
        ow = 300;
      const rows = OBJECTIVES.length;
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
      OBJECTIVES.forEach((o, i) => {
        const done = objDone(o.id);
        const p = objProg[o.id] || 0;
        ctx.fillStyle = done ? "#6d6" : "#e8d8f0";
        ctx.font = "11px Segoe UI,sans-serif";
        const mark = done ? "✓" : "○";
        const label = o.short || o.label;
        fitText(`${mark} ${label}  ${p}/${o.target}`, ox + 12, oy + 40 + i * 20, ow - 24, "left");
      });
      // crisis + debate hint under objectives
      const extraY = oy + 40 + OBJECTIVES.length * 20 + 8;
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
        const known = !!codexSeen[g.id] || voters.includes(g.id);
        const y = cy + 58 + i * 26;
        ctx.fillStyle = known ? g.color : "#555";
        ctx.font = "12px Segoe UI,sans-serif";
        fitText(known ? `${g.icon} ${g.name}` : "??? · ???", cx + 12, y, 200, "left");
        if (known && voters.includes(g.id)) {
          ctx.fillStyle = "#8d8";
          ctx.fillText("IN", cx + 250, y);
        }
      });
      ctx.fillStyle = "#8878a8";
      ctx.font = "10px sans-serif";
      fitText("Scandals: " + (scandals.length ? scandals.slice(-3).join(" · ") : "none yet"), cx + 12, cy + ch - 16, cw - 24, "left");
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
    const bob = Math.sin(animT * 1.5) * 3;
    const artW = 520;
    const artH = 300;
    const artX = W / 2 - artW / 2;
    const artY = 36 + bob;
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

    // title wordmark over lower key art
    ctx.fillStyle = "rgba(20,12,30,0.55)";
    drawRounded(W / 2 - 200, 300, 400, 70, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 36px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Orange Day", W / 2, 332);
    ctx.fillStyle = "#ffb347";
    ctx.font = "700 22px Segoe UI,sans-serif";
    ctx.fillText("Pocket Republic", W / 2, 360);

    ctx.fillStyle = "#c8b8d8";
    ctx.font = "13px Segoe UI,sans-serif";
    ctx.fillText("Cozy satirical civic life-sim · Election week " + BUILD_ID, W / 2, 400);
    ctx.fillStyle = "#9080a8";
    ctx.font = "11px Cascadia Mono,monospace";
    ctx.fillText("Fictional parody archetypes · No real names or likenesses", W / 2, 420);

    const has = hasSave(1) || hasSave(2) || hasSave(3) || hasSave();
    // draft badge
    ctx.fillStyle = "rgba(255,180,80,0.2)";
    drawRounded(W / 2 - 120, 8, 240, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd080";
    ctx.font = "bold 11px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(DRAFT_LABEL + " · " + BUILD_ID, W / 2, 23);

    if (has) {
      const contOn = titleFocus === "continue";
      ctx.fillStyle = contOn ? `rgba(255,140,40,${0.9 + Math.sin(animT * 4) * 0.1})` : "rgba(80,60,100,0.85)";
      drawRounded(W / 2 - 270, 430, 250, 44, 12);
      ctx.fill();
      ctx.fillStyle = contOn ? "#1a0f20" : "#ddd";
      ctx.font = "bold 15px Segoe UI,sans-serif";
      ctx.fillText("Continue (C) slot " + saveSlot, W / 2 - 145, 458);

      ctx.fillStyle = !contOn ? `rgba(255,140,40,${0.9 + Math.sin(animT * 4) * 0.1})` : "rgba(80,60,100,0.85)";
      drawRounded(W / 2 + 20, 430, 250, 44, 12);
      ctx.fill();
      ctx.fillStyle = !contOn ? "#1a0f20" : "#ddd";
      ctx.fillText("New Week (N)", W / 2 + 145, 458);

      // slots — filled vs empty readable at a glance
      for (let s = 1; s <= 3; s++) {
        const on = saveSlot === s;
        const filled = hasSave(s);
        ctx.fillStyle = on ? "#ff9a3c" : filled ? "rgba(70,150,110,0.9)" : "rgba(45,38,65,0.9)";
        drawRounded(W / 2 - 100 + (s - 1) * 70, 482, 60, 26, 6);
        ctx.fill();
        if (on) {
          ctx.strokeStyle = "#fff0c0";
          ctx.lineWidth = 2;
          drawRounded(W / 2 - 100 + (s - 1) * 70, 482, 60, 26, 6);
          ctx.stroke();
        }
        ctx.fillStyle = on ? "#1a1020" : filled ? "#e8ffe8" : "#8878a8";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText((filled ? "●" : "○") + " S" + s, W / 2 - 70 + (s - 1) * 70, 500);
      }

      ctx.fillStyle = "#9a8ab8";
      ctx.font = "11px Segoe UI,sans-serif";
      ctx.fillText("1/2/3 slots (●=save) · G gallery · H glossary · O options", W / 2, 528);
    } else {
      const pulse = 0.88 + Math.sin(animT * 4) * 0.12;
      ctx.fillStyle = `rgba(255,140,40,${pulse})`;
      drawRounded(W / 2 - 130, 440, 260, 48, 12);
      ctx.fill();
      ctx.fillStyle = "#1a0f20";
      ctx.font = "bold 18px Segoe UI,sans-serif";
      ctx.fillText("Press Enter / Click", W / 2, 470);
      ctx.fillStyle = "#7a6a98";
      ctx.font = "12px Segoe UI,sans-serif";
      ctx.fillText("7-day week · WASD · E · Q · O options · gamepad", W / 2, 508);
      ctx.fillStyle = "#6a5a88";
      ctx.font = "10px Cascadia Mono,monospace";
      ctx.fillText(BUILD_ID, W / 2, 528);
    }
  }

  function drawOptions() {
    ctx.fillStyle = "rgba(10,8,20,0.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(30,20,50,0.95)";
    drawRounded(W / 2 - 220, 80, 440, 380, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(W / 2 - 220, 80, 440, 380, 14);
    ctx.stroke();
    ctx.fillStyle = "#ffb347";
    ctx.font = font(22, "bold");
    ctx.textAlign = "center";
    ctx.fillText("Options", W / 2, 120);
    ctx.fillStyle = "#c8b8d8";
    ctx.font = font(14);
    const lines = [
      `Music: ${musicOn ? "ON" : "OFF"}  (M)   vol ${Math.round(musicVol * 100)}%  ([ ])`,
      `SFX: ${sfxOn ? "ON" : "OFF"}  (S)   vol ${Math.round(sfxVol * 100)}%  (; ')`,
      `Text size: ${textScale > 1 ? "LARGE" : "NORMAL"}  (T)`,
      `Reduce flash: ${reduceFlash ? "ON" : "OFF"}  (F)`,
      `Day length: ${dayLengthMode.toUpperCase()}  (L cycles short/normal/long)`,
      "",
      "Gamepad: stick move · A interact · X power · Start pause",
      "Keyboard: WASD · E · Q · Tab · C codex",
      "",
      "Language: English",
      `Build ${BUILD_ID} · web Canvas (no engine port)`,
      ngPlusBonus ? `Soft NG+ ready: +${ngPlusBonus}¢ next new week` : "Soft NG+: win a strong week to bank start ¢",
      `Achievements: ${Object.keys(achievements).length} unlocked`,
      "I — credits",
      "Esc / O — close",
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 152 + i * 22);
    });
  }

  function drawGallery() {
    ctx.fillStyle = "rgba(10,8,20,0.85)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(30,20,50,0.96)";
    drawRounded(W / 2 - 280, 40, 560, 460, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(W / 2 - 280, 40, 560, 460, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb347";
    ctx.font = font(20, "bold");
    ctx.fillText("Achievement Gallery · G", W / 2, 75);
    const list = [
      ["first_voter", "First Voter"],
      ["half_dex", "Half the Codex"],
      ["full_dex", "Full Voter Dex"],
      ["tool", "Multitool Owner"],
      ["power_max", "Power Tree Max"],
      ["debate", "Debate Champ"],
      ["scandal", "Leak Season"],
      ["march", "March Feet"],
      ["gala", "Gala Guest"],
      ["coalition", "Full Bloc"],
      ["week_clear", "Election Week Cleared"],
      ["ending_e1", "Ending: Civic Darling"],
      ["ending_e4", "Ending: Money Machine"],
      ["five_star", "Five Achievements"],
      ["grifted", "Grift Recognized"],
    ];
    ctx.textAlign = "left";
    ctx.font = font(13);
    list.forEach((row, i) => {
      const [id, label] = row;
      const on = !!achievements[id];
      const col = i % 2;
      const x = W / 2 - 250 + col * 270;
      const y = 110 + Math.floor(i / 2) * 28;
      ctx.fillStyle = on ? "#80e0a0" : "#666";
      ctx.fillText((on ? "★ " : "○ ") + label, x, y);
    });
    ctx.textAlign = "center";
    ctx.fillStyle = "#a090b8";
    ctx.font = font(12);
    ctx.fillText(`${Object.keys(achievements).length} unlocked · Esc/G close`, W / 2, 470);
    if (bestEnding) {
      ctx.fillStyle = "#ffd080";
      ctx.fillText(`Best ending: ${bestEnding.title} (${bestEnding.character})`, W / 2, 445);
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
      "Save slots 1–3 on title (keys 1/2/3 when Continue focused).",
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
    ctx.fillStyle = "rgba(30,20,50,0.96)";
    drawRounded(W / 2 - 260, 60, 520, 420, 14);
    ctx.fill();
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    drawRounded(W / 2 - 260, 60, 520, 420, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb347";
    ctx.font = font(22, "bold");
    ctx.fillText("Credits · " + BUILD_ID, W / 2, 100);
    ctx.fillStyle = "#fff";
    ctx.font = font(16, "bold");
    ctx.fillText("Orange Day: Pocket Republic", W / 2, 140);
    ctx.fillStyle = "#c8b8d8";
    ctx.font = font(13);
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
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 175 + i * 20);
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
    ctx.fillText(`Evening Report — Day ${e.day}/${MAX_DAYS}`, W / 2, 48);

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
      fitText(`${o.done ? "✓" : "✗"} ${o.label}`, 80, 248 + i * 22, 420, "left");
    });

    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 14px Segoe UI,sans-serif";
    ctx.fillText("Voters", 560, 220);
    if (!e.voters.length) {
      ctx.fillStyle = "#888";
      ctx.font = "13px sans-serif";
      ctx.fillText("None yet", 560, 248);
    } else {
      e.voters.forEach((id, i) => {
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (!g) return;
        ctx.fillStyle = g.color;
        ctx.font = "13px Segoe UI,sans-serif";
        fitText(`${g.icon} ${g.name} · ${e.loyalty[id] || 0}`, 560, 248 + i * 22, 340, "left");
      });
    }

    if (e.debateDone) {
      ctx.fillStyle = e.debateWon ? "#8d8" : "#da8";
      ctx.font = "13px Segoe UI,sans-serif";
      ctx.fillText(e.debateWon ? "Plaza Debate: WIN" : "Plaza Debate: messy but present", 560, 400);
    }

    const last = e.day >= MAX_DAYS;
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
    ctx.fillText("← → select · Enter/click · 6 avatars · full election week", W / 2, 62);

    const cols = 3;
    const cardW = 280;
    const cardH = 200;
    const gap = 16;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (W - totalW) / 2;
    const y0 = 70;

    CHARACTERS.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = y0 + row * (cardH + gap);
      const sel = i === charIdx;
      const pad = 12;
      const innerW = cardW - pad * 2;

      ctx.fillStyle = sel ? "rgba(255,140,40,0.2)" : "rgba(40,30,60,0.92)";
      drawRounded(x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = sel ? "#ff9a3c" : "#4a3a68";
      ctx.lineWidth = sel ? 3 : 1;
      ctx.stroke();

      ctx.save();
      drawRounded(x, y, cardW, cardH, 12);
      ctx.clip();

      const ab = Math.sin(animT * 3 + i) * 2;
      if (
        !drawSprite(`player/${c.id}_down_idle`, x + 12, y + 24 + ab, 56, 70) &&
        !drawSprite(`player/${c.id}_idle`, x + 12, y + 24 + ab, 56, 70)
      ) {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(x + 40, y + 55, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Segoe UI,sans-serif";
      ctx.textAlign = "left";
      fitText(c.name, x + 80, y + 42, innerW - 70, "left");
      ctx.fillStyle = c.accent;
      ctx.font = "bold 11px Segoe UI,sans-serif";
      fitText(c.power, x + 80, y + 60, innerW - 70, "left");
      ctx.fillStyle = "#c8b8d8";
      ctx.font = "11px Segoe UI,sans-serif";
      wrapText(c.blurb, x + 80, y + 80, innerW - 70, 14, 3, "left");
      ctx.fillStyle = "#e0a0a0";
      ctx.font = "10px Segoe UI,sans-serif";
      wrapText("Weak: " + c.weakness, x + pad, y + cardH - 28, innerW, 13, 2, "left");

      ctx.restore();
    });

    ctx.fillStyle = "#8878a8";
    ctx.font = "12px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Click a card or press Enter", W / 2, H - 18);
  }

  let pauseButtons = [];
  const PAUSE_ITEMS = [
    { id: "resume", label: "Resume", hint: "Esc" },
    { id: "save", label: "Save", hint: "S" },
    { id: "restart", label: "Restart run", hint: "R" },
    { id: "options", label: "Options", hint: "O" },
    { id: "gallery", label: "Achievement Gallery", hint: "G" },
    { id: "glossary", label: "Glossary", hint: "H" },
    { id: "credits", label: "Credits", hint: "I" },
  ];

  function pauseAction(id) {
    if (id === "resume") state = "play";
    else if (id === "save") toast(saveGame() ? "Saved." : "Save failed.");
    else if (id === "restart") {
      clearSave();
      state = "select";
    } else if (id === "options") showOptions = true;
    else if (id === "gallery") showGallery = true;
    else if (id === "glossary") showGlossary = true;
    else if (id === "credits") showCredits = true;
  }

  function drawPause() {
    ctx.fillStyle = "rgba(10,8,20,0.72)";
    ctx.fillRect(0, 0, W, H);

    const panelW = 380,
      panelX = W / 2 - panelW / 2,
      panelY = 70,
      panelH = 424;
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
      btnH = 40,
      gap = 9;
    let by = panelY + 60;
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
    ctx.fillText("Sleep at HOME · 7-day week · " + BUILD_ID, W / 2, panelY + panelH - 14);
  }

  function drawResults() {
    ctx.fillStyle = "#140e24";
    ctx.fillRect(0, 0, W, H);

    const r = results;
    if (!r) return;

    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 26px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("End of Day — Pocket Republic", W / 2, 42);

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

    // objectives
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 14px Segoe UI,sans-serif";
    ctx.fillText("Objectives", 80, 270);
    r.objectives.forEach((o, i) => {
      ctx.fillStyle = o.done ? "#6d6" : "#e88";
      ctx.font = "13px Segoe UI,sans-serif";
      fitText(`${o.done ? "✓" : "✗"} ${o.label}`, 80, 295 + i * 22, 400, "left");
    });

    // voters
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 14px Segoe UI,sans-serif";
    ctx.fillText("Voter Coalition", 520, 270);
    if (!r.voters.length) {
      ctx.fillStyle = "#888";
      ctx.font = "13px Segoe UI,sans-serif";
      ctx.fillText("No groups recruited", 520, 295);
    } else {
      r.voters.forEach((id, i) => {
        const g = VOTER_GROUPS.find((v) => v.id === id);
        if (!g) return;
        ctx.fillStyle = g.color;
        ctx.font = "13px Segoe UI,sans-serif";
        fitText(`${g.icon} ${g.name}  · loyalty ${r.loyalty[id] || 0}`, 520, 295 + i * 22, 360, "left");
      });
    }

    ctx.fillStyle = r.upgraded ? "#80e0ff" : "#888";
    ctx.font = "13px Segoe UI,sans-serif";
    ctx.fillText(r.upgraded ? "✓ Tool upgraded" : "○ No tool upgrade", 520, 420);
    if (r.electionNight) {
      ctx.fillStyle = "#ffb347";
      ctx.font = "bold 14px Segoe UI,sans-serif";
      ctx.fillText("ELECTION NIGHT · " + BUILD_ID, 520, 430);
    }
    if (r.days) {
      ctx.fillStyle = "#c8b8d8";
      ctx.font = "13px Segoe UI,sans-serif";
      ctx.fillText(`Week: ${r.days} days · Codex ${r.codexCount || 0}/12`, 520, 450);
    }
    if (r.outcome && r.outcome.id) {
      ctx.fillStyle = "#a0d0ff";
      ctx.fillText(`Ending ${r.outcome.id}`, 520, 470);
    }

    ctx.fillStyle = "rgba(255,140,40,0.9)";
    drawRounded(W / 2 - 130, 480, 260, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1020";
    ctx.font = "bold 16px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Title Screen (Enter)", W / 2, 508);
    ctx.fillStyle = "#6a5a88";
    ctx.font = "11px Cascadia Mono,monospace";
    const achN = Object.keys(achievements).length;
    ctx.fillStyle = "#6a5a88";
    ctx.font = "11px Cascadia Mono,monospace";
    ctx.fillText("I credits · O options · ★" + achN + " · " + BUILD_ID, W / 2, 532);
  }

  function frame(dt) {
    if (state === "title") drawTitle();
    else if (state === "select") drawSelect();
    else if (state === "evening") drawEvening();
    else if (state === "results") drawResults();
    else {
      drawWorld();
      drawHUD();
      if (state === "pause") drawPause();
    }
    if (showOptions) drawOptions();
    if (showCredits) drawCredits();
    if (showGallery) drawGallery();
    if (showGlossary) drawGlossary();
  }

  // ─── Input ───────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    keys[e.key.toLowerCase()] = true;

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
      if (state === "play" || state === "title" || state === "pause" || state === "results") {
        showGallery = !showGallery;
        if (showGallery) {
          showOptions = false;
          showCredits = false;
          showGlossary = false;
          showCodex = false;
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
    if (showGallery || showGlossary) {
      if (e.key === "Escape") {
        showGallery = false;
        showGlossary = false;
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
        if (musicOn && state === "play") startMusic();
        else stopMusic();
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
        saveSettings();
      }
      if (e.key === "]") {
        musicVol = clamp(musicVol + 0.1, 0, 1);
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
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (hasSave(1) || hasSave(2) || hasSave(3) || hasSave()) titleFocus = titleFocus === "continue" ? "new" : "continue";
      }
      if (e.key === "c" || e.key === "C") titleFocus = "continue";
      if (e.key === "n" || e.key === "N") titleFocus = "new";
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        saveSlot = parseInt(e.key, 10);
        toast("Save slot " + saveSlot);
        if (titleFocus === "continue" && hasSave(saveSlot)) {
          /* slot ready */
        }
      }
      if (e.key === "m" || e.key === "M") {
        musicOn = !musicOn;
        if (!musicOn) stopMusic();
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
        ensureAudio();
        if (titleFocus === "continue" && (hasSave(saveSlot) || hasSave())) {
          if (!loadGame(saveSlot)) {
            titleFocus = "new";
            state = "select";
          }
        } else {
          if (titleFocus === "new") {
            /* keep other slots */
          }
          state = "select";
        }
        e.preventDefault();
      } else if (state === "select") {
        resetRun(CHARACTERS[charIdx]);
        state = "play";
        toast(`You wake as ${selected.name}. Day ${dayIndex} — check the Town Board.`);
        e.preventDefault();
      } else if (state === "evening") {
        finishEvening();
        e.preventDefault();
      } else if (state === "results") {
        state = "title";
        titleFocus = hasSave() ? "continue" : "new";
        e.preventDefault();
      } else if (state === "play" && e.key === " ") {
        interact();
        e.preventDefault();
      }
    }
    if (state === "select") {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") charIdx = (charIdx + CHARACTERS.length - 1) % CHARACTERS.length;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") charIdx = (charIdx + 1) % CHARACTERS.length;
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
        if (musicOn) startMusic();
        else stopMusic();
      }
    } else if (state === "pause") {
      if (e.key === "Escape") pauseAction("resume");
      else if (e.key === "s" || e.key === "S") pauseAction("save");
      else if (e.key === "r" || e.key === "R") pauseAction("restart");
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener("click", (e) => {
    canvas.focus?.();
    const rect = canvas.getBoundingClientRect();
    const sx = W / rect.width;
    const sy = H / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;

    if (showOptions || showGallery || showGlossary || showCredits) {
      showOptions = showGallery = showGlossary = showCredits = false;
      return;
    }
    if (state === "pause") {
      const hit = pauseButtons.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
      if (hit) pauseAction(hit.id);
      return;
    }

    if (state === "title") {
      ensureAudio();
      if (hasSave()) {
        // click left = continue, right = new
        if (mx < W / 2) {
          titleFocus = "continue";
          if (!loadGame()) {
            titleFocus = "new";
            state = "select";
          }
        } else {
          titleFocus = "new";
          clearSave();
          state = "select";
        }
      } else {
        state = "select";
      }
      return;
    }
    if (state === "select") {
      const cols = 3,
        cardW = 280,
        cardH = 200,
        gap = 16,
        y0 = 70;
      const totalW = cols * cardW + (cols - 1) * gap;
      const startX = (W - totalW) / 2;
      CHARACTERS.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gap);
        const y = y0 + row * (cardH + gap);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
          charIdx = i;
          resetRun(CHARACTERS[charIdx]);
          state = "play";
          toast(`You wake as ${selected.name}. Day ${dayIndex}/7 — check the Town Board.`);
        }
      });
      return;
    }
    if (state === "evening") {
      finishEvening();
      return;
    }
    if (state === "results") {
      state = "title";
      titleFocus = "new";
      return;
    }
  });

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

  function unlockAchieve(id, label) {
    if (achievements[id]) return;
    achievements[id] = true;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(ACHIEVE_KEY, JSON.stringify(achievements));
    } catch (_) {}
    banner("★ " + label, "#ffd060", 2.5);
    toast("Achievement: " + label);
    sfx("ok");
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
  }

  loadSettings();

  // Expose debug + QA hooks (browser console / smoke.js)
  window.ORANGE_DAY = {
    get state() {
      return {
        mode: state,
        dayIndex,
        maxDays: MAX_DAYS,
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
      startCharacter(i) {
        charIdx = ((i % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
        resetRun(CHARACTERS[charIdx]);
        state = "play";
        return selected.id;
      },
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
      hasSave,
      getCrisis,
      runPlazaDebate,
      objDone,
      allMainDone,
      forceRecruit(id) {
        return tryRecruit(id, true);
      },
      setDay(n) {
        dayIndex = clamp(n, 1, MAX_DAYS);
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

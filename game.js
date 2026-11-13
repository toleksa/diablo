"use strict";
/* ============================================================
   INFERNAL CRUCIBLE — a Diablo III-like in the browser
   Engine: Canvas 2D, procedural graphics and sound (WebAudio)
   ============================================================ */

// ---------- Utilities ----------
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
let _seed = 1337;
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263 + _seed * 69069) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- Audio (proceduralne efekty WebAudio) ----------
let AC = null, masterGain = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(AC.destination);
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function tone(freq, dur, type, vol, slideTo) {
  const ctx = audio();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(masterGain);
  o.start(); o.stop(ctx.currentTime + dur);
}
function noise(dur, vol, filterFreq) {
  const ctx = audio();
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFreq || 2000;
  const g = ctx.createGain(); g.gain.value = vol || 0.25;
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start();
}
const S = {
  hit()      { noise(0.08, 0.22, 3200); tone(190, 0.07, "square", 0.12, 90); },
  crit()     { noise(0.12, 0.3, 5200); tone(320, 0.12, "sawtooth", 0.16, 120); },
  swing()    { noise(0.05, 0.06, 1400); },
  hurt()     { tone(150, 0.25, "sawtooth", 0.28, 60); noise(0.15, 0.2, 900); },
  death()    { tone(240, 0.5, "sawtooth", 0.2, 40); noise(0.4, 0.25, 700); },
  globe()    { tone(660, 0.09, "sine", 0.16, 990); },
  healGlobe() { tone(520, 0.14, "sine", 0.2, 880); },
  gold()     { tone(1250, 0.06, "square", 0.1, 1600); tone(1700, 0.05, "square", 0.07); },
  levelUp()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.22), i * 110)); },
  whirl()    { noise(0.55, 0.3, 2400); tone(420, 0.5, "sawtooth", 0.12, 180); },
  leap()     { tone(180, 0.16, "square", 0.22, 520); },
  impact()   { noise(0.25, 0.35, 1200); tone(90, 0.3, "sine", 0.3, 45); },
  potion()   { tone(440, 0.2, "sine", 0.18, 660); },
  portal()   { tone(300, 0.7, "sine", 0.2, 900); noise(0.5, 0.1, 3000); },
  treasure() { tone(520, 0.22, "triangle", 0.2, 880); tone(770, 0.3, "sine", 0.22, 1240); noise(0.3, 0.06, 260); },
  item()     { [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.15, "triangle", 0.16), i * 90)); },
  shoot()    { tone(900, 0.06, "square", 0.08, 400); },
  bow()      { noise(0.05, 0.1, 2600); tone(1500, 0.05, "sine", 0.05, 1150); },
  zap()      { tone(760, 0.14, "sine", 0.12, 1500); tone(1180, 0.09, "triangle", 0.1, 640); },
  deny()     { tone(300, 0.1, "sine", 0.07, 210); },
  elite()    { tone(110, 0.5, "sawtooth", 0.25, 55); noise(0.3, 0.2, 500); },
  bossRoar() { tone(70, 1.1, "sawtooth", 0.35, 40); noise(0.8, 0.3, 420); },
  awaken()   { tone(150, 0.3, "sawtooth", 0.16, 75); noise(0.1, 0.12, 900); },
};

// ---------- Constants ----------
const WORLD = { w: 2816, h: 2112 };
const TS = 64, GCOLS = WORLD.w / TS, GROWS = WORLD.h / TS; // 44 x 33 tiles
const WALL_H = 26;

// ---------- Player classes (issue #22) ----------
const CLASSES = {
  // class colours (issue #22), repainted for issue #52: the barbarian is bare-
  // chested so he carries `skin` and `topless`, the warrior wears the grey steel
  // that used to belong to the barbarian, and the mage is blue over light blue
  barbar: { name:'Barbarian', attr:{ str:14, dex:9,  int:6,  vit:11 }, arm:'#5f4328', paul:'#8d6b40', trim:'#c9a24a', crest:'#b03a3a', skin:'#c98f66', topless:true },
  war:    { name:'Warrior',   attr:{ str:11, dex:9,  int:6,  vit:14 }, arm:'#3e4a5c', paul:'#7e8ea4', trim:'#c8a45a', crest:'#a03a3a', skin:'#b8a27c' },
  rog:    { name:'Rogue',     attr:{ str:6,  dex:14, int:11, vit:9  }, arm:'#2e4636', paul:'#5f7a63', trim:'#9a8a55', crest:'#3f6a4a', skin:'#c2a98a' },
  mage:   { name:'Mage',      attr:{ str:9,  dex:11, int:14, vit:6  }, arm:'#3a6fbd', paul:'#85c7d9', trim:'#cfe8f5', crest:'#e6f2fb', skin:'#d8bb96' },
};

// ---------- Player ----------
// P is the LIVE player object — dynamic fields reset by resetPlayer() on (re)start.
const P = {
  r: 15, speed: 190, atkRange: 58, atkCd: 0.5, atkArc: 1.5,
  baseDmg: 12, baseHp: 120, manaMax: 100,
  x: 0, y: 0, aim: 0, walkPhase: 0, hurtT: -1, hurtFlash: 0,
  hp: 120, hpMax: 120, mana: 0,
  attr: { str: 8, dex: 8, int: 8, vit: 10 }, statPoints: 0, inv: [],
  xp: 0, xpNeed: 80, level: 1, gold: 0,
  atkT: 0, dead: false, leap: null, chill: 0, // the lich king's cold grasp (issue #69)
  idleT: 0, idleP: 0, idleAnim: -1, idleNext: -1,
  // fifteen idle seconds start one of three idle routines, and a routine
  // that has finished arms another five seconds later (issue #72)
  cd: { potion: 0, sk2: 0, sk3: 0 },
  eq: { weapon: null, helm: null, armor: null },
};

// ---------- Stan gry ----------
let mcp = 1; // current checkpoint (monster tiers / boss summons)
const game = {
  running: false, checkpoint: 1,
  time: 0, shake: 0,
  quota: 9, killedForQuota: 0, bossMode: false,
  spawnDelay: 1.2,
  monsters: [], projectiles: [], globes: [], goldpiles: [],
  drops: [], particles: [], texts: [], rings: [],
  bolts: [], // the lightning a chain bolt leaves between the foes it struck
  corpses: [], decals: [],
  walls: [], torches: [], grid: null, startPos: null,
  portal: null, boss: null, visited: null,
  chests: [],
  merchant: null, // wandering trader (issue #34)
  th: null, // the palette of the level you are standing in (issue #49)
  moveTarget: null, mouseDown: false, rmbDown: false, deathShown: false,
  totalKills: 0,
  demo: false, // spectator demo mode (issue #35)
  paused: false, // P freezes the whole simulation (issue #44)
  victoryOpen: false, victoryShown: false, // the tenth level's victory window (issue #51)
  bossSpot: null, bossPending: false, // the overlord waits by the portal (issue #57)
  throne: null, seat: 0, finalHall: null, // the thirteenth stage (issue #69)
};
function resetGame() {
  mcp = 1;
  Object.assign(game, {
    running: true, checkpoint: 1, time: 0, shake: 0,
    quota: 9, killedForQuota: 0, bossMode: false,
    spawnDelay: 1.2, portal: null, boss: null,
    moveTarget: null, mouseDown: false, rmbDown: false, deathShown: false,
    totalKills: 0,
    paused: false,
    victoryOpen: false, victoryShown: false,
    bossSpot: null, bossPending: false,
    throne: null, seat: 0, finalHall: null,
  });
  game.monsters = []; game.projectiles = []; game.globes = [];
  game.goldpiles = []; game.drops = []; game.particles = [];
  game.chests = [];
  game.texts = []; game.rings = []; game.bolts = [];
  game.decals = [];
}
function resetPlayer(cls) {
  const c = CLASSES[cls || 'barbar'];
  Object.assign(P, {
    x: WORLD.w / 2, y: WORLD.h - 200, aim: -Math.PI / 2, walkPhase: 0,
    hurtT: -1, hurtFlash: 0,
    hp: P.baseHp, hpMax: P.baseHp, mana: 0,
    cls: (cls && CLASSES[cls]) ? cls : 'barbar',
    attr: { str: c.attr.str, dex: c.attr.dex, int: c.attr.int, vit: c.attr.vit }, statPoints: 0, inv: [],
    xp: 0, xpNeed: 60,
    level: 1, gold: 0, atkT: 0, dead: false, leap: null, chill: 0,
    idleT: 0, idleP: 0, idleAnim: -1, idleNext: -1,
    cd: { potion: 0, sk2: 0, sk3: 0 },
    // a class always starts with its own tool already equipped (issue #65),
    // so the first swing of a fresh run is a swing with something
    eq: { weapon: startWeapon(cls), helm: null, armor: null },
  });
}

// ---------- Walls / level generation ----------
// ---------- LEVEL THEMES (issue #49) ----------
// every third level shifts the whole palette: the stones, the torchlight, the
// dark between them. Level ten is not a ruin at all but the Demon's Roost
// (the stone tones follow the muted primaries of ART_BIBLE.md)
const THEMES = [
  { name: 'Old Ruins', fb: 24, fv: 9, ft: [8, 3, -4], fm: 'rgba(92,84,66,0.55)',
    wf: '#191410', wt: '#39322a', we: 'rgba(120,102,74,0.2)', ws: 'rgba(150,132,98,0.22)',
    br: '#241b10', fl: 'rgba(255,188,74,0.92)', fc: 'rgba(255,242,190,0.92)',
    halo: '255,145,45', dark: 'rgba(4,3,8,0.87)', void: '#070503' },
  { name: 'Frozen Hollows', fb: 22, fv: 9, ft: [-6, 6, 16], fm: 'rgba(74,100,146,0.5)',
    wf: '#111621', wt: '#2b3446', we: 'rgba(122,142,196,0.2)', ws: 'rgba(162,182,226,0.24)',
    br: '#1a2230', fl: 'rgba(126,192,255,0.92)', fc: 'rgba(222,242,255,0.95)',
    halo: '104,168,255', dark: 'rgba(3,5,14,0.87)', void: '#05060b' },
  { name: 'Bone Flats', fb: 29, fv: 8, ft: [12, 9, 2], fm: 'rgba(150,140,116,0.5)',
    wf: '#221e17', wt: '#4a4436', we: 'rgba(172,158,118,0.22)', ws: 'rgba(196,180,132,0.26)',
    br: '#2c2417', fl: 'rgba(255,214,118,0.92)', fc: 'rgba(255,250,222,0.95)',
    halo: '255,192,88', dark: 'rgba(8,7,4,0.84)', void: '#0b0906' },
  { name: "The Demon's Roost", fb: 19, fv: 8, ft: [16, -2, -6], fm: 'rgba(158,52,40,0.5)',
    wf: '#160a08', wt: '#3b1b16', we: 'rgba(190,80,58,0.26)', ws: 'rgba(222,112,70,0.3)',
    br: '#2a110b', fl: 'rgba(255,120,58,0.95)', fc: 'rgba(255,224,130,0.95)',
    halo: '255,92,40', dark: 'rgba(12,3,3,0.86)', void: '#0b0403' },
];
// the thirteenth stage belongs to no realm: the lich king's throne room is
// bone-white stone, blood carpet and cold green candle flame (issue #69)
const FINAL_THEME = { name: 'The Lich Throne', fb: 20, fv: 7, ft: [-3, 4, -3], fm: 'rgba(96,102,94,0.4)',
    wf: '#15111a', wt: '#332c3c', we: 'rgba(148,140,168,0.22)', ws: 'rgba(190,178,200,0.26)',
    br: '#241f1c', fl: 'rgba(120,238,164,0.95)', fc: 'rgba(208,248,214,0.95)',
    halo: '96,224,150', dark: 'rgba(5,4,11,0.87)', void: '#08050c' };
function themeOf(cp) {
  if (cp >= FINAL_LEVEL) return FINAL_THEME;
  return THEMES[clamp(Math.floor((cp - 1) / 3), 0, THEMES.length - 1)];
}


function generateLevel(checkpoint) {
  mcp = checkpoint;
  const final = checkpoint === FINAL_LEVEL; // the throne room (issue #69)
  game.th = themeOf(checkpoint); // the palette this whole level is drawn in
  // the last hall has a quota of nothing: its only inhabitant is its king
  game.quota = final ? 0 : 6 + checkpoint * 3;
  game.killedForQuota = 0;
  game.bossMode = false;
  game.boss = null; // no overlord stands on a fresh level: he waits at the
  // portal and is woken by your approach (issue #57)
  game.bossSpot = null;
  game.bossPending = false;
  _seed = checkpoint * 7717 + 991;
  game.walls = [];
  game.torches = [];
  game.chests = [];
  game.corpses = []; game.decals = [];
  // tile grid: 1 = floor, 0 = wall; collision O(1), walls drawn per tile
  const grid = game.grid = new Uint8Array(GCOLS * GROWS);
  game.visited = new Uint8Array(GCOLS * GROWS); // fog of war for the M map
  const set = (tx, ty) => { if (tx >= 0 && tx < GCOLS && ty >= 0 && ty < GROWS) grid[ty * GCOLS + tx] = 1; };
  const G = (a, b) => hash2(a, b * 977 + checkpoint);
  // rooms
  const want = 9 + Math.min(checkpoint, 6);
  const rooms = [];
  for (let t = 0; t < 600 && rooms.length < want; t++) {
    const rw = 4 + Math.floor(G(t, 11) * 5);
    const rh = 4 + Math.floor(G(t, 23) * 4);
    const rx = 2 + Math.floor(G(t, 37) * (GCOLS - rw - 4));
    const ry = 2 + Math.floor(G(t, 53) * (GROWS - rh - 4));
    let ok = true;
    for (const r of rooms)
      if (rx < r.x + r.w + 1 && rx + rw > r.x - 1 && ry < r.y + r.h + 1 && ry + rh > r.y - 1) { ok = false; break; }
    if (ok) rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }
  if (rooms.length === 0) rooms.push({ x: (GCOLS >> 1) - 3, y: (GROWS >> 1) - 2, w: 6, h: 5 });
  for (const r of rooms)
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) set(tx, ty);
  // corridors 2 tiles wide: chain + extra links (loops)
  const cx = (r) => r.x + (r.w >> 1), cy = (r) => r.y + (r.h >> 1);
  const carveH = (ta, tb, ty) => {
    const a = Math.min(ta, tb), b = Math.max(ta, tb);
    for (let t = a; t <= b; t++) { set(t, ty); set(t, ty + 1); }
  };
  const carveV = (ta, tb, tx) => {
    const a = Math.min(ta, tb), b = Math.max(ta, tb);
    for (let t = a; t <= b; t++) { set(tx, t); set(tx + 1, t); }
  };
  const link = (a, b) => {
    const ra = rooms[a], rb = rooms[b];
    if (G(a * 31 + b, 7) > 0.5) { carveH(cx(ra), cx(rb), cy(ra)); carveV(cy(ra), cy(rb), cx(rb)); }
    else { carveV(cy(ra), cy(rb), cx(ra)); carveH(cx(ra), cx(rb), cy(rb)); }
  };
  for (let i = 0; i + 1 < rooms.length; i++) link(i, i + 1);
  for (let i = 0; i + 2 < rooms.length; i += 2) link(i, i + 2);
  // the tenth level is not a dungeon: it is the arena of the Demon's Roost,
  // one vast hall ringed by pillars so the big boss has room to run and the
  // hero has room to circle him (issue #49)
  const arena = checkpoint >= ROOST_HALL && !final; // the Roost's halls, issue #49
  if (arena) {
    const ax = 4, ay = 4, aw = GCOLS - 8, ah = GROWS - 8;
    for (let ty = ay; ty < ay + ah; ty++) for (let tx = ax; tx < ax + aw; tx++) set(tx, ty);
    for (let t2 = 0; t2 < 10; t2++) {
      const ptx = ax + 2 + Math.floor(G(t2, 131) * (aw - 5)), pty = ay + 2 + Math.floor(G(t2, 137) * (ah - 5));
      if (Math.hypot(ptx - (ax + aw / 2), pty - (ay + ah / 2)) < 5) continue; // keep the ring clear
      grid[pty * GCOLS + ptx] = 0;
      if (ptx + 1 < ax + aw) grid[pty * GCOLS + ptx + 1] = 0;
      if (pty + 1 < ay + ah) grid[(pty + 1) * GCOLS + ptx] = 0;
    }
    rooms.length = 0;
    rooms.push({ x: ax, y: ay, w: aw, h: ah });
  }
  // the thirteenth stage: one small square hall, walled on every side, its
  // axis running from the south gate up to the throne at the north end
  if (final) {
    for (let ty2 = 0; ty2 < GROWS; ty2++) for (let tx2 = 0; tx2 < GCOLS; tx2++) grid[ty2 * GCOLS + tx2] = 0;
    const fx = Math.floor((GCOLS - FINAL_HALL) / 2), fy = Math.floor((GROWS - FINAL_HALL) / 2);
    for (let ty2 = fy; ty2 < fy + FINAL_HALL; ty2++)
      for (let tx2 = fx; tx2 < fx + FINAL_HALL; tx2++) grid[ty2 * GCOLS + tx2] = 1;
    game.finalHall = { x: fx, y: fy, w: FINAL_HALL, h: FINAL_HALL };
    rooms.length = 0;
    rooms.push({ x: fx, y: fy, w: FINAL_HALL, h: FINAL_HALL });
  }
  // wall rects for drawing (culling in drawWalls keeps this cheap)
  for (let ty = 0; ty < GROWS; ty++) for (let tx = 0; tx < GCOLS; tx++)
    if (!grid[ty * GCOLS + tx]) game.walls.push({ x: tx * TS, y: ty * TS, w: TS, h: TS });
  // torches on south-facing wall faces above floor tiles
  if (!final) {
    for (let ty = 1; ty < GROWS - 1; ty++) for (let tx = 1; tx < GCOLS - 1; tx++) {
      if (!grid[ty * GCOLS + tx]) continue;
      if (!grid[(ty - 1) * GCOLS + tx] && ((tx + ty) & 1) === 0 && G(tx * 13, ty * 17) < 0.55)
        game.torches.push({ x: tx * TS + TS / 2, y: ty * TS + 12, ph: G(tx, ty) * TAU });
    }
  } else {
    // candlesticks: a file down each wall and two files down the carpet, so the
    // hall reads as a gothic throne room rather than as another dungeon (issue
    // #69). They are ordinary light-carriers, so lightPass keeps them lit.
    const hl = game.finalHall, ax2 = hl.x, ay2 = hl.y;
    for (let ty2 = ay2 + 1; ty2 < ay2 + hl.h - 1; ty2 += 2) for (const tx2 of [ax2 + 1, ax2 + hl.w - 2])
      game.torches.push({ x: tx2 * TS + TS / 2, y: ty2 * TS + TS / 2, candle: true, ph: G(tx2, ty2) * TAU });
    for (let ty2 = ay2 + 3; ty2 < ay2 + hl.h - 2; ty2 += 3) for (const tx2 of [ax2 + (hl.w >> 1) - 2, ax2 + (hl.w >> 1) + 2])
      game.torches.push({ x: tx2 * TS + TS / 2, y: ty2 * TS + TS / 2, candle: true, ph: G(tx2, ty2) * TAU });
  }
  // start room, the portal's far end, and the ground where the overlord waits
  // (issue #57: no boss is placed on the level - he steps out when you come
  // close enough for the WHOLE gate to sit inside his torchlight (issue #68
  // set that range), so the spot is held, not a body)
  if (final) {
    const hl = game.finalHall, hx = hl.x + hl.w / 2;
    game.startPos = { x: hx * TS, y: (hl.y + hl.h - 2.5) * TS }; // the south gate
    P.x = game.startPos.x; P.y = game.startPos.y;
    // the last stage has no gate to descend through: the throne IS the prize, so
    // there is nothing for the level to hold as a portal
    game.portal = null;
    game.throne = { x: hx * TS, y: (hl.y + 1.4) * TS, sx: hx * TS, sy: (hl.y + 1.9) * TS,
      active: false, t: 0, gr: 34 }; // gr: how close he has to get to be seated
    // the king is already in the room, asleep at the head of the carpet, and he
    // is stirred by light: his whole model has to fit inside the hero's torch
    // light before he comes down (issue #69, the same construction the gate
    // learned in issue #68)
    spawnBoss(hx * TS, (hl.y + hl.h * 0.52) * TS, FINAL_BOSS_BIG);
    game.boss.act = false;
    game.boss.aggro = PLAYER_LIGHT - game.boss.r; // wholly inside the light around him
    game.bossMode = true;
    game.bossPending = false; // he is waiting in the hall, not held off a gate
  } else if (arena) {
    const r0 = rooms[0];
    game.startPos = { x: (r0.x + r0.w / 2) * TS, y: (r0.y + r0.h - 2.5) * TS }; // the south gate
    game.portal = { x: (r0.x + r0.w / 2) * TS, y: (r0.y + 2) * TS, t: 0 };      // the north gate
    P.x = game.startPos.x; P.y = game.startPos.y;
    game.bossSpot = { x: (r0.x + r0.w / 2) * TS, y: (r0.y + 5) * TS, big: 1.55 };
    game.bossPending = true;
  } else {
  const s0 = rooms[0];
  game.startPos = { x: (cx(s0) + 1) * TS, y: (cy(s0) + 1) * TS };
  let far = s0, fd = -1;
  for (const r of rooms) {
    const d = Math.hypot(cx(r) - cx(s0), cy(r) - cy(s0));
    if (d > fd) { fd = d; far = r; }
  }
  const bx = (cx(far) + 1) * TS, by = (cy(far) + 1) * TS;
  const away = Math.atan2(cy(far) - cy(s0), cx(far) - cx(s0));
  let ppx = bx + Math.cos(away) * 84, ppy = by + Math.sin(away) * 84;
  if (solidAt(ppx, ppy, 26)) { ppx = bx; ppy = by; }
  game.portal = { x: ppx, y: ppy, t: 0 };
  // the overlord stands between his portal and the approach, ready to come at
  // you the moment you are close enough to see the gate
  let bxs = bx - Math.cos(away) * 100, bys = by - Math.sin(away) * 100;
  if (solidAt(bxs, bys, 30)) { bxs = bx; bys = by; }
  P.x = game.startPos.x; P.y = game.startPos.y;
  game.bossSpot = { x: bxs, y: bys, big: 1 };
  game.bossPending = true;
  }
  // treasure chests (issue #19): sparse — a guaranteed one, sometimes a second,
  // never in the start room, rolled to hold a magic item
  const tryChest = () => {
    for (let t2 = 0; t2 < 20; t2++) {
      const r = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
      if (!r) continue;
      const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
      const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
      const wx = tx * TS + TS / 2, wy = ty * TS + TS / 2;
      if (solidAt(wx, wy, 20)) continue;
      if (Math.hypot(wx - game.startPos.x, wy - game.startPos.y) < 260) continue;
      if (game.portal && Math.hypot(wx - game.portal.x, wy - game.portal.y) < 80) continue;
      for (const oc of game.chests) if (Math.hypot(wx - oc.x, wy - oc.y) < 120) return;
      game.chests.push({ x: wx, y: wy, item: rollChestItem(checkpoint), open: false });
      return;
    }
  };
  if (rooms.length > 1) { tryChest(); if (chance(0.35)) tryChest(); }
  // merchant: one trader per level, in a random room away from the start
  game.merchant = null;
  if (!final) for (let t2 = 0; t2 < 20; t2++) {
    const r = rooms[Math.floor(Math.random() * rooms.length)];
    if (!r) continue;
    const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
    const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
    const wx = tx * TS + TS / 2, wy = ty * TS + TS / 2;
    if (solidAt(wx, wy, 26)) continue;
    if (Math.hypot(wx - game.startPos.x, wy - game.startPos.y) < 320) continue;
    if (game.portal && Math.hypot(wx - game.portal.x, wy - game.portal.y) < 80) continue;
    game.merchant = mkMerchant(wx, wy);
    break;
  }
}

function solidAt(x, y, r) {
  const grid = game.grid;
  if (!grid) return null;
  const tx0 = Math.floor((x - r) / TS), tx1 = Math.floor((x + r) / TS);
  const ty0 = Math.floor((y - r) / TS), ty1 = Math.floor((y + r) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (tx < 0 || tx >= GCOLS || ty < 0 || ty >= GROWS || !grid[ty * GCOLS + tx])
      return { x: tx * TS, y: ty * TS, w: TS, h: TS };
  }
  return null;
}
function moveWithCollide(e, dx, dy) {
  // separate axes — slide along walls
  let nx = e.x + dx;
  if (!solidAt(nx, e.y, e.r)) e.x = nx;
  let ny = e.y + dy;
  if (!solidAt(e.x, ny, e.r)) e.y = ny;
  e.x = clamp(e.x, 40, WORLD.w - 40);
  e.y = clamp(e.y, 40, WORLD.h - 40);
}

// ---------- MONSTERS ----------
const MTYPES = {
  // distinct archetypes (issue #31): goblins swarm fast but shatter,
  // zombies shamble in heavily, skeletons are scuttling glass cannons,
  // orcs hit hard and slow, shamans cast from the back
  fallen:   { name:'Goblin', hp:22, dmg:6, speed:150, r:13, color:'#5d8f3a', xp:8, touchCd:0.7, ai:'melee' },
  archer:   { name:'Goblin Archer', hp:20, dmg:8, speed:105, r:13, color:'#3f7f4f', xp:11, touchCd:1.4, ai:'ranged', range:340 },
  zombie:   { name:'Zombie', hp:95, dmg:10, speed:50, r:17, color:'#6b7252', xp:15, touchCd:1.4, ai:'melee' },
  skeleton: { name:'Skeleton', hp:34, dmg:12, speed:135, r:14, color:'#c8c2ae', xp:14, touchCd:1.0, ai:'melee' },
  orc:      { name:'Orc Brute', hp:110, dmg:16, speed:66, r:18, color:'#4f6a30', xp:24, touchCd:1.6, ai:'melee' },
  cultist:  { name:'Orc Shaman', hp:40, dmg:13, speed:72, r:14, color:'#6a5a4a', xp:17, touchCd:1.5, ai:'ranged', range:420 },
};
// the run is thirteen stages deep (issue #69): four realms of three levels each,
// the pillar-ringed halls of the Roost at ten to twelve, and the thirteenth
// stage is the lich king's throne room, which has no portal in it at all - the
// throne there is the prize, and sitting on it ends the run
const FINAL_LEVEL = 13;
const ROOST_HALL = 10;    // where the Roost's vast halls begin (issue #49), now three levels deep
const FINAL_HALL = 15;    // the throne room's floor, in tiles: one small square
const FINAL_BOSS_BIG = 2; // the lich king's model, against the other overlords'
// one overlord per level (issue #51): ten named bosses, each with its own
// nameplate, silhouette signature and character. mtier() still scales them by
// depth, and the table itself only ramps gently - a couple of hundred life and
// one point of damage per level - because the hero is growing too: levels,
// attribute points and the loot ladder of issue #50 all climb with the descent.
// The names follow the themes: goblins and orcs in the Old Ruins, frost in the
// Frozen Hollows, bone in the Bone Flats, the demon overlord in the Roost.
const BOSSES = [
  { name:'Goruk — Goblin Warboss',    hp:560,  dmg:16, speed:92, r:27, color:'#b03a3a', xp:230, touchCd:0.8, ai:'boss', sig:0 },
  { name:'Kragg — Iron Juggernaut',   hp:610,  dmg:17, speed:70, r:30, color:'#7d4a2c', xp:290, touchCd:1.7, ai:'boss', sig:1 },
  { name:'Ugruk — Lord of the Bone Pits', hp:640, dmg:18, speed:86, r:28, color:'#8a5a3a', xp:350, touchCd:1.1, ai:'boss', sig:2 },
  { name:'Vessara — The Frostweaver',  hp:660,  dmg:19, speed:96, r:27, color:'#4f7f9a', xp:420, touchCd:1.2, ai:'boss', sig:3 },
  { name:'Kryon — Winterbound Colossus', hp:700, dmg:20, speed:64, r:33, color:'#3f6f8a', xp:500, touchCd:1.9, ai:'boss', sig:4 },
  { name:'Hrolfr — The Icebreaker',    hp:700,  dmg:20, speed:78, r:30, color:'#5d87a0', xp:580, touchCd:1.5, ai:'boss', sig:5 },
  { name:'Sessith — Oracle of the Flats', hp:720, dmg:21, speed:88, r:27, color:'#b0a688', xp:660, touchCd:1.3, ai:'boss', sig:6 },
  { name:'Tharkas — Dune Reaver',      hp:740,  dmg:22, speed:104, r:28, color:'#a0874f', xp:750, touchCd:0.9, ai:'boss', sig:7 },
  { name:'Vomir — Carrion King',       hp:760,  dmg:23, speed:80, r:31, color:'#8f7a5a', xp:840, touchCd:1.6, ai:'boss', sig:8 },
  { name:'Vermithe the Undying — Overlord of the Roost', hp:770, dmg:23, speed:84, r:32, color:'#c2482e', xp:950, touchCd:1.4, ai:'boss', sig:9 },
  { name:'Kazrek the Withered — Flayed Overlord', hp:780, dmg:24, speed:86, r:31, color:'#8a6a58', xp:1040, touchCd:1.5, ai:'boss', sig:10 },
  { name:'Ur-Thul the Bone Crown — Warden of the Roost', hp:800, dmg:25, speed:80, r:33, color:'#6f5a4a', xp:1140, touchCd:1.7, ai:'boss', sig:11 },
  // the last man: a lich king, and a far wider model than any overlord before
  // him. His own three hands are the grave chorus, the cold grasp and the
  // overlord's charge (issue #69); `lich` is what hands them to him.
  { name:'Adrith the Lich King — the Last Throne', hp:620, dmg:18, speed:74, r:33, color:'#9fb4a8', xp:1300, touchCd:1.6, ai:'boss', sig:12, lich: true },
];

function mtier(base, cp) {
  const s = 1 + (cp-1)*0.16;
  return {
    ...base,
    hp: Math.round(base.hp*s),
    dmg: Math.round(base.dmg*(1+(cp-1)*0.10)),
    xp: Math.round(base.xp*(1+(cp-1)*0.3)),
  };
}

function spawnMonster(type, x, y, elite, cp) {
  const d = mtier(MTYPES[type], cp);
  if (elite) { d.hp*=2.6; d.dmg=Math.round(d.dmg*1.4); d.xp*=4; d.r+=4; }
  const m = {
    kind:'monster', type, name: (elite?'Elite: ':'')+d.name, x, y,
    r: d.r, hp: d.hp, hpMax: d.hp, dmg: d.dmg, speed: d.speed*(0.85+Math.random()*0.3),
    xp: d.xp, color: elite?'#d8a23c':d.color, touchCd: d.touchCd, cd: rand(0.4,1.2),
    ai: d.ai, range: d.range || (d.r + 27), elite: !!elite, angle: rand(0,TAU),
    hitFlash: 0, slow: 0, wob: rand(0,TAU), stun: 0, kx: 0, ky: 0,
    // the dose a rogue's arrowhead leaves behind (issue #73): secs left,
    // the countdown to the next tick, and what the dose still has to give
    poison: 0, poisonClock: 1, poisonLeft: 0, poisonTicks: 0,
    act: true, aggro: (d.ai === 'ranged' ? 380 : 310) + (elite ? 70 : 0),
    homeX: x, homeY: y, leash: 0, leashT: 0, // chase leash (issue #29)
  };
  game.monsters.push(m);
  if (elite) { S.elite(); ring(x,y,'#d8a23c'); }
  return m;
}

function findSpawnPoint() {
  for (let i=0;i<80;i++){
    const x = rand(80, WORLD.w-80), y = rand(80, WORLD.h-80);
    if (solidAt(x, y, 12)) continue;
    if (Math.hypot(x - P.x, y - P.y) < 480) continue;
    if (game.portal && Math.hypot(x - game.portal.x, y - game.portal.y) < 260) continue;
    return {x,y};
  }
  return {x: rand(80,WORLD.w-80), y: 80};
}

function pickTypeFor(cp) {
  const pool = ['fallen','fallen','zombie','skeleton'];
  if (cp>=2) pool.push('archer','zombie','orc');
  if (cp>=3) pool.push('skeleton','cultist','orc');
  if (cp>=4) pool.push('cultist','archer','skeleton','orc');
  return pick(pool);
}

// Diable-style: pre-place ALL monsters across the whole map; they sleep
// (idle in place) until the player enters their aggro radius (see wake gate
// in the monster update loop, which checks m.act / m.aggro).
function preplaceMonsters() {
  const cp = game.checkpoint;
  if (cp === FINAL_LEVEL) return; // one king, and nothing else, in the last hall
  const total = game.quota + Math.ceil(game.quota * 0.6) + 3;
  let placed = 0, tries = 0;
  while (placed < total && tries < 2500) {
    tries++;
    const x = rand(95, WORLD.w - 95), y = rand(95, WORLD.h - 95);
    if (solidAt(x, y, 14)) continue;
    if (Math.hypot(x - P.x, y - P.y) < 520) continue;
    if (game.portal && Math.hypot(x - game.portal.x, y - game.portal.y) < 260) continue;
    let ok = true;
    for (const m of game.monsters)
      if (Math.hypot(m.x - x, m.y - y) < 120) { ok = false; break; }
    if (!ok) continue;
    const elite = chance(Math.min(0.05 + cp * 0.015, 0.2));
    const mm = spawnMonster(pickTypeFor(cp), x, y, elite, cp);
    mm.act = false;
    placed++;
  }
}

// the overlord is not walking the halls: he waits unseen at his portal and
// steps out when the hero brings the WHOLE gate inside his torchlight (issue
// #68 replaced the old half-sight rule), then comes straight at you. Only then
// can the gate open.
function wakeBoss() {
  if (!game.bossPending || !game.bossSpot || !game.portal) return false;
  // he is stirred by light, not by distance: the gate has to sit wholly inside
  // the hero's torchlight, so spotting a clipped edge of it leaves him asleep
  // in the dark and gives the hero room to back off and prepare (issue #68)
  if (Math.hypot(P.x - game.portal.x, P.y - game.portal.y) > BOSS_WAKE_R) return false;
  if (P.dead) return false;
  const s = game.bossSpot;
  spawnBoss(s.x, s.y, s.big);
  // he comes out ASLEEP, so the game's own awakening (the roar, the banner,
  // the exclamation) plays on the next frame exactly as it does for a foe the
  // hero has walked into sight
  game.boss.act = false;
  game.bossPending = false;
  game.bossMode = true;
  game.shake = 10; S.elite();
  banner(game.boss.name, '#c84a3a');
  toast('The overlord steps out of the portal dark - slay him to open the gate', '');
  return true;
}

// the throne at the head of the carpet: dim while the lich king stands,
// cold-lit once he is down. Touching the awake throne is how the run is won.
function throneTouch() {
  const tr = game.throne;
  if (!tr || !tr.active || game.seat > 0 || game.victoryShown) return false;
  if (P.dead || game.paused) return false;
  if (Math.hypot(P.x - tr.sx, P.y - tr.sy) > tr.gr) return false;
  game.seat = 0.001;
  P.x = tr.sx; P.y = tr.sy; // he is held on the seat
  game.moveTarget = null;
  toast('Sit down — the throne is yours', '');
  return true;
}

function spawnBoss(x, y, big) {
  if (x == null) { const p = findSpawnPoint(); x = p.x; y = p.y; }
  // the overlord of the level you are standing in (issue #51): each level has
  // its own man, and past the tenth the Roost's overlord keeps coming back
  const bi = clamp(Math.floor(game.checkpoint) - 1, 0, BOSSES.length - 1);
  const d = mtier(BOSSES[bi], game.checkpoint);
  // the tenth level's boss is bred big: wider shoulders, a thicker hide, a
  // heavier hand (issue #49)
  const g = big || 1;
  const b = {
    kind:'boss', type:'boss', name: d.name, sig: BOSSES[bi].sig, x, y, r: Math.round(d.r * g),
    hp: Math.round(d.hp * (1 + (g - 1) * 1.5)), hpMax: Math.round(d.hp * (1 + (g - 1) * 1.5)),
    dmg: Math.round(d.dmg * (1 + (g - 1) * 0.8)),
    // slower bosses (issue #46): a warboss never out-runs a running hero,
    // however deep the dungeon has scaled him
    speed: Math.min(d.speed, 152), xp: Math.round(d.xp * (1 + (g - 1) * 1.2)), color: d.color,
    touchCd: d.touchCd, cd: 1, ai: 'boss', range: Math.round(d.r * g) + P.r + 6, elite: false,
    angle: 0, hitFlash: 0, slow: 0, wob: 0, dashCd: 2.5, summonCd: 5, stun: 0, kx: 0, ky: 0,
    poison: 0, poisonClock: 1, poisonLeft: 0, poisonTicks: 0,
    act: false, aggro: 460, // waits in the boss room until the player steps near
    lich: BOSSES[bi].lich === true, graveCd: 6.5, graspCd: 4.2, // the lich king's hands (issue #69)
    homeX: x, homeY: y, leash: 0, leashT: 0, // his throne: bosses leash like any foe (issue #46)
  };
  game.boss = b; game.monsters.push(b);
  return b;
}

// ---------- FX / ENTITIES ----------
function ring(x, y, color) { game.rings.push({x,y,r:8,max:90,color,life:0.5}); }
// a shot landing: a tight, quick ring plus a handful of spittle, so the hit
// reads on the dark without looking like a full spell burst (issue #62)
function splash(x, y, color) {
  game.rings.push({ x, y, r: 2, max: 30, grow: 110, color, life: 0.26 });
  burst(x, y, color, 7, 150);
}
function banner(text, color) {
  const b = document.getElementById('checkpointBanner');
  b.textContent = text; b.style.color = color || '#e8d8a0';
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(banner._t);
  banner._t = setTimeout(()=>b.classList.add('hidden'), 3200);
}
function dmgText(x, y, text, color) { game.texts.push({x,y:y-10,vy:-46,life:0.9,text,color}); }
function burst(x, y, color, n, spd) {
  for (let i=0;i<n;i++){
    const a = rand(0,TAU), s = rand(40, spd||180);
    game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(0.25,0.6),color,size:rand(1.5,3.5)});
  }
}
// a bolt of lightning down a line: the kinks are thrown when the bolt is born,
// so the bolt keeps its own shape for the whole of its short life rather than
// shivering every frame. Every segment carries its ends, which is what lets the
// bar and the light pass agree where the strike actually was (issue #71)
function boltFx(x1, y1, x2, y2, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy) || 1;
  const px = -dy / d, py = dx / d; // the perpendicular: this is which way a kink jogs
  const steps = clamp(Math.round(d / 22), 2, 14);
  const pts = [{ x: x1, y: y1 }];
  for (let k2 = 1; k2 < steps; k2++) {
    const t = k2 / steps;
    const jog = (k2 % 2 ? 1 : -1) * rand(4, 13) * (1 - Math.abs(t - 0.5) * 0.9);
    pts.push({ x: x1 + dx * t + px * jog, y: y1 + dy * t + py * jog });
  }
  pts.push({ x: x2, y: y2 });
  game.bolts.push({ pts, color, life: 0.26, max: 0.26 });
  if (game.bolts.length > 40) game.bolts.splice(0, game.bolts.length - 40);
}
// the same polyline on the canvas, wherever the camera currently stands
function boltTrail(b) {
  ctx.beginPath();
  ctx.moveTo(b.pts[0].x - vx, b.pts[0].y - vy);
  for (let k2 = 1; k2 < b.pts.length; k2++) ctx.lineTo(b.pts[k2].x - vx, b.pts[k2].y - vy);
  ctx.stroke();
}
function blood(x,y){ burst(x,y,'#8a1f1f',10,150); }

// globes: xp (green), heal (red), mana (blue)
// globes dropped on kill: red heal + blue mana only (issue #33: XP is no
// longer a pickup — it lands on the player card the moment the kill lands)
function dropGlobes(x, y) {
  if (chance(0.3))
    game.globes.push({type:'heal', val:0, life:13, x:x+rand(-14,14), y:y+rand(-14,14), vx:rand(-40,40), vy:rand(-40,40), r:7, color:'#e03535'});
  if (chance(0.35))
    game.globes.push({type:'mana', val:0, life:13, x:x+rand(-14,14), y:y+rand(-14,14), vx:rand(-40,40), vy:rand(-40,40), r:6, color:'#3a7ae0'});
}

function dropGold(x, y, cp) {
  const amount = randInt(4, 12) * cp;
  game.goldpiles.push({x, y, amount, r:8, life:26, bob:rand(0,TAU)});
}

// ---------- ITEMS ----------
// rarity table (issue #50): the odds fall away EXPONENTIALLY, roughly 100 :
// 22 : 5.5 : 1.4. Most drops are plain goods, a magic item is a treat, a rare
// one a rarity and a legendary a special occasion you hear the bell for.
const RARITY = [
  { id:'common',  name:'',        w:78,   mult:1.0,  afx:0 },
  { id:'magic',   name:'Magic',    w:17,   mult:1.5,  afx:1 },
  { id:'rare',    name:'Rare',     w:4.4,  mult:2.2,  afx:2 },
  { id:'legend',  name:'Legendary',w:1.15, mult:3.4,  afx:3 },
];
// luck (issue #50): a higher level, a deeper dungeon and a bigger enemy all
// hand the roll more of it, and it bends the exponential curve instead of
// adding flat odds - tier i's share is multiplied by pow(this growth, luck *
// i), so luck pays far more for the top rungs than for the common bottom one
const RARI_LUCK_GROWTH = 1.62;
const RARI_LUCK_MAX = 2.4; // the ceiling a level-40 veteran in level 10 reaches
// rarity roll (issue #36): odds strictly descend common -> magic -> rare ->
// legendary, and a `luck` bonus lifts the share of the better tiers. `minTier`
// skips the weak tiers outright, so a chest is magic-or-better, never common
function rarityRoll(luck, minTier) {
  const w = [];
  let tot = 0;
  const lk = clamp(luck || 0, 0, RARI_LUCK_MAX);
  for (let i = minTier; i < RARITY.length; i++) {
    const boost = Math.pow(RARI_LUCK_GROWTH, lk * i);
    w.push(RARITY[i].w * boost);
    tot += w[w.length - 1];
  }
  let roll = rand(0, tot);
  for (let i = 0; i < w.length; i++) { if (roll < w[i]) return RARITY[minTier + i]; roll -= w[i]; }
  return RARITY[RARITY.length - 1];
}
// bonus values (issue #36): min..max on an exponential curve, so the top of
// the range is far rarer than the bottom — past half the range gets scarce
function rollBonus(min, max, curve, luck) {
  // exponential curve first (a sample of rand^curve sits low in the range
  // most of the time), then luck slides the WHOLE sample up it (issue #50):
  // the head-room left above the sample is divided by pow(1+luck, 0.75).
  // luck 0 is the novice's roll, where the top third of an affix is all but
  // unreachable; a veteran deep down lands in it often.
  const u = Math.pow(rand(0, 1), curve);
  const lk = luck > 0 ? Math.min(luck, RARI_LUCK_MAX) : 0;
  const up = lk > 0 ? 1 - (1 - u) / Math.pow(1 + lk, 0.75) : u;
  return Math.max(min, Math.round(min + (max - min) * up));
}
const SLOTS = ['weapon','helm','armor'];
// how lucky a roll is (issue #50): ONE ladder feeds both the rarity tier and
// the size of every bonus. A level-1 novice in the first ruins rolls ~0, a
// level-30 veteran two levels from the arena rolls ~1.6, and the caller adds
// the enemy's rank on top (elites nudge, bosses nudge hard).
function fortune(luck, cp) {
  return clamp((luck || 0) + P.level * 0.025 + (cp - 1) * 0.08, 0, RARI_LUCK_MAX);
}
const INV_CAP = 20; // backpack slots (issue #30)
// weapon types (issue #53): a kind decides BOTH the attribute it scales with
// and how the hero uses it - the axe and the sword swing, the bow and the staff
// never touch a foe, they shoot arrows and magic missiles.
const WTYPE = [
  { k:'sword', name:'Sword', dmg:[6, 10], attr:'dex', melee: true  },
  { k:'axe',   name:'Axe',   dmg:[8, 13], attr:'str', melee: true  },
  { k:'bow',   name:'Bow',   dmg:[5, 9],  attr:'dex', melee: false },
  { k:'staff', name:'Staff', dmg:[6, 11], attr:'int', melee: false },
];
// ---------- the kit a class starts the run with (issue #65) ----------
// the hand each class fights with, in the same keys the class buttons use
const START_WKIND = { barbar: 'axe', war: 'sword', rog: 'bow', mage: 'staff' };
// a plain tool, not a roll: the kind's own damage at its LOW end, one flat
// stat, no scaling bonus and no affix behind it. The run has to start able
// to fight, and it must not start holding a lucky draw (issue #65)
function startWeapon(cls) {
  const k = START_WKIND[(cls && CLASSES[cls]) ? cls : 'barbar'];
  const wt = WTYPE.filter((w) => w.k === k)[0];
  const v = wt.dmg[0];
  const stats = [{ k: 'dmg', v, txt: 'Damage: +' + v }];
  return { slot: 'weapon', name: wt.name, rarity: 'common', wk: wt.k, cp: 1,
    stats, score: v * 2.2 }; // 2.2 is the weight rollItem lends a flat damage line
}

const BASES = {
  weapon: null, // a weapon is rolled from WTYPE, not from here
  helm:   { name:'Helm',  hp:[14,22] },
  armor:  { name:'Armour', hp:[24,36] },
};
// bonus-linked naming (issue #26): prefixes/suffixes tied to the bonus kinds
// affix flavour words, three tiers per bonus kind sorted weakest -> strongest
// (issue #40); the tier follows where the rolled value lands inside the kind's
// limit (see BONUS_LIM below)
const NSUF = {
  dmg:  ['of Slaying', 'of the Butcher', 'of Carnage'],
  hp:   ['of Life', 'of the Lifeward', 'of Vigour'],
  mp:   ['of the Mana', 'of the Mana Well', 'of Deep Mana'],
  crit: ['of the Lucky Blade', 'of the Sharp Edge', 'of the Assassin'],
  spd:  ['of the Wind', 'of the Gale', 'of the Storm'],
  str:  ['of the Bear', 'of the Gorilla', 'of the Mountain'],
  dex:  ['of the Cat', 'of the Falcon', 'of the Panther'],
  int:  ['of the Owl', 'of the Sage', 'of the Arcane Mind'],
  vit:  ['of the Ox', 'of the Boar', 'of the Mammoth'],
};
const NPRE = {
  dmg:  ['Sharp', 'Savage', 'Cruel'], hp: ['Sturdy', 'Ironclad', 'Bulwarking'],
  mp:   ['Arcane', 'Mystic', 'Runed'], crit: ['Keen', 'Tricky', 'Deadly'],
  spd:  ['Swift', 'Fleet', 'Thunderfoot'],
  str:  ['Strong', 'Brawny', 'Colossal'], dex: ['Agile', 'Wiry', 'Lithesome'],
  int:  ['Clever', 'Wise', 'Brilliant'], vit: ['Hardy', 'Robust', 'Vigorous'],
};
// per-bonus roll limits (issue #40): lo..hi at the first checkpoint, hi
// growing by `grow` per checkpoint deeper; every kind rolls on the same steep
// curve, so the top third of a range is scarce and the word tier is read off
// where the value lands: <= 33% weakest affix, <= 66% middle, above that the
// strongest
const BONUS_LIM = {
  dmg:  { lo: 1, hi: 9,  grow: 2, curve: 2.4 },
  hp:   { lo: 1, hi: 26, grow: 6, curve: 2.4 },
  mp:   { lo: 1, hi: 32, grow: 7, curve: 2.4 },
  crit: { lo: 1, hi: 10, grow: 1, curve: 2.4 },
  spd:  { lo: 1, hi: 24, grow: 3, curve: 2.4 },
  str:  { lo: 1, hi: 8,  grow: 1, curve: 2.4 },
  dex:  { lo: 1, hi: 8,  grow: 1, curve: 2.4 },
  int:  { lo: 1, hi: 8,  grow: 1, curve: 2.4 },
  vit:  { lo: 1, hi: 8,  grow: 1, curve: 2.4 },
};
// the bonus-kind word for a value: which third of the kind's limit it hit
function bonusTier(k, v, cap) {
  const L = BONUS_LIM[k];
  const hi = cap || (L ? L.hi : 1);
  if (v <= hi / 3) return 0;
  if (v <= (hi * 2) / 3) return 1;
  return 2;
}
const NLEG = ['The ', 'Grand ', 'Ancient ', 'Forgotten ', 'Glorious ',
  'Cursed ',];
const BONUSK = ['dmg', 'hp', 'mp', 'crit', 'spd', 'str', 'dex', 'int', 'vit'];
// dmg/life/mana/crit/move-speed + direct attribute bonuses (issue #25)

function rollItem(cp, forceGood, forceRar, luck) {
  // forceGood = magic-or-better; `luck` is the caller's bonus (enemy rank) on
  // top of the player-level and checkpoint ladders (issue #36/#50). The same
  // fortune bends the rarity tier AND every bonus value, so a veteran's drops
  // are rarer in kind and fatter in size
  const fl = fortune(luck, cp);
  let rar;
  if (forceRar) { for (const r of RARITY) if (r.id === forceRar) { rar = r; break; } }
  else rar = rarityRoll(fl, forceGood ? 1 : 0);
  const slot = pick(SLOTS);
  const wk = slot === 'weapon' ? pick(WTYPE) : null; // weapon kind (issue #53)
  const b = slot === 'weapon' ? { name: wk.name, dmg: wk.dmg } : BASES[slot];
  const scale = 1 + (cp-1)*0.3;
  const stats = [];
  let wscale = null;
  if (slot==='weapon') {
    wscale = wk.attr; // the kind decides its attribute (issue #53)
    // scaling %: 1..200 on a steep exponential curve (issue #36) — past 100
    // is quite rare, past 150 a once-in-a-long-run roll
    const pct = rollBonus(1, 200, 4.2, fl);
    const v = Math.round(rand(b.dmg[0], b.dmg[1]) * scale * rar.mult);
    stats.push({k:'dmg', v, scale: wscale, pct,
      txt: 'Damage: +' + v + ' (+' + pct + '% ' + ATTRPL[wscale] + ')'});
  } else {
    const v = Math.round(rand(b.hp[0], b.hp[1]) * scale * rar.mult);
    stats.push({k:'hp', v, txt:'Life: +'+v});
  }
  for (let i=0;i<rar.afx;i++){
    // a bonus kind (dmg/hp) may appear on an item at most once; affixes can
    // also roll mana, critical chance, movement speed and attributes
    const pool = BONUSK.filter(k => !stats.some(st => st.k === k));
    if (!pool.length) break;
    const kind = pick(pool);
    // every bonus rolls inside its own limit (issue #40), steep curve first
    const L = BONUS_LIM[kind];
    const cap = L.hi + (cp - 1) * L.grow;
    const v = rollBonus(L.lo, cap, L.curve, fl);
    let tx;
    if (kind === 'dmg') tx = 'Damage: +' + v;
    else if (kind === 'hp') tx = 'Life: +' + v;
    else if (kind === 'mp') tx = 'Mana: +' + v;
    else if (kind === 'crit') tx = 'Critical Chance: +' + v + '%';
    else if (kind === 'spd') tx = 'Movement Speed: +' + v + '%';
    else tx = ATTRPL[kind] + ': +' + v;
    stats.push({k: kind, v, cap, txt: tx});
  }
  // naming (issue #26/#39): the bonuses themselves decide the name, and each
  // bonus contributes ONE affix only — the first bonus lends its prefix, every
  // later bonus lends its 'of X' suffix (never both for the same bonus)
  const bonuses = stats.slice(1);
  let nm = (rar.id === 'legend' ? pick(NLEG) : '');
  // one affix per bonus (issue #39/#40): the first bonus lends only its prefix,
  // the rest only their 'of X' suffix — and the word itself is picked by where
  // the value landed inside that kind's limit (issue #40)
  if (bonuses.length)
    nm += NPRE[bonuses[0].k][bonusTier(bonuses[0].k, bonuses[0].v, bonuses[0].cap)] + ' ';
  nm += b.name;
  for (let bi = 1; bi < bonuses.length; bi++) {
    const st = bonuses[bi];
    nm += ' ' + NSUF[st.k][bonusTier(st.k, st.v, st.cap)];
  }
  // score counts the scaling bonus at an assumed average attribute (~11):
  // bonus dmg ≈ pct × 11 / 100
  // score weights each bonus kind; scaling bonus valued at an assumed attribute (~11)
  const W8 = { dmg: 2.2, hp: 1, mp: 0.45, crit: 2.4, spd: 1.4, str: 1.8, dex: 1.8, int: 1.8, vit: 1.8 };
  const score = stats.reduce((s, st) =>
    s + (st.k === 'dmg' ? (st.v + (st.pct || 0) * 0.11) : st.v) * (W8[st.k] || 1), 0);
  return { slot, name:nm, rarity:rar.id, stats, score, cp, wk: wk ? wk.k : null };
}
// treasure chests roll at-least-magic (issue #36), never common: the minTier
// floor plus a small luck so a chest sometimes hides a rare or legendary
function rollChestItem(cp) { return rollItem(cp, true, null, 0.12); }

// enemy drops roll rarity with an enemy-rank bonus on top (issue #50): an
// ordinary corpse rolls at the hero's own odds, an elite nudges the roll
// slightly and a boss nudges it hard, so a boss is the usual source of rare
// and legendary gear
function dropItem(x, y, cp, guarantee, rank) {
  const luck = rank === 'boss' ? 0.45 : rank === 'elite' ? 0.2 : 0;
  const it = rollItem(cp, guarantee || chance(0.14 + cp * 0.01), null, luck);
  game.drops.push({x, y, r:11, item:it, life:60, bob:rand(0,TAU)});
}

// ---------- COMBAT / PROGRESSION ----------
// dmg stats on items scale with their scale-attr (weapons carry one)
function playerDmg() {
  let d = P.baseDmg + (P.level-1)*2;
  for (const s of SLOTS) {
    const e = P.eq[s];
    if (!e) continue;
    for (const st of e.stats) {
      if (st.k !== 'dmg') continue;
      d += st.v; // flat base damage
      // scaling bonus: attribute value × weapon pct (rolled 1-200 on spawn)
      if (st.scale && st.pct) d += curAttr(st.scale) * st.pct / 100;
    }
  }
  return d;
}
// equipment bonus sums for item affix kinds (issue #8: mana/crit/speed exist)
function equipBonus(k) {
  let b = 0;
  for (const s of SLOTS) { const e = P.eq[s]; if (e) for (const st of e.stats) if (st.k === k) b += st.v; }
  return b;
}
// current attribute = base (points assigned) + affix bonuses from equipped gear (issue #25)
function curAttr(k) { return P.attr[k] + equipBonus(k); }
// the pool follows Intelligence hard: a Barbarian on 6 holds 68, a Mage on
// 14 holds 116, so the two classes do not even agree on how much arcane
// there is to spend (issue #66)
// reopened #66 also wants the POOL itself lower: a level-1 barbarian or
// warrior (int 6) must sit at exactly one 40-mana finisher, so the base fell
// from 80 to 56 and Intelligence now carries more of the curve (x8). The
// class-less dummy (int 8) keeps its old 56 as its budget.
function mpMax() { return 56 + (curAttr('int') - 8) * 8 + equipBonus('mp'); }
// and so does the pace it fills back at: this used to be a flat 6 a
// second for everyone, which read as an endless drum. Now the stat decides
// on its own - about 1.3/s for the plate-and-axe pair on Intelligence 6,
// about 2.8/s for the Mage on 14 (issue #66)
function manaRegen() { return 0.25 + curAttr('int') * 0.18; }
function critChance() { return 0.05 + (curAttr('dex') - 8) * 0.006 + equipBonus('crit') / 100; }
// movement speed: base × (1 + rolled % bonus from items)
// the lich king's cold grasp leaves the hero half-walking for a few seconds
function moveSpd() {
  return P.speed * (1 + equipBonus('spd') / 100) * (P.chill > 0 ? 0.58 : 1);
}
function playerHpMax() {
  let h = P.baseHp + (P.level-1)*14 + (curAttr('vit') - 10) * 6;
  for (const s of SLOTS) { const e = P.eq[s]; if (e) for (const st of e.stats) if (st.k==='hp') h += st.v; }
  return h;
}
function refreshHpMax() {
  const nm = playerHpMax();
  if (nm !== P.hpMax) { const diff = nm - P.hpMax; P.hpMax = nm; if (diff>0) P.hp += diff; }
  if (P.hp > P.hpMax) P.hp = P.hpMax;
  if (P.mana > mpMax()) P.mana = mpMax(); // equip swap may shrink the pool (issue #20)
}

function hurtPlayer(dmg, fromX, fromY) {
  if (godMode) return; // developer menu: no damage while god mode is on
  if (P.dead || game.time - P.hurtT < 0.25) return;
  P.hp -= dmg; P.hurtT = game.time;
  dmgText(P.x, P.y, '-'+dmg, '#ff5555');
  blood(P.x, P.y); S.hurt(); game.shake = Math.max(game.shake, 6);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; showDeath(); }
}

// ---------- the venom a rogue's arrow leaves behind (issue #73) ----------
// A dose is a promise: it hands over POISON_MULT plain hits spread over
// POISON_SECS seconds in POISON_TICK-long ticks. A tick takes an even share
// of whatever the dose still has left to give, so the whole course adds up
// to exactly the promise instead of a pile of rounded-up ticks, and a fresh
// dose replaces the one already on a foe rather than stacking with it, so
// two arrows cannot turn into a wall of venom.
const POISON_SECS = 30;   // half a minute of it
const POISON_TICK = 1;    // taken one second at a time
const POISON_TICKS = POISON_SECS / POISON_TICK;
const POISON_MULT = 2;    // two hundred percent of a plain attack
const POISON_TINT = '#69a83c'; // the coat a poisoned foe wears
function applyPoison(m, dmg) {
  m.poison = POISON_SECS;
  m.poisonClock = POISON_TICK;
  m.poisonLeft = dmg;
  m.poisonTicks = POISON_TICKS;
  // the dose is announced the frame it lands, so the player can see which
  // foe he just envenomed rather than counting green motes off a crowd
  poisonFx(m.x, m.y);
  dmgText(m.x, m.y - m.r * 1.5, 'POISONED', '#8cbf3f');
}
// what a single tick of the dose is worth
function poisonShare(m) {
  if (m.poisonTicks <= 0 || m.poisonLeft <= 0) return 0;
  return Math.min(m.poisonLeft, Math.max(1, Math.round(m.poisonLeft / m.poisonTicks)));
}
// the bubbles the venom climbs off a foe with
function poisonFx(x, y) {
  for (let i = 0; i < 5; i++)
    game.particles.push({ x: x + rand(-7, 7), y: y - rand(0, 12), vx: rand(-9, 9),
      vy: -rand(14, 34), life: rand(0.5, 0.95), color: i % 2 ? '#8cbf3f' : '#b9dc6a',
      size: rand(1.6, 3) });
}

function damageMonster(m, dmg, isCrit, knockFrom) {
  m.act = true; // getting hit wakes a sleeping monster
  if (killMode) dmg = m.hp + 1000; // dev menu insta kill: anything dies in one blow
  m.hp -= dmg; m.hitFlash = 0.12;
  dmgText(m.x + rand(-8,8), m.y - m.r, (isCrit?'CRIT! ':'')+Math.round(dmg), isCrit?'#ffd75e':'#ffffff');
  isCrit ? S.crit() : S.hit();
  blood(m.x, m.y);
  if (knockFrom) {
    const a = Math.atan2(m.y-knockFrom.y, m.x-knockFrom.x);
    m.kx = Math.cos(a)*(m.elite||m.type==='boss'?30:110);
    m.ky = Math.sin(a)*(m.elite||m.type==='boss'?30:110);
  }
  P.mana = Math.min(mpMax(), P.mana + (isCrit?9:5));
  if (m.hp <= 0) killMonster(m);
}

function killMonster(m) {
  m.dead = true;
  game.totalKills++;
  S.death();
  game.corpses.push({x:m.x, y:m.y, r:m.r, color:m.color, angle:m.angle, life:14, type:m.type});
  if (game.decals.length > 140) game.decals.splice(0, 40);
  game.decals.push({x:m.x+rand(-6,6), y:m.y+rand(-6,6), r:m.r*1.5, life:20});
  P.xp += m.xp; // XP goes straight to the player card (issue #33)
  dmgText(m.x, m.y - m.r - 14, '+' + m.xp + ' XP', '#7ad67a');
  dropGlobes(m.x, m.y);
  dropGold(m.x, m.y, game.checkpoint);
  if (chance(m.elite ? 0.9 : (m.type==='boss' ? 1 : 0.16)))
    dropItem(m.x + rand(-20,20), m.y + rand(-20,20), game.checkpoint, m.elite || m.type==='boss',
      m.type === 'boss' ? 'boss' : m.elite ? 'elite' : 'normal');
  if (m.type === 'boss') {
    game.boss = null; game.bossMode = false;
    game.shake = 18; S.impact();
    if (game.throne) {
      // the last hall has no gate to blaze open: what his death wakes is the
      // throne at the head of the carpet (issue #69)
      game.throne.active = true;
      game.throne.t = 0;
    }
    for (let i=0;i<3;i++) dropItem(m.x+rand(-40,40), m.y+rand(-40,40), game.checkpoint, true, 'boss');
    S.portal();
    if (game.throne) {
      banner('The lich king is slain — the throne is waking', '#78e8a8');
      toast('The throne at the head of the carpet is awake — touch it and sit down', '');
    } else banner('Boss defeated — portal active!', '#58c8f0');
  } else {
    game.killedForQuota++;
  }
  gainXpCheck();
}

function gainXpCheck() {
  while (P.xp >= P.xpNeed) {
    P.xp -= P.xpNeed;
    P.level++;
    P.xpNeed = Math.round(60 * Math.pow(P.level, 1.32));
    refreshHpMax(); P.hp = P.hpMax; P.mana = mpMax();
    P.statPoints += 3;
    if (game.demo && bot) botSpendPoints(); // the spectator AI spends them itself
    S.levelUp(); ring(P.x, P.y, '#ffd75e'); ring(P.x, P.y, '#ffffff');
    banner('Level ' + P.level + '! · +3 attribute points' +
      (game.demo && bot ? ' (spent by the AI)' : ' (C)'), '#ffd75e');
    if (charOpen) renderChar();
  }
}

// no autoequip: pickups always go to the backpack; the player equips
// manually from the character sheet; full backpack -> sold to gold
function pickUpItem(it) {
  // issue #48: with a full backpack nothing is sold - the item stays on the
  // level and the player is told why it did not come aboard
  if (P.inv.length >= INV_CAP) {
    toast('Backpack is full (' + P.inv.length + '/' + INV_CAP + ')', '');
    return false;
  }
  P.inv.push(it);
  toast('Taken: ' + it.name + ' (backpack) · C = sheet', 'item-' + it.rarity);
  S.item();
  if (charOpen) renderChar();
  return true;
}

function toast(msg, cls) {
  const t = document.getElementById('toast');
  const d = document.createElement('div');
  d.className = 'toastItem ' + (cls||'');
  d.textContent = msg;
  t.appendChild(d);
  setTimeout(()=>{ d.style.opacity='0'; d.style.transition='opacity .4s'; }, 2600);
  setTimeout(()=>d.remove(), 3100);
  while (t.children.length > 4) t.removeChild(t.firstChild);
}

// ============ MAIN UPDATE LOOP ============
function update(dt) {
  game.time += dt;
  game.shake *= Math.pow(0.001, dt);

  if (!P.dead) {
    if (game.demo) botTick(dt); else bot = null; // spectator mode: AI drives the hero
    // --- player ---
    if (game.seat > 0) {
      // seated on the last throne: the run is over and the window is being
      // put up over him, so no keyboard, cursor or bot can ask anything of the
      // hero until the window is closed (issue #69)
      game.seat += dt;
      if (game.seat >= 2.2 && !game.victoryShown) showVictory();
    } else if (P.leap) {
      const L = P.leap;
      L.t += dt / L.dur;
      if (L.t >= 1) { leapLand(L.tx, L.ty, L.mul, L.stun); P.leap = null; }
      else { P.x = L.sx + (L.tx - L.sx) * L.t; P.y = L.sy + (L.ty - L.sy) * L.t; }
    } else {
      let mx = 0, my = 0;
      if (K.w) my -= 1; if (K.s) my += 1; if (K.a) mx -= 1; if (K.d) mx += 1;
      if (mx || my) {
        const l = Math.hypot(mx, my);
        moveWithCollide(P, mx / l * moveSpd() * dt, my / l * moveSpd() * dt);
        if (mx) P.faceX = mx > 0 ? 1 : -1;
        P.aim = walkAim(mx, my); // the cursor's line, not the walk (issue #67)
        game.moveTarget = null;
      } else if (game.moveTarget) {
        const dx = game.moveTarget.x - P.x, dy = game.moveTarget.y - P.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) game.moveTarget = null;
        else {
          moveWithCollide(P, dx / d * moveSpd() * dt, dy / d * moveSpd() * dt);
          if (dx) P.faceX = dx > 0 ? 1 : -1;
          P.aim = walkAim(dx, dy); // click-to-move walks; the cursor still aims (issue #67)
        }
      }
    }

    for (const k of ['potion', 'sk2', 'sk3']) P.cd[k] = Math.max(0, P.cd[k] - dt);
    manaWarnT = Math.max(0, manaWarnT - dt); // the too-low grumble is throttled
    // mana comes back at the class' own pace (issue #66)
    P.mana = Math.min(mpMax(), P.mana + manaRegen() * dt);
    // very slow natural HP regen, unlocked from level 5
    if (P.level >= 5 && P.hp < P.hpMax) {
      const rg = 0.08 + (P.level - 5) * 0.015 + curAttr('vit') * 0.008;
      P.hp = Math.min(P.hpMax, P.hp + rg * dt);
    }
    P.atkT = Math.max(0, P.atkT - dt);
    P.hurtFlash = Math.max(0, P.hurtFlash - dt);
    P.chill = Math.max(0, P.chill - dt); // the frost hand thaws on its own
    if (K.w || K.a || K.s || K.d || game.moveTarget) P.walkPhase += dt * 11;
    else P.walkPhase *= Math.pow(0.02, dt);
    // idle routines (issue #72): a quarter-minute with nothing asked of the
    // hero starts one of three of them, chosen at random. As long as he keeps
    // standing, another starts five idle seconds after the previous one
    // finished, and the next one is always drawn from the two that are not
    // the routine he just played, so the three of them alternate instead of
    // hammering the same stretch over and over. Any input at all - a step,
    // a swing, the bot taking over - stops the whole cadence on the frame
    // it lands on, and the fifteen seconds have to be sat through again.
    if (K.w || K.a || K.s || K.d || game.moveTarget || game.mouseDown ||
        P.dead || P.leap || P.atkT > 0) {
      P.idleT = 0; P.idleP = 0; P.idleNext = -1; // doing something: no cadence
    } else if (P.idleP > 0) {
      P.idleP += dt / IDLE[Math.max(0, P.idleAnim)].dur;
      if (P.idleP >= 1) { P.idleP = 0; P.idleNext = IDLE_AGAIN; } // settled: arm the next
    } else if (P.idleNext > 0) {
      P.idleNext -= dt;
      if (P.idleNext <= 0) { P.idleNext = -1; pickIdle(); }
    } else {
      P.idleT += dt;
      if (P.idleT >= IDLE_FIRST) pickIdle();
    }
    // fog of war: stamp the tiles around the player as visited (issue #13)
    if (game.visited) {
      const pcx = (P.x / TS) | 0, pcy = (P.y / TS) | 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 10) continue;
        const tx = pcx + dx, ty = pcy + dy;
        if (tx >= 0 && tx < GCOLS && ty >= 0 && ty < GROWS) game.visited[ty * GCOLS + tx] = 1;
      }
    }
    // portal lies behind the boss room — usable only after the boss is slain
    // the overlord waits at the gate (issue #57): the gate has to sit wholly
    // inside the torch around him before he stirs (issue #68), and it stays shut
    // until he is down, so a level cannot be run past. The last stage has no gate
    // at all - its throne wakes on the king's death instead (issue #69)
    wakeBoss();
    // the last stage's prize: touching an awake throne seats the hero (issue #69)
    throneTouch();
    if (game.portal && (game.boss === null || game.boss.dead) && !game.bossPending &&
        Math.hypot(P.x - game.portal.x, P.y - game.portal.y) < 26) {
      // the Roost's own portal is not a descent: stepping into it wins the run
      if (game.checkpoint === FINAL_LEVEL) showVictory();
      else nextCheckpoint();
    }
    if (game.mouseDown && P.atkT <= 0 && game.seat <= 0) tryAttack();
  }

  // --- monsters ---
  const near = game.monsters.filter(m => Math.hypot(m.x - P.x, m.y - P.y) < 320);
  if (!P.dead) {
    if (near.length === 0 && game.time > 1.5 && (game.boss || game.bossPending) &&
        (!game.boss || !game.boss.dead)) {
      game.spawnDelay -= dt;
      if (game.spawnDelay <= 0) {
        game.spawnDelay = 1.2;
        const left = game.quota - game.killedForQuota - game.monsters.length;
        if (left > 0) {
          const p = findSpawnPoint();
          const sm = spawnMonster(pickTypeFor(mcp), p.x, p.y, chance(0.05), mcp);
          sm.act = false; // spawns off-screen, asleep — wakes only when player approaches
        }
      }
    }
    // no overlord is placed at level start any more: he is woken by the
    // approach to the portal (issue #57), and the quota is progress
    // flavour only now
  }
  for (const m of game.monsters) {
    if (m.dead) continue;
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    m.touchCd = Math.max(0, m.touchCd - dt);
    m.slow = Math.max(0, m.slow - dt);
    m.wob += dt * 6;
    // the dose eats once a second for half a minute (issue #73). It eats
    // whatever the foe is doing: feeling the venom wakes a sleeping one,
    // so poison is never a free sleep-kill, and it eats through a stun,
    // because venom is not a blow anything can stagger. Killing with it is
    // a kill like any other - it counts, drops and leaves a corpse.
    if (m.poison > 0) {
      m.poisonClock -= dt;
      if (m.poisonClock <= 0) {
        m.poisonClock += POISON_TICK;
        const vk = poisonShare(m);
        m.poisonLeft -= vk;
        m.poisonTicks--;
        if (vk > 0) {
          m.act = true;
          m.hp -= vk;
          m.hitFlash = Math.max(m.hitFlash, 0.1);
          dmgText(m.x + rand(-6, 6), m.y - m.r * 0.7, '-' + vk, '#8cbf3f');
          poisonFx(m.x, m.y);
        }
      }
      if (m.poisonTicks <= 0) m.poison = 0; // the dose has handed over all of it
      if (m.hp <= 0) { killMonster(m); continue; }
    }
    if (m.kx || m.ky) {
      if (passableAt(m.x + m.kx * dt, m.y)) m.x += m.kx * dt;
      if (passableAt(m.x, m.y + m.ky * dt)) m.y += m.ky * dt;
      const decay = Math.pow(0.01, dt);
      m.kx *= decay; m.ky *= decay;
      if (Math.abs(m.kx) < 1) m.kx = 0; if (Math.abs(m.ky) < 1) m.ky = 0;
    }
    if (m.stun > 0) { m.stun -= dt; continue; }
    const dx = P.x - m.x, dy = P.y - m.y;
    const d = Math.hypot(dx, dy);
    // Diable-style awakening: sleeping monsters ignore the world until
    // the player steps into their aggro radius (or until they get hit).
    if (!m.act) {
      if (d < m.aggro) {
        m.act = true;
        if (m.kind === 'boss') {
          S.bossRoar();
          game.shake = Math.max(game.shake, 14);
          banner('Here wakes ' + m.name + '!', '#c03030');
        } else S.awaken();
        dmgText(m.x, m.y - m.r - 16, '!', '#e8d8a0');
      } else continue;
    }
    if (!P.dead) m.angle = Math.atan2(dy, dx);

    // chase leash (issue #29, and issue #46 which hands it to the bosses too):
    // too far from where it stood, the enemy stops chasing - first it pauses to
    // look around, and if the player is still out of sight it walks (never
    // teleports) back home and sleeps there. A boss only guards his own room, so
    // his leash is shorter and his trudge home slower still: run and lose him
    {
      const LR = m.kind === 'boss' ? 520 : 560;
      const hdx = m.x - m.homeX, hdy = m.y - m.homeY;
      if (!m.leash && hdx * hdx + hdy * hdy > LR * LR) m.leash = 1; // looking around
      if (m.leash) {
        if (d < m.aggro) m.leash = 0; // player spotted again: resume the chase
        else if (m.leash === 1) {
          m.leashT = (m.leashT || 0) + dt;
          m.angle += dt * 3.1; // scanning around, not moving
          if (m.leashT > 1.4) { m.leash = 2; m.leashT = 0; } // still blind: head home
          continue;
        } else { // leash 2: walking back to its spot
          const hx = m.homeX - m.x, hy = m.homeY - m.y;
          const hd = Math.hypot(hx, hy);
          if (hd < 12) {
            m.leash = 0;
            m.act = false; // asleep again on its mark
            continue;
          }
          const sp = m.speed * (m.kind === 'boss' ? 0.55 : 0.8);
          const nx = m.x + hx / hd * sp * dt, ny = m.y + hy / hd * sp * dt;
          if (passableAt(nx, m.y)) m.x = nx;
          if (passableAt(m.x, ny)) m.y = ny;
          m.angle = Math.atan2(hy, hx);
          continue;
        }
      }
    }

    if (m.kind === 'boss') {
      m.dashCd -= dt; m.summonCd -= dt;
      if (m.lich) {
        // the last king's own three hands (issue #69): the grave chorus raises
        // the fallen at his feet, the cold grasp is a frost pulse that chills
        // everything inside it, and he keeps the overlord's charge below
        m.graveCd -= dt; m.graspCd -= dt;
        if (m.graveCd <= 0) {
          m.graveCd = 9;
          S.elite();
          banner(game.boss.name + ' raises the fallen!', '#9ff0c8');
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU + (m.wob % TAU);
            const sx2 = m.x + Math.cos(a) * 120, sy2 = m.y + Math.sin(a) * 120;
            if (passableAt(sx2, sy2)) {
              const mm = spawnMonster('skeleton', sx2, sy2, chance(0.2), mcp);
              mm.act = true; mm.angle = a + Math.PI;
            }
          }
        }
        if (m.graspCd <= 0 && d < 250) {
          m.graspCd = 5.4;
          ring(m.x, m.y, '#8ff0c0');
          screenShake(6);
          S.impact();
          if (!P.dead && d < 210) {
            hurtPlayer(Math.round(m.dmg * 0.7), m.x, m.y);
            P.chill = 3.4;
            dmgText(P.x, P.y - 26, 'CHILLED', '#9fe8f8');
          }
        }
      }
      if (m.summonCd <= 0) {
        m.summonCd = 8;
        S.elite();
        banner(game.boss.name + ' summons minions!', '#ff5060');
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const sx = m.x + Math.cos(a) * 110, sy = m.y + Math.sin(a) * 110;
          if (passableAt(sx, sy)) {
            const mm = spawnMonster(pickTypeFor(mcp), sx, sy, chance(0.1), mcp);
            mm.angle = a + Math.PI;
          }
        }
      }
      if (m.dashCd <= 0 && d > 90 && d < 420) {
        m.dashCd = 4.2;
        m.dash = { t: 0, dur: 0.55, sx: m.x, sy: m.y, tx: P.x, ty: P.y, hit: false };
        S.shoot();
        dmgText(m.x, m.y - m.r - 24, 'CHARGE!', '#ff8040');
      }
      if (m.dash) {
        const D = m.dash;
        D.t += dt;
        const t = Math.min(1, D.t / D.dur);
        m.x = D.sx + (D.tx - D.sx) * t; m.y = D.sy + (D.ty - D.sy) * t;
        if (!D.hit && Math.hypot(m.x - P.x, m.y - P.y) < m.r + P.r + 6) {
          D.hit = true;
          hurtPlayer(Math.round(m.dmg * 1.6), m.x, m.y);
          screenShake(10);
        }
        if (t >= 1) m.dash = null;
        continue;
      }
      if (d > m.range) {
        const sp = m.speed * (m.slow ? 0.4 : 1);
        const nx = m.x + dx / d * sp * dt, ny = m.y + dy / d * sp * dt;
        if (passableAt(nx, m.y)) m.x = nx;
        if (passableAt(m.x, ny)) m.y = ny;
      } else if (m.touchCd <= 0) {
        m.touchCd = 1.2;
        swingAt(m);
        if (Math.hypot(P.x - m.x, P.y - m.y) < m.range + 14) hurtPlayer(m.dmg, m.x, m.y);
      }
    } else if (m.ai === 'ranged') {
      if (d < m.range && m.touchCd <= 0 && !(m.channeling > 0)) {
        m.channeling = 0.85;
      }
      if (m.channeling > 0) {
        m.channeling -= dt;
        m.angle = Math.atan2(dy, dx);
        if (m.channeling <= 0) {
          m.channeling = 0;
          if (!P.dead && Math.hypot(P.x - m.x, P.y - m.y) < m.range + 40) {
            S.shoot();
            const a = Math.atan2(P.y - m.y, P.x - m.x) + (Math.random() - 0.5) * 0.12;
            game.projectiles.push({ x: m.x + Math.cos(a) * (m.r + 8), y: m.y + Math.sin(a) * (m.r + 8), vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, dmg: m.dmg, life: 3, color: '#ffe14a' });
            m.touchCd = rand(1.3, 2.3);
          }
        }
      } else if (d > m.range * 0.65) {
        const sp = m.speed * (m.slow ? 0.4 : 1);
        const nx = m.x + dx / d * sp * dt, ny = m.y + dy / d * sp * dt;
        if (passableAt(nx, m.y)) m.x = nx;
        if (passableAt(m.x, ny)) m.y = ny;
      }
    } else {
      if (d > m.range) {
        const sp = m.speed * (m.slow ? 0.4 : 1);
        let mvx = dx / d * sp * dt, mvy = dy / d * sp * dt;
        // friendly fire: monsters avoid hurting each other
        for (const o of near) {
          if (o === m) continue;
          const ox = m.x - o.x, oy = m.y - o.y;
          const od = Math.hypot(ox, oy);
          if (od < m.r + o.r && od > 0.1) { mvx += ox / od * 45 * dt; mvy += oy / od * 45 * dt; }
        }
        const nx = m.x + mvx, ny = m.y + mvy;
        if (passableAt(nx, m.y)) m.x = nx;
        if (passableAt(m.x, ny)) m.y = ny;
      } else if (m.touchCd <= 0) {
        m.touchCd = 1.1;
        swingAt(m);
        if (Math.hypot(P.x - m.x, P.y - m.y) < m.range + 12) hurtPlayer(m.dmg, m.x, m.y);
      }
    }
  }

  game.monsters = game.monsters.filter(m => !m.dead);

  // --- projectiles ---
  for (const pr of game.projectiles) {
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    if (pr.life <= 0) continue;
    if (!passableAt(pr.x, pr.y)) { splash(pr.x, pr.y, pr.color); pr.life = 0; continue; } // issue #62
    if (pr.side === 'p') {
      // the hero's own shots: an arrow flies straight and true, a magic
      // missile steers a little (issue #62) but only toward a foe standing
      // inside a 90 degree arc down its OWN forward path, so a foe behind
      // or beside it never drags the shot around and it never U-turns
      if (pr.home) {
        const ca = Math.atan2(pr.vy, pr.vx);
        let ht = null, hd = HOME_SENSE;
        for (const m of game.monsters) {
          if (m.hp <= 0) continue;
          const d = Math.hypot(m.x - pr.x, m.y - pr.y);
          if (d >= hd) continue;
          const a = Math.atan2(m.y - pr.y, m.x - pr.x);
          const off = Math.abs(Math.atan2(Math.sin(a - ca), Math.cos(a - ca)));
          if (off > Math.PI / 4) continue; // outside its forward arc - ignored
          hd = d; ht = m;
        }
        if (ht) {
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          const a = Math.atan2(ht.y - pr.y, ht.x - pr.x);
          let da = Math.atan2(Math.sin(a - ca), Math.cos(a - ca));
          da = clamp(da, -4.4 * dt, 4.4 * dt);
          const na = ca + da;
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      for (const m of game.monsters) {
        if (m.hp <= 0) continue;
        if (Math.hypot(pr.x - m.x, pr.y - m.y) < m.r + 6) {
          if (pr.slow) m.slow = Math.max(m.slow, pr.slow); // the Mage's cold still bites (issue #63)
          if (pr.poison) applyPoison(m, pr.poisonDmg); // issue #73: the venom the arrowhead left
          const crit = chance(critChance());
          damageMonster(m, Math.round(pr.dmg * (crit ? 1.9 : rand(0.9, 1.1))), crit, P);
          splash(pr.x, pr.y, pr.color); // issue #62: the hit reads on the board
          pr.life = 0;
          break;
        }
      }
      continue;
    }
    if (!P.dead && Math.hypot(pr.x - P.x, pr.y - P.y) < P.r + 5) {
      hurtPlayer(pr.dmg, pr.x, pr.y);
      splash(pr.x, pr.y, pr.color); // issue #62: the hit reads on the board
      pr.life = 0;
    }
  }
  game.projectiles = game.projectiles.filter(pr => pr.life > 0);

  // --- globes / items / fx ---
  for (const g of game.globes) {
    g.life -= dt;
    const d = Math.hypot(P.x - g.x, P.y - g.y);
    if (d < 95) { const pull = Math.min(320, 60 + (95 - d) * 6); g.x += (P.x - g.x) / d * pull * dt; g.y += (P.y - g.y) / d * pull * dt; }
    if (d < P.r + 10 && !P.dead && g.life > 0) {
      g.life = 0;
      S.globe();
      if (g.type === 'heal') { P.hp = Math.min(P.hpMax, P.hp + Math.ceil(P.hpMax * 0.3)); S.healGlobe(); }
      else if (g.type === 'mana') { P.mana = Math.min(mpMax(), P.mana + 14); }
      else { P.gold += g.val; }
    }
  }
  game.globes = game.globes.filter(g => g.life > 0);
  // treasure chests: step up to a closed chest to swing it open (issue #19)
  for (const ch of game.chests) {
    if (ch.open || P.dead) continue;
    if (Math.hypot(P.x - ch.x, P.y - ch.y) > 30) continue;
    ch.open = true;
    game.drops.push({ x: ch.x + rand(-6, 6), y: ch.y - 16, r: 11, item: ch.item, life: 180, bob: rand(0, TAU) });
    dropGold(ch.x + rand(-16, 16), ch.y + rand(-8, 8), game.checkpoint);
    S.treasure();
    toast('Treasure chest — a magic item inside!', 'item-magic');
  }
  // merchant: near him the trade offer floats up (issue #34)
  if (game.merchant && !P.dead) {
    const md = Math.hypot(P.x - game.merchant.x, P.y - game.merchant.y);
    if (md < 150) {
      game.merchant.hintCd -= dt;
      if (game.merchant.hintCd <= 0) {
        game.merchant.hintCd = 5;
        dmgText(game.merchant.x, game.merchant.y - 34, 'press T to trade', '#e8c860');
      }
    }
  }
  // gold — magnet pull + walk over to pick up
  for (const gp of game.goldpiles) {
    gp.life -= dt;
    gp.bob += dt * 4;
    if (P.dead) continue;
    const d = Math.hypot(P.x - gp.x, P.y - gp.y);
    if (d < 110 && d > 1) {
      const pull = Math.min(340, 60 + (110 - d) * 6);
      gp.x += (P.x - gp.x) / d * pull * dt;
      gp.y += (P.y - gp.y) / d * pull * dt;
    }
    if (d < P.r + 12 && gp.life > 0) {
      gp.life = 0;
      P.gold += gp.amount;
      S.gold();
      dmgText(gp.x, gp.y - 10, '+' + gp.amount, '#ffd76a');
    }
  }
  game.goldpiles = game.goldpiles.filter(gp => gp.life > 0);
  for (const it of game.drops) {
    it.bob += dt * 3;
    const d = Math.hypot(P.x - it.x, P.y - it.y);
    // a full backpack refuses the pickup: nothing is sold and the goods are
    // not even aged away, so they wait on the floor until you make room
    // (issue #48)
    if (d < P.r + 14 && !P.dead && it.life > 0 && P.inv.length >= INV_CAP) {
      it.hintCd = (it.hintCd || 0) - dt;
      if (it.hintCd <= 0) {
        it.hintCd = 2;
        dmgText(it.x, it.y - 16, 'backpack full', '#c8a45a');
      }
      continue;
    }
    it.life -= dt;
    if (d < P.r + 14 && !P.dead && it.life > 0) { it.life = 0; pickUpItem(it.item); }
  }
  game.drops = game.drops.filter(it => it.life > 0);
  for (const p of game.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  game.particles = game.particles.filter(p => p.life > 0);
  for (const t of game.texts) { t.y += t.vy * dt; t.life -= dt; }
  game.texts = game.texts.filter(t => t.life > 0);
  for (const r of game.rings) { r.r += (r.grow || 420) * dt; r.life -= dt; }
  game.rings = game.rings.filter(r => r.life > 0);
  // a bolt of lightning is the shortest-lived thing on the board: ART_BIBLE.md
  // 7.2 asks of lightning that it reads as short-lived flashes, and the path it
  // flashes along was decided when it was born, so a bolt does not shimmer
  // once a frame
  for (const b of game.bolts) b.life -= dt;
  game.bolts = game.bolts.filter(b => b.life > 0);
  if (game.portal) game.portal.t += dt;
}
// ============ PART 4 — FIGHTING, SKILLS, PORTAL, DEATH ============
function screenShake(n) { game.shake = Math.max(game.shake, n); }
function passableAt(x, y) { return !solidAt(x, y, 12); }

function swingAt(m) {
  if (!P.dead && Math.hypot(P.x - m.x, P.y - m.y) < 460) S.swing();
}

// the hand's gear decides the attack (issue #53): a bow or a staff shoots and
// never swings; bare fists still swing
function rangedWeapon() {
  const w = P.eq.weapon;
  return !!w && (w.wk === 'bow' || w.wk === 'staff');
}
// ---------- the hero's ranged shot (issues #61 + #62) ----------
// the hero's own torchlight, in world px: lightPass punches a hole this wide
const PLAYER_LIGHT = 255;
// how far a shot carries before it fades out: deliberately its OWN number,
// NOT PLAYER_LIGHT, so that changing what the hero can see never quietly
// changes what a shot can reach (issue #62)
const PROJ_RANGE = 520;
const HOME_SENSE = 260; // how far down its own lane a magic missile notices a foe
const STAFF_MANA = 5;   // mana a staff shot drinks
let manaWarnT = 0;      // throttle for the 'mana too low' warning

// ---------- the gate and the dark around it (issue #68) ----------
// the portal's own drawn disc, dim and open: lightPass punches a hole this
// wide around it. This is the size of the GATE, not of the light around the
// hero - the two are separate numbers on purpose.
const PORTAL_DRAW = 118;
const PORTAL_DRAW_ON = 180;
// the overlord steps out only once the WHOLE portal disc sits inside the
// hero's torchlight: the lit hole is PLAYER_LIGHT wide and the dim gate is
// PORTAL_DRAW across, so he wakes at the difference of the two. A gate that
// is merely clipped by the edge of the light does not stir him - which is
// what lets a hero who has spotted it back off and prepare for the fight
// before he comes (issue #68)
const BOSS_WAKE_R = PLAYER_LIGHT - PORTAL_DRAW; // world px from the gate

function shootRanged() {
  const w = P.eq.weapon;
  const bowly = w.wk === 'bow';
  if (!bowly) {
    // the staff drinks the arcane: STAFF_MANA mana a shot. With less than
    // that left in the pool there is no shot at all, and the toast says so
    // (issue #62)
    if (P.mana < STAFF_MANA) {
      P.atkT = P.atkCd; // one grumble per swing, never one per frame
      if (manaWarnT <= 0) {
        manaWarnT = 1.5;
        toast('Not enough mana - the staff needs ' + STAFF_MANA + ' and you hold only ' + Math.round(P.mana), '');
        S.deny();
      }
      return;
    }
    P.mana -= STAFF_MANA;
  }
  P.atkT = P.atkCd;
  // BOTH ranged weapons leave down the cursor line: an arrow flies exactly
  // where the mouse left P.aim (issue #61), and a staff missile now does the
  // same (issue #62) - no foe standing politely in reach may steal the shot.
  // The missile makes its own course corrections later, inside a forward arc.
  const spd = bowly ? 660 : 450; // an arrow is quick and flat, a missile drifts and homes
  const hx = P.x + Math.cos(P.aim) * (P.r + 6), hy = P.y + Math.sin(P.aim) * (P.r + 6) - 4;
  if (bowly) S.bow(); else S.zap();
  game.projectiles.push({ x: hx, y: hy, vx: Math.cos(P.aim) * spd, vy: Math.sin(P.aim) * spd,
    dmg: playerDmg(), life: (PROJ_RANGE + 12) / spd, color: bowly ? '#e0d2ae' : '#8ac7e8',
    side: 'p', arrow: bowly, home: !bowly });
  if (!bowly) ring(hx, hy, '#8ac7e8');
}

function tryAttack() {
  if (game.seat > 0) return; // seated: the hand stays where it is (issue #69)
  if (rangedWeapon()) { shootRanged(); return; } // a bow or a staff never swings (issue #53)
  P.atkT = P.atkCd;
  // auto-aim at the nearest monster in reach
  let best = null, bd = 1e9;
  for (const m of game.monsters) {
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d < P.atkRange + m.r + 8 && d < bd) { bd = d; best = m; }
  }
  if (best) P.aim = Math.atan2(best.y - P.y, best.x - P.x);
  S.swing();
  const mx = P.x + Math.cos(P.aim) * 34, my = P.y + Math.sin(P.aim) * 34;
  ring(mx, my, '#cfc8b0');
  let hit = false;
  for (const m of game.monsters) {
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d > P.atkRange + m.r) continue;
    let da = Math.atan2(m.y - P.y, m.x - P.x) - P.aim;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > P.atkArc / 2) continue;
    const crit = chance(critChance());
    const dmg = Math.round(playerDmg() * (crit ? 1.9 : rand(0.85, 1.15)));
    damageMonster(m, dmg, crit, P);
    hit = true;
  }
  if (hit) screenShake(2.5);
}

// ---------- class skills (issue #63) ----------
// Slot 1 stays the same tonic for everyone. Slots 2 and 3 now belong to the
// CLASS rather than to the game: each pair answers for the weapon that class
// actually fights with, so a Barbarian cannot spin with a staff and a Mage
// cannot lob lightning through a bowstring - pressing the wrong one says so
// instead of silently doing nothing.
// Every class shares the same shape (issue #63): skill 2 is a solid single
// blow, a good deal stronger than a plain attack, cheap on mana and ready
// again in seconds; skill 3 is the finisher, way stronger, way more mana,
// a long cooldown. The yardstick:
//   skill 2: 1.7-2.1x a plain hit, 12-14 mana, 4 s
//   skill 3: 2.2-2.6x a plain hit over an area, 40-45 mana, 11-13 s
// One opener does not front-load that blow, and it is not an accident:
// issue #73 asked that the Rogue's Venom Shot land an ordinary arrow and
// leave another two plain hits to EAT at the foe over half a minute. Its
// bite is paid out in seconds rather than in one swing, which is the whole
// point of the issue - an arrow that only made a foe crawl was the Mage's
// own bite wearing a different name.
const SKILLS = {
  cleave: {
    name: 'Cleave', mana: 12, cd: 4, weapon: 'melee', run: castCleave,
    blurb: 'a wide two-handed swing that catches every foe in the arc',
  },
  earthquake: {
    name: 'Earthquake', mana: 40, cd: 12, weapon: 'melee', run: castEarthquake,
    blurb: 'hurl yourself at the crowd and let the ground answer, stunning it',
  },
  herostrike: {
    name: 'Hero Strike', mana: 14, cd: 4, weapon: 'melee', run: castHeroStrike,
    precheck: precheckHeroStrike,
    blurb: 'one planted blow, twice a plain attack, that shoves the foe back',
  },
  whirlwind: {
    name: 'Whirlwind', mana: 40, cd: 11, weapon: 'melee', run: castWhirlwind,
    blurb: 'a spin that answers for every foe within reach',
  },
  venshot: {
    name: 'Venom Shot', mana: 12, cd: 4, weapon: 'ranged', run: castVenomShot,
    blurb: 'an ordinary arrow whose venom keeps eating at the foe for half a minute',
  },
  bladefan: {
    name: 'Blade Fan', mana: 42, cd: 12, weapon: 'ranged', run: castBladeFan,
    blurb: 'six arrows fanned out around the hero',
  },
  frostlance: {
    name: 'Frost Lance', mana: 14, cd: 4, weapon: 'ranged', run: castFrostLance,
    blurb: 'a cold bolt that slows whatever it bites',
  },
  chainbolt: {
    name: 'Chain Bolt', mana: 45, cd: 13, weapon: 'ranged', run: castChainBolt,
    blurb: 'lightning that leaves the hero for the nearest foe he can see, then leaps from foe to foe, each leap drawn as an arc between the two',
  },
};
const CLASS_SKILLS = {
  barbar: ['cleave', 'earthquake'],   // two hands of iron: swing, then the ground
  war:    ['herostrike', 'whirlwind'], // plated and steady: plant, then spin
  rog:    ['venshot', 'bladefan'],    // the rogue fights at arm's length
  mage:   ['frostlance', 'chainbolt'],
};
// the skill a slot holds for whoever is playing: the HUD, the keys, the bot and
// the character sheet all ask the same question
function skillOf(n) {
  const row = CLASS_SKILLS[P.cls || 'barbar'];
  return SKILLS[row[n - 2]];
}
function skillWeaponOk(sk) {
  const ranged = rangedWeapon();
  if (sk.weapon === 'melee') return !ranged;
  if (sk.weapon === 'ranged') return ranged;
  return true;
}

// ---------- the plate every skill rides its slot with (issue #70) ----------
// One glyph for both class slots made the bar lie: eight skills live in it, and
// the player had to read the nameplate under the icon before he knew what he
// was carrying. So every skill now draws its own plate. There are no bitmaps in
// this game, so the plates are vector markup assembled from primitives, the
// same shapes the world already draws with (a swing's arc, a blade, a bolt of
// lightning, a droplet), and each one is composed the way its cast actually
// behaves: Cleave sweeps, Whirlwind spirals, Blade Fan really does fan six
// arrows, Chain Bolt really does link four foes. They also wear the exact
// colour that cast throws on the floor - castCleave's ring, castVenomShot's
// arrowhead, castChainBolt's burst - so the bar and the fight read as one
// thing rather than as two vocabularies. ART_BIBLE.md 10.4 asks of icons: one
// object, centred, square, readable at the slot's 56 px, no lettering, and the
// frame rides on currentColor so the rule that dims an unusable slot dims the
// glyph with it.
const ICON_V = 40; // every plate shares this square viewBox

// --- the primitives: one shape each, each returns its own markup ---
function icoRing(cx, cy, r, color, w, dashed) {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color +
    '" stroke-width="' + w + '"' + (dashed ? ' stroke-dasharray="2 3"' : '') + '/>';
}
function icoDisc(cx, cy, r, color) {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
}
// a band of sweep: the arc a swing leaves, closed into a fat wedge
function icoArc(cx, cy, ro, ri, a0, a1, color) {
  const t = (a) => (a - 90) * Math.PI / 180; // 0 degrees points up
  const p = (r, a) => (cx + Math.cos(t(a)) * r).toFixed(2) + ' ' + (cy + Math.sin(t(a)) * r).toFixed(2);
  const sweep = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
  return '<path d="M ' + p(ro, a0) + ' A ' + ro + ' ' + ro + ' 0 ' + sweep + ' 1 ' + p(ro, a1) +
    ' L ' + p(ri, a1) + ' A ' + ri + ' ' + ri + ' 0 ' + sweep + ' 0 ' + p(ri, a0) + ' Z" fill="' +
    color + '"/>';
}
// the same sweep, but as a line rather than a filled band
function icoStroke(cx, cy, r, a0, a1, color, w) {
  const t = (a) => (a - 90) * Math.PI / 180;
  const p = (a) => (cx + Math.cos(t(a)) * r).toFixed(2) + ' ' + (cy + Math.sin(t(a)) * r).toFixed(2);
  const sweep = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
  return '<path d="M ' + p(a0) + ' A ' + r + ' ' + r + ' 0 ' + sweep + ' 1 ' + p(a1) +
    '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"/>';
}
function icoLine(x1, y1, x2, y2, w, color) {
  return '<line x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) + '" x2="' + x2.toFixed(2) +
    '" y2="' + y2.toFixed(2) + '" stroke="' + color + '" stroke-width="' + w +
    '" stroke-linecap="round"/>';
}
// a tapered blade: base at (x, y), point along an angle in degrees
function icoBlade(x, y, len, ang, w, color) {
  const t = ang * Math.PI / 180;
  const dx = Math.cos(t), dy = Math.sin(t), px = -dy * w / 2, py = dx * w / 2;
  return '<path d="M ' + (x + px).toFixed(2) + ' ' + (y + py).toFixed(2) + ' L ' + (x - px).toFixed(2) +
    ' ' + (y - py).toFixed(2) + ' L ' + (x + dx * len).toFixed(2) + ' ' + (y + dy * len).toFixed(2) +
    ' Z" fill="' + color + '"/>';
}
// a four-sided lance head centred on (x, y): base, two barbs, point
function icoHead(x, y, len, ang, w, color) {
  const t = ang * Math.PI / 180;
  const dx = Math.cos(t), dy = Math.sin(t), px = -dy * w / 2, py = dx * w / 2;
  return '<path d="M ' + (x - dx * len).toFixed(2) + ' ' + (y - dy * len).toFixed(2) + ' L ' +
    (x + px).toFixed(2) + ' ' + (y + py).toFixed(2) + ' L ' + (x + dx * len).toFixed(2) + ' ' +
    (y + dy * len).toFixed(2) + ' L ' + (x - px).toFixed(2) + ' ' + (y - py).toFixed(2) +
    ' Z" fill="' + color + '"/>';
}
// a lightning kink: out, jogged out, jogged back, out
function icoBolt(x, y, ang, len, color, w) {
  const t = ang * Math.PI / 180;
  const dx = Math.cos(t), dy = Math.sin(t), px = -dy, py = dx, u = len / 3;
  const p = (s, off) => (x + dx * u * s + px * off).toFixed(2) + ',' +
    (y + dy * u * s + py * off).toFixed(2);
  return '<polyline points="' + p(0, 0) + ' ' + p(1, -3.4) + ' ' + p(2, 3.4) + ' ' + p(3, 0) +
    '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round"/>';
}
// an impact star: the shock a planted blow or a landing leaves on the floor
function icoStar(cx, cy, ro, ri, n, color) {
  let pts = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i * 180 / n - 90) * Math.PI / 180;
    const r = (i % 2) ? ri : ro;
    pts += (cx + Math.cos(a) * r).toFixed(2) + ',' + (cy + Math.sin(a) * r).toFixed(2) + ' ';
  }
  return '<polygon points="' + pts.trim() + '" fill="' + color + '"/>';
}
function icoDrop(x, y, r, color) {
  return '<path d="M ' + x + ' ' + (y - r * 1.8).toFixed(2) + ' C ' + (x + r) + ' ' + (y - r * 0.3) +
    ' ' + (x + r) + ' ' + (y + r * 0.7) + ' ' + x + ' ' + (y + r) + ' C ' + (x - r) + ' ' + (y + r * 0.7) +
    ' ' + (x - r) + ' ' + (y - r * 0.3) + ' ' + x + ' ' + (y - r * 1.8).toFixed(2) + ' Z" fill="' +
    color + '"/>';
}
// two half turns that keep getting wider: the spin of a whirlwind
function icoSpiral(cx, cy, r, color, w) {
  return '<path d="M ' + cx + ' ' + (cy - r * 0.3).toFixed(2) + ' A ' + (r * 0.3).toFixed(2) +
    ' ' + (r * 0.3).toFixed(2) + ' 0 0 1 ' + cx + ' ' + (cy + r * 0.3).toFixed(2) + ' A ' + (r * 0.6).toFixed(2) +
    ' ' + (r * 0.6).toFixed(2) + ' 0 0 1 ' + cx + ' ' + (cy - r * 0.6).toFixed(2) + ' A ' + (r * 0.92).toFixed(2) +
    ' ' + (r * 0.92).toFixed(2) + ' 0 0 1 ' + cx + ' ' + (cy + r * 0.92).toFixed(2) + '" fill="none" stroke="' +
    color + '" stroke-width="' + w + '" stroke-linecap="round"/>';
}

// the colours a plate may spend: the ones its own cast throws on the floor,
// plus the bone and the dirt the dungeon is drawn in
const BARB = '#e8ddc0', WAR = '#d8c060', VEN = '#9ed05a', STEEL = '#e8e0c0';
const FROST = '#8fd6f0', ARC = '#9fd8ff', GRIT = '#594536', EMBER = '#ffd75e';
const WAR2 = '#f2e6b0'; // the paler gold both of the warrior's own plates spend
const SKILL_ICON = {
  cleave: () =>
    // an axe head at the top of a wide sweep, the sweep itself drawn in the bone
    // of castCleave's ring: this is what a swing leaves, not a sword
    icoArc(20, 25, 16.4, 11.6, 44, 132, BARB) +
    icoBlade(9.4, 26.6, 11.4, -8, 4.8, '#8e8779') +
    icoBlade(9.4, 26.6, 9.4, 4, 5.2, '#a49b8a') +
    icoLine(5.6, 28, 19.4, 19.6, 2.6, '#6b5426'),
  earthquake: () =>
    // the hero's own two feet going into a crater: the landing star in the gold
    // of leapLand's ring, the ground cracked out of it in dungeon dirt
    icoStar(20, 22.4, 12.4, 5.4, 8, EMBER) +
    icoDisc(20, 22.4, 4.2, '#c8b070') +
    icoBolt(20, 5.4, 90, 12.6, EMBER, 2.6) +
    icoBolt(7.2, 30.6, 28, 10, GRIT, 2) + icoBolt(32.8, 30.6, 152, 10, GRIT, 2),
  herostrike: () =>
    // one planted blow and the shove behind it: the head of a heavy hammer
    // brought down on a shock star, the foe pushed along a bone arrow
    icoLine(12.4, 32.6, 22.2, 13.4, 3, '#6b5426') +
    '<rect x="15.8" y="9" width="14" height="8" rx="1.4" transform="rotate(-38 22.8 13)" fill="#a49b8a"/>' +
    icoStar(26.2, 23.8, 8.4, 3.4, 6, WAR2) +
    icoBlade(26.6, 26.8, 6.6, 30, 3.2, WAR2),
  whirlwind: () =>
    // the spin as the spin: a spiral of blades around the hero's own hub
    icoSpiral(20, 21, 15, WAR, 2.8) +
    icoBlade(20, 21, 15.4, 42, 4.6, STEEL) + icoBlade(20, 21, 15.4, 222, 4.6, STEEL) +
    icoDisc(20, 21, 3.4, '#6b5426'),
  venshot: () =>
    // a drawn bow with a fanged arrow, and the venom droplet the arrowhead
    // leaves behind in the green of castVenomShot's arrow
    icoStroke(7.8, 20, 13.2, 42, 138, '#6b5426', 2.6) +
    icoLine(16.7, 11.1, 12.8, 20, 1.2, STEEL) + icoLine(12.8, 20, 16.7, 29.1, 1.2, STEEL) +
    icoLine(12.8, 20, 26.4, 20, 1.6, '#6b5426') +
    icoBlade(23.8, 20, 8, 0, 4.2, VEN) +
    icoDrop(30.2, 30.4, 3.4, VEN) + icoDrop(24.8, 31.2, 2.1, '#c8e888'),
  bladefan: () =>
    // six shafts out of the hub, the fan castBladeFan really throws
    (() => {
      let fan = '';
      for (let k = 0; k < 6; k++) fan += icoBlade(20, 22, 15, -140 + k * 20, 3.4, STEEL);
      return fan + icoDisc(20, 22, 3.6, BARB);
    })(),
  frostlance: () =>
    // the head first, then the comet behind it: cold, and clearly not an arrow
    icoHead(20, 12.6, 8.4, -90, 11, FROST) +
    icoLine(20, 21, 20, 31, 3.6, '#6f9fbe') + icoDisc(20, 32.6, 2.6, FROST) +
    icoStroke(20, 20, 16.4, 244, 296, FROST, 1.4),
  chainbolt: () =>
    // the bolt walking the room: kinks linking four heads, the pale blue of
    // castChainBolt's ring and burst
    icoBolt(7.6, 10.4, 58, 12, ARC, 2.6) + icoBolt(14.4, 19.2, 20, 11, ARC, 2.6) +
    icoBolt(24.2, 22.4, 48, 11, ARC, 2.6) +
    icoDisc(7.6, 10.4, 2.8, ARC) + icoDisc(14.4, 19.2, 2.8, ARC) +
    icoDisc(24.2, 22.4, 2.8, ARC) + icoDisc(31.6, 30.6, 3.4, ARC),
};

// the markup a slot carries: the glyph, on a bone frame that rides on current
// Color so the CSS that dims an unusable slot dims the plate with it too
function iconSvgFor(key) {
  const glyph = SKILL_ICON[key] ? SKILL_ICON[key]() : '';
  if (!glyph) return '';
  return '<svg viewBox="0 0 ' + ICON_V + ' ' + ICON_V + '">' +
    icoRing(20, 20, 17.4, 'currentColor', 1.8) + icoRing(20, 20, 14.8, 'currentColor', 0.9, true) +
    glyph + '</svg>';
}
// which plate each slot is already showing: the skillbar is rewritten only when
// the class' pair changes, never once a frame
const iconKey = { 2: '', 3: '' };

// the shared melee arc: the plain attack sweeps reach 1 / arc 1, a class'
// opener reaches further or wider
function meleeSweep(reachMul, dmgMul, arcMul, critBonus) {
  const wr = P.atkRange * reachMul;
  let hit = false;
  for (const m of game.monsters) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d > wr + m.r) continue;
    let da = Math.atan2(m.y - P.y, m.x - P.x) - P.aim;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > (P.atkArc / 2) * arcMul) continue;
    const crit = chance(critChance() + critBonus);
    damageMonster(m, Math.round(playerDmg() * dmgMul * rand(0.92, 1.08)), crit, P);
    hit = true;
  }
  return hit;
}

// BARBARIAN skill 2: he fights with something two hands swing, so his opener
// is a Cleave that reaches past one foe - wider and further than a plain blow,
// 1.7x each, for 12 mana and four seconds
function castCleave() {
  S.swing(); S.hit();
  ring(P.x + Math.cos(P.aim) * 40, P.y + Math.sin(P.aim) * 40, '#e8ddc0');
  if (meleeSweep(1.35, 1.7, 1.3, 0)) screenShake(4);
}

// BARBARIAN skill 3: he hurls himself at the crowd and the ground answers.
// Kept on the hero's own travel + landing machinery, tuned as a finisher:
// 2.4x over the crater and a stun that actually holds
function castEarthquake() {
  let tx = P.x + Math.cos(P.aim) * 250, ty = P.y + Math.sin(P.aim) * 250;
  if (game.moveTarget) {
    const a = Math.atan2(game.moveTarget.y - P.y, game.moveTarget.x - P.x);
    const dd = Math.min(250, Math.hypot(game.moveTarget.x - P.x, game.moveTarget.y - P.y));
    tx = P.x + Math.cos(a) * dd; ty = P.y + Math.sin(a) * dd;
  }
  // a wall in the way: bring the landing closer instead
  for (let i = 3; i > 0; i--) {
    const cx = P.x + (tx - P.x) * (i / 3), cy = P.y + (ty - P.y) * (i / 3);
    if (!solidAt(cx, cy, P.r)) { tx = cx; ty = cy; break; }
  }
  tx = clamp(tx, 30, WORLD.w - 30); ty = clamp(ty, 30, WORLD.h - 30);
  P.leap = { sx: P.x, sy: P.y, tx, ty, t: 0, dur: 0.4, mul: 2.4, stun: 1.0 };
  game.moveTarget = null;
  S.leap();
}

// WARRIOR skill 2: the warrior is the plated one who plants his feet before
// he swings, so his opener is a single planted blow - twice a plain attack on
// one foe, with a shove. There has to be a foe to plant against: with nothing
// in reach the skill refuses and spends nothing, which keeps it honest
let heroTarget = null;
function precheckHeroStrike() {
  heroTarget = null;
  let bd = P.atkRange + 14;
  for (const m of game.monsters) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d < bd) { bd = d; heroTarget = m; }
  }
  if (!heroTarget) { toast('Hero Strike needs a foe in reach', ''); return false; }
  return true;
}
function castHeroStrike() {
  const best = heroTarget;
  if (!best) return;
  P.aim = Math.atan2(best.y - P.y, best.x - P.x);
  S.swing(); S.crit();
  ring(best.x, best.y, '#f2e6b0');
  screenShake(3);
  const crit = chance(critChance() + 0.05);
  damageMonster(best, Math.round(playerDmg() * 2.1 * rand(0.94, 1.06)), crit, P);
  // and the shield goes in behind the blow: a shove twice as heavy as a hit
  const a = Math.atan2(best.y - P.y, best.x - P.x);
  best.kx = Math.cos(a) * 210; best.ky = Math.sin(a) * 210;
}

// WARRIOR skill 3: the spin, kept from the old shared skill and rebalanced as
// a finisher - 2.2x for every foe inside it, 40 mana, eleven seconds
function castWhirlwind() {
  S.whirl();
  ring(P.x, P.y, '#d8c060'); ring(P.x, P.y, '#f2e6b0');
  screenShake(6);
  let n = 0;
  for (const m of game.monsters) {
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - P.x, m.y - P.y) > 118 + m.r) continue;
    damageMonster(m, Math.round(playerDmg() * 2.2 * rand(0.92, 1.08)),
      chance(critChance() + 0.05), P);
    n++;
  }
  if (n > 0) burst(P.x, P.y, '#d8c060', 6 + n, 200);
}

// ROGUE skill 2: the rogue fights at arm's length, so his opener is a shot -
// it leaves down the cursor line like every other arrow (issues #61/#62). The
// slow that used to ride it has been taken off (issue #73): a rogue's arrow
// that only made a foe crawl was the Mage's Frost Lance wearing another name.
// What it does instead is what an arrow with a poisoned head should do: it
// lands an ordinary hit - the arrow is the rogue's plain shot, same draw and
// speed - and the venom the arrowhead leaves behind eats at the foe for half
// a minute, a second apart, for two hundred percent of that same plain hit.
function castVenomShot() {
  S.bow();
  const hx = P.x + Math.cos(P.aim) * (P.r + 6), hy = P.y + Math.sin(P.aim) * (P.r + 6) - 4;
  game.projectiles.push({ x: hx, y: hy, vx: Math.cos(P.aim) * 760, vy: Math.sin(P.aim) * 760,
    dmg: playerDmg(), life: (PROJ_RANGE + 12) / 760, color: '#9ed05a',
    side: 'p', arrow: true, home: false,
    poison: POISON_SECS, poisonDmg: Math.round(playerDmg() * POISON_MULT) });
}

// ROGUE skill 3: six arrows thrown down a fan around the cursor line. No
// single one is strong (1.25x) - what makes it a finisher is that it can
// answer for the whole room at once
function castBladeFan() {
  S.bow(); S.bow();
  const spd = 700;
  for (let k = 0; k < 6; k++) {
    const a = P.aim + (k - 2.5) * 0.24;
    const hx = P.x + Math.cos(a) * (P.r + 6), hy = P.y + Math.sin(a) * (P.r + 6) - 4;
    game.projectiles.push({ x: hx, y: hy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      dmg: Math.round(playerDmg() * 1.25), life: (PROJ_RANGE + 12) / spd, color: '#e8e0c0',
      side: 'p', arrow: true, home: false });
  }
  ring(P.x, P.y, '#e8e0c0');
}

// MAGE skill 2: a cold bolt down the cursor line. It does not auto-aim either
// (issue #62 took the aim off every ranged weapon); what it brings is the
// chill - 1.9x and a two and a half second slow on whatever it bites
function castFrostLance() {
  S.zap();
  const hx = P.x + Math.cos(P.aim) * (P.r + 6), hy = P.y + Math.sin(P.aim) * (P.r + 6) - 4;
  game.projectiles.push({ x: hx, y: hy, vx: Math.cos(P.aim) * 560, vy: Math.sin(P.aim) * 560,
    dmg: Math.round(playerDmg() * 1.9), life: (PROJ_RANGE + 12) / 560, color: '#8fd6f0',
    side: 'p', arrow: false, home: true, slow: 2.5 });
  ring(hx, hy, '#8fd6f0');
}

// MAGE skill 3: lightning that walks the room. It answers for up to four
// foes you can see, 2.3x each, at the price of 45 mana and thirteen seconds
function castChainBolt() {
  S.zap(); S.crit();
  screenShake(7);
  ring(P.x, P.y, '#9fd8ff');
  const cand = [];
  for (const m of game.monsters) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d > 430 || !losClear(P.x, P.y, m.x, m.y)) continue;
    cand.push({ m: m, d: d });
  }
  // the bolt travels rather than branching: it leaves the hero for the nearest
  // foe he can see, and from there it answers for whichever foe stands nearest
  // to the one it has just struck, so the line the player sees runs BETWEEN the
  // crowd instead of being four separate flashes at the hero's feet (issue #71)
  const left = cand.slice();
  let ax = P.x, ay = P.y, n = 0;
  while (n < 4 && left.length > 0) {
    let bi = 0;
    for (let k2 = 1; k2 < left.length; k2++) {
      if (Math.hypot(left[k2].m.x - ax, left[k2].m.y - ay) <
        Math.hypot(left[bi].m.x - ax, left[bi].m.y - ay)) bi = k2;
    }
    const m = left.splice(bi, 1)[0].m;
    boltFx(ax, ay, m.x, m.y, '#9fd8ff'); // the arc that just struck, drawn where it struck
    damageMonster(m, Math.round(playerDmg() * 2.3 * rand(0.9, 1.1)),
      chance(critChance() + 0.15), P);
    ring(m.x, m.y, '#9fd8ff');
    burst(m.x, m.y, '#9fd8ff', 9, 230);
    ax = m.x; ay = m.y;
    n++;
  }
  if (n === 0) burst(P.x, P.y, '#9fd8ff', 6, 160);
}

// the one gate every class' skill walks through: cooldown, then the weapon
// the skill was written for, then mana. A skill that is not ready or that
// belongs to another kind of weapon spends nothing and says why.
function castSkill(n) {
  const sk = skillOf(n);
  if (!sk || game.seat > 0 || P.dead || P.leap || P.cd['sk' + n] > 0) return false; // seated: no casting (issue #69)
  if (!skillWeaponOk(sk)) {
    toast(sk.name + ' wants ' + (rangedWeapon() ?
      'something to swing - a bow or a staff will not do'
      : 'a bow or a staff in hand'), '');
    return false;
  }
  // some skills need something to aim at before they are worth spending
  if (sk.precheck && !sk.precheck()) return false;
  if (P.mana < sk.mana) {
    toast('Not enough mana - ' + sk.name + ' spends ' + sk.mana, '');
    return false;
  }
  P.cd['sk' + n] = sk.cd;
  P.mana -= sk.mana;
  sk.run();
  return true;
}
// the two keys and the two skillbar icons: what they hold follows the class
function trySkill2() { return castSkill(2); }
function trySkill3() { return castSkill(3); }

function leapLand(x, y, mul, stunT) {
  S.impact();
  screenShake(8);
  ring(x, y, '#ffd75e');
  burst(x, y, '#c8b070', 16, 240);
  for (const m of game.monsters) {
    if (Math.hypot(m.x - x, m.y - y) < 130 + m.r) {
      damageMonster(m, Math.round(playerDmg() * (mul === undefined ? 1.3 : mul)), chance(critChance() + 0.1), { x, y });
      m.stun = Math.max(m.stun, stunT === undefined ? 0.35 : stunT);
    }
  }
}
// potions are unlimited; only a 60 s cooldown gates them (issue: unlimited potions)
function drinkPotion() {
  if (P.dead || P.cd.potion > 0) return false;
  if (P.hp >= P.hpMax) return false;
  P.cd.potion = 60;
  const heal = Math.ceil(P.hpMax * 0.5);
  P.hp = Math.min(P.hpMax, P.hp + heal);
  S.potion();
  dmgText(P.x, P.y - 24, '+' + heal, '#5ad85a');
  return true;
}

function openPortal() {
  let px = P.x, py = P.y;
  for (let i = 0; i < 8; i++) {
    const a = rand(0, TAU), d = rand(70, 160);
    const cx = P.x + Math.cos(a) * d, cy = P.y + Math.sin(a) * d;
    if (!solidAt(cx, cy, 34) && cx > 90 && cy > 90 &&
        cx < WORLD.w - 90 && cy < WORLD.h - 90) { px = cx; py = cy; break; }
  }
  game.portal = { x: px, y: py, t: 0 };
  S.portal();
  banner('Portal opened — enter to go deeper', '#58c8f0');
}

// ---- journey save (issue #10): persisted to the browser on every portal ----
const SAVEKEY = 'infernalCrucible_journey_v1';
function saveSnapshot() {
  try {
    const data = {
      v: 1, ts: Date.now(), cls: P.cls,
      checkpoint: game.checkpoint,
      level: P.level, xp: P.xp, xpNeed: P.xpNeed, gold: P.gold,
      statPoints: P.statPoints,
      attr: { str: P.attr.str, dex: P.attr.dex, int: P.attr.int, vit: P.attr.vit },
      inv: P.inv, eq: P.eq,
      totalKills: game.totalKills,
    };
    localStorage.setItem(SAVEKEY, JSON.stringify(data));
  } catch (e) { /* no storage: silently skip */ }
}
function loadSnapshot() {
  try {
    const s = localStorage.getItem(SAVEKEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return (d && d.v === 1) ? d : null;
  } catch (e) { return null; }
}
function clearSnapshot() { try { localStorage.removeItem(SAVEKEY); } catch (e) {} }

function nextCheckpoint() {
  game.portal = null;
  game.checkpoint++;
  game.monsters = []; game.projectiles = []; game.globes = [];
  game.goldpiles = []; game.drops = []; game.rings = []; game.bolts = [];
  generateLevel(game.checkpoint);
  P.x = game.startPos.x; P.y = game.startPos.y;
  game.moveTarget = null;
  P.cd.potion = 0; // fresh potion at every checkpoint
  banner('Checkpoint ' + game.checkpoint, '#e8d8a0');
  preplaceMonsters();
  saveSnapshot(); // journey saved — offered on the title screen after a restart
}

function showDeath() {
  if (game.deathShown) return;
  game.deathShown = true;
  game.running = false;
  const scr = document.getElementById('deathScreen');
  scr.classList.remove('hidden');
  const mins = Math.floor(game.time / 60),
        secs = Math.floor(game.time % 60);
  document.getElementById('deathStats').textContent =
    'Level ' + P.level + ' · Checkpoint ' + game.checkpoint +
    ' · Monsters slain: ' + game.totalKills +
    ' · Gold: ' + P.gold +
    ' · Time: ' + mins + ':' + String(secs).padStart(2, '0');
  banner('You have fallen', '#c03a3a');
}

// ---------- the victory window (issue #51) ----------
// slaying the Roost's overlord and stepping into his portal wins the run: a
// window comes up over the world, painted in code with the Roost's own muse -
// a draped marble figure on a plinth, laurel in her raised hand, the overlord's
// broken crown shattered at her feet. The trophy is a statue, not a person: the
// shipped art stays tasteful while the words carry the fame and the glory.
const WIN_W = 268, WIN_H = 252;
function paintMuse(g, w, h) {
  const px = w / 2, py = h * 0.86;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1d1723'); bg.addColorStop(0.6, '#151017'); bg.addColorStop(1, '#0a0710');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // a moonbeam down the hall
  const beam = g.createLinearGradient(0, 0, 0, h);
  beam.addColorStop(0, 'rgba(230,214,180,0.26)'); beam.addColorStop(1, 'rgba(230,214,180,0)');
  g.beginPath();
  g.moveTo(w * 0.32, 0); g.lineTo(w * 0.68, 0); g.lineTo(w * 0.9, h); g.lineTo(w * 0.1, h);
  g.closePath(); g.fillStyle = beam; g.fill();
  // the floor of the Roost, laid stone
  g.fillStyle = '#1f1a21'; g.fillRect(0, py, w, h - py);
  g.strokeStyle = 'rgba(190,168,128,0.16)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath(); g.moveTo(0, py + 8 + i * 7); g.lineTo(w, py + 4 + i * 7); g.stroke();
  }
  // plinth
  g.fillStyle = '#3a343a'; g.fillRect(px - 48, py - 16, 96, 18);
  g.fillStyle = '#4a4146'; g.fillRect(px - 41, py - 23, 82, 8);
  // marble: legs under a long drape, torso, one arm raised
  const stone = g.createLinearGradient(px - 30, py - 160, px + 34, py);
  stone.addColorStop(0, '#e4dcc4'); stone.addColorStop(0.55, '#c3bba6'); stone.addColorStop(1, '#8b8474');
  g.fillStyle = stone;
  g.beginPath();
  g.moveTo(px - 22, py - 22); g.lineTo(px - 12, py - 86); g.lineTo(px + 12, py - 86); g.lineTo(px + 22, py - 22);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(px - 13, py - 86); g.lineTo(px - 17, py - 120); g.lineTo(px + 16, py - 118); g.lineTo(px + 13, py - 86);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(116,108,92,0.6)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(px - 15, py - 114); g.lineTo(px + 11, py - 88); g.stroke();
  g.beginPath(); g.moveTo(px - 9, py - 82); g.lineTo(px + 17, py - 26); g.stroke();
  g.beginPath(); g.moveTo(px + 4, py - 80); g.lineTo(px + 8, py - 30); g.stroke();
  g.lineCap = 'round';
  g.strokeStyle = '#cfc7b2'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(px - 15, py - 114); g.lineTo(px - 27, py - 76); g.stroke();
  g.beginPath(); g.moveTo(px + 14, py - 114); g.lineTo(px + 27, py - 140); g.stroke();
  // head, with the hair dressed up
  g.fillStyle = '#ddd5bf';
  g.beginPath(); g.arc(px, py - 130, 9, 0, TAU); g.fill();
  g.fillStyle = '#c1b7a2';
  g.beginPath(); g.arc(px - 1, py - 133, 10.5, 0.1, Math.PI * 0.9, true); g.fill();
  // laurel wreathed in the raised hand
  g.fillStyle = '#6e8b4c';
  for (let li = 0; li < 8; li++) {
    const a = -0.7 + li * 0.26;
    g.beginPath();
    g.ellipse(px + 27 + Math.cos(a) * 14, py - 140 + Math.sin(a) * 14, 4.4, 2.2, a, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#5d7440'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(px + 27, py - 140, 14, -0.7, 1.4); g.stroke();
  // the overlord's broken crown, hurled at the plinth's foot
  g.fillStyle = '#8a6834';
  g.beginPath();
  g.moveTo(px - 44, py - 24); g.lineTo(px - 24, py - 24); g.lineTo(px - 30, py - 35); g.lineTo(px - 38, py - 30);
  g.closePath(); g.fill();
  g.strokeStyle = '#8a6834'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(px - 22, py - 25); g.lineTo(px - 11, py - 28); g.stroke();
  g.beginPath(); g.moveTo(px + 26, py - 24); g.lineTo(px + 40, py - 30); g.stroke();
  // embers drifting off the Roost
  for (let i = 0; i < 30; i++) {
    const ex = (i * 71 + 13) % w, ey = h - (i * 43 + 9) % Math.round(h * 0.62);
    g.fillStyle = 'rgba(226,112,44,' + (0.10 + (i % 5) * 0.05) + ')';
    g.beginPath(); g.arc(ex, ey, 1 + (i % 3), 0, TAU); g.fill();
  }
  // vignette so the statue reads out of the dark
  const vg = g.createRadialGradient(px, h * 0.52, 40, px, h * 0.52, w * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,2,9,0.78)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
const winEl = document.getElementById('winScreen');
const winStatsEl = document.getElementById('winStats');
const winArtBox = document.getElementById('winArt');
const winMenuBtn = document.getElementById('menuBtn');
const winJourneyBtn = document.getElementById('journeyBtn');
if (winArtBox && winArtBox.appendChild) {
  const museCv = document.createElement('canvas');
  museCv.width = WIN_W; museCv.height = WIN_H;
  winArtBox.appendChild(museCv); // the muse is painted once, at load
  paintMuse(museCv.getContext('2d'), WIN_W, WIN_H);
}
function showVictory() {
  if (game.victoryShown) return;
  game.victoryShown = true;
  game.victoryOpen = true;
  game.paused = true; // the world holds still while the window is up
  if (winEl) winEl.classList.remove('hidden');
  const mins = Math.floor(game.time / 60),
        secs = String(Math.floor(game.time % 60)).padStart(2, '0');
  const fell = (game.boss && game.boss.name) ? game.boss.name : BOSSES[BOSSES.length - 1].name;
  winStatsEl.textContent =
    fell + ' kneels at the foot of the Lich Throne. The Infernal Crucible is yours:' +
    ' FAME ' + game.totalKills + ' for the monsters you cleared, GLORY ' + P.gold +
    ' for the gold you hoarded, and the muse above you, carved in marble for the season.' +
    ' You sat on the last throne and it is yours to keep.· Fame, glory and the prize.' +
    ' Level ' + P.level + ' · Time ' + mins + ':' + secs;
  banner('The Throne Is Yours', '#e8c477');
}
function closeVictoryWindow() {
  game.victoryOpen = false;
  game.paused = false;
  if (winEl) winEl.classList.add('hidden');
  game.moveTarget = null; // the hero stands still until you ask
  if (game.seat > 0) {
    // he came up off the throne: control is his again, and the seat has cooled,
    // so the same prize cannot be claimed twice (issue #69)
    const tr = game.throne;
    if (tr) { P.x = tr.sx; P.y = tr.sy + 46; tr.active = false; }
    game.seat = 0;
  }
}
function backToMenu() {
  closeVictoryWindow();
  game.running = false;
  const scr = document.getElementById('startScreen');
  if (scr) scr.classList.remove('hidden');
  if (loadSnapshot()) document.getElementById('continueBtn').classList.remove('hidden');
}

// ---------- the title screen's painted art (issue #55) ----------
// no image files anywhere in this game, so the title card is painted too: a
// wordmark with crossed swords behind it, a warrior in armour framing the left
// edge and the princess you are there to save framing the right. The princess
// wears a gown and a crown - a captured prize reads as a prize, deliberately
// not disrobed.
const LOGO_W = 470, LOGO_H = 92, FIG_W = 150, FIG_H = 430;
function paintLogo(g, w, h) {
  const cx = w / 2, cy = h / 2;
  g.lineCap = 'round';
  // the crossed swords that lie behind the word
  const sword = (x0, y0, x1, y1, col) => {
    g.strokeStyle = col; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const px = Math.cos(a + Math.PI / 2) * 9, py = Math.sin(a + Math.PI / 2) * 9;
    const gx = x0 + Math.cos(a) * 20, gy = y0 + Math.sin(a) * 20;
    g.strokeStyle = '#c8a45a'; g.lineWidth = 3.4; // the crossguard
    g.beginPath(); g.moveTo(gx - px, gy - py); g.lineTo(gx + px, gy + py); g.stroke();
    g.strokeStyle = '#7c5a24'; g.lineWidth = 4; // the grip
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * 14, y0 + Math.sin(a) * 14); g.stroke();
  };
  sword(18, h - 12, w - 18, 12, 'rgba(156,166,182,0.5)');
  sword(w - 18, h - 12, 18, 12, 'rgba(122,132,150,0.42)');
  // embers under the word
  for (let i = 0; i < 22; i++) {
    const ex = (i * 53 + 17) % w, ey = h - (i * 29) % 22;
    g.fillStyle = 'rgba(226,110,44,' + (0.07 + (i % 4) * 0.03) + ')';
    g.beginPath(); g.arc(ex, ey, 1 + (i % 3), 0, TAU); g.fill();
  }
  // the wordmark: letterspaced, inked dark then laid in gold
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = 'bold 31px Georgia';
  const word = (txt, y, mode) => {
    let total = 0;
    const adv = [];
    for (let i2 = 0; i2 < txt.length; i2++) { const q = g.measureText(txt[i2]).width + 3.4; adv.push(q); total += q; }
    let px2 = cx - total / 2, i2 = 0;
    for (const ch2 of txt) {
      if (mode === 'stroke') g.strokeText(ch2, px2, y);
      else g.fillText(ch2, px2, y);
      px2 += adv[i2]; i2++;
    }
  };
  g.shadowColor = 'rgba(206,74,26,0.6)'; g.shadowBlur = 16;
  g.lineJoin = 'round'; g.lineWidth = 5.5; g.strokeStyle = '#231006';
  word('INFERNAL', cy - 20, 'stroke');
  word('CRUCIBLE', cy + 21, 'stroke');
  const grd = g.createLinearGradient(0, cy - 34, 0, cy + 34);
  grd.addColorStop(0, '#f2dc9a'); grd.addColorStop(0.52, '#d8b25a'); grd.addColorStop(1, '#8c6728');
  g.fillStyle = grd;
  word('INFERNAL', cy - 20, 'fill');
  word('CRUCIBLE', cy + 21, 'fill');
  g.shadowBlur = 0;
}

function paintWarrior(g, w, h) {
  const cx = w * 0.5, base = h * 0.955;
  // backdrop: down-lit stone, courses of an old stair
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a1519'); bg.addColorStop(0.5, '#131015'); bg.addColorStop(1, '#090608');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const beam = g.createLinearGradient(0, 0, 0, h);
  beam.addColorStop(0, 'rgba(232,206,158,0.2)'); beam.addColorStop(1, 'rgba(232,206,158,0)');
  g.fillStyle = beam; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,132,98,0.14)'; g.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    g.beginPath(); g.moveTo(0, h * (i / 9)); g.lineTo(w, h * (i / 9) + 6); g.stroke();
  }
  const U = h / 430; // a figure of the whole panel height
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.ellipse(cx, base + 4 * U, 40 * U, 9 * U, 0, 0, TAU); g.fill();
  // a war-cloak hung behind
  g.fillStyle = '#5a1c22';
  g.beginPath();
  g.moveTo(cx - 30 * U, 138 * U); g.lineTo(cx + 30 * U, 138 * U);
  g.lineTo(cx + 40 * U, 348 * U); g.lineTo(cx - 40 * U, 348 * U);
  g.closePath(); g.fill();
  // legs and boots
  g.strokeStyle = '#3b4552'; g.lineWidth = 15 * U; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 12 * U, 282 * U); g.lineTo(cx - 16 * U, base - 16 * U);
  g.moveTo(cx + 12 * U, 282 * U); g.lineTo(cx + 17 * U, base - 16 * U);
  g.stroke();
  g.fillStyle = '#22262e';
  g.beginPath();
  g.ellipse(cx - 17 * U, base - 6 * U, 15 * U, 9 * U, 0, 0, TAU);
  g.ellipse(cx + 18 * U, base - 6 * U, 15 * U, 9 * U, 0, 0, TAU);
  g.fill();
  // tassets, then the cuirass
  g.fillStyle = '#47525e';
  g.beginPath();
  g.moveTo(cx - 27 * U, 258 * U); g.lineTo(cx + 27 * U, 258 * U);
  g.lineTo(cx + 22 * U, 296 * U); g.lineTo(cx - 22 * U, 296 * U);
  g.closePath(); g.fill();
  g.fillStyle = '#5d6a7c';
  g.beginPath();
  g.moveTo(cx - 32 * U, 152 * U); g.lineTo(cx + 32 * U, 152 * U);
  g.lineTo(cx + 26 * U, 262 * U); g.lineTo(cx - 26 * U, 262 * U);
  g.closePath(); g.fill();
  g.strokeStyle = '#8ea0b4'; g.lineWidth = 1.4; // the plates
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(cx - 30 * U, (172 + i * 24) * U); g.lineTo(cx + 30 * U, (172 + i * 24) * U); g.stroke();
  }
  g.strokeStyle = '#c8a45a'; g.lineWidth = 3 * U; // the gold ridge and belt
  g.beginPath(); g.moveTo(cx, 158 * U); g.lineTo(cx, 258 * U); g.stroke();
  g.beginPath(); g.moveTo(cx - 28 * U, 256 * U); g.lineTo(cx + 28 * U, 256 * U); g.stroke();
  // pauldrons
  g.fillStyle = '#7e8ea4';
  g.beginPath();
  g.arc(cx - 36 * U, 158 * U, 20 * U, 0, TAU);
  g.arc(cx + 36 * U, 158 * U, 20 * U, 0, TAU);
  g.fill();
  // the sword, planted point-down beside the boot
  g.strokeStyle = '#c9d2dd'; g.lineWidth = 6 * U;
  g.beginPath(); g.moveTo(cx + 52 * U, 150 * U); g.lineTo(cx + 52 * U, 396 * U); g.stroke();
  g.fillStyle = '#c9d2dd';
  g.beginPath();
  g.moveTo(cx + 49 * U, 396 * U); g.lineTo(cx + 55 * U, 396 * U); g.lineTo(cx + 52 * U, 414 * U);
  g.closePath(); g.fill();
  g.strokeStyle = '#c8a45a'; g.lineWidth = 4 * U;
  g.beginPath(); g.moveTo(cx + 38 * U, 152 * U); g.lineTo(cx + 66 * U, 152 * U); g.stroke();
  g.fillStyle = '#8a6a34';
  g.beginPath(); g.arc(cx + 52 * U, 134 * U, 5 * U, 0, TAU); g.fill();
  // the shield on the other arm
  g.fillStyle = '#3f4a58';
  g.beginPath(); g.arc(cx - 44 * U, 226 * U, 28 * U, 0, TAU); g.fill();
  g.strokeStyle = '#c8a45a'; g.lineWidth = 2.4;
  g.beginPath(); g.arc(cx - 44 * U, 226 * U, 21 * U, 0, TAU); g.stroke();
  g.fillStyle = '#c8a45a';
  g.beginPath(); g.arc(cx - 44 * U, 226 * U, 6 * U, 0, TAU); g.fill();
  // the helm and its crest
  g.fillStyle = '#7e8ea4';
  g.beginPath(); g.arc(cx, 122 * U, 24 * U, 0, TAU); g.fill();
  g.fillStyle = '#2a313c';
  g.fillRect(cx - 22 * U, 118 * U, 44 * U, 9 * U); // the visor slit
  g.fillStyle = '#a03a3a';
  g.beginPath();
  g.moveTo(cx - 4 * U, 100 * U);
  g.bezierCurveTo(cx - 26 * U, 78 * U, cx - 30 * U, 118 * U, cx - 16 * U, 150 * U);
  g.lineTo(cx - 4 * U, 118 * U);
  g.closePath(); g.fill();
  // vignette so the figure reads out of the dark
  const vg = g.createRadialGradient(cx, h * 0.5, 60, cx, h * 0.5, w * 1.15);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,2,8,0.8)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}

function paintPrincess(g, w, h) {
  const cx = w * 0.5, base = h * 0.955;
  // backdrop: a moonlit arch somewhere far above the Crucible
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#171626'); bg.addColorStop(0.55, '#121018'); bg.addColorStop(1, '#0a070c');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(150,160,200,0.10)';
  g.beginPath();
  g.moveTo(cx - 44 * 1, h * 0.62);
  g.quadraticCurveTo(cx, h * 0.06, cx + 44, h * 0.62);
  g.lineTo(cx + 44, h * 0.62);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(222,232,255,0.5)';
  g.beginPath(); g.arc(cx + 22, h * 0.16, 13, 0, TAU); g.fill();
  g.fillStyle = 'rgba(222,232,255,0.06)';
  g.beginPath(); g.arc(cx + 22, h * 0.16, 30, 0, TAU); g.fill();
  const U = h / 430;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.ellipse(cx, base + 3 * U, 34 * U, 8 * U, 0, 0, TAU); g.fill();
  // the gown: bodice, then a skirt falling to the floor
  g.fillStyle = '#8f88c6';
  g.beginPath();
  g.moveTo(cx - 18 * U, 152 * U); g.lineTo(cx + 18 * U, 152 * U);
  g.lineTo(cx + 22 * U, 236 * U); g.lineTo(cx - 22 * U, 236 * U);
  g.closePath(); g.fill();
  g.fillStyle = '#a49cd8';
  g.beginPath();
  g.moveTo(cx - 22 * U, 236 * U); g.lineTo(cx + 22 * U, 236 * U);
  g.lineTo(cx + 40 * U, base); g.lineTo(cx - 40 * U, base);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,62,110,0.55)'; g.lineWidth = 1.6; // the folds
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(cx + i * 9 * U, 240 * U);
    g.lineTo(cx + i * 16 * U, base - 3 * U);
    g.stroke();
  }
  g.strokeStyle = '#e6c477'; g.lineWidth = 2.4; // a sash at the waist
  g.beginPath(); g.moveTo(cx - 21 * U, 232 * U); g.lineTo(cx + 21 * U, 232 * U); g.stroke();
  // sleeves and folded hands
  g.strokeStyle = '#8f88c6'; g.lineWidth = 9 * U; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 16 * U, 160 * U); g.lineTo(cx - 22 * U, 244 * U);
  g.moveTo(cx + 16 * U, 160 * U); g.lineTo(cx + 22 * U, 244 * U);
  g.stroke();
  g.fillStyle = '#e2c8b0';
  g.beginPath(); g.arc(cx, 250 * U, 7 * U, 0, TAU); g.fill();
  // the lantern at her feet, lit
  const lx = cx + 44 * U, ly = base - 26 * U;
  const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 34);
  lg.addColorStop(0, 'rgba(255,214,120,0.5)'); lg.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 34, 0, TAU); g.fill();
  g.strokeStyle = '#a98a50'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(lx, ly - 16); g.lineTo(lx, ly - 24); g.stroke();
  g.fillStyle = '#ffe2a0';
  g.beginPath(); g.arc(lx, ly, 8, 0, TAU); g.fill();
  g.strokeStyle = '#a98a50'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(lx, ly, 10, 0, TAU); g.stroke();
  // hair and a crowned head
  g.fillStyle = '#c9a25c';
  g.beginPath();
  g.moveTo(cx - 16 * U, 106 * U);
  g.bezierCurveTo(cx - 26 * U, 150 * U, cx - 22 * U, 176 * U, cx - 15 * U, 196 * U);
  g.lineTo(cx + 15 * U, 196 * U);
  g.bezierCurveTo(cx + 22 * U, 176 * U, cx + 26 * U, 150 * U, cx + 16 * U, 106 * U);
  g.closePath(); g.fill();
  g.fillStyle = '#e6ccba';
  g.beginPath(); g.arc(cx, 122 * U, 17 * U, 0, TAU); g.fill();
  g.fillStyle = '#a98a50'; // the crown
  g.beginPath();
  g.moveTo(cx - 15 * U, 104 * U); g.lineTo(cx - 15 * U, 92 * U);
  g.lineTo(cx - 7 * U, 100 * U); g.lineTo(cx, 88 * U);
  g.lineTo(cx + 7 * U, 100 * U); g.lineTo(cx + 15 * U, 92 * U);
  g.lineTo(cx + 15 * U, 104 * U);
  g.closePath(); g.fill();
  g.fillStyle = '#7ec7e8';
  g.beginPath(); g.arc(cx, 97 * U, 3 * U, 0, TAU); g.fill();
  // a snapped bracelet at the base: what was held here is free now
  g.strokeStyle = '#c8a45a'; g.lineWidth = 2.4;
  g.beginPath(); g.arc(cx - 30 * U, base - 4 * U, 8 * U, 0.4, 3.4); g.stroke();
  g.beginPath(); g.arc(cx - 18 * U, base - 2 * U, 7 * U, 2.2, 5.4); g.stroke();
  const vg = g.createRadialGradient(cx, h * 0.5, 60, cx, h * 0.5, w * 1.15);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,2,10,0.8)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
const logoBox = document.getElementById('logoArt');
const figL = document.getElementById('artL');
const figR = document.getElementById('artR');
if (logoBox && logoBox.appendChild) {
  const c2 = document.createElement('canvas');
  c2.width = LOGO_W; c2.height = LOGO_H;
  logoBox.appendChild(c2);
  paintLogo(c2.getContext('2d'), LOGO_W, LOGO_H);
}
if (figL && figL.appendChild) {
  const c2 = document.createElement('canvas');
  c2.width = FIG_W; c2.height = FIG_H;
  figL.appendChild(c2);
  paintWarrior(c2.getContext('2d'), FIG_W, FIG_H);
}
if (figR && figR.appendChild) {
  const c2 = document.createElement('canvas');
  c2.width = FIG_W; c2.height = FIG_H;
  figR.appendChild(c2);
  paintPrincess(c2.getContext('2d'), FIG_W, FIG_H);
}
// ============ PART 6a — GRAPHICS: setup + world ============
const cv = document.getElementById('canvas');
const ctx = cv.getContext('2d');
const darkCv = document.createElement('canvas');
const dctx = darkCv.getContext('2d');
let cam = { x: WORLD.w / 2, y: WORLD.h / 2 };
let CW = 400, CH = 400, DPR = 1, ZOOM = 1, SC = 1;
let VW = 400, VH = 400;   // visible world extent (screen px / zoom)
let vx = 0, vy = 0; // top-left of viewport, in world coords

function hexA(hexC, a) {
  const n = parseInt(hexC.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function resize() {
  DPR = Math.min(1.5, window.devicePixelRatio || 1);
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  if (w === CW && h === CH && cv.width === Math.round(w * DPR)) return;
  CW = w; CH = h;
  cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
  darkCv.width = cv.width; darkCv.height = cv.height;
  // CRITICAL: pin the canvas CSS box to exactly the window so that
  // 1 world unit === 1 CSS pixel regardless of devicePixelRatio.
  cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
  // zoom: on large monitors everything at scale 1 looks tiny; keep the
  // visible world height close to ~660 world px so the game is readable
  ZOOM = clamp(Math.min(CW, CH) / 660, 1, 1.9);
  SC = DPR * ZOOM;
  VW = CW / ZOOM; VH = CH / ZOOM;
  cam.x = clamp(cam.x, 0, Math.max(0, WORLD.w - VW));
  cam.y = clamp(cam.y, 0, Math.max(0, WORLD.h - VH));
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

function shadowAt(x, y, r, a) {
  ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, TAU); ctx.fill();
}

function drawFloor() {
  const th = game.th;
  const ts = 64;
  const x0 = Math.floor(vx / ts), x1 = Math.floor((vx + VW) / ts);
  const y0 = Math.floor(vy / ts), y1 = Math.floor((vy + VH) / ts);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const h1 = hash2(tx, ty);
    const base = th.fb + Math.floor(h1 * th.fv);
    ctx.fillStyle = 'rgb(' + (base + th.ft[0]) + ',' + (base + th.ft[1]) + ',' + (base + th.ft[2]) + ')';
    ctx.fillRect(tx * ts - vx, ty * ts - vy, ts + 1, ts + 1);
    if (h1 > 0.9) {
      ctx.fillStyle = th.fm;
      ctx.beginPath();
      ctx.arc(tx * ts - vx + hash2(ty, tx) * ts, ty * ts - vy + h1 * ts * 0.8, 3.4, 0, TAU);
      ctx.fill();
    } else if (hash2(tx * 3 + 7, ty * 5 + 3) < 0.05) {
      ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx * ts - vx + 12, ty * ts - vy + 10);
      ctx.lineTo(tx * ts - vx + 30 + h1 * 20, ty * ts - vy + 34);
      ctx.lineTo(tx * ts - vx + 40, ty * ts - vy + 52);
      ctx.stroke();
    }
  }
}

function drawWalls() {
  const th = game.th;
  for (const w of game.walls) {
    const x = w.x - vx, y = w.y - vy;
    if (x + w.w < -40 || x > VW + 40 || y + w.h < -90 || y > VH + 40) continue;
    // front (south-facing) side — pseudo-3D
    ctx.fillStyle = th.wf;
    ctx.fillRect(x, y + w.h - WALL_H, w.w, WALL_H);
    ctx.strokeStyle = th.we; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + w.h + 0.5 - WALL_H); ctx.lineTo(x + w.w, y + w.h + 0.5 - WALL_H);
    ctx.stroke();
    // top
    ctx.fillStyle = th.wt;
    ctx.fillRect(x, y - WALL_H, w.w, w.h);
    ctx.strokeStyle = th.ws; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y - WALL_H, w.w, w.h);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let bx = x; bx < x + w.w - 14; bx += 28)
      if (hash2(Math.round(bx + vx), Math.round(w.y)) > 0.5) ctx.fillRect(bx, y - WALL_H, 13, 7);
  }
}

// the thirteenth hall's own furniture: a blood carpet down its axis, the dais
// at its head, and the throne there - dim while the lich king stands, cold-
// lit and worded once he is down, which is the hint the player needs (issue
// #69)
function drawThroneRoom(t) {
  if (!game.finalHall || game.checkpoint !== FINAL_LEVEL) return;
  const hl = game.finalHall, tr = game.throne;
  const cxc = (hl.x + hl.w / 2) * TS;
  const top = (hl.y + 1.0) * TS, bot = (hl.y + hl.h - 1.3) * TS;
  const cx2 = cxc - vx, tp = top - vy;
  // the carpet, woven pale at the edges
  ctx.fillStyle = '#571317';
  ctx.fillRect(cx2 - 56, tp, 112, bot - top);
  ctx.strokeStyle = 'rgba(204,174,122,0.5)'; ctx.lineWidth = 2.5;
  ctx.strokeRect(cx2 - 50, tp + 6, 100, bot - top - 12);
  ctx.fillStyle = 'rgba(204,174,122,0.10)';
  ctx.fillRect(cx2 - 7, tp + 12, 14, bot - top - 24);
  // two steps of dais under the throne
  ctx.fillStyle = '#241f29'; ctx.fillRect(cx2 - 104, tp - 30, 208, 32);
  ctx.fillStyle = '#2e2735'; ctx.fillRect(cx2 - 82, tp - 46, 164, 18);
  if (!tr) return;
  const tx2 = tr.x - vx, ty2 = tr.y - vy;
  const wake = tr.active ? 1 : 0;
  const pulse = wake ? (0.5 + 0.5 * Math.sin(t * 2.6 + tr.t)) : 0;
  if (wake) {
    ctx.fillStyle = 'rgba(120,238,164,' + (0.13 + 0.10 * pulse) + ')';
    ctx.beginPath(); ctx.ellipse(tx2, ty2 + 10, 56 + pulse * 10, 30, 0, 0, TAU); ctx.fill();
  }
  // a banner of pale bone hung behind the seat
  ctx.fillStyle = 'rgba(176,172,186,0.15)';
  ctx.fillRect(tx2 - 44, ty2 - 106, 88, 30);
  // the throne: a tall gothic back of bone spires, wide arms, a skull finial
  ctx.fillStyle = '#221c26';
  ctx.beginPath();
  ctx.moveTo(tx2 - 26, ty2 + 22); ctx.lineTo(tx2 - 30, ty2 - 62);
  ctx.lineTo(tx2 - 13, ty2 - 86); ctx.lineTo(tx2 + 13, ty2 - 86);
  ctx.lineTo(tx2 + 30, ty2 - 62); ctx.lineTo(tx2 + 26, ty2 + 22);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = wake ? 'rgba(150,242,180,' + (0.48 + 0.3 * pulse) + ')' : 'rgba(150,142,168,0.34)';
  ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#2a2331';
  ctx.fillRect(tx2 - 32, ty2 - 4, 64, 9);
  ctx.fillRect(tx2 - 34, ty2 - 22, 9, 24); ctx.fillRect(tx2 + 25, ty2 - 22, 9, 24);
  ctx.fillStyle = wake ? 'rgba(94,222,150,0.5)' : 'rgba(86,20,26,0.92)';
  ctx.fillRect(tx2 - 25, ty2 - 6, 50, 7);
  ctx.fillStyle = '#c8c2b2';
  ctx.beginPath(); ctx.arc(tx2, ty2 - 90, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#221c26';
  ctx.fillRect(tx2 - 4, ty2 - 93, 2.4, 3); ctx.fillRect(tx2 + 2, ty2 - 93, 2.4, 3);
  if (wake) {
    // the word that tells the player the seat is awake
    ctx.fillStyle = 'rgba(226,246,170,0.92)';
    ctx.font = '11px serif';
    ctx.fillText('THE THRONE IS AWAKE', tx2 - 54, ty2 - 118);
  }
}

function drawTorches(t) {
  const th = game.th;
  for (const tc of game.torches) {
    const x = tc.x - vx, y = tc.y - vy;
    if (x < -50 || x > VW + 50 || y < -50 || y > VH + 50) continue;
    const fl = Math.sin(t * 7 + tc.ph) * 0.5 + Math.sin(t * 13.7 + tc.ph * 2) * 0.3;
    const fx = x + fl * 1.6;
    if (tc.candle) {
      // a free-standing candelabra: stem, cup and three cold flames
      ctx.fillStyle = '#6a6455';
      ctx.fillRect(x - 1.8, y - 21, 3.6, 24);
      ctx.beginPath(); ctx.ellipse(x, y + 3, 9, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillRect(x - 9, y - 22, 18, 2.6);
      ctx.fillStyle = th.fl;
      for (const ci of [-9, 0, 9]) {
        const fh = (ci === 0 ? 9.5 : 7) + fl * 1.6;
        ctx.beginPath(); ctx.ellipse(x + ci + fl * 1.2, y - 26 - (ci === 0 ? 5 : 0), 3.1, fh, 0, 0, TAU); ctx.fill();
      }
      continue;
    }
    ctx.fillStyle = th.br;
    ctx.fillRect(x - 1.5, y - 13, 3, 13);
    ctx.fillStyle = th.fl;
    ctx.beginPath(); ctx.ellipse(fx, y - 17 - fl * 2, 4.4, 7.5 + fl * 1.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = th.fc;
    ctx.beginPath(); ctx.ellipse(fx, y - 17 - fl * 2, 2.1, 3.7, 0, 0, TAU); ctx.fill();
  }
}
// ============ PART 6b — entities ============
const RCOLOR = { common: '#e8e4d8', magic: '#4f8ef0', rare: '#a34fd8', legend: '#ff8a3a' };

function drawGroundFX() {
  for (const d of game.decals) {
    ctx.fillStyle = 'rgba(58,10,10,0.16)';
    ctx.beginPath(); ctx.ellipse(d.x - vx, d.y - vy, d.r, d.r * 0.6, 0, 0, TAU); ctx.fill();
  }
  for (const c of game.corpses) {
    const a = Math.min(1, c.life / 14) * 0.5;
    ctx.save(); ctx.translate(c.x - vx, c.y - vy); ctx.rotate(c.angle);
    ctx.fillStyle = hexA(c.color, a);
    ctx.beginPath(); ctx.ellipse(0, 0, c.r, c.r * 0.62, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(c.r * 0.95, 0, c.r * 0.36, 0, TAU); ctx.fill();
    ctx.restore();
  }
  for (const g of game.goldpiles) {
    const x = g.x - vx, y = g.y - vy;
    if (x < -30 || x > VW + 30 || y < -30 || y > VH + 30) continue;
    shadowAt(x, y + 2, g.r + 4, 0.22);
    for (let i = 0; i < 4; i++) {
      const ox = (hash2(Math.round(g.x) + i, Math.round(g.y)) - 0.5) * 18;
      const oy = (hash2(Math.round(g.y) + i, Math.round(g.x)) - 0.5) * 9;
      ctx.fillStyle = '#e8c24a';
      ctx.beginPath(); ctx.arc(x + ox, y + oy, 3.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff3bc';
      ctx.beginPath(); ctx.arc(x + ox - 1, y + oy - 1, 1.2, 0, TAU); ctx.fill();
    }
  }
  // the wandering merchant: cart + hooded trader + coin pouch glint (issue #34)
  if (game.merchant) {
    const mx = game.merchant.x - vx, my = game.merchant.y - vy;
    if (mx > -40 && mx < VW + 40 && my > -40 && my < VH + 40) {
      shadowAt(mx, my + 6, 18, 0.3);
      ctx.fillStyle = '#4a3318'; ctx.fillRect(mx - 19, my - 8, 16, 12);
      ctx.fillStyle = '#c8a45a'; ctx.fillRect(mx - 19, my - 11, 16, 3);
      ctx.fillStyle = '#2a2218';
      ctx.beginPath(); ctx.arc(mx - 14, my + 5, 3, 0, TAU); ctx.arc(mx - 6, my + 5, 3, 0, TAU); ctx.fill();
      const b = Math.sin(game.time * 2.2 + game.merchant.bob) * 1.2;
      ctx.fillStyle = '#6a4a3a';
      ctx.beginPath();
      ctx.moveTo(mx + 8, my - 14 + b); ctx.lineTo(mx + 16, my - 14 + b);
      ctx.lineTo(mx + 18, my + 6); ctx.lineTo(mx + 6, my + 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a5a';
      ctx.beginPath(); ctx.arc(mx + 12, my - 16 + b, 4.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1d1712';
      ctx.beginPath(); ctx.arc(mx + 12.6, my - 15.4 + b, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8c860';
      ctx.beginPath(); ctx.arc(mx + 17, my - 2, 2.6 + Math.sin(game.time * 4) * 0.6, 0, TAU); ctx.fill();
    }
  }
  // treasure chests — closed: proud lid + gold trim + lock; opened: tipped lid
  // and a blue shimmer where the magic item popped out (issue #19)
  for (const ch of game.chests) {
    const x = ch.x - vx, y = ch.y - vy;
    if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue;
    shadowAt(x, y + 6, 16, 0.3);
    if (!ch.open) {
      ctx.fillStyle = '#5d3f22'; ctx.fillRect(x - 13, y - 10, 26, 12);
      ctx.fillStyle = '#7a5530'; ctx.fillRect(x - 13, y - 17, 26, 8);
      ctx.strokeStyle = '#c8a45a'; ctx.lineWidth = 2;
      ctx.strokeRect(x - 13, y - 17, 26, 19);
      ctx.beginPath(); ctx.moveTo(x - 13, y - 9); ctx.lineTo(x + 13, y - 9); ctx.stroke();
      ctx.fillStyle = '#e8c860';
      ctx.beginPath(); ctx.arc(x, y - 6, 2.6, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#4a3318'; ctx.fillRect(x - 13, y - 9, 26, 11);
      ctx.save();
      ctx.translate(x - 13, y - 9); ctx.rotate(-0.85);
      ctx.fillStyle = '#7a5530'; ctx.fillRect(0, -7, 26, 7);
      ctx.strokeStyle = '#c8a45a'; ctx.lineWidth = 1.5; ctx.strokeRect(0, -7, 26, 7);
      ctx.restore();
      ctx.fillStyle = '#1d150b'; ctx.fillRect(x - 11, y - 7, 22, 6);
      const pulse = 0.18 + Math.sin(game.time * 3.2 + ch.x) * 0.06;
      ctx.fillStyle = 'rgba(120,170,255,' + pulse + ')';
      ctx.beginPath(); ctx.arc(x, y - 3, 11, 0, TAU); ctx.fill();
    }
  }
  for (const it of game.drops) {
    if (it.life < 4 && Math.sin(it.life * 11) > 0.4) continue;
    const x = it.x - vx, y = it.y - vy + Math.sin(it.bob) * 3;
    if (x < -30 || x > VW + 30 || y < -30 || y > VH + 30) continue;
    const col = RCOLOR[it.item.rarity];
    ctx.fillStyle = hexA(col, 0.2);
    ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5.5, -5.5, 11, 11); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(x - 1.6, y - 7.5, 3.2, 15);
    ctx.fillRect(x - 7.5, y - 1.6, 15, 3.2);
  }
  for (const g of game.globes) {
    if (g.life < 3 && Math.sin(g.life * 14) > 0.5) continue;
    const x = g.x - vx, y = g.y - vy;
    if (x < -20 || x > VW + 20 || y < -20 || y > VH + 20) continue;
    ctx.fillStyle = hexA(g.color, 0.28);
    ctx.beginPath(); ctx.arc(x, y, g.r + 5, 0, TAU); ctx.fill();
    ctx.fillStyle = g.color;
    ctx.beginPath(); ctx.arc(x, y, g.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(x - g.r * 0.3, y - g.r * 0.32, g.r * 0.36, 0, TAU); ctx.fill();
  }
}

// two visual states (issue #9): dim + dashed ring while the boss lives,
// bright, fast-spinning + pulsing once the boss is slain
// the gate only blazes once this level's overlord has been put down;
// while one is still pending (issue #57) it stays dark no matter what
function portalActive() { return !game.bossPending && (game.boss === null || game.boss.dead); }
function drawPortalG(t) {
  if (!game.portal) return;
  const p = game.portal;
  const x = p.x - vx, y = p.y - vy;
  if (x < -80 || x > VW + 80 || y < -80 || y > VH + 80) return;
  const on = portalActive();
  const dim = on ? 1 : 0.34;
  shadowAt(x, y + 6, 24, 0.35);
  ctx.save(); ctx.translate(x, y);
  if (!on) {
    // dormant: a slow, dashed containment ring hints that it is inert
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(120,150,165,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (let i = 0; i < 3; i++) {
    const rr = 9 + i * 6.5;
    const sp = (i % 2 ? -1 : 1) * ((on ? 1 : 0.22) * (t * 1.6 + p.t * 2));
    ctx.strokeStyle = 'rgba(80,200,245,' + ((0.8 - i * 0.22) * dim) + ')';
    ctx.lineWidth = 3.2 - i * 0.7;
    ctx.beginPath(); ctx.arc(0, 0, rr, sp, sp + Math.PI * 1.55); ctx.stroke();
  }
  const core = 6.5 + Math.sin(t * 5) * 2;
  if (on) {
    ctx.fillStyle = 'rgba(175,240,255,0.92)';
    ctx.beginPath(); ctx.arc(0, 0, core, 0, TAU); ctx.fill();
    // outward pulse ring while active
    const pr = 22 + (t * 26) % 20;
    ctx.strokeStyle = 'rgba(150,230,255,' + (0.55 * (1 - ((t * 26) % 20) / 20)) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.stroke();
  } else {
    // dormant core: dull, grey-teal, barely breathing
    ctx.fillStyle = 'rgba(95,130,145,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, core * 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function visOn(e, pad) {
  const x = e.x - vx, y = e.y - vy;
  return x > -pad && x < VW + pad && y > -pad && y < VH + pad;
}
// ============ PART 6c — monsters & player ============
function drawMonster(m, t) {
  const x = m.x - vx, y = m.y - vy;
  if (!visOn(m, 70)) return;
  const r = m.r;
  const bob = Math.sin(m.wob) * 2;
  shadowAt(x, y + r * 0.28, r * 0.95, 0.32);
  if (m.elite) {
    ctx.strokeStyle = 'rgba(216,162,60,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.28, r + 6, (r + 6) * 0.55, 0, 0, TAU); ctx.stroke();
  }
  // a poisoned foe wears the venom (issue #73): a green coat under a green
  // haze, with bubbles climbing off it. The read is loud on its own, so the
  // foe you are holding venom on is obvious across a whole dark room, and
  // it stays obvious for the whole half-minute the dose is worth
  const col = m.poison > 0 ? POISON_TINT : m.slow > 0 ? '#6ea8d8' : m.color;
  if (m.poison > 0) {
    // the stink of it, hugging the body so the shape still reads through
    ctx.fillStyle = 'rgba(96,168,50,0.2)';
    ctx.beginPath(); ctx.arc(x, y - r * 0.5 + bob, r * 1.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9ed05a';
    for (let i2 = 0; i2 < 3; i2++) {
      // three bubbles climbing the body, staggered and wrapping round
      const ph = ((m.wob * 0.5 + i2 * 2.1) % 3) / 3;
      ctx.globalAlpha = 0.85 - ph * 0.55;
      ctx.beginPath();
      ctx.arc(x + Math.sin(m.wob + i2 * 2.1) * r * 0.52,
        y - r * (0.18 + ph * 1.3) + bob, r * (0.14 - ph * 0.05), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // body
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(x, y - r * 0.4 + bob, r * 0.85, r * 0.72, 0, 0, TAU); ctx.fill();
  // head
  ctx.beginPath(); ctx.arc(x, y - r * 1.22 + bob, r * 0.44, 0, TAU); ctx.fill();
  // type traits
  if (m.type === 'archer') {
    ctx.strokeStyle = '#6b4a28'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - r * 0.7 + bob, r * 1.05, m.angle - 0.95, m.angle + 0.95); ctx.stroke();
  } else if (m.type === 'cultist') {
    ctx.fillStyle = 'rgba(18,10,22,0.85)';
    ctx.beginPath(); ctx.arc(x, y - r * 1.2 + bob, r * 0.5, 0, TAU); ctx.fill();
  } else if (m.type === 'skeleton') {
    ctx.fillStyle = 'rgba(20,20,20,0.9)';
    ctx.fillRect(x - r * 0.3, y - r * 0.55 + bob, r * 0.6, 2);
    ctx.fillRect(x - r * 0.3, y - r * 0.2 + bob, r * 0.6, 2);
  } else if (m.type === 'orc') {
    // iron pauldrons + tusks for the brute
    ctx.fillStyle = '#3c424c';
    ctx.beginPath();
    ctx.arc(x - r * 0.58, y - r * 0.52 + bob, r * 0.3, 0, TAU);
    ctx.arc(x + r * 0.58, y - r * 0.52 + bob, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e6dcbe';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.2, y - r * 1.05 + bob); ctx.lineTo(x - r * 0.34, y - r * 1.34 + bob); ctx.lineTo(x - r * 0.06, y - r * 1.16 + bob); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, y - r * 1.05 + bob); ctx.lineTo(x + r * 0.34, y - r * 1.34 + bob); ctx.lineTo(x + r * 0.06, y - r * 1.16 + bob); ctx.closePath(); ctx.fill();
  } else if (m.type === 'boss') {
    ctx.fillStyle = '#3a2222';
    // horns + a sigil read off the overlord's index (issue #51), so the ten
    // fights look like ten men and not the same one ten times over
    const hl = 0.9 + ((m.sig || 0) % 4) * 0.17;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.62, y - r * 1.5 + bob);
    ctx.lineTo(x - r * 0.32, y - r * 0.8 + bob);
    ctx.lineTo(x - r * 0.9, y - r * (0.72 + hl) + bob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.62, y - r * 1.5 + bob);
    ctx.lineTo(x + r * 0.32, y - r * 0.8 + bob);
    ctx.lineTo(x + r * 0.9, y - r * (0.72 + hl) + bob);
    ctx.closePath(); ctx.fill();
    if ((m.sig || 0) % 3 === 0) {
      // a spiked crown
      ctx.fillStyle = '#c8a24c';
      for (let ci = -1; ci <= 1; ci++) {
        const cx2 = x + ci * r * 0.24;
        ctx.beginPath();
        ctx.moveTo(cx2 - r * 0.07, y - r * 1.52 + bob);
        ctx.lineTo(cx2, y - r * (1.74 + (ci === 0 ? 0.16 : 0)) + bob);
        ctx.lineTo(cx2 + r * 0.07, y - r * 1.52 + bob);
        ctx.closePath(); ctx.fill();
      }
    } else if ((m.sig || 0) % 3 === 1) {
      // iron spauldrons
      ctx.fillStyle = '#3c424c';
      ctx.beginPath();
      ctx.arc(x - r * 0.62, y - r * 0.56 + bob, r * 0.3, 0, TAU);
      ctx.arc(x + r * 0.62, y - r * 0.56 + bob, r * 0.3, 0, TAU);
      ctx.fill();
    } else {
      // a torn mantle over the shoulders
      ctx.fillStyle = 'rgba(26,12,18,0.8)';
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.62 + bob, r * 0.95, r * 0.42, 0, 0, TAU); ctx.fill();
    }
    if ((m.sig || 0) >= 8) {
      // the two crowned overlords carry a second, shorter pair inside the first
      ctx.fillStyle = '#241318';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y - r * 1.44 + bob);
      ctx.lineTo(x - r * 0.12, y - r * 0.9 + bob);
      ctx.lineTo(x - r * 0.46, y - r * (1.5 + hl * 0.5) + bob);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.3, y - r * 1.44 + bob);
      ctx.lineTo(x + r * 0.12, y - r * 0.9 + bob);
      ctx.lineTo(x + r * 0.46, y - r * (1.5 + hl * 0.5) + bob);
      ctx.closePath(); ctx.fill();
    }
    if (m.lich) {
      // the lich king: a cold aura under him, a taller skull-crown than any
      // overlord wears, and a reaping scythe held out along his aim (issue
      // #69) - and he is bred far wider than the rest of them
      ctx.strokeStyle = 'rgba(126,238,168,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.34, r * 1.02, r * 0.58, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(120,238,164,0.12)';
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.4 + bob, r * 1.0, r * 0.86, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d2c2';
      for (let ci = -2; ci <= 2; ci++) {
        const cx3 = x + ci * r * 0.17;
        ctx.beginPath();
        ctx.moveTo(cx3 - r * 0.05, y - r * 1.58 + bob);
        ctx.lineTo(cx3, y - r * (1.94 + (ci === 0 ? 0.2 : 0)) + bob);
        ctx.lineTo(cx3 + r * 0.05, y - r * 1.58 + bob);
        ctx.closePath(); ctx.fill();
      }
      const ax2 = Math.cos(m.angle), ay2 = Math.sin(m.angle);
      ctx.strokeStyle = '#6a5c4a'; ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(x + ax2 * r * 0.4, y - r * 0.5 + bob + ay2 * r * 0.4);
      ctx.lineTo(x + ax2 * r * 1.55, y - r * 0.3 + bob + ay2 * r * 1.55);
      ctx.stroke();
      ctx.strokeStyle = '#c8d4cc'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + ax2 * r * 1.55, y - r * 0.3 + bob + ay2 * r * 1.55);
      ctx.quadraticCurveTo(x + ax2 * r * 1.9, y - r * 1.0 + bob + ay2 * r * 1.5,
        x + ax2 * r * 1.5, y - r * 1.1 + bob + ay2 * r * 1.1);
      ctx.stroke();
    }
  } else if (m.type === 'fallen') {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y - r * 1.3 + bob);
    ctx.lineTo(x - r * 0.55, y - r * 1.85 + bob);
    ctx.lineTo(x - r * 0.05, y - r * 1.45 + bob);
    ctx.closePath(); ctx.fill();
  }
  // eyes
  const ex = Math.cos(m.angle) * r * 0.18, ey = Math.sin(m.angle) * r * 0.18;
  ctx.fillStyle = m.type === 'boss' ? '#ffe14a' : m.elite ? '#ffd75e' : '#f4e4a8';
  ctx.beginPath();
  ctx.arc(x - r * 0.16 + ex, y - r * 1.22 + ey + bob, 1.7, 0, TAU);
  ctx.arc(x + r * 0.16 + ex, y - r * 1.22 + ey + bob, 1.7, 0, TAU);
  ctx.fill();
  // hit flash
  if (m.hitFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (m.hitFlash / 0.12 * 0.65) + ')';
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.4 + bob, r * 0.85, r * 0.72, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - r * 1.22 + bob, r * 0.44, 0, TAU); ctx.fill();
  }
  // hp bar
  if (m.hp < m.hpMax && m.type !== 'boss') {
    const bw = r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(x - bw / 2 - 1, y - r * 2 - 4, bw + 2, 5);
    ctx.fillStyle = m.elite ? '#e8a030' : '#c22626';
    ctx.fillRect(x - bw / 2, y - r * 2 - 3, bw * Math.max(0, m.hp / m.hpMax), 3);
  }
}

// the equipped weapon, painted in the hero's hand (issue #53): what you wear
// is what you see, and an empty hand is a bare fist
function drawHandWeapon(wk, hx, hy, ang, flare, reach) {
  if (reach === undefined) reach = 1; // issue #74: a melee swing stretches
  // the haft so the axe head rides the sweep it leaves, not the fist
  if (!wk) return;
  if (wk === 'sword') {
    ctx.strokeStyle = '#cad3de'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(ang) * 3, hy - Math.sin(ang) * 3);
    ctx.lineTo(hx + Math.cos(ang) * 14, hy + Math.sin(ang) * 14);
    ctx.stroke();
    ctx.strokeStyle = '#c8a45a'; ctx.lineWidth = 2.4; // the guard
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(ang + Math.PI / 2) * 3.4, hy - Math.sin(ang + Math.PI / 2) * 3.4);
    ctx.lineTo(hx + Math.cos(ang + Math.PI / 2) * 3.4, hy + Math.sin(ang + Math.PI / 2) * 3.4);
    ctx.stroke();
    return;
  }
  if (wk === 'axe') {
    const rz = reach; // reopened #74: during a swing the haft stretches,
    // so the ONE weapon on the figure is the one biting at the arc
    ctx.strokeStyle = '#6b4a28'; ctx.lineWidth = 2.6; // the haft
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(ang) * 6 * rz, hy - Math.sin(ang) * 6 * rz);
    ctx.lineTo(hx + Math.cos(ang) * 13 * rz, hy + Math.sin(ang) * 13 * rz);
    ctx.stroke();
    const pa = ang + Math.PI / 2;
    const ax = hx + Math.cos(ang) * 10 * rz, ay = hy + Math.sin(ang) * 10 * rz;
    ctx.fillStyle = '#b8c1cb'; // a broad axe head
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(ang) * 4 * rz, ay - Math.sin(ang) * 4 * rz);
    ctx.lineTo(ax + Math.cos(pa) * 7.5 * rz, ay + Math.sin(pa) * 7.5 * rz);
    ctx.lineTo(ax + Math.cos(ang) * 6 * rz + Math.cos(pa) * 4 * rz, ay + Math.sin(ang) * 6 * rz + Math.sin(pa) * 4 * rz);
    ctx.lineTo(ax + Math.cos(ang) * 6 * rz - Math.cos(pa) * 4 * rz, ay + Math.sin(ang) * 6 * rz - Math.sin(pa) * 4 * rz);
    ctx.lineTo(ax - Math.cos(pa) * 7.5 * rz, ay - Math.sin(pa) * 7.5 * rz);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7f8791'; ctx.lineWidth = 1; // the socket
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(pa) * 7 * rz, ay - Math.sin(pa) * 7 * rz);
    ctx.lineTo(ax + Math.cos(pa) * 7 * rz, ay + Math.sin(pa) * 7 * rz);
    ctx.stroke();
    return;
  }
  if (wk === 'bow') {
    const pa = ang; // issue #61: the centre of the wooden arc LEADS toward
    // the cursor and the string chord rides behind the grip - the other way
    // round it reads as a bow carried by the limb, tip-first into the fight
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(hx, hy, 10, pa - 1.2, pa + 1.2);
    ctx.stroke();
    const t1 = pa - 1.2, t2 = pa + 1.2;
    ctx.strokeStyle = 'rgba(228,222,200,0.85)'; ctx.lineWidth = 1; // the string
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(t1) * 10, hy + Math.sin(t1) * 10);
    ctx.lineTo(hx + Math.cos(t2) * 10, hy + Math.sin(t2) * 10);
    ctx.stroke();
    if (flare) { // an arrow nocked while the shot is being drawn
      ctx.strokeStyle = '#cbb795'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - Math.cos(ang) * 5, hy - Math.sin(ang) * 5);
      ctx.lineTo(hx + Math.cos(ang) * 15, hy + Math.sin(ang) * 15);
      ctx.stroke();
    }
    return;
  }
  if (wk === 'staff') { // a long haft topped with an arcane crystal
    ctx.strokeStyle = '#6e4b2c'; ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(ang) * 7, hy - Math.sin(ang) * 7);
    ctx.lineTo(hx + Math.cos(ang) * 16, hy + Math.sin(ang) * 16);
    ctx.stroke();
    const sx = hx + Math.cos(ang) * 16, sy = hy + Math.sin(ang) * 16;
    const rad = flare ? 9 : 6.5;
    const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g2.addColorStop(0, '#ecf8ff');
    g2.addColorStop(0.45, flare ? 'rgba(180,225,255,0.9)' : 'rgba(138,199,232,0.65)');
    g2.addColorStop(1, 'rgba(138,199,232,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.fill();
    ctx.fillStyle = '#cfeaf8';
    ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, TAU); ctx.fill();
  }
}

// ---------- the three ways the hero stands when nothing is asked (issue #72) ----------
// The first quarter-minute of standing puts one of these three up, and every
// five idle seconds after that another one goes. Each moves a different part
// of the figure so the three read as three different things: the first rocks
// the whole body over its planted feet, the second takes the weapon off the
// shoulder and brings it up to eye height to look at it, the third leaves the
// body put and turns the head over whatever is down the halls. Only the
// amounts change between them, which is why the row is data and not three
// drawings - the drawing is the same limbs, asked for a different amount.
// reopened #72: the cadence was already three-deep and random, but at the
// gameplay camera a 2 px sway all three of them shared reads as "the same
// animation" every time. Each routine is now unmistakable at that zoom:
// he heaves his weight shoulder-wide, hoists the weapon to eye line, or
// turns the head a full hand's width over both shoulders
const IDLE = [
  { dur: 1.9, lean: 0.11, bob: 3.2, feet: 0.55, arm: 0.18, hand: 4.5, head: 1.6,
    dip: 1.8, crest: 2.4, lift: 0.7 }, // shifts its weight over planted feet
  { dur: 2.7, lean: 0.03, bob: 1.6, feet: 0.1, arm: 0.5, hand: 11, head: 1.8,
    dip: 3.0, crest: 1.2, lift: 1.35 }, // brings the weapon up and reads it
  { dur: 2.4, lean: 0.05, bob: 2.0, feet: 0.15, arm: 0.1, hand: 2.5, head: 7.5,
    dip: 1.2, crest: 4.0, lift: 0.35 }, // stands put and turns over the halls
];
const IDLE_FIRST = 15; // seconds of standing before the first routine
const IDLE_AGAIN = 5;  // and seconds of standing between routines
// the routine that comes next: drawn at random out of the two that are not
// the one just played, which is what makes the three alternate
function pickIdle() {
  const last = P.idleAnim;
  const pool = [];
  for (let a2 = 0; a2 < IDLE.length; a2++) if (a2 !== last) pool.push(a2);
  P.idleAnim = pool[Math.floor(Math.random() * pool.length)];
  P.idleP = 0.001;
}
// the pose a routine holds at progress p. Every field is how far a part of
// the figure has moved by then, so p = 0 and p = 1 both put the hero back
// where he stands: the routines start and end on the plain idle stance and
// never leave a shifted figure behind. The head rides a full turn (sweep)
// rather than an out-and-back, so it looks over one shoulder and then the
// other, which is what a man standing put in the dark actually does.
function idlePose(a2, p) {
  const row = IDLE[clamp(Math.floor(a2), 0, IDLE.length - 1)];
  const arc = Math.sin(clamp(p, 0, 1) * Math.PI); // out and back again
  const sweep = Math.sin(clamp(p, 0, 1) * TAU); // one turn across
  return {
    lean: row.lean * arc, bob: row.bob * arc, feet: row.feet * arc,
    arm: row.arm * arc, hand: row.hand * arc, lift: row.lift * arc,
    head: row.head * sweep, dip: row.dip * arc, crest: row.crest * arc,
  };
}

function drawPlayer() {
  const x = P.x - vx;
  // being seated on the last throne: the figure settles down onto the seat over
  // the first half second and stays there until the window is closed (issue #69)
  const seatT = (game.seat > 0) ? Math.min(1, game.seat / 0.5) : 0;
  const y = P.y - vy + seatT * P.r * 0.36;
  shadowAt(x, P.y - vy + 6, P.r * 1.1, 0.4);
  const faceX = (P.faceX || 1);
  // which of the three routines is running, and how far through it it is
  const idling = P.idleP > 0;
  const pose = idling ? idlePose(P.idleAnim, P.idleP)
    : { lean: 0, bob: 0, feet: 0, arm: 0, hand: 0, head: 0, dip: 0, crest: 0, lift: 0 };
  if (idling) {
    // the whole figure leans over its planted feet as the weight shifts side to
    // side, so the shadow stays put while the body rocks above it
    ctx.save();
    ctx.translate(x, y + 4);
    ctx.rotate(pose.lean * faceX);
    ctx.translate(-x, -(y + 4));
  }
  const bob = Math.sin(P.walkPhase) * (Math.abs(Math.cos(P.walkPhase)) > 0.2 ? 2 : 1) + pose.bob;
  const r = P.r;
  const cl = CLASSES[P.cls || 'barbar']; // class colors (issue #22)
  const bare = !!cl.topless; // the barbarian wears furs, not a cuirass (issue #52)
  const eqw = P.eq.weapon;
  const wk = eqw ? eqw.wk : null; // what is in the hand (issue #53)
  const ranged = rangedWeapon(); // a bow or a staff shoots: it never swings
  // the swing arc: only a weapon that swings leaves one (issue #53)
  const swingT = (P.atkT > P.atkCd - 0.3) ? Math.max(0, Math.min(1, (P.atkCd - P.atkT) / 0.3)) : -1;
  if (swingT >= 0 && !ranged) {
    const sa = P.aim - 0.7 + 1.4 * swingT;
    if (wk === 'axe') {
      // reopened #74: an axe bite is its own heavier, bone-pale chop - the
      // hafted sweep reads nothing like a sword's thin steel flash
      ctx.strokeStyle = 'rgba(233,229,205,0.9)'; ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(sa) * 8, y - 6 + Math.sin(sa) * 8);
      ctx.lineTo(x + Math.cos(sa) * 46, y - 6 + Math.sin(sa) * 46);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(233,229,205,' + (0.75 * (1 - swingT)) + ')';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y - 6, P.atkRange * 0.85, P.aim - 1.0 + 1.6 * swingT, P.aim - 0.2 + 1.6 * swingT);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(235,238,250,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(sa) * 8, y - 6 + Math.sin(sa) * 8);
      ctx.lineTo(x + Math.cos(sa) * 30, y - 6 + Math.sin(sa) * 30);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(245,245,255,' + (0.8 * (1 - swingT)) + ')';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(x, y - 6, P.atkRange * 0.8, P.aim - 1.0 + 1.6 * swingT, P.aim - 0.2 + 1.6 * swingT);
      ctx.stroke();
    }
  }
  // --- walk cycle phase ---
  const w = P.walkPhase;
  const moving = w > 0.05;
  const s = moving ? Math.sin(w) : 0;          // leg swing (-1..1)
  const hipY = y - r * 0.34 + bob * 0.6;
  const shY = y - r * 0.92 + bob * 0.6;        // shoulder line
  const legLen = r * 0.62;
  // legs: steel greaves swinging opposite under the hips
  // seated legs: thighs out of the hips, shins down off the edge of the seat
  const sat = seatT > 0.5;
  // the feet slide apart and back together under the body: that is what a
  // weight shift has to do to its planted feet, and the seated hero keeps
  // his legs on the dais (issue #72)
  const f1x = sat ? x - r * 0.44 : x - r * 0.2 + s * faceX * r * 0.4 + pose.feet * faceX * r;
  const f1y = sat ? y + r * 0.24 : y - r * 0.34 + legLen + Math.abs(s) * 1.8;
  const f2x = sat ? x + r * 0.44 : x + r * 0.2 - s * faceX * r * 0.4 - pose.feet * faceX * r;
  const f2y = sat ? y + r * 0.24 : y - r * 0.34 + legLen + Math.abs(s) * 1.8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = bare ? cl.skin : '#2c3442'; ctx.lineWidth = r * 0.27;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.19, hipY + 1); ctx.lineTo(f1x, f1y);
  ctx.moveTo(x + r * 0.19, hipY + 1); ctx.lineTo(f2x, f2y);
  ctx.stroke();
  // boots
  ctx.fillStyle = bare ? cl.paul : '#1f242e'; // fur wraps instead of steel boots
  ctx.beginPath(); ctx.arc(f1x, f1y + 1, r * 0.15, 0, TAU); ctx.arc(f2x, f2y + 1, r * 0.15, 0, TAU); ctx.fill();
  // tassets/skirt over the hips
  ctx.fillStyle = cl.arm;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, hipY - 2); ctx.lineTo(x + r * 0.42, hipY - 2);
  ctx.lineTo(x + r * 0.34, hipY + r * 0.3); ctx.lineTo(x - r * 0.34, hipY + r * 0.3);
  ctx.closePath(); ctx.fill();
  // armored cuirass (trapezoid torso) - or a bare chest under a pelt (issue #52)
  ctx.lineJoin = 'round';
  ctx.fillStyle = bare ? cl.skin : cl.arm;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.44, shY); ctx.lineTo(x + r * 0.44, shY);
  ctx.lineTo(x + r * 0.36, hipY + 1); ctx.lineTo(x - r * 0.36, hipY + 1);
  ctx.closePath(); ctx.fill();
  if (bare) {
    // a bear hide hung off the near shoulder, so one side of the chest is bare
    // and the other is furred - the barbarian is topless, not under-armoured
    ctx.fillStyle = cl.paul;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.46, shY - 1); ctx.lineTo(x + r * 0.08, shY + 1);
    ctx.lineTo(x + r * 0.26, hipY - r * 0.06); ctx.lineTo(x - r * 0.3, hipY - r * 0.02);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5d4326'; ctx.lineWidth = 1.4; // the torn hem of the hide
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, hipY - r * 0.02); ctx.lineTo(x + r * 0.26, hipY - r * 0.06);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(96,58,40,0.5)'; ctx.lineWidth = 1.2; // the bare shoulder
    ctx.beginPath();
    ctx.moveTo(x + r * 0.16, shY + r * 0.16); ctx.lineTo(x + r * 0.4, shY + r * 0.2);
    ctx.moveTo(x + r * 0.18, shY + r * 0.32); ctx.lineTo(x + r * 0.4, shY + r * 0.36);
    ctx.stroke();
  } else {
    ctx.strokeStyle = cl.arm; ctx.lineWidth = 3; ctx.stroke(); // round the corners
    // gold central ridge
    ctx.strokeStyle = cl.trim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, shY + 1.5); ctx.lineTo(x, hipY); ctx.stroke();
  }
  ctx.strokeStyle = '#8a6a34'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - r * 0.38, hipY - 1); ctx.lineTo(x + r * 0.38, hipY - 1); ctx.stroke();
  // pauldrons
  ctx.fillStyle = cl.paul;
  ctx.beginPath(); ctx.arc(x - r * 0.44, shY + 1, r * 0.21, 0, TAU); ctx.arc(x + r * 0.44, shY + 1, r * 0.21, 0, TAU); ctx.fill();
  // arms: right holds the sword (swings with the slash), left counter-swings
  const armS = moving ? Math.sin(w) : 0;
  const hRx = x + r * 0.52 + (P.atkT > P.atkCd - 0.3 ? Math.cos(P.aim) * r * 0.35 : -armS * faceX * r * 0.3 + pose.arm * faceX * r);
  // the weapon hand is what rides the routine: off the shoulder and up to
  // eye height for the read, a knuckle's lift for the weight shift (issue #72)
  const hRy = shY + r * 0.42 - (P.atkT > P.atkCd - 0.3 ? 2 : Math.abs(armS) * 1.2 + pose.hand);
  // the off hand answers to the same routine as well: it carries the torch,
  // so it rides the same breath the body does
  const hLx = x - r * 0.52 + armS * faceX * r * 0.3 - pose.arm * faceX * r * 0.7;
  const hLy = shY + r * 0.44 - pose.hand * 0.45;
  ctx.strokeStyle = bare ? cl.skin : cl.paul; ctx.lineWidth = r * 0.19;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.4, shY + 2); ctx.lineTo(hRx, hRy);
  ctx.moveTo(x - r * 0.4, shY + 2); ctx.lineTo(hLx, hLy);
  ctx.stroke();
  ctx.fillStyle = bare ? cl.skin : '#b8a27c'; // gauntlet/hands (bare fists for the barbarian)
  ctx.beginPath(); ctx.arc(hRx, hRy, r * 0.12, 0, TAU); ctx.arc(hLx, hLy, r * 0.12, 0, TAU); ctx.fill();
  // the weapon in hand: what you actually wear (issue #53). At rest it hangs in
  // the facing direction (issue #27 keeps it off the cursor), during a swing it
  // rides the arc, and a drawn bow or a charging staff points at the aim
  let wa;
  // a ranged weapon keeps its eye on the cursor whatever the body is doing -
  // issues #61/#62 still hold - but it rides the routine's lift a third of
  // the way, so a staff is still raised to eye height for the read
  if (ranged) wa = P.aim + pose.lift * 0.3 * (faceX > 0 ? 1 : -1);
  else if (swingT >= 0) wa = P.aim - 0.7 + 1.4 * swingT;
  else wa = (faceX > 0 ? 0.55 : Math.PI - 0.55) - pose.lift * (faceX > 0 ? 1 : -1);
  drawHandWeapon(wk, hRx, hRy, wa, (ranged && swingT >= 0) ? 1 : 0,
    (swingT >= 0 && !ranged) ? 1.75 : 1); // #74: the melee swing rides the haft out
  // head + helmet: the neck turns over whatever is down the halls, or dips in
  // over a weapon being read. Only the head of the third routine moves, and
  // it moves furthest, which is what tells the three apart (issue #72)
  const hx2 = x + pose.head * faceX, hy2 = y - r * 1.15 + bob * 0.6 + pose.dip;
  ctx.fillStyle = cl.skin; // the face: every class shows its own skin
  ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.36, 0, TAU); ctx.fill();
  if (bare) {
    // no helm: bare head, braided beard and warpaint (issue #52)
    ctx.fillStyle = '#3e2b1c';
    ctx.beginPath(); ctx.arc(hx2, hy2 + r * 0.1, r * 0.31, 0.2, Math.PI - 0.2); ctx.fill();
    ctx.strokeStyle = cl.crest; ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(hx2 - r * 0.26, hy2 - r * 0.08); ctx.lineTo(hx2 + r * 0.26, hy2 - r * 0.08);
    ctx.moveTo(hx2 - r * 0.2, hy2 + r * 0.02); ctx.lineTo(hx2 + r * 0.08, hy2 + r * 0.02);
    ctx.stroke();
    ctx.strokeStyle = '#3e2b1c'; ctx.lineWidth = 2.2; // the topknot behind it
    ctx.beginPath(); ctx.moveTo(hx2, hy2 - r * 0.3); ctx.lineTo(hx2 - faceX * (2 + pose.crest), hy2 - r * 0.52); ctx.stroke();
  } else {
    ctx.fillStyle = cl.paul;
    ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillStyle = '#5c6a7e';
    ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.4, Math.PI * 0.05, Math.PI * 0.45); ctx.fill(); // visor brim
  }
  // helmet crest
  ctx.strokeStyle = cl.crest; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx2, hy2 - r * 0.4); ctx.lineTo(hx2 - faceX * (3 + pose.crest * 1.5), hy2 - r * 0.6); ctx.stroke();
  // hurt flash
  if (P.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(220,40,40,' + Math.min(0.6, P.hurtFlash * 4) + ')';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.44, shY); ctx.lineTo(x + r * 0.44, shY);
    ctx.lineTo(x + r * 0.36, hipY + 1); ctx.lineTo(x - r * 0.36, hipY + 1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.38, 0, TAU); ctx.fill();
  }
  if (idling) ctx.restore(); // undo the idle lean
}
// ============ PART 6d — FX, lighting, main render ============
function drawProjectiles() {
  ctx.lineCap = 'round';
  for (const pr of game.projectiles) {
    const x = pr.x - vx, y = pr.y - vy;
    if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue;
    const a = Math.atan2(pr.vy, pr.vx);
    if (pr.arrow) {
      // an arrow of the hero's bow: a slim shaft, a steel point, fletching at
      // the tail (issue #53)
      ctx.strokeStyle = '#cbb795'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 17, y - Math.sin(a) * 17); ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = '#dde4ec'; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      ctx.stroke();
      ctx.strokeStyle = pr.color; ctx.lineWidth = 1.2;
      for (let f2 = -1; f2 <= 1; f2 += 2) {
        const bx = x - Math.cos(a) * 15, by = y - Math.sin(a) * 15;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 2.3 * f2) * 5.5, by + Math.sin(a + 2.3 * f2) * 5.5);
        ctx.stroke();
      }
      continue;
    }
    if (pr.side === 'p') {
      // a magic missile off a staff: an arcane head with a halo and a trail
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, 11);
      g2.addColorStop(0, 'rgba(215,240,255,0.95)');
      g2.addColorStop(0.4, 'rgba(138,199,232,0.6)');
      g2.addColorStop(1, 'rgba(138,199,232,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,215,255,0.75)'; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 18, y - Math.sin(a) * 18); ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath(); ctx.arc(x, y, 3.1, 0, TAU); ctx.fill();
      continue;
    }
    ctx.strokeStyle = pr.color; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 14, y - Math.sin(a) * 14);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 2.3, 0, TAU); ctx.fill();
  }
  ctx.lineCap = 'butt';
}

function drawFX() {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - vx - p.size / 2, p.y - vy - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // a chain bolt's lightning, over the crowd rather than under it: a wide soft
  // arc for the halo, then a thin bright core over that, both read off the one
  // path the bolt was born with. ART_BIBLE.md 7.2 asks of lightning that it be
  // a bright, high-contrast arc with a clear direction (issue #71)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const b of game.bolts) {
    const a2 = Math.min(1, b.life / b.max * 1.7);
    ctx.strokeStyle = hexA(b.color, 0.4 * a2); ctx.lineWidth = 7.5;
    boltTrail(b);
    ctx.strokeStyle = hexA('#eef6ff', 0.95 * a2); ctx.lineWidth = 2.2;
    boltTrail(b);
  }
  ctx.globalAlpha = 1;
  for (const r of game.rings) {
    ctx.strokeStyle = hexA(r.color, Math.min(1, r.life * 2.2) * 0.85);
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(r.x - vx, r.y - vy, r.r, 0, TAU); ctx.stroke();
  }
  ctx.font = 'bold 13px Georgia';
  ctx.textAlign = 'center';
  for (const t of game.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x - vx, t.y - vy);
  }
  ctx.globalAlpha = 1;
}

function lightPass(t) {
  const th = game.th;
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.fillStyle = th.dark;
  dctx.fillRect(0, 0, darkCv.width, darkCv.height);
  dctx.globalCompositeOperation = 'destination-out';
  const D = SC;
  const hole = (x, y, r, str) => {
    const g = dctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,' + str + ')');
    g.addColorStop(0.62, 'rgba(0,0,0,' + str * 0.7 + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath(); dctx.arc(x, y, r, 0, TAU); dctx.fill();
  };
  if (!P.dead) hole((P.x - vx) * D, (P.y - vy) * D, PLAYER_LIGHT * D, 1);
  for (const tc of game.torches) {
    const fl = Math.sin(t * 7 + tc.ph) * 6;
    const x = (tc.x - vx) * D, y = (tc.y - vy) * D;
    if (x < -160 * D || x > cv.width + 160 * D || y < -160 * D || y > cv.height + 160 * D) continue;
    hole(x, y, (102 + fl) * D, 1);
  }
  if (game.portal) hole((game.portal.x - vx) * D, (game.portal.y - vy) * D,
    (portalActive() ? PORTAL_DRAW_ON : PORTAL_DRAW) * D, 1); // issue #68: the disc the wake rule measures
  // the awake throne burns cold through the dark: that is how the player is
  // told the seat is ready (issue #69)
  if (game.throne && game.throne.active)
    hole((game.throne.x - vx) * D, (game.throne.y - vy) * D,
      (158 + 16 * Math.sin(game.time * 2.6)) * D, 0.92);
  for (const pr of game.projectiles) hole((pr.x - vx) * D, (pr.y - vy) * D, 70 * D, 0.65);
  // the lightning carries light with it, and not only at its ends: the room the
  // bolt walks through flashes, so a chain that leaps from foe to foe can be
  // followed in an unlit hall rather than only inside the hero's torch (issue #71)
  for (const b of game.bolts) {
    const a2 = Math.min(1, b.life / b.max);
    for (let k2 = 0; k2 < b.pts.length; k2 += 2)
      hole((b.pts[k2].x - vx) * D, (b.pts[k2].y - vy) * D, 74 * D, 0.86 * a2);
  }
  dctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(darkCv, 0, 0);
  // warm haloes
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const tc of game.torches) {
    const x = tc.x - vx, y = tc.y - vy;
    if (x < -70 || x > VW + 70 || y < -70 || y > VH + 70) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 62);
    g.addColorStop(0, 'rgba(' + th.halo + ',0.15)');
    g.addColorStop(1, 'rgba(' + th.halo + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 62, 0, TAU); ctx.fill();
  }
  if (game.portal) {
    const on = portalActive();
    const pr = on ? 90 : 46;
    const g = ctx.createRadialGradient(game.portal.x - vx, game.portal.y - vy, 0, game.portal.x - vx, game.portal.y - vy, pr);
    g.addColorStop(0, 'rgba(70,190,240,' + (on ? 0.22 : 0.06) + ')');
    g.addColorStop(1, 'rgba(70,190,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(game.portal.x - vx, game.portal.y - vy, pr, 0, TAU); ctx.fill();
  }
  // the bolt glows over the dark: a strike is its own light, which is what makes
  // the line of it legible where the hero's torch does not reach (issue #71)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const b of game.bolts) {
    const a2 = Math.min(1, b.life / b.max);
    ctx.strokeStyle = hexA(b.color, 0.55 * a2); ctx.lineWidth = 8;
    boltTrail(b);
  }
  ctx.globalCompositeOperation = 'source-over';
  // red pulse at low HP
  if (!P.dead && P.hp / P.hpMax < 0.3) {
    const pulse = 0.16 + Math.max(0, Math.sin(t * 4.5)) * 0.12;
    const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.33, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
    g.addColorStop(0, 'rgba(140,0,0,0)');
    g.addColorStop(1, 'rgba(140,0,0,' + pulse + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }
}

// the pause card (issue #44): a transparent shadow over the whole frame and a
// plain statement in the middle, so the player knows the world just froze
function pauseVeil() {
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(6, 4, 10, 0.58)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px Georgia';
  ctx.fillStyle = '#0b0705';
  const word = tradeOpen ? 'Trading' : game.victoryOpen ? 'Victory' : 'Paused';
  ctx.fillText(word, VW / 2 + 2, VH / 2 + 2);
  ctx.fillStyle = '#d8b25a';
  ctx.fillText(word, VW / 2, VH / 2);
  ctx.font = '12px Georgia';
  ctx.fillStyle = '#b2a278';
  ctx.fillText(tradeOpen ? 'the world holds still · click a tab, close with T or the X on the stall'
    : 'the world holds still · press P to resume', VW / 2, VH / 2 + 26);
  ctx.textAlign = 'left';
}
function render(dt) {
  const t = game.time;
  const tx = clamp(P.x - VW / 2, 0, Math.max(0, WORLD.w - VW));
  const ty = clamp(P.y - VH / 2 - 24, 0, Math.max(0, WORLD.h - VH));
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 4.5));
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 4.5));
  const sh = Math.min(9, game.shake);
  vx = Math.round(cam.x + (sh > 0.2 ? rand(-sh, sh) : 0));
  vy = Math.round(cam.y + (sh > 0.2 ? rand(-sh, sh) : 0));
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.fillStyle = game.th.void;
  ctx.fillRect(0, 0, VW, VH);
  drawFloor();
  drawGroundFX();
  drawWalls();
  drawThroneRoom(t);
  drawTorches(t);
  drawPortalG(t);
  const ents = game.monsters.slice();
  if (!P.dead) ents.push(P);
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) { if (e === P) drawPlayer(); else drawMonster(e, t); }
  drawProjectiles();
  drawFX();
  lightPass(t);
  if (game.paused) pauseVeil();
}
// ============ PART 7 — INPUT, HUD, MAIN LOOP ============
const K = { w: false, a: false, s: false, d: false };
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

const HUD = {
  objTitle: document.getElementById('objTitle'),
  objText: document.getElementById('objText'),
  goldText: document.getElementById('goldText'),
  hpFill: document.getElementById('hpFill'),
  hpText: document.getElementById('hpText'),
  resourceFill: document.getElementById('resourceFill'),
  resourceText: document.getElementById('resourceText'),
  xpfill: document.getElementById('xpfill'),
  levelText: document.getElementById('levelText'),
  bossbar: document.getElementById('bossbar'),
  bossfill: document.getElementById('bossfill'),
  bossname: document.getElementById('bossname'),
  slotPotion: document.getElementById('slotPotion'),
  slotSkill2: document.getElementById('slotSkill2'),
  slotSkill3: document.getElementById('slotSkill3'),
  iconSkill2: document.getElementById('iconSkill2'),
  iconSkill3: document.getElementById('iconSkill3'),
  skName2: document.getElementById('skName2'),
  skName3: document.getElementById('skName3'),
  slotLMB: document.getElementById('slotLMB'),
};

// LMB-clicking a skill icon uses that skill directly (issue #15)
for (const sc of [
  [HUD.slotPotion, drinkPotion],
  [HUD.slotSkill2, trySkill2],
  [HUD.slotSkill3, trySkill3],
  [HUD.slotLMB, tryAttack],
]) {
  if (sc[0] && sc[0].addEventListener)
    sc[0].addEventListener('click', (e) => { if (e.button === 0 && game.running) sc[1](); });
}

// sheet re-render ticker: the vitals panel is refreshed a few times a second
// instead of every frame, so pressing a row never races a DOM swap (issue #37)
let sheetLive = 0;
function hudUpdate() {
  // acts follow the themes: three levels to an act (issue #49)
  const band = Math.min(Math.floor((game.checkpoint - 1) / 3) + 1, ROMAN.length - 1);
  HUD.objTitle.textContent = 'Act ' + ROMAN[band] + ' — ' + game.th.name + ' · Level ' + game.checkpoint;
  if (game.checkpoint === FINAL_LEVEL) {
    // the last stage has no gate: the king first, then the throne
    if (game.seat > 0) HUD.objText.textContent = 'Rising from the throne';
    else if (game.throne && game.throne.active) HUD.objText.textContent = 'The throne is awake — touch it and sit down';
    else if (game.boss && !game.boss.dead) HUD.objText.textContent = 'Boss: ' + game.boss.name + ' — guarding the throne';
    else HUD.objText.textContent = 'The throne: your prize';
  }
  else if (game.bossPending) HUD.objText.textContent = 'The overlord waits at the portal — step in until the whole gate stands in your light';
  else if (game.boss && !game.boss.dead) HUD.objText.textContent = 'Boss: ' + game.boss.name + ' — guarding the portal';
  else if (game.checkpoint > FINAL_LEVEL) HUD.objText.textContent = 'Enter the portal — deeper still';
  else HUD.objText.textContent = 'Enter portal';
  HUD.goldText.textContent = String(P.gold);
  HUD.hpFill.style.height = clamp(P.hp / P.hpMax, 0, 1) * 100 + '%';
  HUD.hpText.textContent = Math.max(0, Math.round(P.hp)) + '/' + P.hpMax;
  HUD.resourceFill.style.height = clamp(P.mana / mpMax(), 0, 1) * 100 + '%';
  HUD.resourceText.textContent = Math.round(clamp(P.mana, 0, mpMax())) + '/' + mpMax();
  HUD.xpfill.style.width = Math.min(100, P.xp / P.xpNeed * 100) + '%';
  HUD.levelText.textContent = 'Level ' + P.level;
  if (game.boss && !game.boss.dead && game.boss.act) {
    HUD.bossbar.classList.remove('hidden');
    HUD.bossfill.style.width = Math.max(0, game.boss.hp / game.boss.hpMax * 100) + '%';
    HUD.bossname.textContent = game.boss.name;
  } else HUD.bossbar.classList.add('hidden');
  const rings = [
    [HUD.slotPotion, P.cd.potion / 60, true],
    [HUD.slotSkill2, P.cd.sk2 / skillOf(2).cd, P.mana >= skillOf(2).mana],
    [HUD.slotSkill3, P.cd.sk3 / skillOf(3).cd, P.mana >= skillOf(3).mana],
    [HUD.slotLMB, P.atkT / P.atkCd, true],
  ];
  for (const r of rings) {
    r[0].style.setProperty('--cd', clamp(r[1], 0, 1) + 'turn');
    r[0].classList.toggle('ready', r[1] <= 0 && r[2]);
    r[0].classList.toggle('noFury', !r[2]);
  }
  for (const k of [2, 3]) {
    const sk = skillOf(k);
    HUD['skName' + k].textContent = sk ? sk.name : '';
    // the plate the slot rides (issue #70): the glyph its own skill is, put
    // back only when the class' pair changes, so the bar is never rewritten
    // once a frame
    const ic = HUD['iconSkill' + k];
    const row = CLASS_SKILLS[P.cls || 'barbar'];
    const pkey = sk ? row[k - 2] : '';
    if (ic && iconKey[k] !== pkey) { iconKey[k] = pkey; ic.innerHTML = iconSvgFor(pkey); }
    HUD['slotSkill' + k].setAttribute('title', sk ? sk.name + ' - ' + sk.mana +
      ' Mana, ' + sk.cd + ' s cooldown (' + (sk.weapon === 'melee' ?
        'a swung weapon' : 'a bow or a staff') + ') - ' + sk.blurb : '');
  }
  if (mapOpen) drawMapUI();
  sheetLive = (sheetLive + 1) % 5;
  if (charOpen && sheetLive === 0) renderChar(); // vitals stay live, but the
    // sheet DOM is only swapped ~5x a second now: per-frame churn made the row
    // we pressed vanish mid-press, so stat clicks did nothing (issue #37)
}
// ---------- input ----------
// pause (issue #44): P freezes the whole simulation — no hp/mana regen, no
// monster movement or attacks, no torch flicker — and veils the frame
function togglePause() {
  if (!game.running) return;
  game.paused = !game.paused;
  toast(game.paused ? 'Paused — the world holds still (P to resume)' : 'Resumed', '');
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': K.w = true; break;
    case 'KeyS': case 'ArrowDown': K.s = true; break;
    case 'KeyA': case 'ArrowLeft': K.a = true; break;
    case 'KeyD': case 'ArrowRight': K.d = true; break;
    case 'Digit1': case 'Numpad1': if (game.running && !game.paused) drinkPotion(); break;
    case 'Digit2': case 'Numpad2': if (game.running && !game.paused) trySkill2(); break;
    case 'Digit3': case 'Numpad3': if (game.running && !game.paused) trySkill3(); break;
    case 'KeyP': togglePause(); break;
    case 'KeyC': if (game.running) toggleChar(); break;
    case 'KeyM': if (game.running) toggleMap(); break;
    case 'KeyT': if (game.running && game.merchant &&
        Math.hypot(P.x - game.merchant.x, P.y - game.merchant.y) < 130) toggleTrade(); break;
    case 'KeyL': toggleDevMenu(); break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': K.w = false; break;
    case 'KeyS': case 'ArrowDown': K.s = false; break;
    case 'KeyA': case 'ArrowLeft': K.a = false; break;
    case 'KeyD': case 'ArrowRight': K.d = false; break;
  }
});

// ---------- where the cursor is ----------
// a moving hero used to have his aim overwritten with the direction he was
// walking in, so an archer strafing south loosed his arrows at his own heels
// (issue #67). The cursor's world position is remembered instead, and the aim
// is recomputed from it every frame - it has to be recomputed, because the
// angle from the hero to a cursor that has not moved changes as he walks.
let curWX = null, curWY = null; // null until the mouse has been pointed once
function cursorAim() {
  if (curWX === null) return null;
  return Math.atan2(curWY - P.y, curWX - P.x);
}
// a walking hero aims at the cursor's line; only a hero the mouse has never
// been moved for falls back to the direction he is walking in
function walkAim(mx, my) {
  const ca = cursorAim();
  return ca === null ? Math.atan2(my, mx) : ca;
}

// screen (client) px -> world coords, robust to any CSS scaling of the canvas
function worldAt(cx, cy) {
  const r = cv.getBoundingClientRect();
  return {
    x: vx + (cx - r.left) * (VW / Math.max(1, r.width)),
    y: vy + (cy - r.top) * (VH / Math.max(1, r.height)),
  };
}
cv.addEventListener('mousemove', (e) => {
  const w2 = worldAt(e.clientX, e.clientY);
  curWX = w2.x; curWY = w2.y; // remembered, so the aim can follow while walking
  if (!P.dead && game.running && !P.leap) {
    P.aim = Math.atan2(w2.y - P.y, w2.x - P.x);
    // RMB held down: the character continuously follows the cursor (issue #14)
    if (game.rmbDown) game.moveTarget = w2;
  }
});
cv.addEventListener('mousedown', (e) => {
  // a click is also a point: record it, so a hero clicked at without the mouse
  // having moved since still has a line to aim down (issue #67)
  const w2 = worldAt(e.clientX, e.clientY);
  curWX = w2.x; curWY = w2.y;
  if (e.button === 0) game.mouseDown = true;
  else if (e.button === 2) { game.rmbDown = true; game.moveTarget = w2; }
});
cv.addEventListener('mouseup', (e) => {
  if (e.button === 0) game.mouseDown = false;
  else if (e.button === 2) { game.rmbDown = false; game.moveTarget = null; } // release = stop immediately
});
cv.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const w2 = worldAt(e.clientX, e.clientY);
  curWX = w2.x; curWY = w2.y;
  game.rmbDown = true;
  game.moveTarget = w2;
});

// ---------- run lifecycle ----------
function beginRun(cls) {
  clearSnapshot(); // a brand-new game discards the previous journey
  resetGame(); resetPlayer(cls);
  generateLevel(1);
  preplaceMonsters();
  cam.x = P.x - VW / 2; cam.y = P.y - VH / 2;
  // the run should say what it starts holding, not leave the player to find
  // the equipment panel by accident (issue #65)
  toast('In hand: a plain ' + P.eq.weapon.name + ' - nothing on it but its own weight', '');
  // the run should say what the class brought, not leave the player to find
  // the skillbar by accident (issue #63)
  toast('Skills: ' + skillOf(2).name + ' (2) and ' + skillOf(3).name + ' (3)', '');
  toast('Checkpoint 1 — Old Ruins', '');
  toast('Class: ' + CLASSES[P.cls].name + ' · C — character and equipment', '');
}

// continue the journey saved at the last portal (issue #10)
function beginContinue() {
  const d = loadSnapshot();
  if (!d) { beginRun(); return; }
  resetGame(); resetPlayer(d.cls);
  P.cls = (d.cls && CLASSES[d.cls]) ? d.cls : 'barbar';
  game.checkpoint = d.checkpoint;
  game.totalKills = d.totalKills || 0;
  P.level = d.level; P.xp = d.xp; P.xpNeed = d.xpNeed; P.gold = d.gold;
  P.statPoints = d.statPoints;
  P.attr = { str: d.attr.str, dex: d.attr.dex, int: d.attr.int, vit: d.attr.vit };
  P.inv = Array.isArray(d.inv) ? d.inv : [];
  // a saved journey keeps whatever it was carrying, and an empty slot keeps
  // what resetPlayer just handed the class, rather than blanking it (issue #65)
  if (d.eq) for (const sl of SLOTS) if (d.eq[sl]) P.eq[sl] = d.eq[sl];
  refreshHpMax(); P.hp = P.hpMax; P.mana = mpMax();
  generateLevel(game.checkpoint);
  preplaceMonsters();
  cam.x = P.x - VW / 2; cam.y = P.y - VH / 2;
  toast('Continuing — checkpoint ' + game.checkpoint + ' · level ' + P.level, '');
  toast('Your journey is saved at every portal', '');
}

const contBtn = document.getElementById('continueBtn');
// ---- demo mode (issue #35): a small internal AI drives the hero ----
let bot = null;
function botEquip() {
  for (let i = 0; i < P.inv.length; i++) {
    const it = P.inv[i];
    const cur = P.eq[it.slot];
    if (!cur || it.score > cur.score) { equipFromInv(i); return; }
  }
}
// line of sight over the tile grid: sampled every ~14 px, blocked when a
// sample hits solid geometry (issue #41: the spectator bot ignores anything
// it cannot see, so it never walks into a wall toward a walled-off foe)
function losClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 14));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (solidAt(x0 + dx * t, y0 + dy * t, 5)) return false;
  }
  return true;
}
// the bot spends free attribute points in its class' proportions (issue #41)
function botSpendPoints() {
  const c = CLASSES[P.cls || 'barbar'].attr;
  const keys = ['str', 'dex', 'int', 'vit'];
  let tot = 0;
  for (const k of keys) tot += c[k];
  const raw = keys.map((k) => (c[k] / tot) * P.statPoints);
  const base = raw.map(Math.floor);
  let left = P.statPoints - base.reduce((s, x) => s + x, 0);
  const order = [0, 1, 2, 3].sort(
    (a, b) => (raw[b] - base[b]) - (raw[a] - base[a]));
  for (let i = 0; left > 0; i++, left--) base[order[i % 4]]++;
  for (let i = 0; i < keys.length; i++)
    for (let j = 0; j < base[i]; j++) addAttrPoint(keys[i]);
}
function botTick(dt) {
  if (!bot) bot = { tx: P.x, ty: P.y, stuckT: 0, lx: P.x, ly: P.y, wanderT: 0 };
  const B = bot;
  const moved = Math.hypot(P.x - B.lx, P.y - B.ly);
  B.stuckT = (moved < 2 && B.wasAlive !== undefined) ? B.stuckT + dt : 0;
  B.wasAlive = true;
  B.lx = P.x; B.ly = P.y;
  botEquip(); // keep the best gear on, even mid-fight (issue #35)
  let gx = null, gy = null;
  // 1) fight: nearest monster in sight (issue #41: a foe behind a wall is
  // ignored, not walked into)
  const sight = Math.min(VW, VH); // what the hero can actually see (issue #59)
  const mer = game.merchant;
  // reopened #59 adds a hard rule for fighting: the bot attacks only foes
  // standing inside the hero's own torchlight, so a shot never sails down
  // a hall that the player could not even see - the screen edge is not
  // the eye's reach, the flame hole is (PLAYER_LIGHT)
  const fightR = Math.min(sight, PLAYER_LIGHT);
  // the bot answers only to things inside its sight AND down a clear line -
  // never through a wall - and when nothing interesting stands around it
  // simply free-explores (issue #59)
  let tgt = null, bd = fightR;
  for (const m of game.monsters) {
    if (m.hp <= 0) continue; // corpses are not targets
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d >= bd || !losClear(P.x, P.y, m.x, m.y)) continue;
    bd = d; tgt = m;
  }
  if (tgt) {
    const ranged = rangedWeapon();
    // the real distance the blade's tip can actually bite at (issue #59 -
    // it used to flail at foes a hand's width past reach)
    const wr = ranged ? 500 : P.atkRange + tgt.r - 4;
    if (ranged) {
      // the bot drives the hero the way a player drives it: it points the
      // cursor at what it means to shoot (issue #67), and the same rule that
      // lets a strafing archer keep his line aims the hero at it
      curWX = tgt.x; curWY = tgt.y;
      P.aim = Math.atan2(tgt.y - P.y, tgt.x - P.x);
    }
    if (bd > wr) { gx = tgt.x; gy = tgt.y; }
    game.mouseDown = bd <= wr;
    // a swing that ended without the foe losing a single hit point was thin
    // air: the bot comes closer and swings again instead of pawing the
    // empty space (issue #59)
    if (B.swingTgt === tgt && B.swingHp !== undefined && P.atkT <= 0) {
      if (tgt.hp >= B.swingHp) { gx = tgt.x; gy = tgt.y; }
      B.swingTgt = null; B.swingHp = undefined;
    } else if (P.atkT > 0 && B.swingTgt !== tgt) { B.swingTgt = tgt; B.swingHp = tgt.hp; }
    if (P.hp < P.hpMax * 0.4 && P.cd.potion <= 0) drinkPotion();
    let near = 0;
    for (const m of game.monsters) if (Math.hypot(m.x - P.x, m.y - P.y) < 100) near++;
    // a crowd is what the class' finisher is for, its opener is for anything
    // worth spending mana on at all (issue #63: both follow the class)
    const sk3 = skillOf(3);
    if (near >= 2 && sk3 && P.cd.sk3 <= 0 && P.mana >= sk3.mana && skillWeaponOk(sk3)) trySkill3();
    const sk2 = skillOf(2);
    if (sk2 && tgt && P.cd.sk2 <= 0 && P.mana >= sk2.mana && skillWeaponOk(sk2)) trySkill2();
  } else {
    game.mouseDown = false;
    // 2) loot / orbs / gold, 3) chests, 4) portal (when boss down) or boss —
    // all sight-limited too, so the bot never presses into a wall for loot
    let best = null, bd2 = sight;
    for (const it of game.drops) {
      const d = Math.hypot(it.x - P.x, it.y - P.y);
      if (d < bd2 && losClear(P.x, P.y, it.x, it.y)) { bd2 = d; best = it; }
    }
    for (const gp of game.goldpiles) {
      const d = Math.hypot(gp.x - P.x, gp.y - P.y);
      if (d < bd2 && losClear(P.x, P.y, gp.x, gp.y)) { bd2 = d; best = gp; }
    }
    for (const g of game.globes) {
      const d = Math.hypot(g.x - P.x, g.y - P.y);
      if (d < bd2 && losClear(P.x, P.y, g.x, g.y)) { bd2 = d; best = g; }
    }
    for (const ch of game.chests) {
      if (ch.open) continue;
      const d = Math.hypot(ch.x - P.x, ch.y - P.y);
      if (d < sight && d < bd2 && losClear(P.x, P.y, ch.x, ch.y)) { bd2 = d; best = ch; }
    }
    // 5) a trader in sight: he takes what you do not use (issue #59)
    if (P.inv.length > 0 && mer) {
      const md = Math.hypot(mer.x - P.x, mer.y - P.y);
      if (md < sight && losClear(P.x, P.y, mer.x, mer.y)) {
        if (md <= 110) {
          // everything that survived in the backpack is spare by definition:
          // botEquip keeps the best of every slot on the sheets, so the rest
          // of it goes into the trader's purse and back as gold
          for (let q = P.inv.length - 1; q >= 0; q--)
            if (P.inv[q]) tradeSell(q);
        } else if (md < bd2) { bd2 = md; best = mer; }
      }
    }
    // an overlord that has not been woken yet is not down: the bot goes to
    // the gate and stirs him there (issue #57)
    const bossDown = !game.bossPending && (game.boss === null || game.boss.dead);
    if (game.throne && game.throne.active && bossDown) {
      // no gate on the last stage: the bot sits down for the prize
      const td = Math.hypot(game.throne.sx - P.x, game.throne.sy - P.y);
      if (td < sight * 1.5 && losClear(P.x, P.y, game.throne.sx, game.throne.sy)) {
        best = { x: game.throne.sx, y: game.throne.sy }; bd2 = 0;
      }
    } else if (game.portal && bossDown) {
      const d = Math.hypot(game.portal.x - P.x, game.portal.y - P.y);
      if (d < sight * 1.5 && losClear(P.x, P.y, game.portal.x, game.portal.y)) { best = game.portal; bd2 = 0; }
    } else if (game.boss && !game.boss.dead) {
      const d = Math.hypot(game.boss.x - P.x, game.boss.y - P.y);
      if (d < sight && losClear(P.x, P.y, game.boss.x, game.boss.y)) { best = game.boss; bd2 = 0; }
    } else if (game.bossPending && game.portal) {
      // nothing to fight yet: make for the gate, he will come out
      const d = Math.hypot(game.portal.x - P.x, game.portal.y - P.y);
      if (d < sight && losClear(P.x, P.y, game.portal.x, game.portal.y)) { best = game.portal; bd2 = 0; }
    }
    if (best) { gx = best.x; gy = best.y; }
    else {
      // wander with a persistent goal; reroll when reached or stuck
      B.wanderT -= dt;
      const nearGoal = Math.hypot(B.tx - P.x, B.ty - P.y) < 60;
      if (B.wanderT <= 0 || nearGoal || B.stuckT > 0.9) {
        B.wanderT = 3.2;
        B.stuckT = 0;
        let found = false;
        for (let t2 = 0; t2 < 12; t2++) {
          const a = rand(0, TAU), dd = rand(240, 620);
          const wx = P.x + Math.cos(a) * dd, wy = P.y + Math.sin(a) * dd;
          if (!solidAt(wx, wy, 14) && losClear(P.x, P.y, wx, wy)) { B.tx = wx; B.ty = wy; found = true; break; }
        }
        if (!found) for (let t2 = 0; t2 < 12; t2++) {
          const a = rand(0, TAU), dd = rand(200, 520);
          const wx = P.x + Math.cos(a) * dd, wy = P.y + Math.sin(a) * dd;
          if (!solidAt(wx, wy, 14)) { B.tx = wx; B.ty = wy; break; }
        }
      }
      gx = B.tx; gy = B.ty;
    }
  }
  // steering (issue #41): when the straight line to the goal is walled, aim at
  // the nearest passable detour that still makes progress toward the goal, so
  // the bot rounds corners instead of pressing its face into the wall
  if (gx !== null && !passableAt(gx, gy)) {
    const dir = Math.atan2(gy - P.y, gx - P.x);
    if (!passableAt(P.x + Math.cos(dir) * 34, P.y + Math.sin(dir) * 34)) {
      let bx = null, by = null, bestPen = 1e9;
      for (const turn of [-0.4, 0.4, -0.85, 0.85, -1.3, 1.3, -1.9, 1.9]) {
        const a2 = dir + turn;
        for (const reach of [34, 60, 92]) {
          const px = P.x + Math.cos(a2) * reach, py = P.y + Math.sin(a2) * reach;
          if (!passableAt(px, py)) continue;
          const pen = Math.abs(turn) * 90 - reach + Math.hypot(gx - px, gy - py);
          if (pen < bestPen) { bestPen = pen; bx = px; by = py; }
        }
      }
      if (bx !== null) { gx = bx; gy = by; }
    }
  }
  game.moveTarget = (gx === null) ? null : { x: gx, y: gy };
}
if (loadSnapshot()) contBtn.classList.remove('hidden'); // a saved journey exists: offer it
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  game.demo = false;
  beginRun();
});
contBtn.addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  beginContinue();
});
// choose your class at the start (issue #22): each class button begins that run
for (const ck in CLASSES) {
  const cb = document.getElementById('cls-' + ck);
  if (cb && cb.addEventListener)
    cb.addEventListener('click', () => {
      document.getElementById('startScreen').classList.add('hidden');
      game.demo = false;
      beginRun(ck);
    });
}
const demoBtn = document.getElementById('demoBtn');
if (demoBtn && demoBtn.addEventListener)
  demoBtn.addEventListener('click', () => {
    document.getElementById('startScreen').classList.add('hidden');
    const keys = Object.keys(CLASSES);
    beginRun(keys[Math.floor(Math.random() * keys.length)]);
    game.demo = true;
    toast('DEMO MODE — the AI plays; sit back and watch', '');
  });
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('deathScreen').classList.add('hidden');
  beginContinue(); // retry at the last saved portal; fresh start when there is no save
});
// the victory window's two ways out (issue #51): back to the title screen, or
// close the window and let the hero walk again — the journey then goes on
// beyond the Roost, running it once more for every level past the tenth
if (winEl && winMenuBtn.addEventListener)
  winMenuBtn.addEventListener('click', () => { backToMenu(); });
if (winEl && winJourneyBtn.addEventListener)
  winJourneyBtn.addEventListener('click', () => {
    // the thirteenth stage is the last one: continuing the journey stands the
    // hero up off the throne and hands the controls back (issue #69)
    closeVictoryWindow();
    toast('The throne is yours and so is the hall — walk about it whenever you like', '');
  });

// ---------- main loop ----------
let lastT = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000);
  lastT = ts;
  if (game.running && dt > 0 && !game.paused) {
    update(dt);
    hudUpdate();
  }
  if (game.running) render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ============ PART 8 — CARD OF THE CHARACTER / ATTRIBUTES / EQUIPMENT ============
const ATTRPL = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence', vit: 'Vitality' };
const ATTRS4 = [['str', 'Strength'], ['dex', 'Dexterity'], ['int', 'Intelligence'], ['vit', 'Vitality']];
const SLOTPL = { weapon: 'Weapon', helm: 'Helmet', armor: 'Armor' };
let charOpen = false;
const charEl = document.getElementById('charSheet');
// act on mousedown, not click: the sheet re-renders often, so by the time a
// click event fires the row we pressed may already have been replaced by a
// fresh render, and the click then lands on a detached node (issue #37)
if (charEl && charEl.addEventListener) {
  charEl.addEventListener('mousedown', (e) => {
    // the pressed node is often an inner <span> (stat text / item name), so
    // walk up to the row element that carries data-attr / data-inv / data-discard
    let t = e.target;
    while (t && t !== charEl) {
      const ds = t.dataset;
      if (ds && (ds.discard !== undefined || ds.attr || (ds.inv !== undefined && ds.inv !== ''))) break;
      t = t.parentNode;
    }
    if (!t || t === charEl) return;
    const ds = t.dataset;
    if (ds.discard !== undefined) invDiscard(parseInt(ds.discard, 10));
    else if (ds.attr) addAttrPoint(ds.attr);
    else if (ds.inv !== undefined && ds.inv !== '') equipFromInv(parseInt(ds.inv, 10));
  });
}
function toggleChar() {
  if (!charEl || !charEl.classList) return;
  if (charOpen) { charEl.classList.add('hidden'); charOpen = false; }
  else { charEl.classList.remove('hidden'); charOpen = true; renderChar(); }
}

// ---- hidden developer menu (pressed with L): deliberately undocumented ----
let godMode = false;
let killMode = false; // dev menu: one-hit kills everything while on
const devMenu = document.createElement('div');
devMenu.id = 'devMenu';
devMenu.classList.add('hidden');
devMenu.innerHTML =
  '<div class="devTitle">Developer menu</div>' +
  '<button data-dev="god">Toggle god mode</button>' +
  '<button data-dev="kill">Toggle insta kill</button>' +
  '<button data-dev="level">Instant level up</button>' +
  '<button data-dev="items">Spawn items (one per tier)</button>' +
  '<button data-dev="merchant">Spawn merchant nearby</button>' +
  '<button data-dev="map">Reveal the whole map</button>' +
  '<button data-dev="tp">Teleport to next level</button>';
document.getElementById('game').appendChild(devMenu);
devMenu.addEventListener('click', (e) => {
  let t = e.target;
  while (t && t !== devMenu) { if (t.dataset && t.dataset.dev) break; t = t.parentNode; }
  if (!t || t === devMenu) return;
  const act = t.dataset.dev;
  if (act === 'god') {
    godMode = !godMode;
    toast('DEV: god mode ' + (godMode ? 'ON' : 'OFF'), '');
  } else if (act === 'kill') {
    killMode = !killMode;
    toast('DEV: insta kill ' + (killMode ? 'ON' : 'OFF'), '');
  } else if (act === 'level') {
    P.xp += P.xpNeed;
    gainXpCheck();
    toast('DEV: instant level up', '');
  } else if (act === 'items') {
    devSpawnItems();
  } else if (act === 'merchant') {
    devSpawnMerchant();
  } else if (act === 'map') {
    devRevealMap();
  } else if (act === 'tp') {
    if (game.running) { toast('DEV: teleporting deeper', ''); nextCheckpoint(); }
  }
});
function toggleDevMenu() {
  if (devMenu.classList.contains('hidden')) {
    devMenu.classList.remove('hidden');
    toast('DEV MENU — click a choice, press L to close', '');
  } else {
    devMenu.classList.add('hidden');
    toast('DEV: menu closed', '');
  }
}
// spot for the dev-menu merchant: walkable ground, wide enough for the cart,
// and in sight of the hero so he lands in the same room instead of inside
// geometry or behind a wall (issue #42)
function findMerchantSpot(cx, cy, minR, maxR) {
  for (let k = 0; k < 90; k++) {
    const a = rand(0, TAU), dd = rand(minR, maxR);
    const tx = cx + Math.cos(a) * dd, ty = cy + Math.sin(a) * dd;
    if (!passableAt(tx, ty)) continue;
    if (solidAt(tx, ty, 24)) continue;
    if (!losClear(cx, cy, tx, ty)) continue;
    return { x: tx, y: ty };
  }
  return null;
}
function devSpawnMerchant() {
  const spot = findMerchantSpot(P.x, P.y, 80, 280) || findMerchantSpot(P.x, P.y, 280, 560);
  if (!spot) { toast('DEV: no clear ground near the hero for a merchant', ''); return; }
  game.merchant = mkMerchant(spot.x, spot.y);
  toast('DEV: merchant spawned near you (press T to trade)', '');
  S.gold();
}
// the M map keeps its fog of war (issue #13) - this dev switch simply lifts it
// for the current level: every floor tile is stamped as walked into, so the
// whole layout, its chests, gates and keeper stand exposed (issue #60)
function devRevealMap() {
  if (!game.visited || !game.grid) { toast('DEV: no level to reveal', ''); return; }
  for (let i2 = 0; i2 < game.grid.length; i2++)
    if (game.grid[i2]) game.visited[i2] = 1;
  toast('DEV: the whole map is laid bare', '');
}
// dev menu (issue #43): exactly one item of every rarity tier, dropped on
// clear ground around the hero instead of the old five legendaries
function devSpawnItems() {
  for (const r of RARITY) {
    let px = P.x, py = P.y;
    for (let k = 0; k < 8; k++) {
      const a = rand(0, TAU), dd = rand(36, 140);
      const tx = P.x + Math.cos(a) * dd, ty = P.y + Math.sin(a) * dd;
      if (!solidAt(tx, ty, 12)) { px = tx; py = ty; break; }
    }
    game.drops.push({ x: px, y: py, r: 11, item: rollItem(game.checkpoint, false, r.id), life: 60, bob: rand(0, TAU) });
  }
  toast('DEV: 4 items spawned, one per tier (common / magic / rare / legendary)', '');
  S.item();
}

// ---- area map on M: only tiles the player has walked into are revealed ----
let mapOpen = false;
const mapCv = document.createElement('canvas');
mapCv.id = 'miniMap';
mapCv.width = GCOLS * 6; mapCv.height = GROWS * 6;
mapCv.style.width = mapCv.width + 'px';
mapCv.style.height = mapCv.height + 'px';
mapCv.classList.add('hidden');
document.getElementById('game').appendChild(mapCv);
const mapCx = mapCv.getContext('2d');
function toggleMap() {
  mapOpen = !mapOpen;
  if (mapOpen) { mapCv.classList.remove('hidden'); toast('Area map — explored parts only', ''); }
  else mapCv.classList.add('hidden');
}
function drawMapUI() {
  const vis = game.visited, g = game.grid;
  if (!vis || !g) return;
  const cs = 6;
  mapCx.fillStyle = '#0a090f';
  mapCx.fillRect(0, 0, mapCv.width, mapCv.height);
  for (let ty = 0; ty < GROWS; ty++) {
    for (let tx = 0; tx < GCOLS; tx++) {
      const i = ty * GCOLS + tx;
      if (!vis[i]) continue;
      mapCx.fillStyle = g[i] ? '#3a4658' : '#20242c';
      mapCx.fillRect(tx * cs, ty * cs, cs, cs);
    }
  }
  const tileVisited = (wx, wy) => {
    const tx = (wx / TS) | 0, ty = (wy / TS) | 0;
    return tx >= 0 && tx < GCOLS && ty >= 0 && ty < GROWS && vis[ty * GCOLS + tx] === 1;
  };
  // start (gold notch), portal (cyan) and boss (red) — markers honor fog of war
  if (game.startPos && tileVisited(game.startPos.x, game.startPos.y)) {
    mapCx.fillStyle = '#c8a45a';
    mapCx.fillRect(game.startPos.x / TS * cs + 1, game.startPos.y / TS * cs + 1, 4, 4);
  }
  if (game.portal && tileVisited(game.portal.x, game.portal.y)) {
    mapCx.fillStyle = portalActive() ? '#58c8f0' : '#2a5a6a';
    mapCx.beginPath();
    mapCx.arc(game.portal.x / TS * cs + cs / 2, game.portal.y / TS * cs + cs / 2, 3, 0, TAU);
    mapCx.fill();
  }
  if (game.boss && game.boss.hp > 0 && (game.boss.act || tileVisited(game.boss.x, game.boss.y))) {
    mapCx.fillStyle = '#d04040';
    mapCx.beginPath();
    mapCx.arc(game.boss.x / TS * cs + cs / 2, game.boss.y / TS * cs + cs / 2, 3, 0, TAU);
    mapCx.fill();
  }
  // player blip
  mapCx.fillStyle = '#f0d868';
  mapCx.beginPath();
  mapCx.arc(P.x / TS * cs + cs / 2, P.y / TS * cs + cs / 2, 2.4, 0, TAU);
  mapCx.fill();
}
function addAttrPoint(k) {
  if (P.statPoints <= 0 || !(k in P.attr)) return;
  P.attr[k]++;
  P.statPoints--;
  refreshHpMax();
  if (charOpen) renderChar();
}
function invDiscard(i) {
  const it = P.inv[i];
  if (!it) return;
  P.inv.splice(i, 1);
  toast('Discarded: ' + it.name, 'item-' + it.rarity);
  S.item();
  if (charOpen) renderChar();
}
// ============ THE TRADE POST (issue #45) ============
// pressing T next to a trader stops the world and opens his stall as a panel
// with two tabs: Sell (click any backpack item - the merchant buys it and puts
// it on his shelf) and Buy (the pack he generated when he was spawned, rolled
// exactly like a monster drop so strong rolls stay rare). New level, new trader
// with a new pack: the old one is simply discarded by the level generator.
const tradeEl = document.createElement('div');
tradeEl.id = 'tradeMenu';
tradeEl.classList.add('hidden');
document.getElementById('game').appendChild(tradeEl);
// the heading that names the stall, pinned to the upper part of the screen
// while the stall itself sits centred below it (issue #56)
const tradeHdr = document.createElement('div');
tradeHdr.id = 'tradeHeader';
tradeHdr.classList.add('hidden');
document.getElementById('game').appendChild(tradeHdr);
let tradeOpen = false, tradeTab = 'sell', tradeFreeze = false;
const GEM = '\u25c8'; // the little coin mark the panels print gold with
const MERCHANTS = ['Bonrik the Hooded', 'Old Harker', 'Cask & Coin', 'Fenrik Halfpouch',
  'Grett the Barrow-Man', 'Madam Meret', 'Quiet Willa', 'One-Eyed Tanner'];
function sellPrice(it) { return 10 + it.cp * 6 + Math.round(it.score); }
function buyPrice(it) { return Math.round(sellPrice(it) * 2.2) + 8; }
function mkMerchantStock(cp) {
  // his pack: a handful of goods rolled like the drops he never swept up, so
  // rarity and bonuses follow the same exponential curve the heroes see in play
  const st = [];
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const it = rollItem(clamp(cp, 1, 4), false, null, 1);
    st.push({ item: it, price: buyPrice(it) });
  }
  return st;
}
function mkMerchant(x, y) {
  return { x: x, y: y, hintCd: 0, bob: rand(0, TAU),
    name: pick(MERCHANTS), stock: mkMerchantStock(game.checkpoint) };
}
function toggleTrade() {
  if (!game.running) return;
  if (!game.merchant) { toast('No trader in sight', ''); return; }
  if (Math.hypot(P.x - game.merchant.x, P.y - game.merchant.y) > 130) { toast('Walk closer to the trader', ''); return; }
  if (tradeOpen) { closeTrade(); return; }
  tradeOpen = true; tradeTab = 'sell';
  // browsing the stall is a moment of peace, unless the player already paused
  // with P - then their pause stands and we do not steal it back
  if (!game.paused) { game.paused = true; tradeFreeze = true; }
  if (tradeEl) tradeEl.classList.remove('hidden');
  if (tradeHdr) tradeHdr.classList.remove('hidden');
  renderTrade();
  toast('Trade post - click a tab, close with T or the X on the stall', '');
  S.gold();
}
// the X drawn in the top corner of the stall: the same way out as pressing T
function tradeWindowClose() {
  if (!tradeOpen) return false;
  closeTrade();
  return true;
}
function closeTrade() {
  tradeOpen = false;
  if (tradeEl) tradeEl.classList.add('hidden');
  if (tradeHdr) tradeHdr.classList.add('hidden');
  if (tradeFreeze) { game.paused = false; tradeFreeze = false; }
  toast('Trade closed', '');
}
// the heading over the stall: it names the trade post, says what it does and
// counts where you stand, so the words sit above the window instead of buried
// inside it (issue #56)
function renderTradeHeader() {
  if (!tradeHdr || !tradeOpen || !game.merchant) return;
  const m = game.merchant;
  tradeHdr.innerHTML =
    '<div class="trHdrTitle">Trading menu</div>' +
    '<div class="trHdrText">You are at the post of <b>' + m.name + '</b> and the world holds still while you browse. ' +
    'Click <b>Sell</b> to put a backpack item on his shelf for gold, or <b>Buy</b> to take one off it and pay. ' +
    'Switch with the two tabs; close with <b>T</b> or the <b>X</b> at the top corner of the stall.</div>' +
    '<div class="trHdrStats"><span class="csGold">' + GEM + ' ' + P.gold + '</span>' +
    ' gold &#183; Backpack ' + P.inv.length + '/' + INV_CAP + ' &#183; His pack ' + m.stock.length + ' items</div>';
}
function renderTrade() {
  if (!tradeEl || !tradeOpen || !game.merchant) return;
  const m = game.merchant;
  // the X at the top-right corner of the stall is the window's own way out,
  // next to the merchant's nameplate and his price of gold (issue #56)
  let h = '<div class="trTitle">' + m.name + ' <span class="csGold">' + GEM + ' ' + P.gold +
    '</span><button class="trClose" data-close="1">&#10005;</button></div>';
  h += '<div class="trTabs">' +
    '<button class="trTab' + (tradeTab === 'buy' ? ' trOn' : '') + '" data-tab="buy">Buy</button>' +
    '<button class="trTab' + (tradeTab === 'sell' ? ' trOn' : '') + '" data-tab="sell">Sell</button></div>';
  if (tradeTab === 'sell') {
    h += '<div class="trSub">Backpack ' + P.inv.length + '/' + INV_CAP +
      ' - click an item and he buys it for you</div>';
    for (let i = 0; i < P.inv.length; i++) {
      const it = P.inv[i];
      h += '<div class="trRow" data-sell="' + i + '">' + SLOTPL[it.slot] + ': ' + statLine(it) +
        ' <span class="trAsk">' + GEM + ' ' + sellPrice(it) + '</span></div>';
    }
    if (!P.inv.length) h += '<div class="csEmptyRow">nothing to sell</div>';
  } else {
    h += '<div class="trSub">His pack - click an item and pay ' + GEM + ' ' +
      'to buy it</div>';
    for (let i = 0; i < m.stock.length; i++) {
      const s = m.stock[i];
      h += '<div class="trRow" data-buy="' + i + '">' + SLOTPL[s.item.slot] + ': ' + statLine(s.item) +
        ' <span class="trAsk">' + GEM + ' ' + s.price + '</span></div>';
    }
    if (!m.stock.length) h += '<div class="csEmptyRow">his shelves are empty</div>';
  }
  tradeEl.innerHTML = h;
  // the heading above the window follows every change: gold, backpack room
  // and the size of his pack all move
  renderTradeHeader();
}
function tradeSell(i) {
  const it = P.inv[i];
  if (!it || !game.merchant) return;
  const g = sellPrice(it);
  P.inv.splice(i, 1);
  P.gold += g;
  // the consignment goes on his shelf: sold goods appear on the buy list
  game.merchant.stock.push({ item: it, price: buyPrice(it) });
  toast('Sold ' + it.name + ' (+' + g + ' gold) - now on his shelf', 'item-' + it.rarity);
  S.gold();
  renderTrade();
}
function tradeBuy(j) {
  const m = game.merchant;
  if (!m) return;
  const s = m.stock[j];
  if (!s) return;
  if (P.inv.length >= INV_CAP) { toast('Backpack is full - no room for ' + s.item.name, ''); return; }
  if (P.gold < s.price) { toast('Merchant: "that will be ' + s.price + ' gold, good friend"', ''); return; }
  P.gold -= s.price;
  m.stock.splice(j, 1);
  P.inv.push(s.item);
  toast('Bought ' + s.item.name, 'item-' + s.item.rarity);
  S.gold();
  renderTrade();
}
if (tradeEl && tradeEl.addEventListener) {
  tradeEl.addEventListener('mousedown', (e) => {
    let t = e.target;
    while (t && t !== tradeEl) {
      if (t.dataset && (t.dataset.tab || t.dataset.sell !== undefined || t.dataset.buy !== undefined ||
        t.dataset.close !== undefined)) break;
      t = t.parentNode;
    }
    if (!t || t === tradeEl) return;
    if (t.dataset.close !== undefined) { tradeWindowClose(); return; } // the stall's own X (issue #56)
    if (t.dataset.tab) { tradeTab = t.dataset.tab; renderTrade(); return; }
    if (t.dataset.sell !== undefined) tradeSell(parseInt(t.dataset.sell, 10));
    else if (t.dataset.buy !== undefined) tradeBuy(parseInt(t.dataset.buy, 10));
  });
}
function equipFromInv(i) {
  const it = P.inv[i];
  if (!it) return;
  P.inv.splice(i, 1);
  const prev = P.eq[it.slot];
  P.eq[it.slot] = it;
  if (prev) P.inv.push(prev);
  refreshHpMax();
  S.item();
  if (charOpen) renderChar();
}
function statLine(it) {
  if (!it) return '<span class="csEmpty">—</span>';
  const sc = it.stats.map(st => '<span class="csStatV">' + st.txt + '</span>').join(' ');
  return '<span class="item-' + it.rarity + '">' + it.name + '</span> ' + sc;
}
function renderChar() {
  if (!charEl || !charOpen) return;
  const dmg = Math.round(playerDmg());
  const crit = Math.round(critChance() * 100);
  let h = '<div class="csTitle">' + CLASSES[P.cls || 'barbar'].name + ' — Level ' + P.level + ' <span class="csGold">◈ ' + P.gold + '</span></div>';
  const manaNow = Math.round(clamp(P.mana, 0, mpMax()));
  const manaRate = manaRegen();
  h += '<div class="csVitals"><span class="csHp">' + Math.ceil(Math.max(0, P.hp)) + '/' + P.hpMax + '</span> · ' +
       '<span class="csMp">' + manaNow + '/' + mpMax() + '</span> · dmg ' + dmg + '±15% · crit ' + crit + '% · exp ' +
       Math.floor(P.xp) + '/' + P.xpNeed + ' | mana rec ' + manaRate.toFixed(1) + '/s</div>';
  h += '<div class="csSub">Attributes — free: <span class="csPts">' + P.statPoints + '</span></div>';
  for (const row of ATTRS4) {
    const base = P.attr[row[0]], cur = curAttr(row[0]);
    h += '<div class="csAttrRow" data-attr="' + row[0] + '"><span>' + row[1] + ' <b>' + base +
      (cur !== base ? ' (' + cur + ')' : '') + '</b></span>' +
      (P.statPoints > 0 ? '<span class="csPlus">+</span>' : '') + '</div>';
  }
  h += '<div class="csSub">Equipment</div>';
  for (const s of SLOTS) h += '<div class="csGearRow">' + SLOTPL[s] + ': ' + statLine(P.eq[s]) + '</div>';
  h += '<div class="csSub">Backpack ' + P.inv.length + '/' + INV_CAP + ' — click on item → equip</div>';
  for (let i = 0; i < P.inv.length; i++)
    h += '<div class="csInvRow" data-inv="' + i + '">' + SLOTPL[P.inv[i].slot] + ': ' + statLine(P.inv[i]) +
         ' <span class="csNo" data-discard="' + i + '">✕</span></div>';
  if (!P.inv.length) h += '<div class="csEmptyRow">empty</div>';
  charEl.innerHTML = h;
}

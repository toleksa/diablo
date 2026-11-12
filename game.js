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
  atkT: 0, dead: false, leap: null,
  idleT: 0, idleP: 0, // fifteen idle seconds start a short stretch (issue #47)
  cd: { potion: 0, whirl: 0, leap: 0 },
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
  });
  game.monsters = []; game.projectiles = []; game.globes = [];
  game.goldpiles = []; game.drops = []; game.particles = [];
  game.chests = [];
  game.texts = []; game.rings = [];
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
    level: 1, gold: 0, atkT: 0, dead: false, leap: null,
    idleT: 0, idleP: 0,
    cd: { potion: 0, whirl: 0, leap: 0 },
    eq: { weapon: null, helm: null, armor: null },
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
function themeOf(cp) { return THEMES[clamp(Math.floor((cp - 1) / 3), 0, THEMES.length - 1)]; }


function generateLevel(checkpoint) {
  mcp = checkpoint;
  game.th = themeOf(checkpoint); // the palette this whole level is drawn in
  game.quota = 6 + checkpoint * 3;
  game.killedForQuota = 0;
  game.bossMode = false;
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
  const arena = checkpoint >= FINAL_LEVEL;
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
  // wall rects for drawing (culling in drawWalls keeps this cheap)
  for (let ty = 0; ty < GROWS; ty++) for (let tx = 0; tx < GCOLS; tx++)
    if (!grid[ty * GCOLS + tx]) game.walls.push({ x: tx * TS, y: ty * TS, w: TS, h: TS });
  // torches on south-facing wall faces above floor tiles
  for (let ty = 1; ty < GROWS - 1; ty++) for (let tx = 1; tx < GCOLS - 1; tx++) {
    if (!grid[ty * GCOLS + tx]) continue;
    if (!grid[(ty - 1) * GCOLS + tx] && ((tx + ty) & 1) === 0 && G(tx * 13, ty * 17) < 0.55)
      game.torches.push({ x: tx * TS + TS / 2, y: ty * TS + 12, ph: G(tx, ty) * TAU });
  }
  // start room, boss room (farthest), portal behind the boss
  if (arena) {
    const r0 = rooms[0];
    game.startPos = { x: (r0.x + r0.w / 2) * TS, y: (r0.y + r0.h - 2.5) * TS }; // the south gate
    game.portal = { x: (r0.x + r0.w / 2) * TS, y: (r0.y + 2) * TS, t: 0 };      // the north gate
    P.x = game.startPos.x; P.y = game.startPos.y;
    spawnBoss((r0.x + r0.w / 2) * TS, (r0.y + r0.h / 2) * TS - 40, 1.55);
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
  let bxs = bx - Math.cos(away) * 100, bys = by - Math.sin(away) * 100;
  if (solidAt(bxs, bys, 30)) { bxs = bx; bys = by; }
  P.x = game.startPos.x; P.y = game.startPos.y;
  spawnBoss(bxs, bys);
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
  for (let t2 = 0; t2 < 20; t2++) {
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
// the tenth level is the last one: it is the Roost, and slaying its overlord
// wins the run (issue #51)
const FINAL_LEVEL = 10;
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
    act: false, aggro: 460, // waits in the boss room until the player steps near
    homeX: x, homeY: y, leash: 0, leashT: 0, // his throne: bosses leash like any foe (issue #46)
  };
  game.boss = b; game.monsters.push(b);
  return b;
}

// ---------- FX / ENTITIES ----------
function ring(x, y, color) { game.rings.push({x,y,r:8,max:90,color,life:0.5}); }
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
function mpMax() { return 100 + (curAttr('int') - 8) * 4 + equipBonus('mp'); }
function critChance() { return 0.05 + (curAttr('dex') - 8) * 0.006 + equipBonus('crit') / 100; }
// movement speed: base × (1 + rolled % bonus from items)
function moveSpd() { return P.speed * (1 + equipBonus('spd') / 100); }
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
    for (let i=0;i<3;i++) dropItem(m.x+rand(-40,40), m.y+rand(-40,40), game.checkpoint, true, 'boss');
    S.portal();
    banner('Boss defeated — portal active!', '#58c8f0');
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
    if (P.leap) {
      const L = P.leap;
      L.t += dt / L.dur;
      if (L.t >= 1) { leapLand(L.tx, L.ty); P.leap = null; }
      else { P.x = L.sx + (L.tx - L.sx) * L.t; P.y = L.sy + (L.ty - L.sy) * L.t; }
    } else {
      let mx = 0, my = 0;
      if (K.w) my -= 1; if (K.s) my += 1; if (K.a) mx -= 1; if (K.d) mx += 1;
      if (mx || my) {
        const l = Math.hypot(mx, my);
        moveWithCollide(P, mx / l * moveSpd() * dt, my / l * moveSpd() * dt);
        if (mx) P.faceX = mx > 0 ? 1 : -1;
        P.aim = Math.atan2(my, mx);
        game.moveTarget = null;
      } else if (game.moveTarget) {
        const dx = game.moveTarget.x - P.x, dy = game.moveTarget.y - P.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) game.moveTarget = null;
        else {
          moveWithCollide(P, dx / d * moveSpd() * dt, dy / d * moveSpd() * dt);
          if (dx) P.faceX = dx > 0 ? 1 : -1;
          P.aim = Math.atan2(dy, dx);
        }
      }
    }

    for (const k of ['potion', 'whirl', 'leap']) P.cd[k] = Math.max(0, P.cd[k] - dt);
    P.mana = Math.min(mpMax(), P.mana + 6 * dt); // slow mana regen
    // very slow natural HP regen, unlocked from level 5
    if (P.level >= 5 && P.hp < P.hpMax) {
      const rg = 0.08 + (P.level - 5) * 0.015 + curAttr('vit') * 0.008;
      P.hp = Math.min(P.hpMax, P.hp + rg * dt);
    }
    P.atkT = Math.max(0, P.atkT - dt);
    P.hurtFlash = Math.max(0, P.hurtFlash - dt);
    if (K.w || K.a || K.s || K.d || game.moveTarget) P.walkPhase += dt * 11;
    else P.walkPhase *= Math.pow(0.02, dt);
    // idle animation (issue #47): a quarter-minute with nothing asked of the
    // hero and he starts shifting weight - shoulder roll, blade lifting off
    // the shoulder, head scanning. Any input stops it on the very next frame.
    if (K.w || K.a || K.s || K.d || game.moveTarget || game.mouseDown ||
        P.dead || P.leap || P.atkT > 0) {
      P.idleT = 0; P.idleP = 0;
    } else if (P.idleP > 0) {
      P.idleP += dt / 1.9; // the routine itself runs about two seconds
      if (P.idleP >= 1) { P.idleP = 0; P.idleT = 0; } // settled: wait again
    } else {
      P.idleT += dt;
      if (P.idleT >= 15) P.idleP = 0.001;
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
    if (game.portal && (game.boss === null || game.boss.dead) &&
        Math.hypot(P.x - game.portal.x, P.y - game.portal.y) < 26) {
      // the Roost's own portal is not a descent: stepping into it wins the run
      if (game.checkpoint === FINAL_LEVEL) showVictory();
      else nextCheckpoint();
    }
    if (game.mouseDown && P.atkT <= 0) tryAttack();
  }

  // --- monsters ---
  const near = game.monsters.filter(m => Math.hypot(m.x - P.x, m.y - P.y) < 320);
  if (!P.dead) {
    if (near.length === 0 && game.time > 1.5 && game.boss && !game.boss.dead) {
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
    // boss pre-spawns at level start in the farthest room (generateLevel);
    // the quota is progress flavour only now
  }
  for (const m of game.monsters) {
    if (m.dead) continue;
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    m.touchCd = Math.max(0, m.touchCd - dt);
    m.slow = Math.max(0, m.slow - dt);
    m.wob += dt * 6;
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
    if (pr.life <= 0 || !passableAt(pr.x, pr.y)) { pr.life = 0; continue; }
    if (pr.side === 'p') {
      // the hero's own shots (issue #53): a magic missile bends toward the
      // nearest foe, an arrow flies straight and true
      if (pr.home) {
        let ht = null, hd = 250;
        for (const m of game.monsters) {
          if (m.hp <= 0) continue;
          const d = Math.hypot(m.x - pr.x, m.y - pr.y);
          if (d >= hd) continue;
          hd = d; ht = m;
        }
        if (ht) {
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          const ca = Math.atan2(pr.vy, pr.vx);
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
          const crit = chance(critChance());
          damageMonster(m, Math.round(pr.dmg * (crit ? 1.9 : rand(0.9, 1.1))), crit, P);
          pr.life = 0;
          break;
        }
      }
      continue;
    }
    if (!P.dead && Math.hypot(pr.x - P.x, pr.y - P.y) < P.r + 5) {
      hurtPlayer(pr.dmg, pr.x, pr.y);
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
  for (const r of game.rings) { r.r += 420 * dt; r.life -= dt; }
  game.rings = game.rings.filter(r => r.life > 0);
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
function shootRanged() {
  const w = P.eq.weapon;
  const bowly = w.wk === 'bow';
  const rng = bowly ? 520 : 460;
  P.atkT = P.atkCd;
  // loose on the nearest foe you can see, otherwise straight ahead
  let best = null, bd = rng;
  for (const m of game.monsters) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d >= bd || !losClear(P.x, P.y, m.x, m.y)) continue;
    bd = d; best = m;
  }
  if (best) P.aim = Math.atan2(best.y - P.y, best.x - P.x);
  else if (game.moveTarget) P.aim = Math.atan2(game.moveTarget.y - P.y, game.moveTarget.x - P.x);
  const spd = bowly ? 660 : 450; // an arrow is quick and flat, a missile drifts and homes
  const hx = P.x + Math.cos(P.aim) * (P.r + 6), hy = P.y + Math.sin(P.aim) * (P.r + 6) - 4;
  if (bowly) S.bow(); else S.zap();
  game.projectiles.push({ x: hx, y: hy, vx: Math.cos(P.aim) * spd, vy: Math.sin(P.aim) * spd,
    dmg: playerDmg(), life: rng / spd + 0.25, color: bowly ? '#e0d2ae' : '#8ac7e8',
    side: 'p', arrow: bowly, home: !bowly });
  if (!bowly) ring(hx, hy, '#8ac7e8');
}

function tryAttack() {
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

function tryWhirlwind() {
  if (P.dead || P.leap || P.cd.whirl > 0) return false;
  if (rangedWeapon()) { toast('A bow or a staff cannot whirl', ''); return false; }
  if (P.mana < 30) { toast('Not enough mana', ''); return false; }
  P.cd.whirl = 6; P.mana -= 30;
  S.whirl();
  ring(P.x, P.y, '#d8c060'); ring(P.x, P.y, '#f2e6b0');
  screenShake(5);
  for (const m of game.monsters) {
    if (Math.hypot(m.x - P.x, m.y - P.y) < 112 + m.r)
      damageMonster(m, Math.round(playerDmg() * rand(0.8, 1.0)), chance(critChance()+0.05), P);
  }
  return true;
}

function tryLeap() {
  if (P.dead || P.leap || P.cd.leap > 0) return false;
  if (P.mana < 25) { toast('Not enough mana', ''); return false; }
  P.cd.leap = 5; P.mana -= 25;
  let tx = P.x + Math.cos(P.aim) * 240, ty = P.y + Math.sin(P.aim) * 240;
  if (game.moveTarget) {
    const a = Math.atan2(game.moveTarget.y - P.y, game.moveTarget.x - P.x);
    const dd = Math.min(240, Math.hypot(game.moveTarget.x - P.x, game.moveTarget.y - P.y));
    tx = P.x + Math.cos(a) * dd; ty = P.y + Math.sin(a) * dd;
  }
  // if landing on a wall — bring closer
  for (let i = 3; i > 0; i--) {
    const cx = P.x + (tx - P.x) * (i / 3), cy = P.y + (ty - P.y) * (i / 3);
    if (!solidAt(cx, cy, P.r)) { tx = cx; ty = cy; break; }
  }
  tx = clamp(tx, 30, WORLD.w - 30); ty = clamp(ty, 30, WORLD.h - 30);
  P.leap = { sx: P.x, sy: P.y, tx, ty, t: 0, dur: 0.36 };
  game.moveTarget = null;
  S.leap();
  return true;
}

function leapLand(x, y) {
  S.impact();
  screenShake(8);
  ring(x, y, '#ffd75e');
  burst(x, y, '#c8b070', 16, 240);
  for (const m of game.monsters) {
    if (Math.hypot(m.x - x, m.y - y) < 130 + m.r) {
      damageMonster(m, Math.round(playerDmg() * 1.3), chance(critChance()+0.1), { x, y });
      m.stun = Math.max(m.stun, 0.35);
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
  game.goldpiles = []; game.drops = []; game.rings = [];
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
    fell + ' lies felled on the floor of the Roost. The Infernal Crucible is yours:' +
    ' FAME ' + game.totalKills + ' for the monsters you cleared, GLORY ' + P.gold +
    ' for the gold you hoarded, and the muse above you, carved in marble for the season.' +
    ' Level ' + P.level + ' · Time ' + mins + ':' + secs;
  banner('The Crucible Is Yours', '#e8c477');
}
function closeVictoryWindow() {
  game.victoryOpen = false;
  game.paused = false;
  if (winEl) winEl.classList.add('hidden');
  game.moveTarget = null; // the hero stands still until you ask
}
function backToMenu() {
  closeVictoryWindow();
  game.running = false;
  const scr = document.getElementById('startScreen');
  if (scr) scr.classList.remove('hidden');
  if (loadSnapshot()) document.getElementById('continueBtn').classList.remove('hidden');
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

function drawTorches(t) {
  const th = game.th;
  for (const tc of game.torches) {
    const x = tc.x - vx, y = tc.y - vy;
    if (x < -50 || x > VW + 50 || y < -50 || y > VH + 50) continue;
    const fl = Math.sin(t * 7 + tc.ph) * 0.5 + Math.sin(t * 13.7 + tc.ph * 2) * 0.3;
    const fx = x + fl * 1.6;
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
function portalActive() { return game.boss === null || game.boss.dead; }
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
  const col = m.slow > 0 ? '#6ea8d8' : m.color;
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
function drawHandWeapon(wk, hx, hy, ang, flare) {
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
    ctx.strokeStyle = '#6b4a28'; ctx.lineWidth = 2.6; // the haft
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(ang) * 6, hy - Math.sin(ang) * 6);
    ctx.lineTo(hx + Math.cos(ang) * 13, hy + Math.sin(ang) * 13);
    ctx.stroke();
    const pa = ang + Math.PI / 2;
    const ax = hx + Math.cos(ang) * 10, ay = hy + Math.sin(ang) * 10;
    ctx.fillStyle = '#b8c1cb'; // a broad axe head
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(ang) * 4, ay - Math.sin(ang) * 4);
    ctx.lineTo(ax + Math.cos(pa) * 7.5, ay + Math.sin(pa) * 7.5);
    ctx.lineTo(ax + Math.cos(ang) * 6 + Math.cos(pa) * 4, ay + Math.sin(ang) * 6 + Math.sin(pa) * 4);
    ctx.lineTo(ax + Math.cos(ang) * 6 - Math.cos(pa) * 4, ay + Math.sin(ang) * 6 - Math.sin(pa) * 4);
    ctx.lineTo(ax - Math.cos(pa) * 7.5, ay - Math.sin(pa) * 7.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7f8791'; ctx.lineWidth = 1; // the socket
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(pa) * 7, ay - Math.sin(pa) * 7);
    ctx.lineTo(ax + Math.cos(pa) * 7, ay + Math.sin(pa) * 7);
    ctx.stroke();
    return;
  }
  if (wk === 'bow') {
    const pa = ang; // the belly of the bow faces the hero, the tips point down
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(hx, hy, 10, pa + Math.PI - 1.2, pa + Math.PI + 1.2);
    ctx.stroke();
    const t1 = pa + Math.PI - 1.2, t2 = pa + Math.PI + 1.2;
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

function drawPlayer() {
  const x = P.x - vx, y = P.y - vy;
  shadowAt(x, y + 6, P.r * 1.1, 0.4);
  const faceX = (P.faceX || 1);
  // idle animation progress: 0 stands, 0..1 arcs through the stretch (issue #47)
  const ip = (P.idleP > 0) ? Math.sin(Math.min(1, P.idleP) * Math.PI) : 0;
  if (ip > 0) {
    // the whole figure leans over its planted feet as the weight shifts side to
    // side, so the shadow stays put while the body rocks above it
    ctx.save();
    ctx.translate(x, y + 4);
    ctx.rotate(ip * 0.055 * faceX);
    ctx.translate(-x, -(y + 4));
  }
  const bob = Math.sin(P.walkPhase) * (Math.abs(Math.cos(P.walkPhase)) > 0.2 ? 2 : 1) + ip * 1.8;
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
  // --- walk cycle phase ---
  const w = P.walkPhase;
  const moving = w > 0.05;
  const s = moving ? Math.sin(w) : 0;          // leg swing (-1..1)
  const hipY = y - r * 0.34 + bob * 0.6;
  const shY = y - r * 0.92 + bob * 0.6;        // shoulder line
  const legLen = r * 0.62;
  // legs: steel greaves swinging opposite under the hips
  const f1x = x - r * 0.2 + s * faceX * r * 0.4 + ip * faceX * r * 0.16, f1y = y - r * 0.34 + legLen + Math.abs(s) * 1.8;
  const f2x = x + r * 0.2 - s * faceX * r * 0.4 - ip * faceX * r * 0.16, f2y = y - r * 0.34 + legLen + Math.abs(s) * 1.8;
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
  const hRx = x + r * 0.52 + (P.atkT > P.atkCd - 0.3 ? Math.cos(P.aim) * r * 0.35 : -armS * faceX * r * 0.3 + ip * faceX * r * 0.12);
  const hRy = shY + r * 0.42 - (P.atkT > P.atkCd - 0.3 ? 2 : Math.abs(armS) * 1.2 + ip * 3.4);
  const hLx = x - r * 0.52 + armS * faceX * r * 0.3 - ip * faceX * r * 0.1;
  const hLy = shY + r * 0.44 - ip * 1.4;
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
  if (ranged) wa = P.aim;
  else if (swingT >= 0) wa = P.aim - 0.7 + 1.4 * swingT;
  else wa = (faceX > 0 ? 0.55 : Math.PI - 0.55) - ip * 0.52 * (faceX > 0 ? 1 : -1);
  drawHandWeapon(wk, hRx, hRy, wa, (ranged && swingT >= 0) ? 1 : 0);
  // head + helmet - during the idle stretch the neck turns to scan the halls
  const hx2 = x + ip * faceX * 2.6, hy2 = y - r * 1.15 + bob * 0.6 - ip * 1.2;
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
    ctx.beginPath(); ctx.moveTo(hx2, hy2 - r * 0.3); ctx.lineTo(hx2 - faceX * (2 + ip * 2), hy2 - r * 0.52); ctx.stroke();
  } else {
    ctx.fillStyle = cl.paul;
    ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillStyle = '#5c6a7e';
    ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.4, Math.PI * 0.05, Math.PI * 0.45); ctx.fill(); // visor brim
  }
  // helmet crest
  ctx.strokeStyle = cl.crest; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx2, hy2 - r * 0.4); ctx.lineTo(hx2 - faceX * (3 + ip * 3), hy2 - r * 0.6); ctx.stroke();
  // hurt flash
  if (P.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(220,40,40,' + Math.min(0.6, P.hurtFlash * 4) + ')';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.44, shY); ctx.lineTo(x + r * 0.44, shY);
    ctx.lineTo(x + r * 0.36, hipY + 1); ctx.lineTo(x - r * 0.36, hipY + 1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(hx2, hy2, r * 0.38, 0, TAU); ctx.fill();
  }
  if (ip > 0) ctx.restore(); // undo the idle lean
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
  if (!P.dead) hole((P.x - vx) * D, (P.y - vy) * D, 255 * D, 1);
  for (const tc of game.torches) {
    const fl = Math.sin(t * 7 + tc.ph) * 6;
    const x = (tc.x - vx) * D, y = (tc.y - vy) * D;
    if (x < -160 * D || x > cv.width + 160 * D || y < -160 * D || y > cv.height + 160 * D) continue;
    hole(x, y, (102 + fl) * D, 1);
  }
  if (game.portal) hole((game.portal.x - vx) * D, (game.portal.y - vy) * D, (portalActive() ? 180 : 118) * D, 1);
  for (const pr of game.projectiles) hole((pr.x - vx) * D, (pr.y - vy) * D, 70 * D, 0.65);
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
  ctx.fillText(tradeOpen ? 'the world holds still · click a tab, T closes the stall'
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
  slotLMB: document.getElementById('slotLMB'),
};

// LMB-clicking a skill icon uses that skill directly (issue #15)
for (const sc of [
  [HUD.slotPotion, drinkPotion],
  [HUD.slotSkill2, tryWhirlwind],
  [HUD.slotSkill3, tryLeap],
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
  if (game.boss && !game.boss.dead) HUD.objText.textContent = 'Boss: ' + game.boss.name + ' — far in the dungeon';
  else if (game.checkpoint >= FINAL_LEVEL) HUD.objText.textContent = 'Enter the portal — the Crucible is yours';
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
    [HUD.slotSkill2, P.cd.whirl / 6, P.mana >= 30],
    [HUD.slotSkill3, P.cd.leap / 5, P.mana >= 25],
    [HUD.slotLMB, P.atkT / P.atkCd, true],
  ];
  for (const r of rings) {
    r[0].style.setProperty('--cd', clamp(r[1], 0, 1) + 'turn');
    r[0].classList.toggle('ready', r[1] <= 0 && r[2]);
    r[0].classList.toggle('noFury', !r[2]);
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
    case 'Digit2': case 'Numpad2': if (game.running && !game.paused) tryWhirlwind(); break;
    case 'Digit3': case 'Numpad3': if (game.running && !game.paused) tryLeap(); break;
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
  if (!P.dead && game.running && !P.leap) {
    P.aim = Math.atan2(w2.y - P.y, w2.x - P.x);
    // RMB held down: the character continuously follows the cursor (issue #14)
    if (game.rmbDown) game.moveTarget = w2;
  }
});
cv.addEventListener('mousedown', (e) => {
  if (e.button === 0) game.mouseDown = true;
  else if (e.button === 2) { game.rmbDown = true; game.moveTarget = worldAt(e.clientX, e.clientY); }
});
cv.addEventListener('mouseup', (e) => {
  if (e.button === 0) game.mouseDown = false;
  else if (e.button === 2) { game.rmbDown = false; game.moveTarget = null; } // release = stop immediately
});
cv.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  game.rmbDown = true;
  game.moveTarget = worldAt(e.clientX, e.clientY);
});

// ---------- run lifecycle ----------
function beginRun(cls) {
  clearSnapshot(); // a brand-new game discards the previous journey
  resetGame(); resetPlayer(cls);
  generateLevel(1);
  preplaceMonsters();
  cam.x = P.x - VW / 2; cam.y = P.y - VH / 2;
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
  if (d.eq) for (const s of SLOTS) P.eq[s] = d.eq[s] || null;
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
  let tgt = null, bd = 460;
  for (const m of game.monsters) {
    if (m.hp <= 0) continue; // corpses are not targets
    const d = Math.hypot(m.x - P.x, m.y - P.y);
    if (d >= bd || !losClear(P.x, P.y, m.x, m.y)) continue;
    bd = d; tgt = m;
  }
  if (tgt) {
    const wr = rangedWeapon() ? 500 : P.atkRange; // a bow fights at arm's length (issue #53)
    if (bd > wr + 20) { gx = tgt.x; gy = tgt.y; }
    game.mouseDown = bd < wr + 26;
    if (P.hp < P.hpMax * 0.4 && P.cd.potion <= 0) drinkPotion();
    let near = 0;
    for (const m of game.monsters) if (Math.hypot(m.x - P.x, m.y - P.y) < 100) near++;
    if (near >= 2 && P.mana >= 30 && !rangedWeapon()) tryWhirlwind();
  } else {
    game.mouseDown = false;
    // 2) loot / orbs / gold, 3) chests, 4) portal (when boss down) or boss —
    // all sight-limited too, so the bot never presses into a wall for loot
    let best = null, bd2 = 520;
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
      if (d < 760 && (bd2 > 520 || d < bd2) && losClear(P.x, P.y, ch.x, ch.y)) { bd2 = d; best = ch; }
    }
    const bossDown = game.boss === null || game.boss.dead;
    if (game.portal && bossDown) {
      const d = Math.hypot(game.portal.x - P.x, game.portal.y - P.y);
      if (d < 1100) best = game.portal;
    } else if (game.boss && !game.boss.dead) {
      const d = Math.hypot(game.boss.x - P.x, game.boss.y - P.y);
      if (d < 950) { best = game.boss; bd2 = 0; }
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
    closeVictoryWindow();
    nextCheckpoint();
    toast('The journey continues — deeper than the Crucible was drawn', '');
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
  renderTrade();
  toast('Trade post - click a tab, press T to close', '');
  S.gold();
}
function closeTrade() {
  tradeOpen = false;
  if (tradeEl) tradeEl.classList.add('hidden');
  if (tradeFreeze) { game.paused = false; tradeFreeze = false; }
  toast('Trade closed', '');
}
function renderTrade() {
  if (!tradeEl || !tradeOpen || !game.merchant) return;
  const m = game.merchant;
  let h = '<div class="trTitle">' + m.name + ' <span class="csGold">' + GEM + ' ' + P.gold + '</span></div>';
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
      if (t.dataset && (t.dataset.tab || t.dataset.sell !== undefined || t.dataset.buy !== undefined)) break;
      t = t.parentNode;
    }
    if (!t || t === tradeEl) return;
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
  h += '<div class="csVitals"><span class="csHp">' + Math.ceil(Math.max(0, P.hp)) + '/' + P.hpMax + '</span> · ' +
       '<span class="csMp">' + manaNow + '/' + mpMax() + '</span> · dmg ' + dmg + '±15% · crit ' + crit + '% · exp ' +
       Math.floor(P.xp) + '/' + P.xpNeed + '</div>';
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

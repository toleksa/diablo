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
  item()     { [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.15, "triangle", 0.16), i * 90)); },
  shoot()    { tone(900, 0.06, "square", 0.08, 400); },
  elite()    { tone(110, 0.5, "sawtooth", 0.25, 55); noise(0.3, 0.2, 500); },
  bossRoar() { tone(70, 1.1, "sawtooth", 0.35, 40); noise(0.8, 0.3, 420); },
  awaken()   { tone(150, 0.3, "sawtooth", 0.16, 75); noise(0.1, 0.12, 900); },
};

// ---------- Constants ----------
const WORLD = { w: 2816, h: 2112 };
const TS = 64, GCOLS = WORLD.w / TS, GROWS = WORLD.h / TS; // 44 x 33 tiles
const WALL_H = 26;

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
  moveTarget: null, mouseDown: false, deathShown: false,
  totalKills: 0,
};
function resetGame() {
  mcp = 1;
  Object.assign(game, {
    running: true, checkpoint: 1, time: 0, shake: 0,
    quota: 9, killedForQuota: 0, bossMode: false,
    spawnDelay: 1.2, portal: null, boss: null,
    moveTarget: null, mouseDown: false, deathShown: false,
    totalKills: 0,
  });
  game.monsters = []; game.projectiles = []; game.globes = [];
  game.goldpiles = []; game.drops = []; game.particles = [];
  game.texts = []; game.rings = [];
  game.decals = [];
}
function resetPlayer() {
  Object.assign(P, {
    x: WORLD.w / 2, y: WORLD.h - 200, aim: -Math.PI / 2, walkPhase: 0,
    hurtT: -1, hurtFlash: 0,
    hp: P.baseHp, hpMax: P.baseHp, mana: 0,
    attr: { str: 8, dex: 8, int: 8, vit: 10 }, statPoints: 0, inv: [],
    xp: 0, xpNeed: 60,
    level: 1, gold: 0, atkT: 0, dead: false, leap: null,
    cd: { potion: 0, whirl: 0, leap: 0 },
    eq: { weapon: null, helm: null, armor: null },
  });
}

// ---------- Walls / level generation ----------
function generateLevel(checkpoint) {
  mcp = checkpoint;
  game.quota = 6 + checkpoint * 3;
  game.killedForQuota = 0;
  game.bossMode = false;
  _seed = checkpoint * 7717 + 991;
  game.walls = [];
  game.torches = [];
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
  fallen: { name:'Fallen', hp:34, dmg:7, speed:105, r:14, color:'#7a8a4a', xp:9, touchCd:1.0, ai:'melee' },
  archer: { name:'Fallen Archer', hp:26, dmg:8, speed:85, r:13, color:'#5a7a5a', xp:11, touchCd:1.4, ai:'ranged', range:340 },
  zombie: { name:'Ghoul', hp:60, dmg:11, speed:62, r:16, color:'#6b6b52', xp:13, touchCd:1.2, ai:'melee' },
  skeleton: { name:'Skeleton', hp:48, dmg:13, speed:118, r:14, color:'#c8c2ae', xp:15, touchCd:0.9, ai:'melee' },
  cultist: { name:'Cultist', hp:42, dmg:12, speed:80, r:14, color:'#8a4a4a', xp:17, touchCd:1.5, ai:'ranged', range:400 },
};
const BOSS = { name:'Lech – King of the Fallen', hp:620, dmg:17, speed:90, r:30, color:'#b03a3a', xp:240, touchCd:0.8, ai:'boss' };

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
  if (cp>=2) pool.push('archer','zombie');
  if (cp>=3) pool.push('skeleton','cultist');
  if (cp>=4) pool.push('cultist','archer','skeleton');
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

function spawnBoss(x, y) {
  if (x == null) { const p = findSpawnPoint(); x = p.x; y = p.y; }
  const d = mtier(BOSS, game.checkpoint);
  const b = {
    kind:'boss', type:'boss', name: d.name, x, y, r:d.r,
    hp:d.hp, hpMax:d.hp, dmg:d.dmg, speed:d.speed, xp:d.xp, color:d.color,
    touchCd:d.touchCd, cd:1, ai:'boss', range: d.r + P.r + 6, elite:false,
    angle:0, hitFlash:0, slow:0, wob:0, dashCd:2.5, summonCd:5, stun:0, kx:0, ky:0,
    act: false, aggro: 460, // waits in the boss room until the player steps near
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
function dropGlobes(x, y, xp) {
  const n = clamp(Math.round(xp/6), 2, 6);
  const val = Math.max(2, Math.round(xp/n));
  for (let i=0;i<n;i++)
    game.globes.push({type:'xp', val, life:13, x:x+rand(-18,18), y:y+rand(-18,18), vx:rand(-60,60), vy:rand(-60,60), r:5, color:'#3ad15a'});
  if (chance(0.4))
    game.globes.push({type:'heal', val:0, life:13, x:x+rand(-14,14), y:y+rand(-14,14), vx:rand(-40,40), vy:rand(-40,40), r:7, color:'#e03535'});
  if (chance(0.35))
    game.globes.push({type:'mana', val:0, life:13, x:x+rand(-14,14), y:y+rand(-14,14), vx:rand(-40,40), vy:rand(-40,40), r:6, color:'#3a7ae0'});
}

function dropGold(x, y, cp) {
  const amount = randInt(4, 12) * cp;
  game.goldpiles.push({x, y, amount, r:8, life:26, bob:rand(0,TAU)});
}

// ---------- ITEMS ----------
const RARITY = [
  { id:'common',  name:'',        w:56, mult:1.0,  afx:0 },
  { id:'magic',   name:'Magiczny',   w:28, mult:1.5, afx:1 },
  { id:'rare',    name:'Ekskluzywny',w:13, mult:2.2, afx:2 },
  { id:'legend',  name:'Legendarny', w:3,  mult:3.4, afx:3 },
];
const SLOTS = ['weapon','helm','armor'];
const BASES = {
  weapon: { name:'Miecz', dmg:[6,10] },
  helm:   { name:'Helm',  hp:[14,22] },
  armor:  { name:'Zbroja', hp:[24,36] },
};
const AFFIX = ['Might','Storm','Dragon','Shadow','Angel','Demon','Tempest','Wolf','Bone Claw','Blazing Fury'];
const BONUSK = ['dmg', 'hp', 'mp', 'crit', 'spd']; // damage/life/mana/crit/move-speed

function rollItem(cp, forceGood) {
  let total = RARITY.reduce((s,r)=>s+r.w,0);
  let roll = rand(0, total); if (forceGood) roll = Math.min(roll, 3); // rzadziej ale nigdy common wymuszony
  let rar = RARITY[0];
  for (const r of RARITY) { if (roll < r.w) { rar = r; break; } roll -= r.w; }
  const slot = pick(SLOTS), b = BASES[slot];
  const scale = 1 + (cp-1)*0.3;
  const stats = [];
  let wscale = null;
  if (slot==='weapon') {
    wscale = pick(['str', 'dex', 'int']);
    // scaling %: 1..200, higher rolls progressively rarer
    const pct = Math.max(1, Math.round(200 * Math.pow(rand(0, 1), 2.6)));
    const v = Math.round(rand(b.dmg[0], b.dmg[1]) * scale * rar.mult);
    stats.push({k:'dmg', v, scale: wscale, pct,
      txt: 'Damage: +' + v + ' (+' + pct + '% ' + ATTRPL[wscale] + ')'});
  } else {
    const v = Math.round(rand(b.hp[0], b.hp[1]) * scale * rar.mult);
    stats.push({k:'hp', v, txt:'Life: +'+v});
  }
  const names = [];
  for (let i=0;i<rar.afx;i++){
    // a bonus kind (dmg/hp) may appear on an item at most once; affixes can
    // also roll mana, critical chance and movement speed (issue #8)
    const pool = BONUSK.filter(k => !stats.some(st => st.k === k));
    if (!pool.length) break;
    const a = pick(AFFIX);
    const kind = pick(pool);
    if (kind === 'dmg') {
      const v = randInt(1, 3) * (1 + Math.floor(cp / 3));
      stats.push({k:'dmg', v, txt:'Damage: +'+v});
    } else if (kind === 'hp') {
      const v = randInt(3, 8) * (1 + Math.floor(cp / 2));
      stats.push({k:'hp', v, txt:'Life: +'+v});
    } else if (kind === 'mp') {
      const v = randInt(5, 14) * (1 + Math.floor(cp / 3));
      stats.push({k:'mp', v, txt:'Mana: +'+v});
    } else if (kind === 'crit') {
      const v = randInt(2, 5) + Math.floor(cp / 5);
      stats.push({k:'crit', v, txt:'Critical Chance: +'+v+'%'});
    } else {
      const v = randInt(4, 12) + Math.floor(cp / 4);
      stats.push({k:'spd', v, txt:'Movement Speed: +'+v+'%'});
    }
    names.push(a);
  }
  const nm = (rar.name ? rar.name+' ' : '') + b.name + (names.length ? ' '+names.join(' i ') : '');
  // score counts the scaling bonus at an assumed average attribute (~11):
  // bonus dmg ≈ pct × 11 / 100
  // score weights each bonus kind; scaling bonus valued at an assumed attribute (~11)
  const W8 = { dmg: 2.2, hp: 1, mp: 0.45, crit: 2.4, spd: 1.4 };
  const score = stats.reduce((s, st) =>
    s + (st.k === 'dmg' ? (st.v + (st.pct || 0) * 0.11) : st.v) * (W8[st.k] || 1), 0);
  return { slot, name:nm, rarity:rar.id, stats, score, cp };
}

function dropItem(x, y, cp, guarantee) {
  const it = rollItem(cp, guarantee || chance(0.14 + cp*0.01));
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
      if (st.scale && st.pct) d += P.attr[st.scale] * st.pct / 100;
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
function mpMax() { return 100 + (P.attr.int - 8) * 4 + equipBonus('mp'); }
function critChance() { return 0.05 + (P.attr.dex - 8) * 0.006 + equipBonus('crit') / 100; }
// movement speed: base × (1 + rolled % bonus from items)
function moveSpd() { return P.speed * (1 + equipBonus('spd') / 100); }
function playerHpMax() {
  let h = P.baseHp + (P.level-1)*14 + (P.attr.vit - 10) * 6;
  for (const s of SLOTS) { const e = P.eq[s]; if (e) for (const st of e.stats) if (st.k==='hp') h += st.v; }
  return h;
}
function refreshHpMax() {
  const nm = playerHpMax();
  if (nm !== P.hpMax) { const diff = nm - P.hpMax; P.hpMax = nm; if (diff>0) P.hp += diff; }
  if (P.hp > P.hpMax) P.hp = P.hpMax;
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
  dropGlobes(m.x, m.y, m.xp);
  dropGold(m.x, m.y, game.checkpoint);
  if (chance(m.elite ? 0.9 : (m.type==='boss' ? 1 : 0.16)))
    dropItem(m.x + rand(-20,20), m.y + rand(-20,20), game.checkpoint, m.elite || m.type==='boss');
  if (m.type === 'boss') {
    game.boss = null; game.bossMode = false;
    game.shake = 18; S.impact();
    for (let i=0;i<3;i++) dropItem(m.x+rand(-40,40), m.y+rand(-40,40), game.checkpoint, true);
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
    S.levelUp(); ring(P.x, P.y, '#ffd75e'); ring(P.x, P.y, '#ffffff');
    banner('Level ' + P.level + '! · +3 attribute points (C)', '#ffd75e');
    if (charOpen) renderChar();
  }
}

// no autoequip: pickups always go to the backpack; the player equips
// manually from the character sheet; full backpack -> sold to gold
function pickUpItem(it) {
  if (P.inv.length < 12) {
    P.inv.push(it);
    toast('Taken: ' + it.name + ' (backpack) · C = sheet', 'item-' + it.rarity);
  } else {
    const g = 10 + it.cp * 6 + Math.round(it.score);
    P.gold += g;
    toast(it.name + ' → sold (+' + g + ' gold)', 'item-' + it.rarity);
    S.gold();
  }
  S.item();
  if (charOpen) renderChar();
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
      const rg = 0.08 + (P.level - 5) * 0.015 + P.attr.vit * 0.008;
      P.hp = Math.min(P.hpMax, P.hp + rg * dt);
    }
    P.atkT = Math.max(0, P.atkT - dt);
    P.hurtFlash = Math.max(0, P.hurtFlash - dt);
    if (K.w || K.a || K.s || K.d || game.moveTarget) P.walkPhase += dt * 11;
    else P.walkPhase *= Math.pow(0.02, dt);
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
        Math.hypot(P.x - game.portal.x, P.y - game.portal.y) < 26) nextCheckpoint();
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

    if (m.kind === 'boss') {
      m.dashCd -= dt; m.summonCd -= dt;
      if (m.summonCd <= 0) {
        m.summonCd = 8;
        S.elite();
        banner('Lech summons minions!', '#ff5060');
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
      if (g.type === 'xp') { P.xp += g.val; gainXpCheck(); }
      else if (g.type === 'heal') { P.hp = Math.min(P.hpMax, P.hp + Math.ceil(P.hpMax * 0.15)); S.healGlobe(); }
      else if (g.type === 'mana') { P.mana = Math.min(mpMax(), P.mana + 14); }
      else { P.gold += g.val; }
    }
  }
  game.globes = game.globes.filter(g => g.life > 0);
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
    it.life -= dt;
    it.bob += dt * 3;
    const d = Math.hypot(P.x - it.x, P.y - it.y);
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

function tryAttack() {
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
      v: 1, ts: Date.now(),
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
  const ts = 64;
  const x0 = Math.floor(vx / ts), x1 = Math.floor((vx + VW) / ts);
  const y0 = Math.floor(vy / ts), y1 = Math.floor((vy + VH) / ts);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const h1 = hash2(tx, ty);
    const base = 24 + Math.floor(h1 * 9);
    ctx.fillStyle = 'rgb(' + (base + 8) + ',' + (base + 3) + ',' + (base - 4) + ')';
    ctx.fillRect(tx * ts - vx, ty * ts - vy, ts + 1, ts + 1);
    if (h1 > 0.9) {
      ctx.fillStyle = 'rgba(92,84,66,0.55)';
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
  for (const w of game.walls) {
    const x = w.x - vx, y = w.y - vy;
    if (x + w.w < -40 || x > VW + 40 || y + w.h < -90 || y > VH + 40) continue;
    // front (south-facing) side — pseudo-3D
    ctx.fillStyle = '#191410';
    ctx.fillRect(x, y + w.h - WALL_H, w.w, WALL_H);
    ctx.strokeStyle = 'rgba(120,102,74,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + w.h + 0.5 - WALL_H); ctx.lineTo(x + w.w, y + w.h + 0.5 - WALL_H);
    ctx.stroke();
    // top
    ctx.fillStyle = '#39322a';
    ctx.fillRect(x, y - WALL_H, w.w, w.h);
    ctx.strokeStyle = 'rgba(150,132,98,0.22)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y - WALL_H, w.w, w.h);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let bx = x; bx < x + w.w - 14; bx += 28)
      if (hash2(Math.round(bx + vx), Math.round(w.y)) > 0.5) ctx.fillRect(bx, y - WALL_H, 13, 7);
  }
}

function drawTorches(t) {
  for (const tc of game.torches) {
    const x = tc.x - vx, y = tc.y - vy;
    if (x < -50 || x > VW + 50 || y < -50 || y > VH + 50) continue;
    const fl = Math.sin(t * 7 + tc.ph) * 0.5 + Math.sin(t * 13.7 + tc.ph * 2) * 0.3;
    const fx = x + fl * 1.6;
    ctx.fillStyle = '#241b10';
    ctx.fillRect(x - 1.5, y - 13, 3, 13);
    ctx.fillStyle = 'rgba(255,188,74,0.92)';
    ctx.beginPath(); ctx.ellipse(fx, y - 17 - fl * 2, 4.4, 7.5 + fl * 1.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,242,190,0.92)';
    ctx.beginPath(); ctx.ellipse(fx, y - 17 - fl * 2, 2.1, 3.7, 0, 0, TAU); ctx.fill();
  }
}
// ============ PART 6b — entities ============
const RCOLOR = { common: '#c8c8c8', magic: '#7aa8ff', rare: '#ffcf4a', legend: '#ff8a3a' };

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
  } else if (m.type === 'boss') {
    ctx.fillStyle = '#3a2222';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.62, y - r * 1.5 + bob);
    ctx.lineTo(x - r * 0.32, y - r * 0.8 + bob);
    ctx.lineTo(x - r * 0.9, y - r * 0.9 + bob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.62, y - r * 1.5 + bob);
    ctx.lineTo(x + r * 0.32, y - r * 0.8 + bob);
    ctx.lineTo(x + r * 0.9, y - r * 0.9 + bob);
    ctx.closePath(); ctx.fill();
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

function drawPlayer() {
  const x = P.x - vx, y = P.y - vy;
  shadowAt(x, y + 6, P.r * 1.1, 0.4);
  const bob = Math.sin(P.walkPhase) * (Math.abs(Math.cos(P.walkPhase)) > 0.2 ? 2 : 1);
  const r = P.r;
  const faceX = (P.faceX || 1);
  // sword + slash
  if (P.atkT > P.atkCd - 0.3) {
    const pr = Math.max(0, Math.min(1, (P.atkCd - P.atkT) / 0.3));
    const sa = P.aim - 0.7 + 1.4 * pr;
    ctx.strokeStyle = 'rgba(235,238,250,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(sa) * 8, y - 6 + Math.sin(sa) * 8);
    ctx.lineTo(x + Math.cos(sa) * 30, y - 6 + Math.sin(sa) * 30);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(245,245,255,' + (0.8 * (1 - pr)) + ')';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(x, y - 6, P.atkRange * 0.8, P.aim - 1.0 + 1.6 * pr, P.aim - 0.2 + 1.6 * pr);
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
  const f1x = x - r * 0.2 + s * faceX * r * 0.4, f1y = y - r * 0.34 + legLen + Math.abs(s) * 1.8;
  const f2x = x + r * 0.2 - s * faceX * r * 0.4, f2y = y - r * 0.34 + legLen + Math.abs(s) * 1.8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2c3442'; ctx.lineWidth = r * 0.27;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.19, hipY + 1); ctx.lineTo(f1x, f1y);
  ctx.moveTo(x + r * 0.19, hipY + 1); ctx.lineTo(f2x, f2y);
  ctx.stroke();
  // boots
  ctx.fillStyle = '#1f242e';
  ctx.beginPath(); ctx.arc(f1x, f1y + 1, r * 0.15, 0, TAU); ctx.arc(f2x, f2y + 1, r * 0.15, 0, TAU); ctx.fill();
  // tassets/skirt over the hips
  ctx.fillStyle = '#353f50';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, hipY - 2); ctx.lineTo(x + r * 0.42, hipY - 2);
  ctx.lineTo(x + r * 0.34, hipY + r * 0.3); ctx.lineTo(x - r * 0.34, hipY + r * 0.3);
  ctx.closePath(); ctx.fill();
  // armored cuirass (trapezoid torso)
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#3e4a5c';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.44, shY); ctx.lineTo(x + r * 0.44, shY);
  ctx.lineTo(x + r * 0.36, hipY + 1); ctx.lineTo(x - r * 0.36, hipY + 1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3e4a5c'; ctx.lineWidth = 3; ctx.stroke(); // round the corners
  // gold central ridge + belt
  ctx.strokeStyle = '#c8a45a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, shY + 1.5); ctx.lineTo(x, hipY); ctx.stroke();
  ctx.strokeStyle = '#8a6a34'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - r * 0.38, hipY - 1); ctx.lineTo(x + r * 0.38, hipY - 1); ctx.stroke();
  // pauldrons
  ctx.fillStyle = '#7e8ea4';
  ctx.beginPath(); ctx.arc(x - r * 0.44, shY + 1, r * 0.21, 0, TAU); ctx.arc(x + r * 0.44, shY + 1, r * 0.21, 0, TAU); ctx.fill();
  // arms: right holds the sword (swings with the slash), left counter-swings
  const armS = moving ? Math.sin(w) : 0;
  const hRx = x + r * 0.52 + (P.atkT > P.atkCd - 0.3 ? Math.cos(P.aim) * r * 0.35 : -armS * faceX * r * 0.3);
  const hRy = shY + r * 0.42 - (P.atkT > P.atkCd - 0.3 ? 2 : Math.abs(armS) * 1.2);
  const hLx = x - r * 0.52 + armS * faceX * r * 0.3;
  const hLy = shY + r * 0.44;
  ctx.strokeStyle = '#46536a'; ctx.lineWidth = r * 0.19;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.4, shY + 2); ctx.lineTo(hRx, hRy);
  ctx.moveTo(x - r * 0.4, shY + 2); ctx.lineTo(hLx, hLy);
  ctx.stroke();
  ctx.fillStyle = '#b8a27c'; // gauntlet/hands
  ctx.beginPath(); ctx.arc(hRx, hRy, r * 0.12, 0, TAU); ctx.arc(hLx, hLy, r * 0.12, 0, TAU); ctx.fill();
  // sheathed sword at rest in the right hand
  if (!(P.atkT > P.atkCd - 0.3)) {
    ctx.strokeStyle = '#c9d2dd'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hRx, hRy);
    ctx.lineTo(hRx + Math.cos(P.aim) * r * 0.85, hRy + Math.sin(P.aim) * r * 0.85);
    ctx.stroke();
    ctx.strokeStyle = '#c8a45a'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(hRx - Math.cos(P.aim + Math.PI / 2) * 3, hRy - Math.sin(P.aim + Math.PI / 2) * 3);
    ctx.lineTo(hRx + Math.cos(P.aim + Math.PI / 2) * 3, hRy + Math.sin(P.aim + Math.PI / 2) * 3);
    ctx.stroke();
  }
  // head + helmet
  ctx.fillStyle = '#b8a27c';
  ctx.beginPath(); ctx.arc(x, y - r * 1.15 + bob * 0.6, r * 0.36, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7e8ea4';
  ctx.beginPath(); ctx.arc(x, y - r * 1.15 + bob * 0.6, r * 0.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.fillStyle = '#5c6a7e';
  ctx.beginPath(); ctx.arc(x, y - r * 1.15 + bob * 0.6, r * 0.4, Math.PI * 0.05, Math.PI * 0.45); ctx.fill(); // visor brim
  // helmet crest
  ctx.strokeStyle = '#a03a3a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - r * 1.55 + bob * 0.6); ctx.lineTo(x - faceX * 3, y - r * 1.75 + bob * 0.6); ctx.stroke();
  // hurt flash
  if (P.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(220,40,40,' + Math.min(0.6, P.hurtFlash * 4) + ')';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.44, shY); ctx.lineTo(x + r * 0.44, shY);
    ctx.lineTo(x + r * 0.36, hipY + 1); ctx.lineTo(x - r * 0.36, hipY + 1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - r * 1.15 + bob * 0.6, r * 0.38, 0, TAU); ctx.fill();
  }
}
// ============ PART 6d — FX, lighting, main render ============
function drawProjectiles() {
  ctx.lineCap = 'round';
  for (const pr of game.projectiles) {
    const x = pr.x - vx, y = pr.y - vy;
    if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue;
    const a = Math.atan2(pr.vy, pr.vx);
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
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.fillStyle = 'rgba(4,3,8,0.87)';
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
    g.addColorStop(0, 'rgba(255,145,45,0.15)');
    g.addColorStop(1, 'rgba(255,145,45,0)');
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
  ctx.fillStyle = '#070503';
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

function hudUpdate() {
  const rn = ROMAN[Math.min(ROMAN.length - 1, game.checkpoint)];
  HUD.objTitle.textContent = 'Act ' + rn + ' — Old Ruins';
  if (game.boss && !game.boss.dead) HUD.objText.textContent = 'Boss: ' + game.boss.name + ' — far in the dungeon';
  else HUD.objText.textContent = 'Enter portal';
  HUD.goldText.textContent = String(P.gold);
  HUD.hpFill.style.height = clamp(P.hp / P.hpMax, 0, 1) * 100 + '%';
  HUD.hpText.textContent = Math.max(0, Math.round(P.hp)) + '/' + P.hpMax;
  HUD.resourceFill.style.height = P.mana / mpMax() * 100 + '%';
  HUD.resourceText.textContent = Math.round(P.mana) + '/' + mpMax();
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
}
// ---------- input ----------
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': K.w = true; break;
    case 'KeyS': case 'ArrowDown': K.s = true; break;
    case 'KeyA': case 'ArrowLeft': K.a = true; break;
    case 'KeyD': case 'ArrowRight': K.d = true; break;
    case 'Digit1': case 'Numpad1': if (game.running) drinkPotion(); break;
    case 'Digit2': case 'Numpad2': if (game.running) tryWhirlwind(); break;
    case 'Digit3': case 'Numpad3': if (game.running) tryLeap(); break;
    case 'KeyC': if (game.running) toggleChar(); break;
    case 'KeyM': if (game.running) toggleMap(); break;
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
  if (!P.dead && game.running && !P.leap)
    P.aim = Math.atan2(w2.y - P.y, w2.x - P.x);
});
cv.addEventListener('mousedown', (e) => {
  if (e.button === 0) game.mouseDown = true;
  else if (e.button === 2) game.moveTarget = worldAt(e.clientX, e.clientY);
});
cv.addEventListener('mouseup', (e) => { if (e.button === 0) game.mouseDown = false; });
cv.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  game.moveTarget = worldAt(e.clientX, e.clientY);
});

// ---------- run lifecycle ----------
function beginRun() {
  clearSnapshot(); // a brand-new game discards the previous journey
  resetGame(); resetPlayer();
  generateLevel(1);
  preplaceMonsters();
  cam.x = P.x - VW / 2; cam.y = P.y - VH / 2;
  toast('Checkpoint 1 — Old Ruins', '');
  toast('C — character and equipment · walk over items to pick them up', '');
}

// continue the journey saved at the last portal (issue #10)
function beginContinue() {
  const d = loadSnapshot();
  if (!d) { beginRun(); return; }
  resetGame(); resetPlayer();
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
if (loadSnapshot()) contBtn.classList.remove('hidden'); // a saved journey exists: offer it
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  beginRun();
});
contBtn.addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  beginContinue();
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('deathScreen').classList.add('hidden');
  beginContinue(); // retry at the last saved portal; fresh start when there is no save
});

// ---------- main loop ----------
let lastT = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000);
  lastT = ts;
  if (game.running && dt > 0) {
    update(dt);
    hudUpdate();
    render(dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ============ PART 8 — CARD OF THE CHARACTER / ATTRIBUTES / EQUIPMENT ============
const ATTRPL = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence', vit: 'Vitality' };
const ATTRS4 = [['str', 'Strength'], ['dex', 'Dexterity'], ['int', 'Intelligence'], ['vit', 'Vitality']];
const SLOTPL = { weapon: 'Weapon', helm: 'Helmet', armor: 'Armor' };
let charOpen = false;
const charEl = document.getElementById('charSheet');
if (charEl && charEl.addEventListener) {
  charEl.addEventListener('click', (e) => {
    // the click target is often an inner <span> (item name / stat text), so
    // walk up to the row element that actually carries data-attr / data-inv
    let t = e.target;
    while (t && t !== charEl) {
      const ds = t.dataset;
      if (ds && (ds.attr || (ds.inv !== undefined && ds.inv !== ''))) break;
      t = t.parentNode;
    }
    if (!t || t === charEl) return;
    const ds = t.dataset;
    if (ds.attr) addAttrPoint(ds.attr);
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
const devMenu = document.createElement('div');
devMenu.id = 'devMenu';
devMenu.classList.add('hidden');
devMenu.innerHTML =
  '<div class="devTitle">Developer menu</div>' +
  '<button data-dev="god">Toggle god mode</button>' +
  '<button data-dev="level">Instant level up</button>' +
  '<button data-dev="items">Spawn 5 random items</button>' +
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
  } else if (act === 'level') {
    P.xp += P.xpNeed;
    gainXpCheck();
    toast('DEV: instant level up', '');
  } else if (act === 'items') {
    for (let i = 0; i < 5; i++) {
      let px = P.x, py = P.y;
      for (let k = 0; k < 8; k++) {
        const a = rand(0, TAU), dd = rand(36, 140);
        const tx = P.x + Math.cos(a) * dd, ty = P.y + Math.sin(a) * dd;
        if (!solidAt(tx, ty, 12)) { px = tx; py = ty; break; }
      }
      dropItem(px, py, game.checkpoint, true);
    }
    toast('DEV: 5 items spawned around you', '');
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
  let h = '<div class="csTitle">Barbar — Level ' + P.level + ' <span class="csGold">◈ ' + P.gold + '</span></div>';
  h += '<div class="csVitals"><span class="csHp">' + Math.ceil(Math.max(0, P.hp)) + '/' + P.hpMax + '</span> · ' +
       '<span class="csMp">' + Math.round(P.mana) + '/' + mpMax() + '</span> · dmg ' + dmg + '±15% · crit ' + crit + '% · exp ' +
       Math.floor(P.xp) + '/' + P.xpNeed + '</div>';
  h += '<div class="csSub">Attributes — free: <span class="csPts">' + P.statPoints + '</span></div>';
  for (const row of ATTRS4) {
    h += '<div class="csAttrRow"><span>' + row[1] + ' <b>' + P.attr[row[0]] + '</b></span>' +
         (P.statPoints > 0 ? '<span class="csPlus" data-attr="' + row[0] + '">+</span>' : '') + '</div>';
  }
  h += '<div class="csSub">Equipment</div>';
  for (const s of SLOTS) h += '<div class="csGearRow">' + SLOTPL[s] + ': ' + statLine(P.eq[s]) + '</div>';
  h += '<div class="csSub">Backpack ' + P.inv.length + '/12 — click on item → equip</div>';
  for (let i = 0; i < P.inv.length; i++)
    h += '<div class="csInvRow" data-inv="' + i + '">' + SLOTPL[P.inv[i].slot] + ': ' + statLine(P.inv[i]) + '</div>';
  if (!P.inv.length) h += '<div class="csEmptyRow">empty</div>';
  charEl.innerHTML = h;
}

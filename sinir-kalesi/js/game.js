// Sınır Kalesi — tower defense prototipi (Canvas, bağımlılıksız).
// Mantıksal çözünürlük 960x540; ekrana ölçeklenir.

(() => {
'use strict';

// ---------- yardımcılar ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const roll = (r) => rand(r[0], r[1]);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- sprite'lar ----------
// img/manifest.json içindeki dosyalar (png veya svg) yüklenir; anahtar uzantısız addır.
// SVG'ler bir kez tuvale basılır (her karede vektör çizmemek için).
// Bir sprite yoksa o nesne kodla çizilir (yedek), böylece görseller parça parça eklenebilir.
const SPR = {};
const spr = (name) => SPR[name] || null;
fetch('img/manifest.json')
  .then(r => (r.ok ? r.json() : []))
  .then(list => list.forEach(file => {
    const name = file.replace(/\.(png|svg|jpg)$/, '');
    const im = new Image();
    im.onload = () => {
      let out = im;
      if (file.endsWith('.svg')) {
        out = document.createElement('canvas');
        out.width = im.naturalWidth * 2; out.height = im.naturalHeight * 2;
        out.getContext('2d').drawImage(im, 0, 0, out.width, out.height);
      }
      SPR[name] = out;
      if (G && /^(grass_|road|tree_|rock_)/.test(name)) G.bg = renderBackground(G.lv, G.paths);
    };
    im.src = 'img/' + file;
  }))
  .catch(() => {});
// Boyama sprite'larının kaynak ölçüleri (aynı sayfadaki kulelerin göreli boyu korunur)
const SPR_META = {};
fetch('img/meta.json').then(r => (r.ok ? r.json() : {})).then(m => Object.assign(SPR_META, m)).catch(() => {});
// Oyun içi boyutlar (mantıksal px). Karakterler yüksekliğe göre, kule ve dekor kaynak ölçeğe göre.
const CHAR_H = {
  enemy_goblin: 20, enemy_wolf: 19, enemy_bandit: 23, enemy_orc: 27, enemy_bat: 22,
  enemy_shaman: 24, enemy_knight: 27, enemy_troll: 46, hero: 30, soldier: 22, militia: 22,
};
const TOWER_K = 0.12, TREE_K = 0.105, ROCK_K = 0.075;
const TOWER_TOP = { archer: 0.86, barracks: 0.7, mage: 0.92, artillery: 0.74 }; // mermi çıkış yüksekliği
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

// İsabet anında sprite'ın üzerine çizilen beyaz siluet (önbellekli)
const WHITE = {};
function whiteOf(name, im) {
  if (!WHITE[name]) {
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    WHITE[name] = c;
  }
  return WHITE[name];
}

// alt-orta noktaya hizalı çizim (anchorY=0.5 ise merkez)
function drawSprite(c, im, x, y, w, anchorY = 1) {
  const h = w * im.height / im.width;
  c.drawImage(im, x - w / 2, y - h * anchorY, w, h);
}

// ---------- kayıt ----------
const SAVE_KEY = 'sinirKalesi.v1';
let save = { stars: [] };
try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || save; } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------- canvas & ölçek ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const scale = Math.min(cw / W, ch / H);
  view = { scale, ox: (cw - W * scale) / 2, oy: (ch - H * scale) / 2, dpr, cw, ch };
}
window.addEventListener('resize', resize);
resize();

// ---------- ses ----------
// ses/manifest.json içindeki WAV'lar (Kenney, CC0). Dosya adı "tür_n": aynı türün varyantları
// rastgele seçilir, hız hafifçe oynatılır ki tekrar eden sesler mekanik duyulmasın.
// vol: ses düzeyi, gap: aynı türün iki çalışı arasındaki en kısa süre, max: aynı anda en çok kaç tane.
const SOUND = {
  arrow:   { vol: 0.30, gap: 0.07, max: 3, rate: [1.0, 1.3] },
  magic:   { vol: 0.30, gap: 0.12, max: 2, rate: [0.85, 1.1] },
  cannon:  { vol: 0.45, gap: 0.10, max: 2, rate: [0.85, 1.0] },
  boom:    { vol: 0.50, gap: 0.08, max: 3, rate: [0.9, 1.1] },
  meteor:  { vol: 0.70, gap: 0.15, max: 2, rate: [0.85, 1.0] },
  clash:   { vol: 0.22, gap: 0.10, max: 3, rate: [0.9, 1.15] },
  death:   { vol: 0.30, gap: 0.07, max: 3, rate: [0.9, 1.25] },
  coin:    { vol: 0.22, gap: 0.09, max: 2, rate: [0.95, 1.15] },
  coins:   { vol: 0.45, gap: 0.25, max: 1 },
  build:   { vol: 0.60, gap: 0.10, max: 1 },
  upgrade: { vol: 0.55, gap: 0.10, max: 1 },
  leak:    { vol: 0.50, gap: 0.40, max: 1 },
  wave:    { vol: 0.55, gap: 0.50, max: 1 },
  win:     { vol: 0.80, gap: 1, max: 1 },
  lose:    { vol: 0.80, gap: 1, max: 1 },
  levelup: { vol: 0.55, gap: 0.5, max: 1 },
  click:   { vol: 0.40, gap: 0.04, max: 2 },
  select:  { vol: 0.32, gap: 0.05, max: 1, rate: [0.95, 1.05] },
  pick:    { vol: 0.28, gap: 0.05, max: 1, rate: [0.95, 1.05] },
  castlehit: { vol: 0.65, gap: 0.12, max: 2, rate: [0.85, 1.0] },
  bash:    { vol: 0.5, gap: 0.2, max: 1 },
  cry:     { vol: 0.6, gap: 0.5, max: 1 },
  whirl:   { vol: 0.55, gap: 0.2, max: 1, rate: [0.8, 0.9] },
  zap:     { vol: 0.45, gap: 0.2, max: 1, rate: [1.1, 1.25] },
  error:   { vol: 0.35, gap: 0.15, max: 1 },
  spell:   { vol: 0.45, gap: 0.2, max: 1 },
  reinforce: { vol: 0.55, gap: 0.2, max: 1 },
};
let actx = null, master = null;
let muted = false;
try { muted = localStorage.getItem('sinirKalesi.muted') === '1'; } catch (e) {}
const rawSnd = {};   // ad -> ArrayBuffer (ses bağlamı açılmadan önce indirilir)
const SND = {};      // tür -> [AudioBuffer]
const sndState = {}; // tür -> { last, playing }

fetch('ses/manifest.json')
  .then(r => (r.ok ? r.json() : []))
  .then(list => Promise.all(list.map(name =>
    fetch('ses/' + name + '.wav').then(r => r.arrayBuffer()).then(buf => { rawSnd[name] = buf; if (actx) decodeOne(name); }))))
  .catch(() => {});

function decodeOne(name) {
  const buf = rawSnd[name];
  if (!buf) return;
  delete rawSnd[name];
  const kind = name.replace(/_\d+$/, '');
  const done = (ab) => { (SND[kind] = SND[kind] || []).push(ab); };
  try {
    const p = actx.decodeAudioData(buf, done, () => {});
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

// tarayıcılar sesi ancak ilk dokunuştan sonra açar
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = actx.createGain();
  master.gain.value = 0.9;
  master.connect(comp); comp.connect(actx.destination);
  Object.keys(rawSnd).forEach(decodeOne);
}

function sfx(kind) {
  if (muted || !actx) return;
  const def = SOUND[kind], list = SND[kind];
  if (!def || !list || !list.length) return;
  const st = sndState[kind] || (sndState[kind] = { last: -1, playing: 0 });
  const now = actx.currentTime;
  if (now - st.last < def.gap || st.playing >= def.max) return;
  st.last = now; st.playing++;
  const src = actx.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  if (def.rate) src.playbackRate.value = rand(def.rate[0], def.rate[1]);
  const g = actx.createGain();
  g.gain.value = def.vol;
  src.connect(g); g.connect(master);
  src.onended = () => { st.playing--; };
  src.start();
}

function setMuted(m) {
  muted = m;
  try { localStorage.setItem('sinirKalesi.muted', m ? '1' : '0'); } catch (e) {}
}

// ---------- yol geometrisi ----------
function buildPath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return { pts, cum, total: cum[cum.length - 1] };
}
function pathPos(p, d, off = 0) {
  d = clamp(d, 0, p.total);
  let i = 1;
  while (i < p.pts.length - 1 && p.cum[i] < d) i++;
  const a = p.pts[i - 1], b = p.pts[i];
  const segLen = p.cum[i] - p.cum[i - 1] || 1;
  const t = (d - p.cum[i - 1]) / segLen;
  const dx = (b[0] - a[0]) / segLen, dy = (b[1] - a[1]) / segLen;
  return { x: lerp(a[0], b[0], t) - dy * off, y: lerp(a[1], b[1], t) + dx * off, dx, dy };
}
function nearestOnPaths(paths, x, y) {
  let best = { d: 1e9, x, y };
  for (const p of paths) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      const px = a[0] + dx * t, py = a[1] + dy * t;
      const d = dist(x, y, px, py);
      if (d < best.d) best = { d, x: px, y: py };
    }
  }
  return best;
}

// ---------- arka plan (önceden çizilir) ----------
const THEMES = {
  meadow: { grass: '#8cc25a', grass2: '#6a9e46', patch: ['#8cc15a', '#5a8a3a'], trees: 17, rocks: 6, treeCol: ['#2f6b2a', '#3f8a35', '#56a446'], road: ['#7a5a32', '#cfa96b'] },
  forest: { grass: '#5f9a48', grass2: '#447a34', patch: ['#5f9a48', '#355f28'], trees: 42, rocks: 5, treeCol: ['#1f4f22', '#2d6a2c', '#3f8238'], road: ['#664a2a', '#b8925a'] },
  rocky:  { grass: '#a3ad6e', grass2: '#7f8c52', patch: ['#a0a878', '#5f6a40'], trees: 12, rocks: 22, treeCol: ['#3a5a2a', '#4d7236', '#628a44'], road: ['#6a6058', '#b0a690'] },
};

function renderBackground(lv, paths) {
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const th = THEMES[lv.theme];
  const rnd = seeded(lv.name.length * 977 + lv.plots.length * 31);

  const grd = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
  grd.addColorStop(0, th.grass); grd.addColorStop(1, th.grass2);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const grassTex = spr('grass_' + lv.theme);
  if (grassTex) {
    const pat = g.createPattern(grassTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(0.5));
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.42; g.fillStyle = grd; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
  for (let i = 0; i < (grassTex ? 0 : 260); i++) {
    g.globalAlpha = 0.12 + rnd() * 0.12;
    g.fillStyle = th.patch[i % 2];
    g.beginPath();
    g.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 40, 6 + rnd() * 20, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // çimen tutamları
  g.strokeStyle = 'rgba(30,60,20,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < (grassTex ? 0 : 400); i++) {
    const x = rnd() * W, y = rnd() * H;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 4); g.moveTo(x, y); g.lineTo(x + 2, y - 4); g.stroke();
  }

  // yol
  g.lineJoin = 'round'; g.lineCap = 'round';
  const strokePath = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w;
    for (const p of paths) { g.beginPath(); p.pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); }
  };
  strokePath(54, 'rgba(0,0,0,0.18)');
  strokePath(48, th.road[0]);
  const roadTex = spr('road');
  if (roadTex) {
    const pat = g.createPattern(roadTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(0.5));
    strokePath(40, pat);
  } else strokePath(40, th.road[1]);
  // yol taşları
  for (const p of paths) {
    for (let d = 0; d < (roadTex ? 0 : p.total); d += 9) {
      const q = pathPos(p, d, (rnd() - 0.5) * 34);
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,60,30,0.25)' : 'rgba(255,240,200,0.25)';
      g.beginPath(); g.arc(q.x, q.y, 1 + rnd() * 2, 0, Math.PI * 2); g.fill();
    }
  }

  const blocked = (x, y, pad) => {
    if (nearestOnPaths(paths, x, y).d < 36 + pad) return true;
    for (const pl of lv.plots) if (dist(x, y, pl[0], pl[1]) < 38 + pad) return true;
    if (y < 52 && (x < 300 || x > 860)) return true;
    if (y > 465 && x < 230) return true;
    if (Math.abs(x - lv.castle[0]) < 75 + pad && y > lv.castle[1] - 130 && y < lv.castle[1] + 30 + pad) return true;
    return false;
  };
  // kayalar
  for (let i = 0, n = 0; i < 400 && n < th.rocks; i++) {
    const x = rnd() * W, y = rnd() * H, s = 4 + rnd() * 9;
    if (blocked(x, y, s)) continue;
    n++;
    const rockName = 'rock_' + (1 + (n % 2)), rockIm = spr(rockName);
    if (rockIm) {
      const m = SPR_META[rockName], w = m ? m[0] * ROCK_K * (s / 8) : s * 3;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x + 3, y + s * 0.4, w * 0.42, w * 0.12, 0, 0, Math.PI * 2); g.fill();
      drawSprite(g, rockIm, x, y + s * 0.5, w);
      continue;
    }
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x + 2, y + 3, s, s * 0.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8d8a80'; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b3b0a5'; g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.35, 0, 0, Math.PI * 2); g.fill();
  }
  // ağaçlar
  const trees = [];
  for (let i = 0; i < 2000 && trees.length < th.trees; i++) {
    const x = rnd() * W, y = rnd() * H, s = 10 + rnd() * 9;
    if (blocked(x, y, s)) continue;
    trees.push([x, y, s]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of trees) {
    const treeName = 'tree_' + (1 + Math.floor((x * 7 + y * 13) % 3)), treeIm = spr(treeName);
    if (treeIm) {
      const m = SPR_META[treeName], w = m ? m[0] * TREE_K * (0.75 + (s - 10) / 9 * 0.4) : s * 3.4;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 5, y + 3, w * 0.36, w * 0.11, 0, 0, Math.PI * 2); g.fill();
      drawSprite(g, treeIm, x, y + 5, w);
      continue;
    }
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 3, y + 4, s * 0.9, s * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b3b1f'; g.fillRect(x - 2, y - 4, 4, 8);
    g.fillStyle = th.treeCol[0]; g.beginPath(); g.arc(x, y - s * 0.7, s, 0, Math.PI * 2); g.fill();
    g.fillStyle = th.treeCol[1]; g.beginPath(); g.arc(x - s * 0.2, y - s * 0.9, s * 0.75, 0, Math.PI * 2); g.fill();
    g.fillStyle = th.treeCol[2]; g.beginPath(); g.arc(x - s * 0.35, y - s * 1.1, s * 0.4, 0, Math.PI * 2); g.fill();
  }
  // çiçekler
  for (let i = 0; i < 80; i++) {
    const x = rnd() * W, y = rnd() * H;
    if (blocked(x, y, 0)) continue;
    g.fillStyle = ['#f4e36b', '#ffffff', '#e86c8f'][i % 3];
    g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
  }
  return c;
}

// ---------- oyun durumu ----------
let screen = 'title'; // title | map | play
let G = null;          // aktif bölüm durumu
let speed = 1, paused = false, overlay = null; // overlay: null | 'pause' | 'win' | 'lose'
let time = 0;

function startLevel(idx) {
  const lv = LEVELS[idx];
  const paths = lv.paths.map(buildPath);
  G = {
    idx, lv, paths,
    bg: renderBackground(lv, paths),
    gold: lv.gold, lives: lv.lives, maxLives: lv.lives,
    wave: 0, waveCountdown: null, waveCountdownMax: 1, spawners: [],
    enemies: [], towers: [], soldiers: [], projectiles: [], effects: [], floaters: [],
    plots: lv.plots.map(([x, y]) => ({ x, y, tower: null })),
    hero: null,
    spells: { meteor: 0, reinforce: 0 },
    sel: null, preview: null, mode: null,
    stars: 0, t: 0,
    castle: { x: lv.castle[0], y: lv.castle[1], shake: 0, flash: 0, smokeT: 0 },
    hurt: 0, banner: null,
  };
  const start = nearestOnPaths(paths, W * 0.45, H * 0.5);
  G.hero = makeHero(start.x, start.y);
  G.soldiers.push(G.hero);
  screen = 'play'; overlay = null; paused = false; speed = 1;
}

function makeHero(x, y) {
  return {
    hero: true, x, y, rx: x, ry: y, hp: HERO.hp, maxHp: HERO.hp, dmg: HERO.dmg.slice(), armor: HERO.armor,
    rate: HERO.rate, speed: HERO.speed, engage: HERO.engage, atk: 0, target: null, dead: false, respawnT: 0,
    lvl: 1, xp: 0, face: 1, anim: 0,
  };
}

// ---------- dalgalar ----------
function waveBonusAndStart() {
  if (!G || G.wave >= G.lv.waves.length) return;
  if (G.waveCountdown != null && G.waveCountdown > 0 && G.wave > 0) {
    const bonus = Math.ceil(G.waveCountdown * 1.2);
    if (bonus > 0) { G.gold += bonus; floatText(W / 2, 80, `Erken çağrı +${bonus}`, '#ffd34d'); sfx('coins'); }
  }
  const def = G.lv.waves[G.wave];
  let lastSpawn = 0;
  for (const grp of def) {
    G.spawners.push({ t: grp.t, left: grp.n, gap: grp.gap, timer: grp.at || 0, p: grp.p || 0 });
    lastSpawn = Math.max(lastSpawn, (grp.at || 0) + grp.gap * (grp.n - 1));
  }
  G.wave++;
  sfx('wave');
  if (G.wave < G.lv.waves.length) {
    G.waveCountdown = lastSpawn + 18;
    G.waveCountdownMax = G.waveCountdown;
  } else {
    G.waveCountdown = null;
  }
}

function nextWavePaths() {
  if (G.wave >= G.lv.waves.length) return [];
  const s = new Set(G.lv.waves[G.wave].map(g => g.p || 0));
  return [...s];
}

function waveButtonPos(pi) {
  const p = G.paths[pi];
  let d = 0, q = pathPos(p, 0);
  while (d < p.total && (q.x < 34 || q.x > W - 34 || q.y < 72 || q.y > H - 34)) { d += 4; q = pathPos(p, d); }
  return { x: q.x, y: q.y };
}

function spawnEnemy(type, pi) {
  const def = ENEMIES[type];
  const p = G.paths[pi];
  const off = def.boss ? 0 : rand(-11, 11);
  const q = pathPos(p, 0, off);
  G.enemies.push({
    type, def, p, d: 0, off, x: q.x, y: q.y, hp: def.hp, maxHp: def.hp,
    blocker: null, atk: 0, dead: false, anim: rand(0, 10), face: 1, healT: 3,
  });
}

// ---------- hasar ----------
function damageEnemy(e, amount, type) {
  if (e.dead) return;
  const red = type === 'magic' ? e.def.mr : type === 'phys' ? e.def.armor : 0;
  e.hp -= amount * (1 - red);
  e.flash = 0.1;
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true;
  G.gold += e.def.gold;
  floatText(e.x, e.y - 18, `+${e.def.gold}`, '#ffd34d');
  sfx('coin'); sfx('death');
  G.effects.push({ kind: 'corpse', name: 'enemy_' + e.type, x: e.x, y: e.y, face: e.face, fly: e.def.flying ? 26 : 0, t: 0, dur: 0.9 });
  for (let i = 0; i < 3; i++) G.effects.push({ kind: 'puff', x: e.x + rand(-6, 6), y: e.y + rand(-8, 0), t: 0, dur: 0.5, r: rand(2, 4) });
  if (G.hero && !G.hero.dead) gainXp(G.hero, e.def.gold);
}
function gainXp(h, amount) {
  if (h.lvl >= HERO.maxLevel) return;
  h.xp += amount;
  const need = 55 * h.lvl;
  if (h.xp >= need) {
    h.xp -= need; h.lvl++;
    const k = 1 + 0.12 * (h.lvl - 1);
    h.maxHp = Math.round(HERO.hp * k); h.hp = h.maxHp;
    h.dmg = [Math.round(HERO.dmg[0] * k), Math.round(HERO.dmg[1] * k)];
    floatText(h.x, h.y - 30, `Seviye ${h.lvl}!`, '#9ff');
    sfx('levelup');
    const sk = HERO.skills.find(k => k.lvl === h.lvl);
    if (sk) G.banner = { title: `Yeni yetenek: ${sk.name}`, sub: sk.desc, t: 0, dur: 3.5 };
  }
}
function damageSoldier(s, amount) {
  if (s.dead) return;
  s.hp -= amount * (1 - s.armor);
  s.flash = 0.1;
  if (s.hp <= 0) {
    s.dead = true; s.hp = 0;
    G.effects.push({ kind: 'corpse', name: s.hero ? 'hero' : s.militia ? 'militia' : 'soldier', x: s.x, y: s.y, face: s.face, fly: 0, t: 0, dur: 0.9 });
    s.respawnT = s.hero ? HERO.respawn : s.tower ? TOWERS.barracks.levels[s.tower.lvl].respawn : 0;
    releaseSoldier(s);
  }
}
function releaseSoldier(s) {
  for (const e of G.enemies) if (e.blocker === s) e.blocker = null;
  s.target = null;
}

function floatText(x, y, text, col) { G.floaters.push({ x, y, text, col, t: 0 }); }

// ---------- kuleler ----------
function buildTower(plot, type) {
  const cost = TOWERS[type].levels[0].cost;
  if (G.gold < cost) return false;
  G.gold -= cost;
  const t = { type, def: TOWERS[type], lvl: 0, x: plot.x, y: plot.y, cd: 0.3, spent: cost, plot, soldiers: [], anim: 0, shotAnim: 0, born: G.t };
  plot.tower = t;
  G.towers.push(t);
  if (type === 'barracks') {
    const n = nearestOnPaths(G.paths, t.x, t.y);
    t.rx = n.x; t.ry = n.y;
    for (let i = 0; i < 3; i++) {
      const s = makeSoldier(t, i);
      t.soldiers.push(s); G.soldiers.push(s);
    }
  }
  G.effects.push({ kind: 'dust', x: t.x, y: t.y, t: 0, dur: 0.5 });
  sfx('build');
  return true;
}
const SLOTS = [[-13, -7], [13, -7], [0, 10]];
function makeSoldier(t, i) {
  const L = TOWERS.barracks.levels[t.lvl];
  return { tower: t, slot: i, x: t.x, y: t.y + 6, hp: L.hp, maxHp: L.hp, dmg: L.dmg, armor: L.armor, rate: 1, speed: 60, engage: 55,
    atk: 0, target: null, dead: false, respawnT: 0, face: 1, anim: rand(0, 5) };
}
function upgradeTower(t) {
  if (t.lvl >= t.def.levels.length - 1) return false;
  const cost = t.def.levels[t.lvl + 1].cost;
  if (G.gold < cost) return false;
  G.gold -= cost; t.spent += cost; t.lvl++; t.born = G.t;
  if (t.type === 'barracks') {
    const L = t.def.levels[t.lvl];
    for (const s of t.soldiers) { s.maxHp = L.hp; s.hp = s.dead ? 0 : L.hp; s.dmg = L.dmg; s.armor = L.armor; }
  }
  G.effects.push({ kind: 'dust', x: t.x, y: t.y, t: 0, dur: 0.5 });
  sfx('upgrade');
  return true;
}
function sellTower(t) {
  const refund = Math.floor(t.spent * SELL_RATIO);
  G.gold += refund;
  floatText(t.x, t.y - 30, `+${refund}`, '#ffd34d');
  for (const s of t.soldiers) { releaseSoldier(s); s.removed = true; }
  G.soldiers = G.soldiers.filter(s => !s.removed);
  G.towers = G.towers.filter(x => x !== t);
  t.plot.tower = null;
  sfx('coins');
}

function findTarget(t, range, allowAir) {
  let best = null, bestRemain = 1e9;
  for (const e of G.enemies) {
    if (e.dead || (e.def.flying && !allowAir)) continue;
    if (dist(t.x, t.y - 10, e.x, e.y) > range) continue;
    const remain = e.p.total - e.d;
    if (remain < bestRemain) { bestRemain = remain; best = e; }
  }
  return best;
}

// Okçu kule sprite'larında okçuların yeri (sprite genişliği/yüksekliği oranında)
const ARCHER_POS = [
  [[0.38, 0.09], [0.61, 0.10]],
  [[0.38, 0.23], [0.61, 0.24]],
  [[0.30, 0.10], [0.47, 0.13], [0.68, 0.11]],
];
function archerPoint(t, ts, i) {
  const [rx, ry] = ARCHER_POS[t.lvl][i];
  return { x: t.x - ts.w / 2 + rx * ts.w, y: ts.bottom - ts.h + ry * ts.h };
}

function updateArchers(t, dt, L) {
  const ts = towerSprite(t);
  const n = ts ? ARCHER_POS[t.lvl].length : 1;
  if (!t.shots || t.shots.length !== n) {
    t.shots = Array.from({ length: n }, (_, i) => ({ cd: 0.2 + i * L.rate * 0.5, fx: 0 }));
  }
  t.shots.forEach((a, i) => {
    a.fx = Math.max(0, a.fx - dt);
    a.cd -= dt;
    if (a.cd > 0) return;
    const e = findTarget(t, L.range, true);
    if (!e) { a.cd = 0; return; }
    a.cd = L.rate * n; // her okçu kendi sırasıyla; kulenin toplam atış hızı aynı kalır
    a.fx = 0.18;
    const o = ts ? archerPoint(t, ts, i) : { x: t.x, y: t.y - 34 };
    const d = dist(o.x, o.y, e.x, e.y);
    G.projectiles.push({ kind: 'arrow', sx: o.x, sy: o.y, target: e, tx: e.x, ty: e.y, t: 0, dur: clamp(d / 420, 0.15, 0.6), dmg: roll(L.dmg), dtype: 'phys', arc: 18 });
    sfx('arrow');
  });
}

function updateTower(t, dt) {
  t.anim += dt; t.shotAnim = Math.max(0, t.shotAnim - dt);
  if (t.type === 'barracks') return;
  const L = t.def.levels[t.lvl];
  if (t.type === 'archer') { updateArchers(t, dt, L); return; }
  t.cd -= dt;
  if (t.cd > 0) return;
  const e = findTarget(t, L.range, t.def.air);
  if (!e) return;
  t.cd = L.rate;
  t.shotAnim = 0.2;
  const ts = towerSprite(t);
  const sx = t.x, sy = ts ? ts.bottom - ts.h * TOWER_TOP[t.type] : t.y - 34;
  if (t.type === 'archer') {
    const d = dist(sx, sy, e.x, e.y);
    G.projectiles.push({ kind: 'arrow', sx, sy, target: e, tx: e.x, ty: e.y, t: 0, dur: clamp(d / 420, 0.15, 0.6), dmg: roll(L.dmg), dtype: 'phys', arc: 18 });
    sfx('arrow');
  } else if (t.type === 'mage') {
    const d = dist(sx, sy, e.x, e.y);
    G.projectiles.push({ kind: 'bolt', sx, sy: sy - 8, target: e, tx: e.x, ty: e.y, t: 0, dur: clamp(d / 380, 0.15, 0.6), dmg: roll(L.dmg), dtype: 'magic', arc: 0 });
    sfx('magic');
  } else if (t.type === 'artillery') {
    const dur = 0.9;
    let tx = e.x, ty = e.y;
    if (!e.blocker) { const f = pathPos(e.p, e.d + e.def.speed * dur, e.off); tx = f.x; ty = f.y; }
    G.projectiles.push({ kind: 'shell', sx, sy: sy + 6, target: null, tx, ty, t: 0, dur, dmg: roll(L.dmg), dtype: 'phys', arc: 70, splash: L.splash });
    sfx('cannon');
  }
}

// ---------- düşman & asker güncelleme ----------
// Kapıya varan düşman bir kez vurur (kale hasar alır) ve kapıdan içeri dalıp kaybolur.
// Vuruştan önceki kısa hazırlık anında kuleler onu hâlâ öldürebilir.
const SIEGE_HIT = 0.45, SIEGE_END = 0.85;
function updateSiege(e, dt) {
  e.siege += dt;
  if (!e.struck && e.siege >= SIEGE_HIT) {
    e.struck = true;
    castleHit(e);
  }
  if (e.siege >= SIEGE_END) {
    e.dead = true; e.leaked = true;
    for (let i = 0; i < 4; i++) G.effects.push({ kind: 'puff', x: e.x + rand(-6, 6), y: e.y + rand(-10, 0), t: 0, dur: 0.5, r: rand(3, 5) });
  }
}

function castleHit(e) {
  const c = G.castle, before = G.lives / G.maxLives;
  const dmg = e.def.lives;
  G.lives = Math.max(0, G.lives - dmg);
  c.shake = 0.4; c.flash = 0.25; G.hurt = 0.6;
  const hx = e.x + e.face * 10, hy = e.y - 14;
  slashFx(hx, hy, e.face, '#ffb070', 1.4);
  for (let i = 0; i < 9; i++) {
    G.effects.push({ kind: 'debris', x: hx + rand(-6, 6), y: hy + rand(-6, 6), vx: rand(-60, 60), vy: rand(-140, -60),
      rot: rand(0, 6), vr: rand(-10, 10), s: rand(2, 4.5), col: Math.random() < 0.5 ? '#8a8276' : '#6d665b', t: 0, dur: 0.9 });
  }
  for (let i = 0; i < 4; i++) G.effects.push({ kind: 'smoke', x: hx + rand(-10, 10), y: hy + rand(-8, 4), r: rand(5, 9), t: 0, dur: 1.1 });
  floatText(c.x, c.y - 120, `-${dmg}`, '#ff5a4a');
  sfx('castlehit');
  const after = G.lives / G.maxLives;
  if ((before > 0.6 && after <= 0.6) || (before > 0.3 && after <= 0.3)) sfx('leak'); // hasar evresi değişti: çan
}

// kılıç savuruşu izi
function slashFx(x, y, face, col = '#ffffff', size = 1) {
  G.effects.push({ kind: 'slash', x, y, face, col, size, t: 0, dur: 0.2 });
  for (let i = 0; i < 3; i++) {
    G.effects.push({ kind: 'spark', x: x + rand(-3, 3), y: y + rand(-3, 3), t: 0, dur: 0.22, small: true });
  }
}

function unitH(u) {
  return u.hero ? CHAR_H.hero : u.militia ? CHAR_H.militia : CHAR_H.soldier;
}

function updateEnemy(e, dt) {
  e.anim += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.def.heals) {
    e.healT -= dt;
    if (e.healT <= 0) {
      e.healT = 6;
      for (const o of G.enemies) {
        if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < 70 && o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + 25);
          G.effects.push({ kind: 'heal', x: o.x, y: o.y, t: 0, dur: 0.6 });
        }
      }
    }
  }
  if (e.stun > 0) { e.stun -= dt; return; } // sersemlemiş: yürümez, vurmaz
  if (e.siege !== undefined) { updateSiege(e, dt); return; }
  const b = e.blocker;
  if (b && (b.dead || b.removed)) e.blocker = null;
  if (e.blocker) {
    const bd = dist(e.x, e.y, e.blocker.x, e.blocker.y);
    e.inMelee = bd < 26;
    if (e.inMelee) {
      e.face = e.blocker.x < e.x ? -1 : 1;
      e.atk -= dt;
      if (e.atk <= 0) {
        e.atk = e.def.rate;
        const victim = e.blocker;
        slashFx(victim.x, victim.y - unitH(victim) * 0.55, e.face, '#ffd9b0');
        damageSoldier(victim, roll(e.def.dmg));
        sfx('clash');
      }
    }
    return; // bloklanmış: durur
  }
  e.inMelee = false;
  e.d += e.def.speed * dt;
  if (e.d >= e.p.total) {
    e.d = e.p.total;
    e.siege = 0; // kalenin kapısına vardı: saldırıya hazırlanır
    e.face = G.castle.x < e.x ? -1 : 1;
    return;
  }
  const q = pathPos(e.p, e.d, e.off);
  if (Math.abs(q.x - e.x) > 0.01) e.face = q.x < e.x ? -1 : 1;
  e.x = q.x; e.y = q.y;
}

function soldierHome(s) {
  if (s.hero || s.militia) return { x: s.rx, y: s.ry };
  const t = s.tower, o = SLOTS[s.slot];
  return { x: t.rx + o[0], y: t.ry + o[1] };
}

function moveToward(s, x, y, dt) {
  const d = dist(s.x, s.y, x, y);
  if (d < 1) return true;
  const step = Math.min(d, s.speed * dt);
  s.face = x < s.x ? -1 : 1;
  s.x += (x - s.x) / d * step; s.y += (y - s.y) / d * step;
  s.anim += dt;
  return d - step < 1;
}

function updateSoldier(s, dt) {
  if (s.flash > 0) s.flash -= dt;
  if (s.buffT > 0) s.buffT -= dt;
  if (s.spinT > 0) s.spinT -= dt;
  if (s.militia) {
    s.life -= dt;
    if (s.life <= 0 && !s.dead) { s.dead = true; releaseSoldier(s); }
  }
  if (s.dead) {
    if (s.militia) { s.removed = true; return; }
    s.respawnT -= dt;
    if (s.respawnT <= 0) {
      s.dead = false; s.hp = s.maxHp;
      if (s.hero) { /* olduğu yerde dirilir */ } else { s.x = s.tower.x; s.y = s.tower.y + 6; }
    }
    return;
  }
  const home = soldierHome(s);
  const e = s.target;
  if (e && (e.dead || dist(e.x, e.y, home.x, home.y) > s.engage + 40 || s.moving)) {
    if (e.blocker === s) e.blocker = null;
    s.target = null;
  }
  if (!s.target && !s.moving) {
    let best = null, bestScore = 1e9;
    for (const o of G.enemies) {
      if (o.dead || o.def.flying) continue;
      const d = dist(o.x, o.y, home.x, home.y);
      if (d > s.engage) continue;
      const score = (o.blocker ? 1000 : 0) + (o.p.total - o.d);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (best) {
      s.target = best;
      if (!best.blocker) best.blocker = s;
    }
  }
  if (s.target) {
    const t = s.target;
    if (!t.blocker || t.blocker.dead) t.blocker = s;
    const side = s.x < t.x ? -1 : 1;
    const spot = t.blocker === s ? { x: t.x + side * 15, y: t.y } : { x: t.x + side * 14, y: t.y + (s.slot === 2 ? 8 : -8) };
    const arrived = moveToward(s, spot.x, spot.y, dt);
    if (arrived || dist(s.x, s.y, t.x, t.y) < 22) {
      s.face = t.x < s.x ? -1 : 1;
      s.atk -= dt;
      s.anim += dt;
      if (s.atk <= 0) {
        s.atk = s.rate;
        damageEnemy(t, roll(s.dmg) * (s.buffT > 0 ? 1.5 : 1), 'phys');
        slashFx(t.x, t.y - (CHAR_H['enemy_' + t.type] || 20) * 0.55, s.face);
        sfx('clash');
      }
    }
  } else {
    const arrived = moveToward(s, home.x, home.y, dt);
    if (arrived) {
      s.moving = false;
      if (s.hero && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + HERO.regen * dt);
    }
  }
  if (s.hero) heroSkills(s, dt);
}

// ---------- kahraman yetenekleri (seviyeyle açılır, kendiliğinden kullanılır) ----------
function heroSkills(h, dt) {
  h.cds = h.cds || {};
  for (const k in h.cds) h.cds[k] -= dt;
  for (const sk of HERO.skills) {
    if (h.lvl < sk.lvl || (h.cds[sk.id] || 0) > 0) continue;
    if (useSkill(h, sk.id)) {
      h.cds[sk.id] = sk.cd;
      floatText(h.x, h.y - 44, sk.name + '!', '#ffe27a');
    }
  }
}

function enemiesNear(x, y, r, air = false) {
  return G.enemies.filter(e => !e.dead && (air || !e.def.flying) && dist(e.x, e.y, x, y) <= r);
}

function useSkill(h, id) {
  if (id === 'bash') {
    const t = h.target;
    if (!t || t.dead || dist(h.x, h.y, t.x, t.y) > 26) return false;
    t.stun = 2;
    damageEnemy(t, 20 + 6 * h.lvl, 'phys');
    slashFx(t.x, t.y - 12, h.face, '#ffe27a', 1.6);
    G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 22, col: '255,226,122', t: 0, dur: 0.35 });
    sfx('bash');
    return true;
  }
  if (id === 'cry') {
    if (enemiesNear(h.x, h.y, 100).length < 2 && !(h.hp < h.maxHp * 0.6 && h.target)) return false;
    for (const s of G.soldiers) {
      if (s.dead || dist(s.x, s.y, h.x, h.y) > 120) continue;
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.35);
      s.buffT = 6;
      G.effects.push({ kind: 'heal', x: s.x, y: s.y, t: 0, dur: 0.6 });
    }
    G.effects.push({ kind: 'ring', x: h.x, y: h.y, r: 120, col: '255,210,90', t: 0, dur: 0.6 });
    sfx('cry');
    return true;
  }
  if (id === 'whirl') {
    const near = enemiesNear(h.x, h.y, 58);
    if (near.length < 2) return false;
    for (const e of near) damageEnemy(e, 35 + 8 * h.lvl, 'phys');
    h.spinT = 0.5;
    G.effects.push({ kind: 'whirl', x: h.x, y: h.y - 10, t: 0, dur: 0.5 });
    sfx('whirl');
    return true;
  }
  if (id === 'bolt') {
    let cur = enemiesNear(h.x, h.y, 150, true).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
    if (!cur) return false;
    const pts = [[h.x, h.y - 30]], hitSet = new Set();
    for (let i = 0; i < 4 && cur; i++) {
      hitSet.add(cur);
      pts.push([cur.x, cur.y - (cur.def.flying ? 34 : 12)]);
      damageEnemy(cur, 55, 'magic');
      const from = cur;
      cur = G.enemies.filter(e => !e.dead && !hitSet.has(e) && dist(e.x, e.y, from.x, from.y) < 90)
        .sort((a, b) => dist(a.x, a.y, from.x, from.y) - dist(b.x, b.y, from.x, from.y))[0];
    }
    G.effects.push({ kind: 'bolt', pts, t: 0, dur: 0.35 });
    sfx('zap');
    return true;
  }
  return false;
}

// ---------- mermiler & efektler ----------
function updateProjectile(pr, dt) {
  pr.t += dt;
  if (pr.target && !pr.target.dead) { pr.tx = pr.target.x; pr.ty = pr.target.y; }
  if (pr.t < pr.dur) return;
  pr.done = true;
  if (pr.kind === 'shell' || pr.kind === 'meteor') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, pr.tx, pr.ty);
      if (d <= pr.splash) damageEnemy(e, pr.dmg * (1 - 0.5 * d / pr.splash), 'phys');
    }
    G.effects.push({ kind: 'boom', x: pr.tx, y: pr.ty, t: 0, dur: 0.45, r: pr.splash });
    sfx(pr.kind === 'meteor' ? 'meteor' : 'boom');
  } else if (pr.target && !pr.target.dead) {
    damageEnemy(pr.target, pr.dmg, pr.dtype);
    if (pr.kind === 'bolt') G.effects.push({ kind: 'spark', x: pr.tx, y: pr.ty, t: 0, dur: 0.3 });
  }
}

// ---------- büyüler ----------
function castSpell(id, x, y) {
  const S = SPELLS[id];
  if (id === 'meteor') {
    for (let i = 0; i < S.count; i++) {
      const tx = x + rand(-30, 30), ty = y + rand(-20, 20);
      G.projectiles.push({ kind: 'meteor', sx: tx - 120, sy: ty - 400, tx, ty, t: -i * 0.25, dur: 0.6, dmg: roll(S.dmg), splash: S.radius, arc: 0 });
    }
  } else if (id === 'reinforce') {
    for (let i = 0; i < S.count; i++) {
      const s = { militia: true, x: x + (i ? 12 : -12), y: y - 30, rx: x + (i ? 12 : -12), ry: y, hp: S.hp, maxHp: S.hp, dmg: S.dmg, armor: 0,
        rate: 1, speed: 60, engage: 60, atk: 0, target: null, dead: false, life: S.life, face: 1, anim: 0, slot: i };
      G.soldiers.push(s);
    }
    G.effects.push({ kind: 'dust', x, y, t: 0, dur: 0.5 });
    sfx('reinforce');
  }
  G.spells[id] = S.cd;
}

// ---------- ana güncelleme ----------
function update(dt) {
  G.t += dt;
  for (const k in G.spells) G.spells[k] = Math.max(0, G.spells[k] - dt);

  if (G.waveCountdown != null && G.wave > 0) {
    G.waveCountdown -= dt;
    if (G.waveCountdown <= 0) { G.waveCountdown = null; waveBonusAndStart(); }
  }
  for (const sp of G.spawners) {
    sp.timer -= dt;
    while (sp.left > 0 && sp.timer <= 0) {
      spawnEnemy(sp.t, sp.p);
      sp.left--; sp.timer += sp.gap;
    }
  }
  G.spawners = G.spawners.filter(s => s.left > 0);

  castleAmbient(dt);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  for (const t of G.towers) updateTower(t, dt);
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  for (const s of G.soldiers) updateSoldier(s, dt);
  for (const p of G.projectiles) updateProjectile(p, dt);

  G.enemies = G.enemies.filter(e => !e.dead);
  G.soldiers = G.soldiers.filter(s => !s.removed);
  G.projectiles = G.projectiles.filter(p => !p.done);
  for (const f of G.effects) f.t += dt;
  G.effects = G.effects.filter(f => f.t < f.dur);
  for (const f of G.floaters) { f.t += dt; f.y -= 22 * dt; }
  G.floaters = G.floaters.filter(f => f.t < 1.1);

  if (G.lives <= 0 && !overlay) { overlay = 'lose'; sfx('lose'); }
  if (!overlay && G.wave >= G.lv.waves.length && G.spawners.length === 0 && G.enemies.length === 0) {
    G.stars = G.lives >= 18 ? 3 : G.lives >= 6 ? 2 : 1;
    save.stars[G.idx] = Math.max(save.stars[G.idx] || 0, G.stars);
    persist();
    overlay = 'win';
    sfx('win');
  }
}

// ================= ÇİZİM =================
function txt(s, x, y, size, col = '#fff', align = 'center', weight = 'bold') {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function circle(x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function roundRect(x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function shadow(x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function hpBar(x, y, w, frac, col = '#4cd34c') {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#b22'; ctx.fillRect(x - w / 2, y, w, 3);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), 3);
}

function drawPlot(pl) {
  const im = spr('plot');
  if (im) { drawSprite(ctx, im, pl.x, pl.y + 2, 66, 0.5); return; }
  shadow(pl.x, pl.y + 4, 24, 11);
  ctx.fillStyle = '#7a5c3a'; ctx.beginPath(); ctx.ellipse(pl.x, pl.y, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9c7a52'; ctx.beginPath(); ctx.ellipse(pl.x, pl.y - 1, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    ctx.fillStyle = '#c9c2b0';
    ctx.beginPath(); ctx.ellipse(pl.x + Math.cos(a) * 23, pl.y + Math.sin(a) * 11, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// kule çizimi (ikon olarak da kullanılır: icon=true ise küçük)
function drawTowerShape(type, x, y, lvl, s = 1, t = null) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const k = 1 + lvl * 0.08;
  ctx.scale(k, k);
  // temel
  ctx.fillStyle = '#6e6a62'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d887d'; ctx.beginPath(); ctx.ellipse(0, -2, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
  const pulse = t ? Math.sin(t.anim * 4) : 0;
  if (type === 'archer') {
    const wood = lvl >= 2 ? '#7c4a22' : '#8b5a2b';
    ctx.fillStyle = lvl >= 1 ? '#8f8a80' : wood; ctx.fillRect(-14, -26, 28, 26);
    ctx.fillStyle = wood; ctx.fillRect(-14, -36, 28, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    for (let i = -10; i <= 10; i += 7) { ctx.beginPath(); ctx.moveTo(i, -36); ctx.lineTo(i, -24); ctx.stroke(); }
    ctx.fillStyle = '#5a3818'; ctx.fillRect(-17, -38, 34, 5);
    // okçular
    const bob = t && t.shotAnim > 0 ? -2 : 0;
    for (const ax of [-6, 6]) {
      circle(ax, -42 + bob, 4.5, '#2f7a2a');
      circle(ax, -41 + bob, 2.6, '#f0c9a0');
    }
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-4, -14, 8, 14);
    if (lvl >= 2) { ctx.fillStyle = '#c33'; ctx.beginPath(); ctx.moveTo(15, -38); ctx.lineTo(15, -54); ctx.lineTo(25, -50); ctx.lineTo(15, -46); ctx.fill(); }
  } else if (type === 'barracks') {
    ctx.fillStyle = '#b9b1a0'; ctx.fillRect(-18, -24, 36, 24);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    for (let r = -18; r < 0; r += 6) { ctx.beginPath(); ctx.moveTo(-18, r); ctx.lineTo(18, r); ctx.stroke(); }
    ctx.fillStyle = lvl >= 2 ? '#8a1f1f' : lvl >= 1 ? '#a83226' : '#b5452f';
    ctx.beginPath(); ctx.moveTo(-22, -22); ctx.lineTo(0, -42); ctx.lineTo(22, -22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2614'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-6, -11); ctx.arc(0, -11, 6, Math.PI, 0); ctx.lineTo(6, 0); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(0, -56); ctx.stroke();
    ctx.fillStyle = '#2a64c8'; ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(13 + pulse, -52); ctx.lineTo(0, -48); ctx.fill();
  } else if (type === 'mage') {
    const body = lvl >= 2 ? '#4b2f86' : lvl >= 1 ? '#5a3c96' : '#6b4fa0';
    ctx.fillStyle = body; ctx.fillRect(-12, -40, 24, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-12, -40, 7, 40);
    ctx.fillStyle = '#3a2466'; ctx.fillRect(-15, -44, 30, 6);
    ctx.fillStyle = '#e8d27a'; ctx.fillRect(-12, -22, 24, 3);
    const glow = 8 + pulse * 1.5 + (t && t.shotAnim > 0 ? 3 : 0);
    const g = ctx.createRadialGradient(0, -54, 1, 0, -54, glow * 1.8);
    g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#c79bff'); g.addColorStop(1, 'rgba(160,100,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -54, glow * 1.8, 0, Math.PI * 2); ctx.fill();
    circle(0, -54, 5, '#e3ccff');
    ctx.fillStyle = '#1e1235'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-5, -10); ctx.arc(0, -10, 5, Math.PI, 0); ctx.lineTo(5, 0); ctx.fill();
  } else if (type === 'artillery') {
    ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.roundRect(-18, -20, 36, 20, 4); ctx.fill();
    ctx.fillStyle = '#6d675c'; ctx.fillRect(-18, -22, 36, 5);
    const recoil = t && t.shotAnim > 0 ? 3 : 0;
    ctx.save(); ctx.translate(0, -24); ctx.rotate(-0.5);
    ctx.fillStyle = '#2d2d33'; ctx.beginPath(); ctx.roundRect(-6, -20 + recoil, 12, 22, 3); ctx.fill();
    ctx.fillStyle = '#45454d'; ctx.fillRect(-7, -22 + recoil, 14, 4);
    ctx.restore();
    circle(0, -24, 7, '#3a3a40');
    for (const [bx, by] of [[11, -4], [15, -6], [13, -9]]) circle(bx, by, 3, '#222');
    if (lvl >= 2) { ctx.fillStyle = '#c9a230'; ctx.fillRect(-18, -12, 36, 3); }
  }
  ctx.restore();
}

// Kulenin sprite'ı ve ekrandaki ölçüsü; taban elipsinin ortası arsanın merkezine oturur.
function towerSprite(t) {
  const name = `tower_${t.type}_${t.lvl + 1}`, im = spr(name);
  if (!im) return null;
  const m = SPR_META[name];
  const w = m ? m[0] * TOWER_K : 74, h = w * im.height / im.width;
  return { im, w, h, bottom: t.y + (m ? w * 0.24 : 10) };
}

function drawTower(t) {
  const ts = towerSprite(t);
  if (ts) {
    const age = G.t - (t.born ?? -9);
    const pop = age < 0.45 ? easeOutBack(clamp(age / 0.45, 0, 1)) : 1; // inşa/yükseltme zıplaması
    const kick = t.type === 'artillery' && t.shotAnim > 0 ? t.shotAnim / 0.2 : 0; // top geri tepmesi
    ctx.save(); ctx.translate(t.x, ts.bottom);
    ctx.scale(pop * (1 + kick * 0.05), pop * (1 - kick * 0.07));
    drawSprite(ctx, ts.im, 0, 0, ts.w);
    ctx.restore();
    if (t.type === 'archer' && t.shots) {
      t.shots.forEach((a, i) => {
        if (a.fx <= 0 || !ARCHER_POS[t.lvl][i]) return;
        const o = archerPoint(t, ts, i), k = a.fx / 0.18;
        // yay gerilip bırakılır: kısa bir yay çizgisi ve parıltı
        ctx.save(); ctx.globalAlpha = k;
        ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(o.x, o.y, 5 + (1 - k) * 4, -1.1, 1.1); ctx.stroke();
        circle(o.x + 2, o.y, 1.8 + k * 1.5, 'rgba(255,250,220,0.9)');
        ctx.restore();
      });
    }
    if (t.type === 'mage') {
      const gy = ts.bottom - ts.h * 0.9, r = 9 + Math.sin(t.anim * 3) * 2 + (t.shotAnim > 0 ? 8 : 0);
      const g = ctx.createRadialGradient(t.x, gy, 0, t.x, gy, r * 2);
      g.addColorStop(0, 'rgba(230,200,255,0.55)'); g.addColorStop(1, 'rgba(160,90,255,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, gy, r * 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    return;
  }
  shadow(t.x, t.y + 4, 26, 11);
  drawTowerShape(t.type, t.x, t.y, t.lvl, 1, t);
  // seviye pipleri
  for (let i = 0; i <= t.lvl; i++) {
    const px = t.x - t.lvl * 5 + i * 10;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath();
    ctx.moveTo(px, t.y + 8); ctx.lineTo(px + 3.5, t.y + 11.5); ctx.lineTo(px, t.y + 15); ctx.lineTo(px - 3.5, t.y + 11.5); ctx.fill();
  }
}

function drawEnemy(e) {
  const d = e.def;
  const fly = d.flying ? 26 + Math.sin(e.anim * 3) * 3 : 0;
  const bob = d.flying ? 0 : Math.abs(Math.sin(e.anim * 9)) * (e.blocker ? 0.5 : 2);
  const x = e.x, y = e.y - fly - bob;
  const name = 'enemy_' + e.type, im = spr(name);
  if (im) {
    drawUnit(name, im, e.x, e.y, e.face, {
      h: CHAR_H[name] || d.r * 2.6, phase: e.anim * (5 + d.speed / 9),
      walking: !e.blocker && e.siege === undefined && !(e.stun > 0), fly: d.flying ? fly : 0,
      atk: e.siege !== undefined ? e.siege - SIEGE_HIT : e.inMelee ? atkPhase(d.rate, e.atk) : null,
      flash: e.flash, wings: d.flying && e.siege === undefined ? e.anim : null, seed: e.off,
    });
    const top = e.y - fly - (CHAR_H[name] || 20) - 6;
    hpBar(e.x, top, d.boss ? 34 : 16, e.hp / e.maxHp);
    if (e.stun > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + i * 2.1;
        drawStar(e.x + Math.cos(a) * 9, top - 4 + Math.sin(a) * 3, 3, '#ffe27a');
      }
    }
    return;
  }
  shadow(e.x, e.y + 2, d.r * (d.flying ? 0.7 : 1), d.r * 0.4);
  ctx.save(); ctx.translate(x, y); ctx.scale(e.face, 1);
  const r = d.r;
  switch (e.type) {
    case 'goblin':
      ctx.fillStyle = '#5ea83a'; ctx.beginPath(); ctx.moveTo(-r + 1, -r); ctx.lineTo(-r - 6, -r - 5); ctx.lineTo(-r + 4, -r + 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r - 1, -r); ctx.lineTo(r + 6, -r - 5); ctx.lineTo(r - 4, -r + 3); ctx.fill();
      circle(0, -r + 2, r, '#6dbb45', '#2c5a1a', 1.5);
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(-r + 2, -2, 2 * r - 4, 5);
      circle(3, -r, 1.6, '#ff3'); circle(-1, -r, 1.6, '#ff3');
      break;
    case 'wolf':
      ctx.fillStyle = '#7d7f86'; ctx.beginPath(); ctx.ellipse(0, -6, r + 4, r - 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b5d63'; ctx.beginPath(); ctx.ellipse(-r - 3, -9, 5, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
      circle(r + 2, -10, 5, '#8d8f96');
      ctx.fillStyle = '#5b5d63'; ctx.beginPath(); ctx.moveTo(r, -14); ctx.lineTo(r + 2, -20); ctx.lineTo(r + 5, -14); ctx.fill();
      circle(r + 4, -11, 1.3, '#f33');
      break;
    case 'bandit':
      circle(0, -r + 1, r, '#8a6a48', '#3a2a18', 1.5);
      ctx.fillStyle = '#b8282c'; ctx.fillRect(-r + 1, -r - 6, 2 * r - 2, 4);
      circle(2, -r, 1.4, '#000'); circle(-2, -r, 1.4, '#000');
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r - 2, -4); ctx.lineTo(r + 7, -14); ctx.stroke();
      break;
    case 'orc':
      circle(0, -r + 1, r, '#3f7a35', '#1e3a18', 1.5);
      ctx.fillStyle = '#80848c'; ctx.fillRect(-r + 1, -4, 2 * r - 2, 6);
      ctx.fillStyle = '#eee'; ctx.fillRect(2, -r + 4, 2, 3); ctx.fillRect(-3, -r + 4, 2, 3);
      circle(3, -r - 1, 1.5, '#f22'); circle(-2, -r - 1, 1.5, '#f22');
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r - 1, -2); ctx.lineTo(r + 6, -16); ctx.stroke();
      break;
    case 'bat': {
      const w = Math.sin(e.anim * 18) * 6;
      ctx.fillStyle = '#2a2233';
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-16, -8 - w); ctx.lineTo(-10, -2); ctx.lineTo(-6, -4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(16, -8 - w); ctx.lineTo(10, -2); ctx.lineTo(6, -4); ctx.fill();
      circle(0, -4, 5, '#3a3044');
      circle(2, -5, 1.2, '#f44'); circle(-1, -5, 1.2, '#f44');
      break;
    }
    case 'shaman':
      ctx.fillStyle = '#6a3a8a'; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(0, -2 * r - 4); ctx.lineTo(r, 0); ctx.fill();
      circle(0, -r - 2, 5, '#6dbb45');
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r + 2, -22); ctx.stroke();
      circle(r + 2, -23, 3, '#7cff7c');
      break;
    case 'knight':
      circle(0, -r + 1, r, '#3b3f4a', '#111', 1.5);
      ctx.fillStyle = '#555a66'; ctx.fillRect(-r + 2, -r - 6, 2 * r - 4, 8);
      ctx.fillStyle = '#e33'; ctx.fillRect(-2, -r - 13, 4, 8);
      ctx.fillStyle = '#ff6'; ctx.fillRect(1, -r - 3, 6, 1.6);
      ctx.fillStyle = '#2a2d36'; ctx.fillRect(-r - 4, -12, 6, 12);
      break;
    case 'troll':
      circle(0, -r, r, '#6f8aa0', '#2a3a48', 2);
      circle(-6, -r - 10, 7, '#7f9ab0');
      ctx.fillStyle = '#f5f0d0'; ctx.fillRect(4, -r - 2, 3, 4); ctx.fillRect(-2, -r - 2, 3, 4);
      circle(6, -r - 6, 2, '#f80'); circle(-1, -r - 6, 2, '#f80');
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(r - 2, -6); ctx.lineTo(r + 10, -30); ctx.stroke();
      circle(r + 10, -31, 6, '#5a3a1a');
      break;
  }
  ctx.restore();
  const top = y - d.r * 2 - (d.flying ? 6 : 8);
  hpBar(e.x, top, d.boss ? 40 : 20, e.hp / e.maxHp);
}

function drawSoldier(s) {
  if (s.dead) {
    if (s.hero) {
      ctx.globalAlpha = 0.5; circle(s.x, s.y - 4, 7, '#888'); ctx.globalAlpha = 1;
      txt(Math.ceil(s.respawnT) + '', s.x, s.y - 20, 12, '#fff');
    }
    return;
  }
  const bob = Math.abs(Math.sin(s.anim * 9)) * 1.5;
  const fighting = s.target && dist(s.x, s.y, s.target.x, s.target.y) < 24;
  const r = s.hero ? 8 : 5.5;
  shadow(s.x, s.y + 2, r, r * 0.45);
  const name = s.hero ? 'hero' : s.militia ? 'militia' : 'soldier', im = spr(name);
  if (im) {
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    drawUnit(name, im, s.x, s.y, s.face, {
      h: CHAR_H[name], phase: s.anim * 9, walking, fly: 0,
      atk: fighting ? atkPhase(s.rate, s.atk) : null, flash: s.flash, seed: (s.slot || 0) * 1.7,
      buff: s.buffT, spin: s.spinT,
    });
    if (s.hp < s.maxHp || s.hero) hpBar(s.x, s.y - CHAR_H[name] - 6, s.hero ? 20 : 12, s.hp / s.maxHp, s.hero ? '#5ad0ff' : '#4cd34c');
    return;
  }
  ctx.save(); ctx.translate(s.x, s.y - bob); ctx.scale(s.face, 1);
  if (s.hero) {
    ctx.fillStyle = '#b8282c'; ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-12, 0); ctx.lineTo(0, -2); ctx.fill();
    circle(0, -r, r, '#d8b24a', '#6a4a10', 1.5);
    circle(0, -2 * r - 3, 5, '#f0c9a0');
    ctx.fillStyle = '#c9c9d0'; ctx.beginPath(); ctx.arc(0, -2 * r - 4, 5.5, Math.PI, 0); ctx.fill();
  } else {
    const col = s.militia ? '#8a6a3a' : '#2f5fb0';
    circle(0, -r, r, col, '#13284d', 1.2);
    circle(0, -2 * r - 2, 3.5, '#f0c9a0');
    ctx.fillStyle = '#a8a8b0'; ctx.beginPath(); ctx.arc(0, -2 * r - 3, 4, Math.PI, 0); ctx.fill();
  }
  const swing = fighting ? Math.sin(s.anim * 14) * 0.9 : 0;
  ctx.save(); ctx.translate(r - 1, -r); ctx.rotate(-0.6 + swing);
  ctx.strokeStyle = '#e6e6ee'; ctx.lineWidth = s.hero ? 2.5 : 1.8;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s.hero ? -14 : -10); ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (s.hp < s.maxHp || s.hero) hpBar(s.x, s.y - (s.hero ? 34 : 22), s.hero ? 22 : 14, s.hp / s.maxHp, s.hero ? '#5ad0ff' : '#4cd34c');
}

// Karakter çizimi + prosedürel animasyon:
// yürürken adım zıplaması ve sallanma, saldırıda öne atılma, dururken nefes, isabette beyaz parlama.
// Saldırı zamanlaması: negatif = vuruşa kalan süre (hazırlık), pozitif = vuruştan beri geçen süre
function atkPhase(rate, atk) {
  const since = rate - atk;
  return since < 0.3 ? since : -atk;
}

function drawUnit(name, im, x, y, face, o) {
  const h = o.h, w = h * im.width / im.height;
  let ox = 0, oy = -o.fly, rot = 0, sx = 1, sy = 1;
  if (o.wings !== null && o.wings !== undefined) {
    const f = Math.sin(o.wings * 16);
    sy = 1 + f * 0.12; sx = 1 - f * 0.05; oy += f * 1.5;
  } else if (o.atk !== null && o.atk !== undefined && o.atk > -0.28 && o.atk < 0.3) {
    if (o.atk < 0) {
      // hazırlık: geriye yaslanıp silahı kaldırır
      const k = (o.atk + 0.28) / 0.28;
      rot = -0.32 * k; ox = -2.5 * k; sy = 1 + 0.03 * k;
    } else {
      // vuruş: hızla öne savrulur, sonra toparlanır
      const k = 1 - o.atk / 0.3, k2 = k * k;
      rot = 0.45 * k2; ox = 6 * k2; sx = 1 + 0.06 * k2; sy = 1 - 0.05 * k2;
    }
  } else if (o.walking) {
    const st = Math.sin(o.phase);
    oy -= Math.abs(st) * h * 0.07;
    rot = st * 0.06;
    sy = 1 + Math.abs(st) * 0.03; sx = 1 - Math.abs(st) * 0.02;
  } else {
    sy = 1 + Math.sin(time * 2.6 + o.seed) * 0.018;
  }
  if (o.spin > 0) sx *= Math.cos((0.5 - o.spin) * Math.PI * 6); // kasırga: hızlı dönüş
  shadow(x, y + 1, w * 0.36 * (o.fly ? 0.7 : 1), w * 0.12);
  if (o.buff > 0) {
    ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(time * 8) * 0.15;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(x, y + 1, w * 0.5, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x + ox * face, y + 1 + oy);
  ctx.scale(face, 1); ctx.rotate(rot); ctx.scale(sx, sy);
  drawSprite(ctx, im, 0, 0, w);
  if (o.flash > 0) {
    ctx.globalAlpha = clamp(o.flash / 0.1, 0, 1) * 0.7;
    drawSprite(ctx, whiteOf(name, im), 0, 0, w);
  }
  ctx.restore();
}

function drawCorpse(f) {
  const im = spr(f.name);
  if (!im) return;
  const k = f.t / f.dur, fall = clamp(f.t / 0.28, 0, 1);
  const h = CHAR_H[f.name] || 20, w = h * im.width / im.height;
  ctx.save();
  ctx.globalAlpha = 1 - clamp((k - 0.45) / 0.55, 0, 1);
  ctx.translate(f.x, f.y + 1 - f.fly * (1 - fall * fall) + k * 2);
  ctx.scale(f.face, 1);
  ctx.rotate(-fall * 1.35);   // geriye devrilir
  drawSprite(ctx, im, 0, 0, w);
  if (f.t < 0.12) { ctx.globalAlpha *= 0.8; drawSprite(ctx, whiteOf(f.name, im), 0, 0, w); }
  ctx.restore();
}

function drawProjectile(p) {
  if (p.t < 0) return;
  const k = clamp(p.t / p.dur, 0, 1);
  const x = lerp(p.sx, p.tx, k), y = lerp(p.sy, p.ty, k) - Math.sin(k * Math.PI) * p.arc;
  if (p.kind === 'arrow') {
    const k2 = clamp(k + 0.05, 0, 1);
    const x2 = lerp(p.sx, p.tx, k2), y2 = lerp(p.sy, p.ty, k2) - Math.sin(k2 * Math.PI) * p.arc;
    const a = Math.atan2(y2 - y, x2 - x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(3, -2); ctx.lineTo(3, 2); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'bolt') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#c79bff'); g.addColorStop(1, 'rgba(150,80,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'shell') {
    circle(x, y, 4.5, '#1e1e22', '#000', 1);
  } else if (p.kind === 'meteor') {
    ctx.strokeStyle = 'rgba(255,140,40,0.6)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - (p.tx - p.sx) * 0.15, y - (p.ty - p.sy) * 0.15); ctx.lineTo(x, y); ctx.stroke();
    circle(x, y, 8, '#ff9a2a', '#a33', 2);
  }
}

function drawEffect(f) {
  const k = f.t / f.dur;
  if (f.kind === 'boom') {
    ctx.globalAlpha = 1 - k;
    circle(f.x, f.y, f.r * (0.3 + k * 0.7), 'rgba(255,170,60,0.55)');
    circle(f.x, f.y, f.r * 0.5 * (0.3 + k), 'rgba(255,240,180,0.7)');
    ctx.globalAlpha = 1;
  } else if (f.kind === 'puff') {
    ctx.globalAlpha = 1 - k; circle(f.x, f.y - k * 10, f.r * (1 + k), 'rgba(220,220,220,0.8)'); ctx.globalAlpha = 1;
  } else if (f.kind === 'spark') {
    ctx.globalAlpha = 1 - k;
    if (f.small) {
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + f.x; circle(f.x + Math.cos(a) * k * 9, f.y + Math.sin(a) * k * 9 - k * 3, 1.3, '#fff2a8'); }
    } else {
      for (let i = 0; i < 6; i++) { const a = i * 1.05; circle(f.x + Math.cos(a) * k * 14, f.y + Math.sin(a) * k * 14, 2, '#d9b8ff'); }
    }
    ctx.globalAlpha = 1;
  } else if (f.kind === 'slash') {
    // yay şeklinde kılıç izi: önce parlak, sonra incelip kaybolur
    const r = 11 * f.size, a0 = -1.9 + k * 0.6, a1 = a0 + 1.0 + k * 1.6;
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.face, 1);
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.col; ctx.lineCap = 'round';
    ctx.lineWidth = 3.2 * (1 - k) * f.size + 0.5;
    ctx.beginPath(); ctx.arc(-4, 2, r, a0, a1); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  } else if (f.kind === 'debris') {
    const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 260 * f.t * f.t;
    ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.translate(x, y); ctx.rotate(f.rot + f.vr * f.t);
    ctx.fillStyle = f.col; ctx.strokeStyle = '#3a3128'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-f.s, -f.s * 0.6); ctx.lineTo(f.s * 0.8, -f.s); ctx.lineTo(f.s, f.s * 0.7); ctx.lineTo(-f.s * 0.6, f.s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'smoke') {
    ctx.globalAlpha = 0.55 * (1 - k);
    circle(f.x + Math.sin(f.t * 3 + f.x) * 4, f.y - k * 34, f.r * (1 + k * 1.4), f.dark ? '#3c3a38' : '#8f8a84');
    ctx.globalAlpha = 1;
  } else if (f.kind === 'ember') {
    ctx.globalAlpha = 1 - k;
    circle(f.x + Math.sin(f.t * 9 + f.y) * 3, f.y - k * 26, 1.8 * (1 - k) + 0.6, k < 0.4 ? '#ffe08a' : '#ff7a2a');
    ctx.globalAlpha = 1;
  } else if (f.kind === 'ring') {
    ctx.save(); ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = `rgba(${f.col},0.9)`; ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.3 + 0.7 * k), f.r * (0.3 + 0.7 * k) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'whirl') {
    ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#fff6d0'; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = k * 14 + i * 2.1;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(0, 6, 46, 18, 0, a, a + 1.4); ctx.stroke();
    }
    ctx.restore();
  } else if (f.kind === 'bolt') {
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineJoin = 'round';
    for (const [lw, col] of [[6, 'rgba(140,180,255,0.5)'], [2.2, '#f2f7ff']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      f.pts.forEach(([x, y], i) => {
        if (!i) { ctx.moveTo(x, y); return; }
        const [px, py] = f.pts[i - 1];
        for (let j = 1; j <= 4; j++) {
          const q = j / 4, jit = j < 4 ? (Math.sin(f.t * 60 + i * 7 + j * 3) * 6) : 0;
          ctx.lineTo(px + (x - px) * q + jit, py + (y - py) * q - jit * 0.5);
        }
      });
      ctx.stroke();
    }
    ctx.restore();
  } else if (f.kind === 'dust') {
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 8; i++) { const a = i * 0.785; circle(f.x + Math.cos(a) * (10 + k * 22), f.y + Math.sin(a) * (5 + k * 10), 4 * (1 - k) + 1, '#d9c8a8'); }
    ctx.globalAlpha = 1;
  } else if (f.kind === 'heal') {
    ctx.globalAlpha = 1 - k; txt('+', f.x, f.y - 20 - k * 12, 14, '#7cff7c'); ctx.globalAlpha = 1;
  }
}

// ---------- menüler (halka menü) ----------
function plotMenuItems(pl) {
  const offs = [[-44, -40], [44, -40], [-44, 40], [44, 40]];
  return TOWER_ORDER.map((type, i) => ({ id: 'build', type, x: pl.x + offs[i][0], y: pl.y - 16 + offs[i][1], cost: TOWERS[type].levels[0].cost }));
}
function towerMenuItems(t) {
  const items = [];
  if (t.lvl < t.def.levels.length - 1) items.push({ id: 'upgrade', x: t.x, y: t.y - 76, cost: t.def.levels[t.lvl + 1].cost });
  else items.push({ id: 'max', x: t.x, y: t.y - 76 });
  items.push({ id: 'sell', x: t.x, y: t.y + 36, refund: Math.floor(t.spent * SELL_RATIO) });
  if (t.type === 'barracks') items.push({ id: 'rally', x: t.x + 50, y: t.y - 20 });
  return items;
}
// menüyü ekran içinde tutmak için kaydırma
function menuLayout() {
  if (!G.sel || (G.sel.kind !== 'plot' && G.sel.kind !== 'tower')) return { items: [], cx: 0, cy: 0 };
  let items, cx, cy;
  if (G.sel.kind === 'plot') { items = plotMenuItems(G.sel.plot); cx = G.sel.plot.x; cy = G.sel.plot.y - 16; }
  else { items = towerMenuItems(G.sel.tower); cx = G.sel.tower.x; cy = G.sel.tower.y - 20; }
  const xs = items.map(i => i.x), ys = items.map(i => i.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = minX < 26 ? 26 - minX : maxX > W - 26 ? W - 26 - maxX : 0;
  const dy = minY < 26 ? 26 - minY : maxY > H - 34 ? H - 34 - maxY : 0;
  for (const it of items) { it.x += dx; it.y += dy; }
  return { items, cx: cx + dx, cy: cy + dy };
}
function currentMenu() { return menuLayout().items; }
function itemAffordable(it) { return it.cost == null || G.gold >= it.cost; }

function drawMenu() {
  if (!G.sel) return;
  const { items, cx, cy } = menuLayout();
  // menzil önizleme
  let rangeShow = null;
  if (G.sel.kind === 'tower') {
    const t = G.sel.tower;
    rangeShow = t.def.levels[t.lvl].range;
    if (G.preview && G.preview.id === 'upgrade') rangeShow = t.def.levels[t.lvl + 1].range;
    drawRange(t.x, t.y - (t.type === 'barracks' ? 0 : 10), rangeShow, t.type === 'barracks');
    if (t.type === 'barracks') drawRally(t.rx, t.ry);
  } else if (G.preview && G.preview.id === 'build') {
    const pl = G.sel.plot;
    drawRange(pl.x, pl.y - 10, TOWERS[G.preview.type].levels[0].range, G.preview.type === 'barracks');
  }
  ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.stroke();
  for (const it of items) {
    const ok = itemAffordable(it);
    const active = G.preview && G.preview.id === it.id && G.preview.type === it.type;
    circle(it.x, it.y, 21, active ? '#ffe9a8' : '#3b2e22', active ? '#fff' : '#d7b77a', 3);
    if (it.id === 'build') {
      ctx.globalAlpha = ok ? 1 : 0.4;
      const im = spr(`tower_${it.type}_1`);
      if (im) drawSprite(ctx, im, it.x, it.y + 17, 34 * im.width / im.height); else drawTowerShape(it.type, it.x, it.y + 12, 0, 0.46);
      ctx.globalAlpha = 1;
    } else if (it.id === 'upgrade') {
      ctx.globalAlpha = ok ? 1 : 0.4;
      ctx.fillStyle = active ? '#3b2e22' : '#ffd34d';
      ctx.beginPath(); ctx.moveTo(it.x, it.y - 12); ctx.lineTo(it.x + 10, it.y + 1); ctx.lineTo(it.x + 4, it.y + 1); ctx.lineTo(it.x + 4, it.y + 10);
      ctx.lineTo(it.x - 4, it.y + 10); ctx.lineTo(it.x - 4, it.y + 1); ctx.lineTo(it.x - 10, it.y + 1); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (it.id === 'max') {
      txt('MAX', it.x, it.y, 11, '#aaa');
    } else if (it.id === 'sell') {
      circle(it.x, it.y, 9, '#ffd34d', '#8a6a10', 2); txt('$', it.x, it.y + 1, 11, '#5a4000', 'center', '900');
    } else if (it.id === 'rally') {
      ctx.strokeStyle = active ? '#3b2e22' : '#eee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(it.x - 4, it.y + 10); ctx.lineTo(it.x - 4, it.y - 10); ctx.stroke();
      ctx.fillStyle = '#2a64c8'; ctx.beginPath(); ctx.moveTo(it.x - 4, it.y - 10); ctx.lineTo(it.x + 9, it.y - 5); ctx.lineTo(it.x - 4, it.y); ctx.fill();
    }
    if (it.cost != null) {
      roundRect(it.x - 18, it.y + 15, 36, 15, 7, '#1d1a14', ok ? '#ffd34d' : '#a33', 1.5);
      txt(it.cost + '', it.x, it.y + 23, 11, ok ? '#ffd34d' : '#f66');
    }
    if (it.refund != null) {
      roundRect(it.x - 18, it.y + 15, 36, 15, 7, '#1d1a14', '#ffd34d', 1.5);
      txt('+' + it.refund, it.x, it.y + 23, 11, '#ffd34d');
    }
    if (active) {
      circle(it.x + 15, it.y - 15, 8, '#3fae3f', '#fff', 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(it.x + 11, it.y - 15); ctx.lineTo(it.x + 14, it.y - 12); ctx.lineTo(it.x + 19, it.y - 18); ctx.stroke();
    }
  }
}

function drawRange(x, y, r, dashed) {
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
}
function drawRally(x, y) {
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 18); ctx.stroke();
  ctx.fillStyle = '#2a64c8'; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 12, y - 14); ctx.lineTo(x, y - 10); ctx.fill();
}

// ---------- HUD ----------
const SKILL_ICON = (i) => ({ x: 20 + i * 27, y: H - 82, r: 11 });
const HUD = {
  pause: { x: W - 30, y: 28, r: 20 },
  speed: { x: W - 78, y: 28, r: 20 },
  mute:  { x: W - 126, y: 28, r: 16 },
  hero:  { x: 40, y: H - 36, r: 26 },
  meteor:    { x: 106, y: H - 32, r: 23 },
  reinforce: { x: 164, y: H - 32, r: 23 },
};

function drawHud() {
  roundRect(8, 8, 250, 40, 12, 'rgba(29,26,20,0.78)', '#d7b77a', 2);
  // can
  ctx.fillStyle = '#e8434b';
  ctx.beginPath(); ctx.moveTo(30, 36); ctx.bezierCurveTo(14, 24, 20, 14, 30, 22); ctx.bezierCurveTo(40, 14, 46, 24, 30, 36); ctx.fill();
  txt(G.lives + '', 58, 28, 17, '#fff');
  circle(92, 28, 9, '#ffd34d', '#8a6a10', 2);
  txt(Math.floor(G.gold) + '', 124, 28, 17, '#ffd34d');
  txt(`Dalga ${G.wave}/${G.lv.waves.length}`, 204, 28, 14, '#eee');

  for (const [k, b] of Object.entries({ pause: HUD.pause, speed: HUD.speed, mute: HUD.mute })) {
    circle(b.x, b.y, b.r, 'rgba(29,26,20,0.85)', '#d7b77a', 2);
    if (k === 'pause') { ctx.fillStyle = '#eee'; ctx.fillRect(b.x - 7, b.y - 8, 5, 16); ctx.fillRect(b.x + 2, b.y - 8, 5, 16); }
    if (k === 'speed') txt(speed + 'x', b.x, b.y + 1, 14, speed > 1 ? '#ffd34d' : '#eee');
    if (k === 'mute') txt(muted ? '🔇' : '🔊', b.x, b.y + 1, 13, '#eee', 'center', 'normal');
  }

  // kahraman portresi
  const h = G.hero, hb = HUD.hero;
  const selHero = G.sel && G.sel.kind === 'hero';
  circle(hb.x, hb.y, hb.r, '#2b2418', selHero ? '#fff' : '#d7b77a', 3);
  ctx.save(); ctx.beginPath(); ctx.arc(hb.x, hb.y, hb.r - 2, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = h.dead ? 0.35 : 1;
  const heroIm = spr('hero');
  if (heroIm) drawSprite(ctx, heroIm, hb.x + 4, hb.y + 62, 64);
  else {
    ctx.fillStyle = '#b8282c'; ctx.fillRect(hb.x - 20, hb.y + 4, 40, 30);
    circle(hb.x, hb.y + 16, 14, '#d8b24a');
    circle(hb.x, hb.y - 4, 10, '#f0c9a0');
    ctx.fillStyle = '#c9c9d0'; ctx.beginPath(); ctx.arc(hb.x, hb.y - 6, 11, Math.PI, 0); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (h.dead) txt(Math.ceil(h.respawnT) + '', hb.x, hb.y, 18, '#fff');
  ctx.strokeStyle = '#5ad0ff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(hb.x, hb.y, hb.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (h.hp / h.maxHp)); ctx.stroke();
  circle(hb.x + 19, hb.y - 19, 9, '#3b2e22', '#d7b77a', 1.5);
  txt(h.lvl + '', hb.x + 19, hb.y - 18, 11, '#9ff');

  for (const id of ['meteor', 'reinforce']) {
    const b = HUD[id], cd = G.spells[id], max = SPELLS[id].cd;
    const active = G.mode && G.mode.kind === 'spell' && G.mode.id === id;
    circle(b.x, b.y, b.r, active ? '#5a3a20' : '#2b2418', active ? '#fff' : '#d7b77a', 3);
    if (id === 'meteor') { circle(b.x + 2, b.y + 2, 8, '#ff9a2a', '#a33', 2); ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x - 12, b.y - 12); ctx.lineTo(b.x - 4, b.y - 4); ctx.stroke(); }
    else { circle(b.x - 6, b.y + 2, 6, '#8a6a3a'); circle(b.x + 6, b.y + 2, 6, '#8a6a3a'); circle(b.x - 6, b.y - 7, 3.5, '#f0c9a0'); circle(b.x + 6, b.y - 7, 3.5, '#f0c9a0'); }
    if (cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / max)); ctx.fill();
      txt(Math.ceil(cd) + '', b.x, b.y, 14, '#fff');
    }
  }

  // kahraman yetenekleri
  HERO.skills.forEach((sk, i) => {
    const b = SKILL_ICON(i), open = h.lvl >= sk.lvl, cd = (h.cds && h.cds[sk.id]) || 0;
    circle(b.x, b.y, b.r, open ? '#3b2e22' : '#2a2620', open ? '#ffd34d' : '#6a5f50', 2);
    if (open) drawSkillGlyph(sk.id, b.x, b.y);
    else txt(sk.lvl + '', b.x, b.y + 1, 10, '#8a7f70');
    if (open && cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / sk.cd)); ctx.fill();
    }
  });

  // dalga çağırma butonları
  const showWave = G.wave < G.lv.waves.length && (G.wave === 0 || G.waveCountdown != null);
  if (showWave) {
    for (const pi of nextWavePaths()) {
      const b = waveButtonPos(pi);
      const pulse = 1 + Math.sin(time * 5) * 0.08;
      circle(b.x, b.y, 20 * pulse, 'rgba(120,20,20,0.9)', '#ffd34d', 3);
      // kafatası
      circle(b.x, b.y - 2, 8, '#eee');
      ctx.fillStyle = '#eee'; ctx.fillRect(b.x - 5, b.y + 3, 10, 5);
      circle(b.x - 3, b.y - 2, 2.2, '#300'); circle(b.x + 3, b.y - 2, 2.2, '#300');
      if (G.wave > 0 && G.waveCountdown != null) {
        ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.x, b.y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - G.waveCountdown / G.waveCountdownMax)); ctx.stroke();
      }
      if (G.wave === 0) txt('Başlat', b.x, b.y + 34, 12, '#ffd34d');
    }
  }

  // bilgi paneli
  const info = infoText();
  if (info) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    const w = Math.max(260, ctx.measureText(info[1]).width + 30);
    roundRect(W / 2 - w / 2, H - 50, w, 42, 10, 'rgba(29,26,20,0.85)', '#d7b77a', 2);
    txt(info[0], W / 2, H - 38, 14, '#ffd34d');
    txt(info[1], W / 2, H - 20, 12, '#eee', 'center', '600');
  }
  if (G.mode) {
    const m = G.mode.kind === 'rally' ? 'Askerlerin toplanma noktasını seç' : `${SPELLS[G.mode.id].name}: hedefi seç`;
    txt(m, W / 2, 66, 15, '#fff');
  } else if (G.sel && G.sel.kind === 'hero') {
    txt('Komutanı göndermek için haritaya dokun', W / 2, 66, 15, '#fff');
  }
}

function drawSkillGlyph(id, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#ffe27a'; ctx.fillStyle = '#ffe27a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  if (id === 'bash') { ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, -5); ctx.lineTo(5, 1); ctx.quadraticCurveTo(5, 6, 0, 7); ctx.quadraticCurveTo(-5, 6, -5, 1); ctx.closePath(); ctx.fill(); }
  else if (id === 'cry') { ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(2, -6); ctx.lineTo(2, 6); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(3, 0, 5, -0.7, 0.7); ctx.stroke(); }
  else if (id === 'whirl') { ctx.beginPath(); for (let a = 0; a < 9; a += 0.3) { const r = a * 0.75; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); }
  else if (id === 'bolt') { ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 7); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// Ekranın üstünde kısa duyuru (yeni yetenek, yetenek bilgisi)
function drawBanner() {
  const b = G.banner;
  if (!b) return;
  const a = Math.min(1, b.t / 0.25, (b.dur - b.t) / 0.4);
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  ctx.font = '600 12px system-ui, sans-serif';
  const w = Math.max(300, ctx.measureText(b.sub).width + 40);
  roundRect(W / 2 - w / 2, 84, w, 48, 12, 'rgba(29,26,20,0.88)', '#ffd34d', 2);
  txt(b.title, W / 2, 100, 16, '#ffd34d');
  txt(b.sub, W / 2, 120, 12, '#eee', 'center', '600');
  ctx.restore();
}

function infoText() {
  if (G.preview && G.preview.id === 'build') {
    const T = TOWERS[G.preview.type], L = T.levels[0];
    return [`${T.name} — ${L.cost} altın`, towerStats(G.preview.type, L)];
  }
  if (G.sel && G.sel.kind === 'tower') {
    const t = G.sel.tower;
    if (G.preview && G.preview.id === 'upgrade') {
      const L = t.def.levels[t.lvl + 1];
      return [`Yükselt → Seviye ${t.lvl + 2} — ${L.cost} altın`, towerStats(t.type, L)];
    }
    if (G.preview && G.preview.id === 'sell') return ['Sat', `${Math.floor(t.spent * SELL_RATIO)} altın geri al`];
    return [`${t.def.name} — Seviye ${t.lvl + 1}`, towerStats(t.type, t.def.levels[t.lvl])];
  }
  return null;
}
function towerStats(type, L) {
  if (type === 'barracks') return `3 asker · Can ${L.hp} · Hasar ${L.dmg[0]}-${L.dmg[1]} · Zırh %${Math.round(L.armor * 100)}`;
  let s = `Hasar ${L.dmg[0]}-${L.dmg[1]} · Menzil ${L.range} · Atış ${L.rate}sn`;
  if (L.splash) s += ' · Alan';
  if (type === 'mage') s += ' · Büyü';
  return s;
}

// ---------- ekranlar ----------
const buttons = []; // ekran/overlay butonları: {x,y,w,h,label,fn}
function button(x, y, w, h, label, fn, col = '#7a3d1a') {
  roundRect(x - w / 2, y - h / 2, w, h, 12, col, '#ffd34d', 3);
  txt(label, x, y + 1, 18, '#fff');
  buttons.push({ x: x - w / 2, y: y - h / 2, w, h, fn });
}

function drawTitle() {
  const bg = spr('title_bg');
  if (bg) {
    // ekranı kaplayacak şekilde ölçekle, taşan kısmı kırp
    const k = Math.max(W / bg.width, H / bg.height), w = bg.width * k, h = bg.height * k;
    ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
    const sh = ctx.createLinearGradient(0, 0, 0, 170);
    sh.addColorStop(0, 'rgba(40,20,10,0.35)'); sh.addColorStop(1, 'rgba(40,20,10,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, W, 170);
    txt('SINIR KALESİ', W / 2, 84, 60, '#ffd34d', 'center', '900');
    txt('kule savunma · prototip v0.2', W / 2, 130, 16, '#fff', 'center', '600');
    button(W / 2, 470, 210, 58, 'OYNA', () => { screen = 'map'; });
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a6ea8'); g.addColorStop(0.6, '#8fc0e0'); g.addColorStop(0.61, '#5f9440'); g.addColorStop(1, '#3d7030');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // tepeler + kale
  ctx.fillStyle = '#4f8a3c'; ctx.beginPath(); ctx.ellipse(250, 360, 380, 90, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#5f9a48'; ctx.beginPath(); ctx.ellipse(760, 370, 360, 80, 0, Math.PI, 0); ctx.fill();
  const cx = 480, cy = 330;
  ctx.fillStyle = '#8d887d'; ctx.fillRect(cx - 110, cy - 60, 220, 60);
  for (let i = 0; i < 11; i++) ctx.fillRect(cx - 110 + i * 20, cy - 72, 12, 12);
  for (const tx of [-130, 110]) {
    ctx.fillStyle = '#7a756b'; ctx.fillRect(cx + tx, cy - 110, 40, 110);
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + tx + i * 15, cy - 122, 10, 12);
    ctx.fillStyle = '#b5452f'; ctx.beginPath(); ctx.moveTo(cx + tx - 6, cy - 122); ctx.lineTo(cx + tx + 20, cy - 165); ctx.lineTo(cx + tx + 46, cy - 122); ctx.fill();
  }
  ctx.fillStyle = '#3a2614'; ctx.beginPath(); ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 22, cy - 30); ctx.arc(cx, cy - 30, 22, Math.PI, 0); ctx.lineTo(cx + 22, cy); ctx.fill();
  txt('SINIR KALESİ', W / 2, 90, 56, '#ffd34d', 'center', '900');
  txt('kule savunma · prototip v0.1', W / 2, 136, 16, '#fff', 'center', '600');
  button(W / 2, 430, 200, 56, 'OYNA', () => { screen = 'map'; });
}

function drawMap() {
  ctx.fillStyle = '#d9c39a'; ctx.fillRect(0, 0, W, H);
  const rnd = seeded(7);
  for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(120,90,50,${0.04 + rnd() * 0.06})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 10 + rnd() * 60, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 6; ctx.strokeRect(14, 14, W - 28, H - 28);
  txt('Harita', W / 2, 54, 30, '#5a3a1a', 'center', '900');
  ctx.setLineDash([10, 10]); ctx.strokeStyle = '#7a5a32'; ctx.lineWidth = 4;
  ctx.beginPath(); LEVELS.forEach((lv, i) => i ? ctx.lineTo(lv.mapPos[0], lv.mapPos[1]) : ctx.moveTo(lv.mapPos[0], lv.mapPos[1])); ctx.stroke();
  ctx.setLineDash([]);
  LEVELS.forEach((lv, i) => {
    const [x, y] = lv.mapPos;
    const unlocked = i === 0 || (save.stars[i - 1] || 0) > 0;
    const st = save.stars[i] || 0;
    circle(x, y, 34, unlocked ? '#b5452f' : '#777', '#ffd34d', 4);
    txt((i + 1) + '', x, y + 1, 26, '#fff', 'center', '900');
    txt(lv.name, x, y + 52, 16, unlocked ? '#3a2614' : '#666', 'center', '800');
    for (let k = 0; k < 3; k++) drawStar(x - 26 + k * 26, y - 48, 10, k < st ? '#ffd34d' : 'rgba(0,0,0,0.25)');
    if (unlocked) buttons.push({ x: x - 40, y: y - 40, w: 80, h: 110, fn: () => startLevel(i) });
  });
  button(90, H - 50, 120, 44, 'Geri', () => { screen = 'title'; }, '#5a4a3a');
  txt('Yıldızlar: ' + save.stars.reduce((a, b) => a + (b || 0), 0) + '/' + LEVELS.length * 3, W - 110, H - 50, 16, '#5a3a1a', 'center', '800');
}

function drawStar(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
}

// Kale: Gemini sprite'ı (castle_1..3, hasar evresine göre) yoksa kışlanın en büyük hali yedek olarak kullanılır.
function drawCastle() {
  const c = G.castle, ratio = G.lives / G.maxLives;
  const stage = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
  const im = spr('castle_' + stage) || spr('castle_1') || spr('tower_barracks_3');
  const sh = c.shake > 0 ? Math.sin(c.shake * 70) * c.shake * 8 : 0;
  if (im) {
    const w = 118, h = w * im.height / im.width;
    ctx.save(); ctx.translate(c.x + sh, c.y);
    drawSprite(ctx, im, 0, 0, w);
    if (c.flash > 0) { ctx.globalAlpha = c.flash / 0.25 * 0.45; drawSprite(ctx, whiteOf('castle_fx_' + stage, im), 0, 0, w); }
    ctx.restore();
    // can barı
    const bw = 64, by = c.y + 10; // can barı kalenin altında: sağ üstteki düğmelerle çakışmasın
    roundRect(c.x - bw / 2 - 14, by - 6, bw + 20, 12, 6, 'rgba(29,26,20,0.8)', '#d7b77a', 1.5);
    ctx.fillStyle = '#e8434b';
    ctx.beginPath(); const hx = c.x - bw / 2 - 6, hy = by + 3;
    ctx.moveTo(hx, hy); ctx.bezierCurveTo(hx - 6, hy - 4, hx - 4, hy - 9, hx, hy - 6); ctx.bezierCurveTo(hx + 4, hy - 9, hx + 6, hy - 4, hx, hy); ctx.fill();
    ctx.fillStyle = '#4a1010'; ctx.fillRect(c.x - bw / 2 + 2, by - 2, bw, 5);
    ctx.fillStyle = ratio > 0.6 ? '#5bd35b' : ratio > 0.3 ? '#f2c230' : '#e8434b';
    ctx.fillRect(c.x - bw / 2 + 2, by - 2, bw * ratio, 5);
  }
}

// Kale hasarlıysa sürekli duman/kıvılcım çıkar
function castleAmbient(dt) {
  const c = G.castle, ratio = G.lives / G.maxLives;
  c.shake = Math.max(0, c.shake - dt); c.flash = Math.max(0, c.flash - dt);
  G.hurt = Math.max(0, G.hurt - dt);
  if (ratio > 0.6 || G.lives <= 0) return;
  c.smokeT -= dt;
  if (c.smokeT > 0) return;
  c.smokeT = ratio > 0.3 ? 0.35 : 0.15;
  const x = c.x + rand(-40, 40), y = c.y - rand(40, 85);
  G.effects.push({ kind: 'smoke', x, y, r: rand(4, 8), dark: ratio <= 0.3, t: 0, dur: 1.6 });
  if (ratio <= 0.3) G.effects.push({ kind: 'ember', x: x + rand(-5, 5), y, t: 0, dur: 0.9 });
}

function drawPlay() {
  ctx.drawImage(G.bg, 0, 0, W, H);
  for (const pl of G.plots) if (!pl.tower) drawPlot(pl);
  if (G.sel && G.sel.kind === 'hero') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(G.hero.x, G.hero.y + 2, 14, 7, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (G.mode && G.mode.kind === 'rally') {
    const t = G.mode.tower; drawRange(t.x, t.y, t.def.levels[t.lvl].range, true); drawRally(t.rx, t.ry);
  }
  // derinlik sıralı varlıklar
  const ents = [];
  for (const t of G.towers) ents.push([t.y, 0, t]);
  for (const e of G.enemies) ents.push([e.y + (e.def.flying ? 60 : 0), 1, e]);
  for (const s of G.soldiers) ents.push([s.y, 2, s]);
  ents.push([G.castle.y - 30, 3, G.castle]);
  ents.sort((a, b) => a[0] - b[0]);
  for (const f of G.effects) if (f.kind === 'corpse') drawCorpse(f);
  for (const [, k, o] of ents) k === 0 ? drawTower(o) : k === 1 ? drawEnemy(o) : k === 2 ? drawSoldier(o) : drawCastle();
  for (const p of G.projectiles) drawProjectile(p);
  for (const f of G.effects) if (f.kind !== 'corpse') drawEffect(f);
  for (const f of G.floaters) { ctx.globalAlpha = 1 - f.t / 1.1; txt(f.text, f.x, f.y, 13, f.col); ctx.globalAlpha = 1; }
  if (G.hurt > 0) {
    // kale hasar alınca ekran kenarları kızarır
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${0.45 * G.hurt / 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawHud();
  drawBanner();
  drawMenu();
  if (overlay) drawOverlay();
}

function drawOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  roundRect(W / 2 - 200, H / 2 - 150, 400, 300, 18, '#e3cfa4', '#7a5a32', 6);
  if (overlay === 'pause') {
    txt('Durduruldu', W / 2, H / 2 - 105, 30, '#5a3a1a', 'center', '900');
    button(W / 2, H / 2 - 35, 220, 50, 'Devam', () => { overlay = null; });
    button(W / 2, H / 2 + 28, 220, 50, 'Yeniden Başla', () => startLevel(G.idx), '#5a4a3a');
    button(W / 2, H / 2 + 91, 220, 50, 'Harita', () => { screen = 'map'; overlay = null; }, '#5a4a3a');
  } else if (overlay === 'win') {
    txt('Zafer!', W / 2, H / 2 - 108, 38, '#3a7a2a', 'center', '900');
    for (let k = 0; k < 3; k++) drawStar(W / 2 - 60 + k * 60, H / 2 - 45, 24, k < G.stars ? '#ffd34d' : 'rgba(0,0,0,0.2)');
    txt(`Kalan can: ${G.lives}/${G.maxLives}`, W / 2, H / 2 + 5, 16, '#5a3a1a', 'center', '700');
    button(W / 2 - 95, H / 2 + 85, 170, 50, 'Tekrar', () => startLevel(G.idx), '#5a4a3a');
    button(W / 2 + 95, H / 2 + 85, 170, 50, 'Harita', () => { screen = 'map'; overlay = null; });
  } else if (overlay === 'lose') {
    txt('Kale düştü', W / 2, H / 2 - 100, 34, '#8a1f1f', 'center', '900');
    txt(`Dalga ${G.wave}/${G.lv.waves.length}`, W / 2, H / 2 - 50, 18, '#5a3a1a', 'center', '700');
    button(W / 2, H / 2 + 20, 220, 50, 'Tekrar Dene', () => startLevel(G.idx));
    button(W / 2, H / 2 + 85, 220, 50, 'Harita', () => { screen = 'map'; overlay = null; }, '#5a4a3a');
  }
}

// ---------- giriş ----------
function toLogical(ev) {
  return { x: (ev.clientX - view.ox) / view.scale, y: (ev.clientY - view.oy) / view.scale };
}
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  initAudio();
  const p = toLogical(ev);
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { sfx('click'); b.fn(); return; }
  }
  if (screen === 'play' && !overlay) playTap(p.x, p.y);
});

const hit = (b, x, y, pad = 4) => dist(b.x, b.y, x, y) <= b.r + pad;

function playTap(x, y) {
  // HUD
  for (let i = 0; i < HERO.skills.length; i++) {
    if (hit(SKILL_ICON(i), x, y, 3)) {
      const sk = HERO.skills[i], open = G.hero.lvl >= sk.lvl;
      G.banner = { title: open ? sk.name : `${sk.name} (Seviye ${sk.lvl}'de açılır)`, sub: sk.desc, t: 0, dur: 3 };
      sfx('pick');
      return;
    }
  }
  if (hit(HUD.pause, x, y)) { sfx('click'); overlay = 'pause'; return; }
  if (hit(HUD.speed, x, y)) { sfx('click'); speed = speed === 1 ? 2 : 1; return; }
  if (hit(HUD.mute, x, y)) { setMuted(!muted); sfx('click'); return; }
  if (hit(HUD.hero, x, y)) { G.mode = null; G.sel = (G.sel && G.sel.kind === 'hero') || G.hero.dead ? null : { kind: 'hero' }; G.preview = null; return; }
  for (const id of ['meteor', 'reinforce']) {
    if (hit(HUD[id], x, y)) {
      G.sel = null; G.preview = null;
      if (G.spells[id] > 0) { sfx('error'); return; }
      G.mode = G.mode && G.mode.id === id ? null : { kind: 'spell', id };
      if (G.mode) sfx('spell');
      return;
    }
  }
  // dalga butonu
  if (G.wave < G.lv.waves.length && (G.wave === 0 || G.waveCountdown != null)) {
    for (const pi of nextWavePaths()) {
      const b = waveButtonPos(pi);
      if (dist(b.x, b.y, x, y) < 26) { waveBonusAndStart(); return; }
    }
  }
  // hedefleme modları
  if (G.mode) {
    const m = G.mode; G.mode = null;
    if (m.kind === 'spell') {
      if (m.id === 'reinforce') { const n = nearestOnPaths(G.paths, x, y); if (n.d > 60) { sfx('error'); return; } castSpell(m.id, n.x, n.y); }
      else castSpell(m.id, x, y);
    } else if (m.kind === 'rally') {
      const t = m.tower;
      const n = nearestOnPaths(G.paths, x, y);
      const px = n.d < 30 ? n.x : x, py = n.d < 30 ? n.y : y;
      if (dist(t.x, t.y, px, py) <= t.def.levels[t.lvl].range) {
        t.rx = px; t.ry = py;
        for (const s of t.soldiers) { releaseSoldier(s); s.moving = true; }
        sfx('click');
      } else {
        floatText(x, y, 'Menzil dışı', '#f66');
        sfx('error');
      }
    }
    return;
  }
  // açık menü
  if (G.sel && (G.sel.kind === 'plot' || G.sel.kind === 'tower')) {
    for (const it of currentMenu()) {
      if (dist(it.x, it.y, x, y) <= 24) {
        const same = G.preview && G.preview.id === it.id && G.preview.type === it.type;
        if (it.id === 'rally') { G.mode = { kind: 'rally', tower: G.sel.tower }; G.sel = null; G.preview = null; return; }
        if (it.id === 'max') return;
        if (!same) { G.preview = it; sfx('pick'); return; }
        if (it.id === 'build') { if (buildTower(G.sel.plot, it.type)) { G.sel = null; G.preview = null; } else sfx('error'); }
        else if (it.id === 'upgrade') { if (upgradeTower(G.sel.tower)) { G.preview = null; } else sfx('error'); }
        else if (it.id === 'sell') { sellTower(G.sel.tower); G.sel = null; G.preview = null; }
        return;
      }
    }
  }
  const wasHero = G.sel && G.sel.kind === 'hero';
  G.sel = null; G.preview = null;
  // kahraman hareketi
  if (wasHero) {
    const h = G.hero;
    if (dist(h.x, h.y - 8, x, y) < 18) return;
    h.rx = clamp(x, 10, W - 10); h.ry = clamp(y, 60, H - 10);
    releaseSoldier(h); h.moving = true;
    G.effects.push({ kind: 'dust', x: h.rx, y: h.ry, t: 0, dur: 0.4 });
    return;
  }
  // kahramanı seç
  if (!G.hero.dead && dist(G.hero.x, G.hero.y - 8, x, y) < 20) { G.sel = { kind: 'hero' }; sfx('select'); return; }
  // kule
  for (const t of G.towers) {
    if (Math.abs(x - t.x) < 30 && y < t.y + 18 && y > t.y - 85) { G.sel = { kind: 'tower', tower: t }; sfx('select'); return; }
  }
  // boş arsa
  for (const pl of G.plots) {
    if (!pl.tower && dist(pl.x, pl.y, x, y) < 30) { G.sel = { kind: 'plot', plot: pl }; sfx('select'); return; }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play' && !overlay) overlay = 'pause';
});

// ---------- döngü ----------
let last = performance.now();
function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now; time += real;
  if (screen === 'play' && !overlay) {
    for (let i = 0; i < speed; i++) update(real);
  }
  // çizim
  const { dpr, scale, ox, oy } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1d1a14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  buttons.length = 0;
  if (screen === 'title') drawTitle();
  else if (screen === 'map') drawMap();
  else drawPlay();
  ctx.restore();
  if (view.ch > view.cw * 1.1) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    txt('Daha iyi deneyim için telefonu yan çevir ↻', view.cw / 2, view.ch - 40, 15, '#ffd34d');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// test/geliştirme kancası
window.__game = {
  get G() { return G; }, get overlay() { return overlay; }, startLevel, setSpeed: (s) => { speed = s; },
  build: (i, type) => buildTower(G.plots[i], type), upgrade: (i) => G.plots[i].tower && upgradeTower(G.plots[i].tower),
  wave: () => waveBonusAndStart(), cast: castSpell,
  sim(seconds, dt = 1 / 30) { for (let t = 0; t < seconds && !overlay; t += dt) update(dt); return overlay; },
};
})();

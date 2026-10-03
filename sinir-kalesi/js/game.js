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
let bgDirty = 0; // arka plan sprite'ı yeni yüklendi: bölüm arka planı ve harita önizlemeleri yeniden çizilecek
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
      if (/^(grass_|road|tree_|rock_|castle)/.test(name)) bgDirty = Math.max(time, 0.001);
    };
    im.src = 'img/' + file;
  }))
  .catch(() => {});
// Boyama sprite'larının kaynak ölçüleri (aynı sayfadaki kulelerin göreli boyu korunur)
const SPR_META = {};
fetch('img/meta.json').then(r => (r.ok ? r.json() : {})).then(m => Object.assign(SPR_META, m)).catch(() => {});
// Oyun içi boyutlar (mantıksal px). Karakterler yüksekliğe göre, kule ve dekor kaynak ölçeğe göre.
const CHAR_H = {
  enemy_goblin: 24, enemy_wolf: 23, enemy_bandit: 27, enemy_orc: 32, enemy_bat: 26,
  enemy_shaman: 29, enemy_knight: 32, enemy_troll: 54, hero: 29, soldier: 21, militia: 21,
};
for (const k in ENEMIES) if (ENEMIES[k].h) CHAR_H['enemy_' + k] = ENEMIES[k].h;
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

// Büyük kaynak görselleri küçük çizerken tarayıcının tek adımlı küçültmesi tırtıklı sonuç verir.
// Her görselin yarıya yarıya küçültülmüş kopyaları (mipmap) bir kez hazırlanır; çizimde ekrandaki
// piksel boyuna en yakın (ondan büyük) kopya seçilir, böylece sprite'lar her boyda keskin kalır.
const MIPS = new WeakMap();
function mipsOf(im) {
  let list = MIPS.get(im);
  if (list) return list;
  list = [im];
  let cur = im;
  while (cur.width > 48 && cur.height > 48) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(cur.width / 2); c.height = Math.ceil(cur.height / 2);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, c.width, c.height);
    list.push(c); cur = c;
  }
  MIPS.set(im, list);
  return list;
}
function pickMip(c, im, w) {
  const m = c.getTransform(), px = w * Math.hypot(m.a, m.b);
  const list = mipsOf(im);
  let best = list[0];
  for (const l of list) { if (l.width >= px * 1.05) best = l; else break; }
  return best;
}

// alt-orta noktaya hizalı çizim (anchorY=0.5 ise merkez)
function drawSprite(c, im, x, y, w, anchorY = 1) {
  const h = w * im.height / im.width;
  c.drawImage(pickMip(c, im, w), x - w / 2, y - h * anchorY, w, h);
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

// Çentikli telefonlarda (yatay tutuşta kamera çentiği) oyun alanı güvenli bölgeye sığdırılır
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
  'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
document.body.appendChild(safeProbe);
// Çizim çözünürlüğü: ekranın piksel yoğunluğu en fazla 1.5'e sınırlanır (fark gözle seçilmez, çizim yükü yarıya iner).
// Kare hızı düşerse çözünürlük kademeli olarak azaltılır, toparlanınca geri yükseltilir.
const QMAX = Math.min(window.devicePixelRatio || 1, 1.5);
let quality = QMAX;
const perf = { acc: 0, n: 0, t: 0, good: 0 };
function adaptQuality(real) {
  if (real > 0.2) return; // sekme arka plandaydı
  perf.acc += real; perf.n++; perf.t += real;
  if (perf.t < 2) return;
  const avg = perf.acc / perf.n;
  perf.acc = perf.n = perf.t = 0;
  if (avg > 1 / 42 && quality > 0.85) { quality = Math.max(0.85, quality - 0.2); perf.good = 0; resize(); }
  else if (avg < 1 / 57 && quality < QMAX) { if (++perf.good >= 3) { quality = Math.min(QMAX, quality + 0.15); perf.good = 0; resize(); } }
  else perf.good = 0;
}
function resize() {
  const dpr = quality;
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const cs = getComputedStyle(safeProbe), px = (v) => parseFloat(v) || 0;
  const sl = px(cs.paddingLeft), sr = px(cs.paddingRight), st = px(cs.paddingTop), sb = px(cs.paddingBottom);
  const aw = cw - sl - sr, ah = ch - st - sb;
  const scale = Math.min(aw / W, ah / H);
  view = { scale, ox: sl + (aw - W * scale) / 2, oy: st + (ah - H * scale) / 2, dpr, cw, ch };
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; // tuval boyutu değişince sıfırlanır
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
// Bölüm verisindeki köşe noktaları merkezcil Catmull-Rom eğrisiyle yumuşatılır: yol virajlı çizilir,
// düşmanlar da aynı eğriyi izler. Eğri tüm köşe noktalarından geçer, taşma yapmaz.
function smoothPts(pts, step = 5) {
  if (pts.length < 3) return pts;
  const P = [pts[0].map((v, k) => 2 * v - pts[1][k]), ...pts, pts[pts.length - 1].map((v, k) => 2 * v - pts[pts.length - 2][k])];
  const out = [pts[0]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const tj = (a, b) => Math.pow(Math.max(1e-4, dist(a[0], a[1], b[0], b[1])), 0.5);
    const t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    const n = Math.max(2, Math.ceil(dist(p1[0], p1[1], p2[0], p2[1]) / step));
    for (let j = 1; j <= n; j++) {
      const t = t1 + (t2 - t1) * j / n;
      const pt = [0, 1].map(k => {
        const A1 = (t1 - t) / t1 * p0[k] + t / t1 * p1[k];
        const A2 = (t2 - t) / (t2 - t1) * p1[k] + (t - t1) / (t2 - t1) * p2[k];
        const A3 = (t3 - t) / (t3 - t2) * p2[k] + (t - t2) / (t3 - t2) * p3[k];
        const B1 = (t2 - t) / t2 * A1 + t / t2 * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        return (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      });
      out.push(pt);
    }
  }
  return out;
}
function buildPath(pts) {
  pts = smoothPts(pts);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return { pts, cum, total: cum[cum.length - 1] };
}
function pathPos(p, d, off = 0) {
  d = clamp(d, 0, p.total);
  let lo = 1, hi = p.pts.length - 1; // cum[i] >= d olan ilk i (ikili arama)
  while (lo < hi) { const mid = (lo + hi) >> 1; if (p.cum[mid] < d) lo = mid + 1; else hi = mid; }
  const i = lo;
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
  meadow: { grass: '#8cc25a', grass2: '#6a9e46', patch: ['#8cc15a', '#5a8a3a'], trees: 17, rocks: 6, treeCol: ['#2f6b2a', '#3f8a35', '#56a446'], road: ['#7a5a32', '#cfa96b', '#5a3f1f'], tuft: ['#4f8a2e', '#6ea83e'], stone: ['#a49c8a', '#cfc7b4'], light: 'rgba(255,226,160,0.16)' },
  forest: { grass: '#5f9a48', grass2: '#447a34', patch: ['#5f9a48', '#355f28'], trees: 42, rocks: 5, treeCol: ['#1f4f22', '#2d6a2c', '#3f8238'], road: ['#664a2a', '#b8925a', '#47321a'], tuft: ['#335f25', '#4b7f30'], stone: ['#8f8a7c', '#b8b2a2'], light: 'rgba(200,240,170,0.12)' },
  dusk:   { tex: 'meadow', tint: 'rgba(255,120,40,0.2)', grass: '#9cb85a', grass2: '#7a8a40', patch: ['#9cb85a', '#6a7a3a'], trees: 20, rocks: 8, treeCol: ['#4a5a2a', '#6a7a3a', '#8a8a4a'], road: ['#80552e', '#d4a46b', '#5a3a1a'], tuft: ['#6a7a30', '#8a9a40'], stone: ['#a8907a', '#d8c0a4'], light: 'rgba(255,170,90,0.28)', amb: '255,190,120' },
  swamp:  { tex: 'forest', tint: 'rgba(30,90,80,0.22)', grass: '#4f7a48', grass2: '#34583a', patch: ['#4f7a48', '#2a4a30'], trees: 34, rocks: 8, treeCol: ['#1f3f2a', '#2d5a3a', '#3f7048'], road: ['#5a4a32', '#9a8a62', '#3a2e1c'], tuft: ['#2a5038', '#3f6a40'], stone: ['#7a8478', '#a8b0a0'], light: 'rgba(160,230,200,0.12)', amb: '170,255,140' },
  winter: { tex: 'rocky', tint: 'rgba(235,242,255,0.55)', grass: '#dfe8ee', grass2: '#b8c8d4', patch: ['#e8eef4', '#b8c8d4'], trees: 22, rocks: 12, treeCol: ['#2a4a3a', '#3a5a4a', '#5a7a6a'], road: ['#7a7680', '#c8c4cc', '#4a4650'], tuft: ['#c8d4dc', '#eef4f8'], stone: ['#9a9ca8', '#d4d8e0'], light: 'rgba(220,235,255,0.2)', amb: '255,255,255', snow: true },
  volcano:{ tex: 'rocky', tint: 'rgba(70,20,10,0.4)', grass: '#6a5a4a', grass2: '#3a2a22', patch: ['#5a4a3a', '#2a1a14'], trees: 8, rocks: 26, treeCol: ['#3a2a1a', '#4a3a2a', '#5a4a3a'], road: ['#4a3a34', '#8a7464', '#2a1e18'], tuft: ['#5a4a2a', '#7a6a3a'], stone: ['#5a5050', '#8a8080'], light: 'rgba(255,90,40,0.2)', amb: '255,120,50', embers: true },
  rocky:  { grass: '#a3ad6e', grass2: '#7f8c52', patch: ['#a0a878', '#5f6a40'], trees: 12, rocks: 22, treeCol: ['#3a5a2a', '#4d7236', '#628a44'], road: ['#6a6058', '#b0a690', '#4a4239'], tuft: ['#6f7a40', '#8f9a55'], stone: ['#8d877c', '#bdb6a6'], light: 'rgba(255,214,150,0.18)' },
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
  const grassTex = spr('grass_' + (th.tex || lv.theme));
  if (grassTex) {
    const pat = g.createPattern(grassTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(0.5));
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.42; g.fillStyle = grd; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
  if (th.tint) { g.fillStyle = th.tint; g.fillRect(0, 0, W, H); }
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

  // yol: yumuşak gölge → koyu toprak kenar → doku → ortada açık aşınma izi → tekerlek izleri
  g.lineJoin = 'round'; g.lineCap = 'round';
  const tracePaths = () => { g.beginPath(); for (const p of paths) p.pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); };
  const strokePath = (w, col) => { g.strokeStyle = col; g.lineWidth = w; tracePaths(); g.stroke(); };
  g.save(); g.shadowColor = 'rgba(30,20,8,0.55)'; g.shadowBlur = 16; g.shadowOffsetY = 3;
  strokePath(52, th.road[2]); g.restore();
  strokePath(56, 'rgba(40,28,12,0.18)');
  strokePath(50, th.road[2]);
  strokePath(46, th.road[0]);
  const roadTex = spr('road');
  if (roadTex) {
    const pat = g.createPattern(roadTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(0.5));
    strokePath(42, pat);
  } else strokePath(42, th.road[1]);
  // kenara doğru koyulaşan iç gölge: kenar yumuşak bir eğimle çimene karışır
  for (let k = 0; k < 4; k++) strokePath(42 - k * 6, `rgba(255,240,205,${0.035 + k * 0.012})`);
  strokePath(14, 'rgba(255,244,215,0.08)');
  for (const p of paths) {
    for (const side of [-1, 1]) {
      g.strokeStyle = 'rgba(70,45,20,0.16)'; g.lineWidth = 3; g.beginPath();
      for (let d = 0; d <= p.total; d += 6) { const q = pathPos(p, d, side * 8); d ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
      g.stroke();
    }
  }
  // çakıllar ve kenar taşları
  for (const p of paths) {
    for (let d = 0; d < p.total; d += 7) {
      const q = pathPos(p, d, (rnd() - 0.5) * 36);
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,60,30,0.22)' : 'rgba(255,240,200,0.22)';
      g.beginPath(); g.arc(q.x, q.y, 0.8 + rnd() * 1.6, 0, Math.PI * 2); g.fill();
    }
    for (let d = 0; d < p.total; d += 16 + rnd() * 30) {
      const side = rnd() < 0.5 ? -1 : 1, q = pathPos(p, d, side * (22 + rnd() * 3)), r = 1.8 + rnd() * 2.4;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(q.x + 1, q.y + 1.2, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone[0]; g.beginPath(); g.ellipse(q.x, q.y, r * 1.2, r * 0.85, rnd(), 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone[1]; g.beginPath(); g.ellipse(q.x - r * 0.3, q.y - r * 0.3, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // yol kenarına taşan çimen tutamları: düz çizgi yerine organik, yumuşak bir sınır
  const tuft = (x, y, s, col) => {
    g.strokeStyle = col; g.lineWidth = 1.3 * s; g.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.38 + (rnd() - 0.5) * 0.3, len = (4 + rnd() * 4) * s;
      g.beginPath(); g.moveTo(x + (k - 2) * 1.2 * s, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  };
  for (const p of paths) {
    for (let d = 0; d < p.total; d += 3.2) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const q = pathPos(p, d, side * (20 + rnd() * 6));
        tuft(q.x, q.y + 2, 0.7 + rnd() * 0.5, rnd() < 0.5 ? th.tuft[0] : th.tuft[1]);
      }
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
  // ışık: sol üstten sıcak güneş, sağ alta doğru serin gölge, kenarlarda vinyet
  const sun = g.createLinearGradient(0, 0, W, H);
  sun.addColorStop(0, th.light); sun.addColorStop(0.5, 'rgba(255,255,255,0)'); sun.addColorStop(1, 'rgba(20,30,70,0.16)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.66);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(10,15,5,0.38)');
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  return c;
}

// ---------- oyun durumu ----------
let screen = 'title'; // title | map | play
let G = null;          // aktif bölüm durumu
let speed = 1, paused = false, overlay = null; // overlay: null | 'pause' | 'win' | 'lose'
let time = 0;
let screenT = 0, overlayT = 0; // ekranın / pencerenin açıldığı an (giriş animasyonları için)
let uiParts = [];
let mapPage = null, mapPageT = 0; // bölüm haritasında açık sayfa (3 bölüm/sayfa)
let swipe = null;                 // harita sayfasını parmakla kaydırma               // menü ekranlarının parçacıkları (konfeti, toz zerreleri)

function heroUnlocked(id) {
  const u = HEROES[id].unlock;
  return !u || (save.stars[u - 1] || 0) > 0;
}
// seçili kahraman takımı (en fazla 2, yalnızca açılmış olanlar)
function team() {
  const t = (save.team || ['commander', 'caner']).filter(id => HEROES[id] && heroUnlocked(id)).slice(0, 2);
  return t.length ? t : ['commander'];
}

function startLevel(idx) {
  const lv = LEVELS[idx];
  const paths = lv.paths.map(buildPath);
  G = {
    idx, lv, paths,
    bg: renderBackground(lv, paths),
    gold: Math.round(lv.gold * diff().gold) + (upgRank('castle') >= 2 ? 60 : 0) + (upgRank('castle') >= 3 ? 60 : 0),
    lives: diff().lives + (upgRank('castle') >= 1 ? 3 : 0) + (upgRank('castle') >= 3 ? 3 : 0),
    maxLives: diff().lives + (upgRank('castle') >= 1 ? 3 : 0) + (upgRank('castle') >= 3 ? 3 : 0),
    wave: 0, waveCountdown: null, waveCountdownMax: 1, spawners: [],
    enemies: [], towers: [], soldiers: [], projectiles: [], effects: [], floaters: [],
    parts: [], decals: [], zones: [], coins: [], traps: [], shakeT: 0, shakeAmp: 0, shakeDur: 1, ambT: 0,
    plots: lv.plots.map(([x, y]) => ({ x, y, tower: null })),
    heroes: [],
    spells: { meteor: 0, reinforce: 0 },
    sel: null, preview: null, mode: null, menuT: 0, menuClose: null, waveBtn: {},
    stars: 0, t: 0, starFx: 0,
    castle: { x: lv.castle[0], y: lv.castle[1], shake: 0, flash: 0, smokeT: 0 },
    hurt: 0, banner: null,
  };
  team().forEach((id, i) => {
    const q = nearestOnPaths(paths, W * (0.45 + i * 0.1), H * (0.5 - i * 0.08));
    const h = makeHero(id, q.x + i * 6, q.y, i);
    G.heroes.push(h); G.soldiers.push(h);
  });
  screen = 'play'; setOverlay(null); paused = false; speed = 1; screenT = time;
}

function setOverlay(o) {
  if (o === overlay) return;
  overlay = o; overlayT = time;
  press.key = null;
  if (G) { G.starFx = 0; if (o) setSel(null); }
  if (o === 'win') {
    const cols = ['#ffd34d', '#ff5a4a', '#4fc3ff', '#7be05a', '#ffffff', '#c77dff'];
    for (let i = 0; i < 110; i++) emit(uiParts, { kind: 'chunk', x: rand(0, W), y: rand(-260, -10), vx: rand(-30, 30), vy: rand(30, 110),
      g: 50, drag: 0.5, vr: rand(-9, 9), rot: rand(0, 6), col: cols[i % cols.length], s0: rand(5, 8), s1: 4, life: rand(3.5, 5.5) });
  }
}

function makeHero(id, x, y, slot) {
  const d = HEROES[id];
  const h = { hero: true, id, def: d, slot, x, y, rx: x, ry: y, hp: d.hp, maxHp: d.hp, dmg: d.dmg.slice(), armor: d.armor,
    rate: d.rate, speed: d.speed, engage: d.engage, regen: d.regen, ranged: d.ranged || 0, atk: 0, target: null, dead: false, respawnT: 0,
    lvl: 1, xp: 0, face: 1, anim: 0, learned: {}, cds: {}, castT: 0, reviveLeft: 0, crit: 0, dustT: 0 };
  heroStats(h);
  h.hp = h.maxHp;
  return h;
}
// seviye ve kalıcı yeteneklerden kahraman değerleri
function heroStats(h) {
  const d = h.def, k = 1 + 0.2 * (h.lvl - 1), L = h.learned;
  const ratio = h.maxHp ? h.hp / h.maxHp : 1;
  h.maxHp = Math.round(d.hp * k); h.hp = Math.min(h.maxHp, h.maxHp * ratio);
  h.dmg = [Math.round(d.dmg[0] * k), Math.round(d.dmg[1] * k)];
  h.armor = Math.min(0.8, d.armor + (L.iron ? 0.25 : 0));
  h.regen = d.regen * (L.iron ? 2 : 1);
  h.rate = d.rate * (L.shadow ? 0.75 : 1);
  h.crit = L.shadow ? 0.2 : L.eagle ? 0.25 : 0;
  h.ranged = (d.ranged || 0) * (L.eagle ? 1.2 : 1);
  h.dodge = L.dodge ? 0.35 : 0;
}
function heroPoints(h) { return (h.lvl - 1) - Object.keys(h.learned).length; }
// bir yolun sıradaki öğrenilebilir yeteneği (yol içinde sırayla açılır)
function nextSkill(h, pi) { const p = h.def.paths[pi] || h.def.paths[0]; return p.skills.find(sk => !h.learned[sk.id]) || null; }
function learnSkill(h, pi, want) {
  const sk = want && !h.learned[want.id] ? want : nextSkill(h, pi);
  if (!sk || heroPoints(h) <= 0) return null;
  h.learned[sk.id] = true;
  if (sk.id === 'revive') h.reviveLeft = 1;
  if (sk.id === 'ninelives') h.reviveLeft = 2;
  heroStats(h);
  return sk;
}

// ---------- dalgalar ----------
function waveBonusAndStart() {
  if (!G || G.wave >= G.lv.waves.length) return;
  const bonus = earlyBonus();
  if (bonus > 0) {
    const b = waveButtonPos(nextWavePaths()[0] || 0);
    dropCoins(b.x, b.y, bonus, true);
    floatText(b.x, b.y - 34, `Erken çağrı +${bonus}`, '#ffd34d');
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

function spawnEnemy(type, pi, d0 = 0) {
  const def = ENEMIES[type];
  const p = G.paths[pi] || G.paths[0];
  const off = def.boss ? 0 : rand(-11, 11);
  const q = pathPos(p, d0, off);
  const hp = def.hp * (G.lv.hpMul || 1) * diff().hp * (def.chief ? 1 + 0.12 * G.idx : 1);
  const e = { type, def, p, d: d0, off, x: q.x, y: q.y, hp, maxHp: hp, blocker: null, atk: 0, dead: false, anim: rand(0, 10), face: 1, healT: 3 };
  G.enemies.push(e);
  if (def.chief) bossIntro(e);
  else {
    save.seenEnemies = save.seenEnemies || [];
    if (!save.seenEnemies.includes(type)) { save.seenEnemies.push(type); persist(); if (!G.intro) G.intro = { type, t: 0, dur: 4.5 }; }
  }
}

// ---------- parçacıklar ----------
// Hafif bir parçacık sistemi: kıvılcım, duman, ateş, toprak parçası. 'glow' türü önceden çizilmiş yumuşak
// bir daire dokusudur; add=true ise ışık gibi toplanarak (lighter) çizilir.
const GLOW = {};
function glowTex(col) {
  if (!GLOW[col]) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.4, `rgba(${col},0.45)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    GLOW[col] = c;
  }
  return GLOW[col];
}
function glow(c, x, y, r, col, a = 1) {
  if (a <= 0 || r <= 0) return;
  const pa = c.globalAlpha; c.globalAlpha = pa * a;
  c.drawImage(glowTex(col), x - r, y - r, r * 2, r * 2);
  c.globalAlpha = pa;
}
function emit(list, o) {
  if (list.length > 900) return;
  list.push(Object.assign({ t: 0, vx: 0, vy: 0, g: 0, drag: 0, s0: 2, s1: 0, a: 1, kind: 'dot' }, o));
}
function updateParts(list, dt) {
  for (const p of list) {
    p.t += dt;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d; p.vy *= d; p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
    if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.5; p.vr = (p.vr || 0) * 0.5; }
  }
  return list.filter(p => p.t < p.life);
}
function drawParts(list, add) {
  for (const p of list) {
    if (!!p.add !== add) continue;
    const k = p.t / p.life, s = lerp(p.s0, p.s1, k);
    const a = p.a * (p.fadeIn ? Math.min(1, k / p.fadeIn) : 1) * (1 - k);
    if (p.kind === 'glow') { glow(ctx, p.x, p.y, s, p.col, a); continue; }
    ctx.globalAlpha = a;
    if (p.kind === 'streak') {
      ctx.strokeStyle = p.col; ctx.lineWidth = s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
    } else if (p.kind === 'chunk') {
      ctx.globalAlpha = Math.min(1, a * 2.5);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.col; ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
      ctx.restore();
    } else {
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawPartsAll(list) {
  drawParts(list, false);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawParts(list, true); ctx.restore();
}

function shakeScreen(amp, dur) {
  if (G.shakeT > 0 && G.shakeAmp * (G.shakeT / G.shakeDur) > amp) return;
  G.shakeAmp = amp; G.shakeT = dur; G.shakeDur = dur;
}

// Gülle / ateş yağmuru patlaması: parlama, ateş topu, şok dalgası, toprak parçaları, kıvılcım, duman ve yanık izi
function fxExplosion(x, y, r, big) {
  const P = G.parts, m = big ? 1.5 : 1;
  emit(P, { kind: 'glow', add: true, x, y: y - 6, col: '255,236,180', s0: r * 1.4, s1: r * 1.8, life: 0.16, a: 0.95 });
  for (let i = 0; i < 9 * m; i++) {
    const a = rand(0, Math.PI * 2), v = rand(15, 70) * m;
    emit(P, { kind: 'glow', add: true, x: x + rand(-r, r) * 0.25, y: y - rand(0, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - rand(15, 45),
      drag: 3, col: i % 2 ? '255,140,40' : '255,200,90', s0: rand(r * 0.35, r * 0.6), s1: r * 0.12, life: rand(0.3, 0.55) });
  }
  for (let i = 0; i < 7 * m; i++) {
    emit(P, { kind: 'glow', x: x + rand(-r, r) * 0.5, y: y - rand(0, 12), vx: rand(-22, 22), vy: rand(-38, -12), drag: 1.2,
      col: i % 2 ? '72,66,60' : '110,102,94', s0: rand(r * 0.22, r * 0.35), s1: rand(r * 0.6, r * 0.95), life: rand(1, 1.7), a: 0.6, fadeIn: 0.12 });
  }
  for (let i = 0; i < 12 * m; i++) {
    const a = rand(Math.PI * 1.08, Math.PI * 1.92), v = rand(70, 170);
    emit(P, { kind: 'chunk', x: x + rand(-4, 4), y: y - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 430, col: i % 3 ? '#6a4a2a' : '#958670',
      s0: rand(2.2, 3.8), s1: 2, life: rand(0.7, 1), vr: rand(-12, 12), floor: y + rand(-8, 10) });
  }
  for (let i = 0; i < 10 * m; i++) {
    const a = rand(0, Math.PI * 2), v = rand(90, 220);
    emit(P, { kind: 'streak', add: true, x, y: y - 5, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 50, g: 260, col: '#ffd27a', s0: 1.8, s1: 0.4, life: rand(0.25, 0.5) });
  }
  G.effects.push({ kind: 'shock', x, y, r: r * 1.6, t: 0, dur: 0.38 });
  G.decals.push({ x, y, r: r * (big ? 0.95 : 0.75), t: 0, life: 8 });
  shakeScreen(big ? 5 : 2.4, big ? 0.38 : 0.2);
}
function fxMuzzle(x, y, face = 1) {
  const P = G.parts, dx = 0.8 * face, dy = -0.6; // namlu yönü: yukarı ve hedef tarafına
  emit(P, { kind: 'glow', add: true, x, y, col: '255,200,110', s0: 20, s1: 26, life: 0.12 });
  emit(P, { kind: 'glow', add: true, x: x + dx * 8, y: y + dy * 8, col: '255,240,190', s0: 12, s1: 4, life: 0.1 });
  for (let i = 0; i < 6; i++) {
    const v = rand(50, 120);
    emit(P, { kind: 'glow', x: x + dx * 4, y: y + dy * 4, vx: dx * v + rand(-15, 15), vy: dy * v + rand(-15, 15), drag: 3.5,
      col: '200,195,185', s0: rand(3, 5), s1: rand(9, 14), life: rand(0.5, 0.9), a: 0.6 });
  }
  for (let i = 0; i < 6; i++) {
    emit(P, { kind: 'glow', x: x + rand(-4, 4), y: y + rand(-3, 3), vx: rand(-25, 25), vy: rand(-45, -15), drag: 2,
      col: '150,144,136', s0: rand(4, 6), s1: rand(11, 16), life: rand(0.6, 1), a: 0.55, fadeIn: 0.1 });
  }
  for (let i = 0; i < 5; i++) {
    const a = rand(-Math.PI, 0), v = rand(60, 140);
    emit(P, { kind: 'streak', add: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, col: '#ffcf70', s0: 1.5, s1: 0.3, life: rand(0.18, 0.32) });
  }
}
function fxMagicCharge(x, y) {
  emit(G.parts, { kind: 'glow', add: true, x, y, col: '200,150,255', s0: 26, s1: 10, life: 0.25 });
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2);
    emit(G.parts, { kind: 'glow', add: true, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70,
      col: '220,190,255', s0: 4, s1: 1, life: 0.25 });
  }
}
function fxMagicHit(x, y, frost) {
  const P = G.parts, c1 = frost ? '150,210,255' : '190,120,255', c0 = frost ? '200,235,255' : '210,160,255';
  emit(P, { kind: 'glow', add: true, x, y, col: c0, s0: 22, s1: 30, life: 0.2 });
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), v = rand(50, 130);
    emit(P, { kind: 'glow', add: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, drag: 4, col: i % 2 ? c1 : '255,240,255', s0: rand(3, 5), s1: 0.5, life: rand(0.3, 0.5) });
  }
  G.effects.push({ kind: 'ring', x, y: y + 6, r: 26, col: frost ? '160,220,255' : '200,150,255', t: 0, dur: 0.35 });
}
function fxFireHit(x, y, big) {
  emit(G.parts, { kind: 'glow', add: true, x, y, col: '255,190,90', s0: big ? 26 : 16, s1: big ? 34 : 22, life: 0.18 });
  for (let i = 0; i < (big ? 14 : 8); i++) {
    const a = rand(0, Math.PI * 2), v = rand(40, big ? 140 : 100);
    emit(G.parts, { kind: 'glow', add: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, drag: 3, col: i % 2 ? '255,130,40' : '255,220,120', s0: rand(3, 6), s1: 0.5, life: rand(0.3, 0.5) });
  }
  if (big) G.effects.push({ kind: 'ring', x, y: y + 6, r: 34, col: '255,160,70', t: 0, dur: 0.35 });
}
function fxArcaneBlast(x, y) {
  const P = G.parts;
  emit(P, { kind: 'glow', add: true, x, y: y - 6, col: '220,170,255', s0: 50, s1: 70, life: 0.25 });
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), v = rand(60, 180);
    emit(P, { kind: 'glow', add: true, x, y: y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55 - 30, drag: 3, col: i % 3 ? '180,110,255' : '255,235,255', s0: rand(4, 7), s1: 0.5, life: rand(0.4, 0.7) });
  }
  G.effects.push({ kind: 'ring', x, y, r: 70, col: '210,160,255', t: 0, dur: 0.45 });
  G.effects.push({ kind: 'shock', x, y, r: 80, t: 0, dur: 0.4 });
  shakeScreen(2, 0.15);
}
function fxArrowHit(x, y, metal) {
  for (let i = 0; i < (metal ? 6 : 4); i++) {
    const a = rand(-Math.PI, 0), v = rand(50, 120);
    emit(G.parts, { kind: 'streak', add: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 300, col: metal ? '#ffc060' : '#fff2c0', s0: 1.4, s1: 0.3, life: rand(0.15, 0.28) });
  }
  emit(G.parts, { kind: 'glow', x, y: y + 4, vx: rand(-8, 8), vy: -10, col: '200,185,160', s0: 3, s1: 8, life: 0.4, a: 0.45 });
}
// hedefin gövde ortası (oklar ve büyü ayağa değil gövdeye gider)
function aimY(e) {
  return e.y - (e.def.flying ? 26 : 0) - (CHAR_H['enemy_' + e.type] || 20) * 0.5;
}

// ---------- hasar ----------
// type: 'phys' (zırh azaltır), 'magic' (büyü direnci azaltır), 'true' (hiçbir şey azaltmaz: zehir, ateş, delici ok)
function damageEnemy(e, amount, type, quiet) {
  if (e.dead) return;
  if (e.shieldT > 0) { if (!quiet && (!e.blockFx || time - e.blockFx > 0.4)) { e.blockFx = time; floatText(e.x, e.y - 40, 'BLOK', '#9fd8ff'); } return; }
  if (e.markT > 0) amount *= 1.6;
  const red = type === 'magic' ? e.def.mr : type === 'phys' ? e.def.armor : 0;
  e.hp -= amount * (1 - red);
  if (!quiet) { e.flash = 0.1; e.hitT = 0.18; }
  e.hitAt = time;
  if (e.hp <= 0) killEnemy(e);
}
// durum etkileri: yavaşlatma (en güçlüsü geçerli), zehir (en güçlüsü geçerli, süre yenilenir), sersemletme
function slowEnemy(e, k, t) {
  if (e.def.boss) k = Math.min(k, 0.4); // boss en fazla %40 yavaşlar
  if (!e.slowT || k >= e.slowK) e.slowK = k;
  e.slowT = Math.max(e.slowT || 0, t);
}
function poisonEnemy(e, dps, t) {
  e.poisonDps = Math.max(e.poisonT > 0 ? e.poisonDps : 0, dps);
  e.poisonT = t;
}
function stunEnemy(e, t) {
  if (e.def.boss) t *= 0.4;
  e.stun = Math.max(e.stun || 0, t);
}
// kulenin bir yeteneğinin şu anki kademesi (yoksa null)
function abRank(t, id) {
  const r = t.ab && t.ab[id];
  if (!r) return null;
  return t.def.abilities.find(a => a.id === id).ranks[r - 1];
}
function killEnemy(e) {
  e.dead = true;
  G.kills = (G.kills || 0) + 1;
  dropCoins(e.x, e.y, e.def.gold);
  sfx('death');
  G.effects.push({ kind: 'corpse', name: 'enemy_' + e.type, x: e.x, y: e.y, face: e.face, fly: e.def.flying ? 26 : 0, t: 0, dur: 0.9 });
  for (let i = 0; i < 5; i++) {
    emit(G.parts, { kind: 'glow', x: e.x + rand(-7, 7), y: e.y + rand(-6, 2), vx: rand(-14, 14), vy: rand(-22, -6), drag: 1.5,
      col: '205,195,175', s0: rand(3, 5), s1: rand(9, 13), life: rand(0.5, 0.8), a: 0.5 });
  }
  for (const h of G.heroes) if (!h.dead) gainXp(h, e.def.gold);
}
const xpNeed = (lvl) => 50 * lvl;
function gainXp(h, amount) {
  if (h.lvl >= HERO_MAX) return;
  h.xp += amount;
  if (h.xp < xpNeed(h.lvl)) return;
  h.xp -= xpNeed(h.lvl); h.lvl++;
  heroStats(h); h.hp = h.maxHp;
  floatText(h.x, h.y - 40, `Seviye ${h.lvl}!`, '#9ff');
  G.effects.push({ kind: 'pillar', x: h.x, y: h.y, col: '255,240,170', t: 0, dur: 0.9 });
  for (let i = 0; i < 18; i++) {
    emit(G.parts, { kind: 'glow', add: true, x: h.x + rand(-12, 12), y: h.y - rand(0, 10), vy: -rand(40, 110), vx: rand(-15, 15), drag: 1,
      col: '255,230,140', s0: rand(3, 5), s1: 0.5, life: rand(0.6, 1) });
  }
  sfx('levelup');
  // yetenekler seviye atladıkça sırayla kendiliğinden açılır
  const sk = learnSkill(h, 0);
  G.banner = sk ? { title: `${h.def.name}: ${sk.name}`, sub: sk.desc, t: 0, dur: 3.5 }
    : { title: `${h.def.name} seviye ${h.lvl}!`, sub: 'Can ve hasar arttı', t: 0, dur: 3 };
  if (sk) floatText(h.x, h.y - 56, sk.name + ' açıldı!', '#ffe27a');
}

// ----- düşen altınlar -----
// Düşman ölünce birkaç altın sekerek yere düşer, 5 sn bekler (dokununca hemen toplanır),
// sonra üstteki altın sayacına uçar; altın, sayaca vardığında hesaba eklenir.
const COIN_TARGET = { x: 112, y: 25 };
function dropCoins(x, y, value, flyNow) {
  const n = clamp(Math.round(value / 4), 1, value >= 100 ? 10 : 6);
  let left = value;
  for (let i = 0; i < n; i++) {
    const v = i === n - 1 ? left : Math.floor(value / n); left -= v;
    const a = rand(0, Math.PI * 2), sp = rand(18, 42);
    const c = { x, y: y + rand(-3, 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, z: 6, vz: rand(70, 110), t: rand(0, 0.3), val: v, state: 'drop', spin: rand(0, 6) };
    G.coins.push(c);
    if (flyNow) { c.z = rand(0, 12); collectCoin(c); c.ft = -i * 0.05; }
  }
}
function collectCoin(c) {
  if (c.state === 'fly') return;
  c.state = 'fly'; c.ft = 0; c.fx0 = c.x; c.fy0 = c.y - c.z;
}
function updateCoins(dt) {
  for (const c of G.coins) {
    c.t += dt; c.spin += dt * 7;
    if (c.state === 'drop') {
      c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 1 - 3 * dt; c.vy *= 1 - 3 * dt;
      c.vz -= 380 * dt; c.z += c.vz * dt;
      if (c.z <= 0) { c.z = 0; if (Math.abs(c.vz) > 40) c.vz = -c.vz * 0.4; else { c.vz = 0; c.state = 'rest'; } }
    } else if (c.state === 'rest') {
      if (c.t > 4) collectCoin(c);
    } else {
      c.ft += dt;
      if (c.ft >= 0.65) {
        c.done = true; G.gold += c.val;
      }
    }
  }
  G.coins = G.coins.filter(c => !c.done);
}
function coinFlyPos(c) {
  const k = clamp(c.ft / 0.65, 0, 1), e = k * k * (3 - 2 * k);
  const mx = (c.fx0 + COIN_TARGET.x) / 2, my = Math.min(c.fy0, COIN_TARGET.y) - 80;
  const u = 1 - e;
  return { x: u * u * c.fx0 + 2 * u * e * mx + e * e * COIN_TARGET.x, y: u * u * c.fy0 + 2 * u * e * my + e * e * COIN_TARGET.y, k };
}
let COIN_IM = null;
function drawCoin(x, y, r, spin) {
  if (!COIN_IM) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 2, 0, 30);
    gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#ffc928'); gr.addColorStop(1, '#b8780c');
    g.fillStyle = gr; g.strokeStyle = '#6a4206'; g.lineWidth = 3;
    g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(150,90,10,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(16, 16, 8.5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(11, 10, 4, 2.4, -0.6, 0, Math.PI * 2); g.fill();
    COIN_IM = c;
  }
  const w = Math.max(0.15, Math.abs(Math.cos(spin)));
  ctx.drawImage(COIN_IM, x - r * w, y - r, 2 * r * w, 2 * r);
}
function drawCoinsWorld() {
  for (const c of G.coins) {
    if (c.state === 'fly') continue;
    const bob = c.state === 'rest' ? Math.sin(time * 4 + c.spin) * 0.8 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 1, 3.2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    drawCoin(c.x, c.y - c.z - 3 - bob, 3, c.state === 'rest' ? time * 2 + c.spin : c.spin);
    const glint = c.state === 'rest' ? Math.sin(time * 3 + c.spin * 2) : 0;
    if (glint > 0.85) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, c.x + 1, c.y - c.z - 5, 6, '255,255,220', (glint - 0.85) * 6); ctx.restore(); }
  }
}
function drawCoinsFlying() {
  for (const c of G.coins) {
    if (c.state !== 'fly' || c.ft < 0) continue;
    const p = coinFlyPos(c);
    drawCoin(p.x, p.y, 3 + p.k * 2, c.spin);
  }
}
function damageSoldier(s, amount) {
  if (s.dead) return;
  // Ateş Bilgesi'nin buz zırhı aurası
  if (G.heroes.some(h => !h.dead && h.learned.frostarmor && dist(h.x, h.y, s.x, s.y) < 110)) amount *= 0.8;
  if (s.dodge && Math.random() < s.dodge) { if (Math.random() < 0.4) floatText(s.x, s.y - 30, 'Kaçtı!', '#ffe9b0'); return; }
  s.hp -= amount * (1 - s.armor);
  s.flash = 0.1;
  if (s.hp <= 0) {
    if (s.hero && s.reviveLeft > 0) {
      // Diriliş: bölümde bir kez yarı canla ayağa kalkar
      s.reviveLeft--; s.hp = s.maxHp * 0.5;
      G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '255,250,210', t: 0, dur: 1 });
      floatText(s.x, s.y - 44, 'Diriliş!', '#fff6c0'); sfx('levelup');
      return;
    }
    s.dead = true; s.hp = 0;
    G.effects.push({ kind: 'corpse', name: s.hero ? s.def.sprite : s.militia ? 'militia' : 'soldier', x: s.x, y: s.y, face: s.face, fly: 0, t: 0, dur: 0.9 });
    s.respawnT = s.hero ? s.def.respawn * (s.learned.ninelives ? 0.5 : 1) : s.tower ? TOWERS.barracks.levels[s.tower.lvl].respawn - (upgRank('barracks') >= 3 ? 3 : 0) : 0;
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
function soldierStats(t) {
  const L = TOWERS.barracks.levels[t.lvl], sh = abRank(t, 'shield'), bl = abRank(t, 'blade'), ur = upgRank('barracks');
  const hm = ur >= 1 ? 1.2 : 1, dm = (ur >= 2 ? 1.2 : 1) * (bl ? bl.mult : 1);
  return {
    maxHp: Math.round((L.hp + (sh ? sh.hp : 0)) * hm), armor: Math.min(0.75, L.armor + (sh ? sh.armor : 0) + (ur >= 3 ? 0.15 : 0)),
    dmg: [L.dmg[0] * dm, L.dmg[1] * dm], crit: bl ? bl.crit : 0, steal: t.lvl >= 2 ? 0.15 : 0,
  };
}
function applySoldierStats(t) {
  const st = soldierStats(t);
  for (const s of t.soldiers) {
    const gain = st.maxHp - s.maxHp;
    s.maxHp = st.maxHp; s.hp = s.dead ? 0 : Math.min(st.maxHp, s.hp + Math.max(0, gain) + st.maxHp * 0.5);
    s.dmg = st.dmg; s.armor = st.armor; s.crit = st.crit; s.steal = st.steal; s.gear = t.lvl;
  }
}
function makeSoldier(t, i) {
  const st = soldierStats(t);
  return { tower: t, slot: i, x: t.x, y: t.y + 6, hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, armor: st.armor, crit: st.crit, steal: st.steal,
    gear: t.lvl, rate: 1, speed: 60, engage: 55, atk: 0, target: null, dead: false, respawnT: 0, face: 1, anim: rand(0, 5) };
}
// son seviyedeki kulenin yeteneğini bir kademe geliştir
function buyAbility(t, id) {
  const def = t.def.abilities.find(a => a.id === id), cur = (t.ab && t.ab[id]) || 0;
  if (cur >= def.ranks.length) return false;
  const cost = def.ranks[cur].cost;
  if (G.gold < cost) return false;
  G.gold -= cost; t.spent += cost; t.ab = t.ab || {}; t.ab[id] = cur + 1; t.born = G.t;
  if (t.type === 'barracks') applySoldierStats(t);
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), v = rand(30, 90);
    emit(G.parts, { kind: 'glow', add: true, x: t.x + rand(-14, 14), y: t.y - rand(10, 60), vx: Math.cos(a) * v * 0.4, vy: -rand(30, 80), drag: 1.5,
      col: '255,220,120', s0: rand(3, 5), s1: 0.5, life: rand(0.6, 1) });
  }
  G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 40, col: '255,215,100', t: 0, dur: 0.5 });
  floatText(t.x, t.y - 70, `${def.name} ${cur + 1}!`, '#ffe27a');
  sfx('upgrade');
  return true;
}
function upgradeTower(t) {
  if (t.lvl >= t.def.levels.length - 1) return false;
  const cost = t.def.levels[t.lvl + 1].cost;
  if (G.gold < cost) return false;
  G.gold -= cost; t.spent += cost; t.lvl++; t.born = G.t;
  if (t.type === 'barracks') applySoldierStats(t);
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
  const [rx, ry] = ARCHER_POS[t.lvl][i], a = t.shots && t.shots[i];
  return { x: t.x - ts.w / 2 + rx * ts.w + (a ? a.ox || 0 : 0), y: ts.bottom - ts.h + ry * ts.h };
}
// okun çıktığı nokta: okçunun yayının ucu
function bowPoint(t, ts, i) {
  const o = archerPoint(t, ts, i), a = t.shots[i], s = ts.w / 68;
  return { x: o.x + Math.cos(a.ang) * 6 * s, y: o.y + 2.3 * s + Math.sin(a.ang) * 6 * s };
}
// top kulesi görsellerinde namlu ağzının yeri (genişlik/yükseklik oranı, top sağa bakarken)
const MUZZLE = [[0.715, 0.084], [0.696, 0.066], [0.742, 0.284]];
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function updateArchers(t, dt, L) {
  const ts = towerSprite(t);
  const n = ts ? ARCHER_POS[t.lvl].length : 1;
  if (!t.shots || t.shots.length !== n) {
    t.shots = Array.from({ length: n }, (_, i) => ({ cd: 0.2 + i * L.rate * 0.5, fx: 0, ang: i % 2 ? 0.3 : Math.PI - 0.3, ox: 0, seed: rand(0, 9), draw: 0 }));
  }
  const e0 = findTarget(t, L.range, true);
  t.shots.forEach((a, i) => {
    a.fx = Math.max(0, a.fx - dt);
    a.cd -= dt;
    // dolaşma: hedef yokken platformda sağa sola yürür, etrafa bakınır; hedef varken yerinde durup nişan alır
    const roam = ts ? ts.w * 0.045 : 0;
    const want = e0 ? a.ox * 0.9 : Math.sin(G.t * 0.55 + a.seed) * roam;
    a.vx = (want - a.ox) * (e0 ? 6 : 1.5);
    a.ox += a.vx * dt;
    a.walk = Math.abs(a.vx) > 0.4 ? (a.walk || 0) + dt : 0;
    const o = ts ? archerPoint(t, ts, i) : { x: t.x, y: t.y - 34 };
    let goal;
    if (e0) goal = Math.atan2(aimY(e0) - o.y, e0.x - o.x);
    else goal = a.vx > 0.3 ? 0.35 : a.vx < -0.3 ? Math.PI - 0.35 : a.ang;
    a.ang += clamp(angDiff(goal, a.ang), -9 * dt, 9 * dt);
    // yay germe: atıştan önceki 0.4 sn'de gerilir
    a.draw = e0 ? clamp(1 - a.cd / 0.4, 0, 1) : Math.max(0, a.draw - dt * 4);
    if (a.cd > 0) return;
    const e = e0;
    if (!e) { a.cd = 0; return; }
    if (Math.abs(angDiff(goal, a.ang)) > 0.35) { a.cd = 0.02; return; } // önce hedefe dönsün
    a.cd = L.rate * n; // her okçu kendi sırasıyla; kulenin toplam atış hızı aynı kalır
    a.fx = 0.18; a.draw = 0;
    if (ts) { const bp = bowPoint(t, ts, i); o.x = bp.x; o.y = bp.y; }
    const d = dist(o.x, o.y, e.x, e.y);
    const pierce = t.lvl >= 1 && Math.random() < 0.25, crit = t.lvl >= 2 && Math.random() < 0.15, po = abRank(t, 'poison');
    G.projectiles.push({ kind: 'arrow', sx: o.x, sy: o.y, target: e, tx: e.x, ty: aimY(e), t: 0, dur: clamp(d / 420, 0.15, 0.6),
      dmg: roll(L.dmg) * (crit ? 2 : 1), dtype: pierce ? 'true' : 'phys', arc: 18, crit, pierce, poison: po ? po.dps : 0 });
    sfx('arrow');
  });
  // Keskin nişancı: belli aralıkla menzildeki en canlı düşmana zırh delen tek atış
  const sn = abRank(t, 'snipe');
  if (sn) {
    t.snipeCd = (t.snipeCd ?? 2) - dt;
    if (t.snipeCd <= 0) {
      let best = null;
      for (const e of G.enemies) if (!e.dead && dist(t.x, t.y - 10, e.x, e.y) <= L.range * 1.15 && (!best || e.hp > best.hp)) best = e;
      if (best) {
        t.snipeCd = sn.cd;
        const o = ts ? archerPoint(t, ts, 0) : { x: t.x, y: t.y - 40 };
        G.effects.push({ kind: 'snipe', x0: o.x, y0: o.y, x1: best.x, y1: aimY(best), t: 0, dur: 0.3 });
        fxArrowHit(best.x, aimY(best), true);
        emit(G.parts, { kind: 'glow', add: true, x: best.x, y: aimY(best), col: '255,240,190', s0: 18, s1: 26, life: 0.2 });
        floatText(best.x, best.y - 40, `-${sn.dmg}`, '#ffe9a0');
        damageEnemy(best, sn.dmg, 'true');
        sfx('arrow'); sfx('bash');
      } else t.snipeCd = 0.3;
    }
  }
}

function updateTower(t, dt) {
  t.anim += dt; t.shotAnim = Math.max(0, t.shotAnim - dt);
  if (t.type === 'artillery') t.faceS = (t.faceS ?? 1) + clamp((t.face || 1) - (t.faceS ?? 1), -7 * dt, 7 * dt);
  if (t.type === 'barracks') return;
  const L = effLevel(t);
  if (t.type === 'archer') { updateArchers(t, dt, L); return; }
  const bl = t.type === 'mage' && abRank(t, 'blast');
  if (bl) {
    t.blastCd = (t.blastCd ?? 3) - dt;
    if (t.blastCd <= 0) {
      // menzilde en kalabalık noktayı bul
      let best = null, bestN = 0;
      for (const e of G.enemies) {
        if (e.dead || dist(t.x, t.y - 10, e.x, e.y) > L.range) continue;
        const n = G.enemies.filter(o => !o.dead && dist(o.x, o.y, e.x, e.y) < 60).length;
        if (n > bestN) { bestN = n; best = e; }
      }
      if (best) {
        t.blastCd = bl.cd; t.shotAnim = 0.3;
        for (const o of G.enemies) if (!o.dead && dist(o.x, o.y, best.x, best.y) < 62) damageEnemy(o, bl.dmg, 'magic');
        fxArcaneBlast(best.x, best.y);
        sfx('meteor');
      } else t.blastCd = 0.4;
    }
  }
  t.cd -= dt;
  if (t.cd > 0) return;
  const e = findTarget(t, L.range, t.def.air);
  if (!e) return;
  t.cd = L.rate;
  t.shotAnim = t.type === 'artillery' ? 0.35 : 0.2;
  const ts = towerSprite(t);
  let sx = t.x, sy = ts ? ts.bottom - ts.h * TOWER_TOP[t.type] : t.y - 34;
  if (t.type === 'artillery' && ts) {
    t.face = e.x < t.x ? -1 : 1;
    if (Math.abs((t.faceS ?? 1) - t.face) > 0.3) { t.cd = 0.2; t.shotAnim = 0; return; } // dönüş bitmeden ateş etmez
    const m = MUZZLE[t.lvl]; sx = t.x + (m[0] - 0.5) * ts.w * t.face; sy = ts.bottom - ts.h + m[1] * ts.h;
  }
  if (t.type === 'archer') {
    const d = dist(sx, sy, e.x, e.y);
    G.projectiles.push({ kind: 'arrow', sx, sy, target: e, tx: e.x, ty: e.y, t: 0, dur: clamp(d / 420, 0.15, 0.6), dmg: roll(L.dmg), dtype: 'phys', arc: 18 });
    sfx('arrow');
  } else if (t.type === 'mage') {
    const d = dist(sx, sy, e.x, e.y);
    const fr = abRank(t, 'frost');
    G.projectiles.push({ kind: 'bolt', sx, sy: sy - 8, target: e, tx: e.x, ty: aimY(e), t: 0, dur: clamp(d / 340, 0.2, 0.7), dmg: roll(L.dmg), dtype: 'magic', arc: 10,
      slow: fr ? fr : t.lvl >= 1 ? { k: 0.3, t: 1 } : null, chain: t.lvl >= 2, frost: !!fr });
    fxMagicCharge(sx, sy - 8);
    sfx('magic');
  } else if (t.type === 'artillery') {
    const dur = 0.9;
    let tx = e.x, ty = e.y;
    if (!e.blocker) { const f = pathPos(e.p, e.d + e.def.speed * dur, e.off); tx = f.x; ty = f.y; }
    const na = abRank(t, 'napalm'), db = abRank(t, 'double');
    const shell = { kind: 'shell', sx, sy, gy: t.y, target: null, tx, ty, t: 0, dur, dmg: roll(L.dmg), dtype: 'phys', arc: 70, splash: L.splash,
      stun: t.lvl >= 2 ? 0.3 : 0, napalm: na ? na.dps : 0 };
    G.projectiles.push(shell);
    if (db) {
      // ikinci gülle: başka bir düşmana (yoksa aynı yere yakın) biraz gecikmeli
      const other = G.enemies.find(o => o !== e && !o.dead && !o.def.flying && dist(t.x, t.y, o.x, o.y) <= L.range);
      const tg = other || e;
      let x2 = tg.x + (other ? 0 : rand(-18, 18)), y2 = tg.y + (other ? 0 : rand(-10, 10));
      if (other && !other.blocker) { const f = pathPos(other.p, other.d + other.def.speed * dur, other.off); x2 = f.x; y2 = f.y; }
      G.projectiles.push(Object.assign({}, shell, { tx: x2, ty: y2, t: -0.22, dmg: shell.dmg * db.mult, arc: 80 }));
    }
    fxMuzzle(sx, sy, t.face || 1);
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
  const slow = e.slowT > 0 ? 1 - e.slowK : 1;
  e.anim += dt * slow;
  if (e.flash > 0) e.flash -= dt;
  if (e.hitT > 0) e.hitT -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (Math.random() < dt * 6) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-7, 7), y: aimY(e) + rand(-8, 8), vy: 10, col: '170,220,255', s0: 3, s1: 0.5, life: 0.6 }); }
  if (e.markT > 0) e.markT -= dt;
  if (e.hasteT > 0) e.hasteT -= dt;
  if (e.shieldT > 0) e.shieldT -= dt;
  if (e.bleedT > 0) {
    e.bleedT -= dt;
    damageEnemy(e, e.bleedDps * dt, 'true', true);
    if (Math.random() < dt * 8) emit(G.parts, { kind: 'dot', x: e.x + rand(-5, 5), y: aimY(e) + rand(-4, 6), vy: rand(10, 30), g: 120, col: '#c0181a', s0: 1.6, s1: 0.6, life: 0.5 });
    if (e.dead) return;
  }
  if (e.poisonT > 0) {
    e.poisonT -= dt;
    damageEnemy(e, e.poisonDps * dt, 'true', true);
    if (Math.random() < dt * 8) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: aimY(e) + rand(-6, 6), vy: -18, col: '140,255,90', s0: 2.8, s1: 0.5, life: 0.7 });
    if (e.dead) return;
  }
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
  if (e.def.ab) bossAbilities(e, dt);
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
  e.d += e.def.speed * (e.slowT > 0 ? 1 - e.slowK : 1) * (e.hasteT > 0 ? 1.5 : 1) * dt;
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

// menzilli kahraman: yolu kesmez, toplanma noktasında durup menzildeki (uçanlar dahil) düşmana atış yapar
function updateRangedHero(h, dt) {
  const home = soldierHome(h);
  if (h.moving || dist(h.x, h.y, home.x, home.y) > 2) {
    if (moveToward(h, home.x, home.y, dt)) h.moving = false;
    heroDust(h, dt);
    h.shooting = false;
    return;
  }
  let best = null, bestRemain = 1e9;
  for (const e of G.enemies) {
    if (e.dead || dist(h.x, h.y - 10, e.x, e.y) > h.ranged) continue;
    const remain = e.p.total - e.d;
    if (remain < bestRemain) { bestRemain = remain; best = e; }
  }
  h.target = best; h.shooting = !!best;
  if (!best) { if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.regen * dt); h.atk = Math.min(h.atk, h.rate * 0.4); return; }
  h.face = best.x < h.x ? -1 : 1;
  h.anim += dt;
  h.atk -= dt;
  if (h.atk <= 0) { h.atk = h.rate; fireHeroShot(h, best); }
}
// kahraman yürürken ayağından toz kalkar
function heroDust(h, dt) {
  h.dustT -= dt;
  if (h.dustT > 0) return;
  h.dustT = 0.18;
  emit(G.parts, { kind: 'glow', x: h.x - h.face * 4, y: h.y, vx: -h.face * rand(5, 15), vy: -rand(4, 12), col: '200,185,160', s0: 2.5, s1: 6, life: 0.5, a: 0.45 });
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
      if (s.hero) G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '255,240,190', t: 0, dur: 0.8 }); // olduğu yerde, ışık sütunuyla dirilir
      else { s.x = s.tower.x; s.y = s.tower.y + 6; }
    }
    return;
  }
  if (s.stunT > 0) { s.stunT -= dt; return; }
  if (s.hero && s.ranged) { updateRangedHero(s, dt); heroSkills(s, dt); return; }
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
        const crit = s.crit && Math.random() < s.crit;
        const dmg = roll(s.dmg) * (s.buffT > 0 ? 1.5 : 1) * (crit ? 2 : 1);
        if (s.hero) {
          s.swingT = 0.3;
          if (s.learned.bleed) { t.bleedDps = Math.max(t.bleedT > 0 ? t.bleedDps : 0, 6 + s.lvl * 2); t.bleedT = 3; }
        }
        damageEnemy(t, dmg, 'phys');
        if (s.steal) s.hp = Math.min(s.maxHp, s.hp + dmg * s.steal);
        if (crit) floatText(t.x, t.y - 30, 'KRİTİK!', '#ffb347');
        slashFx(t.x, t.y - (CHAR_H['enemy_' + t.type] || 20) * 0.55, s.face, s.gear >= 2 ? '#ffe9a0' : '#ffffff', crit ? 1.5 : 1);
        sfx('clash');
      }
    }
  } else {
    const arrived = moveToward(s, home.x, home.y, dt);
    if (s.hero && !arrived) heroDust(s, dt);
    if (arrived) {
      s.moving = false;
      if (s.hero && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.regen * dt);
    }
  }
  if (s.hero) heroSkills(s, dt);
}

// ---------- kahraman yetenekleri (öğrenilenler bekleme süresi dolunca kendiliğinden kullanılır) ----------
function heroSkills(h, dt) {
  for (const k in h.cds) h.cds[k] -= dt;
  if (h.castT > 0) h.castT -= dt;
  for (const p of h.def.paths) for (const sk of p.skills) {
    if (sk.passive || !h.learned[sk.id] || (h.cds[sk.id] || 0) > 0) continue;
    if (!useSkill(h, sk.id)) { h.cds[sk.id] = 0.3; continue; }
    {
      h.cds[sk.id] = sk.cd; h.castT = 0.45;
      floatText(h.x, h.y - 46, sk.name + '!', '#ffe27a');
      const col = h.def.aura;
      G.effects.push({ kind: 'ring', x: h.x, y: h.y, r: 26, col, t: 0, dur: 0.4 });
      for (let i = 0; i < 8; i++) emit(G.parts, { kind: 'glow', add: true, x: h.x + rand(-8, 8), y: h.y - rand(10, 30), vy: -rand(20, 60), col, s0: 3.5, s1: 0.5, life: 0.5 });
      return; // bir karede tek yetenek
    }
  }
}

function enemiesNear(x, y, r, air = false) {
  return G.enemies.filter(e => !e.dead && (air || !e.def.flying) && dist(e.x, e.y, x, y) <= r);
}
// menzildeki en kalabalık düşman kümesinin merkezi
function densest(x, y, range, r, air = false) {
  let best = null, bestN = 0;
  for (const e of G.enemies) {
    if (e.dead || (!air && e.def.flying) || dist(x, y, e.x, e.y) > range) continue;
    const n = enemiesNear(e.x, e.y, r, air).length;
    if (n > bestN) { bestN = n; best = e; }
  }
  return best ? { e: best, n: bestN } : null;
}

function useSkill(h, id) {
  const L = h.lvl, R = h.ranged || 0;
  switch (id) {
    case 'bash': {
      const t = h.target;
      if (!t || t.dead || dist(h.x, h.y, t.x, t.y) > 28) return false;
      stunEnemy(t, 2);
      damageEnemy(t, 20 + 6 * L, 'phys');
      slashFx(t.x, t.y - 12, h.face, '#ffe27a', 1.6);
      G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 22, col: '255,226,122', t: 0, dur: 0.35 });
      sfx('bash');
      return true;
    }
    case 'cry': {
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
    case 'whirl': {
      const near = enemiesNear(h.x, h.y, 58);
      if (near.length < 2) return false;
      for (const e of near) damageEnemy(e, 35 + 8 * L, 'phys');
      h.spinT = 0.5;
      G.effects.push({ kind: 'whirl', x: h.x, y: h.y - 10, t: 0, dur: 0.5 });
      sfx('whirl');
      return true;
    }
    case 'bolt': {
      let cur = enemiesNear(h.x, h.y, 150, true).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
      if (!cur) return false;
      const pts = [[h.x, h.y - 30]], hitSet = new Set();
      for (let i = 0; i < 4 && cur; i++) {
        hitSet.add(cur);
        pts.push([cur.x, aimY(cur)]);
        damageEnemy(cur, 40 + 6 * L, 'magic');
        const from = cur;
        cur = G.enemies.filter(e => !e.dead && !hitSet.has(e) && dist(e.x, e.y, from.x, from.y) < 90)
          .sort((a, b) => dist(a.x, a.y, from.x, from.y) - dist(b.x, b.y, from.x, from.y))[0];
      }
      G.effects.push({ kind: 'bolt', pts, t: 0, dur: 0.35 });
      sfx('zap');
      return true;
    }
    case 'charge': {
      // kaleye en çok yaklaşmış düşmana atılır
      const t = enemiesNear(h.x, h.y, 240).sort((a, b) => (b.d / b.p.total) - (a.d / a.p.total))[0];
      if (!t || dist(h.x, h.y, t.x, t.y) < 40) return false;
      const side = h.x < t.x ? -1 : 1;
      G.effects.push({ kind: 'dash', x0: h.x, y0: h.y - 12, x1: t.x + side * 14, y1: t.y - 12, t: 0, dur: 0.35, col: '255,220,140' });
      releaseSoldier(h);
      h.x = t.x + side * 14; h.y = t.y; h.face = -side;
      damageEnemy(t, 70 + 12 * L, 'phys'); stunEnemy(t, 1);
      slashFx(t.x, t.y - 14, h.face, '#ffe27a', 2);
      shakeScreen(3, 0.2); sfx('bash');
      return true;
    }
    case 'holy': {
      const allies = G.soldiers.filter(s => !s.dead && dist(s.x, s.y, h.x, h.y) < 120);
      if (!allies.some(s => s.hp < s.maxHp * 0.7)) return false;
      for (const s of allies) {
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.45);
        G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '255,240,170', t: 0, dur: 0.6, small: true });
        G.effects.push({ kind: 'heal', x: s.x, y: s.y, t: 0, dur: 0.6 });
      }
      sfx('cry');
      return true;
    }
    case 'consecrate': {
      if (enemiesNear(h.x, h.y, 70).length < 2) return false;
      G.zones.push({ x: h.x, y: h.y, r: 70, dps: 20 + 5 * L, dtype: 'magic', kind: 'holy', t: 0, life: 4, fxT: 0 });
      G.effects.push({ kind: 'ring', x: h.x, y: h.y, r: 70, col: '255,235,150', t: 0, dur: 0.5 });
      sfx('spell');
      return true;
    }
    case 'shieldthrow': {
      let cur = enemiesNear(h.x, h.y, 170, true).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
      if (!cur) return false;
      const pts = [[h.x, h.y - 20]], hitSet = new Set();
      for (let i = 0; i < 3 && cur; i++) {
        hitSet.add(cur); pts.push([cur.x, aimY(cur)]);
        damageEnemy(cur, 30 + 6 * L, 'phys'); stunEnemy(cur, 1);
        const from = cur;
        cur = G.enemies.filter(e => !e.dead && !hitSet.has(e) && dist(e.x, e.y, from.x, from.y) < 100)[0];
      }
      G.effects.push({ kind: 'bolt', pts, t: 0, dur: 0.35, col: 'holy' });
      sfx('bash');
      return true;
    }
    case 'quake': {
      const near = enemiesNear(h.x, h.y, 72);
      if (near.length < 2) return false;
      for (const e of near) { damageEnemy(e, 25 + 4 * L, 'phys'); stunEnemy(e, 1.2); }
      G.effects.push({ kind: 'shock', x: h.x, y: h.y, r: 90, t: 0, dur: 0.45 });
      for (let i = 0; i < 16; i++) {
        const a = rand(0, Math.PI * 2), v = rand(40, 110);
        emit(G.parts, { kind: 'chunk', x: h.x + Math.cos(a) * 20, y: h.y, vx: Math.cos(a) * v, vy: -rand(60, 140), g: 420, col: '#7a5a3a', s0: 3, s1: 2, life: 0.8, vr: rand(-10, 10), floor: h.y + rand(-6, 8) });
      }
      shakeScreen(4, 0.3); sfx('boom');
      return true;
    }
    case 'judgment': {
      const t = h.target;
      if (!t || t.dead || dist(h.x, h.y, t.x, t.y) > 30) return false;
      if (!t.def.boss && t.hp / t.maxHp < 0.25) { floatText(t.x, t.y - 34, 'İNFAZ!', '#ffe27a'); damageEnemy(t, t.hp + 1, 'true'); }
      else damageEnemy(t, roll(h.dmg) * 3, 'phys');
      G.effects.push({ kind: 'pillar', x: t.x, y: t.y, col: '255,250,200', t: 0, dur: 0.45, small: true });
      slashFx(t.x, t.y - 14, h.face, '#fff6c0', 2.2);
      sfx('bash');
      return true;
    }
    case 'fan': {
      const ts = enemiesNear(h.x, h.y, R, true).slice(0, 5);
      if (ts.length < 2) return false;
      for (const e of ts) fireHeroShot(h, e, 1);
      return true;
    }
    case 'deadly': {
      const t = enemiesNear(h.x, h.y, R * 1.3, true).sort((a, b) => b.hp - a.hp)[0];
      if (!t || t.hp < 60) return false;
      G.effects.push({ kind: 'snipe', x0: h.x, y0: h.y - 18, x1: t.x, y1: aimY(t), t: 0, dur: 0.35 });
      fxArrowHit(t.x, aimY(t), true);
      floatText(t.x, t.y - 40, `-${90 + 15 * L}`, '#b8ffb0');
      damageEnemy(t, 90 + 15 * L, 'true');
      sfx('arrow'); sfx('bash');
      return true;
    }
    case 'smoke': {
      const c = densest(h.x, h.y, R, 60);
      if (!c || c.n < 3) return false;
      for (const e of enemiesNear(c.e.x, c.e.y, 65)) slowEnemy(e, 0.5, 3);
      for (let i = 0; i < 22; i++) {
        emit(G.parts, { kind: 'glow', x: c.e.x + rand(-40, 40), y: c.e.y + rand(-20, 15), vx: rand(-10, 10), vy: rand(-12, -2), col: '150,150,160', s0: rand(10, 16), s1: rand(22, 30), life: rand(2, 3), a: 0.5, fadeIn: 0.1 });
      }
      sfx('whirl');
      return true;
    }
    case 'trap': {
      if (G.traps.filter(t => t.owner === h).length >= 2) return false;
      const q = nearestOnPaths(G.paths, h.x, h.y);
      if (q.d > 140) return false;
      G.traps.push({ x: q.x + rand(-8, 8), y: q.y + rand(-5, 5), dmg: 60 + 10 * L, owner: h, t: 0 });
      G.effects.push({ kind: 'dust', x: q.x, y: q.y, t: 0, dur: 0.4 });
      sfx('build');
      return true;
    }
    case 'flamering': {
      const near = enemiesNear(h.x, h.y, 75);
      if (near.length < 2) return false;
      for (const e of near) damageEnemy(e, 35 + 7 * L, 'magic');
      G.zones.push({ x: h.x, y: h.y, r: 70, dps: 10 + 2 * L, dtype: 'true', kind: 'fire', t: 0, life: 2, fxT: 0 });
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        emit(G.parts, { kind: 'glow', add: true, x: h.x + Math.cos(a) * 20, y: h.y + Math.sin(a) * 10, vx: Math.cos(a) * 140, vy: Math.sin(a) * 70, drag: 3, col: i % 2 ? '255,140,40' : '255,210,90', s0: 8, s1: 1, life: 0.5 });
      }
      sfx('meteor');
      return true;
    }
    case 'meteor2': {
      const c = densest(h.x, h.y, 230, 60);
      if (!c || c.n < 3) return false;
      G.projectiles.push({ kind: 'meteor', sx: c.e.x - 130, sy: c.e.y - 420, tx: c.e.x, ty: c.e.y, t: 0, dur: 0.7, dmg: 110 + 15 * L, splash: 66, arc: 0 });
      sfx('spell');
      return true;
    }
    case 'icelance': {
      const t = enemiesNear(h.x, h.y, R, true).sort((a, b) => b.hp - a.hp)[0];
      if (!t) return false;
      G.effects.push({ kind: 'bolt', pts: [[h.x, h.y - 24], [t.x, aimY(t)]], t: 0, dur: 0.3, col: 'frost' });
      fxMagicHit(t.x, aimY(t), true);
      damageEnemy(t, 45 + 9 * L, 'magic'); slowEnemy(t, 0.6, 2.5);
      sfx('magic');
      return true;
    }
    case 'volley': {
      const c = densest(h.x, h.y, R + 20, 60);
      if (!c || c.n < 3) return false;
      for (let i = 0; i < 12; i++) {
        const tx = c.e.x + rand(-40, 40), ty = c.e.y + rand(-22, 22);
        G.projectiles.push({ kind: 'rainarrow', sx: tx - 60, sy: ty - 260, tx, ty, t: -i * 0.06, dur: 0.45, dmg: 18 + 4 * L, splash: 20, arc: 0 });
      }
      sfx('arrow');
      return true;
    }
    case 'blastarrow': {
      const c = densest(h.x, h.y, R, 55);
      if (!c || c.n < 2) return false;
      fireHeroShot(h, c.e, 2.2, { splash: 60, big: true, dtype: 'phys' });
      return true;
    }
    case 'multishot': {
      const ts = enemiesNear(h.x, h.y, R, true).slice(0, 4);
      if (ts.length < 2) return false;
      for (const e of ts) fireHeroShot(h, e, 1.2);
      return true;
    }
    case 'pierce': {
      // en uzaktaki düşmana doğru yol boyunca her şeyi delen ışık oku
      const ts = enemiesNear(h.x, h.y, R * 1.2, true);
      if (ts.length < 2) return false;
      const far = ts.sort((a, b) => dist(b.x, b.y, h.x, h.y) - dist(a.x, a.y, h.x, h.y))[0];
      const x0 = h.x, y0 = h.y - 18, ang = Math.atan2(aimY(far) - y0, far.x - x0), len = R * 1.4;
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const ex = e.x - x0, ey = aimY(e) - y0, t = clamp((ex * Math.cos(ang) + ey * Math.sin(ang)) / len, 0, 1);
        if (dist(e.x, aimY(e), x0 + Math.cos(ang) * len * t, y0 + Math.sin(ang) * len * t) < 16) damageEnemy(e, 60 + 12 * L, 'true');
      }
      G.effects.push({ kind: 'snipe', x0, y0, x1, y1, t: 0, dur: 0.4 });
      sfx('arrow'); sfx('zap');
      return true;
    }
    case 'shadowstep': {
      const t = enemiesNear(h.x, h.y, 200).sort((a, b) => b.hp - a.hp)[0];
      if (!t || t.hp < 50) return false;
      const side = t.face > 0 ? -1 : 1;
      for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', x: h.x + rand(-6, 6), y: h.y - rand(0, 24), vx: rand(-20, 20), vy: -rand(10, 30), col: '60,40,90', s0: 6, s1: 12, life: 0.5, a: 0.7 });
      releaseSoldier(h);
      h.x = t.x + side * 14; h.y = t.y; h.rx = h.x; h.ry = h.y; h.face = -side;
      for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', x: h.x + rand(-6, 6), y: h.y - rand(0, 24), vx: rand(-20, 20), vy: -rand(10, 30), col: '60,40,90', s0: 6, s1: 12, life: 0.5, a: 0.7 });
      damageEnemy(t, roll(h.dmg) * 3 + 20 * L, 'true');
      slashFx(t.x, t.y - 14, h.face, '#d8b8ff', 2);
      h.target = t; t.blocker = t.blocker || h;
      sfx('whirl');
      return true;
    }
    case 'clawstorm': {
      const near = enemiesNear(h.x, h.y, 62);
      if (near.length < 2) return false;
      for (const e of near) damageEnemy(e, 2 * (22 + 6 * L), 'phys');
      h.spinT = 0.5;
      G.effects.push({ kind: 'whirl', x: h.x, y: h.y - 8, t: 0, dur: 0.5 });
      for (let i = 0; i < 6; i++) slashFx(h.x + rand(-30, 30), h.y - rand(4, 22), i % 2 ? 1 : -1, '#ffd9a0', 1.2);
      sfx('whirl');
      return true;
    }
    case 'mark': {
      const t = enemiesNear(h.x, h.y, 180, true).sort((a, b) => b.hp - a.hp)[0];
      if (!t || t.markT > 0 || t.hp < 80) return false;
      t.markT = 6;
      G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 24, col: '255,80,80', t: 0, dur: 0.5 });
      sfx('spell');
      return true;
    }
    case 'freeze': {
      const c = densest(h.x, h.y, R + 20, 60);
      if (!c || c.n < 3) return false;
      for (const e of enemiesNear(c.e.x, c.e.y, 62)) { stunEnemy(e, 2); slowEnemy(e, 0.5, 3.5); }
      G.effects.push({ kind: 'ring', x: c.e.x, y: c.e.y, r: 62, col: '170,225,255', t: 0, dur: 0.5 });
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2), rr = rand(0, 60);
        emit(G.parts, { kind: 'glow', add: true, x: c.e.x + Math.cos(a) * rr, y: c.e.y + Math.sin(a) * rr * 0.5, vy: -rand(5, 25), col: i % 2 ? '190,235,255' : '255,255,255', s0: rand(3, 6), s1: 0.5, life: rand(1, 1.8) });
      }
      sfx('zap');
      return true;
    }
  }
  return false;
}

// menzilli kahramanın atışı: Gölge Avcı bıçak, Ateş Bilgesi ateş topu fırlatır
function fireHeroShot(h, e, mult = 1, extra) {
  const sx = h.x + h.face * 6, sy = h.y - h.def.h * 0.6, d = dist(sx, sy, e.x, e.y);
  const crit = h.crit && Math.random() < h.crit;
  const sp = h.def.proj === 'dagger' ? 460 : h.def.proj === 'harrow' ? 480 : 320;
  const p = { kind: h.def.proj, sx, sy, target: e, tx: e.x, ty: aimY(e), t: 0, dur: clamp(d / sp, 0.15, 0.7),
    splash: h.def.splash ? h.def.splash * (h.learned.fireaim ? 1.6 : 1) : 0, burn: !!h.learned.fireaim,
    dmg: roll(h.dmg) * mult * (crit ? 2 : 1), dtype: h.def.magic ? 'magic' : 'phys', arc: h.def.proj === 'dagger' ? 10 : 16, crit,
    poison: h.learned.venom ? 4 + h.lvl * 1.5 : 0, inferno: h.learned.inferno ? 34 : 0 };
  if (extra) Object.assign(p, extra);
  G.projectiles.push(p);
  sfx(h.def.proj === 'fireball' ? 'magic' : 'arrow');
}

// tuzak: üstüne basan ilk yer düşmanı hasar alır ve sersemler
function updateTraps(dt) {
  for (const tr of G.traps) {
    tr.t += dt;
    const e = G.enemies.find(o => !o.dead && !o.def.flying && dist(o.x, o.y, tr.x, tr.y) < 16);
    if (!e) continue;
    tr.done = true;
    damageEnemy(e, tr.dmg, 'phys'); stunEnemy(e, 1.5);
    for (let i = 0; i < 10; i++) emit(G.parts, { kind: 'streak', add: true, x: tr.x, y: tr.y, vx: rand(-90, 90), vy: -rand(60, 160), g: 300, col: '#e8e0d0', s0: 1.6, s1: 0.3, life: 0.35 });
    G.effects.push({ kind: 'ring', x: tr.x, y: tr.y, r: 22, col: '230,220,200', t: 0, dur: 0.35 });
    sfx('bash');
  }
  G.traps = G.traps.filter(t => !t.done);
}
function drawTraps() {
  for (const tr of G.traps) {
    const pop = easeOutBack(clamp(tr.t / 0.3, 0, 1));
    ctx.save(); ctx.translate(tr.x, tr.y); ctx.scale(pop, pop);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    roundRect(-10, -3, 20, 6, 3, '#5a4630', '#2a1e10', 1.2);
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = '#d8d4cc'; ctx.strokeStyle = '#3a3630'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(i * 4 - 2, -2); ctx.lineTo(i * 4, -8 - (i % 2 ? 0 : 2)); ctx.lineTo(i * 4 + 2, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- mermiler & efektler ----------
function projPos(pr, k) {
  k = clamp(k, 0, 1);
  return { x: lerp(pr.sx, pr.tx, k), y: lerp(pr.sy, pr.ty, k) - Math.sin(k * Math.PI) * pr.arc };
}
function updateProjectile(pr, dt) {
  pr.t += dt;
  if (pr.target && !pr.target.dead) { pr.tx = pr.target.x; pr.ty = aimY(pr.target); }
  if (pr.t > 0) {
    pr.fxT = (pr.fxT || 0) - dt;
    if (pr.fxT <= 0) {
      const q = projPos(pr, pr.t / pr.dur);
      if (pr.kind === 'bolt') {
        pr.fxT = 0.016;
        emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-2, 2), y: q.y + rand(-2, 2), vx: rand(-14, 14), vy: rand(-14, 14), col: '180,120,255', s0: rand(5, 8), s1: 1, life: rand(0.25, 0.4) });
      } else if (pr.kind === 'fireball') {
        pr.fxT = 0.016;
        emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-2, 2), y: q.y + rand(-2, 2), vx: rand(-12, 12), vy: rand(-20, 0), col: Math.random() < 0.5 ? '255,130,40' : '255,210,90', s0: rand(5, 8), s1: 1, life: rand(0.25, 0.4) });
      } else if (pr.kind === 'shell') {
        pr.fxT = 0.03;
        emit(G.parts, { kind: 'glow', x: q.x, y: q.y, vx: rand(-5, 5), vy: -8, col: '130,124,118', s0: 2.5, s1: 7, life: 0.5, a: 0.4 });
      } else if (pr.kind === 'meteor') {
        pr.fxT = 0.012;
        emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-4, 4), y: q.y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-30, 0), col: Math.random() < 0.5 ? '255,140,40' : '255,210,100', s0: rand(9, 13), s1: 2, life: rand(0.25, 0.4) });
        emit(G.parts, { kind: 'glow', x: q.x, y: q.y, vx: rand(-10, 10), vy: rand(-15, -5), col: '80,70,64', s0: 6, s1: 14, life: 0.7, a: 0.4 });
      }
    }
  }
  if (pr.t < pr.dur) return;
  pr.done = true;
  if (pr.kind === 'rainarrow') {
    for (const e of G.enemies) if (!e.dead && dist(e.x, e.y, pr.tx, pr.ty) <= pr.splash) damageEnemy(e, pr.dmg, 'phys', true);
    fxArrowHit(pr.tx, pr.ty, false);
    return;
  }
  if (pr.kind === 'shell' || pr.kind === 'meteor') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, pr.tx, pr.ty);
      if (d <= pr.splash) damageEnemy(e, pr.dmg * (1 - 0.5 * d / pr.splash), 'phys');
    }
    if (pr.stun) for (const e of G.enemies) if (!e.dead && !e.def.flying && dist(e.x, e.y, pr.tx, pr.ty) <= pr.splash * 0.8 && Math.random() < pr.stun) stunEnemy(e, 0.6);
    if (pr.napalm) G.zones.push({ x: pr.tx, y: pr.ty, r: pr.splash * 0.75, dps: pr.napalm, t: 0, life: 3, fxT: 0 });
    fxExplosion(pr.tx, pr.ty, pr.splash, pr.kind === 'meteor');
    sfx(pr.kind === 'meteor' ? 'meteor' : 'boom');
  } else if (pr.target && !pr.target.dead) {
    const e = pr.target;
    if (pr.kind === 'bolt') fxMagicHit(pr.tx, pr.ty, pr.frost);
    else if (pr.kind === 'fireball') fxFireHit(pr.tx, pr.ty, pr.inferno);
    else fxArrowHit(pr.tx, pr.ty, e.def.armor >= 0.5 || pr.pierce);
    if (pr.inferno) for (const o of G.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < pr.inferno) damageEnemy(o, pr.dmg * 0.5, 'magic');
    if (pr.splash) {
      for (const o of G.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < pr.splash) damageEnemy(o, pr.dmg * 0.55, pr.dtype);
      if (pr.burn) G.zones.push({ x: e.x, y: e.y, r: pr.splash * 0.8, dps: 8, dtype: 'true', kind: 'fire', t: 0, life: 1.5, fxT: 0 });
      G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: pr.splash, col: pr.burn ? '255,160,70' : '255,240,190', t: 0, dur: 0.3 });
      if (pr.big) fxExplosion(e.x, e.y, pr.splash, false);
    }
    if (pr.crit) floatText(e.x, e.y - 34, 'KRİTİK!', '#ffb347');
    if (pr.poison) poisonEnemy(e, pr.poison, 3);
    if (pr.slow) slowEnemy(e, pr.slow.k, pr.slow.t);
    damageEnemy(e, pr.dmg, pr.dtype);
    if (pr.chain) {
      const n = G.enemies.filter(o => o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < 85)
        .sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y))[0];
      if (n) {
        G.effects.push({ kind: 'bolt', pts: [[pr.tx, pr.ty], [n.x, aimY(n)]], t: 0, dur: 0.25, col: pr.frost ? 'frost' : 'arcane' });
        fxMagicHit(n.x, aimY(n), pr.frost);
        if (pr.slow) slowEnemy(n, pr.slow.k, pr.slow.t);
        damageEnemy(n, pr.dmg * 0.6, 'magic');
      }
    }
  }
}

// ---------- büyüler ----------
function castSpell(id, x, y) {
  const S = SPELLS[id];
  const ur = upgRank('spells');
  if (id === 'meteor') {
    for (let i = 0; i < S.count + (ur >= 1 ? 1 : 0); i++) {
      const tx = x + rand(-30, 30), ty = y + rand(-20, 20);
      G.projectiles.push({ kind: 'meteor', sx: tx - 120, sy: ty - 400, tx, ty, t: -i * 0.25, dur: 0.6, dmg: roll(S.dmg), splash: S.radius, arc: 0 });
    }
  } else if (id === 'reinforce') {
    for (let i = 0; i < S.count + (ur >= 2 ? 1 : 0); i++) {
      const s = { militia: true, x: x + (i ? 12 : -12), y: y - 30, rx: x + (i ? 12 : -12), ry: y, hp: S.hp, maxHp: S.hp, dmg: S.dmg, armor: 0,
        rate: 1, speed: 60, engage: 60, atk: 0, target: null, dead: false, life: S.life, face: 1, anim: 0, slot: i };
      G.soldiers.push(s);
    }
    G.effects.push({ kind: 'dust', x, y, t: 0, dur: 0.5 });
    sfx('reinforce');
  }
  G.spells[id] = S.cd * (ur >= 3 ? 0.75 : 1);
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
  G.parts = updateParts(G.parts, dt);
  if (G.intro) { G.intro.t += dt; if (G.intro.t > G.intro.dur) G.intro = null; }
  for (const z of G.zones) {
    z.t += dt; z.fxT -= dt;
    for (const e of G.enemies) if (!e.dead && !e.def.flying && dist(e.x, e.y, z.x, z.y) <= z.r) damageEnemy(e, z.dps * dt, z.dtype || 'true', true);
    if (z.fxT <= 0) {
      z.fxT = 0.04;
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * z.r, holy = z.kind === 'holy';
      emit(G.parts, { kind: 'glow', add: true, x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.5, vy: -rand(20, 45),
        col: holy ? (Math.random() < 0.5 ? '255,240,170' : '255,255,230') : (Math.random() < 0.5 ? '255,140,40' : '255,200,80'), s0: rand(4, 7), s1: 1, life: rand(0.4, 0.7) });
    }
  }
  G.zones = G.zones.filter(z => z.t < z.life);
  updateCoins(dt);
  updateTraps(dt);
  for (const d of G.decals) d.t += dt;
  G.decals = G.decals.filter(d => d.t < d.life);
  G.shakeT = Math.max(0, G.shakeT - dt);
  G.ambT -= dt;
  if (G.ambT <= 0) { // havada süzülen polen / ateş böcekleri / kar taneleri / kor
    const th = THEMES[G.lv.theme];
    if (th.snow) {
      G.ambT = 0.06;
      emit(G.parts, { kind: 'glow', x: rand(-40, W), y: -10, vx: rand(8, 22), vy: rand(22, 40), col: '255,255,255', s0: rand(1.6, 3), s1: 1.4, life: rand(10, 14), a: 0.9 });
    } else if (th.embers) {
      G.ambT = 0.12;
      emit(G.parts, { kind: 'glow', add: true, x: rand(0, W), y: H + 5, vx: rand(-10, 10), vy: -rand(25, 50), col: Math.random() < 0.5 ? '255,120,40' : '255,190,80', s0: rand(1.6, 3), s1: 0.5, life: rand(5, 9), a: 0.9 });
    } else {
      G.ambT = 0.3;
      emit(G.parts, { kind: 'glow', add: true, x: rand(0, W), y: rand(70, H), vx: rand(-7, 7), vy: rand(-9, -2),
        col: th.amb || (G.lv.theme === 'forest' ? '200,255,150' : '255,245,190'), s0: rand(2, 3.4), s1: 1, life: rand(3, 5), a: 0.75, fadeIn: 0.3 });
    }
  }
  for (const f of G.floaters) { f.t += dt; f.y -= 22 * dt; }
  G.floaters = G.floaters.filter(f => f.t < 1.1);

  if (G.lives <= 0 && !overlay) { setOverlay('lose'); sfx('lose'); }
  if (!overlay && G.wave >= G.lv.waves.length && G.spawners.length === 0 && G.enemies.length === 0) {
    const lr = G.lives / G.maxLives;
    G.stars = lr >= 0.9 ? 3 : lr >= 0.3 ? 2 : 1;
    save.stars[G.idx] = Math.max(save.stars[G.idx] || 0, G.stars);
    persist();
    setOverlay('win');
    sfx('win');
  }
}

// ================= ÇİZİM =================
// Başlıklar ve butonlar için tok bir oyun yazı tipi (Lilita One), metinler için yuvarlak hatlı Baloo 2.
const FONT_T = '"Lilita One", "Arial Black", system-ui, sans-serif';
const FONT_B = '"Baloo 2", system-ui, -apple-system, "Segoe UI", sans-serif';
if (document.fonts && document.fonts.load) {
  document.fonts.load(`40px ${FONT_T}`).catch(() => {});
  document.fonts.load(`800 20px ${FONT_B}`).catch(() => {});
}
let lastFont = '', lastFontNorm = '';
function txt(s, x, y, size, col = '#fff', align = 'center', weight = '800', font = FONT_B, stroke = true) {
  const f = `${weight} ${size}px ${font}`;
  if (f !== lastFont || ctx.font !== lastFontNorm) { ctx.font = f; lastFont = f; lastFontNorm = ctx.font; }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, size / 4.2); ctx.strokeStyle = 'rgba(28,16,6,0.88)';
    ctx.strokeText(s, x, y);
  }
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
// küçük, yuvarlak uçlu (hap biçimli) can barı
function hpBar(x, y, w, frac, col = '#4cd34c') {
  frac = clamp(frac, 0, 1);
  const h = 3.2, r = h / 2 + 1.1;
  roundRect(x - w / 2 - 1.1, y - 1.1, w + 2.2, h + 2.2, r, 'rgba(14,8,3,0.78)');
  roundRect(x - w / 2, y, w, h, h / 2, '#5a1712');
  if (frac > 0) {
    roundRect(x - w / 2, y, Math.max(h, w * frac), h, h / 2, col);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - w / 2 + 1, y + 0.4, Math.max(0, w * frac - 2), h * 0.35);
  }
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

// Kule tepesindeki okçu: gövde, başlık/miğfer, hedef yönüne dönen kollar ve yay; kiriş atıştan önce gerilir
const ARCHER_LOOK = [
  { body: '#3f7a2e', dark: '#24501c', hood: '#4f8f36', trim: '#8a5a2a' },
  { body: '#2f6a2a', dark: '#1c4418', hood: '#3f7e30', trim: '#c9a24a' },
  { body: '#c9302a', dark: '#7a1612', hood: '#e2b13c', trim: '#ffe08a', helm: true },
];
function drawArcher(t, ts, i, a) {
  const o = archerPoint(t, ts, i), s = ts.w / 68, L = ARCHER_LOOK[t.lvl];
  const face = Math.cos(a.ang) >= 0 ? 1 : -1, la = face > 0 ? a.ang : Math.PI - a.ang;
  const bob = a.walk ? Math.abs(Math.sin(a.walk * 10)) * 1.2 : Math.sin(G.t * 2.5 + a.seed) * 0.4;
  const rec = a.fx > 0 ? a.fx / 0.18 : 0; // bırakış sonrası
  ctx.save();
  // bel hizasının altı korkuluğun / mazgalın arkasında kalır
  ctx.beginPath(); ctx.rect(o.x - 14 * s, o.y - 20 * s, 28 * s, 26 * s); ctx.clip();
  ctx.translate(o.x, o.y + 3.5 * s - bob * s); ctx.scale(s * face, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const out = 'rgba(28,16,6,0.95)';
  ctx.fillStyle = L.dark; ctx.strokeStyle = out; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-3, -3); ctx.quadraticCurveTo(-7.5, 3, -5.5, 9); ctx.lineTo(1, 9); ctx.lineTo(2, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.body; ctx.beginPath(); ctx.roundRect(-3.6, -3, 7.2, 11, 2.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.trim; ctx.fillRect(-3.4, 3.4, 6.8, 1.4);
  ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.roundRect(-5.2, -4.5, 2.6, 7, 1); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-4.4, -4.5); ctx.lineTo(-5, -6.5); ctx.moveTo(-3.4, -4.5); ctx.lineTo(-3.4, -6.8); ctx.stroke();
  ctx.strokeStyle = out; ctx.lineWidth = 1.4;
  ctx.fillStyle = '#f2c69a'; ctx.beginPath(); ctx.arc(0.6, -6.2, 3.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.hood; ctx.beginPath();
  if (L.helm) { ctx.arc(0.4, -6.8, 3.6, Math.PI * 1.02, Math.PI * 2.02); ctx.lineTo(4, -6); ctx.lineTo(-3.2, -6); }
  else { ctx.moveTo(-3, -4); ctx.quadraticCurveTo(-4.2, -10.5, 1, -10.2); ctx.quadraticCurveTo(4.6, -9.6, 3.8, -6.6); ctx.quadraticCurveTo(1.6, -7.8, 0.4, -5.4); ctx.quadraticCurveTo(-0.8, -3.8, -3, -4); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (L.helm) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -10.4); ctx.quadraticCurveTo(-3.5, -13, -5.5, -9.5); ctx.quadraticCurveTo(-3, -11, 0, -10.4); ctx.fill(); }
  circle(2.3, -6.3, 0.55, '#1a0e04');
  ctx.save(); ctx.translate(0.5, -1.2); ctx.rotate(la);
  const R = 5.4, dr = a.draw * 3.6 - rec * 0.6;
  const tipX = Math.cos(1.15) * R, tipY = Math.sin(1.15) * R;
  const arm = (x0, x1, col) => { ctx.strokeStyle = out; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke(); };
  arm(0, tipX - dr, L.body);
  arm(0, R - 0.6, '#f2c69a');
  ctx.strokeStyle = out; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, R, -1.15, 1.15); ctx.stroke();
  ctx.strokeStyle = t.lvl >= 2 ? '#e8b440' : '#a8743a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, R, -1.15, 1.15); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,225,0.9)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(tipX, -tipY); ctx.lineTo(tipX - dr, 0); ctx.lineTo(tipX, tipY); ctx.stroke();
  if (a.fx <= 0.08) {
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(tipX - dr, 0); ctx.lineTo(R + 2.2, 0); ctx.stroke();
    ctx.fillStyle = '#e8ecf2'; ctx.beginPath(); ctx.moveTo(R + 3.4, 0); ctx.lineTo(R + 1.8, -1); ctx.lineTo(R + 1.8, 1); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  if (rec > 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const bp = bowPoint(t, ts, i); glow(ctx, bp.x, bp.y, 5 * rec, '255,245,200', rec * 0.8); ctx.restore(); }
}

function drawTower(t) {
  const ts = towerSprite(t);
  if (ts) {
    const age = G.t - (t.born ?? -9);
    const pop = age < 0.45 ? easeOutBack(clamp(age / 0.45, 0, 1)) : 1; // inşa/yükseltme zıplaması
    // top: ateşte önce sert geri teper (kule namlunun tersine kayar ve ezilir), sonra yaylanarak yerine döner
    let kx = 0, ksx = 1, ksy = 1;
    if (t.type === 'artillery' && t.shotAnim > 0) {
      const k = 1 - t.shotAnim / 0.35, e = k < 0.15 ? k / 0.15 : Math.exp(-6 * (k - 0.15)) * Math.cos((k - 0.15) * 14);
      kx = -e * 3 * (t.face || 1); ksx = 1 + e * 0.05; ksy = 1 - e * 0.08;
    }
    const fs = t.type === 'artillery' ? (t.faceS ?? 1) : 1;
    ctx.save(); ctx.translate(t.x + kx, ts.bottom);
    ctx.scale(pop * ksx * (Math.abs(fs) < 0.08 ? 0.08 * Math.sign(fs || 1) : fs), pop * ksy);
    drawSprite(ctx, ts.im, 0, 0, ts.w);
    ctx.restore();
    if (t.type === 'artillery' && t.shotAnim > 0.27) {
      const m = MUZZLE[t.lvl], mx = t.x + kx + (m[0] - 0.5) * ts.w * fs, my = ts.bottom - ts.h + m[1] * ts.h, k = (t.shotAnim - 0.27) / 0.08;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, mx, my, 16 + 10 * k, '255,190,90', k); glow(ctx, mx + 6 * fs, my - 5, 9 * k, '255,250,220', k);
      ctx.restore();
    }
    if (t.type === 'archer' && t.shots && age > 0.3) {
      t.shots.forEach((a, i) => { if (ARCHER_POS[t.lvl][i]) drawArcher(t, ts, i, a); });
    }
    if (t.ab) {
      const ids = t.def.abilities.filter(a => t.ab[a.id]);
      ids.forEach((a, i) => {
        const bx = t.x + (ids.length === 1 ? 0 : i ? 13 : -13), by = t.y + 17;
        circle(bx, by + 1.5, 8.5, 'rgba(0,0,0,0.35)');
        circle(bx, by, 8.5, '#2a1c10', '#e2a93c', 1.6);
        drawAbilityIcon(a.id, bx, by, 0.42);
        for (let k = 0; k < t.ab[a.id]; k++) circle(bx - 4 + k * 4, by + 10, 1.6, '#ffd34d', '#2a1406', 0.8);
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
  const name = 'enemy_' + e.type, im = d.base ? enemySprite(e.type) : spr(name);
  if (im) {
    if (d.chief) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - 2, d.h * 0.9, d.ab && d.ab.blink ? '90,220,230' : '255,70,40', 0.3 + Math.sin(time * 4) * 0.1);
      ctx.restore();
      ctx.strokeStyle = `rgba(255,90,60,${0.6 + Math.sin(time * 5) * 0.2})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, d.h * 0.55, d.h * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawUnit(name, im, e.x, e.y, e.face, {
      rig: d.base ? 'enemy_' + d.base : undefined,
      h: CHAR_H[name] || d.r * 2.6, phase: e.anim * (5 + d.speed / 9),
      walking: !e.blocker && e.siege === undefined && !(e.stun > 0), fly: d.flying ? fly : 0,
      atk: e.siege !== undefined ? e.siege - SIEGE_HIT : e.inMelee ? atkPhase(d.rate, e.atk) : null,
      flash: e.flash, hit: e.hitT, wings: d.flying ? e.anim : null, seed: e.off,
    });
    const top = e.y - fly - (CHAR_H[name] || 20) - 6;
    const fr = e.hp / e.maxHp;
    if (d.chief && im.generated) drawCrown(e.x + e.face * d.h * 0.06, top - 2, d.h / 44, e.face);
    if (e.shieldT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - d.h * 0.5, d.h * 0.85, '110,190,255', 0.55 + Math.sin(time * 12) * 0.1);
      ctx.restore();
      circle(e.x, e.y - d.h * 0.5, d.h * 0.62, null, 'rgba(170,220,255,0.8)', 2);
    }
    if (e.markT > 0) {
      ctx.save(); ctx.translate(e.x, top - 12); ctx.rotate(time * 2);
      circle(0, 0, 6, null, '#ff4a4a', 2); ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-4, 0); ctx.moveTo(4, 0); ctx.lineTo(9, 0); ctx.moveTo(0, -9); ctx.lineTo(0, -4); ctx.moveTo(0, 4); ctx.lineTo(0, 9); ctx.stroke();
      ctx.restore();
    }
    if (!d.chief) hpBar(e.x, top, d.boss ? 30 : 14, fr, d.boss ? '#ff7a3a' : fr > 0.5 ? '#5bd35b' : fr > 0.25 ? '#f2c230' : '#ef4a3a');
    else hpBar(e.x, top + 6, 34, fr, '#ff5a3a');
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
  const name = s.hero ? s.def.sprite : s.militia ? 'militia' : 'soldier';
  let im = s.hero ? heroSprite(s.def) : spr(name), key = name, pad = 0, glowIm = null;
  if (name === 'soldier') { const gs = gearSprite(s.gear || 0); if (gs) { im = gs.im; key = gs.key; pad = gs.pad; glowIm = gs.glow; } }
  if (im) {
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    const ch = s.hero ? s.def.h : CHAR_H[name];
    drawUnit(key, im, s.x, s.y, s.face, {
      h: ch, rig: name, pad, glow: glowIm, phase: s.anim * 9, walking, fly: 0,
      atk: fighting || s.shooting ? atkPhase(s.rate, s.atk) : null, flash: s.flash, seed: (s.slot || 0) * 1.7,
      buff: s.buffT, spin: s.spinT, cast: s.castT, aura: s.hero ? s.def.aura : null,
    });
    if (s.hero) {
      hpBar(s.x, s.y - ch - 7, 18, s.hp / s.maxHp, '#5ad0ff');
      return;
    }
    if (s.hp < s.maxHp || s.hero) hpBar(s.x, s.y - CHAR_H[s.hero ? 'hero' : s.militia ? 'militia' : 'soldier'] - 6, s.hero ? 18 : 11, s.hp / s.maxHp, s.hero ? '#5ad0ff' : '#4cd34c');
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

// ----- karakter animasyonu -----
// Her karakter görseli üç parçaya ayrılır: gövde, arka bacak (sol yarı) ve ön bacak (sağ yarı).
// Yürürken bacaklar sırayla öne savrulup kalkar, gövde adım ortasında yükselip iner ve kalçadan hafif sallanır.
// Saldırı üç evreden oluşur: hazırlık (geriye yaslanma, ön ayağın basması), vuruş (öne atılma + arkada iz) ve toparlanma.
// Yarasada iki kanat gövdenin iki yanından ayrı ayrı çırpar.
const RIG = {
  enemy_goblin: { legY: 0.7 }, enemy_bandit: { legY: 0.72 }, enemy_orc: { legY: 0.7 }, enemy_shaman: { legY: 0.8, stride: 0.55 },
  enemy_knight: { legY: 0.72 }, enemy_troll: { legY: 0.7, stride: 0.8 }, enemy_wolf: { legY: 0.6, stride: 1.25 }, enemy_bat: { wings: true },
  hero: { legY: 0.72 }, soldier: { legY: 0.7 }, militia: { legY: 0.74 },
  hero_caner: { legY: 0.7 }, hero_zeynep: { legY: 0.7 }, hero_cat: { legY: 0.72, stride: 1.15 }, hero_sage: { legY: 0.8, stride: 0.55 },
};
const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function drawRig(im, w, h, legY, P, rig) {
  const mip = pickMip(ctx, im, w), mw = mip.width, mh = mip.height;
  const part = (x0, y0, x1, y1, dx, dy) => ctx.drawImage(mip, x0 * mw, y0 * mh, (x1 - x0) * mw, (y1 - y0) * mh,
    -w / 2 + x0 * w + dx, -h + y0 * h + dy, (x1 - x0) * w, (y1 - y0) * h);
  if (rig.wings) {
    const cy = -h * 0.5, a = P.flap * 0.4;
    for (const [x0, x1, sgn] of [[0, 0.56, -1], [0.44, 1, 1]]) {
      ctx.save(); ctx.translate(0, cy); ctx.rotate(sgn * a); ctx.scale(1, 1 - Math.abs(P.flap) * 0.12); ctx.translate(0, -cy);
      part(x0, 0, x1, 1, 0, 0);
      ctx.restore();
    }
    part(0.36, 0, 0.64, 1, 0, 0); // gövde kanatların üstünde sabit kalır
    return;
  }
  const xs = rig.xs ?? 0.5, ov = 0.1;
  part(0, legY - 0.03, xs + ov, 1, P.stepB * w, -P.liftB * h);          // arka bacak
  part(xs - ov, legY - 0.03, 1, 1, P.stepF * w, -P.liftF * h);          // ön bacak
  const hipY = -h * (1 - legY);
  ctx.save(); ctx.translate(0, hipY + P.bodyDy); ctx.rotate(P.rot); ctx.scale(P.sx, P.sy); ctx.translate(0, -hipY);
  part(0, 0, 1, legY + 0.04, 0, 0);                                      // gövde (kalçadan döner)
  ctx.restore();
}

function drawUnit(name, im, x, y, face, o) {
  const pad = o.pad || 0, h = o.h * (1 + pad), w = h * im.width / im.height;
  const rig = RIG[o.rig || name] || { legY: 0.7 };
  const legY = (rig.legY + pad) / (1 + pad), S = rig.stride ?? 1;
  const P = { rot: 0, sx: 1, sy: 1, bodyDy: 0, stepF: 0, stepB: 0, liftF: 0, liftB: 0, flap: 0 };
  let ox = 0, oy = -o.fly, ghost = 0, glowK = 0;
  if (rig.wings && o.wings != null) {
    P.flap = Math.sin(o.wings * 14); oy -= P.flap * 2.5;
  } else if (o.atk != null && o.atk > -0.3 && o.atk < 0.3) {
    if (o.atk < 0) {
      // hazırlık: silahı kaldırıp geriye yaslanır, ağırlık arka ayağa geçer
      const k = easeInOut((o.atk + 0.3) / 0.3);
      P.rot = -0.3 * k; ox = -2.5 * k; P.sy = 1 + 0.05 * k; P.sx = 1 - 0.03 * k; P.stepF = 0.03 * k; P.stepB = -0.04 * k;
    } else {
      // vuruş: çok hızlı öne savrulur (ilk %25), sonra yavaşça toparlanır
      const k = o.atk / 0.3, e = k < 0.25 ? easeInOut(k / 0.25) : 1 - easeInOut((k - 0.25) / 0.75);
      P.rot = 0.45 * e; ox = 7 * e; P.sx = 1 + 0.07 * e; P.sy = 1 - 0.06 * e; P.stepF = 0.1 * e * S; P.stepB = -0.06 * e * S;
      ghost = k < 0.4 ? 1 - k / 0.4 : 0; glowK = e;
    }
  } else if (o.walking) {
    const p = o.phase, sp = Math.sin(p), cp = Math.cos(p);
    P.stepF = sp * 0.075 * S; P.stepB = -sp * 0.075 * S;
    P.liftF = Math.max(0, cp) * 0.055 * S; P.liftB = Math.max(0, -cp) * 0.055 * S;
    P.bodyDy = -(1 - Math.abs(sp)) * h * 0.03;
    P.rot = 0.05 + Math.sin(p * 2) * 0.02;
    P.sy = 1 + Math.abs(cp) * 0.02;
  } else {
    // dururken nefes alır, ağırlığını hafifçe bir ayaktan diğerine verir
    P.sy = 1 + Math.sin(time * 2.6 + o.seed) * 0.02; P.rot = Math.sin(time * 1.3 + o.seed) * 0.02;
  }
  if (o.cast > 0) {
    // yetenek kullanırken: geriye yaslanıp yükselir, elleri parlar
    const k = Math.sin(clamp(o.cast / 0.45, 0, 1) * Math.PI);
    P.rot = -0.2 * k; P.sy = 1 + 0.09 * k; P.sx = 1 - 0.04 * k; oy -= 4 * k;
  }
  if (o.hit > 0) { const k = o.hit / 0.18; P.rot -= 0.16 * k; ox -= 2 * k; }   // darbe alınca geriye sarsılır
  if (o.spin > 0) P.sx *= Math.cos((0.5 - o.spin) * Math.PI * 6);           // kasırga: hızlı dönüş
  shadow(x, y + 1, w * 0.34 * (o.fly ? 0.7 : 1), w * 0.11);
  if (o.aura) {
    // kahramanın ayağının altında dönen renkli halka
    ctx.save(); ctx.strokeStyle = `rgba(${o.aura},${0.45 + Math.sin(time * 3) * 0.12})`; ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]); ctx.lineDashOffset = -time * 10;
    ctx.beginPath(); ctx.ellipse(x, y + 1.5, w * 0.48, w * 0.17, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (o.buff > 0) {
    ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(time * 8) * 0.15;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(x, y + 1, w * 0.5, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x + ox * face, y + 1 + oy);
  ctx.scale(face, 1);
  if (ghost > 0) {
    // vuruşun hız izi: bir önceki pozun soluk kopyası
    ctx.save(); ctx.globalAlpha *= 0.3 * ghost; ctx.translate(-7, 0);
    drawRig(im, w, h, legY, Object.assign({}, P, { rot: P.rot * 0.35 }), rig);
    ctx.restore();
  }
  drawRig(im, w, h, legY, P, rig);
  if (o.glow) {
    // altın şövalyenin parlayan kılıcı
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 + Math.sin(time * 5 + o.seed) * 0.1 + glowK * 0.5;
    drawRig(o.glow, w, h, legY, P, rig);
    ctx.restore();
  }
  if (o.flash > 0) {
    ctx.globalAlpha = clamp(o.flash / 0.1, 0, 1) * 0.7;
    drawRig(whiteOf(name, im), w, h, legY, P, rig);
  }
  ctx.restore();
  if (o.cast > 0 && o.aura) {
    const k = Math.sin(clamp(o.cast / 0.45, 0, 1) * Math.PI);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x + face * w * 0.15, y - h * 0.62 + oy, 16 * k + 4, o.aura, 0.8 * k);
    ctx.restore();
  }
}

// ----- kahraman görselleri -----
// Komutan kendi görselini kullanır; diğerleri düşman görsellerinden yeniden renklendirilerek üretilir.
function heroSprite(d) {
  if (!d.base) return spr(d.sprite);
  if (SPR[d.sprite]) return SPR[d.sprite];
  const base = spr(d.base);
  if (!base) return null;
  return (SPR[d.sprite] = recolorHero(d.sprite, base));
}
function recolorHero(name, base) {
  const W0 = base.width, H0 = base.height;
  const c = document.createElement('canvas'); c.width = W0; c.height = H0;
  const g = c.getContext('2d'); g.drawImage(base, 0, 0);
  const d = g.getImageData(0, 0, W0, H0), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 10) continue;
    let [h, s, l] = rgb2hsl(a[i], a[i + 1], a[i + 2]);
    const red = (h < 18 || h > 335) && s > 0.35;
    if (name === 'hero_caner') {
      // kara zırh gümüşe, kızıl kumaş ve tüy kraliyet mavisine
      if (red) { h = 214; s = Math.min(1, s * 0.9); l = Math.min(0.75, l * 1.05); }
      else if (s < 0.28 && l > 0.1 && l < 0.6) { h = 214; s = 0.1; l = Math.min(0.93, 0.36 + l * 1.05); }
      else continue;
    } else if (name === 'hero_rogue') {
      // kızıl bandana koyu yeşile, kahverengi yelek ve pantolon is rengine
      if (red) { h = 150; s *= 0.65; l *= 0.75; }
      else if (h > 12 && h < 48 && s > 0.15 && l < 0.42) { h = 160; s = 0.14; l *= 0.85; }
      else continue;
    } else if (name === 'hero_sage') {
      // mor cüppe kızıla, yeşil asa küresi ateşe
      if (h > 245 && h < 325 && s > 0.18) { h = 6; s = Math.min(1, s * 1.25); l = Math.min(0.7, l * 1.08); }
      else if (h > 80 && h < 165 && s > 0.55 && l > 0.5) { h = 30; s = 1; }
      else continue;
    }
    const rgb = hsl2rgb(h, s, l);
    a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2];
  }
  g.putImageData(d, 0, 0);
  if (name === 'hero_caner') {
    // kalkandaki kurukafanın üstüne arma
    const cx = W0 * 0.17, cy = H0 * 0.5, r = W0 * 0.1;
    g.fillStyle = '#2a5fb8'; g.strokeStyle = '#e8c04a'; g.lineWidth = W0 * 0.018;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = W0 * 0.025; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy - r * 0.62); g.lineTo(cx, cy + r * 0.62); g.moveTo(cx - r * 0.5, cy - r * 0.12); g.lineTo(cx + r * 0.5, cy - r * 0.12); g.stroke();
  }
  return c;
}

// ----- kışla askerlerinin zırh kademeleri -----
// Seviye 1: deri/mavi tunik (orijinal görsel). Seviye 2: kızıl tunik, parlak çelik, kırmızı sorguç.
// Seviye 3: fildişi tunik, altın zırh ve kalkan, beyaz sorguç, kızıl pelerin ve parlayan kılıç.
const GEAR = {};
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, hk = h / 360;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(hk + 1 / 3) * 255, f(hk) * 255, f(hk - 1 / 3) * 255];
}
function gearSprite(lvl) {
  const base = spr('soldier');
  if (!base) return null;
  if (lvl <= 0) return { im: base, pad: 0, key: 'soldier' };
  return GEAR[lvl] || (GEAR[lvl] = buildGear(base, lvl));
}
function buildGear(base, lvl) {
  const W0 = base.width, H0 = base.height, P = Math.round(H0 * 0.1);
  const c = document.createElement('canvas'); c.width = W0; c.height = H0 + P;
  const g = c.getContext('2d');
  g.drawImage(base, 0, P);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  const m = document.createElement('canvas'); m.width = c.width; m.height = c.height;
  const mg = m.getContext('2d'), md = mg.createImageData(c.width, c.height);
  let top = c.height, sumX = 0, nX = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < W0; x++) {
    const i = (y * W0 + x) * 4;
    if (a[i + 3] < 10) continue;
    if (y < top) top = y;
    if (y < P + 0.06 * H0) { sumX += x; nX++; }
    let [h, s, l] = rgb2hsl(a[i], a[i + 1], a[i + 2]);
    const cloth = h > 190 && h < 255 && s > 0.22, metal = s < 0.2 && l > 0.32;
    // kılıç ağzı: görselin sol ortasındaki açık renkli metal
    if (lvl >= 2 && metal && l > 0.55 && x < W0 * 0.6 && y > P + H0 * 0.3 && y < P + H0 * 0.68) {
      md.data[i] = 255; md.data[i + 1] = 214; md.data[i + 2] = 120; md.data[i + 3] = a[i + 3];
    }
    if (cloth) {
      if (lvl === 1) { h = 355; s = Math.min(1, s * 1.1); l *= 0.85; } else { h = 42; s = 0.3; l = 0.52 + l * 0.42; }
    } else if (metal) {
      if (lvl === 1) { h = 210; s = 0.1; l = Math.min(0.97, l * 1.08 + 0.02); } else { h = 44; s = 0.78; l = 0.22 + l * 0.62; }
    } else continue;
    const rgb = hsl2rgb(h, s, l);
    a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2];
  }
  g.putImageData(d, 0, 0);
  mg.putImageData(md, 0, 0);
  // miğfer sorguçu (miğferin tepesinden arkaya doğru kavis)
  const cx = nX ? sumX / nX : W0 * 0.44, ty = top + 3;
  const col = lvl === 1 ? ['#ff5a4a', '#a8160e'] : ['#ffffff', '#c9c2b0'];
  g.save(); g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(cx + W0 * 0.1, ty + H0 * 0.035);
  g.quadraticCurveTo(cx + W0 * 0.02, ty - H0 * 0.085, cx - W0 * 0.12, ty - H0 * 0.04);
  g.quadraticCurveTo(cx - W0 * 0.24, ty + H0 * 0.0, cx - W0 * 0.22, ty + H0 * 0.14);
  g.quadraticCurveTo(cx - W0 * 0.16, ty + H0 * 0.06, cx - W0 * 0.1, ty + H0 * 0.05);
  g.quadraticCurveTo(cx - W0 * 0.02, ty + H0 * 0.03, cx + W0 * 0.1, ty + H0 * 0.035);
  g.closePath();
  const pg = g.createLinearGradient(0, ty - H0 * 0.09, 0, ty + H0 * 0.14);
  pg.addColorStop(0, col[0]); pg.addColorStop(1, col[1]);
  g.fillStyle = pg; g.fill();
  g.strokeStyle = '#2a1206'; g.lineWidth = W0 * 0.02; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = W0 * 0.008;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(cx + W0 * (0.06 - k * 0.05), ty + H0 * 0.02); g.quadraticCurveTo(cx - W0 * k * 0.05, ty - H0 * 0.05, cx - W0 * (0.08 + k * 0.04), ty - H0 * 0.02 + k * H0 * 0.03); g.stroke(); }
  g.restore();
  if (lvl >= 2) {
    // pelerin: görselin arkasında kalır, yalnızca kenarları görünür
    g.save(); g.globalCompositeOperation = 'destination-over';
    g.beginPath();
    g.moveTo(W0 * 0.3, P + H0 * 0.3); g.lineTo(W0 * 0.66, P + H0 * 0.3);
    g.quadraticCurveTo(W0 * 0.7, P + H0 * 0.6, W0 * 0.62, P + H0 * 0.86);
    g.quadraticCurveTo(W0 * 0.35, P + H0 * 0.92, W0 * 0.12, P + H0 * 0.84);
    g.quadraticCurveTo(W0 * 0.2, P + H0 * 0.55, W0 * 0.3, P + H0 * 0.3);
    const cg = g.createLinearGradient(0, P + H0 * 0.3, 0, P + H0 * 0.9);
    cg.addColorStop(0, '#d6372c'); cg.addColorStop(1, '#6a0e0a');
    g.fillStyle = cg; g.fill(); g.strokeStyle = '#2a0804'; g.lineWidth = W0 * 0.02; g.stroke();
    g.restore();
  }
  return { im: c, pad: P / H0, key: 'soldier_g' + lvl, glow: lvl >= 2 ? m : null };
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
  const { x, y } = projPos(p, k);
  if (p.kind === 'rainarrow') {
    const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255,250,230,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-8, 0); ctx.stroke();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = '#d8dbe2'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.2); ctx.lineTo(3, 2.2); ctx.fill();
    ctx.restore();
    return;
  }
  if (p.kind === 'arrow' || p.kind === 'harrow') {
    const n = projPos(p, k + 0.05), a = Math.atan2(n.y - y, n.x - x), tl = projPos(p, k - 0.14);
    ctx.strokeStyle = 'rgba(255,250,230,0.35)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-11, -2.6); ctx.lineTo(-6, 0); ctx.lineTo(-11, 2.6); ctx.fill();
    ctx.fillStyle = '#d8dbe2'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.4); ctx.lineTo(3, 2.4); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'bolt') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, 18, '170,100,255', 0.9);
    glow(ctx, x, y, 8, '255,240,255', 1);
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
    ctx.restore();
  } else if (p.kind === 'dagger') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 22);
    ctx.fillStyle = '#e8ecf4'; ctx.strokeStyle = '#2a2e38'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.lineTo(0, -7); ctx.lineTo(1.6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    roundRect(-2.6, 0, 5.2, 1.6, 0.8, '#c9a24a'); roundRect(-1, 1.4, 2, 3.4, 0.8, '#4a2e18');
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 7, '200,255,200', 0.35); ctx.restore();
  } else if (p.kind === 'fireball') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, 16, '255,120,40', 0.9); glow(ctx, x, y, 7, '255,240,190', 1);
    ctx.restore();
  } else if (p.kind === 'shell') {
    const gx = lerp(p.sx, p.tx, k), gy = lerp(p.gy ?? p.sy + 40, p.ty, k), hgt = 1 - Math.sin(k * Math.PI);
    ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.15 * hgt})`;
    ctx.beginPath(); ctx.ellipse(gx, gy, 3 + 2 * hgt, 1.5 + hgt, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5);
    g.addColorStop(0, '#8a8d98'); g.addColorStop(1, '#141418');
    circle(x, y, 5, g, '#000', 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + 3, y - 4, 5, '255,190,90', 0.8 + Math.sin(time * 40) * 0.2); ctx.restore();
  } else if (p.kind === 'meteor') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, 30, '255,130,40', 0.9);
    glow(ctx, x, y, 12, '255,240,200', 1);
    ctx.restore();
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
    g.addColorStop(0, '#ffe2a0'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, '#8a2a10');
    circle(x, y, 7.5, g);
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
    const bc = f.col === 'arcane' ? 'rgba(190,120,255,0.55)' : f.col === 'frost' ? 'rgba(140,210,255,0.55)' : f.col === 'holy' ? 'rgba(255,235,160,0.6)' : 'rgba(140,180,255,0.5)';
    for (const [lw, col] of [[6, bc], [2.2, '#f2f7ff']]) {
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
  } else if (f.kind === 'pillar') {
    const a = Math.sin(k * Math.PI), w = f.small ? 10 : 18, hh = f.small ? 60 : 120;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, f.y - hh, 0, f.y);
    g.addColorStop(0, `rgba(${f.col},0)`); g.addColorStop(1, `rgba(${f.col},${0.65 * a})`);
    ctx.fillStyle = g; ctx.fillRect(f.x - w * (1 - k * 0.4), f.y - hh, w * 2 * (1 - k * 0.4), hh);
    glow(ctx, f.x, f.y - 4, w * 2, f.col, 0.7 * a);
    ctx.restore();
  } else if (f.kind === 'dash') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${f.col},0.5)`; ctx.lineWidth = 14 * (1 - k);
    ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
    ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 3 * (1 - k);
    ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'snipe') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 5 * (1 - k) + 1;
    ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
    ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'shock') {
    const e = 1 - Math.pow(1 - k, 3), r = f.r * (0.2 + 0.8 * e);
    ctx.save(); ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = '#fff1cc'; ctx.lineWidth = 5 * (1 - k) + 0.6;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'heal') {
    ctx.globalAlpha = 1 - k; txt('+', f.x, f.y - 20 - k * 12, 14, '#7cff7c'); ctx.globalAlpha = 1;
  }
}

// ---------- arayüz bileşenleri ----------
// Butonlar her karede yeniden çizilir ve `buttons` listesine kaydolur. Dokununca buton basılı görünür
// (içeri çöker), parmak kalkınca yaylanarak eski boyuna döner ve işlevi çalışır (mobil oyunlardaki gibi).
const buttons = [];
const press = { key: null, t: 0, b: null, id: null };
const pops = {}; // anahtar -> bırakıldığı an (yaylanma animasyonu)
function pressScale(key) {
  if (press.key === key) return 1 - 0.09 * clamp((time - press.t) / 0.07, 0, 1);
  const r = pops[key];
  if (r != null) {
    const k = (time - r) / 0.45;
    if (k < 1) return 1 - 0.09 * Math.exp(-5 * k) * Math.cos(k * 15);
    delete pops[key];
  }
  return 1;
}
const tapPop = (key) => { pops[key] = time; };

// Ekran geçişi: kısa bir kararma, ortasında ekran değişir
let trans = null;
function go(fn) {
  if (trans) return;
  trans = { t: 0, fn, fired: false };
}

// renk takımları: [üst, alt, dudak, dış çizgi]
const STYLES = {
  green: ['#a8ef72', '#4caf33', '#2d7a1c', '#173f0c'],
  gold:  ['#ffe592', '#f0ad32', '#b26d14', '#5e3608'],
  red:   ['#ff8f70', '#d8463a', '#93281e', '#4e110b'],
  blue:  ['#93d4ff', '#3d8de0', '#2858a0', '#132d5a'],
  wood:  ['#cf9f66', '#8c5f34', '#5a391b', '#2e1b0b'],
  dark:  ['#6a5644', '#2c2118', '#1a120b', '#0c0805'],
};

function gameButton(key, x, y, w, h, label, fn, style = 'gold', o = {}) {
  const appear = o.appear == null ? 1 : easeOutBack(clamp(o.appear / 0.35, 0, 1));
  if (appear <= 0.01) return;
  const c = STYLES[style], down = press.key === key;
  const sc = pressScale(key) * appear * (o.breathe ? 1 + Math.sin(time * 3.2) * 0.025 : 1);
  const lip = 6, dy = down ? lip - 2 : 0, r = Math.min(18, h / 2.4);
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  if (o.glow) glow(ctx, 0, 0, w * 0.75, o.glow, 0.35 + Math.sin(time * 4) * 0.12);
  roundRect(-w / 2 + 2, -h / 2 + lip + 5, w - 4, h, r, 'rgba(0,0,0,0.35)');
  roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + lip + 6, r + 3, c[3]);
  roundRect(-w / 2, -h / 2 + lip, w, h, r, c[2]);
  const g = ctx.createLinearGradient(0, -h / 2 + dy, 0, h / 2 + dy);
  g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  roundRect(-w / 2, -h / 2 + dy, w, h, r, g);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + dy, w, h, r); ctx.clip();
  const gl = ctx.createLinearGradient(0, -h / 2 + dy, 0, dy);
  gl.addColorStop(0, 'rgba(255,255,255,0.5)'); gl.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.roundRect(-w / 2 + 5, -h / 2 + dy + 3, w - 10, h * 0.44, r - 4); ctx.fill();
  if (o.shine) {
    const ph = (time * 0.42) % 1.7;
    if (ph < 1) {
      const sx = -w / 2 - 40 + ph * (w + 80);
      const sg = ctx.createLinearGradient(sx - 26, 0, sx + 26, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2 + dy, w, h);
    }
  }
  ctx.restore();
  roundRect(-w / 2 + 1.5, -h / 2 + dy + 1.5, w - 3, h - 3, r - 1.5, null, 'rgba(255,255,255,0.35)', 1.5);
  const size = o.size || Math.round(h * 0.44);
  if (o.icon) {
    const iw = h * 0.5;
    ctx.font = `${size}px ${FONT_T}`;
    const tw = label ? ctx.measureText(label).width : 0, gap = label ? 9 : 0, total = iw + gap + tw;
    drawIcon(o.icon, -total / 2 + iw / 2, dy, iw);
    if (label) txt(label, -total / 2 + iw + gap + tw / 2, dy + 1, size, '#fff', 'center', '400', FONT_T);
  } else {
    txt(label, 0, dy + 1, size, '#fff', 'center', '400', FONT_T);
  }
  ctx.restore();
  if (fn && o.reg !== false) buttons.push({ key, x: x - w / 2, y: y - h / 2, w, h: h + lip, fn });
}

// yuvarlak 3B buton; fn yoksa (oyun içi HUD) dokunma playTap'te ayrıca yakalanır
function roundBtn(key, x, y, r, icon, fn, o = {}) {
  const appear = o.appear == null ? 1 : easeOutBack(clamp(o.appear / 0.35, 0, 1));
  if (appear <= 0.01) return;
  const c = STYLES[o.style || 'wood'];
  ctx.save(); ctx.translate(x, y); const sc = pressScale(key) * appear; ctx.scale(sc, sc);
  if (o.active) glow(ctx, 0, 0, r * 2.2, o.activeCol || '255,220,120', 0.55 + Math.sin(time * 6) * 0.15);
  circle(0, 5, r + 3, 'rgba(0,0,0,0.35)');
  circle(0, 0, r + 3, c[3]);
  circle(0, 3, r, c[2]);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  circle(0, 0, r, g);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.45, r * 0.66, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  circle(0, 0, r - 1, null, 'rgba(255,255,255,0.3)', 1.2);
  if (typeof icon === 'function') icon(r); else drawIcon(icon, 0, 0, r * 1.05);
  ctx.restore();
  if (fn) buttons.push({ key, x: x - r - 6, y: y - r - 6, w: 2 * r + 12, h: 2 * r + 12, fn });
}

// tahta çerçeveli parşömen panel
function panel(x, y, w, h) {
  roundRect(x + 4, y + 10, w, h, 24, 'rgba(0,0,0,0.45)');
  const fr = ctx.createLinearGradient(0, y, 0, y + h);
  fr.addColorStop(0, '#a87442'); fr.addColorStop(1, '#4e2f16');
  roundRect(x, y, w, h, 24, fr, '#22120a', 3);
  roundRect(x + 4, y + 4, w - 8, h - 8, 20, null, 'rgba(255,220,160,0.25)', 1.5);
  const inner = ctx.createLinearGradient(0, y + 14, 0, y + h - 14);
  inner.addColorStop(0, '#f8ebcc'); inner.addColorStop(1, '#e0c68f');
  roundRect(x + 14, y + 14, w - 28, h - 28, 14, inner, 'rgba(92,58,22,0.65)', 2);
  const vg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(150,100,40,0)'); vg.addColorStop(1, 'rgba(150,100,40,0.28)');
  roundRect(x + 14, y + 14, w - 28, h - 28, 14, vg);
  for (const [cx, cy] of [[x + 13, y + 13], [x + w - 13, y + 13], [x + 13, y + h - 13], [x + w - 13, y + h - 13]]) {
    const g = ctx.createRadialGradient(cx - 2, cy - 2, 0.5, cx, cy, 6.5);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#a8741c');
    circle(cx, cy, 6, g, '#3a2208', 1.5);
  }
}

const RIBBON = { red: ['#ef5b4c', '#a92a1f', '#6a140b'], green: ['#76d050', '#3b8c26', '#1d5011'], blue: ['#5fb2ff', '#2f6fc8', '#173f7a'], gold: ['#ffd968', '#d6921f', '#7a4a0a'] };
function ribbon(cx, cy, w, text, col = 'red', size = 26) {
  const c = RIBBON[col], h = size * 1.75, t = h * 0.7;
  for (const sd of [-1, 1]) {
    const ex = cx + sd * (w / 2 + t), ix = cx + sd * (w / 2 - 6);
    ctx.fillStyle = c[1];
    ctx.beginPath();
    ctx.moveTo(ix, cy - h / 2 + 10); ctx.lineTo(ex, cy - h / 2 + 10); ctx.lineTo(ex - sd * t * 0.45, cy + 10); ctx.lineTo(ex, cy + h / 2 + 10); ctx.lineTo(ix, cy + h / 2 + 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,10,4,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = c[2];
    ctx.beginPath(); ctx.moveTo(cx + sd * (w / 2), cy + h / 2); ctx.lineTo(ix, cy + h / 2 + 10); ctx.lineTo(cx + sd * (w / 2), cy + h / 2 + 10); ctx.closePath(); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  roundRect(cx - w / 2, cy - h / 2, w, h, 5, g, 'rgba(40,10,4,0.85)', 2.5);
  ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 + 6, cy - h / 2 + 5); ctx.lineTo(cx + w / 2 - 6, cy - h / 2 + 5);
  ctx.moveTo(cx - w / 2 + 6, cy + h / 2 - 5); ctx.lineTo(cx + w / 2 - 6, cy + h / 2 - 5); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h * 0.35);
  txt(text, cx, cy + 1, size, '#fff', 'center', '400', FONT_T);
}

// yüzey üzerinde altın yıldız (boşsa koyu yuva)
function starShape(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function drawStar(x, y, r, col, stroke = 'rgba(0,0,0,0.5)', lw = 1.5) {
  ctx.lineJoin = 'round';
  starShape(x, y, r); ctx.fillStyle = col; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function fancyStar(x, y, r, filled) {
  ctx.lineJoin = 'round';
  if (!filled) {
    starShape(x, y + 2, r); ctx.fillStyle = 'rgba(80,48,18,0.28)'; ctx.fill();
    ctx.strokeStyle = 'rgba(80,48,18,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    return;
  }
  starShape(x, y + 3, r); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  starShape(x, y, r);
  ctx.strokeStyle = '#5a3206'; ctx.lineWidth = Math.max(2.5, r * 0.18); ctx.stroke();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, '#fff6b8'); g.addColorStop(0.5, '#ffd03a'); g.addColorStop(1, '#e08a12');
  ctx.fillStyle = g; ctx.fill();
  starShape(x - r * 0.08, y - r * 0.12, r * 0.5); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
}

function sunburst(x, y, r, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(time * 0.25); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * Math.PI / 6, i * Math.PI / 6 + 0.24); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// vektör ikonlar (beyaz dolgu, koyu kontur); s ≈ ikonun boyu
function drawIcon(name, x, y, s, col = '#fff') {
  ctx.save(); ctx.translate(x, y); const k = s / 24; ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fs = (fill = col, lw = 4) => { ctx.strokeStyle = 'rgba(28,15,5,0.9)'; ctx.lineWidth = lw; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); };
  const line = (lw = 3, c = col) => { ctx.strokeStyle = 'rgba(28,15,5,0.9)'; ctx.lineWidth = lw + 3; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); };
  ctx.beginPath();
  switch (name) {
    case 'play': ctx.moveTo(-6, -9); ctx.lineTo(9, 0); ctx.lineTo(-6, 9); ctx.closePath(); fs(); break;
    case 'next': case 'fast':
      ctx.moveTo(-10, -8); ctx.lineTo(-1, 0); ctx.lineTo(-10, 8); ctx.closePath();
      ctx.moveTo(0, -8); ctx.lineTo(9, 0); ctx.lineTo(0, 8); ctx.closePath(); fs(); break;
    case 'pause': ctx.roundRect(-7.5, -8.5, 5.5, 17, 1.5); ctx.roundRect(2, -8.5, 5.5, 17, 1.5); fs(); break;
    case 'restart':
      ctx.arc(0, 1, 7.5, -2.3, 2.6); line(3.4);
      ctx.beginPath(); ctx.moveTo(-9.5, -9); ctx.lineTo(-3, -8); ctx.lineTo(-7.5, -2.5); ctx.closePath(); fs(col, 3); break;
    case 'map':
      ctx.moveTo(-10, -7); ctx.lineTo(-3.5, -9.5); ctx.lineTo(3.5, -7); ctx.lineTo(10, -9.5); ctx.lineTo(10, 7); ctx.lineTo(3.5, 9.5); ctx.lineTo(-3.5, 7); ctx.lineTo(-10, 9.5); ctx.closePath();
      fs('#f6e6bc');
      ctx.beginPath(); ctx.moveTo(-3.5, -9.5); ctx.lineTo(-3.5, 7); ctx.moveTo(3.5, -7); ctx.lineTo(3.5, 9.5);
      ctx.strokeStyle = 'rgba(120,80,30,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(6.5, -1, 2, 0, Math.PI * 2); ctx.fillStyle = '#d9453a'; ctx.fill(); break;
    case 'back': ctx.moveTo(-10, 0); ctx.lineTo(-1, -9); ctx.lineTo(-1, -4); ctx.lineTo(9, -4); ctx.lineTo(9, 4); ctx.lineTo(-1, 4); ctx.lineTo(-1, 9); ctx.closePath(); fs(); break;
    case 'sound': case 'mute':
      ctx.moveTo(-10, -4); ctx.lineTo(-5, -4); ctx.lineTo(1, -9.5); ctx.lineTo(1, 9.5); ctx.lineTo(-5, 4); ctx.lineTo(-10, 4); ctx.closePath(); fs();
      ctx.beginPath();
      if (name === 'sound') { ctx.arc(2, 0, 5, -0.8, 0.8); ctx.moveTo(2 + 9 * Math.cos(-0.8), 9 * Math.sin(-0.8)); ctx.arc(2, 0, 9, -0.8, 0.8); line(2.2); }
      else { ctx.moveTo(4.5, -4.5); ctx.lineTo(11, 4.5); ctx.moveTo(11, -4.5); ctx.lineTo(4.5, 4.5); line(2.6, '#ff7a6a'); }
      break;
    case 'heart':
      ctx.moveTo(0, 9); ctx.bezierCurveTo(-13, 0, -10, -11, 0, -4); ctx.bezierCurveTo(10, -11, 13, 0, 0, 9); fs('#ff4f5e', 3.5);
      ctx.beginPath(); ctx.ellipse(-4.5, -3.5, 2.5, 1.6, -0.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill(); break;
    case 'coin': {
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffcc33'); g.addColorStop(1, '#c98410');
      fs(g, 3);
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(150,90,10,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-3, -4, 2.6, 1.5, -0.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill(); break;
    }
    case 'skull':
      ctx.arc(0, -2, 9, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(5, 9); ctx.lineTo(-5, 9); ctx.closePath(); fs('#f4efe2', 3);
      ctx.beginPath(); ctx.ellipse(-3.6, -1.5, 2.8, 3.2, 0, 0, Math.PI * 2); ctx.ellipse(3.6, -1.5, 2.8, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3a0c08'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, 9); ctx.lineTo(-2, 5.5); ctx.moveTo(2, 9); ctx.lineTo(2, 5.5); ctx.strokeStyle = '#3a0c08'; ctx.lineWidth = 1.3; ctx.stroke(); break;
    case 'lock': {
      ctx.arc(0, -3, 6, Math.PI, 0); line(3.2, '#d8d8de');
      ctx.beginPath(); ctx.roundRect(-9, -3, 18, 14, 3);
      const g = ctx.createLinearGradient(0, -3, 0, 11); g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#c8861a');
      fs(g, 3);
      ctx.beginPath(); ctx.arc(0, 3, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#4a2a08'; ctx.fill(); break;
    }
    case 'check': ctx.moveTo(-6, 0); ctx.lineTo(-1.5, 5); ctx.lineTo(7, -5); line(3.2); break;
    case 'close': ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); line(3.4); break;
    case 'crown':
      ctx.moveTo(-10, 7); ctx.lineTo(-11, -6); ctx.lineTo(-5, -1); ctx.lineTo(0, -9); ctx.lineTo(5, -1); ctx.lineTo(11, -6); ctx.lineTo(10, 7); ctx.closePath();
      fs('#ffd34d', 3.5);
      ctx.beginPath(); ctx.arc(0, 2, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#e8434b'; ctx.fill(); break;
  }
  ctx.restore();
}

function logo(s, x, y, size) {
  ctx.font = `${size}px ${FONT_T}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(s, x + 3, y + 8);
  ctx.strokeStyle = '#2a1404'; ctx.lineWidth = size * 0.24; ctx.strokeText(s, x, y);
  ctx.strokeStyle = '#94501a'; ctx.lineWidth = size * 0.11; ctx.strokeText(s, x, y);
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, '#fffbe2'); g.addColorStop(0.45, '#ffd84a'); g.addColorStop(0.56, '#f4b11f'); g.addColorStop(1, '#d7701a');
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width, ph = (time * 0.33) % 1.9 - 0.3;
  if (ph > -0.2 && ph < 1.2) {
    const sx = x - w / 2 + ph * w, sg = ctx.createLinearGradient(sx - 45, 0, sx + 45, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.8)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillText(s, x, y);
  }
}

// ---------- menüler (halka menü) ----------
// Arsa ya da kule seçilince öğeler merkezden yaylanarak sırayla açılır, seçim kalkınca içeri toplanıp kapanır.
const MENU_R = 25;
function plotMenuItems(pl) {
  const offs = [[-48, -44], [48, -44], [-48, 44], [48, 44]];
  return TOWER_ORDER.map((type, i) => ({ id: 'build', type, x: pl.x + offs[i][0], y: pl.y - 16 + offs[i][1], cost: TOWERS[type].levels[0].cost }));
}
function towerMenuItems(t) {
  const items = [];
  if (t.lvl < t.def.levels.length - 1) items.push({ id: 'upgrade', x: t.x, y: t.y - 82, cost: t.def.levels[t.lvl + 1].cost });
  else {
    // son seviye: iki yetenek, her biri 3 kademe geliştirilebilir
    t.def.abilities.forEach((a, i) => {
      const r = (t.ab && t.ab[a.id]) || 0;
      items.push({ id: 'ability', type: a.id, ab: a, rank: r, x: t.x + (i ? 44 : -44), y: t.y - 76, cost: r < a.ranks.length ? a.ranks[r].cost : null });
    });
  }
  items.push({ id: 'sell', x: t.x, y: t.y + 40, refund: Math.floor(t.spent * SELL_RATIO) });
  if (t.type === 'barracks') items.push({ id: 'rally', x: t.x + 60, y: t.y - 20 });
  return items;
}
// menüyü ekran içinde tutmak için kaydırma
function menuLayout(sel = G.sel) {
  if (!sel || (sel.kind !== 'plot' && sel.kind !== 'tower')) return { items: [], cx: 0, cy: 0 };
  let items, cx, cy;
  if (sel.kind === 'plot') { items = plotMenuItems(sel.plot); cx = sel.plot.x; cy = sel.plot.y - 16; }
  else { items = towerMenuItems(sel.tower); cx = sel.tower.x; cy = sel.tower.y - 20; }
  const xs = items.map(i => i.x), ys = items.map(i => i.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = minX < 32 ? 32 - minX : maxX > W - 32 ? W - 32 - maxX : 0;
  const dy = minY < 32 ? 32 - minY : maxY > H - 48 ? H - 48 - maxY : 0;
  for (const it of items) { it.x += dx; it.y += dy; }
  return { items, cx: cx + dx, cy: cy + dy };
}
function currentMenu() { return menuLayout().items; }
function itemAffordable(it) { return it.cost == null || G.gold >= it.cost; }

// seçim değişince menünün kapanış animasyonu için eski hali saklanır
function setSel(sel) {
  const old = G.sel;
  const same = old && sel && old.kind === sel.kind && old.plot === sel.plot && old.tower === sel.tower && old.hero === sel.hero;
  if (same) return;
  if (old && (old.kind === 'plot' || old.kind === 'tower')) G.menuClose = { layout: menuLayout(old), t: time, preview: G.preview };
  G.sel = sel; G.preview = null; G.menuT = time;
}

function drawMenu() {
  if (G.menuClose) {
    const k = (time - G.menuClose.t) / 0.16;
    if (k >= 1) G.menuClose = null;
    else drawMenuLayout(G.menuClose.layout, 1 - k, true, G.menuClose.preview);
  }
  if (!G.sel) return;
  // menzil önizleme
  if (G.sel.kind === 'tower') {
    const t = G.sel.tower;
    let rangeShow = t.def.levels[t.lvl].range;
    if (G.preview && G.preview.id === 'upgrade') rangeShow = t.def.levels[t.lvl + 1].range;
    drawRange(t.x, t.y - (t.type === 'barracks' ? 0 : 10), rangeShow * Math.min(1, easeOutBack(clamp((time - G.menuT) / 0.3, 0, 1))), t.type === 'barracks');
    if (t.type === 'barracks') drawRally(t.rx, t.ry);
  } else if (G.preview && G.preview.id === 'build') {
    const pl = G.sel.plot;
    drawRange(pl.x, pl.y - 10, TOWERS[G.preview.type].levels[0].range, G.preview.type === 'barracks');
  }
  if (G.sel.kind !== 'plot' && G.sel.kind !== 'tower') return;
  drawMenuLayout(menuLayout(), time - G.menuT, false, G.preview);
}

function drawMenuLayout(L, k, closing, preview) {
  const { items, cx, cy } = L;
  const rk = closing ? k : clamp(k / 0.22, 0, 1);
  const rs = closing ? 0.8 + 0.2 * k : 0.55 + 0.45 * easeOutBack(rk);
  ctx.save(); ctx.globalAlpha = rk; ctx.translate(cx, cy); ctx.scale(rs, rs);
  const bg = ctx.createRadialGradient(0, 0, 20, 0, 0, 74);
  bg.addColorStop(0, 'rgba(20,12,4,0.05)'); bg.addColorStop(0.75, 'rgba(20,12,4,0.22)'); bg.addColorStop(1, 'rgba(20,12,4,0)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 74, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,18,6,0.5)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,226,150,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -time * 16;
  ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  items.forEach((it, i) => {
    let e, a;
    if (closing) { e = k * k; a = k; }
    else { const p = clamp((k - i * 0.045) / 0.3, 0, 1); e = easeOutBack(p); a = clamp(p * 2.5, 0, 1); }
    if (a <= 0.01) return;
    drawMenuItem(it, lerp(cx, it.x, e), lerp(cy, it.y, e), 0.3 + 0.7 * e, a, preview);
  });
}

function drawMenuItem(it, x, y, sc, a, preview) {
  const ok = itemAffordable(it), R = MENU_R;
  const active = preview && preview.id === it.id && preview.type === it.type;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  const s = sc * pressScale('mi' + it.id + (it.type || '')) * (active ? 1.07 + Math.sin(time * 6) * 0.025 : 1);
  ctx.scale(s, s);
  if (active) glow(ctx, 0, 0, R * 2.2, '255,215,110', 0.6);
  circle(0, 5, R + 3, 'rgba(0,0,0,0.38)');
  const rim = ctx.createLinearGradient(0, -R, 0, R);
  rim.addColorStop(0, '#fff2b8'); rim.addColorStop(0.45, '#e2a93c'); rim.addColorStop(1, '#7a4c10');
  circle(0, 0, R + 3.5, rim, '#2e1a06', 1.5);
  const body = ctx.createRadialGradient(-7, -9, 2, 0, 0, R + 2);
  body.addColorStop(0, active ? '#fff6d0' : '#7d664b'); body.addColorStop(1, active ? '#d99a2a' : '#271b10');
  circle(0, 0, R, body);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, Math.PI * 2); ctx.clip();
  if (!ok) ctx.globalAlpha = a * 0.45;
  if (it.id === 'build') {
    const im = spr(`tower_${it.type}_1`);
    if (im) drawSprite(ctx, im, 0, R - 2, 42 * im.width / im.height);
    else drawTowerShape(it.type, 0, 12, 0, 0.46);
  } else if (it.id === 'upgrade') {
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 0); ctx.lineTo(5, 0); ctx.lineTo(5, 12); ctx.lineTo(-5, 12); ctx.lineTo(-5, 0); ctx.lineTo(-12, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -14, 0, 12); g.addColorStop(0, '#d4ff9a'); g.addColorStop(1, '#3a9a22');
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#123a08'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
  } else if (it.id === 'ability') {
    drawAbilityIcon(it.type, 0, -1, 1);
  } else if (it.id === 'max') {
    fancyStar(0, -3, 13, true);
    txt('MAX', 0, 12, 10, '#fff', 'center', '400', FONT_T);
  } else if (it.id === 'sell') {
    drawIcon('coin', -4, 3, 17); drawIcon('coin', 4, -3, 19);
  } else if (it.id === 'rally') {
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(-5, -12); ctx.stroke();
    const w = Math.sin(time * 6) * 2;
    ctx.fillStyle = '#3f86e8'; ctx.strokeStyle = '#102a55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-5, -12); ctx.quadraticCurveTo(3, -12 + w, 11, -7); ctx.quadraticCurveTo(3, -4 - w, -5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.ellipse(0, -R * 0.5, R * 0.62, R * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  if (it.id === 'ability') {
    for (let i = 0; i < it.ab.ranks.length; i++) {
      const px = (i - 1) * 9, py = -R - 2;
      circle(px, py, 3.6, i < it.rank ? '#ffd34d' : '#3a2a1a', '#1a0e04', 1.2);
    }
    if (it.cost == null) { roundRect(-22, R + 0.5, 44, 17, 8.5, 'rgba(24,15,7,0.94)', '#e8bb4a', 1.6); txt('MAX', 0, R + 9.5, 12, '#ffe27a', 'center', '400', FONT_T); }
  }
  if (it.cost != null || it.refund != null) {
    const label = it.cost != null ? it.cost + '' : '+' + it.refund, tw = 50, ty = R + 9;
    roundRect(-tw / 2, ty - 9.5, tw, 19, 9.5, 'rgba(24,15,7,0.94)', ok ? '#e8bb4a' : '#d9453a', 1.8);
    drawIcon('coin', -tw / 2 + 10, ty, 12);
    txt(label, 6, ty + 1, 13, ok ? '#ffe9a0' : '#ff8070', 'center', '400', FONT_T);
  }
  if (active) {
    circle(R * 0.74, -R * 0.74, 9.5, '#3cbf3c', '#fff', 2);
    drawIcon('check', R * 0.74, -R * 0.74, 12);
  }
  ctx.restore();
}

// kule yeteneklerinin ikonları (menü düğmesinde ve kule altındaki rozetlerde)
function drawAbilityIcon(id, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const dark = 'rgba(20,10,4,0.9)';
  if (id === 'poison') {
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.bezierCurveTo(8, -2, 9, 4, 0, 10); ctx.bezierCurveTo(-9, 4, -8, -2, 0, -12);
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#7be04a'; ctx.fill();
    circle(-3, 1, 2.4, 'rgba(255,255,255,0.6)');
  } else if (id === 'snipe') {
    circle(0, 0, 10, null, dark, 5); circle(0, 0, 10, null, '#ff6a4a', 2.5);
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 0); ctx.moveTo(4, 0); ctx.lineTo(14, 0); ctx.moveTo(0, -14); ctx.lineTo(0, -4); ctx.moveTo(0, 4); ctx.lineTo(0, 14);
    ctx.strokeStyle = dark; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    circle(0, 0, 2.2, '#ff6a4a');
  } else if (id === 'frost') {
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.moveTo(-4, -9); ctx.lineTo(0, -6); ctx.lineTo(4, -9); ctx.moveTo(-4, 9); ctx.lineTo(0, 6); ctx.lineTo(4, 9);
      ctx.strokeStyle = dark; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'blast') {
    starShape(0, 0, 13); ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 13); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#d29aff'); g.addColorStop(1, '#7a3ad8');
    ctx.fillStyle = g; ctx.fill();
  } else if (id === 'napalm') {
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.bezierCurveTo(9, -4, 10, 4, 6, 9); ctx.quadraticCurveTo(0, 13, -6, 9); ctx.bezierCurveTo(-10, 4, -6, -3, -2, -5); ctx.quadraticCurveTo(-1, -9, 0, -13);
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    const g = ctx.createLinearGradient(0, -13, 0, 11); g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#ff4a1a'); ctx.fillStyle = g; ctx.fill();
  } else if (id === 'double') {
    for (const [bx, by] of [[-5, 3], [5, -3]]) {
      const g = ctx.createRadialGradient(bx - 2, by - 2, 0.5, bx, by, 7); g.addColorStop(0, '#9a9da8'); g.addColorStop(1, '#141418');
      circle(bx, by, 6.5, g, dark, 2);
    }
  } else if (id === 'holy') {
    for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -13); ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    circle(0, 0, 6.5, '#ffe27a', dark, 2.5);
  } else if (id === 'quake') {
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-5, 0); ctx.lineTo(-1, 6); ctx.lineTo(4, -4); ctx.lineTo(7, 3); ctx.lineTo(12, -6);
    ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 9, 12, 3, 0, 0, Math.PI * 2); ctx.strokeStyle = '#c9a35a'; ctx.lineWidth = 2; ctx.stroke();
  } else if (id === 'fan') {
    for (const a of [-0.5, 0, 0.5]) {
      ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(0, -13); ctx.lineTo(2, 6); ctx.closePath();
      ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#eef2f8'; ctx.fill();
      roundRect(-3.5, 6, 7, 2.5, 1, '#c9a24a'); ctx.restore();
    }
  } else if (id === 'smoke') {
    for (const [cx, cy, r] of [[-5, 3, 6], [4, 2, 7], [0, -4, 6.5]]) circle(cx, cy, r, '#b8b8c4', dark, 2);
    circle(-1, -1, 4, '#d8d8e4');
  } else if (id === 'trap') {
    roundRect(-11, 3, 22, 5, 2, '#7a5a3a', dark, 1.5);
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 4.4 - 2, 4); ctx.lineTo(i * 4.4, -9); ctx.lineTo(i * 4.4 + 2, 4); ctx.closePath(); ctx.fillStyle = '#e8e4dc'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.stroke(); }
  } else if (id === 'shadow') {
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.arc(5, -3, 9, 0, Math.PI * 2, true);
    ctx.fillStyle = '#b8a0ff'; ctx.fill('evenodd'); ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
  } else if (id === 'meteor') {
    ctx.strokeStyle = 'rgba(255,190,90,0.9)'; ctx.lineWidth = 3;
    for (const o of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(-12 + o, -12 - o * 0.3); ctx.lineTo(-2 + o * 0.3, -2); ctx.stroke(); }
    const mg = ctx.createRadialGradient(1, 1, 1, 3, 3, 8); mg.addColorStop(0, '#fff2b0'); mg.addColorStop(0.5, '#ff9a2a'); mg.addColorStop(1, '#a8301a');
    circle(3, 3, 7.5, mg, dark, 2);
  } else if (id === 'shield') {
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, -8); ctx.lineTo(9, 3); ctx.quadraticCurveTo(6, 10, 0, 13); ctx.quadraticCurveTo(-6, 10, -9, 3); ctx.lineTo(-10, -8); ctx.closePath();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    const g = ctx.createLinearGradient(0, -12, 0, 13); g.addColorStop(0, '#8fc3ff'); g.addColorStop(1, '#2a5fb8'); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 9); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.stroke();
  } else if (id === 'blade') {
    ctx.save(); ctx.rotate(-0.78);
    ctx.beginPath(); ctx.moveTo(-2.5, 6); ctx.lineTo(-2.5, -11); ctx.lineTo(0, -15); ctx.lineTo(2.5, -11); ctx.lineTo(2.5, 6); ctx.closePath();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#eef2f8'; ctx.fill();
    roundRect(-7, 5, 14, 3.5, 1.5, '#ffd34d', dark, 1.2); roundRect(-1.8, 8, 3.6, 7, 1.2, '#7a4a20', dark, 1);
    ctx.restore();
  }
  ctx.restore();
}

function drawRange(x, y, r, dashed) {
  if (r <= 1) return;
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(255,240,200,0.16)');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 2;
  if (dashed) { ctx.setLineDash([7, 6]); ctx.lineDashOffset = -time * 12; }
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
}
function drawRally(x, y) {
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 20); ctx.stroke();
  const w = Math.sin(time * 6) * 2;
  ctx.fillStyle = '#3f86e8'; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.quadraticCurveTo(x + 7, y - 19 + w, x + 14, y - 15); ctx.quadraticCurveTo(x + 7, y - 11 - w, x, y - 10); ctx.fill();
}

// ---------- HUD ----------
const HUD = {
  pause: { x: W - 30, y: 30, r: 19 },
  speed: { x: W - 78, y: 30, r: 19 },
  mute:  { x: W - 122, y: 30, r: 16 },
  heroes: [{ x: 42, y: H - 42, r: 27 }, { x: 104, y: H - 37, r: 23 }],
  meteor:    { x: 168, y: H - 34, r: 23 },
  reinforce: { x: 226, y: H - 34, r: 23 },
};
const heroBadge = (hb) => ({ x: hb.x + hb.r * 0.8, y: hb.y - hb.r * 0.8, r: 10 });

// küçük bilgi hapı: solda ikon, sağda değer
function statPill(x, y, w, icon, text, col, popT, label) {
  const h = 26;
  roundRect(x + 1.5, y + 3, w, h, h / 2, 'rgba(0,0,0,0.28)');
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(66,48,30,0.92)'); g.addColorStop(1, 'rgba(26,18,10,0.92)');
  roundRect(x, y, w, h, h / 2, g, '#c9a35a', 1.6);
  roundRect(x + 4, y + 2.5, w - 8, h * 0.36, h / 4, 'rgba(255,255,255,0.08)');
  drawIcon(icon, x + h / 2, y + h / 2, 17);
  const p = popT != null ? Math.max(0, 1 - (time - popT) / 0.35) : 0;
  const tx = x + h + (w - h) / 2 - 3;
  ctx.save(); ctx.translate(tx, y + h / 2 + 1); ctx.scale(1 + p * 0.3, 1 + p * 0.3);
  if (label) {
    txt(label, 0, -6, 8, '#d9c39a', 'center', '800', FONT_B, false);
    txt(text, 0, 4.5, 13, col, 'center', '400', FONT_T);
  } else txt(text, 0, 0, 15, col, 'center', '400', FONT_T);
  ctx.restore();
}

// Dalga butonu yolun üstünde değil yanında durur (düşmanları örtmesin); yolun girişinde yön okları akar.
function waveButtonPos(pi) {
  if (G.waveBtn[pi]) return G.waveBtn[pi];
  const p = G.paths[pi];
  let d = 0, q = pathPos(p, 0);
  while (d < p.total && (q.x < 40 || q.x > W - 40 || q.y < 84 || q.y > H - 40)) { d += 4; q = pathPos(p, d); }
  const cands = [];
  for (const along of [0, 24, 48]) {
    const a = pathPos(p, d + along);
    for (const side of [1, -1]) {
      const x = clamp(a.x - a.dy * 54 * side, 30, W - 30), y = clamp(a.y + a.dx * 54 * side, 86, H - 70);
      let score = nearestOnPaths(G.paths, x, y).d;
      for (const pl of G.plots) score = Math.min(score, dist(x, y, pl.x, pl.y) - 12);
      if (x < 270 && y > H - 130) score -= 100; // sol alttaki kahraman/büyü düğmeleri
      if (x < 280 && y < 70) score -= 100;      // sol üstteki bilgi hapları
      cands.push({ x, y, score });
    }
  }
  const best = cands.sort((a, b) => b.score - a.score)[0];
  return (G.waveBtn[pi] = { x: best.x, y: best.y, ax: q.x, ay: q.y, dx: q.dx, dy: q.dy });
}

// erken çağrı ödülü: kalan geri sayım ve dalga numarasıyla büyür
function earlyBonus() {
  return G.wave > 0 && G.waveCountdown > 0 ? Math.ceil(G.waveCountdown * (1.5 + 0.15 * G.wave)) : 0;
}

// dalga çağrılınca buton kaybolur; sahadaki düşmanlar temizlenince (sonraki dalga kendiliğinden gelmeden önce) geri gelir
function waveCallable() {
  return G.wave < G.lv.waves.length && (G.wave === 0 || (G.waveCountdown != null && G.spawners.length === 0 && G.enemies.length === 0));
}
function drawWaveButtons() {
  const show = waveCallable();
  if (show && G.waveShowT == null) G.waveShowT = time;
  if (!show) G.waveShowT = null;
  if (!show) return;
  const appear = easeOutBack(clamp((time - G.waveShowT) / 0.4, 0, 1));
  const next = G.lv.waves[G.wave], bonus = earlyBonus();
  for (const pi of nextWavePaths()) {
    const b = waveButtonPos(pi);
    // yolun girişinde akan yön okları
    const ang = Math.atan2(b.dy, b.dx);
    for (let j = 0; j < 3; j++) {
      const ph = (time * 0.9 + j / 3) % 1, ax = b.ax + b.dx * (ph * 46 - 6), ay = b.ay + b.dy * (ph * 46 - 6);
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.95; ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(4, 0); ctx.lineTo(-6, 9); ctx.lineTo(-2, 0); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(60,8,4,0.9)'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#ff6a4a'; ctx.fill();
      ctx.restore();
    }
    ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,220,150,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ax, b.ay); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(b.x, b.y);
    const s = appear * pressScale('wave' + pi) * (1 + Math.sin(time * 5) * 0.06); ctx.scale(s, s);
    glow(ctx, 0, 0, 44, '255,80,50', 0.45 + Math.sin(time * 5) * 0.15);
    circle(0, 5, 24, 'rgba(0,0,0,0.4)');
    const rim = ctx.createLinearGradient(0, -22, 0, 22); rim.addColorStop(0, '#fff0a8'); rim.addColorStop(1, '#a8681a');
    circle(0, 0, 23, rim, '#2e1606', 1.5);
    const body = ctx.createRadialGradient(-5, -7, 2, 0, 0, 21); body.addColorStop(0, '#f2584a'); body.addColorStop(1, '#5e0e0a');
    circle(0, 0, 19.5, body);
    drawIcon('skull', 0, 0, 22);
    if (G.wave > 0 && G.waveCountdown != null) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - G.waveCountdown / G.waveCountdownMax)); ctx.stroke();
    }
    ctx.restore();
    // etiket (BAŞLAT ya da erken çağrı ödülü) arsalardan ve yoldan uzak tarafa; gelecek düşmanlar karşı tarafa
    const room = (y) => (y < 80 || y > H - 20) ? -1e9 : Math.min(nearestOnPaths(G.paths, b.x, y).d + 10, ...G.plots.map(pl => dist(b.x, y, pl.x, pl.y)));
    if (b.ly == null) b.ly = room(b.y + 42) >= room(b.y - 42) ? b.y + 42 : b.y - 42;
    const bob = Math.sin(time * 4) * 2, ly = b.ly + bob;
    ctx.save(); ctx.globalAlpha = appear;
    if (G.wave === 0) {
      roundRect(b.x - 38, ly - 12, 76, 24, 12, 'rgba(26,14,6,0.92)', '#e8bb4a', 2);
      txt('BAŞLAT', b.x, ly + 1, 15, '#ffe27a', 'center', '400', FONT_T);
    } else if (bonus > 0) {
      roundRect(b.x - 34, ly - 11, 68, 22, 11, 'rgba(26,14,6,0.92)', '#e8bb4a', 2);
      drawIcon('coin', b.x - 20, ly, 13);
      txt('+' + bonus, b.x + 7, ly + 1, 14, '#ffe27a', 'center', '400', FONT_T);
    }
    // gelecek dalganın düşman türleri (bu yoldan)
    const types = [...new Set(next.filter(g => (g.p || 0) === pi).map(g => g.t))].slice(0, 4);
    const cy = b.ly > b.y ? b.y - 40 : b.y + 40;
    types.forEach((t, i) => {
      const cx = b.x + (i - (types.length - 1) / 2) * 22, im = enemySprite(t) || spr('enemy_' + t);
      circle(cx, cy + 1.5, 10, 'rgba(0,0,0,0.35)');
      circle(cx, cy, 10, '#2a1c10', ENEMIES[t].boss ? '#ff6a4a' : ENEMIES[t].flying ? '#8fd0ff' : '#c9a35a', 1.6);
      if (im) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 8.8, 0, Math.PI * 2); ctx.clip();
        const hh = ENEMIES[t].boss ? 30 : 24; drawSprite(ctx, im, cx, cy + hh * 0.62, hh * im.width / im.height);
        ctx.restore();
      }
    });
    ctx.restore();
  }
}

function drawHeroPortrait(h, hb, i) {
  const selHero = G.sel && G.sel.kind === 'hero' && G.sel.hero === h, pts = heroPoints(h);
  ctx.save(); ctx.translate(hb.x, hb.y); const hs = pressScale('hud_hero' + i); ctx.scale(hs, hs);
  if (selHero) glow(ctx, 0, 0, hb.r * 2, '120,220,255', 0.55 + Math.sin(time * 5) * 0.2);
  circle(0, 5, hb.r + 6, 'rgba(0,0,0,0.4)');
  const rim = ctx.createLinearGradient(0, -hb.r, 0, hb.r); rim.addColorStop(0, '#fff0b0'); rim.addColorStop(0.5, '#d9a03a'); rim.addColorStop(1, '#6a420e');
  circle(0, 0, hb.r + 6, rim, '#2a1606', 1.5);
  const bgp = ctx.createRadialGradient(-6, -10, 3, 0, 0, hb.r);
  bgp.addColorStop(0, `rgba(${h.def.aura},0.9)`); bgp.addColorStop(1, '#14181e');
  circle(0, 0, hb.r, bgp);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, hb.r - 1, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = h.dead ? 0.35 : 1;
  const im = heroSprite(h.def);
  if (im) { const ph = hb.r * 3.6; drawSprite(ctx, im, 3, hb.r * 2.35, ph * im.width / im.height); }
  ctx.restore();
  // can halkası ve deneyim çubuğu
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, hb.r + 2.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#5ad0ff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, hb.r + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (h.hp / h.maxHp)); ctx.stroke();
  if (h.lvl < HERO_MAX) {
    const xw = hb.r * 1.5;
    roundRect(-xw / 2, hb.r + 4, xw, 4, 2, 'rgba(10,6,2,0.8)');
    roundRect(-xw / 2, hb.r + 4, xw * clamp(h.xp / xpNeed(h.lvl), 0, 1), 4, 2, '#ffd34d');
  }
  if (h.dead) { circle(0, 0, hb.r, 'rgba(0,0,0,0.45)'); txt(Math.ceil(h.respawnT) + '', 0, 1, 20, '#fff', 'center', '400', FONT_T); }
  ctx.restore();
  // seviye rozeti; harcanmamış puan varsa yeşil + (dokununca yetenek ağacı açılır)
  const b = heroBadge(hb);
  ctx.save(); ctx.translate(b.x, b.y); const bs = pressScale('hb' + i) * (pts > 0 ? 1 + Math.sin(time * 6) * 0.1 : 1); ctx.scale(bs, bs);
  if (pts > 0) {
    glow(ctx, 0, 0, 22, '120,255,120', 0.6);
    circle(0, 1.5, 10.5, 'rgba(0,0,0,0.4)');
    circle(0, 0, 10.5, '#3cbf3c', '#fff', 1.8);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(4.5, 0); ctx.moveTo(0, -4.5); ctx.lineTo(0, 4.5); ctx.stroke();
  } else {
    fancyStar(0, 0, 11.5, true);
    txt(h.lvl + '', 0, 1.5, 11, '#5a2a00', 'center', '400', FONT_T, false);
  }
  ctx.restore();
}

function drawHud() {
  // altın / can değişince sayı zıplar
  if (G.goldShown !== Math.floor(G.gold)) { if (G.goldShown != null) G.goldPop = time; G.goldShown = Math.floor(G.gold); }
  if (G.livesShown !== G.lives) { if (G.livesShown != null) G.livesPop = time; G.livesShown = G.lives; }
  statPill(8, 8, 70, 'heart', G.lives + '', G.lives <= 5 ? '#ff8a7a' : '#fff', G.livesPop);
  statPill(84, 8, 86, 'coin', Math.floor(G.gold) + '', '#ffe27a', G.goldPop);
  statPill(176, 8, 78, 'skull', `${G.wave}/${G.lv.waves.length}`, '#fff', null, 'DALGA');

  roundBtn('hud_pause', HUD.pause.x, HUD.pause.y, HUD.pause.r, 'pause', null);
  roundBtn('hud_speed', HUD.speed.x, HUD.speed.y, HUD.speed.r, () => {
    drawIcon('fast', 0, -3, 15, speed > 1 ? '#ffe27a' : '#fff');
    txt(speed + 'x', 0, 9, 10, speed > 1 ? '#ffe27a' : '#fff', 'center', '400', FONT_T);
  }, null, { active: speed > 1 });
  roundBtn('hud_mute', HUD.mute.x, HUD.mute.y, HUD.mute.r, muted ? 'mute' : 'sound', null);

  G.heroes.forEach((h, i) => drawHeroPortrait(h, HUD.heroes[i], i));

  for (const id of ['meteor', 'reinforce']) {
    const b = HUD[id], cd = G.spells[id], max = SPELLS[id].cd;
    const active = G.mode && G.mode.kind === 'spell' && G.mode.id === id, ready = cd <= 0;
    ctx.save(); ctx.translate(b.x, b.y); const s = pressScale('hud_' + id); ctx.scale(s, s);
    if (active) glow(ctx, 0, 0, b.r * 2.3, '255,220,120', 0.7 + Math.sin(time * 8) * 0.2);
    else if (ready) glow(ctx, 0, 0, b.r * 1.9, id === 'meteor' ? '255,140,60' : '120,200,255', 0.25 + Math.sin(time * 3) * 0.1);
    circle(0, 5, b.r + 4, 'rgba(0,0,0,0.4)');
    const rm = ctx.createLinearGradient(0, -b.r, 0, b.r);
    rm.addColorStop(0, ready ? '#fff0b0' : '#b8b0a0'); rm.addColorStop(1, ready ? '#8a5a14' : '#4a443c');
    circle(0, 0, b.r + 4, rm, '#2a1606', 1.5);
    const bd = ctx.createRadialGradient(-5, -7, 2, 0, 0, b.r);
    if (id === 'meteor') { bd.addColorStop(0, '#a8402a'); bd.addColorStop(1, '#2e0c06'); } else { bd.addColorStop(0, '#3a6aa0'); bd.addColorStop(1, '#0e1a2c'); }
    circle(0, 0, b.r, bd);
    if (id === 'meteor') {
      ctx.strokeStyle = 'rgba(255,190,90,0.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const o of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(-13 + o, -13 - o * 0.3); ctx.lineTo(-3 + o * 0.4, -3); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 3, 3, 14, '255,150,50', 0.9); ctx.restore();
      const fg = ctx.createRadialGradient(1, 1, 1, 3, 3, 8); fg.addColorStop(0, '#fff2b0'); fg.addColorStop(0.5, '#ff9a2a'); fg.addColorStop(1, '#a8301a');
      circle(3, 3, 7.5, fg, '#4a1006', 1.5);
    } else {
      const mil = spr('militia'), sol = spr('soldier');
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, b.r - 1, 0, Math.PI * 2); ctx.clip();
      const sh = ctx.createRadialGradient(0, -4, 2, 0, 0, b.r); sh.addColorStop(0, 'rgba(140,200,255,0.55)'); sh.addColorStop(1, 'rgba(140,200,255,0)');
      ctx.fillStyle = sh; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
      if (mil && sol) {
        ctx.save(); ctx.translate(-8, 22); ctx.scale(-1, 1); drawSprite(ctx, mil, 0, 0, 34 * mil.width / mil.height); ctx.restore();
        drawSprite(ctx, sol, 8, 24, 38 * sol.width / sol.height);
      }
      ctx.restore();

    }
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(0, -b.r * 0.5, b.r * 0.6, b.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    if (!ready) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / max)); ctx.fill();
      txt(Math.ceil(cd) + '', 0, 1, 16, '#fff', 'center', '400', FONT_T);
    }
    ctx.restore();
  }

  drawWaveButtons();

  // bilgi paneli
  const info = infoText();
  if (info) {
    ctx.font = `700 13px ${FONT_B}`;
    const w = Math.max(290, ctx.measureText(info[1]).width + 44), x0 = W / 2 - w / 2, y0 = H - 58;
    roundRect(x0 + 2, y0 + 5, w, 48, 15, 'rgba(0,0,0,0.3)');
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 48); g.addColorStop(0, 'rgba(62,44,26,0.96)'); g.addColorStop(1, 'rgba(24,16,8,0.96)');
    roundRect(x0, y0, w, 48, 15, g, '#d4ab5a', 2);
    txt(info[0], W / 2, y0 + 16, 16, '#ffd34d', 'center', '400', FONT_T);
    txt(info[1], W / 2, y0 + 34, 13, '#f2e8d4', 'center', '700', FONT_B, false);
  }
  const hint = G.mode ? (G.mode.kind === 'rally' ? 'Askerlerin toplanma noktasını seç' : `${SPELLS[G.mode.id].name}: hedefi seç`)
    : (G.sel && G.sel.kind === 'hero') ? `${G.sel.hero.def.name}: göndermek için haritaya dokun` : null;
  if (hint) {
    ctx.font = `700 15px ${FONT_B}`;
    const w = ctx.measureText(hint).width + 36, bob = Math.sin(time * 4) * 1.5;
    roundRect(W / 2 - w / 2, 58 + bob, w, 28, 14, 'rgba(24,16,8,0.88)', '#d4ab5a', 1.5);
    txt(hint, W / 2, 73 + bob, 15, '#fff', 'center', '700', FONT_B, false);
  }
}

// Ekranın üstünde kısa duyuru (yeni yetenek, yetenek bilgisi)
function drawBanner() {
  const b = G.banner;
  if (!b) return;
  const a = clamp(Math.min(1, b.t / 0.25, (b.dur - b.t) / 0.4), 0, 1), e = easeOutBack(clamp(b.t / 0.35, 0, 1));
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 112); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e);
  ctx.font = `700 13px ${FONT_B}`;
  const w = Math.max(320, ctx.measureText(b.sub).width + 48);
  roundRect(-w / 2 + 2, -24 + 5, w, 52, 14, 'rgba(0,0,0,0.3)');
  const g = ctx.createLinearGradient(0, -24, 0, 28); g.addColorStop(0, 'rgba(62,44,26,0.96)'); g.addColorStop(1, 'rgba(24,16,8,0.96)');
  roundRect(-w / 2, -24, w, 52, 14, g, '#ffd34d', 2);
  txt(b.title, 0, -7, 18, '#ffd34d', 'center', '400', FONT_T);
  txt(b.sub, 0, 13, 13, '#f2e8d4', 'center', '700', FONT_B, false);
  ctx.restore();
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


function infoText() {
  if (G.preview && G.preview.id === 'build') {
    const T = TOWERS[G.preview.type], L = T.levels[0];
    return [`${T.name} — ${L.cost} altın`, towerStats(G.preview.type, L)];
  }
  if (G.sel && G.sel.kind === 'tower') {
    const t = G.sel.tower;
    if (G.preview && G.preview.id === 'upgrade') {
      const L = t.def.levels[t.lvl + 1];
      return [`Yükselt → Seviye ${t.lvl + 2} — ${L.cost} altın`, `${towerStats(t.type, L)} · Yeni: ${L.perk}`];
    }
    if (G.preview && G.preview.id === 'sell') return ['Sat', `${Math.floor(t.spent * SELL_RATIO)} altın geri al`];
    if (G.preview && G.preview.id === 'ability') {
      const a = G.preview.ab, r = (t.ab && t.ab[a.id]) || 0;
      if (r >= a.ranks.length) return [`${a.name} — En üst kademe`, a.desc(a.ranks[r - 1])];
      return [`${a.name} ${r + 1}/${a.ranks.length} — ${a.ranks[r].cost} altın`, a.desc(a.ranks[r])];
    }
    const L = t.def.levels[t.lvl];
    if (t.lvl >= t.def.levels.length - 1) return [`${t.def.name} — Seviye ${t.lvl + 1} (son)`, `${L.perk} · Yetenek geliştirmek için yukarıdaki düğmeler`];
    return [`${t.def.name} — Seviye ${t.lvl + 1}`, `${towerStats(t.type, L)} · ${L.perk}`];
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


// Kale görseli (izometrik, kapısı sol önde): kapı yolun bittiği noktaya gelecek şekilde biraz sola-aşağı kaydırılır.
// Eski yedek görsel (kışla) ise kale noktasına ortalanır.
function castlePlace(x, y, im) {
  if (im === spr('tower_barracks_3')) return { x, y, w: 118 };
  return { x: x - 15, y: y + 10, w: 124 };
}

// Kale: Gemini sprite'ı (castle_1..3, hasar evresine göre) yoksa kışlanın en büyük hali yedek olarak kullanılır.
function drawCastle() {
  const c = G.castle, ratio = G.lives / G.maxLives;
  const stage = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
  const im = spr('castle_' + stage) || spr('castle_1') || spr('tower_barracks_3');
  const sh = c.shake > 0 ? Math.sin(c.shake * 70) * c.shake * 8 : 0;
  if (im) {
    const cp = castlePlace(c.x, c.y, im);
    ctx.save(); ctx.translate(cp.x + sh, cp.y);
    drawSprite(ctx, im, 0, 0, cp.w);
    if (c.flash > 0) { ctx.globalAlpha = c.flash / 0.25 * 0.45; drawSprite(ctx, whiteOf('castle_fx_' + stage, im), 0, 0, cp.w); }
    ctx.restore();
    // can barı
    const bw = 64, by = c.y + 22; // can barı kalenin altında: sağ üstteki düğmelerle çakışmasın
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

// ----- kahraman yetenek ikonları -----
const HSK_ICON = {
  iron: 'shield', charge: 'blade', holy: 'holy', consecrate: 'blast', shieldthrow: 'shield', quake: 'quake', judgment: 'blade',
  fan: 'fan', venom: 'poison', deadly: 'snipe', smoke: 'smoke', trap: 'trap', shadow: 'shadow',
  flamering: 'napalm', inferno: 'napalm', meteor2: 'meteor', icelance: 'frost', freeze: 'frost', frostarmor: 'shield',
  volley: 'fan', blastarrow: 'napalm', fireaim: 'napalm', multishot: 'fan', pierce: 'snipe', eagle: 'snipe',
  shadowstep: 'shadow', bleed: 'poison', clawstorm: 'blade', dodge: 'smoke', mark: 'snipe',
};
function drawHeroSkillIcon(id, x, y, s) {
  if (['bash', 'cry', 'whirl', 'bolt'].includes(id)) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.6, s * 1.6); drawSkillGlyph(id, 0, 0); ctx.restore();
  } else if (id === 'revive' || id === 'ninelives') drawIcon('heart', x, y, 24 * s);
  else drawAbilityIcon(HSK_ICON[id] || 'blast', x, y, s);
}

// ----- yetenek ağacı penceresi (oyun durur) -----
function openSkills(h) {
  G.skillHero = h; G.skillSel = null;
  const pi = h.def.paths.findIndex((p, i) => nextSkill(h, i));
  if (heroPoints(h) > 0 && pi >= 0) G.skillSel = { sk: nextSkill(h, pi), pi };
  setOverlay('skills');
  sfx('open');
}
function drawSkillsPanel(k, px, py, pw, ph, cx) {
  const h = G.skillHero, pts = heroPoints(h);
  ribbon(cx, py + 4, 300, h.def.name, 'blue', 24);
  txt(`Seviye ${h.lvl}/${HERO_MAX}  ·  yetenekler seviye atladıkça kendiliğinden açılır`, cx, py + 54, 14, '#7a5530', 'center', '800', FONT_B, false);
  roundBtn('sk_close', px + pw - 26, py + 26, 17, 'close', () => setOverlay(null), { style: 'red', appear: k - 0.2 });
  h.def.paths.forEach((path, pi) => {
    const colX = h.def.paths.length === 1 ? cx - 60 : cx + (pi ? 130 : -130);
    roundRect(colX - 92, py + 70, 184, 24, 12, 'rgba(90,60,25,0.18)');
    txt(path.name, colX, py + 83, 16, '#4a2a0e', 'center', '400', FONT_T, false);
    const nxt = nextSkill(h, pi);
    path.skills.forEach((sk, si) => {
      const ny = py + 128 + si * 58, nx = colX - 56;
      if (si > 0) {
        ctx.strokeStyle = h.learned[path.skills[si - 1].id] ? path.col : 'rgba(90,60,25,0.35)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(nx, ny - 58 + 22); ctx.lineTo(nx, ny - 22); ctx.stroke();
      }
      const learned = h.learned[sk.id], avail = !learned && pts > 0, sel = G.skillSel && G.skillSel.sk === sk;
      const appear = easeOutBack(clamp((k - 0.15 - si * 0.07 - pi * 0.05) / 0.35, 0, 1));
      ctx.save(); ctx.translate(nx, ny); ctx.scale(appear * pressScale('sk' + sk.id), appear * pressScale('sk' + sk.id));
      if (avail) glow(ctx, 0, 0, 40, '120,255,120', 0.45 + Math.sin(time * 5) * 0.15);
      if (sel) glow(ctx, 0, 0, 40, '255,220,120', 0.6);
      circle(0, 3, 22, 'rgba(0,0,0,0.3)');
      const rim = ctx.createLinearGradient(0, -20, 0, 20);
      if (learned) { rim.addColorStop(0, '#fff2b8'); rim.addColorStop(1, '#a8681a'); } else { rim.addColorStop(0, '#b8b0a0'); rim.addColorStop(1, '#5a5246'); }
      circle(0, 0, 21, rim, '#2a1606', 1.5);
      const body = ctx.createRadialGradient(-5, -6, 2, 0, 0, 19);
      body.addColorStop(0, learned ? '#6a5a40' : avail ? '#3a5a30' : '#4a4440'); body.addColorStop(1, learned ? '#241a10' : '#1a1814');
      circle(0, 0, 18, body);
      ctx.globalAlpha *= learned || avail ? 1 : 0.45;
      drawHeroSkillIcon(sk.id, 0, 0, 0.85);
      ctx.restore();
      if (sk.passive) { roundRect(nx - 16, ny + 15, 32, 11, 5.5, '#5a3a8a'); txt('KALICI', nx, ny + 20.5, 7, '#fff', 'center', '800', FONT_B, false); }
      if (learned) { circle(nx + 15, ny - 15, 7, '#3cbf3c', '#fff', 1.5); drawIcon('check', nx + 15, ny - 15, 9); }
      txt(sk.name, nx + 28, ny - 6, 14, learned ? '#4a2a0e' : '#7a5530', 'left', '400', FONT_T, false);
      txt(learned ? (sk.passive ? 'Kalıcı güç' : `${sk.cd} sn bekleme`) : `Seviye ${si + 2}${['', '', "'de", "'te", "'te"][si + 2]} açılır`, nx + 28, ny + 10, 11, '#8a6238', 'left', '700', FONT_B, false);
      buttons.push({ key: 'sk' + sk.id, x: nx - 26, y: ny - 26, w: 150, h: 52, fn: () => { G.skillSel = { sk, pi }; sfx('pick'); } });
    });
  });
  // seçili yeteneğin açıklaması ve öğren düğmesi
  const by = py + ph - 82;
  roundRect(px + 26, by, pw - 52, 58, 12, 'rgba(90,60,25,0.16)', 'rgba(90,60,25,0.35)', 1.5);
  const ss = G.skillSel && G.skillSel.sk;
  if (ss) {
    const learned = h.learned[ss.id], can = !learned && pts > 0;
    txt(ss.name, px + 44, by + 18, 17, '#4a2a0e', 'left', '400', FONT_T, false);
    txt(ss.desc, px + 44, by + 39, 12.5, '#6a4420', 'left', '700', FONT_B, false);
    if (can) {
      gameButton('sk_learn', px + pw - 100, by + 26, 120, 40, 'ÖĞREN', () => {
        const got = learnSkill(h, G.skillSel.pi, ss);
        if (!got) return;
        sfx('upgrade');
        for (let i = 0; i < 20; i++) {
          const a = rand(0, Math.PI * 2), v = rand(60, 180);
          emit(uiParts, { kind: 'glow', add: true, x: px + pw - 100, y: by + 26, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, col: '140,255,140', s0: 5, s1: 0.5, life: 0.6 });
        }
        const pi2 = h.def.paths.findIndex((p, i) => nextSkill(h, i));
        G.skillSel = heroPoints(h) > 0 && pi2 >= 0 ? { sk: nextSkill(h, pi2), pi: pi2 } : G.skillSel;
      }, 'green', { icon: 'check', shine: true, size: 17 });
    } else {
      txt(learned ? 'Açık' : 'Henüz açılmadı', px + pw - 100, by + 29, 12, '#8a6238', 'center', '800', FONT_B, false);
    }
  } else {
    txt('Ayrıntısını görmek için bir yeteneğe dokun', cx, by + 29, 13, '#7a5530', 'center', '700', FONT_B, false);
  }
}

// ----- kahraman seçim ekranı -----
function drawHeroes() {
  const st = time - screenT, bg = spr('title_bg');
  if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
  else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, W, H); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(24,12,4,0.5)'); g.addColorStop(1, 'rgba(14,8,2,0.8)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 300, 'KAHRAMANLAR', 'blue', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'map'; }), { appear: st - 0.1 });
  const tm = team();
  txt('Savaşa en fazla 2 kahraman götürebilirsin · seçmek için karta dokun', W / 2, 98, 14, '#f0e2c4', 'center', '700', FONT_B, false);
  HERO_ORDER.forEach((id, i) => drawHeroCard(id, W / 2 + (i - (HERO_ORDER.length - 1) / 2) * 182, 300, st - 0.1 - i * 0.08, tm));
  save.seenHeroes = save.seenHeroes || ['commander'];
  for (const id of HERO_ORDER) if (heroUnlocked(id) && !save.seenHeroes.includes(id)) { save.seenHeroes.push(id); persist(); }
}
function drawHeroCard(id, cx, cy, at, tm) {
  const p = clamp(at / 0.45, 0, 1);
  if (p <= 0) return;
  const d = HEROES[id], e = easeOutBack(p), w = 174, h = 330, unlocked = heroUnlocked(id), sel = tm.includes(id);
  const key = 'hc' + id, sc = pressScale(key), fy = cy + (1 - e) * 70;
  ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1); ctx.translate(cx, fy); ctx.scale(sc, sc);
  const x0 = -w / 2, y0 = -h / 2;
  if (sel) glow(ctx, 0, 0, w * 0.8, d.aura, 0.4 + Math.sin(time * 3) * 0.1);
  roundRect(x0 + 5, y0 + 12, w, h, 20, 'rgba(0,0,0,0.5)');
  const fr = ctx.createLinearGradient(0, y0, 0, y0 + h); fr.addColorStop(0, '#b07a46'); fr.addColorStop(1, '#4a2c14');
  roundRect(x0, y0, w, h, 20, fr, sel ? '#7be05a' : '#22120a', sel ? 4 : 3);
  const pg = ctx.createLinearGradient(0, y0 + 10, 0, y0 + h - 10); pg.addColorStop(0, '#f8ebcc'); pg.addColorStop(1, '#dcc089');
  roundRect(x0 + 10, y0 + 10, w - 20, h - 20, 15, pg, 'rgba(92,58,22,0.6)', 1.5);
  // portre
  ctx.save(); ctx.beginPath(); ctx.roundRect(x0 + 18, y0 + 18, w - 36, 150, 12); ctx.clip();
  const bgc = ctx.createRadialGradient(0, y0 + 90, 10, 0, y0 + 90, 120);
  bgc.addColorStop(0, `rgba(${d.aura},0.9)`); bgc.addColorStop(1, '#1a1410');
  ctx.fillStyle = bgc; ctx.fillRect(x0 + 18, y0 + 18, w - 36, 150);
  const im = heroSprite(d);
  if (im) {
    const ih = 132, iw = ih * im.width / im.height, bob = Math.sin(time * 2 + cx) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, y0 + 160, iw * 0.35, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, im, 0, y0 + 160 + bob * 0.3, iw);
  }
  ctx.restore();
  roundRect(x0 + 18, y0 + 18, w - 36, 150, 12, null, '#3a2410', 2.5);
  txt(d.name, 0, y0 + 188, 21, '#4a2a0e', 'center', '400', FONT_T, false);
  txt(d.role, 0, y0 + 208, 10.5, '#8a6238', 'center', '800', FONT_B, false);
  // değer çubukları
  const bars = !unlocked ? [] : [['Can', d.hp / 520, '#e8434b'], ['Saldırı', ((d.dmg[0] + d.dmg[1]) / 2 / d.rate) / 28, '#ffb347'], ['Hız', d.speed / 135, '#5ad0ff'], ['Menzil', (d.ranged || 40) / 215, '#9be06a']];
  bars.forEach(([lab, v, col], j) => {
    const by = y0 + 228 + j * 14;
    txt(lab, x0 + 22, by, 10, '#6a4420', 'left', '800', FONT_B, false);
    roundRect(x0 + 70, by - 3.5, 82, 7, 3.5, 'rgba(60,40,20,0.25)');
    roundRect(x0 + 70, by - 3.5, 82 * clamp(v, 0.08, 1), 7, 3.5, col);
  });
  if (!unlocked) { /* kilitliyken rozet yok */ }
  else if (d.ranged) { roundRect(-34, y0 + 290, 68, 16, 8, '#2a5fb8'); txt('MENZİLLİ', 0, y0 + 298, 9, '#fff', 'center', '800', FONT_B, false); }
  else { roundRect(-44, y0 + 290, 88, 16, 8, '#8a3a1a'); txt('YAKIN DÖVÜŞ', 0, y0 + 298, 9, '#fff', 'center', '800', FONT_B, false); }
  if (sel) { circle(w / 2 - 20, y0 + 22, 13, '#3cbf3c', '#fff', 2); drawIcon('check', w / 2 - 20, y0 + 22, 16); }
  if (unlocked && !(save.seenHeroes || ['commander']).includes(id)) { roundRect(x0 + 14, y0 + 14, 50, 18, 9, '#e8434b', '#fff', 1.5); txt('YENİ', x0 + 39, y0 + 23, 10, '#fff', 'center', '400', FONT_T); }
  if (!unlocked) {
    roundRect(x0, y0, w, h, 20, 'rgba(18,10,4,0.66)');
    drawIcon('lock', 0, y0 + 90, 44);
    txt('Kilitli', 0, y0 + 250, 22, '#f0e2c4', 'center', '400', FONT_T);
    txt(`${d.unlock}. bölümü bitirince açılır`, 0, y0 + 274, 12, '#cdb894', 'center', '700', FONT_B, false);
  }
  ctx.restore();
  if (unlocked) buttons.push({ key, x: cx - w / 2, y: fy - h / 2, w, h, fn: () => toggleHero(id) });
}
function toggleHero(id) {
  let t = team().slice();
  if (t.includes(id)) { if (t.length > 1) t = t.filter(x => x !== id); else { sfx('error'); return; } }
  else { t.push(id); if (t.length > 2) t.shift(); }
  save.team = t; persist(); sfx('select');
}

// ---------- bosslar ----------
// Boss görselleri temel düşman görselinden renk değiştirilerek üretilir (bir kez, önbelleğe alınır).
// img/ klasörüne enemy_<boss>.png koyulursa o kullanılır.
const BOSS_LOOK = {
  goblin_king:  (h, s, l) => (h > 15 && h < 50 && s > 0.15) ? [355, Math.min(1, s * 1.4), l * 0.9] : (h > 70 && h < 160 && s > 0.2) ? [h - 10, s, l * 0.92] : null,
  wolf_alpha:   (h, s, l) => s < 0.25 ? [h, s, l * 0.42] : null,
  orc_warlord:  (h, s, l) => (h > 70 && h < 160 && s > 0.2) ? [358, s * 0.9, l * 0.95] : (s < 0.2 && l > 0.2) ? [30, 0.15, l * 0.7] : null,
  dark_shaman:  (h, s, l) => (h > 245 && h < 325 && s > 0.15) ? [200, s * 0.55, l * 0.55] : (h > 80 && h < 165 && s > 0.5 && l > 0.45) ? [300, 1, l] : (h > 70 && h < 165 && s > 0.2) ? [h + 40, s * 0.6, l * 0.8] : null,
  death_knight: (h, s, l) => s < 0.28 ? [195, 0.25, 0.32 + l * 0.75] : ((h < 18 || h > 335) && s > 0.35) ? [185, 0.9, l * 1.2] : null,
  troll_king:   (h, s, l) => (h > 190 && h < 240 && s > 0.12) ? [95, s * 1.1, l * 0.9] : null,
  overlord:     (h, s, l) => s < 0.28 ? [355, 0.55, 0.08 + l * 0.6] : ((h < 18 || h > 335) && s > 0.35) ? [28, 1, l * 1.25] : null,
};
function enemySprite(type) {
  const name = 'enemy_' + type;
  if (SPR[name]) return SPR[name];
  const d = ENEMIES[type];
  if (!d || !d.base) return null;
  const base = spr('enemy_' + d.base);
  if (!base) return null;
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
  const g = c.getContext('2d'); g.drawImage(base, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), a = im.data, f = BOSS_LOOK[type];
  if (f) for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 10) continue;
    const r = f(...rgb2hsl(a[i], a[i + 1], a[i + 2]));
    if (!r) continue;
    const rgb = hsl2rgb((r[0] + 360) % 360, clamp(r[1], 0, 1), clamp(r[2], 0, 1));
    a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2];
  }
  g.putImageData(im, 0, 0);
  c.generated = true;
  return (SPR[name] = c);
}
// başın üstünde taç
function drawCrown(x, y, s, face) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s); ctx.rotate(0.12);
  ctx.beginPath();
  ctx.moveTo(-10, 6); ctx.lineTo(-11, -5); ctx.lineTo(-5, 0); ctx.lineTo(0, -9); ctx.lineTo(5, 0); ctx.lineTo(11, -5); ctx.lineTo(10, 6); ctx.closePath();
  const g = ctx.createLinearGradient(0, -9, 0, 6); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc928'); g.addColorStop(1, '#b8780c');
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a2004'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
  circle(0, 1.5, 2, '#e8434b'); circle(-6, 2.5, 1.4, '#4fc3ff'); circle(6, 2.5, 1.4, '#4fc3ff');
  ctx.restore();
}

function bossIntro(e) {
  G.bossT = 0;
  G.intro = { type: e.type, t: 0, dur: 5, boss: true };
  shakeScreen(4, 0.6);
  sfx('wave'); sfx('castlehit');
}

// boss yetenekleri
function bossAbilities(e, dt) {
  const ab = e.def.ab;
  if (!ab) return;
  e.abT = e.abT || {};
  const ready = (k, cd) => { e.abT[k] = (e.abT[k] ?? cd * 0.6) - dt; if (e.abT[k] > 0) return false; e.abT[k] = cd; return true; };
  if (ab.regen && e.hp < e.maxHp && time - (e.hitAt || -9) > 4) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ab.regen * dt);
  if (ab.summon && ready('summon', ab.summon.cd)) {
    for (let i = 0; i < ab.summon.n; i++) spawnEnemy(ab.summon.t, G.paths.indexOf(e.p), Math.max(0, e.d - 12 - i * 14));
    G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 40, col: '190,90,255', t: 0, dur: 0.5 });
    for (let i = 0; i < 16; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-30, 30), y: e.y + rand(-8, 8), vy: -rand(20, 60), col: '190,110,255', s0: 4, s1: 0.5, life: 0.7 });
    floatText(e.x, e.y - 60, 'Çağrı!', '#d8a8ff'); sfx('spell');
  }
  if (ab.howl && ready('howl', ab.howl.cd)) {
    for (const o of G.enemies) if (!o.dead && dist(o.x, o.y, e.x, e.y) < ab.howl.r) o.hasteT = 4;
    G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: ab.howl.r, col: '255,90,70', t: 0, dur: 0.6 });
    floatText(e.x, e.y - 50, 'Uluma!', '#ff8a7a'); sfx('cry');
  }
  if (ab.slam && ready('slam', ab.slam.cd)) {
    const hitAny = G.soldiers.some(s => !s.dead && dist(s.x, s.y, e.x, e.y) < ab.slam.r);
    if (!hitAny) e.abT.slam = 1;
    else {
      for (const s of G.soldiers) if (!s.dead && dist(s.x, s.y, e.x, e.y) < ab.slam.r) { damageSoldier(s, ab.slam.dmg); s.stunT = ab.slam.stun; }
      G.effects.push({ kind: 'shock', x: e.x, y: e.y, r: ab.slam.r * 1.3, t: 0, dur: 0.45 });
      for (let i = 0; i < 14; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-20, 20), y: e.y, vx: rand(-90, 90), vy: -rand(60, 150), g: 420, col: '#6a5040', s0: 3, s1: 2, life: 0.8, vr: rand(-10, 10), floor: e.y + rand(-6, 8) });
      shakeScreen(4, 0.3); sfx('boom');
    }
  }
  if (ab.shield && ready('shield', ab.shield.cd)) { e.shieldT = ab.shield.t; sfx('magic'); }
  if (ab.heal && ready('heal', ab.heal.cd)) {
    for (const o of G.enemies) if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < ab.heal.r && o.hp < o.maxHp) {
      o.hp = Math.min(o.maxHp, o.hp + ab.heal.amt); G.effects.push({ kind: 'heal', x: o.x, y: o.y, t: 0, dur: 0.6 });
    }
  }
  if (ab.blink && !e.blocker && e.siege === undefined && ready('blink', ab.blink.cd)) {
    for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', x: e.x + rand(-8, 8), y: e.y - rand(0, 40), vy: -rand(10, 30), col: '90,220,230', s0: 6, s1: 12, life: 0.5, a: 0.7 });
    e.d = Math.min(e.p.total - 30, e.d + ab.blink.d);
    const q = pathPos(e.p, e.d, e.off); e.x = q.x; e.y = q.y;
    for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-8, 8), y: e.y - rand(0, 40), vy: -rand(10, 30), col: '120,240,255', s0: 5, s1: 0.5, life: 0.5 });
    sfx('zap');
  }
}

// ekranın üstünde boss can barı
function drawBossBar() {
  const b = G.enemies.find(e => e.def.chief && !e.dead);
  if (!b) return;
  const w = 300, x = W / 2 - w / 2, y = 62, fr = clamp(b.hp / b.maxHp, 0, 1);
  b.shownHp = b.shownHp == null ? fr : lerp(b.shownHp, fr, 0.08);
  roundRect(x - 4, y - 4, w + 8, 24, 12, 'rgba(14,8,3,0.85)', '#c9a35a', 1.6);
  roundRect(x, y, w, 16, 8, '#3a0e0a');
  roundRect(x, y, Math.max(16, w * b.shownHp), 16, 8, '#ffd98a');
  roundRect(x, y, Math.max(16, w * fr), 16, 8, b.shieldT > 0 ? '#5ab4ff' : '#d8342a');
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 4, y + 2, Math.max(0, w * fr - 8), 4);
  drawCrown(x - 2, y + 2, 0.8, 1);
  txt(b.def.name, W / 2, y + 8.5, 13, '#fff', 'center', '400', FONT_T);
}

// yeni düşman / boss tanıtım kartı
function drawIntro() {
  const it = G.intro;
  if (!it) return;
  if (it.t > it.dur) { G.intro = null; return; }
  const d = ENEMIES[it.type], a = clamp(Math.min(it.t / 0.3, (it.dur - it.t) / 0.4), 0, 1), e = easeOutBack(clamp(it.t / 0.4, 0, 1));
  const w = it.boss ? 340 : 300, h = 70, x0 = W / 2 - w / 2, y0 = it.boss ? 92 : 64;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y0 + h / 2); ctx.scale(e, e); ctx.translate(-W / 2, -(y0 + h / 2));
  roundRect(x0 + 2, y0 + 5, w, h, 16, 'rgba(0,0,0,0.3)');
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, it.boss ? 'rgba(90,20,14,0.96)' : 'rgba(62,44,26,0.96)'); g.addColorStop(1, 'rgba(24,12,8,0.96)');
  roundRect(x0, y0, w, h, 16, g, it.boss ? '#ff6a4a' : '#d4ab5a', 2);
  circle(x0 + 36, y0 + h / 2, 26, '#1a120a', it.boss ? '#ff6a4a' : '#c9a35a', 2);
  const im = enemySprite(it.type) || spr('enemy_' + it.type);
  if (im) {
    ctx.save(); ctx.beginPath(); ctx.arc(x0 + 36, y0 + h / 2, 24.5, 0, Math.PI * 2); ctx.clip();
    const ih = it.boss ? 62 : 46; drawSprite(ctx, im, x0 + 36, y0 + h / 2 + ih * 0.55, ih * im.width / im.height);
    ctx.restore();
  }
  txt(it.boss ? 'BOSS GELİYOR' : 'YENİ DÜŞMAN', x0 + 72, y0 + 16, 11, it.boss ? '#ff9a7a' : '#ffd34d', 'left', '800', FONT_B, false);
  txt(d.name, x0 + 72, y0 + 34, 19, '#fff', 'left', '400', FONT_T);
  txt(d.desc || ENEMY_DESC[it.type] || '', x0 + 72, y0 + 54, 11.5, '#f0e2c4', 'left', '700', FONT_B, false);
  ctx.restore();
}

// Düşmanların çıkacağı yolun başında uyarı: yalnızca o yoldan gerçekten düşman gelecekse (birkaç sn önceden ve gelirken)
function drawIncoming() {
  const warn = new Set();
  for (const sp of G.spawners) if (sp.left > 0 && sp.timer < 3) warn.add(sp.p);
  for (const pi of warn) {
    const p = G.paths[pi];
    let d = 0, q = pathPos(p, 0);
    while (d < p.total && (q.x < 22 || q.x > W - 22 || q.y < 22 || q.y > H - 22)) { d += 4; q = pathPos(p, d); }
    const pulse = 1 + Math.sin(time * 10) * 0.12;
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(pulse, pulse);
    glow(ctx, 0, 0, 30, '255,60,40', 0.5);
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a0804'; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = '#ff5a3a'; ctx.fill();
    txt('!', 0, 2, 15, '#fff', 'center', '400', FONT_T, false);
    ctx.restore();
  }
}

// ----- yıldız gelişmeleri -----
function upgRank(id) { return (save.upg && save.upg[id]) || 0; }
function starsTotal() { return save.stars.reduce((a, b) => a + (b || 0), 0); }
function starsSpent() { return UPGRADES.reduce((a, u) => a + u.ranks.slice(0, upgRank(u.id)).reduce((b, r) => b + r.cost, 0), 0); }
function diff() { return DIFFS[save.diff ?? 1]; }
// gelişmelerle güçlenmiş kule seviyesi değerleri
function effLevel(t) {
  const L = t.def.levels[t.lvl], r = upgRank(t.type);
  if (!r || t.type === 'barracks') return L;
  const dm = (r >= 1 ? 1.1 : 1) * (r >= 3 ? 1.15 : 1);
  const o = Object.assign({}, L, { dmg: [L.dmg[0] * dm, L.dmg[1] * dm] });
  if (r >= 2 && t.type !== 'artillery') o.range = L.range * 1.1;
  if (r >= 2 && t.type === 'artillery') o.splash = L.splash * 1.15;
  return o;
}

function drawUpgrades() {
  const st = time - screenT, bg = spr('title_bg');
  if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
  else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, W, H); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(24,12,4,0.5)'); g.addColorStop(1, 'rgba(14,8,2,0.82)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 320, 'GELİŞMELER', 'gold', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'map'; }), { appear: st - 0.1 });
  const free = starsTotal() - starsSpent();
  roundRect(W - 160, 26, 138, 38, 19, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
  fancyStar(W - 139, 45, 13, true);
  txt(`${free} yıldız`, W - 84, 46, 18, '#ffe27a', 'center', '400', FONT_T);
  txt('Bölümlerden kazandığın yıldızlarla kalıcı güç satın al · her satır soldan sağa açılır', W / 2, 100, 13.5, '#f0e2c4', 'center', '700', FONT_B, false);
  UPGRADES.forEach((u, i) => {
    const y = 140 + i * 56, r = upgRank(u.id), p = clamp((st - 0.1 - i * 0.05) / 0.35, 0, 1);
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - easeOutBack(p)) * -60, 0);
    roundRect(70, y - 22, 820, 46, 23, 'rgba(30,18,8,0.75)', 'rgba(212,171,90,0.5)', 1.5);
    circle(98, y + 1, 19, '#2a1c10', '#c9a35a', 2);
    upgradeIcon(u.id, 98, y + 1);
    txt(u.name, 128, y + 1, 18, '#ffe9b0', 'left', '400', FONT_T);
    u.ranks.forEach((rk2, j) => {
      const x = 262 + j * 208, bought = j < r, next = j === r, can = next && free >= rk2.cost;
      const key = 'up' + u.id + j, sc = pressScale(key);
      ctx.save(); ctx.translate(x + 95, y + 1); ctx.scale(sc, sc);
      const fill = bought ? '#3c7a24' : can ? '#6a4a1c' : 'rgba(60,44,28,0.85)';
      roundRect(-95, -17, 190, 34, 17, fill, bought ? '#9be06a' : can ? '#ffd34d' : 'rgba(212,171,90,0.35)', bought || can ? 2 : 1.2);
      if (can) glow(ctx, 0, 0, 90, '255,210,90', 0.12 + Math.sin(time * 4) * 0.05);
      txt(rk2.desc, -12, 1, 12, bought ? '#eaffd8' : next ? '#fff3d0' : '#a89878', 'center', '700', FONT_B, false);
      if (bought) { circle(78, 0, 9, '#3cbf3c', '#fff', 1.5); drawIcon('check', 78, 0, 11); }
      else { fancyStar(72, 0, 8, true); txt(rk2.cost + '', 84, 1, 12, '#ffe27a', 'center', '400', FONT_T); }
      ctx.restore();
      if (next) buttons.push({ key, x: x, y: y - 17, w: 190, h: 34, fn: () => {
        if (free < rk2.cost) { sfx('error'); return; }
        save.upg = save.upg || {}; save.upg[u.id] = r + 1; persist(); sfx('upgrade');
        for (let k = 0; k < 16; k++) { const a = rand(0, Math.PI * 2), v = rand(50, 150); emit(uiParts, { kind: 'glow', add: true, x: x + 95, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, col: '255,220,120', s0: 4, s1: 0.5, life: 0.6 }); }
      } });
    });
    ctx.restore();
  });
  gameButton('up_reset', W / 2, H - 34, 200, 40, 'SIFIRLA', () => { save.upg = {}; persist(); sfx('coins'); }, 'red', { icon: 'restart', size: 17, appear: st - 0.4 });
}
function upgradeIcon(id, x, y) {
  if (['archer', 'barracks', 'mage', 'artillery'].includes(id)) {
    const im = spr(`tower_${id}_2`);
    if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.clip(); drawSprite(ctx, im, x, y + 19, 36 * im.width / im.height); ctx.restore(); }
  } else if (id === 'spells') drawAbilityIcon('meteor', x, y, 0.9);
  else drawIcon('heart', x, y, 20);
}

// harita ekranındaki zorluk seçici
function drawDiffPicker(st) {
  const cur = save.diff ?? 1, x0 = 26, y = H - 32;
  ctx.save(); ctx.globalAlpha = clamp((st - 0.3) / 0.3, 0, 1);
  roundRect(x0 - 4, y - 18, 3 * 76 + 8, 36, 18, 'rgba(24,14,6,0.88)', '#d4ab5a', 1.6);
  DIFFS.forEach((d, i) => {
    const x = x0 + i * 76, on = i === cur;
    if (on) roundRect(x, y - 14, 72, 28, 14, ['#4caf33', '#d99a2a', '#c8392c'][i], '#fff', 1.5);
    txt(d.name, x + 36, y + 1, 14, on ? '#fff' : '#bba888', 'center', '400', FONT_T, on);
    buttons.push({ key: 'df' + i, x, y: y - 16, w: 72, h: 32, fn: () => { save.diff = i; persist(); sfx('select'); } });
  });
  ctx.restore();
}

// ---------- ekranlar ----------
// başlık görselinin bulanık kopyası (harita ekranının arka planı): küçültüp büyütmek her tarayıcıda çalışan ucuz bir bulanıklık
const BLUR = {};
function blurOf(name, im) {
  if (!BLUR[name]) {
    const c = document.createElement('canvas'); c.width = 96; c.height = Math.round(96 * im.height / im.width);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(pickMip(g, im, c.width), 0, 0, c.width, c.height);
    BLUR[name] = c;
  }
  return BLUR[name];
}
function coverImage(im, zoom = 1, ox = 0, oy = 0) {
  const k = Math.max(W / im.width, H / im.height) * zoom, w = im.width * k, h = im.height * k;
  ctx.drawImage(im.width > w * 1.5 ? pickMip(ctx, im, w) : im, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h);
}

function drawTitle() {
  const st = time - screenT, bg = spr('title_bg');
  if (bg) coverImage(bg, 1.07 + Math.sin(time * 0.1) * 0.03, Math.sin(time * 0.07) * 10, Math.cos(time * 0.09) * 5);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a6ea8'); g.addColorStop(0.6, '#8fc0e0'); g.addColorStop(0.61, '#5f9440'); g.addColorStop(1, '#3d7030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // sol üstten süzülen güneş hüzmeleri
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const a = 0.28 + i * 0.17 + Math.sin(time * 0.35 + i * 1.7) * 0.03;
    ctx.save(); ctx.translate(-40, -60); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, 1000, 0);
    g.addColorStop(0, `rgba(255,222,160,${0.1 + 0.03 * Math.sin(time + i)})`); g.addColorStop(1, 'rgba(255,222,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, -24 - i * 7); ctx.lineTo(1100, 24 + i * 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  let g = ctx.createLinearGradient(0, 0, 0, 210);
  g.addColorStop(0, 'rgba(40,18,6,0.55)'); g.addColorStop(1, 'rgba(40,18,6,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 210);
  g = ctx.createLinearGradient(0, H - 190, 0, H);
  g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(1, 'rgba(20,10,4,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 190, W, 190);

  const e = easeOutBack(clamp(st / 0.7, 0, 1));
  ctx.save(); ctx.globalAlpha = clamp(st / 0.25, 0, 1);
  ctx.translate(W / 2, 96); ctx.scale(e, e); ctx.rotate(Math.sin(time * 1.2) * 0.01);
  logo('SINIR KALESİ', 0, 0, 76);
  ctx.restore();
  const r = clamp((st - 0.35) / 0.35, 0, 1);
  if (r > 0) {
    ctx.save(); ctx.globalAlpha = r; ctx.translate(W / 2, 160); const rs = 0.6 + 0.4 * easeOutBack(r); ctx.scale(rs, rs);
    ribbon(0, 0, 250, 'KULE SAVUNMA', 'red', 19);
    ctx.restore();
  }
  gameButton('play', W / 2, 452, 250, 66, 'OYNA', () => go(() => { screen = 'map'; }), 'green', { icon: 'play', shine: true, breathe: true, appear: st - 0.55, size: 32 });
  roundBtn('snd', W - 38, 38, 21, muted ? 'mute' : 'sound', () => setMuted(!muted), { appear: st - 0.7 });
  txt('v0.3', W - 14, H - 14, 12, 'rgba(255,255,255,0.75)', 'right', '700', FONT_B, false);
  if (Math.random() < 0.3) {
    emit(uiParts, { kind: 'glow', add: true, x: rand(0, W), y: rand(H * 0.3, H), vx: rand(-8, 8), vy: rand(-18, -6),
      col: '255,220,150', s0: rand(1.5, 3.2), s1: 0.5, life: rand(3, 5), a: 0.85, fadeIn: 0.3 });
  }
}

// ----- bölüm seçimi: önizlemeli kartlar -----
const DIFF = ['Kolay', 'Kolay', 'Orta', 'Orta', 'Orta', 'Zor', 'Zor', 'Zor', 'Çok zor', 'Efsane'];
const THUMB = {};
function thumbOf(i) {
  if (THUMB[i]) return THUMB[i];
  if (thumbOf.at === time) return null; // kare başına en çok bir önizleme hazırlanır (takılma olmasın)
  thumbOf.at = time;
  const lv = LEVELS[i], bg = renderBackground(lv, lv.paths.map(buildPath));
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.scale(480 / W, 270 / H);
  g.drawImage(pickMip(g, bg, W), 0, 0, W, H);
  const im = spr('castle_1') || spr('tower_barracks_3');
  if (im) { const cp = castlePlace(lv.castle[0], lv.castle[1], im); drawSprite(g, im, cp.x, cp.y, cp.w); }
  return (THUMB[i] = c);
}

function drawMap() {
  const st = time - screenT, bg = spr('title_bg');
  if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
  else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, W, H); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(24,12,4,0.45)'); g.addColorStop(1, 'rgba(14,8,2,0.78)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 60); ctx.scale(rk, rk); ribbon(0, 0, 330, 'SEFER HARİTASI', 'red', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'title'; }), { appear: st - 0.1 });
  const total = save.stars.reduce((a, b) => a + (b || 0), 0);
  ctx.save(); ctx.globalAlpha = clamp((st - 0.15) / 0.25, 0, 1);
  roundRect(W - 154, 26, 132, 38, 19, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
  fancyStar(W - 133, 45, 13, true);
  txt(`${total} / ${LEVELS.length * 3}`, W - 76, 46, 20, '#ffe27a', 'center', '400', FONT_T);
  ctx.restore();
  const pages = Math.ceil(LEVELS.length / 3);
  if (mapPage == null) { const first = LEVELS.findIndex((lv, i) => !(save.stars[i] > 0)); mapPage = Math.floor((first < 0 ? LEVELS.length - 1 : first) / 3); mapPageT = screenT; }
  const pst = time - Math.max(screenT, mapPageT);
  const ids = []; for (let i = mapPage * 3; i < Math.min(LEVELS.length, mapPage * 3 + 3); i++) ids.push(i);
  ids.forEach((i, j) => drawLevelCard(i, W / 2 + (j - (ids.length - 1) / 2) * 286, 290, pst - 0.08 - j * 0.08));
  const flip = (d) => { mapPage = clamp(mapPage + d, 0, pages - 1); mapPageT = time; sfx('pick'); };
  if (mapPage > 0) roundBtn('pg_prev', 34, 290, 22, 'back', () => flip(-1), { appear: st - 0.2 });
  if (mapPage < pages - 1) roundBtn('pg_next', W - 34, 290, 22, () => { ctx.scale(-1, 1); drawIcon('back', 0, 0, 22); }, () => flip(1), { appear: st - 0.2 });
  for (let p = 0; p < pages; p++) {
    const dx = W / 2 + (p - (pages - 1) / 2) * 20;
    circle(dx, 474, p === mapPage ? 5.5 : 4, p === mapPage ? '#ffd34d' : 'rgba(255,240,200,0.35)', 'rgba(20,10,4,0.8)', 1.2);
  }
  // kahramanlar düğmesi (yeni açılan kahraman varsa rozet)
  const fresh = HERO_ORDER.filter(id => heroUnlocked(id) && !(save.seenHeroes || ['commander']).includes(id));
  gameButton('heroes', W / 2, H - 32, 220, 42, 'KAHRAMANLAR', () => go(() => { screen = 'heroes'; }), 'blue', { icon: 'crown', appear: st - 0.35, size: 18, shine: fresh.length > 0 });
  const freeStars = starsTotal() - starsSpent();
  gameButton('upgrades', W - 126, H - 32, 210, 42, 'GELİŞMELER', () => go(() => { screen = 'upgrades'; }), 'gold', { icon: 'crown', appear: st - 0.4, size: 18, shine: freeStars > 0 });
  if (freeStars > 0) { const bx = W - 30, by = H - 52 + Math.sin(time * 5) * 2; circle(bx, by, 11, '#e8434b', '#fff', 1.5); txt(freeStars + '', bx, by + 1, 12, '#fff', 'center', '400', FONT_T); }
  drawDiffPicker(st);
  if (fresh.length) {
    const bx = W / 2 + 110, by = H - 52 + Math.sin(time * 5) * 2;
    roundRect(bx - 22, by - 10, 44, 20, 10, '#e8434b', '#fff', 1.5); txt('YENİ', bx, by + 1, 11, '#fff', 'center', '400', FONT_T);
  }

  if (Math.random() < 0.15) {
    emit(uiParts, { kind: 'glow', add: true, x: rand(0, W), y: rand(H * 0.4, H), vx: rand(-6, 6), vy: rand(-14, -5),
      col: '255,210,140', s0: rand(1.5, 2.8), s1: 0.5, life: rand(3, 5), a: 0.7, fadeIn: 0.3 });
  }
}

function drawLevelCard(i, cx, cy, at) {
  const p = clamp(at / 0.5, 0, 1);
  if (p <= 0) return;
  const lv = LEVELS[i], e = easeOutBack(p), w = 254, h = 338;
  const unlocked = i === 0 || (save.stars[i - 1] || 0) > 0, st = save.stars[i] || 0;
  const current = unlocked && st === 0;
  const fy = cy + (1 - e) * 80 + (current ? Math.sin(time * 2.2) * 3 : 0);
  const key = 'card' + i, sc = pressScale(key);
  const x0 = -w / 2, y0 = -h / 2;
  ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1); ctx.translate(cx, fy); ctx.scale(sc, sc);
  if (current) glow(ctx, 0, 0, w * 0.85, '255,200,90', 0.3 + Math.sin(time * 3) * 0.1);
  roundRect(x0 + 5, y0 + 12, w, h, 22, 'rgba(0,0,0,0.5)');
  const fr = ctx.createLinearGradient(0, y0, 0, y0 + h);
  fr.addColorStop(0, '#b07a46'); fr.addColorStop(1, '#4a2c14');
  roundRect(x0, y0, w, h, 22, fr, current ? '#ffd34d' : '#22120a', current ? 3.5 : 3);
  const pg = ctx.createLinearGradient(0, y0 + 10, 0, y0 + h - 10);
  pg.addColorStop(0, '#f8ebcc'); pg.addColorStop(1, '#dcc089');
  roundRect(x0 + 10, y0 + 10, w - 20, h - 20, 15, pg, 'rgba(92,58,22,0.6)', 1.5);
  // önizleme görseli
  const tx = x0 + 18, ty = y0 + 18, tw = w - 36, th = 138;
  ctx.save(); ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 11); ctx.clip();
  const T = thumbOf(i);
  if (T) {
    const k = Math.max(tw / T.width, th / T.height), dw = T.width * k, dh = T.height * k;
    ctx.drawImage(T, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh);
  } else {
    const pg2 = ctx.createLinearGradient(0, ty, 0, ty + th); pg2.addColorStop(0, '#6a9a4a'); pg2.addColorStop(1, '#3a5a2a');
    ctx.fillStyle = pg2; ctx.fillRect(tx, ty, tw, th);
  }
  const sh = ctx.createLinearGradient(0, ty + th * 0.5, 0, ty + th);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sh; ctx.fillRect(tx, ty, tw, th);
  ctx.restore();
  roundRect(tx, ty, tw, th, 11, null, '#3a2410', 3);
  roundRect(tx + 2, ty + 2, tw - 4, th - 4, 9, null, 'rgba(255,255,255,0.3)', 1.2);
  // bölüm numarası madalyonu
  const mg = ctx.createLinearGradient(0, y0 + 6, 0, y0 + 46);
  mg.addColorStop(0, '#fff0b0'); mg.addColorStop(1, '#a8681a');
  circle(x0 + 26, y0 + 26, 21, mg, '#2e1606', 2);
  const mb = ctx.createRadialGradient(x0 + 22, y0 + 21, 2, x0 + 26, y0 + 26, 17);
  mb.addColorStop(0, '#f05a4a'); mb.addColorStop(1, '#7a140e');
  circle(x0 + 26, y0 + 26, 16.5, mb);
  txt((i + 1) + '', x0 + 26, y0 + 27, 21, '#fff', 'center', '400', FONT_T);
  txt(lv.name, 0, y0 + 180, 24, '#4a2a0e', 'center', '400', FONT_T, false);
  txt(`${lv.waves.length} dalga  ·  ${DIFF[i] || 'Zor'}`, 0, y0 + 204, 14, '#8a6238', 'center', '800', FONT_B, false);
  for (let s = 0; s < 3; s++) fancyStar((s - 1) * 40, y0 + 238 - (s === 1 ? 4 : 0), s === 1 ? 17 : 15, s < st);
  if (!unlocked) {
    roundRect(x0, y0, w, h, 22, 'rgba(18,10,4,0.62)');
    drawIcon('lock', 0, y0 + 86, 46);
    txt('Kilitli', 0, y0 + 274, 24, '#f0e2c4', 'center', '400', FONT_T);
    txt('Önceki bölümü tamamla', 0, y0 + 298, 13, '#cdb894', 'center', '700', FONT_B, false);
  }
  ctx.restore();
  if (unlocked) {
    const by = fy + (y0 + 290) * sc;
    ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1);
    gameButton(key, cx, by, 176, 46, st ? 'TEKRAR OYNA' : 'OYNA', null, st ? 'gold' : 'green', { icon: st ? 'restart' : 'play', shine: current, size: 19 });
    ctx.restore();
    buttons.push({ key, x: cx - w / 2, y: fy - h / 2, w, h, fn: () => go(() => startLevel(i)) });
  }
}


// gülle patlamalarının zeminde bıraktığı yanık izi
let SCORCH = null;
function scorchTex() {
  if (!SCORCH) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 4, 48, 48, 48);
    gr.addColorStop(0, 'rgba(25,16,8,0.9)'); gr.addColorStop(0.5, 'rgba(40,26,12,0.55)'); gr.addColorStop(1, 'rgba(40,26,12,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    const r = seeded(5);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(20,12,6,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(48 + (r() - 0.5) * 70, 48 + (r() - 0.5) * 70, 1 + r() * 3, 0, Math.PI * 2); g.fill(); }
    SCORCH = c;
  }
  return SCORCH;
}

function drawPlay() {
  const sh = G.shakeT > 0 ? G.shakeAmp * (G.shakeT / G.shakeDur) : 0;
  ctx.save();
  if (sh > 0) ctx.translate(rand(-sh, sh), rand(-sh, sh));
  ctx.drawImage(G.bg, 0, 0, W, H);
  for (const d of G.decals) {
    ctx.globalAlpha = 0.38 * Math.min(1, (d.life - d.t) / 2.5);
    ctx.drawImage(scorchTex(), d.x - d.r, d.y - d.r * 0.5, d.r * 2, d.r);
  }
  ctx.globalAlpha = 1;
  for (const pl of G.plots) if (!pl.tower) drawPlot(pl);
  if (G.sel && G.sel.kind === 'plot') {
    const pl = G.sel.plot, k = clamp((time - G.menuT) / 0.25, 0, 1);
    ctx.strokeStyle = `rgba(255,230,160,${0.9 * k})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 2, 30 + Math.sin(time * 6) * 1.5, 15, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (G.sel && G.sel.kind === 'hero') {
    const hh = G.sel.hero;
    ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(hh.x, hh.y + 2, 16 + Math.sin(time * 6), 8, 0, 0, Math.PI * 2); ctx.stroke();
    if (hh.ranged) { ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(160,230,255,0.5)'; ctx.beginPath(); ctx.ellipse(hh.rx, hh.ry, hh.ranged, hh.ranged * 0.92, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  drawTraps();
  drawIncoming();
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
  drawCoinsWorld();
  for (const p of G.projectiles) drawProjectile(p);
  for (const f of G.effects) if (f.kind !== 'corpse') drawEffect(f);
  drawPartsAll(G.parts);
  for (const f of G.floaters) {
    const k = f.t / 1.1, pop = easeOutBack(clamp(f.t / 0.2, 0, 1));
    ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.scale(pop, pop);
    txt(f.text, 0, 0, 15, f.col, 'center', '400', FONT_T);
    ctx.restore();
  }
  ctx.restore();
  if (G.hurt > 0) {
    // kale hasar alınca ekran kenarları kızarır
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${0.45 * G.hurt / 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawMenu();
  drawHud();
  drawCoinsFlying();
  drawBossBar();
  drawIntro();
  drawBanner();
  if (overlay) drawOverlay();
}

const TIPS = [
  'İpucu: Kışla askerleri düşmanı yolda durdurur, okçular da arkadan vurur.',
  'İpucu: Uçan yarasaları yalnızca okçu ve büyücü kuleleri vurabilir.',
  'İpucu: Kara şövalyenin zırhı kalın; büyücü kulesi zırhı deler.',
];

function drawOverlay() {
  const k = time - overlayT, fade = clamp(k / 0.25, 0, 1);
  ctx.fillStyle = `rgba(12,7,2,${0.62 * fade})`; ctx.fillRect(0, 0, W, H);
  const big = overlay === 'skills';
  const pw = big ? 600 : 470, ph = big ? 400 : 350, cx = W / 2, cy = H / 2 + (big ? 14 : 18), px = cx - pw / 2, py = cy - ph / 2;
  const e = easeOutBack(clamp(k / 0.42, 0, 1));
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15, 0, 1);
  ctx.translate(cx, cy); ctx.scale(e, e); ctx.translate(-cx, -cy);
  if (overlay === 'win') sunburst(cx, py + 110, 300, '255,220,120');
  panel(px, py, pw, ph);
  if (overlay === 'skills') {
    drawSkillsPanel(k, px, py, pw, ph, cx);
  } else if (overlay === 'pause') {
    ribbon(cx, py + 4, 290, 'DURAKLATILDI', 'blue', 26);
    gameButton('ov_resume', cx, py + 104, 270, 52, 'DEVAM ET', () => setOverlay(null), 'green', { icon: 'play', shine: true, appear: k - 0.15 });
    gameButton('ov_restart', cx, py + 176, 270, 52, 'YENİDEN BAŞLA', () => go(() => startLevel(G.idx)), 'gold', { icon: 'restart', appear: k - 0.22 });
    gameButton('ov_map', cx, py + 248, 270, 52, 'HARİTA', () => go(() => { screen = 'map'; setOverlay(null); }), 'wood', { icon: 'map', appear: k - 0.29 });
    roundBtn('ov_snd', px + pw - 46, py + ph - 46, 19, muted ? 'mute' : 'sound', () => setMuted(!muted), { appear: k - 0.35 });
  } else if (overlay === 'win') {
    ribbon(cx, py + 4, 260, 'ZAFER!', 'green', 32);
    for (let s = 0; s < 3; s++) {
      const sx = cx + (s - 1) * 82, sy = py + 112 - (s === 1 ? 14 : 0), r = s === 1 ? 38 : 31;
      fancyStar(sx, sy, r, false);
      if (s >= G.stars) continue;
      const q = clamp((k - 0.45 - s * 0.3) / 0.38, 0, 1);
      if (q <= 0) continue;
      if (!(G.starFx & (1 << s))) {
        G.starFx |= 1 << s; sfx('coin');
        for (let j = 0; j < 16; j++) {
          const a = rand(0, Math.PI * 2), v = rand(80, 200);
          emit(uiParts, { kind: 'glow', add: true, x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, col: j % 2 ? '255,220,100' : '255,255,220', s0: rand(4, 7), s1: 1, life: rand(0.4, 0.7) });
        }
      }
      ctx.save(); ctx.translate(sx, sy); const ss = 2.2 - 1.2 * easeOutBack(q); ctx.scale(ss, ss); ctx.globalAlpha *= q;
      fancyStar(0, 0, r, true);
      ctx.restore();
    }
    const lt = `Kalan can: ${G.lives}/${G.maxLives}`;
    ctx.font = `21px ${FONT_T}`;
    const lw = ctx.measureText(lt).width;
    drawIcon('heart', cx - lw / 2 - 8, py + 182, 22);
    txt(lt, cx + 12, py + 178, 21, '#5a3410', 'center', '400', FONT_T, false);
    const mm = Math.floor(G.t / 60), ss2 = Math.floor(G.t % 60);
    txt(`${G.kills || 0} düşman · ${mm}:${String(ss2).padStart(2, '0')} · ${diff().name}`, cx, py + 206, 13, '#8a6238', 'center', '800', FONT_B, false);
    const appear = k - 1.3;
    if (G.idx + 1 < LEVELS.length) {
      roundBtn('ov_retry', cx - 168, py + 262, 25, 'restart', () => go(() => startLevel(G.idx)), { appear });
      txt('Tekrar', cx - 168, py + 302, 12, '#6a4420', 'center', '800', FONT_B, false);
      roundBtn('ov_map', cx - 104, py + 262, 25, 'map', () => go(() => { screen = 'map'; setOverlay(null); }), { appear: appear - 0.06, style: 'blue' });
      txt('Harita', cx - 104, py + 302, 12, '#6a4420', 'center', '800', FONT_B, false);
      gameButton('ov_next', cx + 70, py + 262, 236, 56, 'SONRAKİ BÖLÜM', () => go(() => startLevel(G.idx + 1)), 'green',
        { icon: 'next', shine: true, breathe: true, appear: appear - 0.12, size: 22, glow: '140,255,120' });
    } else {
      txt('Tüm bölümleri tamamladın!', cx, py + 222, 18, '#3a7a2a', 'center', '400', FONT_T, false);
      gameButton('ov_retry', cx - 100, py + 278, 170, 50, 'TEKRAR', () => go(() => startLevel(G.idx)), 'wood', { icon: 'restart', appear });
      gameButton('ov_map', cx + 100, py + 278, 170, 50, 'HARİTA', () => go(() => { screen = 'map'; setOverlay(null); }), 'green', { icon: 'map', appear: appear - 0.06, shine: true });
    }
  } else if (overlay === 'lose') {
    ribbon(cx, py + 4, 280, 'KALE DÜŞTÜ', 'red', 28);
    ctx.save(); ctx.translate(cx, py + 104); ctx.rotate(Math.sin(time * 2) * 0.05);
    drawIcon('skull', 0, 0, 64); ctx.restore();
    txt(`${G.wave}. dalgada düştün`, cx, py + 164, 22, '#5a3410', 'center', '400', FONT_T, false);
    txt(TIPS[G.idx % TIPS.length], cx, py + 192, 13, '#8a6238', 'center', '700', FONT_B, false);
    gameButton('ov_retry', cx, py + 240, 270, 52, 'TEKRAR DENE', () => go(() => startLevel(G.idx)), 'green', { icon: 'restart', shine: true, appear: k - 0.3 });
    gameButton('ov_map', cx, py + 304, 270, 46, 'HARİTA', () => go(() => { screen = 'map'; setOverlay(null); }), 'wood', { icon: 'map', appear: k - 0.38 });
  }
  ctx.restore();
}

// ---------- giriş ----------
function toLogical(ev) {
  return { x: (ev.clientX - view.ox) / view.scale, y: (ev.clientY - view.oy) / view.scale };
}
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  initAudio();
  if (trans) return;
  const p = toLogical(ev);
  swipe = screen === 'map' ? { x: p.x, y: p.y } : null;
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      press.key = b.key; press.t = time; press.b = b; press.id = ev.pointerId;
      sfx('click');
      return;
    }
  }
  if (screen === 'play' && !overlay) playTap(p.x, p.y);
});
// buton işlevi parmak kalkınca çalışır; parmak butondan kayıp gittiyse iptal olur
function release(ev, cancel) {
  if (swipe && !cancel && screen === 'map') {
    const p = toLogical(ev), dx = p.x - swipe.x;
    swipe = null;
    if (Math.abs(dx) > 50) {
      const pages = Math.ceil(LEVELS.length / 3), np = clamp(mapPage - Math.sign(dx), 0, pages - 1);
      if (np !== mapPage) { mapPage = np; mapPageT = time; sfx('pick'); }
      if (press.key) { pops[press.key] = time; press.key = null; press.b = null; }
      return;
    }
  }
  if (!press.key || (press.id != null && ev.pointerId !== press.id)) return;
  const b = press.b, key = press.key, p = toLogical(ev), pad = 16;
  press.key = null; press.b = null;
  pops[key] = time;
  if (cancel || trans) return;
  if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) b.fn();
}
window.addEventListener('pointerup', (ev) => release(ev, false));
window.addEventListener('pointercancel', (ev) => release(ev, true));

const hit = (b, x, y, pad = 6) => dist(b.x, b.y, x, y) <= b.r + pad;

function playTap(x, y) {
  // HUD
  if (hit(HUD.pause, x, y)) { tapPop('hud_pause'); sfx('click'); setOverlay('pause'); return; }
  if (hit(HUD.speed, x, y)) { tapPop('hud_speed'); sfx('click'); speed = speed >= 3 ? 1 : speed + 1; return; }
  if (hit(HUD.mute, x, y)) { tapPop('hud_mute'); setMuted(!muted); sfx('click'); return; }
  for (let i = 0; i < G.heroes.length; i++) {
    const h = G.heroes[i], hb = HUD.heroes[i], bd = heroBadge(hb);
    if (dist(bd.x, bd.y, x, y) <= bd.r + 6) { tapPop('hb' + i); openSkills(h); return; }
    if (hit(hb, x, y)) {
      tapPop('hud_hero' + i); G.mode = null;
      setSel((G.sel && G.sel.hero === h) || h.dead ? null : { kind: 'hero', hero: h });
      sfx('select');
      return;
    }
  }
  // yerdeki altınlar: dokununca çevredekilerle birlikte hemen toplanır
  for (const c of G.coins) {
    if (c.state === 'fly' || dist(c.x, c.y - c.z - 3, x, y) > 16) continue;
    for (const o of G.coins) if (o.state !== 'fly' && dist(o.x, o.y, c.x, c.y) < 55) collectCoin(o);
    return;
  }
  for (const id of ['meteor', 'reinforce']) {
    if (hit(HUD[id], x, y)) {
      tapPop('hud_' + id);
      setSel(null);
      if (G.spells[id] > 0) { sfx('error'); return; }
      G.mode = G.mode && G.mode.id === id ? null : { kind: 'spell', id };
      if (G.mode) sfx('spell');
      return;
    }
  }
  // dalga butonu
  if (waveCallable()) {
    for (const pi of nextWavePaths()) {
      const b = waveButtonPos(pi);
      if (dist(b.x, b.y, x, y) < 30) { tapPop('wave' + pi); waveBonusAndStart(); return; }
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
        G.effects.push({ kind: 'ring', x: px, y: py, r: 22, col: '120,180,255', t: 0, dur: 0.4 });
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
      if (dist(it.x, it.y, x, y) <= MENU_R + 8) {
        const same = G.preview && G.preview.id === it.id && G.preview.type === it.type;
        tapPop('mi' + it.id + (it.type || ''));
        if (it.id === 'rally') { const tw = G.sel.tower; setSel(null); G.mode = { kind: 'rally', tower: tw }; sfx('pick'); return; }
        if (it.id === 'max') return;
        if (!same) { G.preview = it; sfx('pick'); return; }
        if (it.id === 'build') { if (buildTower(G.sel.plot, it.type)) setSel(null); else sfx('error'); }
        else if (it.id === 'upgrade') { if (upgradeTower(G.sel.tower)) { G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'ability') { if (it.cost != null && buyAbility(G.sel.tower, it.type)) G.preview = null; else sfx('error'); }
        else if (it.id === 'sell') { sellTower(G.sel.tower); setSel(null); }
        return;
      }
    }
  }
  const wasHero = G.sel && G.sel.kind === 'hero' && G.sel.hero;
  // kahraman hareketi
  if (wasHero) {
    setSel(null);
    const h = wasHero;
    if (dist(h.x, h.y - 8, x, y) < 18) return;
    h.rx = clamp(x, 10, W - 10); h.ry = clamp(y, 60, H - 10);
    releaseSoldier(h); h.moving = true;
    G.effects.push({ kind: 'ring', x: h.rx, y: h.ry, r: 20, col: '120,220,255', t: 0, dur: 0.45 });
    return;
  }
  // kahramanı seç
  for (const h of G.heroes) {
    if (!h.dead && dist(h.x, h.y - 10, x, y) < 22) { setSel({ kind: 'hero', hero: h }); sfx('select'); return; }
  }
  // kule
  for (const t of G.towers) {
    if (Math.abs(x - t.x) < 32 && y < t.y + 20 && y > t.y - 88) {
      if (G.sel && G.sel.tower === t) { setSel(null); return; }
      setSel({ kind: 'tower', tower: t }); sfx('select'); return;
    }
  }
  // boş arsa
  for (const pl of G.plots) {
    if (!pl.tower && dist(pl.x, pl.y, x, y) < 32) {
      if (G.sel && G.sel.plot === pl) { setSel(null); return; }
      setSel({ kind: 'plot', plot: pl }); sfx('select'); return;
    }
  }
  setSel(null);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play' && !overlay) setOverlay('pause');
});

// ---------- döngü ----------
let last = performance.now();
function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now; time += real;
  adaptQuality(real);
  if (bgDirty && time - bgDirty > 0.3) {
    bgDirty = 0;
    if (G) G.bg = renderBackground(G.lv, G.paths);
    for (const k in THUMB) delete THUMB[k];
  }
  if (screen === 'play' && !overlay && !trans) {
    for (let i = 0; i < speed; i++) update(real);
  }
  if (trans) {
    trans.t += real;
    if (!trans.fired && trans.t >= 0.22) { trans.fired = true; uiParts = []; trans.fn(); screenT = time; }
    if (trans.t >= 0.5) trans = null;
  }
  uiParts = updateParts(uiParts, real);
  // çizim
  const { dpr, scale, ox, oy } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1d1a14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  buttons.length = 0;
  if (screen === 'title') drawTitle();
  else if (screen === 'map') drawMap();
  else if (screen === 'heroes') drawHeroes();
  else if (screen === 'upgrades') drawUpgrades();
  else drawPlay();
  drawPartsAll(uiParts);
  if (trans) {
    const a = trans.t < 0.22 ? trans.t / 0.22 : 1 - (trans.t - 0.22) / 0.28;
    ctx.fillStyle = `rgba(8,5,2,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  if (view.ch > view.cw * 1.1) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    roundRect(view.cw / 2 - 150, view.ch - 60, 300, 40, 20, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
    txt('Telefonu yan çevir ↻', view.cw / 2, view.ch - 40, 16, '#ffd34d', 'center', '400', FONT_T);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// test/geliştirme kancası
window.__game = {
  get G() { return G; }, get overlay() { return overlay; }, get screen() { return screen; }, startLevel, setSpeed: (s) => { speed = s; },
  build: (i, type) => buildTower(G.plots[i], type), upgrade: (i) => G.plots[i].tower && upgradeTower(G.plots[i].tower),
  wave: () => waveBonusAndStart(), cast: castSpell, setOverlay, buy: buyAbility, selectTower: (t) => setSel({ kind: 'tower', tower: t }), select: (i) => setSel({ kind: 'plot', plot: G.plots[i] }),
  goMap: () => { screen = 'map'; screenT = time; }, goHeroes: () => { screen = 'heroes'; screenT = time; }, goUpgrades: () => { screen = 'upgrades'; screenT = time; },
  learn: (i, pi) => learnSkill(G.heroes[i], pi), kill: (e) => damageEnemy(e, 1e9, 'true'), openSkills: (i) => openSkills(G.heroes[i]), save: () => save,
  sim(seconds, dt = 1 / 30) { for (let t = 0; t < seconds && !overlay; t += dt) update(dt); return overlay; },
};
})();

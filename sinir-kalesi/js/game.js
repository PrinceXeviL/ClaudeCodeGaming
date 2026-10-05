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
fetch('img/manifest.json', { cache: 'no-cache' }) // liste değişince eski kopya kullanılmasın
  .then(r => (r.ok ? r.json() : []))
  .then(list => list.forEach(file => {
    const name = file.replace(/\.(png|svg|jpg|webp)$/, '');
    const im = new Image();
    im.onload = () => {
      let out = im;
      if (file.endsWith('.svg')) {
        out = document.createElement('canvas');
        out.width = im.naturalWidth * 2; out.height = im.naturalHeight * 2;
        out.getContext('2d').drawImage(im, 0, 0, out.width, out.height);
      }
      SPR[name] = out;
      if (/^(grass_|road|tree_|rock_|castle|s2_)/.test(name)) bgDirty = Math.max(time, 0.001);
    };
    im.src = 'img/' + file;
  }))
  .catch(() => {});
// Boyama sprite'larının kaynak ölçüleri (aynı sayfadaki kulelerin göreli boyu korunur)
const SPR_META = {};
fetch('img/meta.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).then(m => Object.assign(SPR_META, m)).catch(() => {});
// Oyun içi boyutlar (mantıksal px). Karakterler yüksekliğe göre, kule ve dekor kaynak ölçeğe göre.
const CHAR_H = {
  enemy_goblin: 24, enemy_wolf: 23, enemy_bandit: 27, enemy_orc: 32, enemy_bat: 26,
  enemy_shaman: 29, enemy_knight: 32, enemy_troll: 54, hero: 29, soldier: 21, militia: 21,
};
for (const k in ENEMIES) if (ENEMIES[k].h) CHAR_H['enemy_' + k] = ENEMIES[k].h;
// Ortak ölçekler: UNIT_K tüm birimler (asker, kahraman, düşman), BUILD_K binalar (kule, kale, arsa),
// ROAD_K yol genişliği. ZOOM_MAX: en yakın zoom (arka plan dokusunun keskin kaldığı sınır).
const UNIT_K = 0.8, BUILD_K = 0.81, ROAD_K = 1.32, ZOOM_MAX = 2.5;
for (const k in CHAR_H) CHAR_H[k] *= UNIT_K;
const TOWER_K = 0.12 * BUILD_K, TREE_K = 0.105, ROCK_K = 0.075;
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
  death:   { vol: 0.22, gap: 0.1, max: 2, rate: [0.9, 1.15] },
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
  // dosyasız, WebAudio ile üretilen sesler: gök gürültüsü ve hava ortam sesleri
  thunder: { vol: 0.9 },
  rain:    { vol: 0.11 },
  wind:    { vol: 0.08 },
  spell:   { vol: 0.45, gap: 0.2, max: 1 },
  reinforce: { vol: 0.55, gap: 0.2, max: 1 },
};
let actx = null, master = null;
let muted = false;
try { muted = localStorage.getItem('sinirKalesi.muted') === '1'; } catch (e) {}
const rawSnd = {};   // ad -> ArrayBuffer (ses bağlamı açılmadan önce indirilir)
const SND = {};      // tür -> [AudioBuffer]
const sndState = {}; // tür -> { last, playing }

fetch('ses/manifest.json', { cache: 'no-cache' })
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

// Arayüz sesleri: ince/tiz dosyalar yerine sentezlenmiş dolgun "pop" sesleri
// (mobil oyunlardaki yumuşak, tahta-kabarcık hissi veren düğme sesi: perdesi hızla düşen sinüs + kısa tık)
let NOISE_BUF = null;
function noiseBuf() {
  if (NOISE_BUF) return NOISE_BUF;
  const n = Math.floor(actx.sampleRate * 0.3), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (NOISE_BUF = b);
}
function uiPop(t0, f0, f1, dur, vol, out) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.7);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
  // gövde: bir oktav üstte hafif üçgen dalga (sese dolgunluk verir)
  const o2 = actx.createOscillator(), g2 = actx.createGain();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(f0 * 2, t0); o2.frequency.exponentialRampToValueAtTime(f1 * 2, t0 + dur * 0.5);
  g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(vol * 0.22, t0 + 0.003); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
  o2.connect(g2); g2.connect(out); o2.start(t0); o2.stop(t0 + dur);
}
function uiTick(t0, f, vol, out) {
  const n = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
  n.buffer = noiseBuf(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.2;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.018);
  n.connect(bp); bp.connect(g); g.connect(out); n.start(t0); n.stop(t0 + 0.03);
}
const UI_LAST = {};
function uiSound(kind) {
  const now = actx.currentTime;
  if (now - (UI_LAST[kind] || -1) < 0.045) return true;
  UI_LAST[kind] = now;
  const out = actx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 2400; out.connect(master);
  if (kind === 'click') { uiTick(now, 1500, 0.07, out); uiPop(now, 380, 150, 0.12, 0.42, out); }
  else if (kind === 'select') { uiTick(now, 1800, 0.06, out); uiPop(now, 460, 190, 0.1, 0.36, out); uiPop(now + 0.055, 620, 300, 0.09, 0.22, out); }
  else if (kind === 'pick') { uiTick(now, 1600, 0.05, out); uiPop(now, 420, 210, 0.09, 0.32, out); }
  else if (kind === 'open') {
    uiPop(now, 260, 120, 0.14, 0.3, out);
    const n = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
    n.buffer = noiseBuf(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(450, now); bp.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.09, now + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(now); n.stop(now + 0.17);
  } else return false;
  return true;
}
// Dalga çağırma: uzaktan gelen yumuşak bir borazan ve iki boğuk savaş davulu (yorucu olmayan, alçak ses)
function waveSound() {
  const t = actx.currentTime;
  const out = actx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 900; out.Q.value = 0.5; out.connect(master);
  for (const [f, v] of [[196, 0.07], [293.7, 0.05]]) {
    const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    lfo.frequency.value = 5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t + 0.12); g.gain.exponentialRampToValueAtTime(v, t + 0.35);
    g.gain.setValueAtTime(v, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    o.connect(g); g.connect(out); o.start(t + 0.1); lfo.start(t + 0.1); o.stop(t + 1.3); lfo.stop(t + 1.3);
  }
  for (const dt of [0, 0.3]) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(95, t + dt); o.frequency.exponentialRampToValueAtTime(50, t + dt + 0.25);
    g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.32, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.3);
    o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.32);
  }
}

function sfx(kind) {
  if (muted || !actx) return;
  if (kind === 'wave') { const st = sndState.wave || (sndState.wave = { last: -9, playing: 0 }); if (actx.currentTime - st.last > 0.6) { st.last = actx.currentTime; waveSound(); } return; }
  if ((kind === 'click' || kind === 'select' || kind === 'pick' || kind === 'open') && uiSound(kind)) return;
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

// Ölüm sesleri: yaratık türüne göre kısa, sentezlenmiş "ah/uh" sesleri (ses dosyası gerekmez).
// Testere dalgası (gırtlak) iki ünlü formant süzgecinden geçer; perde düşer, genlik söner.
const VOWEL = { a: [800, 1200], e: [450, 1900], i: [320, 2300], o: [500, 900], u: [350, 750] };
const VOICE = {
  goblin:  { f0: [300, 185], v: 'e', dur: 0.2,  vol: 0.08 },
  wolf:    { f0: [560, 330], v: 'u', dur: 0.24, vol: 0.06, wave: 'triangle' },
  bandit:  { f0: [150, 92],  v: 'u', dur: 0.28, vol: 0.1 },
  orc:     { f0: [100, 62],  v: 'o', dur: 0.34, vol: 0.11, growl: 28 },
  bat:     { f0: [760, 520], v: 'i', dur: 0.12, vol: 0.045, wave: 'triangle' },
  shaman:  { f0: [190, 115], v: 'a', dur: 0.32, vol: 0.09 },
  knight:  { f0: [125, 80],  v: 'u', dur: 0.3,  vol: 0.1, clank: true },
  troll:   { f0: [72, 42],   v: 'o', dur: 0.55, vol: 0.13, growl: 22 },
};
let voiceLast = 0, voicePlaying = 0;
function deathVoice(e) {
  if (muted || !actx) return;
  const def = e.def, V = VOICE[def.base || e.type] || VOICE.bandit, now = actx.currentTime;
  if (now - voiceLast < 0.12 || voicePlaying >= 3) return; // kalabalıkta üst üste binmesin
  voiceLast = now; voicePlaying++;
  const p = rand(0.92, 1.08) * (def.chief ? 0.8 : 1), dur = V.dur * (def.chief ? 1.5 : 1);
  const osc = actx.createOscillator(); osc.type = V.wave || 'sawtooth';
  osc.frequency.setValueAtTime(V.f0[0] * p, now);
  osc.frequency.exponentialRampToValueAtTime(V.f0[1] * p, now + dur);
  const amp = actx.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(V.vol, now + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  amp.connect(master);
  let last = amp;
  if (V.growl) { // hırıltı: genliği hızlı titreten LFO
    const lfo = actx.createOscillator(), lg = actx.createGain(), tr = actx.createGain();
    lfo.frequency.value = V.growl; lg.gain.value = 0.45; tr.gain.value = 0.6;
    lfo.connect(lg); lg.connect(tr.gain); tr.connect(amp); last = tr;
    lfo.start(now); lfo.stop(now + dur + 0.05);
  }
  if (V.v) {
    for (const [i, f] of VOWEL[V.v].entries()) {
      const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (def.chief ? 0.9 : 1); bp.Q.value = i ? 9 : 6;
      const g = actx.createGain(); g.gain.value = i ? 0.6 : 1;
      osc.connect(bp); bp.connect(g); g.connect(last);
    }
  } else osc.connect(last);
  osc.start(now); osc.stop(now + dur + 0.05);
  osc.onended = () => { voicePlaying--; };
  if (V.clank) sfx('clash');
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
  // ----- 2. sefer (Kızılkum): kum zemini, hurma/kaktüs, kumtaşı/sütun/heykel; treeSpr/rockSpr dekor listeleri -----
  desert: { tex: 'desert', grass: '#d8884a', grass2: '#a85a34', patch: ['#d8884a', '#a85a34'], trees: 9, rocks: 9, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#a8703e', '#ecc890', '#7a4a24'], tuft: ['#9a8840', '#c4ac5a'], stone: ['#b08a60', '#e0c090'], light: 'rgba(255,220,150,0.2)', amb: '255,220,160', flowers: 0, roadTint: 'rgba(222,150,84,0.4)',
    treeSpr: ['s2_palm_1', 's2_palm_2', 's2_palm_3', 's2_palm_4', 's2_cactus'], rockSpr: ['s2_rock_1', 's2_rock_2'], treeK: 1.35 },
  oasis:  { tex: 'desert', grass: '#d8904e', grass2: '#a86238', patch: ['#d8904e', '#a86238'], trees: 22, rocks: 5, treeCol: ['#3a6a2a', '#4a7a3a', '#5a8a4a'], road: ['#a8703e', '#ecc890', '#7a4a24'], tuft: ['#6a8a34', '#8aa846'], stone: ['#b08a60', '#e0c090'], light: 'rgba(255,230,160,0.2)', amb: '220,255,180', flowers: 0, roadTint: 'rgba(222,150,84,0.4)',
    treeSpr: ['s2_palm_1', 's2_palm_2', 's2_palm_double', 's2_palm_3', 's2_palm_4'], rockSpr: ['s2_rock_1', 's2_rock_2'], treeK: 1.35, ponds: 3, bushes: 16 },
  canyon: { tex: 'desert', tint: 'rgba(120,40,20,0.2)', grass: '#b86a40', grass2: '#7a3a22', patch: ['#b86a40', '#7a3a22'], trees: 4, rocks: 26, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#8a5a34', '#d4a874', '#5a361c'], tuft: ['#8a7a3a', '#a8964a'], stone: ['#9a6a48', '#c89870'], light: 'rgba(255,190,120,0.2)', amb: '255,190,140', flowers: 0, roadTint: 'rgba(190,110,60,0.38)',
    treeSpr: ['s2_cactus'], rockSpr: ['s2_rock_1', 's2_rock_2', 's2_rock_1'], treeK: 1.35, rockK: 1.3 },
  salt:   { tex: 'desert', tint: 'rgba(246,240,232,0.66)', grass: '#efe6da', grass2: '#c8b8a4', patch: ['#efe6da', '#c8b8a4'], trees: 3, rocks: 8, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#a89070', '#e4d4bc', '#7a644a'], tuft: ['#c8bca8', '#e8e0d4'], stone: ['#c4b49c', '#ece4d8'], light: 'rgba(255,250,235,0.22)', amb: '255,255,240', flowers: 0, roadTint: 'rgba(240,226,206,0.5)',
    treeSpr: ['s2_cactus'], rockSpr: ['s2_rock_2', 's2_rock_1'], treeK: 1.35 },
  ruins:  { tex: 'desert', grass: '#d08450', grass2: '#9a5a36', patch: ['#d08450', '#9a5a36'], trees: 6, rocks: 16, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#9a7a5a', '#d8c4a4', '#6a5038'], tuft: ['#9a8840', '#c4ac5a'], stone: ['#b8a888', '#e4d8bc'], light: 'rgba(255,210,150,0.2)', amb: '255,220,160', flowers: 0, roadTint: 'rgba(210,170,120,0.35)',
    treeSpr: ['s2_palm_3', 's2_palm_4', 's2_cactus'], rockSpr: ['s2_column', 's2_head', 's2_rock_1', 's2_column', 's2_rock_2'], treeK: 1.35, rockK: 1.25 },
  dunes:  { tex: 'desert', tint: 'rgba(255,160,80,0.12)', grass: '#e0904c', grass2: '#b0623a', patch: ['#e0904c', '#b0623a'], trees: 3, rocks: 4, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#b07a44', '#f0d098', '#80502a'], tuft: ['#a89040', '#c8b05a'], stone: ['#b08a60', '#e0c090'], light: 'rgba(255,220,150,0.25)', amb: '255,220,160', flowers: 0, roadTint: 'rgba(222,150,84,0.4)',
    treeSpr: ['s2_cactus', 's2_palm_1'], rockSpr: ['s2_rock_2', 's2_head'], treeK: 1.35 },
  tombs:  { tex: 'desert', tint: 'rgba(70,30,30,0.3)', grass: '#9a6448', grass2: '#5a3424', patch: ['#9a6448', '#5a3424'], trees: 2, rocks: 22, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#7a5a44', '#b8987a', '#4a3424'], tuft: ['#7a6a3a', '#9a8848'], stone: ['#8a7464', '#b8a08c'], light: 'rgba(200,150,120,0.15)', amb: '180,255,170', flowers: 0, roadTint: 'rgba(150,100,70,0.35)',
    treeSpr: ['s2_cactus'], rockSpr: ['s2_head', 's2_rock_1', 's2_column', 's2_rock_2'], treeK: 1.35, rockK: 1.2 },
  temple: { tex: 'desert', tint: 'rgba(255,210,120,0.15)', grass: '#e09a54', grass2: '#b06a3a', patch: ['#e09a54', '#b06a3a'], trees: 8, rocks: 14, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#b89a6a', '#f0dcb0', '#806a44'], tuft: ['#9a8840', '#c4ac5a'], stone: ['#d4bc8c', '#f4e4bc'], light: 'rgba(255,230,150,0.28)', amb: '255,230,150', flowers: 0, roadTint: 'rgba(230,190,120,0.35)',
    treeSpr: ['s2_palm_1', 's2_palm_2', 's2_palm_double'], rockSpr: ['s2_column', 's2_column', 's2_head'], treeK: 1.35, rockK: 1.3 },
  palace: { tex: 'desert', grass: '#d88a4c', grass2: '#a85a34', patch: ['#d88a4c', '#a85a34'], trees: 12, rocks: 10, treeCol: ['#4a6a2a', '#5a7a3a', '#6a8a4a'], road: ['#b49a74', '#ecdcbc', '#7c664a'], tuft: ['#7a9a3a', '#9ab04a'], stone: ['#d4bc8c', '#f4e4bc'], light: 'rgba(255,210,150,0.22)', amb: '255,200,140', flowers: 0, roadTint: 'rgba(230,190,130,0.35)',
    treeSpr: ['s2_palm_double', 's2_palm_2', 's2_palm_1'], rockSpr: ['s2_column', 's2_rock_1', 's2_head'], treeK: 1.35, rockK: 1.2, bushes: 8 },
  rocky:  { grass: '#a3ad6e', grass2: '#7f8c52', patch: ['#a0a878', '#5f6a40'], trees: 12, rocks: 22, treeCol: ['#3a5a2a', '#4d7236', '#628a44'], road: ['#6a6058', '#b0a690', '#4a4239'], tuft: ['#6f7a40', '#8f9a55'], stone: ['#8d877c', '#bdb6a6'], light: 'rgba(255,214,150,0.18)' },
};

// Bölüm arka planının piksel yoğunluğu: en yakın zoomda ekran pikseline yetecek kadar (2x..4x).
function bgRes() {
  return clamp(Math.ceil(view.scale * view.dpr * ZOOM_MAX), 2, 4);
}
// Yol yüzeyi ayrıntısı: ayrı katmanda çizilir, yol şekline kırpılıp zemine basılır.
// Tonal lekeler (dövülmüş toprak), çatlaklar ve yer yer gömülü yassı taş kümeleri.
// Kendi rastgele dizisini kullanır; ağaç/kaya yerleşimi değişmesin.
function drawRoadDetail(g, c, res, paths, th, rr) {
  const R = ROAD_K;
  const det = document.createElement('canvas'); det.width = c.width; det.height = c.height;
  const d = det.getContext('2d'); d.scale(res, res);
  const hex = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  for (const p of paths) {
    // tonal lekeler: koyu ezilmiş ve açık kurumuş bölgeler
    for (let s = 0; s < p.total; s += 7) {
      const q = pathPos(p, s, (rr() - 0.5) * 34 * R), dark = rr() < 0.55;
      d.fillStyle = dark ? hex(th.road[2], 0.05 + rr() * 0.07) : `rgba(255,244,214,${0.05 + rr() * 0.06})`;
      d.beginPath(); d.ellipse(q.x, q.y, 5 + rr() * 13, 3 + rr() * 7, rr() * 3, 0, Math.PI * 2); d.fill();
    }
    // çatlaklar: kırık çizgi, altında ince açık kenar (derinlik)
    for (let s = 10 + rr() * 30; s < p.total; s += 26 + rr() * 46) {
      const q = pathPos(p, s, (rr() - 0.5) * 30 * R);
      let x = q.x, y = q.y, a = rr() * Math.PI * 2;
      const pts = [[x, y]], n = 3 + Math.floor(rr() * 3);
      for (let k = 0; k < n; k++) { a += (rr() - 0.5) * 1.4; const l = 2.5 + rr() * 4; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
      const line = (dx, dy) => { d.beginPath(); pts.forEach((t, i) => i ? d.lineTo(t[0] + dx, t[1] + dy) : d.moveTo(t[0] + dx, t[1] + dy)); d.stroke(); };
      d.lineCap = 'round'; d.lineJoin = 'round';
      d.strokeStyle = 'rgba(255,240,210,0.28)'; d.lineWidth = 0.9; line(0.5, 0.7);
      d.strokeStyle = hex(th.road[2], 0.55); d.lineWidth = 0.8; line(0, 0);
      if (rr() < 0.5) { // kısa yan kol
        const t = pts[1 + Math.floor(rr() * (pts.length - 1))], b = a + (rr() < 0.5 ? 1 : -1) * (0.9 + rr() * 0.6), l = 2 + rr() * 3;
        d.beginPath(); d.moveTo(t[0], t[1]); d.lineTo(t[0] + Math.cos(b) * l, t[1] + Math.sin(b) * l); d.stroke();
      }
    }
    // gömülü yassı taş kümeleri: yüzeyle aynı hizada, hafif gölgeli
    for (let s = 30 + rr() * 60; s < p.total; s += 70 + rr() * 90) {
      const q = pathPos(p, s, (rr() - 0.5) * 22 * R), n = 3 + Math.floor(rr() * 4);
      for (let k = 0; k < n; k++) {
        const x = q.x + (rr() - 0.5) * 14, y = q.y + (rr() - 0.5) * 9, r = 2.4 + rr() * 2.6, sides = 5 + Math.floor(rr() * 3), rot = rr() * 6;
        const poly = (dx, dy, kk) => { d.beginPath(); for (let i = 0; i < sides; i++) { const an = rot + i / sides * Math.PI * 2, rad = r * kk * (0.8 + ((i * 37 + k * 11) % 7) / 20); d[i ? 'lineTo' : 'moveTo'](x + dx + Math.cos(an) * rad * 1.25, y + dy + Math.sin(an) * rad * 0.85); } d.closePath(); };
        d.fillStyle = 'rgba(40,26,12,0.28)'; poly(0.6, 1, 1.08); d.fill();
        d.fillStyle = hex(th.stone[0], 0.85); poly(0, 0, 1); d.fill();
        d.fillStyle = hex(th.stone[1], 0.6); poly(-r * 0.22, -r * 0.2, 0.55); d.fill();
      }
    }
  }
  // yol şekline kırp
  d.globalCompositeOperation = 'destination-in';
  d.lineJoin = 'round'; d.lineCap = 'round'; d.lineWidth = 40 * R; d.strokeStyle = '#000';
  d.beginPath(); for (const p of paths) p.pts.forEach((q, i) => i ? d.lineTo(q[0], q[1]) : d.moveTo(q[0], q[1])); d.stroke();
  g.drawImage(det, 0, 0, W, H);
}

function renderBackground(lv, paths, res = 2) {
  const c = document.createElement('canvas');
  c.width = W * res; c.height = H * res;
  const g = c.getContext('2d');
  g.scale(res, res);
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
  const R = ROAD_K;
  strokePath(52 * R, th.road[2]); g.restore();
  strokePath(56 * R, 'rgba(40,28,12,0.18)');
  strokePath(50 * R, th.road[2]);
  strokePath(46 * R, th.road[0]);
  const roadTex = spr('road');
  if (roadTex) {
    const pat = g.createPattern(roadTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(0.5));
    strokePath(42 * R, pat);
    if (th.roadTint) strokePath(42 * R, th.roadTint); // çölde yol kum rengine boyanır
  } else strokePath(42 * R, th.road[1]);
  // kenara doğru koyulaşan iç gölge: kenar yumuşak bir eğimle çimene karışır
  for (let k = 0; k < 4; k++) strokePath((42 - k * 6) * R, `rgba(255,240,205,${0.035 + k * 0.012})`);
  strokePath(14 * R, 'rgba(255,244,215,0.08)');
  // Kavşaklar: bir yolun kenar süsleri (taş, çimen tutamı) başka bir yolun üstüne düşmesin.
  // Ortak gövdede tekerlek izlerini yalnız ilk yol çizer, öbürü onun yüzeyine iz bırakmaz.
  const onRoad = (p, x, y, onlyBefore) => {
    for (const o of paths) {
      if (o === p) { if (onlyBefore) break; continue; }
      if (nearestOnPaths([o], x, y).d < 19 * R) return true;
    }
    return false;
  };
  drawRoadDetail(g, c, res, paths, th, seeded(lv.name.length * 131 + lv.plots.length * 7));
  // çakıllar ve kenar taşları
  for (const p of paths) {
    for (let d = 0; d < p.total; d += 7) {
      const q = pathPos(p, d, (rnd() - 0.5) * 36 * R);
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,60,30,0.22)' : 'rgba(255,240,200,0.22)';
      g.beginPath(); g.arc(q.x, q.y, 0.8 + rnd() * 1.6, 0, Math.PI * 2); g.fill();
    }
    for (let d = 0; d < p.total; d += 16 + rnd() * 30) {
      const side = rnd() < 0.5 ? -1 : 1, q = pathPos(p, d, side * (22 * R + rnd() * 3)), r = 1.8 + rnd() * 2.4;
      if (onRoad(p, q.x, q.y)) { rnd(); continue; } // rastgele dizi kaymasın diye aynı sayıda çekilir
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(q.x + 1, q.y + 1.2, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone[0]; g.beginPath(); g.ellipse(q.x, q.y, r * 1.2, r * 0.85, rnd(), 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone[1]; g.beginPath(); g.ellipse(q.x - r * 0.3, q.y - r * 0.3, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // yol kenarına taşan çimen tutamları: düz çizgi yerine organik, yumuşak bir sınır
  const tuft = (x, y, s, col, skip) => {
    g.strokeStyle = col; g.lineWidth = 1.3 * s; g.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.38 + (rnd() - 0.5) * 0.3, len = (4 + rnd() * 4) * s;
      if (skip) continue;
      g.beginPath(); g.moveTo(x + (k - 2) * 1.2 * s, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  };
  for (const p of paths) {
    for (let d = 0; d < p.total; d += 3.2) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const q = pathPos(p, d, side * (20 * R + rnd() * 6));
        tuft(q.x, q.y + 2, 0.7 + rnd() * 0.5, rnd() < 0.5 ? th.tuft[0] : th.tuft[1], onRoad(p, q.x, q.y));
      }
    }
  }

  const blocked = (x, y, pad) => {
    if (nearestOnPaths(paths, x, y).d < 36 + 21 * (R - 1) + pad) return true;
    for (const pl of lv.plots) if (dist(x, y, pl[0], pl[1]) < 38 + pad) return true;
    if (y < 52 && (x < 300 || x > 860)) return true;
    if (y > 465 && x < 230) return true;
    if (Math.abs(x - lv.castle[0]) < 75 + pad && y > lv.castle[1] - 130 && y < lv.castle[1] + 30 + pad) return true;
    return false;
  };
  // vaha gölleri ve çalılar (yerde, gölgesiz)
  for (let i = 0, n = 0; i < 300 && n < (th.ponds || 0); i++) {
    const x = 90 + rnd() * (W - 180), y = 90 + rnd() * (H - 180), im = spr('s2_pond_2');
    if (blocked(x, y, 34) || !im) continue;
    n++;
    drawSprite(g, im, x, y, 60 + rnd() * 30, 0.5);
    for (let k = 0; k < 4; k++) { const b = spr('s2_bush_' + (1 + (k % 2))); if (b) drawSprite(g, b, x + (rnd() - 0.5) * 80, y + 18 + rnd() * 10, 16 + rnd() * 8); }
  }
  for (let i = 0, n = 0; i < 400 && n < (th.bushes || 0); i++) {
    const x = rnd() * W, y = rnd() * H, b = spr('s2_bush_' + (1 + (i % 2)));
    if (blocked(x, y, 6) || !b) continue;
    n++; drawSprite(g, b, x, y + 4, 12 + rnd() * 10);
  }
  // kayalar
  for (let i = 0, n = 0; i < 400 && n < th.rocks; i++) {
    const x = rnd() * W, y = rnd() * H, s = 4 + rnd() * 9;
    if (blocked(x, y, s)) continue;
    n++;
    const rockName = th.rockSpr ? th.rockSpr[n % th.rockSpr.length] : 'rock_' + (1 + (n % 2)), rockIm = spr(rockName);
    if (rockIm) {
      const m = SPR_META[rockName], w = m ? m[0] * ROCK_K * (th.rockK || 1) * (s / 8) : s * 3;
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
    const treeName = th.treeSpr ? th.treeSpr[Math.floor(x * 7 + y * 13) % th.treeSpr.length] : 'tree_' + (1 + Math.floor((x * 7 + y * 13) % 3)), treeIm = spr(treeName);
    if (treeIm) {
      const m = SPR_META[treeName], w = m ? m[0] * TREE_K * (th.treeK || 1) * (0.75 + (s - 10) / 9 * 0.4) : s * 3.4;
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
  for (let i = 0; i < (th.flowers ?? 80); i++) {
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
// Kamera: (x, y) görünen alanın sol üst köşesi (dünya koordinatı), z yakınlaştırma (1 = tüm harita)
const cam = { z: 1, x: 0, y: 0 };
let zoomGoal = null; // fare tekerleği / klavye: yumuşak geçiş hedefi { z, sx, sy }
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
    bg: renderBackground(lv, paths, bgRes()),
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
    weather: lv.weather || null, wspd: (WEATHER[lv.weather] || {}).speed ?? 1,
    ground: [], // yer seviyesi efektleri (ayak tozu, yağmur sıçraması): birimlerin altında çizilir
  };
  cam.z = 1; cam.x = 0; cam.y = 0; zoomGoal = null;
  initWeather();
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
// Kahramanların genel gücü (can, saldırı ve yetenek hasarı) bu çarpanla ölçeklenir
// Kahraman dengesi: HERO_POWER hasar ve yetenek hasarı, HERO_HP can ve can yenileme çarpanı
const HERO_POWER = 0.64, HERO_HP = 0.64;
// Düşmanların kahramanlara saldırganlığı: yakından geçen düşman kahramana saldırmak için durur
// (bir kahramana en çok HERO_AGGRO.max düşman), kahramana vuruşları HERO_AGGRO.dmg kat sert
const HERO_AGGRO = { r: 30, max: 3, dmg: 1.3 };
let HERO_SKILL = false; // yetenek hasarı işlenirken true
function heroStats(h) {
  const d = h.def, lk = 1 + 0.2 * (h.lvl - 1), k = lk * HERO_POWER, L = h.learned;
  const ratio = h.maxHp ? h.hp / h.maxHp : 1;
  h.maxHp = Math.round(d.hp * lk * HERO_HP); h.hp = Math.min(h.maxHp, h.maxHp * ratio);
  h.dmg = [Math.max(1, Math.round(d.dmg[0] * k)), Math.max(1, Math.round(d.dmg[1] * k))];
  h.armor = Math.min(0.8, d.armor + (L.iron ? 0.25 : 0));
  h.regen = d.regen * HERO_HP * (L.iron ? 2 : 1);
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
    G.spawners.push({ t: grp.t, types: grp.types, pack: grp.pack, hpK: grp.hpK, left: grp.n, n: grp.n, gap: grp.gap, timer: grp.at || 0, p: grp.p || 0 });
    lastSpawn = Math.max(lastSpawn, (grp.at || 0) + grp.gap * (grp.n - 1));
  }
  G.wave++; G.wavePop = time;
  sfx('wave');
  if (G.wave === G.lv.waves.length && G.wave > 1) {
    // son dalga: kırmızı duyuru, ekran kenarı kızarır, kısa sarsıntı
    G.banner = { title: 'SON DALGA!', sub: 'En kalabalık dalga geliyor. Kaleyi tut!', t: 0, dur: 3.6, red: true };
    G.finalT = 0; G.hurt = Math.max(G.hurt, 0.5);
    shakeScreen(4, 0.5); setTimeout(() => { if (actx && !muted) waveSound(); }, 450);
  }
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

// Muhafız dizilişi: [boss'a göre yol üzerindeki ileri/geri mesafe, yanal kayma]
const ESCORT_FORM = [[18, -11], [18, 11], [0, -17], [0, 17], [-16, -10], [-16, 10], [34, 0]];
function spawnEnemy(type, pi, d0 = 0, off0 = null) {
  const def = ENEMIES[type];
  const p = G.paths[pi] || G.paths[0];
  const esc = def.chief && BOSS_ESCORT[type];
  if (esc && d0 === 0) d0 = 18; // muhafızların arkada da yer bulması için boss biraz ileriden başlar
  const off = off0 ?? (def.boss ? 0 : rand(-11, 11) * ROAD_K);
  const q = pathPos(p, d0, off);
  const tier = G.lv.tier ?? G.idx; // boss gücü kademesi (2. sefer 1. seferin sonlarından başlar)
  const hp = def.chief ? (650 + 400 * tier) * (def.hpK || 1) : def.hp * (G.lv.hpMul || 1) * diff().hp;
  const e = { type, def, p, d: d0, off, x: q.x, y: q.y, hp, maxHp: hp, blocker: null, atk: 0, dead: false, anim: rand(0, 10), face: 1, healT: 3 };
  G.enemies.push(e);
  if (def.chief) { e.dmgMul = 1 + 0.08 * tier; e.cdMul = 1 - 0.025 * tier; } // boss gücü bölümle artar: hasar ve yetenek sıklığı
  if (def.plate) { e.plate = e.maxPlate = def.plate; e.spdMul = 1; }
  if (esc) {
    let k = 0;
    for (const [t2, n] of esc) for (let i = 0; i < n; i++, k++) {
      const [fd, fo] = ESCORT_FORM[k % ESCORT_FORM.length];
      const m = spawnEnemy(t2, G.paths.indexOf(p), Math.max(0, d0 + fd + (k >= ESCORT_FORM.length ? -30 : 0)), fo);
      m.leader = e; m.form = fd + (k >= ESCORT_FORM.length ? -30 : 0);
    }
  }
  if (def.chief) bossIntro(e);
  else {
    // (v2: zayıflık/direnç bilgisiyle her düşman kartı bir kez daha gösterilir)
    save.seenEnemies2 = save.seenEnemies2 || [];
    if (!save.seenEnemies2.includes(type)) { save.seenEnemies2.push(type); persist(); if (!G.intro) G.intro = { type, t: 0, dur: 4.5 }; }
  }
  return e;
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
// Göktaşı çarpması: kör edici parlama, alev halkası, akkor kaya parçaları, duman sütunu, kızgın krater
function fxMeteorImpact(x, y, r, burn) {
  fxExplosion(x, y, r, true);
  const P = G.parts;
  emit(P, { kind: 'glow', add: true, x, y: y - 10, col: '255,240,200', s0: r * 1.3, s1: r * 1.6, life: 0.12, a: 0.8 });
  for (let i = 0; i < 14; i++) {
    const a = rand(Math.PI * 1.05, Math.PI * 1.95), v = rand(110, 230);
    emit(P, { kind: 'chunk', x: x + rand(-5, 5), y: y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 480, col: i % 2 ? '#3a2a22' : '#ff7a2a',
      s0: rand(2.5, 4.5), s1: 2, life: rand(0.8, 1.2), vr: rand(-14, 14), floor: y + rand(-10, 12) });
  }
  for (let i = 0; i < 10; i++) {
    emit(P, { kind: 'glow', x: x + rand(-r, r) * 0.3, y: y - rand(0, 14), vx: rand(-14, 14), vy: rand(-60, -30), drag: 0.6,
      col: i % 2 ? '58,50,46' : '92,82,74', s0: rand(10, 14), s1: rand(26, 36), life: rand(1.4, 2.2), a: 0.55, fadeIn: 0.15 });
  }
  for (let i = 0; i < 16; i++) emit(P, { kind: 'glow', add: true, x: x + rand(-r, r) * 0.6, y: y + rand(-r, r) * 0.3, vy: -rand(30, 90), drag: 1, col: '255,170,60', s0: rand(2, 4), s1: 0.5, life: rand(0.8, 1.5) });
  G.effects.push({ kind: 'firering', x, y, r: r * 1.25, t: 0, dur: 0.55 });
  G.decals.push({ x, y, r: r * 1.05, t: 0, life: 10, hot: true });
  if (burn) G.zones.push({ x, y, r: r * 0.6, dps: 8, t: 0, life: 2.5, fxT: 0, src: 'blast' });
  shakeScreen(7, 0.45);
}
// Göktaşının kayası (bir kez çizilir): çatlaklarından akkor ışık sızan, köşeli koyu kaya
let METEOR_ROCK = null;
function meteorRock() {
  if (METEOR_ROCK) return METEOR_ROCK;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.translate(32, 32);
  const pts = [];
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, r = 22 + Math.sin(i * 2.7) * 4 + (i % 3) * 1.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  const gr = g.createRadialGradient(-7, -8, 2, 0, 0, 26);
  gr.addColorStop(0, '#8a6a58'); gr.addColorStop(0.55, '#4a3428'); gr.addColorStop(1, '#1e140e');
  path(); g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#140a06'; g.stroke();
  g.save(); path(); g.clip();
  g.strokeStyle = '#ffb040'; g.lineWidth = 2.2; g.lineCap = 'round'; g.shadowColor = '#ff7a20'; g.shadowBlur = 6;
  for (const seg of [[[-14, -4], [-4, 2], [3, -6], [12, -2]], [[-6, 10], [2, 6], [8, 12]], [[4, -16], [6, -8]]]) {
    g.beginPath(); seg.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-8, -10, 7, 4, -0.6, 0, Math.PI * 2); g.fill();
  return (METEOR_ROCK = c);
}
// Göktaşı: yerde hedef işareti, alev kuyruğu, ısı halesi ve dönen kaya
function drawMeteor(p) {
  const k = clamp(p.t / p.dur, 0, 1), pre = p.t < 0 ? clamp(1 + p.t / 0.6, 0, 1) : 1;
  // hedef işareti: düşüşe yaklaştıkça parlaklaşan ve daralan halka
  {
    const a = (p.t < 0 ? pre * 0.5 : 0.5 + 0.5 * k), r = p.splash * (1.1 - 0.3 * k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,120,40,${0.55 * a})`; ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time * 30;
    ctx.beginPath(); ctx.ellipse(p.tx, p.ty, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    glow(ctx, p.tx, p.ty, r * 0.9, '255,110,30', 0.25 * a);
    ctx.restore();
  }
  if (p.t < 0) return;
  const { x, y } = projPos(p, k), dx = p.tx - p.sx, dy = p.ty - p.sy, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
  // gölge yerde büyür
  ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.25 * k})`; ctx.beginPath(); ctx.ellipse(p.tx, p.ty, 6 + 14 * k, (6 + 14 * k) * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // alev kuyruğu
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const TL = 95, nx = -uy, ny = ux;
  for (const [w, col, len] of [[15, '255,90,20', TL], [9, '255,170,60', TL * 0.75], [4.5, '255,245,200', TL * 0.45]]) {
    const g = ctx.createLinearGradient(x, y, x - ux * len, y - uy * len);
    g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(x + nx * w, y + ny * w);
    ctx.quadraticCurveTo(x - ux * len * 0.5 + nx * w * 0.6 + Math.sin(time * 30) * 2, y - uy * len * 0.5 + ny * w * 0.6, x - ux * len, y - uy * len);
    ctx.quadraticCurveTo(x - ux * len * 0.5 - nx * w * 0.6, y - uy * len * 0.5 - ny * w * 0.6 + Math.cos(time * 27) * 2, x - nx * w, y - ny * w);
    ctx.closePath(); ctx.fill();
  }
  glow(ctx, x, y, 34, '255,120,30', 0.85); glow(ctx, x, y, 16, '255,230,170', 0.9);
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate((p.spin || 0) + time * 5);
  ctx.drawImage(meteorRock(), -12, -12, 24, 24);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + ux * 6, y + uy * 6, 9, '255,200,120', 0.7); ctx.restore();
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
  emit(G.parts, { kind: 'glow', add: true, x, y, col: '170,210,255', s0: 30, s1: 8, life: 0.2 });
  emit(G.parts, { kind: 'glow', add: true, x, y, col: '255,255,255', s0: 12, s1: 2, life: 0.12 });
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2), v = rand(80, 160);
    emit(G.parts, { kind: 'streak', add: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: '#cfe6ff', s0: 1.4, s1: 0.2, life: rand(0.1, 0.2) });
  }
}
// yıldırım çarpması: beyaz parlama, elektrik kıvılcımları, yerde şok halkası
function fxMagicHit(x, y, frost) {
  const P = G.parts, c0 = frost ? '190,240,255' : '170,205,255';
  emit(P, { kind: 'glow', add: true, x, y, col: c0, s0: 26, s1: 34, life: 0.16 });
  emit(P, { kind: 'glow', add: true, x, y, col: '255,255,255', s0: 12, s1: 4, life: 0.1 });
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), v = rand(90, 220);
    emit(P, { kind: 'streak', add: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, g: 300, col: i % 3 ? '#bfe0ff' : '#ffffff', s0: 1.5, s1: 0.2, life: rand(0.15, 0.35) });
  }
  if (frost) for (let i = 0; i < 5; i++) emit(P, { kind: 'glow', add: true, x: x + rand(-8, 8), y: y + rand(-8, 8), vy: -20, col: '210,245,255', s0: 4, s1: 1, life: 0.5 });
  G.effects.push({ kind: 'ring', x, y: y + 8, r: 22, col: frost ? '170,235,255' : '150,200,255', t: 0, dur: 0.3 });
}
// Zikzaklı yıldırım çizgisi: orta nokta kaydırmayla dallanır; tohum her ~40 ms değişir (titreme)
function lightningPts(x0, y0, x1, y1, seed, rough) {
  let pts = [[x0, y0], [x1, y1]];
  const R = (k) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };
  let amp = Math.hypot(x1 - x0, y1 - y0) * rough, n = 0;
  for (let lvl = 0; lvl < 4; lvl++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      const o = R(n++) * amp;
      out.push([(ax + bx) / 2 - dy / l * o, (ay + by) / 2 + dx / l * o], pts[i]);
    }
    pts = out; amp *= 0.5;
  }
  return pts;
}
function strokeLightning(pts, w, col, a) {
  const line = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over'; // dış hale normal karışımla: açık zeminde de mavi kalsın
  ctx.globalAlpha = a * 0.35; ctx.strokeStyle = col; ctx.lineWidth = 7 * w; line();
  ctx.globalAlpha = a * 0.9; ctx.lineWidth = 2.6 * w; line();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = a; ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 0.9 * w; line();
}
function drawZap(f) {
  if (f.target && !f.target.dead) { f.x1 = f.target.x; f.y1 = aimY(f.target); }
  const k = f.t / f.dur, a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
  const seed = f.seed + Math.floor(f.t * 25), col = f.col || (f.frost ? 'rgb(90,220,255)' : 'rgb(70,130,255)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pts = lightningPts(f.x0, f.y0, f.x1, f.y1, seed, 0.26);
  strokeLightning(pts, f.w || 1, col, a);
  // yan dallar
  for (let b = 0; b < 2; b++) {
    const i = 3 + ((seed * 7 + b * 5) % (pts.length - 6)) | 0, [bx, by] = pts[i];
    const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0) + (b ? 0.7 : -0.7), L = 12 + (seed % 10);
    strokeLightning(lightningPts(bx, by, bx + Math.cos(ang) * L, by + Math.sin(ang) * L, seed + b * 3, 0.3), (f.w || 1) * 0.55, col, a * 0.8);
  }
  if (!f.col) { glow(ctx, f.x0, f.y0, 12, '170,210,255', a); glow(ctx, f.x1, f.y1, 16, '190,220,255', a); }
  else glow(ctx, f.x1, f.y1, 16, f.col.slice(4, -1), a * 0.8);
  ctx.restore();
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
// src: hasar kaynağı (arrow/magic/blast/melee); düşmanın zayıflık/direnç çarpanı uygulanır
function damageEnemy(e, amount, type, quiet, src) {
  if (e.dead || e.under || e.reviveT > 0) return; // kumun altında / dirilirken vurulamaz
  e.lastSrc = src || type;
  const wk = src && e.def.wk && e.def.wk[src];
  if (wk) amount *= wk;
  if (e.rageT > 0) amount *= 0.5; // boss öfkesi
  if (HERO_SKILL) amount *= HERO_POWER; // kahraman yetenek hasarı
  if (e.shieldT > 0) { if (!quiet && (!e.blockFx || time - e.blockFx > 0.4)) { e.blockFx = time; floatText(e.x, e.y - 40, 'BLOK', '#9fd8ff'); } return; }
  if (e.markT > 0) amount *= 1.6;
  // zırh barı: hasarı önce zırh karşılar (direnç uygulanmaz), artan kısım cana geçer
  if (e.plate > 0) {
    const take = Math.min(e.plate, amount);
    e.plate -= take; amount -= take;
    if (!quiet) { e.flash = 0.1; e.hitT = 0.18; }
    e.hitAt = time;
    if (e.plate <= 0) plateBreak(e);
    if (amount <= 0) return;
  }
  const red = type === 'magic' ? e.def.mr : type === 'phys' ? e.def.armor : 0;
  e.hp -= amount * (1 - red);
  if (!quiet) { e.flash = 0.1; e.hitT = 0.18; }
  e.hitAt = time;
  if (e.hp <= 0) killEnemy(e);
}
// durum etkileri: yavaşlatma (en güçlüsü geçerli), zehir (en güçlüsü geçerli, süre yenilenir), sersemletme
function slowEnemy(e, k, t) {
  if (e.def.stoneskin) k = Math.min(k, 0.2);
  if (e.def.boss) k = Math.min(k, e.plate > 0 ? 0.15 : 0.4); // boss en fazla %40 (zırhlıyken %15) yavaşlar
  if (!e.slowT || k >= e.slowK) e.slowK = k;
  e.slowT = Math.max(e.slowT || 0, t);
}
function poisonEnemy(e, dps, t) {
  e.poisonDps = Math.max(e.poisonT > 0 ? e.poisonDps : 0, dps);
  e.poisonT = t;
}
function stunEnemy(e, t) {
  if (e.plate > 0 || e.def.stoneskin || e.under) return; // zırhlı boss / taş deri / gömülü sersemlemez
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
  // mumya: bir kez yarı canla dirilir; patlama (top, göktaşı, napalm) ile ölürse dirilmez
  if (e.def.revive && !e.revived && e.lastSrc !== 'blast') {
    e.revived = true; e.hp = e.maxHp * e.def.revive; e.reviveT = 1.1; e.blocker = null;
    for (const s of G.soldiers) if (s.target === e) s.target = null;
    for (let i = 0; i < 14; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-9, 9), y: e.y - rand(0, 26), vy: -rand(20, 50), col: '140,255,120', s0: rand(3, 5), s1: 0.5, life: rand(0.6, 1) });
    floatText(e.x, e.y - 34, 'Diriliş!', '#8cff7a');
    sfx('magic');
    return;
  }
  e.dead = true;
  if (e.def.dismount) {
    // deve süvarisi: deve düşer, süvari yaya olarak yoluna devam eder
    const r = spawnEnemy(e.def.dismount, G.paths.indexOf(e.p), e.d, e.off);
    r.hopT = 0.4; r.anim = 0;
  }
  G.kills = (G.kills || 0) + 1;
  dropCoins(e.x, e.y, e.def.gold);
  sfx('death');
  deathVoice(e);
  G.effects.push({ kind: 'corpse', name: 'enemy_' + e.type, rig: e.def.base ? 'enemy_' + e.def.base : null, h: CHAR_H['enemy_' + e.type],
    x: e.x, y: e.y, face: e.face, fly: e.def.flying ? 26 : 0, t: 0, dur: CORPSE_DUR });
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
  // küçük, dikkat dağıtmayan bildirim
  G.banner = sk ? { title: `${h.def.name} Sv.${h.lvl} · ${sk.name}`, sub: sk.desc, t: 0, dur: 2.6, small: true }
    : { title: `${h.def.name} seviye ${h.lvl}`, sub: 'Can ve hasar arttı', t: 0, dur: 2, small: true };
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
  const q = worldToScreen(c.x, c.y - c.z);
  c.state = 'fly'; c.ft = 0; c.fx0 = q.x; c.fy0 = q.y;
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
// yerdeki altın: kule/düşmanlarla birlikte derinliğe göre sıralanıp çizilir (kulenin arkasında kalabilir)
function drawCoinWorld(c) {
  {
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
    G.effects.push({ kind: 'corpse', name: s.hero ? s.def.sprite : s.militia ? 'militia' : 'soldier', rig: s.hero ? s.def.sprite : null,
      h: s.hero ? s.def.h * UNIT_K : CHAR_H[s.militia ? 'militia' : 'soldier'], x: s.x, y: s.y, face: s.face, fly: 0, t: 0, dur: CORPSE_DUR });
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
  const sp = t.spec ? SPEC_BONUS : 1; // uzmanlık seçen kışlanın askerleri daha güçlü
  const hm = (ur >= 1 ? 1.2 : 1) * sp, dm = (ur >= 2 ? 1.2 : 1) * (bl ? bl.mult : 1) * sp;
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
    if (s.gear !== t.lvl && !s.dead) {
      for (let k = 0; k < 10; k++) emit(G.parts, { kind: 'glow', add: true, x: s.x + rand(-7, 7), y: s.y - rand(0, 22), vy: -rand(20, 60), col: '255,225,140', s0: rand(2, 4), s1: 0.5, life: rand(0.5, 0.9) });
      G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '255,240,170', t: 0, dur: 0.6, small: true });
    }
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
  if (t.spec && t.spec !== id) return false; // diğer uzmanlık yolu kapalı
  if (cur >= def.ranks.length) return false;
  const cost = def.ranks[cur].cost;
  if (G.gold < cost) return false;
  G.gold -= cost; t.spent += cost; t.ab = t.ab || {}; t.ab[id] = cur + 1; t.born = G.t;
  const first = !t.spec;
  t.spec = id;
  if (t.type === 'barracks') applySoldierStats(t);
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), v = rand(30, 90);
    emit(G.parts, { kind: 'glow', add: true, x: t.x + rand(-14, 14), y: t.y - rand(10, 60), vx: Math.cos(a) * v * 0.4, vy: -rand(30, 80), drag: 1.5,
      col: '255,220,120', s0: rand(3, 5), s1: 0.5, life: rand(0.6, 1) });
  }
  G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 40, col: '255,215,100', t: 0, dur: 0.5 });
  floatText(t.x, t.y - 70, first ? SPEC[id].title + '!' : `${def.name} ${cur + 1}!`, '#ffe27a');
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
  floatText(t.x, t.y - 80, t.def.levels[t.lvl].title, '#ffe27a');
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
    if (e.dead || e.under || (e.def.flying && !allowAir)) continue;
    if (dist(t.x, t.y - 10, e.x, e.y) > range) continue;
    const remain = e.p.total - e.d;
    if (remain < bestRemain) { bestRemain = remain; best = e; }
  }
  return best;
}

// Okçu kulelerinin platformu (sprite genişliği/yüksekliği oranında): okçuların ayaklarının
// dolaşabildiği eşkenar dörtgen. Önündeki korkuluk/mazgal ayrı bir "_front" katmanıyla üstten çizilir.
const ARCHER_DECK = [
  { cx: 0.5, cy: 0.30, hw: 0.29, hh: 0.10, n: 2 },
  { cx: 0.388, cy: 0.341, hw: 0.22, hh: 0.10, n: 2 },
  { cx: 0.5, cy: 0.252, hw: 0.25, hh: 0.09, n: 3 },
];
const archerScale = (ts) => Math.min(ts.w, 72) / 100;
// okçunun ayak noktası; p,q platform içindeki konumu (|p|+|q| <= 1)
function archerPoint(t, ts, i) {
  const D = ARCHER_DECK[t.lvl], a = t.shots && t.shots[i];
  const p = a ? a.p : 0, q = a ? a.q : 0;
  return { x: t.x - ts.w / 2 + (D.cx + p * D.hw) * ts.w, y: ts.bottom - ts.h + (D.cy + q * D.hh) * ts.h };
}
// okun çıktığı nokta: okçunun omzundan nişan yönünde yayın ucu
function bowPoint(t, ts, i) {
  const o = archerPoint(t, ts, i), a = t.shots[i], s = archerScale(ts), f = Math.cos(a.ang) >= 0 ? 1 : -1;
  return { x: o.x + f * 0.6 * s + Math.cos(a.ang) * 11 * s, y: o.y - 16.4 * s + Math.sin(a.ang) * 11 * s };
}
// platformda rastgele bir nokta; birkaç adaydan diğer okçulara en uzak olanı seçilir
function deckSpot(shots, me, px, py) {
  let best = null, bd = -1;
  for (let k = 0; k < 6; k++) {
    const p = rand(-0.75, 0.75), r = 0.8 - Math.abs(p), q = rand(-r, r);
    let d = 9;
    for (const b of shots) if (b !== me) d = Math.min(d, Math.hypot((p - b.gp) * px / 11, (q - b.gq) * py / 7), Math.hypot((p - b.p) * px / 11, (q - b.q) * py / 7));
    if (d > bd) { bd = d; best = [p, q]; }
  }
  return best;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function updateArchers(t, dt, L) {
  const ts = towerSprite(t);
  const n = ARCHER_DECK[t.lvl].n;
  if (!t.shots || t.shots.length !== n) {
    t.shots = Array.from({ length: n }, (_, i) => {
      const [p, q] = n === 3 ? [[-0.5, 0], [0.45, -0.1], [0, 0.4]][i] : [[-0.45, 0.1], [0.45, -0.05]][i];
      return { cd: 0.2 + i * L.rate * 0.5, fx: 0, ang: p > 0 ? 0.3 : Math.PI - 0.3, p, q, gp: p, gq: q, wait: rand(0.5, 2.5), seed: rand(0, 9), draw: 0, walk: 0, moving: false };
    });
  }
  const e0 = findTarget(t, L.range, true);
  const D = ARCHER_DECK[t.lvl], px = ts ? D.hw * ts.w : 20, py = ts ? D.hh * ts.h : 8; // platformun yarı ölçüleri (px)
  t.shots.forEach((a, i) => {
    a.fx = Math.max(0, a.fx - dt);
    a.cd -= dt;
    // dolaşma: hedef yokken platformda rastgele noktalara yürür, durup etrafa bakınır;
    // düşman menzile girince olduğu yerde durur, ona döner ve ateş eder
    let vx = 0;
    if (!e0) {
      const dp = a.gp - a.p, dq = (a.gq - a.q) * 0.45, d = Math.hypot(dp, dq);
      if (d < 0.03) {
        a.moving = false;
        a.wait -= dt;
        if (a.wait <= 0) { [a.gp, a.gq] = deckSpot(t.shots, a, px, py); a.wait = rand(0.8, 3); a.walkT = 0; }
      } else {
        const sp = Math.min(0.42 * dt, d);
        a.p += dp / d * sp; a.q += (dq / d * sp) / 0.45;
        vx = dp / d; a.moving = true;
        // yolu başka okçu tıkıyorsa yerinde yürümesin: bir süre sonra vazgeçip olduğu yerde durur
        a.walkT = (a.walkT || 0) + dt;
        if (a.walkT > 2.5) { a.gp = a.p; a.gq = a.q; a.walkT = 0; }
      }
    } else { a.moving = false; a.gp = a.p; a.gq = a.q; a.wait = rand(0.6, 1.5); }
    // birbirinin içinden geçmesinler: ekranda ~11 px yan, ~7 px derinlik aralığı korunur
    for (let j = 0; j < t.shots.length; j++) {
      if (j === i) continue;
      const b = t.shots[j], dx = (a.p - b.p) * px, dy = (a.q - b.q) * py, e = Math.hypot(dx / 11, dy / 7);
      if (e < 1) {
        const ux = e > 1e-4 ? dx / 11 / e : (i < j ? -1 : 1), uy = e > 1e-4 ? dy / 7 / e : 0, k = (1 - e) * 3 * dt;
        a.p += ux * k * 11 / px; a.q += uy * k * 7 / py;
      }
    }
    const m = Math.abs(a.p) + Math.abs(a.q);
    if (m > 0.9) { a.p *= 0.9 / m; a.q *= 0.9 / m; }
    a.walk = a.moving ? a.walk + dt : 0;
    const o = ts ? archerPoint(t, ts, i) : { x: t.x, y: t.y - 34 };
    if (ts) o.y -= 16.4 * archerScale(ts);
    let goal;
    if (e0) goal = Math.atan2(aimY(e0) - o.y, e0.x - o.x);
    else if (a.moving) goal = vx >= 0 ? 0.3 : Math.PI - 0.3;
    else goal = a.ang + Math.sin(G.t * 0.7 + a.seed) * 0.4 * dt; // etrafa bakınma
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
      dmg: roll(L.dmg) * (crit ? 2 : 1), dtype: pierce ? 'true' : 'phys', arc: 18, crit, pierce, poison: po ? po.dps : 0, src: 'arrow' });
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
        const o = ts ? bowPoint(t, ts, 0) : { x: t.x, y: t.y - 40 };
        G.effects.push({ kind: 'snipe', x0: o.x, y0: o.y, x1: best.x, y1: aimY(best), t: 0, dur: 0.3 });
        fxArrowHit(best.x, aimY(best), true);
        emit(G.parts, { kind: 'glow', add: true, x: best.x, y: aimY(best), col: '255,240,190', s0: 18, s1: 26, life: 0.2 });
        floatText(best.x, best.y - 40, `-${sn.dmg}`, '#ffe9a0');
        damageEnemy(best, sn.dmg, 'true', false, 'arrow');
        sfx('arrow'); sfx('bash');
      } else t.snipeCd = 0.3;
    }
  }
}

function updateTower(t, dt) {
  t.anim += dt; t.shotAnim = Math.max(0, t.shotAnim - dt);
  if (t.disabledT > 0) { t.disabledT -= dt; return; } // boss tarafından susturuldu
  if (t.type === 'barracks') return;
  const L = effLevel(t);
  if (t.type === 'artillery') {
    // top hedefe doğru döner (zemin düzleminde açı; dikeyde perspektif sıkışması telafi edilir)
    if (t.yaw == null) t.yaw = t.x < W / 2 ? 0.25 : Math.PI - 0.25;
    const e = findTarget(t, L.range, false);
    if (e) {
      t.yawGoal = Math.atan2((e.y - t.y) / CAM_S, e.x - t.x);
      t.elGoal = 0.14 + 0.32 * clamp(dist(t.x, t.y, e.x, e.y) / L.range, 0, 1); // uzak hedefe namlu daha çok kalkar
    }
    if (t.yawGoal != null) t.yaw += clamp(angDiff(t.yawGoal, t.yaw), -3.2 * dt, 3.2 * dt);
    t.el = (t.el ?? 0.25) + clamp((t.elGoal ?? 0.25) - (t.el ?? 0.25), -0.8 * dt, 0.8 * dt);
  }
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
        for (const o of G.enemies) if (!o.dead && dist(o.x, o.y, best.x, best.y) < 62) damageEnemy(o, bl.dmg, 'magic', false, 'magic');
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
    const goal = Math.atan2((e.y - t.y) / CAM_S, e.x - t.x);
    if (Math.abs(angDiff(goal, t.yaw ?? goal)) > 0.25) { t.cd = 0.05; t.shotAnim = 0; return; } // dönüş bitmeden ateş etmez
    const m = cannonMuzzle(t, ts); sx = m.x; sy = m.y; t.muzzleDir = m.dx;
  }
  if (t.type === 'archer') {
    const d = dist(sx, sy, e.x, e.y);
    G.projectiles.push({ kind: 'arrow', sx, sy, target: e, tx: e.x, ty: e.y, t: 0, dur: clamp(d / 420, 0.15, 0.6), dmg: roll(L.dmg), dtype: 'phys', arc: 18 });
    sfx('arrow');
  } else if (t.type === 'mage') {
    const d = dist(sx, sy, e.x, e.y);
    const fr = abRank(t, 'frost');
    // yıldırım: kuleden hedefe neredeyse anında çakar
    G.projectiles.push({ kind: 'bolt', sx, sy: sy - 8, target: e, tx: e.x, ty: aimY(e), t: 0, dur: 0.07, dmg: roll(L.dmg), dtype: 'magic', arc: 0, src: 'magic',
      slow: fr ? fr : t.lvl >= 1 ? { k: 0.3, t: 1 } : null, chain: t.lvl >= 2, frost: !!fr });
    G.effects.push({ kind: 'zap', x0: sx, y0: sy - 8, target: e, x1: e.x, y1: aimY(e), t: 0, dur: 0.28, w: 1 + t.lvl * 0.25, frost: !!fr, seed: rand(0, 99) });
    fxMagicCharge(sx, sy - 8);
    sfx('zap');
  } else if (t.type === 'artillery') {
    const dur = 0.9;
    let tx = e.x, ty = e.y;
    if (!e.blocker) { const f = pathPos(e.p, e.d + e.def.speed * G.wspd * dur, e.off); tx = f.x; ty = f.y; }
    const na = abRank(t, 'napalm'), db = abRank(t, 'double');
    const shell = { kind: 'shell', src: 'blast', sx, sy, gy: t.y, target: null, tx, ty, t: 0, dur, dmg: roll(L.dmg), dtype: 'phys', arc: 70, splash: L.splash,
      stun: t.lvl >= 2 ? 0.3 : 0, napalm: na ? na.dps : 0 };
    G.projectiles.push(shell);
    if (db) {
      // ikinci gülle: başka bir düşmana (yoksa aynı yere yakın) biraz gecikmeli
      const other = G.enemies.find(o => o !== e && !o.dead && !o.def.flying && dist(t.x, t.y, o.x, o.y) <= L.range);
      const tg = other || e;
      let x2 = tg.x + (other ? 0 : rand(-18, 18)), y2 = tg.y + (other ? 0 : rand(-10, 10));
      if (other && !other.blocker) { const f = pathPos(other.p, other.d + other.def.speed * G.wspd * dur, other.off); x2 = f.x; y2 = f.y; }
      G.projectiles.push(Object.assign({}, shell, { tx: x2, ty: y2, t: -0.22, dmg: shell.dmg * db.mult, arc: 80 }));
    }
    fxMuzzle(sx, sy, Math.sign(t.muzzleDir || 1));
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

// Yürüyen düşmanın ayağından kalkan hafif toz (karda kar serpintisi, yağmurda çamur sıçraması)
function footDust(e) {
  const k = (CHAR_H['enemy_' + e.type] || 20) / 20;
  const col = G.weather === 'snow' ? '246,250,255' : G.weather === 'rain' ? '96,78,54' : '214,194,158';
  const n = e.def.chief || e.def.boss ? 3 : 1;
  for (let i = 0; i < n; i++) {
    G.ground.push({ kind: 'dust', x: e.x - e.face * rand(1, 4) * k, y: e.y + rand(-1, 1.5), vx: -e.face * rand(4, 12), vy: -rand(2, 6),
      r: rand(2.2, 3.6) * k, col, a: G.weather === 'rain' ? 0.5 : 0.38, t: 0, dur: rand(0.45, 0.7) });
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
    damageEnemy(e, e.poisonDps * dt, 'true', true, 'arrow');
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
  if (e.reviveT > 0) { e.reviveT -= dt; return; } // diriliyor: yerinden kalkar
  if (e.hopT > 0) e.hopT -= dt;
  if (e.emergeT > 0) e.emergeT -= dt;
  // kum altı: belli aralıklarla gömülür / yüzeye çıkar. Gömülüyken vurulamaz, durdurulamaz, hızlı ilerler
  const BU = e.def.burrow;
  if (BU && e.siege === undefined) {
    e.bT = (e.bT ?? BU.up * rand(0.6, 1)) - dt;
    if (e.bT <= 0) {
      e.under = !e.under; e.bT = e.under ? BU.down : BU.up;
      if (e.under) { e.blocker = null; for (const s of G.soldiers) if (s.target === e) s.target = null; e.stun = 0; }
      else { e.emergeT = 0.35; if (e.def.ab && e.def.ab.slam && e.abT) e.abT.slam = 0; } // dev solucan çıkarken yeri döver
      for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-10, 10), y: e.y, vx: rand(-70, 70), vy: -rand(60, 140), g: 380, col: Math.random() < 0.5 ? '#d8a060' : '#b07840', s0: 2.5, s1: 1.5, life: 0.6, floor: e.y + rand(-3, 4) });
      emit(G.parts, { kind: 'glow', x: e.x, y: e.y - 4, col: '220,180,120', s0: 10, s1: 22, life: 0.6, a: 0.5 });
    }
  }
  // kum cini: ileri ışınlanır, yakındaki dostlarına kısa kalkan verir
  if (e.def.blink && !e.blocker && e.siege === undefined) {
    e.blT = (e.blT ?? rand(2, e.def.blink.cd)) - dt;
    if (e.blT <= 0) {
      e.blT = e.def.blink.cd;
      G.effects.push({ kind: 'portal', x: e.x, y: e.y, t: 0, dur: 0.6, col: '90,170,255' });
      e.d = Math.min(e.p.total - 30, e.d + e.def.blink.d);
      const q = pathPos(e.p, e.d, e.off); e.x = q.x; e.y = q.y;
      G.effects.push({ kind: 'portal', x: e.x, y: e.y, t: 0, dur: 0.6, col: '90,170,255' });
    }
  }
  if (e.def.ward) {
    const Wd = e.def.ward;
    e.wdT = (e.wdT ?? rand(1, Wd.cd)) - dt;
    if (e.wdT <= 0) {
      e.wdT = Wd.cd;
      const near = G.enemies.filter(o => !o.dead && o !== e && !o.def.chief && dist(o.x, o.y, e.x, e.y) < Wd.r).slice(0, Wd.n);
      for (const o of near) { o.shieldT = Math.max(o.shieldT || 0, Wd.t); G.effects.push({ kind: 'zap', x0: e.x, y0: e.y - 30, target: o, x1: o.x, y1: aimY(o), t: 0, dur: 0.3, w: 0.5, col: 'rgb(110,190,255)', seed: rand(0, 99) }); }
    }
  }
  if (e.stun > 0) { e.stun -= dt; return; } // sersemlemiş: yürümez, vurmaz
  if (e.def.ab) bossAbilities(e, dt);
  if (e.siege !== undefined) { updateSiege(e, dt); return; }
  const b = e.blocker;
  if (b && (b.dead || b.removed)) e.blocker = null;
  // kahraman başka yere yürüdüyse düşman takılı kalmaz
  else if (b && b.hero && b.target !== e && dist(e.x, e.y, b.x, b.y) > HERO_AGGRO.r + 12) e.blocker = null;
  // menzilli düşman: menzildeki kahramana (yol dışında olsa da) durup atış yapar.
  // any: askerleri de hedefler; ammo: sınırlı atış hakkı (ork: 3 balta)
  const RG = e.def.ranged;
  if (RG && !e.blocker && !e.under && (RG.ammo == null || (e.ammo ?? RG.ammo) > 0)) {
    if (e.shootT > 0) { e.shootT -= dt; return; }
    e.rcd = (e.rcd ?? rand(0.5, 1.5)) - dt;
    if (e.rcd <= 0) {
      let tgt = null, bd = RG.r;
      for (const h of RG.any ? G.soldiers : G.heroes) { if (h.dead || h.removed) continue; const d = dist(e.x, e.y, h.x, h.y); if (d <= bd) { bd = d; tgt = h; } }
      if (!tgt) e.rcd = 0.3;
      else {
        e.rcd = RG.rate; e.shootT = 0.45; e.face = tgt.x < e.x ? -1 : 1;
        if (RG.ammo != null) e.ammo = (e.ammo ?? RG.ammo) - 1;
        G.projectiles.push({ kind: RG.proj, foe: true, hero: tgt, sx: e.x + e.face * 6, sy: aimY(e), tx: tgt.x, ty: tgt.y - 12, t: -0.18,
          dur: clamp(bd / 260, 0.25, 0.7), arc: RG.proj === 'axe' ? 22 : RG.proj === 'knife' ? 12 : 4, edmg: roll(RG.dmg) * (e.dmgMul || 1) * (tgt.hero ? HERO_AGGRO.dmg : 1) });
        return;
      }
    }
  }
  if (e.blocker) {
    const bd = dist(e.x, e.y, e.blocker.x, e.blocker.y);
    e.inMelee = bd < 22;
    if (e.inMelee) {
      e.face = e.blocker.x < e.x ? -1 : 1;
      e.atk -= dt;
      if (e.atk <= 0) {
        e.atk = e.def.rate;
        const victim = e.blocker;
        slashFx(victim.x, victim.y - unitH(victim) * 0.55, e.face, '#ffd9b0');
        damageSoldier(victim, roll(e.def.dmg) * (e.dmgMul || 1) * (victim.hero ? HERO_AGGRO.dmg : 1));
        sfx('clash');
      }
    }
    return; // bloklanmış: durur
  }
  e.inMelee = false;
  // kahramana saldırı: yanından geçerken durup kahramanla dövüşür
  if (!e.def.flying && !e.leader && !e.under) {
    for (const h of G.heroes) {
      if (h.dead || dist(e.x, e.y, h.x, h.y) > HERO_AGGRO.r) continue;
      let n = 0;
      for (const o of G.enemies) if (o.blocker === h && !o.dead) n++;
      if (n < HERO_AGGRO.max) { e.blocker = h; return; }
    }
  }
  let spd = e.def.speed * G.wspd * (e.spdMul || 1) * (e.slowT > 0 ? 1 - e.slowK : 1) * (e.hasteT > 0 ? 1.5 : 1) * (e.under ? BU.speed : 1);
  // muhafız: boss'un yanında dizilişini korur; boss savaşırken bekler, boss ölünce serbest kalır
  if (e.leader) {
    const L = e.leader;
    if (L.dead || L.p !== e.p || L.siege != null) e.leader = null;
    else {
      const ls = L.blocker ? 0 : L.def.speed * G.wspd * (L.spdMul || 1) * (L.slowT > 0 ? 1 - L.slowK : 1) * (L.hasteT > 0 ? 1.5 : 1);
      spd = clamp(ls + ((L.d + e.form) - e.d) * 1.5, 0, spd * 1.3);
    }
  }
  e.d += spd * dt;
  // ayak tozu: yürüyüş döngüsünde her adım yere bastığında (çizimdeki adım hızıyla aynı)
  if (!e.def.flying && spd > 0) {
    const step = Math.floor(e.anim * (5 + e.def.speed * G.wspd / 9) / Math.PI);
    if (step !== e.step) { e.step = step; footDust(e); }
  }
  if (e.d >= e.p.total) {
    e.d = e.p.total;
    e.siege = 0; // kalenin kapısına vardı: saldırıya hazırlanır
    if (e.under) { e.under = false; e.emergeT = 0.35; }
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
  const step = Math.min(d, s.speed * G.wspd * dt);
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
    if (e.dead || e.under || dist(h.x, h.y - 10, e.x, e.y) > h.ranged) continue;
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
  if (s.hero && s.ranged) { updateRangedHero(s, dt); runHeroSkills(s, dt); return; }
  const home = soldierHome(s);
  const e = s.target;
  if (e && (e.dead || e.under || e.reviveT > 0 || dist(e.x, e.y, home.x, home.y) > s.engage + 40 || s.moving)) {
    if (e.blocker === s) e.blocker = null;
    s.target = null;
  }
  if (!s.target && !s.moving) {
    let best = null, bestScore = 1e9;
    for (const o of G.enemies) {
      if (o.dead || o.def.flying || o.under || o.reviveT > 0) continue;
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
    const spot = t.blocker === s ? { x: t.x + side * 13, y: t.y } : { x: t.x + side * 12, y: t.y + (s.slot === 2 ? 7 : -7) };
    const arrived = moveToward(s, spot.x, spot.y, dt);
    if (arrived || dist(s.x, s.y, t.x, t.y) < 19) {
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
        damageEnemy(t, dmg, 'phys', false, s.hero ? null : 'melee');
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
      // askerler savaşmadığında yaralarını sarar (saniyede canının %8'i)
      else if (!s.hero && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.08 * dt);
    }
  }
  if (s.hero) runHeroSkills(s, dt);
}

// ---------- kahraman yetenekleri (öğrenilenler bekleme süresi dolunca kendiliğinden kullanılır) ----------
function runHeroSkills(h, dt) {
  const np = G.projectiles.length, nz = G.zones.length;
  HERO_SKILL = true;
  heroSkills(h, dt);
  HERO_SKILL = false;
  for (let i = np; i < G.projectiles.length; i++) G.projectiles[i].heroSkill = true;
  for (let i = nz; i < G.zones.length; i++) G.zones[i].heroSkill = true;
}
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
  return G.enemies.filter(e => !e.dead && !e.under && (air || !e.def.flying) && dist(e.x, e.y, x, y) <= r);
}
// menzildeki en kalabalık düşman kümesinin merkezi
function densest(x, y, range, r, air = false) {
  let best = null, bestN = 0;
  for (const e of G.enemies) {
    if (e.dead || e.under || (!air && e.def.flying) || dist(x, y, e.x, e.y) > range) continue;
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
      else damageEnemy(t, roll(h.dmg) / HERO_POWER * 3, 'phys'); // h.dmg zaten ölçekli: tek sefer düşsün
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
      damageEnemy(t, roll(h.dmg) / HERO_POWER * 3 + 20 * L, 'true');
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
  const sx = h.x + h.face * 6, sy = h.y - h.def.h * UNIT_K * 0.6, d = dist(sx, sy, e.x, e.y);
  const crit = h.crit && Math.random() < h.crit;
  const sp = h.def.proj === 'dagger' ? 460 : h.def.proj === 'harrow' ? 480 : 320;
  const p = { kind: h.def.proj, sx, sy, target: e, tx: e.x, ty: aimY(e), t: 0, dur: clamp(d / sp, 0.15, 0.7),
    splash: h.def.splash ? h.def.splash * (h.learned.fireaim ? 1.6 : 1) : 0, burn: !!h.learned.fireaim,
    dmg: roll(h.dmg) * mult * (crit ? 2 : 1) / (HERO_SKILL ? HERO_POWER : 1), dtype: h.def.magic ? 'magic' : 'phys', arc: h.def.proj === 'dagger' ? 10 : 16, crit,
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
  if (pr.foe) {
    // düşmandan kahramana: hedefi izler, varınca vurur
    const h = pr.hero;
    if (h && !h.dead) { pr.tx = h.x; pr.ty = h.y - 12; }
    if (pr.t >= 0 && !pr.snd) { pr.snd = true; sfx(pr.kind === 'hex' ? 'magic' : pr.kind === 'axe' ? 'whirl' : 'arrow'); }
    if (pr.t < pr.dur) return;
    pr.done = true;
    if (h && !h.dead && !h.removed) {
      damageSoldier(h, pr.edmg);
      if (pr.kind === 'axe') sfx('clash');
      for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', add: true, x: pr.tx + rand(-4, 4), y: pr.ty + rand(-4, 4), vx: rand(-40, 40), vy: rand(-50, 10), drag: 3,
        col: pr.kind === 'hex' ? '140,255,110' : '255,230,190', s0: 3, s1: 0.5, life: 0.35 });
    }
    return;
  }
  if (pr.target && !pr.target.dead) { pr.tx = pr.target.x; pr.ty = aimY(pr.target); }
  if (pr.t > 0) {
    pr.fxT = (pr.fxT || 0) - dt;
    if (pr.fxT <= 0) {
      const q = projPos(pr, pr.t / pr.dur);
      if (pr.kind === 'bolt') {
        pr.fxT = 1;
      } else if (pr.kind === 'fireball') {
        pr.fxT = 0.016;
        emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-2, 2), y: q.y + rand(-2, 2), vx: rand(-12, 12), vy: rand(-20, 0), col: Math.random() < 0.5 ? '255,130,40' : '255,210,90', s0: rand(5, 8), s1: 1, life: rand(0.25, 0.4) });
      } else if (pr.kind === 'shell') {
        pr.fxT = 0.03;
        emit(G.parts, { kind: 'glow', x: q.x, y: q.y, vx: rand(-5, 5), vy: -8, col: '130,124,118', s0: 2.5, s1: 7, life: 0.5, a: 0.4 });
      } else if (pr.kind === 'meteor') {
        pr.fxT = 0.01;
        emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-5, 5), y: q.y + rand(-5, 5), vx: rand(-25, 25), vy: rand(-35, 5), drag: 2, col: Math.random() < 0.5 ? '255,120,30' : '255,200,90', s0: rand(10, 15), s1: 2, life: rand(0.3, 0.5) });
        emit(G.parts, { kind: 'glow', x: q.x + rand(-3, 3), y: q.y, vx: rand(-12, 12), vy: rand(-22, -8), drag: 0.8, col: Math.random() < 0.5 ? '60,52,48' : '96,86,78', s0: rand(6, 9), s1: rand(16, 22), life: rand(0.8, 1.2), a: 0.45, fadeIn: 0.08 });
        if (Math.random() < 0.6) emit(G.parts, { kind: 'streak', add: true, x: q.x, y: q.y, vx: rand(-60, 60), vy: rand(-80, 20), g: 260, col: '#ffcf70', s0: 1.4, s1: 0.2, life: rand(0.25, 0.45) });
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
  if (pr.kind === 'bossthrow') {
    const t = pr.tower;
    fxExplosion(pr.tx, pr.ty + 18, 26, false);
    if (t && G.towers.includes(t)) { t.disabledT = Math.max(t.disabledT || 0, pr.stun); t.disabledKind = 'stun'; floatText(t.x, t.y - 60, 'Sersemledi!', '#ffd08a'); }
    sfx('boom');
    return;
  }
  if (pr.kind === 'shell' || pr.kind === 'meteor') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, pr.tx, pr.ty);
      if (d <= pr.splash) damageEnemy(e, pr.dmg * (1 - 0.5 * d / pr.splash), 'phys', false, pr.src);
    }
    if (pr.stun) for (const e of G.enemies) if (!e.dead && !e.def.flying && dist(e.x, e.y, pr.tx, pr.ty) <= pr.splash * 0.8 && Math.random() < pr.stun) stunEnemy(e, 0.6);
    if (pr.napalm) G.zones.push({ x: pr.tx, y: pr.ty, r: pr.splash * 0.75, dps: pr.napalm, t: 0, life: 3, fxT: 0, src: 'blast' });
    if (pr.kind === 'meteor') fxMeteorImpact(pr.tx, pr.ty, pr.splash, pr.burn);
    else fxExplosion(pr.tx, pr.ty, pr.splash, false);
    sfx(pr.kind === 'meteor' ? 'meteor' : 'boom');
  } else if (pr.target && !pr.target.dead) {
    const e = pr.target;
    if (pr.kind === 'bolt') fxMagicHit(pr.tx, pr.ty, pr.frost);
    else if (pr.kind === 'fireball') fxFireHit(pr.tx, pr.ty, pr.inferno);
    else fxArrowHit(pr.tx, pr.ty, e.def.armor >= 0.5 || pr.pierce);
    if (pr.inferno) for (const o of G.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < pr.inferno) damageEnemy(o, pr.dmg * 0.5, 'magic');
    if (pr.splash) {
      for (const o of G.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < pr.splash) damageEnemy(o, pr.dmg * 0.55, pr.dtype, false, pr.src);
      if (pr.burn) G.zones.push({ x: e.x, y: e.y, r: pr.splash * 0.8, dps: 8, dtype: 'true', kind: 'fire', t: 0, life: 1.5, fxT: 0 });
      G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: pr.splash, col: pr.burn ? '255,160,70' : '255,240,190', t: 0, dur: 0.3 });
      if (pr.big) fxExplosion(e.x, e.y, pr.splash, false);
    }
    if (pr.crit) floatText(e.x, e.y - 34, 'KRİTİK!', '#ffb347');
    if (pr.poison) poisonEnemy(e, pr.poison, 3);
    if (pr.slow) slowEnemy(e, pr.slow.k, pr.slow.t);
    damageEnemy(e, pr.dmg, pr.dtype, false, pr.src);
    if (pr.chain) {
      const n = G.enemies.filter(o => o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < 85)
        .sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y))[0];
      if (n) {
        G.effects.push({ kind: 'zap', x0: pr.tx, y0: pr.ty, target: n, x1: n.x, y1: aimY(n), t: 0, dur: 0.25, w: 0.8, frost: pr.frost, seed: rand(0, 99) });
        fxMagicHit(n.x, aimY(n), pr.frost);
        if (pr.slow) slowEnemy(n, pr.slow.k, pr.slow.t);
        damageEnemy(n, pr.dmg * 0.6, 'magic', false, 'magic');
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
      const tx = x + (i ? rand(-34, 34) : 0), ty = y + (i ? rand(-20, 20) : 0);
      G.projectiles.push({ kind: 'meteor', sx: tx + 170, sy: ty - 470, tx, ty, t: -0.35 - i * 0.28, dur: 0.8, dmg: roll(S.dmg), splash: S.radius, arc: 0, src: 'blast', spin: rand(0, 6), burn: true });
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
      const i = sp.n - sp.left;
      const e = spawnEnemy(sp.types ? sp.types[i] : sp.t, sp.p);
      if (sp.hpK && !e.def.chief) { e.hp *= sp.hpK; e.maxHp *= sp.hpK; }
      sp.left--;
      // paket: küme içinde sık, kümeler arasında uzun ara (ortalama sıklık aynı kalır)
      if (sp.pack) sp.timer += (i + 1) % sp.pack ? sp.gap * 0.35 : sp.gap * (sp.pack - 0.35 * (sp.pack - 1));
      else sp.timer += sp.gap;
    }
  }
  G.spawners = G.spawners.filter(s => s.left > 0);

  castleAmbient(dt);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  for (const t of G.towers) updateTower(t, dt);
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  for (const s of G.soldiers) updateSoldier(s, dt);
  for (const p of G.projectiles) { HERO_SKILL = !!p.heroSkill; updateProjectile(p, dt); }
  HERO_SKILL = false;

  G.enemies = G.enemies.filter(e => !e.dead);
  G.soldiers = G.soldiers.filter(s => !s.removed);
  G.projectiles = G.projectiles.filter(p => !p.done);
  for (const f of G.effects) f.t += dt;
  G.effects = G.effects.filter(f => f.t < f.dur);
  G.parts = updateParts(G.parts, dt);
  if (G.stormT > 0) G.stormT -= dt;
  for (const f of G.ground) f.t += dt;
  G.ground = G.ground.filter(f => f.t < f.dur);
  updateWeather(dt);
  if (G.intro) { G.intro.t += dt; if (G.intro.t > G.intro.dur) G.intro = null; }
  for (const z of G.zones) {
    z.t += dt; z.fxT -= dt;
    HERO_SKILL = !!z.heroSkill;
    for (const e of G.enemies) if (!e.dead && !e.def.flying && dist(e.x, e.y, z.x, z.y) <= z.r) damageEnemy(e, z.dps * dt, z.dtype || 'true', true, z.src);
    HERO_SKILL = false;
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
    if (G.weather) {
      G.ambT = 1; // yağmur/kar ayrı katmanda çizilir
    } else if (th.snow) {
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
  if (im) { drawSprite(ctx, im, pl.x, pl.y + 2, 66 * BUILD_K, 0.5); return; }
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
  const w = m ? m[0] * TOWER_K : 74 * BUILD_K, h = w * im.height / im.width;
  return { im, w, h, bottom: t.y + (m ? w * (m[2] ?? 0.24) : 10) };
}

// ---- Top kulesinin 3B topu: gerçek 3B modelden eğik (ortografik) izdüşümle çizilir ----
// Dünya: X sağ, Y yukarı, Z izleyiciye doğru. Kamera yukarıdan CAM_S açısıyla bakar.
const CAM_S = 0.45, CAM_C = Math.sqrt(1 - CAM_S * CAM_S);
const CAM_V = [0, CAM_S, CAM_C]; // kameraya doğru birim vektör
const CANNON_LOOK = [
  { scale: 1, wood: '#9a6434', rim: '#b88a3a', barrel: ['#a6afba', '#4c525c', '#1c1f24'], band: '#2a2e34', bandHi: '#6c737e', bore: '#0c0a08' },
  { scale: 1.08, wood: '#844a28', rim: '#d8aa44', barrel: ['#b4bcc6', '#50565f', '#1c1f24'], band: '#c8962e', bandHi: '#ffe08a', bore: '#0c0a08' },
  { scale: 1.16, wood: '#6c3a1e', rim: '#f2c64e', barrel: ['#ffe9a0', '#c08a2e', '#5a3608'], band: '#f2c64e', bandHi: '#fff6c8', bore: '#1a0e04' },
];
const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const C_OUT = '#24140a', C_LIGHT = v3.norm([-0.45, 0.85, 0.35]);
// yaw: zemin düzleminde namlu yönü; el: namlu yükselişi; rec: geri tepme (0..1)
function cannonModel(ox, oy, k, yaw, el, rec, lvl) {
  const L = CANNON_LOOK[lvl], K = k * L.scale;
  const P = (p) => ({ x: ox + p[0] * K, y: oy + (p[2] * CAM_S - p[1] * CAM_C) * K });
  const u = [Math.cos(yaw), 0, Math.sin(yaw)], w = [-Math.sin(yaw), 0, Math.cos(yaw)], up = [0, 1, 0];
  const back = -rec * 3.5;
  const d = v3.norm([Math.cos(yaw) * Math.cos(el + rec * 0.12), Math.sin(el + rec * 0.12), Math.sin(yaw) * Math.cos(el + rec * 0.12)]);
  const trun = v3.add(v3.add(v3.mul(u, -1 + back), [0, 14, 0]), [0, 0, 0]);
  return { L, K, P, u, w, up, back, d, trun, muzzle: v3.add(trun, v3.mul(d, 27)) };
}
function cannonMuzzlePos(ox, oy, k, yaw, el, rec, lvl) {
  const M = cannonModel(ox, oy, k, yaw, el, rec, lvl);
  return Object.assign(M.P(M.muzzle), { dx: M.d[0], dy: M.d[2] * CAM_S - M.d[1] * CAM_C });
}
function drawCannonModel(g, ox, oy, k, yaw, el, rec, lvl) {
  const M = cannonModel(ox, oy, k, yaw, el, rec, lvl), { L, K, P, u, w, up, back, d, trun } = M;
  g.lineJoin = 'round'; g.lineCap = 'round';
  const lw = Math.max(0.7, 0.9 * K);
  const poly = (pts, fill, stroke = true) => {
    g.beginPath(); pts.forEach((p, i) => { const q = P(p); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); g.closePath();
    g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = C_OUT; g.lineWidth = lw; g.stroke(); }
  };
  const lit = (n, base) => shadeHex(base, 0.62 + 0.55 * Math.max(0, v3.dot(n, C_LIGHT)));
  // kutu: merkez c, eksenler (a: uzunluk, b: genişlik, yukarı), yarı ölçüler
  const box = (c, a, b, ha, hb, h0, h1, col) => {
    const pt = (sa, sb, hh) => v3.add(v3.add(v3.add(c, v3.mul(a, sa * ha)), v3.mul(b, sb * hb)), [0, hh, 0]);
    const faces = [
      [up, [pt(-1, -1, h1), pt(1, -1, h1), pt(1, 1, h1), pt(-1, 1, h1)]],
      [a, [pt(1, -1, h0), pt(1, 1, h0), pt(1, 1, h1), pt(1, -1, h1)]],
      [v3.mul(a, -1), [pt(-1, -1, h0), pt(-1, 1, h0), pt(-1, 1, h1), pt(-1, -1, h1)]],
      [b, [pt(-1, 1, h0), pt(1, 1, h0), pt(1, 1, h1), pt(-1, 1, h1)]],
      [v3.mul(b, -1), [pt(-1, -1, h0), pt(1, -1, h0), pt(1, -1, h1), pt(-1, -1, h1)]],
    ];
    for (const [n, pts] of faces) if (v3.dot(n, CAM_V) > 0.001) poly(pts, lit(n, col));
  };
  // dikey düzlemde daire (tekerlek): merkez c, normal n
  const disc = (c, n, r, col, hub) => {
    const e1 = v3.norm(v3.cross(n, up)), pts = [];
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; pts.push(v3.add(c, v3.add(v3.mul(e1, Math.cos(a) * r), v3.mul(up, Math.sin(a) * r)))); }
    poly(pts, lit(n, col));
    const hc = P(c); g.fillStyle = hub; g.beginPath(); g.arc(hc.x, hc.y, Math.max(0.8, r * 0.32 * K), 0, Math.PI * 2); g.fill(); g.strokeStyle = C_OUT; g.lineWidth = lw * 0.7; g.stroke();
  };
  // 1) döner tabla
  {
    const R = 17 * K, c0 = P([0, 0, 0]), c1 = P([0, 3, 0]);
    g.fillStyle = shadeHex(L.wood, 0.5); g.strokeStyle = C_OUT; g.lineWidth = lw;
    g.beginPath(); g.ellipse(c0.x, c0.y, R, R * CAM_S, 0, 0, Math.PI); g.lineTo(c1.x - R, c1.y); g.ellipse(c1.x, c1.y, R, R * CAM_S, 0, Math.PI, 0, true); g.closePath(); g.fill(); g.stroke();
    const gr = g.createLinearGradient(c1.x, c1.y - R * CAM_S, c1.x, c1.y + R * CAM_S);
    gr.addColorStop(0, shadeHex(L.wood, 1.25)); gr.addColorStop(1, shadeHex(L.wood, 0.85));
    g.fillStyle = gr; g.beginPath(); g.ellipse(c1.x, c1.y, R, R * CAM_S, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = L.rim; g.lineWidth = Math.max(0.6, 1.1 * K); g.beginPath(); g.ellipse(c1.x, c1.y, R * 0.82, R * 0.82 * CAM_S, 0, 0, Math.PI * 2); g.stroke();
  }
  const base = v3.mul(u, back);
  const near = Math.cos(yaw) >= 0 ? 1 : -1; // izleyiciye bakan yan
  const wheelPos = [];
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) wheelPos.push([sa, sb]);
  const wheel = ([sa, sb]) => disc(v3.add(v3.add(v3.add(base, v3.mul(u, sa * 8.5)), v3.mul(w, sb * 8.6)), [0, 6.6, 0]), v3.mul(w, sb), 3.6, L.wood, L.rim);
  wheelPos.filter(p => p[1] !== near).forEach(wheel);
  // 2) kundak tabanı
  box(base, u, w, 12, 7.5, 3, 8, L.wood);
  // 3) yanaklar ve namlu (uzak yanak, namlu, yakın yanak)
  const cheek = (sb) => box(v3.add(base, v3.mul(w, sb * 6)), u, w, 8.5, 1.5, 8, 15.5, shadeHex(L.wood, 1.08).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, gg, b) => '#' + [r, gg, b].map(x => (+x).toString(16).padStart(2, '0')).join('')));
  cheek(-near);
  // namlu
  {
    const ends = [[-15, 5.1], [-9, 5.3], [-8, 4.9], [1, 4.7], [2, 5.0], [3, 4.6], [21, 3.9], [23, 4.6], [27, 4.7]];
    const pts3 = ends.map(([t]) => v3.add(trun, v3.mul(d, t)));
    const ps = pts3.map(P);
    const ax = { x: ps[ps.length - 1].x - ps[0].x, y: ps[ps.length - 1].y - ps[0].y }, al = Math.hypot(ax.x, ax.y);
    let px = al > 0.01 ? -ax.y / al : 0, py = al > 0.01 ? ax.x / al : -1;
    if (py > 0) { px = -px; py = -py; } // dik vektör ekranda yukarıyı göstersin
    const facing = v3.dot(d, CAM_V); // >0: namlu ağzı izleyiciye bakıyor
    const e1 = v3.norm(v3.cross(d, up)), e2 = v3.cross(e1, d);
    const ring = (c, r, col, wdt, full) => {
      g.strokeStyle = col; g.lineWidth = wdt; g.beginPath(); let on = false;
      for (let i = 0; i <= 28; i++) {
        const a = i / 28 * Math.PI * 2, n = v3.add(v3.mul(e1, Math.cos(a)), v3.mul(e2, Math.sin(a)));
        const vis = full || v3.dot(n, CAM_V) > -0.05, q = P(v3.add(c, v3.mul(n, r)));
        if (vis) { on ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); on = true; } else on = false;
      }
      g.stroke();
    };
    const cap = (c, r, fill) => {
      g.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, q = P(v3.add(c, v3.add(v3.mul(e1, Math.cos(a) * r), v3.mul(e2, Math.sin(a) * r)))); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
      g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = C_OUT; g.lineWidth = lw; g.stroke();
    };
    const knob = () => { const q = P(v3.add(trun, v3.mul(d, -17))); const r = 2.4 * K;
      const gr = g.createRadialGradient(q.x - r * 0.4, q.y - r * 0.4, 0, q.x, q.y, r); gr.addColorStop(0, L.barrel[0]); gr.addColorStop(1, L.barrel[2]);
      g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = C_OUT; g.lineWidth = lw; g.stroke(); };
    if (facing > 0) knob();
    if (facing <= 0) cap(pts3[ps.length - 1], 4.7, L.barrel[1]); // namlu ağzı arkada: dış halkası görünür
    if (facing > 0) cap(pts3[0], 5.1, L.barrel[2]);
    // gövde
    g.beginPath();
    ps.forEach((q, i) => { const r = ends[i][1] * K; i ? g.lineTo(q.x + px * r, q.y + py * r) : g.moveTo(q.x + px * r, q.y + py * r); });
    for (let i = ps.length - 1; i >= 0; i--) { const q = ps[i], r = ends[i][1] * K; g.lineTo(q.x - px * r, q.y - py * r); }
    g.closePath();
    const m = ps[3], R0 = 5 * K, gr = g.createLinearGradient(m.x + px * R0, m.y + py * R0, m.x - px * R0, m.y - py * R0);
    gr.addColorStop(0, L.barrel[1]); gr.addColorStop(0.22, L.barrel[0]); gr.addColorStop(0.5, L.barrel[1]); gr.addColorStop(1, L.barrel[2]);
    g.fillStyle = gr; g.fill(); g.strokeStyle = C_OUT; g.lineWidth = lw; g.stroke();
    // halkalar
    for (const [t, r] of [[-8.5, 5.3], [1.5, 5.0], [22, 4.6]]) {
      const c = v3.add(trun, v3.mul(d, t));
      ring(c, r, C_OUT, Math.max(1.2, 2.3 * K), false); ring(c, r, L.band, Math.max(0.7, 1.4 * K), false);
    }
    if (facing <= 0) knob();
    if (facing > 0) {
      // namlu ağzı ve karanlık iç
      const mc = pts3[ps.length - 1];
      cap(mc, 4.7, L.barrel[1]); cap(mc, 3.0, L.bore);
      ring(mc, 4.7, L.bandHi, Math.max(0.5, 0.7 * K), true);
    }
  }
  cheek(near);
  // yakın yanakta muylu başlığı
  { const q = P(v3.add(v3.add(trun, v3.mul(w, near * 7.6)), [0, 0, 0])); g.fillStyle = L.rim; g.beginPath(); g.arc(q.x, q.y, Math.max(1, 1.7 * K), 0, Math.PI * 2); g.fill(); g.strokeStyle = C_OUT; g.lineWidth = lw * 0.8; g.stroke(); }
  wheelPos.filter(p => p[1] === near).forEach(wheel);
}

// Kule görselinde topun oturduğu zemin noktası (oran); top ölçeği kule genişliğine göre
const CANNON = { floor: [0.48, 0.235], k: 1 / 68 };
function cannonPose(t, ts) {
  let rec = 0;
  if (t.shotAnim > 0) { const k = 1 - t.shotAnim / 0.35; rec = k < 0.15 ? k / 0.15 : Math.exp(-6 * (k - 0.15)) * Math.cos((k - 0.15) * 14); }
  const pop = t.born != null && G.t - t.born < 0.45 ? easeOutBack(clamp((G.t - t.born) / 0.45, 0, 1)) : 1;
  return { x: t.x + (CANNON.floor[0] - 0.5) * ts.w * pop, y: ts.bottom - (1 - CANNON.floor[1]) * ts.h * pop,
    k: ts.w * CANNON.k * pop, yaw: t.yaw ?? 0.25, el: t.el ?? 0.25, rec };
}
function cannonMuzzle(t, ts) {
  const P = cannonPose(t, ts);
  return cannonMuzzlePos(P.x, P.y, P.k, P.yaw, P.el, P.rec, t.lvl);
}
// Her karede 3B modeli yeniden çizmemek için açılar kademelere bölünüp önbelleğe alınır
const CANNON_CACHE = new Map(), CC_K = 2.4, CC_X = 44, CC_Y0 = -52, CC_Y1 = 16;
function cannonSprite(lvl, yaw, el, rec) {
  const qy = ((Math.round(yaw / (Math.PI * 2) * 72) % 72) + 72) % 72, qe = Math.round(el / 0.05), qr = Math.round(rec * 5);
  const key = lvl * 1e6 + qy * 1e3 + qe * 20 + (qr + 5);
  let c = CANNON_CACHE.get(key);
  if (!c) {
    if (CANNON_CACHE.size > 1200) CANNON_CACHE.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil(CC_X * 2 * CC_K); c.height = Math.ceil((CC_Y1 - CC_Y0) * CC_K);
    drawCannonModel(c.getContext('2d'), CC_X * CC_K, -CC_Y0 * CC_K, CC_K, qy / 72 * Math.PI * 2, qe * 0.05, qr / 5, lvl);
    CANNON_CACHE.set(key, c);
  }
  return c;
}
function drawCannon(t, ts) {
  const P = cannonPose(t, ts);
  if (t.spec === 'double') {
    // İkiz Toplar: arkada, hafif solda ikinci top
    const sx = -ts.w * 0.2, sy = -ts.h * 0.03;
    ctx.drawImage(cannonSprite(t.lvl, P.yaw, P.el, Math.max(0, P.rec - 0.3)), P.x + sx - CC_X * P.k * 0.9, P.y + sy + CC_Y0 * P.k * 0.9, CC_X * 2 * P.k * 0.9, (CC_Y1 - CC_Y0) * P.k * 0.9);
  }
  if (t.spec === 'napalm') {
    // Ateş Bataryası: namlu kızgın, ağzından duman tüter
    const m = cannonMuzzlePos(P.x, P.y, P.k, P.yaw, P.el, P.rec, t.lvl);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, m.x, m.y, 9 + Math.sin(G.t * 6) * 1.5, '255,110,30', 0.55); ctx.restore();
    if (Math.random() < 0.12) emit(G.parts, { kind: 'glow', x: m.x, y: m.y, vx: rand(-4, 4), vy: -rand(14, 26), col: '90,80,76', s0: 3, s1: 9, life: 1.2, a: 0.4 });
  }
  ctx.drawImage(cannonSprite(t.lvl, P.yaw, P.el, P.rec), P.x - CC_X * P.k, P.y + CC_Y0 * P.k, CC_X * 2 * P.k, (CC_Y1 - CC_Y0) * P.k);
  if (t.shotAnim > 0.25) {
    const m = cannonMuzzlePos(P.x, P.y, P.k, P.yaw, P.el, P.rec, t.lvl), k = (t.shotAnim - 0.25) / 0.1;
    const l = Math.hypot(m.dx, m.dy) || 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, m.x, m.y, 15 + 10 * k, '255,190,90', k); glow(ctx, m.x + m.dx / l * 6, m.y + m.dy / l * 6, 9 * k, '255,250,220', k);
    ctx.restore();
  }
}
// Menü simgeleri için: top kulesi görseli + üstündeki top tek görselde
const TOWER_ICONS = {};
function towerIcon(type, lvl) {
  const name = `tower_${type}_${lvl}`, im = spr(name);
  if (!im || type !== 'artillery') return im;
  if (TOWER_ICONS[name]) return TOWER_ICONS[name];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  drawCannonModel(g, CANNON.floor[0] * im.width, CANNON.floor[1] * im.height, im.width * CANNON.k, 0.45, 0.28, 0, lvl - 1);
  return (TOWER_ICONS[name] = c);
}
// Top kulesi 2. ve 3. seviyede gövdesine asılı sancaklar
function drawArtilleryBanners(t, ts) {
  if (t.lvl < 1) return;
  const s = ts.w / 70, top = ts.bottom - ts.h * 0.6;
  for (const side of [-1, 1]) {
    const x = t.x + side * ts.w * 0.24, sway = Math.sin(G.t * 1.6 + side) * 0.8 * s;
    const bw = 7.5 * s, bh = (t.lvl >= 2 ? 19 : 16) * s;
    ctx.save(); ctx.translate(x, top);
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#4a2e14'; ctx.strokeStyle = '#1e1208'; ctx.lineWidth = 0.9 * s;
    ctx.beginPath(); ctx.roundRect(-bw / 2 - 1.5 * s, -1.2 * s, bw + 3 * s, 2.4 * s, 1 * s); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0); ctx.lineTo(bw / 2, 0);
    ctx.lineTo(bw / 2 + sway * 0.4, bh); ctx.lineTo(sway * 0.6, bh - 3.5 * s); ctx.lineTo(-bw / 2 + sway * 0.4, bh); ctx.closePath();
    const fire = t.spec === 'napalm', twin = t.spec === 'double';
    ctx.fillStyle = fire ? '#1e1410' : twin ? '#2a3a6a' : t.lvl >= 2 ? '#a81e22' : '#b8322a'; ctx.fill();
    ctx.strokeStyle = fire ? '#ff7a2a' : t.lvl >= 2 ? '#f0c24a' : '#6a1410'; ctx.lineWidth = (t.lvl >= 2 ? 1.2 : 0.9) * s; ctx.stroke();
    if (fire) {
      // alev amblemi
      ctx.beginPath(); ctx.moveTo(sway * 0.2, bh * 0.2); ctx.quadraticCurveTo(sway * 0.2 + 3 * s, bh * 0.45, sway * 0.2 + 1.6 * s, bh * 0.62);
      ctx.quadraticCurveTo(sway * 0.2, bh * 0.7, sway * 0.2 - 1.8 * s, bh * 0.6); ctx.quadraticCurveTo(sway * 0.2 - 2.6 * s, bh * 0.42, sway * 0.2, bh * 0.2);
      ctx.fillStyle = '#ff8a2a'; ctx.fill();
      circle(sway * 0.2, bh * 0.52, 0.9 * s, '#ffe08a');
    } else if (twin) {
      circle(sway * 0.2 - 1.4 * s, bh * 0.42, 1.7 * s, '#f0c24a', '#7a4c10', 0.6 * s);
      circle(sway * 0.2 + 1.4 * s, bh * 0.42, 1.7 * s, '#f0c24a', '#7a4c10', 0.6 * s);
    } else if (t.lvl >= 2) {
      // altın gülle amblemi
      circle(sway * 0.2, bh * 0.42, 2.2 * s, '#f0c24a', '#7a4c10', 0.7 * s);
      circle(sway * 0.2 - 0.6 * s, bh * 0.42 - 0.6 * s, 0.7 * s, '#fff6c8');
    }
    ctx.restore();
  }
}

// Ayaz Kulesi: kürenin çevresinde buz kristali tacı, aşağı süzülen kırağı
function drawFrostCrown(t, ts, gy) {
  const s = ts.w / 70;
  ctx.save(); ctx.lineJoin = 'round';
  for (const [a, len, w] of [[-2.5, 13, 3.2], [-1.95, 17, 3.6], [-1.57, 20, 4], [-1.2, 16, 3.4], [-0.65, 12, 3]]) {
    const bx = t.x + Math.cos(a) * 5 * s, by = gy + 7 * s;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(-w / 2 * s, 0); ctx.lineTo(0, -len * s); ctx.lineTo(w / 2 * s, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -len * s); g.addColorStop(0, 'rgba(120,190,240,0.85)'); g.addColorStop(1, 'rgba(235,252,255,0.95)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(30,70,110,0.8)'; ctx.lineWidth = 0.7 * s; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.5 * s; ctx.beginPath(); ctx.moveTo(0, -2 * s); ctx.lineTo(0, -len * s * 0.8); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  if (Math.random() < 0.15) emit(G.parts, { kind: 'glow', add: true, x: t.x + rand(-12, 12) * s, y: gy + rand(0, 20) * s, vy: rand(6, 16), col: '190,240,255', s0: rand(1.5, 2.5), s1: 0.4, life: rand(0.8, 1.4) });
}
// Arkan Kulesi: kürenin çevresinde dönen mor rün taşları
function drawArcaneRunes(t, ts, gy) {
  const s = ts.w / 70;
  for (let i = 0; i < 4; i++) {
    const a = G.t * 1.6 + i * Math.PI / 2, rx = 17 * s, ry = 6 * s;
    const x = t.x + Math.cos(a) * rx, y = gy + 4 * s + Math.sin(a) * ry, front = Math.sin(a) > 0;
    ctx.save(); ctx.globalAlpha = front ? 1 : 0.55; ctx.translate(x, y); ctx.rotate(a * 0.5);
    ctx.beginPath(); ctx.moveTo(0, -3.4 * s); ctx.lineTo(2.4 * s, 0); ctx.lineTo(0, 3.4 * s); ctx.lineTo(-2.4 * s, 0); ctx.closePath();
    ctx.fillStyle = '#3a1a5a'; ctx.fill(); ctx.strokeStyle = '#d8a8ff'; ctx.lineWidth = 0.8 * s; ctx.stroke();
    ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(0, -1.6 * s); ctx.lineTo(0, 1.6 * s); ctx.moveTo(-1 * s, 0); ctx.lineTo(1 * s, 0); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 5 * s, '200,120,255', 0.5); ctx.restore();
  }
}

// ---- Kule okçusu: önceden çizilmiş (önbellekli) gövde/bacak/yay parçaları + eklemli kollar ----
// Birim uzay: ayaklar (0,0), boy ~30 birim, sağa bakar. Parçalar ARCH_R px/birim çözünürlükte bir kez çizilir.
const ARCH_R = 10;
const ARCHER_LOOK = [
  { tunic: ['#7dbb4e', '#3d7424'], hood: ['#86c454', '#3f7a26'], inner: '#1f3a12', cape: ['#4a8030', '#22451a'], sleeve: ['#6aa842', '#356a20'],
    trim: '#b07a3a', belt: '#5a3416', buckle: '#d9b45a', pants: ['#7a6446', '#4a3a26'], boot: ['#6a4022', '#3a200c'], bow: ['#d49a56', '#7a4a1e'], fletch: '#f1ead6', quiver: ['#a8703a', '#64401a'] },
  { tunic: ['#5aa848', '#2a6420'], hood: ['#3f8a34', '#1c4a16'], inner: '#122a0c', cape: ['#2f6a26', '#133212'], sleeve: ['#4f9a3c', '#265a1c'], vest: ['#b4783e', '#6c4018'],
    trim: '#e8b84a', belt: '#4a2a10', buckle: '#f2cd5a', pants: ['#5e4c34', '#3a2c1c'], boot: ['#5a3418', '#2e1808'], bow: ['#e0a65a', '#84501e'], fletch: '#e2412e', quiver: ['#8a5428', '#502e10'] },
  { tunic: ['#e04a40', '#8a1a16'], helm: ['#f4f8fc', '#8492a2'], plume: ['#ff5a48', '#a8141a'], cape: ['#c42a2c', '#5e0c10'], sleeve: ['#d2dae2', '#76808c'],
    trim: '#f4c84e', belt: '#4a2a10', buckle: '#ffe27a', pants: ['#4a4258', '#2a2434'], boot: ['#4a2e14', '#24140a'], bow: ['#ffd866', '#a06c10'], fletch: '#ffffff', quiver: ['#7a3a1e', '#401a0a'], hair: '#6a3a1a' },
];
// Uzmanlık kıyafetleri: zehir avcısı (koyu başlık + ağız maskesi), kartal göz (geniş kenarlı şapka + tüy)
ARCHER_LOOK.poison = { tunic: ['#3a4a2c', '#161e10'], hood: ['#3e5a2c', '#121c0a'], inner: '#050a03', cape: ['#26341c', '#0c1408'], sleeve: ['#40522e', '#1a2412'],
  vest: ['#5a3c22', '#2a1a0c'], trim: '#8aff4a', belt: '#1a0e06', buckle: '#8aff4a', pants: ['#3a3426', '#1e1a12'], boot: ['#3a2a18', '#1a1008'],
  bow: ['#7a9a3a', '#2e3e14'], fletch: '#8aff4a', quiver: ['#4a3a1e', '#22180a'], mask: '#1e2a16' };
ARCHER_LOOK.snipe = { tunic: ['#4a4e5c', '#1c1e26'], hat: ['#5a4630', '#21160a'], feather: ['#ff4a3a', '#8a1010'], hair: '#3a2210', cape: ['#6a1e18', '#2a0806'],
  sleeve: ['#545866', '#24262e'], vest: ['#6a4a2a', '#3a2410'], trim: '#e8c66a', belt: '#2a1608', buckle: '#e8c66a', pants: ['#3e3a40', '#1e1c22'],
  boot: ['#3a2414', '#180c04'], bow: ['#4a3420', '#140a04'], fletch: '#ff4a3a', quiver: ['#5a2a14', '#2a1006'], apron: true };
const ARCH_OUT = '#2a160a';
function archCanvas(x0, y0, w, h, paint) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * ARCH_R); c.height = Math.ceil(h * ARCH_R);
  const g = c.getContext('2d');
  g.scale(ARCH_R, ARCH_R); g.translate(-x0, -y0);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = ARCH_OUT; g.lineWidth = 1.05;
  paint(g);
  return { c, x0, y0, w, h };
}
const archGrad = (g, x0, y0, x1, y1, c) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); return gr; };
function paintArcherBody(g, L, lvl) {
  const fs = (fill) => { g.fillStyle = fill; g.fill(); g.stroke(); };
  // pelerin (arkada)
  g.beginPath(); g.moveTo(-1.5, -18.2);
  g.bezierCurveTo(-6.5, -17.5, -9.6, -12.5, -10, -6.4);
  g.quadraticCurveTo(-8.6, -7.4, -7.4, -6.2); g.quadraticCurveTo(-6.2, -7.3, -4.8, -6.4);
  g.lineTo(-2.2, -9); g.closePath();
  fs(archGrad(g, -6, -18, -6, -6, L.cape));
  g.save(); g.globalAlpha = 0.35; g.strokeStyle = '#000'; g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(-4, -16); g.quadraticCurveTo(-6.8, -12, -7.2, -7.2); g.stroke(); g.restore();
  // sadak: sırtta, oklar omzun üstünden görünür
  g.save(); g.translate(-4.4, -15.2); g.rotate(-0.42);
  for (const [dx, h, col] of [[-0.9, 3.4, L.fletch], [0.2, 4.2, L.fletch], [1.1, 3.0, L.fletch]]) {
    g.strokeStyle = ARCH_OUT; g.lineWidth = 0.9; g.beginPath(); g.moveTo(dx, -4.8); g.lineTo(dx, -4.8 - h + 1.2); g.stroke();
    g.beginPath(); g.moveTo(dx, -4.8 - h); g.lineTo(dx + 0.9, -4.8 - h + 1.8); g.lineTo(dx, -4.8 - h + 1.3); g.lineTo(dx - 0.9, -4.8 - h + 1.8); g.closePath();
    g.lineWidth = 0.55; g.fillStyle = col; g.fill(); g.stroke();
  }
  g.lineWidth = 1.05; g.beginPath(); g.roundRect(-2, -5.2, 4, 10.6, 1.3); fs(archGrad(g, -2, 0, 2, 0, L.quiver));
  g.fillStyle = L.trim; g.fillRect(-2, -4.4, 4, 0.9); g.fillRect(-2, 3.2, 4, 0.9);
  g.restore();
  // gövde (tunik)
  g.beginPath();
  g.moveTo(-4.4, -17.6); g.quadraticCurveTo(0, -18.6, 4.2, -17.6);
  g.lineTo(4.4, -10.6); g.quadraticCurveTo(5.4, -8.4, 5.6, -6.8);
  g.quadraticCurveTo(0, -5.8, -5.4, -6.8);
  g.quadraticCurveTo(-5.2, -8.6, -4.3, -10.6); g.closePath();
  fs(archGrad(g, -4, -18, 4, -7, L.tunic));
  // etek yırtmacı ve kenar süsü
  g.save(); g.clip();
  g.strokeStyle = L.trim; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-5.6, -7.2); g.quadraticCurveTo(0, -6.3, 5.8, -7.2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(1.4, -15.2, 1.6, 2.6, 0.2, 0, 7); g.fill();
  if (L.vest) {
    g.beginPath(); g.moveTo(-1.2, -18); g.lineTo(4.6, -17.8); g.lineTo(4.8, -10.4); g.lineTo(-0.6, -10.4); g.closePath();
    g.fillStyle = archGrad(g, -1, -18, 4, -10, L.vest); g.fill(); g.strokeStyle = ARCH_OUT; g.lineWidth = 0.7; g.stroke();
    g.fillStyle = L.trim; for (const y of [-16.4, -14.4, -12.4]) { g.beginPath(); g.arc(1.6, y, 0.45, 0, 7); g.fill(); }
  }
  if (lvl === 2 || L.apron) {
    // altın şeritli arma önlüğü
    g.fillStyle = L.trim; g.fillRect(0.6, -18, 1.4, 12);
    g.fillStyle = '#7a1210'; g.fillRect(1.0, -18, 0.6, 12);
  }
  g.restore();
  // kemer
  g.lineWidth = 0.7; g.beginPath(); g.roundRect(-4.6, -11.2, 9.4, 1.6, 0.5); fs(L.belt);
  g.beginPath(); g.roundRect(1.6, -11.5, 2.2, 2.2, 0.5); g.fillStyle = L.buckle; g.fill(); g.stroke();
  g.lineWidth = 1.05;
  // boyun
  g.beginPath(); g.roundRect(-0.6, -19.4, 3, 2.4, 0.8); fs('#e8a878');
  const hx = 1.2, hy = -23;
  const skin = archGrad(g, hx - 4, hy - 5, hx + 4, hy + 5, ['#ffe0bc', '#e9a674']);
  const face = () => {
    g.beginPath(); g.arc(hx, hy, 5.5, 0, Math.PI * 2); g.fillStyle = skin; g.fill();
    // yanak, göz, kaş, burun, ağız
    g.fillStyle = 'rgba(240,120,100,0.45)'; g.beginPath(); g.ellipse(hx + 3.0, hy + 1.8, 1.2, 0.8, 0, 0, 7); g.fill();
    g.fillStyle = '#1e1008'; g.beginPath(); g.ellipse(hx + 3.0, hy - 0.4, 0.75, 1.15, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 3.25, hy - 0.8, 0.32, 0, 7); g.fill();
    g.strokeStyle = '#4a2810'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(hx + 1.9, hy - 2.4); g.lineTo(hx + 4.0, hy - 2.0); g.stroke();
    g.strokeStyle = '#a8603a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(hx + 3.6, hy + 2.9); g.quadraticCurveTo(hx + 4.4, hy + 3.2, hx + 4.8, hy + 2.7); g.stroke();
    g.fillStyle = skin; g.strokeStyle = ARCH_OUT; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(hx + 5.2, hy - 0.4); g.quadraticCurveTo(hx + 6.6, hy + 0.9, hx + 5.2, hy + 1.4); g.fill(); g.stroke();
    g.lineWidth = 1.05;
  };
  if (L.helm) {
    // saç, yüz, miğfer, sorguç
    g.beginPath(); g.moveTo(hx - 5.4, hy - 1); g.quadraticCurveTo(hx - 6.6, hy + 4, hx - 3, hy + 5); g.lineTo(hx - 1, hy + 2); g.closePath(); fs(L.hair);
    face();
    g.beginPath(); g.arc(hx, hy, 5.5, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(hx - 0.6, hy - 6.6); g.bezierCurveTo(hx - 3, hy - 11.2, hx - 8.4, hy - 9.6, hx - 9.4, hy - 6.2);
    g.bezierCurveTo(hx - 7.6, hy - 7.6, hx - 4, hy - 7.6, hx - 0.6, hy - 6.6); fs(archGrad(g, hx, hy - 11, hx - 9, hy - 6, L.plume));
    g.beginPath(); g.ellipse(hx + 0.2, hy - 1.6, 6.3, 5.6, 0, Math.PI, Math.PI * 2); g.closePath(); fs(archGrad(g, hx - 3, hy - 7, hx + 4, hy - 1, L.helm));
    g.beginPath(); g.ellipse(hx + 0.2, hy - 1.4, 7.6, 1.5, 0, 0, Math.PI * 2); fs(archGrad(g, hx, hy - 3, hx, hy, L.helm));
    g.fillStyle = L.trim; g.strokeStyle = ARCH_OUT; g.lineWidth = 0.6; g.beginPath(); g.roundRect(hx - 0.5, hy - 7.4, 1.4, 6, 0.6); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(hx - 2.2, hy - 4.8, 1.6, 0.8, -0.5, 0, 7); g.fill();
  } else if (L.hat) {
    // geniş kenarlı nişancı şapkası, arkaya uzanan kırmızı tüy
    g.beginPath(); g.moveTo(hx - 5.4, hy - 1); g.quadraticCurveTo(hx - 6.6, hy + 4, hx - 3, hy + 5); g.lineTo(hx - 1, hy + 2); g.closePath(); fs(L.hair);
    face();
    g.beginPath(); g.arc(hx, hy, 5.5, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(hx - 1.6, hy - 6.6); g.bezierCurveTo(hx - 5, hy - 12.4, hx - 10.6, hy - 10.6, hx - 11.6, hy - 6.4);
    g.bezierCurveTo(hx - 9, hy - 8.2, hx - 5, hy - 8.2, hx - 1.6, hy - 6.6); fs(archGrad(g, hx, hy - 12, hx - 10, hy - 6, L.feather));
    g.beginPath(); g.moveTo(hx - 4.6, hy - 3.2); g.bezierCurveTo(hx - 4.8, hy - 9.6, hx + 4.8, hy - 9.8, hx + 4.6, hy - 3.2); g.closePath();
    fs(archGrad(g, hx - 4, hy - 9, hx + 4, hy - 3, L.hat));
    g.fillStyle = L.trim; g.fillRect(hx - 4.6, hy - 4.6, 9.2, 1.1);
    g.beginPath(); g.ellipse(hx + 0.4, hy - 3, 9, 1.9, -0.06, 0, Math.PI * 2); fs(archGrad(g, hx, hy - 5, hx, hy - 1, L.hat));
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(hx - 1.6, hy - 7, 2, 0.9, -0.3, 0, 7); g.fill();
  } else {
    // başlık: dış kontur + sivri ucu, yüz açıklığı
    g.beginPath();
    g.moveTo(hx + 4.8, hy + 4.6);
    g.bezierCurveTo(hx + 7.6, hy + 1, hx + 7.4, hy - 5.6, hx + 2.6, hy - 7.0);
    g.bezierCurveTo(hx - 2.4, hy - 8.2, hx - 6.0, hy - 5.6, hx - 7.0, hy - 2.4);
    g.quadraticCurveTo(hx - 8.6, hy + 0.6, hx - 10.2, hy + 2.2);
    g.quadraticCurveTo(hx - 7.4, hy + 3.4, hx - 6.2, hy + 4.6);
    g.quadraticCurveTo(hx - 3.6, hy + 6.6, hx - 1, hy + 6.4); g.closePath();
    fs(archGrad(g, hx - 6, hy - 8, hx + 4, hy + 6, L.hood));
    const open = () => { g.beginPath(); g.ellipse(hx + 2.7, hy + 0.3, 3.9, 4.9, -0.12, 0, Math.PI * 2); };
    g.save(); open(); g.clip(); g.fillStyle = L.inner; g.fillRect(hx - 3, hy - 6, 10, 12);
    g.translate(0.5, 0.3); face(); g.restore();
    open(); g.strokeStyle = L.hood[0]; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = ARCH_OUT; g.lineWidth = 0.55; g.stroke(); g.lineWidth = 1.05;
    // başlık parlaması ve dikiş
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(hx - 2, hy - 5.4, 2.6, 1.1, -0.35, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(hx - 1.4, hy - 7.6); g.quadraticCurveTo(hx - 5.4, hy - 3.6, hx - 9.4, hy + 2); g.stroke();
    if (L.trim && lvl === 1) { g.strokeStyle = L.trim; g.lineWidth = 0.5; open(); g.stroke(); }
    if (L.mask) {
      // ağzı ve burnu örten bez maske, zehir yeşili dikiş
      g.save(); open(); g.clip();
      g.beginPath(); g.moveTo(hx - 2, hy + 0.6); g.quadraticCurveTo(hx + 3, hy - 0.2, hx + 7.4, hy + 0.4); g.lineTo(hx + 7.4, hy + 6); g.lineTo(hx - 2, hy + 6); g.closePath();
      g.fillStyle = L.mask; g.fill(); g.strokeStyle = ARCH_OUT; g.lineWidth = 0.5; g.stroke();
      g.strokeStyle = L.trim; g.lineWidth = 0.4; g.setLineDash([0.6, 0.5]); g.beginPath(); g.moveTo(hx - 1, hy + 1.4); g.quadraticCurveTo(hx + 3, hy + 0.8, hx + 7, hy + 1.3); g.stroke(); g.setLineDash([]);
      g.restore(); g.lineWidth = 1.05;
    }
  }
  // omuz yaması
  g.lineWidth = 0.8; g.beginPath(); g.ellipse(-0.2, -17.4, 2.4, 1.5, 0, 0, Math.PI * 2); fs(archGrad(g, 0, -19, 0, -16, L.sleeve));
}
function paintArcherLeg(g, L, back) {
  const d = (c) => back ? [shade(c[0], 0.78), shade(c[1], 0.78)] : c;
  g.beginPath(); g.roundRect(-1.55, -0.4, 3.1, 7.6, 1.3); g.fillStyle = archGrad(g, -1.5, 0, 1.5, 0, d(L.pants)); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-1.8, 5.6); g.lineTo(1.7, 5.6); g.quadraticCurveTo(3.8, 7.2, 3.6, 8.9); g.lineTo(-1.9, 8.9); g.closePath();
  g.fillStyle = archGrad(g, 0, 5.6, 0, 9, d(L.boot)); g.fill(); g.stroke();
  g.strokeStyle = shade(L.boot[0], 1.25); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-1.5, 6.4); g.lineTo(1.6, 6.4); g.stroke();
}
function paintArcherBow(g, L) {
  const limb = () => { g.beginPath(); g.moveTo(-1.6, -8.6); g.quadraticCurveTo(-0.6, -8.2, 0, -7.4); g.bezierCurveTo(2.6, -4.6, 1.6, -1.4, 1.0, 0); g.bezierCurveTo(1.6, 1.4, 2.6, 4.6, 0, 7.4); g.quadraticCurveTo(-0.6, 8.2, -1.6, 8.6); };
  limb(); g.lineWidth = 2.0; g.strokeStyle = ARCH_OUT; g.stroke();
  limb(); g.lineWidth = 1.05; g.strokeStyle = L.bow[0]; g.stroke();
  limb(); g.lineWidth = 0.35; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
  g.beginPath(); g.roundRect(0.1, -1.3, 1.8, 2.6, 0.6); g.fillStyle = L.bow[1]; g.fill(); g.lineWidth = 0.6; g.strokeStyle = ARCH_OUT; g.stroke();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
const ARCH_CACHE = [];
function archerParts(lvl) {
  if (ARCH_CACHE[lvl]) return ARCH_CACHE[lvl];
  const L = ARCHER_LOOK[lvl];
  return (ARCH_CACHE[lvl] = {
    body: archCanvas(-12, -32, 21.5, 27, g => paintArcherBody(g, L, lvl)),
    leg: archCanvas(-2.6, -1.2, 7, 11, g => paintArcherLeg(g, L, false)),
    legB: archCanvas(-2.6, -1.2, 7, 11, g => paintArcherLeg(g, L, true)),
    bow: archCanvas(-2.8, -9.8, 6.4, 19.6, g => paintArcherBow(g, L)),
  });
}
function blitPart(c, P) { c.drawImage(pickMip(c, P.c, P.w), P.x0, P.y0, P.w, P.h); }
// o: ayak noktası; s: ölçek; a: okçu durumu (ang, draw, fx, walk, seed); lvl: kule seviyesi
function paintArcher(c, o, s, a, lvl) {
  const P = archerParts(lvl), L = ARCHER_LOOK[lvl];
  const face = Math.cos(a.ang) >= 0 ? 1 : -1;
  const la = clamp(face > 0 ? a.ang : Math.PI - a.ang, -1.25, 1.25);
  const walking = a.walk > 0;
  const bob = walking ? Math.abs(Math.sin(a.walk * 10)) * 0.9 : Math.sin(G.t * 2.4 + a.seed) * 0.3;
  const rel = a.fx > 0 ? a.fx / 0.18 : 0;
  c.save(); c.translate(o.x, o.y); c.scale(s * face, s);
  // gölge
  c.fillStyle = 'rgba(25,14,4,0.38)'; c.beginPath(); c.ellipse(0.4, 0, 5.6, 1.7, 0, 0, Math.PI * 2); c.fill();
  // bacaklar
  const sw = walking ? Math.sin(a.walk * 10) * 0.5 : 0, st = walking ? 0 : 0.2;
  const leg = (part, hx, ang) => { c.save(); c.translate(hx, -9 - bob * 0.3); c.rotate(ang); blitPart(c, part); c.restore(); };
  leg(P.legB, -1.2, -sw - st);
  leg(P.leg, 1.3, sw + st * 0.6);
  // gövde: hedefe doğru hafifçe eğilir, nefes alır
  const lean = la * 0.12 + (walking ? 0.06 : 0);
  c.translate(0, -9 - bob); c.rotate(lean); c.translate(0, 9);
  const br = 1 + Math.sin(G.t * 2.4 + a.seed) * 0.012;
  c.save(); c.translate(0, -9); c.scale(1, br); c.translate(0, 9); blitPart(c, P.body); c.restore();
  // kollar ve yay (gövde eğimine göre yerel açı)
  const aim = la - lean, ca = Math.cos(aim), sa = Math.sin(aim);
  const S = { x: 0.6, y: -16.4 }, H = { x: S.x + ca * 7.2, y: S.y + sa * 7.2 };
  const dr = 1.3 + a.draw * 5.6 - rel * 1.0;
  const Pw = { x: H.x - ca * dr, y: H.y - sa * dr };
  const limb = (pts, col, w) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x, p.y)); c.strokeStyle = ARCH_OUT; c.lineWidth = w + 1.1; c.stroke();
    c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x, p.y)); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  };
  // yay kolu
  limb([S, H], L.sleeve[1], 2.2);
  // yay
  c.save(); c.translate(H.x, H.y); c.rotate(aim); blitPart(c, P.bow);
  // kiriş
  c.strokeStyle = 'rgba(255,250,235,0.95)'; c.lineWidth = 0.38; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-1.6, -8.6); c.lineTo(-dr, 0); c.lineTo(-1.6, 8.6); c.stroke();
  // ok
  if (a.fx <= 0.06) {
    c.strokeStyle = ARCH_OUT; c.lineWidth = 0.95; c.beginPath(); c.moveTo(-dr, 0); c.lineTo(5.2, 0); c.stroke();
    c.strokeStyle = '#b07a3a'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(-dr, 0); c.lineTo(5.2, 0); c.stroke();
    c.fillStyle = '#e6ecf2'; c.strokeStyle = ARCH_OUT; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(7.0, 0); c.lineTo(5.0, -1.0); c.lineTo(5.4, 0); c.lineTo(5.0, 1.0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = L.fletch; c.beginPath(); c.moveTo(-dr + 0.4, 0); c.lineTo(-dr - 1.2, -1.0); c.lineTo(-dr + 1.6, 0); c.lineTo(-dr - 1.2, 1.0); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
  // yay elinin eli
  c.fillStyle = '#f2c095'; c.strokeStyle = ARCH_OUT; c.lineWidth = 0.6; c.beginPath(); c.arc(H.x, H.y, 1.25, 0, Math.PI * 2); c.fill(); c.stroke();
  // çeken kol: dirsek dışarı/yukarı kalkar
  const S2 = { x: -0.6, y: -16.0 };
  const mx = (S2.x + Pw.x) / 2, my = (S2.y + Pw.y) / 2, k = 1.6 + a.draw * 1.4;
  const E = { x: mx - sa * k * 0.4 - ca * a.draw * 1.4, y: my - Math.abs(ca) * k * 0.55 };
  limb([S2, E, Pw], L.sleeve[0], 2.3);
  c.fillStyle = '#f2c095'; c.strokeStyle = ARCH_OUT; c.lineWidth = 0.6; c.beginPath(); c.arc(Pw.x, Pw.y, 1.2, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}
// ---- Kışla askerleri: seviyeye göre belirgin zırh ve silah (önceden çizilmiş parçalar + eklemli kollar) ----
// 1. seviye: deri başlık, deri yelek, yuvarlak tahta kalkan, kısa kılıç
// 2. seviye: sorguçlu çelik miğfer, zincir zırh + mavi arma önlüğü, armalı badem kalkan, uzun kılıç
// 3. seviye: kapalı şövalye miğferi (beyaz-altın sorguç), altın işlemeli plaka zırh, omuzluklar,
//            kırmızı pelerin, altın taçlı büyük kalkan, altın kabzalı geniş kılıç
const SOLDIER_LOOK = [
  { tunic: ['#a8783e', '#6a4420'], sleeve: ['#9a6a36', '#5a3818'], pants: ['#6a5638', '#3e3020'], boot: ['#5a3a1c', '#2e1c0c'], belt: '#3e240e', trim: '#c9a05a',
    blade: ['#e8ecf2', '#8a929c'], hilt: '#6a4422', guard: '#8a8a90', bladeLen: 9.5 },
  { tunic: ['#3f78d0', '#1e3f80'], mail: ['#c8ced6', '#6e7680'], sleeve: ['#b8c0ca', '#646c78'], pants: ['#5a6270', '#30363e'], boot: ['#5a5e66', '#2a2e34'], belt: '#3a2410', trim: '#f2f4f8',
    helm: ['#f2f6fa', '#7c8896'], plume: ['#ff5a48', '#a8141a'], blade: ['#ffffff', '#9aa4b0'], hilt: '#4a2e18', guard: '#c9ced6', bladeLen: 12 },
  { tunic: ['#f4f6fa', '#9aa4b2'], plate: true, sleeve: ['#e8edf3', '#8a96a6'], pants: ['#d4dae2', '#7c8898'], boot: ['#c8d0da', '#6c7888'], belt: '#7a1a14', trim: '#f2c64e',
    helm: ['#ffffff', '#8592a2'], plume: ['#ffffff', '#d8c89a'], cape: ['#d8302c', '#6a0c10'], blade: ['#ffffff', '#b8c2ce'], hilt: '#5a1410', guard: '#f2c64e', bladeLen: 14 },
];
// Uzmanlık kostümleri. Muhafız: mavi-gümüş ağır plaka, kapalı miğfer, büyük kule kalkanı.
// Akıncı: hafif pul zırh, çıplak kollar, açık miğfer ve uzun at kılı sorguç, kalkan yerine ikinci kılıç.
SOLDIER_LOOK.guard = { tunic: ['#e6edf6', '#7d8a9c'], plate: true, sleeve: ['#dfe6ef', '#6d7a8c'], pants: ['#c4ccd8', '#5c6878'], boot: ['#aab4c2', '#4c5868'], belt: '#1c2e5a', trim: '#cfdcf0',
  helm: ['#eef3fa', '#6d7a8c'], plume: ['#5a9cff', '#1a3a8a'], cape: ['#2a4a9a', '#0e1e48'], blade: ['#ffffff', '#b8c2ce'], hilt: '#1c2e5a', guard: '#cfdcf0', bladeLen: 11, shield: 'tower', head: 2 };
SOLDIER_LOOK.berserk = { tunic: ['#d8362c', '#6a0e0c'], mail: ['#8a7460', '#3e3228'], sleeve: ['#f0b888', '#b0704a'], pants: ['#3a2a22', '#1e140e'], boot: ['#4a2e14', '#24140a'], belt: '#2a1206', trim: '#ffb040',
  helm: ['#a8b0bc', '#3e4652'], plume: ['#3a2a2a', '#0a0606'], cape: ['#4a0c0a', '#1a0404'], blade: ['#fff8ec', '#c0a890'], hilt: '#3a0e08', guard: '#ffb040', bladeLen: 15, offhand: true, head: 'crest' };
const SOL_OUT = '#22140a';
function paintSoldierBody(g, L, lvl) {
  const fs = (fill) => { g.fillStyle = fill; g.fill(); g.stroke(); };
  g.lineWidth = 1.05; g.strokeStyle = SOL_OUT;
  // pelerin
  if (L.cape) {
    g.beginPath(); g.moveTo(-2, -18.4); g.bezierCurveTo(-7.5, -17, -10.4, -12, -10.2, -5.6);
    g.quadraticCurveTo(-8.4, -6.8, -7, -5.4); g.quadraticCurveTo(-5.6, -6.6, -4, -5.8); g.lineTo(-2.4, -9); g.closePath();
    fs(archGrad(g, -6, -18, -6, -6, L.cape));
    g.fillStyle = L.trim; g.fillRect(-9.8, -6.6, 0.1, 0.1);
  }
  // gövde
  g.beginPath();
  g.moveTo(-4.6, -17.8); g.quadraticCurveTo(0, -19, 4.6, -17.8);
  g.lineTo(4.8, -10.2); g.quadraticCurveTo(5.6, -8.2, 5.6, -6.6); g.quadraticCurveTo(0, -5.6, -5.4, -6.6); g.quadraticCurveTo(-5.4, -8.4, -4.5, -10.2); g.closePath();
  fs(archGrad(g, -4, -18, 4, -7, L.mail || L.tunic));
  g.save(); g.clip();
  if (L.mail) {
    // zincir zırh dokusu + mavi önlük
    g.strokeStyle = 'rgba(40,46,56,0.35)'; g.lineWidth = 0.35;
    for (let y = -18; y < -6; y += 1.1) for (let x = -5; x < 6; x += 1.1) { g.beginPath(); g.arc(x + (Math.round(y) % 2) * 0.55, y, 0.45, 0, Math.PI); g.stroke(); }
    g.beginPath(); g.moveTo(-2.2, -18.6); g.lineTo(4.2, -18.6); g.lineTo(4.6, -6); g.lineTo(-2.6, -6); g.closePath();
    g.fillStyle = archGrad(g, 0, -18, 0, -6, L.tunic); g.fill(); g.strokeStyle = SOL_OUT; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = L.trim; g.fillRect(0.6, -16.5, 1, 6); g.fillRect(-0.9, -14.2, 4, 1);
  } else if (L.plate) {
    // plaka zırh: göğüs plakası parlaması ve altın şeritler
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(1.2, -15, 1.6, 3, 0.15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = L.trim; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-4.6, -12.6); g.quadraticCurveTo(0, -11.6, 4.8, -12.6); g.stroke();
    g.beginPath(); g.moveTo(0.4, -18.6); g.lineTo(0.6, -12); g.stroke();
    g.strokeStyle = 'rgba(60,70,84,0.5)'; g.lineWidth = 0.5;
    for (const y of [-9.4, -7.8]) { g.beginPath(); g.moveTo(-5.4, y); g.quadraticCurveTo(0, y + 0.8, 5.6, y); g.stroke(); }
  } else {
    // deri yelek: dikiş ve çapraz kayış
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.ellipse(1.4, -15, 1.6, 2.6, 0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,20,6,0.45)'; g.lineWidth = 0.45; g.setLineDash([0.7, 0.6]);
    g.beginPath(); g.moveTo(0.5, -18.4); g.lineTo(0.8, -6.2); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#4a2a10'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-4.4, -17.6); g.lineTo(4.6, -10.6); g.stroke();
  }
  g.restore();
  g.strokeStyle = SOL_OUT; g.lineWidth = 0.7;
  g.beginPath(); g.roundRect(-4.8, -11, 10, 1.6, 0.5); fs(L.belt);
  g.beginPath(); g.roundRect(1.8, -11.3, 2, 2.2, 0.5); g.fillStyle = L.trim; g.fill(); g.stroke();
  g.lineWidth = 1.05;
  // omuzluk
  if (L.plate) {
    g.beginPath(); g.ellipse(-0.6, -17.4, 3.6, 2.2, -0.15, Math.PI, Math.PI * 2.05); g.closePath(); fs(archGrad(g, 0, -20, 0, -16, L.sleeve));
    g.strokeStyle = L.trim; g.lineWidth = 0.6; g.beginPath(); g.ellipse(-0.6, -17.4, 3.1, 1.7, -0.15, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.strokeStyle = SOL_OUT; g.lineWidth = 1.05;
  }
  // boyun ve baş
  g.beginPath(); g.roundRect(-0.6, -19.6, 3, 2.4, 0.8); fs('#e8a878');
  const hx = 1.2, hy = -23.2;
  const skin = archGrad(g, hx - 4, hy - 5, hx + 4, hy + 5, ['#ffe0bc', '#e9a674']);
  const face = () => {
    g.beginPath(); g.arc(hx, hy, 5.3, 0, Math.PI * 2); g.fillStyle = skin; g.fill(); g.stroke();
    g.fillStyle = 'rgba(240,120,100,0.4)'; g.beginPath(); g.ellipse(hx + 3, hy + 1.8, 1.1, 0.75, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1e1008'; g.beginPath(); g.ellipse(hx + 3, hy - 0.2, 0.7, 1.05, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a2810'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(hx + 1.8, hy - 2); g.lineTo(hx + 4, hy - 1.7); g.stroke();
    g.fillStyle = skin; g.strokeStyle = SOL_OUT; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(hx + 5, hy - 0.2); g.quadraticCurveTo(hx + 6.4, hy + 1, hx + 5, hy + 1.6); g.fill(); g.stroke();
    g.lineWidth = 1.05;
  };
  const head = L.head ?? lvl;
  if (head === 'crest') {
    face();
    // açık miğfer, yanak siperi, arkaya savrulan uzun at kılı sorguç, boyunda kızıl atkı
    g.beginPath(); g.moveTo(hx - 1, hy - 6.6); g.bezierCurveTo(hx - 4, hy - 14, hx - 12, hy - 11, hx - 12.6, hy - 2);
    g.bezierCurveTo(hx - 10.6, hy - 6.4, hx - 8.6, hy - 6.6, hx - 7.8, hy - 4.6);
    g.bezierCurveTo(hx - 6.6, hy - 8, hx - 4, hy - 8, hx - 1, hy - 6.6); fs(archGrad(g, hx, hy - 13, hx - 11, hy - 3, L.plume));
    g.beginPath(); g.ellipse(hx - 0.1, hy - 1.2, 6.2, 6.1, 0, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(hx + 6, hy - 0.6); g.lineTo(hx - 6, hy - 0.6); g.closePath();
    fs(archGrad(g, hx - 3, hy - 7, hx + 4, hy, L.helm));
    g.beginPath(); g.moveTo(hx - 6, hy - 0.6); g.lineTo(hx - 6.4, hy + 4.4); g.lineTo(hx - 2.8, hy + 3.6); g.lineTo(hx - 2.6, hy - 0.6); g.closePath(); fs(archGrad(g, 0, hy, 0, hy + 4, L.helm));
    g.strokeStyle = L.trim; g.lineWidth = 0.7; g.beginPath(); g.moveTo(hx - 5.8, hy - 2.2); g.bezierCurveTo(hx - 3, hy - 3.6, hx + 3, hy - 3.6, hx + 5.9, hy - 1.8); g.stroke();
    g.strokeStyle = SOL_OUT; g.lineWidth = 1.05;
    g.beginPath(); g.moveTo(hx - 3.6, hy + 5); g.quadraticCurveTo(hx + 1, hy + 6.8, hx + 4.4, hy + 4.6); g.lineTo(hx + 3.6, hy + 7); g.quadraticCurveTo(hx - 1, hy + 8.2, hx - 4.4, hy + 6.6); g.closePath();
    fs(archGrad(g, 0, hy + 4, 0, hy + 8, L.tunic));
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(hx - 2.4, hy - 4.8, 1.8, 0.8, -0.5, 0, Math.PI * 2); g.fill();
  } else if (head === 0) {
    face();
    // deri başlık + kulaklık
    g.beginPath(); g.ellipse(hx - 0.2, hy - 1.2, 5.9, 5.2, 0, Math.PI * 0.98, Math.PI * 2.05); g.lineTo(hx + 1, hy - 0.6); g.lineTo(hx - 1.2, hy + 3.4); g.lineTo(hx - 5.6, hy + 2); g.closePath();
    fs(archGrad(g, hx, hy - 7, hx, hy + 2, ['#9a6a36', '#5a3818']));
    g.strokeStyle = 'rgba(40,20,6,0.5)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(hx - 5.6, hy - 1.6); g.quadraticCurveTo(hx, hy - 3.2, hx + 5.6, hy - 1.8); g.stroke();
  } else if (head === 1) {
    face();
    // burun korumalı çelik miğfer + kırmızı sorguç
    g.beginPath(); g.moveTo(hx - 0.4, hy - 6.4); g.bezierCurveTo(hx - 2, hy - 11.4, hx - 8, hy - 10.4, hx - 9.6, hy - 6.4);
    g.bezierCurveTo(hx - 7.4, hy - 8, hx - 3.6, hy - 7.8, hx - 0.4, hy - 6.4); fs(archGrad(g, hx, hy - 11, hx - 9, hy - 6, L.plume));
    g.beginPath(); g.ellipse(hx - 0.1, hy - 1, 6.1, 6, 0, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(hx + 6, hy - 0.4); g.lineTo(hx - 6, hy - 0.4); g.closePath();
    fs(archGrad(g, hx - 3, hy - 7, hx + 4, hy, L.helm));
    g.beginPath(); g.roundRect(hx + 3.6, hy - 1.2, 1.3, 4.2, 0.5); fs(archGrad(g, 0, hy - 1, 0, hy + 3, L.helm));
    g.beginPath(); g.moveTo(hx - 6, hy - 0.4); g.lineTo(hx - 6.2, hy + 3.4); g.lineTo(hx - 3.4, hy + 3); g.lineTo(hx - 3, hy - 0.4); g.closePath(); fs(archGrad(g, 0, hy, 0, hy + 3, L.helm));
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(hx - 2.4, hy - 4.6, 1.8, 0.8, -0.5, 0, Math.PI * 2); g.fill();
  } else {
    // kapalı şövalye miğferi: göz yarığı, nefes delikleri, altın taç şeridi, uzun beyaz sorguç
    g.beginPath(); g.moveTo(hx - 0.6, hy - 6.6); g.bezierCurveTo(hx - 3, hy - 13.4, hx - 10.4, hy - 12.2, hx - 11.4, hy - 6.4);
    g.bezierCurveTo(hx - 9.6, hy - 7.2, hx - 8, hy - 5.6, hx - 7.6, hy - 3.4);
    g.bezierCurveTo(hx - 6.8, hy - 7, hx - 3.6, hy - 8, hx - 0.6, hy - 6.6); fs(archGrad(g, hx, hy - 13, hx - 10, hy - 4, L.plume));
    g.beginPath(); g.moveTo(hx - 5.8, hy + 4.2); g.lineTo(hx - 6, hy - 2.6); g.bezierCurveTo(hx - 5.6, hy - 8, hx + 4.6, hy - 8.4, hx + 6, hy - 2.4);
    g.lineTo(hx + 6.4, hy + 1.4); g.quadraticCurveTo(hx + 5.6, hy + 4.4, hx + 2.6, hy + 5); g.lineTo(hx - 3, hy + 5); g.closePath();
    fs(archGrad(g, hx - 4, hy - 8, hx + 4, hy + 4, L.helm));
    g.fillStyle = '#1a1c22'; g.beginPath(); g.roundRect(hx + 0.6, hy - 1.6, 5.6, 1.1, 0.5); g.fill();
    g.fillStyle = '#2a2e36'; for (const [x, y] of [[3.6, 1.4], [4.8, 1.4], [3.6, 2.6], [4.8, 2.6]]) { g.beginPath(); g.arc(hx + x, hy + y, 0.35, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = L.trim; g.lineWidth = 0.9; g.beginPath(); g.moveTo(hx - 5.8, hy - 3.2); g.bezierCurveTo(hx - 3, hy - 4.6, hx + 3, hy - 4.6, hx + 6.1, hy - 2.8); g.stroke();
    g.beginPath(); g.moveTo(hx - 0.2, hy - 7.6); g.lineTo(hx - 0.2, hy - 3.8); g.stroke();
    g.strokeStyle = SOL_OUT; g.lineWidth = 1.05;
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(hx - 2.6, hy - 5, 1.9, 0.9, -0.5, 0, Math.PI * 2); g.fill();
  }
}
function paintSoldierShield(g, L, lvl) {
  g.lineWidth = 1.05; g.strokeStyle = SOL_OUT; g.lineJoin = 'round';
  if (L.offhand) { g.save(); g.scale(0.8, 0.8); paintSoldierSword(g, Object.assign({}, L, { bladeLen: 10 })); g.restore(); return; }
  if (L.shield === 'tower') {
    // büyük kule kalkanı: mavi alan, gümüş kenar ve haç, perçinler
    g.beginPath(); g.moveTo(-6.4, -9.6); g.quadraticCurveTo(0, -11, 6.4, -9.6); g.lineTo(6.6, 6.4); g.quadraticCurveTo(0, 12.6, -6.6, 6.4); g.closePath();
    g.fillStyle = archGrad(g, -6, -10, 6, 10, ['#4a7ee0', '#16306e']); g.fill(); g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = '#d8e2f0'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-5.5, -8.7); g.quadraticCurveTo(0, -9.9, 5.5, -8.7); g.lineTo(5.7, 5.9); g.quadraticCurveTo(0, 11.3, -5.7, 5.9); g.closePath(); g.stroke();
    g.fillStyle = '#eef3fa'; g.fillRect(-0.9, -8.4, 1.8, 16.6); g.fillRect(-4.8, -3.4, 9.6, 1.8);
    g.fillStyle = '#cfdcf0'; for (const [x, y] of [[-4.6, -7.4], [4.6, -7.4], [-4.6, 4.6], [4.6, 4.6]]) { g.beginPath(); g.arc(x, y, 0.55, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(-2.6, -5.6, 2.2, 1.1, -0.4, 0, Math.PI * 2); g.fill();
    return;
  }
  if (lvl === 0) {
    g.beginPath(); g.arc(0, 0, 4.6, 0, Math.PI * 2); g.fillStyle = archGrad(g, -4, -4, 4, 4, ['#b07a40', '#6a4420']); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(40,20,6,0.45)'; g.lineWidth = 0.4; for (const x of [-2, 0, 2]) { g.beginPath(); g.moveTo(x, -4.2); g.lineTo(x, 4.2); g.stroke(); }
    g.strokeStyle = '#8a8e96'; g.lineWidth = 0.9; g.beginPath(); g.arc(0, 0, 4.1, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 1.4, 0, Math.PI * 2); g.fillStyle = '#b8bcc4'; g.fill(); g.strokeStyle = SOL_OUT; g.lineWidth = 0.6; g.stroke();
  } else if (lvl === 1) {
    g.beginPath(); g.moveTo(-4, -5.4); g.quadraticCurveTo(0, -6.4, 4, -5.4); g.lineTo(4, 0); g.quadraticCurveTo(3.4, 4.6, 0, 7.4); g.quadraticCurveTo(-3.4, 4.6, -4, 0); g.closePath();
    g.fillStyle = archGrad(g, 0, -6, 0, 7, ['#4a86e0', '#1c3a7a']); g.fill(); g.stroke();
    g.fillStyle = '#f4f6fa'; g.fillRect(-0.6, -5.2, 1.2, 11); g.fillRect(-3.4, -2.4, 6.8, 1.2);
    g.strokeStyle = '#c9ced6'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-3.4, -4.9); g.quadraticCurveTo(0, -5.8, 3.4, -4.9); g.lineTo(3.4, 0); g.quadraticCurveTo(2.9, 4, 0, 6.6); g.quadraticCurveTo(-2.9, 4, -3.4, 0); g.closePath(); g.stroke();
  } else {
    g.beginPath(); g.moveTo(-5, -6.6); g.quadraticCurveTo(0, -7.8, 5, -6.6); g.lineTo(5, 0.4); g.quadraticCurveTo(4.2, 5.8, 0, 9); g.quadraticCurveTo(-4.2, 5.8, -5, 0.4); g.closePath();
    g.fillStyle = archGrad(g, 0, -7, 0, 9, ['#e83a32', '#7a0e10']); g.fill(); g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = '#f2c64e'; g.lineWidth = 1; g.beginPath(); g.moveTo(-4.3, -6); g.quadraticCurveTo(0, -7, 4.3, -6); g.lineTo(4.3, 0.4); g.quadraticCurveTo(3.6, 5.2, 0, 8); g.quadraticCurveTo(-3.6, 5.2, -4.3, 0.4); g.closePath(); g.stroke();
    // altın taç amblemi
    g.fillStyle = '#f2c64e'; g.strokeStyle = '#6a3e0a'; g.lineWidth = 0.4;
    g.beginPath(); g.moveTo(-2.6, 1.6); g.lineTo(-2.6, -1.6); g.lineTo(-1.3, -0.2); g.lineTo(0, -2.4); g.lineTo(1.3, -0.2); g.lineTo(2.6, -1.6); g.lineTo(2.6, 1.6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-2, -4, 2, 1, -0.4, 0, Math.PI * 2); g.fill();
  }
}
function paintSoldierSword(g, L) {
  const len = L.bladeLen;
  g.lineJoin = 'round'; g.strokeStyle = SOL_OUT; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(-0.9, 0); g.lineTo(-0.9, -len); g.lineTo(0, -len - 1.6); g.lineTo(0.9, -len); g.lineTo(0.9, 0); g.closePath();
  g.fillStyle = archGrad(g, -1, 0, 1, 0, L.blade); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(120,130,145,0.6)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(0, -0.5); g.lineTo(0, -len + 0.5); g.stroke();
  g.strokeStyle = SOL_OUT; g.lineWidth = 0.7;
  g.beginPath(); g.roundRect(-2.6, -0.3, 5.2, 1.3, 0.5); g.fillStyle = L.guard; g.fill(); g.stroke();
  g.beginPath(); g.roundRect(-0.7, 0.9, 1.4, 2.6, 0.5); g.fillStyle = L.hilt; g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 4.1, 0.9, 0, Math.PI * 2); g.fillStyle = L.guard; g.fill(); g.stroke();
}
const SOL_CACHE = {};
function soldierParts(lvl) {
  if (SOL_CACHE[lvl]) return SOL_CACHE[lvl];
  const L = SOLDIER_LOOK[lvl];
  return (SOL_CACHE[lvl] = {
    body: archCanvas(-12.5, -37, 22, 32.5, g => paintSoldierBody(g, L, lvl)),
    leg: archCanvas(-2.6, -1.2, 7, 11, g => paintArcherLeg(g, L, false)),
    legB: archCanvas(-2.6, -1.2, 7, 11, g => paintArcherLeg(g, L, true)),
    shield: L.shield === 'tower' ? archCanvas(-8, -12, 16, 26, g => paintSoldierShield(g, L, lvl))
      : L.offhand ? archCanvas(-3, -11, 6, 16, g => paintSoldierShield(g, L, lvl)) : archCanvas(-6, -9, 12, 19, g => paintSoldierShield(g, L, lvl)),
    sword: archCanvas(-3, -L.bladeLen - 2.4, 6, L.bladeLen + 7.6, g => paintSoldierSword(g, L)),
  });
}
// o: ayak; s: ölçek; face: yön; walk: yürüyüş zamanı (0 = durgun); atk: saldırı evresi (atkPhase) ya da null
function paintSoldier(c, o, s, face, lvl, walk, atk, seed, fx) {
  const P = soldierParts(lvl), L = SOLDIER_LOOK[lvl];
  const bob = walk ? Math.abs(Math.sin(walk * 9)) * 0.9 : Math.sin(G.t * 2.2 + seed) * 0.25;
  c.save(); c.translate(o.x, o.y); c.scale(s * face, s);
  c.fillStyle = 'rgba(25,14,4,0.35)'; c.beginPath(); c.ellipse(0.4, 0, 5.8, 1.7, 0, 0, Math.PI * 2); c.fill();
  // saldırı: hazırlıkta kılıç geriye-yukarı kalkar, vuruşta öne-aşağı iner; gövde öne atılır
  // nöbet duruşu: kılıç önde, yukarı bakar; hazırlıkta başın üstüne kalkar, vuruşta öne-aşağı iner
  let swing = 0.75 + Math.sin(G.t * 2.2 + seed) * 0.04, lunge = 0;
  // dört evre: hazırlık (kılıç başın üstüne) → vuruş (hızla öne-aşağı) → çarpma (titreşim) → toparlanma
  let step = 0;
  if (atk != null) {
    if (atk < 0) { const k = easeInOut(clamp(1 + atk / 0.3, 0, 1)); swing = 0.75 - 2.3 * k; lunge = -0.6 * k; step = -0.15 * k; }
    else if (atk < 0.07) { const k = easeOutQ(atk / 0.07); swing = -1.55 + 3.6 * k; lunge = lerp(-0.6, 1.8, k); step = 0.4 * k; }
    else if (atk < 0.16) { const k = (atk - 0.07) / 0.09; swing = 2.05 + Math.sin(k * Math.PI * 2) * 0.1 * (1 - k); lunge = 1.8; step = 0.4; }
    else { const k = easeInOut(clamp((atk - 0.16) / 0.29, 0, 1)); swing = 2.05 - 1.3 * k; lunge = 1.8 * (1 - k); step = 0.4 * (1 - k); }
  }
  const sw = walk ? Math.sin(walk * 9) * 0.5 : 0, st = walk ? 0 : 0.18;
  const leg = (part, hx, ang) => { c.save(); c.translate(hx, -9 - bob * 0.3); c.rotate(ang); blitPart(c, part); c.restore(); };
  c.translate(lunge, 0);
  leg(P.legB, -1.2, -sw - st - step * 0.5);
  leg(P.leg, 1.3, sw + st * 0.6 + step);
  c.translate(0, -bob);
  // kılıç kolu (uzak taraf): omuzdan, kılıçla birlikte döner
  const S = { x: -0.2, y: -16.6 };
  c.save(); c.translate(S.x, S.y); c.rotate(swing);
  c.lineCap = 'round';
  c.strokeStyle = SOL_OUT; c.lineWidth = 3.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -6.2); c.stroke();
  c.strokeStyle = L.sleeve[1]; c.lineWidth = 2.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -6.2); c.stroke();
  c.translate(0, -6.6); c.rotate(-0.25); blitPart(c, P.sword);
  if (fx && fx.blade) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + Math.sin(G.t * 6) * 0.2; c.fillStyle = 'rgba(255,200,90,0.9)'; c.fillRect(-1.3, -L.bladeLen - 1, 2.6, L.bladeLen); c.restore(); }
  c.fillStyle = '#f2c095'; c.strokeStyle = SOL_OUT; c.lineWidth = 0.6; c.beginPath(); c.arc(0, 1.6, 1.3, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
  // vuruş izi
  if (atk != null && atk >= 0 && atk < 0.2) {
    c.save(); c.globalAlpha = (1 - atk / 0.2) * 0.8; c.strokeStyle = '#fff6dc'; c.lineWidth = 1.6; c.lineCap = 'round';
    c.beginPath(); c.arc(S.x, S.y, 6.6 + L.bladeLen * 0.8, -1.55 - Math.PI / 2, swing - Math.PI / 2); c.stroke(); c.restore();
  }
  blitPart(c, P.body);
  // kalkan (yakın taraf), göğüs önünde
  c.save();
  if (L.offhand) { c.translate(3.4 + lunge * 0.6, -11.8); c.rotate(1.0 - (swing - 0.75) * 0.3); } // akıncı: ikinci kılıç önde, ters yönde savrulur
  else { c.translate(3.6 + lunge * 0.4, -12.4); c.rotate(0.08); }
  blitPart(c, P.shield);
  if (fx && fx.wall) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + Math.sin(G.t * 4) * 0.12; c.fillStyle = '#9fd8ff'; c.beginPath(); c.ellipse(0, 0.6, 5.2, 7.2, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  c.restore();
  c.restore();
}

function drawArcher(t, ts, i, a) {
  paintArcher(ctx, archerPoint(t, ts, i), archerScale(ts), a, t.spec && ARCHER_LOOK[t.spec] ? t.spec : t.lvl);
  const rec = a.fx > 0 ? a.fx / 0.18 : 0;
  if (rec > 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const bp = bowPoint(t, ts, i); glow(ctx, bp.x, bp.y, 5 * rec, '255,245,200', rec * 0.8); ctx.restore(); }
}

function drawTower(t) {
  drawTowerBody(t);
  if (t.disabledT > 0) drawTowerDisabled(t);
}
// susturulan kule: üstünde dönen yıldızlar (sersemleme) ya da mor lanet halkası
function drawTowerDisabled(t) {
  const ts = towerSprite(t), top = ts ? ts.bottom - ts.h - 4 : t.y - 70, a = Math.min(1, t.disabledT / 0.4);
  ctx.save(); ctx.globalAlpha = a;
  if (t.disabledKind === 'hex') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, t.x, t.y - 30, 40, '150,60,255', 0.35 + Math.sin(time * 8) * 0.1); ctx.restore();
    ctx.strokeStyle = 'rgba(200,130,255,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.lineDashOffset = time * 25;
    ctx.beginPath(); ctx.ellipse(t.x, t.y - 26, 30, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  for (let i = 0; i < 3; i++) {
    const an = time * 4 + i * 2.09, sx = t.x + Math.cos(an) * 14, sy = top + Math.sin(an) * 4;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(time * 3);
    ctx.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 2 : 4.6, aa = j / 10 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(aa) * r, Math.sin(aa) * r); } ctx.closePath();
    ctx.fillStyle = t.disabledKind === 'hex' ? '#d8a8ff' : '#ffe27a'; ctx.fill(); ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
function drawTowerBody(t) {
  const ts = towerSprite(t);
  if (ts) {
    const age = G.t - (t.born ?? -9);
    const pop = age < 0.45 ? easeOutBack(clamp(age / 0.45, 0, 1)) : 1; // inşa/yükseltme zıplaması
    // top ateşlediğinde kule hafifçe sarsılır (top kendi içinde geri teper)
    const ksy = t.type === 'artillery' && t.shotAnim > 0.2 ? 1 - (t.shotAnim - 0.2) * 0.25 : 1;
    ctx.save(); ctx.translate(t.x, ts.bottom); ctx.scale(pop, pop * ksy);
    drawSprite(ctx, ts.im, 0, 0, ts.w);
    ctx.restore();
    if (t.type === 'artillery') { drawArtilleryBanners(t, ts); drawCannon(t, ts); }
    if (t.type === 'archer' && t.shots && age > 0.3) {
      // okçular arkadan öne sıralı çizilir; önlerindeki korkuluk/mazgal katmanı en üste gelir
      const ord = t.shots.map((a, i) => i).sort((i, j) => t.shots[i].q - t.shots[j].q);
      for (const i of ord) drawArcher(t, ts, i, t.shots[i]);
      const fr = spr(`tower_archer_${t.lvl + 1}_front`);
      if (fr) { ctx.save(); ctx.translate(t.x, ts.bottom); ctx.scale(pop, pop); drawSprite(ctx, fr, 0, 0, ts.w); ctx.restore(); }
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
      const arc = t.spec === 'blast', ice = t.spec === 'frost';
      if (ice) drawFrostCrown(t, ts, gy);
      if (arc) drawArcaneRunes(t, ts, gy);
      const g = ctx.createRadialGradient(t.x, gy, 0, t.x, gy, r * 2);
      g.addColorStop(0, arc ? 'rgba(240,190,255,0.7)' : ice ? 'rgba(220,250,255,0.7)' : 'rgba(200,230,255,0.6)');
      g.addColorStop(1, arc ? 'rgba(170,60,255,0)' : ice ? 'rgba(120,220,255,0)' : 'rgba(80,140,255,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, gy, r * 2, 0, Math.PI * 2); ctx.fill();
      // küre etrafında çıtırdayan kısa elektrik arkları
      const sd = Math.floor(G.t * 14 + t.x);
      if (sd % 3 === 0 || t.shotAnim > 0) {
        const a0 = (sd * 2.39996) % (Math.PI * 2), L = 7 + (sd % 5);
        strokeLightning(lightningPts(t.x + Math.cos(a0) * 3, gy + Math.sin(a0) * 3, t.x + Math.cos(a0) * L, gy + Math.sin(a0) * L * 0.8, sd, 0.35), 0.45, arc ? 'rgb(200,120,255)' : ice ? 'rgb(170,235,255)' : 'rgb(130,180,255)', 0.9);
      }
      ctx.restore();
    }
    return;
  }
  shadow(t.x, t.y + 4, 26, 11);
  drawTowerShape(t.type, t.x, t.y, t.lvl, BUILD_K, t);
  // seviye pipleri
  for (let i = 0; i <= t.lvl; i++) {
    const px = t.x - t.lvl * 5 + i * 10;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath();
    ctx.moveTo(px, t.y + 8); ctx.lineTo(px + 3.5, t.y + 11.5); ctx.lineTo(px, t.y + 15); ctx.lineTo(px - 3.5, t.y + 11.5); ctx.fill();
  }
}

// kumun altında ilerleyen solucan: yürüyen bir kum tümseği ve arkasında toz
function drawBurrow(e) {
  const k = (CHAR_H['enemy_' + e.type] || 30) / 30, wob = Math.sin(e.anim * 10) * 1.2;
  ctx.fillStyle = 'rgba(40,20,8,0.22)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 15 * k, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(e.x - 3 * k, e.y - 6 * k, 1, e.x, e.y - 2 * k, 14 * k);
  g.addColorStop(0, '#f0c088'); g.addColorStop(1, '#a8703e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, e.y - 1.5 * k, 13 * k + wob, 6.5 * k - wob * 0.3, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,20,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(e.x - 5 * k, e.y - 4 * k); ctx.lineTo(e.x - 1 * k, e.y - 2 * k); ctx.lineTo(e.x + 4 * k, e.y - 5 * k); ctx.stroke();
  if (Math.random() < 0.3) emit(G.parts, { kind: 'glow', x: e.x - e.face * 8 * k, y: e.y - 2, vx: -e.face * rand(5, 15), vy: -rand(5, 15), col: '220,180,120', s0: 3, s1: 7, life: 0.5, a: 0.45 });
}

function drawEnemy(e) {
  const d = e.def;
  const fly = d.flying ? 26 + Math.sin(e.anim * 3) * 3 : 0;
  const bob = d.flying ? 0 : Math.abs(Math.sin(e.anim * 9)) * (e.blocker ? 0.5 : 2);
  const x = e.x, y = e.y - fly - bob;
  const name = 'enemy_' + e.type, im = d.base ? enemySprite(e.type) : spr(name);
  const dh = (d.h || 30) * UNIT_K;
  if (e.under) { drawBurrow(e); return; }
  if (im) {
    if (d.chief) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - 2, dh * 0.9, d.ab && d.ab.blink ? '90,220,230' : '255,70,40', 0.3 + Math.sin(time * 4) * 0.1);
      ctx.restore();
      ctx.strokeStyle = `rgba(255,90,60,${0.6 + Math.sin(time * 5) * 0.2})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, dh * 0.55, dh * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawUnit(name, im, e.x, e.y, e.face, {
      rig: d.base ? 'enemy_' + d.base : undefined,
      h: CHAR_H[name] || d.r * 2.6, phase: e.anim * (5 + d.speed * G.wspd / 9),
      rise: e.reviveT > 0 ? 0.25 + 0.75 * (1 - e.reviveT / 1.1) : e.emergeT > 0 ? 1 - e.emergeT / 0.35 * 0.85 : null,
      walking: !e.blocker && e.siege === undefined && !(e.stun > 0) && !(e.shootT > 0) && !(e.reviveT > 0),
      fly: (d.flying ? fly : 0) + (e.hopT > 0 ? Math.sin((1 - e.hopT / 0.4) * Math.PI) * 10 : 0),
      atk: e.siege !== undefined ? e.siege - SIEGE_HIT : e.inMelee ? atkPhase(d.rate, e.atk) : e.shootT > 0 ? 0.27 - e.shootT : null,
      flash: e.flash, hit: e.hitT, wings: d.flying ? e.anim : null, seed: e.off,
    });
    const top = e.y - fly - (CHAR_H[name] || 20) - 6;
    const fr = e.hp / e.maxHp;
    if (d.chief && im.generated) drawCrown(e.x + e.face * dh * 0.06, top - 2, dh / 44, e.face);
    if (e.plate > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - dh * 0.5, dh * 0.75, '170,195,255', 0.22 + Math.sin(time * 3 + e.x) * 0.08);
      ctx.restore();
    } else if (e.phase2 && Math.random() < 0.4) {
      emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-dh * 0.3, dh * 0.3), y: e.y - rand(0, dh), vy: -rand(20, 50), col: '255,90,40', s0: rand(2, 4), s1: 0.5, life: 0.6 });
    }
    if (e.rageT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - dh * 0.45, dh * 0.9, '255,60,30', 0.45 + Math.sin(time * 14) * 0.12);
      ctx.restore();
    }
    if (e.shieldT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - dh * 0.5, dh * 0.85, '110,190,255', 0.55 + Math.sin(time * 12) * 0.1);
      ctx.restore();
      circle(e.x, e.y - dh * 0.5, dh * 0.62, null, 'rgba(170,220,255,0.8)', 2);
    }
    if (e.markT > 0) {
      ctx.save(); ctx.translate(e.x, top - 12); ctx.rotate(time * 2);
      circle(0, 0, 6, null, '#ff4a4a', 2); ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-4, 0); ctx.moveTo(4, 0); ctx.lineTo(9, 0); ctx.moveTo(0, -9); ctx.lineTo(0, -4); ctx.moveTo(0, 4); ctx.lineTo(0, 9); ctx.stroke();
      ctx.restore();
    }
    // can barı yalnızca hasar almış düşmanda görünür
    if (fr < 0.999) {
      if (!d.chief) hpBar(e.x, top, d.boss ? 30 : 14, fr, d.boss ? '#ff7a3a' : fr > 0.5 ? '#5bd35b' : fr > 0.25 ? '#f2c230' : '#ef4a3a');
      else hpBar(e.x, top + 6, 34, fr, '#ff5a3a');
    }
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
  if (e.hp < e.maxHp * 0.999) hpBar(e.x, top, d.boss ? 40 : 20, e.hp / e.maxHp);
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
  const fighting = s.target && dist(s.x, s.y, s.target.x, s.target.y) < 21;
  const r = s.hero ? 8 : 5.5;
  const name = s.hero ? s.def.sprite : s.militia ? 'militia' : 'soldier';
  // kışla askeri: seviyeye göre zırh/silah değişen çizim
  if (name === 'soldier') {
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    const ab = s.tower && s.tower.ab;
    const look = s.tower && s.tower.spec === 'shield' ? 'guard' : s.tower && s.tower.spec === 'blade' ? 'berserk' : s.gear || 0;
    paintSoldier(ctx, { x: s.x, y: s.y }, 0.72 * UNIT_K, s.face || 1, look, walking ? s.anim : 0, fighting ? atkPhase(s.rate, s.atk) : null, (s.slot || 0) * 1.7,
      ab ? { blade: !!ab.blade, wall: !!ab.shield } : null);
    if (s.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 12, 14, '255,255,255', s.flash * 6); ctx.restore(); }
    if (s.hp < s.maxHp) hpBar(s.x, s.y - CHAR_H.soldier - 6, 11, s.hp / s.maxHp, '#4cd34c');
    return;
  }
  let im = s.hero ? heroSprite(s.def) : spr(name), key = name, pad = 0, glowIm = null;
  if (name === 'soldier') { const gs = gearSprite(s.gear || 0); if (gs) { im = gs.im; key = gs.key; pad = gs.pad; glowIm = gs.glow; } }
  if (im) {
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    const ch = s.hero ? s.def.h * UNIT_K : CHAR_H[name];
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
const ATK_PREP = 0.3, ATK_AFTER = 0.45; // hazırlık süresi / vuruştan sonra toparlanmanın bittiği an
function atkPhase(rate, atk) {
  const since = rate - atk;
  return since < ATK_AFTER ? since : -atk;
}
const easeOutQ = (x) => 1 - (1 - x) * (1 - x);

// ----- karakter animasyonu -----
// Her karakter görseli üç parçaya ayrılır: gövde, arka bacak (sol yarı) ve ön bacak (sağ yarı).
// Yürürken bacaklar sırayla öne savrulup kalkar, gövde adım ortasında yükselip iner ve kalçadan hafif sallanır.
// Saldırı dört evreden oluşur: hazırlık (silah geride, ağırlık arka ayakta), vuruş (çok hızlı öne savrulma, ön ayak
// öne basar, arkada iz), çarpma (gövde ezilir ve sarsılır) ve toparlanma (yavaşça duruşa döner).
// Yarasada iki kanat gövdenin iki yanından ayrı ayrı çırpar.
const RIG = {
  enemy_goblin: { legY: 0.7 }, enemy_bandit: { legY: 0.72 }, enemy_orc: { legY: 0.7 }, enemy_shaman: { legY: 0.8, stride: 0.55 },
  enemy_knight: { legY: 0.72 }, enemy_troll: { legY: 0.7, stride: 0.8 }, enemy_wolf: { legY: 0.6, stride: 1.25 }, enemy_bat: { wings: true },
  hero: { legY: 0.72 }, soldier: { legY: 0.7 }, militia: { legY: 0.74 },
  hero_caner: { legY: 0.7 }, hero_zeynep: { legY: 0.7 }, hero_cat: { legY: 0.72, stride: 1.15 }, hero_sage: { legY: 0.8, stride: 0.55 },
  // 2. sefer. flip: görsel sola bakıyor (aynalanır). solid: bacaksız tek parça (float: süzülür, worm: tabandan salınır)
  enemy_raider: { legY: 0.72 }, enemy_scorpion: { legY: 0.58, stride: 1.3, flip: true }, enemy_vulture: { wings: true, flip: true },
  enemy_camel: { legY: 0.62, stride: 1.2, flip: true }, enemy_sandworm: { solid: 'worm' }, enemy_mummy: { legY: 0.72, stride: 0.7 },
  enemy_djinn: { solid: 'float' }, enemy_golem: { legY: 0.7, stride: 0.8 },
  enemy_scorpion_queen: { legY: 0.6, stride: 1.2 }, enemy_worm_king: { solid: 'worm' }, enemy_storm_djinn: { solid: 'float' },
};
const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function drawRig(im, w, h, legY, P, rig) {
  const mip = pickMip(ctx, im, w), mw = mip.width, mh = mip.height;
  const part = (x0, y0, x1, y1, dx, dy) => ctx.drawImage(mip, x0 * mw, y0 * mh, (x1 - x0) * mw, (y1 - y0) * mh,
    -w / 2 + x0 * w + dx, -h + y0 * h + dy, (x1 - x0) * w, (y1 - y0) * h);
  if (rig.solid) {
    // bacaksız: süzülen cin merkezinden hafifçe sallanır ve yükselip alçalır; solucan tabanından salınır, nefes alır gibi uzar
    const fl = rig.solid === 'float', py = fl ? -h * 0.5 : 0;
    const sway = fl ? Math.sin(time * 1.8 + w) * 0.03 : Math.sin(time * 3 + w) * 0.06;
    const bob = fl ? Math.sin(time * 2.4 + w) * h * 0.04 : 0, st = fl ? 1 : 1 + Math.sin(time * 4 + w) * 0.04;
    ctx.save(); ctx.translate(0, py + P.bodyDy + bob); ctx.rotate(P.rot * 0.7 + sway); ctx.scale(P.sx, P.sy * st); ctx.translate(0, -py);
    part(0, 0, 1, 1, 0, 0);
    ctx.restore();
    return;
  }
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
  } else if (o.atk != null && o.atk > -ATK_PREP && o.atk < ATK_AFTER) {
    const u = h / 24; // öne atılma mesafesi birim boyuyla orantılı
    if (o.atk < 0) {
      // 1) hazırlık: silahı kaldırıp geriye yaslanır, ağırlık arka ayağa geçer
      const k = easeInOut((o.atk + ATK_PREP) / ATK_PREP);
      P.rot = -0.38 * k; ox = -2.5 * u * k; P.sy = 1 + 0.05 * k; P.sx = 1 - 0.03 * k; P.stepF = 0.03 * k; P.stepB = -0.05 * k;
    } else if (o.atk < 0.07) {
      // 2) vuruş: çok hızlı öne savrulur, ön ayak öne basar
      const k = easeOutQ(o.atk / 0.07);
      P.rot = lerp(-0.38, 0.52, k); ox = lerp(-2.5, 7, k) * u; P.stepF = lerp(0.03, 0.11, k) * S; P.stepB = lerp(-0.05, -0.07, k) * S;
      P.sx = 1 + 0.04 * k; P.sy = 1 - 0.03 * k;
      ghost = 1; glowK = k;
    } else if (o.atk < 0.16) {
      // 3) çarpma: gövde ezilir, darbenin etkisiyle hafifçe titrer
      const k = (o.atk - 0.07) / 0.09;
      P.rot = 0.52 + Math.sin(k * Math.PI * 2) * 0.05 * (1 - k); ox = 7 * u; P.stepF = 0.11 * S; P.stepB = -0.07 * S;
      P.sx = 1 + 0.08 * (1 - k); P.sy = 1 - 0.07 * (1 - k); P.bodyDy = h * 0.015 * (1 - k);
      ghost = 1 - k; glowK = 1;
    } else {
      // 4) toparlanma: yavaşça duruşa döner, ön ayak geri çekilir
      const k = easeInOut(clamp((o.atk - 0.16) / (ATK_AFTER - 0.16), 0, 1));
      P.rot = 0.52 * (1 - k); ox = 7 * u * (1 - k); P.stepF = 0.11 * S * (1 - k); P.stepB = -0.07 * S * (1 - k);
      glowK = 1 - k;
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
  ctx.scale(face * (rig.flip ? -1 : 1), 1);
  if (o.rise != null) ctx.scale(1, o.rise); // kumdan çıkış
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

// Ölüm beş evre: geri sarsılma → dizler bükülür, gövde çöker → geriye devrilir → yere çarpıp seker → solar
const CORPSE_DUR = 1.15;
function drawCorpse(f) {
  const im = spr(f.name);
  if (!im) return;
  const t = f.t, rig = RIG[f.rig || f.name] || { legY: 0.7 };
  const h = f.h || CHAR_H[f.name] || 20, w = h * im.width / im.height, legY = rig.legY ?? 0.7;
  const P = { rot: 0, sx: 1, sy: 1, bodyDy: 0, stepF: 0, stepB: 0, liftF: 0, liftB: 0, flap: 0 };
  let rot = 0, oy = 0;
  if (rig.wings) {
    // yarasa: çırpınır, kanatlar kapanır, dönerek düşer
    const k = clamp(t / 0.45, 0, 1);
    P.flap = Math.sin(t * 34) * (1 - k) - 0.8 * k;
    oy = -f.fly * (1 - k * k); rot = k * 1.1;
  } else if (t < 0.08) {
    const k = t / 0.08;
    P.rot = -0.3 * k; oy = -h * 0.05 * Math.sin(k * Math.PI);
  } else if (t < 0.28) {
    const k = easeInOut((t - 0.08) / 0.2);
    P.rot = -0.3 - 0.2 * k; P.bodyDy = h * (1 - legY) * 0.35 * k; P.sy = 1 - 0.05 * k;
    P.stepF = 0.06 * k; P.stepB = -0.04 * k;
  } else {
    const k = clamp((t - 0.28) / 0.24, 0, 1);
    P.rot = -0.5 + 0.3 * k; P.bodyDy = h * (1 - legY) * 0.35; P.sy = 0.95; P.stepF = 0.06; P.stepB = -0.04;
    rot = -1.4 * k * k;
    const b = (t - 0.52) / 0.18;
    if (b > 0 && b < 1) rot += Math.sin(b * Math.PI) * 0.12 * (1 - b);
  }
  ctx.save();
  ctx.globalAlpha = 1 - clamp((t - 0.6) / (CORPSE_DUR - 0.6), 0, 1);
  ctx.translate(f.x, f.y + 1 + oy);
  ctx.scale(f.face * (rig.flip ? -1 : 1), 1);
  ctx.rotate(rot);
  drawRig(im, w, h, legY, P, rig);
  if (t < 0.12) { ctx.globalAlpha *= 0.8; drawRig(whiteOf(f.name, im), w, h, legY, P, rig); }
  ctx.restore();
}

function drawProjectile(p) {
  if (p.kind === 'meteor') { drawMeteor(p); return; }
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
    ctx.strokeStyle = p.poison ? 'rgba(140,255,80,0.6)' : 'rgba(255,250,230,0.35)'; ctx.lineWidth = p.poison ? 1.8 : 1.2; ctx.lineCap = 'round';
    if (p.poison) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 6, '140,255,80', 0.6); ctx.restore(); }
    ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-11, -2.6); ctx.lineTo(-6, 0); ctx.lineTo(-11, 2.6); ctx.fill();
    ctx.fillStyle = '#d8dbe2'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.4); ctx.lineTo(3, 2.4); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'bolt') {
    // yıldırım 'zap' efektiyle çiziliyor
  } else if (p.kind === 'hex') {
    // şaman büyüsü: yeşil kıvrık ışık topu
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, 10, '120,255,90', 0.85); glow(ctx, x, y, 4, '235,255,220', 1);
    for (let i = 0; i < 2; i++) { const a = time * 14 + i * Math.PI; glow(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 3, 2.5, '170,255,140', 0.8); }
    ctx.restore();
  } else if (p.kind === 'axe') {
    // ork baltası: dönerek uçar
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 16 * (p.tx < p.sx ? -1 : 1));
    ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.stroke();
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(5.5, -6.5, 6, -1.5); ctx.quadraticCurveTo(3, -2.4, 0, -1.6); ctx.closePath();
    ctx.fillStyle = '#c8ced8'; ctx.fill(); ctx.strokeStyle = '#2a2e38'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.restore();
  } else if (p.kind === 'knife') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 20);
    ctx.fillStyle = '#e8ecf4'; ctx.strokeStyle = '#2a2e38'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-1.3, 0); ctx.lineTo(0, -5.6); ctx.lineTo(1.3, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    roundRect(-0.9, 0, 1.8, 3, 0.7, '#5a3418');
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
  } else if (p.kind === 'bossthrow') {
    const gx = lerp(p.sx, p.tx, k), gy = lerp(p.sy + 40, p.ty + 30, k);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(gx, gy, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin + time * 8);
    if (p.sub === 'bomb') {
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7); g.addColorStop(0, '#6a6e78'); g.addColorStop(1, '#0e0e12');
      circle(0, 0, 6.5, g, '#000', 1.2);
      ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(3, -5); ctx.quadraticCurveTo(6, -9, 5, -11); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + Math.cos(p.spin + time * 8) * 5, y - 10, 6, '255,200,90', 0.9 + Math.sin(time * 50) * 0.1); ctx.restore();
    } else {
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#a49a8c'); g.addColorStop(1, '#4a4238');
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = 8.5 + Math.sin(i * 2.3) * 1.6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#241c14'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
    }
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
  if (f.t < 0) return; // gecikmeli başlayan efekt
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
  } else if (f.kind === 'zap') {
    drawZap(f);
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
  } else if (f.kind === 'portal') {
    // yerde dönen büyü geçidi
    const o = k < 0.2 ? k / 0.2 : k > 0.75 ? (1 - k) / 0.25 : 1, r = 26 * (0.6 + 0.4 * Math.min(1, k * 4));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, f.x, f.y - 4, r * 1.6, f.col, 0.55 * o);
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(${f.col},${0.8 * o})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, r * (1 - i * 0.25), r * (1 - i * 0.25) * 0.42, 0, time * (3 + i) + i * 2, time * (3 + i) + i * 2 + Math.PI * 1.3); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.5) emit(G.parts, { kind: 'glow', add: true, x: f.x + rand(-r, r), y: f.y + rand(-r, r) * 0.4, vy: -rand(30, 70), col: f.col, s0: 3, s1: 0.5, life: 0.6 });
  } else if (f.kind === 'firering') {
    // yerde genişleyen alev halkası
    const e = 1 - Math.pow(1 - k, 2.5), r = f.r * (0.25 + 0.75 * e);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, fx = f.x + Math.cos(a) * r, fy = f.y + Math.sin(a) * r * 0.45;
      glow(ctx, fx, fy - 4, 10 * (1 - k) + 3, i % 2 ? '255,130,40' : '255,200,90', 1 - k);
    }
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

// yuvarlak 3B buton; fn yoksa (oyun içi HUD) dokunma hudTap'te ayrıca yakalanır
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
    // son seviye: iki uzmanlık yolu; biri seçilince yalnız o kalır ve 3 kademeye kadar geliştirilir
    t.def.abilities.forEach((a, i) => {
      if (t.spec && t.spec !== a.id) return;
      const r = (t.ab && t.ab[a.id]) || 0;
      items.push({ id: 'ability', type: a.id, ab: a, rank: r, x: t.spec ? t.x : t.x + (i ? 44 : -44), y: t.y - 76, cost: r < a.ranks.length ? a.ranks[r].cost : null });
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
  // halka menü ekran koordinatında kurulur: seçilen yerin ekrandaki konumu merkez alınır
  if (sel.kind === 'plot') { const q = worldToScreen(sel.plot.x, sel.plot.y); items = plotMenuItems(q); cx = q.x; cy = q.y - 16; }
  else { const q = worldToScreen(sel.tower.x, sel.tower.y); items = towerMenuItems(Object.assign({}, sel.tower, q)); cx = q.x; cy = q.y - 20; }
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
// Seçili düşmanın özellik paneli (alt orta)
const ENEMY_PANEL = { x: 960 / 2 - 165, y: 540 - 104, w: 330, h: 92 };
// seçili düşmanın altındaki halka (dünyada)
function drawEnemyRing() {
  const e = G.sel && G.sel.kind === 'enemy' && G.sel.enemy;
  if (!e || e.dead) return;
  const eh = CHAR_H['enemy_' + e.type] || 26;
  ctx.save(); ctx.strokeStyle = 'rgba(255,220,120,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -time * 20;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, Math.max(12, eh * 0.45), Math.max(5, eh * 0.18), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function drawEnemyPanel() {
  const e = G.sel && G.sel.kind === 'enemy' && G.sel.enemy;
  if (!e) return;
  if (e.dead || e.siege !== undefined) { G.sel = null; return; }
  const d = e.def, P = ENEMY_PANEL, k = easeOutBack(clamp((time - G.menuT) / 0.25, 0, 1));
  const eh = CHAR_H['enemy_' + e.type] || 26, fy = d.flying ? 26 : 0;
  ctx.save(); ctx.translate(P.x + P.w / 2, P.y + P.h / 2); ctx.scale(k, k); ctx.translate(-(P.x + P.w / 2), -(P.y + P.h / 2));
  roundRect(P.x + 2, P.y + 4, P.w, P.h, 14, 'rgba(0,0,0,0.3)');
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
  g.addColorStop(0, d.chief ? 'rgba(90,24,16,0.95)' : 'rgba(58,40,24,0.95)'); g.addColorStop(1, 'rgba(22,12,6,0.95)');
  roundRect(P.x, P.y, P.w, P.h, 14, g, d.chief ? '#ff7a5a' : '#d4ab5a', 1.6);
  // portre
  const cx = P.x + 36, cy = P.y + P.h / 2;
  circle(cx, cy, 27, '#1a120a', d.chief ? '#ff7a5a' : '#c9a35a', 2);
  const im = enemySprite(e.type) || spr('enemy_' + e.type);
  if (im) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 25.5, 0, Math.PI * 2); ctx.clip(); const ih = d.chief ? 64 : 48; drawSprite(ctx, im, cx, cy + ih * 0.55, ih * im.width / im.height); ctx.restore(); }
  const x0 = P.x + 72;
  txt(d.name, x0, P.y + 15, 15, '#fff', 'left', '400', FONT_T);
  if (d.chief || d.boss) { ctx.font = `400 15px ${FONT_T}`; const nw = ctx.measureText(d.name).width; roundRect(x0 + nw + 6, P.y + 8, 34, 14, 7, '#c8392c'); txt('BOSS', x0 + nw + 23, P.y + 15.5, 9, '#fff', 'center', '800', FONT_B, false); }
  // can barı
  const fr = clamp(e.hp / e.maxHp, 0, 1), bw = P.w - 84;
  roundRect(x0, P.y + 24, bw, 9, 4.5, 'rgba(0,0,0,0.5)');
  if (fr > 0) roundRect(x0, P.y + 24, Math.max(9, bw * fr), 9, 4.5, fr > 0.5 ? '#5bd35b' : fr > 0.25 ? '#f2c230' : '#ef4a3a');
  txt(`${Math.ceil(e.hp)} / ${Math.round(e.maxHp)}`, x0 + bw / 2, P.y + 29, 8.5, '#fff', 'center', '800', FONT_B, false);
  // değerler
  const st = [`Zırh %${Math.round(d.armor * 100)}`, `Büyü dir. %${Math.round(d.mr * 100)}`, `Hız ${d.speed}`, `Can kaybı ${d.lives}`];
  if (d.flying) st.push('Uçar');
  txt(st.join(' · '), x0, P.y + 44, 9.5, '#f0e2c4', 'left', '700', FONT_B, false);
  // zayıflık / direnç
  const wk = d.wk || {}, weak = Object.keys(wk).filter(q => wk[q] > 1), res = Object.keys(wk).filter(q => wk[q] < 1);
  let tx = x0;
  const tag = (label, list, col, bg) => {
    const s2 = label + ' ' + (list.length ? list.map(q => `${WK_NAME[q]} ${wk[q] > 1 ? '+' : '−'}%${Math.round(Math.abs(wk[q] - 1) * 100)}`).join(', ') : 'yok');
    ctx.font = `800 9.5px ${FONT_B}`; const tw = ctx.measureText(s2).width + 12;
    roundRect(tx, P.y + 52, tw, 15, 7.5, bg, col, 1);
    txt(s2, tx + tw / 2, P.y + 60, 9.5, col, 'center', '800', FONT_B, false);
    tx += tw + 5;
  };
  tag('Zayıf:', weak, '#ffd08a', 'rgba(150,60,10,0.6)');
  tag('Dirençli:', res, '#a8d8ff', 'rgba(20,60,120,0.6)');
  const desc = d.desc || ENEMY_DESC[e.type] || '';
  if (desc) txt(desc, x0, P.y + 79, 9.5, '#cdbb98', 'left', '700', FONT_B, false);
  ctx.restore();
}

function setSel(sel) {
  const old = G.sel;
  const same = old && sel && old.kind === sel.kind && old.plot === sel.plot && old.tower === sel.tower && old.hero === sel.hero && old.enemy === sel.enemy;
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
  if (G.sel.kind !== 'plot' && G.sel.kind !== 'tower') return;
  drawMenuLayout(menuLayout(), time - G.menuT, false, G.preview);
}

// menzil önizleme ve toplanma bayrağı: dünyada çizilir, zoomla birlikte büyür
function drawMenuRange() {
  if (!G.sel) return;
  if (G.sel.kind === 'tower') {
    const t = G.sel.tower;
    let rangeShow = effLevel(t).range; // yıldız gelişmeleri ve yetenekler dahil gerçek menzil
    if (G.preview && G.preview.id === 'upgrade') rangeShow = effLevel(Object.assign({}, t, { lvl: t.lvl + 1 })).range;
    drawRange(t.x, t.y - (t.type === 'barracks' ? 0 : 10), rangeShow * Math.min(1, easeOutBack(clamp((time - G.menuT) / 0.3, 0, 1))), t.type === 'barracks');
    if (t.type === 'barracks') drawRally(t.rx, t.ry);
  } else if (G.preview && G.preview.id === 'build') {
    const pl = G.sel.plot;
    drawRange(pl.x, pl.y - 10, TOWERS[G.preview.type].levels[0].range, G.preview.type === 'barracks');
  }
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
    const im = towerIcon(it.type, 1);
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
// Dalga göstergesinin rengi dalgaya göre ısınır: yeşil → sarı → turuncu; son dalga yanıp sönen kırmızı
function waveTint() {
  const n = G.lv.waves.length, w = G.wave;
  if (w <= 0) return null;
  if (w >= n) return ['rgba(190,30,20,0.96)', 'rgba(80,6,4,0.96)', '#ff9a7a', '255,60,30'];
  const k = (w - 1) / Math.max(1, n - 2); // 0 ilk dalga, 1 sondan bir önceki
  const stops = [[60, 120, 40], [170, 140, 30], [200, 90, 20], [190, 50, 20]];
  const f = k * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), t = f - i;
  const c = stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * t));
  return [`rgba(${c[0]},${c[1]},${c[2]},0.94)`, `rgba(${c[0] * 0.35 | 0},${c[1] * 0.35 | 0},${c[2] * 0.35 | 0},0.94)`, `rgb(${Math.min(255, c[0] + 70)},${Math.min(255, c[1] + 70)},${Math.min(255, c[2] + 60)})`];
}
function statPill(x, y, w, icon, text, col, popT, label, tint) {
  const h = 26;
  roundRect(x + 1.5, y + 3, w, h, h / 2, 'rgba(0,0,0,0.28)');
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tint ? tint[0] : 'rgba(66,48,30,0.92)'); g.addColorStop(1, tint ? tint[1] : 'rgba(26,18,10,0.92)');
  if (tint && tint[3]) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + w / 2, y + h / 2, w * 0.75, tint[3], 0.3 + Math.sin(time * 6) * 0.12); ctx.restore(); }
  roundRect(x, y, w, h, h / 2, g, tint ? tint[2] : '#c9a35a', 1.6);
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
  // HUD'a çarpmayan güvenli bölge
  const blocked = (x, y) => x < 26 || x > W - 26 || y < 26 || y > H - 26 ||
    (x < 300 && y < 64) || (x > W - 180 && y < 74) || (x < 280 && y > H - 92);
  let d = 0, q = pathPos(p, 0);
  while (d < p.total - 40 && blocked(q.x, q.y)) { d += 3; q = pathPos(p, d); }
  d += 8; q = pathPos(p, d);
  return (G.waveBtn[pi] = { x: q.x, y: q.y, dx: q.dx, dy: q.dy });
}

// erken çağrı ödülü: kalan geri sayım ve dalga numarasıyla büyür
function earlyBonus() {
  return G.wave > 0 && G.waveCountdown > 0 ? Math.ceil(G.waveCountdown * (1.5 + 0.15 * G.wave)) : 0;
}

// dalga çağrılınca buton kaybolur; sahadaki düşmanlar temizlenince (sonraki dalga kendiliğinden gelmeden önce) geri gelir
function waveCallable() {
  return G.wave < G.lv.waves.length && (G.wave === 0 || (G.waveCountdown != null && G.spawners.length === 0 && G.enemies.length === 0));
}
// Dalga çağırma işareti (popüler kule savunma oyunlarındaki gibi): yolun girişinde, yol yönünü gösteren
// küçük damla biçimli altın çerçeveli madalyon; içinde kırmızı kuru kafa; dikkat çekmek için radar dalgası
let WAVE_PIN = null;
function wavePinIcon() {
  if (WAVE_PIN) return WAVE_PIN;
  const S = 4, c = document.createElement('canvas'); c.width = c.height = 48 * S;
  const g = c.getContext('2d'); g.scale(S, S); g.translate(24, 24); g.lineJoin = 'round'; g.lineCap = 'round';
  // damla: sağa (yol yönüne) bakan uç
  const drop = (r) => { g.beginPath(); g.arc(0, 0, r, Math.PI * 0.27, Math.PI * 1.73); g.lineTo(r * 1.62, 0); g.closePath(); };
  g.save(); g.translate(0, 1.6); drop(13); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.restore();
  drop(13);
  const rim = g.createLinearGradient(0, -13, 0, 13); rim.addColorStop(0, '#fff2b0'); rim.addColorStop(0.5, '#e6b040'); rim.addColorStop(1, '#8a5410');
  g.fillStyle = rim; g.fill(); g.strokeStyle = '#2a1406'; g.lineWidth = 1.4; g.stroke();
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2);
  const body = g.createRadialGradient(-3, -4, 1, 0, 0, 11); body.addColorStop(0, '#e8443a'); body.addColorStop(1, '#5a0a08');
  g.fillStyle = body; g.fill(); g.strokeStyle = 'rgba(40,6,4,0.8)'; g.lineWidth = 0.8; g.stroke();
  // kuru kafa
  g.fillStyle = '#fbf3e4'; g.strokeStyle = '#3a0a06'; g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(-5.4, 0.6); g.bezierCurveTo(-6.2, -6.2, 6.2, -6.2, 5.4, 0.6); g.quadraticCurveTo(5.2, 2.6, 3.4, 3.1);
  g.lineTo(3.2, 5.2); g.lineTo(-3.2, 5.2); g.lineTo(-3.4, 3.1); g.quadraticCurveTo(-5.2, 2.6, -5.4, 0.6); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#3a0a06';
  g.beginPath(); g.ellipse(-2.3, -0.4, 1.55, 1.75, 0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(2.3, -0.4, 1.55, 1.75, -0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(0, 1.3); g.lineTo(-0.8, 2.6); g.lineTo(0.8, 2.6); g.closePath(); g.fill();
  g.lineWidth = 0.55; g.beginPath(); for (const x of [-1.6, 0, 1.6]) { g.moveTo(x, 3.6); g.lineTo(x, 5.2); } g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(-3.5, -6, 4.5, 2, -0.4, 0, Math.PI * 2); g.fill();
  return (WAVE_PIN = c);
}
function waveBtnScreen(pi) {
  const b = waveButtonPos(pi), q = worldToScreen(b.x, b.y);
  return { x: clamp(q.x, 26, W - 26), y: clamp(q.y, 26, H - 26), dx: b.dx, dy: b.dy };
}
function drawWaveButtons() {
  const show = waveCallable();
  if (show && G.waveShowT == null) G.waveShowT = time;
  if (!show) G.waveShowT = null;
  if (!show) return;
  const appear = easeOutBack(clamp((time - G.waveShowT) / 0.4, 0, 1)), bonus = earlyBonus();
  for (const pi of nextWavePaths()) {
    const b = waveBtnScreen(pi), ang = Math.atan2(b.dy, b.dx);
    ctx.save(); ctx.translate(b.x, b.y);
    // radar dalgası: dikkat çeker ama yer kaplamaz
    for (let j = 0; j < 2; j++) {
      const ph = (time * 0.8 + j * 0.5) % 1;
      ctx.strokeStyle = `rgba(255,${190 - ph * 80},90,${(1 - ph) * 0.7})`; ctx.lineWidth = 2 * (1 - ph) + 0.5;
      ctx.beginPath(); ctx.arc(0, 0, 14 + ph * 16, 0, Math.PI * 2); ctx.stroke();
    }
    const s = appear * pressScale('wave' + pi) * (1 + Math.sin(time * 5) * 0.04);
    ctx.scale(s, s);
    if (G.wave > 0 && G.waveCountdown != null) {
      ctx.strokeStyle = 'rgba(20,8,2,0.65)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - G.waveCountdown / G.waveCountdownMax)); ctx.stroke();
    }
    ctx.rotate(ang);
    ctx.drawImage(wavePinIcon(), -24, -24, 48, 48);
    ctx.restore();
    // erken çağrı ödülü: işaretin altında minik hap
    if (bonus > 0) {
      const bx = clamp(b.x, 30, W - 30), by = b.y + 33 > H ? b.y - 25 : b.y + 25;
      ctx.save(); ctx.globalAlpha = appear;
      ctx.font = `400 10.5px ${FONT_T}`; const tw = ctx.measureText('+' + bonus).width + 22;
      roundRect(bx - tw / 2, by - 8, tw, 16, 8, 'rgba(24,12,4,0.85)', '#e8bb4a', 1.2);
      drawIcon('coin', bx - tw / 2 + 8.5, by, 9);
      txt('+' + bonus, bx + 5, by + 0.5, 10.5, '#ffe27a', 'center', '400', FONT_T, false);
      ctx.restore();
    }
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
  statPill(176, 8, 78, 'skull', `${G.wave}/${G.lv.waves.length}`, '#fff', G.wavePop, G.wave >= G.lv.waves.length ? 'SON DALGA' : 'DALGA', waveTint());

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
  if (b.small) {
    // kahraman seviye bildirimi: üstte ince bir şerit
    ctx.save(); ctx.globalAlpha = a * 0.95; ctx.translate(W / 2, (G.enemies.some(o => o.def.chief && !o.dead) ? 120 : 78) - (1 - e) * 8);
    ctx.font = `700 10px ${FONT_B}`;
    const w = Math.max(170, ctx.measureText(b.sub).width + 28);
    roundRect(-w / 2, -15, w, 30, 10, 'rgba(24,16,8,0.82)', 'rgba(255,211,77,0.7)', 1.2);
    txt(b.title, 0, -4.5, 11.5, '#ffd34d', 'center', '400', FONT_T, false);
    txt(b.sub, 0, 8, 9.5, '#e8dcc4', 'center', '700', FONT_B, false);
    ctx.restore();
    return;
  }
  const by = G.intro ? 200 : G.enemies.some(o => o.def.chief && !o.dead) ? 140 : 112; // tanıtım kartı / boss barı açıkken altına iner
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, by); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e);
  if (b.red) { const k = 1 + Math.sin(time * 10) * 0.04; ctx.scale(k, k); }
  ctx.font = `700 13px ${FONT_B}`;
  const w = Math.max(320, ctx.measureText(b.sub).width + 48);
  roundRect(-w / 2 + 2, -24 + 5, w, 52, 14, 'rgba(0,0,0,0.3)');
  const g = ctx.createLinearGradient(0, -24, 0, 28);
  g.addColorStop(0, b.red ? 'rgba(150,24,16,0.97)' : 'rgba(62,44,26,0.96)'); g.addColorStop(1, b.red ? 'rgba(60,6,4,0.97)' : 'rgba(24,16,8,0.96)');
  if (b.red) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, w * 0.6, '255,60,30', 0.25 + Math.sin(time * 10) * 0.08); ctx.restore(); }
  roundRect(-w / 2, -24, w, 52, 14, g, b.red ? '#ff8a6a' : '#ffd34d', 2);
  txt(b.title, 0, -7, b.red ? 21 : 18, b.red ? '#fff0c0' : '#ffd34d', 'center', '400', FONT_T);
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
      return [`Yükselt → ${L.title} — ${L.cost} altın`, `${towerStats(t.type, L)} · Yeni: ${L.perk}`];
    }
    if (G.preview && G.preview.id === 'sell') return ['Sat', `${Math.floor(t.spent * SELL_RATIO)} altın geri al`];
    if (G.preview && G.preview.id === 'ability') {
      const a = G.preview.ab, r = (t.ab && t.ab[a.id]) || 0;
      if (r >= a.ranks.length) return [`${a.name} — En üst kademe`, a.desc(a.ranks[r - 1])];
      if (!t.spec) return [`${SPEC[a.id].title}: ${a.name} — ${a.ranks[r].cost} altın`, `${a.desc(a.ranks[r])} · ${SPEC[a.id].who} · Uzmanlık +%20 güç verir, diğer yol kapanır`];
      return [`${a.name} ${r + 1}/${a.ranks.length} — ${a.ranks[r].cost} altın`, a.desc(a.ranks[r])];
    }
    const L = t.def.levels[t.lvl];
    if (t.spec) return [`${SPEC[t.spec].title} — Seviye ${t.lvl + 1}`, `${L.perk} · ${SPEC[t.spec].who}`];
    if (t.lvl >= t.def.levels.length - 1) return [`${L.title} — Seviye ${t.lvl + 1} (son)`, `${L.perk} · Bir uzmanlık seç: yukarıdaki iki düğmeden biri`];
    return [`${L.title} — Seviye ${t.lvl + 1}`, `${towerStats(t.type, L)} · ${L.perk}`];
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
  if (im === spr('tower_barracks_3')) return { x, y, w: 118 * BUILD_K };
  return { x: x - 15 * BUILD_K, y: y + 10, w: 124 * BUILD_K };
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
  // 2. sefer: Çöl Şeyhi (mor cüppe, altın kuşak), Mumya Kral (altın sargılar), Taş Titan (kara bazalt, kızıl rünler)
  raider_chief: (h, s, l) => ((h < 20 || h > 340) && s > 0.35) ? [45, 0.95, Math.min(0.75, l * 1.15)] : (h > 18 && h < 60 && s < 0.45 && l > 0.42) ? [275, 0.4, l * 0.62] : null,
  mummy_king:   (h, s, l) => (h > 70 && h < 160 && s > 0.4) ? [h, s, l] : (h > 20 && h < 65 && l > 0.28) ? [44, Math.min(1, s * 1.6 + 0.25), l * 0.95] : null,
  golem_titan:  (h, s, l) => (h > 25 && h < 60 && s > 0.6 && l > 0.5) ? [8, 1, l] : (h > 12 && h < 55 && s > 0.12) ? [h, s * 0.25, l * 0.5] : null,
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

// Zırh parçalanır: çelik parçaları saçılır, ekran sarsılır, boss 2. evreye geçer ve lejyonunu çağırır
function plateBreak(e) {
  e.plate = 0; e.phase2 = true;
  const P2 = e.def.phase2 || {};
  e.spdMul = P2.speed || 1; e.cdMul = (e.cdMul || 1) * (P2.cd || 1);
  const h = CHAR_H['enemy_' + e.type] || 50;
  for (let i = 0; i < 26; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-h * 0.3, h * 0.3), y: e.y - rand(h * 0.2, h * 0.8), vx: rand(-150, 150), vy: -rand(80, 220), g: 460,
    col: Math.random() < 0.5 ? '#9aa6b8' : '#5a6474', s0: rand(3, 6), s1: 2.5, life: 1.1, vr: rand(-14, 14), floor: e.y + rand(-6, 10) });
  for (let i = 0; i < 18; i++) { const a = rand(0, Math.PI * 2), v = rand(60, 160); emit(G.parts, { kind: 'streak', add: true, x: e.x, y: e.y - h * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: '#cfe0ff', s0: 1.6, s1: 0.4, life: 0.35 }); }
  G.effects.push({ kind: 'shock', x: e.x, y: e.y, r: 110, t: 0, dur: 0.5 });
  G.effects.push({ kind: 'firering', x: e.x, y: e.y, r: 70, t: 0, dur: 0.6 });
  bossCastFx(e, 'ZIRH PARÇALANDI!', '190,215,255');
  G.banner = { title: `${e.def.name} öfkelendi!`, sub: 'Zırhı kırıldı: artık daha hızlı ve lejyonunu çağırıyor', t: 0, dur: 3 };
  shakeScreen(7, 0.6); sfx('boom'); sfx('castlehit');
  e.rageT = Math.max(e.rageT || 0, 2.5);
  summonLegion(e);
}
// Lejyon: bütün yolların girişinde ve boss'un arkasında geçitler açılır, karışık minyonlar çıkar
function summonLegion(e) {
  const L = e.def.legion;
  if (!L) return;
  let k = 0;
  for (const [t2, n] of L) for (let i = 0; i < n; i++, k++) {
    const behind = k % 2 === 0, pi = behind ? G.paths.indexOf(e.p) : k % G.paths.length;
    const p = G.paths[pi], d0 = behind ? Math.max(0, e.d - 30 - i * 12) : 10 + i * 14;
    const m = spawnEnemy(t2, pi, d0);
    const q = pathPos(p, d0);
    if (i === 0) G.effects.push({ kind: 'portal', x: q.x, y: q.y, t: 0, dur: 1.4, col: '200,60,60' });
    for (let j = 0; j < 5; j++) emit(G.parts, { kind: 'glow', add: true, x: m.x + rand(-8, 8), y: m.y - rand(0, 20), vy: -rand(20, 50), col: '255,110,90', s0: 4, s1: 0.5, life: 0.6 });
  }
  floatText(e.x, e.y - (CHAR_H['enemy_' + e.type] || 50) - 34, 'LEJYON!', '#ff6a50');
}

// boss yetenekleri
// Boss yeteneği kullanırken: adı belirir, boss parlar ve etrafına kıvılcım saçılır
function bossCastFx(e, name, col) {
  floatText(e.x, e.y - (e.def.h || 40) - 18, name, `rgb(${col})`);
  emit(G.parts, { kind: 'glow', add: true, x: e.x, y: e.y - (e.def.h || 40) * 0.5, col, s0: (e.def.h || 40) * 1.4, s1: (e.def.h || 40) * 0.6, life: 0.35 });
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), v = rand(40, 110);
    emit(G.parts, { kind: 'glow', add: true, x: e.x, y: e.y - (e.def.h || 40) * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, drag: 2.5, col, s0: rand(3, 5), s1: 0.5, life: rand(0.4, 0.7) });
  }
}
// yakındaki (susturulmamış) kulelerden rastgele biri
function bossTowerTarget(e, r) {
  const list = G.towers.filter(t => !(t.disabledT > 0) && dist(t.x, t.y, e.x, e.y) <= r);
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
function bossAbilities(e, dt) {
  const ab = e.def.ab;
  if (!ab) return;
  e.abT = e.abT || {};
  const ready = (k, cd) => { cd *= e.cdMul || 1; e.abT[k] = (e.abT[k] ?? cd * 0.6) - dt; if (e.abT[k] > 0) return false; e.abT[k] = cd; return true; };
  if (e.rageT > 0) {
    e.rageT -= dt;
    if (Math.random() < dt * 30) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-14, 14), y: e.y - rand(0, e.def.h || 40), vy: -rand(30, 70), col: Math.random() < 0.5 ? '255,70,40' : '255,150,60', s0: rand(3, 6), s1: 0.5, life: rand(0.4, 0.7) });
  }
  if (ab.regen && e.hp < e.maxHp && time - (e.hitAt || -9) > 4) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ab.regen * dt);
  // sefer sonu bossu: canı yarıya inince ikinci lejyon
  if (e.def.legion && e.phase2 && !e.legion2 && e.hp < e.maxHp * 0.5) { e.legion2 = true; bossCastFx(e, 'Son Çağrı!', '255,90,70'); summonLegion(e); shakeScreen(5, 0.4); }
  // Muhafız çağırma: boss'un arkasında açılan geçitten minyonlar çıkar ve onunla yürür
  if (ab.summon && e.siege === undefined && ready('summon', ab.summon.cd)) {
    const pi = G.paths.indexOf(e.p), d0 = Math.max(0, e.d - 24), q = pathPos(e.p, d0);
    G.effects.push({ kind: 'portal', x: q.x, y: q.y, t: 0, dur: 1.2, col: e.def.base === 'knight' || e.type === 'dark_shaman' ? '170,90,255' : '120,230,90' });
    for (let i = 0; i < ab.summon.n; i++) {
      const st = Array.isArray(ab.summon.t) ? ab.summon.t[i % ab.summon.t.length] : ab.summon.t;
      const m = spawnEnemy(st, pi, Math.max(0, d0 - i * 10), i % 2 ? 10 : -10);
      m.leader = e; m.form = -22 - i * 12;
      for (let k = 0; k < 6; k++) emit(G.parts, { kind: 'glow', add: true, x: m.x + rand(-8, 8), y: m.y - rand(0, 20), vy: -rand(20, 50), col: '200,160,255', s0: 4, s1: 0.5, life: 0.6 });
    }
    bossCastFx(e, 'Çağrı!', '200,140,255'); sfx('spell');
  }
  if (ab.howl && ready('howl', ab.howl.cd)) {
    for (const o of G.enemies) if (!o.dead && dist(o.x, o.y, e.x, e.y) < ab.howl.r) o.hasteT = 4;
    for (let i = 0; i < 3; i++) G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: ab.howl.r * (0.5 + i * 0.25), col: '255,90,70', t: -i * 0.12, dur: 0.6 });
    bossCastFx(e, 'Uluma!', '255,110,80'); sfx('cry');
  }
  if (ab.slam && ready('slam', ab.slam.cd)) {
    const hitAny = G.soldiers.some(s => !s.dead && dist(s.x, s.y, e.x, e.y) < ab.slam.r);
    if (!hitAny) e.abT.slam = 1;
    else {
      for (const s of G.soldiers) if (!s.dead && dist(s.x, s.y, e.x, e.y) < ab.slam.r) { damageSoldier(s, ab.slam.dmg * (e.dmgMul || 1)); s.stunT = ab.slam.stun; }
      G.effects.push({ kind: 'shock', x: e.x, y: e.y, r: ab.slam.r * 1.3, t: 0, dur: 0.45 });
      G.effects.push({ kind: 'firering', x: e.x, y: e.y, r: ab.slam.r, t: 0, dur: 0.4 });
      G.decals.push({ x: e.x, y: e.y, r: ab.slam.r * 0.6, t: 0, life: 6 });
      for (let i = 0; i < 18; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-20, 20), y: e.y, vx: rand(-110, 110), vy: -rand(70, 170), g: 420, col: '#6a5040', s0: 3, s1: 2, life: 0.8, vr: rand(-10, 10), floor: e.y + rand(-6, 8) });
      bossCastFx(e, 'Yer Sarsıntısı!', '255,190,110');
      shakeScreen(5, 0.35); sfx('boom');
    }
  }
  if (ab.storm && ready('storm', ab.storm.cd)) {
    G.stormT = ab.storm.t;
    bossCastFx(e, 'Kum Fırtınası!', '255,190,110'); sfx('whirl'); shakeScreen(3, 0.4);
  }
  if (ab.shield && ready('shield', ab.shield.cd)) { e.shieldT = ab.shield.t; bossCastFx(e, 'Kalkan!', '120,200,255'); sfx('magic'); }
  if (ab.heal && ready('heal', ab.heal.cd)) {
    let any = false;
    for (const o of G.enemies) if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < ab.heal.r && o.hp < o.maxHp) {
      any = true; o.hp = Math.min(o.maxHp, o.hp + ab.heal.amt); G.effects.push({ kind: 'heal', x: o.x, y: o.y, t: 0, dur: 0.6 });
      G.effects.push({ kind: 'zap', x0: e.x, y0: e.y - 30, target: o, x1: o.x, y1: aimY(o), t: 0, dur: 0.35, w: 0.5, col: 'rgb(90,220,110)', seed: rand(0, 99) });
    }
    if (any) bossCastFx(e, 'Şifa!', '120,255,140');
  }
  if (ab.blink && !e.blocker && e.siege === undefined && ready('blink', ab.blink.cd)) {
    for (let i = 0; i < 16; i++) emit(G.parts, { kind: 'glow', x: e.x + rand(-8, 8), y: e.y - rand(0, 40), vy: -rand(10, 30), col: '40,200,140', s0: 6, s1: 12, life: 0.6, a: 0.7 });
    G.effects.push({ kind: 'portal', x: e.x, y: e.y, t: 0, dur: 0.8, col: '60,230,160' });
    e.d = Math.min(e.p.total - 30, e.d + ab.blink.d);
    const q = pathPos(e.p, e.d, e.off); e.x = q.x; e.y = q.y;
    G.effects.push({ kind: 'portal', x: e.x, y: e.y, t: 0, dur: 0.8, col: '60,230,160' });
    for (let i = 0; i < 16; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-8, 8), y: e.y - rand(0, 40), vy: -rand(10, 30), col: '120,255,200', s0: 5, s1: 0.5, life: 0.5 });
    bossCastFx(e, 'Işınlanma!', '90,240,190'); sfx('zap');
  }
  // İleri atılış: toz bulutu ve hız izleriyle yolda sıçrar
  if (ab.pounce && !e.blocker && e.siege === undefined && ready('pounce', ab.pounce.cd)) {
    const x0 = e.x, y0 = e.y;
    e.d = Math.min(e.p.total - 30, e.d + ab.pounce.d);
    const q = pathPos(e.p, e.d, e.off); e.x = q.x; e.y = q.y;
    for (let i = 0; i < 10; i++) { const k = i / 9; emit(G.parts, { kind: 'glow', x: lerp(x0, e.x, k) + rand(-4, 4), y: lerp(y0, e.y, k) - Math.sin(k * Math.PI) * 26, col: '200,180,150', s0: 6, s1: 12, life: 0.5, a: 0.5 }); }
    G.effects.push({ kind: 'dust', x: x0, y: y0, t: 0, dur: 0.5 }); G.effects.push({ kind: 'dust', x: e.x, y: e.y, t: 0, dur: 0.5 });
    bossCastFx(e, 'Atılış!', '255,200,120'); sfx('whirl');
  }
  // Öfke: kısa süre yarı hasar alır, kırmızı alev halesi
  if (ab.rage && ready('rage', ab.rage.cd)) {
    e.rageT = ab.rage.t;
    G.effects.push({ kind: 'firering', x: e.x, y: e.y, r: 50, t: 0, dur: 0.5 });
    bossCastFx(e, 'Öfke!', '255,80,50'); sfx('cry');
  }
  // Bomba / kaya: menzildeki bir kuleye fırlatır, kule birkaç saniye susar
  for (const kind of ['bomb', 'boulder']) {
    const A = ab[kind];
    if (!A) continue;
    e.abT[kind] = (e.abT[kind] ?? A.cd * 0.6) - dt;
    if (e.abT[kind] > 0) continue;
    const t = bossTowerTarget(e, A.r);
    if (!t) { e.abT[kind] = 1; continue; }
    e.abT[kind] = A.cd * (e.cdMul || 1);
    G.projectiles.push({ kind: 'bossthrow', sub: kind, sx: e.x, sy: e.y - (e.def.h || 40) * 0.7, tx: t.x, ty: t.y - 30, tower: t, stun: A.stun, t: 0, dur: 0.9, arc: 90, spin: rand(0, 6) });
    bossCastFx(e, kind === 'bomb' ? 'Bomba!' : 'Kaya!', '255,200,120'); sfx('whirl');
  }
  // Lanet: gökten kara yıldırım bir kuleyi susturur
  if (ab.hex) {
    e.abT.hex = (e.abT.hex ?? ab.hex.cd * 0.6) - dt;
    if (e.abT.hex <= 0) {
      const t = bossTowerTarget(e, ab.hex.r);
      if (!t) e.abT.hex = 1;
      else {
        e.abT.hex = ab.hex.cd * (e.cdMul || 1);
        const ts = towerSprite(t), ty = ts ? ts.bottom - ts.h * 0.8 : t.y - 40;
        G.effects.push({ kind: 'zap', x0: t.x + rand(-30, 30), y0: ty - 230, x1: t.x, y1: ty, t: 0, dur: 0.45, w: 1.6, col: 'rgb(170,70,255)', seed: rand(0, 99) });
        G.effects.push({ kind: 'zap', x0: e.x, y0: e.y - (e.def.h || 40), x1: e.x, y1: e.y - (e.def.h || 40) - 60, t: 0, dur: 0.3, w: 0.8, col: 'rgb(170,70,255)', seed: rand(0, 99) });
        G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 40, col: '190,110,255', t: 0, dur: 0.5 });
        t.disabledT = Math.max(t.disabledT || 0, ab.hex.t); t.disabledKind = 'hex';
        bossCastFx(e, 'Lanet!', '190,110,255'); sfx('zap');
      }
    }
  }
  // Can emme: yakındaki askerlerden yeşil ışınlarla can çeker
  if (ab.drain && ready('drain', ab.drain.cd)) {
    const vs = G.soldiers.filter(s2 => !s2.dead && dist(s2.x, s2.y, e.x, e.y) < ab.drain.r);
    if (!vs.length) e.abT.drain = 1;
    else {
      for (const s2 of vs) {
        damageSoldier(s2, ab.drain.dmg * (e.dmgMul || 1)); e.hp = Math.min(e.maxHp, e.hp + ab.drain.dmg * 1.5);
        G.effects.push({ kind: 'zap', x0: s2.x, y0: s2.y - 14, x1: e.x, y1: e.y - (e.def.h || 40) * 0.5, t: 0, dur: 0.5, w: 0.7, col: 'rgb(80,230,110)', seed: rand(0, 99) });
      }
      bossCastFx(e, 'Can Emme!', '110,255,140'); sfx('magic');
    }
  }
}

// ekranın üstünde boss can barı
// Ekranın üstünde boss barı: altın çerçeve, solda kuru kafa madalyonu, ad şeridi; zırhlı bosslarda iki bar
// (üstte çelik zırh, altta can). Hasar yiyince bar önce beyaz iz bırakır, iz yavaşça erir.
function drawBossBar() {
  const b = G.enemies.find(e => e.def.chief && !e.dead);
  if (!b) return;
  const armored = b.maxPlate > 0, w = armored ? 330 : 300, x = W / 2 - w / 2 + 12, y = 60;
  const fr = clamp(b.hp / b.maxHp, 0, 1), pf = armored ? clamp(b.plate / b.maxPlate, 0, 1) : 0;
  b.shownHp = b.shownHp == null ? fr : Math.max(fr, b.shownHp - 0.25 * (1 / 60));
  b.shownPl = b.shownPl == null ? pf : Math.max(pf, b.shownPl - 0.25 * (1 / 60));
  const hpY = armored ? y + 12 : y, hpH = armored ? 13 : 16, H0 = armored ? 31 : 22;
  // çerçeve
  roundRect(x - 10, y - 6 + 3, w + 18, H0 + 8, 10, 'rgba(0,0,0,0.4)');
  const fg = ctx.createLinearGradient(0, y - 6, 0, y + H0);
  fg.addColorStop(0, '#3a2412'); fg.addColorStop(1, '#140a04');
  roundRect(x - 10, y - 6, w + 18, H0 + 8, 10, fg, '#d8ac52', 2);
  ctx.strokeStyle = 'rgba(255,230,160,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - 7, y - 3, w + 12, H0 + 2, 8); ctx.stroke();
  const bar = (by, bh, frac, shown, cols, segs) => {
    roundRect(x, by, w, bh, bh / 2, '#1a0a06');
    if (shown > frac) roundRect(x, by, Math.max(bh, w * shown), bh, bh / 2, 'rgba(255,245,215,0.85)');
    if (frac > 0) {
      const g = ctx.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
      roundRect(x, by, Math.max(bh, w * frac), bh, bh / 2, g);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x + bh / 2, by + 1.5, Math.max(0, w * frac - bh), bh * 0.28);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    for (let i = 1; i < segs; i++) { const sx = x + w * i / segs; ctx.beginPath(); ctx.moveTo(sx, by + 2); ctx.lineTo(sx, by + bh - 2); ctx.stroke(); }
  };
  if (armored) {
    const sheen = b.plate > 0 ? 0.15 * Math.sin(time * 3) : 0;
    bar(y, 9, pf, b.shownPl, [`rgb(${clamp(238 + sheen * 100, 0, 255)},${clamp(244 + sheen * 60, 0, 255)},255)`, '#aebcd4', '#5c6a82'], 10);
    for (let i = 0; i <= 10; i += 2) circle(x + w * i / 10 - (i === 10 ? 4 : i === 0 ? -4 : 0), y + 4.5, 1.2, pf * 10 >= i ? '#eef3ff' : '#4a5260');
  }
  bar(hpY, hpH, fr, b.shownHp, b.shieldT > 0 ? ['#a8e0ff', '#3c9cf0', '#1a4c90'] : b.phase2 ? ['#ff9a6a', '#e83a22', '#7a0e08'] : ['#ff7a6a', '#d02a22', '#6a0a08'], 4);
  // kuru kafa madalyonu ve taç
  const mx = x - 22, my = y + H0 / 2 - 1;
  circle(mx, my + 2, 18, 'rgba(0,0,0,0.45)');
  const mg = ctx.createRadialGradient(mx - 5, my - 6, 2, mx, my, 18); mg.addColorStop(0, b.phase2 ? '#d8402a' : '#7a2a1a'); mg.addColorStop(1, '#1a0604');
  circle(mx, my, 17, mg, '#e8bb52', 2.4);
  drawIcon('skull', mx, my + 1, 19, '#f4ead8');
  drawCrown(mx, my - 19, 0.85, 1);
  if (b.phase2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, mx, my, 30, '255,80,40', 0.35 + Math.sin(time * 8) * 0.12); ctx.restore(); }
  // ad şeridi ve bar yazıları
  ctx.font = `400 14px ${FONT_T}`;
  const nw = ctx.measureText(b.def.name).width + 26, nx = x + w / 2 - 4;
  roundRect(nx - nw / 2, y - 18, nw, 18, 9, '#7a1a12', '#e8bb52', 1.4);
  txt(b.def.name, nx, y - 9, 14, '#ffe9b0', 'center', '400', FONT_T, false);
  if (armored) txt(b.plate > 0 ? 'ZIRH' : 'ZIRH KIRILDI', x + 6, y + 4.8, 8, b.plate > 0 ? '#1e2a3a' : '#cfd6e2', 'left', '400', FONT_T, false);
  txt(Math.ceil(b.hp) + '', x + w - 6, hpY + hpH / 2 + 0.5, 9, '#fff', 'right', '400', FONT_T, false);
}

// yeni düşman / boss tanıtım kartı
function drawIntro() {
  const it = G.intro;
  if (!it) return;
  if (it.t > it.dur) { G.intro = null; return; }
  const d = ENEMIES[it.type], a = clamp(Math.min(it.t / 0.3, (it.dur - it.t) / 0.4), 0, 1), e = easeOutBack(clamp(it.t / 0.4, 0, 1));
  const wk = d.wk || {}, weak = Object.keys(wk).filter(k => wk[k] > 1), res = Object.keys(wk).filter(k => wk[k] < 1);
  const w = it.boss ? 340 : 300, h = weak.length || res.length ? 88 : 70, x0 = W / 2 - w / 2, y0 = it.boss ? 92 : 64;
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
  let tx = x0 + 72;
  const tag = (label, list, col, bg) => {
    if (!list.length) return;
    const s = label + ' ' + list.map(k => WK_NAME[k]).join(', ');
    ctx.font = `800 10.5px ${FONT_B}`; const tw = ctx.measureText(s).width + 14;
    roundRect(tx, y0 + 64, tw, 16, 8, bg, col, 1);
    txt(s, tx + tw / 2, y0 + 72.5, 10.5, col, 'center', '800', FONT_B, false);
    tx += tw + 6;
  };
  tag('Zayıf:', weak, '#ffd08a', 'rgba(150,60,10,0.6)');
  tag('Dirençli:', res, '#a8d8ff', 'rgba(20,60,120,0.6)');
  ctx.restore();
}

// Düşmanların çıkacağı yolun başında uyarı: yalnızca o yoldan gerçekten düşman gelecekse (birkaç sn önceden ve gelirken)
function drawIncoming() {
  const warn = new Set();
  // her grubun ilk düşmanı çıkmadan önceki 2.5 sn içinde görünür, sonra söner (kalıcı değil)
  const warnA = {};
  for (const sp of G.spawners) {
    if (sp.left > 0 && sp.left === sp.n && sp.timer < 2.5) warnA[sp.p] = Math.max(warnA[sp.p] || 0, clamp((2.5 - sp.timer) / 0.3, 0, 1));
  }
  for (const pi in warnA) {
    const p = G.paths[pi];
    let d = 0, q = pathPos(p, 0);
    while (d < p.total && (q.x < 22 || q.x > W - 22 || q.y < 22 || q.y > H - 22)) { d += 4; q = pathPos(p, d); }
    // yolun üstünde değil, yanında dursun (düşmanları kapatmasın)
    const q2 = pathPos(p, d + 6), tx = q2.x - q.x, ty = q2.y - q.y, l = Math.hypot(tx, ty) || 1;
    let nx = -ty / l, ny = tx / l;
    if (q.y + ny * 24 < 30 || q.y + ny * 24 > H - 30 || q.x + nx * 24 < 14 || q.x + nx * 24 > W - 14) { nx = -nx; ny = -ny; }
    const x = q.x + nx * 24 + tx / l * 14, y = q.y + ny * 24 + ty / l * 14;
    const a = warnA[pi], pulse = 1 + Math.sin(time * 9) * 0.08;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(pulse * 0.62, pulse * 0.62);
    glow(ctx, 0, 0, 22, '255,60,40', 0.35);
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
function diff() { return GAME_DIFF; } // zorluk sabit
// gelişmelerle güçlenmiş kule seviyesi değerleri
// uzmanlık seçen kule +%20 hasar (kışlada asker canı ve hasarı) alır: tek yol seçmenin karşılığı
const SPEC_BONUS = 1.2;
function effLevel(t) {
  let L = t.def.levels[t.lvl];
  const sn = t.type === 'archer' && abRank(t, 'snipe'); // keskin nişancı menzili de artırır
  if (sn) L = Object.assign({}, L, { range: L.range + sn.range });
  if (t.spec && t.type !== 'barracks') L = Object.assign({}, L, { dmg: [L.dmg[0] * SPEC_BONUS, L.dmg[1] * SPEC_BONUS] });
  // kum fırtınası (hava ya da Fırtına Cini'nin yeteneği) kule menzilini düşürür
  const wr = (G && G.weather === 'sand' ? WEATHER.sand.range : 1) * (G && G.stormT > 0 ? 0.8 : 1);
  if (wr < 1) L = Object.assign({}, L, { range: L.range * wr });
  const r = upgRank(t.type);
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
    const im = towerIcon(id, 2);
    if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.clip(); drawSprite(ctx, im, x, y + 19, 36 * im.width / im.height); ctx.restore(); }
  } else if (id === 'spells') drawAbilityIcon('meteor', x, y, 0.9);
  else drawIcon('heart', x, y, 20);
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
const DIFF = ['Kolay', 'Kolay', 'Orta', 'Orta', 'Orta', 'Zor', 'Zor', 'Zor', 'Çok zor', 'Efsane',
  'Orta', 'Orta', 'Zor', 'Zor', 'Zor', 'Çok zor', 'Çok zor', 'Çok zor', 'Efsane', 'Efsane'];
// ----- seferler -----
const epLevels = (ep) => LEVELS.map((lv, i) => i).filter(i => LEVELS[i].ep === ep);
const epOf = (i) => LEVELS[i].ep || 1;
// sefer, önceki seferin son bölümü bitince açılır
function epUnlocked(ep) {
  if (ep <= 1) return true;
  const prev = epLevels(ep - 1);
  return (save.stars[prev[prev.length - 1]] || 0) > 0;
}
// bölüm: seferin ilk bölümü sefer açıksa, diğerleri önceki bölüm bitince açılır
function levelUnlocked(i) {
  const first = epLevels(epOf(i))[0];
  return i === first ? epUnlocked(epOf(i)) : (save.stars[i - 1] || 0) > 0;
}
let mapEp = null;
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
  if (mapEp == null) {
    const first = LEVELS.findIndex((lv, i) => levelUnlocked(i) && !(save.stars[i] > 0));
    mapEp = first < 0 ? EPISODES.length : epOf(first);
  }
  const E = EPISODES[mapEp - 1], ids0 = epLevels(mapEp);
  const st = time - screenT, bgName = spr(E.bg) ? E.bg : 'title_bg', bg = spr(bgName);
  if (bg) coverImage(blurOf(bgName, bg), 1.1 + Math.sin(time * 0.1) * 0.02);
  else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, W, H); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(24,12,4,0.45)'); g.addColorStop(1, 'rgba(14,8,2,0.78)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 60); ctx.scale(rk, rk); ribbon(0, 0, 360, `${mapEp}. SEFER: ${E.name.toLocaleUpperCase('tr')}`, mapEp === 1 ? 'red' : 'gold', 22); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'title'; }), { appear: st - 0.1 });
  const total = save.stars.reduce((a, b) => a + (b || 0), 0);
  ctx.save(); ctx.globalAlpha = clamp((st - 0.15) / 0.25, 0, 1);
  roundRect(W - 154, 26, 132, 38, 19, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
  fancyStar(W - 133, 45, 13, true);
  txt(`${total} / ${LEVELS.length * 3}`, W - 76, 46, 20, '#ffe27a', 'center', '400', FONT_T);
  ctx.restore();
  const pages = Math.ceil(ids0.length / 3);
  if (mapPage == null) { const k = ids0.findIndex(i => levelUnlocked(i) && !(save.stars[i] > 0)); mapPage = Math.floor((k < 0 ? ids0.length - 1 : k) / 3); mapPageT = screenT; }
  mapPage = clamp(mapPage, 0, pages - 1);
  const pst = time - Math.max(screenT, mapPageT);
  const ids = ids0.slice(mapPage * 3, mapPage * 3 + 3);
  ids.forEach((i, j) => drawLevelCard(i, W / 2 + (j - (ids.length - 1) / 2) * 286, 290, pst - 0.08 - j * 0.08));
  const flip = (d) => { mapPage = clamp(mapPage + d, 0, pages - 1); mapPageT = time; sfx('pick'); };
  if (mapPage > 0) roundBtn('pg_prev', 34, 290, 22, 'back', () => flip(-1), { appear: st - 0.2 });
  if (mapPage < pages - 1) roundBtn('pg_next', W - 34, 290, 22, () => { ctx.scale(-1, 1); drawIcon('back', 0, 0, 22); }, () => flip(1), { appear: st - 0.2 });
  for (let p = 0; p < pages; p++) {
    const dx = W / 2 + (p - (pages - 1) / 2) * 20;
    circle(dx, 474, p === mapPage ? 5.5 : 4, p === mapPage ? '#ffd34d' : 'rgba(255,240,200,0.35)', 'rgba(20,10,4,0.8)', 1.2);
  }
  // sefer seçimi (sol alt): kilitli sefer kilit simgesiyle görünür
  EPISODES.forEach((ep, k) => {
    const n = k + 1, x = 70 + k * 116, y = H - 32, open = epUnlocked(n), on = n === mapEp, key = 'ep' + n;
    gameButton(key, x, y, 108, 38, n + '. SEFER', null, on ? 'gold' : open ? 'wood' : 'dark', { appear: st - 0.3, size: 14, icon: open ? null : 'lock' });
    buttons.push({ key, x: x - 54, y: y - 19, w: 108, h: 38, fn: () => {
      if (!open) { sfx('error'); return; }
      if (mapEp !== n) { mapEp = n; mapPage = null; mapPageT = time; sfx('pick'); }
    } });
  });
  // kahramanlar düğmesi (yeni açılan kahraman varsa rozet)
  const fresh = HERO_ORDER.filter(id => heroUnlocked(id) && !(save.seenHeroes || ['commander']).includes(id));
  gameButton('heroes', W / 2, H - 32, 220, 42, 'KAHRAMANLAR', () => go(() => { screen = 'heroes'; }), 'blue', { icon: 'crown', appear: st - 0.35, size: 18, shine: fresh.length > 0 });
  const freeStars = starsTotal() - starsSpent();
  gameButton('upgrades', W - 126, H - 32, 210, 42, 'GELİŞMELER', () => go(() => { screen = 'upgrades'; }), 'gold', { icon: 'crown', appear: st - 0.4, size: 18, shine: freeStars > 0 });
  if (freeStars > 0) { const bx = W - 30, by = H - 52 + Math.sin(time * 5) * 2; circle(bx, by, 11, '#e8434b', '#fff', 1.5); txt(freeStars + '', bx, by + 1, 12, '#fff', 'center', '400', FONT_T); }
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
  const unlocked = levelUnlocked(i), st = save.stars[i] || 0, num = epLevels(epOf(i)).indexOf(i) + 1;
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
  txt(num + '', x0 + 26, y0 + 27, 21, '#fff', 'center', '400', FONT_T);
  txt(lv.name, 0, y0 + 180, 24, '#4a2a0e', 'center', '400', FONT_T, false);
  txt(`${lv.waves.length} dalga  ·  ${DIFF[i] || 'Zor'}`, 0, y0 + 204, 14, '#8a6238', 'center', '800', FONT_B, false);
  for (let s = 0; s < 3; s++) fancyStar((s - 1) * 40, y0 + 238 - (s === 1 ? 4 : 0), s === 1 ? 17 : 15, s < st);
  if (!unlocked) {
    roundRect(x0, y0, w, h, 22, 'rgba(18,10,4,0.62)');
    drawIcon('lock', 0, y0 + 86, 46);
    txt('Kilitli', 0, y0 + 274, 24, '#f0e2c4', 'center', '400', FONT_T);
    txt(num === 1 ? 'Önceki seferi tamamla' : 'Önceki bölümü tamamla', 0, y0 + 298, 13, '#cdb894', 'center', '700', FONT_B, false);
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

// ---------- hava durumu (yağmur, kar) ----------
// Yağmur damlaları ve kar taneleri ekran koordinatında (zoomdan bağımsız) çizilir;
// yağmur sıçramaları ve ayak tozu dünyada, birimlerin altında.
const WFX = { drops: [], flakes: [], dust: [], bolt: null, flashT: 9, next: 0, thunderT: null, near: false };

function initWeather() {
  WFX.drops = []; WFX.flakes = []; WFX.bolt = null; WFX.flashT = 9; WFX.thunderT = null;
  // kum zerreleri: kum fırtınası havasında ya da cin fırtına çağırınca görünür (rüzgâr soldan sağa)
  WFX.dust = [];
  for (let i = 0; i < 200; i++) WFX.dust.push({ x: rand(-40, W), y: rand(0, H), len: rand(10, 34), v: rand(280, 560), a: rand(0.3, 0.75), w: rand(1, 2.4) });
  WFX.clouds = [];
  for (let i = 0; i < 12; i++) WFX.clouds.push({ x: rand(-200, W), y: rand(-40, H + 40), r: rand(90, 190), v: rand(40, 90), a: rand(0.18, 0.32) });
  if (G.weather === 'rain') {
    for (let i = 0; i < 260; i++) {
      const far = i % 3 === 0;
      WFX.drops.push({ x: rand(-60, W + 60), y: rand(-20, H), len: far ? rand(7, 11) : rand(12, 19), v: far ? rand(420, 520) : rand(620, 760), far });
    }
    const L = WEATHER.rain.lightning;
    WFX.next = rand(2, L[0]);
  } else if (G.weather === 'snow') {
    for (let i = 0; i < 190; i++) {
      const layer = i % 3; // 0 uzak (küçük, yavaş) .. 2 yakın (büyük, hızlı)
      WFX.flakes.push({ x: rand(0, W), y: rand(0, H), r: [0.9, 1.5, 2.4][layer] * rand(0.8, 1.2), v: [14, 24, 38][layer] * rand(0.8, 1.2),
        sway: rand(4, 14), f: rand(0.6, 1.6), ph: rand(0, 7), layer });
    }
  }
}

// oyun zamanıyla ilerleyenler (duraklatınca durur): sıçramalar, şimşek zamanlaması
function updateWeather(dt) {
  if (G.weather !== 'rain') return;
  const n = Math.floor(70 * dt + Math.random());
  for (let i = 0; i < n; i++) {
    const w = screenToWorld(rand(0, W), rand(0, H));
    G.ground.push({ kind: 'splash', x: w.x, y: w.y, t: 0, dur: 0.28 });
  }
  WFX.next -= dt;
  if (WFX.next <= 0) {
    const L = WEATHER.rain.lightning;
    WFX.next = rand(L[0], L[1]);
    strikeLightning();
  }
}

// Şimşek: gökten yere zikzak çizgi + dallar, ekran iki kez parlar; gök gürültüsü ışıktan sonra gelir
function strikeLightning() {
  const tx = rand(80, W - 80), ty = rand(H * 0.3, H * 0.85);
  const zig = (x0, y0, x1, y1, n, amp) => {
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) {
      const k = i / n;
      pts.push([lerp(x0, x1, k) + rand(-amp, amp), lerp(y0, y1, k) + rand(-amp, amp) * 0.3]);
    }
    pts.push([x1, y1]);
    return pts;
  };
  const main = zig(tx + rand(-140, 140), -10, tx, ty, 14, 22);
  const branches = [];
  for (let b = 0; b < 3; b++) {
    const i = randi(3, main.length - 4), [bx, by] = main[i];
    branches.push(zig(bx, by, bx + rand(-90, 90), by + rand(40, 110), 6, 12));
  }
  WFX.bolt = { main, branches, t: 0 };
  WFX.flashT = 0;
  WFX.near = Math.random() < 0.5;
  WFX.thunderT = WFX.near ? rand(0.12, 0.35) : rand(0.6, 1.5);
}

// gerçek zamanla ilerleyenler: damla/tane hareketi, şimşek ışığı, gök gürültüsü
function weatherVisuals(dt) {
  if (!G) return;
  for (const d of WFX.drops) {
    d.y += d.v * dt; d.x -= d.v * 0.22 * dt;
    if (d.y > H + 20) { d.y -= H + 40; d.x = rand(-20, W + 120); }
  }
  for (const d of WFX.dust) {
    d.x += d.v * dt; d.y += Math.sin(time * 2 + d.v) * 12 * dt;
    if (d.x > W + 30) { d.x = rand(-60, -10); d.y = rand(0, H); }
  }
  for (const c of WFX.clouds || []) {
    c.x += c.v * dt;
    if (c.x - c.r > W) { c.x = -c.r - rand(0, 100); c.y = rand(-40, H + 40); }
  }
  for (const f of WFX.flakes) {
    f.y += f.v * dt; f.ph += f.f * dt;
    if (f.y > H + 6) { f.y = -6; f.x = rand(0, W); }
  }
  WFX.flashT += dt;
  if (WFX.bolt) { WFX.bolt.t += dt; if (WFX.bolt.t > 0.4) WFX.bolt = null; }
  if (WFX.thunderT !== null) {
    WFX.thunderT -= dt;
    if (WFX.thunderT <= 0) { WFX.thunderT = null; thunder(WFX.near); }
  }
}

// iki çakışlı parlama: parla → sön → tekrar parla → sön
function flashLevel(t) {
  if (t < 0.05) return 1;
  if (t < 0.11) return 0.25;
  if (t < 0.16) return 0.85;
  return Math.max(0, 0.85 * (1 - (t - 0.16) / 0.45));
}

// Kum fırtınası: turuncu pus ve yatay savrulan kum çizgileri (fırtına yeteneğinde daha yoğun)
function drawSandstorm(k) {
  ctx.fillStyle = `rgba(200,140,80,${0.24 * k})`; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, `rgba(235,175,110,${0.3 * k})`); g.addColorStop(1, 'rgba(235,175,110,0.04)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const c of WFX.clouds || []) glow(ctx, c.x, c.y, c.r, '236,186,124', c.a * k);
  ctx.lineCap = 'round';
  for (const d of WFX.dust) {
    ctx.strokeStyle = `rgba(250,210,150,${d.a * k})`; ctx.lineWidth = d.w;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len, d.y - d.len * 0.08); ctx.stroke();
  }
}
// Gece: ekran karanlık; kuleler, kale, kahramanlar ve askerler çevrelerini aydınlatır (meşale titremesi)
let NIGHT = null;
function drawNight() {
  if (!NIGHT) { NIGHT = document.createElement('canvas'); NIGHT.width = 480; NIGHT.height = 270; }
  const n = NIGHT.getContext('2d'), k = 480 / W;
  n.globalCompositeOperation = 'source-over'; n.clearRect(0, 0, 480, 270);
  n.fillStyle = 'rgba(6,10,30,0.66)'; n.fillRect(0, 0, 480, 270);
  n.globalCompositeOperation = 'destination-out';
  const hole = (wx, wy, r, a = 1) => {
    const q = worldToScreen(wx, wy), R = r * cam.z * k * (1 + Math.sin(time * 9 + wx) * 0.03);
    const g = n.createRadialGradient(q.x * k, q.y * k, 0, q.x * k, q.y * k, R);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    n.fillStyle = g; n.beginPath(); n.arc(q.x * k, q.y * k, R, 0, Math.PI * 2); n.fill();
  };
  for (const t of G.towers) hole(t.x, t.y - 20, 85);
  hole(G.castle.x, G.castle.y - 40, 130);
  for (const s of G.soldiers) if (!s.dead) hole(s.x, s.y - 10, s.hero ? 60 : 26, s.hero ? 1 : 0.6);
  for (const p of G.projectiles) if (p.kind === 'meteor' || p.kind === 'fireball' || p.kind === 'shell') { const q = projPos(p, p.t / p.dur); hole(q.x, q.y, 40, 0.8); }
  for (const z of G.zones) hole(z.x, z.y, z.r * 1.6, 0.8);
  ctx.drawImage(NIGHT, 0, 0, W, H);
  // meşale ışığı: kulelerin çevresinde sıcak parıltı
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const t of G.towers) { const q = worldToScreen(t.x, t.y - 26); glow(ctx, q.x, q.y, 34 * cam.z, '255,170,80', 0.16 + Math.sin(time * 8 + t.x) * 0.03); }
  ctx.restore();
}

function drawWeather() {
  if (G.weather === 'sand' || G.stormT > 0) drawSandstorm(G.stormT > 0 ? 1.6 : 1);
  if (G.weather === 'rain') {
    const fl = flashLevel(WFX.flashT);
    ctx.fillStyle = `rgba(10,18,32,${0.2 * (1 - fl)})`; ctx.fillRect(0, 0, W, H);
    for (const far of [true, false]) {
      ctx.strokeStyle = far ? 'rgba(170,190,215,0.28)' : 'rgba(205,220,240,0.42)';
      ctx.lineWidth = far ? 0.8 : 1.1;
      ctx.beginPath();
      for (const d of WFX.drops) {
        if (d.far !== far) continue;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.len * 0.22, d.y - d.len);
      }
      ctx.stroke();
    }
    const b = WFX.bolt;
    if (b) {
      const a = b.t < 0.06 ? 1 : b.t < 0.12 ? 0.3 : b.t < 0.18 ? 0.9 : Math.max(0, 1 - (b.t - 0.18) / 0.22);
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = a;
      const line = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      for (const [lw, col] of [[9, 'rgba(150,180,255,0.25)'], [4, 'rgba(190,210,255,0.6)'], [1.8, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; line(b.main);
        ctx.lineWidth = lw * 0.55; b.branches.forEach(line);
      }
      const [gx, gy] = b.main[b.main.length - 1];
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 60);
      g.addColorStop(0, 'rgba(220,230,255,0.6)'); g.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, 60, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (fl > 0) { ctx.fillStyle = `rgba(235,242,255,${0.42 * fl})`; ctx.fillRect(0, 0, W, H); }
  } else if (G.weather === 'night') {
    drawNight();
  } else if (G.weather === 'snow') {
    ctx.fillStyle = 'rgba(185,205,235,0.08)'; ctx.fillRect(0, 0, W, H);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.92)'][layer];
      ctx.beginPath();
      for (const f of WFX.flakes) {
        if (f.layer !== layer) continue;
        const x = f.x + Math.sin(f.ph) * f.sway;
        ctx.moveTo(x + f.r, f.y); ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}

// Ortam sesi (yağmur hışırtısı / kar rüzgârı) ve gök gürültüsü: Web Audio ile gürültüden üretilir
let amb = null, ambLast = { rain: -1, wind: -1, t: 0 }, brownBuf = null;
function noiseBuffer(sec, brown) {
  const len = Math.floor(actx.sampleRate * sec), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}
function weatherAudio() {
  if (!actx || !master) return;
  if (!amb) {
    const buf = noiseBuffer(2, false);
    const mk = (type, freq, q) => {
      const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = actx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      return g;
    };
    amb = { rain: mk('bandpass', 2400, 0.45), wind: mk('lowpass', 420, 0.8) };
  }
  if (time - ambLast.t < 0.2) return;
  ambLast.t = time;
  const on = screen === 'play' && G && !muted, k = overlay ? 0.35 : 1;
  const rain = on && G.weather === 'rain' ? SOUND.rain.vol * k : 0;
  const windy = G && (G.weather === 'snow' || G.weather === 'sand' || G.stormT > 0), gust = G && (G.weather === 'sand' || G.stormT > 0) ? 1.6 : 1;
  const wind = on && windy ? SOUND.wind.vol * k * gust * (0.55 + 0.45 * Math.sin(time * 0.45) * Math.sin(time * 0.17)) : 0;
  for (const [key, v] of [['rain', rain], ['wind', wind]]) {
    if (Math.abs(ambLast[key] - v) < 0.002) continue;
    ambLast[key] = v;
    amb[key].gain.setTargetAtTime(v, actx.currentTime, 0.4);
  }
}
function thunder(near) {
  if (muted || !actx || !master) return;
  if (!brownBuf) brownBuf = noiseBuffer(3.5, true);
  const t = actx.currentTime, peak = SOUND.thunder.vol * (near ? 1 : 0.55);
  const src = actx.createBufferSource(); src.buffer = brownBuf;
  src.playbackRate.value = rand(0.8, 1.1);
  const f = actx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(near ? 1400 : 500, t); f.frequency.exponentialRampToValueAtTime(140, t + 2);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (near ? 0.02 : 0.15));    // çatırtı
  g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.6);
  g.gain.linearRampToValueAtTime(peak * 0.6, t + 1.0);                     // yuvarlanan gürleme
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + 3.4);
}

// yer seviyesi efektleri: birimlerin altında çizilir
function drawGround() {
  for (const f of G.ground) {
    const k = f.t / f.dur;
    if (f.kind === 'dust') {
      glow(ctx, f.x + f.vx * f.t, f.y + f.vy * f.t, f.r * (1 + k * 1.8), f.col, f.a * (1 - k));
    } else if (f.kind === 'splash') {
      ctx.globalAlpha = 0.5 * (1 - k); ctx.strokeStyle = '#c8d8ea'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 1 + k * 4, 0.5 + k * 1.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawPlay() {
  const sh = G.shakeT > 0 ? G.shakeAmp * (G.shakeT / G.shakeDur) : 0;
  ctx.save();
  if (sh > 0) ctx.translate(rand(-sh, sh), rand(-sh, sh));
  ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(G.bg, 0, 0, W, H);
  for (const d of G.decals) {
    ctx.globalAlpha = (d.hot ? 0.6 : 0.38) * Math.min(1, (d.life - d.t) / 2.5);
    ctx.drawImage(scorchTex(), d.x - d.r, d.y - d.r * 0.5, d.r * 2, d.r);
    if (d.hot && d.t < 3) {
      ctx.globalAlpha = 1; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, d.x, d.y, d.r * 0.7, '255,110,30', (1 - d.t / 3) * (0.55 + Math.sin(time * 9 + d.x) * 0.1));
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  drawGround();
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
  for (const c of G.coins) if (c.state !== 'fly') ents.push([c.y, 4, c]);
  ents.push([G.castle.y - 30, 3, G.castle]);
  ents.sort((a, b) => a[0] - b[0]);
  for (const f of G.effects) if (f.kind === 'corpse') drawCorpse(f);
  for (const [, k, o] of ents) k === 0 ? drawTower(o) : k === 1 ? drawEnemy(o) : k === 2 ? drawSoldier(o) : k === 4 ? drawCoinWorld(o) : drawCastle();
  for (const p of G.projectiles) drawProjectile(p);
  for (const f of G.effects) if (f.kind !== 'corpse') drawEffect(f);
  drawPartsAll(G.parts);
  for (const f of G.floaters) {
    const k = f.t / 1.1, pop = easeOutBack(clamp(f.t / 0.2, 0, 1));
    ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.scale(pop, pop);
    txt(f.text, 0, 0, 15, f.col, 'center', '400', FONT_T);
    ctx.restore();
  }
  drawMenuRange();
  drawEnemyRing();
  ctx.restore();
  drawWeather();
  if (G.hurt > 0) {
    // kale hasar alınca ekran kenarları kızarır
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${0.45 * G.hurt / 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawMenu();
  drawEnemyPanel();
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
    txt(`${G.kills || 0} düşman · ${mm}:${String(ss2).padStart(2, '0')}`, cx, py + 206, 13, '#8a6238', 'center', '800', FONT_B, false);
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
// ---------- kamera (yakınlaştırma / kaydırma) ----------
// Ekran (mantıksal 960x540) <-> dünya dönüşümü; z=1'de ikisi aynıdır.
function worldToScreen(x, y) { return { x: (x - cam.x) * cam.z, y: (y - cam.y) * cam.z }; }
function screenToWorld(x, y) { return { x: cam.x + x / cam.z, y: cam.y + y / cam.z }; }
function clampCam() {
  cam.z = clamp(cam.z, 1, ZOOM_MAX);
  cam.x = clamp(cam.x, 0, W - W / cam.z);
  cam.y = clamp(cam.y, 0, H - H / cam.z);
}
// (sx, sy) ekran noktasının altındaki dünya noktası yerinde kalacak şekilde zoom
function zoomAt(sx, sy, z) {
  const w = screenToWorld(sx, sy);
  cam.z = clamp(z, 1, ZOOM_MAX);
  cam.x = w.x - sx / cam.z; cam.y = w.y - sy / cam.z;
  clampCam();
}
function updateCamera(dt) {
  if (!zoomGoal) return;
  const z = lerp(cam.z, zoomGoal.z, 1 - Math.exp(-dt * 14));
  zoomAt(zoomGoal.sx, zoomGoal.sy, Math.abs(z - zoomGoal.z) < 0.002 ? zoomGoal.z : z);
  if (cam.z === zoomGoal.z) zoomGoal = null;
}

// Dokunmatik: tek parmak dokunuş = seçim (parmak kalkınca), tek parmak sürükleme = kaydırma,
// iki parmak = sıkıştırarak zoom. Fare: tekerlek = zoom, sürükleme = kaydırma. Klavye: + - 0.
const pointers = new Map(); // id -> { x, y, sx, sy, moved, hud }
let pinch = null;           // { d, mx, my }
const DRAG_PX = 8;          // bu kadar kayarsa dokunuş değil sürüklemedir (mantıksal px)

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  initAudio();
  if (trans) return;
  const p = toLogical(ev);
  const ptr = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, hud: false };
  pointers.set(ev.pointerId, ptr);
  if (pointers.size >= 2) {
    // ikinci parmak: sıkıştırma başlar, bekleyen dokunuşlar iptal
    const [a, b] = [...pointers.values()];
    for (const q of pointers.values()) q.moved = true;
    pinch = { d: dist(a.x, a.y, b.x, b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  swipe = screen === 'map' ? { x: p.x, y: p.y } : null;
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      press.key = b.key; press.t = time; press.b = b; press.id = ev.pointerId;
      sfx('click'); ptr.hud = true;
      return;
    }
  }
  if (screen === 'play' && !overlay && hudTap(p.x, p.y)) ptr.hud = true;
});

canvas.addEventListener('pointermove', (ev) => {
  const ptr = pointers.get(ev.pointerId);
  if (!ptr) return;
  const p = toLogical(ev), dx = p.x - ptr.x, dy = p.y - ptr.y;
  ptr.x = p.x; ptr.y = p.y;
  const playing = screen === 'play' && !overlay && !trans;
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = dist(a.x, a.y, b.x, b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (playing && pinch.d > 10) {
      zoomGoal = null;
      zoomAt(pinch.mx, pinch.my, cam.z * d / pinch.d);
      cam.x -= (mx - pinch.mx) / cam.z; cam.y -= (my - pinch.my) / cam.z;
      clampCam();
    }
    pinch = { d, mx, my };
    return;
  }
  if (!ptr.moved && dist(p.x, p.y, ptr.sx, ptr.sy) > DRAG_PX) ptr.moved = true;
  if (ptr.moved && !ptr.hud && playing) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); }
});

function endPointer(ev, cancel) {
  const ptr = pointers.get(ev.pointerId);
  if (!ptr) return;
  pointers.delete(ev.pointerId);
  const wasPinch = !!pinch;
  if (pointers.size < 2) pinch = null;
  if (cancel || ptr.hud || ptr.moved || wasPinch || trans) return;
  if (screen === 'play' && !overlay) { const w = screenToWorld(ptr.sx, ptr.sy); worldTap(w.x, w.y); }
}
window.addEventListener('pointerup', (ev) => endPointer(ev, false));
window.addEventListener('pointercancel', (ev) => endPointer(ev, true));

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  if (screen !== 'play' || overlay) return;
  const p = toLogical(ev);
  // trackpad sıkıştırması ctrlKey ile gelir ve küçük adımlıdır
  const k = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.012 : 0.0018)), base = zoomGoal ? zoomGoal.z : cam.z;
  zoomGoal = { z: clamp(base * k, 1, ZOOM_MAX), sx: p.x, sy: p.y };
}, { passive: false });
window.addEventListener('keydown', (ev) => {
  if (screen !== 'play' || overlay) return;
  const base = zoomGoal ? zoomGoal.z : cam.z;
  if (ev.key === '+' || ev.key === '=') zoomGoal = { z: clamp(base * 1.25, 1, ZOOM_MAX), sx: W / 2, sy: H / 2 };
  else if (ev.key === '-') zoomGoal = { z: clamp(base / 1.25, 1, ZOOM_MAX), sx: W / 2, sy: H / 2 };
  else if (ev.key === '0') zoomGoal = { z: 1, sx: W / 2, sy: H / 2 };
});
// buton işlevi parmak kalkınca çalışır; parmak butondan kayıp gittiyse iptal olur
function release(ev, cancel) {
  if (swipe && !cancel && screen === 'map') {
    const p = toLogical(ev), dx = p.x - swipe.x;
    swipe = null;
    if (Math.abs(dx) > 50) {
      const pages = Math.ceil(epLevels(mapEp || 1).length / 3), np = clamp(mapPage - Math.sign(dx), 0, pages - 1);
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

// Ekran koordinatlı öğeler (HUD, büyüler, dalga işareti, halka menü, düşman paneli).
// Parmak değdiği an çalışır; dokunuş bunlardan birine denk geldiyse true döner.
function hudTap(x, y) {
  if (hit(HUD.pause, x, y)) { tapPop('hud_pause'); sfx('click'); setOverlay('pause'); return true; }
  if (hit(HUD.speed, x, y)) { tapPop('hud_speed'); sfx('click'); speed = speed >= 3 ? 1 : speed + 1; return true; }
  if (hit(HUD.mute, x, y)) { tapPop('hud_mute'); setMuted(!muted); sfx('click'); return true; }
  for (let i = 0; i < G.heroes.length; i++) {
    const h = G.heroes[i], hb = HUD.heroes[i], bd = heroBadge(hb);
    if (dist(bd.x, bd.y, x, y) <= bd.r + 6) { tapPop('hb' + i); openSkills(h); return true; }
    if (hit(hb, x, y)) {
      tapPop('hud_hero' + i); G.mode = null;
      setSel((G.sel && G.sel.hero === h) || h.dead ? null : { kind: 'hero', hero: h });
      sfx('select');
      return true;
    }
  }
  for (const id of ['meteor', 'reinforce']) {
    if (hit(HUD[id], x, y)) {
      tapPop('hud_' + id);
      setSel(null);
      if (G.spells[id] > 0) { sfx('error'); return true; }
      G.mode = G.mode && G.mode.id === id ? null : { kind: 'spell', id };
      if (G.mode) sfx('spell');
      return true;
    }
  }
  // dalga butonu
  if (waveCallable()) {
    for (const pi of nextWavePaths()) {
      const b = waveBtnScreen(pi);
      if (dist(b.x, b.y, x, y) < 24) { tapPop('wave' + pi); waveBonusAndStart(); return true; }
    }
  }
  // açık menü
  if (!G.mode && G.sel && (G.sel.kind === 'plot' || G.sel.kind === 'tower')) {
    for (const it of currentMenu()) {
      if (dist(it.x, it.y, x, y) <= MENU_R + 8) {
        const same = G.preview && G.preview.id === it.id && G.preview.type === it.type;
        tapPop('mi' + it.id + (it.type || ''));
        if (it.id === 'rally') { const tw = G.sel.tower; setSel(null); G.mode = { kind: 'rally', tower: tw }; sfx('pick'); return true; }
        if (it.id === 'max') return true;
        if (!same) { G.preview = it; sfx('pick'); return true; }
        if (it.id === 'build') { if (buildTower(G.sel.plot, it.type)) setSel(null); else sfx('error'); }
        else if (it.id === 'upgrade') { if (upgradeTower(G.sel.tower)) { G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'ability') { if (it.cost != null && buyAbility(G.sel.tower, it.type)) G.preview = null; else sfx('error'); }
        else if (it.id === 'sell') { sellTower(G.sel.tower); setSel(null); }
        return true;
      }
    }
  }
  // açık düşman paneline dokunmak paneli kapatmaz
  if (G.sel && G.sel.kind === 'enemy' && hit(ENEMY_PANEL, x, y)) return true;
  return false;
}

// Dünya koordinatlı dokunuş (parmak kaymadan kalkınca): altın, hedefleme, kahraman, düşman, kule, arsa
function worldTap(x, y) {
  // yerdeki altınlar: dokununca çevredekilerle birlikte hemen toplanır
  for (const c of G.coins) {
    if (c.state === 'fly' || dist(c.x, c.y - c.z - 3, x, y) > 16) continue;
    for (const o of G.coins) if (o.state !== 'fly' && dist(o.x, o.y, c.x, c.y) < 55) collectCoin(o);
    return;
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
  // düşman: dokununca özellik paneli
  {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.siege !== undefined) continue;
      const h = CHAR_H['enemy_' + e.type] || 26, d = dist(e.x, e.y - h * 0.45 - (e.def.flying ? 26 : 0), x, y);
      if (d < Math.max(16, h * 0.6) && d < bd) { bd = d; best = e; }
    }
    if (best) { setSel(G.sel && G.sel.enemy === best ? null : { kind: 'enemy', enemy: best }); sfx('select'); return; }
  }
  // kule
  for (const t of G.towers) {
    if (Math.abs(x - t.x) < 32 * BUILD_K && y < t.y + 20 && y > t.y - 88 * BUILD_K) {
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
    if (G) G.bg = renderBackground(G.lv, G.paths, bgRes());
    for (const k in THUMB) delete THUMB[k];
  }
  if (screen === 'play' && !overlay && !trans) {
    for (let i = 0; i < speed; i++) update(real);
  }
  if (screen === 'play' && G) { updateCamera(real); weatherVisuals(real); }
  weatherAudio();
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
  wave: () => waveBonusAndStart(), cast: castSpell, cam, zoomAt, lightning: () => strikeLightning(), spawn: (t, p = 0) => spawnEnemy(t, p), setOverlay, buy: buyAbility, selectTower: (t) => setSel({ kind: 'tower', tower: t }), select: (i) => setSel({ kind: 'plot', plot: G.plots[i] }),
  goMap: () => { screen = 'map'; screenT = time; }, goHeroes: () => { screen = 'heroes'; screenT = time; }, goUpgrades: () => { screen = 'upgrades'; screenT = time; },
  learn: (i, pi) => learnSkill(G.heroes[i], pi), kill: (e) => damageEnemy(e, 1e9, 'true'), openSkills: (i) => openSkills(G.heroes[i]), save: () => save,
  sim(seconds, dt = 1 / 30) { for (let t = 0; t < seconds && !overlay; t += dt) update(dt); return overlay; },
};
})();

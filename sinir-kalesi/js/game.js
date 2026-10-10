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
// Düşman/iskelet animasyon şeritleri açılışta yüklenmez: bölüm başında yalnız o bölümde görünecekler yüklenir,
// gerekmeyenler bellekten atılır (hepsi birden yüzlerce MB tutup tablet/telefonda oyunu donduruyordu).
const LAZY = {}, LAZY_RE = /^(enemy|unit|hero)_.+_(walk|walk_on|walk_arka|atk|atk2|atk3|skill|die)$/, STRIP_WAIT = new Set();
function loadStrip(name) {
  if (SPR[name] || !LAZY[name] || STRIP_WAIT.has(name)) return;
  STRIP_WAIT.add(name);
  const im = new Image();
  im.src = 'img/' + LAZY[name] + (window.SURUM ? '?v=' + window.SURUM : '');
  (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; }))
    .then(() => { if (STRIP_WAIT.has(name)) { SPR[name] = im; mipsOf(im); } }) // küçük kopyalar da şimdi (ilk çizimde takılmasın)
    .catch(() => {})
    .finally(() => STRIP_WAIT.delete(name));
}
function useStrips(keep) {
  for (const k in SPR) if (LAZY_RE.test(k) && !keep.has(k)) delete SPR[k];
  for (const k in ROT) if (LAZY_RE.test(k)) delete ROT[k]; // dirilenlerin çürümüş şerit kopyaları
  for (const k of [...STRIP_WAIT]) if (!keep.has(k)) STRIP_WAIT.delete(k);
  keep.forEach(loadStrip);
}
let IMG_READY = false; // açılışta yüklenen bütün görseller geldi (harita zemini ancak o zaman önceden hazırlanır)
let bgDirty = 0; // arka plan sprite'ı yeni yüklendi: bölüm arka planı ve harita önizlemeleri yeniden çizilecek
fetch('img/manifest.json', { cache: 'no-cache' }) // liste değişince eski kopya kullanılmasın
  .then(r => (r.ok ? r.json() : []))
  .then(list => {
    // kapak görseli tek başına önce yüklenir (diğer ~200 görsel onunla yarışmasın: telefonda açılış siyah ekranı kısalır), sonra kalanlar
    const load = (file, done) => {
      const name = file.replace(/\.(png|svg|jpg|webp)$/, '');
      if (LAZY_RE.test(name)) { LAZY[name] = file; return; } // animasyon şeridi: bölümde gerekince yüklenir
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
        if (done) done();
      };
      if (done) im.onerror = done;
      im.src = 'img/' + file + (window.SURUM ? '?v=' + window.SURUM : '');
    };
    const isKey = (f) => /^nm_key/.test(f), rest = list.filter(f => !isKey(f));
    let started = false, left = 0; const tick = () => { if (--left <= 0) IMG_READY = true; };
    const go = () => { if (!started) { started = true; const eager = rest.filter(f => !LAZY_RE.test(f.replace(/\.(png|svg|jpg|webp)$/, ''))); left = eager.length; rest.forEach(f => load(f, LAZY_RE.test(f.replace(/\.(png|svg|jpg|webp)$/, '')) ? null : tick)); if (!left) IMG_READY = true; } };
    const key = list.filter(isKey); key.forEach(f => load(f, go)); if (!key.length) go();
    setTimeout(go, 2500); // kapak gelmezse yine de devam
  })
  .catch(() => {});
// Kare kare animasyon şeritleri (img/anim.json): ad -> { n: kare sayısı, fw/fh: kare boyu (px), base: ayak çizgisinin
// alttan oranı, ch: karakter boyunun kare boyuna oranı }. Şerit varsa o hareket bu karelerle çizilir (ör. enemy_orc_walk).
const ANIM_META = {};
fetch('img/anim.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).then(m => Object.assign(ANIM_META, m)).catch(() => {});
// şeridin i. karesi: ayaklar orijinde, karakter boyu h olacak şekilde
function drawFrame(img, F, i, h) {
  const k = h / (F.ch * F.fh), dw = F.fw * k, dh = F.fh * k;
  const m = pickMip(ctx, img, dw * F.n), s = m.width / img.width;
  ctx.drawImage(m, i * F.fw * s, 0, F.fw * s, F.fh * s, -dw / 2, -dh * (1 - F.base), dw, dh);
}
// Boyama sprite'larının kaynak ölçüleri (aynı sayfadaki kulelerin göreli boyu korunur)
const SPR_META = {};
fetch('img/meta.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).then(m => Object.assign(SPR_META, m)).catch(() => {});
// Oyun içi boyutlar (mantıksal px). Karakterler yüksekliğe göre, kule ve dekor kaynak ölçeğe göre.
const CHAR_H = { soldier: 21, militia: 21 };
for (const k in ENEMIES) if (ENEMIES[k].h) CHAR_H['enemy_' + k] = ENEMIES[k].h;
// Ortak ölçekler: UNIT_K tüm birimler (asker, kahraman, düşman), BUILD_K binalar (kule, kale, arsa),
// ROAD_K yol genişliği. ZOOM_MAX: en yakın zoom (arka plan dokusunun keskin kaldığı sınır).
const UNIT_K = 0.72, BUILD_K = 0.81, ROAD_K = 1.57, ZOOM_MAX = 2.5;
for (const k in CHAR_H) CHAR_H[k] *= UNIT_K;
const TOWER_K = 0.12 * BUILD_K, TREE_K = 0.105, ROCK_K = 0.075;
const TOWER_TOP = { archer: 0.86, barracks: 0.7, mage: 0.92, artillery: 0.74 }; // mermi çıkış yüksekliği
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

// İsabet anında sprite'ın üzerine çizilen beyaz siluet (önbellekli)
const WHITE = {};
// dirilen cesetler: aynı görselin solgun, yeşilimsi-gri çürümüş renkli kopyası (önbellekli)
const ROT = {};
function rottenOf(name, im) {
  if (ROT[name]) return ROT[name];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const L = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;
    a[i] = (a[i] * 0.3 + (L * 0.74 + 16) * 0.7) * 0.86;
    a[i + 1] = (a[i + 1] * 0.3 + (L * 0.92 + 30) * 0.7) * 0.86;
    a[i + 2] = (a[i + 2] * 0.3 + (L * 0.68 + 12) * 0.7) * 0.86;
  }
  g.putImageData(d, 0, 0);
  return (ROT[name] = c);
}
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
// müzik düzeyi (10 Eki): varsayılan YÜKSEK yerine ORTA; kayıtta dokunulmamış YÜKSEK (1) varsa bir kez ORTA (0.7) yapılır
if (!save.mvol07) { if (save.settings && save.settings.mvol === 1) save.settings.mvol = 0.7; save.mvol07 = true; }
// 15 bölüme geçiş (8 Eki): eski 5 bölümün yıldızları ve meydan okumaları yeni sıralarına (1, 4, 7, 10, 15) taşınır
if (!save.v15) {
  const MAP5 = [0, 3, 6, 9, 14];
  if (save.stars && save.stars.length && save.stars.length <= 5) {
    const st = [], ch = {};
    save.stars.forEach((v, i) => { st[MAP5[i]] = v || 0; });
    for (const k in save.ch || {}) ch[MAP5[k]] = save.ch[k];
    save.stars = Array.from(st, v => v || 0); save.ch = ch;
  }
  save.v15 = 1;
}
// 10 Eki: seferler 15'ten 20 bölüme çıktı (her bölgenin finalinden önce yeni bölüm): eski kayıttaki bölüm dizinleri taşınır
if (NECRO && !save.lv20 && save.stars && save.stars.length) {
  const M = (i) => { const ep = i >= 15 ? 1 : 0, j = i - 15 * ep; return 20 * ep + 4 * Math.floor(j / 3) + (j % 3 < 2 ? j % 3 : 3); };
  for (const k of ['stars', 'ch', 'endless']) {
    const o = save[k]; if (!o || typeof o !== 'object') continue;
    const n = Array.isArray(o) ? [] : {};
    for (const i of Object.keys(o)) if (/^\d+$/.test(i)) n[M(+i)] = o[i]; else n[i] = o[i];
    save[k] = n;
  }
}
save.lv20 = true;
// ----- ayarlar (kayıtta saklanır) -----
const SETTINGS_DEF = { vol: 1, shake: true, gfx: 'auto', music: true, mvol: 0.7, sfx: true }; // Caner (10 Eki): müzik varsayılanı ORTA // vol: efekt düzeyi, mvol: müzik düzeyi
const sfxGain = () => (setting('sfx') ? 0.9 * setting('vol') : 0);
function setting(k) { return (save.settings && save.settings[k] != null) ? save.settings[k] : SETTINGS_DEF[k]; }
function setSetting(k, v) {
  save.settings = Object.assign({}, save.settings, { [k]: v }); persist();
  if ((k === 'vol' || k === 'sfx') && master) master.gain.value = sfxGain();
  if (k === 'gfx') { quality = v === 'low' ? 0.75 : QMAX; resize(); }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------- canvas & ölçek ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
// Tam ekran (Caner, 10 Eki): oyun çerçevesi (960x540) güvenli bölgeye sığdırılır, ama siyah kenar kalmaz.
// VIS: ekranın tamamı, EDGE: çentik/ana ekran çubuğu dışındaki güvenli bölge (ikisi de çerçevenin mantıksal koordinatında).
// Bölüm zemini çerçevenin dışına BLEED kadar taşar; arayüz (can/altın, düğmeler, büyüler) EDGE kenarlarına yaslanır.
let VIS = { l: 0, t: 0, r: W, b: H, w: W, h: H }, EDGE = { l: 0, t: 0, r: W, b: H }, BLEED = { x: 0, y: 0 };
const BLEED_MAX = { x: 420, y: 260 }; // çok geniş masaüstü pencerelerinde zemin bundan fazla taşmaz (dışı karanlık)

// Çentikli telefonlarda (yatay tutuşta kamera çentiği) oyun alanı güvenli bölgeye sığdırılır
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
  'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
document.body.appendChild(safeProbe);
// Çizim çözünürlüğü: ekranın gerçek piksel yoğunluğu (en çok 3). 1.5 sınırı yakınlaşınca her şeyi bulanıklaştırıyordu (Caner, 10 Eki).
// Kare hızı düşerse çözünürlük kademeli olarak azaltılır, toparlanınca geri yükseltilir.
const QMAX = Math.min(window.devicePixelRatio || 1, 3);
let quality = setting('gfx') === 'low' ? 0.75 : QMAX;
// Otomatik kalite (10 Eki düzeltmesi): eskiden kare aralığına bakıyordu; iPhone Düşük Güç kipinde (30 fps sınırı) aralık hep uzun
// olduğundan çözünürlük 0.85'e iner, birimler bulanıklaşırdı (Caner: "düşmanlar ve askerlerim net değil"). Artık karenin gerçek iş
// süresine bakar ve otomatikte ekran yoğunluğunun 2 katının altına inmez (düşük kalite elle seçilirse 0.75).
const QMIN = Math.min(QMAX, 2);
const perf = { acc: 0, work: 0, n: 0, t: 0, good: 0, last: 0 };
function adaptQuality(real) {
  if (real > 0.2 || setting('gfx') !== 'auto') return; // sekme arka plandaydı / kalite elle seçildi
  perf.acc += real; perf.work += perf.last; perf.n++; perf.t += real;
  if (perf.t < 2) return;
  const avg = perf.acc / perf.n, work = perf.work / perf.n;
  perf.acc = perf.work = perf.n = perf.t = 0;
  if (avg > 1 / 42 && work > 0.02 && quality > QMIN) { quality = Math.max(QMIN, quality * 0.85); perf.good = 0; resize(); }
  else if (work < 0.01 && quality < QMAX) { if (++perf.good >= 2) { quality = Math.min(QMAX, quality * 1.15); perf.good = 0; resize(); } }
  else perf.good = 0;
}
function resize() {
  const dpr = quality;
  // gizli/sıfır boyutlu pencere (ör. arka plandaki sekme): ölçek 0 olur, her şey NaN'a döner; önceki ölçüyle devam
  const cw = window.innerWidth || (view && view.cw) || W, ch = window.innerHeight || (view && view.ch) || H;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const cs = getComputedStyle(safeProbe), px = (v) => parseFloat(v) || 0;
  let sl = px(cs.paddingLeft), sr = px(cs.paddingRight), st = px(cs.paddingTop), sb = px(cs.paddingBottom);
  // geniş (çentikli / yuvarlak köşeli) telefon ekranı: güvenli bölge bilgisi gelmese de arayüz köşelere yenmesin (Caner, 10 Eki: iPhone'da
  // sol üst, sağ üst ve sol alttaki düğmeler kesiliyordu). Yanlardan en az %5,5, alttan en az 14 px pay.
  if (cw / ch > 1.95 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
    const m = Math.round(cw * 0.055); sl = Math.max(sl, m); sr = Math.max(sr, m); sb = Math.max(sb, 14);
  }
  const aw = cw - sl - sr, ah = ch - st - sb;
  const scale = Math.min(aw / W, ah / H);
  view = { scale, ox: sl + (aw - W * scale) / 2, oy: st + (ah - H * scale) / 2, dpr, cw, ch };
  const L = (x) => (x - view.ox) / scale, T = (y) => (y - view.oy) / scale;
  VIS = { l: L(0), t: T(0), r: L(cw), b: T(ch) }; VIS.w = VIS.r - VIS.l; VIS.h = VIS.b - VIS.t;
  EDGE = { l: Math.min(0, L(sl)), t: Math.min(0, T(st)), r: Math.max(W, L(cw - sr)), b: Math.max(H, T(ch - sb)) };
  try { if (G) G.waveBtn = {}; } catch (e) {} // dalga düğmesinin yeri görünen kenarlara göre yeniden hesaplanır (ilk çağrıda G henüz tanımsız)
  const bx = Math.min(BLEED_MAX.x, Math.ceil(Math.max(0, -VIS.l, VIS.r - W) / 16) * 16), by = Math.min(BLEED_MAX.y, Math.ceil(Math.max(0, -VIS.t, VIS.b - H) / 16) * 16); // güvenli pay tek yandaysa çerçeve kayar: iki yanın büyüğü
  if (bx > BLEED.x || by > BLEED.y) { BLEED = { x: Math.max(bx, BLEED.x), y: Math.max(by, BLEED.y) }; try { if (G) bgDirty = Math.max(time, 0.001); } catch (e) {} } // ilk çağrıda G henüz tanımsız
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; // tuval boyutu değişince sıfırlanır
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
resize();
// iOS uygulamasında güvenli bölge payları sayfa açıldıktan biraz sonra gelir (resize olayı olmadan): değişirse yeniden ölçülür
{ let lastSafe = '';
  setInterval(() => { const cs = getComputedStyle(safeProbe), k = cs.paddingLeft + cs.paddingRight + cs.paddingTop + cs.paddingBottom; if (k !== lastSafe) { lastSafe = k; resize(); } }, 700); }

// ---------- ses ----------
// ses/manifest.json içindeki WAV'lar (Kenney, CC0). Dosya adı "tür_n": aynı türün varyantları
// rastgele seçilir, hız hafifçe oynatılır ki tekrar eden sesler mekanik duyulmasın.
// vol: ses düzeyi, gap: aynı türün iki çalışı arasındaki en kısa süre, max: aynı anda en çok kaç tane.
const SOUND = {
  arrow:   { vol: 0.26, gap: 0.07, max: 3, rate: [0.92, 1.12] },   // kemik ok bırakma
  arrowhit: { vol: 0.22, gap: 0.06, max: 2, rate: [0.9, 1.15] },   // ok ucu saplanması
  splash:  { vol: 0.32, gap: 0.14, max: 2, rate: [0.9, 1.1] },     // kazan: fokurdayan buhar
  pain:    { vol: 0.14, gap: 0.12, max: 2 },                         // düşman acı sesi (painVoice)
  dvoice:  { vol: 0.15, gap: 0.15, max: 2 },                         // ölüm iniltisi (deathVoice)
  scream:  { vol: 0.13, gap: 0.12, max: 2, rate: [0.95, 1.08] },    // korku çığlığı
  mvoices: { vol: 0.5, gap: 0.4, max: 1 },  mvoicem: { vol: 0.5, gap: 0.4, max: 1 },  mvoicel: { vol: 0.5, gap: 0.4, max: 1 }, // Mortimer konuşması
  mlaugh:  { vol: 0.45, gap: 1, max: 1 },                           // Mortimer'ın sinsi kahkahası
  drum:    { vol: 0.26, gap: 0.3, max: 1, rate: [0.96, 1.04] },     // savaş davulu (davulcu)
  horn:    { vol: 0.36, gap: 1, max: 1 },                           // borazancı, ilk dalga (10 Eki: gerçekçi tek uzun savaş borusu)
  hornboss: { vol: 0.42, gap: 2, max: 1 },                          // boss gelirken: iki uzun, derin, ürkütücü üfleme
  xbow:    { vol: 0.24, gap: 0.06, max: 3, rate: [0.94, 1.08] },    // arbalet atışı (kiriş şaklaması)
  xbowh:   { vol: 0.34, gap: 0.12, max: 2, rate: [0.95, 1.05] },    // ağır arbalet atışı (kalın kiriş, mekanizma)
  armorhit: { vol: 0.2, gap: 0.08, max: 2, rate: [0.9, 1.12] },     // cıvata zırha çarpar (metal tınlaması)
  rattle:  { vol: 0.2, gap: 0.25, max: 1, rate: [0.92, 1.1] },      // iskelet mahzenden çıkarken kemik takırtısı
  // ElevenLabs efektleri (varliklar/elevenlabs_efekt.py): yeni birimler ve Mortimer'ın büyüleri
  elephant: { vol: 0.5, gap: 3, max: 1, rate: [0.95, 1.05] },     // savaş fili böğürmesi (gelişte, ezerken)
  vulture:  { vol: 0.32, gap: 2.5, max: 1, rate: [0.92, 1.1] },   // akbaba çığlığı (gelişte, ceset yerken)
  bonewall: { vol: 0.6, gap: 0.5, max: 1 },                       // kemik duvar topraktan fışkırır
  raise:    { vol: 0.5, gap: 1, max: 1 },                         // ölüler kalkar
  fear:     { vol: 0.5, gap: 1, max: 1 },                         // korku ruhları uğuldar
  bats:     { vol: 0.45, gap: 1, max: 1 },                        // yarasa sürüsü
  bonefall: { vol: 0.13, gap: 0.2, max: 1, rate: [0.92, 1.1] },       // iskelet ölünce kemikleri saçılır (arka planda kalsın)
  magic:   { vol: 0.30, gap: 0.12, max: 2, rate: [0.85, 1.1] },
  cannon:  { vol: 0.45, gap: 0.10, max: 2, rate: [0.85, 1.0] },
  boom:    { vol: 0.50, gap: 0.08, max: 3, rate: [0.9, 1.1] },
  meteor:  { vol: 0.70, gap: 0.15, max: 2, rate: [0.85, 1.0] },
  clash:   { vol: 0.17, gap: 0.1, max: 2, rate: [0.94, 1.06] },     // kılıç çarpışması (gerçek kayıt, StarNinjas CC0; hafif)
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
  bash:    { vol: 0.36, gap: 0.2, max: 1, rate: [0.92, 1.08] },     // kemik çatırtısı
  cry:     { vol: 0.6, gap: 0.5, max: 1 },
  whirl:   { vol: 0.55, gap: 0.2, max: 1, rate: [0.8, 0.9] },
  zap:     { vol: 0.3, gap: 0.14, max: 2, rate: [0.92, 1.08] },     // karanlık ruh uğultusu
  error:   { vol: 0.35, gap: 0.15, max: 1 },
  // dosyasız, WebAudio ile üretilen sesler: gök gürültüsü ve hava ortam sesleri
  thunder: { vol: 0.9 },
  rain:    { vol: 0.07 },
  wind:    { vol: 0.08 },
  spell:   { vol: 0.45, gap: 0.2, max: 1 },
  reinforce: { vol: 0.55, gap: 0.2, max: 1 },
  portal:  { vol: 1, gap: 0.6, max: 1 },
  roar:    { vol: 1, gap: 1.2, max: 1 },
  stomp:   { vol: 1, gap: 0.22, max: 1 },
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
  master.gain.value = sfxGain();
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
  } else if (kind === 'whoosh') { // geçiş: yükselip alçalan hava hışırtısı ve altta boğuk bir gümleme
    const n = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
    n.buffer = noiseBuf(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(320, now); bp.frequency.exponentialRampToValueAtTime(1700, now + 0.22); bp.frequency.exponentialRampToValueAtTime(500, now + 0.5);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.16, now + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    n.connect(bp); bp.connect(g); g.connect(master); n.start(now); n.stop(now + 0.6);
    uiPop(now + 0.24, 120, 55, 0.22, 0.35, out);
  } else return false;
  return true;
}
// Mortimer konuşurken: kısa, anlamsız, boğuk hece mırıltısı (kare dalga + ağız formantı) ve arada kemik takırtısı
// Mortimer'ın sesi: sentezlenmiş anlamsız konuşma (varliklar/ses_uret.py mort_babble), yazının uzunluğuna göre kısa/orta/uzun;
// alaycı laflarda arkasından kahkaha. Ses dosyaları yoksa eski osilatör mırıltısı.
const MORT_LAUGH = ['fear', 'raise', 'burst', 'bossDown', 'streak', 'wall', 'bossRage'];
// Mortimer'ın seslendirilmiş replikleri (ElevenLabs, varliklar/elevenlabs_seslendir.py). Hepsi tek dosyada (ses ızgarası,
// varliklar/mort_sprite.py): ses/mort/mort_all.mp3 + sprite.json {yazı: [başlangıç, süre]}; ilk replikte bir kez çözülür.
// Dosyası olan replik birebir seslendirilir; olmayanlar aşağıdaki sentez mırıltıya düşer.
let MORT_VO = null, mortVoiceUntil = 0, MORT_ALL = null, MORT_ALL_P = null;
fetch('ses/mort/sprite.json?v=' + (window.SURUM || ''), { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(j => { MORT_VO = j; }).catch(() => {});
function mortVoice(text) {
  const sp = MORT_VO && MORT_VO[text];
  if (!sp || muted || !actx || !master || window.LANG === 'en') return false; // kayıtlar Türkçe: İngilizcede mırıltı çalar
  const play = (buf) => {
    const src = actx.createBufferSource(), g = actx.createGain();
    g.gain.value = 0.76; src.buffer = buf; src.connect(g); g.connect(master); src.start(0, sp[0], sp[1] + 0.06); // 10 Eki: %20 kısıldı (0.95 -> 0.76)
    mortVoiceUntil = time + sp[1] + 0.2;
  };
  if (MORT_ALL) { play(MORT_ALL); return true; }
  if (!MORT_ALL_P) MORT_ALL_P = fetch('ses/mort/mort_all.mp3?v=' + (window.SURUM || '')).then(r => r.arrayBuffer()).then(a => actx.decodeAudioData(a)).then(b => (MORT_ALL = b)).catch(() => { MORT_ALL_P = null; });
  MORT_ALL_P.then(b => b && play(b));
  return true;
}
function mortMumble(text, kind) {
  if (muted || !actx || !master) return;
  if (mortVoice(text)) return;
  const grp = text.length < 22 ? 'mvoices' : text.length < 38 ? 'mvoicem' : 'mvoicel';
  if (SND[grp] && SND[grp].length) {
    sfx(grp, rand(0.96, 1.05));
    if (MORT_LAUGH.includes(kind) && Math.random() < 0.6) setTimeout(() => sfx('mlaugh', rand(0.97, 1.04)), 300 + text.length * 22);
    return;
  }
  const now = actx.currentTime, n = clamp(Math.round(text.length / 4), 4, 12), base = 112 + Math.random() * 24;
  const out = actx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 1700; out.connect(master);
  let t = now + 0.02;
  for (let i = 0; i < n; i++) {
    const dur = 0.05 + Math.random() * 0.045, f0 = base * (i === n - 1 ? 0.78 : 0.85 + Math.random() * 0.6);
    const o = actx.createOscillator(), bp = actx.createBiquadFilter(), g = actx.createGain();
    o.type = Math.random() < 0.5 ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (0.82 + Math.random() * 0.3), t + dur);
    bp.type = 'bandpass'; bp.Q.value = 3.5; bp.frequency.setValueAtTime(480 + Math.random() * 700, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    if (i % 4 === 3) { // kemik takırtısı
      const nz = actx.createBufferSource(), nb = actx.createBiquadFilter(), ng = actx.createGain();
      nz.buffer = noiseBuf(); nb.type = 'bandpass'; nb.frequency.value = 2600; nb.Q.value = 6;
      ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      nz.connect(nb); nb.connect(ng); ng.connect(out); nz.start(t); nz.stop(t + 0.04);
    }
    t += dur + 0.012 + Math.random() * 0.035;
  }
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

// Boss çağrısı: tiz büyü sesi yerine yumuşak, alçak bir geçit uğultusu (süzülmüş gürültü + derin sinüs)
function portalSound(now) {
  const n = actx.createBufferSource(), lp = actx.createBiquadFilter(), g = actx.createGain();
  n.buffer = noiseBuf(); n.loop = true; lp.type = 'lowpass'; lp.Q.value = 4;
  lp.frequency.setValueAtTime(220, now); lp.frequency.exponentialRampToValueAtTime(700, now + 0.35); lp.frequency.exponentialRampToValueAtTime(160, now + 0.9);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.14, now + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
  n.connect(lp); lp.connect(g); g.connect(master); n.start(now); n.stop(now + 1);
  const o = actx.createOscillator(), og = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(58, now); o.frequency.exponentialRampToValueAtTime(42, now + 0.9);
  og.gain.setValueAtTime(0.0001, now); og.gain.exponentialRampToValueAtTime(0.16, now + 0.25); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
  o.connect(og); og.connect(master); o.start(now); o.stop(now + 1);
}
// Boss kükremesi: gırtlaktan testere dalgası, iki ünlü süzgeci, hızlı hırıltı titreşimi ve nefes gürültüsü
function roarSound(now) {
  const dur = 0.85, o = actx.createOscillator(), amp = actx.createGain(), tr = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(92, 105), now); o.frequency.linearRampToValueAtTime(rand(120, 130), now + 0.2); o.frequency.exponentialRampToValueAtTime(58, now + dur);
  lfo.frequency.value = 27; lg.gain.value = 0.5; tr.gain.value = 0.6; lfo.connect(lg); lg.connect(tr.gain);
  amp.gain.setValueAtTime(0.0001, now); amp.gain.exponentialRampToValueAtTime(0.2, now + 0.08); amp.gain.setValueAtTime(0.2, now + 0.45); amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  for (const [f, q, k] of [[520, 5, 1], [880, 7, 0.6], [240, 3, 0.8]]) { const bp = actx.createBiquadFilter(), bg = actx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; bg.gain.value = k; o.connect(bp); bp.connect(bg); bg.connect(tr); }
  tr.connect(amp); amp.connect(master);
  const n = actx.createBufferSource(), nl = actx.createBiquadFilter(), ng = actx.createGain();
  n.buffer = noiseBuf(); n.loop = true; nl.type = 'bandpass'; nl.frequency.value = 600; nl.Q.value = 0.7;
  ng.gain.setValueAtTime(0.0001, now); ng.gain.exponentialRampToValueAtTime(0.07, now + 0.1); ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  n.connect(nl); nl.connect(ng); ng.connect(master);
  o.start(now); lfo.start(now); n.start(now); o.stop(now + dur + 0.05); lfo.stop(now + dur + 0.05); n.stop(now + dur + 0.05);
}
// Dev boss adımı: kısa, derin bir gümleme
function stompSound(now) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(70, now); o.frequency.exponentialRampToValueAtTime(32, now + 0.16);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.22, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + 0.22);
}
// Boss girişi: uzaktan derin boru akoru, üç ağır savaş davulu ve yer gürültüsü
function bossSting() {
  if (muted || !actx) return;
  const t = actx.currentTime, out = actx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 650; out.Q.value = 0.6; out.connect(master);
  for (const [f, v] of [[55, 0.1], [82.4, 0.08], [110, 0.06], [65.4, 0.05]]) {
    const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lfo.frequency.value = 4.5; lg.gain.value = f * 0.008; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.6); g.gain.setValueAtTime(v, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + 2.7); lfo.stop(t + 2.7);
  }
  for (const dt of [0, 0.42, 0.84, 1.5]) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(80, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.35);
    g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(dt > 1 ? 0.42 : 0.32, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.45);
    o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.5);
  }
  const n = actx.createBufferSource(), lp = actx.createBiquadFilter(), ng = actx.createGain();
  n.buffer = noiseBuf(); n.loop = true; lp.type = 'lowpass'; lp.frequency.value = 140;
  ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.25, t + 0.8); ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  n.connect(lp); lp.connect(ng); ng.connect(master); n.start(t); n.stop(t + 2.7);
}
const SYNTH_SFX = { portal: portalSound, roar: roarSound, stomp: stompSound };

function sfx(kind, rate) {
  if (muted || !actx) return;
  if (kind === 'wave') { const st = sndState.wave || (sndState.wave = { last: -9, playing: 0 }); if (actx.currentTime - st.last > 0.6) { st.last = actx.currentTime; waveSound(); } return; }
  if ((kind === 'click' || kind === 'select' || kind === 'pick' || kind === 'open' || kind === 'whoosh') && uiSound(kind)) return;
  const def = SOUND[kind], list = SND[kind];
  const synth = SYNTH_SFX[kind];
  if (!def || (!synth && (!list || !list.length))) return;
  const st = sndState[kind] || (sndState[kind] = { last: -1, playing: 0 });
  const now = actx.currentTime;
  if (now - st.last < def.gap || st.playing >= def.max) return;
  st.last = now;
  if (synth) { synth(now, list); return; }
  st.playing++;
  const src = actx.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  if (rate) src.playbackRate.value = rate;
  else if (def.rate) src.playbackRate.value = rand(def.rate[0], def.rate[1]);
  const g = actx.createGain();
  g.gain.value = def.vol;
  src.connect(g); g.connect(master);
  src.onended = () => { st.playing--; };
  src.start();
}

// Düşman sesleri (ses/pain_*, dvoice_*, scream_*: gerçek kayıtlar, varliklar/ses_kayit_isle.py). Perde düşmana göre: ağır/boss kalın, hafif ince.
// Her düşmanın kendi perdesi vardır (e.vp) ki kalabalıkta aynı adam bağırıyor gibi olmasın.
const VOICE_P = { heavy: 0.95, gladiator: 0.97, cavalry: 0.98, priest: 1.1, assassin: 1.08, solarcher: 1.05 };
function voicePitch(e) {
  if (!e.vp) e.vp = (VOICE_P[e.def.base || e.type] || 1) * rand(0.94, 1.08) * (e.def.chief ? 0.9 : 1);
  return e.vp;
}
const MUTE_VOICE = (e) => !!e.def.machine || ['wardog', 'eagle', 'elephant', 'vulture'].includes(e.type); // makineler ve hayvanlar insan sesiyle bağırmaz
function deathVoice(e) { if (!MUTE_VOICE(e)) sfx('dvoice', voicePitch(e)); }
// acı sesi: her düşman en çok ~1,4 sn'de bir, sürekli hasarda (zehir, gaz) çıkmaz
function painVoice(e) {
  if (MUTE_VOICE(e) || (e.painAt && time - e.painAt < 2) || Math.random() > 0.35) return;
  e.painAt = time; sfx('pain', voicePitch(e));
}

// ----- müzik: üç parça, aralarında yumuşak geçiş -----
// menu: ana tema (Banquet for the Uninvited), menülerde döngü. battle: bölüm içi savaş müziği. boss: boss sahadayken.
// Dosya yoksa (henüz üretilmediyse) o parça sessiz kalır, boss parçası yoksa savaş parçası çalar.
// Her parça kaldığı yerden devam eder; savaş parçası her bölüm başında baştan başlar.
// Tarayıcılar ilk dokunuştan önce ses çalmaya izin vermez. Parçalar yüksek masterlandığı için kısık çalınır.
// Savaş ve boss parçaları 10 Eki'de iki kez kısıldı (Caner: oyun içi müzik yüksek; toplam ~%40).
const MUSIC = { started: false, tracks: {
  menu:   { file: 'muzik_menu.mp3',  gain: 0.3 },
  battle: { file: 'muzik_savas.mp3', gain: 0.07, seam: true }, // The Necromancer's Parade
  boss:   { file: 'muzik_boss.mp3',  gain: 0.12, seam: true }, // Bones on the Battlements
  // 2. sefer (Cadı Avı): dosya yoksa 1. seferin parçası çalar
  battle2: { file: 'muzik_savas2.mp3', gain: 0.07, seam: true },
  boss2:   { file: 'muzik_boss2.mp3',  gain: 0.12, seam: true },
} };
// seam: dikişsiz döngü. Dosyanın sonu başıyla önceden harmanlanmıştır (ffmpeg); tarayıcının loop'u MP3'te kısa bir
// boşluk bırakabildiği için iki ses öğesi sırayla çalar: biri bitmeden 0,3 sn önce öteki baştan başlar, eskisi söner.
function musicAudio(T) {
  const el = new Audio('ses/' + T.file + (window.SURUM ? '?v=' + window.SURUM : ''));
  el.loop = !T.seam; el.volume = 0; el.preload = 'auto';
  // geçiş kaçarsa (sekme takıldı vb.) biten öğe baştan başlar
  if (T.seam) el.addEventListener('ended', () => { if (T.el === el) { el.currentTime = 0; el.play().catch(() => {}); } });
  return el;
}
function musicEl(T) {
  if (!T.el && !T.missing) {
    T.el = musicAudio(T); T.vol = 0;
    T.el.addEventListener('error', () => { T.missing = true; T.el = null; });
    if (T.seam) T.el2 = musicAudio(T);
  }
  return T.el;
}
const SEAM = 0.3;
function musicSeam(T, dt) {
  const el = T.el;
  if (T.old) {
    T.oldT += dt;
    T.old.volume = clamp(T.oldV * (1 - T.oldT / SEAM), 0, 1);
    if (T.oldT >= SEAM) { T.old.pause(); try { T.old.currentTime = 0; } catch (e) {} T.old = null; }
  }
  if (!T.old && !el.paused && el.duration > SEAM * 4 && el.currentTime > el.duration - SEAM) {
    const nx = T.el2;
    try { nx.currentTime = 0; } catch (e) {}
    nx.volume = el.volume; nx.play().catch(() => {});
    T.old = el; T.oldV = el.volume; T.oldT = 0; T.el = nx; T.el2 = el;
  }
}
function startMusic() {
  if (MUSIC.started) return;
  MUSIC.started = true;
  const el = musicEl(MUSIC.tracks.menu);
  // izin yoksa sonraki dokunuşta yeniden denenir
  if (el) el.play().catch((e) => { if (e && e.name === 'NotAllowedError') MUSIC.started = false; });
}
// iOS ve bazı tarayıcılar sesi yalnız parmak kalkınca / tıklamada açar: birkaç olayda denenir
for (const [t, o] of [['pointerup', window], ['touchend', window], ['click', window], ['keydown', window]]) o.addEventListener(t, () => startMusic(), { passive: true });
// açılışta dokunuş beklemeden dener (Caner, 10 Eki: menü müziği hemen başlasın). iOS uygulamasında (Capacitor, WKWebView
// mediaTypesRequiringUserActionForPlayback = []) izin var; tarayıcı izin vermezse NotAllowedError ile ilk dokunuşa kalır.
setTimeout(() => { if (!muted) startMusic(); }, 400);
// bölüm başında savaş parçası baştan başlar
function musicRestartBattle() { for (const k of ['battle', 'battle2']) { const T = MUSIC.tracks[k]; if (T.el) { try { T.el.currentTime = 0; } catch (e) {} } } }
function musicWanted() {
  if (screen !== 'play') return 'menu';
  if (!G || overlay === 'win' || overlay === 'lose' || !G.musicOn) return null;
  const T = MUSIC.tracks;
  const ep2 = G.lv.ep === 2;
  if (G.enemies.some(e => e.def.chief && e.hp > 0)) { if (ep2 && !T.boss2.missing) return 'boss2'; if (!T.boss.missing) return 'boss'; }
  return ep2 && !T.battle2.missing ? 'battle2' : 'battle';
}
// Savaşın yoğunluğu (Caner, 11 Eki: oyun içinde savaş ve efektler önde, müzik gerekince girsin, boss'ta kesin):
// sahadaki düşman sayısı ve son dalga; yavaş değişir (~4 sn), müzik pompalamasın. 0,2 (sakin, neredeyse duyulmaz) .. 1 (yoğun).
function musicHeat(dt) {
  if (!G || screen !== 'play') return 1;
  const alive = G.enemies.reduce((a, e) => a + (e.dead ? 0 : 1), 0), last = G.wave >= G.lv.waves.length && G.wave > 0;
  const goal = Math.max(clamp((alive - 4) / 12, 0, 1), last && alive > 0 ? 0.7 : 0);
  G.musHeat = (G.musHeat ?? 0) + (goal - (G.musHeat ?? 0)) * Math.min(1, dt / 4);
  return 0.2 + 0.8 * G.musHeat;
}
function updateMusic(dt) {
  if (!MUSIC.started) return;
  const want = musicWanted(), on = !muted && setting('music') && !document.hidden;
  for (const k in MUSIC.tracks) {
    const T = MUSIC.tracks[k];
    let tgt = on && k === want ? T.gain * setting('mvol') : 0;
    if (tgt && k.startsWith('battle')) tgt *= musicHeat(dt); // savaş müziği: sakinde çok kısık, kalabalıkta açılır (boss parçası hep tam)
    if (tgt && overlay === 'pause') tgt *= 0.4;
    if (tgt && G && screen === 'play' && (G.heralds || []).some(h => h.state === 'blow')) tgt *= 0.2; // borazan duyulsun
    if (tgt && time < mortVoiceUntil) tgt *= 0.45; // Mortimer konuşurken müzik kısılır
    if (!tgt && !T.el) continue;
    const el = musicEl(T); if (!el) continue;
    // yumuşak giriş (Caner, 10 Eki: borazandan sonra müzik birden yüksek giriyordu): hedefe savaşta ~5 sn'de, boss'ta ~2,5 sn'de
    // kulak kararı doğrusal değil, karesel yükselir (başta çok kısık, sonra açılır); çıkış ~1 sn
    const full = T.gain * setting('mvol') || 0.1;
    T.lin = T.lin || 0;
    T.lin = clamp(T.lin + clamp(Math.sqrt(tgt / full) - T.lin, -dt * 2, dt / (k.startsWith('boss') ? 2.5 : 5)), 0, 1);
    T.vol = full * T.lin * T.lin;
    el.volume = clamp(T.vol, 0, 1);
    if (T.seam) musicSeam(T, dt);
    if (T.vol <= 0.002 && tgt === 0 && !el.paused) { el.pause(); if (T.old) { T.old.pause(); T.old = null; } }
    else if (tgt > 0 && el.paused) el.play().catch(() => {});
  }
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
  if (d < 0 && p.ext) { // tam ekran: çerçeve dışından gelen yolun girişinden geriye, ilk doğrultuda uzanır (düşman ekran dışında doğar)
    const a = p.pts[0], b = p.pts[1], L = p.cum[1] || 1, dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
    return { x: a[0] + dx * d - dy * off, y: a[1] + dy * d + dx * off, dx, dy };
  }
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
// giriş payı: düşman/borazancı yolun bu kadar gerisinden (görünen ekranın dışından) yola çıkar; masaüstünde (taşma yok) 0
const dLo = (p) => (p && p.ext ? -1e4 : 0);
function entryLead(p) {
  if (!p.ext) return 0;
  for (let L = 0; L < 600; L += 10) {
    const q = pathPos(p, -L);
    if (q.x < VIS.l - 30 || q.x > VIS.r + 30 || q.y < VIS.t - 10 || q.y > VIS.b + 60) return L;
  }
  return 600;
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
      if (d < best.d) best = { d, x: px, y: py, p, along: p.cum[i] + (p.cum[i + 1] - p.cum[i]) * t };
    }
  }
  return best;
}

// ----- mahzen kapakları (2. sefer): yol kenarında; altınla açılır, içinden gulyabani çıkıp yolu tutar -----
// gulyabani ölürse respawn sn sonra kapaktan yeniden çıkar; meşaleci kapağın yanında seal sn kalırsa kapağı mühürler (artık çıkmaz)
const HATCH = { cost: 120, respawn: 30, seal: 1.6, sealR: 64, w: 46,
  ghoul: { hp: 520, dmg: [10, 16], armor: 0.35, rate: 1.1, speed: 40, engage: 80 } };
const epRel = (lv) => LEVELS.indexOf(lv) - LEVELS.findIndex(l => l.ep === lv.ep); // seferin içindeki sıra (0..19)
function hatchSpots(lv, paths) {
  if (lv.ep !== 2 || !NECRO) return [];
  if (lv._hatch) return lv._hatch;
  const li = LEVELS.indexOf(lv);
  let seed = ((li + 7) * 2246822519) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const n = epRel(lv) >= 9 ? 3 : 2, out = [], R = lv.roadK || ROAD_K;
  for (let k = 0; k < 600 && out.length < n; k++) {
    const P = paths[Math.floor(rnd() * paths.length)], q = pathPos(P, P.total * (0.15 + rnd() * 0.62));
    const side = rnd() < 0.5 ? -1 : 1, off = 40 + 14 * R, x = q.x - q.dy * off * side, y = q.y + q.dx * off * side;
    if (x < 50 || x > W - 50 || y < 80 || y > H - 40) continue;
    if (y > H - 90 && x < 440) continue; // sol alttaki düğmelerin altı
    if (nearestOnPaths(paths, x, y).d < off - 4) continue; // başka yolun üstüne düşmesin
    if (lv.plots.some(pl => dist(x, y, pl[0], pl[1]) < 56)) continue;
    if (dist(x, y, lv.castle[0], lv.castle[1]) < 160) continue;
    if (out.some(o => dist(x, y, o[0], o[1]) < 170)) continue;
    out.push([x, y, q.x, q.y]);
  }
  return (lv._hatch = out);
}

// ----- Kızıl Ay (2. sefer): işaretli dalgada gök kızarır. İskeletler sert vurur, büyüler hızlı dolar,
// ölen düşman kendiliğinden ölü olarak kalkar; Engizisyon dua eder (yavaşlar) -----
const BLOOD = { dur: 20, dmg: 1.3, cd: 2, slow: 0.75, rise: 0.8 };
function bloodWaves(lv) { // 0 tabanlı dalga sırası; 2. seferin 3. bölümünden başlar, son üç bölümde iki kez
  const li = epRel(lv), N = lv.waves.length;
  if (lv.ep !== 2 || !NECRO || li < 3) return [];
  return li >= 16 ? [Math.floor(N / 2) - 1, N - 2] : [Math.floor(N / 2) + (li % 2)];
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
  // ----- Necromancer seferi: lanetli orman, bataklık, mezarlık, kara göl, Mortimer'ın kapısı -----
  cursed:    { tex: 'cursed', grass: '#3a4030', grass2: '#22281c', patch: ['#3a4030', '#22281c'], trees: 26, rocks: 12, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5e5040', '#a4927a', '#2e2418'], tuft: ['#4a5a2a', '#6a7a34'], stone: ['#6a6a62', '#9a9a8e'], light: 'rgba(150,255,170,0.08)', amb: '150,255,140', flowers: 0,
    treeSpr: ['nm_tree_1', 'nm_tree_3', 'nm_tree_2', 'nm_tree_1', 'nm_tree_4'], rockSpr: ['nm_rock_1', 'nm_rock_2', 'nm_tomb_2', 'nm_bones'], treeK: 0.95, rockK: 1.1, bushSpr: ['nm_bush', 'nm_shroom'], bushes: 10 },
  bog:       { tex: 'cursed', tint: 'rgba(30,80,60,0.25)', grass: '#34402e', grass2: '#1e2a1e', patch: ['#34402e', '#1e2a1e'], trees: 18, rocks: 8, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#56503e', '#9a9074', '#262014'], tuft: ['#3a5a30', '#5a7a3a'], stone: ['#5a665a', '#8a968a'], light: 'rgba(160,255,200,0.1)', amb: '170,255,140', flowers: 0,
    treeSpr: ['nm_tree_3', 'nm_tree_2', 'nm_tree_1'], rockSpr: ['nm_rock_2', 'nm_rock_1', 'nm_crow'], treeK: 0.9, rockK: 1.1, pondSpr: 'nm_pond', ponds: 5, bushSpr: ['nm_shroom', 'nm_bush'], bushes: 12 },
  graveyard: { tex: 'cursed', tint: 'rgba(40,30,60,0.22)', grass: '#3a3a38', grass2: '#222226', patch: ['#3a3a38', '#222226'], trees: 12, rocks: 30, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5a5450', '#a49a8e', '#2a2420'], tuft: ['#4a5236', '#646e44'], stone: ['#6e6e72', '#a0a0a6'], light: 'rgba(190,170,255,0.08)', amb: '200,180,255', flowers: 0,
    treeSpr: ['nm_tree_4', 'nm_tree_1', 'nm_tree_2'], rockSpr: ['nm_tomb_1', 'nm_tomb_2', 'nm_tomb_3', 'nm_bones', 'nm_fence', 'nm_tomb_1', 'nm_crow'], treeK: 0.95, rockK: 1.25, bushSpr: ['nm_shroom'], bushes: 8 },
  blacklake: { tex: 'cursed', tint: 'rgba(20,30,50,0.3)', grass: '#2e3434', grass2: '#181e22', patch: ['#2e3434', '#181e22'], trees: 16, rocks: 14, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#54504c', '#9c948a', '#24201c'], tuft: ['#3a4a3a', '#566a48'], stone: ['#5a6066', '#8a9298'], light: 'rgba(140,200,255,0.08)', amb: '160,220,255', flowers: 0,
    treeSpr: ['nm_tree_3', 'nm_tree_1', 'nm_tree_4'], rockSpr: ['nm_rock_1', 'nm_rock_2', 'nm_bones', 'nm_crow'], treeK: 0.9, rockK: 1.15, pondSpr: 'nm_pond', ponds: 7, bushSpr: ['nm_bush'], bushes: 8 },
  necrogate: { tex: 'cursed', tint: 'rgba(60,20,70,0.22)', grass: '#36302e', grass2: '#1e1a1c', patch: ['#36302e', '#1e1a1c'], trees: 20, rocks: 22, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5c5048', '#a8968a', '#2a201a'], tuft: ['#4a4a30', '#6a6a3a'], stone: ['#665e66', '#9a909a'], light: 'rgba(180,255,170,0.1)', amb: '170,255,150', flowers: 0,
    treeSpr: ['nm_tree_2', 'nm_tree_4', 'nm_tree_1', 'nm_tree_3'], rockSpr: ['nm_tomb_3', 'nm_tomb_1', 'nm_bones', 'nm_tomb_2', 'nm_fence'], treeK: 0.95, rockK: 1.2, bushSpr: ['nm_shroom', 'nm_bush'], bushes: 12 },
  // Sefer 2 (Cadı Avı): Kuzgun Ormanı, Veba Köyü, Batık Manastır, Kemik Katedrali, Kızıl Ay Tepesi.
  // ruinSpr/ruinK: yol dışındaki büyük yapılar (harabe yerleşimiyle), ruinN: kaç tane
  ravenwood: { tex: 'cursed', tint: 'rgba(30,20,40,0.28)', grass: '#30362a', grass2: '#1a1e16', patch: ['#30362a', '#1a1e16'], trees: 28, rocks: 10, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5a4c3e', '#9e8c76', '#2a2016'], tuft: ['#3a4a2a', '#56663a'], stone: ['#605e5a', '#908c84'], light: 'rgba(200,170,120,0.06)', amb: '160,200,140', flowers: 0,
    treeSpr: ['nm_tree_1', 'nm_tree_3', 'nm_tree_4', 'nm2_ravtree'], rockSpr: ['nm_rock_1', 'nm_rock_2', 'nm_bones', 'nm_crow', 'nm2_stake'], treeK: 0.95, rockK: 1.1, bushSpr: ['nm_bush', 'nm_shroom'], bushes: 8,
    ruinSpr: ['nm2_gallows', 'nm2_stake', 'nm2_ravtree'], ruinK: 0.2, ruinN: 3 },
  plague:    { tex: 'village', tint: 'rgba(40,30,20,0.15)', grass: '#4a3a2a', grass2: '#2a2018', patch: ['#4a3a2a', '#2a2018'], trees: 10, rocks: 14, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5e5446', '#a89a84', '#2c241a'], tuft: ['#4a4a2a', '#66663a'], stone: ['#6a645a', '#9c968a'], light: 'rgba(255,190,120,0.06)', amb: '220,200,150', flowers: 0,
    treeSpr: ['nm_tree_1', 'nm_tree_4', 'nm_tree_3'], rockSpr: ['nm2_qfence', 'nm_bones', 'nm_rock_2', 'nm2_stake', 'nm_crow'], treeK: 0.9, rockK: 1.15, bushSpr: ['nm_shroom'], bushes: 6,
    ruinSpr: ['nm2_cottage', 'nm2_well', 'nm2_cottage', 'nm2_gallows'], ruinK: 0.22, ruinN: 4, weather: 'rain' },
  monastery: { tex: 'marsh', tint: 'rgba(20,50,50,0.2)', grass: '#22322c', grass2: '#121c18', patch: ['#22322c', '#121c18'], trees: 12, rocks: 10, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5a564c', '#a29c8c', '#28241c'], tuft: ['#2a4a34', '#3a6a44'], stone: ['#5a6662', '#8a9692'], light: 'rgba(160,255,200,0.1)', amb: '170,255,190', flowers: 0,
    treeSpr: ['nm_tree_3', 'nm_tree_1', 'nm_tree_2'], rockSpr: ['nm_rock_1', 'nm_rock_2', 'nm_tomb_3', 'nm_crow'], treeK: 0.9, rockK: 1.1, bushSpr: ['nm_bush', 'nm_shroom'], bushes: 10,
    ruinSpr: ['nm_ruin_1', 'nm_ruin_4', 'nm_ruin_5', 'nm_ruin_2'], ruinN: 3 },
  ossuary:   { tex: 'bone', tint: 'rgba(40,20,50,0.25)', grass: '#3a3440', grass2: '#1e1a22', patch: ['#3a3440', '#1e1a22'], trees: 4, rocks: 26, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5c5450', '#a89e96', '#2a2420'], tuft: ['#4a4a40', '#5e5e50'], stone: ['#6a6270', '#9c94a2'], light: 'rgba(190,160,255,0.08)', amb: '200,180,255', flowers: 0,
    treeSpr: ['nm_tree_4', 'nm_tree_1'], rockSpr: ['nm_bones', 'nm_tomb_1', 'nm_tomb_2', 'nm_tomb_3', 'nm_bones', 'nm_rock_1'], treeK: 0.85, rockK: 1.2, bushSpr: ['nm_shroom'], bushes: 6,
    ruinSpr: ['nm_ruin_3', 'nm_ruin_5', 'nm_ruin_6', 'nm_ruin_2'], ruinN: 4 },
  bloodmoon: { tex: 'cursed', tint: 'rgba(110,10,20,0.26)', grass: '#3a2a26', grass2: '#1e1414', patch: ['#3a2a26', '#1e1414'], trees: 22, rocks: 16, treeCol: ['#2a2a26', '#3a3a34', '#4a4a40'], road: ['#5c4a44', '#a8908a', '#2a1c18'], tuft: ['#4a3a2a', '#6a4a3a'], stone: ['#665a5a', '#9a8a8a'], light: 'rgba(255,90,80,0.1)', amb: '255,140,130', flowers: 0,
    treeSpr: ['nm_tree_2', 'nm_tree_4', 'nm_tree_1', 'nm2_ravtree'], rockSpr: ['nm_tomb_1', 'nm_bones', 'nm2_stake', 'nm_tomb_3', 'nm_rock_1'], treeK: 0.95, rockK: 1.2, bushSpr: ['nm_shroom', 'nm_bush'], bushes: 10,
    ruinSpr: ['nm_ruin_1', 'nm2_gallows', 'nm_ruin_6', 'nm2_ravtree'], ruinK: 0.2, ruinN: 3 },
  rocky:  { grass: '#a3ad6e', grass2: '#7f8c52', patch: ['#a0a878', '#5f6a40'], trees: 12, rocks: 22, treeCol: ['#3a5a2a', '#4d7236', '#628a44'], road: ['#6a6058', '#b0a690', '#4a4239'], tuft: ['#6f7a40', '#8f9a55'], stone: ['#8d877c', '#bdb6a6'], light: 'rgba(255,214,150,0.18)' },
};

// Bölüm arka planının piksel yoğunluğu: en yakın zoomda ekran pikseline yetecek kadar (2x..4x).
function bgRes() {
  return clamp(Math.ceil(view.scale * view.dpr * ZOOM_MAX), 2, 4);
}
// Yol kenarı doğal dursun: iki kenar birbirinden bağımsız dalgalanır (uzun yumuşak kıvrım + kısa çıkıntılar);
// yol yer yer genişleyip daralır, hafifçe asimetrik olur. Fazlar yola özgüdür, her çizimde aynı çıkar.
function roadVary(p, d, side) {
  const f = p.vph || (p.vph = (() => { const r = seeded(Math.round(p.total * 7) + p.pts.length * 13); return [0, 1, 2, 3, 4, 5].map(() => r() * 6.283); })());
  const k = side > 0 ? 0 : 3;
  return 1 + 0.06 * Math.sin(d * 0.017 + f[k]) + 0.025 * Math.sin(d * 0.05 + f[k + 1]); // yumuşak: kısa tırtıklar yok
}
// w genişliğindeki yol şeridi: sol kenar ileri, sağ kenar geri izlenir (tüm şeritler aynı yönde döner,
// kavşaklarda üst üste binenler tek parça dolar); kale kapısında yuvarlak biter
function roadShape(g, paths, w) {
  g.beginPath();
  for (const p of paths) {
    const Lp = [], Rp = [];
    for (let d = 0; ; d = Math.min(p.total, d + 4)) {
      // kale kapısına yaklaşırken yol daralır ve kapının altında biter
      const tp = 0.4 + 0.6 * easeInOut(clamp((p.total - d) / 60, 0, 1));
      Lp.push(pathPos(p, d, -w / 2 * tp * roadVary(p, d, -1))); Rp.push(pathPos(p, d, w / 2 * tp * roadVary(p, d, 1)));
      if (d >= p.total) break;
    }
    g.moveTo(Lp[0].x, Lp[0].y); for (const q of Lp) g.lineTo(q.x, q.y);
    for (let i = Rp.length - 1; i >= 0; i--) g.lineTo(Rp[i].x, Rp[i].y);
    g.closePath();
    const e = pathPos(p, p.total), r = w / 2 * 0.4;
    g.moveTo(e.x + r, e.y); g.arc(e.x, e.y, r, 0, Math.PI * 2);
  }
}

// Yumuşatılmış yol maskesi (10 Eki): yol şekli düşük çözünürlükte çizilir, üç kat kutu bulanıklığıyla yayılır ve yeniden
// eşiklenir. Böylece kavşaklardaki ve keskin dönüşlerdeki sivri uçlar (içte ve dışta) yuvarlanır. Eşik, yavaş değişen bir
// gürültüyle oynatılır: kenar düzensiz, doğal kıvrılır (çizgi gibi değil). Eşik bandı yumuşak: kenar 2-3 px'te çimene karışır.
// Bütün yol katmanları aynı gürültüyü kullanır, iç içe kalırlar.
const ROAD_SMOOTH = { scale: 1, blur: 6, ramp: 0.08, noise: 0.14 };
let roadMaskCache = null, roadNoiseCache = null, roadTmp = null;
function roadNoise(w, h, S) {
  const n = new Float32Array(w * h), r = seeded(9137), ph = [0, 1, 2, 3, 4].map(() => r() * 6.283);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x / S, Y = y / S;
    n[y * w + x] = 0.45 * Math.sin(X * 0.061 + Y * 0.023 + ph[0]) + 0.3 * Math.sin(X * 0.117 - Y * 0.094 + ph[1])
      + 0.2 * Math.sin(-X * 0.19 + Y * 0.173 + ph[2]) + 0.12 * Math.sin(X * 0.31 + Y * 0.27 + ph[3]) + 0.08 * Math.sin(-X * 0.43 - Y * 0.39 + ph[4]);
  }
  return n;
}
function boxBlur(a, w, h, r) {
  const t = new Float32Array(a.length), k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { // yatay
      const o = y * w; let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { t[o + x] = sum * k; sum += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) { // dikey
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += t[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = sum * k; sum += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; }
    }
  }
  return a;
}
function roadMask(paths, w) {
  const key = Math.round(w * 10);
  const B = bgBox(), bk = B.w + 'x' + B.h;
  if (!roadMaskCache || roadMaskCache.paths !== paths || roadMaskCache.bk !== bk) roadMaskCache = { paths, bk, m: {} };
  if (roadMaskCache.m[key]) return roadMaskCache.m[key];
  const S = ROAD_SMOOTH.scale, cw = Math.ceil(B.w * S), ch = Math.ceil(B.h * S);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true }); g.scale(S, S); g.translate(-B.x, -B.y); g.fillStyle = '#000'; roadShape(g, paths, w); g.fill();
  const im = g.getImageData(0, 0, cw, ch), d = im.data, n = cw * ch, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = d[i * 4 + 3] / 255;
  boxBlur(a, cw, ch, Math.max(1, Math.round(ROAD_SMOOTH.blur * S)));
  if (!roadNoiseCache || roadNoiseCache.length !== n) roadNoiseCache = roadNoise(cw, ch, S); // gürültü bir kez hesaplanır
  const N = roadNoiseCache, R = ROAD_SMOOTH.ramp;
  for (let i = 0; i < n; i++) {
    const t = 0.5 + N[i] * ROAD_SMOOTH.noise, v = clamp((a[i] - t + R) / (2 * R), 0, 1);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; d[i * 4 + 3] = Math.round(v * v * (3 - 2 * v) * 255);
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(im, 0, 0);
  return (roadMaskCache.m[key] = c);
}
// düz renkli katmanlar maske çözünürlüğünde üst üste boyanır, sonra tek seferde büyütülür (her katmanı tam çözünürlükte
// ayrı maskelemek bölüm açılışını ~1 sn yavaşlatıyordu); kenarlar zaten yumuşak, büyütme fark edilmez
function roadLayers(paths, list) {
  const B = bgBox(), S = ROAD_SMOOTH.scale, cw = Math.ceil(B.w * S), ch = Math.ceil(B.h * S);
  const acc = document.createElement('canvas'); acc.width = cw; acc.height = ch;
  const a = acc.getContext('2d'), t = document.createElement('canvas'); t.width = cw; t.height = ch;
  const tg = t.getContext('2d');
  for (const [w, col] of list) {
    tg.globalCompositeOperation = 'copy'; tg.drawImage(roadMask(paths, w), 0, 0);
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, cw, ch);
    a.drawImage(t, 0, 0);
  }
  return acc;
}
// maskeli dolgu: col (renk ya da desen) yalnız yumuşatılmış yol şekline boyanır; g'nin o anki gölge/karışım ayarı korunur
function fillRoad(g, paths, w, col, res) {
  const B = bgBox(), m = roadMask(paths, w), t = roadTmp || (roadTmp = document.createElement('canvas')); // ara tuval yeniden kullanılır
  const tw = Math.round(B.w * res), th = Math.round(B.h * res);
  if (t.width !== tw || t.height !== th) { t.width = tw; t.height = th; }
  const tg = t.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'copy'; tg.drawImage(m, 0, 0, t.width, t.height);
  tg.globalCompositeOperation = 'source-in'; tg.scale(res, res); tg.translate(-B.x, -B.y); tg.fillStyle = col; tg.fillRect(B.x, B.y, B.w, B.h);
  g.drawImage(t, B.x, B.y, B.w, B.h);
}

// Yol yüzeyi ayrıntısı: ayrı katmanda çizilir, yol şekline kırpılıp zemine basılır.
// Tonal lekeler (dövülmüş toprak), çatlaklar ve yer yer gömülü yassı taş kümeleri.
// Kendi rastgele dizisini kullanır; ağaç/kaya yerleşimi değişmesin.
let bgRoadK = ROAD_K; // zemin çizilirken yol genişliği (bölge haritasında yol daha ince)
function drawRoadDetail(g, c, res, paths, th, rr, painted) {
  const R = bgRoadK;
  const B = bgBox(), det = document.createElement('canvas'); det.width = c.width; det.height = c.height;
  const d = det.getContext('2d'); d.scale(res, res); d.translate(-B.x, -B.y);
  const hex = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  for (const p of paths) {
    // tonal lekeler: koyu ezilmiş ve açık kurumuş bölgeler
    for (let s = 0; s < p.total; s += 7) {
      const q = pathPos(p, s, (rr() - 0.5) * 34 * R), dark = rr() < 0.55;
      d.fillStyle = dark ? hex(th.road[2], 0.05 + rr() * 0.07) : `rgba(255,244,214,${0.05 + rr() * 0.06})`;
      d.beginPath(); d.ellipse(q.x, q.y, 5 + rr() * 13, 3 + rr() * 7, rr() * 3, 0, Math.PI * 2); d.fill();
    }
    if (painted) continue; // boyalı dokuda çatlak ve taş zaten var; yalnız lekeler tekrarı kırar
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
  d.setTransform(1, 0, 0, 1, 0, 0); d.drawImage(roadMask(paths, 40 * R), 0, 0, det.width, det.height);
  g.drawImage(det, B.x, B.y, B.w, B.h);
}

const TREE_MUL = 2; // bölüm zeminindeki ağaç sayısı çarpanı (tema trees değerine)
const RUIN_K = 0.12; // harabe görsellerinin ölçeği (görsel pikseli -> dünya)
// Zemin taşma payı (tam ekran): renderBackground'a m verilirse zemin çerçevenin dışına m.x/m.y kadar taşar (yol, çimen,
// ağaçlar dahil). Yol maskeleri de bu kutuya göre çizilir (bgBox). Tuvalin payı c.m'de saklanır, çizen ona göre yerleştirir.
let BGM = { x: 0, y: 0 };
const bgBox = () => ({ x: -BGM.x, y: -BGM.y, w: W + 2 * BGM.x, h: H + 2 * BGM.y });
function renderBackground(lv, paths, res = 2, m = null) {
  BGM = m ? { x: m.x, y: m.y } : { x: 0, y: 0 };
  try { const c = renderBackground0(lv, paths, res); c.m = BGM; return c; } finally { BGM = { x: 0, y: 0 }; }
}
// çerçevenin dışından gelen yollar taşma payında da sürsün: giriş ucu dışarıdaki yollar ilk doğrultusunda geriye uzatılır
function extendEntry(p) {
  const a = p.pts[0], b = p.pts[1];
  if (a[0] >= 0 && a[0] <= W && a[1] >= 0 && a[1] <= H) return p; // haritanın içinden ayrılan kol
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ext = 2 * Math.max(BGM.x, BGM.y) + 80;
  const pts = [[a[0] - (b[0] - a[0]) / L * ext, a[1] - (b[1] - a[1]) / L * ext]].concat(p.pts);
  return { pts, cum: [0].concat(p.cum.map(c => c + ext)), total: p.total + ext };
}
function renderBackground0(lv, paths, res) {
  if (BGM.x || BGM.y) paths = paths.map(extendEntry);
  const B = bgBox(), c = document.createElement('canvas');
  c.width = Math.round(B.w * res); c.height = Math.round(B.h * res);
  const g = c.getContext('2d');
  g.scale(res, res); g.translate(-B.x, -B.y);
  const th = THEMES[lv.theme];
  const rnd = seeded(lv.name.length * 977 + lv.plots.length * 31);
  bgRoadK = lv.roadK || ROAD_K;

  const grd = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
  grd.addColorStop(0, th.grass); grd.addColorStop(1, th.grass2);
  g.fillStyle = grd; g.fillRect(B.x, B.y, B.w, B.h);
  const grassTex = spr('grass_' + (th.tex || lv.theme));
  if (grassTex) {
    const pat = g.createPattern(grassTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(0.5));
    g.fillStyle = pat; g.fillRect(B.x, B.y, B.w, B.h);
    g.globalAlpha = 0.42; g.fillStyle = grd; g.fillRect(B.x, B.y, B.w, B.h); g.globalAlpha = 1;
  }
  if (th.tint) { g.fillStyle = th.tint; g.fillRect(B.x, B.y, B.w, B.h); }
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
  // yol katmanları, kenarları doğal dalgalanan dolu şekiller olarak çizilir (roadShape)
  const strokePath = (w, col) => fillRoad(g, paths, w, col, res); // yumuşatılmış, doğal kenarlı yol katmanı
  const layers = (list) => g.drawImage(roadLayers(paths, list), B.x, B.y, B.w, B.h);
  const R = bgRoadK;
  g.save(); g.shadowColor = 'rgba(30,20,8,0.55)'; g.shadowBlur = 16; g.shadowOffsetY = 3;
  layers([[52 * R, th.road[2]]]); g.restore();
  layers([[56 * R, 'rgba(40,28,12,0.18)'], [50 * R, th.road[2]], [46 * R, th.road[0]]]);
  // Boyalı yol dokusu (Gemini): çölde taş döşemeli kum, diğer temalarda toprak. Yoksa eski üretilmiş doku.
  const desert = th.tex === 'desert';
  const painted = spr(th.roadTex || (desert ? 'road_sand' : 'road_dirt'));
  const roadTex = painted || spr('road');
  if (roadTex) {
    const pat = g.createPattern(roadTex, 'repeat');
    pat.setTransform(new DOMMatrix().scale(painted ? (desert ? 0.24 : 0.3) : 0.5));
    strokePath(42 * R, pat);
    if (painted) {
      // doku tonu temaya uyar: rengi temanın yol renginden, açıklık/ayrıntı dokudan gelir
      g.save(); g.globalCompositeOperation = 'color'; g.globalAlpha = desert ? 0.15 : 0.55;
      layers([[42 * R, th.road[1]]]); g.restore();
    } else if (th.roadTint) layers([[42 * R, th.roadTint]]); // çölde yol kum rengine boyanır
  } else layers([[42 * R, th.road[1]]]);
  // kenara doğru koyulaşan iç gölge: kenar yumuşak bir eğimle çimene karışır
  // (boyalı dokuda hafif tutulur, yoksa doku ayrıntısı soluklaşır)
  const lit = painted ? 0.35 : 1;
  layers([0, 1, 2, 3].map(k => [(42 - k * 6) * R, `rgba(255,240,205,${(0.035 + k * 0.012) * lit})`]).concat([[14 * R, `rgba(255,244,215,${0.08 * lit})`]]));
  // Kavşaklar: bir yolun kenar süsleri (taş, çimen tutamı) başka bir yolun üstüne düşmesin.
  // Ortak gövdede tekerlek izlerini yalnız ilk yol çizer, öbürü onun yüzeyine iz bırakmaz.
  // yolun kendi üstünden geçtiği yerler (aynı yolun uzak bir parçası) de kavşak sayılır
  const selfS = paths.map(p => { const a = []; for (let s = 0; s <= p.total; s += 4) a.push([s, pathPos(p, s)]); return a; });
  const onRoad = (p, x, y, onlyBefore, d) => {
    if (d != null) for (const [s, q] of selfS[paths.indexOf(p)]) if (Math.abs(s - d) > 90 && Math.hypot(q.x - x, q.y - y) < 27 * R) return true;
    for (const o of paths) {
      if (o === p) { if (onlyBefore) break; continue; }
      if (nearestOnPaths([o], x, y).d < 27 * R) return true; // öbür yolun koyu kenarı ve dalgası dahil
    }
    return false;
  };
  drawRoadDetail(g, c, res, paths, th, seeded(lv.name.length * 131 + lv.plots.length * 7), !!painted);
  // çakıllar ve kenar taşları
  for (const p of paths) {
    for (let d = 0; d < p.total; d += 7) {
      const q = pathPos(p, d, (rnd() - 0.5) * 36 * R);
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,60,30,0.22)' : 'rgba(255,240,200,0.22)';
      g.beginPath(); g.arc(q.x, q.y, 0.8 + rnd() * 1.6, 0, Math.PI * 2); g.fill();
    }
    for (let d = 0; d < p.total; d += 16 + rnd() * 30) {
      const side = rnd() < 0.5 ? -1 : 1, q = pathPos(p, d, side * (22 * R * roadVary(p, d, side) + rnd() * 3)), r = 1.8 + rnd() * 2.4;
      if (onRoad(p, q.x, q.y, false, d)) { rnd(); continue; } // rastgele dizi kaymasın diye aynı sayıda çekilir
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(q.x + 1, q.y + 1.2, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone[0]; g.beginPath(); g.ellipse(q.x, q.y, r * 1.2, r * 0.85, rnd(), 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone[1]; g.beginPath(); g.ellipse(q.x - r * 0.3, q.y - r * 0.3, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // yol kenarı (doğal): kenar boyunca yoğunluğu dalgalanan ot öbekleri — yer yer gür ve yola taşan, yer yer seyrek,
  // aralarda çıplak toprak ve ufalanmış kenar; öbeklerin boyu, yaprak sayısı ve eğimi hep farklı.
  const tc = (h, k) => { const n = parseInt(h.slice(1), 16), f = (v) => Math.round(clamp(v * k, 0, 255)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const clumps = [], crumbs = [];
  for (const p of paths) {
    const ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
    for (const side of [-1, 1]) {
      const o = side > 0 ? 0 : 2;
      for (let d = 2 + rnd() * 4; d < p.total - 6;) {
        // yoğunluk 0..1: uzun ve kısa iki dalganın toplamı (gür kuşaklar, seyrek boşluklar)
        const dens = clamp(0.55 + 0.4 * Math.sin(d * 0.021 + ph[o]) + 0.3 * Math.sin(d * 0.067 + ph[o + 1]), 0, 1);
        d += 3 + (1 - dens) * 12 + rnd() * 5;
        const e = 20.6 * R * roadVary(p, d, side), q0 = pathPos(p, d, side * e);
        if (onRoad(p, q0.x, q0.y, false, d)) continue;
        if (rnd() > 0.4 + dens * 0.6) { // boşluk: çıplak kenarda ufalanmış toprak ve çakıl
          if (rnd() < 0.6) crumbs.push(pathPos(p, d, side * (e - 2 - rnd() * 4)));
          continue;
        }
        const big = dens > 0.7 && rnd() < 0.5, inset = big ? 2 + rnd() * 4 : rnd() * 3 - 1; // gür yerde ot yola taşar
        const q = pathPos(p, d, side * (e - inset)), out = pathPos(p, d, side * (e + 4));
        clumps.push([q.x, q.y, (big ? 0.95 : 0.55) + rnd() * 0.5, rnd(), Math.atan2(out.y - q.y, out.x - q.x), 3 + Math.floor(rnd() * (big ? 5 : 3))]);
        if (big && rnd() < 0.6) { const q2 = pathPos(p, d + 2, side * (e + 3 + rnd() * 4)); clumps.push([q2.x, q2.y, 0.6 + rnd() * 0.5, rnd(), Math.atan2(out.y - q.y, out.x - q.x), 3 + Math.floor(rnd() * 3)]); }
      }
    }
  }
  // ufalanmış kenar: toprak rengi küçük topaklar, gölgeli
  for (const q of crumbs) {
    const r = 1 + rnd() * 1.6;
    g.fillStyle = 'rgba(20,14,6,0.3)'; g.beginPath(); g.ellipse(q.x + 0.6, q.y + 0.8, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rnd() < 0.5 ? th.road[2] : th.stone[0]; g.beginPath(); g.ellipse(q.x, q.y, r * 1.2, r * 0.85, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  // öbek gölgeleri yola düşer (önce hepsi), sonra öbekler yukarıdan aşağı sırayla (önde olan arkadakini örter)
  for (const [x, y, s] of clumps) { g.fillStyle = 'rgba(25,18,8,0.2)'; g.beginPath(); g.ellipse(x + 1, y + 1.8 * s, 6 * s, 2.2 * s, 0, 0, Math.PI * 2); g.fill(); }
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s, ph, out, nb] of clumps) {
    const lean = Math.cos(out) * 0.45, tone = 0.8 + ph * 0.35;
    const dark = tc(th.tuft[0], 0.62 * tone), mid = tc(th.tuft[0], tone), light = tc(th.tuft[1], tone), tip = tc(th.tuft[1], 1.2 * tone);
    for (let k = 0; k < nb; k++) {
      const u = nb > 1 ? k / (nb - 1) - 0.5 : 0, j = Math.sin(ph * 40 + k * 2.7);
      const a = -Math.PI / 2 + u * 1.5 + lean + j * 0.22, len = (4.5 + 3.5 * Math.abs(Math.sin(ph * 17 + k * 1.9))) * s * (1 - Math.abs(u) * 0.35);
      const bx = x + u * 6 * s, tx = bx + Math.cos(a) * len, ty = y + Math.sin(a) * len, wd = (1.1 + 0.5 * Math.abs(j)) * s;
      const nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd, bend = j * 1.6 * s;
      const gr = g.createLinearGradient(bx, y, tx, ty); gr.addColorStop(0, dark); gr.addColorStop(0.5, k % 2 ? mid : light); gr.addColorStop(1, tip);
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx - nx, y - ny);
      g.quadraticCurveTo(bx + Math.cos(a) * len * 0.55 - nx * 0.4 + bend, y + Math.sin(a) * len * 0.55 - ny * 0.4, tx + bend * 0.6, ty);
      g.quadraticCurveTo(bx + Math.cos(a) * len * 0.55 + nx * 0.4 + bend, y + Math.sin(a) * len * 0.55 + ny * 0.4, bx + nx, y + ny);
      g.closePath(); g.fill();
    }
  }

  const blocked = (x, y, pad) => {
    if (nearestOnPaths(paths, x, y).d < 40 + 23 * (R - 1) + pad) return true; // dalgalı kenar payı dahil
    for (const pl of lv.plots) if (dist(x, y, pl[0], pl[1]) < 38 + pad) return true;
    for (const hq of hatchSpots(lv, paths)) if (dist(x, y, hq[0], hq[1]) < 30 + pad) return true;
    if (y < 52 && (x < 300 || x > 860)) return true;
    if (y > 465 && x < 230) return true;
    if (Math.abs(x - lv.castle[0]) < 75 + pad && y > lv.castle[1] - 170 && y < lv.castle[1] + 38 + pad) return true;
    return false;
  };
  // vaha gölleri ve çalılar (yerde, gölgesiz)
  const DK = lv.decorK || 1; // dekor yoğunluğu (bölge haritası daha dolu)
  for (let i = 0, n = 0; i < 300 * DK && n < (th.ponds || 0) * DK; i++) {
    const x = 90 + rnd() * (W - 180), y = 90 + rnd() * (H - 180), im = spr(th.pondSpr || 's2_pond_2');
    if (blocked(x, y, 34) || !im) continue;
    n++;
    drawSprite(g, im, x, y, 60 + rnd() * 30, 0.5);
    for (let k = 0; k < 4; k++) { const b = spr(th.bushSpr ? th.bushSpr[k % th.bushSpr.length] : 's2_bush_' + (1 + (k % 2))); if (b) drawSprite(g, b, x + (rnd() - 0.5) * 80, y + 18 + rnd() * 10, 16 + rnd() * 8); }
  }
  for (let i = 0, n = 0; i < 400 * DK && n < (th.bushes || 0) * DK; i++) {
    const x = rnd() * W, y = rnd() * H, b = spr(th.bushSpr ? th.bushSpr[i % th.bushSpr.length] : 's2_bush_' + (1 + (i % 2)));
    if (blocked(x, y, 6) || !b) continue;
    n++; drawSprite(g, b, x, y + 4, 12 + rnd() * 10);
  }
  // kayalar
  for (let i = 0, n = 0; i < 400 * DK && n < th.rocks * DK; i++) {
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
  // bölümde yol dışı boş kalmasın: tema sayısının ~2 katı ağaç, yarısı küçük kümeler halinde (koru gibi)
  // harabeler (yıkık kilise duvarı, kırık sütunlar, mahzen girişi... nm_ruin_*) ve mezarlık kümeleri: yol dışındaki boşluklara,
  // ağaçlardan önce yerleşir (ağaçlar bunlara binmez)
  const props = [];
  if (NECRO && !lv.decorK) {
    const ruins = (th.ruinSpr || [1, 2, 3, 4, 5, 6].map(n => 'nm_ruin_' + n)).filter(n => spr(n));
    const nR = ruins.length ? th.ruinN || (th === THEMES.graveyard || th === THEMES.necrogate ? 3 : 2) : 0, nG = th === THEMES.graveyard ? 5 : 3;
    const place = (pad) => { for (let k = 0; k < 300; k++) { const x = 40 + rnd() * (W - 80), y = 90 + rnd() * (H - 130); if (!blocked(x, y, pad) && !props.some(o => Math.hypot(o[0] - x, o[1] - y) < pad + o[2])) return [x, y]; } return null; };
    for (let i = 0; i < nR; i++) {
      const name = ruins[(i + Math.floor(rnd() * 9)) % ruins.length], im = spr(name), M = SPR_META[name] || [300, 300];
      const w = M[0] * (name.startsWith('nm_ruin') ? RUIN_K : th.ruinK || RUIN_K) * (0.85 + rnd() * 0.3), h = w * M[1] / M[0];
      // görsel ayak noktasından yukarı uzar: gövdesinin üst ve yan noktaları da yola/arsaya binmesin
      let q = null;
      for (let k = 0; k < 40 && !q; k++) {
        const c = place(w * 0.42); if (!c) break;
        if (![[0, -h * 0.5], [0, -h * 0.85], [-w * 0.4, -h * 0.3], [w * 0.4, -h * 0.3]].some(([dx, dy]) => blocked(c[0] + dx, c[1] + dy, 14))) q = c;
      }
      if (!q) continue;
      props.push([q[0], q[1], w * 0.45], [q[0], q[1] - h * 0.5, w * 0.4]);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(q[0] + 4, q[1] + 2, w * 0.45, w * 0.12, 0, 0, Math.PI * 2); g.fill();
      drawSprite(g, im, q[0], q[1] + 4, w);
    }
    const tombs = ['nm_tomb_1', 'nm_tomb_2', 'nm_tomb_3'].filter(n => spr(n));
    for (let i = 0; tombs.length && i < nG; i++) {
      const q = place(34); if (!q) continue;
      props.push([q[0], q[1], 30]);
      const graves = [], n = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) graves.push([q[0] + (j % 3 - 1) * 17 + (rnd() - 0.5) * 5, q[1] + Math.floor(j / 3) * 13 + (rnd() - 0.5) * 4]);
      graves.sort((a, b) => a[1] - b[1]);
      for (const [x, y] of graves) {
        const im = spr(tombs[Math.floor(rnd() * tombs.length)]), w = 13 + rnd() * 5;
        g.fillStyle = 'rgba(52,36,22,0.75)'; g.beginPath(); g.ellipse(x, y + 4, w * 0.5, w * 0.2, 0, 0, Math.PI * 2); g.fill(); // toprak höyüğü
        g.fillStyle = 'rgba(90,66,40,0.5)'; g.beginPath(); g.ellipse(x - 1, y + 3, w * 0.4, w * 0.12, 0, 0, Math.PI * 2); g.fill();
        drawSprite(g, im, x, y + 1, w);
        if (rnd() < 0.25) { g.fillStyle = '#e8e0c8'; g.fillRect(x + w * 0.35, y - 2, 1.6, 4); g.fillStyle = 'rgba(140,255,150,0.8)'; g.beginPath(); g.ellipse(x + w * 0.35 + 0.8, y - 3.5, 1.2, 2, 0, 0, Math.PI * 2); g.fill(); } // yeşil alevli mum
      }
    }
  }
  const trees = [], TN = th.trees * DK * (lv.decorK ? 1 : TREE_MUL);
  const treeOk = (x, y, s) => x > -10 && x < W + 10 && y > 20 && y < H + 10 && !blocked(x, y, s) && !trees.some(t => Math.hypot(t[0] - x, (t[1] - y) * 1.5) < 18) && !props.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + 12);
  for (let i = 0; i < 3000 * DK && trees.length < TN; i++) {
    const x = rnd() * W, y = rnd() * H, s = 10 + rnd() * 9;
    if (!treeOk(x, y, s)) continue;
    trees.push([x, y, s]);
    if (rnd() < 0.5) for (let k = 0, n = 1 + Math.floor(rnd() * 2); k < n; k++) {
      const a = rnd() * 6.283, r = 22 + rnd() * 18, x2 = x + Math.cos(a) * r, y2 = y + Math.sin(a) * r * 0.6, s2 = 9 + rnd() * 8;
      if (treeOk(x2, y2, s2)) trees.push([x2, y2, s2]);
    }
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of trees) {
    let treeName = th.treeSpr ? th.treeSpr[Math.floor(x * 7 + y * 13) % th.treeSpr.length] : 'tree_' + (1 + Math.floor((x * 7 + y * 13) % 3));
    // fenerli ağaç (nm_tree_2) çok sık çıkıyordu: yarısı fenersiz ağaca döner (konuma bağlı, rastgele dizi kaymaz)
    if (treeName === 'nm_tree_2' && Math.floor(x * 3 + y * 5) % 2) { const alt = th.treeSpr.filter(n => n !== 'nm_tree_2'); if (alt.length) treeName = alt[Math.floor(x + y) % alt.length]; }
    const treeIm = spr(treeName);
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
  g.fillStyle = sun; g.fillRect(B.x, B.y, B.w, B.h);
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.66);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(10,15,5,0.38)');
  g.fillStyle = vig; g.fillRect(B.x, B.y, B.w, B.h);
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
// seçili kahraman (savaşa tek kahraman gider; kahramanlar ekranından ya da ayarlardan seçilir)
function team() {
  const t = (save.team || ['commander']).filter(id => HEROES[id] && HERO_ORDER.includes(id) && heroUnlocked(id)).slice(0, 1);
  return t.length ? t : ['commander'];
}

// Meydan okuma (bölümde 3 yıldızdan sonra): 'h' Kahramanlık (aynı dalgalar, düşman canı +%20, 3 can). 1 ek yıldız (save.ch).
const CHAL = {
  h: { name: 'KAHRAMANLIK', short: 'Kahramanlık', hp: 1.2, lives: 3, desc: '3 can · düşmanlar %20 daha dayanıklı' },
  // Sonsuz: bölümün dalgaları döngüyle sonsuza dek gelir, her turda daha kalabalık ve dayanıklı; skor = dayanılan dalga
  e: { name: 'SONSUZ GECE', short: 'Sonsuz', hp: 1, lives: 20, endless: true, desc: 'Dalgalar bitmez, her turda güçlenir · rekorunu kır' },
  // Günün meydan okuması: her gün tarihe göre seçilen bölüm + bir zorlaştırıcı (DAILY_MODS)
  d: { name: 'GÜNÜN SINAVI', short: 'Günlük', hp: 1, lives: 20, daily: true },
};
// sonsuz mod: dalga k, bölümün (k mod N). dalgasından kopyalanır; her tur (N dalga) +%18 can, +%12 kalabalık
const ENDLESS = { hp: 0.18, n: 0.12 };
function endlessExtend() {
  if (!G || !G.endless) return;
  const base = G.baseWaves, N = base.length;
  while (G.lv.waves.length < G.wave + 2) {
    const k = G.lv.waves.length, cyc = Math.floor(k / N), w = JSON.parse(JSON.stringify(base[k % N]));
    for (const g of w) {
      g.hpK = (g.hpK || 1) * (1 + ENDLESS.hp * cyc);
      if (!ENEMIES[g.t] || !ENEMIES[g.t].chief) g.n = Math.max(1, Math.round(g.n * (1 + ENDLESS.n * cyc)));
      if (g.types) { const T = g.types; g.types = Array.from({ length: g.n }, (_, j) => T[j % T.length]); } // karışık bölük: tür sırası uzar
    }
    G.lv.waves.push(w);
  }
}
// günün sınavı: tarihten tohumlanan bölüm (açılmış olanlardan) ve zorlaştırıcı
const DAILY_MODS = [
  { id: 'fast', name: 'Hızlı Lejyon', desc: 'Düşmanlar %30 hızlı', speed: 1.3 },
  { id: 'tough', name: 'Demir Deri', desc: 'Düşmanlar %35 dayanıklı', hp: 1.35 },
  { id: 'poor', name: 'Kıtlık', desc: 'Başlangıç altını %40 az', gold: 0.6 },
  { id: 'nospell', name: 'Büyüsüz Gece', desc: 'Mortimer büyü yapamaz', nospell: true },
];
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
function dailyPick() {
  const key = todayKey(); let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const open = LEVELS.map((_, i) => i).filter(i => (save.stars[i] || 0) > 0);
  const pool = open.length ? open : [0];
  return { key, idx: pool[h % pool.length], mod: DAILY_MODS[(h >> 4) % DAILY_MODS.length] };
}
function chalStars() { let n = 0; for (const k in save.ch || {}) n += save.ch[k].h ? 1 : 0; return n; }
function startLevel(idx, chal = null) {
  mapSel = null; musicRestartBattle();
  const lv = LEVELS[idx];
  const paths = lv.paths.map(buildPath);
  for (const p of paths) { const a = p.pts[0]; p.ext = a[0] < 0 || a[0] > W || a[1] < 0 || a[1] > H; } // çerçeve dışından gelen giriş
  G = {
    idx, lv, paths,
    bg: renderBackground(lv, paths, bgRes(), BLEED),
    gold: (Math.round(lv.gold * diff().gold) + (upgRank('castle') >= 2 ? 60 : 0) + (upgRank('castle') >= 3 ? 60 : 0)),
    lives: chal ? CHAL[chal].lives : diff().lives - (lv.ep === 2 ? 5 : 0) + (upgRank('castle') >= 1 ? 3 : 0) + (upgRank('castle') >= 3 ? 3 : 0),
    maxLives: chal ? CHAL[chal].lives : diff().lives - (lv.ep === 2 ? 5 : 0) + (upgRank('castle') >= 1 ? 3 : 0) + (upgRank('castle') >= 3 ? 3 : 0),
    chal,
    wave: 0, waveCountdown: null, waveCountdownMax: 1, spawners: [],
    enemies: [], towers: [], soldiers: [], projectiles: [], effects: [], floaters: [], dmgNums: [],
    parts: [], decals: [], zones: [], coins: [], traps: [], shakeT: 0, shakeAmp: 0, shakeDur: 1, ambT: 0,
    plots: lv.plots.map(([x, y]) => ({ x, y, tower: null })),
    hatches: hatchSpots(lv, paths).map(([x, y, rx, ry]) => ({ x, y, rx, ry, state: 'closed', sealT: 0, ghoul: null })),
    heroes: [],
    spells: {}, mercT: null,
    sel: null, preview: null, mode: null, menuT: 0, menuClose: null, waveBtn: {},
    musicOn: !NECRO, ghosts: [], stars: 0, t: 0, starFx: 0, stats: { by: {}, raised: 0, spells: 0 },
    castle: { x: lv.castle[0], y: lv.castle[1], shake: 0, flash: 0, smokeT: 0, lvl: 0, archers: [] },
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
    G.spells['ult' + i] = 0;
    if (NECRO) { G.spells.nm_raise = 0; G.spells.nm_fear = 0; G.spells.nm_wall = 0; G.spells.nm_burst = 0; G.spells.nm_golem = 0; }
  });
  // bölümde görünecek karakterlerin kol kesimleri her karede bir tane hazırlanır (ilk görünüşte takılma olmasın)
  const types = new Set();
  lv.waves.forEach(w => w.forEach(g => { types.add(g.t); (g.types || []).forEach(t => types.add(t)); (BOSS_ESCORT[g.t] || []).forEach(([t]) => types.add(t)); }));
  [...types].forEach(t => { const d = ENEMIES[t]; if (d && d.split) types.add(d.split[0]); if (d && d.ab && d.ab.summon) types.add(d.ab.summon.t); });
  const keep = new Set(), SUF = ['_walk', '_walk_on', '_walk_arka', '_atk', '_atk2', '_atk3', '_skill', '_die'];
  types.forEach(t => { const d = ENEMIES[t]; if (!d) return; SUF.forEach(sf => { keep.add('enemy_' + t + sf); if (d.base) keep.add('enemy_' + d.base + sf); }); });
  for (let i = 1; i <= 8; i++) SUF.forEach(sf => keep.add('unit_skel_' + i + sf));
  for (const b of ['unit_bonegiant', 'unit_corpsegolem', 'unit_gulyabani']) SUF.forEach(sf => keep.add(b + sf)); // iri birimler
  for (const id of team()) if (HEROES[id] && HEROES[id].sprite) SUF.forEach(sf => keep.add(HEROES[id].sprite + sf)); // komutan şeritleri
  for (const k in MEN) keep.add(MEN[k].pre + '_walk'); // kuledeki iskeletlerin yürüyüşü
  useStrips(keep);
  G.bakeQ = [...types].map(t => 'e:' + t).concat(team().map(id => 'h:' + id));
  setupMech();
  setupProps();
  setupHeralds();
  setupGate();
  G.tut = NECRO && idx === 0 && !save.tutDone ? { i: 0, t: 0, on: false } : null;
  // yeni büyü açıldıysa ilk bölümde duyurulur
  if (G.hatches.length && !save.hatchSeen) {
    save.hatchSeen = true; persist();
    G.banner = { title: 'YENİ: MAHZEN KAPAĞI', sub: `Kapağa dokun: ${HATCH.cost} altına gulyabani çıkar, yolu tutar. Meşaleciler kapağı mühürler!`, t: 0, dur: 5 };
  } else if (NECRO && necroSpellOn('nm_golem') && !save.golemSeen) {
    save.golemSeen = true; persist();
    G.banner = { title: 'YENİ BÜYÜ: ' + NECRO_SPELLS.nm_golem.name, sub: NECRO_SPELLS.nm_golem.short, t: 0, dur: 4.2 };
  } else if (NECRO && necroSpellOn('nm_burst') && !save.burstSeen) {
    save.burstSeen = true; persist();
    G.banner = { title: 'YENİ BÜYÜ: ' + NECRO_SPELLS.nm_burst.name, sub: NECRO_SPELLS.nm_burst.short, t: 0, dur: 4.2 };
  }
  if (chal === 'e') { G.endless = true; G.baseWaves = lv.waves; G.lv = Object.assign({}, lv, { waves: lv.waves.map(w => JSON.parse(JSON.stringify(w))) }); endlessExtend(); }
  if (chal === 'd') { // günün sınavı: zorlaştırıcı
    const D = dailyPick(); G.daily = D; G.mod = D.mod;
    if (D.mod.gold) G.gold = Math.round(G.gold * D.mod.gold);
    G.banner = { title: 'GÜNÜN SINAVI: ' + D.mod.name, sub: D.mod.desc, t: 0, dur: 4 };
  }
  screen = 'play'; setOverlay(null); paused = false; speed = 1; screenT = time;
  // hikâye panelleri: bölge girişi (1. bölüm) ya da bu bölümün bossu ilk kez geliyorsa, bir kez
  if (NECRO) {
    const seen = (save.comics || {}), key = idx === 0 ? 'intro' : lv.ep === 2 && idx === LEVELS.findIndex(l => l.ep === 2) ? 'intro2' : lv.comic && COMICS[lv.comic] && !seen[lv.comic] ? lv.comic : lv.boss;
    if (COMICS[key] && !seen[key]) startComic(key);
  }
}
function bakeNext() {
  const k = G.bakeQ.shift();
  let name, rigName, im;
  if (k[0] === 'e') {
    const t = k.slice(2), d = ENEMIES[t]; if (!d) return; name = 'enemy_' + t; rigName = d.base ? 'enemy_' + d.base : name; im = d.base ? enemySprite(t) : spr(name);
    if (d.base && ['_walk', '_atk'].some(sf => STRIP_WAIT.has(rigName + sf))) { G.bakeQ.push(k); return; } // şerit inince boyansın
    if (d.base) for (const sf of ['_walk', '_walk_on', '_walk_arka', '_atk']) animStrip(name, rigName, sf);
  }
  else { const d = HEROES[k.slice(2)]; if (!d) return; name = rigName = d.sprite; im = heroSprite(d); }
  const arms = im && armsOf(name, rigName, im);
  if (!arms) return;
  cutImage(im, arms); cutImage(whiteOf(name, im), arms);
}

function setOverlay(o) {
  if (o === overlay) return;
  overlay = o; overlayT = time;
  press.key = null;
  if (G) { G.starFx = 0; if (o) setSel(null); }
  if (o === 'win' && NECRO) {
    // necro zaferi: konfeti yerine yukarı süzülen yeşil-mor ruh kıvılcımları ve dökülen kemik kırıntıları
    for (let i = 0; i < 70; i++) emit(uiParts, { kind: 'glow', add: true, x: rand(0, W), y: rand(H * 0.4, H + 40), vx: rand(-12, 12), vy: -rand(25, 70),
      drag: 0.2, col: i % 3 ? '120,255,140' : '180,120,255', s0: rand(3, 6), s1: 0.5, life: rand(2.5, 4.5) });
    const bone = ['#efe8d2', '#cbbf9c', '#a89c7c'];
    for (let i = 0; i < 40; i++) emit(uiParts, { kind: 'chunk', x: rand(0, W), y: rand(-200, -10), vx: rand(-20, 20), vy: rand(30, 90),
      g: 50, drag: 0.5, vr: rand(-6, 6), rot: rand(0, 6), col: bone[i % 3], s0: rand(4, 7), s1: 3, life: rand(3.5, 5) });
  } else if (o === 'win') {
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
const WAVE_REST = 20; // iki dalga arası dinlenme (sn); oyuncu dalgayı erken çağırıp altın kazanabilir
function waveBonusAndStart() {
  endlessExtend();
  if (!G || G.wave >= G.lv.waves.length) return;
  G.wavePeek = null;
  const bonus = earlyBonus();
  if (bonus > 0) {
    const b = waveButtonPos(nextWavePaths()[0] || 0);
    dropCoins(b.x, b.y, bonus, true);
    floatText(b.x, b.y - 34, `Erken çağrı +${bonus}`, '#ffd34d');
  }
  const def = G.lv.waves[G.wave];
  // ilk dalga: önce borazancı gelir, çalar, döner; düşmanlar sonra
  const wait = G.wave === 0 && NECRO ? (callHeralds(nextWavePaths()), heraldT(false)) : 0;
  G.cryAt = G.t + wait + 2.2; // dalganın ilk sırası görününce çığlık
  repairGate(); // Mortimer her dalgada kapıyı onarır
  let lastSpawn = 0;
  G.waveN = def.reduce((a, grp) => a + grp.n, 0); // dalganın asker sayısı (erken çağrı eşiği için)
  for (const grp of def) {
    G.spawners.push({ t: grp.t, types: grp.types, pack: grp.pack, hpK: grp.hpK, left: grp.n, n: grp.n, gap: grp.gap, timer: (grp.at || 0) + wait, p: grp.p || 0 });
    lastSpawn = Math.max(lastSpawn, (grp.at || 0) + wait + grp.gap * (grp.n - 1));
  }
  if (!G.endless && bloodWaves(G.lv).includes(G.wave)) startBloodMoon();
  G.wave++; G.wavePop = time; G.wLives = G.lives;
  sfx('wave');
  if (G.wave === G.lv.waves.length && G.wave > 1) mortSay('last', true); else if (G.wave > 1 && Math.random() < 0.6) mortSay('wave');
  if (G.wave === G.lv.waves.length && G.wave > 1) {
    // son dalga: kırmızı duyuru, ekran kenarı kızarır, kısa sarsıntı
    G.banner = { title: 'SON DALGA!', sub: NECRO ? 'En kalabalık dalga geliyor. Şapeli tut!' : 'En kalabalık dalga geliyor. Kaleyi tut!', t: 0, dur: 3.6, red: true };
    G.finalT = 0; G.hurt = Math.max(G.hurt, 0.5);
    shakeScreen(4, 0.5); setTimeout(() => { if (actx && !muted) waveSound(); }, 450);
  }
  if (G.wave < G.lv.waves.length) {
    G.waveCountdown = WAVE_REST; // sayaç, dalganın tamamı sahaya çıkıp düşmanlar temizlenince işler (updateWaveTimer)
    G.waveCountdownMax = G.waveCountdown;
  } else {
    G.waveCountdown = null;
  }
}

// hizalı yürüyüş: piyade 3'lü, atlı 2'li sıra; uçan, makine, boss, dizilişli ve iskelete takılmayanlar serbest.
// 10 Eki: Caner yan yana sıraları istemedi; kapalı (askerler eskisi gibi yolda karışık, tek tek gelir)
const MARCH_ON = false;
function marchRow(D, sp) {
  if (!MARCH_ON || !D || D.flying || D.machine || D.chief || D.noblock || D.formation) return 0;
  return D.r >= 13 ? 2 : 3;
}
// savaş çığlığı: dalga başında ve ilk göğüs göğüse çarpışmada (sık değil); sessiz, yalnız yazı balonu
const SHOUTS = ['Sol Invictus!', 'Hücum!', 'İleri!', 'Kalkanlar!', 'Güneş için!', 'Saf tutun!', 'Ölüme, ileri!'];
function warCry(e, text = true) {
  if (!e || e.dead || MUTE_VOICE(e) || e.def.flying) return;
  if (text) floatText(e.x, e.y - (CHAR_H['enemy_' + e.type] || 24) - 10, SHOUTS[Math.floor(Math.random() * SHOUTS.length)], '#ffe2b0');
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
  if (type === 'lantern' && !G.saidLight) { G.saidLight = true; setTimeout(() => G && mortSay('light', true), 2500); }
  const p = G.paths[pi] || G.paths[0];
  const esc = def.chief && BOSS_ESCORT[type];
  if (esc && d0 <= 0) d0 += 18; // muhafızların arkada da yer bulması için boss biraz ileriden başlar
  const off = off0 ?? (def.boss ? 0 : rand(-11, 11) * ROAD_K);
  const q = pathPos(p, d0, off);
  const tier = G.lv.tier ?? G.idx; // boss gücü kademesi (2. sefer 1. seferin sonlarından başlar)
  const hp = (def.chief ? (650 + 400 * tier) * (def.hpK || 1) : def.hp * (G.lv.hpMul || 1) * diff().hp) * (G.chal ? CHAL[G.chal].hp : 1) * (G.mod && G.mod.hp || 1);
  const e = { type, def, p, d: d0, off, x: q.x, y: q.y, hp, maxHp: hp, blocker: null, atk: 0, dead: false, anim: rand(0, 10), face: 1, healT: 3 };
  G.enemies.push(e);
  if (type === 'elephant') sfx('elephant'); else if (type === 'vulture' && Math.random() < 0.4) sfx('vulture');
  if (def.chief) { e.dmgMul = 1 + 0.08 * tier; e.cdMul = 1 - 0.025 * tier; } // boss gücü bölümle artar: hasar ve yetenek sıklığı
  if (def.plate) { e.plate = e.maxPlate = def.plate; e.spdMul = 1; }
  if (esc) {
    let k = 0;
    for (const [t2, n] of esc) for (let i = 0; i < n; i++, k++) {
      const [fd, fo] = ESCORT_FORM[k % ESCORT_FORM.length];
      const m = spawnEnemy(t2, G.paths.indexOf(p), Math.max(dLo(p), d0 + fd + (k >= ESCORT_FORM.length ? -30 : 0)), fo);
      m.leader = e; m.form = fd + (k >= ESCORT_FORM.length ? -30 : 0);
    }
  }
  codexNote(type);
  if (type === 'ram' && !G.saidRam) { G.saidRam = true; setTimeout(() => mortSay('ram', true), 1200); }
  if (def.chief) bossIntro(e);
  else {
    // (v2: zayıflık/direnç bilgisiyle her düşman kartı bir kez daha gösterilir)
    save.seenEnemies2 = save.seenEnemies2 || [];
    // rütbeli türler tür başına değil, rütbe başına bir kez tanıtılır (ilk kıdemli, ilk yüzbaşı)
    const key = def.rank ? 'rank' + def.rank : type;
    if (!save.seenEnemies2.includes(key)) {
      save.seenEnemies2.push(key); persist();
      if (!G.intro) G.intro = { type, t: 0, dur: 4.5, rank: def.rank };
      if (def.rank) mortSay(def.rank === 2 ? 'captain' : 'veteran', true);
    }
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
// Sis öbeği dokusu: üst üste binmiş yumuşak lekeler (düzensiz kenarlı bulut); 3 çeşit, renk başına önbellekli
const FOG_TEX = {};
function fogTex(col, v) {
  const key = col + '|' + v;
  if (!FOG_TEX[key]) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d'), r = seeded(17 + v * 31);
    for (let i = 0; i < 9; i++) {
      const x = 24 + r() * 80, y = 26 + r() * 14, R = 12 + r() * 16, gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${col},0.55)`); gr.addColorStop(0.5, `rgba(${col},0.25)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    }
    FOG_TEX[key] = c;
  }
  return FOG_TEX[key];
}
// Kulenin ayağında dönerek süzülen sis (Caner, 10 Eki: kuleler hareketli olsun, çevresindeki sis hareket etsin).
// front=false: binanın arkasında kalan yarı (binadan önce çizilir), true: önündeki yarı (soluk, binayı örtmesin).
const TOWER_FOG = { altar: { n: 9, a: 0.9, col: ['150,110,200', '120,70,170'] }, archer: { n: 8, a: 0.85, col: ['205,215,210', '190,180,215'] }, barracks: { n: 9, a: 0.95, col: ['200,220,205', '195,180,220'] } };
function drawTowerFog(t, ts, front) {
  const F = NECRO && TOWER_FOG[t.type]; if (!F) return;
  const s = ts.w / 50, R = ts.w * 0.56, cy = ts.bottom - 3 * s;
  for (let i = 0; i < F.n; i++) {
    const sp = 0.07 + (i % 3) * 0.025, a = time * sp * (i % 2 ? 1 : -1) + i * 2.399 + t.x * 0.013, sn = Math.sin(a);
    if ((sn > 0) !== front) continue;
    const rr = R * (0.8 + 0.25 * Math.sin(time * 0.31 + i)), x = t.x + Math.cos(a) * rr, y = cy + sn * rr * 0.26 - (i % 2) * 2 * s;
    const w = ts.w * (0.62 + 0.14 * Math.sin(time * 0.43 + i * 1.7)), al = F.a * (0.55 + 0.45 * Math.sin(time * 0.37 + i * 2.1)) * (front ? 0.55 : 1);
    ctx.globalAlpha = Math.max(0, al) * 0.8; ctx.drawImage(fogTex(F.col[i % 2], i % 3), x - w / 2, y - w * 0.25, w, w * 0.5);
  }
  ctx.globalAlpha = 1;
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
  if (!setting('shake')) return;
  if (G.shakeT > 0 && G.shakeAmp * (G.shakeT / G.shakeDur) > amp) return;
  G.shakeAmp = amp; G.shakeT = dur; G.shakeDur = dur;
}

// Gülle / ateş yağmuru patlaması: parlama, ateş topu, şok dalgası, toprak parçaları, kıvılcım, duman ve yanık izi
// veba sıçraması: yeşil bulamaç damlaları, gaz bulutu, birkaç kemik parçası
// veba sıçraması: çember yok; sıvı yere çarpıp dört bir yana saçılır, düzensiz bir birikinti ve çevresine damla lekeleri kalır
function fxPlagueSplash(x, y, r) {
  const P = G.parts;
  for (let i = 0; i < 22; i++) { // yere yakın, yayvan saçılan damlalar
    const a = rand(0, Math.PI * 2), v = rand(50, 150);
    emit(P, { kind: 'dot', x, y: y - 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.45 - rand(30, 80), g: 340, col: i % 3 ? '#6cc83c' : '#b8f27a', s0: rand(1.4, 2.6), s1: 0.8, life: rand(0.35, 0.6) });
  }
  for (let i = 0; i < 5; i++) emit(P, { kind: 'glow', x: x + rand(-r, r) * 0.4, y: y - rand(0, 8), vx: rand(-12, 12), vy: -rand(8, 20), col: '110,190,80', s0: r * 0.3, s1: r * 0.7, life: rand(0.7, 1.1), a: 0.4 });
  for (let i = 0; i < 3; i++) emit(P, { kind: 'dot', x, y: y - 4, vx: rand(-60, 60), vy: -rand(60, 110), g: 300, col: '#efe6cc', s0: 1.8, s1: 1.2, life: 0.6 });
  if (!G.decals) return;
  G.decals.push({ kind: 'splat', x, y, r: r * 0.8, rot: rand(0, 6.28), v: Math.floor(rand(0, SPLAT_N)), t: 0, life: 3.2 });
  for (let i = 0; i < 7; i++) { // damlaların düştüğü yerler: biraz gecikmeyle beliren küçük lekeler
    const a = rand(0, Math.PI * 2), d = rand(0.8, 1.6) * r;
    G.decals.push({ kind: 'splat', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.45, r: rand(3, 6), rot: rand(0, 6.28), v: Math.floor(rand(0, SPLAT_N)), t: -rand(0.25, 0.5), life: 2.6, small: true });
  }
}
// birikinti dokuları (birkaç çeşit, bir kez üretilir): düzensiz gövde, uzanan kollar, uçlarda damlalar, açık iç ton ve parlak benekler
const SPLAT_N = 4, SPLATS = [];
function splatTex(v) {
  if (SPLATS[v]) return SPLATS[v];
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = seeded(31 + v * 17), C = S / 2;
  const blob = (r0, col, jit) => {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2, rr = r0 * (1 + (rnd() - 0.5) * jit); i ? g.lineTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr) : g.moveTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  blob(S * 0.26, '#3a7a20', 0.45);
  for (let i = 0, n = 5 + Math.floor(rnd() * 3); i < n; i++) { // kollar
    const a = rnd() * Math.PI * 2, L = S * (0.22 + rnd() * 0.18), w = S * (0.05 + rnd() * 0.04);
    g.save(); g.translate(C, C); g.rotate(a); g.fillStyle = '#3a7a20';
    g.beginPath(); g.moveTo(0, -w); g.quadraticCurveTo(L * 0.6, -w * 0.5, L, 0); g.quadraticCurveTo(L * 0.6, w * 0.5, 0, w); g.closePath(); g.fill();
    g.beginPath(); g.arc(L + w * 0.6, 0, w * 0.75, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, d = S * (0.3 + rnd() * 0.16); g.fillStyle = '#3a7a20'; g.beginPath(); g.arc(C + Math.cos(a) * d, C + Math.sin(a) * d, S * (0.012 + rnd() * 0.02), 0, Math.PI * 2); g.fill(); }
  blob(S * 0.17, '#5aa832', 0.5);
  blob(S * 0.08, '#86d24e', 0.6);
  g.fillStyle = 'rgba(220,255,190,0.85)';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(C - S * 0.08 + rnd() * S * 0.1, C - S * 0.08 + rnd() * S * 0.08, S * 0.018, S * 0.01, -0.5, 0, Math.PI * 2); g.fill(); }
  return (SPLATS[v] = c);
}
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
// gaz/buhar öbeği: bir kez çizilen yumuşak yeşil daire (her karede degrade oluşturmamak için)
let GAS_BLOB = null, GAS_CORE = null;
function gasBlob(core) {
  if (!GAS_BLOB) {
    const mk = (c0, c1, c2) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, c0); gr.addColorStop(0.6, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; };
    GAS_BLOB = mk('rgba(170,240,110,1)', 'rgba(110,200,70,0.6)', 'rgba(80,160,50,0)');
    GAS_CORE = mk('rgba(232,255,200,1)', 'rgba(168,240,112,0.6)', 'rgba(90,170,60,0)');
  }
  return core ? GAS_CORE : GAS_BLOB;
}
// Veba Kazanı gaz bulutu: yolu kaplayan, yavaşça dönen yarı saydam yeşil buhar öbekleri (2 sn)
function drawGasClouds() {
  for (const z of G.zones) {
    if (!z.gas) continue;
    const a = Math.min(1, z.t / 0.15, (z.life - z.t) / 0.5);
    if (a <= 0) continue;
    for (let i = 0; i < 5; i++) {
      const an = z.seed + i * 1.26 + time * 0.5 * (i % 2 ? 1 : -1), rr = z.r * (0.25 + 0.2 * (i % 3));
      const x = z.x + Math.cos(an) * rr, y = z.y - 4 + Math.sin(an) * rr * 0.45 - z.t * 3, r = z.r * (0.55 + 0.12 * Math.sin(time * 2 + i));
      ctx.globalAlpha = 0.3 * a; ctx.drawImage(gasBlob(), x - r, y - r * 0.6, r * 2, r * 1.2);
    }
  }
  ctx.globalAlpha = 1;
}
// kemik kıymığı çarpması: fildişi kırıntılar saçılır, yeşil ruh tozu
function fxShardHit(x, y, crit) {
  for (let i = 0; i < (crit ? 8 : 5); i++) {
    const a = rand(-Math.PI * 0.95, -0.05), v = rand(60, 140);
    emit(G.parts, { kind: 'chunk', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420, drag: 0.6, vr: rand(-14, 14), rot: rand(0, 6), col: i % 3 ? '#efe6cc' : '#c9bd98', s0: rand(1.6, 2.6), s1: 1, life: rand(0.3, 0.5) });
  }
  emit(G.parts, { kind: 'glow', add: true, x, y, col: '150,255,160', s0: crit ? 12 : 8, s1: crit ? 18 : 12, life: 0.18, a: 0.7 });
}
// hedefin gövde ortası (oklar ve büyü ayağa değil gövdeye gider)
function aimY(e) {
  return e.y - (e.def.flying ? 26 : 0) - (CHAR_H['enemy_' + e.type] || 20) * 0.5;
}

// ---------- hasar ----------
// type: 'phys' (zırh azaltır), 'magic' (büyü direnci azaltır), 'true' (hiçbir şey azaltmaz: zehir, ateş, delici ok)
// src: hasar kaynağı (arrow/magic/blast/melee); düşmanın zayıflık/direnç çarpanı uygulanır
// bölüm sonu özeti için: o an vuranın türü (kule, iskelet, dirilen, komutan); çağıran kod ayarlar
let hitBy = null;
const PROJ_BY = { arrow: 'arrow', rainarrow: 'arrow', bolt: 'magic', vapor: 'blast', ultsword: 'hero' };
function damageEnemy(e, amount, type, quiet, src, pen = 0, raw = false) { // pen: zırhın bu kadarını deler (ağır cıvata); raw: zırh sınıfı çarpanı yok (süreli hasarlar)
  if (e.dead || e.under || e.reviveT > 0) return; // kumun altında / dirilirken vurulamaz
  if (hitBy || src) e.lastBy = hitBy || src;
  if (e.curseT > 0) amount *= 1 + (e.curseK || 0); // lanetli fazla hasar alır
  if (src === 'melee' && NECRO) { const L = lightAt(e.x, e.y); if (L) amount *= L.k; } // fener ışığında iskeletler zayıf
  if (src === 'melee' && G.bloodT > 0) amount *= BLOOD.dmg; // Kızıl Ay: ölüler azgın
  e.lastSrc = src || type;
  const wkK = src === 'minion' || src === 'ghoul' || (!src && hitBy === 'hero') ? 'melee' : src; // dirilen ölü ve komutan da Kesici
  let wk = !raw && wkK && e.def.wk && e.def.wk[wkK];
  if (wk && wk < 1 && e.curseT > 0) wk += (1 - wk) * (e.curseRes || 0); // lanet: dirençli olduğu saldırı türüne direnci erir
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
  const red = (type === 'magic' ? e.def.mr : type === 'phys' ? Math.min(0.85, (e.def.armor + (e.armT > 0 ? 0.25 : 0)) * (e.rotT > 0 ? 0.5 : 1)) * (1 - pen) : 0) // veba: zırh yarıya iner; sancak +zırh
    * (e.curseT > 0 ? 1 - (e.curseRes || 0) : 1); // lanet: zırh ve büyü direnci kırılır
  const dealt = Math.min(Math.max(0, e.hp), amount * (1 - red));
  e.hp -= amount * (1 - red);
  dmgNum(e, dealt, quiet);
  if (!quiet) knockback(e, dealt, src);
  if (!quiet) { e.flash = 0.1; e.hitT = 0.18; if (e.hp > 0) painVoice(e); }
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
const immuneTo = (e, k) => { const C = NECRO && ARMOR_CLASS[e.def.acl]; return !!(C && C.immune && C.immune.includes(k)); };
function poisonEnemy(e, dps, t, by) {
  if (immuneTo(e, 'poison')) return; // makineler zehirlenmez
  e.poisonDps = Math.max(e.poisonT > 0 ? e.poisonDps : 0, dps);
  e.poisonT = t; if (by) e.poisonBy = by;
}
// yanma (10 Eki): Veba/Ateş türünden süreli hasar; yanan düşman iyileşemez. Kuşatma (ahşap) ve canavar daha çok yanar.
function burnEnemy(e, dps, t, by) {
  dps *= (e.def.wk && e.def.wk.blast) || 1;
  e.burnDps = Math.max(e.burnT > 0 ? e.burnDps : 0, dps); e.burnT = Math.max(e.burnT || 0, t); e.burnBy = by;
}
// silah büyüsü (IMBUE, data.js): kemik kulesinin oku ya da mahzen iskeletinin kılıcı her vuruşta düşmana etkisini bırakır
function applyImbue(e, kind, by) {
  const I = IMBUE[kind]; if (!I || !e || e.dead) return;
  if (kind === 'fire') burnEnemy(e, I.dps, I.t, by);
  else if (kind === 'poison') poisonEnemy(e, I.dps, I.t, by);
  else if (kind === 'frost') slowEnemy(e, I.slow, I.t);
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
  // testudo: kalkan çatısı dağılır, içinden lejyonerler çıkıp yürümeye devam eder
  if (e.def.split && !e.leaked) {
    const [t, n] = e.def.split, pi = G.paths.indexOf(e.p);
    for (let k = 0; k < n; k++) { const m = spawnEnemy(t, pi, Math.max(dLo(e.p), e.d - 4 + k * 5), e.off + (k - 1) * 7); m.hopT = 0.4; }
    G.effects.push({ kind: 'dust', x: e.x, y: e.y, t: 0, dur: 0.6 });
  }
  if (e.def.chief) setTimeout(() => mortSay('bossDown', true), 900);
  if (e.def.dismount) {
    // deve süvarisi: deve düşer, süvari yaya olarak yoluna devam eder
    const r = spawnEnemy(e.def.dismount, G.paths.indexOf(e.p), e.d, e.off);
    r.hopT = 0.4; r.anim = 0;
  }
  G.kills = (G.kills || 0) + 1;
  if (G.stats) { const by = e.lastBy || 'other'; G.stats.by[by] = (G.stats.by[by] || 0) + 1; }
  cnt('kills'); if (e.def.chief) cnt('bosses');
  dropCoins(e.x, e.y, Math.max(1, Math.round(e.def.gold * diff().bounty)));
  sfx('death');
  deathVoice(e);
  G.effects.push({ kind: 'corpse', name: 'enemy_' + e.type, rig: e.def.base ? 'enemy_' + e.def.base : null, h: CHAR_H['enemy_' + e.type],
    x: e.x, y: e.y, face: e.face, fly: e.def.flying ? 26 : 0, t: 0,
    dur: NECRO ? NECRO_SPELLS.nm_raise.corpse + 0.5 : CORPSE_DUR, raisable: NECRO && !e.def.flying && !e.def.chief && !e.def.machine && !e.def.noraise && !lightAt(e.x, e.y) }); // kuşatma makinesi diriltilemez (yalnız insan ve hayvan)
  const body = G.effects[G.effects.length - 1];
  if (G.bloodT > 0 && body.raisable) body.riseAt = BLOOD.rise; // Kızıl Ay: ceset kendiliğinden kalkar
  // ölüm şeridi olmayan kuşatma makinesi parçalanıp yığılır, uçan düşman dönerek düşer (ceset yerine bu efekt görünür)
  const dn = 'enemy_' + (e.def.base || e.type) + '_die', noDie = !LAZY[dn] && !SPR[dn];
  if (noDie && (e.def.machine || e.def.flying) && !e.leaked) {
    body.dur = 0.01;
    if (e.def.machine) machineWreck(e); else skyFall(e);
  }
  if (e.lastBig && pushable(e) && !e.leaked) launchCorpse(body, e); // patlamayla ya da büyük vuruşla ölen savrulur
  if (e.nailT > 0) body.dur += 4; // ruh çivisi: ceset uzun yatar
  const riseK = Math.max(e.nailT > 0 ? e.nailK || 0 : 0, e.curseT > 0 ? e.curseRise || 0 : 0);
  if (riseK && body.raisable && !e.leaked && Math.random() < riseK) body.riseAt = 1.0; // düştükten sonra kendiliğinden kalkar
  if (e.plagueT > 0) for (const o of G.enemies) { // kara veba yanındakilere bulaşır
    if (o.dead || o === e || o.plagueT > 0 || dist(o.x, o.y, e.x, e.y) > 55) continue;
    poisonEnemy(o, e.plagueDps, 4); o.plagueT = 4; o.plagueDps = e.plagueDps;
    G.effects.push({ kind: 'puff', x: o.x, y: o.y - 8, t: 0, dur: 0.5, r: 6 });
  }
  if (e.curseT > 0 && e.blightN) { // kara lanet: en yakınlara sıçrar
    G.enemies.filter(o => !o.dead && o !== e && !(o.curseT > 0.5) && dist(o.x, o.y, e.x, e.y) < 90).sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y))
      .slice(0, e.blightN).forEach(o => { o.curseT = 4; o.curseK = e.curseK; o.curseRise = e.curseRise; o.curseRes = e.curseRes; o.curseWeak = e.curseWeak; o.blightN = e.blightN;
        G.effects.push({ kind: 'zap', x0: e.x, y0: e.y - 14, target: o, x1: o.x, y1: aimY(o), t: 0, dur: 0.3, w: 0.7, seed: rand(0, 99), col: 'rgb(190,90,255)' }); });
  }
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
// Karşılık: hasar alan iskelet (ve aynı mahzenin boştaki iskeletleri) vuranın üstüne yürür; PROVOKE.r bayraktan en uzak kovalama
const PROVOKE = { t: 5, r: 175 };
function provoke(s, src) {
  if (!src || src.dead || src.def.flying || src.under || s.hero || s.wall || s.bow || s.march) return;
  const mates = s.tower ? s.tower.soldiers || [] : [s];
  for (const m of mates.includes(s) ? mates : [s, ...mates]) {
    if (m.dead || m.bow || (m !== s && m.target)) continue;
    m.provoker = src; m.provokeT = PROVOKE.t;
  }
}
function damageSoldier(s, amount, src) {
  if (s.dead) return;
  if (src) provoke(s, src);
  if (s.wall) {
    s.hp -= amount * (1 - s.armor); s.flash = 0.08;
    if (s.hp <= 0) { s.dead = true; s.hp = 0; s.life = 0; wallCrumble(s); releaseSoldier(s); }
    return;
  }
  // Ateş Bilgesi'nin buz zırhı aurası
  if (G.heroes.some(h => !h.dead && h.learned.frostarmor && dist(h.x, h.y, s.x, s.y) < 110)) amount *= 0.8;
  if (s.dodge && Math.random() < s.dodge) { if (Math.random() < 0.4) floatText(s.x, s.y - 30, 'Kaçtı!', '#ffe9b0'); return; }
  if (s.block && Math.random() < s.block) { s.flash = 0.06; if (Math.random() < 0.3) floatText(s.x, s.y - 30, 'Savuşturdu!', '#cfe8ff'); sfx('bash'); return; }
  const CA = !s.hero && (s.tower || s.minion) && curseAura(s.x, s.y); // lanet aurası: iskelete ek zırh
  s.hp -= amount * (1 - Math.min(0.85, s.armor + (CA ? CA.allyArm : 0)));
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
    if (s.hero) mortSay('heroDown');
    else if (s.ghoul || s.big) { // gulyabani / golem / dev çürük bir toz bulutuyla yere çöker
      sfx('bonefall');
      for (let i = 0; i < 14; i++) emit(G.parts, { kind: 'glow', add: true, x: s.x + rand(-10, 10), y: s.y - rand(2, 26), vx: rand(-30, 30), vy: -rand(10, 40), drag: 2,
        col: i % 3 ? '120,230,110' : '190,110,255', s0: rand(3, 6), s1: 0.5, life: rand(0.5, 0.9) });
      G.effects.push({ kind: 'puff', x: s.x, y: s.y - 6, t: 0, dur: 0.6, r: 9 });
    }
    else if (NECRO && !s.wall) { // iskelet dağılır: kemikler ve kafatası saçılır
      sfx('bonefall');
      boneCollapse(s);
      for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'chunk', x: s.x + rand(-6, 6), y: s.y - rand(4, 20), vx: rand(-55, 55), vy: -rand(50, 130), g: 520, vr: rand(-14, 14), rot: rand(0, 6), col: i % 3 ? '#efe6cc' : '#cbbf9c', s0: rand(1, 2), s1: 1, life: rand(0.5, 0.8) });
      emit(G.parts, { kind: 'glow', add: true, x: s.x, y: s.y - 10, col: '120,255,140', s0: 10, s1: 22, life: 0.35, a: 0.4 });
    }
    const cn = s.hero ? s.def.sprite : s.militia && !s.merc ? 'militia' : 'soldier';
    if (s.big && ANIM_META[s.big + '_die']) G.effects.push({ kind: 'corpse', name: s.big, rig: s.big, h: s.bh, x: s.x, y: s.y, face: s.face || 1, fly: 0, t: 0, dur: 3 }); // iri birim: Wan çöküş şeridi
    else if (!s.ghoul && !s.big) G.effects.push({ kind: 'corpse', name: cn, rig: s.hero ? s.def.sprite : null,
      h: s.hero ? s.def.h * UNIT_K : CHAR_H[cn], x: s.x, y: s.y, face: s.face, fly: 0, t: 0, dur: CORPSE_DUR });
    s.respawnT = s.hero ? s.def.respawn * (s.learned.ninelives ? 0.5 : 1) : s.tower ? (TOWERS.barracks.levels[s.tower.lvl].respawn - (upgRank('barracks') >= 3 ? 3 : 0)) * (s.giant ? 2 : 1) : s.ghoul ? HATCH.respawn : s.chapel ? s.giant.respawn : s.guard ? GATE.guard.respawn : 0;
    releaseSoldier(s);
  }
}
// iskelet çöker: görsel yatay dilimlere bölünür, dilimler yere düşüp kemik yığını olur, kafatası yuvarlanır; yığın bir süre durup söner
const BONES = { n: 5, g: 760, stay: 3.2, fade: 0.6 };
function boneCollapse(s) {
  const key = s.skelKey || 'unit_skel_1', im = spr(key);
  if (!im) return;
  const look = +key.slice(10) || 1, h = (SKEL_H[look] || 30) * UNIT_K, w = h * im.width / im.height, bh = h / BONES.n, face = s.face || 1;
  const parts = [];
  for (let k = 0; k < BONES.n; k++) {
    const head = k === 0, lvl = BONES.n - 1 - k; // alttan yığılma sırası: bacaklar en altta, kafatası en üstte
    parts.push({ k, x: s.x, y: s.y - h + (k + 0.5) * bh, vx: (head ? rand(18, 34) * (Math.random() < 0.5 ? -1 : 1) : rand(-16, 16)), vy: -rand(0, 40),
      rot: 0, vr: head ? rand(-7, 7) : rand(-2.2, 2.2), rest: false, floor: s.y - bh * 0.4 - lvl * bh * 0.16 + rand(-1.5, 1.5), delay: lvl * 0.035 });
  }
  G.effects.push({ kind: 'bones', key, x: s.x, y: s.y, w, h, bh, face, parts, t: 0, dur: BONES.stay + BONES.fade });
}
function bonePhys(f, dt) {
  for (const p of f.parts) {
    if (p.rest || f.t < p.delay) continue;
    p.vy += BONES.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.y >= p.floor) {
      p.y = p.floor;
      if (p.vy > 70) { p.vy *= -0.28; p.vx *= 0.55; p.vr *= 0.5; if (p.k === 0 && p.vy < -20) p.vr = p.vx * 0.12; }
      else { p.rest = true; if (p.k) p.rot = clamp(p.rot, -0.6, 0.6); }
    }
  }
}
function drawBones(f) {
  const im = f.img || spr(f.key);
  if (!im) return;
  ctx.save();
  ctx.globalAlpha = 1 - clamp((f.t - BONES.stay) / BONES.fade, 0, 1);
  const sh = im.height / (f.n || BONES.n);
  for (const p of f.parts) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * f.face); ctx.scale(f.face, p.rest ? 0.86 : 1);
    ctx.drawImage(im, 0, p.k * sh, im.width, sh + 0.5, -f.w / 2, -f.bh / 2, f.w, f.bh + 0.3);
    ctx.restore();
  }
  ctx.restore();
}
// kuşatma makinesi yıkılır: görsel yatay dilimlere bölünür, dilimler yana savrulup devrilerek yere yığılır; tahta kıymıkları ve toz
function machineWreck(e) {
  const name = 'enemy_' + e.type, im = enemySprite(e.type) || spr(name);
  if (!im) return;
  const h = CHAR_H[name] || 40, w = h * im.width / im.height, n = 6, bh = h / n, face = e.face || 1;
  const parts = [];
  for (let k = 0; k < n; k++) {
    const lvl = n - 1 - k;
    parts.push({ k, x: e.x, y: e.y - h + (k + 0.5) * bh, vx: rand(-40, 40) + (k - n / 2) * 6 * face, vy: -rand(20, 90) * (k < 2 ? 1.4 : 0.6),
      rot: 0, vr: rand(-4, 4), rest: false, floor: e.y - bh * 0.35 - lvl * bh * 0.1 + rand(-2, 2), delay: lvl * 0.05 });
  }
  G.effects.push({ kind: 'bones', key: name, img: im, x: e.x, y: e.y, w, h, bh, face, parts, n, t: 0, dur: BONES.stay + BONES.fade });
  for (let i = 0; i < 18; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-w * 0.3, w * 0.3), y: e.y - rand(4, h * 0.8), vx: rand(-90, 90), vy: -rand(60, 200), g: 560, vr: rand(-16, 16), rot: rand(0, 6), col: i % 3 ? '#7a5230' : '#a8784a', s0: rand(1.4, 3), s1: 1, life: rand(0.7, 1.2) });
  G.effects.push({ kind: 'dust', x: e.x, y: e.y, t: 0, dur: 0.8 });
  impactFx(e.x, e.y - h * 0.4, '230,200,150', 1.2); shakeScreen(2, 0.25); sfx('castlehit');
}
// uçan düşman vurulunca kanatları kapanır, dönerek düşer, tüyler saçılır, yerde bir süre yatıp söner
function skyFall(e) {
  const name = 'enemy_' + e.type, im = enemySprite(e.type) || spr(name);
  if (!im) return;
  const h = CHAR_H[name] || 24;
  G.effects.push({ kind: 'skyfall', img: im, x: e.x, y: e.y - 26, floor: e.y, h, face: e.face || 1, vx: rand(-12, 12), vy: -30, rot: 0, vr: (e.face || 1) * rand(4, 7), rest: false, t: 0, dur: 2.6 });
  for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-6, 6), y: e.y - 26 - rand(0, 10), vx: rand(-60, 60), vy: rand(-80, 10), g: 120, vr: rand(-6, 6), rot: rand(0, 6), col: i % 3 ? '#e8dcc0' : '#7a4a22', s0: rand(1.2, 2.2), s1: 0.8, life: rand(0.9, 1.6) });
}
function skyFallPhys(f, dt) {
  if (f.rest) return;
  f.vy += 520 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
  if (f.y >= f.floor) {
    f.y = f.floor;
    if (f.vy > 60) { f.vy *= -0.25; f.vr *= 0.3; f.vx *= 0.5; G.effects.push({ kind: 'dust', x: f.x, y: f.y, t: 0, dur: 0.4 }); }
    else { f.rest = true; f.rot = Math.round(f.rot / Math.PI) * Math.PI + (f.face > 0 ? 1.2 : -1.2); } // yan yatar
  }
}
function drawSkyFall(f) {
  const w = f.h * f.img.width / f.img.height;
  ctx.save(); ctx.globalAlpha = 1 - clamp((f.t - (f.dur - 0.6)) / 0.6, 0, 1);
  ctx.translate(f.x, f.y - f.h * 0.35); ctx.rotate(f.rot); ctx.scale(f.face, 1);
  ctx.drawImage(pickMip(ctx, f.img, w), -w / 2, -f.h / 2, w, f.h);
  ctx.restore();
}
function wallCrumble(s) {
  for (let i = 0; i < 16; i++) emit(G.parts, { kind: 'chunk', x: s.x + rand(-24, 24), y: s.y - rand(0, 16), vx: rand(-60, 60), vy: -rand(40, 120), g: 420, vr: rand(-12, 12), rot: rand(0, 6), col: i % 3 ? '#efe6cc' : '#c9bd98', s0: rand(1.8, 3), s1: 1, life: rand(0.4, 0.8) });
  G.effects.push({ kind: 'dust', x: s.x, y: s.y, t: 0, dur: 0.6 });
  impactFx(s.x, s.y - 18, '235,225,200', 1.1);
}
function releaseSoldier(s) {
  for (const e of G.enemies) if (e.blocker === s) e.blocker = null;
  s.target = null;
}

function floatText(x, y, text, col) { G.floaters.push({ x, y, text, col, t: 0 }); }
// ----- basit fizik (görsel): geri itme ve patlamada savrulan cesetler -----
// big: canın büyük kısmını götüren vuruş ya da patlama. Boss, kuşatma makinesi, uçan ve kapıdaki düşman itilmez.
const KNOCK = { t: 0.2, hit: 0.22, blast: 0.06, launch: 0.3, g: 560, bounce: 0.32 };
const pushable = (e) => !e.def.chief && !e.def.machine && !e.def.flying && e.siege === undefined && !e.under;
function knockback(e, dealt, src) {
  const r = dealt / e.maxHp;
  e.lastBig = src === 'blast' || r > KNOCK.launch; // bu vuruşla ölürse ceset savrulur
  if (e.hp <= 0 || !pushable(e) || e.blocker || r < (src === 'blast' ? KNOCK.blast : KNOCK.hit)) return;
  e.knockT = KNOCK.t; e.knockV = clamp(r * 260, 60, 160); e.hopT = Math.max(e.hopT || 0, 0.25);
}
// ceset havaya savrulur: yolun gerisine doğru, döne döne; yere çarpınca bir iki sekip durur, sonra ölüm pozu kaldığı yerden sürer
function launchCorpse(f, e) {
  const q = pathPos(e.p, e.d), back = Math.hypot(q.dx, q.dy) || 1, v = rand(50, 95);
  f.vx = -q.dx / back * v + rand(-25, 25); f.vy = (-q.dy / back * v + rand(-20, 20)) * 0.5;
  f.z = 0; f.vz = rand(120, 175); f.ang = 0; f.spin = rand(7, 12) * (Math.random() < 0.5 ? -1 : 1); f.air = true;
}
function corpsePhys(f, dt) {
  f.t = Math.min(f.t, 0.15); // havadayken ölüm pozu 'darbe' anında bekler
  f.x += f.vx * dt; f.y += f.vy * dt; f.vz -= KNOCK.g * dt; f.z += f.vz * dt; f.ang += f.spin * dt;
  if (f.z > 0) return;
  f.z = 0;
  if (f.vz < -70) { f.vz = -f.vz * KNOCK.bounce; f.vx *= 0.5; f.vy *= 0.5; f.spin *= 0.35; G.effects.push({ kind: 'dust', x: f.x, y: f.y, t: 0, dur: 0.4 }); }
  else { f.air = false; f.ang = 0; f.t = 0.32; f.flung = true; } // yerleşti: yere yığılma pozundan devam (şeritte yatan kare)
}
// Hasar sayıları: vurulan düşmanın üstünde küçük, kısa ömürlü sayı (büyük vuruş daha iri ve kırmızıya döner).
// Sürekli hasar (zehir, gaz, kanama) toplanıp yarım saniyede bir gösterilir; aynı düşmana çok yakın vuruşlar birleşir.
const DMGNUM = { life: 0.7, max: 45 };
// can barı renkleri: mahzen iskeletleri mavi, komutanlar mor (düşmanlarınki yeşil-sarı-kırmızı kalır, dirilenler yeşil)
const HP_SOLDIER = '#4aa8ff', HP_HERO = '#b57aff';
function dmgNum(e, v, dot) {
  if (v < 0.5 || !G.dmgNums) return;
  if (dot) { e.dotAcc = (e.dotAcc || 0) + v; return; } // updateDmgNums boşaltır
  const last = e.lastNum;
  if (last && last.t < 0.12 && G.dmgNums.includes(last)) { last.v += v; return; }
  if (G.dmgNums.length >= DMGNUM.max) G.dmgNums.shift();
  const n = { e, v, x: e.x + rand(-6, 6), y: e.y - (CHAR_H['enemy_' + e.type] || 22) - 4, t: 0, vx: rand(-8, 8) };
  G.dmgNums.push(n); e.lastNum = n;
}
function updateDmgNums(dt) {
  for (const e of G.enemies) {
    if (!e.dotAcc) continue;
    e.dotT = (e.dotT || 0) + dt;
    if (e.dotT >= 0.5 || e.dead) { const v = e.dotAcc; e.dotAcc = 0; e.dotT = 0; if (v >= 0.5) { dmgNum(e, v, false); if (e.lastNum) e.lastNum.dot = true; } }
  }
  for (const n of G.dmgNums) { n.t += dt; n.y -= 16 * dt; n.x += n.vx * dt; }
  G.dmgNums = G.dmgNums.filter(n => n.t < DMGNUM.life);
}
function drawDmgNums() {
  for (const n of G.dmgNums) {
    const v = Math.round(n.v); if (v < 1) continue;
    const k = n.t / DMGNUM.life, big = Math.log2(1 + v);
    const size = clamp(5.5 + big * 1.15, 6, 15), pop = 1 + 0.35 * Math.max(0, 1 - n.t / 0.12);
    const col = n.dot ? '#9fe870' : v < 10 ? '#f2ecd8' : v < 30 ? '#ffd96a' : v < 80 ? '#ffa04a' : '#ff5a44';
    ctx.save(); ctx.globalAlpha = k < 0.55 ? 0.95 : 0.95 * (1 - (k - 0.55) / 0.45);
    ctx.translate(n.x, n.y); ctx.scale(pop, pop);
    txt(v + '', 0, 0, size, col, 'center', '400', FONT_T);
    ctx.restore();
  }
}

// ---------- kuleler ----------
function buildTower(plot, type) {
  const cost = TOWERS[type].levels[0].cost;
  if (G.gold < cost) return false;
  if (TOWERS[type].unique && G.towers.some(o => o.type === type)) return false; // Lanet Kulesi haritada tek
  G.gold -= cost;
  const t = { type, def: TOWERS[type], lvl: 0, x: plot.x, y: plot.y, cd: 0.3, spent: cost, plot, soldiers: [], anim: 0, shotAnim: 0, born: G.t };
  plot.tower = t;
  G.towers.push(t);
  if (type === 'barracks') {
    const n = nearestOnPaths(G.paths, t.x, t.y);
    t.rx = n.x; t.ry = n.y;
    for (let i = 0; i < 3; i++) {
      const s = makeSoldier(t, i); riseFromGrave(s);
      t.soldiers.push(s); G.soldiers.push(s);
    }
  }
  G.effects.push({ kind: 'dust', x: t.x, y: t.y, t: 0, dur: 0.5 });
  sfx('build');
  return true;
}
const SLOTS = [[-13, -7], [13, -7], [0, 10]], SLOTS4 = [[-14, -8], [14, -8], [-14, 9], [14, 9]]; // uzmanlıkta 4. iskelet katılır
function soldierStats(t) {
  const L = TOWERS.barracks.levels[t.lvl], sh = abRank(t, 'shield'), bl = abRank(t, 'blade'), bw = abRank(t, 'bow'), ur = upgRank('barracks');
  const sp = t.spec ? SPEC_BONUS : 1; // uzmanlık seçen kışlanın askerleri daha güçlü
  const hm = (ur >= 1 ? 1.2 : 1) * sp * (bw ? 0.75 : 1), dm = (ur >= 2 ? 1.2 : 1) * (bl ? bl.mult : 1) * (bw ? bw.mult : 1) * sp;
  // yol farkları: kalkan ağır ve yavaş vurur, darbeleri savuşturur, arada kalkanla sersemletir;
  // kılıç hızlı vurur, vuruşu yanındaki ikinci düşmana da işler, zırhı biraz düşük; okçu uzaktan atar
  const shR = (t.ab && t.ab.shield) || 0, blR = (t.ab && t.ab.blade) || 0;
  return {
    bow: bw ? { r: bw.r, rate: bw.rate } : null,
    maxHp: Math.round((L.hp + (sh ? sh.hp : 0)) * hm), armor: Math.min(0.75, Math.max(0, L.armor + (sh ? sh.armor : 0) + (ur >= 3 ? 0.15 : 0) - (bl ? 0.05 : 0))),
    dmg: [L.dmg[0] * dm * (sh ? 1.15 : 1), L.dmg[1] * dm * (sh ? 1.15 : 1)], crit: bl ? bl.crit : 0, steal: t.lvl >= 2 ? 0.15 : 0,
    rate: sh ? 1.3 : bl ? 0.7 : 1, block: sh ? 0.15 + 0.05 * shR : 0, bash: sh ? 0.6 + 0.2 * shR : 0, cleave: bl ? 0.4 + 0.1 * blR : 0,
    ...(bl ? SKEL_STANCE.attack : sh ? SKEL_STANCE.guard : SKEL_STANCE.base),
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
    s.dmg = st.dmg; s.armor = st.armor; s.crit = st.crit; s.steal = st.steal; s.gear = t.lvl; s.bow = st.bow;
    s.rate = st.rate; s.block = st.block; s.bash = st.bash; s.cleave = st.cleave;
    s.speed = st.speed; s.engage = st.engage; s.leash = st.leash; s.aggro = st.aggro;
    if (s.bow && s.target) { if (s.target.blocker === s) s.target.blocker = null; s.target = null; } // okçular yolu bırakır
  }
}
// iskeletlerin duruşu: engage = bayrağa bu uzaklıktaki düşmana yürür, leash = hedef bundan da uzaklaşınca bırakıp döner.
// Savunmacı (temel, kalkan) yerinden az ayrılır, yaklaşanı karşılar; saldırgan (kılıç) gördüğü en yakın düşmanın üstüne koşar.
const SKEL_STANCE = {
  base: { engage: 82, leash: 28, speed: 60, aggro: false },
  guard: { engage: 74, leash: 20, speed: 56, aggro: false },
  attack: { engage: 140, leash: 60, speed: 80, aggro: true },
};
// Mahzen: iskeletler kapıdan toz kaldırarak çıkar (10 Eki'de mezarlıktaki mezarlardan kalkıyorlardı).
// Noktalar görsele göre: [yatay pay (genişliğin oranı, merkezden), alttan yükseklik (boyun oranı)], kademe sırasıyla.
// 11 Eki: yeni Mahzen (nm_mahzen_v2.jpg); iskeletler kapının merdiveninin dibinden çıkar. DOOR_GLOW: kapı ağzının ortası (ışık)
const GRAVE_SPOTS = [[[-0.04, 0.2]], [[-0.2, 0.17]], [[-0.17, 0.12]]];
const DOOR_GLOW = [[-0.05, 0.42], [-0.21, 0.4], [-0.14, 0.44]];
// Yönlü mahzen (10 Eki, Caner: kapı yola dönük olsun, iskeletler gerçekten kapıdan çıkıp yola gitsin). Kademe başına iki görsel:
// önden (kapı aşağı bakar) ve _side (kapı sağ öne bakar; aynalanınca sol öne). Yol hangi yandaysa o görsel seçilir.
// Noktalar [merkezden yatay pay (genişlik oranı), alttan yükseklik (boy oranı)]: door kapı eşiği (iskelet karanlıktan burada belirir),
// stair merdivenin dibi (buradan bayrağa yürür), glow kapı ağzının ışığı, fire titreyen alevler ('c' mum, 'l' fener).
const MAHZEN_V = {
  0: { front: { door: [0, 0.42], stair: [0, 0.15], glow: [0, 0.56], fire: [[-0.29, 0.33, 'c'], [-0.24, 0.32, 'c'], [0.25, 0.32, 'c'], [0.3, 0.3, 'c'], [0.43, 0.6, 'l']] },
       side: { door: [0.3, 0.42], stair: [0.37, 0.2], glow: [0.33, 0.56], fire: [[-0.25, 0.83, 'c'], [-0.19, 0.82, 'c'], [-0.03, 0.24, 'c'], [0.03, 0.24, 'c'], [0.45, 0.39, 'c'], [0.41, 0.69, 'l']] } },
  1: { front: { door: [0, 0.29], stair: [0, 0.12], glow: [0, 0.45], fire: [[-0.38, 0.42, 'c'], [0.34, 0.42, 'c'], [0.38, 0.39, 'c'], [0.39, 0.53, 'l']] },
       side: { dir: -1, door: [-0.12, 0.32], stair: [-0.2, 0.15], glow: [-0.12, 0.46], fire: [] } }, // dir -1: yan görselde kapı sola bakar
  2: { front: { door: [0, 0.35], stair: [0, 0.12], glow: [0, 0.42], fire: [[-0.26, 0.33, 'b'], [0.23, 0.33, 'b']] }, // Kara Türbe: kafatasının ağzı
       side: { dir: -1, door: [-0.13, 0.33], stair: [-0.27, 0.15], glow: [-0.13, 0.43], fire: [[-0.39, 0.34, 'b'], [-0.03, 0.24, 'b']] } },
};
function mahzenView(t) {
  const V = NECRO && t.type === 'barracks' && MAHZEN_V[t.lvl];
  if (!V || !spr(`tower_barracks_${t.lvl + 1}`)) return null;
  const dx = (t.rx ?? t.x) - t.x, dy = (t.ry ?? t.y) - t.y, side = !!spr(`tower_barracks_${t.lvl + 1}_side`) && (Math.abs(dx) > Math.max(dy, 0) * 0.9 + 8 || dy < -10); // yol arkadaysa yandan çıkıp binanın yanından dolanır
  return { side, fl: side ? (dx < 0 ? -1 : 1) * (V.side.dir || 1) : 1, P: side ? V.side : V.front };
}
const mahzenPt = (t, ts, MV, q) => ({ x: t.x + q[0] * MV.fl * ts.w, y: ts.bottom - q[1] * ts.h });
function graveSpot(t, i) {
  const ts = towerSprite(t), L = GRAVE_SPOTS[t.lvl] || GRAVE_SPOTS[0], g = L[i % L.length];
  return ts ? { x: t.x + g[0] * ts.w, y: ts.bottom - g[1] * ts.h } : { x: t.x, y: t.y + 6 };
}
function riseFromGrave(s) {
  if (!NECRO || !s.tower) return;
  const t = s.tower, MV = mahzenView(t), ts = MV && towerSprite(t);
  if (ts) { // kapının karanlığından belirir, merdivenden iner, sonra bayrağa yürür
    const d = mahzenPt(t, ts, MV, MV.P.door), st = mahzenPt(t, ts, MV, MV.P.stair), j = ((s.slot || 0) - 1) * ts.w * 0.04;
    s.x = d.x + j; s.y = d.y; s.born = G.t; s.door = true; s.exit = { x: st.x + j, y: st.y }; sfx('rattle');
    if ((t.ry ?? t.y) < t.y - 10) s.exit.then = { x: t.x + (Math.sign(MV.P.door[0] * MV.fl) || 1) * ts.w * 0.62 + j, y: t.y - 4 }; // bayrak arkada: önce binanın yanına
    for (let k = 0; k < 6; k++) emit(G.parts, { kind: 'glow', x: d.x + rand(-5, 5), y: d.y - rand(0, 8), vx: rand(-8, 8), vy: -rand(4, 12), col: k % 2 ? '150,230,170' : '180,160,220', s0: 4, s1: 10, life: rand(0.6, 1), a: 0.35 });
    return;
  }
  s.door = false; s.exit = null;
  const q = graveSpot(s.tower, s.slot || 0);
  s.x = q.x; s.y = q.y; s.born = G.t;
  for (let k = 0; k < 7; k++) emit(G.parts, { kind: 'chunk', x: q.x + rand(-4, 4), y: q.y, vx: rand(-40, 40), vy: -rand(60, 130), g: 420, vr: rand(-10, 10), rot: rand(0, 6), col: k % 2 ? '#5a4430' : '#3a2a1a', s0: rand(1.2, 2.2), s1: 1, life: rand(0.35, 0.6) });
  G.effects.push({ kind: 'ring', x: q.x, y: q.y, r: 12, col: Math.random() < 0.5 ? '190,120,255' : '120,255,150', t: 0, dur: 0.5 });
}
function makeSoldier(t, i) {
  const st = soldierStats(t);
  return { tower: t, slot: i, x: t.x, y: t.y + 6, hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, armor: st.armor, crit: st.crit, steal: st.steal, bow: st.bow,
    block: st.block, bash: st.bash, cleave: st.cleave, gear: t.lvl, rate: st.rate, speed: st.speed, engage: st.engage, leash: st.leash, aggro: st.aggro, atk: 0, target: null, dead: false, respawnT: 0, face: 1, anim: rand(0, 5),
 };
}
// iri birimler (Kemik Devi, Ceset Golemi, gulyabani): boy, alan vuruşu, birden çok düşmanı durdurma
const BIG_H = { giant: 21 * 2.4 * UNIT_K, golem: 21 * 2.1 * UNIT_K, ghoul: 21 * 2 * UNIT_K };
function bigHold(s, dt, n) { // çevresindeki serbest düşmanları da durdurur (en çok n)
  if ((s.holdT = (s.holdT || 0) - dt) > 0) return; s.holdT = 0.25;
  let k = G.enemies.filter(e => e.blocker === s && !e.dead).length;
  for (const e of G.enemies) {
    if (k >= n) break;
    if (e.dead || e.blocker || e.def.flying || e.def.noblock || e.under || e.siege !== undefined || dist(e.x, e.y, s.x, s.y) > 30) continue;
    e.blocker = s; k++;
  }
}
function bigStomp(s) {
  shakeScreen(3, 0.25); sfx('stomp');
  G.effects.push({ kind: 'ring', x: s.x, y: s.y, r: 46, col: '230,220,190', t: 0, dur: 0.45 }); G.effects.push({ kind: 'dust', x: s.x, y: s.y, t: 0, dur: 0.7 });
  for (const e of G.enemies) if (!e.dead && !e.def.flying && dist(e.x, e.y, s.x, s.y) < 46) stunEnemy(e, 1.2);
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
  if (cur + 1 >= def.ranks.length) achGive('master');
  if (t.type === 'barracks') {
    if (first && t.soldiers.length < 4) { // uzmanlık seçilince 4. iskelet mahzenden kalkar
      const s4 = makeSoldier(t, 3);
      t.soldiers.push(s4); G.soldiers.push(s4);
      G.effects.push({ kind: 'pillar', x: t.x, y: t.y + 6, col: '140,255,140', t: 0, dur: 0.7 });
    }
    applySoldierStats(t);
  }
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
// Kemik Kulesi yolu: 2. kademeye yükseltirken okçu ya da arbaletçi seçilir; yol 4. kademe uzmanlığını da belirler
function buyPath(t, p) {
  if (!ARCHER_PATH[p] || t.path) return false;
  t.path = p;
  if (!upgradeTower(t)) { t.path = null; return false; }
  t.ga = null; // tepedeki adamlar yeni yola göre yeniden dizilir
  G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 40, col: p === 'bow' ? '150,255,160' : '255,200,120', t: 0, dur: 0.5 });
  return true;
}
function buyImbue(t, k) {
  const I = IMBUE[k];
  if (!I || t.imbue || !imbueOpen(t) || G.gold < I.cost) return false;
  G.gold -= I.cost; t.spent += I.cost; t.imbue = k; t.born = G.t;
  floatText(t.x, t.y - 80, (t.type === 'archer' ? I.arrow : I.melee) + '!', `rgb(${I.col})`); sfx('upgrade');
  G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 44, col: I.col, t: 0, dur: 0.5 });
  for (let i = 0; i < 18; i++) { const a = rand(0, Math.PI * 2), v = rand(30, 90); emit(G.parts, { kind: 'glow', add: true, x: t.x + rand(-14, 14), y: t.y - rand(10, 60), vx: Math.cos(a) * v * 0.4, vy: -rand(30, 80), drag: 1.5, col: I.col, s0: rand(3, 5), s1: 0.5, life: rand(0.6, 1) }); }
  return true;
}
function upgradeTower(t) {
  if (t.lvl >= t.def.levels.length - 1) return false;
  const cost = t.def.levels[t.lvl + 1].cost;
  if (G.gold < cost) return false;
  G.gold -= cost; t.spent += cost; t.lvl++; t.born = G.t;
  if (t.type === 'barracks') applySoldierStats(t);
  G.effects.push({ kind: 'dust', x: t.x, y: t.y, t: 0, dur: 0.5 });
  floatText(t.x, t.y - 80, towerTitle(t), '#ffe27a');
  sfx('upgrade');
  if (t.lvl === t.def.levels.length - 1 && !G.saidMax) { G.saidMax = true; mortSay('maxTower'); }
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

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Necromancer kulelerinde merminin çıktığı nokta (görsel oranı): dikilitaş tepesi, fener kafesi, kazan ağzı
const TOWER_EYE = { altar: [[0.5, 0.14], [0.48, 0.12], [0.505, 0.38]], archer: [[0.5, 0.14], [0.5, 0.1], [0.5, 0.12]], mage: [[0.72, 0.5], [0.5, 0.28], [0.5, 0.3]], artillery: [[0.47, 0.36], [0.42, 0.37], [0.45, 0.36]] };
function towerEye(t, ts) {
  ts = ts || towerSprite(t);
  const E = (TOWER_EYE[t.type] || [])[t.lvl];
  if (!ts || !E) return { x: t.x, y: t.y - 40 };
  return { x: t.x - ts.w / 2 + E[0] * ts.w, y: ts.bottom - ts.h + E[1] * ts.h };
}
// Kemik Dikilitaşı: tepesinde dönen kıymıklardan biri hedefe fırlar (tek hedef, hızlı, uçanları vurur)
function updateObelisk(t, dt, L) {
  const ts = towerSprite(t), F = obeliskForm(t);
  if (F) { L = Object.assign({}, L, { rate: L.rate * F.rate, dmg: [L.dmg[0] * F.dmg, L.dmg[1] * F.dmg], range: L.range * F.range }); return updateObeliskForm(t, dt, L, ts, F); }
  if (xbowCount(t) && ts) { // arbaletçiler: kulenin atış aralığı arbaletçiler arasında sırayla bölüşülür
    t.cd -= dt;
    if (t.cd > 0) return;
    const e = findTarget(t, L.range, true);
    if (!e) { t.cd = 0.1; return; }
    const P = t.path && ARCHER_PATH[t.path]; // yol: okçular sık ve hafif, arbaletçiler seyrek, ağır, zırh deler
    t.cd = L.rate * (P ? P.rate : 1); t.shotAnim = 0.25;
    const crit = t.lvl >= 2 && Math.random() < 0.15;
    xbowShoot(t, ts, L, e, { dmg: roll(L.dmg) * (P ? P.dmg : 1) * (crit ? 2 : 1), crit, pen: P && P.pen || 0, fly: P && P.fly || 1 });
    return;
  }
  t.cd -= dt;
  // hazırlık: ateşten hemen önce kıymıklar göze toplanır (yalnız hedef varken)
  t.charge = t.hasFoe ? clamp(1 - t.cd / Math.min(0.35, L.rate * 0.6), 0, 1) : 0;
  if (t.cd <= 0) {
    const e = findTarget(t, L.range, true);
    t.hasFoe = !!e;
    if (e) {
      t.cd = L.rate; t.shotAnim = 0.25; t.charge = 0;
      const o = towerEye(t, ts), d = dist(o.x, o.y, e.x, e.y);
      G.effects.push({ kind: 'ring', x: o.x, y: o.y, r: 12 + t.lvl * 2, col: '160,255,170', t: 0, dur: 0.22 });
      const pierce = t.lvl >= 1 && Math.random() < 0.25, crit = t.lvl >= 2 && Math.random() < 0.15, nl = abRank(t, 'nail'), fa = abRank(t, 'fan');
      const shot = (tg, dmg) => G.projectiles.push({ kind: 'arrow', shard: true, sx: o.x, sy: o.y, target: tg, tx: tg.x, ty: aimY(tg), t: 0, dur: clamp(dist(o.x, o.y, tg.x, tg.y) / 520, 0.12, 0.5),
        dmg, dtype: pierce ? 'true' : 'phys', arc: 6, crit, pierce, nail: nl ? nl.rise : 0, src: 'arrow' });
      shot(e, roll(L.dmg) * (crit ? 2 : 1));
      if (fa) G.enemies.filter(x => x !== e && !x.dead && !x.under && dist(t.x, t.y - 10, x.x, x.y) <= L.range)
        .sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y)).slice(0, fa.n).forEach(x => shot(x, roll(L.dmg) * fa.mult)); // kemik yelpazesi
      for (let i = 0; i < 4; i++) emit(G.parts, { kind: 'glow', add: true, x: o.x, y: o.y, vx: rand(-30, 30), vy: rand(-30, 10), drag: 3, col: '150,255,150', s0: 3, s1: 0.5, life: 0.3 });
      sfx('arrow');
    } else t.cd = 0.1;
  }
}
// Kemik Balistası: dev kemik mızrak ucundan fırlar (geri tepme, kiriş şaklar), hedefin arkasındakileri de deler.
// Hayalet Okçular: hedef soldaysa yeşil, sağdaysa mor okçu atar; çok hızlı, uçanlara ek hasar.
function updateObeliskForm(t, dt, L, ts, F) {
  if (F.layers) balTrack(t, dt, L, ts, F);
  t.cd -= dt;
  if (t.cd > 0) return;
  let e = findTarget(t, L.range, true);
  if (!e) { t.cd = 0.1; return; }
  if (F.layers && Math.abs((t.balRotT || 0) - (t.balRot || 0)) > 0.3) { t.cd = 0.05; return; } // balista önce hedefe döner
  t.cd = L.rate; t.shotAnim = 0.3;
  const nl = abRank(t, 'nail'), fa = abRank(t, 'fan'), crit = Math.random() < 0.15;
  const TA = towerAnim(t), loopA = TA && F.loopAnim, rel = TA && !loopA ? TA.M.rel * TA.dur : 0; // atış animasyonu varsa ok/mızrak fırlatma karesinde çıkar
  if (TA && !loopA) t.animT = 0;
  if (loopA) t.engageT = 1.2; // hızlı atan kule: animasyon hedef olduğu sürece döngüde oynar
  if (F.tip) {
    if (!F.layers) t.face = e.x < t.x ? -1 : 1;
    const lay = balLay(t), o = lay ? balPoint(t, ts, F, F.tip) : formPoint(t, ts, F.tip), n = lay ? balPoint(t, ts, F, F.nock) : formPoint(t, ts, F.nock);
    t.balT = G.t; t.balRate = L.rate;
    if (F.layers) { // kiriş şaklar: kurma yerinden kıvılcım, kaidede toz
      const m = balPoint(t, ts, F, [(F.armUp[0] + F.armLo[0]) / 2, (F.armUp[1] + F.armLo[1]) / 2]);
      for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', add: true, x: lerp(n.x, m.x, 0.5), y: lerp(n.y, m.y, 0.5), vx: rand(-50, 50), vy: rand(-60, 10), drag: 4, col: i % 3 ? '255,235,200' : '200,120,255', s0: 2.2, s1: 0.3, life: 0.3 });
      G.effects.push({ kind: 'dust', x: t.x, y: ts.bottom - 2, t: 0, dur: 0.5 });
    }
    G.projectiles.push({ kind: 'bspear', sc: F.layers ? clamp(dist(o.x, o.y, n.x, n.y) / 44, 1, 2) : 1, sx: o.x, sy: o.y, target: e, tx: e.x, ty: aimY(e), t: -rel, dur: clamp(dist(o.x, o.y, e.x, e.y) / 620, 0.12, 0.45),
      dmg: roll(L.dmg) * (crit ? 1.6 : 1), dtype: 'true', arc: 3, crit, pierceLine: F.pierce, pierceK: F.pierceK, nail: nl ? nl.rise : 0, src: 'arrow' });
    G.effects.push({ kind: 'ring', x: o.x, y: o.y, r: 14, col: '255,90,90', t: 0, dur: 0.25 });
    for (let i = 0; i < 8; i++) emit(G.parts, { kind: 'glow', add: true, x: o.x, y: o.y, vx: rand(-40, 40) + (e.x - o.x) * 0.3, vy: rand(-40, 20), drag: 3, col: i % 2 ? '255,80,80' : '255,190,120', s0: 3.5, s1: 0.5, life: 0.35 });
    t.snap = { x: n.x, y: n.y, t: 0.18 }; sfx('cannon');
  } else if (t.spec === 'bow') { // Hayalet Okçular: sık ve hafif; her N. ok zehirli
    const bw = abRank(t, 'bow'); t.shotN = (t.shotN || 0) + 1;
    xbowShoot(t, ts, L, e, { dmg: roll(L.dmg), fly: F.fly, poison: bw && t.shotN % bw.every === 0 ? bw.poison : 0 });
  } else { // Ağır Arbaletçiler: seyrek ve ağır; zırh deler, kritik 3 kat
    const cr = !!fa && Math.random() < fa.crit;
    xbowShoot(t, ts, L, e, { dmg: roll(L.dmg) * (cr ? 3 : 1), crit: cr, pen: fa ? fa.pen : 0, fly: F.fly });
  }
}
// ----- 4. kademe ikinci güçleri -----
function buyExtra(t) {
  const E = t && t.spec && TOWER_EXTRA[t.spec];
  if (!E || t.extra || G.gold < E.cost) return false;
  G.gold -= E.cost; t.spent += E.cost; t.extra = true; t.exT = 1.5;
  floatText(t.x, t.y - 80, E.name + '!', '#ffe27a'); sfx('upgrade');
  G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 44, col: '255,215,100', t: 0, dur: 0.5 });
  return true;
}
function densestOf(list, r) { let best = null, bn = 0; for (const e of list) { const n = list.filter(o => dist(o.x, o.y, e.x, e.y) < r).length; if (n > bn) { bn = n; best = e; } } return best; }
function updateExtra(t, dt) {
  if ((t.exT = (t.exT ?? 1.5) - dt) > 0) return;
  const E = TOWER_EXTRA[t.spec], L = effLevel(t), R = (L.range || 140) * 1.05, eye = towerEye(t);
  const near = G.enemies.filter(e => !e.dead && !e.under && dist(t.x, t.y - 10, e.x, e.y) <= R && (t.type === 'archer' || !e.def.flying));
  const avg = L.dmg ? (L.dmg[0] + L.dmg[1]) / 2 : 20;
  if (t.spec === 'rite') { // iskeletleri güçlendirir: menzilde savaşan iskelet yoksa bekler
    const sol = G.soldiers.filter(s => !s.dead && !s.wall && dist(s.x, s.y, t.x, t.y) <= R && s.target);
    if (!sol.length) { t.exT = 0.5; return; }
    for (const s of sol) { s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.4); s.buffT = 6; G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '255,60,70', t: 0, dur: 0.6, small: true }); }
    G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: R * 0.5, col: '255,60,70', t: 0, dur: 0.6 }); sfx('portal'); t.exT = E.cd; return;
  }
  if (!near.length) { t.exT = 0.3; return; }
  t.exT = E.cd; t.shotAnim = 0.3;
  if (t.spec === 'bow' || t.spec === 'fan') {
    const ts = towerSprite(t), A = ts && xbowMen(t), M = menOf(t), w = M.aim * 1.3;
    if (!A || !A.length) { t.exT = 0.5; return; }
    const c = densestOf(near, 50);
    A.forEach(a => { a.tx = null; a.walking = false; a.aimT = w; a.kickT = w + M.kick; a.face = c.x < xbowFoot(t, ts, a).x ? -1 : 1; });
    if (t.spec === 'bow') { // Ok Yağmuru: okçular göğe 18 ok salar, kalabalığın çevresine yüksek kavisle yağar
      for (let i = 0; i < 18; i++) {
        const o = xbowTip(t, ts, A[i % A.length]), px = c.x + rand(-45, 45), py = c.y + rand(-18, 18);
        G.projectiles.push({ kind: 'ghostarrow', ballistic: true, longArrow: true, col: M.col, sx: o.x, sy: o.y, gy0: t.y, ax: px, ay: py - 10, tx: px, ty: py - 10, fy: py, fy0: py,
          target: null, t: -w - i * 0.05, dur: 0.85 + dist(o.x, o.y, px, py) / 900, arc: rand(110, 150), dmg: avg * 0.6, rain: 18, src: 'arrow' });
      }
      t.relQ = (t.relQ || []).concat(A.map(a => { const o = xbowTip(t, ts, a); return { t: w, x: o.x, y: o.y, col: M.col, bow: true }; }));
    } else { // Delici Cıvata: dev cıvata en öndeki düşmana, arkasındaki hattı delip geçer
      const e = near.slice().sort((a, b) => (a.p.total - a.d) - (b.p.total - b.d))[0], o = xbowTip(t, ts, A[0]);
      ballisticShot(o, t.y, e, w, M, { giant: true, dmg: avg * 4, dtype: 'true', pierceLine: 99, pierceLen: 320, pierceK: 0.8, knock: true });
      t.relQ = (t.relQ || []).concat([{ t: w, x: o.x, y: o.y, col: M.col, heavy: true }]);
      setTimeout(() => G && shakeScreen(1.6, 0.15), w * 1000);
    }
  } else if (t.spec === 'plague') {
    const c = densestOf(near, 45);
    for (let k = 0; k < (t.spec === 'nail' ? 5 : 1); k++) {
      const x = c.x + (k ? rand(-28, 28) : 0), y = c.y + (k ? rand(-14, 14) : 0);
      if (t.spec === 'nail') {
        impactFx(x, y - 6, '240,230,200', 1.2); G.effects.push({ kind: 'dust', x, y, t: 0, dur: 0.6 });
        for (let i = 0; i < 5; i++) emit(G.parts, { kind: 'chunk', x, y: y - 4, vx: rand(-50, 50), vy: -rand(60, 120), g: 480, vr: rand(-12, 12), rot: rand(0, 6), col: '#efe6cc', s0: rand(1.5, 2.5), s1: 1, life: 0.6 });
        for (const e of near) if (!e.dead && dist(e.x, e.y, x, y) < 26) { damageEnemy(e, 45, 'true', false, 'arrow'); slowEnemy(e, 0.5, 2.5); }
      } else {
        for (let i = 0; i < 30; i++) emit(G.parts, { kind: 'glow', x: x + rand(-50, 50), y: y + rand(-20, 20), vx: rand(-10, 10), vy: -rand(2, 10), col: i % 3 ? '120,230,90' : '160,90,220', s0: rand(10, 18), s1: rand(14, 24), life: rand(2.5, 4), a: 0.35 });
        for (const e of near) if (dist(e.x, e.y, x, y) < 60) poisonEnemy(e, 14, 5);
      }
    }
    shakeScreen(t.spec === 'nail' ? 2.5 : 0.8, 0.25); sfx(t.spec === 'nail' ? 'stomp' : 'splash');
  } else if (t.spec === 'drain') {
    const c = near.reduce((a, e) => (e.hp > a.hp ? e : a), near[0]);
    G.effects.push({ kind: 'ring', x: c.x, y: c.y, r: 60, col: '190,140,255', t: 0, dur: 0.5 }); impactFx(c.x, c.y - 12, '190,140,255', 1.6);
    for (const e of near) if (dist(e.x, e.y, c.x, c.y) < 60) damageEnemy(e, 55, 'magic', false, 'magic');
    for (const s of G.soldiers) if (!s.dead && dist(s.x, s.y, c.x, c.y) < 90) s.hp = Math.min(s.maxHp, s.hp + 30);
    sfx('zap');
  } else if (t.spec === 'ghost') {
    near.sort((a, b) => dist(a.x, a.y, t.x, t.y) - dist(b.x, b.y, t.x, t.y)).slice(0, 4).forEach(e => {
      stunEnemy(e, 1.6); damageEnemy(e, 25, 'magic', false, 'magic');
      G.effects.push({ kind: 'zap', x0: eye.x, y0: eye.y, x1: e.x, y1: e.y - 12, t: 0, dur: 0.45, w: 1, col: 'rgb(255,80,80)', seed: rand(0, 9) });
    });
    sfx('zap');
  } else if (t.spec === 'corpse') {
    for (let k = 0; k < 3; k++) {
      const e = near[Math.floor(Math.random() * near.length)];
      { if (e.dead) continue;
        impactFx(e.x, e.y - 6, '200,120,90', 1.3); G.effects.push({ kind: 'dust', x: e.x, y: e.y, t: 0, dur: 0.7 });
        for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'chunk', x: e.x, y: e.y - 4, vx: rand(-60, 60), vy: -rand(70, 140), g: 480, vr: rand(-12, 12), rot: rand(0, 6), col: i % 2 ? '#7a4a3a' : '#cbbf9c', s0: rand(1.5, 2.5), s1: 1, life: 0.6 });
        for (const o of G.enemies) if (!o.dead && !o.def.flying && dist(o.x, o.y, e.x, e.y) < 35) damageEnemy(o, avg * (o === e ? 1.2 : 0.6), 'phys', false, 'blast');
        sfx('boom'); }
    }
  } else if (t.spec === 'blight') {
    for (const e of near) { if (e.def.nocurse) continue; e.curseT = Math.max(e.curseT || 0, 5); e.curseK = Math.max(e.curseK || 0, 0.3); poisonEnemy(e, 8, 5);
      for (let i = 0; i < 4; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-8, 8), y: e.y - rand(0, 20), vy: -rand(15, 35), col: '140,60,200', s0: 3, s1: 0.5, life: 0.6 }); }
    G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: R * 0.6, col: '140,60,200', t: 0, dur: 0.6 }); sfx('portal');
  }
}
function updateTower(t, dt) {
  t.anim += dt; t.shotAnim = Math.max(0, t.shotAnim - dt);
  if (t.animT != null) t.animT += dt;
  if (t.engageT > 0) { t.engageT -= dt; const A = towerAnim(t); if (A) { if (t.animT == null || t.animT >= A.dur) t.animT = 0; } } // döngü
  if (t.disabledT > 0) { t.disabledT -= dt; return; } // boss tarafından susturuldu
  if (t.extra) updateExtra(t, dt);
  if (xbowCount(t)) { updateXbowMen(t, dt); updateXbowRelease(t, dt); }
  if (t.type === 'barracks') return;
  if (t.type === 'altar') { updateAltar(t, dt); return; }
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
  if (t.type === 'archer') { updateObelisk(t, dt, L); return; }
  // Hayalet Çağırıcı: yolda düşmanlara doğru süzülen hayalet; değdiğini yakar ve korkutur
  const gh = t.type === 'mage' && abRank(t, 'ghost');
  if (gh) {
    t.ghostCd = (t.ghostCd ?? 2) - dt;
    if (t.ghostCd <= 0) {
      if (findTarget(t, L.range, false)) {
        const q = nearestOnPaths(G.paths, t.x, t.y);
        t.ghostCd = gh.cd; t.shotAnim = 0.3;
        G.ghosts.push({ p: q.p, d: q.along, end: q.along - L.range * 2.2, hit: new Set(), dmg: gh.dmg, fear: gh.fear, t: 0, x: q.x, y: q.y });
        const GF = towerForm(t), gts = GF && towerSprite(t);
        if (GF && GF.cageAt && gts) { const c = formPoint(t, gts, GF.cageAt); G.effects.push({ kind: 'zap', x0: c.x, y0: c.y, x1: q.x, y1: q.y - 10, t: 0, dur: 0.35, w: 1.4, seed: rand(0, 99), col: 'rgb(190,140,255)' }); } // hayalet kafesten süzülür
        sfx('scream');
      } else t.ghostCd = 0.4;
    }
  }
  // Ruh Kafesi: ara ara menzildeki en güçlü düşmanı hayalet kafese kapatır (boss yarı süre)
  const CF = t.type === 'mage' && towerForm(t);
  if (CF && CF.cage) {
    t.cageCd = (t.cageCd ?? 3) - dt;
    if (t.cageCd <= 0) {
      const v = G.enemies.filter(o => !o.dead && !o.under && !o.def.flying && dist(o.x, o.y, t.x, t.y - 10) <= L.range).sort((a, b) => b.hp - a.hp)[0];
      if (v) {
        t.cageCd = CF.cage.cd; const T = CF.cage.t * (v.def.chief ? 0.5 : 1);
        v.cageT = T; stunEnemy(v, T); t.shotAnim = 0.3;
        const cts = towerSprite(t), c = cts ? formPoint(t, cts, CF.cageAt) : { x: t.x, y: t.y - 50 };
        G.effects.push({ kind: 'zap', x0: c.x, y0: c.y, x1: v.x, y1: aimY(v), t: 0, dur: 0.4, w: 1.6, seed: rand(0, 99), col: 'rgb(200,140,255)' });
        floatText(v.x, v.y - (CHAR_H['enemy_' + v.type] || 24) - 12, 'Ruh Hapsi!', '#d8a8ff'); sfx('magic');
      } else t.cageCd = 0.5;
    }
  }
  t.cd -= dt;
  if (t.cd > 0) return;
  let e = findTarget(t, L.range, t.def.air);
  const LF = t.type === 'mage' && towerForm(t); // Ruh Emici ışını hedefine kilitlenir (ölene ya da menzilden çıkana kadar)
  if (LF && LF.ramp && t.lastHit && !t.lastHit.dead && !t.lastHit.under && dist(t.lastHit.x, t.lastHit.y, t.x, t.y - 10) <= L.range) e = t.lastHit;
  if (!e) return;
  t.cd = L.rate;
  t.shotAnim = t.type === 'artillery' ? 0.35 : 0.2;
  const ts = towerSprite(t);
  let sx = t.x, sy = ts ? ts.bottom - ts.h * TOWER_TOP[t.type] : t.y - 34;
  if (ts) { const o = towerEye(t, ts); sx = o.x; sy = o.y + (t.type === 'mage' ? 8 : 0); }
  const MF = t.type === 'mage' && towerForm(t);
  if (MF) { const o = formPoint(t, ts, MF.src); sx = o.x; sy = o.y + 8; } // ışın kristalden / kızıl gözden
  if (t.type === 'mage') {
    const d = dist(sx, sy, e.x, e.y);
    const dr = abRank(t, 'drain');
    let mul = 1;
    if (MF && MF.ramp) { t.ramp = t.lastHit === e ? Math.min(MF.rampMax, (t.ramp || 0) + MF.ramp) : 0; t.lastHit = e; mul = 1 + t.ramp; t.cd *= MF.rate; } // Ruh Emici: aynı hedefe güçlenir
    if (MF) { const MA = towerAnim(t); if (MA && !(t.animT != null && t.animT < MA.dur)) t.animT = 0; } // ışın anında; kule animasyonu sürüyorsa baştan başlamaz
    // ruh ışını: kuleden hedefe neredeyse anında çakar; Ruh Emici'de yeşil, canı iskeletlere aktarır
    G.projectiles.push({ kind: 'bolt', sx, sy: sy - 8, target: e, tx: e.x, ty: aimY(e), t: 0, dur: 0.07, dmg: roll(L.dmg) * mul, dtype: 'magic', arc: 0, src: 'magic',
      slow: t.lvl >= 1 ? { k: 0.3, t: 1 } : null, chain: t.lvl >= 2, drain: dr ? dr.heal : 0 });
    G.effects.push({ kind: 'zap', x0: sx, y0: sy - 8, target: e, x1: e.x, y1: aimY(e), t: 0, dur: 0.28, w: 1 + t.lvl * 0.25 + (t.ramp || 0) * (MF && MF.ramp ? 1.5 : 0), seed: rand(0, 99),
      col: NECRO ? (MF ? MF.col : dr ? 'rgb(120,255,150)' : 'rgb(170,130,255)') : undefined });
    if (MF && MF.ramp && dr) G.effects.push({ kind: 'zap', x0: sx, y0: sy - 8, target: e, x1: e.x, y1: aimY(e), t: 0, dur: 0.22, w: 0.6, seed: rand(0, 99), col: 'rgb(120,255,150)' }); // emilen can: ince yeşil damar
    fxMagicCharge(sx, sy - 8);
    sfx('zap');
  } else if (t.type === 'artillery') {
    const dur = 0.9;
    let tx = e.x, ty = e.y;
    if (!e.blocker) { const f = pathPos(e.p, e.d + e.def.speed * G.wspd * dur, e.off); tx = f.x; ty = f.y; }
    const cr = abRank(t, 'corpse'), pl = abRank(t, 'plague');
    const AF = towerForm(t), AA = AF && towerAnim(t);
    if (AF) { // dönüşmüş kazan: hedefe döner, atış animasyonu oynar, mermi fırlatma anında kovadan / ağızdan çıkar
      if (AF.flip) t.face = e.x < t.x ? -1 : 1;
      const ats = towerSprite(t), o = formPoint(t, ats, AA ? AA.M.relPt : AF.src); sx = o.x; sy = o.y;
      if (AA) t.animT = 0;
    }
    const rel = AA ? AA.M.rel * AA.dur : 0; // fırlatma gecikmesi: hedefin o ana kadarki ilerleyişi de hesaba katılır
    // ceset mancınığı: menzildeki bir cesedi cephane yapar; dönüşmüş mancınık ceset yoksa kendi ceset yığınını atar
    let body = cr && G.effects.find(f => f.kind === 'corpse' && !f.air && f.t > 0.4 && f.t < f.dur - 0.2 && dist(f.x, f.y, t.x, t.y) <= L.range);
    if (body) body.t = body.dur;
    else if (AF && t.spec === 'corpse') body = { name: 'enemy_legion', rig: null, h: 24, face: t.face || 1, pile: true };
    {
      // buhar jeti: kazandan hedefe alçak kavisle yeşil buhar püskürür; değdiği yerde yolu kaplayan gaz bulutu kalır
      const fire = (x2, y2, dmg, delay, path, along) => G.projectiles.push({ kind: 'vapor', src: 'blast', sx, sy, gy: t.y, target: null, tx: x2, ty: y2, t: delay, dur: body ? 0.6 : 0.42,
        dmg, dtype: 'phys', arc: body ? 60 : 26, splash: L.splash * (body ? 1.3 : 1), stun: t.lvl >= 2 ? 0.3 : 0, gas: (L.dmg[0] + L.dmg[1]) * 0.09 * (AF && AF.gas || 1), big: !!body, path, along,
        black: AF && t.spec === 'plague',
        plague: pl ? pl.dps : 0, body: body ? { name: body.name, rig: body.rig, h: body.h, face: body.face } : null });
      const tp = e.blocker ? null : e.p, ta = e.blocker ? 0 : e.d + e.def.speed * G.wspd * (0.42 + rel);
      if (!e.blocker) { const f = pathPos(e.p, ta, e.off); tx = f.x; ty = f.y; }
      fire(tx, ty, roll(L.dmg) * (body ? (body.pile ? 1.3 : cr.mult) : 1) * (AF && AF.dmg || 1), -rel, tp, ta);
      if (rel) { t.aimX = tx; t.aimY = ty; sfx('whirl'); return; } // duman ve ses fırlatma anında (aşağıda değil)
      t.aimX = tx; t.aimY = ty;
      for (let i = 0; i < 10; i++) {
        const a = Math.atan2(ty - sy, tx - sx) + rand(-0.5, 0.5), v = rand(40, 110);
        emit(G.parts, { kind: 'glow', x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, drag: 2.5, col: i % 2 ? '150,230,100' : '200,255,150', s0: rand(4, 7), s1: rand(10, 16), life: rand(0.4, 0.7), a: 0.45 });
      }
      sfx('splash');
      return;
    }
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

const HOLD = { max: 6, walk: 3 }; // menzilli düşmanın nişan alıp durma sınırı (sn)
function castleHit(e) {
  const c = G.castle, before = G.lives / G.maxLives;
  const dmg = e.def.lives;
  G.lives = Math.max(0, G.lives - dmg);
  if (!G.saidLeak) { G.saidLeak = true; mortSay('firstleak', true); }
  else if (!G.saidLow && G.lives <= 5 && G.lives > 0) { G.saidLow = true; mortSay('low', true); }
  else mortSay('leak');
  impactFx(e.x, e.y - 16, '255,120,90', 1.2);
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
  if (e.nailT > 0) e.nailT -= dt; if (e.plagueT > 0) e.plagueT -= dt; if (e.curseT > 0 && (e.curseT -= dt) <= 0) e.curseK = e.curseRes = e.curseRise = e.curseWeak = 0;
  if (e.hasteT > 0) e.hasteT -= dt;
  if (e.armT > 0) e.armT -= dt;
  if (e.drumT > 0) e.drumT -= dt;
  if (e.skillT > 0) e.skillT -= dt; if (e.altT > 0) e.altT -= dt; if (e.cageT > 0) e.cageT -= dt; // özel saldırı anı ve bekleme süresi
  // sancaktar / davulcu: çevresindekilere zırh ya da hız (kendisi dahil değil)
  const AU = e.def.aura;
  if (AU) for (const o of G.enemies) {
    if (o === e || o.dead || o.curseT > 0 || dist(o.x, o.y, e.x, e.y) > AU.r) continue; // lanetli coşmaz
    if (AU.armor) o.armT = 0.3; if (AU.speed) o.drumT = 0.3;
  }
  // davulcu: iki tokmakla sırayla vurur (güm-güm), her ikinci vuruşta davul sesi ve yerde dalga
  if (e.def.prop === 'drum') {
    e.beatT = (e.beatT ?? rand(0, DRUM.beat)) - dt;
    if (e.beatT <= 0) {
      e.beatT += DRUM.beat; e.hand = 1 - (e.hand || 0); e.hitAt = G.t; e.beatN = (e.beatN || 0) + 1;
      if (e.beatN % 2 === 0) { sfx('drum'); G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: (AU && AU.r) || 80, col: '255,150,80', t: 0, dur: 0.45 }); }
    }
  }
  // savaş arabası: yolundaki iskeletleri ezip geçer (her birine bir kez); kemik duvar durdurur
  const TR = e.def.trample;
  if (TR && !e.blocker) for (const s of G.soldiers) {
    if (s.dead || s.wall || s.hero || (s.born != null && G.t < s.born) || dist(s.x, s.y, e.x, e.y) > TR.r) continue;
    if ((e.ran || (e.ran = new Set())).has(s)) continue;
    e.ran.add(s); damageSoldier(s, TR.dmg); s.flash = 0.15; impactFx(s.x, s.y - 8, '235,225,200', 0.9); sfx('bash'); if (e.type === 'elephant') sfx('elephant');
  }
  // güneş rahibesi: belli aralıklarla çevresindeki cesetleri yakar (diriltilemez) ve dirilen ölülere ışıkla vurur
  const PU = e.def.purify;
  if (PU) {
    e.purT = (e.purT ?? 1.5) - dt;
    if (e.purT <= 0) {
      e.purT = PU.every;
      let n = 0;
      for (const f of G.effects) if (f.kind === 'corpse' && f.raisable && dist(f.x, f.y, e.x, e.y) < PU.r) {
        f.raisable = false; f.dur = Math.min(f.dur, f.t + 0.7); n++;
        for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', add: true, x: f.x + rand(-8, 8), y: f.y - rand(0, 6), vy: -rand(20, 50), col: i % 2 ? '255,200,90' : '255,240,180', s0: rand(3, 5), s1: 0.5, life: rand(0.5, 0.9) });
      }
      for (const so of G.soldiers) if (so.zombie && !so.dead && dist(so.x, so.y, e.x, e.y) < PU.r) { damageSoldier(so, PU.dmg); n++; }
      if (n) { G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: PU.r, col: '255,220,120', t: 0, dur: 0.6 }); sfx('magic'); }
    }
  }
  // leş akbabası: yakındaki diriltilebilir cesedi yer (Mortimer diriltemez), canı dolar
  const SC = e.def.scavenge;
  if (SC && !(e.fearT > 0)) {
    e.scT = (e.scT ?? rand(0.5, 1.5)) - dt;
    if (e.scT <= 0) {
      e.scT = 0.4;
      const f = G.effects.find(f => f.kind === 'corpse' && f.raisable && !f.eaten && dist(f.x, f.y, e.x, e.y) < SC.r);
      if (f) {
        e.scT = SC.every; f.raisable = false; f.eaten = true; f.dur = Math.min(f.dur, f.t + 0.6);
        e.hp = Math.min(e.maxHp, e.hp + SC.heal); sfx('vulture');
        for (let i = 0; i < 7; i++) emit(G.parts, { kind: 'dot', x: f.x + rand(-6, 6), y: f.y - rand(0, 6), vx: rand(-30, 30), vy: -rand(20, 60), g: 160, col: i % 3 ? '#8a1c1c' : '#e8dcc0', s0: rand(1.4, 2.4), s1: 0.6, life: rand(0.4, 0.7) });
      }
    }
  }
  if (e.shieldT > 0) e.shieldT -= dt;
  if (e.rotT > 0) { e.rotT -= dt; if (Math.random() < dt * 3) emit(G.parts, { kind: 'dot', x: e.x + rand(-5, 5), y: aimY(e) + rand(-4, 6), vy: rand(10, 25), g: 80, col: '#8ae04a', s0: 1.4, s1: 0.6, life: 0.5 }); }
  // Korku (Mortimer): kavgayı bırakır, yolda geri kaçar
  if (e.fearT > 0) {
    e.fearT -= dt;
    if (e.blocker) { for (const s of G.soldiers) if (s.target === e) s.target = null; e.blocker = null; }
    e.inMelee = false; e.offPath = false;
    // panik: ilk anlarda daha hızlı koşar, arada zıplar, ter damlaları saçar
    const sp = e.def.speed * G.wspd * (1.25 + 0.6 * clamp(e.fearT / 2, 0, 1)) * (e.slowT > 0 ? 1 - e.slowK : 1);
    e.d = Math.max(0, e.d - sp * dt); e.anim += dt * 0.8;
    e.off = clamp(e.off + Math.sin(G.t * 5 + e.d * 0.05) * dt * 26, -16, 16); // panik: yolda sağa sola savrularak kaçar
    if (e.fearGhost) e.fearGhost.t += dt;
    const q = pathPos(e.p, e.d, e.off); if (Math.abs(q.dx) > 0.08) e.face = q.dx > 0 ? -1 : 1; e.x = q.x; e.y = q.y;
    if (e.hopT > 0) e.hopT -= dt; else if (Math.random() < dt * 0.9) e.hopT = 0.4;
    if (Math.random() < dt * 5) emit(G.parts, { kind: 'dot', x: e.x + rand(-5, 5), y: aimY(e) - 10, vx: rand(-40, 40), vy: -rand(40, 80), g: 260, col: '#9fd8ff', s0: 1.8, s1: 0.8, life: 0.45 });
    if (Math.random() < dt * 3) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: aimY(e) - 8, vy: -rand(15, 30), col: '190,120,255', s0: 2.5, s1: 0.5, life: 0.6 });
    return;
  }
  if (e.burnT > 0) { // yanma: alev dilleri, iyileşme yok
    e.burnT -= dt;
    damageEnemy(e, e.burnDps * dt, 'true', true, e.burnBy, 0, true);
    if (Math.random() < dt * 14) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: aimY(e) + rand(-6, 8), vx: rand(-6, 6), vy: -rand(25, 50), col: Math.random() < 0.5 ? '255,140,40' : '255,210,90', s0: rand(2.5, 4), s1: 0.4, life: rand(0.35, 0.6) });
    if (e.dead) return;
  }
  if (e.bleedT > 0) {
    e.bleedT -= dt;
    damageEnemy(e, e.bleedDps * dt * (G.t - (e.movedAt ?? -9) < 0.15 ? 1 : 0.35), 'true', true, e.bleedBy, 0, true); // yürürken tam
    if (Math.random() < dt * 8) emit(G.parts, { kind: 'dot', x: e.x + rand(-5, 5), y: aimY(e) + rand(-4, 6), vy: rand(10, 30), g: 120, col: '#c0181a', s0: 1.6, s1: 0.6, life: 0.5 });
    if (e.dead) return;
  }
  if (e.poisonT > 0) {
    e.poisonT -= dt;
    damageEnemy(e, e.poisonDps * dt, 'true', true, e.poisonBy || 'arrow', 0, true);
    if (Math.random() < dt * 8) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: aimY(e) + rand(-6, 6), vy: -18, col: '140,255,90', s0: 2.8, s1: 0.5, life: 0.7 });
    if (e.dead) return;
  }
  if (e.def.heals) {
    e.healT -= dt;
    if (e.healT <= 0) {
      e.healT = 6;
      for (const o of G.enemies) {
        if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < 70 && o.hp < o.maxHp && !(o.burnT > 0)) {
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
  // hold: menzilde hedef varken durup nişan alır (okçu); önüne kesen olursa yakın dövüşe girmez, onu dibinden vurur
  const RG = e.def.ranged;
  if (RG && (!e.blocker || RG.hold) && !e.under && (RG.ammo == null || (e.ammo ?? RG.ammo) > 0)) {
    let tgt = e.blocker && RG.hold ? e.blocker : null, bd = tgt ? dist(e.x, e.y, tgt.x, tgt.y) : RG.r;
    if (!tgt) for (const h of RG.any ? G.soldiers : G.heroes) {
      if (h.dead || h.removed || h.wall || (h.born != null && G.t < h.born)) continue;
      const d = dist(e.x, e.y, h.x, h.y); if (d <= bd) { bd = d; tgt = h; }
    }
    if (e.shootT > 0) { e.shootT -= dt; if (!RG.moving) { e.inMelee = false; return; } }
    e.rcd = (e.rcd ?? rand(0.3, 0.9)) - dt;
    if (tgt) {
      if (!RG.moving) e.face = tgt.x < e.x ? -1 : 1;
      if (e.rcd <= 0) {
        e.rcd = RG.rate * curseSlowAtk(e); e.shootT = 0.45;
        if (RG.ammo != null) e.ammo = (e.ammo ?? RG.ammo) - 1;
        const AR = e.def.alt && e.def.alt.ranged && (e.altT ??= e.def.alt.cd * 0.4) <= 0 ? e.def.alt : null; // özel atış: ağ ya da ateşli ok
        if (AR) { e.altT = AR.cd; playSkill(e); }
        if (AR && AR.kind === 'net') throwNet(e, tgt, AR.stun); else
        G.projectiles.push({ kind: RG.proj, foe: true, splash: RG.splash, burn: AR && AR.kind === 'burn' ? AR : null, hero: tgt, from: e, sx: e.x + e.face * 6, sy: RG.top ? e.y - (CHAR_H['enemy_' + e.type] || 30) * RG.top : aimY(e), tx: tgt.x, ty: tgt.y - 12, t: -0.18,
          dur: clamp(bd / 300, 0.12, 0.6), arc: RG.proj === 'axe' ? 22 : RG.proj === 'knife' ? 12 : 4 + bd * 0.06, edmg: roll(RG.dmg) * foeDmgMul(e) * (e.drumT > 0 ? DRUM.dmg : 1) * (tgt.hero ? HERO_AGGRO.dmg : 1) });
      }
      // durur: yürümez, kılıç sallamaz. Kimse önünü kesmiyorsa en çok HOLD.max sn durur, sonra HOLD.walk sn atış yaparak yürür
      // (kule menzili dışından iyileşen iskeletlere sonsuza dek ateş edip bölümü kilitlemesin)
      if (RG.hold) {
        e.holdT = e.blocker ? 0 : (e.holdT || 0) + dt;
        if (e.holdT > HOLD.max + HOLD.walk) e.holdT = 0;
        if (e.holdT <= HOLD.max) { e.inMelee = false; return; }
      }
    } else e.holdT = 0;
  }
  if (e.atGate && !e.blocker) { // kapıya vuruyor
    if (!G.gate || G.gate.hp <= 0) { e.atGate = false; e.inMelee = false; e.p = G.inner || e.p; e.d = 0; return; }
    e.inMelee = true; e.atk = (e.atk ?? 0.3) - dt;
    if (e.atk <= 0) { e.atk = e.def.rate * curseSlowAtk(e); gateHit(e, roll(e.def.dmg) * foeDmgMul(e) * (e.def.machine ? GATE.machine : 1) * (e.def.chief ? 3 : 1)); }
    return;
  }
  if (e.blocker) {
    const B = e.blocker, bd = dist(e.x, e.y, B.x, B.y);
    e.inMelee = bd < 22;
    if (e.inMelee && !e.cried && G.cryCd <= 0) { e.cried = true; G.cryCd = 5; warCry(e); } // göğüs göğüse: hücum çığlığı
    if (!e.inMelee) {
      // Kilitlendiği asker/kahraman yanına gelmiyorsa (kahraman yol dışında durur, asker başka düşmanla uğraşır)
      // düşman kısa bir bekleyişten sonra kendisi ona yürür; çok uzaklaşan hedefi bırakır.
      const coming = !B.hero && B.target === e && !B.moving;
      e.waitT = (e.waitT || 0) + dt;
      if (bd > 75 || (!coming && !B.hero && e.waitT > 3)) { e.blocker = null; e.waitT = 0; }
      else if (!coming || e.waitT > 1.2) {
        const sp = e.def.speed * G.wspd * (e.spdMul || 1) * slow, k = Math.min(1, sp * dt / Math.max(1, bd - 18));
        e.face = B.x < e.x ? -1 : 1; e.x += (B.x - e.x) * k; e.y += (B.y - e.y) * k; e.offPath = true;
      }
      if (!e.blocker) return;
    } else e.waitT = 0;
    if (e.inMelee) {
      e.face = e.blocker.x < e.x ? -1 : 1;
      e.atk -= dt;
      if (e.atk <= 0) {
        e.atk = e.def.rate * curseSlowAtk(e); e.atkV = Math.floor(Math.random() * 3);
        const victim = e.blocker, A = e.def.alt;
        if (A && !A.ranged && (e.altT ??= A.cd * 0.4) <= 0) { e.altT = A.cd; playSkill(e); doAlt(e, A, victim); return; } // özel saldırı
        slashFx(victim.x, victim.y - unitH(victim) * 0.55, e.face, '#ffd9b0');
        damageSoldier(victim, roll(e.def.dmg) * foeDmgMul(e) * (e.drumT > 0 ? DRUM.dmg : 1) * (victim.hero ? HERO_AGGRO.dmg : 1), e);
        sfx('clash');
      }
    }
    return; // bloklanmış: durur
  }
  e.inMelee = false;
  // kahramana saldırı: yanından geçerken durup kahramanla dövüşür
  if (!e.def.flying && !e.leader && !e.under) {
    for (const h of G.heroes) {
      if (h.dead || e.def.noblock || dist(e.x, e.y, h.x, h.y) > HERO_AGGRO.r) continue;
      let n = 0;
      for (const o of G.enemies) if (o.blocker === h && !o.dead) n++;
      if (n < HERO_AGGRO.max) { e.blocker = h; return; }
    }
  }
  // geri itme: sert vuruş ya da patlama düşmanı yolda kısa süre geriye savurur (hız sönerek azalır)
  if (e.knockT > 0) {
    e.knockT -= dt;
    if (!e.offPath) { e.d = Math.max(0, e.d - e.knockV * dt * (0.3 + e.knockT / KNOCK.t)); const q = pathPos(e.p, e.d, e.off); e.x = q.x; e.y = q.y; return; }
  }
  if (e.skillT > 0 && !e.def.machine) return; // özel saldırı / büyü anında durur
  let spd = e.def.speed * G.wspd * (G.bloodT > 0 ? BLOOD.slow : 1) * (G.mod && G.mod.speed || 1) * (e.spdMul || 1) * (e.def.frenzy ? 1 + e.def.frenzy.spd * (1 - e.hp / e.maxHp) : 1) * (e.slowT > 0 ? 1 - e.slowK : 1) * (e.hasteT > 0 ? 1.5 : 1) * (e.drumT > 0 ? 1.3 : 1) * (e.under ? BU.speed : 1);
  if (e.entryT > 0) { // boss girişi: ağır adımlar
    e.entryT -= dt; spd *= 0.3;
    if ((e.stompT = (e.stompT ?? 0.4) - dt) <= 0) { e.stompT = 0.8; sfx('stomp'); shakeScreen(2.6, 0.22); G.effects.push({ kind: 'dust', x: e.x, y: e.y, t: 0, dur: 0.6 }); }
  }
  // muhafız: boss'un yanında dizilişini korur; boss savaşırken bekler, boss ölünce serbest kalır
  if (e.leader) {
    const L = e.leader;
    if (L.dead || L.p !== e.p || L.siege != null || (L.blocker && L.d - e.d < 60)) e.leader = null; // önder dövüşe tutuldu: muhafız düzeni bozar, yürümeye devam eder
    else {
      const ls = L.blocker ? 0 : L.def.speed * G.wspd * (L.spdMul || 1) * (L.slowT > 0 ? 1 - L.slowK : 1) * (L.hasteT > 0 ? 1.5 : 1) * (L.entryT > 0 ? 0.3 : 1);
      spd = clamp(ls + ((L.d + e.form) - e.d) * 1.5, 0, spd * 1.3);
    }
  }
  // dövüş için yoldan çıktıysa önce yumuşakça yola geri döner
  if (e.offPath) {
    const q = pathPos(e.p, e.d, e.off), d = dist(e.x, e.y, q.x, q.y), st = Math.max(spd, 12) * dt;
    if (d <= st + 0.5) e.offPath = false;
    else { e.face = q.x < e.x ? -1 : 1; e.x += (q.x - e.x) / d * st; e.y += (q.y - e.y) / d * st; return; }
  }
  e.curSpd = spd * (e.d < 0 ? 1.5 : 1); e.movedAt = G.t; // mermilerin tahminli nişanı için (leadPoint)
  e.d += e.curSpd * dt; // ekran dışındaki giriş payını biraz hızlı geçer (dalga gecikmesin)
  // ayak tozu: yürüyüş döngüsünde her adım yere bastığında (çizimdeki adım hızıyla aynı)
  if (!e.def.flying && spd > 0) {
    const step = Math.floor(e.anim * (5 + e.def.speed * G.wspd / 9) / Math.PI);
    if (step !== e.step) {
      e.step = step; footDust(e);
      // dev bossun her adımı yeri sarsar
      if (e.def.chief && (e.def.h || 0) >= 46 && !(e.def.ab && e.def.ab.blink) && !e.def.float) { shakeScreen(1.3, 0.1); sfx('stomp'); }
    }
  }
  if (e.d >= e.p.total) {
    e.d = e.p.total;
    if (G.gate && e.p !== G.inner && !e.def.flying) { // kemik kapı: sağlamsa vurur, kırıksa avluya dalar
      if (G.gate.hp > 0) { e.atGate = true; e.face = G.castle.x < e.x ? -1 : 1; return; }
      e.p = G.inner; e.d = 0; return;
    }
    e.siege = 0; // kalenin kapısına vardı: saldırıya hazırlanır
    if (e.under) { e.under = false; e.emergeT = 0.35; }
    e.face = G.castle.x < e.x ? -1 : 1;
    return;
  }
  const q = pathPos(e.p, e.d, e.off);
  // yüz yönü yolun gidiş yönünden: yandan sapmalı yürüyüşte örnek noktası geçişlerinde konum bir pikselden az geri sıçrayabiliyor,
  // konum farkına bakılırsa karakter bir kareliğine ters döner (çapraz/virajlı yolda takılma gibi görünür). Dikey yolda yön korunur.
  if (Math.abs(q.dx) > 0.08) e.face = q.dx < 0 ? -1 : 1;
  e.x = q.x; e.y = q.y;
}

function soldierHome(s) {
  if (s.hero || s.militia || s.guard) return { x: s.rx, y: s.ry };
  const t = s.tower, o = (t.soldiers.length > 3 ? SLOTS4 : SLOTS)[s.slot];
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

// Mahzenin okçu yolu: iskelet okçu toplanma yerinde durur, menzildeki (uçan dahil) en öndeki düşmana kemik ok atar
function updateBowSoldier(s, dt) {
  const home = soldierHome(s);
  if (s.moving || dist(s.x, s.y, home.x, home.y) > 2) {
    if (s.melee && s.melee.blocker === s) s.melee.blocker = null;
    s.melee = null;
    if (moveToward(s, home.x, home.y, dt)) s.moving = false;
    s.shootT = 0;
    return;
  }
  if (s.shootT > 0) s.shootT -= dt;
  // yanına kadar gelen düşmanı durdurur: düşman ona saldırır, okçu da onu yakından vurur
  if (s.melee && (s.melee.dead || s.melee.blocker !== s)) s.melee = null;
  if (!s.melee) for (const e of G.enemies) {
    if (e.dead || e.def.flying || e.def.noblock || e.under || e.blocker || e.siege !== undefined || e.reviveT > 0) continue;
    if (dist(e.x, e.y, s.x, s.y) < 20) { e.blocker = s; s.melee = e; break; }
  }
  let best = s.melee, bestRemain = 1e9;
  if (!best) for (const e of G.enemies) {
    if (e.dead || e.under || e.reviveT > 0 || dist(s.x, s.y - 10, e.x, e.y) > s.bow.r) continue;
    // başka okçunun nişan aldığı düşman 90 px "uzakmış" sayılır: okçular ayrı hedeflere dağılır
    const remain = e.p.total - e.d + G.soldiers.reduce((n, x) => n + (x !== s && x.bow && !x.dead && x.aim === e ? 90 : 0), 0);
    if (remain < bestRemain) { bestRemain = remain; best = e; }
  }
  s.aim = best;
  s.atk -= dt;
  if (!best) { if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.08 * dt); s.atk = Math.max(s.atk, 0.15 * (s.slot || 0)); return; }
  s.face = best.x < s.x ? -1 : 1;
  s.anim += dt;
  if (s.melee && dist(s.x, s.y, s.melee.x, s.melee.y) < 24) {
    // ikinci silah: kemik hançer, daha sık ama biraz zayıf vurur
    if (s.atk <= 0) {
      s.atk = 0.75; s.shootT = 0.25;
      const crit = s.crit && Math.random() < s.crit, dmg = roll(s.dmg) * 0.75 * (s.buffT > 0 ? 1.5 : 1) * (crit ? 2 : 1) * allyK(s);
      damageEnemy(s.melee, dmg, 'phys', false, 'melee'); if (s.tower && s.tower.imbue) applyImbue(s.melee, s.tower.imbue, 'melee');
      slashFx(s.melee.x, s.melee.y - (CHAR_H['enemy_' + s.melee.type] || 22) * 0.5, s.face, '#d8ffcf', crit ? 1.2 : 0.7);
      if (crit) impactFx(s.melee.x, s.melee.y - 14, '235,255,220');
      sfx('clash');
    }
    return;
  }
  if (s.atk <= 0) {
    s.atk = s.bow.rate; s.shootT = 0.35;
    const sx = s.x + s.face * 5, sy = s.y - 18, d = dist(sx, sy, best.x, best.y), crit = s.crit && Math.random() < s.crit;
    G.projectiles.push({ kind: 'arrow', boneArrow: true, sx, sy, target: best, tx: best.x, ty: aimY(best), t: 0, dur: clamp(d / 480, 0.12, 0.55),
      dmg: roll(s.dmg) * (s.buffT > 0 ? 1.5 : 1) * (crit ? 2 : 1) * allyK(s), dtype: 'phys', arc: 14, crit, src: 'arrow', imbue: s.tower && s.tower.imbue });
    sfx('arrow');
  }
}
// Kemik Duvarı: yerinden kıpırdamaz, yanına gelen her yer düşmanını durdurur; düşmanlar ona vurur
function updateWall(s, dt) {
  for (const e of G.enemies) {
    if (e.dead || e.def.flying || e.under || e.blocker || e.siege !== undefined || e.reviveT > 0) continue;
    if (dist(e.x, e.y, s.x, s.y) < 28) e.blocker = s;
  }
}
function updateSoldier(s, dt) {
  if (s.born != null && G.t < s.born) return; // diriltilen minyon sırasını bekliyor
  if (s.flash > 0) s.flash -= dt;
  if (s.buffT > 0) s.buffT -= dt;
  if (s.spinT > 0) s.spinT -= dt;
  if (s.militia) {
    s.life -= dt;
    if (s.life <= 0 && !s.dead) { s.dead = true; releaseSoldier(s); }
  }
  if (s.dead) {
    if (s.militia || (s.ghoul && s.ghoul.state === 'sealed')) { s.removed = true; return; }
    s.respawnT -= dt;
    if (s.respawnT <= 0) {
      s.dead = false; s.hp = s.maxHp;
      if (s.hero) G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '255,240,190', t: 0, dur: 0.8 }); // olduğu yerde, ışık sütunuyla dirilir
      else if (s.ghoul) { s.x = s.ghoul.x; s.y = s.ghoul.y; s.born = G.t; ghoulRiseFx(s.ghoul); }
      else if (s.guard) { s.x = s.rx; s.y = s.ry; G.effects.push({ kind: 'pillar', x: s.x, y: s.y, col: '140,255,140', t: 0, dur: 0.6 }); }
      else { s.x = s.tower.x; s.y = s.tower.y + 6; riseFromGrave(s); }
    }
    return;
  }
  if (s.wall) { updateWall(s, dt); return; }
  if (s.exit) { // mahzenden çıkış: önce merdivenin dibine iner (dövüşe karışmaz)
    if (moveToward(s, s.exit.x, s.exit.y, dt * 26 / s.speed) || G.t - s.born > 4) s.exit = s.exit.then && G.t - s.born <= 4 ? s.exit.then : null; // ~26 px/sn, ağır adımlarla
    return;
  }
  if (s.giant) { bigHold(s, dt, s.giant.block); if (s.giant.stomp && s.target && (s.stompT = (s.stompT ?? 3) - dt) <= 0) { s.stompT = 6; bigStomp(s); } }
  else if (s.golem) bigHold(s, dt, 3);
  if (s.netT > 0) s.netT -= dt;
  if (s.dotT > 0) { // yanma / zehir: yarım saniyede bir hasar, üstünden kıvılcım ya da zehir kabarcığı
    s.dotT -= dt; s.dotAcc = (s.dotAcc || 0) + s.dotDps * dt;
    if (Math.random() < dt * 8) emit(G.parts, { kind: 'glow', add: true, x: s.x + rand(-5, 5), y: s.y - rand(4, 18), vy: -rand(15, 35), col: s.dotCol || '255,140,60', s0: 3, s1: 0.5, life: 0.5 });
    if (s.dotAcc >= 3 || s.dotT <= 0) { const a = s.dotAcc; s.dotAcc = 0; damageSoldier(s, a); if (s.dead) return; }
  }
  if (s.stunT > 0) { s.stunT -= dt; return; }
  if (s.march) { marchSoldier(s, dt); return; }
  // dirilen ceset: hedefi yokken en yakın yer düşmanına yönelir (yürüdüğü nokta düşmanla birlikte güncellenir)
  if (s.zombie && !s.target) zombieHunt(s);
  if (s.hero && s.ranged) { updateRangedHero(s, dt); runHeroSkills(s, dt); return; }
  if (s.bow) { updateBowSoldier(s, dt); return; }
  const home = soldierHome(s);
  if (s.provokeT > 0) { s.provokeT -= dt; if (s.provokeT <= 0 || !s.provoker || s.provoker.dead || s.provoker.under) s.provoker = null; }
  // vuran düşman: elindeki hedef göğüs göğüse değilse bırakıp ona döner
  const pv = s.provoker;
  if (pv && !s.moving && s.target !== pv && dist(pv.x, pv.y, home.x, home.y) <= PROVOKE.r && (!s.target || dist(s.x, s.y, s.target.x, s.target.y) > 26)) {
    if (s.target && s.target.blocker === s) s.target.blocker = null;
    s.target = pv; if (!pv.blocker && !pv.def.noblock) pv.blocker = s;
  }
  const e = s.target, lim = e && e === s.provoker ? PROVOKE.r + 20 : s.engage + (s.leash ?? 40);
  if (e && (e.dead || e.under || e.reviveT > 0 || dist(e.x, e.y, home.x, home.y) > lim || s.moving)) {
    if (e.blocker === s) e.blocker = null;
    s.target = null;
  }
  // yardımcı (düşmanı başkası durdurmuş): menzilde kimsenin durdurmadığı düşman varsa ona geçer; her iskelet ayrı birini tutsun
  if (s.target && !s.moving && s.target.blocker && s.target.blocker !== s && !s.hero && (s.retgT = (s.retgT || 0) - dt) <= 0) {
    s.retgT = 0.4;
    const free = G.enemies.find(o => !o.dead && !o.blocker && !o.def.flying && !o.def.noblock && !o.under && !(o.reviveT > 0) && o.siege === undefined && dist(o.x, o.y, home.x, home.y) <= s.engage);
    if (free) { s.target = free; free.blocker = s; }
  }
  if (!s.target && !s.moving) {
    let best = null, bestScore = 1e9;
    for (const o of G.enemies) {
      if (o.dead || o.def.flying || o.under || o.reviveT > 0) continue; // uçmayan her şeye saldırır (araba gibi durdurulamayanlar dahil)
      const d = dist(o.x, o.y, home.x, home.y);
      if (d > s.engage) continue;
      const busy = G.soldiers.reduce((n, x) => n + (x !== s && !x.dead && x.target === o ? 1 : 0), 0); // ona zaten saldıranlar
      const score = s.zombie || s.aggro ? dist(o.x, o.y, s.x, s.y) + (o.blocker ? 40 : 0) + busy * 30 : (o.blocker ? 1000 : 0) + busy * 400 + (o.p.total - o.d);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (best) {
      s.target = best;
      if (!best.blocker && !best.def.noblock) best.blocker = s;
    }
  }
  if (s.target) {
    const t = s.target;
    if ((!t.blocker || t.blocker.dead) && !t.def.noblock) t.blocker = s;
    const side = s.x < t.x ? -1 : 1;
    const spot = t.blocker === s ? { x: t.x + side * 13, y: t.y } : { x: t.x + side * 12, y: t.y + (s.slot === 2 ? 7 : -7) };
    const arrived = moveToward(s, spot.x, spot.y, dt);
    if (arrived || dist(s.x, s.y, t.x, t.y) < 19) {
      s.face = t.x < s.x ? -1 : 1;
      s.atk -= dt;
      s.anim += dt;
      if (s.atk <= 0) {
        s.atk = s.rate; s.atkV = Math.floor(Math.random() * 3);
        const crit = s.crit && Math.random() < s.crit;
        const dmg = roll(s.dmg) * (s.buffT > 0 ? 1.5 : 1) * (crit ? 2 : 1) * allyK(s);
        if (s.hero) {
          s.swingT = 0.3;
          if (s.learned.bleed) { t.bleedDps = Math.max(t.bleedT > 0 ? t.bleedDps : 0, 6 + s.lvl * 2); t.bleedT = 3; }
        }
        hitBy = s.hero ? 'hero' : s.minion ? 'minion' : 'melee'; damageEnemy(t, dmg, 'phys', false, s.hero ? null : 'melee');
        if (s.tower && s.tower.imbue && !s.hero) applyImbue(t, s.tower.imbue, 'melee'); // silah büyüsü
        if (s.aoe) { // iri birim: savurması çevresindeki herkese işler
          for (const o of G.enemies) if (o !== t && !o.dead && !o.def.flying && !o.under && dist(o.x, o.y, t.x, t.y) < 34) damageEnemy(o, dmg * s.aoe, 'phys', false, 'melee');
          impactFx(t.x, t.y - 8, '230,220,190', 1.1); shakeScreen(1.2, 0.08);
        }
        if (s.cleave) { // kılıç ustası: savurma yanındaki ikinci düşmana da işler
          let o2 = null, od = 30; for (const o of G.enemies) { if (o === t || o.dead || o.def.flying || o.under) continue; const dd = dist(o.x, o.y, t.x, t.y); if (dd < od) { od = dd; o2 = o; } }
          if (o2) { damageEnemy(o2, dmg * s.cleave, 'phys', false, 'melee'); slashFx(o2.x, o2.y - 14, s.face || 1, '#c8ffb0', 0.6); }
        }
        if (s.bash && (s.bashT = (s.bashT ?? 2) - s.rate) <= 0 && !t.dead) { // kalkan darbesi: sersemletir, biraz geri iter
          s.bashT = 5; stunEnemy(t, s.bash); impactFx(t.x, t.y - 12, '200,230,255', 1.1); if (pushable(t)) knockback(t, t.maxHp, 'blast');
        }
        hitBy = null;
        if (s.steal) s.hp = Math.min(s.maxHp, s.hp + dmg * s.steal);
        if (crit) impactFx(t.x, t.y - 14, '255,245,220');
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
  if (h.ultT > 0) h.ultT -= dt;
  for (const p of h.def.paths) for (const sk of p.skills) {
    if (sk.passive || !h.learned[sk.id] || (h.cds[sk.id] || 0) > 0) continue;
    hitBy = 'hero'; const used = useSkill(h, sk.id); hitBy = null;
    if (!used) { h.cds[sk.id] = 0.3; continue; }
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
// saplanan ok: isabet edince düşmanın gövdesinde (onunla birlikte gider, 1,4 sn sonra söner; en çok 3), ıskalayınca yerde titreyerek kalır
function stickArrow(pr, e) {
  const k = 0.985, ang = projAng(pr, k);
  if (e) {
    if ((e.stuckN || 0) >= 3) return;
    e.stuckN = (e.stuckN || 0) + 1;
    G.effects.push({ kind: 'stuck', target: e, dx: pr.tx - e.x + Math.cos(ang) * 3, dy: pr.ty - e.y + Math.sin(ang) * 3, ang, t: 0, dur: 1.4, col: pr.col, bolt: pr.bolt, heavy: pr.heavy, longA: pr.longArrow });
  } else {
    const gy = pr.fy ?? pr.ty, a = clamp(ang, 0.35, Math.PI - 0.35); // yere eğik saplanır, 5,5 sn kalır (en çok 90 ok; fazlası en eskiden söner)
    const old = G.effects.filter(f => f.kind === 'stuck' && f.ground);
    if (old.length >= 90) old[0].t = Math.max(old[0].t, old[0].dur - 0.4);
    G.effects.push({ kind: 'stuck', x: pr.tx, y: gy, ang: a, t: 0, dur: 5.5, col: pr.col, bolt: pr.bolt, heavy: pr.heavy, longA: pr.longArrow, ground: true });
    for (let i = 0; i < 3; i++) emit(G.parts, { kind: 'dot', x: pr.tx, y: gy, vx: rand(-25, 25), vy: -rand(15, 45), g: 220, col: '#7a6a52', s0: 1.3, s1: 0.6, life: 0.35 });
  }
}
const dustPuff = (x, y, k = 1) => { for (let i = 0; i < 3; i++) emit(G.parts, { kind: 'glow', x: x + rand(-3, 3), y, vx: rand(-14, 14), vy: -rand(4, 12), col: '170,150,120', s0: 3 * k, s1: 8 * k, life: 0.45, a: 0.3 }); };
function projPos(pr, k) {
  k = clamp(k, 0, 1);
  if (pr.ballistic) return { x: lerp(pr.sx, pr.tx, k), y: lerp(pr.sy, pr.ty, k) - 4 * pr.arc * k * (1 - k) }; // gerçek parabol (sabit yerçekimi)
  return { x: lerp(pr.sx, pr.tx, k), y: lerp(pr.sy, pr.ty, k) - Math.sin(k * Math.PI) * pr.arc };
}
// balistik merminin o anki doğrultusu (parabolün türevi): ok burnu hep uçuş yönüne bakar
const projAng = (pr, k) => Math.atan2((pr.ty - pr.sy) - 4 * pr.arc * (1 - 2 * clamp(k, 0, 1)), (pr.tx - pr.sx) || 0.001);
function updateProjectile(pr, dt) {
  pr.t += dt;
  if (pr.foe) {
    // düşmandan kahramana: hedefi izler, varınca vurur
    const h = pr.hero;
    if (h && !h.dead) { pr.tx = h.x; pr.ty = h.y - 12; }
    if (pr.t >= 0 && !pr.snd) { pr.snd = true; sfx(pr.kind === 'hex' ? 'magic' : pr.kind === 'axe' ? 'whirl' : 'arrow'); }
    if (pr.t < pr.dur) return;
    pr.done = true;
    if (pr.splash) { // kutsal su şişesi: isabet yerindeki bütün askerlere alan hasarı, mavi sıçrama
      for (const s2 of G.soldiers) if (s2 !== h && !s2.dead && !s2.wall && dist(s2.x, s2.y, pr.tx, pr.ty + 12) < pr.splash) damageSoldier(s2, pr.edmg * 0.7, pr.from);
      G.effects.push({ kind: 'ring', x: pr.tx, y: pr.ty + 12, r: pr.splash, col: '120,200,255', t: 0, dur: 0.4 });
      for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', add: true, x: pr.tx + rand(-6, 6), y: pr.ty + rand(-4, 6), vx: rand(-70, 70), vy: rand(-90, -10), g: 220, col: i % 2 ? '140,210,255' : '220,245,255', s0: 3, s1: 0.5, life: rand(0.35, 0.6) });
      sfx('splash');
    }
    if (pr.net && h && !h.dead) { netSoldier(h, pr.net); sfx('bash'); return; } // ağ isabet etti
    if (pr.burn && h && !h.dead) soldierDot(h, pr.burn.dps, pr.burn.t, '255,140,60');
    if (pr.stunHit && h && !h.dead && !h.wall) h.stunT = Math.max(h.stunT || 0, pr.stunHit);
    if (h && !h.dead && !h.removed) {
      damageSoldier(h, pr.edmg, pr.from);
      if (pr.kind === 'axe') sfx('clash');
      for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', add: true, x: pr.tx + rand(-4, 4), y: pr.ty + rand(-4, 4), vx: rand(-40, 40), vy: rand(-50, 10), drag: 3,
        col: pr.kind === 'hex' ? '140,255,110' : '255,230,190', s0: 3, s1: 0.5, life: 0.35 });
    }
    return;
  }
  if (pr.ballistic) { // tahmin noktasına uçar; son %40'ta hedefe yumuşakça döner (isabet hissi; ani kıvrılma yok)
    if (pr.target && !pr.target.dead && pr.t > 0) {
      const w = clamp((pr.t / pr.dur - 0.6) / 0.4, 0, 1), s3 = w * w * (3 - 2 * w);
      pr.tx = lerp(pr.ax, pr.target.x, s3); pr.ty = lerp(pr.ay, aimY(pr.target), s3); pr.fy = lerp(pr.fy0, pr.target.y, s3);
    }
  } else if (pr.target && !pr.target.dead) { pr.tx = pr.target.x; pr.ty = aimY(pr.target); }
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
        if (NECRO) emit(G.parts, { kind: 'dot', x: q.x, y: q.y, vx: rand(-8, 8), vy: rand(0, 20), g: 160, col: '#7ae04a', s0: 1.6, s1: 0.8, life: 0.4 });
        else emit(G.parts, { kind: 'glow', x: q.x, y: q.y, vx: rand(-5, 5), vy: -8, col: '130,124,118', s0: 2.5, s1: 7, life: 0.5, a: 0.4 });
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
  if (pr.rain) { // ok yağmuru: düştüğü yerde küçük alan hasarı, ok yere saplanır
    for (const e of G.enemies) if (!e.dead && !e.under && dist(e.x, e.y, pr.tx, pr.fy) < pr.rain) damageEnemy(e, pr.dmg, 'phys', true, 'arrow');
    stickArrow(pr, null); dustPuff(pr.tx, pr.fy, 0.5);
    return;
  }
  if (pr.kind === 'rainarrow') {
    for (const e of G.enemies) {
      if (e.dead || dist(e.x, e.y, pr.tx, pr.ty) > pr.splash) continue;
      damageEnemy(e, pr.dmg, 'phys', true);
      if (pr.poison) poisonEnemy(e, pr.poison, pr.poisonT);
    }
    if (pr.poison) for (let i = 0; i < 4; i++) emit(G.parts, { kind: 'glow', add: true, x: pr.tx + rand(-6, 6), y: pr.ty + rand(-3, 3), vx: rand(-20, 20), vy: -rand(10, 40), drag: 2, col: i % 2 ? '140,255,80' : '200,255,140', s0: 3.5, s1: 0.5, life: 0.5 });
    else fxArrowHit(pr.tx, pr.ty, false);
    return;
  }
  // ----- kahraman güçleri -----
  if (pr.kind === 'ultsword') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying || dist(e.x, e.y, pr.tx, pr.ty) > pr.splash) continue;
      damageEnemy(e, pr.dmg, 'phys', true); stunEnemy(e, pr.stun);
    }
    G.effects.push({ kind: 'swordstuck', x: pr.tx, y: pr.ty, t: 0, dur: 1.3, rot: rand(-0.15, 0.15) });
    for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', x: pr.tx + rand(-6, 6), y: pr.ty, vx: rand(-40, 40), vy: -rand(10, 40), drag: 3, col: '210,190,160', s0: 3, s1: 7, life: 0.5, a: 0.5 });
    for (let i = 0; i < 4; i++) emit(G.parts, { kind: 'glow', add: true, x: pr.tx, y: pr.ty - 6, vx: rand(-60, 60), vy: -rand(30, 90), drag: 3, col: '255,235,170', s0: 2.5, s1: 0.4, life: 0.35 });
    shakeScreen(1.5, 0.1); sfx('clash');
    return;
  }
  if (pr.kind === 'ulthammer') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, pr.tx, pr.ty);
      if (d <= pr.splash) { damageEnemy(e, pr.dmg * (1 - 0.35 * d / pr.splash), 'magic', true); stunEnemy(e, pr.stun); }
    }
    for (const so of G.soldiers) {
      if (so.dead || dist(so.x, so.y, pr.tx, pr.ty) > pr.splash) continue;
      so.hp = Math.min(so.maxHp, so.hp + so.maxHp * pr.heal);
      G.effects.push({ kind: 'heal', x: so.x, y: so.y, t: 0, dur: 0.6 });
    }
    G.effects.push({ kind: 'ulthammer', x: pr.tx, y: pr.ty, t: 0, dur: 0.6 });
    G.effects.push({ kind: 'shock', x: pr.tx, y: pr.ty, r: pr.splash * 1.3, t: 0, dur: 0.5 });
    G.effects.push({ kind: 'pillar', x: pr.tx, y: pr.ty, col: '255,240,170', t: 0, dur: 0.7 });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), v = rand(50, 130);
      emit(G.parts, { kind: 'chunk', x: pr.tx + Math.cos(a) * 14, y: pr.ty, vx: Math.cos(a) * v, vy: -rand(70, 150), g: 420, col: '#8a6a44', s0: 3, s1: 2, life: 0.8, vr: rand(-10, 10), floor: pr.ty + rand(-6, 8) });
    }
    shakeScreen(5, 0.35); sfx('boom'); sfx('bash');
    return;
  }
  if (pr.kind === 'ultcat') {
    let e = pr.target && !pr.target.dead && dist(pr.target.x, pr.target.y, pr.tx, pr.ty) < 30 ? pr.target : null;
    if (!e) e = enemiesNear(pr.tx, pr.ty, 30, true)[0] || null;
    if (e) {
      damageEnemy(e, pr.dmg * pr.hits, 'phys', true);
      e.markT = Math.max(e.markT || 0, pr.mark);
      const face = pr.tx >= pr.sx ? 1 : -1;
      for (let i = 0; i < pr.hits; i++) {
        G.effects.push({ kind: 'slash', x: e.x + rand(-5, 5), y: e.y - rand(8, 18), face: i % 2 ? -face : face, col: '#d8b8ff', size: 1.2, t: -i * 0.12, dur: 0.2 });
      }
    }
    G.effects.push({ kind: 'catpounce', x: pr.tx, y: pr.ty, face: pr.tx >= pr.sx ? 1 : -1, t: 0, dur: 0.45 });
    sfx('whirl');
    return;
  }
  if (pr.kind === 'ultpillar') {
    for (const e of G.enemies) if (!e.dead && dist(e.x, e.y, pr.tx, pr.ty) <= pr.splash) damageEnemy(e, pr.dmg, 'magic', true);
    G.zones.push({ x: pr.tx, y: pr.ty, r: pr.splash * 0.9, dps: pr.burn, dtype: 'true', kind: 'fire', t: 0, life: pr.burnT, fxT: 0 });
    G.effects.push({ kind: 'firepillar', x: pr.tx, y: pr.ty, t: 0, dur: 0.8 });
    for (let i = 0; i < 14; i++) emit(G.parts, { kind: 'glow', add: true, x: pr.tx + rand(-8, 8), y: pr.ty - rand(0, 50), vx: rand(-30, 30), vy: -rand(40, 120), drag: 1.5, col: i % 2 ? '255,140,40' : '255,220,110', s0: rand(5, 9), s1: 1, life: rand(0.4, 0.8) });
    shakeScreen(1.5, 0.12); sfx('boom');
    return;
  }
  if (pr.kind === 'bossthrow') {
    const t = pr.tower;
    fxExplosion(pr.tx, pr.ty + 18, 26, false);
    if (t && G.towers.includes(t)) { t.disabledT = Math.max(t.disabledT || 0, pr.stun); t.disabledKind = 'stun'; floatText(t.x, t.y - 60, 'Sersemledi!', '#ffd08a'); if (Math.random() < 0.5) mortSay('stunned'); }
    sfx('boom');
    return;
  }
  if (pr.kind === 'vapor') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, pr.tx, pr.ty);
      if (d <= pr.splash) {
        damageEnemy(e, pr.dmg * (1 - 0.4 * d / pr.splash), 'phys', false, pr.src); e.rotT = 4; if (pr.stun && Math.random() < pr.stun) stunEnemy(e, 0.5);
        if (pr.plague && !e.dead) { poisonEnemy(e, pr.plague, 4); e.plagueT = 4; e.plagueDps = pr.plague; } // kara veba
      }
    }
    // gaz bulutu yolu boylamasına kaplar: hedef noktası ve yolun iki yanındaki iki halka, 2 sn kalır
    const R = pr.splash * (pr.big ? 0.75 : 0.6), spots = [[pr.tx, pr.ty]];
    if (pr.path) for (const k of [-1, 1]) { const q = pathPos(pr.path, pr.along + k * R * 1.1); spots.push([q.x, q.y]); }
    for (const [x, y] of spots) G.zones.push({ x, y, r: R, dps: pr.gas, t: 0, life: 2, fxT: 0, src: 'blast', kind: 'plague', gas: true, seed: rand(0, 9) });
    fxPlagueSplash(pr.tx, pr.ty, pr.splash);
    if (pr.body) { for (let i = 0; i < 10; i++) emit(G.parts, { kind: 'chunk', x: pr.tx + rand(-6, 6), y: pr.ty - rand(0, 6), vx: rand(-90, 90), vy: -rand(80, 180), g: 520, vr: rand(-12, 12), rot: rand(0, 6), col: i % 3 ? '#efe6cc' : '#7a3a2a', s0: rand(1.4, 2.4), s1: 1, life: rand(0.5, 0.8) }); shakeScreen(2.5, 0.2); sfx('bash'); }
    return;
  }
  if (pr.kind === 'shell' || pr.kind === 'meteor') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, pr.tx, pr.ty);
      if (d <= pr.splash) damageEnemy(e, pr.dmg * (1 - 0.5 * d / pr.splash), 'phys', false, pr.src);
    }
    if (pr.stun) for (const e of G.enemies) if (!e.dead && !e.def.flying && dist(e.x, e.y, pr.tx, pr.ty) <= pr.splash * 0.8 && Math.random() < pr.stun) stunEnemy(e, 0.6);
    if (pr.napalm) G.zones.push({ x: pr.tx, y: pr.ty, r: pr.splash * 0.75, dps: pr.napalm, t: 0, life: 3, fxT: 0, src: 'blast', kind: NECRO ? 'plague' : undefined });
    if (pr.plague) {
      // Veba Kazanı: düştüğü yerde zehirli gaz kalır (sürekli hasar), içindekilerin zırhı çürür
      G.zones.push({ x: pr.tx, y: pr.ty, r: pr.splash * 0.6, dps: pr.plague, t: 0, life: 2.5, fxT: 0, src: 'blast', kind: 'plague' });
      for (const e of G.enemies) if (!e.dead && dist(e.x, e.y, pr.tx, pr.ty) <= pr.splash) e.rotT = 4;
    }
    if (pr.kind === 'meteor') fxMeteorImpact(pr.tx, pr.ty, pr.splash, pr.burn);
    else if (NECRO) fxPlagueSplash(pr.tx, pr.ty, pr.splash);
    else fxExplosion(pr.tx, pr.ty, pr.splash, false);
    sfx(pr.kind === 'meteor' ? 'meteor' : 'boom');
  } else if (pr.ballistic && !(pr.target && !pr.target.dead)) {
    stickArrow(pr, null); // hedef uçuşta öldü: ok yere saplanır
  } else if (pr.target && !pr.target.dead) {
    const e = pr.target;
    if (pr.kind === 'bolt') fxMagicHit(pr.tx, pr.ty, pr.frost);
    else if (pr.kind === 'fireball') fxFireHit(pr.tx, pr.ty, pr.inferno);
    else if (pr.shard) fxShardHit(pr.tx, pr.ty, pr.crit);
    else fxArrowHit(pr.tx, pr.ty, e.def.armor >= 0.5 || pr.pierce);
    if (pr.kind === 'arrow') sfx(e.def.armor >= 0.5 ? 'armorhit' : 'arrowhit'); // zırhlıya saplanan cıvata metal tınlar
    if (pr.inferno) for (const o of G.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < pr.inferno) damageEnemy(o, pr.dmg * 0.5, 'magic');
    if (pr.splash) {
      for (const o of G.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < pr.splash) damageEnemy(o, pr.dmg * 0.55, pr.dtype, false, pr.src);
      if (pr.burn) G.zones.push({ x: e.x, y: e.y, r: pr.splash * 0.8, dps: 8, dtype: 'true', kind: 'fire', t: 0, life: 1.5, fxT: 0 });
      G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: pr.splash, col: pr.burn ? '255,160,70' : '255,240,190', t: 0, dur: 0.3 });
      if (pr.big) fxExplosion(e.x, e.y, pr.splash, false);
    }
    if (pr.crit) impactFx(e.x, aimY(e), '235,255,220');
    if (pr.poison) poisonEnemy(e, pr.poison, 3);
    if (pr.imbue) applyImbue(e, pr.imbue, pr.src); // silah büyüsü
    if (pr.slow) slowEnemy(e, pr.slow.k, pr.slow.t);
    if (pr.nail) { e.nailT = 4; e.nailK = pr.nail; } // ruh çivisi
    damageEnemy(e, pr.dmg, pr.dtype, false, pr.src, pr.pen || 0);
    if (pr.ballistic) stickArrow(pr, e);
    if (pr.knock && !e.dead && !e.def.chief && !e.def.boss && pushable(e) && !e.blocker) { e.knockT = KNOCK.t * 1.4; e.knockV = 110; e.hopT = Math.max(e.hopT || 0, 0.2); } // ağır cıvata geri iter
    if (pr.pierceLine) { // balista mızrağı: hedefin arkasında aynı doğrultudaki düşmanları da deler
      const L0 = Math.hypot(pr.tx - pr.sx, pr.ty - pr.sy) || 1, ux = (pr.tx - pr.sx) / L0, uy = (pr.ty - pr.sy) / L0;
      G.enemies.filter(o => o !== e && !o.dead && !o.under).map(o => { const ax = o.x - e.x, ay = aimY(o) - pr.ty, along = ax * ux + ay * uy; return { o, along, off: Math.abs(ax * uy - ay * ux) }; })
        .filter(q => q.along > 0 && q.along < (pr.pierceLen || 110) && q.off < 18).sort((a, b) => a.along - b.along).slice(0, pr.pierceLine)
        .forEach(q => { damageEnemy(q.o, pr.dmg * (pr.pierceK || 0.6), 'true', false, pr.src); impactFx(q.o.x, aimY(q.o), '255,120,110', 0.9); });
    }
    if (pr.drain) for (const s of G.soldiers) { // ruh emici: hedefin yakınındaki iskeletler iyileşir
      if (s.dead || s.wall || s.hp >= s.maxHp || dist(s.x, s.y, e.x, e.y) > 75) continue;
      s.hp = Math.min(s.maxHp, s.hp + pr.dmg * pr.drain);
      for (let i = 0; i < 3; i++) emit(G.parts, { kind: 'glow', add: true, x: lerp(e.x, s.x, i / 3), y: lerp(aimY(e), s.y - 14, i / 3), vy: -rand(10, 30), col: '120,255,150', s0: 3, s1: 0.5, life: 0.4 });
    }
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

// ---------- büyüler ve kahraman güçleri ----------
// Sol alttaki düğmeler: takımdaki her kahramanın kendi gücü (ult0, ult1)
// büyü açık mı (unlock: o bölüm kazanılmış olmalı)
// şapelde büyü geliştirme (bölüm içi, altınla): her büyü 2 kademe; her kademe beklemeyi %10 kısaltır
const SPELL_UP = { cost: [120, 200],
  nm_raise: ['+3 dirilen, dirilenler %25 dayanıklı', 'Dirilenler %40 sert vurur, +10 sn kalır'],
  nm_fear: ['Korku alanı %25 geniş', 'Korku +1,5 sn sürer'],
  nm_wall: ['Duvar %50 dayanıklı', 'Duvar +3 sn kalır'],
  nm_burst: ['Patlama hasarı +%35', 'Patlama alanı %25 geniş'],
  nm_golem: ['Golem +8 sn yaşar', 'Golem %40 daha canlı'] };
const spellRank = (id) => (G && G.spellUp && G.spellUp[id]) || 0;
function spellStats(id) { // kademelere göre büyünün o anki değerleri
  const S = NECRO_SPELLS[id], r = spellRank(id); if (!r) return S;
  const o = Object.assign({}, S);
  if (id === 'nm_raise') { o.max = S.max + 3; o.minion = Object.assign({}, S.minion, { hp: S.minion.hp * 1.25 }); if (r >= 2) Object.assign(o.minion, { dmg: S.minion.dmg.map(v => v * 1.4), life: S.minion.life + 10 }); }
  if (id === 'nm_fear') { o.r = S.r * 1.25; if (r >= 2) o.t = S.t + 1.5; }
  if (id === 'nm_wall') { o.hp = S.hp * 1.5; if (r >= 2) o.life = S.life + 3; }
  if (id === 'nm_burst') { o.dmg = S.dmg * 1.35; if (r >= 2) o.r = S.r * 1.25; }
  if (id === 'nm_golem') { o.life = S.life + 8; if (r >= 2) { o.hp = S.hp * 1.4; o.hpPer = S.hpPer * 1.4; } }
  return o;
}
function buySpellUp(id) {
  const r = spellRank(id), cost = SPELL_UP.cost[r];
  if (cost == null || G.gold < cost) return false;
  G.gold -= cost; G.spellUp = G.spellUp || {}; G.spellUp[id] = r + 1;
  const c = G.castle; floatText(c.x, c.y - 90, NECRO_SPELLS[id].name + ' ' + (r + 1) + '!', '#c8ffb0'); sfx('upgrade');
  G.effects.push({ kind: 'ring', x: c.x, y: c.y - 20, r: 50, col: NECRO_SPELLS[id].col, t: 0, dur: 0.5 });
  return true;
}
const necroSpellOn = (id) => { const u = NECRO_SPELLS[id].unlock; return u == null || (save.stars[u] || 0) > 0; };
const spellIds = () => (NECRO ? ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem'].filter(necroSpellOn) : []).concat(G.heroes.map((h, i) => 'ult' + i));
// Oyun içi arayüz ölçüsü (Caner, 10 Eki: telefonda parmakla dokunmak için küçüktü): düğmeler %25 büyük, aralıklar %10 açık,
// dokunma alanı görünenden %40 geniş (UI_HIT); sol üst can/altın şeridi ve boss can çubuğu da büyütüldü
const UI_K = 1.25, UI_GAP = 1.1, UI_HIT = 0.4;
const SPELL_R = 24 * UI_K, SPELL_STEP = 2 * SPELL_R + 10 * UI_GAP;
const spellBtn = (i) => ({ x: EDGE.l + 18 + 2 * 28 * UI_K + 16 * UI_GAP + SPELL_R + i * SPELL_STEP, y: EDGE.b - 14 - SPELL_R, r: SPELL_R });
// sol alttaki portre + büyü düğmelerinin sağ kenarı: alt paneller bunun sağından başlar (üst üste binmesin)
const hudLeft = () => spellBtn(spellIds().length - 1).x + SPELL_R + 8;
function spellInfo(id) {
  const fast = upgRank('spells') >= 3 ? 0.75 : 1;
  if (NECRO_SPELLS[id]) { const S = NECRO_SPELLS[id]; return { name: S.name, cd: S.cd * fast * (1 - 0.1 * spellRank(id)), necro: S, U: S }; }
  const h = G.heroes[+id.slice(3)], U = HERO_ULT[h.id];
  return { name: U.name, cd: U.cd * fast, hero: h, U };
}
function castSpell(id, x, y) {
  if (NECRO_SPELLS[id] && G.mod && G.mod.nospell) { floatText(x, y - 20, 'Bu gece büyü yok!', '#d8a8ff'); sfx('error'); return; }
  if (NECRO_SPELLS[id]) { if (castNecro(id, x, y) === false) return; }
  else { hitBy = 'hero'; const ok = castUlt(G.heroes[+id.slice(3)], x, y); hitBy = null; if (ok === false) return; } // yanlış yere: bekleme başlamaz
  if (G.stats) G.stats.spells++;
  G.spells[id] = spellInfo(id).cd;
}
// ----- Mortimer'ın büyüleri -----
function castNecro(id, x, y) {
  const S = spellStats(id), c = G.castle, m = mortimerPoint();
  G.mortCast = MORT_CAST_T; // balkonda tırpanını kaldırır (büyü kareleri)
  if (id === 'nm_raise') {
    const alive = G.soldiers.filter(s => s.minion && !s.dead).length;
    const bodies = G.effects.filter(f => f.kind === 'corpse' && f.raisable && f.t > 0.3 && f.t < f.dur - 0.15).sort((a, b) => a.t - b.t).slice(0, Math.max(0, S.max - alive));
    if (!bodies.length) { G.mortCast = 0; floatText(m.x, m.y - 40, 'Ceset yok!', '#c8c8c8'); sfx('error'); return false; }
    G.raiseT = 1.2; mortSay('raise', true);
    bodies.forEach((f, i) => { raiseMinion(f, i * 0.08); f.t = f.dur; }); cnt('raise', bodies.length);
    G.effects.push({ kind: 'ring', x: m.x, y: m.y - 10, r: 70, col: S.col, t: 0, dur: 0.7 });
    sfx('portal'); sfx('raise');
  } else if (id === 'nm_golem') {
    const q = nearestOnPaths(G.paths, x, y);
    if (q.d > 60) { G.mortCast = 0; floatText(x, y - 20, 'Yolun yakınına koy!', '#c8c8c8'); sfx('error'); return false; }
    const bodies = G.effects.filter(f => f.kind === 'corpse' && !f.fly && f.t < f.dur - 0.1 && (f.name || '').startsWith('enemy_')).slice(0, S.max);
    if (bodies.length < S.min) { G.mortCast = 0; floatText(q.x, q.y - 30, `En az ${S.min} ceset gerek!`, '#c8c8c8'); sfx('error'); return false; }
    const n = bodies.length, k = 1 + (n - S.min) * S.dmgPer;
    for (const f of bodies) { // cesetler yeşil izlerle golemin doğacağı yere akar
      for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', add: true, x: f.x + rand(-5, 5), y: f.y - rand(0, 8), vx: (q.x - f.x) * rand(1.2, 2), vy: (q.y - f.y) * rand(1.2, 2) - 20, drag: 1.2,
        col: i % 2 ? '150,255,110' : '190,110,255', s0: rand(3, 5), s1: 0.5, life: rand(0.5, 0.8) });
      f.t = f.dur;
    }
    const g = { militia: true, golem: true, zombie: true, x: q.x, y: q.y, rx: q.x, ry: q.y, hp: S.hp + S.hpPer * n, maxHp: S.hp + S.hpPer * n, dmg: [S.dmg[0] * k, S.dmg[1] * k], armor: 0.3,
      rate: 1.3, speed: 34, engage: 120, atk: 0, target: null, dead: false, face: 1, anim: 0, slot: 0, life: S.life, born: G.t + 0.5,
      big: 'unit_corpsegolem', bh: BIG_H.golem * (0.85 + 0.03 * n), aoe: 0.5 };
    G.soldiers.push(g);
    G.effects.push({ kind: 'pillar', x: q.x, y: q.y, col: S.col, t: 0, dur: 1 }); G.effects.push({ kind: 'ring', x: q.x, y: q.y, r: 50, col: '190,110,255', t: 0, dur: 0.6 });
    shakeScreen(5, 0.5); sfx('portal'); sfx('stomp'); floatText(q.x, q.y - 60, `${n} ceset!`, '#b8ff8a'); mortSay('raise', true);
  } else if (id === 'nm_wall') {
    // yolun en yakın noktasına, yola dik kemik duvar
    const q = nearestOnPaths(G.paths, x, y);
    if (q.d > 45) { G.mortCast = 0; floatText(x, y - 20, 'Yolun üstüne koy!', '#c8c8c8'); sfx('error'); return false; }
    cnt('wall');
    const dir = pathPos(q.p, q.along);
    G.soldiers.push({ militia: true, wall: true, x: q.x, y: q.y, rx: q.x, ry: q.y, hp: S.hp, maxHp: S.hp, dmg: [0, 0], armor: 0.3, rate: 99, speed: 0,
      engage: 0, atk: 0, target: null, dead: false, face: 1, anim: 0, slot: 0, life: S.life, born: G.t, dx: dir.dx, dy: dir.dy, seed: rand(0, 9) });
    G.effects.push({ kind: 'dust', x: q.x, y: q.y, t: 0, dur: 0.9 });
    G.effects.push({ kind: 'ring', x: q.x, y: q.y, r: 52, col: '110,255,130', t: 0, dur: 0.5 });
    impactFx(q.x, q.y - 10, '200,255,200', 1.2); shakeScreen(4, 0.35); sfx('bonewall'); mortSay('wall', true);
  } else if (id === 'nm_fear') {
    G.effects.push({ kind: 'ring', x, y, r: S.r, col: S.col, t: 0, dur: 0.6 }); mortSay('fear', true);
    // Mortimer'dan hedefe uzanan mor ruh dalgası
    for (let i = 0; i < 18; i++) { const k = i / 17; emit(G.parts, { kind: 'glow', add: true, x: lerp(m.x, x, k) + rand(-6, 6), y: lerp(m.y - 18, y, k) + rand(-6, 6), vy: -rand(5, 20), col: S.col, s0: rand(3, 5), s1: 0.5, life: rand(0.4, 0.8) }); }
    let nScream = 0, nGhost = 0;
    for (const e of G.enemies) {
      if (e.dead || e.siege !== undefined || dist(e.x, e.y, x, y) > S.r) continue;
      if (e.def.machine) continue; // makine korkmaz
      // büyü direnci korkuyu kısaltır; bosslar çok az etkilenir
      const k = e.def.chief ? 0.22 : clamp(1 - 0.8 * (e.def.mr || 0), 0.3, 1), t = S.t * k;
      if (t < 0.9) { floatText(e.x, e.y - 30, 'Direndi!', '#c8c8e8'); e.fearT = Math.max(e.fearT || 0, t); continue; }
      e.fearT = t; cnt('fear'); e.hopT = 0.4; e.fearMax = t;
      if (nGhost < (S.ghosts || 10)) { e.fearGhost = { ph: rand(0, 6), t: 0 }; nGhost++; } // peşinden ruh gelir
      floatText(e.x, e.y - 30, '!', '#d8a8ff'); nScream++;
    }
    // birkaç tanesi çığlık atar (hepsi atarsa kulak tırmalar)
    for (let i = 0; i < Math.min(3, nScream); i++) setTimeout(() => sfx('scream'), i * 140 + rand(0, 60));
    sfx('roar'); sfx('fear');
  } else if (id === 'nm_burst') {
    const bodies = G.effects.filter(f => f.kind === 'corpse' && !f.air && f.t > 0.3 && f.t < f.dur - 0.1 && dist(f.x, f.y, x, y) <= S.r);
    if (!bodies.length) { G.mortCast = 0; floatText(x, y - 20, 'Burada ceset yok!', '#c8c8c8'); sfx('error'); return false; }
    G.effects.push({ kind: 'ring', x, y, r: S.r, col: S.col, t: 0, dur: 0.5 }); mortSay('burst', true); cnt('burst', bodies.length);
    for (let i = 0; i < 16; i++) { const k = i / 15; emit(G.parts, { kind: 'glow', add: true, x: lerp(m.x, x, k) + rand(-6, 6), y: lerp(m.y - 18, y, k) + rand(-6, 6), vy: -rand(5, 20), col: S.col, s0: rand(3, 5), s1: 0.5, life: rand(0.3, 0.6) }); }
    hitBy = 'burst';
    for (const f of bodies) {
      f.t = f.dur; // ceset parçalanır
      fxPlagueSplash(f.x, f.y, S.blast);
      impactFx(f.x, f.y - 8, S.col, 1.6);
      for (let i = 0; i < 9; i++) emit(G.parts, { kind: 'chunk', x: f.x + rand(-6, 6), y: f.y - rand(0, 8), vx: rand(-90, 90), vy: -rand(90, 200), g: 520, vr: rand(-12, 12), rot: rand(0, 6), col: i % 3 ? '#efe6cc' : '#7a3a2a', s0: rand(1.4, 2.4), s1: 1, life: rand(0.5, 0.8) });
      for (const e of G.enemies) {
        if (e.dead || e.under || dist(e.x, e.y, f.x, f.y) > S.blast) continue;
        damageEnemy(e, S.dmg + e.maxHp * S.pct * (e.def.chief ? 0.5 : 1), 'magic', false, 'burst');
        if (!e.dead) poisonEnemy(e, S.poison[0], S.poison[1]);
      }
    }
    hitBy = null;
    shakeScreen(3 + Math.min(4, bodies.length), 0.35); sfx('splash'); sfx('stomp');
  }
}
// dirilen ceset: en yakın yol noktasından yolun başına (düşman girişine) doğru yürür; yolda düşmana rastlarsa dövüşür
function zombieHunt(s) {
  let best = null, bd = 1e9;
  for (const o of G.enemies) {
    if (o.dead || o.def.flying || o.def.noblock || o.under || o.reviveT > 0) continue;
    const d = dist(o.x, o.y, s.x, s.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  // yoldan yürür: önce en yakın yol noktasına çıkar, sonra yol boyunca düşmana doğru adım adım ilerler (yol dışına kesmez);
  // hedef menzile girince normal dövüş seçimi devralır
  const me = nearestOnPaths(G.paths, s.x, s.y);
  if (me.d > 8) { s.rx = me.x; s.ry = me.y; return; }
  const tg = nearestOnPaths([me.p], best.x, best.y), q = pathPos(me.p, me.along + clamp(tg.along - me.along, -30, 30));
  s.rx = q.x; s.ry = q.y;
}
// ölen düşman, diriltme açıkken yerinde iskelet minyon olarak kalkar
function raiseMinion(e, delay = 0) {
  const S = spellStats('nm_raise'), M = S.minion, up = upgRank('spells') >= 2 ? 1.25 : 1; // gelişme: dirilenler %25 dayanıklı
  if (G.soldiers.filter(s => s.minion && !s.dead).length >= S.max) return;
  if (G.stats) G.stats.raised++;
  const s = { militia: true, merc: true, minion: true, x: e.x, y: e.y, rx: e.x, ry: e.y, hp: M.hp * up, maxHp: M.hp * up, dmg: M.dmg, armor: M.armor,
    rate: 1, speed: 40, engage: 60, atk: 0, target: null, dead: false, face: e.face || 1, anim: 0, slot: G.soldiers.length % 4, life: M.life * up, born: G.t + delay };
  // ceset düşmanın kendi kılığında kalkar (çürümüş renkte), en yakın düşmana saldırır
  if (e.name) {
    const D = ENEMIES[e.name.slice(6)];
    s.zname = e.name; s.zrig = e.rig; s.zh = e.h || (D ? D.r * 2.6 : 30); s.zombie = true;
  }
  G.soldiers.push(s);
  G.effects.push({ kind: 'pillar', x: e.x, y: e.y, col: '140,255,140', t: 0, dur: 0.7 });
  for (let i = 0; i < 8; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-8, 8), y: e.y - rand(0, 20), vy: -rand(20, 45), col: '140,255,120', s0: rand(2, 4), s1: 0.5, life: rand(0.5, 0.9) });
}
// Mortimer şapelin ön balkonunda durur. Hasar evresine göre (castle_1..3): at = ayak noktası (görsel oranı),
// rail = korkuluk dikdörtgeni (x0, y0, x1, y1; Mortimer'dan sonra yeniden çizilir, ayakları korkuluğun arkasında kalır;
// 3. evrede korkuluk kırık). MORT_PX: Mortimer'ın boyu, kale görselinin pikseliyle (balkon kapısından biraz uzun).
const MORT_STAGE = [null,
  { at: [0.454, 0.558], rail: [0.29, 0.548, 0.625, 0.6] },
  { at: [0.454, 0.562], rail: [0.29, 0.551, 0.625, 0.6] },
  { at: [0.515, 0.558], rail: null }];
const MORT_PX = 125;
// Avlulu şapel (Gemini, castle_avlu_1 kapı sağlam / _2 kapı kırık): cesetlerden duvar, kemik kapı, bahçede iki muhafız.
// Oranlar görsele göre: kapı eşiği (gate), balkon (at, rail, px: Mortimer boyu görsel pikseliyle), şapel kapısı (door), muhafız yerleri (guards)
const AVLU = { w: 270, gate: [0.506, 0.959], door: [0.5, 0.57], at: [0.498, 0.383], rail: [0.444, 0.352, 0.554, 0.402], px: 100, guards: [[0.455, 0.7], [0.556, 0.7]], front: 0.8 };
const AVLU_ON = false; // 10 Eki: Caner duvarlı avluyu istemedi; yeni heybetli kale gelene kadar şapel (castle_1..3)
const avluOn = () => AVLU_ON && NECRO && !!spr('castle_avlu_1');
const isAvlu = (im) => im && (im === spr('castle_avlu_1') || im === spr('castle_avlu_2'));
// avlu görselinde oranlı noktayı dünya koordinatına çevirir
function avluPt(f) {
  const c = G.castle, im = spr('castle_avlu_1'), cp = castlePlace(c.x, c.y, im), h = cp.w * im.height / im.width;
  return { x: cp.x - cp.w / 2 + f[0] * cp.w, y: cp.y - h + f[1] * h };
}
function castleStage() { const r = G.lives / G.maxLives; return r > 0.6 ? 1 : r > 0.3 ? 2 : 3; }
// Heybetli kale (10 Eki, Gemini): kafatası çenesi kapı, önde balkon. gate = kapı eşiği (yolun ucu), at = Mortimer'ın ayağı,
// rail = Mortimer'ın önüne yeniden çizilen korkuluk bandı, px = Mortimer boyu (görsel pikseli), w = oyundaki genişlik
const KEEP = { w: 178, gate: [0.45, 0.85], at: [0.478, 0.57], rail: [0.36, 0.525, 0.61, 0.6], px: 130 }; // Mortimer balkonun ortasında, önde
const isKeep = (im) => im && [1, 2, 3].some(n => im === spr('castle_keep_' + n));
function castleStageSprite() {
  if (NECRO && spr('castle_keep_1') && !avluOn()) { const st = castleStage(); return spr('castle_keep_' + st) || (st > 1 && spr('castle_keep_2')) || spr('castle_keep_1'); } // can azaldıkça hasarlı hal
  if (avluOn()) return spr(G.gate && G.gate.hp <= 0 ? 'castle_avlu_2' : 'castle_avlu_1') || spr('castle_avlu_1');
  return spr('castle_' + castleStage()) || spr('castle_1') || spr('tower_barracks_3');
}
const mortStage = (im) => (isKeep(im) ? KEEP : isAvlu(im) ? AVLU : MORT_STAGE[castleStage()] || MORT_STAGE[1]);
function mortimerPoint() {
  const c = G.castle, im = castleStageSprite();
  if (!im) return { x: c.x, y: c.y - 60, h: 30 };
  const cp = castlePlace(c.x, c.y, im), h = cp.w * im.height / im.width, S = mortStage(im);
  return { x: cp.x - cp.w / 2 + S.at[0] * cp.w, y: cp.y - h + S.at[1] * h, h: (S.px || MORT_PX) * cp.w / im.width };
}
// ----- kemik kapı: düşmanlar önce kapıyı kırmalı; kırılınca avluya dalıp şapel kapısına yürürler, muhafızlar karşılar -----
const GATE = { hp: 260, perLvl: 30, machine: 8, guard: { hp: 140, dmg: [5, 9], armor: 0.25, respawn: 14 } };
function setupGate() {
  G.gate = null; G.inner = null;
  if (!avluOn()) return;
  const max = GATE.hp + GATE.perLvl * G.idx, c = G.castle, d = avluPt(AVLU.door);
  G.gate = { hp: max, max, hitT: 0, sndT: 0 };
  G.inner = buildPath([[c.x, c.y], [c.x, c.y - 14], [d.x, d.y]]);
  AVLU.guards.forEach((f, i) => {
    const q = avluPt(f);
    G.soldiers.push({ guard: true, militia: false, x: q.x, y: q.y, rx: q.x, ry: q.y, hp: GATE.guard.hp, maxHp: GATE.guard.hp, dmg: GATE.guard.dmg, armor: GATE.guard.armor,
      rate: 1.1, speed: 50, engage: 52, atk: 0, target: null, dead: false, respawnT: 0, face: i ? -1 : 1, anim: rand(0, 5), gear: 2, slot: i });
  });
}
function gateHit(e, dmg) {
  const g = G.gate; if (!g || g.hp <= 0) return;
  g.hp -= dmg; g.hitT = 0.15;
  const c = G.castle;
  if ((g.sndT -= 1) <= 0) { g.sndT = 3; sfx('bash'); }
  for (let i = 0; i < 2; i++) emit(G.parts, { kind: 'chunk', x: c.x + rand(-12, 12), y: c.y - rand(6, 22), vx: rand(-40, 40), vy: -rand(40, 100), g: 420, vr: rand(-10, 10), rot: rand(0, 6), col: '#efe6cc', s0: rand(1, 1.8), s1: 0.8, life: rand(0.3, 0.5) });
  if (g.hp <= 0) { // kırıldı
    g.hp = 0; shakeScreen(5, 0.45); sfx('boom'); mortSay('gatebreak', true);
    floatText(c.x, c.y - 50, 'Kapı kırıldı!', '#ff9a8a');
    for (let i = 0; i < 18; i++) emit(G.parts, { kind: 'chunk', x: c.x + rand(-20, 20), y: c.y - rand(0, 30), vx: rand(-110, 110), vy: -rand(80, 220), g: 480, vr: rand(-12, 12), rot: rand(0, 6), col: i % 3 ? '#efe6cc' : '#8a7a5a', s0: rand(1.4, 2.6), s1: 1, life: rand(0.5, 0.9) });
    G.effects.push({ kind: 'dust', x: c.x, y: c.y, t: 0, dur: 0.8 });
  }
}
function repairGate() {
  const g = G.gate; if (!g || g.hp >= g.max) return;
  const was = g.hp <= 0; g.hp = g.max;
  const c = G.castle;
  if (was) { floatText(c.x, c.y - 50, 'Kapı onarıldı', '#9dff8a'); G.effects.push({ kind: 'pillar', x: c.x, y: c.y, col: '140,255,140', t: 0, dur: 0.7 }); sfx('build'); }
}
function drawGateBar() {
  const g = G.gate; if (!g || g.hp >= g.max || g.hp <= 0) return;
  const c = G.castle, w = 40, x = c.x - w / 2, y = c.y - 46;
  roundRect(x - 2, y - 2, w + 4, 7, 3, 'rgba(20,14,10,0.85)', '#cfc4a8', 1);
  ctx.fillStyle = g.hitT > 0 ? '#fff' : '#e8dcc0'; ctx.fillRect(x, y, w * g.hp / g.max, 3);
}
// büyü düğmesi simgeleri: diriltme = yerden kalkan iskelet, korku = çığlık atan hayalet
function drawNecroGlyph(id, r) {
  if (id === 'nm_wall') {
    // kemik çit: dört kazık, iki kaburga, ortada kafatası
    for (let i = 0; i < 4; i++) { const x = -r * 0.5 + i * r * 0.33, hh = r * (0.7 + (i % 2) * 0.18); roundRect(x - 2, r * 0.45 - hh, 4, hh, 2, '#efe6cc', '#2a1c10', 1); }
    ctx.strokeStyle = '#d8cfb0'; ctx.lineWidth = 2;
    for (const yy of [0, r * 0.22]) { ctx.beginPath(); ctx.moveTo(-r * 0.62, yy); ctx.quadraticCurveTo(0, yy - 4, r * 0.62, yy); ctx.stroke(); }
    drawSkullIcon(0, -r * 0.42, r * 0.28);
    return;
  }
  if (id === 'nm_burst') {
    // ortada çatlak kafatası, çevresinde yeşil patlama dişleri
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r * 0.95, '170,255,90', 0.35 + Math.sin(time * 6) * 0.1); ctx.restore();
    ctx.fillStyle = '#b8ff6a'; ctx.strokeStyle = '#1a3008'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = r * (i % 2 ? 0.48 : 0.78); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    drawSkullIcon(0, r * 0.05, r * 0.42);
    ctx.strokeStyle = '#140c18'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.32); ctx.lineTo(r * 0.06, -r * 0.18); ctx.lineTo(-r * 0.02, -r * 0.06); ctx.stroke();
    return;
  }
  if (id === 'nm_golem') {
    const im = spr('unit_corpsegolem');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r, '150,255,110', 0.3 + Math.sin(time * 5) * 0.08); ctx.restore();
    if (im) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.clip(); drawSprite(ctx, im, 0, r * 1.15, r * 2.1 * im.width / im.height * 1.15); ctx.restore(); }
    return;
  }
  if (id === 'nm_raise') {
    const im = spr('unit_skel_1');
    ctx.fillStyle = 'rgba(30,16,8,0.7)'; ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 0.75, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    if (im) drawSprite(ctx, im, 0, r * 0.75, r * 1.5 * im.width / im.height);
    if (G.raiseT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r, '120,255,140', 0.4 + Math.sin(time * 8) * 0.15); ctx.restore(); }
    return;
  }
  const w = Math.sin(time * 4) * 1.5;
  if (id === 'nm_scream') {
    ctx.save(); ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(r * 0.05, r * 0.1, r * (0.62 + i * 0.2), -0.5, 0.5); ctx.stroke(); }
    ctx.restore(); ctx.save(); ctx.translate(-r * 0.15, 0); ctx.scale(0.85, 0.85);
  } else ctx.save();
  ctx.save(); ctx.translate(0, w * 0.3);
  ctx.fillStyle = 'rgba(240,228,255,0.95)'; ctx.strokeStyle = '#2a1640'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.5, Math.PI, 0);
  ctx.lineTo(r * 0.5, r * 0.5);
  for (let i = 0; i < 4; i++) { const x0 = r * 0.5 - (i + 0.5) * r * 0.25; ctx.quadraticCurveTo(x0, r * (i % 2 ? 0.66 : 0.34) + w, x0 - r * 0.125, r * 0.5); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a0a2a';
  ctx.beginPath(); ctx.ellipse(-r * 0.18, -r * 0.2, r * 0.09, r * 0.14, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.18, -r * 0.2, r * 0.09, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.1, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.restore();
}
// Mortimer'ın büyü kareleri (mortimer_cast, 8 kare): 0 aura, 1 dur, 2 kaldır, 3 başın üstünde, 4 doruk, 5 tut, 6 indir, 7 aura
const MORT_CAST_T = 1.2, MORT_CAST_SEQ = [2, 3, 3, 4, 4, 5, 5, 6, 7];
// Mortimer'ın hâli (Wan videolarından şeritler): 'tea' oturur çay içer (mortimer_cay), düşman şapele yaklaşınca 'up' kalkar
// (mortimer_otur tersten), 'panic' tedirgin (mortimer_panik), sakinleşince 'down' oturur; büyüde mortimer_buyu. Şerit yoksa eski kareler.
const MORT_SIT_K = 0.8, MORT_TRANS = 0.7;
function mortDanger() {
  const c = G.castle;
  return c.shake > 0 || G.enemies.some(e => !e.dead && !e.def.flying && dist(e.x, e.y, c.x, c.y) < 150);
}
function updateMortState(dt) {
  const M = G.mort || (G.mort = { st: 'tea', t: 0, calm: 0 });
  M.t += dt;
  if (mortDanger()) M.calm = 0; else M.calm += dt;
  if (M.st === 'tea' && M.calm === 0) { M.st = 'up'; M.t = 0; }
  else if (M.st === 'up' && M.t > MORT_TRANS) { M.st = 'panic'; M.t = 0; }
  else if (M.st === 'panic' && M.calm > 3) { M.st = 'down'; M.t = 0; }
  else if (M.st === 'down' && M.t > MORT_TRANS) { M.st = 'tea'; M.t = 0; }
}
const mortStrip = (n) => (ANIM_META[n] && spr(n) ? n : null);
// o an çizilecek şerit, kare ve boy çarpanı (yoksa null)
function mortAnim(p) {
  const M = G && G.mort;
  if (p >= 0 && mortStrip('mortimer_buyu')) return { n: 'mortimer_buyu', i: Math.min(ANIM_META.mortimer_buyu.n - 1, Math.floor(p * ANIM_META.mortimer_buyu.n)), k: 1 };
  if (!M) return null;
  if ((M.st === 'up' || M.st === 'down') && mortStrip('mortimer_otur')) {
    const q = clamp(M.t / MORT_TRANS, 0, 1), N = ANIM_META.mortimer_otur.n;
    return { n: 'mortimer_otur', i: Math.round((M.st === 'down' ? q : 1 - q) * (N - 1)), k: (1 + MORT_SIT_K) / 2 };
  }
  if (M.st === 'panic' && mortStrip('mortimer_panik')) return { n: 'mortimer_panik', i: Math.floor(time * 16) % ANIM_META.mortimer_panik.n, k: 1 };
  if (mortStrip('mortimer_cay') && M.st !== 'panic') return { n: 'mortimer_cay', i: Math.floor(time * 12) % ANIM_META.mortimer_cay.n, k: MORT_SIT_K };
  return null;
}
function drawMortimer() {
  const m = mortimerPoint(), hgt = m.h, p = G.mortCast > 0 ? clamp(1 - G.mortCast / MORT_CAST_T, 0, 1) : -1;
  const k = p >= 0 ? Math.sin(p * Math.PI) : 0;
  const F = ANIM_META.mortimer_cast, fim = F && spr('mortimer_cast'), im = spr('mortimer');
  if (!fim && !im) return;
  // arkasında hafif parlayan hale: mor, yeşil ve kızıl yavaşça birbirine karışır; büyüde ışık sütunu, dönen rün çemberi ve kıvılcımlar
  const cx = m.x, cy = m.y - hgt * 0.5, mix = (Math.sin(time * 0.7) + 1) / 2;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, cx, cy, hgt * 0.95, '160,70,255', 0.26 + 0.35 * k + Math.sin(time * 2) * 0.06);
  glow(ctx, cx, cy, hgt * 0.6, mix > 0.5 ? '110,255,140' : '255,70,70', 0.12 + 0.08 * Math.abs(mix - 0.5) * 2 + 0.45 * k + (G.raiseT > 0 ? 0.2 : 0));
  if (k > 0) {
    const pg = ctx.createLinearGradient(0, m.y, 0, m.y - hgt * 3.2);
    pg.addColorStop(0, `rgba(170,110,255,${0.5 * k})`); pg.addColorStop(0.5, `rgba(120,255,150,${0.25 * k})`); pg.addColorStop(1, 'rgba(120,255,150,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(cx - hgt * 0.3, m.y); ctx.lineTo(cx - hgt * 0.12, m.y - hgt * 3.2); ctx.lineTo(cx + hgt * 0.12, m.y - hgt * 3.2); ctx.lineTo(cx + hgt * 0.3, m.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(190,140,255,${0.8 * k})`; ctx.lineWidth = 1.2; // dönen rün çemberi (ayak hizasında)
    for (let j = 0; j < 12; j++) { const a0 = time * 2 + j * Math.PI / 6; ctx.beginPath(); ctx.ellipse(cx, m.y - 1, hgt * 0.62, hgt * 0.2, 0, a0, a0 + 0.32); ctx.stroke(); }
    ctx.strokeStyle = `rgba(120,255,150,${0.6 * k})`; ctx.beginPath(); ctx.ellipse(cx, m.y - 1, hgt * 0.45 * (1 + 0.2 * k), hgt * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
    if (Math.random() < 0.5 * k) emit(G.parts, { kind: 'glow', add: true, x: cx + rand(-hgt * 0.4, hgt * 0.4), y: m.y - rand(0, hgt * 0.6), vx: rand(-8, 8), vy: -rand(30, 60), col: Math.random() < 0.5 ? '190,130,255' : '120,255,150', s0: rand(1.5, 3), s1: 0.3, life: rand(0.6, 1.1), a: 0.9 });
  }
  ctx.restore();
  ctx.save(); ctx.translate(m.x, m.y);
  const MA = mortAnim(p);
  // panik şeridi yoksa: ayakta tedirgin titreme ve küçük sekmeler
  if (!MA && p < 0 && G.mort && G.mort.st === 'panic') ctx.translate(Math.sin(time * 47) * 0.5, -Math.abs(Math.sin(time * 9)) * 1.2);
  if (MA) drawFrame(spr(MA.n), ANIM_META[MA.n], MA.i, hgt * 1.15 * MA.k);
  else if (fim) {
    // boşta 1. kare hafifçe nefes alır; büyüde kareler sırayla oynar
    const i = p >= 0 ? MORT_CAST_SEQ[Math.min(MORT_CAST_SEQ.length - 1, Math.floor(p * MORT_CAST_SEQ.length))] : 1;
    if (p < 0) ctx.scale(1, 1 + Math.sin(time * 1.6) * 0.012);
    drawFrame(fim, F, i, hgt * 0.97);
  } else drawSprite(ctx, im, 0, 0, hgt * im.width / im.height);
  ctx.restore();
  if (isPremium()) drawCrown(m.x, m.y - hgt * 1.04 + Math.sin(time * 2) * 1, 0.55, 1); // Hazine sahibine altın taç
}
// Mortimer'ın lafları: olaylara göre balkondan konuşma balonu (aynı anda tek balon, iki laf arası en az 7 sn)
const MORT_LINES = {
  // 2. sefer (Cadı Avı)
  start2: ['Cadı avı mı? Yanlış kapıyı çaldınız.', 'Meşaleler, çanlar... Ne kadar gürültücü bir din.', 'Çaydanlığımı geri alana kadar kimse uyumuyor.'],
  hatch: ['Mahzen açık! Bubu\'nun kuzeni geldi.', 'Gulyabani, misafirlerle ilgilen.', 'Aşağıda biri çok acıkmış.'],
  sealed: ['Kapağımı mühürledi! Terbiyesiz.', 'O mahzenin kirasını kim ödeyecek?'],
  blood: ['Ay kızardı. Benden utandı herhalde.', 'Kızıl Ay! Kalkın çocuklar, gece bizim.', 'Dua edin bakalım. Ben de güleyim.'],
  light: ['Fener mi? Söndürün şunu, gözüm kamaştı!', 'Işık arabası. Ne kadar da kaba.'],
  tea: ['Earl Grey. Ölüleri bile diriltir.', 'Şşş. Çay saati.', 'Şekersiz. Ben zaten yeterince tatlıyım.', 'Bir yudum daha, sonra kıyamet.', 'Soğumuş. Tıpkı düşmanlarım gibi.'],
  crowtap: ['Kargalarıma dokunma! Dedikodu taşıyorlar.', 'O karga bana borçlu, bilesin.'],
  start: ['Yine mi misafir? Çayımı yeni demlemiştim.', 'Kapıyı çalmadan girmek yok. Hiç.', 'Solarianlar... Bugün de mi?', 'Bahçeme basan mezara basar.'],
  wave: ['Bir dalga daha. Ne azimliler.', 'Sıraya girin. Mezarlıkta herkese yer var.', 'Yeni gönüllüler! İskeletim azalmıştı.', 'Kalabalık geldiler. Çayı tazeleyeyim.', 'İmparator hiç mi ders almaz?'],
  last: ['Son dalga mı? Sonunda biraz sessizlik.', 'Hepsi bu mu? Kalanlar da gelsin!'],
  leak: ['Hey! Halıma basma!', 'Kapı kilitli değil diye girilmez!', 'Çayımı döktürdün!', 'Bu kaç oldu? Saymayı bıraktım.', 'Kim açtı o kapıyı?!'],
  raise: ['Kalkın! Mesai bitmedi.', 'Ölmek bahane değil. Kalk!', 'Emekliliğiniz iptal.', 'Kalkın tembeller!'],
  fear: ['Böö!', 'Annenizi mi istiyorsunuz?', 'Koşun! Koşun! Hah!', 'Arkanıza bakmayın.'],
  boss: ['Oo, rütbeli biri. Kafası rafıma yakışır.', 'Bu da kim? Kartını bırakıp gitsin.', 'Büyük adam, büyük mezar.'],
  sun: ['Güneş mi? Perdeleri kapatın!', 'Solarian ışığı... gözüm kamaştı. Şaka, gözüm yok.'],
  graves: ['Komşular uyandı!', 'Mezarlıkta herkes bizden.'],
  lake: ['Gölde bir şey var. Ve aç.', 'Afiyet olsun, Bubu!'],
  gatebreak: ['Kapımı kırdılar! Kemiklerini sayacağım.', 'Kapı mı? Ben onu yeniden yaparım. Sizden.', 'Muhafızlar! Misafirleri karşılayın!'],
  burst: ['Geri dönüşüm, necromancer usulü.', 'Pat! Biraz dağınık oldu.', 'Cesetler de bir işe yarasın.', 'Kimse temizlemeyecek bunu, değil mi?'],
  wall: ['Buradan geçiş yok!', 'Kemikten çit. Komşuluk ilişkileri böyle başlar.', 'Duvara toslamak sağlığa zararlıdır.'],
  firstleak: ['Biri bahçeme girdi! Balkabaklarım!', 'İlk misafir kapıda. Davetsiz, tabii.', 'Çayıma toz kaçtı. Bu kişisel oldu.'],
  low: ['Kule sallanıyor... Kitaplarım!', 'Bu gidişle çayı bahçede içeceğim.', 'Az kaldı! Biri şu kapıyı tutsun!'],
  veteran: ['Kıdemliler. Kemikleri daha sağlam olur.', 'Kırmızı sorguç mu? Ne kadar da şık.', 'Tecrübeli askerler. Tecrübeli iskelet olurlar.'],
  captain: ['Yüzbaşı! Borazanı da benim olacak.', 'Altın sorguç... Rafımda tam yeri var.', 'Rütbe yükseldikçe mezar derinleşir.'],
  bossRage: ['Sinirlendi mi? Ne tatlı.', 'Bağırmak kibarlığa sığmaz, general.', 'Öfke kalbe zararlı. Benim kalbim yok tabii.'],
  bossDown: ['Bir general daha koleksiyonda.', 'Kartını bıraktı. Ve kafasını.', 'Rütbesi mezar taşına yazılsın.'],
  stunned: ['Kuleme taş atmak ayıp!', 'Hey! O kule kiralık değil!', 'Taşlarını geri al, kaba adam.'],
  maxTower: ['İşte şimdi oldu.', 'Böyle bir kulem olsun isterdim. Dur, var.', 'Mimari harikası. Biraz da ürkütücü.'],
  heroDown: ['Kalk, uyuklama!', 'Ölmek mi? Bizde bu geçici.', 'Kısa bir mola. Hemen döner.'],
  clean: ['Tertemiz. Tek damla çay dökülmedi.', 'Kimse geçemedi. Beklendiği gibi.', 'Bahçe güvende. Şimdilik.'],
  rich: ['Altınlar mezara gömülmez. Bir şey kur!', 'Kese dolu, kuleler boş. Garip.', 'O altınla iki kule olur. Sadece diyorum.'],
  ram: ['Koçbaşı mı? Kapımı çalmanın kaba yolu.', 'Kapıma koç mu? Ne kadar kaba.'],
  streak: ['Mükemmel. Yeni malzeme.', 'Hepsini kemik deposuna!', 'Bir, iki, on... yetmez.', 'İşte buna verimlilik denir.'],
};
const MORT_TALK_SKIP = 0.2;
function mortSay(kind, force) {
  if (!NECRO || !G || (!force && G.sayCd > 0)) return;
  const L = MORT_LINES[kind]; if (!L) return;
  if (kind !== 'start' && kind !== 'start2' && Math.random() < MORT_TALK_SKIP) return; // 10 Eki: Caner daha az konuşsun istedi (%20 seyrek)
  let text = L[Math.floor(Math.random() * L.length)];
  if (text === G.sayLast && L.length > 1) text = L[(L.indexOf(text) + 1) % L.length];
  G.say = { text, t: 0, dur: 2.2 + text.length * 0.045 }; G.sayLast = text; G.sayCd = 7;
  mortMumble(text, kind);
}
function updateMortSay(dt) {
  if (!NECRO) return;
  G.sayCd = (G.sayCd || 0) - dt;
  if (G.say && (G.say.t += dt) > G.say.dur) G.say = null;
  if (!G.saidStart && G.t > 1.2) { G.saidStart = true; mortSay(G.lv.ep === 2 && Math.random() < 0.6 ? 'start2' : 'start', true); }
  // seri öldürme: 4 sn içinde 8 düşman
  const k = G.kills || 0;
  G.killLog = (G.killLog || []).filter(([t]) => G.t - t < 4);
  if (k > (G.killSeen || 0)) { for (let i = G.killSeen || 0; i < k; i++) G.killLog.push([G.t]); G.killSeen = k; }
  if (G.killLog.length >= 8) { G.killLog = []; mortSay('streak'); }
  // dalga temizlendi ve bu dalgada kimse geçemedi
  if (G.wave > 0 && G.wave < G.lv.waves.length && G.spawners.length === 0 && G.enemies.length === 0 && G.cleanW !== G.wave) {
    G.cleanW = G.wave;
    if (G.lives === G.wLives && Math.random() < 0.5) mortSay('clean');
  }
  // çok altın biriktirip 25 sn bir şey yapmayan oyuncuya laf atar (bölümde en çok iki kez)
  if (G.gold < (G.richLast ?? 0)) G.richT = 0; // altın harcandı
  G.richLast = G.gold;
  if (G.gold >= 500 && G.wave > 0 && (G.richN || 0) < 2) { G.richT = (G.richT || 0) + dt; if (G.richT > 25) { G.richT = -40; G.richN = (G.richN || 0) + 1; mortSay('rich'); } }
  else if (G.gold < 500) G.richT = 0;
}
function drawMortSay() {
  const S = G.say; if (!S) return;
  const m = mortimerPoint(), a = Math.min(1, S.t / 0.15, (S.dur - S.t) / 0.3), pop = easeOutBack(clamp(S.t / 0.25, 0, 1));
  // yazı 14 px; uzun laf tek geniş satır olmaz, eşit uzunlukta 2 (çok uzunsa 3) satıra bölünür
  const FS = 14, LH = 17, text = TR(S.text);
  ctx.save(); ctx.font = `800 ${FS}px ${FONT_B}`;
  const full = ctx.measureText(text).width, n = full > 600 ? 3 : full > 230 ? 2 : 1, lim = full / n + FS * 1.6;
  const words = text.split(' '), lines = [];
  for (const w of words) { const cur = lines[lines.length - 1]; if (cur && ctx.measureText(cur + ' ' + w).width <= lim) lines[lines.length - 1] = cur + ' ' + w; else lines.push(w); }
  const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22, bh = lines.length * LH + 12;
  // balon: Mortimer'ın başının üstünde, ekran içinde kalır
  let bx = clamp(m.x - bw / 2, 6, W - bw - 6), by = Math.max(6, m.y - m.h - bh - 14);
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.translate(m.x, m.y - m.h - 10); ctx.scale(pop, pop); ctx.translate(-m.x, -(m.y - m.h - 10));
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(bx + 2, by + 3, bw, bh, 8, 'rgba(0,0,0,0.35)');
  roundRect(bx, by, bw, bh, 8, '#f2ecd8', '#1a1024', 2);
  ctx.beginPath(); ctx.moveTo(clamp(m.x - 6, bx + 8, bx + bw - 20), by + bh - 1); ctx.lineTo(m.x, m.y - m.h - 2); ctx.lineTo(clamp(m.x + 6, bx + 14, bx + bw - 8), by + bh - 1);
  ctx.closePath(); ctx.fillStyle = '#f2ecd8'; ctx.fill(); ctx.strokeStyle = '#1a1024'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillRect(clamp(m.x - 5, bx + 9, bx + bw - 19), by + bh - 3, 10, 3);
  lines.forEach((l, i) => txt(l, bx + bw / 2, by + 6 + LH / 2 + i * LH, FS, '#2a1838', 'center', '800', FONT_B, false));
  ctx.restore();
}
// ----- 1. bölüm eğitimi: ilk oynanışta adım adım ok işaretiyle yol gösterir (save.tutDone) -----
const TUT = [
  { text: 'Yolun kenarındaki kule yerlerinden birine dokun ve bir kule kur.', done: () => G.towers.length > 0,
    at: () => { const P = G.paths[0], q = pathPos(P, P.total * 0.25); let b = null; for (const pl of G.plots) if (!pl.tower && (!b || dist(pl.x, pl.y, q.x, q.y) < dist(b.x, b.y, q.x, q.y))) b = pl; return b && worldToScreen(b.x, b.y - 10); } },
  { text: 'Kafatasına dokun: gelecek düşmanları gör. Bir daha dokun: dalga gelsin.', done: () => G.wave > 0,
    at: () => { const ps = nextWavePaths(); return ps.length && waveCallable() ? waveBtnScreen(ps[0]) : null; } },
  { text: 'Ölen düşmanların cesetleri 6 sn yerde kalır. Ölüleri Diriltme büyüsüne dokun!', when: () => G.effects.some(f => f.kind === 'corpse' && f.raisable),
    done: () => G.raiseT > 0 || G.spells.nm_raise > 0, timeout: 15, at: () => spellBtn(spellIds().indexOf('nm_raise')) },
  { text: 'Altının yetince kuleye dokunup yükselt: daha güçlü olur.', when: () => G.towers.some(t => t.lvl < t.def.levels.length - 1 && G.gold >= t.def.levels[t.lvl + 1].cost),
    done: () => G.towers.some(t => t.lvl > 0), timeout: 14, at: () => { const t = G.towers[0]; return t && worldToScreen(t.x, t.y - 46); } },
];
function updateTut(dt) {
  const T = G.tut; if (!T) return;
  while (T.i < TUT.length && TUT[T.i].done()) { T.i++; T.t = 0; }
  if (T.i >= TUT.length) { G.tut = null; save.tutDone = true; persist(); return; }
  const S = TUT[T.i];
  if (S.when && !S.when()) { T.on = false; return; }
  T.on = true; T.t += dt;
  if (S.timeout && T.t > S.timeout) { T.i++; T.t = 0; }
}
function drawTut() {
  const T = G.tut; if (!T || !T.on || overlay) return;
  const S = TUT[T.i], p = S.at && S.at(), a = clamp(T.t / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  // üstte kemik parşömen şeridi
  ctx.font = `700 14px ${FONT_B}`;
  const w = Math.min(W - 40, ctx.measureText(S.text).width + 46), x0 = W / 2 - w / 2, y0 = 82;
  roundRect(x0 + 2, y0 + 4, w, 34, 12, 'rgba(0,0,0,0.4)');
  roundRect(x0, y0, w, 34, 12, '#efe8d2', '#1a1024', 2);
  drawSkullIcon(x0 + 18, y0 + 17, 9);
  txt(S.text, W / 2 + 10, y0 + 17.5, 14, '#2a1838', 'center', '800', FONT_B, false);
  // hedefin üstünde zıplayan ok ve nabız halkası
  if (p) {
    const bob = Math.abs(Math.sin(time * 5)) * 8, ph = (time * 1.2) % 1;
    ctx.strokeStyle = `rgba(255,236,150,${0.9 * (1 - ph)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + ph * 22, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(p.x, p.y - 30 - bob);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 22, '255,220,120', 0.45); ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.moveTo(-9, -16); ctx.lineTo(9, -16); ctx.lineTo(9, -4); ctx.lineTo(15, -4); ctx.lineTo(0, 10); ctx.lineTo(-15, -4); ctx.lineTo(-9, -4); ctx.closePath();
    ctx.fillStyle = '#ffe27a'; ctx.fill(); ctx.strokeStyle = '#2a1406'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
// ----- başarımlar -----
// save.ach: açılanlar (id -> zaman), save.cnt: kalıcı sayaçlar. cnt(k, n) sayacı artırır ve ilgili başarımları dener.
// Sayaçlar bellekte artar; kayıt başarım açılınca ve bölüm bitince yazılır.
const ACH = [
  { id: 'first', name: 'İlk Kan', desc: 'Bir bölümü bitir', icon: 'skull' },
  { id: 'flawless', name: 'Kusursuz', desc: 'Bir bölümü hiç can kaybetmeden bitir', icon: 'heart' },
  { id: 'allstars', name: 'Yıldız Avcısı', desc: 'Bütün bölümlerden 3 yıldız al', icon: 'star' },
  { id: 'heroic', name: 'Kahraman', desc: 'Bir Kahramanlık meydan okumasını bitir', icon: 'shield' },
  { id: 'kills', name: 'Mezarlık Dolu', desc: 'Toplam 1000 düşman öldür', icon: 'skull', cnt: 'kills', need: 1000 },
  { id: 'bosses', name: 'Rütbe Söken', desc: '5 komutan (boss) devir', icon: 'crown', cnt: 'bosses', need: 5 },
  { id: 'raise', name: 'Mesai Arkadaşları', desc: 'Toplam 100 ölüyü dirilt', icon: 'raise', cnt: 'raise', need: 100 },
  { id: 'fear', name: 'Böö!', desc: 'Korku büyüsüyle 50 düşman kaçır', icon: 'fear', cnt: 'fear', need: 50 },
  { id: 'wall', name: 'Duvarcı Ustası', desc: 'Kemik Duvarı 15 kez dik', icon: 'wall', cnt: 'wall', need: 15 },
  { id: 'tea', name: 'Çay Saati', desc: "Mortimer'a 10 kez çay içir", icon: 'tea', cnt: 'tea', need: 10 },
  { id: 'crow', name: 'Kargalar Dostu', desc: '15 kargayı ürküt', icon: 'crow', cnt: 'crow', need: 15 },
  { id: 'tip', name: 'Mezar Bahşişi', desc: 'Mezardaki elden bahşiş al', icon: 'coin', cnt: 'tip', need: 1 },
  { id: 'hoard', name: 'Cimri Büyücü', desc: 'Bir bölümde 2000 altın biriktir', icon: 'coin' },
  { id: 'master', name: 'Kara Türbe', desc: 'Bir kulenin uzmanlığını son kademeye çıkar', icon: 'tower' },
  { id: 'codex', name: 'Ansiklopedist', desc: 'Kodeksteki bütün düşmanları gör', icon: 'book' },
  { id: 'chal5', name: 'Lanetli Efsane', desc: 'Bütün bölümlerde Kahramanlık meydan okumasını bitir', icon: 'crown' },
];
const ACH_TOAST = [];
function cnt(k, n = 1) {
  save.cnt = save.cnt || {}; save.cnt[k] = (save.cnt[k] || 0) + n;
  if (!cnt.due) cnt.due = setTimeout(() => { cnt.due = 0; persist(); }, 3000); // sayaçlar bölüm ortasında çıkılsa da kaybolmasın
  for (const a of ACH) if (a.cnt === k && save.cnt[k] >= a.need) achGive(a.id);
}
function achGive(id) {
  save.ach = save.ach || {};
  if (save.ach[id]) return;
  save.ach[id] = Date.now(); save.achNew = (save.achNew || 0) + 1; persist();
  ACH_TOAST.push({ a: ACH.find(x => x.id === id), t: null });
  if (actx && !muted) sfx('levelup');
}
// bölüm sonu ve diğer durum başarımları
function achLevelEnd(win) {
  if (win) {
    achGive('first');
    if (!G.chal && G.lives >= G.maxLives) achGive('flawless');
    if (LEVELS.every((lv, i) => (save.stars[i] || 0) >= 3)) achGive('allstars');
    if (G.chal === 'h') achGive('heroic');
    if (LEVELS.every((lv, i) => save.ch && save.ch[i] && save.ch[i].h)) achGive('chal5');
  }
  persist();
}
function achIcon(icon, r) {
  ctx.save(); ctx.lineJoin = 'round';
  if (icon === 'skull' || icon === 'raise') drawSkullIcon(0, 0, r * 0.95);
  else if (icon === 'heart') drawIcon('heart', 0, 0, r * 1.4);
  else if (icon === 'star') fancyStar(0, 0, r * 0.75, true);
  else if (icon === 'coin') drawIcon('coin', 0, 0, r * 1.4);
  else if (icon === 'crown') drawIcon('crown', 0, 0, r * 1.4);
  else if (icon === 'fear') drawNecroGlyph('nm_fear', r);
  else if (icon === 'wall') drawNecroGlyph('nm_wall', r);
  else if (icon === 'book') codexBookIcon(r);
  else if (icon === 'shield') { ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.4); ctx.lineTo(r * 0.45, r * 0.15); ctx.quadraticCurveTo(r * 0.3, r * 0.5, 0, r * 0.65); ctx.quadraticCurveTo(-r * 0.3, r * 0.5, -r * 0.45, r * 0.15); ctx.lineTo(-r * 0.5, -r * 0.4); ctx.closePath(); ctx.fillStyle = '#e04a3a'; ctx.fill(); ctx.strokeStyle = '#1a0606'; ctx.lineWidth = 2; ctx.stroke(); }
  else if (icon === 'tea') { roundRect(-r * 0.45, -r * 0.2, r * 0.8, r * 0.6, r * 0.2, '#f2ecd8', '#1a1024', 1.6); ctx.strokeStyle = '#1a1024'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(r * 0.42, r * 0.08, r * 0.17, -1.4, 1.4); ctx.stroke(); ctx.strokeStyle = 'rgba(230,230,220,0.8)'; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.3); ctx.quadraticCurveTo(r * 0.05, -r * 0.5, -r * 0.05, -r * 0.7); ctx.stroke(); }
  else if (icon === 'crow') { const im = spr('nm_crow'); if (im) drawSprite(ctx, im, 0, r * 0.65, r * 1.3 * im.width / im.height); }
  else if (icon === 'tower') { const im = spr('tower_barracks_3'); if (im) drawSprite(ctx, im, 0, r * 0.7, r * 1.5); }
  ctx.restore();
}
// açılan başarım bildirimi: üstten kayar, 3 sn kalır, sırayla
function drawAchToast() {
  const T = ACH_TOAST[0]; if (!T) return;
  if (T.t == null) T.t = time;
  const k = time - T.t, a = clamp(Math.min(k / 0.3, (3.2 - k) / 0.4), 0, 1);
  if (k > 3.2) { ACH_TOAST.shift(); return; }
  const y = -40 + 56 * easeOutBack(clamp(k / 0.4, 0, 1)) * (k > 2.8 ? a : 1);
  ctx.save(); ctx.globalAlpha = a;
  const w = 300, x = W / 2 - w / 2;
  roundRect(x + 2, y + 4, w, 46, 14, 'rgba(0,0,0,0.45)');
  roundRect(x, y, w, 46, 14, '#241a32', '#e8c86a', 2);
  ctx.save(); ctx.translate(x + 26, y + 23); achIcon(T.a.icon, 14); ctx.restore();
  txt('BAŞARIM: ' + T.a.name, x + 50, y + 15, 14, '#ffe27a', 'left', '400', FONT_T, false);
  txt(T.a.desc, x + 50, y + 32, 11, '#e8e0f0', 'left', '700', FONT_B, false);
  ctx.restore();
}
// başarımlar ekranı (haritadaki kupa düğmesi)
// başarımlar/kodeks nereden açıldıysa geri düğmesi oraya döner
let menuBack = 'map';
function drawAchievements() {
  const st = time - screenT, bg = spr('nm_title');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    ctx.fillStyle = 'rgba(8,4,16,0.75)'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 40); ctx.scale(rk, rk); ribbon(0, 0, 300, 'BAŞARIMLAR', 'blue', 24); ctx.restore();
  const got = ACH.filter(a => save.ach && save.ach[a.id]).length;
  txt(`${got} / ${ACH.length}`, W / 2, 74, 15, '#ffe27a', 'center', '400', FONT_T);
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = menuBack; screenT = time; }), { appear: st });
  const cols = 3, cw = 290, ch = 58, gx = 10, gy = 6, x0 = W / 2 - (cols * cw + (cols - 1) * gx) / 2, y0 = 88;
  ACH.forEach((a, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = x0 + c * (cw + gx), y = y0 + r * (ch + gy), on = save.ach && save.ach[a.id];
    const ap = clamp((st - 0.1 - i * 0.025) / 0.25, 0, 1); if (ap <= 0) return;
    ctx.save(); ctx.globalAlpha = ap;
    if (NECRO) { velvetCard(x, y, cw, ch, 12, { border: on ? '#e8c86a' : 'rgba(150,120,140,0.55)', ac: on ? '230,190,110' : null }); if (!on) roundRect(x, y, cw, ch, 12, 'rgba(10,4,12,0.35)'); }
    else roundRect(x, y, cw, ch, 12, on ? '#2c2240' : 'rgba(30,24,40,0.85)', on ? '#e8c86a' : 'rgba(150,140,170,0.4)', on ? 2 : 1.2);
    circle(x + 30, y + ch / 2, 21, on ? '#3e2e58' : '#1c1626', on ? '#e8c86a' : '#4a4058', 1.6);
    ctx.save(); ctx.translate(x + 30, y + ch / 2); if (!on) ctx.globalAlpha *= 0.45; achIcon(a.icon, 19); ctx.restore();
    txt(a.name, x + 60, y + 19, 15, on ? '#ffe27a' : '#b8acc8', 'left', '400', FONT_T, false);
    txt(a.desc, x + 60, y + 36, 11, on ? '#e8e0f0' : '#8a809a', 'left', '700', FONT_B, false);
    if (a.cnt && !on) {
      const v = Math.min(a.need, (save.cnt && save.cnt[a.cnt]) || 0), bw = cw - 72;
      roundRect(x + 60, y + 45, bw, 6, 3, '#120c1a');
      if (v) roundRect(x + 60, y + 45, bw * v / a.need, 6, 3, '#8fd06a');
      txt(`${v}/${a.need}`, x + cw - 10, y + 19, 10, '#8a809a', 'right', '800', FONT_B, false);
    }
    if (on) { circle(x + cw - 16, y + 16, 8, '#3cbf3c', '#0a2a0a', 1.4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + cw - 20, y + 16); ctx.lineTo(x + cw - 17, y + 19); ctx.lineTo(x + cw - 12, y + 13); ctx.stroke(); }
    ctx.restore();
  });
  save.achNew = 0;
}
// ----- borazancı: ilk dalga çağrılınca o dalganın girişlerinden birer lejyoner çıkar, savaş borazanını çalar, geri döner;
// düşmanlar o dönünce gelir (heraldT sn gecikme) -----
// boss gelmeden de çıkar: aynı çağrıyı daha kalın ve uzun (yavaş) çalar (long)
// Borazancı yolun üstünden, ortasından değil bir kenarına yakın yürür; ekran sınırından iki adım girip çalar, aynı yoldan geri döner.
// step: ekrana girdiği yerden yürüdüğü yol, side: yol ortasından kenara uzaklığı (yarı genişliğin oranı)
// davul: vuruş aralığı (sn); davulun duyulduğu yerdeki askerler hızlanır (aura.speed) ve daha sert vurur (dmg)
const DRUM = { beat: 0.3, dmg: 1.2 };
const HERALD = { step: 16, side: 0.6, speed: 70, blow: 2.3, blowLong: 3.8, back: 90 }; // step: sınırdan iki adım
function setupHeralds() { G.heralds = []; }
function heraldSpot(p) {
  let d0 = 0; while (d0 < p.total) { const q = pathPos(p, d0); if (q.x > 14 && q.y > 30 && q.x < W - 14 && q.y < H - 8) break; d0 += 4; }
  const d = Math.min(p.total * 0.5, d0 + HERALD.step), q = pathPos(p, d), half = 22 * ROAD_K * HERALD.side;
  let best = null;
  for (const sd of [1, -1]) {
    const g = pathPos(p, d, sd * half), inside = g.x > 24 && g.x < W - 24 && g.y > 80 && g.y < H - 20;
    const score = (inside ? 1000 : 0) + nearestOnPaths(G.paths, g.x, g.y).d;
    if (!best || score > best.score) best = { score, sd };
  }
  return { dW: d, sd: best.sd, half };
}
function callHeralds(paths, long = false) {
  paths.slice(0, 3).forEach((pi, i) => { const p = G.paths[pi], d0 = -entryLead(p); G.heralds.push({ p, d: d0, d0, state: 'in', t: -i * 0.15, i, long, ...heraldSpot(p) }); });
}
// düşmanlar borazancı(lar) geri dönünce yola çıkar
const heraldT = (long) => 0.3 + Math.max(0, ...(G.heralds || []).filter(h => h.state === 'in').map(h =>
  h.i * 0.15 + (h.dW - h.d0) / HERALD.speed + (long ? HERALD.blowLong : HERALD.blow) + (h.dW - h.d0) / HERALD.back)); // borazancı ekran dışına çıkınca düşmanlar gelir
function updateHeralds(dt) {
  for (const h of G.heralds || []) {
    h.t += dt;
    if (h.t < 0) continue;
    if (h.state === 'in') { h.d += HERALD.speed * dt; if (h.d >= h.dW) { h.d = h.dW; h.state = 'blow'; h.t = 0; if (h.i === 0) sfx(h.long ? 'hornboss' : 'horn'); } }
    else if (h.state === 'blow') {
      if (h.t > (h.long ? HERALD.blowLong : HERALD.blow)) { h.state = 'out'; h.t = 0; if (h.i === 0 && !G.musicOn) { G.musicOn = true; musicRestartBattle(); } }
    }
    else h.d -= HERALD.back * dt;
  }
  if (G.heralds) G.heralds = G.heralds.filter(h => h.state !== 'out' || h.d > Math.min(-10, (h.d0 || 0) - 10));
}
function drawHeralds() {
  // Gemini borazancısı (enemy_herald: kurt postlu, sırtında cornu) varsa o çizilir; yoksa lejyoner + kodla çizilen borazan
  const hr = spr('enemy_herald'), im = hr || spr('enemy_legion'); if (!im) return;
  const name = hr ? 'enemy_herald' : 'enemy_legion', hgt = (CHAR_H.enemy_legion || ENEMIES.legion.h * UNIT_K) * (hr ? 1.3 : 1);
  for (const h of G.heralds || []) {
    if (h.t < 0 && h.state === 'in') continue;
    const q = pathPos(h.p, Math.max(dLo(h.p), h.d), h.sd * h.half), fwd = q.dx >= 0 ? 1 : -1; // yolun kenarına yakın yürür
    const face = h.state === 'out' ? -fwd : fwd; // çalarken düşmanın yürüyeceği yöne bakar
    const blowing = h.state === 'blow', dur = h.long ? HERALD.blowLong : HERALD.blow;
    // kaldırma: borazan 0,3 sn'de omuzdan ağza kalkar, çalarken gövde geriye yaslanır ve nefesle kabarır, sonunda iner
    const k = blowing ? easeInOut(clamp(h.t / 0.3, 0, 1)) * easeInOut(clamp((dur - h.t) / 0.3, 0, 1)) : 0;
    const breath = blowing ? Math.sin(h.t * 7) * 0.5 + 0.5 : 0;
    ctx.save(); if (!hr) { ctx.translate(q.x, q.y); ctx.rotate(-face * 0.1 * k); ctx.scale(1, 1 + 0.025 * k * breath); ctx.translate(-q.x, -q.y); } // Gemini borazancısında gövde sabit
    if (!hr) { ctx.save(); ctx.translate(q.x, q.y); drawCornu(face, hgt, k, breath); ctx.restore(); } // boru askerin arkasında: gövdeyi sarar
    if (blowing && hr) drawHeraldBlow(hr, q.x, q.y, face, hgt, k, breath); // gövde sabit, yalnız borazan ve el oynar
    else drawUnit(name, im, q.x, q.y, face, { rig: 'enemy_legion', h: hgt, phase: time * 6, walking: !blowing, fly: 0, seed: h.i });
    ctx.restore();
    if (!blowing || h.i !== 0) continue;
    // ses dalgaları borazanın ağzından ileri yayılır
    const u = hgt / 24, bx = q.x + face * hgt * (hr ? 0.27 : 0.1 + 0.55 * k), by = q.y - hgt * (hr ? 0.86 : 1.02 + 0.12 * k); // borazanın ağzı
    for (let r = 0; r < 4; r++) {
      const ph = (h.t * 1.6 + r / 4) % 1;
      ctx.strokeStyle = `rgba(255,228,150,${0.6 * (1 - ph) * k})`; ctx.lineWidth = 1.6 * (1 - ph * 0.5);
      ctx.beginPath(); ctx.arc(bx, by, 4 * u + ph * 26 * u, face > 0 ? -0.8 : Math.PI - 0.7, face > 0 ? 0.7 : Math.PI + 0.8); ctx.stroke();
    }
  }
}
// Çalan borazancı: gövde durağan görsel olarak çizilir; borazanın ağzı (görselin sağ üstü) ağızlıktan dönerek hafifçe kalkar
// ve nefesle kabarır, borazanı tutan el ritimle azıcık iner kalkar. Parçalar büyütülerek çizilir ki alttaki asıl hali görünmesin.
const HERALD_PART = { bell: [0.67, 0, 1, 0.285], bellPivot: [0.7, 0.27], hand: [0.79, 0.4, 0.97, 0.5] };
function heraldPart(im, r) {
  const key = r.join(','), C = heraldPart.c || (heraldPart.c = {});
  if (C[key] && C[key].im === im) return C[key];
  const sx = Math.round(r[0] * im.width), sy = Math.round(r[1] * im.height), sw = Math.round((r[2] - r[0]) * im.width), sh = Math.round((r[3] - r[1]) * im.height);
  const c = document.createElement('canvas'); c.width = sw; c.height = sh; c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
  return (C[key] = { im, c, sx, sy, sw, sh });
}
function drawHeraldBlow(im, x, y, face, hgt, k, breath) {
  const w = hgt * im.width / im.height, S = w / im.width; // görsel pikseli -> dünya
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  shadow(0, 0, w * 0.32, w * 0.1);
  ctx.drawImage(pickMip(ctx, im, w), -w / 2, -hgt, w, hgt);
  const B = heraldPart(im, HERALD_PART.bell), px = -w / 2 + HERALD_PART.bellPivot[0] * w, py = -hgt + HERALD_PART.bellPivot[1] * hgt;
  const ang = -0.1 * k - 0.025 * breath, sc = 1 + 0.03 * k + 0.035 * breath; // kalkar, nefesle kabarır
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(sc, sc);
  ctx.drawImage(B.c, (B.sx - HERALD_PART.bellPivot[0] * im.width) * S, (B.sy - HERALD_PART.bellPivot[1] * im.height) * S, B.sw * S, B.sh * S);
  ctx.restore();
  const Hd = heraldPart(im, HERALD_PART.hand), dy = -1.2 * S * im.height / 100 * breath * k;
  ctx.drawImage(Hd.c, -w / 2 + Hd.sx * S - 0.3, -hgt + Hd.sy * S + dy - 0.3, Hd.sw * S * 1.03, Hd.sh * S * 1.03);
  ctx.restore();
}
// Roma cornu'su: gövdeyi saran büyük G biçimli pirinç boru, ortasında tutma çubuğu, ağzı başın üstünden ileri açılır.
// k=0 yürürken omuzda yatık, k=1 ağızda kalkık
function drawCornu(face, hgt, k, breath) {
  const u = hgt / 24;
  ctx.save(); ctx.translate(-face * 0.5 * u, -hgt * 0.66 - 1.5 * u * k); ctx.scale(face * u, u); ctx.rotate(-0.9 + 0.7 * k);
  const R = 6.6, tube = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, R, 0.35, Math.PI * 2 - 0.25); ctx.stroke(); };
  tube(3.4, '#2a1806'); // koyu dış çizgi
  const gr = ctx.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, '#fff0b0'); gr.addColorStop(0.45, '#e2ae46'); gr.addColorStop(1, '#8a5a18');
  tube(2.1, gr);
  ctx.strokeStyle = 'rgba(255,250,220,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, R - 0.5, 3.6, 5.2); ctx.stroke(); // parlaklık
  // tutma çubuğu (çaprazına)
  ctx.strokeStyle = '#2a1806'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-R * 0.7, R * 0.55); ctx.lineTo(R * 0.6, -R * 0.6); ctx.stroke();
  ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 1; ctx.stroke();
  // ağız (çan): borunun ucunda genişleyen huni
  ctx.save(); ctx.rotate(-0.25); ctx.translate(R, 0);
  const fl = 1 + 0.06 * breath * k;
  ctx.beginPath(); ctx.moveTo(-0.5, -1.2); ctx.lineTo(4.5 * fl, -3.6 * fl); ctx.lineTo(4.8 * fl, 3.6 * fl); ctx.lineTo(-0.5, 1.2); ctx.closePath();
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = '#2a1806'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = '#5a3810'; ctx.beginPath(); ctx.ellipse(4.7 * fl, 0, 0.9, 3.4 * fl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}
// ----- dokunulabilir dekor şakaları -----
// karga: dokununca gaklayıp uçar, 20-30 sn sonra başka yere konar · mezar: dokununca topraktan iskelet eli çıkar, el sallar, laf atar;
// üçüncü dokunuşta bir kez bahşiş fırlatır · Mortimer: balkonda dokununca çayından yudum alır (buhar, laf)
const GRAVE_LINES = ['Selam!', 'Rahatsız etmeyin, uyuyoruz.', 'Ön sıra dolu mu?', 'Bir kahve alırım.', 'Mortimer kira istiyor mu hâlâ?', 'Toprak üşütüyor.', 'Bir daha dokunursan bahşiş veririm. Belki.'];
function propSpot(rnd, pad) {
  for (let k = 0; k < 80; k++) {
    const x = 60 + rnd() * (W - 120), y = 110 + rnd() * (H - 170);
    if (nearestOnPaths(G.paths, x, y).d < 42 + pad) continue;
    if (G.plots.some(p => dist(p.x, p.y, x, y) < 40 + pad)) continue;
    if (dist(x, y, G.castle.x, G.castle.y - 40) < 110) continue;
    if ((G.props || []).some(o => dist(o.x, o.y, x, y) < 70)) continue;
    if (x < 300 && y > H - 100) continue; // sol alt arayüz
    return { x, y };
  }
  return null;
}
function setupProps() {
  let seed = (G.idx + 7) * 7919;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  G.props = []; G.propRnd = rnd;
  for (let i = 0; i < 2; i++) { const q = propSpot(rnd, 6); if (q) G.props.push({ kind: 'crow', x: q.x, y: q.y, state: 'idle', t: rnd() * 5, face: rnd() < 0.5 ? -1 : 1 }); }
  const q = propSpot(rnd, 10); if (q) G.props.push({ kind: 'grave', x: q.x, y: q.y, state: 'idle', t: 0, taps: 0, look: 1 + Math.floor(rnd() * 3) });
  G.teaT = 0;
}
function updateProps(dt) {
  if (G.teaT > 0) G.teaT -= dt;
  for (const o of G.props || []) {
    o.t += dt;
    if (o.kind === 'crow') {
      if (o.state === 'fly' && o.t > 1.6) { o.state = 'gone'; o.t = 0; o.wait = 20 + G.propRnd() * 10; }
      else if (o.state === 'gone' && o.t > o.wait) { const q = propSpot(G.propRnd, 6); if (q) { o.x = q.x; o.y = q.y; } o.state = 'land'; o.t = 0; }
      else if (o.state === 'land' && o.t > 0.8) { o.state = 'idle'; o.t = 0; }
    } else if (o.kind === 'grave' && o.state === 'hand' && o.t > 2.4) { o.state = 'idle'; o.t = 0; }
  }
}
function tapProps(x, y) {
  // Mortimer: balkondaki figürün üstü
  const m = mortimerPoint();
  if (Math.abs(x - m.x) < m.h * 0.45 && y < m.y + 4 && y > m.y - m.h - 4) {
    if (G.teaT <= 0) {
      G.teaT = 2.2; mortSay('tea', true); sfx('pick');
      for (let i = 0; i < 8; i++) emit(G.parts, { kind: 'glow', x: m.x + m.h * 0.28 + rand(-2, 2), y: m.y - m.h * 0.6, vx: rand(-4, 4), vy: -rand(10, 22), col: '235,235,225', s0: rand(1.5, 2.5), s1: rand(4, 6), life: rand(0.8, 1.3), a: 0.5 });
      cnt('tea'); G.stat = G.stat || {}; G.stat.tea = (G.stat.tea || 0) + 1;
    }
    return true;
  }
  for (const o of G.props || []) {
    if (o.kind === 'crow' && (o.state === 'idle' || o.state === 'land') && dist(x, y, o.x, o.y - 10) < 18) {
      o.state = 'fly'; o.t = 0; o.face = x < o.x ? 1 : -1; crowCaw();
      for (let i = 0; i < 5; i++) emit(G.parts, { kind: 'chunk', x: o.x, y: o.y - 8, vx: rand(-30, 30), vy: -rand(20, 60), g: 120, drag: 1.5, vr: rand(-5, 5), rot: rand(0, 6), col: '#1a1420', s0: 2, s1: 1, life: 0.8 });
      if (Math.random() < 0.35) mortSay('crowtap');
      cnt('crow'); G.stat = G.stat || {}; G.stat.crow = (G.stat.crow || 0) + 1;
      return true;
    }
    if (o.kind === 'grave' && dist(x, y, o.x, o.y - 10) < 18) {
      if (o.state !== 'hand' || o.t > 1.6) {
        o.state = 'hand'; o.t = 0; o.taps++;
        o.say = o.taps === 3 ? 'Al bakalım, bahşiş!' : GRAVE_LINES[(o.taps + G.idx) % GRAVE_LINES.length];
        if (o.taps === 3) { setTimeout(() => G && G.props && G.props.includes(o) && dropCoins(o.x, o.y - 14, 15), 900); cnt('tip'); }
        sfx('pick');
        for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'chunk', x: o.x + rand(-6, 6), y: o.y + 2, vx: rand(-25, 25), vy: -rand(30, 70), g: 260, vr: rand(-8, 8), rot: rand(0, 6), col: '#4a3a2a', s0: 1.8, s1: 1, life: 0.5 });
        G.stat = G.stat || {}; G.stat.grave = (G.stat.grave || 0) + 1;
      }
      return true;
    }
  }
  return false;
}
// karga gaklaması: iki kısa, kaba, inen ses (testere dalga + bant geçiren)
function crowCaw() {
  if (muted || !actx || !master) return;
  const t0 = actx.currentTime;
  for (let i = 0; i < 2; i++) {
    const t = t0 + i * 0.19, o = actx.createOscillator(), bp = actx.createBiquadFilter(), g = actx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.13);
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(bp); bp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.17);
  }
}
function drawProps(air) {
  for (const o of G.props || []) {
    if (o.kind === 'crow') {
      const im = spr('nm_crow'); if (!im || o.state === 'gone') continue;
      const flying = o.state === 'fly' || o.state === 'land';
      if (flying !== air) continue;
      let x = o.x, y = o.y, s = 1, rot = 0, flap = 0;
      if (o.state === 'fly') { const k = o.t / 1.6; x += o.face * k * k * 260; y -= k * 220; s = 1 - k * 0.3; rot = o.face * -0.3; flap = Math.sin(o.t * 40); }
      else if (o.state === 'land') { const k = 1 - o.t / 0.8; x -= k * 60; y -= k * k * 120; flap = Math.sin(o.t * 30) * k; }
      else { y -= Math.max(0, Math.sin(o.t * 2.2 + 1)) > 0.92 ? 2 : 0; } // arada bir gagalar/sıçrar
      if (!flying) shadow(x, y + 1, 7, 2.5);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(o.face * s, s * (1 - Math.abs(flap) * 0.15));
      drawSprite(ctx, im, 0, 0, 24 * im.width / im.height);
      ctx.restore();
    } else if (o.kind === 'grave' && !air) {
      const im = spr('nm_tomb_' + o.look);
      shadow(o.x, o.y + 2, 11, 4);
      if (im) drawSprite(ctx, im, o.x, o.y + 3, 20);
      if (o.state === 'hand') {
        // topraktan çıkan iskelet eli: yükselir, sallanır, iner
        const k = o.t < 0.3 ? o.t / 0.3 : o.t > 2.0 ? Math.max(0, 1 - (o.t - 2.0) / 0.4) : 1, wave = Math.sin(o.t * 9) * 0.35 * (o.t > 0.3 && o.t < 2 ? 1 : 0);
        const hx = o.x + 14, hy = o.y + 4;
        ctx.save(); ctx.beginPath(); ctx.rect(hx - 20, hy - 50, 40, 50); ctx.clip();
        ctx.translate(hx, hy + (1 - k) * 34); ctx.rotate(wave); ctx.scale(1.5, 1.5);
        ctx.strokeStyle = '#1a120c'; ctx.lineCap = 'round';
        const bone = (x0, y0, x1, y1, w) => { ctx.lineWidth = w + 1.6; ctx.strokeStyle = '#1a120c'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = '#efe6cc'; ctx.stroke(); };
        bone(0, 0, 0, -12, 2.6);            // bilek kemiği
        roundRect(-3.2, -16, 6.4, 5, 2, '#efe6cc', '#1a120c', 0.8); // avuç
        for (let f = 0; f < 4; f++) bone(-2.4 + f * 1.6, -16, -3.6 + f * 2.4, -22 - (f === 1 || f === 2 ? 2 : 0), 1.2);
        bone(3, -13, 6, -17, 1.2);          // başparmak
        ctx.restore();
        // toprak öbeği
        ctx.fillStyle = '#3a2c1e'; ctx.beginPath(); ctx.ellipse(hx, hy, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        if (o.say && o.t > 0.25 && o.t < 2.2) {
          ctx.save(); ctx.font = `800 12px ${FONT_B}`; const sw = ctx.measureText(TR(o.say)).width, ls = wrapLines(o.say, sw > 170 ? sw / 2 + 20 : 200, 12, '800', FONT_B, 3);
          ctx.font = `800 12px ${FONT_B}`; const tw = Math.max(...ls.map(l => ctx.measureText(l).width)) + 14, th = ls.length * 14 + 6, bx = clamp(hx - tw / 2, 4, W - tw - 4), by = hy - 50 - th;
          roundRect(bx, by, tw, th, 6, '#f2ecd8', '#1a1024', 1.4); ls.forEach((l, i) => txt(l, bx + tw / 2, by + 10 + i * 14, 12, '#2a1838', 'center', '800', FONT_B, false));
          ctx.restore();
        }
      }
    }
  }
}
// ----- bölüme özel mekanikler (lv.mech) -----
// mud: yoldaki çamur düşmanı yavaşlatır · graves: yol kenarı mezarlardan arada bir bizim tarafa ölü kalkar
// lake: göldeki yaratık yoldaki bir düşmanı suya çeker · sunbeam: Solarian güneş ışını bir kuleyi kısa süre susturur
const MECH = {
  mud: { title: 'ÇAMURLU YOL', sub: 'Çamur birikintileri düşmanları neredeyse yarı hıza düşürür' },
  graves: { title: 'MEZARLAR UYANIYOR', sub: 'Arada bir mezarlardan senin için ölüler kalkar', every: 18 },
  lake: { title: 'GÖLDE BİR ŞEY VAR', sub: 'Göl yaratığı yoldaki düşmanları suya çeker', every: 30 },
  sunbeam: { title: 'GÜNEŞ IŞINI', sub: 'Solarian rahipleri arada bir kulelerinden birini susturur', every: 30, warn: 2, off: 4 },
};
function setupMech() {
  const kind = G.lv.mech;
  G.mech = kind ? { kind, timer: (MECH[kind].every || 0) * 0.6, spots: [], fx: [], shown: false } : null;
  if (!kind) return;
  const M = G.mech, P0 = G.paths[0];
  const free = (x, y, r) => x > 30 && x < W - 30 && y > 80 && y < H - 30 && G.plots.every(p => dist(p.x, p.y, x, y) > r) && dist(x, y, G.castle.x, G.castle.y) > 90;
  const spaced = (x, y, r) => M.spots.every(o => dist(o.x, o.y, x, y) > r);
  if (kind === 'mud') {
    for (const [p, f] of [[P0, 0.3], [P0, 0.56]].concat(G.paths.slice(1, 2).map(p => [p, 0.45]))) {
      const q = pathPos(p, p.total * f);
      // ang: yolun yer düzlemindeki yönü (birikinti yol boyunca uzanır); a: yol boyunca, b: yol enine yarıçap
      if (spaced(q.x, q.y, 60)) M.spots.push({ x: q.x, y: q.y, r: 32, a: 37, b: 24, ang: Math.atan2(q.dy / MUD_SQ, q.dx), seed: Math.random() * 9 });
    }
  } else if (kind === 'graves' || kind === 'lake') {
    for (let f = 0.18; f <= 0.82 && M.spots.length < (kind === 'graves' ? 4 : 2); f += 0.06) {
      for (const side of [1, -1]) {
        const q = pathPos(P0, P0.total * f, side * (kind === 'graves' ? 44 : 50));
        const near = nearestOnPaths(G.paths, q.x, q.y);
        if (near.d > 32 && free(q.x, q.y, 46) && spaced(q.x, q.y, kind === 'graves' ? 110 : 200)) {
          const r = pathPos(P0, P0.total * f);
          M.spots.push({ x: q.x, y: q.y, rx: r.x, ry: r.y, look: 1 + (M.spots.length % 3), seed: Math.random() * 9 });
          break;
        }
      }
    }
  }
}
function updateMech(dt) {
  const M = G.mech; if (!M) return;
  const D = MECH[M.kind];
  if (!M.shown && G.t > 3.5) { M.shown = true; G.banner = { title: D.title, sub: D.sub, t: 0, dur: 3.4 }; }
  for (const f of M.fx) f.t += dt;
  if (M.kind === 'mud') {
    for (const e of G.enemies) {
      if (e.dead || e.def.flying || e.under) continue;
      const m = mudAt(e.x, e.y);
      e.inMud = !!m;
      if (m) {
        slowEnemy(e, MUD_SLOW, 0.25);
        // yürürken çamur sıçrar
        if (Math.random() < dt * 4) {
          const k = (CHAR_H['enemy_' + e.type] || 24) / 24;
          for (let i = 0; i < 3; i++) emit(G.parts, { x: e.x + rand(-4, 4) * k, y: e.y - 1, vx: rand(-30, 30), vy: -rand(30, 70), g: 260, col: i ? '#3b2c17' : '#5c4526', s0: rand(1, 1.8) * k, s1: 0.6, life: rand(0.35, 0.55), floor: e.y + rand(0, 3) });
        }
      }
    }
    for (const sd of G.soldiers) sd.inMud = !sd.dead && !!mudAt(sd.x, sd.y);
  }
  if (G.wave <= 0) return;
  M.timer -= dt;
  if (M.kind === 'graves' && M.timer <= 0 && M.spots.length) {
    M.timer = D.every;
    const m = M.spots[Math.floor(Math.random() * M.spots.length)];
    const pool = [...new Set(G.lv.waves.flat().map(g => g.t))].filter(t => ENEMIES[t] && !ENEMIES[t].chief && ENEMIES[t].hp < 600 && !ENEMIES[t].flying);
    const t = pool[Math.floor(Math.random() * pool.length)] || 'legion';
    raiseMinion({ x: m.x, y: m.y + 6, face: m.x < m.rx ? 1 : -1, name: 'enemy_' + t, rig: ENEMIES[t].base ? 'enemy_' + ENEMIES[t].base : null });
    m.flash = 1; mortSay('graves');
  } else if (M.kind === 'lake' && M.timer <= 0) {
    // menzildeki (boss olmayan, uçmayan) en öndeki düşmanı yakalar; yoksa kısa süre sonra yine dener
    let pick = null, spot = null;
    for (const m of M.spots) for (const e of G.enemies) {
      if (e.dead || e.def.chief || e.def.flying || e.under || e.grabbed || dist(e.x, e.y, m.rx, m.ry) > 48) continue;
      if (!pick || e.d > pick.d) { pick = e; spot = m; }
    }
    if (!pick) { M.timer = 0.8; return; }
    M.timer = D.every; pick.grabbed = true; stunEnemy(pick, 1.2);
    M.fx.push({ kind: 'tentacle', x: spot.x, y: spot.y, e: pick, t: 0, dur: 1.3 });
    sfx('roar'); mortSay('lake');
  } else if (M.kind === 'sunbeam' && M.timer <= 0) {
    const list = G.towers.filter(t => !(t.disabledT > 0));
    if (!list.length) { M.timer = 3; return; }
    M.timer = D.every;
    M.fx.push({ kind: 'sun', tower: list[Math.floor(Math.random() * list.length)], t: 0, dur: D.warn + 0.7 });
  }
  // efektlerin zamanlı sonuçları
  for (const f of M.fx) {
    if (f.kind === 'tentacle' && !f.done && f.t > 0.75) {
      f.done = true;
      if (!f.e.dead) { killEnemy(f.e); f.e.leaked = true; }
      for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', x: f.x + rand(-10, 10), y: f.y - rand(0, 8), vx: rand(-40, 40), vy: -rand(40, 110), g: 220, col: '90,170,160', s0: rand(2, 4), s1: 1, life: rand(0.4, 0.8) });
      impactFx(f.x, f.y - 12, '120,220,200', 1.2);
    }
    if (f.kind === 'sun' && !f.done && f.t > D.warn) {
      f.done = true;
      if (G.towers.includes(f.tower)) { f.tower.disabledT = Math.max(f.tower.disabledT || 0, D.off); f.tower.disabledKind = 'sun'; }
      impactFx(f.tower.x, f.tower.y - 60, '255,230,140', 1.5); shakeScreen(2, 0.2); mortSay('sun');
    }
  }
  M.fx = M.fx.filter(f => f.t < f.dur);
  for (const m of M.spots) if (m.flash > 0) m.flash -= dt;
}
// ----- Çamur birikintisi (Sisli Bataklık): yol üstünde, yol yönünde uzanan düzensiz birikinti -----
// Yer düzlemi koordinatları (u: yol boyunca, v: enine) MUD_SQ ile dikeyde basıktır (3/4 bakış).
// Durağan katman (ıslak leke, sıçrantılar, kenar, çamur, yosun, yarı gömülü kemik) bir kez önbelleğe çizilir;
// her karede parıltı, girdap, kabarcıklar, yağmur halkaları ve içinden geçenlerin halkaları eklenir.
const MUD_SQ = 0.6, MUD_RES = 3;
// çamurda yavaşlama: hız %52'ye düşer (önce %65'ti, 8 Eki'de %20 daha yavaşlatıldı)
const MUD_SLOW = 1 - 0.65 * 0.8;
function mudRand(m) { let x = Math.floor(m.seed * 1e6) || 1; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }
// kenar çizgisi: yarıçap açıyla dalgalanır (tohumlu)
function mudShape(m) {
  if (m.shape) return m.shape;
  const R = mudRand(m), waves = [2, 3, 4, 5, 7].map(k => [k, R() * 0.06 + (k > 5 ? 0.02 : 0.04), R() * 6.28]);
  return (m.shape = (th) => 1 + waves.reduce((acc, [k, amp, ph]) => acc + amp * Math.sin(k * th + ph), 0));
}
function mudPath(g, m, k, n = 40) {
  const f = mudShape(m);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = i / n * Math.PI * 2, r = f(th) * k;
    const x = Math.cos(th) * m.a * r, y = Math.sin(th) * m.b * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
// yer düzlemi -> ekran (birikinti merkezine göre)
function mudPt(m, u, v) { const c = Math.cos(m.ang), s2 = Math.sin(m.ang); return { x: m.x + u * c - v * s2, y: m.y + (u * s2 + v * c) * MUD_SQ }; }
// nokta bir çamur birikintisinin içinde mi (kenarın biraz içi)
function mudAt(x, y) {
  const M = G.mech; if (!M || M.kind !== 'mud') return null;
  for (const m of M.spots) {
    const dx = x - m.x, dy = (y - m.y) / MUD_SQ, c = Math.cos(m.ang), s2 = Math.sin(m.ang);
    const u = dx * c + dy * s2, v = -dx * s2 + dy * c;
    if ((u / (m.a * 0.92)) ** 2 + (v / (m.b * 0.92)) ** 2 < 1) return m;
  }
  return null;
}
function mudBase(m) {
  if (m.base) return m.base;
  const ext = Math.ceil(Math.max(m.a, m.b) * 1.5 + 8), c = document.createElement('canvas');
  c.width = c.height = ext * 2 * MUD_RES;
  const g = c.getContext('2d'), R = mudRand(m);
  g.scale(MUD_RES, MUD_RES); g.translate(ext, ext); g.scale(1, MUD_SQ); g.rotate(m.ang);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // ıslak toprak lekesi (dışta, yumuşak)
  for (const [k, al] of [[1.42, 0.10], [1.28, 0.14], [1.16, 0.18]]) { mudPath(g, m, k); g.fillStyle = `rgba(48,34,16,${al})`; g.fill(); }
  // etrafa sıçramış çamur damlaları
  for (let i = 0; i < 9; i++) {
    const th = R() * Math.PI * 2, rr = 1.08 + R() * 0.3, rad = 1.2 + R() * 2.2;
    const x = Math.cos(th) * m.a * rr, y = Math.sin(th) * m.b * rr;
    g.beginPath(); g.ellipse(x, y, rad * 1.3, rad, th, 0, Math.PI * 2);
    g.fillStyle = '#7a5a30'; g.fill(); g.strokeStyle = 'rgba(36,22,10,0.85)'; g.lineWidth = 0.8; g.stroke();
    g.beginPath(); g.ellipse(x - rad * 0.3, y - rad * 0.35, rad * 0.5, rad * 0.3, th, 0, Math.PI * 2); g.fillStyle = 'rgba(255,236,190,0.35)'; g.fill();
  }
  // kabarık ıslak kenar
  mudPath(g, m, 1.04);
  const rim = g.createLinearGradient(0, -m.b, 0, m.b); rim.addColorStop(0, '#b08a56'); rim.addColorStop(0.55, '#8c6a3c'); rim.addColorStop(1, '#6a4c26');
  g.fillStyle = rim; g.fill(); g.strokeStyle = '#2a190b'; g.lineWidth = 1.8; g.stroke();
  // kenarın üstünde ıslak parıltı
  // kenarın üst yarısında ıslak parıltı (ışık yukarıdan)
  g.save(); g.beginPath(); g.rect(-m.a * 2, -m.b * 2, m.a * 4, m.b * 1.7); g.clip();
  mudPath(g, m, 0.95); g.strokeStyle = 'rgba(255,238,200,0.3)'; g.lineWidth = 1.4; g.stroke(); g.restore();
  // çamur yüzeyi
  mudPath(g, m, 0.84);
  const mud = g.createRadialGradient(-m.a * 0.15, -m.b * 0.1, 2, 0, 0, m.a * 0.9);
  mud.addColorStop(0, '#6e5a2e'); mud.addColorStop(0.55, '#57461f'); mud.addColorStop(1, '#3c3015');
  g.fillStyle = mud; g.fill(); g.strokeStyle = 'rgba(30,18,8,0.85)'; g.lineWidth = 1.2; g.stroke();
  g.save(); mudPath(g, m, 0.84); g.clip();
  // iç kenar gölgesi (kenar yüzeye gölge düşürür)
  g.translate(0, -2); mudPath(g, m, 0.84); g.strokeStyle = 'rgba(14,8,2,0.3)'; g.lineWidth = 4; g.stroke(); g.translate(0, 2);
  // bataklık yosunu lekeleri
  for (let i = 0; i < 4; i++) {
    const x = (R() - 0.5) * m.a * 1.1, y = (R() - 0.5) * m.b * 1.0, rx = 3 + R() * 5;
    g.beginPath(); g.ellipse(x, y, rx, rx * (0.5 + R() * 0.4), R() * 3, 0, Math.PI * 2);
    g.fillStyle = 'rgba(104,118,44,0.42)'; g.fill();
    g.beginPath(); g.ellipse(x - 1, y - 0.6, rx * 0.45, rx * 0.22, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(150,165,70,0.35)'; g.fill();
  }
  // çamur topakları
  for (let i = 0; i < 3; i++) {
    const x = (R() - 0.5) * m.a * 1.0, y = (R() - 0.5) * m.b * 0.9, rr = 2 + R() * 2;
    g.beginPath(); g.ellipse(x, y, rr * 1.4, rr, 0, 0, Math.PI * 2); g.fillStyle = '#4f3d20'; g.fill();
    g.strokeStyle = 'rgba(20,12,4,0.7)'; g.lineWidth = 0.8; g.stroke();
  }
  g.restore();
  // kenara takılmış küçük çubuklar
  for (let i = 0; i < 2; i++) {
    const th = R() * Math.PI * 2, x = Math.cos(th) * m.a * 0.86, y = Math.sin(th) * m.b * 0.86, L = 6 + R() * 5, an = th + 1.4 + R() * 0.4;
    g.strokeStyle = '#21140a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke();
    g.strokeStyle = '#6e5230'; g.lineWidth = 1.2; g.stroke();
  }
  return (m.base = { c, ext });
}
// yarı gömülü kemik / kafatası: ekran düzleminde (basık değil) çizilir
function mudProp(m) {
  const R = mudRand(m); R(); R();
  const kind = R() < 0.5 ? 'skull' : 'bone', p = mudPt(m, (R() - 0.5) * m.a * 0.7, (R() - 0.5) * m.b * 0.5);
  const bob = Math.sin(time * 1.3 + m.seed) * 0.6;
  ctx.save(); ctx.translate(p.x, p.y + bob); ctx.lineJoin = 'round';
  if (kind === 'skull') {
    // yarısı çamurda kafatası: yalnız üst kubbe ve göz çukurları
    ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.bezierCurveTo(-6, -7.5, 6, -7.5, 5.5, 0); ctx.closePath();
    ctx.fillStyle = '#e8dcbc'; ctx.fill(); ctx.strokeStyle = '#21140a'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = '#21140a';
    for (const ex of [-2.3, 2.3]) { ctx.beginPath(); ctx.ellipse(ex, -1.8, 1.4, 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
    // gözlerde soluk yeşil ışık
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const ex of [-2.3, 2.3]) glow(ctx, ex, -1.8, 2.2, '120,255,140', 0.35 + 0.25 * Math.sin(time * 2 + m.seed)); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-2.5, -5, 1.6, 0.8, -0.3, 0, Math.PI * 2); ctx.fill();
  } else {
    // çamurdan çıkan kemik ucu
    ctx.rotate(-0.5 + R() * 0.3);
    ctx.fillStyle = '#e8dcbc'; ctx.strokeStyle = '#21140a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.rect(-1.4, -8, 2.8, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-1.6, -8.4, 1.9, 0, Math.PI * 2); ctx.arc(1.6, -8.4, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(-1.2, -8.6, 2.4, 2);
  }
  // çamurun kemiğe değdiği yerde koyu halka
  ctx.restore();
  ctx.fillStyle = 'rgba(30,20,8,0.7)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + bob + 0.5, 6.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
}
function drawMud(m) {
  const B = mudBase(m);
  ctx.drawImage(B.c, m.x - B.ext, m.y - B.ext, B.ext * 2, B.ext * 2);
  ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1, MUD_SQ); ctx.rotate(m.ang);
  mudPath(ctx, m, 0.84); ctx.clip();
  // yavaş dönen girdap çizgileri
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const r = (0.25 + i * 0.22), rot = time * (0.18 + i * 0.05) * (i % 2 ? -1 : 1) + m.seed + i;
    ctx.strokeStyle = `rgba(122,98,58,${0.35 - i * 0.07})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, m.a * r, m.b * r, 0, rot, rot + 1.3 + i * 0.3); ctx.stroke();
  }
  // ıslak parıltı: yavaşça kayar ve nabız gibi parlar
  for (let i = 0; i < 2; i++) {
    const ph = time * 0.25 + m.seed * 3 + i * 2.1, x = -m.a * 0.32 + Math.sin(ph) * 3 + i * m.a * 0.45, y = -m.b * 0.34 + i * m.b * 0.42 + Math.cos(ph) * 1.5;
    ctx.fillStyle = `rgba(200,215,170,${0.13 + 0.06 * Math.sin(time * 1.7 + i * 2 + m.seed)})`;
    ctx.beginPath(); ctx.ellipse(x, y, m.a * (0.32 - i * 0.08), m.b * 0.16, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,250,225,${0.3 + 0.15 * Math.sin(time * 1.7 + i * 2 + m.seed)})`;
    ctx.beginPath(); ctx.ellipse(x - 2, y - 1, m.a * (0.15 - i * 0.04), m.b * 0.05, -0.15, 0, Math.PI * 2); ctx.fill();
  }
  // halkalar: kabarcık patlaması, yağmur damlası, içinden geçenler
  const ring = (u, v, k, al) => { ctx.strokeStyle = `rgba(150,124,80,${al * (1 - k)})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(u, v, 1.5 + k * 9, 1.5 + k * 9, 0, 0, Math.PI * 2); ctx.stroke(); };
  const bub = [];
  for (let i = 0; i < 4; i++) {
    const per = 2.4 + i * 0.55, tt = time + m.seed * 5 + i * 1.7, cyc = Math.floor(tt / per), p = (tt / per) % 1;
    const h1 = Math.sin(cyc * 12.9898 + i * 78.233 + m.seed) * 43758.5453, h2 = Math.sin(cyc * 39.346 + i * 11.135 + m.seed) * 24634.6345;
    const u = (h1 - Math.floor(h1) - 0.5) * m.a * 1.1, v = (h2 - Math.floor(h2) - 0.5) * m.b * 0.9;
    if (p > 0.72 && p < 1) ring(u, v, (p - 0.72) / 0.28, 0.9);
    bub.push([u, v, p, i]);
  }
  if (G.weather === 'rain') for (let i = 0; i < 3; i++) {
    const per = 0.9 + i * 0.37, tt = time + i * 0.41 + m.seed, cyc = Math.floor(tt / per), p = (tt / per) % 1;
    const h = Math.sin(cyc * 91.7 + i * 7.3 + m.seed) * 1e4, h2 = Math.sin(cyc * 17.1 + i * 3.1) * 1e4;
    ring((h - Math.floor(h) - 0.5) * m.a * 1.3, (h2 - Math.floor(h2) - 0.5) * m.b * 1.1, p, 0.6);
  }
  ctx.restore();
  // içinden geçenlerin ayak halkaları (ekran düzleminde)
  for (const list of [G.enemies, G.soldiers]) for (const u of list) {
    if (!u.inMud || u.dead) continue;
    const k = (((time * 1.6 + (u.off || u.x * 0.01)) % 1) + 1) % 1;
    ctx.strokeStyle = `rgba(150,124,80,${0.7 * (1 - k)})`; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(u.x, u.y, 5 + k * 10, (5 + k * 10) * MUD_SQ, 0, 0, Math.PI * 2); ctx.stroke();
  }
  mudProp(m);
  // kabarcıklar: şişer, parlar, patlar (patlayınca çamur damlaları sıçrar)
  for (const [u, v, p, i] of bub) {
    const q = mudPt(m, u, v);
    if (p < 0.7) {
      const r = 0.5 + easeOutBack(p / 0.7) * (1.6 + (i % 2) * 0.9);
      ctx.fillStyle = '#7a6436'; ctx.strokeStyle = 'rgba(30,18,6,0.75)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,215,0.65)'; ctx.beginPath(); ctx.arc(q.x - r * 0.35, q.y - r * 0.5, r * 0.25, 0, Math.PI * 2); ctx.fill();
    } else if (p < 0.82) {
      const k = (p - 0.7) / 0.12;
      ctx.fillStyle = `rgba(60,44,22,${1 - k})`;
      for (let j = 0; j < 4; j++) { const an = -0.4 - j * 0.75; ctx.beginPath(); ctx.arc(q.x + Math.cos(an) * k * 6, q.y - Math.sin(-an) * k * 5 - Math.sin(k * Math.PI) * 4, 0.9, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}
// çamurdakilerin ayakları: birim çizildikten sonra ayaklarının üstüne çamur halkası (gömülmüş görünür)
function drawWade(u) {
  if (!u.inMud || u.dead) return;
  const k = (ENEMIES[u.type] ? CHAR_H['enemy_' + u.type] || 26 : unitH(u)) / 30, w = 8 * k, h = 2.6 * k, y = u.y + 0.5;
  ctx.fillStyle = '#352814'; ctx.beginPath(); ctx.ellipse(u.x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6e5430'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(u.x, y - 0.4, w * 0.9, h * 0.7, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(u.x, y, w, h, 0, 0, Math.PI); ctx.stroke();
}
function drawMechGround() {
  const M = G.mech; if (!M) return;
  if (M.kind === 'mud') { for (const m of M.spots) drawMud(m); return; }
  if (M.kind === 'graves') {
    for (const m of M.spots) {
      const im = spr('nm_tomb_' + m.look), soon = M.timer < 2 || m.flash > 0;
      if (soon) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, m.x, m.y - 8, 26, '120,255,140', 0.35 + Math.sin(time * 9) * 0.15); ctx.restore(); }
      shadow(m.x, m.y + 2, 12, 4);
      if (im) drawSprite(ctx, im, m.x, m.y + 3, 22);
      else roundRect(m.x - 7, m.y - 18, 14, 20, 6, '#6a6a72', '#1a1a20', 1.5);
    }
  } else if (M.kind === 'lake') {
    for (const m of M.spots) {
      ctx.save(); ctx.translate(m.x, m.y);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
      g.addColorStop(0, 'rgba(8,22,26,0.95)'); g.addColorStop(0.8, 'rgba(14,40,44,0.85)'); g.addColorStop(1, 'rgba(14,40,44,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 2; i++) {
        const ph = (time * 0.5 + i * 0.5 + m.seed) % 1;
        ctx.strokeStyle = `rgba(120,200,190,${0.4 * (1 - ph)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, 6 + ph * 16, 3 + ph * 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // iki parlak göz: arada bir kırpar
      if (Math.sin(time * 0.8 + m.seed) > -0.85) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, -4, -1, 3.5, '255,220,80', 0.9); glow(ctx, 4, -1, 3.5, '255,220,80', 0.9); ctx.restore();
      }
      ctx.restore();
    }
  }
}
function drawMechFx() {
  const M = G.mech; if (!M) return;
  for (const f of M.fx) {
    if (f.kind === 'tentacle') {
      // dokunaç: göl gözünden kalkıp kurbana uzanır, sarar, suya çeker
      const k = f.t / f.dur, reach = k < 0.45 ? easeOutBack(k / 0.45) : k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const tx = f.done ? f.x : lerp(f.x, f.e.x, reach), ty = f.done ? f.y : lerp(f.y, f.e.y - 10, reach);
      const mx = (f.x + tx) / 2 + Math.sin(time * 12) * 6, my = Math.min(f.y, ty) - 30 * reach;
      ctx.save(); ctx.lineCap = 'round';
      for (const [w, c] of [[11, '#140a1c'], [8, '#4a2a5a'], [4, '#7a4a8a']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * (1 - k * 0.3);
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
      }
      for (let i = 1; i < 5; i++) { const u = i / 5, px = (1 - u) ** 2 * f.x + 2 * (1 - u) * u * mx + u * u * tx, py = (1 - u) ** 2 * f.y + 2 * (1 - u) * u * my + u * u * ty; circle(px, py - 1, 1.6, '#d8b0e0'); }
      ctx.restore();
    } else if (f.kind === 'sun') {
      const t = f.tower, D = MECH.sunbeam;
      if (!f.done) {
        // uyarı: kulenin altında daralan altın halka
        const k = f.t / D.warn;
        ctx.save(); ctx.strokeStyle = `rgba(255,220,110,${0.5 + 0.4 * Math.sin(time * 14)})`; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time * 30;
        ctx.beginPath(); ctx.ellipse(t.x, t.y, 46 - k * 16, (46 - k * 16) * 0.42, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      } else {
        // ışın: gökten inen altın sütun
        const k = (f.t - D.warn) / 0.7, a = 1 - k;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(t.x - 22, 0, t.x + 22, 0);
        g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.5, `rgba(255,245,200,${0.85 * a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g; ctx.fillRect(t.x - 22, 0, 44, t.y);
        glow(ctx, t.x, t.y - 20, 60, '255,220,120', 0.6 * a);
        ctx.restore();
      }
    }
  }
}
// Paralı askerler: kale kapısından çıkıp en ilerlemiş düşmanın geldiği yol boyunca yürürler
function spawnMercs() {
  const n = MERCS.count + (upgRank('spells') >= 2 ? 1 : 0);
  let p = G.paths[0], best = -1;
  for (const e of G.enemies) if (!e.dead && e.d / e.p.total > best) { best = e.d / e.p.total; p = e.p; }
  // toplanma yeri seçildiyse oraya en yakın yol noktasına kadar yolu izlerler, sonra yerine yürürler
  const R = G.castle.rally, q = R ? nearestOnPaths(G.paths, R.x, R.y) : null;
  if (q) p = q.p;
  const goal = q ? q.along : Math.max(0, p.total - MERCS.guard);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 10, st = pathPos(p, p.total, off), g0 = R ? { x: R.x + off, y: R.y + (i % 2 ? 6 : -6) } : pathPos(p, goal, off);
    G.soldiers.push({ militia: true, merc: true, x: st.x, y: st.y, rx: g0.x, ry: g0.y, hp: MERCS.hp, maxHp: MERCS.hp, dmg: MERCS.dmg, armor: MERCS.armor,
      rate: 1, speed: MERCS.march, engage: 60, atk: 0, target: null, dead: false, face: -1, anim: 0, slot: i, life: MERCS.life,
      march: { p, d: p.total + i * 16, goal, off, rally: !!R } });
  }
  G.effects.push({ kind: 'dust', x: G.castle.x, y: G.castle.y, t: 0, dur: 0.5 });
  G.castle.flash = 0.15;
  floatText(G.castle.x - 10, G.castle.y - 70, NECRO ? 'Ölüler kalkıyor!' : 'Paralı askerler!', NECRO ? '#9dff8a' : '#ffe27a');
  sfx('reinforce');
}
function updateMercs(dt) {
  if (NECRO) return; // şapelden kendiliğinden iskelet çıkmaz
  if (G.wave <= 0 || G.lives <= 0) return;
  if (G.mercT == null) G.mercT = MERCS.first;
  G.mercT -= dt;
  if (G.mercT <= 0) { spawnMercs(); G.mercT = MERCS.every * (upgRank('spells') >= 3 ? 0.75 : 1); }
}
// ----- Kızıl Ay -----
function startBloodMoon() {
  G.bloodT = BLOOD.dur;
  G.banner = { title: 'KIZIL AY', sub: 'Ölüler azgın, büyüler hızlı dolar, düşen düşman ölü olarak kalkar. Engizisyon dua ediyor!', t: 0, dur: 3.6 };
  shakeScreen(3, 0.4); sfx('portal'); mortSay('blood', true);
}
function drawBloodMoon() {
  if (!(G.bloodT > 0)) return;
  const k = Math.min(1, (BLOOD.dur - G.bloodT) / 1.5, G.bloodT / 1.5), p = 0.85 + Math.sin(time * 1.6) * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,${Math.round(255 - 95 * k)},${Math.round(255 - 115 * k)},1)`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, 'rgba(90,0,10,0)'); g.addColorStop(1, `rgba(90,0,10,${0.45 * k * p})`); ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  // gökte kızıl ay (üst orta, boss barının altında kalmasın diye biraz sağda)
  const mx = W * 0.62, my = 70;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, mx, my, 70, '255,40,30', 0.35 * k * p);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = k; circle(mx, my, 17, '#c21a12', 'rgba(255,120,90,0.8)', 1.5);
  ctx.fillStyle = 'rgba(90,0,0,0.45)'; ctx.beginPath(); ctx.arc(mx - 5, my - 3, 4.5, 0, Math.PI * 2); ctx.arc(mx + 6, my + 5, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// ----- mahzen kapağı -----
function openHatch(h) {
  if (!h || h.state !== 'closed' || G.gold < HATCH.cost) return false;
  G.gold -= HATCH.cost; h.state = 'open'; h.openT = G.t;
  const C = HATCH.ghoul, s = { guard: true, ghoul: h, militia: false, x: h.x, y: h.y, rx: h.rx, ry: h.ry, hp: C.hp, maxHp: C.hp, dmg: C.dmg, armor: C.armor,
    rate: C.rate, speed: C.speed, engage: C.engage, atk: 0, target: null, dead: false, respawnT: 0, face: h.rx < h.x ? -1 : 1, anim: 0, slot: 0, born: G.t,
    big: 'unit_gulyabani', bigAtk: 'unit_gulyabani_lunge', bh: BIG_H.ghoul };
  h.ghoul = s; G.soldiers.push(s);
  ghoulRiseFx(h); sfx('raise'); mortSay('hatch', true);
  return true;
}
function ghoulRiseFx(h) {
  G.effects.push({ kind: 'pillar', x: h.x, y: h.y, col: '150,255,130', t: 0, dur: 0.8 });
  G.effects.push({ kind: 'ring', x: h.x, y: h.y, r: 34, col: '190,110,255', t: 0, dur: 0.5 });
  G.effects.push({ kind: 'dust', x: h.x, y: h.y, t: 0, dur: 0.7 });
  for (let i = 0; i < 12; i++) emit(G.parts, { kind: 'glow', add: true, x: h.x + rand(-12, 12), y: h.y - rand(0, 14), vy: -rand(25, 60), drag: 1.5,
    col: i % 3 ? '130,255,120' : '200,110,255', s0: rand(3, 5), s1: 0.5, life: rand(0.5, 0.9) });
}
function updateHatches(dt) {
  for (const h of G.hatches) {
    if (h.state === 'sealed') continue;
    // meşaleci yanından geçerken (gulyabani nöbette değilse) kapağı mühürler
    const guard = h.ghoul && !h.ghoul.dead && dist(h.ghoul.x, h.ghoul.y, h.x, h.y) < HATCH.sealR * 1.6;
    const torch = !guard && G.enemies.find(e => !e.dead && e.type === 'torch' && e.siege === undefined && dist(e.x, e.y, h.x, h.y) < HATCH.sealR);
    if (torch) {
      h.sealT += dt;
      if (Math.random() < dt * 22) emit(G.parts, { kind: 'glow', add: true, x: h.x + rand(-14, 14), y: h.y - rand(0, 10), vy: -rand(20, 50), col: '255,150,60', s0: rand(3, 6), s1: 0.5, life: rand(0.4, 0.7) });
      if (h.sealT >= HATCH.seal) {
        h.state = 'sealed';
        floatText(h.x, h.y - 34, 'Mühürlendi!', '#ffb070'); sfx('splash'); mortSay('sealed', true);
        G.effects.push({ kind: 'ring', x: h.x, y: h.y, r: 30, col: '255,150,60', t: 0, dur: 0.5 });
        if (G.sel && G.sel.hatch === h) setSel(null);
      }
    } else h.sealT = Math.max(0, h.sealT - dt * 0.5);
  }
}
function drawHatches() {
  for (const h of G.hatches) {
    const name = h.state === 'sealed' ? 'nm2_hatch_sealed' : h.state === 'open' ? 'nm2_hatch_open' : 'nm2_hatch', im = spr(name);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(h.x + 2, h.y + 2, HATCH.w * 0.52, HATCH.w * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    // kapalı kapak: aralıktan sızan yeşil-mor ışık (dokunulabilir olduğu belli olsun)
    if (h.state === 'closed') glow(ctx, h.x, h.y - 4, 26, (Math.sin(time * 1.3 + h.x) > 0 ? '150,255,130' : '190,110,255'), 0.18 + Math.sin(time * 3 + h.y) * 0.06);
    if (h.state === 'open') glow(ctx, h.x, h.y - 6, 30, '130,255,120', 0.28);
    if (im) drawSprite(ctx, im, h.x, h.y + HATCH.w * 0.22, HATCH.w * (h.state === 'closed' ? 1 : 1.02));
    else { ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(h.x, h.y, HATCH.w * 0.45, HATCH.w * 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
    if (h.sealT > 0 && h.state !== 'sealed') { // mühürleme ilerlemesi
      const k = h.sealT / HATCH.seal;
      ctx.strokeStyle = 'rgba(255,150,60,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y - 26, 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    const g = h.ghoul;
    if (g && g.dead && h.state === 'open') { // yeniden çıkış sayacı
      const k = 1 - g.respawnT / HATCH.respawn;
      circle(h.x, h.y - 26, 9, 'rgba(20,12,24,0.75)', 'rgba(150,255,130,0.5)', 1.2);
      ctx.strokeStyle = '#96ff82'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(h.x, h.y - 26, 9, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      drawSkullIcon(h.x, h.y - 26, 5);
    }
  }
}
// ----- şapel ağacı: Kemik Devi kapıyı tutar (son kademe Kemik Kolos: daha iri, yeri döver) -----
function chapelGate() { // devin bekleyeceği yer: bayrak seçildiyse orası, yoksa kaleye giren yolun kapıdan biraz önü
  if (G.castle.rally) return G.castle.rally;
  const P = G.paths.reduce((a, p) => (dist(p.pts[p.pts.length - 1][0], p.pts[p.pts.length - 1][1], G.castle.x, G.castle.y) < dist(a.pts[a.pts.length - 1][0], a.pts[a.pts.length - 1][1], G.castle.x, G.castle.y) ? p : a), G.paths[0]);
  return pathPos(P, P.total - 70);
}
function updateChapel(dt) {
  const c = G.castle, L = CASTLE.levels[c.lvl];
  if (L.giant) {
    let g = G.chapelGiant;
    if (!g) {
      const q = chapelGate();
      g = G.chapelGiant = { guard: true, chapel: true, militia: false, x: c.x, y: c.y, rx: q.x, ry: q.y, hp: L.giant.hp, maxHp: L.giant.hp, dmg: L.giant.dmg, armor: L.giant.armor,
        rate: 1.5, speed: 32, engage: 70, atk: 0, target: null, dead: false, respawnT: 0, face: -1, anim: 0, slot: 0, born: G.t, moving: true,
        big: 'unit_bonegiant', bh: BIG_H.giant, aoe: 0.6, giant: L.giant, steal: 0.1 };
      G.soldiers.push(g); shakeScreen(4, 0.4); sfx('bonewall'); mortSay('raise', true);
      G.effects.push({ kind: 'pillar', x: c.x, y: c.y, col: '190,110,255', t: 0, dur: 0.9 });
    } else if (g.giant !== L.giant) { // yükseltme: dev güçlenir
      g.maxHp = L.giant.hp; g.hp = g.dead ? 0 : g.maxHp; g.dmg = L.giant.dmg; g.armor = L.giant.armor; g.giant = L.giant; g.bh = BIG_H.giant * (L.giant.k || 1);
      if (!g.dead) G.effects.push({ kind: 'pillar', x: g.x, y: g.y, col: '255,240,170', t: 0, dur: 0.6 });
    }
  }
}
// Sahadaki paralı askeri yeni toplanma yerine gönderir: yolun üstündeyse yol boyunca, değilse dümdüz yürür
function sendMerc(s) {
  const R = G.castle.rally, i = s.slot || 0;
  releaseSoldier(s);
  s.rx = R.x + (i - 0.5) * 10; s.ry = R.y + (i % 2 ? 6 : -6);
  const q = nearestOnPaths(G.paths, R.x, R.y), me = nearestOnPaths([q.p], s.x, s.y);
  if (me.d < 26) s.march = { p: q.p, d: me.along, goal: q.along, off: (i - 0.5) * 10, rally: true };
  else { s.march = null; s.moving = true; }
}
// paralı askerin yürüyüşü: yol üzerinde hedef noktaya (iki yöne de) yürür
function marchSoldier(s, dt) {
  const m = s.march, sp = MERCS.march * G.wspd;
  // toplanma yeri seçilmediyse yolda karşılaştığı ilk düşmanla orada dövüşür; seçildiyse yerine gider
  const foe = !m.rally && G.enemies.find(e => !e.dead && !e.def.flying && !e.under && dist(e.x, e.y, s.x, s.y) < 34);
  if (foe || Math.abs(m.d - m.goal) < 1) { s.march = null; if (foe) { s.rx = s.x; s.ry = s.y; } else s.moving = true; return; }
  m.d += Math.sign(m.goal - m.d) * Math.min(sp * dt, Math.abs(m.goal - m.d));
  const q = pathPos(m.p, Math.min(m.d, m.p.total), m.off);
  s.face = q.x < s.x ? -1 : 1; s.x = q.x; s.y = q.y; s.anim += dt;
}

// Kahraman gücü: seviyeyle hasar %15 artar, yıldız gelişmesiyle +%20
function castUlt(h, x, y) {
  const U = HERO_ULT[h.id], k = (1 + 0.15 * (h.lvl - 1)) * (upgRank('spells') >= 1 ? 1.2 : 1);
  const dmg = () => roll(U.dmg) * k;
  // isabet noktası: yarısı alandaki düşmanların üstüne (biraz ileriye), kalanı alana rastgele düşer
  const foes = enemiesNear(x, y, U.r * 1.1, true);
  let fi = 0;
  const spot = (r, aim = true) => {
    if (aim && foes.length && fi++ % 2 === 0) { const e = foes[(fi >> 1) % foes.length], f = e.under || e.blocker ? e : pathPos(e.p, e.d + e.def.speed * 0.4, e.off); return [f.x + rand(-6, 6), f.y + rand(-4, 4)]; }
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * r; return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6];
  };
  floatText(h.x, h.y - 46, U.name + '!', '#ffe27a');
  h.castT = 0.45; h.ultT = ULT_ANIM; // komutanın güç şeridi (varsa) bu sürede bir kez oynar
  G.effects.push({ kind: 'ring', x, y, r: U.r, col: h.def.aura, t: 0, dur: 0.5 });
  if (h.id === 'commander' && U.bats) {
    // Vladrik'in yarasaları: kahramandan alana uçar, alanda döner, ısırır (hasar + yavaşlatma), ısırıklarla Vladrik iyileşir
    G.zones.push({ x, y, r: U.r, dps: roll(U.dps) * k, dtype: 'phys', t: 0, life: U.dur, fxT: 0, kind: 'bats', hx: h.x, hy: h.y - 20, hero: h, slow: U.slow, heal: U.heal, n: U.n, seed: rand(0, 9) }); sfx('bats');
    sfx('whirl'); setTimeout(() => sfx('scream', 1.8), 250);
  } else if (U.chains) {
    // Spartaküs'ün zincir fırtınası: alanda kırık zincirler döner, değdiğine vurur ve yavaşlatır
    G.zones.push({ x, y, r: U.r, dps: roll(U.dps) * k, dtype: 'phys', t: 0, life: U.dur, fxT: 0, kind: 'chains', slow: U.slow, seed: rand(0, 9) });
    shakeScreen(3, 0.3); sfx('whirl'); setTimeout(() => sfx('clash'), 150); setTimeout(() => sfx('clash'), 450);
  } else if (U.phalanx) {
    // Leonidas'ın falanksı: yola dik, kalkanlı üç iskelet hoplit; kemik duvar gibi yolu tutar, vurularak kırılabilir
    const q = nearestOnPaths(G.paths, x, y);
    if (q.d > 50) { floatText(x, y - 20, 'Yolun üstüne koy!', '#c8c8c8'); sfx('error'); return false; }
    const dir = pathPos(q.p, q.along);
    G.soldiers.push({ militia: true, wall: true, phalanx: true, x: q.x, y: q.y, rx: q.x, ry: q.y, hp: U.hp * k, maxHp: U.hp * k, dmg: [0, 0], armor: 0.5, rate: 99, speed: 0,
      engage: 0, atk: 0, target: null, dead: false, face: 1, anim: 0, slot: 0, life: U.life, born: G.t, dx: dir.dx, dy: dir.dy, seed: rand(0, 9) });
    G.effects.push({ kind: 'dust', x: q.x, y: q.y, t: 0, dur: 0.9 }); G.effects.push({ kind: 'ring', x: q.x, y: q.y, r: 50, col: '200,150,255', t: 0, dur: 0.5 });
    floatText(q.x, q.y - 40, 'Bu Sparta!', '#ffd34d'); shakeScreen(4, 0.3); sfx('bash'); setTimeout(() => sfx('clash'), 200);
  } else if (h.id === 'zeynep') {
    // Wren'in ölüm çığlığı: iç içe genişleyen ses halkaları, alandaki düşmanlar hasar alır ve sersemler
    for (let i = 0; i < 3; i++) G.effects.push({ kind: 'ring', x, y, r: U.r * (0.45 + i * 0.3), col: '210,235,255', t: 0, dur: 0.45 + i * 0.15 });
    for (const e of enemiesNear(x, y, U.r, true)) { damageEnemy(e, dmg(), 'magic'); stunEnemy(e, U.stun); }
    shakeScreen(3, 0.3); sfx('roar');
  }
}

// ---------- ana güncelleme ----------
function update(dt) {
  G.t += dt;
  if (G.bloodT > 0) G.bloodT -= dt;
  for (const k in G.spells) G.spells[k] = Math.max(0, G.spells[k] - dt * (G.bloodT > 0 ? BLOOD.cd : 1));
  if (G.raiseT > 0) G.raiseT -= dt;
  if (G.mortCast > 0) G.mortCast -= dt;
  updateMortState(dt);
  updateMortSay(dt);
  updateMech(dt);
  updateProps(dt);
  updateHeralds(dt);
  G.cryCd = (G.cryCd || 0) - dt;
  if (G.gate && G.gate.hitT > 0) G.gate.hitT -= dt;
  if (G.cryAt != null && G.t >= G.cryAt) {
    let lead = null; for (const e of G.enemies) if (!e.dead && !MUTE_VOICE(e) && !e.def.flying && (!lead || e.d > lead.d)) lead = e;
    if (lead) { warCry(lead); G.cryAt = null; G.cryCd = 3; } else if (G.t > G.cryAt + 8) G.cryAt = null;
  }
  updateTut(dt);

  if (G.waveCountdown != null && G.wave > 0) {
    // önceki dalga bitmeden yenisi gelmesin: sahada düşman varken sayaç durur, 1-2 kaçak kalınca yavaş işler
    const alive = G.spawners.length ? 99 : G.enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
    G.waveCountdown -= dt * (alive === 0 ? 1 : alive <= 2 ? 0.35 : 0);
    if (G.waveCountdown <= 0) { G.waveCountdown = null; waveBonusAndStart(); }
  }
  for (const sp of G.spawners) {
    sp.timer -= dt;
    while (sp.left > 0 && sp.timer <= 0) {
      const i = sp.n - sp.left, ty = sp.types ? sp.types[i] : sp.t;
      // boss sırası: önce borazancı uzun çağrısını çalıp döner, boss sonra gelir
      if (NECRO && ENEMIES[ty] && ENEMIES[ty].chief && !sp.called) { sp.called = true; callHeralds([sp.p], true); sp.timer += heraldT(true); break; }
      // kollu girişte düşmanlar kollara sırayla (rastgele başlangıçla) dağılır; bir sıra hep aynı kola
      const R = sp.pack ? 0 : marchRow(ENEMIES[ty], sp), col = R ? i % R : 0;
      const rt = G.lv.routes && G.lv.routes[sp.p];
      const pi = R && col ? sp.lastPi : rt ? rt[(sp.rk = (sp.rk ?? Math.floor(Math.random() * rt.length)) + 1) % rt.length] : sp.p;
      sp.lastPi = pi;
      const e = spawnEnemy(ty, pi, -entryLead(G.paths[pi] || G.paths[0]), R ? (col - (R - 1) / 2) * 10 * ROAD_K : null);
      if (R) e.march = true;
      if (sp.hpK && !e.def.chief) { e.hp *= sp.hpK; e.maxHp *= sp.hpK; }
      sp.left--;
      // paket: küme içinde sık, kümeler arasında uzun ara (ortalama sıklık aynı kalır)
      if (sp.pack) sp.timer += (i + 1) % sp.pack ? sp.gap * 0.35 : sp.gap * (sp.pack - 0.35 * (sp.pack - 1));
      else if (R) sp.timer += col < R - 1 ? 0 : sp.gap * R * 0.8; // sıra tamamlanınca sonraki sıra
      else sp.timer += sp.gap;
    }
  }
  G.spawners = G.spawners.filter(s => s.left > 0);

  castleAmbient(dt);
  updateCastleArchers(dt);
  updateMercs(dt);
  updateHatches(dt);
  if (G.bossFx && (G.bossFx.t += dt) > G.bossFx.dur) G.bossFx = null;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  for (const t of G.towers) updateTower(t, dt);
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  for (const s of G.soldiers) updateSoldier(s, dt);
  for (const p of G.projectiles) { HERO_SKILL = !!p.heroSkill; hitBy = p.heroSkill ? 'hero' : PROJ_BY[p.kind] || null; updateProjectile(p, dt); }
  hitBy = null;
  HERO_SKILL = false;

  G.enemies = G.enemies.filter(e => !e.dead);
  G.soldiers = G.soldiers.filter(s => !s.removed);
  G.projectiles = G.projectiles.filter(p => !p.done);
  for (const f of G.effects) {
    if (f.kind === 'stuck' && f.target && (f.target.dead || f.t + dt >= f.dur) && !f.gone) { f.gone = true; f.target.stuckN = Math.max(0, (f.target.stuckN || 1) - 1); if (f.target.dead) f.t = f.dur; }
  }
  for (const f of G.effects) { f.t += dt; if (f.air) corpsePhys(f, dt); else if (f.kind === 'bones') bonePhys(f, dt); else if (f.kind === 'skyfall') skyFallPhys(f, dt); }
  G.effects = G.effects.filter(f => f.t < f.dur);
  G.parts = updateParts(G.parts, dt);
  if (G.stormT > 0) G.stormT -= dt;
  for (const f of G.ground) f.t += dt;
  G.ground = G.ground.filter(f => f.t < f.dur);
  updateWeather(dt);
  if (G.intro) { G.intro.t += dt; if (G.intro.t > G.intro.dur) G.intro = null; }
  for (const f of G.effects) if (f.riseAt != null && f.kind === 'corpse' && f.t >= f.riseAt) { // çivili/lanetli ceset kendiliğinden dirilir
    f.riseAt = null;
    if (G.soldiers.filter(s => s.minion && !s.dead).length < spellStats('nm_raise').max) { raiseMinion(f, 0); f.t = f.dur; floatText(f.x, f.y - 30, 'Kalktı!', '#9dff8a'); }
  }
  for (const g of G.ghosts) { // hayalet: yolda geriye süzülür, değdiğini yakar ve korkutur
    g.t += dt; g.d -= 85 * dt;
    const q = pathPos(g.p, Math.max(0, g.d)); g.x = q.x; g.y = q.y;
    for (const e of G.enemies) {
      if (e.dead || e.under || g.hit.has(e) || dist(e.x, e.y, g.x, g.y) > 20) continue;
      g.hit.add(e); hitBy = 'magic'; damageEnemy(e, g.dmg, 'magic', false, 'magic'); hitBy = null;
      if (!e.dead && e.siege === undefined) { e.fearT = Math.max(e.fearT || 0, e.def.chief ? g.fear * 0.5 : g.fear); e.hopT = 0.4; }
    }
  }
  G.ghosts = G.ghosts.filter(g => g.d > g.end && g.d > 0);
  for (const z of G.zones) {
    z.t += dt; z.fxT -= dt;
    HERO_SKILL = !!z.heroSkill;
    const bats = z.kind === 'bats', live = !bats || z.t > 0.35; // yarasalar önce uçup gelir
    if (live) for (const e of G.enemies) if (!e.dead && (bats || !e.def.flying) && dist(e.x, e.y, z.x, z.y) <= z.r) {
      const hp0 = e.hp; damageEnemy(e, z.dps * dt, z.dtype || 'true', true, z.src);
      if (z.kind === 'chains') { e.slowT = Math.max(e.slowT || 0, 0.3); e.slowK = Math.max(e.slowK || 0, z.slow); }
      if (bats) { e.slowT = Math.max(e.slowT || 0, 0.3); e.slowK = Math.max(e.slowK || 0, z.slow); if (z.hero && !z.hero.dead) z.hero.hp = Math.min(z.hero.maxHp, z.hero.hp + (hp0 - Math.max(0, e.hp)) * z.heal); }
    }
    HERO_SKILL = false;
    if (z.fxT <= 0) {
      z.fxT = 0.04;
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * z.r, holy = z.kind === 'holy';
      if (z.kind === 'chains') { z.fxT = 0.1; emit(G.parts, { kind: 'chunk', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.5, vx: rand(-40, 40), vy: -rand(40, 90), g: 420, col: '#6a5a4a', s0: 1.6, s1: 1, life: 0.4, vr: rand(-8, 8) }); continue; }
      if (bats) { z.fxT = 0.12; if (live) emit(G.parts, { kind: 'dot', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.5 - 6, vy: rand(10, 30), g: 140, col: '#b01020', s0: 1.4, s1: 0.5, life: 0.4 }); continue; }
      if (z.kind === 'plague') {
        z.fxT = z.gas ? 0.22 : 0.07;
        emit(G.parts, { kind: 'glow', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.5, vx: rand(-6, 6), vy: -rand(6, 16), col: Math.random() < 0.5 ? '120,200,80' : '150,230,100', s0: rand(5, 8), s1: rand(10, 14), life: rand(0.8, 1.2), a: 0.35 });
        continue;
      }
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
  updateDmgNums(dt);
  for (const f of G.floaters) { f.t += dt; f.y -= 22 * dt; }
  G.floaters = G.floaters.filter(f => f.t < 1.1);

  if (G.lives <= 0 && !overlay) {
    if (G.endless) { save.endless = save.endless || {}; G.endBest = save.endless[G.idx] || 0; G.endNew = G.wave > G.endBest; save.endless[G.idx] = Math.max(G.endBest, G.wave); persist(); }
    setOverlay('lose'); sfx('lose'); achLevelEnd(false); levelEndAd();
  }
  if (G.gold >= 2000) achGive('hoard');
  if (!overlay && !G.endless && G.wave >= G.lv.waves.length && G.spawners.length === 0 && G.enemies.length === 0) {
    const lr = G.lives / G.maxLives;
    if (G.chal === 'd') { save.daily = { key: G.daily.key, done: true, n: ((save.daily && save.daily.n) || 0) + 1 }; G.stars = 1; }
    else if (G.chal) { save.ch = save.ch || {}; save.ch[G.idx] = Object.assign({}, save.ch[G.idx], { [G.chal]: 1 }); G.stars = 1; }
    else {
      G.stars = lr >= 0.9 ? 3 : lr >= 0.3 ? 2 : 1;
      save.stars[G.idx] = Math.max(save.stars[G.idx] || 0, G.stars);
    }
    persist();
    setOverlay('win');
    sfx('win');
    achLevelEnd(true); levelEndAd();
  }
}

// ================= ÇİZİM =================
// Başlıklar ve butonlar için sert, oyunvari Russo One; metinler için kalın, yuvarlak Rubik (ikisi de Türkçe + Kiril; fonts/ içinde gömülü).
const FONT_T = '"Russo One", "Arial Black", system-ui, sans-serif';
const FONT_B = '"Rubik", system-ui, -apple-system, "Segoe UI", sans-serif';
if (document.fonts && document.fonts.load) {
  document.fonts.load(`40px ${FONT_T}`).catch(() => {});
  document.fonts.load(`800 20px ${FONT_B}`).catch(() => {});
}
let lastFont = '', lastFontNorm = '';
// Necromancer menüleri kadife (koyu) zeminli: parşömen için seçilmiş koyu kahve yazı renkleri açık karşılıklarına çevrilir
const INK = { '#4a2a0e': '#f0e2c4', '#8a6238': '#cdb0d8', '#7a5530': '#d8c0e0', '#6a4420': '#d8c8e0', '#5a3a1a': '#d0bcd8', '#5a3410': '#e6c27a', '#8a1a14': '#e6c27a' };
function txt(s, x, y, size, col = '#fff', align = 'center', weight = '800', font = FONT_B, stroke = true) {
  if (NECRO && INK[col]) col = INK[col];
  const f = `${weight} ${size}px ${font}`;
  if (f !== lastFont || ctx.font !== lastFontNorm) { ctx.font = f; lastFont = f; lastFontNorm = ctx.font; }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, size / 4.2); ctx.strokeStyle = 'rgba(28,16,6,0.88)';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
// metni verilen genişliğe sığacak satırlara böler (en çok max satır; taşan son satır '…' ile biter)
const TR = (s) => (window.tr ? window.tr(s) : s); // dil katmanı (js/dil.js): satıra bölmeden / kısaltmadan önce bütün metin çevrilir
function wrapLines(s, maxW, size, weight = '700', font = FONT_B, max = 2) {
  s = TR(s);
  ctx.font = `${weight} ${size}px ${font}`; lastFont = null;
  const lines = [];
  for (const w of s.split(' ')) {
    const cur = lines[lines.length - 1];
    if (cur != null && ctx.measureText(cur + ' ' + w).width <= maxW) lines[lines.length - 1] = cur + ' ' + w; else lines.push(w);
  }
  if (lines.length > max) { lines.length = max; lines[max - 1] += '…'; }
  return lines;
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
const HP_K = 0.81; // can barı ölçeği (genişlik ve kalınlık)
function hpBar(x, y, w, frac, col = '#4cd34c') {
  frac = clamp(frac, 0, 1); w *= HP_K;
  const h = 3.2 * HP_K, r = h / 2 + 1.1 * HP_K;
  const b = 1.1 * HP_K; // dış çerçeve payı
  roundRect(x - w / 2 - b, y - b, w + 2 * b, h + 2 * b, r, 'rgba(14,8,3,0.78)');
  roundRect(x - w / 2, y, w, h, h / 2, '#5a1712');
  if (frac > 0) {
    roundRect(x - w / 2, y, Math.max(h, w * frac), h, h / 2, col);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - w / 2 + 1, y + 0.4, Math.max(0, w * frac - 2), h * 0.35);
  }
}

// boş kule yerinin arka kenarında küçük tabela: kazık ve kafatası levha
function drawPlotSign(pl) {
  const x = pl.x + 14 * BUILD_K, y = pl.y - 6 * BUILD_K, s = BUILD_K;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(1, 1, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  roundRect(-1.6, -20, 3.2, 21, 1, '#5a3a22', '#1a0e06', 1);
  ctx.rotate(-0.06);
  roundRect(-8, -24, 16, 11, 2, '#c9b48a', '#1a0e06', 1.2);
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(0, -19.5, 3.2, Math.PI, 0); ctx.lineTo(2, -16.5); ctx.lineTo(-2, -16.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.arc(-1.2, -19.3, 0.9, 0, Math.PI * 2); ctx.arc(1.2, -19.3, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawPlot(pl) {
  const im = spr('plot');
  if (im) { drawSprite(ctx, im, pl.x, pl.y + 2, 66 * BUILD_K, 0.5); if (NECRO) drawPlotSign(pl); return; }
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
// Dikilitaşın 4. kademe dönüşümleri (10 Eki): uzmanlık seçilince kule değişir. nail (Ruh Çivisi) -> Kemik Balistası,
// fan (Kemik Yelpazesi) -> Hayalet Okçular. w: genişlik çarpanı, rate/dmg/range: saldırı çarpanları,
// tip/nock: mızrağın ucu ve kirişi, bows: okçuların ok uçları (görselin sol üstünden oran; L sola, R sağa nişan alır)
// Ruh Feneri: drain (Ruh Emici) -> kristalli kule: ışın kristalden, aynı hedefe art arda vurdukça güçlenir (ramp);
// ghost (Hayalet Çağırıcı) -> Ruh Kafesi: ışın kızıl gözden, hayaletler kafesten çıkar, ara ara en güçlü düşmanı kafese kapatır.
const TOWER_FORM = {
  // 10 Eki denge: dönüşümler 3. kademenin ~1,3 katı (önce ~2,4 kattı, tek kule bölüm geçiyordu)
  archer_nail: { noAnim: true, layers: true, w: 1.55, rate: 2.4, dmg: 2.3, range: 1.15, tip: [0.9857, 0.3389], nock: [0.3057, 0.1216], armUp: [0.7314, 0.0556], armLo: [0.1086, 0.2574], pivot: [0.4714, 0.3622], rotMax: [-1.05, 1.2], pierce: 2, pierceK: 0.45, flip: true },
  // Hayalet Okçular (10 Eki): tepesi boş kule; üstünde iki elit kızıl okçu gezip ayrı hedeflere nişan alır (GHOST_ARCH)
  // 4. kademe yolları (11 Eki): aynı açık tepeli kule; Ağır Arbaletçiler seyrek ve ağır, Hayalet Okçular sık ve hafif (ikisi de 3. kademenin ~1,3 katı hasar/sn)
  archer_fan: { noAnim: true, w: 1.14, rate: 1.9, dmg: 2.6, range: 1.12, fly: 1, archers: true },
  archer_bow: { noAnim: true, img: 'tower_archer_fan', w: 1.14, rate: 0.42, dmg: 0.55, range: 1.08, fly: 1.3, archers: true },
  mage_drain: { w: 1.1, src: [0.49, 0.1], rate: 0.9, ramp: 0.12, rampMax: 0.6, col: 'rgb(190,140,255)' },
  mage_ghost: { w: 1.15, src: [0.345, 0.43], cageAt: [0.55, 0.3], col: 'rgb(255,80,80)', cage: { cd: 8, t: 2.2 } },
  // Veba Kazanı: corpse -> Ceset Mancınığı (kova sağ üstte; hep ceset yığını fırlatır, uzun menzil), plague -> Kara Veba Kazanı (ağızdan veba topu)
  artillery_corpse: { w: 1.3, src: [0.87, 0.08], flip: true, range: 1.2, dmg: 1 },
  artillery_plague: { w: 1.15, src: [0.5, 0.24], dmg: 1.05, gas: 1.6 },
  // Lanet Kulesi: rite -> Kan Mabedi (kızıl bağlar kâseden çıkar), blight -> Kara Lanet Mabedi (lanet küreden, ölenlerin kalkma şansı +%10)
};
// kule atış animasyonu (kule_anim_isle.py): <görsel>_atk şeridi; box: görsele göre çerçeve, rel: fırlatma anı, relPt: o anda fırlayan parça
const TOWER_ANIM_FPS = 16;
function towerAnim(t) {
  const F = towerForm(t); if (!F || F.noAnim) return null; // noAnim: Wan şeridi beğenilmedi, kapalı
  const n = `tower_${t.type}_${t.spec}_atk`, M = ANIM_META[n];
  if (!M || !M.tower) return null;
  const im = spr(n); if (!im) { loadStrip(n); return null; }
  return { im, M, n, dur: M.n / TOWER_ANIM_FPS };
}
const formImg = (t) => { const F = TOWER_FORM[t.type + '_' + t.spec]; return (F && F.img) || `tower_${t.type}_${t.spec}`; }; // img: başka uzmanlığın görselini paylaşır
const towerForm = (t) => (t.spec && TOWER_FORM[t.type + '_' + t.spec] && spr(formImg(t)) ? TOWER_FORM[t.type + '_' + t.spec] : null);
const obeliskForm = (t) => (t.type === 'archer' ? towerForm(t) : null);
// dönüşmüş kulede görsel üzerindeki bir noktanın dünya konumu (balista hedefe dönükse aynalanır)
// Arbaletçi kulesi (11 Eki, Caner): tepedeki platformda kademeye göre 1/2/3 yeşil kemik arbaletçi; Hayalet Arbaletçiler (fan) 3 kızıl hayalet.
// Her biri ayrı hedef seçer, platformda gezer; atarken arbaleti omzuna kaldırır (aim), cıvatayı bırakınca geri teper (kick), sonra indirip kurar.
const XBOW = { speed: 0.22, gap: 0.13, aim: 0.3, kick: 0.16, hold: 0.55, tip: [0.99, 0.24], lvW: [0.8, 0.9, 1] };
// platform ölçüleri kule görseline göre (görsel kesirleri): x gezinme aralığı, y ayak derinliği, h arbaletçi boyu (hepsinde aynı mutlak boy), clip ön korkuluk
// 4. kademe kulesi (tower_archer_fan) 3. kademeden kısa kalıyordu (Caner, 10 Eki): w 1.14 ile ~140 birim (3. kademe 134); h buna göre küçüldü (askerin boyu aynı)
const XBOW_T = {
  tower_xbow_1: { x: [0.47, 0.47], y: [0.19, 0.22], h: 0.1995, clip: null },
  tower_xbow_2: { x: [0.37, 0.63], y: [0.17, 0.22], h: 0.191, clip: [[0, 0.08], [0.11, 0.08], [0.5, 0.2], [0.85, 0.09], [1, 0.09]] },
  tower_xbow_3: { x: [0.3, 0.6], y: [0.21, 0.27], h: 0.166, clip: [[0, 0.17], [0.04, 0.17], [0.43, 0.3], [0.84, 0.16], [1, 0.16]] },
  tower_archer_fan: { x: [0.3, 0.7], y: [0.246, 0.2997], h: 0.1588, clip: [[0, 0.246], [0.5, 0.3158], [1, 0.246]] },
};
// kuledeki iskeletler: 1-3. kademe yeşil arbaletçiler; 4. kademede ya 2 kızıl ağır arbaletçi (fan) ya da 3 kızıl hayalet okçu (bow).
// aim: nişan / yay germe süresi (ok bu sürenin sonunda çıkar), kick: bırakınca geri tepme, hold: atıştan sonra silahı indirmeden bekleme,
// tip: atış pozunda okun çıktığı nokta (görsel kesri), spd: mermi hızı (px/sn), arc: kavis (uzaklığın kesri; okçular yüksek atar)
const MEN = {
  base: { pre: 'unit_xbow', pose: '_aim', aim: 0.3, kick: 0.16, hold: 0.55, tip: [0.99, 0.24], n: (t) => t.lvl + 1, col: '140,255,150', spd: 720, arc: 0.06 },
  fan:  { pre: 'unit_ghostxbow', pose: '_aim', aim: 0.46, kick: 0.3, hold: 1.25, tip: [0.989, 0.189], n: () => 2, col: '255,80,90', spd: 820, arc: 0.035, heavy: true,
    seq: [[0.35, ''], [1, '_aim']], relPose: '_kick', rel: 0.22, load: 0.85 }, // Gemini 4 poz (arbaletci_poz_isle.py): hazır → nişan → geri tepme → kurma kolunu çevirerek dolum
  bow:  { pre: 'unit_ghostarcher', pose: '_draw', aim: 0.42, kick: 0.12, hold: 0.32, tip: [0.98, 0.237], n: () => 3, col: '255,90,130', spd: 420, arc: 0.26, bow: true,
    seq: [[0.3, '_nock'], [0.62, '_half'], [1, '_draw']], rel: 0.26 }, // yay germe kareleri (Gemini 5 poz, varliklar/okcu_poz_isle.py): ok takma → yarım → tam germe; bırakınca _rel
};
// 1-3. kademe: her kademenin kendi iskelet arbaletçisi (Gemini 4 poz, poz_ayir.py: unit_xbowN, _aim, _kick, _load); görseli yoksa eski yeşil arbaletçi
const XBOW_TIP = [[0.99, 0.186], [0.99, 0.192], [0.916, 0.253]]; // kademe görsellerinde nişan pozunun cıvata ucu (poz_ayir.py yazar)
for (let k = 1; k <= 3; k++) MEN['k' + k] = Object.assign({}, MEN.base, { pre: 'unit_xbow' + k, seq: [[0.35, ''], [1, '_aim']], relPose: '_kick', rel: 0.18, load: 0.5, hold: 0.9, tip: XBOW_TIP[k - 1] });
// 3. kademe sayfasının geri tepme pozu arbalet yerine yay çizilmişti: _kick nişan pozunun kopyası, tepme kodla
// 10 Eki (yol seçimi): 1. kademe ve okçu yolu iskelet okçu (geçici görsel: hayalet okçu çizimi, sayısı kademe kadar), arbaletçi yolu kademe arbaletçileri
MEN.arch = Object.assign({}, MEN.bow, { n: (t) => t.lvl + 1, col: '150,255,160' });
const menOf = (t) => {
  if (t.spec === 'fan' || t.spec === 'bow') return MEN[t.spec];
  if (NECRO && (t.path === 'bow' || (!t.path && t.lvl === 0))) return MEN.arch;
  const k = MEN['k' + (t.lvl + 1)]; return k && spr(k.pre) ? k : MEN.base;
};
// kulenin o anki unvanı: Kemik Kulesi yolunda yola göre (ör. Kemik Okçular / Kemik Arbaletçiler)
const towerTitle = (t, lvl = t.lvl) => (t.path && ARCHER_PATH[t.path] && ARCHER_PATH[t.path].titles[lvl]) || t.def.levels[lvl].title;
const xbowCfg = (t) => XBOW_T[t.spec ? 'tower_archer_fan' : xbowTowerName(t.lvl)];
const xbowCount = (t) => (!NECRO || t.type !== 'archer' ? 0 : t.spec && !MEN[t.spec] ? 0 : menOf(t).n(t));
function xbowMen(t) {
  const n = xbowCount(t); if (!t.ga) t.ga = [];
  if (t.ga.length > n) t.ga.length = n;
  const C = xbowCfg(t);
  while (t.ga.length < n) t.ga.push({ x: n === 1 ? (C.x[0] + C.x[1]) / 2 : lerp(C.x[0], C.x[1], t.ga.length / (n - 1)), d: rand(0.2, 0.8), tx: null, face: t.ga.length % 2 ? 1 : -1, aimT: 0, kickT: -1, moveT: rand(1, 3), anim: rand(0, 5), tg: null });
  return t.ga;
}
function updateXbowMen(t, dt) {
  const A = xbowMen(t), X = Object.assign({}, XBOW, xbowCfg(t)), M = menOf(t);
  A.forEach((a, i) => {
    a.anim += dt; if (a.aimT > 0) a.aimT -= dt; if (a.kickT > -M.hold) a.kickT -= dt;
    const busy = a.aimT > 0 || a.kickT > -M.hold;
    if (a.tx == null && !busy && (a.moveT -= dt) <= 0) { // ara ara platformda yer değiştirir (diğerlerine çok yaklaşmadan)
      for (let k = 0; k < 8; k++) { const nx = rand(X.x[0], X.x[1]); if (A.every((o, j) => j === i || Math.abs(nx - o.x) > X.gap) && Math.abs(nx - a.x) > 0.05) { a.tx = nx; a.td = rand(0, 1); break; } }
      a.moveT = rand(2.5, 5);
    }
    if (a.tx != null && !busy) {
      const dx = a.tx - a.x, st = X.speed * dt;
      a.face = dx < 0 ? -1 : 1; a.walking = true;
      if (Math.abs(dx) <= st) { a.x = a.tx; a.tx = null; a.walking = false; } else a.x += Math.sign(dx) * st;
      a.d += (a.td - a.d) * Math.min(1, dt * 2);
    } else a.walking = false;
  });
}
function xbowFoot(t, ts, a) { const C = xbowCfg(t); return { x: t.x + (a.x - 0.5) * ts.w, y: ts.bottom - ts.h + lerp(C.y[0], C.y[1], a.d) * ts.h }; }
// kuledeki iskeletler kuleyle karışmasın (Caner, 11 Eki): %10 iri ve koyu konturlu (kontur görsel başına bir kez hazırlanır)
const MEN_K = 1.1, OUTL = new Map();
function outlined(im, R = 7, col = 'rgba(14,6,12,0.92)') {
  let c = OUTL.get(im); if (c) return c;
  const s = document.createElement('canvas'); s.width = im.width; s.height = im.height;
  const sg = s.getContext('2d'); sg.drawImage(im, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, s.width, s.height);
  c = document.createElement('canvas'); c.width = im.width + 2 * R; c.height = im.height + 2 * R;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; g.drawImage(s, R + Math.cos(a) * R, R + Math.sin(a) * R); }
  g.drawImage(im, R, R); c.pad = R; OUTL.set(im, c);
  return c;
}
// görseldeki karakterin dolu yüksekliğinin tuval yüksekliğine oranı (poz tuvallerinde başın üstünde boşluk olabilir); bir kez ölçülür
const BODY_R = new Map();
function bodyRatio(im) {
  if (!im) return 1;
  let r = BODY_R.get(im); if (r) return r;
  const c = document.createElement('canvas'); c.width = Math.max(1, im.width >> 2); c.height = Math.max(1, im.height >> 2);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data; let top = c.height;
  for (let y = 0; y < c.height && top === c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { top = y; break; }
  r = clamp(1 - top / c.height, 0.5, 1); BODY_R.set(im, r);
  return r;
}
// konturlu şerit karesi (drawFrame gibi; kontur şeridin tamamına bir kez çizilir, kare komşu karenin kontur payını da alır)
function drawFrameOutlined(img, F, i, h) {
  const O = outlined(img, Math.max(3, Math.round(7 * F.fh / 300))), p = O.pad, k = h / (F.ch * F.fh), dw = F.fw * k, dh = F.fh * k;
  ctx.drawImage(O, i * F.fw, 0, F.fw + 2 * p, F.fh + 2 * p, -dw / 2 - p * k, -dh * (1 - F.base) - p * k, dw + 2 * p * k, dh + 2 * p * k);
}
function xbowTip(t, ts, a) { // atış pozunda okun / cıvatanın çıktığı nokta (dünya koordinatı)
  const M = menOf(t), f = xbowFoot(t, ts, a), im = spr(M.pre + M.pose), h = ts.h * xbowCfg(t).h * MEN_K, w = im ? h * im.width / im.height : h * 0.89;
  return { x: f.x + (M.tip[0] - 0.5) * w * a.face, y: f.y - (1 - M.tip[1]) * h };
}
// fizik: hedefin mermi varana dek yolda nereye varacağı tahmin edilir (yürüyorsa); durmuş, dövüşen ya da yoldan çıkmışsa olduğu yer
function leadPoint(e, T) {
  const moving = e.p && !e.offPath && !e.blocker && !(e.stunT > 0) && !(e.skillT > 0) && !e.under && G.t - (e.movedAt || -9) < 0.15;
  if (!moving) return { x: e.x, y: aimY(e), fy: e.y };
  const q = pathPos(e.p, Math.min(e.p.total, e.d + (e.curSpd || 0) * T), e.off);
  return { x: q.x, y: q.y + (aimY(e) - e.y), fy: q.y };
}
// balistik mermi: (sx,sy)'den tahmin noktasına parabol (arc: tepe yüksekliği); gy0 atanın, fy hedefin yer hizası (gölge için)
function ballisticShot(o, gy0, tg, T0, M, extra) {
  const d = dist(o.x, o.y, tg.x, aimY(tg)), dur = clamp(d / M.spd, 0.1, M.bow ? 0.8 : 0.45), P = leadPoint(tg, T0 + dur);
  const pr = Object.assign({ kind: 'ghostarrow', ballistic: true, bolt: !M.bow, heavy: !!M.heavy, longArrow: !!M.bow, col: M.col, sx: o.x, sy: o.y, gy0, target: tg,
    ax: P.x, ay: P.y, tx: P.x, ty: P.y, fy: P.fy, fy0: P.fy, t: -T0, dur, arc: clamp(dist(o.x, o.y, P.x, P.y) * M.arc, M.bow ? 16 : 2, M.bow ? 75 : 14), src: 'arrow' }, extra);
  G.projectiles.push(pr);
  return pr;
}
// bir arbaletçi atar: ötekilerin hedeflemediği en öndeki düşmanı seçer (yoksa verilen hedef), döner, nişan alır; cıvata nişan bitince çıkar
function xbowShoot(t, ts, L, e0, opt) {
  const A = xbowMen(t), M = menOf(t); if (!A.length) return null;
  const i = (t.xi = ((t.xi ?? -1) + 1) % A.length), a = A[i];
  const taken = new Set(A.filter((o, j) => j !== i && o.kickT > -M.hold && o.tg && !o.tg.dead).map(o => o.tg));
  let e = e0;
  if (taken.has(e0)) { let br = 1e9; for (const x of G.enemies) if (!taken.has(x) && !x.dead && !x.under && dist(t.x, t.y - 10, x.x, x.y) <= L.range && x.p.total - x.d < br) { br = x.p.total - x.d; e = x; } }
  a.tg = e; a.tx = null; a.walking = false; a.face = e.x < xbowFoot(t, ts, a).x ? -1 : 1; a.aimT = M.aim; a.kickT = M.aim + M.kick;
  const o = xbowTip(t, ts, a);
  ballisticShot(o, t.y, e, M.aim, M, { dmg: opt.dmg * (e.def.flying ? opt.fly || 1 : 1), dtype: opt.pierce ? 'true' : 'phys', crit: opt.crit, pierce: opt.pierce, pen: opt.pen || 0, poison: opt.poison || 0, knock: !!M.heavy, imbue: t.imbue });
  t.relQ = (t.relQ || []).concat([{ t: M.aim, x: o.x, y: o.y, col: M.col, heavy: M.heavy, bow: M.bow }]); // bırakma anında parıltı ve ses
  return a;
}
function updateXbowRelease(t, dt) {
  if (!t.relQ || !t.relQ.length) return;
  for (const r of t.relQ) if ((r.t -= dt) <= 0) {
    for (let i = 0; i < (r.heavy ? 9 : 5); i++) emit(G.parts, { kind: 'glow', add: true, x: r.x, y: r.y, vx: rand(-30, 30), vy: rand(-30, 10), drag: 3, col: r.col, s0: r.heavy ? 3.4 : 2.6, s1: 0.4, life: 0.28 });
    sfx(r.heavy ? 'xbowh' : r.bow ? 'arrow' : 'xbow', r.bow ? rand(1.05, 1.2) : undefined); // hayalet okçular yay, ötekiler arbalet
  }
  t.relQ = t.relQ.filter(r => r.t > 0);
}
function drawXbowMen(t, ts, redraw) {
  const A = xbowMen(t), h = ts.h * xbowCfg(t).h * MEN_K, M = menOf(t), ghost = !!t.spec, pre = M.pre;
  for (const a of A.slice().sort((p, q) => p.d - q.d)) { // arkadaki önce
    const f = xbowFoot(t, ts, a), up = a.kickT > -M.hold;
    if (ghost) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y - h * 0.15, h * 0.45, '255,60,80', 0.2 + (up ? 0.12 : 0)); ctx.restore(); }
    const rise = a.aimT > 0 ? (1 - a.aimT / M.aim) : 1; // nişana kalkış / yay germe (0..1)
    let pose = up ? M.pose : '';
    const sinceRel = M.kick - a.kickT; // bırakmadan bu yana geçen süre
    if (M.seq && up) pose = a.aimT > 0 ? M.seq.find(q => rise <= q[0])[1] : sinceRel < M.rel ? M.relPose || '_rel' : M.load && sinceRel < M.rel + M.load ? '_load' : ''; // germe/nişan sırası, bırakma pozu, (arbalette) kurma
    const im = spr(pre + pose) || spr(up ? pre + M.pose : pre); if (!im) continue;
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(a.face, 1);
    const bob = a.walking ? Math.abs(Math.sin(a.anim * 9)) * h * 0.04 : Math.sin(a.anim * 2) * h * 0.012; // yürürken sekme, dururken nefes
    const kk = a.aimT <= 0 && a.kickT > 0 ? a.kickT / M.kick : 0; // bırakınca geri tepme (geri ve yukarı)
    let lean = a.walking ? Math.sin(a.anim * 9) * 0.04 : up ? (1 - rise) * 0.12 - kk * 0.1 : 0, sx = 1, sy = 1, back = 0;
    if (M.bow && up) { // okçu: pozlar germeyi gösterir; üstüne tam gerilimde hafif titreme, bırakınca küçük ileri sekme
      const tense = a.aimT > 0 ? Math.max(0, rise - 0.62) / 0.38 : 0;
      lean = -tense * 0.02 + kk * 0.03; back = Math.sin(a.anim * 40) * tense * h * 0.004 - kk * h * 0.02;
    }
    if (M.heavy && up && kk > 0) back = h * 0.05 * kk; // ağır arbalet sert teper (poz zaten geri tepmiş)
    if (pose === '_load') back = Math.sin(a.anim * 13) * h * 0.006; // kurma kolu çevrilirken gövde hafifçe sallanır
    ctx.translate(-h * 0.07 * kk * (M.bow ? 0 : 1) - back, -bob); ctx.rotate(lean); ctx.scale(sx, sy);
    const wk = a.walking && !up && animStrip(pre, null, '_walk'); // platformda yer değiştirirken yürüme şeridi (Kaggle Wan, 49 kare)
    if (wk) drawFrameOutlined(spr(wk), ANIM_META[wk], Math.floor(a.anim * 20) % ANIM_META[wk].n, h * bodyRatio(spr(pre))); // bekleme pozundaki boyla aynı
    else { const io = outlined(im), w0 = h * im.width / im.height, kk2 = w0 / im.width; drawSprite(ctx, io, 0, io.pad * kk2, io.width * kk2); }
    ctx.restore();
    const o = xbowTip(t, ts, a);
    if (M.bow && a.aimT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, o.x, o.y, h * 0.1 * rise, M.col, 0.45 * rise); ctx.restore(); } // gerilen okun ucunda kızıl ışık
    if (kk > 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, o.x, o.y, h * (M.heavy ? 0.24 : 0.16) * kk, ghost ? M.col : '140,255,150', 0.7 * kk); ctx.restore(); }
  }
  redraw(); // ön korkuluk ve gövde iskeletlerin ayaklarının önüne
}
// Kemik Balistası (katmanlı, kodla canlı): gövde + ayrı mızrak katmanı, kirişler kodla çizilir.
// Atıştan sonra (s sn): kiriş şaklayıp titrer → kurma kolu kirişi geri çeker → yeni mızrak kızıl-yeşil sisle belirip oluğa kayar.
// Süreler atış aralığıyla ölçeklenir (BAL x k, k = aralık / 2.4).
const balIO = (x) => x * x * (3 - 2 * x);
const BAL = { launch: 0.07, vib: 0.32, pull: [0.32, 1.0], spear: [0.95, 1.55], slide: 0.2 };
function balState(t) {
  const k = clamp((t.balRate || 2.4) / 2.4, 0.3, 1.2), s = t.balT == null ? 99 : (G.t - t.balT) / k;
  const pull = s < BAL.pull[0] ? 0 : balIO(clamp((s - BAL.pull[0]) / (BAL.pull[1] - BAL.pull[0]), 0, 1));
  const load = s < BAL.spear[0] ? 0 : clamp((s - BAL.spear[0]) / (BAL.spear[1] - BAL.spear[0]), 0, 1);
  return { s, pull, load, vib: s < BAL.vib ? Math.exp(-s * 11) * Math.sin(s * 75) : 0, launch: s < BAL.launch ? s / BAL.launch : -1 };
}
const balLay = (t) => { const F = towerForm(t); return !!(F && F.layers && spr(`tower_${t.type}_${t.spec}_top`)); };
// balista hedefe döner: yön kulenin sağ/soluna göre aynalanır (eşikli), yay mızrak ekseni hedefe bakacak açıyla pivot çevresinde döner
function balTrack(t, dt, L, ts, F) {
  const e = findTarget(t, L.range, true);
  if (e) {
    if (e.x < t.x - 6) t.face = -1; else if (e.x > t.x + 6) t.face = 1;
    const fl = t.face === -1 ? -1 : 1, px = t.x + (F.pivot[0] - 0.5) * ts.w * fl, py = ts.bottom - ts.h + F.pivot[1] * ts.h;
    const a0 = Math.atan2((F.tip[1] - F.nock[1]) * ts.h, (F.tip[0] - F.nock[0]) * ts.w);
    t.balRotT = clamp(Math.atan2(aimY(e) - py, (e.x - px) * fl) - a0, F.rotMax[0], F.rotMax[1]);
  } else t.balRotT = 0;
  const r = t.balRot || 0, sp = (e ? 5 : 1.2) * dt;
  t.balRot = r + clamp(t.balRotT - r, -sp, sp);
}
// yaydaki bir noktanın (görsel kesri) dünya konumu: pivot çevresinde döndürülür, sonra aynalanır
function balPoint(t, ts, F, p) {
  const fl = t.face === -1 ? -1 : 1, r = t.balRot || 0, c = Math.cos(r), s = Math.sin(r);
  const vx = (p[0] - F.pivot[0]) * ts.w, vy = (p[1] - F.pivot[1]) * ts.h;
  return { x: t.x + ((F.pivot[0] - 0.5) * ts.w + vx * c - vy * s) * fl, y: ts.bottom - ts.h + F.pivot[1] * ts.h + vx * s + vy * c };
}
function drawBallista(t, ts, F) { // yerel koordinat: (0,0) tabanın ortası, görsel [-w/2, w/2] x [-h, 0]
  const lc = TOWER_LIT.cols[t.type] || TOWER_LIT.col, top = spr(`tower_${t.type}_${t.spec}_top`), ped = spr(`tower_${t.type}_${t.spec}_ped`), sp = spr(`tower_${t.type}_${t.spec}_spear`);
  const P = (p) => ({ x: (p[0] - 0.5) * ts.w, y: (p[1] - 1) * ts.h }), st = balState(t), sc = ts.w / 93, rot = t.balRot || 0;
  if (ped) drawSprite(ctx, (NECRO && litOf(ped, lc)) || ped, 0, 0, ts.w);
  // döner tabla: kaidenin üstünde demir disk, perçinleri yayla birlikte döner
  const C = P([0.4857, 0.4204]), rx = ts.w * 0.21, ry = rx * 0.3;
  ctx.save();
  ctx.fillStyle = '#140d14'; ctx.beginPath(); ctx.ellipse(C.x, C.y + 3.2 * sc, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  const tg = ctx.createLinearGradient(0, C.y - ry, 0, C.y + ry); tg.addColorStop(0, '#4a3e52'); tg.addColorStop(1, '#241c2a');
  ctx.fillStyle = tg; ctx.strokeStyle = '#0e080e'; ctx.lineWidth = 0.9 * sc; ctx.beginPath(); ctx.ellipse(C.x, C.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,120,170,0.45)'; ctx.lineWidth = 0.6 * sc; ctx.beginPath(); ctx.ellipse(C.x, C.y, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5; circle(C.x + Math.cos(a) * rx * 0.8, C.y + Math.sin(a) * ry * 0.8, 0.9 * sc, '#b8a890', '#1a1018', 0.4 * sc); }
  const Pv = P(F.pivot), pw = ts.w * 0.045; // tabladan yaya yükselen demir mil
  ctx.fillStyle = '#2a2230'; ctx.strokeStyle = '#0e080e'; ctx.lineWidth = 0.8 * sc;
  ctx.beginPath(); ctx.rect(C.x - pw, Pv.y, pw * 2, C.y - Pv.y); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(160,130,180,0.35)'; ctx.fillRect(C.x - pw * 0.5, Pv.y, pw * 0.35, C.y - Pv.y);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, C.x, C.y, rx * 0.7, '120,255,140', 0.08 + 0.04 * Math.sin(time * 2 + t.x)); // tablanın altından sızan ruh ışığı
  ctx.restore();
  ctx.save();
  const Na = P(F.nock), Ta = P(F.tip), al = Math.hypot(Ta.x - Na.x, Ta.y - Na.y);
  const rc = t.shotAnim > 0 ? -Math.sin(t.shotAnim / 0.3 * Math.PI) * 3.5 * sc : 0; // geri tepme mızrak ekseni boyunca
  ctx.translate(Pv.x, Pv.y); ctx.rotate(rot); ctx.translate(-Pv.x + (Ta.x - Na.x) / al * rc, -Pv.y + (Ta.y - Na.y) / al * rc);
  drawSprite(ctx, (NECRO && litOf(top, lc)) || top, 0, 0, ts.w);
  const U = P(F.armUp), D = P(F.armLo), N = P(F.nock), T = P(F.tip);
  // kirişin orta noktası: dinlenirken iki kol ucunu birleştiren çizgide, kurulunca gezde; şaklayınca ileri taşıp söner
  const ux = D.x - U.x, uy = D.y - U.y, q = ((N.x - U.x) * ux + (N.y - U.y) * uy) / (ux * ux + uy * uy), R = { x: U.x + ux * q, y: U.y + uy * q };
  const M = { x: lerp(R.x, N.x, st.pull) - (N.x - R.x) * st.vib * 0.45, y: lerp(R.y, N.y, st.pull) - (N.y - R.y) * st.vib * 0.45 };
  if (st.pull > 0 && st.pull < 1) { M.x += Math.sin(G.t * 60) * 0.25 * sc; } // kurma çarkı tık tık çeker
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const str = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(U.x, U.y); ctx.lineTo(M.x, M.y); ctx.lineTo(D.x, D.y); ctx.stroke(); };
  str(1.9 * sc, '#24160e'); str(0.8 * sc, '#cdb88e');
  if (st.load >= 1) { ctx.globalCompositeOperation = 'lighter'; str(1.6 * sc, `rgba(255,70,90,${0.1 + 0.07 * Math.sin(time * 5 + t.x)})`); } // gergin kirişte kızıl titreşim
  ctx.restore();
  // mızrak: fırlarken ileri kayıp söner, sonra arkadan belirip oluğa oturur
  let a = 0, off = 0;
  if (st.launch >= 0) { a = 1 - st.launch; off = st.launch * 0.55; }
  else if (st.load > 0) { a = Math.pow(st.load, 0.7); off = -(1 - easeOutQ(st.load)) * BAL.slide; }
  if (sp && a > 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate((T.x - N.x) * off, (T.y - N.y) * off);
    drawSprite(ctx, (NECRO && litOf(sp, lc)) || sp, 0, 0, ts.w); ctx.restore();
  }
  if (st.load > 0 && st.load < 1) { // beliriş sisi: şaft boyunca yeşil, mor, kızıl zerreler
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cols = ['120,255,140', '190,110,255', '255,80,90'], fade = Math.sin(st.load * Math.PI);
    for (let i = 0; i < 9; i++) {
      const f = i / 8, w = Math.sin(time * 7 + i * 1.7) * 2.5 * sc;
      glow(ctx, lerp(N.x, T.x, f) + w, lerp(N.y, T.y, f) - Math.abs(w) - (1 - st.load) * 6 * sc * ((i % 3) - 1), (3 + 2 * fade) * sc, cols[i % 3], 0.55 * fade);
    }
    ctx.restore();
  }
  ctx.restore();
}
function formPoint(t, ts, p) {
  const fl = towerForm(t) && towerForm(t).flip && t.face === -1 ? -1 : 1;
  return { x: t.x + (p[0] - 0.5) * ts.w * fl, y: ts.bottom - ts.h + p[1] * ts.h };
}
function towerSprite(t) {
  const F = towerForm(t);
  const xb = !F && xbowCount(t), MV = !F && mahzenView(t), name = F ? formImg(t) : xb ? xbowTowerName(t.lvl) : `tower_${t.type}_${t.lvl + 1}${MV && MV.side ? '_side' : ''}`, im = spr(name);
  if (!im) return null;
  const m = SPR_META[name];
  const w = (m ? m[0] * TOWER_K * (NECRO && t.type === 'archer' ? 1.3 : 1) : 74 * BUILD_K) * (F ? F.w : xb && name === 'tower_archer_fan' ? XBOW.lvW[t.lvl] : 1), h = w * im.height / im.width;
  return { im, name, w, h, bottom: t.y + (m ? w * (m[2] ?? 0.24) : 10) };
}

// ---- Top kulesinin 3B topu: gerçek 3B modelden eğik (ortografik) izdüşümle çizilir ----
// Dünya: X sağ, Y yukarı, Z izleyiciye doğru. Kamera yukarıdan CAM_S açısıyla bakar.
const CAM_S = 0.45, CAM_C = Math.sqrt(1 - CAM_S * CAM_S);

// arbaletçi kulesinin kademe görseli: tower_xbow_1..3 yoksa platformlu Hayalet Arbaletçiler kulesi (geçici)
const xbowTowerName = (lvl) => (spr(`tower_xbow_${lvl + 1}`) ? `tower_xbow_${lvl + 1}` : 'tower_archer_fan');
function towerIcon(type, lvl) {
  if (NECRO && type === 'archer') return spr(xbowTowerName(lvl - 1));
  return spr(`tower_${type}_${lvl}`);
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
// Necromancer: okçular mor başlıklı, kemik renkli giysili ölüler
if (NECRO) for (const L of [...ARCHER_LOOK, ARCHER_LOOK.poison, ARCHER_LOOK.snipe]) for (const [k, v] of Object.entries({
  tunic: ['#cfc9ae', '#7c7660'], hood: ['#5a3a7a', '#24143a'], hat: ['#4a2e66', '#1e1030'], inner: '#0c0614', cape: ['#4a2a6a', '#1c0e30'],
  sleeve: ['#cfc9ae', '#7c7660'], vest: ['#3a2a4a', '#1a1024'], pants: ['#3a3040', '#1a1420'], boot: ['#2a2430', '#100c14'], trim: '#7ad36a', buckle: '#7ad36a',
})) if (k in L) L[k] = v; // yalnız görünümde olan renkler değişir (eksik alan çizimi bozar)
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
  // Necromancer: okçular iskelet; yüz yerine yeşil gözlü kafatası
  const face = NECRO ? () => {
    g.beginPath(); g.arc(hx, hy, 5.5, 0, Math.PI * 2); g.fillStyle = archGrad(g, hx - 4, hy - 5, hx + 4, hy + 5, ['#f6f1de', '#b4ac90']); g.fill();
    g.fillStyle = '#140c18'; g.beginPath(); g.ellipse(hx + 2.7, hy - 0.5, 1.6, 1.8, 0, 0, 7); g.fill();
    g.fillStyle = '#8dff7a'; g.beginPath(); g.arc(hx + 2.9, hy - 0.5, 0.65, 0, 7); g.fill();
    g.fillStyle = '#140c18'; g.beginPath(); g.moveTo(hx + 4.7, hy + 0.9); g.lineTo(hx + 5.4, hy + 2.3); g.lineTo(hx + 4.2, hy + 2.2); g.closePath(); g.fill();
    g.strokeStyle = '#3a3020'; g.lineWidth = 0.45;
    g.beginPath(); g.moveTo(hx + 1.6, hy + 3.4); g.lineTo(hx + 5.2, hy + 3.4); g.stroke();
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(hx + 2 + i * 0.9, hy + 2.9); g.lineTo(hx + 2 + i * 0.9, hy + 4.1); g.stroke(); }
    g.lineWidth = 1.05;
  } : () => {
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
  const walking = a.walk > 0, g8 = walking ? gaitOf(a.walk * 10 / TAU) : null; // 12 pozlu yürüyüş
  const bob = g8 ? -g8.dy * 26 : Math.sin(G.t * 2.4 + a.seed) * 0.3;
  const rel = a.fx > 0 ? a.fx / 0.18 : 0, dw = pose(BOW_DRAW, a.draw, Q).d; // yay çekişi 12 poz
  c.save(); c.translate(o.x, o.y); c.scale(s * face, s);
  // gölge
  c.fillStyle = 'rgba(25,14,4,0.38)'; c.beginPath(); c.ellipse(0.4, 0, 5.6, 1.7, 0, 0, Math.PI * 2); c.fill();
  // bacaklar (açı artı yönde ayak geriye gider)
  const st = walking ? 0 : 0.2;
  const leg = (part, hx, ang, lift) => { c.save(); c.translate(hx, -9 - bob * 0.3 - lift); c.rotate(ang); blitPart(c, part); c.restore(); };
  leg(P.legB, -1.2, (g8 ? -g8.b * 0.5 : 0) - st, g8 ? Math.max(0, g8.bl) * 1.3 : 0);
  leg(P.leg, 1.3, (g8 ? -g8.f * 0.5 : 0) + st * 0.6, g8 ? Math.max(0, g8.fl) * 1.3 : 0);
  // gövde: hedefe doğru hafifçe eğilir, nefes alır
  // atıştan sonra kısa geri tepme: gövde geriye yaslanır, yay kolu hafifçe düşer
  const lean = la * 0.12 + (walking ? 0.06 : 0) - Math.sin(rel * Math.PI) * 0.07 + dw * 0.03;
  c.translate(0, -9 - bob); c.rotate(lean); c.translate(0, 9);
  const br = 1 + Math.sin(G.t * 2.4 + a.seed) * 0.012;
  c.save(); c.translate(0, -9); c.scale(1, br); c.translate(0, 9); blitPart(c, P.body); c.restore();
  // kollar ve yay (gövde eğimine göre yerel açı)
  const aim = la - lean, ca = Math.cos(aim), sa = Math.sin(aim);
  const S = { x: 0.6, y: -16.4 }, H = { x: S.x + ca * 7.2, y: S.y + sa * 7.2 };
  const dr = 1.3 + dw * 5.6 - rel * 1.0;
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
  const vib = rel > 0 ? Math.sin(rel * 42) * rel * 1.4 : 0; // atıştan sonra kiriş titrer
  c.beginPath(); c.moveTo(-1.6, -8.6); c.lineTo(-dr + vib, 0); c.lineTo(-1.6, 8.6); c.stroke();
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
  c.fillStyle = NECRO ? '#e6e0c8' : '#f2c095'; c.strokeStyle = ARCH_OUT; c.lineWidth = 0.6; c.beginPath(); c.arc(H.x, H.y, 1.25, 0, Math.PI * 2); c.fill(); c.stroke();
  // çeken kol: dirsek dışarı/yukarı kalkar
  const S2 = { x: -0.6, y: -16.0 };
  const mx = (S2.x + Pw.x) / 2, my = (S2.y + Pw.y) / 2, k = 1.6 + dw * 1.4;
  const E = { x: mx - sa * k * 0.4 - ca * dw * 1.4, y: my - Math.abs(ca) * k * 0.55 };
  limb([S2, E, Pw], L.sleeve[0], 2.3);
  c.fillStyle = NECRO ? '#e6e0c8' : '#f2c095'; c.strokeStyle = ARCH_OUT; c.lineWidth = 0.6; c.beginPath(); c.arc(Pw.x, Pw.y, 1.2, 0, Math.PI * 2); c.fill(); c.stroke();
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
// Paralı asker: yamalı yeşil cüppe altında eski zincir zırh, burun korumalı miğfer, kahverengi pelerin, tahta kalkan
SOLDIER_LOOK.merc = { tunic: ['#6a7a3a', '#33401a'], mail: ['#9a968c', '#4e4a44'], sleeve: ['#8a6a44', '#4a3018'], pants: ['#5a4030', '#2e2018'], boot: ['#3a2618', '#1a100a'], belt: '#2a1608', trim: '#d8a040',
  helm: ['#c4beb2', '#5e5a52'], plume: ['#5a4434', '#1e140c'], cape: ['#7a4a22', '#34180a'], blade: ['#ece8de', '#8a8478'], hilt: '#3a2010', guard: '#a8946a', bladeLen: 11, head: 1, shieldLvl: 0 };
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
  if ((L.shieldLvl ?? lvl) === 0) {
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
  // yürüyüş (12 poz): bacaklar yerde geri kayar, havada diz kalkarak öne savrulur; gövde adımda iner-kalkar
  const g8 = walk ? gaitOf(walk * 9 / TAU) : null;
  const bob = g8 ? -g8.dy * 26 : Math.sin(G.t * 2.2 + seed) * 0.25;
  c.save(); c.translate(o.x, o.y); c.scale(s * face, s);
  c.fillStyle = 'rgba(25,14,4,0.35)'; c.beginPath(); c.ellipse(0.4, 0, 5.8, 1.7, 0, 0, Math.PI * 2); c.fill();
  // nöbet duruşu: kılıç önde, yukarı bakar. Saldırı 12 poz (SOL_ATK): ağırlık geri → sezdirme (kılıç öne iner,
  // çömelir) → kılıç kalkar → kurulma (başın üstü) → gerilim → savuruş → darbe → sekme → devam → toparlanma
  let swing = 0.75 + Math.sin(G.t * 2.2 + seed) * 0.04, lunge = 0, step = 0, crouch = 0;
  if (atk != null) {
    const A = pose(SOL_ATK, atk, Q);
    swing = A.sw; lunge = A.lu; step = A.st; crouch = A.cr;
    if (atk > 0.06 && atk < 0.13) { const k = (atk - 0.06) / 0.07; swing += Math.sin(k * Math.PI * 3) * 0.1 * (1 - k); } // darbe titremesi
  }
  // bacak açısı artı yönde ayak geriye gider: öne savrulma için işaret ters
  const sw = g8 ? -g8.f * 0.5 : 0, swB = g8 ? -g8.b * 0.5 : 0, st = g8 ? 0 : 0.18;
  const leg = (part, hx, ang, lift) => { c.save(); c.translate(hx, -9 - bob * 0.3 - lift); c.rotate(ang); blitPart(c, part); c.restore(); };
  c.translate(lunge, 0);
  leg(P.legB, -1.2, swB - st - step * 0.5, g8 ? Math.max(0, g8.bl) * 1.3 : 0);
  leg(P.leg, 1.3, sw + st * 0.6 + step, g8 ? Math.max(0, g8.fl) * 1.3 : 0);
  c.translate(0, -bob + crouch);
  if (g8) c.rotate((g8.rot - 0.04) * 0.6);
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


function drawTower(t) {
  drawTowerBody(t);
  if (t.disabledT > 0) drawTowerDisabled(t);
}
// susturulan kule: üstünde dönen yıldızlar (sersemleme) ya da mor lanet halkası
// ---- Lanet Kulesi canlandırması (10 Eki, Caner: "en kaliteli şekilde hareketlendir, korkutucu olsun") ----
// Görsel nm_lanet_kulesi.jpg (3 kademe). Noktalar [x oranı, alttan yükseklik oranı]. eye: [cx, up, rx, ry] boyalı gözün yeri;
// üstüne kodla canlı göz çizilir (iris, yarık bebek en yakın düşmana bakar, ara ara kırpar, korkuttuğunda kızarır).
const ALTAR_FX = [
  { eye: [0.5, 0.86, 0.095, 0.06], candles: [[0.43, 0.295], [0.28, 0.232], [0.658, 0.31], [0.722, 0.232], [0.668, 0.2]], runes: { x: 0.585, y0: 0.42, y1: 0.76, col: '190,110,255' }, smoke: [0.5, 0.95] },
  { book: true, braziers: [[0.17, 0.35], [0.83, 0.35]], skullEyes: [[0.578, 0.63], [0.672, 0.63]], runes: { x: 0.41, y0: 0.3, y1: 0.46, col: '120,150,255' } },
  { eye: [0.505, 0.62, 0.09, 0.075], braziers: [[0.225, 0.3], [0.78, 0.3]], skullEyes: [[0.488, 0.322], [0.522, 0.322]], floor: [0.5, 0.16, 0.36, 0.1] },
];
// görseli yatay bir çizgiden ikiye bölen katmanlar: üstteki (kitap) ayrı salınır. cut: alttan yükseklik oranı
const TOWER_SPLIT = { tower_altar_2: { cut: 0.765, bob: 2.6, tilt: 0.035 } };
const SPLIT_CACHE = new WeakMap();
function splitOf(im, cut) {
  let S = SPLIT_CACHE.get(im); if (S) return S;
  const W = im.width, H = im.height, cy = Math.round(H * (1 - cut)), mk = (y0, y1) => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(im, 0, y0, W, y1 - y0, 0, y0, W, y1 - y0); return c; };
  S = { top: mk(0, cy), bot: mk(cy, H) }; SPLIT_CACHE.set(im, S); return S;
}
function drawSplitTower(t, ts, im, SP) {
  const S = splitOf(im, SP.cut), s = ts.w / 50, ph = time * 1.5 + t.x * 0.01;
  drawSprite(ctx, S.bot, 0, 0, ts.w);
  // kitabın altına düşen mor ışık (sütunun tepesine)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -ts.h * SP.cut + 2 * s, ts.w * 0.32, '170,90,255', 0.28 + Math.sin(ph * 1.7) * 0.08); ctx.restore();
  const by = -ts.h * SP.cut, dy = -Math.abs(Math.sin(ph)) * SP.bob * s - 1.5 * s;
  ctx.save(); ctx.translate(0, by + dy); ctx.rotate(Math.sin(ph * 0.8) * SP.tilt); ctx.translate(0, -by);
  drawSprite(ctx, S.top, 0, 0, ts.w);
  ctx.restore();
}
function drawAltarFx(t, ts) {
  const F = ALTAR_FX[t.lvl], s = ts.w / 50; if (!F) return;
  const P = (q) => ({ x: t.x + (q[0] - 0.5) * ts.w, y: ts.bottom - q[1] * ts.h });
  const L = t.def.levels[t.lvl], beat = Math.pow(Math.max(0, Math.sin(time * 2.6 + t.x)), 6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (F.floor) { // lanet sisi zeminde ağır ağır döner
    const c = P(F.floor);
    for (let i = 0; i < 4; i++) { const a = time * 0.35 + i * 1.57; glow(ctx, c.x + Math.cos(a) * ts.w * F.floor[2] * 0.7, c.y + Math.sin(a) * ts.h * F.floor[3] * 0.5, ts.w * 0.2, i % 2 ? '150,70,255' : '110,40,200', 0.14 + 0.05 * Math.sin(time * 1.3 + i)); }
  }
  if (F.runes) { // runlar: aşağıdan yukarı akan lanet enerjisi
    for (let i = 0; i < 3; i++) { const k = (time * 0.45 + i / 3 + t.x * 0.003) % 1, q = P([F.runes.x, lerp(F.runes.y0, F.runes.y1, k)]); glow(ctx, q.x, q.y, 6 * s, F.runes.col, 0.5 * Math.sin(k * Math.PI)); }
    const q0 = P([F.runes.x, (F.runes.y0 + F.runes.y1) / 2]); glow(ctx, q0.x, q0.y, ts.h * (F.runes.y1 - F.runes.y0) * 0.6, F.runes.col, 0.08 + 0.06 * beat);
  }
  for (const [i, c] of (F.candles || []).entries()) { const q = P(c), fk = 0.75 + 0.15 * Math.sin(time * 11 + i * 2.1) + 0.1 * Math.sin(time * 23 + i); glow(ctx, q.x, q.y - 1.5 * s, 4.5 * s * fk, '255,190,90', 0.55 * fk); glow(ctx, q.x, q.y - 1.5 * s, 1.5 * s, '255,245,210', 0.6 * fk); }
  for (const [i, c] of (F.braziers || []).entries()) { // mor ateş: titrer, kıvılcım savurur
    const q = P(c), fk = 0.75 + 0.15 * Math.sin(time * 9 + i * 2.7) + 0.1 * Math.sin(time * 21 + i);
    glow(ctx, q.x, q.y - 3 * s, 12 * s * fk, '170,80,255', 0.5 * fk); glow(ctx, q.x, q.y - 2 * s, 4.5 * s, '235,200,255', 0.55 * fk);
    if (Math.random() < 0.12) emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-3, 3) * s, y: q.y - 4 * s, vx: rand(-6, 6), vy: -rand(20, 45), col: Math.random() < 0.3 ? '255,120,200' : '170,90,255', s0: 2.4, s1: 0.4, life: rand(0.5, 0.9) });
  }
  for (const c of F.skullEyes || []) { const q = P(c), f = 0.6 + 0.4 * Math.sin(time * 4.3 + c[0] * 9); glow(ctx, q.x, q.y, 2.6 * s, '255,40,60', 0.75 * f); } // kafatası gözlerinde kızıl kor
  if (F.smoke && Math.random() < 0.18) { const q = P(F.smoke); emit(G.parts, { kind: 'glow', x: q.x + rand(-4, 4) * s, y: q.y, vx: rand(-6, 6), vy: -rand(10, 22), col: '130,60,200', s0: 3 * s, s1: 7 * s, life: rand(1, 1.6), a: 0.35 }); }
  if (F.book) { // kitabın sayfalarından yükselen run kıvılcımları
    const q = P([0.48, 0.88]); if (Math.random() < 0.2) emit(G.parts, { kind: 'glow', add: true, x: q.x + rand(-8, 8) * s, y: q.y, vx: rand(-5, 5), vy: -rand(12, 28), col: Math.random() < 0.5 ? '200,150,255' : '150,110,255', s0: 2, s1: 0.4, life: rand(0.8, 1.3) });
    glow(ctx, q.x, q.y, 14 * s, '180,110,255', 0.22 + 0.15 * beat);
  }
  ctx.restore();
  if (F.eye) drawCurseEye(t, ts, F.eye, P, L);
}
// canlı lanet gözü: boyalı gözün üstüne iris + yarık bebek; bebek en yakın düşmana döner, ara ara göz kırpar, korkutunca kızarır
function drawCurseEye(t, ts, E, P, L) {
  const c = P(E), rx = E[2] * ts.w, ry = E[3] * ts.h, s = ts.w / 50;
  let tx = Math.sin(time * 0.7 + t.x) * 0.6, ty = Math.sin(time * 0.53) * 0.3, best = 1e9;
  for (const e of G.enemies) { if (e.dead || e.under) continue; const d = dist(e.x, e.y, t.x, t.y); if (d < L.range * 1.6 && d < best) { best = d; tx = clamp((e.x - c.x) / 90, -1, 1); ty = clamp((e.y - 10 - c.y) / 90, -1, 1); } }
  t.eyeX = lerp(t.eyeX || 0, tx, 0.12); t.eyeY = lerp(t.eyeY || 0, ty, 0.12);
  if ((t.blinkAt ?? (t.blinkAt = time + rand(2, 6))) < time - 0.22) t.blinkAt = time + rand(3, 7);
  const bk = time >= t.blinkAt ? Math.sin(clamp((time - t.blinkAt) / 0.22, 0, 1) * Math.PI) : 0, red = clamp((t.scareT || 0) - time, 0, 1);
  const beat = Math.pow(Math.max(0, Math.sin(time * 2.6 + t.x)), 6);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(c.x + t.eyeX * rx * 0.25, c.y + t.eyeY * ry * 0.2, 1, c.x, c.y, rx);
  g.addColorStop(0, red ? '#ffb0b0' : '#f0c8ff'); g.addColorStop(0.45, red ? '#ff3040' : '#a24dff'); g.addColorStop(1, red ? '#5a0610' : '#2a0850');
  ctx.fillStyle = g; ctx.fillRect(c.x - rx, c.y - ry, rx * 2, ry * 2);
  const px = c.x + t.eyeX * rx * 0.42, py = c.y + t.eyeY * ry * 0.3, pw = rx * (0.13 + 0.12 * beat), ph = ry * 0.78; // atışta bebek açılır
  ctx.beginPath(); ctx.moveTo(px, py - ph); ctx.quadraticCurveTo(px + pw * 1.6, py, px, py + ph); ctx.quadraticCurveTo(px - pw * 1.6, py, px, py - ph); ctx.fillStyle = '#12041c'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(c.x - rx * 0.32, c.y - ry * 0.38, rx * 0.12, ry * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  if (bk > 0) { // göz kapakları: koyu taş renginde yukarıdan ve aşağıdan kapanır
    ctx.fillStyle = '#1e1426'; ctx.fillRect(c.x - rx, c.y - ry, rx * 2, ry * bk * 1.02); ctx.fillRect(c.x - rx, c.y + ry - ry * bk * 1.02, rx * 2, ry * bk * 1.02);
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, c.x, c.y, rx * (2.2 + 0.8 * beat), red ? '255,40,60' : '170,80,255', (0.3 + 0.35 * beat) * (1 - bk * 0.8));
  ctx.restore();
}
// Necromancer kulelerinin canlı kısımları (kodla): dikilitaş kıymıkları, fener ruhu, kazan köpüğü
function drawNecroTowerFx(t, ts) {
  const TF = towerForm(t), o = TF && TF.src ? formPoint(t, ts, TF.src) : towerEye(t, ts), s = ts.w / 50, sh = t.shotAnim > 0 ? t.shotAnim / 0.25 : 0;
  ctx.save();
  const OF = obeliskForm(t);
  if (OF) {
    ctx.globalCompositeOperation = 'lighter';
    if (OF.tip) { // balista: mızrak ucunda kızıl alev, atışta kiriş şaklar
      const lay = balLay(t), o = lay ? balPoint(t, ts, OF, OF.tip) : formPoint(t, ts, OF.tip), ready = lay ? balState(t).load : t.shotAnim > 0 ? 0.3 : 1;
      glow(ctx, o.x, o.y, 9 * s, '255,70,70', (0.45 + Math.sin(time * 9 + t.x) * 0.12) * ready);
      if (!lay && t.snap && (t.snap.t -= 0.016) > 0) {
        const n = t.snap, k = n.t / 0.18;
        ctx.strokeStyle = `rgba(255,230,200,${0.8 * k})`; ctx.lineWidth = 1.2;
        for (const dy of [-6, 6]) { ctx.beginPath(); ctx.moveTo(n.x, n.y + dy * s * (1 - k * 0.5)); ctx.quadraticCurveTo(n.x - (t.face || 1) * 4 * k * s, n.y, n.x, n.y - dy * s); ctx.stroke(); }
      }
    } // hayalet arbaletçiler: parıltıları drawXbowMen çizer
    ctx.globalCompositeOperation = 'source-over';
  } else if (t.type === 'mage' && towerForm(t)) {
    const MF = towerForm(t), o = formPoint(t, ts, MF.src), sh2 = t.shotAnim > 0 ? t.shotAnim / 0.2 : 0;
    ctx.globalCompositeOperation = 'lighter';
    if (MF.ramp) { // kristal: mor-yeşil nabız, ışın güçlendikçe büyür
      const r = 1 + (t.ramp || 0) * 0.8;
      glow(ctx, o.x, o.y, (14 + 8 * sh2) * s * r, '190,130,255', 0.35 + Math.sin(time * 3 + t.x) * 0.1 + 0.4 * sh2);
      glow(ctx, o.x, o.y, 6 * s * r, '160,255,200', 0.4 + 0.3 * sh2);
    } else { // ruh kafesi: kızıl göz atar, kafesin içi ruh ışığıyla döner
      const c = formPoint(t, ts, MF.cageAt);
      glow(ctx, c.x, c.y, 18 * s, '190,140,255', 0.25 + Math.sin(time * 2.2 + t.x) * 0.08);
      glow(ctx, o.x, o.y, (9 + 6 * sh2) * s, '255,70,60', 0.45 + Math.sin(time * 5) * 0.12 + 0.4 * sh2);
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (t.type === 'archer' && !xbowCount(t)) {
    // tepede dönen kemik kıymıkları (ön yarısı kulenin önünde, arka yarısı arkasında görünür gibi soluk)
    const ch = t.charge || 0, n = 3 + t.lvl - (sh > 0.4 ? 1 : 0), R = (8 + t.lvl * 3) * s * (1 - 0.65 * ch);
    t.spin = (t.spin || 0) + (1.6 + t.lvl * 0.3 + ch * 9) * 0.016;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, o.x, o.y, (10 + 10 * ch + 12 * sh) * s, '150,255,160', 0.3 + 0.5 * ch + 0.5 * sh + Math.sin(time * 3 + t.x) * 0.06);
    if (ch > 0.3) glow(ctx, o.x, o.y, 4 * s, '230,255,230', ch);
    ctx.restore();
    if (sh > 0) { ctx.save(); ctx.translate(0, -sh * 2 * s); } // atışta tepe hafifçe geri teper
    for (let i = 0; i < n; i++) {
      const a = t.spin + i * Math.PI * 2 / n, x = o.x + Math.cos(a) * R, y = o.y + Math.sin(a) * R * 0.35 - 2 * s, front = Math.sin(a) > 0;
      ctx.save(); ctx.globalAlpha = front ? 1 : 0.55; ctx.translate(x, y); ctx.rotate(a + Math.PI / 2 + Math.sin(time * 5 + i) * 0.2); ctx.scale(s, s);
      ctx.fillStyle = '#efe6cc'; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(1.6, 1.5); ctx.lineTo(0, 3); ctx.lineTo(-1.6, 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (sh > 0) ctx.restore();
  } else if (t.type === 'barracks' && NECRO) {
    // Mahzen (11 Eki): kapının ağzında nabız gibi atan yeşil-mor ruh ışığı, ayağında süzülen sis
    const P = (dx, up) => ({ x: t.x + dx * ts.w, y: ts.bottom - up * ts.h }), g = DOOR_GLOW[t.lvl] || DOOR_GLOW[0];
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = time * 0.5 + i * 2.1 + t.x * 0.01, q = P(Math.sin(a) * 0.3, 0.06 + 0.04 * Math.cos(a * 1.3 + i));
      glow(ctx, q.x, q.y, ts.w * (0.15 + 0.04 * Math.sin(a * 2)), i % 2 ? '190,120,255' : '120,255,150', 0.08 + 0.04 * Math.sin(a * 1.7));
    }
    const MV = mahzenView(t), d = MV ? mahzenPt(t, ts, MV, MV.P.glow) : P(g[0], g[1]);
    glow(ctx, d.x, d.y, 13 * s, '120,255,160', 0.22 + 0.1 * Math.sin(time * 2.2 + t.x)); glow(ctx, d.x, d.y + 4 * s, 8 * s, '170,100,255', 0.18 + 0.08 * Math.sin(time * 3.1));
    if (MV) for (const [i, f] of MV.P.fire.entries()) { // mum ve fener alevleri titrer
      const q = mahzenPt(t, ts, MV, f), fk = 0.75 + 0.15 * Math.sin(time * 11 + i * 2.3) + 0.1 * Math.sin(time * 23 + i);
      if (f[2] === 'l') glow(ctx, q.x, q.y, 7 * s * fk, '120,255,150', 0.45 * fk);
      else if (f[2] === 'b') { glow(ctx, q.x, q.y - 3 * s, 11 * s * fk, '110,255,140', 0.4 * fk); glow(ctx, q.x, q.y - 2 * s, 4 * s, '220,255,220', 0.5 * fk); } // mangal: yeşil ateş
      else { glow(ctx, q.x, q.y - 1.5 * s, 4.5 * s * fk, '255,190,90', 0.5 * fk); glow(ctx, q.x, q.y - 1.5 * s, 1.6 * s, '255,245,200', 0.6 * fk); }
    }
  } else if (t.type === 'mage') {
    // fenerdeki ruh: nabız gibi atan mor-yeşil ışık, çevresinde dönen küçük hayalet kıvılcımları
    const pulse = 0.5 + Math.sin(time * 3.2 + t.x) * 0.15 + 0.4 * sh;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, o.x, o.y, (12 + 4 * t.lvl + 10 * sh) * s, '170,130,255', pulse);
    glow(ctx, o.x, o.y, (5 + 2 * t.lvl) * s, '210,255,240', 0.5 + 0.4 * sh);
    for (let i = 0; i < 2 + t.lvl; i++) {
      const a = time * 1.4 + i * 2.1 + t.x, x = o.x + Math.cos(a) * (10 + 3 * t.lvl) * s, y = o.y + Math.sin(a * 1.3) * 6 * s - ((time * 12 + i * 9) % 14) * s * 0.4;
      glow(ctx, x, y, 3 * s, i % 2 ? '170,255,220' : '190,150,255', 0.55);
    }
  } else if (t.type === 'altar') {
    // lanet kulesi: nabız gibi atan mor lanet ışığı, yerde dönen lanet halkası; kan ayini varsa güçlendirdiği kulelere bağ
    const beat = Math.pow(Math.max(0, Math.sin(time * 3.2 + t.x)), 6), L = t.def.levels[t.lvl];
    ctx.restore(); drawAltarFx(t, ts); ctx.save(); // göz, kitap, ateşler, sis (drawAltarFx)
    ctx.globalCompositeOperation = 'lighter';
    {
      ctx.strokeStyle = `rgba(170,90,255,${0.14 + 0.1 * beat})`; ctx.lineWidth = 1.6; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 14;
      ctx.beginPath(); ctx.ellipse(t.x, t.y, L.range, L.range * 0.62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const u of G.towers) {
      if (!abRank(t, 'rite')) break;
      if (u === t || u.type === 'altar' || u.type === 'barracks' || dist(u.x, u.y, t.x, t.y) > L.range) continue;
      const uts = towerSprite(u), ux = u.x, uy = uts ? uts.bottom - uts.h * 0.5 : u.y - 30;
      ctx.strokeStyle = `rgba(255,50,60,${0.35 + 0.25 * beat})`; ctx.lineWidth = 2.4 * s; ctx.setLineDash([3 * s, 5 * s]); ctx.lineDashOffset = -time * 20;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.quadraticCurveTo((o.x + ux) / 2, Math.min(o.y, uy) - 20 * s, ux, uy); ctx.stroke(); ctx.setLineDash([]);
      const k = (time * 0.7 + u.x * 0.01) % 1, qx = (1 - k) * (1 - k) * o.x + 2 * k * (1 - k) * (o.x + ux) / 2 + k * k * ux, qy = (1 - k) * (1 - k) * o.y + 2 * k * (1 - k) * (Math.min(o.y, uy) - 20 * s) + k * k * uy;
      glow(ctx, qx, qy, 5 * s, '255,60,70', 0.9);
      glow(ctx, ux, u.y, 18 * s, '255,40,50', 0.25 + 0.2 * beat);
    }
  } else if (t.type === 'artillery' && towerForm(t)) {
    const AF = towerForm(t), TA = towerAnim(t), busy = TA && t.animT != null && t.animT < TA.dur;
    ctx.globalCompositeOperation = 'lighter';
    if (t.spec === 'plague') { // kara veba: ağızda mor-yeşil kaynama, altında kızıl ateş
      const m = formPoint(t, ts, AF.src), f = formPoint(t, ts, [0.5, 0.62]);
      glow(ctx, m.x, m.y, 16 * s, '180,90,255', 0.25 + Math.sin(time * 4 + t.x) * 0.08);
      glow(ctx, f.x, f.y, 12 * s, '255,60,60', 0.35 + Math.sin(time * 9) * 0.1 + Math.sin(time * 23) * 0.05);
      if (!busy && Math.random() < 0.12) emit(G.parts, { kind: 'glow', add: true, x: m.x + rand(-8, 8) * s, y: m.y, vy: -rand(15, 35), col: Math.random() < 0.5 ? '180,100,255' : '140,255,110', s0: 3, s1: 0.5, life: 0.7 });
    } else { // mancınık: yanındaki küçük kazan fokurdar, runlar mor parlar
      const c = formPoint(t, ts, [0.8, 0.72]), r = formPoint(t, ts, [0.45, 0.72]);
      glow(ctx, c.x, c.y, 8 * s, '140,255,110', 0.3 + Math.sin(time * 5 + t.x) * 0.1);
      glow(ctx, r.x, r.y, 14 * s, '170,90,255', 0.14 + Math.sin(time * 1.7) * 0.05);
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (t.type === 'artillery') {
    // kazan: kaynayan kabarcıklar, atışta yükselen bulamaç, üstte yeşil buhar ışığı
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, o.x, o.y, (12 + 3 * t.lvl) * s, '120,255,90', 0.3 + Math.sin(time * 2.5 + t.x) * 0.08 + 0.3 * sh); ctx.restore();
    for (let i = 0; i < 4 + t.lvl; i++) {
      const ph = (time * (0.9 + i * 0.13) + i / 4 + t.x * 0.01) % 1, x = o.x + Math.sin(i * 2.4 + t.x) * (6 + t.lvl) * s, y = o.y - ph * 7 * s;
      ctx.globalAlpha = 1 - ph; circle(x, y, (0.9 + ph * 1.8) * s, ph > 0.8 ? null : '#9cf26a', '#1e4a10', 0.6 * s);
    }
    ctx.globalAlpha = 1;
    if (sh > 0) { ctx.save(); ctx.translate(o.x, o.y - (1 - sh) * 14 * s); ctx.scale(s, s); circle(0, 0, 3.5 * sh + 1, '#7ae04a', '#1e4a10', 0.8); ctx.restore(); }
    if (Math.random() < 0.06) emit(G.parts, { kind: 'glow', x: o.x + rand(-6, 6) * s, y: o.y - 4 * s, vx: rand(-4, 4), vy: -rand(8, 16), col: '120,200,80', s0: 3 * s, s1: 8 * s, life: 1, a: 0.25 });
  }
  ctx.restore();
}
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
// Kulelerin koyu zeminde seçilmesi (10 Eki, 4. deneme; Caner: renklendirme olmasın): binanın arkasından ve ayağından çok hafif
// sıcak beyaz-sarı ışık. Fark edilmeyecek kadar soluk; amaç binayı zeminden ayırmak. Görsel başına bir kez hazırlanır.
// back: binanın arkasındaki ışık (sprite'tan önce çizilir), pool: ayağındaki ışık havuzu, a: yüzeye vuran ışığın gücü.
const TOWER_LIT = { a: 0.28, reach: 0.75, mode: 'soft-light', pool: 0.05, back: 0.09, shade: 0.42,
  cols: {}, col: ['255,238,205', '255,228,175'] };
const LIT_CACHE = new Map();
function litOf(im, cols, strip) {
  const key = im.src + '|' + cols.join('|');
  if (LIT_CACHE.has(key)) return LIT_CACHE.get(key);
  // görsel tamamen çözülmeden hazırlanırsa boş/beyaz çıkar: çözülmeyi bekle, bu arada özgün görsel çizilir
  LIT_CACHE.set(key, null);
  const build = () => {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    if (!iw) { LIT_CACHE.delete(key); return; }
    try {
      const c = document.createElement('canvas'); c.width = iw; c.height = ih;
      const g = c.getContext('2d'), A = TOWER_LIT.a;
      g.drawImage(im, 0, 0);
      g.globalCompositeOperation = TOWER_LIT.mode;
      // iki projektör: sol alt ve sağ alt köşeden yukarı, birbirine karışarak (şeritte her karenin görsel dikdörtgenine göre)
      const frames = strip ? strip.n : 1;
      for (let f = 0; f < frames; f++) {
        const b = strip ? strip.box : [0, 0, 1, 1], fw = iw / frames, sw = fw / (b[2] - b[0]), shh = ih / (b[3] - b[1]);
        const ox = f * fw - b[0] * sw, oy = -b[1] * shh; // görsel dikdörtgeninin bu karedeki yeri
        g.save(); g.beginPath(); g.rect(f * fw, 0, fw, ih); g.clip();
        for (const [k, col] of [[0, cols[0]], [1, cols[1]]]) {
          const x = ox + sw * (k ? 0.82 : 0.18), gr = g.createRadialGradient(x, oy + shh * 1.02, sw * 0.05, x, oy + shh * 0.95, shh * TOWER_LIT.reach);
          gr.addColorStop(0, `rgba(${col},${A})`); gr.addColorStop(0.45, `rgba(${col},${A * 0.5})`); gr.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = gr; g.fillRect(f * fw, 0, fw, ih);
        }
        g.restore();
      }
      g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0); // saydam yerler saydam kalsın
      LIT_CACHE.set(key, c);
    } catch (e) { /* özgün görselle devam */ }
  };
  if (im.decode) im.decode().then(build, () => LIT_CACHE.delete(key)); else build();
  return null;
}
function drawTowerBody(t) {
  const ts = towerSprite(t);
  if (ts) {
    if (NECRO) { // temas gölgesi (binayı zemine oturtur) ve ayağındaki soluk ışık havuzu
      const sh = ctx.createRadialGradient(t.x, ts.bottom - 2, 2, t.x, ts.bottom - 2, ts.w * 0.62);
      sh.addColorStop(0, `rgba(8,4,12,${TOWER_LIT.shade})`); sh.addColorStop(1, 'rgba(8,4,12,0)');
      ctx.save(); ctx.translate(t.x, ts.bottom - 2); ctx.scale(1, 0.42); ctx.translate(-t.x, -(ts.bottom - 2));
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(t.x, ts.bottom - 2, ts.w * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lc = TOWER_LIT.cols[t.type] || TOWER_LIT.col;
      glow(ctx, t.x, ts.bottom - ts.h * 0.32, ts.w * 0.78, lc[0], TOWER_LIT.back); // arkadan: siluet zeminden ayrılır
      glow(ctx, t.x - ts.w * 0.2, ts.bottom - 3, ts.w * 0.42, lc[0], TOWER_LIT.pool);
      glow(ctx, t.x + ts.w * 0.2, ts.bottom - 3, ts.w * 0.42, lc[1], TOWER_LIT.pool);
      ctx.restore();
      drawTowerFog(t, ts, false);
    }
    const age = G.t - (t.born ?? -9);
    const pop = age < 0.45 ? easeOutBack(clamp(age / 0.45, 0, 1)) : 1; // inşa/yükseltme zıplaması
    // top ateşlediğinde kule hafifçe sarsılır (top kendi içinde geri teper)
    const ksy = t.type === 'artillery' && t.shotAnim > 0.2 ? 1 - (t.shotAnim - 0.2) * 0.25 : 1;
    const OF = towerForm(t), MV = mahzenView(t), fl = MV ? MV.fl : OF && OF.flip && t.face === -1 ? -1 : 1;
    const recoil = OF && OF.tip && !balLay(t) && t.shotAnim > 0 ? -Math.sin(t.shotAnim / 0.3 * Math.PI) * 3.5 * fl : 0; // balista geri teper
    ctx.save(); ctx.translate(t.x + recoil, ts.bottom); ctx.scale(pop * fl, pop * ksy);
    const TA = towerAnim(t);
    if (TA && t.animT != null && t.animT < TA.dur) { // atış animasyonu: şeridin karesi, görselle aynı yere oturur
      const M = TA.M, i = Math.min(M.n - 1, Math.floor(t.animT * TOWER_ANIM_FPS)), b = M.box, lim = litOf(TA.im, TOWER_LIT.cols[t.type] || TOWER_LIT.col, M) || TA.im;
      ctx.drawImage(lim, i * M.fw, 0, M.fw, M.fh, (b[0] - 0.5) * ts.w, (b[1] - 1) * ts.h, (b[2] - b[0]) * ts.w, (b[3] - b[1]) * ts.h);
    } else if (balLay(t)) drawBallista(t, ts, OF);
    else {
      const lit = NECRO && litOf(ts.im, TOWER_LIT.cols[t.type] || TOWER_LIT.col), SP = TOWER_SPLIT[ts.name];
      if (SP) drawSplitTower(t, ts, lit || ts.im, SP); else drawSprite(ctx, lit || ts.im, 0, 0, ts.w);
    }
    ctx.restore();
    if (xbowCount(t) && pop >= 0.99) drawXbowMen(t, ts, () => { // korkuluk çizgisinin altını yeniden çiz
      const lit = NECRO && litOf(ts.im, TOWER_LIT.cols[t.type] || TOWER_LIT.col), C = xbowCfg(t).clip;
      if (!C) return; // ön korkuluk yok (1. kademe): ayaklar platformun üstünde görünür
      ctx.save(); ctx.translate(t.x, ts.bottom); ctx.beginPath();
      ctx.moveTo(-ts.w / 2, (C[0][1] - 1) * ts.h); for (const [cx, cy] of C) ctx.lineTo((cx - 0.5) * ts.w, (cy - 1) * ts.h);
      ctx.lineTo(ts.w / 2, 0); ctx.lineTo(-ts.w / 2, 0); ctx.closePath(); ctx.clip();
      drawSprite(ctx, lit || ts.im, 0, 0, ts.w); ctx.restore();
    });
    drawNecroTowerFx(t, ts);
    drawTowerFog(t, ts, true);
    if (t.ab) {
      const ids = t.def.abilities.filter(a => t.ab[a.id]);
      ids.forEach((a, i) => {
        const bx = t.x + (ids.length === 1 ? 0 : i ? 13 : -13), by = t.y + 17;
        circle(bx, by + 1.5, 8.5, 'rgba(0,0,0,0.35)');
        circle(bx, by, 8.5, '#2a1c10', '#e2a93c', 1.6);
        drawAbilityIcon(a.id, bx, by, 0.42);
        for (let k = 0; k < t.ab[a.id]; k++) circle(bx - 4 + k * 4, by + 10, 1.6, '#ffd34d', '#2a1406', 0.8);
      });
      if (t.imbue) { const bx = t.x + (ids.length ? 22 : 0), by = t.y + 17; circle(bx, by + 1.5, 8.5, 'rgba(0,0,0,0.35)'); circle(bx, by, 8.5, '#2a1424', `rgb(${IMBUE[t.imbue].col})`, 1.6); drawImbueIcon(t.imbue, bx, by, 0.42); } // silah büyüsü rozeti
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

// tam ekranda yolun giriş ağzı görünür: düşman çerçeve dışında doğarken ilk adımlarında belirir (birden çıkmasın)
function drawEnemy(e) {
  const out = e.x < 0 || e.x > W || e.y < 0 || e.y > H;
  if (!out || e.d >= 45 || e.d < 0 || e.p.ext) return drawEnemy0(e); // giriş payından gelen zaten ekran dışından yürür
  ctx.save(); ctx.globalAlpha *= clamp(e.d / 45, 0, 1); drawEnemy0(e); ctx.restore();
}
function drawEnemy0(e) {
  const d = e.def;
  const fly = d.flying ? 26 + Math.sin(e.anim * 3) * 3 : 0;
  const bob = d.flying ? 0 : Math.abs(Math.sin(e.anim * 9)) * (e.blocker ? 0.5 : 2);
  const x = e.x, y = e.y - fly - bob;
  const name = 'enemy_' + e.type, im = d.base ? enemySprite(e.type) : spr(name);
  const dh = (d.h || 30) * UNIT_K;
  if (e.under) { drawBurrow(e); return; }
  if (im) {
    const moved = e.px !== undefined && Math.hypot(e.x - e.px, e.y - e.py) > 0.004;
    if (moved) { e.hdx = lerp(e.hdx || 0, e.x - e.px, 0.2); e.hdy = lerp(e.hdy || 0, e.y - e.py, 0.2); }
    e.px = e.x; e.py = e.y;
    // yürüyüş yönü: belirgin aşağı = önden, yukarı = arkadan, yoksa yandan
    // histerezis: önden/arkadan görünüşe 1,5 oranında geçer, 1,1'in altına inince yana döner (eşikte gidip gelmesin)
    const ax = Math.abs(e.hdx || 0), ay = Math.abs(e.hdy || 0);
    if (e.dirV ? ay < ax * 1.1 : ay > ax * 1.5) e.dirV = !e.dirV;
    const dir = e.dirV ? (e.hdy > 0 ? 'on' : 'arka') : null;
    if (d.chief) drawBossAura(e, dh);
    const uo = {
      rig: d.base ? 'enemy_' + d.base : undefined,
      h: CHAR_H[name] || d.r * 2.6, phase: (e.march && !(e.slowT > 0) ? G.t : e.anim) * (5 + d.speed * G.wspd / 9), // sıradakiler uygun adım
      rise: e.reviveT > 0 ? 0.25 + 0.75 * (1 - e.reviveT / 1.1) : e.emergeT > 0 ? 1 - e.emergeT / 0.35 * 0.85 : null,
      // yürüyor mu: gerçekten yer değiştiriyorsa (askere doğru yürürken de; yoksa tek pozda kayar gibi görünür)
      walking: moved && !e.inMelee && e.siege === undefined && !(e.stun > 0) && !(e.shootT > 0) && !(e.reviveT > 0),
      fly: (d.flying ? fly : 0) + (e.hopT > 0 ? Math.sin((1 - e.hopT / 0.4) * Math.PI) * 10 : 0),
      atk: e.siege !== undefined ? e.siege - SIEGE_HIT : e.inMelee ? atkPhase(d.rate, e.atk) : e.shootT > 0 ? 0.27 - e.shootT : null, atkVar: e.inMelee ? e.atkV : 0,
      flash: e.flash, hit: e.hitT, wings: d.flying ? e.anim : null, seed: e.off, dir, logId: e.logId,
      skill: e.skillT > 0 && !d.flying ? 1 - e.skillT / e.skillDur : null,
    };
    const ux = e.x + (e.fearT > 0 ? Math.sin(time * 70 + e.off * 9) * 0.9 : 0);
    if (d.formation) drawFormation(e, name, im, ux, uo);
    else drawUnit(name, im, ux, e.y, e.face, uo);
    if (d.prop) drawEnemyProp(e, d.prop, uo.h);
    if (e.drumT > 0 && !d.aura) { // davulla gaza gelen asker: ayağında ritimle atan kızıl ışık, yukarı uçuşan kıvılcım
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, e.x, e.y - 2, 12, '255,120,60', 0.18 + 0.12 * Math.max(0, Math.sin(G.t * Math.PI / DRUM.beat)));
      ctx.restore();
      if (Math.random() < 0.03) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-5, 5), y: e.y - rand(6, 20), vy: -rand(18, 34), col: '255,140,70', s0: 1.4, s1: 0.3, life: 0.6, a: 0.9 });
    }
    const top = e.y - fly - (CHAR_H[name] || 20) - 6;
    const fr = e.hp / e.maxHp;
    if (d.rank === 2) drawRankStar(e.x, top - 1);
    // durum işaretleri: lanet (mor halka, ayakta), ruh çivisi (başın üstünde kara çivi), kara veba (yeşil kabarcık)
    if (e.curseT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(190,100,255,${0.5 + Math.sin(time * 6 + e.off) * 0.15})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, d.r * 1.1, d.r * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); glow(ctx, e.x, e.y - dh * 0.4, dh * 0.5, '170,80,255', 0.12); ctx.restore(); }
    if (e.nailT > 0) { ctx.save(); ctx.translate(e.x + 6, top - 4); ctx.rotate(0.3); ctx.fillStyle = '#1a1020'; ctx.strokeStyle = '#9dff8a'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-2.4, -5); ctx.lineTo(2.4, -5); ctx.lineTo(0.6, 4); ctx.lineTo(-0.6, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (e.plagueT > 0 && Math.random() < 0.15) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: e.y - rand(4, dh * 0.8), vy: -rand(8, 20), col: '110,220,60', s0: 2.5, s1: 0.4, life: 0.6 });
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
}

// Kemik Duvarı çizimi: yola dik dizilmiş kemik kazıklar, aralarında kaburgalar, tepelerde kafatası; yerden yükselir, hasar aldıkça çatlar
// Kemik Duvarı: önce yol toprağı yarılır (çatlaklardan yeşil ışık sızar), sonra kaburga, diş ve uyluk kemikleri ortadan dışa doğru
// sırayla topraktan fışkırır (her biri çıkarken toprak parçaları saçar), ortada yeşil gözlü büyük kafatası; süre bitince toprağa geri gömülür.
// 10 Eki: Caner daha sık ve ince kemik istedi: 13 kalın sütun yerine 3 sıra halinde 27 ince kemik
const BWALL = { imgW: 89, imgSY: 0.75, imgBase: 15, sideW: 0.55, // sideW: yandan görünüşün genişliği (önden görünüşe oranla, dar ve uzun) // 10 Eki: %20 geniş (74 -> 89), boy %10 kısa (0.9 / 1.2 = 0.75)
  span: 66, cols: 27, rows: [-5, 0, 5], crackT: 0.12, rise: 0.24, stagger: 0.016, sink: 0.45 };
function boneWallGeom(s) {
  if (s.geo) return s.geo;
  const r = seeded(Math.floor(s.seed * 9973) + 7), cr = [];
  for (let k = 0; k < 7; k++) { // çatlaklar: duvar çizgisinden iki yana zikzak
    const u = (r() - 0.5) * BWALL.span * 0.9, side = k % 2 ? 1 : -1, pts = [[u, 0]];
    let x = u, y = 0; for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 9; y += side * (4 + r() * 6); pts.push([x, y]); }
    cr.push(pts);
  }
  const cols = [];
  for (let i = 0; i < BWALL.cols; i++) {
    const kind = i === (BWALL.cols >> 1) ? 'skull' : (i % 5 === 2 ? 'femur' : 'rib');
    cols.push({ kind, h: 20 + r() * 14 - Math.abs(i - (BWALL.cols - 1) / 2) * 0.6, lean: (r() - 0.5) * 0.4 + (i < BWALL.cols / 2 ? -0.08 : 0.08), bend: (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.25),
      w: kind === 'femur' ? 3 + r() * 0.8 : 2.1 + r() * 1, row: BWALL.rows[i % 3] + (r() - 0.5) * 2 });
  }
  return (s.geo = { cr, cols });
}
// Leonidas'ın falanksı: yola dik sıralı üç kalkanlı iskelet hoplit; topraktan yükselir, süre bitince gömülür
function drawPhalanx(s) {
  const age = G.t - s.born, nx = -s.dy, ny = s.dx, k = clamp(age / 0.35, 0, 1), sink = s.life < 0.4 ? 1 - Math.max(0, s.life) / 0.4 : 0;
  const im = spr('unit_skel_2') || spr('unit_skel_1'); if (!im) return;
  const h = 30 * UNIT_K * 1.35 * easeOutBack(k) * (1 - sink), face = -Math.sign(s.dx || 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 8, 40, '200,150,255', 0.2 * (1 - sink)); ctx.restore();
  const pts = [-1, 0, 1].map(i => ({ x: s.x + nx * i * 17 * ROAD_K * 0.6, y: s.y + ny * i * 17 * ROAD_K * 0.6 })).sort((a, b) => a.y - b.y);
  for (const p of pts) {
    shadow(p.x, p.y + 2, 9, 3.5);
    if (h > 1) drawUnit('unit_skel_2', im, p.x, p.y, face, { h, rig: 'unit_skel_2', phase: 0, walking: false, fly: 0, flash: s.flash, seed: p.x });
    // bronz kalkan önde (Sparta lambdası)
    const sx = p.x + face * 6, sy = p.y - h * 0.38, R = h * 0.22; // kalkan önde, iskeleti örtmeyecek kadar
    if (h > 4) { circle(sx, sy, R, '#b0863a', '#3a2408', 1.2); circle(sx, sy, R * 0.72, null, 'rgba(255,230,160,0.5)', 0.8);
      ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx - R * 0.35, sy + R * 0.4); ctx.lineTo(sx, sy - R * 0.45); ctx.lineTo(sx + R * 0.35, sy + R * 0.4); ctx.stroke(); }
  }
  if (s.hp < s.maxHp && !sink) hpBar(s.x, s.y - 42, 26, s.hp / s.maxHp, '#d8b0ff');
}
function drawBoneWall(s) {
  if (s.phalanx) { drawPhalanx(s); return; }
  const age = G.t - s.born, dmg = 1 - s.hp / s.maxHp, G0 = boneWallGeom(s);
  const nx = -s.dy, ny = s.dx; // yola dik yön: duvar yolun bir kenarından öbürüne uzanır
  const sink = s.life < BWALL.sink ? 1 - Math.max(0, s.life) / BWALL.sink : 0; // süre bitince gömülür
  const P = (u, v = 0) => [s.x + nx * u + s.dx * v, s.y + ny * u + s.dy * v];
  ctx.save();
  // yarılan toprak: koyu çatlaklar, içinden yeşil ışık
  const ck = clamp(age / BWALL.crackT, 0, 1) * (1 - sink);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!spr('nm_bwall_1')) for (const pts of G0.cr) { // çizimli duvarda çatlak çizgileri yok (görselin kendi yeşil ışığı var)
    const n = Math.max(2, Math.ceil(pts.length * ck));
    ctx.beginPath(); pts.slice(0, n).forEach(([u, v], j) => { const [x, y] = P(u, v); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = 'rgba(20,12,6,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(110,255,130,${(0.35 + 0.25 * Math.sin(time * 6 + s.seed)) * ck})`; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 4, 38, '110,255,130', 0.22 * ck + (s.flash > 0 ? s.flash * 3 : 0)); ctx.restore();
  // Gemini çizimi (nm_bwall_*): duvar ekranda yataysa önden (yarı canın altında hasarlı), değilse çapraz görünüş (yönüne göre aynalı);
  // topraktan yükselir (zemin çizgisinin altı kırpılır), süre bitince geri gömülür
  // görünüş: duvar ekranda yataysa önden, dikine ise yandan (nm_bwall_4/5, varsa), arası çapraz; yarı canın altında hasarlı
  const front = Math.abs(ny) < 0.55, side = !front && Math.abs(ny) > 0.88 && spr('nm_bwall_4');
  const bwIm = spr(front ? (dmg > 0.5 && spr('nm_bwall_2') ? 'nm_bwall_2' : 'nm_bwall_1') : side ? (dmg > 0.5 && spr('nm_bwall_5') ? 'nm_bwall_5' : 'nm_bwall_4') : 'nm_bwall_3');
  if (bwIm) {
    const sy = side ? 1 : BWALL.imgSY, w = BWALL.imgW * (front ? 1 : side ? BWALL.sideW : 0.9), h = w * bwIm.height / bwIm.width * sy;
    const gy = side ? s.y + h * 0.42 : s.y + BWALL.imgBase; // yandan görünüş yolun ortasına oturur (uzunluğu yolun enini kapatır)
    const k = clamp((age - BWALL.crackT * 0.6) / BWALL.rise, 0, 1), rise = easeOutBack(k) * (1 - sink);
    if (k > 0 && !s.burst) {
      s.burst = true;
      for (let j = 0; j < 14; j++) { const [x, y] = P((j / 13 - 0.5) * BWALL.span); emit(G.parts, { kind: 'chunk', x: x + rand(-3, 3), y, vx: rand(-45, 45), vy: -rand(70, 170), g: 480, vr: rand(-10, 10), rot: rand(0, 6), col: j % 2 ? '#5a4430' : '#3a2a1a', s0: rand(1.4, 2.6), s1: 1, life: rand(0.4, 0.8) }); }
    }
    shadow(s.x, s.y + 3, w * 0.5, w * 0.16);
    if (rise > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(s.x - w, gy - h * 1.6, w * 2, h * 1.6); ctx.clip();
      ctx.translate(s.x + (s.flash > 0 ? rand(-1.2, 1.2) : 0), gy + (1 - rise) * h * 0.9);
      ctx.scale(!front && !side && nx * ny > 0 ? -1 : 1, sy);
      drawSprite(ctx, bwIm, 0, 0, w);
      if (s.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(0.5, s.flash * 3); drawSprite(ctx, bwIm, 0, 0, w); }
      ctx.restore();
    }
    ctx.restore();
    if (s.hp < s.maxHp && !sink) hpBar(s.x, gy - h * rise - 4, 22, s.hp / s.maxHp, '#e8dcb8');
    return;
  }
  // toprak yığını: duvar çizgisi boyunca kabarmış topaklar
  shadow(s.x, s.y + 3, 18 + Math.abs(nx) * BWALL.span * 0.5, 8 + Math.abs(ny) * BWALL.span * 0.5);
  for (let i = 0; i < 12; i++) { const [x, y] = P((i / 11 - 0.5) * BWALL.span * 1.08, (i % 2 ? 6 : -6)); circle(x, y + 1, (3.4 + (i % 3)) * ck, '#4a3624', '#22160c', 1); }
  // kemikler: ortadan dışa sırayla fışkırır
  const mid = (BWALL.cols - 1) / 2;
  s.popped = s.popped || [];
  const order = G0.cols.map((c, i) => [i, P((i / (BWALL.cols - 1) - 0.5) * BWALL.span, c.row)[1]]).sort((a, b) => a[1] - b[1]).map(o => o[0]); // arkadaki önce
  order.forEach((i) => {
    const c = G0.cols[i];
    const t0 = BWALL.crackT * 0.6 + Math.abs(i - mid) * BWALL.stagger, k = clamp((age - t0) / BWALL.rise, 0, 1);
    if (k > 0 && !s.popped[i]) { // çıkış anı: toprak ve kemik parçaları
      s.popped[i] = true; const [x, y] = P((i / (BWALL.cols - 1) - 0.5) * BWALL.span);
      for (let j = 0; j < 2; j++) emit(G.parts, { kind: 'chunk', x: x + rand(-3, 3), y, vx: rand(-45, 45), vy: -rand(70, 160), g: 480, vr: rand(-10, 10), rot: rand(0, 6), col: j % 2 ? '#5a4430' : '#3a2a1a', s0: rand(1.4, 2.4), s1: 1, life: rand(0.4, 0.7) });
    }
    if (k <= 0) return;
    const rise = easeOutBack(k) * (1 - sink), [x, y] = P((i / (BWALL.cols - 1) - 0.5) * BWALL.span, c.row); // üç sıra: duvar sık ve kalın görünsün
    const hh = c.h * rise * (1 - dmg * 0.3 * (i % 3) / 2), shake = s.flash > 0 ? rand(-0.06, 0.06) : 0;
    // uçlar düşmanın geldiği yöne eğik (dikenli barikat); yol dikeyse yalnız hafif yalpa
    const toward = -Math.sign(s.dx) * Math.min(1, Math.abs(s.dx)) * (0.14 + 0.12 * ((i * 5) % 3) / 2) * (c.kind === 'skull' ? 0.2 : 1); // ince kemikler: hafif eğik, sık çit gibi
    ctx.save(); ctx.translate(x, y); ctx.rotate(c.lean * 0.6 + toward + shake);
    if (c.kind === 'skull') {
      roundRect(-3, -hh * 0.8, 6, hh * 0.8, 2.5, '#e9dfc4', '#22160c', 1.2); // omurga gövdesi
      for (let v = 0.2; v < 0.8; v += 0.18) { ctx.strokeStyle = '#22160c'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-3, -hh * v); ctx.lineTo(3, -hh * v); ctx.stroke(); }
      ctx.restore();
      drawSkullIcon(x, y - hh * 0.8 - 6, 8 * Math.min(1, rise));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - hh * 0.8 - 7, 14, '120,255,140', 0.35 + 0.2 * Math.sin(time * 5)); ctx.restore();
      return;
    }
    if (c.kind === 'femur') {
      roundRect(-c.w / 2, -hh, c.w, hh, c.w / 2, '#efe6cc', '#22160c', 0.8);
      circle(-c.w * 0.4, -hh, c.w * 0.55, '#efe6cc', '#22160c', 0.8); circle(c.w * 0.4, -hh, c.w * 0.55, '#efe6cc', '#22160c', 0.8);
    } else { // kaburga / diş: kıvrık, ucu sivri
      const tipX = c.bend * hh * 0.45;
      ctx.beginPath(); ctx.moveTo(-c.w / 2, 0); ctx.quadraticCurveTo(-c.w / 2 + tipX * 0.2, -hh * 0.6, tipX, -hh);
      ctx.quadraticCurveTo(c.w / 2 + tipX * 0.3, -hh * 0.55, c.w / 2, 0); ctx.closePath();
      const gr = ctx.createLinearGradient(0, 0, 0, -hh); gr.addColorStop(0, '#b8ab88'); gr.addColorStop(0.5, '#efe6cc'); gr.addColorStop(1, '#fff8e6');
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = '#22160c'; ctx.lineWidth = 0.8; ctx.stroke(); // ince kemik: kontur da ince
    }
    if (dmg > 0.4 && i % 2) { ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-1.5, -hh * 0.6); ctx.lineTo(1.2, -hh * 0.45); ctx.lineTo(-0.8, -hh * 0.3); ctx.stroke(); }
    ctx.restore();
  });
  // tabanda topraktan yarı çıkmış kafatasları (önde)
  const sk = clamp((age - BWALL.crackT - 0.25) / 0.25, 0, 1) * (1 - sink);
  if (sk > 0) for (let j = 0; j < 4; j++) { const [x, y] = P(((j + 0.5) / 4 - 0.5) * BWALL.span * 0.85, 7); drawSkullIcon(x, y - 2 * sk, 4.6 * sk); }
  ctx.restore();
  if (s.hp < s.maxHp && !sink) hpBar(s.x, s.y - 46, 22, s.hp / s.maxHp, '#e8dcb8');
}
function drawSoldier(s) {
  if (s.wall) { drawBoneWall(s); return; }
  if (s.dead) {
    if (s.hero) {
      ctx.globalAlpha = 0.5; circle(s.x, s.y - 4, 7, '#888'); ctx.globalAlpha = 1;
      txt(Math.ceil(s.respawnT) + '', s.x, s.y - 20, 12, '#fff');
    }
    return;
  }
  const bob = Math.abs(Math.sin(s.anim * 9)) * 1.5;
  const fighting = (s.target && dist(s.x, s.y, s.target.x, s.target.y) < 21) || s.shootT > 0;
  const r = s.hero ? 8 : 5.5;
  const name = s.hero ? s.def.sprite : s.merc ? 'soldier' : s.militia ? 'militia' : 'soldier';
  // iri birimler kendi görselleriyle (çürük tonu yok)
  if (NECRO && s.big && spr(s.big)) {
    if (s.born != null && G.t < s.born) return;
    const lunge = s.bigAtk && fighting && s.atk < s.rate * 0.45 && spr(s.bigAtk); // vuruş anında saldırı pozu
    const im = lunge || spr(s.big), walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05; s.px = s.x; s.py = s.y;
    const ch = s.bh, rise = s.born != null && G.t - s.born < 0.7 ? 0.1 + 0.9 * easeOutBack(clamp((G.t - s.born) / 0.7, 0, 1)) : null;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - ch * 0.4, ch * 0.55, s.golem ? '150,255,110' : '170,120,255', 0.2); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 1, ch * 0.32, ch * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    // Wan şeritleri geldiyse onlar oynar (saldırı: vuruş döngüsüne bağlı kare, yürüyüş: 16 fps); yoksa çizimden hareket
    const sk = rise == null && ((fighting && animStrip(s.big, null, '_atk')) || (walking && animStrip(s.big, null, '_walk')));
    if (sk) {
      const F = ANIM_META[sk], i = sk.endsWith('_atk') ? Math.floor(clamp(1 - s.atk / s.rate, 0, 0.999) * F.n) : Math.floor(s.anim * 16) % F.n;
      ctx.save(); ctx.translate(s.x, s.y + 1); ctx.scale(s.face || 1, 1); drawFrame(spr(sk), F, i, ch); ctx.restore();
    } else drawUnit(lunge ? s.bigAtk : s.big, im, s.x, s.y, s.face || 1, { h: ch, rig: s.big, phase: s.anim * 5, walking, fly: 0, rise,
      atk: fighting ? atkPhase(s.rate, s.atk) : null, atkVar: s.atkV, flash: s.flash, seed: 0.7 });
    if (s.golem && s.life < 4) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 10); glow(ctx, s.x, s.y - ch * 0.5, ch * 0.5, '150,255,110', 0.3); ctx.restore(); } // dağılmak üzere
    if (s.hp < s.maxHp) hpBar(s.x, s.y - ch - 6, 22, s.hp / s.maxHp, s.golem ? '#9dff6a' : '#d8c8a8');
    return;
  }
  // Necromancer: mahzen askerleri, paralı askerler ve çağrılanlar iskelet (seviye ve uzmanlığa göre 5 görsel)
  if (NECRO && s.zname) {
    const base = spr(s.zname) || enemySprite(s.zname.slice(6));
    if (base) {
      const key = s.zname + '_rot', im = rottenOf(s.zname, base);
      if (ARMS[s.zname] && !ARMS[key]) ARMS[key] = ARMS[s.zname];
      const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
      s.px = s.x; s.py = s.y;
      const ch = s.zh || 30 * UNIT_K;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 2, 14, '110,255,140', 0.25); ctx.restore();
      if (s.born != null && G.t < s.born) return;
      const up = s.born != null && G.t - s.born < DIE_T ? animStrip(key, s.zrig || s.zname, '_die') : null;
      if (up) { // yerden kalkış: ölüm kareleri tersten
        const F = ANIM_META[up], i = Math.max(0, F.n - 1 - Math.floor((G.t - s.born) / DIE_T * F.n));
        const rg = RIG[s.zrig || s.zname] || {};
        ctx.save(); ctx.translate(s.x, s.y + 1); ctx.scale((s.face || 1) * (rg.flip ? -1 : 1), 1); drawFrame(spr(up), F, i, ch); ctx.restore();
        return;
      }
      const rise = s.born != null && G.t - s.born < 0.6 ? 0.1 + 0.9 * easeOutBack(clamp((G.t - s.born) / 0.6, 0, 1)) : null;
      drawUnit(key, im, s.x, s.y, s.face || 1, { h: ch, rig: s.zrig || s.zname, phase: s.anim * 7, walking, fly: 0, rise,
        atk: fighting ? atkPhase(s.rate, s.atk) : null, atkVar: s.atkV, flash: s.flash, seed: (s.slot || 0) * 1.7 });
      // başının üstünde soluk yeşil ruh alevi: bizim tarafta olduğu belli olsun
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - ch - 3, 5 + Math.sin(time * 6 + s.slot) * 1, '120,255,140', 0.55); ctx.restore();
      if (s.hp < s.maxHp) hpBar(s.x, s.y - ch - 8, 12, s.hp / s.maxHp, '#7ad36a');
      return;
    }
  }
  if (NECRO && !s.hero && spr('unit_skel_1')) {
    const sp2 = s.tower && s.tower.spec;
    // okçu yolu: kademe (1-3) arttıkça zırhı güçlenen 3 okçu görseli (unit_skel_6..8)
    let look = s.merc || s.militia ? 1 : sp2 === 'shield' ? 4 : sp2 === 'blade' ? 5 : sp2 === 'bow' ? 5 + Math.max(1, (s.tower.ab && s.tower.ab.bow) || 1) : Math.min(3, (s.gear || 0) + 1);
    if (look >= 6 && !spr('unit_skel_' + look)) look = spr('unit_skel_6') ? 6 : 2; // okçu görseli gelene kadar
    const key = 'unit_skel_' + look, im = spr(key) || spr('unit_skel_1');
    s.skelKey = spr(key) ? key : 'unit_skel_1'; // ölünce kemik yığını bu görselden kesilir
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    const spR = sp2 && sp2 !== 'bow' && s.tower.ab ? s.tower.ab[sp2] || 0 : 0; // kalkan/kılıç kademesi
    const ch = SKEL_H[look] * UNIT_K * (1 + 0.05 * Math.max(0, spR - 1));
    if (spR >= 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - ch * 0.55, ch * (0.55 + 0.1 * spR), sp2 === 'shield' ? '120,200,255' : '120,255,120', 0.12 + 0.06 * spR + Math.sin(time * 4 + s.slot) * 0.04); ctx.restore(); }
    // ayağın altında hafif yeşil ruh ışığı: koyu zeminde iskelet seçilsin
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 2, 13, '110,255,140', 0.22); ctx.restore();
    if (s.born != null && G.t < s.born) return; // sırası gelmemiş minyon henüz yerde
    const rise = !s.door && s.born != null && G.t - s.born < 0.6 ? 0.1 + 0.9 * easeOutBack(clamp((G.t - s.born) / 0.6, 0, 1)) : null;
    const fade = s.door && s.born != null ? clamp((G.t - s.born) / 0.55, 0, 1) : 1; // mahzen kapısının karanlığından belirir
    if (fade < 1) { ctx.save(); ctx.globalAlpha *= fade; }
    drawUnit(key, im, s.x, s.y, s.face || 1, { h: ch, rig: key, phase: s.anim * 9, walking: walking || !!s.exit, fly: 0, rise,
      atk: fighting ? atkPhase(s.rate, s.atk) : null, atkVar: s.atkV, flash: s.flash, seed: (s.slot || 0) * 1.7, buff: s.buffT });
    if (fade < 1) ctx.restore();
    if (s.bow && s.melee && !s.melee.dead && dist(s.x, s.y, s.melee.x, s.melee.y) < 24) {
      // yakın dövüşte elindeki kemik hançer: vuruşta öne savrulur
      const sw = s.shootT > 0 ? Math.sin(clamp(1 - s.shootT / 0.25, 0, 1) * Math.PI) : 0;
      ctx.save(); ctx.translate(s.x + (s.face || 1) * (6 + sw * 4), s.y - ch * 0.48); ctx.scale(s.face || 1, 1); ctx.rotate(-0.9 + sw * 1.5);
      roundRect(-1.2, -1, 2.4, 5, 1, '#4a3020', '#140a06', 0.8);
      ctx.beginPath(); ctx.moveTo(-1.6, -1); ctx.lineTo(0, -10); ctx.lineTo(1.6, -1); ctx.closePath();
      ctx.fillStyle = '#f2ead2'; ctx.fill(); ctx.strokeStyle = '#140a06'; ctx.lineWidth = 0.8; ctx.stroke();
      roundRect(-3, -1.6, 6, 1.6, 0.8, '#cbbf9c', '#140a06', 0.6);
      ctx.restore();
    }
    if (allyK(s) > 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 1, 12, '170,110,255', 0.22 + Math.sin(time * 3 + (s.slot || 0)) * 0.05); ctx.restore(); } // lanet aurasında: ayağında mor ışık
    if (s.tower && s.tower.imbue && IMBUE[s.tower.imbue]) { // silah büyüsü: kılıcın (ya da yayın) çevresinde renkli parıltı, ara ara kıvılcım
      const I = IMBUE[s.tower.imbue], wx = s.x + (s.face || 1) * ch * 0.28, wy = s.y - ch * 0.55, sw = fighting ? 1.3 : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, wx, wy, 7 * sw, I.col, 0.55 + Math.sin(time * 6 + (s.slot || 0)) * 0.12); ctx.restore();
      if (Math.random() < 0.06 * sw) emit(G.parts, { kind: 'glow', add: true, x: wx + rand(-3, 3), y: wy + rand(-4, 4), vy: s.tower.imbue === 'fire' ? -rand(15, 30) : -rand(4, 12), col: I.col, s0: 2.2, s1: 0.4, life: 0.4 });
    }
    if (s.hp < s.maxHp) hpBar(s.x, s.y - ch - 6, 11, s.hp / s.maxHp, HP_SOLDIER);
    return;
  }
  // kışla askeri (ve paralı asker): seviyeye göre zırh/silah değişen çizim
  if (name === 'soldier') {
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    const ab = s.tower && s.tower.ab;
    const look = s.merc ? 'merc' : s.tower && s.tower.spec === 'shield' ? 'guard' : s.tower && s.tower.spec === 'blade' ? 'berserk' : s.gear || 0;
    paintSoldier(ctx, { x: s.x, y: s.y }, 0.72 * UNIT_K, s.face || 1, look, walking ? s.anim : 0, fighting ? atkPhase(s.rate, s.atk) : null, (s.slot || 0) * 1.7,
      ab ? { blade: !!ab.blade, wall: !!ab.shield } : null);
    if (s.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - 12, 14, '255,255,255', s.flash * 6); ctx.restore(); }
    if (s.hp < s.maxHp) hpBar(s.x, s.y - CHAR_H.soldier - 6, 11, s.hp / s.maxHp, HP_SOLDIER);
    return;
  }
  let im = s.hero ? heroSprite(s.def) : spr(name), key = name, pad = 0, glowIm = null;
  if (name === 'soldier') { const gs = gearSprite(s.gear || 0); if (gs) { im = gs.im; key = gs.key; pad = gs.pad; glowIm = gs.glow; } }
  if (im) {
    const walking = s.px !== undefined && dist(s.x, s.y, s.px, s.py) > 0.05;
    s.px = s.x; s.py = s.y;
    const ch = s.hero ? s.def.h * UNIT_K : CHAR_H[name];
    // komutan: Wan şeritleri geldiyse onlar oynar (saldırı kareleri vuruş döngüsüne bağlı)
    const ult = s.hero && s.ultT > 0 && animStrip(name, null, '_skill');
    const hsk = ult || (s.hero && !(s.castT > 0) && (((fighting || s.shooting) && animStrip(name, null, '_atk')) || (walking && animStrip(name, null, '_walk'))));
    if (hsk) {
      const F = ANIM_META[hsk], i = ult ? Math.floor(clamp(1 - s.ultT / ULT_ANIM, 0, 0.999) * F.n) : hsk.endsWith('_atk') ? Math.floor(clamp(1 - s.atk / s.rate, 0, 0.999) * F.n) : Math.floor(s.anim * 16) % F.n;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s.x, s.y - ch * 0.4, ch * 0.7, s.def.aura, 0.18); ctx.restore();
      ctx.save(); ctx.translate(s.x, s.y + 1); ctx.scale(s.face || 1, 1); drawFrame(spr(hsk), F, i, ch); ctx.restore();
      hpBar(s.x, s.y - ch - 7, 18, s.hp / s.maxHp, HP_HERO);
      return;
    }
    drawUnit(key, im, s.x, s.y, s.face, {
      h: ch, rig: name, pad, glow: glowIm, phase: s.anim * 9, walking, fly: 0,
      atk: fighting || s.shooting ? atkPhase(s.rate, s.atk) : null, flash: s.flash, seed: (s.slot || 0) * 1.7,
      buff: s.buffT, spin: s.spinT, cast: s.castT, aura: s.hero ? s.def.aura : null,
    });
    if (s.hero) {
      hpBar(s.x, s.y - ch - 7, 18, s.hp / s.maxHp, HP_HERO);
      return;
    }
    if (s.hp < s.maxHp || s.hero) hpBar(s.x, s.y - CHAR_H[s.hero ? 'hero' : s.militia ? 'militia' : 'soldier'] - 6, s.hero ? 18 : 11, s.hp / s.maxHp, s.hero ? HP_HERO : HP_SOLDIER);
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
  if (s.hp < s.maxHp || s.hero) hpBar(s.x, s.y - (s.hero ? 34 : 22), s.hero ? 22 : 14, s.hp / s.maxHp, s.hero ? HP_HERO : HP_SOLDIER);
}

// Karakter çizimi + prosedürel animasyon:
// yürürken adım zıplaması ve sallanma, saldırıda öne atılma, dururken nefes, isabette beyaz parlama.
// Saldırı zamanlaması: negatif = vuruşa kalan süre (hazırlık), pozitif = vuruştan beri geçen süre
const ATK_PREP = 0.3, ATK_AFTER = 0.45; // hazırlık süresi / vuruştan sonra toparlanmanın bittiği an
// 8 karelik çizilmiş saldırı: karelerin başladığı an (0 = darbe). 0 hazır, 1 geri çek, 2 kaldır, 3 savuruş başı, 4 iniş, 5 darbe, 6 devam, 7 toparlan
const ATK_FRAME_T = [-0.3, -0.22, -0.15, -0.08, -0.03, 0, 0.12, 0.28];
function atkPhase(rate, atk) {
  const since = rate - atk;
  return since < ATK_AFTER ? since : -atk;
}
const easeOutQ = (x) => 1 - (1 - x) * (1 - x);

// ----- anahtar pozlar -----
// Animasyonlar her ekran karesinde hesaplanır. Her hareket 12 anahtar pozla tanımlanır; aradaki kareler
// yumuşak (Hermite) eğriyle doldurulur. Pozda yazılmayan alan bir önceki pozdan aynen taşınır.
// '!' işaretli pozda hareket keskin yön değiştirir (darbe, yere basma), '=' işaretli pozda bir an asılı kalır (gerilim).
function track(keys, loop) {
  const n = keys.length, ts = keys.map(k => k[0]), per = ts[n - 1] - ts[0], names = new Set(), F = {};
  keys.forEach(k => Object.keys(k[1]).forEach(f => names.add(f)));
  for (const f of names) {
    let last = f === 'sx' || f === 'sy' ? 1 : 0;
    const v = keys.map(k => (last = k[1][f] ?? last)), mi = [], mo = [];
    for (let i = 0; i < n; i++) {
      // komşu pozlar; döngüde ilk ve son poz aynıdır, komşu öbür uçtan alınır
      const hasP = i > 0 || loop, hasN = i < n - 1 || loop;
      const pv = i > 0 ? v[i - 1] : v[n - 2], pt = i > 0 ? ts[i - 1] : ts[n - 2] - per;
      const nv = i < n - 1 ? v[i + 1] : v[1], nt = i < n - 1 ? ts[i + 1] : ts[1] + per;
      const sIn = hasP ? (v[i] - pv) / (ts[i] - pt) : 0, sOut = hasN ? (nv - v[i]) / (nt - ts[i]) : 0, fl = keys[i][2];
      if (fl === '=' || !hasP || !hasN) { mi[i] = mo[i] = 0; }
      else if (fl === '!') { mi[i] = sIn; mo[i] = sOut; }
      else if (sIn * sOut <= 0) { mi[i] = mo[i] = 0; } // tepe noktası: taşma olmadan döner
      else {
        const a = ts[i] - pt, b = nt - ts[i];
        let m = (sIn * b + sOut * a) / (a + b);
        const cap = 3 * Math.min(Math.abs(sIn), Math.abs(sOut));
        if (Math.abs(m) > cap) m = Math.sign(m) * cap;
        mi[i] = mo[i] = m;
      }
    }
    F[f] = { v, mi, mo };
  }
  return { ts, F, loop, per };
}
function pose(tr, t, out = {}) {
  const ts = tr.ts, n = ts.length;
  if (tr.loop) t = ts[0] + (((t - ts[0]) % tr.per) + tr.per) % tr.per;
  t = clamp(t, ts[0], ts[n - 1]);
  let i = 0;
  while (i < n - 2 && t > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i], s = h > 0 ? (t - ts[i]) / h : 0, s2 = s * s, s3 = s2 * s;
  const a0 = 2 * s3 - 3 * s2 + 1, b0 = (s3 - 2 * s2 + s) * h, a1 = 3 * s2 - 2 * s3, b1 = (s3 - s2) * h;
  for (const f in tr.F) { const c = tr.F[f]; out[f] = a0 * c.v[i] + b0 * c.mo[i] + a1 * c.v[i + 1] + b1 * c.mi[i + 1]; }
  return out;
}
const TAU = Math.PI * 2;

// Yakın dövüş saldırısı (zaman: vuruşa kalan / vuruştan geçen saniye). ox: birim boyu/24, dy: boy oranı.
// rot: gövde eğimi, sf/sb: ön/arka ayak adımı, lf: ön ayağın kalkması, ghost: hız izi, glow: silah parıltısı
const ATK_POSE = track([
  [-0.30, { rot: 0, sx: 1, sy: 1, dy: 0, ox: 0, sf: 0, sb: 0, lf: 0, ghost: 0, glow: 0, arm: 0, bend: 0 }],
  [-0.25, { rot: -0.04, sy: 1.015, ox: -0.4, arm: 0.12, bend: 0.01 }],                                   // 1 ağırlık bir an geriye, kol iner
  [-0.19, { rot: 0.09, sx: 1.05, sy: 0.93, dy: 0.026, ox: 0.7, arm: 0.22, bend: 0.03 }],                 // 2 sezdirme: çömelip öne eğilir
  [-0.12, { rot: -0.18, sx: 1, sy: 1, dy: 0.008, ox: -1, sb: -0.03, arm: -0.45, bend: -0.01 }],          // 3 silah geriye kalkmaya başlar
  [-0.05, { rot: -0.44, sx: 0.96, sy: 1.07, dy: -0.01, ox: -2.7, sf: 0.03, sb: -0.07, lf: 0.025, arm: -1.15, bend: -0.05 }], // 4 kurulma
  [-0.012, { rot: -0.49, sx: 0.955, sy: 1.08, ox: -3, arm: -1.28, bend: -0.06 }, '='],                   // 5 gerilim: tepe noktada asılı
  [0.025, { rot: 0.12, sx: 1.03, sy: 1, dy: 0, ox: 3, sf: 0.09, sb: -0.08, lf: 0.01, ghost: 1, glow: 0.6, arm: -0.25, bend: -0.03 }], // 6 savuruş (baş geriden gelir)
  [0.06, { rot: 0.6, sx: 1.1, sy: 0.92, dy: 0.022, ox: 7.6, sf: 0.125, lf: 0, glow: 1, arm: 0.62, bend: 0.06 }, '!'],                // 7 darbe
  [0.1, { rot: 0.5, sx: 1.03, sy: 0.99, dy: 0.008, ox: 7.1, ghost: 0.35, arm: 0.48, bend: 0.03 }],       // 8 sekme: darbenin tepkisi
  [0.17, { rot: 0.68, sx: 1, sy: 1.02, dy: 0, ox: 8.4, ghost: 0, glow: 0.75, arm: 0.7, bend: 0.05 }],    // 9 devam: savuruşun ağırlığı
  [0.3, { rot: 0.24, sy: 1.035, ox: 3.6, sf: 0.05, sb: -0.035, glow: 0.3, arm: 0.22, bend: 0.01 }],      // 10 toparlanma, küçük zıplama
  [0.45, { rot: 0, sx: 1, sy: 1, ox: 0, sf: 0, sb: 0, glow: 0, arm: 0, bend: 0 }],                       // 11 duruş
]);
// Yürüyüşte tek bacak (tam döngü; öbür bacak yarım döngü geriden gelir). x: adım (-1 geride, 1 önde), l: kalkma.
// Yerdeyken sabit hızla geriye kayar (döngünün %58'i), havadayken hızla öne savrulur ve diz yukarı kalkar.
const GAIT_LEG = track([
  [0, { x: 1, l: 0 }], [0.1, { x: 0.68 }], [0.2, { x: 0.35 }], [0.3, { x: 0.02 }], [0.4, { x: -0.32 }], [0.5, { x: -0.65 }],
  [0.58, { x: -0.92, l: 0.12 }], [0.66, { x: -0.78, l: 0.7 }], [0.75, { x: -0.2, l: 1 }], [0.83, { x: 0.42, l: 0.82 }],
  [0.92, { x: 0.9, l: 0.3 }], [1, { x: 1, l: 0 }],
], true);
// Gövde her adımda: değme → çöküş → itiş → geçiş → tepe → iniş (döngü başına 2 adım = 12 poz)
const GAIT_BODY = track([
  [0, { dy: 0.004, sy: 0.985, sx: 1.012, rot: 0.04, bend: 0.008 }],
  [0.17, { dy: 0.022, sy: 0.968, sx: 1.022, rot: 0.06, bend: 0.018 }],
  [0.33, { dy: 0.004, sy: 0.998, sx: 1, rot: 0.065, bend: 0.006 }],
  [0.5, { dy: -0.022, sy: 1.024, sx: 0.992, rot: 0.055, bend: -0.008 }],
  [0.67, { dy: -0.034, sy: 1.03, sx: 0.99, rot: 0.04, bend: -0.012 }],
  [0.83, { dy: -0.016, sy: 1.008, sx: 1, rot: 0.03, bend: -0.002 }],
  [1, { dy: 0.004, sy: 0.985, sx: 1.012, rot: 0.04, bend: 0.008 }],
], true);
// Kanat çırpma: aşağı vuruş hızlı (gövdeyi kaldırır), yukarı kalkış yavaş. f: 1 aşağı, -1 yukarı
const FLAP = track([
  [0, { f: -1 }], [0.06, { f: -0.85 }], [0.13, { f: -0.35 }], [0.2, { f: 0.35 }], [0.27, { f: 0.85 }], [0.34, { f: 1.05 }, '='],
  [0.42, { f: 0.9 }], [0.52, { f: 0.45 }], [0.62, { f: -0.05 }], [0.74, { f: -0.55 }], [0.87, { f: -0.92 }], [1, { f: -1 }],
], true);
// Ölüm (saniye). rot: gövde, R: bütün beden devrilmesi, bd: gövdenin çökmesi (bacak boyu oranı), oy: zıplama (boy oranı)
const DEATH_POSE = track([
  [0, { rot: 0, sf: 0, sb: 0, bd: 0, sx: 1, sy: 1, R: 0, oy: 0, arm: 0, bend: 0 }],
  [0.035, { rot: -0.24, sx: 0.96, sy: 1.05, oy: -0.045, arm: -0.7, bend: -0.06 }],                  // 1 darbe: geriye savrulur, kol fırlar
  [0.075, { rot: -0.33, sx: 0.98, sy: 1.03, oy: -0.06, arm: -0.9, bend: -0.07 }],                   // 2 havada
  [0.125, { rot: -0.22, sx: 1.02, sy: 0.98, oy: 0, sf: -0.03, sb: -0.07, arm: -0.5, bend: -0.02 }, '!'], // 3 geri adımla yere basar
  [0.18, { rot: -0.36, sx: 1, sy: 1, sf: -0.045, arm: -0.3, bend: -0.04 }],                         // 4 sendeleme
  [0.24, { rot: -0.4, bd: 0.22, sy: 0.97, sx: 1.02, sf: 0, arm: 0.2, bend: 0.02 }],                 // 5 dizler çözülür, kol düşer
  [0.3, { rot: -0.5, bd: 0.4, sy: 0.93, sx: 1.04, sf: 0.06, R: -0.06, arm: 0.4, bend: 0.04 }],      // 6 çöküş
  [0.39, { R: -0.5, arm: 0.2, bend: 0 }],                                                           // 7 devrilmeye başlar
  [0.47, { R: -1.52, sy: 0.9, sx: 1.07, arm: -0.3, bend: 0.05 }, '!'],                              // 8 sırtüstü yere çarpar
  [0.55, { R: -1.34, oy: -0.05, sy: 0.95, sx: 1.03, arm: 0.1, bend: -0.02 }],                       // 9 seker
  [0.63, { R: -1.47, oy: 0, sy: 0.92, sx: 1.05, arm: -0.1, bend: 0.01 }, '!'],                      // 10 ikinci kez değer
  [0.78, { R: -1.45, sy: 0.93, sx: 1.04, arm: 0, bend: 0 }],                                        // 11 yerleşir
]);
// Yetenek kullanma (0 → 1): toplanır, yükselir, gücü salar, asılı kalır, yere iner
const CAST_POSE = track([
  [0, { rot: 0, sx: 1, sy: 1, oy: 0, arm: 0, bend: 0 }],
  [0.08, { rot: 0.06, sx: 1.04, sy: 0.94, arm: 0.15, bend: 0.015 }],
  [0.16, { rot: 0.08, sx: 1.06, sy: 0.91, oy: 0.5, arm: 0.25, bend: 0.03 }],
  [0.26, { rot: -0.08, sx: 1, sy: 1.04, oy: -2, arm: -0.4, bend: -0.01 }],
  [0.36, { rot: -0.2, sx: 0.96, sy: 1.1, oy: -4.5, arm: -1, bend: -0.05 }],
  [0.44, { rot: -0.24, sx: 0.95, sy: 1.11, oy: -5, arm: -1.1, bend: -0.06 }, '='],
  [0.54, { rot: -0.2, sx: 0.96, sy: 1.08, oy: -4.6, arm: -1, bend: -0.05 }],
  [0.64, { rot: -0.12, sx: 0.98, sy: 1.04, oy: -3, arm: -0.7, bend: -0.03 }],
  [0.74, { rot: -0.04, sx: 1, sy: 1, oy: -1.2, arm: -0.35, bend: -0.01 }],
  [0.84, { rot: 0.03, sx: 1.03, sy: 0.96, oy: 0, arm: 0, bend: 0.015 }, '!'],
  [0.92, { rot: 0.01, sx: 1, sy: 1.01, arm: 0.05, bend: 0 }],
  [1, { rot: 0, sx: 1, sy: 1, oy: 0, arm: 0, bend: 0 }],
]);
// Kışla askerinin kılıç saldırısı. sw: kılıç kolu açısı, lu: öne atılma, st: adım, cr: çömelme (+ aşağı)
const SOL_ATK = track([
  [-0.3, { sw: 0.75, lu: 0, st: 0, cr: 0 }],
  [-0.25, { sw: 0.68, lu: -0.15, cr: -0.1 }],
  [-0.19, { sw: 1.02, lu: 0.35, cr: 0.6 }],
  [-0.12, { sw: 0.1, lu: 0.05, st: -0.06, cr: 0.2 }],
  [-0.05, { sw: -1.45, lu: -0.55, st: -0.15, cr: -0.3 }],
  [-0.012, { sw: -1.6, lu: -0.65, cr: -0.35 }, '='],
  [0.025, { sw: 0.4, lu: 0.9, st: 0.25, cr: 0.1 }],
  [0.06, { sw: 2.08, lu: 1.85, st: 0.4, cr: 0.55 }, '!'],
  [0.1, { sw: 1.9, lu: 1.6, cr: 0.35 }],
  [0.17, { sw: 2.28, lu: 2.1, cr: 0.15 }],
  [0.3, { sw: 1.3, lu: 0.9, st: 0.18, cr: -0.25 }],
  [0.45, { sw: 0.75, lu: 0, st: 0, cr: 0 }],
]);
// Yay çekişi (0 → 1): oku kirişe takar, hızla çeker, sonra son santimleri zorlanarak yavaşça gerer
const BOW_DRAW = track([
  [0, { d: 0 }], [0.08, { d: 0.02 }], [0.16, { d: 0.08 }], [0.26, { d: 0.25 }], [0.36, { d: 0.48 }], [0.46, { d: 0.66 }],
  [0.56, { d: 0.78 }], [0.66, { d: 0.86 }], [0.76, { d: 0.92 }], [0.86, { d: 0.96 }], [0.94, { d: 0.99 }], [1, { d: 1 }],
]);
// kodla çizilen askerler/okçular için yürüyüş: bacak açıları, kalkma ve gövde zıplaması (u: 0..1 döngü)
const GL = {}, GL2 = {}, GB = {}, Q = {}; // ortak ara nesneler (her karede yeni nesne üretilmesin)
function gaitOf(u) {
  pose(GAIT_LEG, u, GL); pose(GAIT_LEG, u + 0.5, GL2); pose(GAIT_BODY, u * 2, GB);
  return { f: GL.x, fl: GL.l, b: GL2.x, bl: GL2.l, dy: GB.dy, rot: GB.rot };
}

// ----- karakter animasyonu -----
// Her karakter görseli üç parçaya ayrılır: gövde, arka bacak (sol yarı) ve ön bacak (sağ yarı).
// Yürürken bacaklar sırayla öne savrulup kalkar, gövde adım ortasında yükselip iner ve kalçadan hafif sallanır.
// Saldırı dört evreden oluşur: hazırlık (silah geride, ağırlık arka ayakta), vuruş (çok hızlı öne savrulma, ön ayak
// öne basar, arkada iz), çarpma (gövde ezilir ve sarsılır) ve toparlanma (yavaşça duruşa döner).
// Yarasada iki kanat gövdenin iki yanından ayrı ayrı çırpar.
const RIG = {
};
const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
// Necromancer seferi görselleri: iskeletler (1 acemi, 2 muhafız, 3 kemik şövalye, 4 mezar bekçisi, 5 ölüm şövalyesi),
// Solarian askerleri, atlılar (bacak bölgesi alçak), tekerlekli kuşatma araçları (cart: hafif sarsıntı), uçan banshee
const SKEL_H = [0, 32, 33, 35, 36, 34, 33, 34, 35];
Object.assign(RIG, {
  unit_skel_1: { legY: 0.72 }, unit_skel_2: { legY: 0.72 }, unit_skel_3: { legY: 0.72 }, unit_skel_4: { legY: 0.72 }, unit_skel_5: { legY: 0.72 },
  enemy_legion: { legY: 0.72 }, enemy_solarcher: { legY: 0.72 }, enemy_gladiator: { legY: 0.72 }, enemy_assassin: { legY: 0.7 },
  enemy_priest: { legY: 0.82, stride: 0.5 }, enemy_heavy: { legY: 0.74, stride: 0.8 }, enemy_cavalry: { legY: 0.62, stride: 1.2 },
  enemy_gloriosus: { legY: 0.62, stride: 1.2 }, enemy_ram: { solid: 'cart' }, enemy_catapult: { solid: 'cart' },
  hero_drakula: { legY: 0.66 },
});

// ----- silah kolu ve gövde iskeleti -----
// Her karakter görselinin silahlı kolu (silahıyla birlikte) ayrı bir parça olarak kesilir ve omuzdan döner.
// Kolun ardında kalan, gövdenin çevrelediği boşluk komşu piksellerden doldurulur (kol oynayınca delik görünmesin).
// poly: kol + silah bölgesi, p: omuz (görsel oranı, 0-1). amp: dönüş ölçeği, ph: 1 ise ikinci kol (yürürken ters salınır),
// ov: ileri (artı) dönüş ölçeği; aşağı sarkan silahlarda küçüktür.
const ARMS = {
};
// görselin kol verisi: kendi verisi, yoksa (bossların renklendirilmiş kopyaları) temel görselinki
function armsOf(name, rigName, im) { return ARMS[name] || (im && im.generated ? ARMS[rigName] : null) || null; }
const CUTS = new WeakMap();
function cutImage(im, arms) {
  let cut = CUTS.get(im);
  if (cut) return cut;
  const W = im.width, H = im.height, N = W * H;
  const mk = () => { const k = document.createElement('canvas'); k.width = W; k.height = H; return k; };
  const path = (g, a) => { g.beginPath(); a.poly.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x * W, y * H)); g.closePath(); };
  const ctx2 = (k) => k.getContext('2d', { willReadFrequently: true });
  const body = mk(), bg = ctx2(body);
  bg.drawImage(im, 0, 0);
  const orig = bg.getImageData(0, 0, W, H).data;
  const mask = mk(), mg = ctx2(mask);
  mg.fillStyle = '#fff'; for (const a of arms) { path(mg, a); mg.fill(); }
  bg.globalCompositeOperation = 'destination-out'; bg.drawImage(mask, 0, 0); bg.globalCompositeOperation = 'source-over';
  const id = bg.getImageData(0, 0, W, H), d = id.data, md = mg.getImageData(0, 0, W, H).data;
  // kol parçaları: çokgenin içi
  const parts = arms.map(a => {
    const k = mk(), g = ctx2(k);
    path(g, a); g.save(); g.clip(); g.drawImage(im, 0, 0); g.restore();
    let cx = 0, cy = 0; a.poly.forEach(([x, y]) => { cx += x * W; cy += y * H; });
    return { c: k, g, a, data: g.getImageData(0, 0, W, H), cx: cx / a.poly.length, cy: cy / a.poly.length };
  });
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // gövdeden kopup kalan küçük adacıklar (silah ucu, asa tepesi) en yakın kola geçer
  const lab = new Int32Array(N).fill(-1), comps = [];
  for (let i = 0; i < N; i++) {
    if (lab[i] >= 0 || d[i * 4 + 3] <= 20) continue;
    const list = [i]; lab[i] = comps.length;
    for (let q = 0; q < list.length; q++) {
      const j = list[q], x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of dirs) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = yy * W + xx;
        if (lab[k] < 0 && d[k * 4 + 3] > 20) { lab[k] = comps.length; list.push(k); }
      }
    }
    comps.push(list);
  }
  const big = comps.reduce((m, c) => Math.max(m, c.length), 0);
  for (const c of comps) {
    if (c.length >= big * 0.04) continue;
    let cx = 0, cy = 0; for (const j of c) { cx += j % W; cy += (j / W) | 0; } cx /= c.length; cy /= c.length;
    const P = parts.reduce((b, p) => Math.hypot(p.cx - cx, p.cy - cy) < Math.hypot(b.cx - cx, b.cy - cy) ? p : b, parts[0]);
    // yalnız kolun yakınındaki adacıklar taşınır (gövdenin kendi küçük parçaları yerinde kalır)
    let near = false;
    for (const j of c) { if (md[j * 4 + 3]) { near = true; break; } }
    if (!near) for (let k = 0; k < c.length && !near; k += 3) {
      const x = c[k] % W, y = (c[k] / W) | 0;
      for (let r = 1; r < 6 && !near; r++) for (const [dx, dy] of dirs) { const xx = x + dx * r, yy = y + dy * r; if (xx >= 0 && yy >= 0 && xx < W && yy < H && md[(yy * W + xx) * 4 + 3]) { near = true; break; } }
    }
    if (!near) continue;
    for (const j of c) { for (let ch = 0; ch < 4; ch++) P.data.data[j * 4 + ch] = Math.max(P.data.data[j * 4 + ch], d[j * 4 + ch] * (ch < 3 ? 1 : 1)); d[j * 4 + 3] = 0; }
  }
  for (const p of parts) p.g.putImageData(p.data, 0, 0);
  // doldurulacak pikseller: kolun altında kalan, sekiz yönden en az altısında gövdeyle çevrili noktalar
  const R = Math.round(Math.max(W, H) * 0.14), need = new Uint8Array(N), known = new Uint8Array(N);
  for (let i = 0; i < N; i++) known[i] = d[i * 4 + 3] > 200 ? 1 : 0;
  let nNeed = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!md[i * 4 + 3] || orig[i * 4 + 3] < 40 || known[i]) continue;
    let hit = 0;
    for (const [dx, dy] of dirs) {
      for (let k = 2; k <= R; k += 2) {
        const xx = x + dx * k, yy = y + dy * k;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
        if (known[yy * W + xx]) { hit++; break; }
      }
    }
    if (hit >= 6) { need[i] = 1; nNeed++; }
  }
  if (nNeed) {
    // itme-çekme doldurma: bilinen pikseller yarıya yarıya küçültülüp ortalanır, sonra delikler kaba
    // katmandan yumuşakça (çift doğrusal) doldurularak geri büyütülür; çizgi/iz bırakmaz
    const lv = [{ w: W, h: H, c: new Float32Array(N * 3), a: new Float32Array(N) }];
    for (let i = 0; i < N; i++) if (known[i]) { lv[0].a[i] = 1; lv[0].c[i * 3] = d[i * 4]; lv[0].c[i * 3 + 1] = d[i * 4 + 1]; lv[0].c[i * 3 + 2] = d[i * 4 + 2]; }
    while (lv[lv.length - 1].w > 1 || lv[lv.length - 1].h > 1) {
      const L = lv[lv.length - 1], w = Math.ceil(L.w / 2), h = Math.ceil(L.h / 2), c = new Float32Array(w * h * 3), a = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sa = 0, r = 0, g = 0, b = 0;
        for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) {
          const xx = x * 2 + u, yy = y * 2 + v; if (xx >= L.w || yy >= L.h) continue;
          const j = yy * L.w + xx, wa = L.a[j]; sa += wa; r += L.c[j * 3] * wa; g += L.c[j * 3 + 1] * wa; b += L.c[j * 3 + 2] * wa;
        }
        const i = y * w + x; a[i] = Math.min(1, sa);
        if (sa > 0) { c[i * 3] = r / sa; c[i * 3 + 1] = g / sa; c[i * 3 + 2] = b / sa; }
      }
      lv.push({ w, h, c, a });
    }
    for (let l = lv.length - 2; l >= 0; l--) {
      const L = lv[l], U = lv[l + 1];
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x; if (L.a[i] >= 1) continue;
        const fx = clamp((x + 0.5) / 2 - 0.5, 0, U.w - 1), fy = clamp((y + 0.5) / 2 - 0.5, 0, U.h - 1);
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(U.w - 1, x0 + 1), y1 = Math.min(U.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
        const k = 1 - L.a[i];
        for (let ch = 0; ch < 3; ch++) {
          const v = (U.c[(y0 * U.w + x0) * 3 + ch] * (1 - tx) + U.c[(y0 * U.w + x1) * 3 + ch] * tx) * (1 - ty)
            + (U.c[(y1 * U.w + x0) * 3 + ch] * (1 - tx) + U.c[(y1 * U.w + x1) * 3 + ch] * tx) * ty;
          L.c[i * 3 + ch] = L.c[i * 3 + ch] * (1 - k) + v * k;
        }
        L.a[i] = 1;
      }
    }
    const F = lv[0].c;
    for (let i = 0; i < N; i++) if (need[i]) {
      // biraz koyu: kolun ardında kalan gölgeli yüzey
      const a0 = d[i * 4 + 3] / 255;
      for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = d[i * 4 + ch] * a0 + F[i * 3 + ch] * 0.88 * (1 - a0);
      d[i * 4 + 3] = 255;
    }
  }
  bg.putImageData(id, 0, 0);
  cut = { body, arms: parts.map(p => ({ c: p.c, a: p.a })) };
  CUTS.set(im, cut);
  return cut;
}

// Yarı saydam çizimde (vuruş parlaması, hız izi, solan ceset) gövde dilimlerinin üst üste binen kenarları
// çizgi gibi görünmesin diye karakter önce tam opak bir tampona çizilir, sonra saydamlıkla bindirilir.
const RIGBUF = document.createElement('canvas'), RIGBUF_G = RIGBUF.getContext('2d');
function drawRig(im, w, h, legY, P, rig, arms) {
  const al = ctx.globalAlpha;
  if (al > 0.99 || rig.wings) { drawRigTo(ctx, im, w, h, legY, P, rig, arms); return; }
  const m = ctx.getTransform();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [lx, ly] of [[-w * 1.3, -h * 1.5], [w * 1.3, -h * 1.5], [-w * 1.3, h * 0.4], [w * 1.3, h * 0.4]]) {
    const X = m.a * lx + m.c * ly + m.e, Y = m.b * lx + m.d * ly + m.f;
    x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
  }
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const bw = Math.ceil(x1 - x0) + 2, bh = Math.ceil(y1 - y0) + 2;
  if (bw > 1024 || bh > 1024 || bw < 1 || bh < 1) { drawRigTo(ctx, im, w, h, legY, P, rig, arms); return; }
  if (RIGBUF.width < bw || RIGBUF.height < bh) { RIGBUF.width = Math.max(RIGBUF.width, bw); RIGBUF.height = Math.max(RIGBUF.height, bh); }
  const g = RIGBUF_G;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw, bh);
  g.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawRigTo(g, im, w, h, legY, P, rig, arms);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(RIGBUF, 0, 0, bw, bh, x0, y0, bw, bh);
  ctx.restore();
}
function drawRigTo(ctx, im, w, h, legY, P, rig, arms) {
  const cut = arms && !rig.solid && !rig.wings ? cutImage(im, arms) : null;
  const mip = pickMip(ctx, cut ? cut.body : im, w), mw = mip.width, mh = mip.height;
  const part = (x0, y0, x1, y1, dx, dy) => ctx.drawImage(mip, x0 * mw, y0 * mh, (x1 - x0) * mw, (y1 - y0) * mh,
    -w / 2 + x0 * w + dx, -h + y0 * h + dy, (x1 - x0) * w, (y1 - y0) * h);
  if (rig.solid) {
    // bacaksız: süzülen cin merkezinden hafifçe sallanır ve yükselip alçalır; solucan tabanından salınır, nefes alır gibi uzar
    const fl = rig.solid === 'float', cart = rig.solid === 'cart', py = fl ? -h * 0.5 : 0;
    const sway = cart ? Math.sin(time * 9 + w) * 0.008 : fl ? Math.sin(time * 1.8 + w) * 0.03 : Math.sin(time * 3 + w) * 0.06;
    const bob = fl ? Math.sin(time * 2.4 + w) * h * 0.04 : cart ? Math.abs(Math.sin(time * 9 + w)) * h * -0.01 : 0, st = fl || cart ? 1 : 1 + Math.sin(time * 4 + w) * 0.04;
    ctx.save(); ctx.translate(0, py + P.bodyDy + bob); ctx.rotate(P.rot * 0.7 + sway); ctx.scale(P.sx, P.sy * st); ctx.translate(0, -py);
    // gövde dilimleri yatayda kayarak kıvrılır (cin dumanı, solucan gövdesi)
    const N = cart ? 1 : 6, bend = cart ? 0 : (P.bend || 0) * h + (fl ? Math.sin(time * 2.1 + w) : Math.sin(time * 3.4 + w)) * h * 0.03;
    for (let i = 0; i < N; i++) {
      const ya = i / N, yb = (i + 1) / N, oA = bend * (1 - ya) * (1 - ya), oB = bend * (1 - yb) * (1 - yb);
      const cA = -h + ya * h, cB = -h + yb * h, sh = (oA - oB) / (cA - cB);
      ctx.save(); ctx.transform(1, 0, sh, 1, oB - cB * sh, 0); part(0, Math.max(0, ya - 0.004), 1, Math.min(1, yb + 0.004), 0, 0); ctx.restore();
    }
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
  // bacaklar kalçadan sarkaç gibi döner (adım), havadayken yukarı kalkar
  const xs = rig.xs ?? 0.5, ov = 0.1, legLen = (1 - legY) * h, hy = -h + legY * h;
  const leg = (x0, x1, step, lift) => {
    const hx = -w / 2 + (x0 + x1) / 2 * w;
    ctx.save(); ctx.translate(hx + step * w * 0.35, hy - lift * h); ctx.rotate(-Math.atan2(step * w * 0.65, legLen)); ctx.translate(-hx, -hy);
    part(x0, legY - 0.03, x1, 1, 0, 0); ctx.restore();
  };
  leg(0, xs + ov, P.stepB, P.liftB);                                     // arka bacak
  leg(xs - ov, 1, P.stepF, P.liftF);                                     // ön bacak
  // gövde: kalçadan döner; dilimler halinde çizilir ve omurga gibi kıvrılır (bend: tepe noktasının yana kayması)
  const hipY = -h * (1 - legY), bend = (P.bend || 0) * h, top = legY + 0.04;
  ctx.save(); ctx.translate(0, hipY + P.bodyDy); ctx.rotate(P.rot); ctx.scale(P.sx, P.sy); ctx.translate(0, -hipY);
  const off = (y) => { const s = clamp((legY - y) / legY, 0, 1); return bend * s * s; };
  const N = quality < 0.9 ? 3 : 5; // düşük grafik kalitesinde daha az dilim
  for (let i = 0; i < N; i++) {
    const ya = top * i / N, yb = top * (i + 1) / N, oA = off(ya), oB = off(yb);
    const cA = -h + ya * h, cB = -h + yb * h, sh = (oA - oB) / (cA - cB);
    ctx.save(); ctx.transform(1, 0, sh, 1, oB - cB * sh, 0); part(0, Math.max(0, ya - 0.004), 1, Math.min(1, yb + 0.004), 0, 0); ctx.restore();
  }
  if (cut) for (const A of cut.arms) {
    // kol, omzun bulunduğu gövde diliminin kaymasıyla birlikte gider ve omuzdan döner
    const a = A.a, px = -w / 2 + a.p[0] * w, py = -h + a.p[1] * h;
    let ang = (a.ph ? P.arm2 : P.arm) * (a.amp ?? 1);
    if (ang > 0) ang *= a.ov ?? 1; // aşağı sarkan silah: vuruş dinlenme duruşunda biter, geriye savrulmaz
    const am = pickMip(ctx, A.c, w);
    ctx.save(); ctx.translate(px + off(a.p[1]), py); ctx.rotate(ang); ctx.translate(-px, -py);
    ctx.drawImage(am, -w / 2, -h, w, h); ctx.restore();
  }
  ctx.restore();
}


function drawUnit(name, im, x, y, face, o) {
  const pad = o.pad || 0, h = o.h * (1 + pad), w = h * im.width / im.height;
  const rig = RIG[o.rig || name] || { legY: 0.7 };
  const legY = (rig.legY + pad) / (1 + pad), S = rig.stride ?? 1;
  const P = { rot: 0, sx: 1, sy: 1, bodyDy: 0, stepF: 0, stepB: 0, liftF: 0, liftB: 0, flap: 0, arm: 0, arm2: 0, bend: 0 };
  const arms = armsOf(name, o.rig || name, im);
  let ox = 0, oy = -o.fly, ghost = 0, glowK = 0;
  if (rig.wings && o.wings != null) {
    P.flap = pose(FLAP, o.wings * 14 / TAU, Q).f; oy -= P.flap * 2.5;
  } else if (o.atk != null && o.atk > -ATK_PREP && o.atk < ATK_AFTER) {
    // 12 pozlu saldırı (ATK_POSE): sezdirme → kurulma → gerilim → savuruş → darbe → sekme → devam → toparlanma
    const u = h / 24, t = o.atk, A = pose(ATK_POSE, t, Q); // öne atılma mesafesi birim boyuyla orantılı
    P.rot = A.rot; P.sx = A.sx; P.sy = A.sy; P.bodyDy = A.dy * h; ox = A.ox * u;
    P.stepF = A.sf * S; P.stepB = A.sb * S; P.liftF = Math.max(0, A.lf) * S;
    ghost = clamp(A.ghost, 0, 1); glowK = clamp(A.glow, 0, 1);
    P.arm = A.arm; P.arm2 = A.arm * 0.4; P.bend = A.bend;
    if (t > 0.06 && t < 0.13) { const k = (t - 0.06) / 0.07; P.rot += Math.sin(k * Math.PI * 3) * 0.05 * (1 - k); } // darbe titremesi
  } else if (o.walking) {
    // 12 pozlu yürüyüş: bacaklar yerdeyken sabit hızla geri kayar, havada hızla öne savrulur;
    // gövde her adımda değme → çöküş → itiş → geçiş → tepe → iniş pozlarından geçer
    const u = o.phase / TAU;
    pose(GAIT_LEG, u, GL); pose(GAIT_LEG, u + 0.5, GL2); pose(GAIT_BODY, u * 2, GB);
    P.stepF = GL.x * 0.078 * S; P.stepB = GL2.x * 0.078 * S;
    P.liftF = Math.max(0, GL.l) * 0.06 * S; P.liftB = Math.max(0, GL2.l) * 0.06 * S;
    P.bodyDy = GB.dy * h; P.rot = GB.rot; P.sy = GB.sy; P.sx = GB.sx; P.bend = GB.bend;
    P.arm = -GL.x * 0.2; P.arm2 = GL.x * 0.2;                           // kollar bacaklara ters salınır
    ox = Math.sin(2 * o.phase) * 0.35;
  } else {
    // dururken nefes alır, ağırlığını hafifçe bir ayaktan diğerine verir
    P.sy = 1 + Math.sin(time * 2.6 + o.seed) * 0.02; P.rot = Math.sin(time * 1.3 + o.seed) * 0.02;
    P.arm = Math.sin(time * 1.3 + o.seed + 0.8) * 0.06; P.arm2 = Math.sin(time * 1.3 + o.seed + 2.4) * 0.05;
    P.bend = Math.sin(time * 1.3 + o.seed - 0.7) * 0.008;               // baş gövdenin biraz gerisinden gelir
  }
  if (o.cast > 0) {
    // yetenek kullanırken (12 poz): toplanır, yükselir, gücü salar, bir an asılı kalır, yere iner
    const C = pose(CAST_POSE, 1 - clamp(o.cast / 0.45, 0, 1), Q);
    P.rot = C.rot; P.sy = C.sy; P.sx = C.sx; oy += C.oy; P.arm = C.arm; P.arm2 = C.arm * 0.6; P.bend = C.bend;
  }
  if (o.hit > 0) { const k = o.hit / 0.18; P.rot -= 0.16 * k; ox -= 2 * k; P.arm -= 0.25 * k; P.bend -= 0.04 * k; }   // darbe alınca geriye sarsılır
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
  // çizilmiş kareler (kare kare animasyon) varsa iskelet yerine onlar çizilir:
  // saldırı (<ad>_atk) ya da yürüyüş; yürüyüşte yöne göre önden (_walk_on), arkadan (_walk_arka) veya yandan (_walk)
  let fName = null, fi = 0;
  const atkOn = o.atk != null && o.atk > -ATK_PREP && o.atk < ATK_AFTER;
  const atkKey = atkOn && ((o.atkVar && animStrip(name, o.rig, ['_atk', '_atk2', '_atk3'][o.atkVar % 3])) || animStrip(name, o.rig, '_atk'));
  // özel saldırı / büyü anı: <ad>_skill şeridi (yoksa saldırı şeridi) baştan sona bir kez oynar
  const skillKey = o.skill != null && (animStrip(name, o.rig, '_skill') || animStrip(name, o.rig, '_atk'));
  if (skillKey) { fName = skillKey; fi = Math.min(ANIM_META[fName].n - 1, Math.floor(o.skill * ANIM_META[fName].n)); }
  else if (atkKey) {
    fName = atkKey;
    const T = ANIM_META[fName].n === 8 ? ATK_FRAME_T : null;
    if (T) { fi = 0; for (let i = 0; i < 8; i++) if (o.atk >= T[i]) fi = i; }
    else fi = Math.min(ANIM_META[fName].n - 1, Math.floor((o.atk + ATK_PREP) / (ATK_PREP + ATK_AFTER) * ANIM_META[fName].n));
  } else if (o.walking && !rig.wings) {
    const suf = o.dir === 'on' ? '_walk_on' : o.dir === 'arka' ? '_walk_arka' : '_walk';
    for (const sf of [suf, '_walk']) { const n = animStrip(name, o.rig, sf); if (n) { fName = n; break; } }
    if (fName) fi = Math.floor(((o.phase / TAU) % 1 + 1) % 1 * ANIM_META[fName].n) % ANIM_META[fName].n;
  }
  else if (!rig.wings && !(o.rise != null)) {
    // dururken: yürüyüş şeridinin ayakları kapalı karesi (anim.json "idle"); tek resme dönüp tasarım değişmesin
    const n = animStrip(name, o.rig, '_walk');
    if (n && ANIM_META[n].idle != null) { fName = n; fi = ANIM_META[n].idle; }
  }
  const frontBack = fName && /_walk_(on|arka)$/.test(fName); // önden/arkadan görünüş aynalanmaz
  if (window.__animLog && o.logId != null) window.__animLog.push([o.logId, fName, fi, face, !!o.walking, o.dir || '', +x.toFixed(2), +y.toFixed(2)]);
  ctx.save();
  ctx.translate(x + (frontBack ? 0 : ox * face), y + 1 + oy);
  ctx.scale(frontBack ? 1 : face * (rig.flip ? -1 : 1), 1);
  if (o.rise != null) ctx.scale(1, o.rise); // kumdan çıkış
  if (o.skill != null && !fName) { // şeridi olmayan birimde özel saldırı: geri gerilip ileri atılır
    const k = o.skill, lean = k < 0.45 ? -Math.sin(k / 0.45 * Math.PI / 2) * 0.14 : -0.14 + (k - 0.45) / 0.55 * 0.3 * Math.sin((k - 0.45) / 0.55 * Math.PI);
    ctx.rotate(lean); ctx.scale(1 + (k > 0.45 ? 0.06 * Math.sin((k - 0.45) / 0.55 * Math.PI) : 0), 1);
  }
  if (fName) {
    const F = ANIM_META[fName], fImg = spr(fName);
    drawFrame(fImg, F, fi, o.h);
    if (o.flash > 0) { ctx.globalAlpha = clamp(o.flash / 0.1, 0, 1) * 0.7; drawFrame(whiteOf(fName, fImg), F, fi, o.h); }
    ctx.restore();
    return;
  }
  if (ghost > 0) {
    // vuruşun hız izi: bir önceki pozun soluk kopyası
    ctx.save(); ctx.globalAlpha *= 0.3 * ghost; ctx.translate(-7, 0);
    drawRig(im, w, h, legY, Object.assign({}, P, { rot: P.rot * 0.35, arm: P.arm * 0.5 }), rig, arms);
    ctx.restore();
  }
  drawRig(im, w, h, legY, P, rig, arms);
  if (o.glow) {
    // altın şövalyenin parlayan kılıcı
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 + Math.sin(time * 5 + o.seed) * 0.1 + glowK * 0.5;
    drawRig(o.glow, w, h, legY, P, rig, arms);
    ctx.restore();
  }
  if (o.flash > 0) {
    ctx.globalAlpha = clamp(o.flash / 0.1, 0, 1) * 0.7;
    drawRig(whiteOf(name, im), w, h, legY, P, rig, arms);
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
  return spr(d.sprite);
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
let CORPSE_BAKE = 3; // kare başına en çok bu kadar ceset önbelleğe alınır (çok ölüm aynı karede takılma yapmasın)
// ölüm şeridi süresi (sn): kareler bu sürede oynar, ceset son karede yatar; dirilişte tersten
const DIE_T = 0.9;
function drawCorpse(f) {
  const im = spr(f.name);
  if (!im) return;
  const t = f.t, rig = RIG[f.rig || f.name] || { legY: 0.7 };
  const dk = !f.air && !rig.wings && animStrip(f.name, f.rig, '_die');
  if (dk) {
    const F = ANIM_META[dk], i = f.flung ? F.n - 1 : Math.min(F.n - 1, Math.floor(t / DIE_T * F.n));
    ctx.save();
    const fade0 = f.dur > CORPSE_DUR ? f.dur - 0.5 : 0.78;
    ctx.globalAlpha = 1 - clamp((t - fade0) / (f.dur - fade0), 0, 1);
    if (f.raisable && t > 0.6 && G.spells.nm_raise <= 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, 12, '110,255,140', 0.18 + Math.sin(time * 5 + f.x) * 0.06); ctx.restore(); }
    ctx.translate(f.x, f.y + 1); ctx.scale(f.face * (rig.flip ? -1 : 1), 1);
    drawFrame(spr(dk), F, i, f.h || CHAR_H[f.name] || 20);
    ctx.restore();
    return;
  }
  const h = f.h || CHAR_H[f.name] || 20, w = h * im.width / im.height, legY = rig.legY ?? 0.7;
  const P = { rot: 0, sx: 1, sy: 1, bodyDy: 0, stepF: 0, stepB: 0, liftF: 0, liftB: 0, flap: 0, arm: 0, arm2: 0, bend: 0 };
  const arms = armsOf(f.name, f.rig || f.name, im);
  let rot = 0, oy = 0;
  if (rig.wings) {
    // yarasa: çırpınır, kanatlar kapanır, dönerek düşer
    const k = clamp(t / 0.45, 0, 1);
    P.flap = Math.sin(t * 34) * (1 - k) - 0.8 * k;
    oy = -f.fly * (1 - k * k); rot = k * 1.1;
  } else {
    // 12 pozlu ölüm (DEATH_POSE): darbe → havada → geri adım → sendeleme → dizler çözülür → çöküş →
    // devrilme → yere çarpma → sekme → ikinci değme → yerleşme, sonra söner
    const D = pose(DEATH_POSE, t, Q);
    P.rot = D.rot; P.sx = D.sx; P.sy = D.sy; P.stepF = D.sf; P.stepB = D.sb; P.bodyDy = h * (1 - legY) * D.bd;
    rot = D.R; oy = D.oy * h; P.arm = D.arm; P.arm2 = -D.arm * 0.7; P.bend = D.bend;
  }
  ctx.save();
  const fade0 = f.dur > CORPSE_DUR ? f.dur - 0.5 : 0.78; // uzun yatan ceset son yarım saniyede solar
  ctx.globalAlpha = 1 - clamp((t - fade0) / (f.dur - fade0), 0, 1);
  // diriltme hazırsa kaldırılabilecek cesetlerin altında yeşil ruh ışığı
  if (f.raisable && t > 0.6 && G.spells.nm_raise <= 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, 12, '110,255,140', 0.18 + Math.sin(time * 5 + f.x) * 0.06); ctx.restore(); }
  // ölüm pozu bitince (0.8 sn) ceset değişmez: bir kez ayrı tuvale çizilir, sonra tek resim olarak basılır (10 sn yatan cesetler ucuzlasın)
  if (f.air) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 1, w * 0.4, w * 0.13, 0, 0, Math.PI * 2); ctx.fill(); }
  if (t > 0.8 && !f.air && !rig.wings && (f.cache || CORPSE_BAKE-- > 0)) {
    if (!f.cache) {
      const cw = Math.ceil((w + h) * 1.7 + 8), chh = Math.ceil((w + h) * 1.5 + 8), ay = chh * 0.66, K = 2;
      const c = document.createElement('canvas'); c.width = cw * K; c.height = chh * K;
      const g2 = c.getContext('2d'); g2.scale(K, K); g2.translate(cw / 2, ay + 1 + oy); g2.scale(f.face * (rig.flip ? -1 : 1), 1); g2.rotate(rot);
      drawRigTo(g2, im, w, h, legY, P, rig, arms);
      f.cache = { c, cw, chh, ay };
    }
    const C = f.cache;
    ctx.drawImage(C.c, f.x - C.cw / 2, f.y - C.ay, C.cw, C.chh);
    ctx.restore();
    return;
  }
  ctx.translate(f.x, f.y + 1 + oy - (f.z || 0));
  if (f.ang) { ctx.translate(0, -h * 0.45); ctx.rotate(f.ang); ctx.translate(0, h * 0.45); } // savrulurken gövde ortası etrafında döner
  ctx.scale(f.face * (rig.flip ? -1 : 1), 1);
  ctx.rotate(rot);
  drawRig(im, w, h, legY, P, rig, arms);
  if (t < 0.12) { ctx.globalAlpha *= 0.8; drawRig(whiteOf(f.name, im), w, h, legY, P, rig, arms); }
  ctx.restore();
}

function drawProjectile(p) {
  if (p.kind === 'meteor') { drawMeteor(p); return; }
  if (p.t < 0) return;
  const k = clamp(p.t / p.dur, 0, 1);
  const { x, y } = projPos(p, k);
  if (p.imbue && IMBUE[p.imbue]) { // silah büyüsü: okun çevresinde renkli parıltı, arkasında kıvılcım
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 8, IMBUE[p.imbue].col, 0.75); ctx.restore();
    if (Math.random() < 0.45) emit(G.parts, { kind: 'glow', add: true, x, y, vx: rand(-8, 8), vy: p.imbue === 'fire' ? -rand(10, 30) : rand(-6, 10), col: IMBUE[p.imbue].col, s0: 2.4, s1: 0.4, life: 0.3 });
  }
  if (p.kind === 'ultsword') { drawUltSword(x, y, 1, 1 - k * 0.3); return; }
  if (p.kind === 'ulthammer') { drawUltHammer(x, y, -1.3 * (1 - easeInOut(k)), 1); return; }
  if (p.kind === 'ultcat') { drawShadowCat(x, y, p.tx >= p.sx ? 1 : -1, k); return; }
  if (p.kind === 'ultpillar') return;
  if (p.kind === 'rainarrow') {
    const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (p.poison) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 7, '140,255,80', 0.55); ctx.restore(); }
    ctx.strokeStyle = p.poison ? 'rgba(160,255,110,0.55)' : 'rgba(255,250,230,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-8, 0); ctx.stroke();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = p.poison ? '#8fe85a' : '#d8dbe2'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.2); ctx.lineTo(3, 2.2); ctx.fill();
    ctx.restore();
    return;
  }
  if (p.kind === 'arrow' || p.kind === 'harrow') {
    const n = projPos(p, k + 0.05), a = Math.atan2(n.y - y, n.x - x), tl = projPos(p, k - 0.14), bone = NECRO && p.kind === 'arrow';
    if (p.boneArrow) {
      // iskelet okçunun oku: ince uzun kemik şaft, sivri kemik uç, yeşil tüy; arkasında hafif ruh izi
      ctx.save(); ctx.strokeStyle = 'rgba(150,255,160,0.35)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineCap = 'round';
      ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = '#f6f0dc'; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, -1.6); ctx.lineTo(6, 0); ctx.lineTo(5, 1.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8fe88a'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-13, -2); ctx.lineTo(-11.5, 0); ctx.lineTo(-13, 2); ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    if (p.shard) {
      // kemik kıymığı: sivri fildişi diken, arkasında incelen yeşil ruh izi ve soluk kopyalar
      const tl2 = projPos(p, k - 0.3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = p.poison ? 'rgba(140,255,80,0.25)' : 'rgba(140,255,150,0.22)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(tl2.x, tl2.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = p.poison ? 'rgba(170,255,110,0.7)' : 'rgba(190,255,200,0.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(x, y); ctx.stroke(); glow(ctx, x, y, 7, '140,255,150', 0.55); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#efe6cc'; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -2.4); ctx.lineTo(-7, 0); ctx.lineTo(-4, 2.4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = p.poison ? 'rgba(140,255,80,0.6)' : bone ? 'rgba(150,255,160,0.45)' : 'rgba(255,250,230,0.3)'; ctx.lineWidth = p.poison ? 1.8 : p.foe ? 0.7 : 1.2; ctx.lineCap = 'round';
    if (p.poison) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 6, '140,255,80', 0.6); ctx.restore(); }
    ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(x, y); ctx.stroke();
    if (p.foe) { // düşman oku: ince uzun şaft, küçük demir uç, dar tüy
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineCap = 'round';
      ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = '#e8e2d2'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-12, -1.4); ctx.lineTo(-8, 0); ctx.lineTo(-12, 1.4); ctx.fill();
      ctx.fillStyle = '#c8ccd6'; ctx.beginPath(); ctx.moveTo(7.5, 0); ctx.lineTo(4.5, -1.3); ctx.lineTo(4.5, 1.3); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = bone ? '#3a3024' : '#5a3a1a'; ctx.lineWidth = bone ? 2.6 : 1.8; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    if (bone) { ctx.strokeStyle = '#ece4cc'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.fillStyle = '#ece4cc'; ctx.beginPath(); ctx.arc(-8.5, -1, 1.3, 0, 7); ctx.arc(-8.5, 1, 1.3, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-11, -2.6); ctx.lineTo(-6, 0); ctx.lineTo(-11, 2.6); ctx.fill(); }
    ctx.fillStyle = bone ? '#f6f0dc' : '#d8dbe2'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.4); ctx.lineTo(3, 2.4); ctx.fill();
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
  } else if (p.kind === 'bspear') { // balistanın dev kemik mızrağı: kemik şaft, kızıl alevli uç, iz
    const pv = projPos(p, k - 0.06), a = Math.atan2(y - pv.y, x - pv.x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 4; i++) { const q = projPos(p, k - i * 0.05); glow(ctx, q.x, q.y, 6 - i, '255,90,80', 0.35 - i * 0.06); }
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); if (p.sc) ctx.scale(p.sc, p.sc); // katmanlı balistada mızrak kendi boyunda uçar
    ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.strokeStyle = '#efe2c2'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-21, 0); ctx.lineTo(3, 0); ctx.stroke();
    circle(-22, -1.5, 2, '#efe2c2', '#2a1a10', 0.8); circle(-22, 1.5, 2, '#efe2c2', '#2a1a10', 0.8);
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(2, -3.6); ctx.lineTo(4, 0); ctx.lineTo(2, 3.6); ctx.closePath(); ctx.fillStyle = '#ff6a5a'; ctx.fill(); ctx.strokeStyle = '#3a0a08'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, '255,80,70', 0.7); ctx.restore();
  } else if (p.kind === 'ghostarrow') { // hayalet ok / cıvata: okçunun renginde ışıklı iz; balistikse yerde gölgesi uçar
    const ang = p.ballistic ? projAng(p, k) : Math.atan2(y - projPos(p, k - 0.12).y, x - projPos(p, k - 0.12).x), pv = projPos(p, k - (p.longArrow ? 0.08 : 0.12));
    if (p.ballistic && p.gy0 != null) { // yer gölgesi: atanın ayağından hedefin ayağına; ok yükseldikçe küçülür ve solar
      const gy = lerp(p.gy0, p.fy ?? p.ty, k), hgt = Math.max(0, gy - y), sh = clamp(1 - hgt / 140, 0.3, 1);
      ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.22 * sh})`; ctx.beginPath(); ctx.ellipse(x, gy, (p.heavy ? 7 : 5.5) * sh * ARROW_K, 1.6 * sh * ARROW_K, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${p.col},${p.heavy ? 0.55 : 0.45})`; ctx.lineWidth = (p.heavy ? 3.2 : p.longArrow ? 1.4 : 2.2) * ARROW_K; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    boneArrowShape(p.col, p.bolt, p.heavy, p.longArrow, false, p.giant);
    ctx.restore();
  } else if (p.kind === 'net') { // dönen ağ: halka ve ağ örgüsü, uçtukça açılır
    const k = clamp(p.t / p.dur, 0, 1), R = 3 + 6 * k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 9); ctx.scale(1, 0.7);
    ctx.strokeStyle = '#d8ccaa'; ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * R / 2.5, -R); ctx.lineTo(i * R / 2.5, R); ctx.moveTo(-R, i * R / 2.5); ctx.lineTo(R, i * R / 2.5); ctx.stroke(); }
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (p.kind === 'flask') { // kutsal su şişesi: dönen mavi cam
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 12);
    circle(0, 1, 3.2, '#6ac8ff', '#1a3050', 0.8); roundRect(-1, -4.5, 2, 3, 0.6, '#cfe8ff', '#1a3050', 0.6); roundRect(-1.2, -5.6, 2.4, 1.3, 0.5, '#8a5a2a');
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 8, '140,210,255', 0.5); ctx.restore();
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
  } else if (p.kind === 'vapor' && p.body) {
    const im = spr(p.body.name) || enemySprite(p.body.name.slice(6)), q = projPos(p, k);
    if (im) { const h = (p.body.h || 26) * 0.9; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(k * 9 * (p.body.face || 1)); drawSprite(ctx, rottenOf(p.body.name, im), 0, h * 0.5, h * im.width / im.height); ctx.restore(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, q.x, q.y, 12, '120,255,90', 0.35); ctx.restore();
  } else if (p.kind === 'vapor') {
    // yeşil buhar jeti: kazandan başa uzanan, incelip saydamlaşan bulut kuyruğu
    ctx.save();
    for (let i = 14; i >= 0; i--) {
      const kk = k - i * 0.04; if (kk < 0) continue;
      const q = projPos(p, kk), f = 1 - i / 15, r = (5 + 10 * f) * (0.75 + 0.25 * Math.sin(time * 18 + i * 1.7));
      q.x += Math.sin(time * 9 + i) * 2 * (1 - f); q.y += Math.cos(time * 7 + i) * 2 * (1 - f);
      ctx.globalAlpha = 0.14 + 0.5 * f;
      if (p.black && i % 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, q.x, q.y, r * 1.1, '180,90,255', 0.35 * f); ctx.restore(); } // kara veba: mor-yeşil
      else ctx.drawImage(gasBlob(f > 0.8), q.x - r, q.y - r, r * 2, r * 2);
    }
    ctx.restore();
    if (p.black) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 12, '190,100,255', 0.6); glow(ctx, x, y, 6, '150,255,120', 0.6); ctx.restore(); }
  } else if (p.kind === 'shell') {
    const gx = lerp(p.sx, p.tx, k), gy = lerp(p.gy ?? p.sy + 40, p.ty, k), hgt = 1 - Math.sin(k * Math.PI);
    ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.15 * hgt})`;
    ctx.beginPath(); ctx.ellipse(gx, gy, 3 + 2 * hgt, 1.5 + hgt, 0, 0, Math.PI * 2); ctx.fill();
    if (NECRO) {
      // veba bulamacı: titreşen yeşil damla, kenarında kafatası kırıntısı
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 10, '120,255,90', 0.55); ctx.restore();
      const wob = Math.sin(time * 30) * 0.6, g = ctx.createRadialGradient(x - 1.5, y - 2, 0.5, x, y, 6);
      g.addColorStop(0, '#d8ffa0'); g.addColorStop(0.5, '#6ad83a'); g.addColorStop(1, '#1e5a14');
      ctx.fillStyle = g; ctx.strokeStyle = '#0e2a08'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, 5.2 + wob, 4.6 - wob, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      circle(x + 1.6, y - 1.2, 1.5, '#efe6cc');
    } else {
    const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5);
    g.addColorStop(0, '#8a8d98'); g.addColorStop(1, '#141418');
    circle(x, y, 5, g, '#000', 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + 3, y - 4, 5, '255,190,90', 0.8 + Math.sin(time * 40) * 0.2); ctx.restore();
    }
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

// ----- kahraman gücü çizimleri -----
// Kılıç Yağmuru: ucu aşağıda, ışık saçan geniş kılıç
function drawUltSword(x, y, a, glowK) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -12, 14, '255,230,150', 0.55 * glowK); ctx.restore();
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2.6, -5); ctx.lineTo(-2.6, -24); ctx.lineTo(2.6, -24); ctx.lineTo(2.6, -5); ctx.closePath();
  const bg = ctx.createLinearGradient(-3, 0, 3, 0); bg.addColorStop(0, '#9aa6b4'); bg.addColorStop(0.5, '#ffffff'); bg.addColorStop(1, '#8a96a6');
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#2a2e38'; ctx.lineWidth = 0.9; ctx.stroke();
  roundRect(-7, -27, 14, 3.2, 1.5, '#f2c64e', '#5a3a08', 0.8);
  roundRect(-1.6, -35, 3.2, 8, 1, '#6a2a14', '#2a0e04', 0.7);
  circle(0, -36, 2.2, '#f2c64e', '#5a3a08', 0.7);
  ctx.restore();
}
// Kutsal Çekiç: altın başlı dev savaş çekici (sap ucu etrafında döner)
function drawUltHammer(x, y, rot, a) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -14, 40, '255,240,170', 0.6); ctx.restore();
  ctx.translate(26, -6); ctx.rotate(rot); ctx.translate(-26, 6);
  roundRect(-3, -6, 52, 6, 3, '#7a4a1a', '#2a1406', 1.2);           // sap
  roundRect(42, -7, 8, 8, 2, '#f2c64e', '#5a3a08', 1);
  const hg = ctx.createLinearGradient(0, -30, 0, 10); hg.addColorStop(0, '#fff6c8'); hg.addColorStop(0.5, '#f2c64e'); hg.addColorStop(1, '#a8701a');
  roundRect(-18, -24, 26, 32, 5, hg, '#4a2a06', 1.6);                 // baş
  roundRect(-20, -26, 30, 6, 3, '#fff2b0', '#4a2a06', 1.2);
  roundRect(-20, 4, 30, 6, 3, '#fff2b0', '#4a2a06', 1.2);
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha *= 0.85;
  ctx.beginPath(); ctx.moveTo(-5, -15); ctx.lineTo(-5, -1); ctx.moveTo(-11, -9); ctx.lineTo(1, -9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.restore();
}
// Gölge Kedi: mor ışıklı, parlayan gözlü kara kedi; sıçrarken gerilir
function drawShadowCat(x, y, face, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -5, 13, '170,120,255', 0.5); ctx.restore();
  const st = 1 + Math.sin(k * Math.PI) * 0.35;
  ctx.fillStyle = '#1a1024'; ctx.strokeStyle = '#7a5ab8'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(0, -5, 7 * st, 3.6, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(7 * st, -8, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5.4 * st + 1, -10.5); ctx.lineTo(6 * st + 1, -14); ctx.lineTo(7.6 * st + 1, -11); ctx.moveTo(8 * st, -11); ctx.lineTo(9.6 * st, -14); ctx.lineTo(10 * st, -10); ctx.fill();
  ctx.strokeStyle = '#1a1024'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6.5 * st, -6); ctx.quadraticCurveTo(-12 * st, -12, -9 * st, -15); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(6 + 3 * st, 0); ctx.moveTo(-4, -3); ctx.lineTo(-6 - 3 * st, 0); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 8.4 * st, -8.6, 2.6, '200,255,120', 1); ctx.restore();
  circle(8.4 * st, -8.6, 0.9, '#e8ffb0');
  ctx.restore();
}

// Darbe efekti (yazı yerine): kısa parlama, ince halka ve birkaç kısa kıvılcım çizgisi; abartısız
function impactFx(x, y, col = '255,245,220', size = 1) {
  if (!G) return;
  if (G.effects.filter(f => f.kind === 'impact').length > 6) return;
  G.effects.push({ kind: 'impact', x, y, col, size, rot: rand(0, 6), t: 0, dur: 0.28 });
}
function drawImpact(f) {
  const k = f.t / f.dur, a = 1 - k, r = (6 + 12 * (1 - (1 - k) ** 3)) * f.size;
  ctx.save(); ctx.translate(f.x, f.y); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, 0, r * 1.4, f.col, 0.5 * a);
  ctx.strokeStyle = `rgba(${f.col},${0.7 * a})`; ctx.lineWidth = 1.4 * a + 0.4;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const an = f.rot + i / 6 * Math.PI * 2, r0 = r * 0.55, r1 = r * (1.05 + (i % 2) * 0.25);
    ctx.strokeStyle = `rgba(${f.col},${0.85 * a})`; ctx.beginPath();
    ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0 * 0.8); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1 * 0.8); ctx.stroke();
  }
  ctx.restore();
}
const ARROW_K = 0.7; // oklar ve cıvatalar %30 küçük (Caner, 11 Eki)
// kemik ok / cıvata çizimi (0,0 = uç bölgesi, +x uçuş yönü). embed: ucu gövdeye gömülü (yalnız şaft ve tüy görünür).
// Oranlar türe göre (Caner, 11 Eki): okçu oku uzun ve ince, ucu ve tüyü küçük (%10 daha küçük); arbalet cıvatası kısa, kalın şaftlı,
// küt üçgen uçlu, kısa sert kanatçıklı; ağır cıvata aynı biçim biraz iri; dev cıvata (Delici Cıvata) iki katı
const ARROW_FORM = {
  arrow: { k: 0.9, sh: [-13, 6], w: 1.5, head: [9.5, 6, 1.15], fl: [-9, -13.5, 1.5] },
  bolt:  { k: 1, sh: [-7, 4], w: 2.4, head: [7.5, 3.6, 1.7], fl: [-4, -7.5, 1.9] },
};
function boneArrowShape(col, bolt, heavy, longA, embed, giant) {
  const F = longA || !bolt ? ARROW_FORM.arrow : ARROW_FORM.bolt, k = ARROW_K * F.k * (giant ? 1.9 : heavy ? 1.25 : 1);
  ctx.save(); ctx.scale(k, k);
  if (!embed) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 2, 0, heavy || giant ? 8 : 6, col, heavy ? 0.55 : 0.45); ctx.restore(); }
  const x1 = embed ? -1 : F.head[1];
  ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1c14'; ctx.lineWidth = F.w; ctx.beginPath(); ctx.moveTo(F.sh[0], 0); ctx.lineTo(x1, 0); ctx.stroke();
  ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = F.w * 0.5; ctx.beginPath(); ctx.moveTo(F.sh[0], 0); ctx.lineTo(x1, 0); ctx.stroke();
  if (!embed) { // uç: ince sivri (ok) / küt üçgen (cıvata)
    const [tx, bx, hw] = F.head;
    ctx.fillStyle = '#f6f0dc'; ctx.strokeStyle = '#2a1c14'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(bx, -hw); ctx.lineTo(bx + (tx - bx) * 0.2, 0); ctx.lineTo(bx, hw); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const [f0, f1, fw] = F.fl; // tüy / kanatçık: iki küçük yaprak
  ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.moveTo(f0, 0); ctx.lineTo(f1, -fw); ctx.lineTo(f1 + (f0 - f1) * 0.25, 0); ctx.lineTo(f1, fw); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawEffect(f) {
  if (f.t < 0) return; // gecikmeli başlayan efekt
  const k = f.t / f.dur;
  if (f.kind === 'stuck') { // saplanmış ok: düşmanda onunla birlikte, yerde titreyerek; sonda söner
    const T = f.target, x = T ? T.x + f.dx : f.x, y = T ? T.y + f.dy : f.y, a = clamp((f.dur - f.t) / 0.6, 0, 1); // son 0,6 sn'de söner
    const wob = Math.exp(-f.t * 9) * Math.sin(f.t * 55) * 0.25; // saplanınca sallanır
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(f.ang + wob);
    if (f.ground) { ctx.fillStyle = 'rgba(40,26,12,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 3 * ARROW_K, 1.1 * ARROW_K, -f.ang, 0, Math.PI * 2); ctx.fill(); }
    boneArrowShape(f.col || '255,90,90', f.bolt, f.heavy, f.longA, true);
    ctx.restore();
    return;
  }
  if (f.kind === 'impact') { drawImpact(f); return; }
  if (f.kind === 'swordstuck') {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    const a = 1 - clamp((k - 0.6) / 0.4, 0, 1);
    ctx.fillStyle = `rgba(40,26,12,${0.3 * a})`; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    drawUltSword(0, 4, a, Math.max(0, 1 - k * 2));
    ctx.restore();
    return;
  }
  if (f.kind === 'ulthammer') { drawUltHammer(f.x, f.y, Math.sin(k * Math.PI) * 0.06, 1 - k); return; }
  if (f.kind === 'catpounce') {
    // kedi bir an durup mor dumana dönüşür
    ctx.save(); ctx.globalAlpha = 1 - k; drawShadowCat(f.x, f.y - k * 6, f.face, 0); ctx.restore();
    if (Math.random() < 0.5) emit(G.parts, { kind: 'glow', x: f.x + rand(-6, 6), y: f.y - rand(2, 12), vx: rand(-10, 10), vy: -rand(10, 30), col: '90,60,140', s0: 4, s1: 9, life: 0.5, a: 0.5 });
    return;
  }
  if (f.kind === 'firepillar') {
    // yerden fışkıran alev sütunu: hızla yükselir, incelip söner
    const up = easeOutQ(clamp(k / 0.25, 0, 1)), fade = 1 - clamp((k - 0.4) / 0.6, 0, 1), hgt = 78 * up, wd = 13 * (1 - k * 0.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    const g = ctx.createLinearGradient(0, f.y - hgt, 0, f.y);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(0.35, 'rgba(255,150,50,0.75)'); g.addColorStop(1, 'rgba(255,235,160,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(f.x - wd, f.y);
    ctx.quadraticCurveTo(f.x - wd * 0.6 + Math.sin(time * 30) * 2, f.y - hgt * 0.6, f.x, f.y - hgt);
    ctx.quadraticCurveTo(f.x + wd * 0.6 + Math.sin(time * 27) * 2, f.y - hgt * 0.6, f.x + wd, f.y); ctx.closePath(); ctx.fill();
    glow(ctx, f.x, f.y - 6, 26, '255,140,40', 0.8 * fade);
    ctx.restore();
    return;
  }
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
// ekran geçişi (Caner, 11 Eki): hışırtı sesi, ekran kenarlardan ortaya doğru kararır (göz kapanır gibi), yeni ekran ortadan açılır
const TRANS = { in: 0.3, out: 0.38 };
function go(fn) {
  if (trans) return;
  trans = { t: 0, fn, fired: false };
  sfx('whoosh');
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
if (NECRO) Object.assign(STYLES, {
  wood: ['#9a8cb0', '#54476c', '#2f2742', '#130f1e'], // kara taş
  gold: ['#e6ddc4', '#b9aa80', '#7e6f4a', '#3a3020'], // kemik
  green: ['#94d88a', '#45934a', '#2a5e30', '#10301a'], // ruh yeşili (göz almasın diye kısık)
  blue: ['#c9a6ff', '#7446c8', '#3e2380', '#1a0c40'], // ruh moru
});

// Necromancer arayüzü (Caner, 10 Eki: menülerde Necromancer tasarımı ağır bassın): düğmeler parlak şeker yerine kara taş levha,
// kemik çerçeve, köşelerde kemik perçin, rengi yalnız kenardaki ruh ışığında (yeşil devam, mor ayar, kemik, kızıl). Karolar mezar taşı biçiminde.
const NECRO_AC = { green: '130,255,150', blue: '190,140,255', gold: '235,215,170', wood: '175,155,215', red: '255,95,85', dark: '180,160,140' };
function necroButton(key, x, y, w, h, label, fn, style, o, appear) {
  // duraklatma karolarının dili: kızıl-mor kadife, altın çerçeve, alttan rengine göre ruh ışığı; karo (o.tile) simgesi altın madalyonda
  const ac = NECRO_AC[style] || NECRO_AC.wood, down = press.key === key;
  const sc = pressScale(key) * appear * (o.breathe ? 1 + Math.sin(time * 3.2) * 0.025 : 1);
  const dy = down ? 3 : 0, r = Math.min(14, h / 2.4);
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, dy, w * 0.68, ac, (o.glow || o.shine ? 0.26 + Math.sin(time * 3) * 0.06 : 0.09)); ctx.restore();
  roundRect(-w / 2 + 2, -h / 2 + 8, w - 4, h, r, 'rgba(0,0,0,0.5)');
  roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 9, r + 3, '#050206');
  roundRect(-w / 2, -h / 2 + 4, w, h, r, '#140610');
  const g = ctx.createLinearGradient(0, -h / 2 + dy, 0, h / 2 + dy); g.addColorStop(0, '#3e1430'); g.addColorStop(1, '#170816');
  roundRect(-w / 2, -h / 2 + dy, w, h, r, g);
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + dy, w, h, r); ctx.clip();
  ctx.globalAlpha = 0.06; ctx.fillStyle = ctx.createPattern(pausePattern(), 'repeat'); ctx.fillRect(-w / 2, -h / 2 + dy, w, h); ctx.globalAlpha = 1;
  const tg = ctx.createLinearGradient(0, h / 2 + dy, 0, -h / 2 + dy); tg.addColorStop(0, `rgba(${ac},0.32)`); tg.addColorStop(0.65, `rgba(${ac},0)`); ctx.fillStyle = tg; ctx.fillRect(-w / 2, -h / 2 + dy, w, h);
  if (o.shine) { const ph = (time * 0.35) % 1.8; if (ph < 1) { const sx = -w / 2 - 40 + ph * (w + 80), sg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
    sg.addColorStop(0, `rgba(${ac},0)`); sg.addColorStop(0.5, `rgba(${ac},0.25)`); sg.addColorStop(1, `rgba(${ac},0)`); ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2 + dy, w, h); } }
  ctx.restore();
  roundRect(-w / 2, -h / 2 + dy, w, h, r, null, '#c9a865', 2);
  if (h >= 30) roundRect(-w / 2 + 4, -h / 2 + dy + 4, w - 8, h - 8, Math.max(2, r - 3), null, 'rgba(201,168,101,0.28)', 1);
  const size = o.size || Math.round(h * 0.44), lc = '#efe1c0';
  if (o.tile) {
    const my = dy - h * 0.13, mr = Math.min(25, h * 0.24);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, my, mr * 1.8, ac, 0.3); ctx.restore();
    const mg = ctx.createRadialGradient(-mr * 0.3, my - mr * 0.3, 1, 0, my, mr); mg.addColorStop(0, '#3a1a3a'); mg.addColorStop(1, '#12060f');
    circle(0, my, mr + 2.5, '#c9a865', '#050206', 1.5); circle(0, my, mr, mg); circle(0, my, mr - 3, null, `rgba(${ac},0.55)`, 1.2);
    drawIcon(o.icon, 0, my, mr * 1.05);
    ctx.font = `${size}px ${FONT_T}`; const tw = ctx.measureText(TR(label)).width, fs = Math.min(size, size * (w - 18) / Math.max(1, tw));
    txt(label, 0, dy + h * 0.3, fs, lc, 'center', '400', FONT_T);
  } else if (o.icon) {
    const iw = h * 0.5;
    ctx.font = `${size}px ${FONT_T}`;
    const tw = label ? ctx.measureText(label).width : 0, gap = label ? 9 : 0, total = iw + gap + tw;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, -total / 2 + iw / 2, dy, iw * 0.9, ac, 0.3); ctx.restore();
    drawIcon(o.icon, -total / 2 + iw / 2, dy, iw);
    if (label) txt(label, -total / 2 + iw + gap + tw / 2, dy + 1, size, lc, 'center', '400', FONT_T);
  } else txt(label, 0, dy + 1, size, lc, 'center', '400', FONT_T);
  ctx.restore();
  if (fn && o.reg !== false) buttons.push({ key, x: x - w / 2, y: y - h / 2, w, h: h + 6, fn });
}
function gameButton(key, x, y, w, h, label, fn, style = 'gold', o = {}) {
  const appear = o.appear == null ? 1 : easeOutBack(clamp(o.appear / 0.35, 0, 1));
  if (appear <= 0.01) return;
  if (NECRO) return necroButton(key, x, y, w, h, label, fn, style, o, appear);
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
  if (o.tile) { // kare karo: üstte büyük simge, altta yazı (sığmazsa küçülür)
    drawIcon(o.icon, 0, dy - h * 0.14, h * 0.36);
    ctx.font = `${size}px ${FONT_T}`; const tw = ctx.measureText(TR(label)).width, fs = Math.min(size, size * (w - 18) / Math.max(1, tw));
    txt(label, 0, dy + h * 0.27, fs, '#fff', 'center', '400', FONT_T);
  } else if (o.icon) {
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
  if (NECRO) { // altın çerçeveli kadife madalyon, içte rengine göre ruh ışığı halkası (duraklatma menüsünün dili)
    const ac = NECRO_AC[o.style || 'wood'] || NECRO_AC.wood;
    circle(0, 4, r + 3, 'rgba(0,0,0,0.45)'); circle(0, 0, r + 3.5, '#c9a865', '#050206', 1.5);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r); g.addColorStop(0, '#4a1a3e'); g.addColorStop(1, '#14060f'); circle(0, 0, r, g);
    const rg = ctx.createRadialGradient(0, r * 0.6, 1, 0, r * 0.6, r * 1.2); rg.addColorStop(0, `rgba(${ac},0.32)`); rg.addColorStop(1, `rgba(${ac},0)`); circle(0, 0, r, rg);
    circle(0, 0, r - 2.5, null, `rgba(${ac},${0.5 + Math.sin(time * 3 + x * 0.02) * 0.1})`, 1.3);
    if (typeof icon === 'function') icon(r); else drawIcon(icon, 0, 0, r * 1.05);
    ctx.restore();
    if (fn) buttons.push({ key, x: x - r - 6, y: y - r - 6, w: 2 * r + 12, h: 2 * r + 12, fn });
    return;
  }
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
  if (NECRO) { pauseFrame(x, y, w, h); pauseCrest(x + w / 2, y + 4); return; }
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

// mezar taşı biçimi: sivri kemerli tepe (rise), yuvarlak köşeler. Necromancer panelleri (pauseFrame) bu biçimi kullanır.
function tombPath(x, y, w, h, rise) {
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(x, y + rise + r);
  ctx.quadraticCurveTo(x, y + rise, x + r, y + rise);
  ctx.lineTo(x + w * 0.3, y + rise);
  ctx.quadraticCurveTo(x + w * 0.44, y + rise * 0.55, x + w / 2, y);
  ctx.quadraticCurveTo(x + w * 0.56, y + rise * 0.55, x + w * 0.7, y + rise);
  ctx.lineTo(x + w - r, y + rise);
  ctx.quadraticCurveTo(x + w, y + rise, x + w, y + rise + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.closePath();
}
// panel başlığı: oyulmuş yazı, iki yanda ince süs çizgisi
function plaqueTitle(cx, y, text, col = '#e8dcc0', size = 26) {
  if (NECRO) return crimsonRibbon(cx, y + 14, text, Math.min(size, 26), 280);
  ctx.font = `400 ${size}px ${FONT_T}`;
  const tw = ctx.measureText(text).width;
  ctx.save(); ctx.strokeStyle = 'rgba(214,200,166,0.4)'; ctx.lineWidth = 1.5;
  for (const sd of [-1, 1]) {
    const x0 = cx + sd * (tw / 2 + 14), x1 = cx + sd * (tw / 2 + 64);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.fillStyle = 'rgba(214,200,166,0.55)';
    ctx.beginPath(); ctx.moveTo(x1 + sd * 6, y); ctx.lineTo(x1, y - 3.5); ctx.lineTo(x1 - sd * 6, y); ctx.lineTo(x1, y + 3.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  txt(text, cx, y + 1, size, col, 'center', '400', FONT_T);
}
const RIBBON = { red: ['#ef5b4c', '#a92a1f', '#6a140b'], green: ['#76d050', '#3b8c26', '#1d5011'], blue: ['#5fb2ff', '#2f6fc8', '#173f7a'], gold: ['#ffd968', '#d6921f', '#7a4a0a'] };
if (NECRO) Object.assign(RIBBON, { red: ['#c8443c', '#7c1616', '#3c0606'], green: ['#86e88e', '#2e8a4a', '#113e22'], blue: ['#a888ff', '#5a34b0', '#26125e'] });
function ribbon(cx, cy, w, text, col = 'red', size = 26) {
  if (NECRO) return crimsonRibbon(cx, cy, text, size, w);
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
  ctx.font = `400 ${size}px ${FONT_T}`; const tw = ctx.measureText(text).width; // uzun ad şeride sığsın diye küçülür
  txt(text, cx, cy + 1, tw > w - 14 ? size * (w - 14) / tw : size, '#fff', 'center', '400', FONT_T);
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
    case 'gear':
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 7.6 : 10.4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.moveTo(3.6, 0); ctx.arc(0, 0, 3.6, 0, Math.PI * 2, true); fs(); break;
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


// ---------- menüler (halka menü) ----------
// Arsa ya da kule seçilince öğeler merkezden yaylanarak sırayla açılır, seçim kalkınca içeri toplanıp kapanır.
const MENU_R = 25, MENU_K = 1.15; // MENU_K: Caner (10 Eki) menü düğmeleri %15 büyük (içerikle birlikte ölçeklenir); arsa menüsünde aralar da %15 açıldı
function towerUnlocked(type) { const u = TOWERS[type].unlockLevel; return u == null || !G || G.idx >= u || (save.stars[u - 1] || 0) > 0; }
function plotMenuItems(pl) {
  const types = TOWER_ORDER.filter(towerUnlocked);
  const offs = types.length > 4 ? [[-56, -36], [0, -66], [56, -36], [-38, 42], [38, 42]] : [[-48, -44], [48, -44], [-48, 44], [48, 44]];
  return types.map((type, i) => ({ id: 'build', type, x: pl.x + offs[i][0] * 1.15, y: pl.y - 16 + offs[i][1] * 1.15, cost: TOWERS[type].levels[0].cost,
    blocked: !!(TOWERS[type].unique && G.towers.some(o => o.type === type)) })); // tek kurulabilen kule zaten varsa kilitli
}
// silah büyüsü: kemik kulesi ve mahzende uzmanlık son kademesine gelince açılır (kule başına bir büyü)
const imbueOpen = (t) => { if (!NECRO || (t.type !== 'archer' && t.type !== 'barracks') || !t.spec) return false; const a = t.def.abilities.find(q => q.id === t.spec); return !!a && ((t.ab && t.ab[t.spec]) || 0) >= a.ranks.length; };
function towerMenuItems(t) {
  const items = [];
  if (G.sel && G.sel.sub === 'imbue' && imbueOpen(t) && !t.imbue) { // büyü seçimi: beş büyü kulenin üstünde yay çizer, geri düğmesi altta
    IMBUE_ORDER.forEach((k, i) => { const a = Math.PI * (1 + (i + 0.5) / IMBUE_ORDER.length); items.push({ id: 'imbuepick', type: k, x: t.x + Math.cos(a) * 92, y: t.y - 30 + Math.sin(a) * 78, cost: IMBUE[k].cost }); }); // yay, düğmeler birbirine değmez
    items.push({ id: 'imback', x: t.x, y: t.y + 40 });
    return items;
  }
  if (NECRO && t.type === 'archer' && t.lvl === 0 && !t.path) { // 2. kademe: okçu ya da arbaletçi yolu
    for (const [k, dx] of [['bow', -46], ['xbow', 46]]) items.push({ id: 'path', type: k, x: t.x + dx, y: t.y - 82, cost: t.def.levels[1].cost });
  } else if (t.lvl < t.def.levels.length - 1) items.push({ id: 'upgrade', x: t.x, y: t.y - 82, cost: t.def.levels[t.lvl + 1].cost });
  else {
    // son seviye: iki yetenek, her biri 3 kademe geliştirilebilir
    // son seviye: iki uzmanlık yolu; biri seçilince yalnız o kalır ve 3 kademeye kadar geliştirilir
    t.def.abilities.forEach((a, i) => {
      if (t.spec && t.spec !== a.id) return;
      const PS = t.path && ARCHER_PATH[t.path] && ARCHER_PATH[t.path].spec; if (PS && PS !== a.id) return; // yol 4. kademeyi belirler
      const r = (t.ab && t.ab[a.id]) || 0, one = t.spec || PS;
      const n = t.def.abilities.length, ox = n === 3 ? [-58, 0, 58][i] : (i ? 44 : -44), oy = n === 3 && i === 1 ? -92 : -76;
      items.push({ id: 'ability', type: a.id, ab: a, rank: r, x: one ? t.x : t.x + ox, y: one ? t.y - 76 : t.y + oy, cost: r < a.ranks.length ? a.ranks[r].cost : null });
    });
  }
  const EX = t.spec && TOWER_EXTRA[t.spec];
  if (EX) items.push({ id: 'extra', type: t.spec, x: t.x - 64, y: t.y - 34, cost: t.extra ? null : EX.cost, owned: !!t.extra });
  if (imbueOpen(t)) items.push({ id: 'imbue', type: t.imbue || null, x: t.x + (t.type === 'archer' ? 64 : -64), y: t.y - 34, owned: !!t.imbue });
  items.push({ id: 'sell', x: t.x, y: t.y + 40, refund: Math.floor(t.spent * SELL_RATIO) });
  if (t.type === 'barracks') items.push({ id: 'rally', x: t.x + 62, y: t.y + (t.spec ? -20 : 12) }); // 3 yol düğmesiyle çakışmasın
  return items;
}
// menüyü ekran içinde tutmak için kaydırma
function menuLayout(sel = G.sel) {
  if (!sel || (sel.kind !== 'plot' && sel.kind !== 'tower' && sel.kind !== 'castle' && sel.kind !== 'hatch')) return { items: [], cx: 0, cy: 0 };
  let items, cx, cy;
  if (sel.kind === 'hatch') {
    const q = worldToScreen(sel.hatch.x, sel.hatch.y);
    items = [{ id: 'ghoul', x: q.x, y: q.y - 66, cost: HATCH.cost }]; cx = q.x; cy = q.y - 10;
  } else
  if (sel.kind === 'castle') {
    const c = G.castle, q = worldToScreen(c.x - 10, c.y - 40), N = CASTLE.levels[c.lvl + 1];
    items = [N ? { id: 'upgrade', type: 'castle', x: q.x, y: q.y - 74, cost: N.cost } : { id: 'max', x: q.x, y: q.y - 74 }];
    if (NECRO) {
      const ids = spellIds().filter(i => NECRO_SPELLS[i]), n = ids.length;
      // iki sütunlu zikzak: komşu düğmelerin fiyat hapları birbirine binmesin
      ids.forEach((id, i) => { const r = spellRank(id);
        items.push({ id: 'spellup', type: id, x: q.x - (i % 2 ? 150 : 90), y: q.y - 8 + (i - (n - 1) / 2) * 48, rank: r, cost: SPELL_UP.cost[r] ?? null }); });
      if (c.lvl) items.push({ id: 'rally', type: 'castle', x: q.x + 12, y: q.y + 58 });
    } else items.push({ id: 'rally', type: 'castle', x: q.x - 66, y: q.y - 20 });
    cx = q.x; cy = q.y;
  } else
  // halka menü ekran koordinatında kurulur: seçilen yerin ekrandaki konumu merkez alınır
  if (sel.kind === 'plot') { const q = worldToScreen(sel.plot.x, sel.plot.y); items = plotMenuItems(q); cx = q.x; cy = q.y - 16; }
  else { const q = worldToScreen(sel.tower.x, sel.tower.y); items = towerMenuItems(Object.assign({}, sel.tower, q)); cx = q.x; cy = q.y - 20; }
  const xs = items.map(i => i.x), ys = items.map(i => i.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = minX < 32 ? 32 - minX : maxX > W - 32 ? W - 32 - maxX : 0;
  let dy = minY < 32 ? 32 - minY : maxY > H - 48 ? H - 48 - maxY : 0;
  // sol alttaki portre ve büyü düğmelerinin üstüne binmesin: düğme (r≈22) + fiyat hapı oraya giriyorsa menü yukarı kayar
  let up = 0;
  for (const it of items) if (it.x + dx - 22 < hudLeft() - 4) up = Math.max(up, it.y + dy + 34 - (it.x + dx - 22 < 150 ? H - 96 : H - 66));
  dy -= up;
  for (const it of items) { it.x += dx; it.y += dy; }
  return { items, cx: cx + dx, cy: cy + dy };
}
function currentMenu() { return menuLayout().items; }
function itemAffordable(it) { return !it.blocked && (it.cost == null || G.gold >= it.cost); }

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
  G.enemyPanelR = null;
  if (infoText()) return; // büyü/kule açıklaması aynı alt şeridi kullanır: o açıkken kart çekilir
  const d = e.def, dl = wrapLines(d.desc || ENEMY_DESC[e.type] || '', ENEMY_PANEL.w - 82, 9.5, '700', FONT_B, 4);
  // zayıflık / direnç etiketleri: ikisi bir satıra sığmazsa direnç alt satıra iner
  const wk = d.wk || {}, cls = NECRO && ARMOR_CLASS[d.acl] ? ARMOR_CLASS[d.acl].name + ' · ' : '', tagS = [[cls + 'Zayıf:', Object.keys(wk).filter(q => wk[q] > 1)], ['Dirençli:', Object.keys(wk).filter(q => wk[q] < 1)]]
    .map(([label, list]) => label + ' ' + (list.length ? list.map(q => `${WK_NAME[q]} ${wk[q] > 1 ? '+' : '−'}%${Math.round(Math.abs(wk[q] - 1) * 100)}`).join(', ') : 'yok'));
  ctx.font = `800 9.5px ${FONT_B}`; const tagW = tagS.map(t => ctx.measureText(t).width + 12);
  const tagRows = tagW[0] + 5 + tagW[1] <= ENEMY_PANEL.w - 82 ? 1 : 2, ex = Math.max(0, dl.length - 1) * 11 + (tagRows - 1) * 18;
  const P = { x: clamp(W / 2 - ENEMY_PANEL.w / 2, hudLeft(), W - ENEMY_PANEL.w - 10), y: ENEMY_PANEL.y - ex, w: ENEMY_PANEL.w, h: ENEMY_PANEL.h + ex }; G.enemyPanelR = P; const k = easeOutBack(clamp((time - G.menuT) / 0.25, 0, 1));
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
  [['#ffd08a', 'rgba(150,60,10,0.6)'], ['#a8d8ff', 'rgba(20,60,120,0.6)']].forEach(([col, bg], i) => {
    const tx = i && tagRows === 1 ? x0 + tagW[0] + 5 : x0, ty = P.y + 52 + (i && tagRows === 2 ? 18 : 0);
    roundRect(tx, ty, tagW[i], 15, 7.5, bg, col, 1);
    txt(tagS[i], tx + tagW[i] / 2, ty + 8, 9.5, col, 'center', '800', FONT_B, false);
  });
  const dy = P.y + 79 + (tagRows - 1) * 18;
  dl.forEach((l, i) => txt(l, x0, dy + i * 11, 9.5, '#cdbb98', 'left', '700', FONT_B, false));
  ctx.restore();
}

function setSel(sel) {
  const old = G.sel;
  const same = old && sel && old.kind === sel.kind && old.plot === sel.plot && old.tower === sel.tower && old.hero === sel.hero && old.enemy === sel.enemy;
  if (same) return;
  if (old && (old.kind === 'plot' || old.kind === 'tower' || old.kind === 'castle' || old.kind === 'hatch')) G.menuClose = { layout: menuLayout(old), t: time, preview: G.preview };
  G.sel = sel; G.preview = null; G.menuT = time;
}

function drawMenu() {
  if (G.menuClose) {
    const k = (time - G.menuClose.t) / 0.16;
    if (k >= 1) G.menuClose = null;
    else drawMenuLayout(G.menuClose.layout, 1 - k, true, G.menuClose.preview);
  }
  if (!G.sel) return;
  if (G.sel.kind !== 'plot' && G.sel.kind !== 'tower' && G.sel.kind !== 'castle' && G.sel.kind !== 'hatch') return;
  drawMenuLayout(menuLayout(), time - G.menuT, false, G.preview);
}

// menzil önizleme ve toplanma bayrağı: dünyada çizilir, zoomla birlikte büyür
function drawMenuRange() {
  if (!G.sel) return;
  if (G.sel.kind === 'castle') {
    drawRange(G.castle.x, G.castle.y - 30, CASTLE.range * Math.min(1, easeOutBack(clamp((time - G.menuT) / 0.3, 0, 1))), false);
    if (G.castle.rally) drawRally(G.castle.rally.x, G.castle.rally.y);
    return;
  }
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

// silah büyüsü simgeleri: alev dili, zehir damlası, kar tanesi; büyü seçilmemişse hepsi küçük halkada
function drawImbueIcon(k, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (!k) { IMBUE_ORDER.forEach((q, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / IMBUE_ORDER.length + time * 0.8; ctx.save(); ctx.translate(Math.cos(a) * 9, Math.sin(a) * 9); drawImbueIcon(q, 0, 0, 0.42); ctx.restore(); }); ctx.restore(); return; }
  const I = IMBUE[k]; glow(ctx, 0, 0, 18, I.col, 0.45 + Math.sin(time * 4) * 0.1);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#140a06';
  const fill = (c) => { ctx.fillStyle = c; ctx.fill(); ctx.stroke(); };
  ctx.beginPath();
  if (k === 'fire') { ctx.moveTo(0, -13); ctx.quadraticCurveTo(10, -3, 7, 6); ctx.quadraticCurveTo(4, 12, 0, 12); ctx.quadraticCurveTo(-8, 11, -8, 4); ctx.quadraticCurveTo(-8, -2, -3, -5); ctx.quadraticCurveTo(-2, 0, 1, 1); ctx.quadraticCurveTo(2, -6, 0, -13); fill('#ff9a3a');
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(5, 4, 2, 9); ctx.quadraticCurveTo(-4, 9, -3, 4); ctx.closePath(); ctx.fillStyle = '#ffe680'; ctx.fill(); }
  else if (k === 'poison') { ctx.moveTo(0, -12); ctx.quadraticCurveTo(10, 2, 8, 6); ctx.arc(0, 5, 8, 0.1, Math.PI - 0.1); ctx.quadraticCurveTo(-10, 2, 0, -12); fill('#7ae04a');
    ctx.beginPath(); ctx.ellipse(-3, 3, 2, 3.2, -0.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill(); }
  else if (k === 'frost') { ctx.strokeStyle = '#140a06'; ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.moveTo(0, -12); ctx.lineTo(0, 12); } ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 2.6; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.moveTo(-4, -8); ctx.lineTo(0, -5); ctx.lineTo(4, -8); } ctx.stroke(); }
  ctx.restore();
}
// Kemik Kulesi yol simgeleri: yay (okçu) ve arbalet
function drawPathIcon(k, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  glow(ctx, 0, 0, 18, k === 'bow' ? '150,255,160' : '255,200,120', 0.35);
  const st = (w, c) => { ctx.strokeStyle = '#140a06'; ctx.lineWidth = w + 3; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); };
  if (k === 'bow') { // çapraz uzun yay ve ok
    ctx.rotate(-0.75);
    ctx.beginPath(); ctx.moveTo(-3, -15); ctx.quadraticCurveTo(-15, 0, -3, 15); st(3, '#e8dcc0');
    ctx.beginPath(); ctx.moveTo(-3, -15); ctx.lineTo(-3, 15); st(1, '#cfc4a8');
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(14, 0); st(2, '#f0e6cc');
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(9, -3.5); ctx.lineTo(9, 3.5); ctx.closePath(); ctx.fillStyle = '#f0e6cc'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-11, -3); ctx.moveTo(-7, 0); ctx.lineTo(-11, 3); st(1.4, '#9dff8a');
  } else { // arbalet: kalın kundak, önde enine yay, tetik
    ctx.beginPath(); ctx.moveTo(-14, 1); ctx.lineTo(10, 1); st(6, '#8a5a34');
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-14, 6); st(4, '#6a4224');
    ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-6, 10); st(2, '#6a4224');
    ctx.beginPath(); ctx.moveTo(6, -14); ctx.quadraticCurveTo(14, 1, 6, 16); st(3.4, '#e8dcc0');
    ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(-2, 1); ctx.lineTo(6, 16); st(1, '#cfc4a8');
    ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(15, -2); st(1.8, '#ffd08a');
  }
  ctx.restore();
}
function drawMenuItem(it, x, y, sc, a, preview) {
  const ok = itemAffordable(it), R = MENU_R;
  const active = preview && preview.id === it.id && preview.type === it.type;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  const s = MENU_K * sc * pressScale('mi' + it.id + (it.type || '')) * (active ? 1.07 + Math.sin(time * 6) * 0.025 : 1);
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
  } else if (it.id === 'spellup') {
    ctx.save(); ctx.scale(0.72, 0.72); drawNecroGlyph(it.type, 22); ctx.restore();
  } else if (it.id === 'extra') {
    glow(ctx, 0, 0, 20, '255,215,110', 0.3 + Math.sin(time * 4) * 0.08); drawAbilityIcon(it.type, 0, -1, 0.85); fancyStar(9, -10, 5, true);
  } else if (it.id === 'ghoul') {
    glow(ctx, 0, 2, 20, '140,255,120', 0.35); drawSkullIcon(0, 1, 15);
  } else if (it.id === 'path') { // okçu yolu: yay; arbaletçi yolu: arbalet
    drawPathIcon(it.type, 0, 0, 1);
  } else if (it.id === 'imbue' || it.id === 'imbuepick') {
    drawImbueIcon(it.type, 0, 0, 1);
  } else if (it.id === 'imback') {
    drawIcon('back', 0, 0, 22);
  } else if (it.id === 'rally') {
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(-5, -12); ctx.stroke();
    const w = Math.sin(time * 6) * 2;
    ctx.fillStyle = '#3f86e8'; ctx.strokeStyle = '#102a55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-5, -12); ctx.quadraticCurveTo(3, -12 + w, 11, -7); ctx.quadraticCurveTo(3, -4 - w, -5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.ellipse(0, -R * 0.5, R * 0.62, R * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  if (it.blocked) { circle(0, 0, R - 1, 'rgba(10,4,12,0.55)'); drawIcon('lock', 0, -2, 20); }
  if ((it.id === 'extra' || it.id === 'imbue') && it.owned) { roundRect(-22, R + 0.5, 44, 17, 8.5, 'rgba(24,15,7,0.94)', '#e8bb4a', 1.6); txt('VAR', 0, R + 9.5, 12, '#ffe27a', 'center', '400', FONT_T); }
  if (it.id === 'imbue' && !it.owned) { roundRect(-26, R + 0.5, 52, 17, 8.5, 'rgba(24,15,7,0.94)', '#c9a0ff', 1.6); txt('BÜYÜ', 0, R + 9.5, 12, '#e8d0ff', 'center', '400', FONT_T); }
  if (it.id === 'spellup') {
    for (let i = 0; i < 2; i++) circle((i - 0.5) * 9, -R - 2, 3.6, i < it.rank ? '#b8ff8a' : '#3a2a1a', '#1a0e04', 1.2);
    if (it.cost == null) { roundRect(-22, R + 0.5, 44, 17, 8.5, 'rgba(24,15,7,0.94)', '#9dff8a', 1.6); txt('MAX', 0, R + 9.5, 12, '#c8ffb0', 'center', '400', FONT_T); }
  }
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
  } else if (id === 'fan') { // ağır arbalet: kemik kundak, kaburga yaylar, kızıl cıvata
    ctx.save(); ctx.rotate(-0.5);
    roundRect(-3, -2, 6, 17, 2, '#4a3a44', dark, 2.2); // kundak
    ctx.beginPath(); ctx.moveTo(-13, 3); ctx.quadraticCurveTo(0, -9, 13, 3); ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12.5, 3); ctx.lineTo(0, 7); ctx.lineTo(12.5, 3); ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, -12); ctx.strokeStyle = dark; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-3, -11); ctx.lineTo(3, -11); ctx.closePath(); ctx.fillStyle = '#ff5a5a'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  } else if (id === 'nail') { // ruh çivisi: kara çivi, yeşil ruh ışığı
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 14, '120,255,140', 0.6); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.lineTo(7, -7); ctx.lineTo(2, -7); ctx.lineTo(0.6, 12); ctx.lineTo(-0.6, 12); ctx.lineTo(-2, -7); ctx.lineTo(-7, -7); ctx.closePath();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#3a3044'; ctx.fill();
  } else if (id === 'drain') { // ruh emici: yeşil damla içinde kalp
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.bezierCurveTo(9, -2, 10, 5, 0, 11); ctx.bezierCurveTo(-10, 5, -9, -2, 0, -13);
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#6ae08a'; ctx.fill();
    ctx.fillStyle = '#e8434b'; ctx.beginPath(); ctx.arc(-2.2, 1, 2.6, 0, Math.PI * 2); ctx.arc(2.2, 1, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4.6, 2); ctx.lineTo(0, 7.5); ctx.lineTo(4.6, 2); ctx.fill();
  } else if (id === 'ghost') { drawNecroGlyph('nm_fear', 12);
  } else if (id === 'corpse') { // ceset mancınığı: uçan kafatası ve hız çizgileri
    ctx.strokeStyle = dark; ctx.lineWidth = 2.5; for (const yy of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(-13, yy); ctx.lineTo(-6, yy); ctx.stroke(); }
    drawSkullIcon(3, 0, 11);
  } else if (id === 'plague') { // kara veba: yeşil fıçı damlası, kara benekler
    circle(0, 0, 11, '#4aa82a', dark, 3); circle(-3, -3, 2.6, '#14260c'); circle(4, 2, 2, '#14260c'); circle(-1, 5, 1.6, '#14260c');
    circle(-4, -6, 1.6, 'rgba(255,255,255,0.5)');
  } else if (id === 'blight') { // kara lanet: mor ışıklı kafatası
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 15, '180,90,255', 0.7); ctx.restore();
    drawSkullIcon(0, 0, 12);
  } else if (id === 'rite') { // kan ayini: kan damlası
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.bezierCurveTo(8, -2, 9, 4, 0, 10); ctx.bezierCurveTo(-9, 4, -8, -2, 0, -12);
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#d8202e'; ctx.fill(); circle(-3, 1, 2.2, 'rgba(255,255,255,0.5)');
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
  } else if (id === 'bow') {
    // kemik yay ve ok
    ctx.beginPath(); ctx.arc(-3, 0, 12, -1.15, 1.15); ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#efe8d2'; ctx.lineWidth = 2.8; ctx.stroke();
    const a = 1.15, ex = -3 + Math.cos(a) * 12, ey = Math.sin(a) * 12;
    ctx.beginPath(); ctx.moveTo(ex, -ey); ctx.lineTo(ex, ey); ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(10, 0); ctx.strokeStyle = dark; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = '#c8b890'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(8, -3.5); ctx.lineTo(8, 3.5); ctx.closePath(); ctx.fillStyle = '#9dff8a'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.stroke();
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
// Arayüz yerleşimi (KR düzeninden esinli): sol üst can/altın + dalga, sağ üst kare düğmeler,
// sol alt çerçeveli komutan portresi (altında seviye ve can plakası), yanında kare büyü kartları
const HUD = (() => { // sağ üst düğmeler ve sol alt portre (UI_K ile büyütülmüş); tam ekranda güvenli bölgenin köşelerine yaslanır (EDGE)
  const rb = 19 * UI_K * 1.1, rm = 16 * UI_K * 1.1, gap = 11 * UI_GAP, hr = 28 * UI_K; // sağ üst düğmeler %10 daha büyük (Caner, 10 Eki)
  return {
    get pause() { return { x: EDGE.r - 11 - rb, y: EDGE.t + 11 + rb, r: rb }; },
    get speed() { const p = this.pause; return { x: p.x - 2 * rb - gap, y: p.y, r: rb }; },
    get mute() { const p = this.speed; return { x: p.x - rb - rm - gap, y: p.y, r: rm }; },
    get heroes() { return [{ x: EDGE.l + 18 + hr, y: EDGE.b - 34 - hr, r: hr }, { x: EDGE.l + 18 + 3 * hr + 10, y: EDGE.b - 34 - hr, r: 24 * UI_K }]; },
  };
})();
const heroBadge = (hb) => ({ x: hb.x + hb.r * 0.8, y: hb.y - hb.r * 0.8, r: 10 * UI_K });

// küçük bilgi hapı: solda ikon, sağda değer
// Dalga göstergesinin rengi dalgaya göre ısınır: yeşil → sarı → turuncu; son dalga yanıp sönen kırmızı
function waveTint() {
  const n = G.endless ? 8 : G.lv.waves.length, w = G.endless ? (G.wave - 1) % 8 + 1 : G.wave;
  if (w <= 0) return null;
  if (w >= n) return ['rgba(190,30,20,0.96)', 'rgba(80,6,4,0.96)', '#ff9a7a', '255,60,30'];
  const k = (w - 1) / Math.max(1, n - 2); // 0 ilk dalga, 1 sondan bir önceki
  const stops = [[60, 120, 40], [170, 140, 30], [200, 90, 20], [190, 50, 20]];
  const f = k * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), t = f - i;
  const c = stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * t));
  return [`rgba(${c[0]},${c[1]},${c[2]},0.94)`, `rgba(${c[0] * 0.35 | 0},${c[1] * 0.35 | 0},${c[2] * 0.35 | 0},0.94)`, `rgb(${Math.min(255, c[0] + 70)},${Math.min(255, c[1] + 70)},${Math.min(255, c[2] + 60)})`];
}

// Dalga butonu yolun üstünde değil yanında durur (düşmanları örtmesin); yolun girişinde yön okları akar.
function waveButtonPos(pi) {
  if (G.waveBtn[pi]) return G.waveBtn[pi];
  const p = G.paths[pi];
  // HUD'a çarpmayan güvenli bölge (tam ekranda görünen kenarlara göre). Caner (10 Eki): düğme biraz daha geride, yolun ağzında dursun:
  // yolun ekran dışından gelen uzantısından başlar, kenara ve HUD'a değmeyen ilk noktaya oturur
  const E = EDGE, m = 32, blocked = (x, y) => x < E.l + m || x > E.r - m || y < E.t + m || y > E.b - m ||
    (x < E.l + 300 && y < E.t + 84) || (x > E.r - 190 && y < E.t + 80) || (x < E.l + 290 && y > E.b - 100);
  let d = -entryLead(p), q = pathPos(p, d);
  while (d < p.total - 40 && blocked(q.x, q.y)) { d += 3; q = pathPos(p, d); }
  return (G.waveBtn[pi] = { x: q.x, y: q.y, dx: q.dx, dy: q.dy });
}

// erken çağrı ödülü: kalan geri sayım ve dalga numarasıyla büyür
function earlyBonus() {
  return G.wave > 0 && G.waveCountdown > 0 ? Math.ceil(G.waveCountdown * (1.5 + 0.15 * G.wave) * diff().bounty) : 0;
}

// dalga çağrılınca buton kaybolur; sahadaki düşmanlar temizlenince (sonraki dalga kendiliğinden gelmeden önce) geri gelir
// Sonraki dalga, mevcut dalganın gelmemiş + sahadaki askeri %30'un altına inince çağrılabilir (Caner, 10 Eki; önceden saha boşalmalıydı)
const WAVE_CALL_AT = 0.3;
function waveCallable() {
  if (G.wave >= G.lv.waves.length) return false;
  if (G.wave === 0) return true;
  if (G.waveCountdown == null) return false;
  const left = G.spawners.reduce((a, sp) => a + Math.max(0, sp.left), 0) + G.enemies.reduce((a, e) => a + (e.dead ? 0 : 1), 0);
  return left < WAVE_CALL_AT * (G.waveN || 1);
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
  return { x: clamp(q.x, EDGE.l + 30, EDGE.r - 30), y: clamp(q.y, EDGE.t + 30, EDGE.b - 30), dx: b.dx, dy: b.dy };
}
const WAVE_BTN_K = 1.22; // erken çağrı düğmesinin büyüklüğü (Caner, 10 Eki: biraz daha büyük)
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
      ctx.beginPath(); ctx.arc(0, 0, (14 + ph * 16) * WAVE_BTN_K, 0, Math.PI * 2); ctx.stroke();
    }
    const s = WAVE_BTN_K * appear * pressScale('wave' + pi) * (1 + Math.sin(time * 5) * 0.04);
    ctx.scale(s, s);
    if (G.wave > 0 && G.waveCountdown != null) {
      ctx.strokeStyle = 'rgba(20,8,2,0.65)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - G.waveCountdown / G.waveCountdownMax)); ctx.stroke();
    }
    if (G.wavePeek && G.wavePeek.pi === pi) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 26, '255,210,90', 0.45 + Math.sin(time * 8) * 0.15); ctx.restore(); }
    ctx.rotate(ang);
    ctx.drawImage(wavePinIcon(), -24, -24, 48, 48);
    ctx.restore();
    // erken çağrı ödülü: işaretin altında minik hap
    if (bonus > 0) {
      const bx = clamp(b.x, EDGE.l + 30, EDGE.r - 30), by = b.y + 38 > EDGE.b ? b.y - 30 : b.y + 30;
      ctx.save(); ctx.globalAlpha = appear;
      ctx.font = `400 10.5px ${FONT_T}`; const tw = ctx.measureText('+' + bonus).width + 22;
      roundRect(bx - tw / 2, by - 8, tw, 16, 8, 'rgba(24,12,4,0.85)', '#e8bb4a', 1.2);
      drawIcon('coin', bx - tw / 2 + 8.5, by, 9);
      txt('+' + bonus, bx + 5, by + 0.5, 10.5, '#ffe27a', 'center', '400', FONT_T, false);
      ctx.restore();
    }
  }
}

// Dalga önizlemesi: dalga işaretine ilk dokunuşta, o girişten gelecek düşmanlar (simge, sayı, ad) küçük bir kutuda
function waveComposition(wi, pi) {
  // rütbeli türler asıl türün satırında toplanır: [tür, toplam, [er, kıdemli, yüzbaşı]]
  const cnt = new Map();
  for (const g of G.lv.waves[wi] || []) {
    if ((g.p || 0) !== pi) continue;
    for (const t of g.types || Array(g.n).fill(g.t)) {
      const d = ENEMIES[t], base = d.rank ? d.base : t;
      const r = cnt.get(base) || [base, 0, [0, 0, 0]];
      r[1]++; r[2][d.rank || 0]++; cnt.set(base, r);
    }
  }
  // sıralama: boss en altta, diğerleri sayıya göre
  return [...cnt.values()].sort((a, b) => (ENEMIES[a[0]].chief ? 1 : 0) - (ENEMIES[b[0]].chief ? 1 : 0) || b[1] - a[1]);
}
const RANK_COL = ['#8a6a3a', '#c8463a', '#ffc93a'];
function drawWavePeek() {
  const P = G.wavePeek;
  if (!P || !waveCallable() || P.w !== G.wave) { if (P) G.wavePeek = null; return; }
  if (time - P.t > 8) { G.wavePeek = null; return; }
  const list = waveComposition(G.wave, P.pi);
  if (!list.length) return;
  const b = waveBtnScreen(P.pi), k = easeOutBack(clamp((time - P.t) / 0.25, 0, 1)), fade = clamp((8 - (time - P.t)) / 0.4, 0, 1);
  // genişlik: en uzun satıra göre (ad + rütbe rozetleri)
  ctx.font = `800 10.5px ${FONT_B}`; lastFont = null;
  const rowW = (r) => ctx.measureText(ENEMIES[r[0]].name).width + (r[2][1] ? 22 : 0) + (r[2][2] ? 22 : 0);
  const rowH = 24, w = clamp(Math.max(...list.map(rowW)) + 84, 176, 280), h = 44 + list.length * rowH + 18;
  // kutu işaretin yanında: ekranda daha çok yer olan tarafta
  const right = b.x < W / 2, x0 = clamp(right ? b.x + 30 : b.x - 30 - w, 8, W - w - 8), y0 = clamp(b.y - h / 2, 8, H - h - 8);
  P.box = { x: x0, y: y0, w, h };
  ctx.save(); ctx.globalAlpha = fade;
  const ox = right ? x0 : x0 + w, oy = clamp(b.y, y0 + 12, y0 + h - 12);
  ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-ox, -oy);
  roundRect(x0 + 2, y0 + 4, w, h, 12, 'rgba(0,0,0,0.35)');
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(58,40,24,0.96)'); g.addColorStop(1, 'rgba(22,12,6,0.96)');
  roundRect(x0, y0, w, h, 12, g, '#d4ab5a', 1.6);
  // işarete bakan küçük uç
  ctx.beginPath(); const tx = right ? x0 : x0 + w, dir = right ? -1 : 1;
  ctx.moveTo(tx, oy - 7); ctx.lineTo(tx + dir * 8, oy); ctx.lineTo(tx, oy + 7); ctx.closePath();
  ctx.fillStyle = 'rgba(40,26,14,0.96)'; ctx.fill(); ctx.strokeStyle = '#d4ab5a'; ctx.lineWidth = 1.6; ctx.stroke();
  const N = G.lv.waves.length, last = G.wave === N - 1;
  txt(`DALGA ${G.wave + 1}/${N}`, x0 + 12, y0 + 16, 14, last ? '#ff8a6a' : '#ffd34d', 'left', '400', FONT_T);
  const total = list.reduce((a, r) => a + r[1], 0);
  txt(`${total} düşman`, x0 + w - 12, y0 + 16, 10.5, '#cdbb98', 'right', '800', FONT_B, false);
  ctx.fillStyle = 'rgba(212,171,90,0.4)'; ctx.fillRect(x0 + 10, y0 + 30, w - 20, 1);
  list.forEach(([t, n, rk], i) => {
    const d = ENEMIES[t], cy = y0 + 44 + i * rowH, cx = x0 + 22;
    circle(cx, cy, 10.5, '#1a120a', d.chief ? '#ff7a5a' : RANK_COL[0], 1.5);
    const im = d.base ? enemySprite(t) : spr('enemy_' + t);
    if (im) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 9.5, 0, Math.PI * 2); ctx.clip();
      const ih = d.chief ? 30 : 24; drawSprite(ctx, im, cx, cy + ih * 0.62, ih * im.width / im.height);
      ctx.restore();
    }
    txt('×' + n, x0 + 40, cy + 0.5, 12, '#fff', 'left', '400', FONT_T);
    txt(d.name, x0 + 68, cy + 0.5, 10.5, d.chief ? '#ff9a7a' : '#f0e2c4', 'left', '800', FONT_B, false);
    // rütbeliler: sağda kırmızı (kıdemli) ve altın (yüzbaşı) rozet, içinde sayısı
    let bx = x0 + w - 14;
    for (const r of [2, 1]) {
      if (!rk[r]) continue;
      circle(bx, cy, 8, RANK_COL[r], '#1a0e04', 1.4);
      if (r === 2) drawStar(bx, cy - 9.5, 3, '#ffe27a');
      txt(rk[r] + '', bx, cy + 0.5, 9.5, r === 2 ? '#3a2004' : '#fff', 'center', '800', FONT_B, false);
      bx -= 21;
    }
  });
  txt('Çağırmak için tekrar dokun', x0 + w / 2, y0 + h - 11, 9.5, '#ffe27a', 'center', '800', FONT_B, false);
  ctx.restore();
}

// portre kadrajı: görselin tepesinden (kafa) kare bir parça; kafa bandındaki piksellerin ortasına ortalanır (bir kez hesaplanır)
const HEAD_CROP = new Map();
function headCrop(im) {
  if (HEAD_CROP.has(im)) return HEAD_CROP.get(im);
  let c = null;
  try {
    const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height, k = Math.min(1, 200 / H);
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * k)); cv.height = Math.max(1, Math.round(H * k));
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height);
    const d = g.getImageData(0, 0, cv.width, cv.height).data, w = cv.width, h = cv.height;
    let y0 = -1; for (let y = 0; y < h && y0 < 0; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 60) { y0 = y; break; }
    if (y0 >= 0) {
      const s = h * 0.34; let sx = 0, n = 0;
      for (let y = y0; y < Math.min(h, y0 + s * 0.6); y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 60) { sx += x; n++; }
      const cx = n ? sx / n : w / 2;
      c = { x: (cx - s / 2) / k, y: (y0 - s * 0.06) / k, s: s / k };
    }
  } catch (e) { c = null; }
  HEAD_CROP.set(im, c); return c;
}
function drawHeroPortrait(h, hb, i) {
  const selHero = G.sel && G.sel.kind === 'hero' && G.sel.hero === h, pts = heroPoints(h);
  ctx.save(); ctx.translate(hb.x, hb.y); const hs = pressScale('hud_hero' + i); ctx.scale(hs, hs);
  if (selHero) glow(ctx, 0, 0, hb.r * 2, '120,220,255', 0.55 + Math.sin(time * 5) * 0.2);
  // alt plaka: solda seviye kutusu, sağda can barı
  const pw = hb.r * 2.3, py = hb.r - 2;
  hudFrame(-pw / 2, py, pw, 20, 6, false);
  roundRect(-pw / 2 + 4, py + 4, 15, 12, 3, '#16101f', 'rgba(0,0,0,0.7)', 1);
  hudNum(h.lvl + '', -pw / 2 + 11.5, py + 10.5, 11, '#f2ecd8', 'center');
  const bw = pw - 26, bx = -pw / 2 + 22;
  roundRect(bx, py + 6, bw, 8, 3, '#0e0a14', 'rgba(0,0,0,0.8)', 1);
  roundRect(bx + 1, py + 7, (bw - 2) * clamp(h.hp / h.maxHp, 0, 1), 6, 2.5, h.hp / h.maxHp > 0.35 ? '#5fd04a' : '#e0503a');
  if (h.lvl < HERO_MAX) roundRect(bx + 1, py + 12, (bw - 2) * clamp(h.xp / xpNeed(h.lvl), 0, 1), 1.5, 1, '#ffd34d');
  circle(0, 5, hb.r + 6, 'rgba(0,0,0,0.45)');
  const rim = ctx.createLinearGradient(0, -hb.r, 0, hb.r); rim.addColorStop(0, '#d8d2e8'); rim.addColorStop(0.5, '#6e6886'); rim.addColorStop(1, '#2c2640');
  circle(0, 0, hb.r + 6, rim, '#0a0612', 2);
  circle(0, 0, hb.r + 4.5, null, 'rgba(255,255,255,0.35)', 1);
  const bgp = ctx.createRadialGradient(-6, -10, 3, 0, 0, hb.r);
  bgp.addColorStop(0, `rgba(${h.def.aura},0.9)`); bgp.addColorStop(1, '#14181e');
  circle(0, 0, hb.r, bgp);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, hb.r - 1, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = h.dead ? 0.35 : 1;
  const im = heroSprite(h.def);
  if (im) { const c = headCrop(im); if (c) ctx.drawImage(im, c.x, c.y, c.s, c.s, -hb.r, -hb.r, hb.r * 2, hb.r * 2); else { const ph = hb.r * 3.6; drawSprite(ctx, im, 3, hb.r * 2.35, ph * im.width / im.height); } }
  ctx.restore();
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
  } else { ctx.restore(); return; } // seviye artık alt plakada
  ctx.restore();
}

// kahraman gücü düğmesinin simgesi
function drawUltGlyph(id, r) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (id === 'commander') { drawBat(-6, -2, 1.1, 1, time * 9, 1); drawBat(7, 4, 0.8, -1, time * 9 + 2, 1); drawBat(1, 9, 0.7, 1, time * 9 + 4, 1); }
  else if (id === 'spartacus') { // dönen zincir halkası
    for (let k = 0; k < 8; k++) { const a = time * 3 + k * Math.PI / 4; ctx.save(); ctx.translate(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42); ctx.rotate(a + (k % 2 ? 0 : Math.PI / 2));
      ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.13, r * 0.075, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#d8ccb8'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
  } else if (id === 'leonidas') { // bronz hoplit kalkanı ve lambda
    circle(0, 0, r * 0.55, '#b0863a', '#3a2408', 2); circle(0, 0, r * 0.42, null, 'rgba(255,230,160,0.55)', 1.2);
    ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.24); ctx.lineTo(0, -r * 0.26); ctx.lineTo(r * 0.2, r * 0.24); ctx.stroke();
  }
  ctx.restore();
}
// yarasa: kanatları çırpan küçük siluet, kızıl gözler
function drawBat(x, y, s, face, ph, a = 1) {
  const f = Math.sin(ph), span = 9 * s;
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1); ctx.globalAlpha *= a;
  ctx.fillStyle = '#1c0c16'; ctx.strokeStyle = '#05020a'; ctx.lineWidth = 0.7 * s;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, -1 * s);
    ctx.quadraticCurveTo(sd * span * 0.5, -6 * s * f - 3 * s, sd * span, -4 * s * f);
    ctx.lineTo(sd * span * 0.75, 0.5 * s - 2 * s * f); ctx.lineTo(sd * span * 0.5, 1.5 * s - 2.5 * s * f); ctx.lineTo(sd * span * 0.25, 1 * s - 1 * s * f);
    ctx.lineTo(0, 1.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 2 * s, 2.6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-1.6 * s, -2 * s); ctx.lineTo(-1 * s, -3.6 * s); ctx.lineTo(-0.3 * s, -2.2 * s); ctx.moveTo(1.6 * s, -2 * s); ctx.lineTo(1 * s, -3.6 * s); ctx.lineTo(0.3 * s, -2.2 * s); ctx.fill();
  ctx.fillStyle = '#ff3a3a'; ctx.fillRect(-1.2 * s, -1.3 * s, 0.8 * s, 0.7 * s); ctx.fillRect(0.4 * s, -1.3 * s, 0.8 * s, 0.7 * s);
  ctx.restore();
}
// Korku ruhları: korkan düşmanın arkasından (kale yönünden) uçarak kovalar, uluyarak üstüne atılır
function drawFearGhosts() {
  for (const e of G.enemies) {
    const g = e.fearGhost;
    if (!g || e.dead) continue;
    if (!(e.fearT > 0)) { e.fearGhost = null; continue; }
    const a = Math.min(1, g.t / 0.3, e.fearT / 0.5), lunge = Math.max(0, Math.sin(G.t * 4 + g.ph)) * 6;
    const q = pathPos(e.p, e.d + 22 - lunge, e.off + Math.sin(G.t * 3 + g.ph) * 8), gx = q.x, gy = q.y - 22 - Math.sin(G.t * 5 + g.ph) * 3;
    drawSpecter(gx, gy, 1, e.x < gx ? -1 : 1, G.t * 6 + g.ph, a * 0.9);
  }
}
function drawSpecter(x, y, s, face, ph, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face * s, s); ctx.globalAlpha *= a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 22, '170,110,255', 0.35); ctx.restore();
  const gr = ctx.createLinearGradient(0, -10, -16, 10); gr.addColorStop(0, 'rgba(238,228,255,0.92)'); gr.addColorStop(1, 'rgba(150,90,255,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(6, -6);
  ctx.bezierCurveTo(6, -14, -6, -14, -6, -6); // baş
  ctx.quadraticCurveTo(-10, 0, -18, 4 + Math.sin(ph) * 3); ctx.quadraticCurveTo(-10, 4, -12, 9 + Math.sin(ph + 1) * 3); // dalgalı kuyruk
  ctx.quadraticCurveTo(-4, 4, 2, 6); ctx.quadraticCurveTo(7, 2, 6, -6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(225,210,255,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); // öne uzanan pençeli kollar
  ctx.moveTo(3, -1); ctx.quadraticCurveTo(10, -3 + Math.sin(ph) * 2, 14, 0 + Math.sin(ph) * 2); ctx.moveTo(2, 2); ctx.quadraticCurveTo(9, 3, 13, 5 + Math.cos(ph) * 2); ctx.stroke();
  ctx.fillStyle = '#1a0628'; ctx.beginPath(); ctx.ellipse(-1, -8, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.ellipse(3, -8, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.5, -3.5, 1.4, 2.2 + Math.sin(ph * 1.3) * 0.6, 0, 0, Math.PI * 2); ctx.fill(); // uluyan ağız
  ctx.restore();
}
function drawBatSwarms() {
  for (const z of G.zones) {
    if (z.kind === 'chains') { // dönen zincirler: üç kırık zincir kolu, halka halka, kızıl kıvılcımlı
      const a0 = Math.min(1, z.t / 0.25, (z.life - z.t) / 0.4);
      ctx.save(); ctx.globalAlpha = a0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, z.x, z.y - 6, z.r * 0.8, '255,80,70', 0.18); ctx.restore();
      for (let arm = 0; arm < 3; arm++) {
        const base = z.seed + z.t * 7 + arm * Math.PI * 2 / 3;
        for (let k = 1; k <= 9; k++) {
          const rr = z.r * k / 9, a = base - k * 0.09, x = z.x + Math.cos(a) * rr, y = z.y - 8 + Math.sin(a) * rr * 0.45;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a + (k % 2 ? 0 : Math.PI / 2));
          ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.8, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = '#a89a88'; ctx.lineWidth = 1.3; ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
      continue;
    }
    if (z.kind !== 'bats') continue;
    const a = Math.min(1, (z.life - z.t) / 0.4);
    if (z.t < 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, z.x, z.y - 8, z.r * 0.9, '180,20,40', 0.15 * (1 - z.t / 0.5)); ctx.restore(); }
    for (let i = 0; i < z.n; i++) {
      const ph = z.seed + i * 2.399, sp = (i % 2 ? 1 : -1) * (2.2 + (i % 3) * 0.5), rr = z.r * (0.35 + 0.55 * ((i * 0.37) % 1));
      const ox = z.x + Math.cos(ph + z.t * sp) * rr, oy = z.y - 14 + Math.sin(ph + z.t * sp) * rr * 0.45 + Math.sin(z.t * 7 + i) * 4;
      const fly = clamp((z.t - i * 0.015) / 0.35, 0, 1), e = easeInOut(fly); // kahramandan uçup gelir
      const x = lerp(z.hx, ox, e), y = lerp(z.hy, oy, e) - Math.sin(Math.PI * e) * 30;
      const out = z.t > z.life - 0.4 ? (z.t - (z.life - 0.4)) / 0.4 : 0; // sonda dağılıp uçar
      drawBat(x + Math.cos(ph) * out * 60, y - out * 50, 0.8 + 0.25 * ((i * 0.53) % 1), Math.cos(ph + z.t * sp) * sp > 0 ? -1 : 1, time * 22 + i, a);
    }
  }
}

// metal-taş çerçeveli kutu (kare düğme, portre, büyü kartı)
function hudFrame(x, y, w, h, r, fill) {
  roundRect(x + 1.5, y + 3.5, w, h, r, 'rgba(0,0,0,0.5)');
  const rim = ctx.createLinearGradient(0, y, 0, y + h);
  rim.addColorStop(0, '#c9c4d8'); rim.addColorStop(0.45, '#6e6886'); rim.addColorStop(1, '#2c2640');
  roundRect(x, y, w, h, r, rim, '#0a0612', 2);
  roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1, null, 'rgba(255,255,255,0.35)', 1);
  if (fill !== false) {
    let f = fill;
    if (!f) { f = ctx.createLinearGradient(0, y, 0, y + h); f.addColorStop(0, '#3a3050'); f.addColorStop(1, '#16101f'); }
    roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3), f, 'rgba(0,0,0,0.7)', 1.2);
  }
}
// yatık (italik görünümlü) kalın sayı
function hudNum(s, x, y, size, col, align = 'left') {
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.16, 1, 0, 0);
  txt(s, 0, 0, size, col, align, '400', FONT_T);
  ctx.restore();
}
function hudBar(x, y, w, h) {
  roundRect(x + 1, y + 2, w, h, h / 2.4, 'rgba(0,0,0,0.35)');
  roundRect(x, y, w, h, h / 2.4, 'rgba(12,8,18,0.86)', 'rgba(205,190,235,0.45)', 1.4);
}
function drawHud() {
  // altın / can değişince sayı zıplar
  if (G.goldShown !== Math.floor(G.gold)) { if (G.goldShown != null) G.goldPop = time; G.goldShown = Math.floor(G.gold); }
  if (G.livesShown !== G.lives) { if (G.livesShown != null) G.livesPop = time; G.livesShown = G.lives; }
  const pop = (t) => (t != null ? 1 + Math.max(0, 1 - (time - t) / 0.35) * 0.3 : 1);
  // sol üst: küçük can + altın şeridi, altında dolan dalga çubuğu (%20 büyük, sol üst köşeye yaslı)
  ctx.save(); ctx.translate(EDGE.l, EDGE.t); ctx.scale(1.2, 1.2);
  hudBar(8, 7, 136, 24);
  drawIcon('heart', 22, 19, 16);
  ctx.save(); ctx.translate(34, 20); ctx.scale(pop(G.livesPop), pop(G.livesPop)); hudNum(G.lives + '', 0, 0, 14, G.lives <= 5 ? '#ff8a7a' : '#fff'); ctx.restore();
  drawIcon('coin', 76, 19, 16);
  ctx.save(); ctx.translate(88, 20); ctx.scale(pop(G.goldPop), pop(G.goldPop)); hudNum(Math.floor(G.gold) + '', 0, 0, 14, '#ffe27a'); ctx.restore();
  const n = G.endless ? 8 : G.lv.waves.length, last = !G.endless && G.wave >= n && G.wave > 0, wk = G.endless ? ((G.wave - 1) % 8 + 1) / 8 * (G.wave > 0) : clamp(G.wave / n, 0, 1);
  hudBar(8, 34, 96, 20);
  // dolum: dalga ilerledikçe yeşilden kırmızıya, son dalgada tamamen dolu ve nabız gibi
  if (wk > 0) {
    const fw = (96 - 6) * wk, wt = waveTint();
    const fg = ctx.createLinearGradient(0, 37, 0, 51);
    fg.addColorStop(0, wt ? wt[2] : '#8fdc6a'); fg.addColorStop(1, wt ? wt[0] : '#3a7a2a');
    ctx.save(); ctx.globalAlpha = last ? 0.75 + Math.sin(time * 6) * 0.2 : 0.85;
    roundRect(11, 37, fw, 14, 5, fg); ctx.restore();
    roundRect(12, 38, fw - 2, 4, 2, 'rgba(255,255,255,0.18)');
  }
  drawIcon('skull', 21, 44, 14);
  ctx.save(); ctx.translate(58, 45); ctx.scale(pop(G.wavePop), pop(G.wavePop)); hudNum(G.endless ? `${G.wave} ∞` : `${G.wave}/${n}`, 0, 0, 12, '#fff', 'center'); ctx.restore();
  ctx.restore();

  // sağ üst: duraklat, hız, ses
  roundBtn('hud_pause', HUD.pause.x, HUD.pause.y, HUD.pause.r, 'pause', null);
  roundBtn('hud_speed', HUD.speed.x, HUD.speed.y, HUD.speed.r, () => {
    drawIcon('fast', 0, -3, 15, speed > 1 ? '#ffe27a' : '#fff');
    txt(speed + 'x', 0, 9, 10, speed > 1 ? '#ffe27a' : '#fff', 'center', '400', FONT_T);
  }, null, { active: speed > 1 });
  roundBtn('hud_mute', HUD.mute.x, HUD.mute.y, HUD.mute.r, muted ? 'mute' : 'sound', null);

  G.heroes.forEach((h, i) => drawHeroPortrait(h, HUD.heroes[i], i));

  spellIds().forEach((id, i) => {
    const b = spellBtn(i), cd = G.spells[id], info = spellInfo(id), max = info.cd;
    const active = G.mode && G.mode.kind === 'spell' && G.mode.id === id, ready = cd <= 0, peek = G.spellPeek === id;
    const col = info.hero ? info.hero.def.aura : info.necro ? info.necro.col : '120,200,255';
    ctx.save(); ctx.translate(b.x, b.y); const s = pressScale('hud_' + id) * (peek ? 1.12 : 1); ctx.scale(s, s);
    if (active) glow(ctx, 0, 0, b.r * 2.3, '255,220,120', 0.7 + Math.sin(time * 8) * 0.2);
    else if (peek) glow(ctx, 0, 0, b.r * 2.2, '255,240,200', 0.5 + Math.sin(time * 6) * 0.15);
    else if (ready) glow(ctx, 0, 0, b.r * 1.9, col, 0.25 + Math.sin(time * 3) * 0.1);
    circle(0, 5, b.r + 4, 'rgba(0,0,0,0.45)');
    const rm = ctx.createLinearGradient(0, -b.r, 0, b.r);
    rm.addColorStop(0, ready ? '#d8d2e8' : '#8a8494'); rm.addColorStop(0.5, ready ? '#6e6886' : '#4a4452'); rm.addColorStop(1, '#2c2640');
    circle(0, 0, b.r + 4, rm, '#0a0612', 2);
    circle(0, 0, b.r + 2.5, null, 'rgba(255,255,255,0.3)', 1);
    const bd = ctx.createRadialGradient(-5, -7, 2, 0, 0, b.r);
    bd.addColorStop(0, `rgba(${col},0.95)`); bd.addColorStop(1, '#120c18');
    circle(0, 0, b.r, bd);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, b.r - 1, 0, Math.PI * 2); ctx.clip();
    if (info.hero) { if (info.hero.id === 'zeynep') drawNecroGlyph('nm_scream', b.r); else drawUltGlyph(info.hero.id, b.r); }
    else if (info.necro) drawNecroGlyph(id, b.r);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(0, -b.r * 0.5, b.r * 0.6, b.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    if (!ready) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / max)); ctx.fill();
      txt(Math.ceil(cd) + '', 0, 1, 16, '#fff', 'center', '400', FONT_T);
    }
    if (peek) { ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, b.r + 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  });

  drawWaveButtons();
  drawWavePeek();

  // bilgi paneli
  const info = infoText();
  if (info) {
    // sol alttaki portre ve büyü düğmeleriyle sağ kenar arasına sığar; uzun açıklama satırlara bölünür (ekrandan taşmasın)
    const left = hudLeft(), maxW = EDGE.r - left - 10, chips = info[2] || null;
    ctx.font = `700 13px ${FONT_B}`;
    const lines = info[1] ? wrapLines(info[1], maxW - 30, chips ? 12 : 13, '700', FONT_B, chips ? 2 : 3) : [];
    let tw = 0; for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
    ctx.font = `400 16px ${FONT_T}`; tw = Math.max(tw, ctx.measureText(info[0]).width);
    ctx.font = `800 12px ${FONT_B}`; const cw = chips ? chips.map(c => ctx.measureText(String(c[1])).width + 22) : []; const chipsW = cw.reduce((a, b) => a + b + 8, 0);
    tw = Math.max(tw, chipsW);
    const w = clamp(tw + 40, 260, maxW), ph = 30 + (chips ? 20 : 0) + lines.length * (chips ? 14 : 16), y0 = H - 10 - ph;
    const x0 = clamp(W / 2 - w / 2, left, W - w - 10), cxp = x0 + w / 2;
    roundRect(x0 + 2, y0 + 5, w, ph, 15, 'rgba(0,0,0,0.3)');
    const g = ctx.createLinearGradient(0, y0, 0, y0 + ph); g.addColorStop(0, 'rgba(62,44,26,0.96)'); g.addColorStop(1, 'rgba(24,16,8,0.96)');
    roundRect(x0, y0, w, ph, 15, g, '#d4ab5a', 2);
    txt(info[0], cxp, y0 + 16, 16, '#ffd34d', 'center', '400', FONT_T);
    let ly = y0 + 34;
    if (chips) { // simgeli değerler: koyu kapsüller içinde, ortalı
      let cx = cxp - chipsW / 2 + 4;
      chips.forEach((c, i) => {
        roundRect(cx, ly - 8, cw[i], 16, 8, 'rgba(0,0,0,0.35)', 'rgba(212,171,90,0.45)', 1);
        statGlyph(c[0], cx + 9, ly); txt(String(c[1]), cx + 17, ly + 0.5, 12, '#f8eed8', 'left', '800', FONT_B, false);
        cx += cw[i] + 8;
      });
      ly += 19;
    }
    lines.forEach((l, i) => txt(l, cxp, ly + i * (chips ? 14 : 16), chips ? 12 : 13, chips ? '#d8ccb4' : '#f2e8d4', 'center', '700', FONT_B, false));
  }
  const hint = G.mode ? (G.mode.kind === 'rally' ? (G.mode.castle ? (NECRO ? 'Ölüleri' : 'Paralı askerleri') + ' göndereceğin yeri seç (haritanın her yeri)' : 'Askerlerin toplanma noktasını seç') : `${spellInfo(G.mode.id).name}: hedefi seç`)
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
    const sw = ctx.measureText(b.sub).width, w = Math.min(W - 30, Math.max(170, sw + 28)), fs = sw + 28 > w ? 9.5 * (w - 28) / sw : 9.5; // ekrana sığar
    roundRect(-w / 2, -15, w, 30, 10, 'rgba(24,16,8,0.82)', 'rgba(255,211,77,0.7)', 1.2);
    txt(b.title, 0, -4.5, 11.5, '#ffd34d', 'center', '400', FONT_T, false);
    txt(b.sub, 0, 8, fs, '#e8dcc4', 'center', '700', FONT_B, false);
    ctx.restore();
    return;
  }
  const by = G.intro ? 200 : G.enemies.some(o => o.def.chief && !o.dead) ? 140 : 112; // tanıtım kartı / boss barı açıkken altına iner
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, by); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e);
  if (b.red) { const k = 1 + Math.sin(time * 10) * 0.04; ctx.scale(k, k); }
  const sl = wrapLines(b.sub, W - 120, 13, '700', FONT_B, 2); // uzun alt yazı iki satıra bölünür, ekrandan taşmaz
  ctx.font = `700 13px ${FONT_B}`; let sw = 0; for (const l of sl) sw = Math.max(sw, ctx.measureText(l).width);
  const w = Math.min(W - 60, Math.max(320, sw + 48)), bh = 52 + (sl.length - 1) * 15;
  roundRect(-w / 2 + 2, -24 + 5, w, bh, 14, 'rgba(0,0,0,0.3)');
  const g = ctx.createLinearGradient(0, -24, 0, 28);
  g.addColorStop(0, b.red ? 'rgba(150,24,16,0.97)' : 'rgba(62,44,26,0.96)'); g.addColorStop(1, b.red ? 'rgba(60,6,4,0.97)' : 'rgba(24,16,8,0.96)');
  if (b.red) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, w * 0.6, '255,60,30', 0.25 + Math.sin(time * 10) * 0.08); ctx.restore(); }
  roundRect(-w / 2, -24, w, bh, 14, g, b.red ? '#ff8a6a' : '#ffd34d', 2);
  txt(b.title, 0, -7, b.red ? 21 : 18, b.red ? '#fff0c0' : '#ffd34d', 'center', '400', FONT_T);
  sl.forEach((l, i) => txt(l, 0, 13 + i * 15, 13, '#f2e8d4', 'center', '700', FONT_B, false));
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
  const pk = G.spellPeek || (G.mode && G.mode.kind === 'spell' && G.mode.id);
  if (pk) {
    const I = spellInfo(pk), cd = G.spells[pk];
    return [I.name, `${I.U.short || I.U.desc} · ${cd > 0 ? Math.ceil(cd) + ' sn sonra hazır' : 'Haritada hedefe dokun'}`];
  }
  if (G.sel && G.sel.kind === 'tower' && G.preview && G.preview.id === 'extra') {
    const E = TOWER_EXTRA[G.preview.type], t = G.sel.tower;
    return [t.extra ? `${E.name} (alındı)` : `${E.name} — ${E.cost} altın`, `${E.desc} · ${E.cd} sn'de bir`];
  }
  if (G.sel && G.sel.kind === 'hatch') {
    const C = HATCH.ghoul;
    return [`Mahzen Kapağı — ${HATCH.cost} altın`, `Gulyabani çıkar (Can ${C.hp} · Hasar ${C.dmg[0]}-${C.dmg[1]} · Zırh %${Math.round(C.armor * 100)}), yolu tutar; ölürse ${HATCH.respawn} sn sonra yeniden çıkar. Meşaleciler kapağı mühürler!`];
  }
  if (G.sel && G.sel.kind === 'castle') {
    const c = G.castle, L = CASTLE.levels[c.lvl], N = CASTLE.levels[c.lvl + 1];
    if (NECRO) { // şapel ağacı: Kara Şapel → Kemik Devi → Kemik Kolos
      const P = G.preview;
      if (P && P.id === 'spellup') {
        const S = NECRO_SPELLS[P.type], r = spellRank(P.type), L2 = SPELL_UP[P.type];
        return r >= 2 ? [`${S.name} — son kademe`, L2.join(' · ')] : [`${S.name} ${r + 1}. kademe — ${SPELL_UP.cost[r]} altın`, `${L2[r]} · bekleme %10 kısa`];
      }
      if (G.preview && G.preview.id === 'upgrade' && N) return [`Yükselt → ${N.title} — ${N.cost} altın`, N.perk];
      return [`${L.title}${N ? '' : ' (son)'}`, `${L.perk}${N ? ` · Sonraki: ${N.title}` : ''}${c.lvl ? ' · Bayrak: devi gönder' : ''}`];
    }
    const st = (X) => `${X.archers} okçu · Hasar ${X.dmg[0]}-${X.dmg[1]} · Menzil ${CASTLE.range} · Atış ${X.rate}sn`;
    if (G.preview && G.preview.id === 'upgrade' && N) return [`Yükselt → ${N.title} — ${N.cost} altın`, `${st(N)} · ${N.perk}`];
    return [`${L.title} — Seviye ${c.lvl + 1}${N ? '' : ' (son)'}`, `${st(L)} · ${N ? 'Ok: yükselt' : L.perk} · Bayrak: ${NECRO ? 'ölüleri' : 'paralı askerleri'} gönder`];
  }
  if (G.preview && G.preview.id === 'build') {
    const T = TOWERS[G.preview.type], L = T.levels[0];
    if (G.preview.blocked) return [T.name, 'Haritada yalnız bir Lanet Kulesi kurulabilir'];
    return [`${T.name} — ${L.cost} altın`, T.desc || '', towerChips(G.preview.type, L)];
  }
  if (G.sel && G.sel.kind === 'tower') {
    const t = G.sel.tower, PD = t.path && ARCHER_PATH[t.path];
    if (G.preview && G.preview.id === 'path') { // Kemik Kulesi: okçu ya da arbaletçi yolu
      const P = ARCHER_PATH[G.preview.type], L = t.def.levels[1];
      return [`${P.name} → ${P.titles[1]} — ${L.cost} altın`, P.desc, towerChips(t.type, Object.assign({}, L, { rate: L.rate * P.rate, dmg: L.dmg.map(v => v * P.dmg) }))];
    }
    if (G.preview && G.preview.id === 'imbuepick') {
      const I = IMBUE[G.preview.type];
      return [`${t.type === 'archer' ? I.arrow : I.melee} — ${I.cost} altın`, `${TR(I.desc)} · ${TR('kule başına tek büyü')}`]; // açıklama kendi içinde · taşır: parça parça çevrilir
    }
    if (G.preview && G.preview.id === 'imbue' && t.imbue) { const I = IMBUE[t.imbue]; return [`${t.type === 'archer' ? I.arrow : I.melee} (alındı)`, I.desc]; }
    if (G.sel.sub === 'imbue') return ['Silah büyüsü seç', `${t.type === 'archer' ? 'Oklar' : 'Kılıçlar'} her vuruşta düşmana bir etki bırakır: alev, zehir ya da buz`];
    if (G.preview && G.preview.id === 'upgrade') {
      const L = t.def.levels[t.lvl + 1];
      return [`Yükselt → ${towerTitle(t, t.lvl + 1)} — ${L.cost} altın`, `Yeni: ${(PD && PD.perks[t.lvl + 1]) || L.perk}`, towerChips(t.type, PD ? Object.assign({}, L, { rate: L.rate * PD.rate, dmg: L.dmg.map(v => v * PD.dmg) }) : L)];
    }
    if (G.preview && G.preview.id === 'sell') return ['Sat', `${Math.floor(t.spent * SELL_RATIO)} altın geri al`];
    if (G.preview && G.preview.id === 'ability') {
      const a = G.preview.ab, r = (t.ab && t.ab[a.id]) || 0;
      if (r >= a.ranks.length) return [`${a.name} — En üst kademe`, a.desc(a.ranks[r - 1])];
      if (!t.spec) return [`${SPEC[a.id].title}: ${a.name} — ${a.ranks[r].cost} altın`, `${a.desc(a.ranks[r])} · ${SPEC[a.id].who} · Uzmanlık +%20 güç verir, diğer yol kapanır`];
      return [`${a.name} ${r + 1}/${a.ranks.length} — ${a.ranks[r].cost} altın`, a.desc(a.ranks[r])];
    }
    const L = t.def.levels[t.lvl];
    const C = towerChips(t.type, effLevel(t));
    if (t.spec) return [`${SPEC[t.spec].title}${t.imbue ? ' · ' + (t.type === 'archer' ? IMBUE[t.imbue].arrow : IMBUE[t.imbue].melee) : ''}`, imbueOpen(t) && !t.imbue ? `${SPEC[t.spec].who} · Silah büyüsü açıldı: yandaki düğme` : SPEC[t.spec].who, C];
    if (t.lvl >= t.def.levels.length - 1) return [`${towerTitle(t)} — Seviye ${t.lvl + 1} (son)`, PD ? `Uzmanlık: yukarıdaki düğme (${SPEC[PD.spec].title})` : `Uzmanlık seç: yukarıdaki ${t.def.abilities.length === 3 ? 'üç' : 'iki'} düğmeden biri`, C];
    if (NECRO && t.type === 'archer' && t.lvl === 0) return [`${L.title} — Seviye 1`, `${TR(L.perk)} · ${TR('Yükseltirken yolunu seç')}: ${TR('okçular ya da arbaletçiler')}`, C];
    return [`${towerTitle(t)} — Seviye ${t.lvl + 1}`, (PD && PD.perks[t.lvl]) || L.perk, C];
  }
  return null;
}
function towerStats(type, L) {
  if (type === 'altar') return `Menzil ${L.range} · dirençler -%${Math.round(L.res * 100)} · +%${Math.round(L.curse * 100)} hasar alır · %${Math.round(L.slow * 100)} yavaş · %${Math.round(L.weak * 100)} güçsüz`;
  if (type === 'barracks') return `3 asker · Can ${L.hp} · Hasar ${L.dmg[0]}-${L.dmg[1]} · Zırh %${Math.round(L.armor * 100)}`;
  let s = `Hasar ${L.dmg[0]}-${L.dmg[1]} · Menzil ${L.range} · Atış ${L.rate}sn`;
  if (L.splash) s += ' · Alan';
  if (type === 'mage') s += ' · Büyü';
  return s;
}
// Kingdom Rush tarzı kısa değerler (10 Eki): simge + kısa söz; alt panelde uzun cümle yerine
const RATE_WORD = (r) => (r < 0.6 ? 'Çok hızlı' : r < 1 ? 'Hızlı' : r < 1.6 ? 'Orta' : 'Yavaş');
const RANGE_WORD = (r) => (r > 185 ? 'Çok uzun' : r > 150 ? 'Uzun' : r > 115 ? 'Orta' : 'Kısa');
function towerChips(type, L) {
  if (type === 'altar') return [['target', RANGE_WORD(L.range)], ['skull', `Direnç -%${Math.round(L.res * 100)}`], ['clock', `%${Math.round(L.slow * 100)} yavaş`]];
  if (type === 'barracks') return [['heart', L.hp], ['sword', `${L.dmg[0]}-${L.dmg[1]}`], ['shield', `%${Math.round(L.armor * 100)}`]];
  const c = [['sword', `${Math.round(L.dmg[0])}-${Math.round(L.dmg[1])}`], ['clock', RATE_WORD(L.rate)], ['target', RANGE_WORD(L.range)]];
  if (L.splash) c.push(['blast', 'Alan']);
  if (type === 'mage') c.push(['magic', 'Büyü']);
  if (TOWERS[type] && TOWERS[type].air) c.push(['wing', 'Uçan']);
  return c;
}
// küçük değer simgeleri (panel için, ~12 px)
function statGlyph(k, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const st = (c, w) => { ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.lineWidth = w + 2; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); };
  ctx.beginPath();
  if (k === 'sword') { ctx.moveTo(-4, 4); ctx.lineTo(4, -4); st('#e8e8f0', 1.8); ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(-1, 5); st('#d8a040', 1.6); }
  else if (k === 'clock') { ctx.arc(0, 0, 4.5, 0, Math.PI * 2); st('#f0e2c4', 1.4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3); ctx.moveTo(0, 0); ctx.lineTo(2.2, 1); st('#f0e2c4', 1.2); }
  else if (k === 'target') { ctx.arc(0, 0, 4.8, 0, Math.PI * 2); st('#ff8a6a', 1.3); ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); st('#ff8a6a', 1.3); }
  else if (k === 'shield') { ctx.moveTo(0, -5); ctx.lineTo(4.5, -3); ctx.lineTo(3.5, 2); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 2); ctx.lineTo(-4.5, -3); ctx.closePath(); st('#9fd0ff', 1.4); }
  else if (k === 'blast') { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 2.4 : 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); st('#ffb060', 1.3); }
  else if (k === 'magic') { ctx.moveTo(0, -5); ctx.lineTo(1.4, -1.4); ctx.lineTo(5, 0); ctx.lineTo(1.4, 1.4); ctx.lineTo(0, 5); ctx.lineTo(-1.4, 1.4); ctx.lineTo(-5, 0); ctx.lineTo(-1.4, -1.4); ctx.closePath(); st('#c8a0ff', 1.3); }
  else if (k === 'wing') { ctx.moveTo(-5, 2); ctx.quadraticCurveTo(-1, -5, 5, -3); ctx.quadraticCurveTo(1, -1, 2, 3); ctx.quadraticCurveTo(-1, 1, -5, 2); st('#b8f0c8', 1.2); }
  else if (k === 'heart' || k === 'skull') { ctx.restore(); drawIcon(k, x, y, 11, k === 'heart' ? '#ff6a6a' : '#d8c0ff'); return; }
  ctx.restore();
}


// Kale görseli (izometrik, kapısı sol önde): kapı yolun bittiği noktaya gelecek şekilde biraz sola-aşağı kaydırılır.
// Eski yedek görsel (kışla) ise kale noktasına ortalanır.
function castlePlace(x, y, im) {
  if (im === spr('tower_barracks_3')) return { x, y, w: 118 * BUILD_K };
  if (isKeep(im)) { const w = KEEP.w, h = w * im.height / im.width; return { x: x + (0.5 - KEEP.gate[0]) * w, y: y + (1 - KEEP.gate[1]) * h, w }; } // kapı eşiği = yolun ucu
  if (isAvlu(im)) { const w = AVLU.w, h = w * im.height / im.width; return { x: x + (0.5 - AVLU.gate[0]) * w, y: y + (1 - AVLU.gate[1]) * h, w }; } // kapı eşiği = yolun ucu
  if (NECRO) return { x, y: y + 34, w: 135 }; // şapel: (x, y) kapı eşiği = yolun ucu; kapı görselin ortasında, eşik yüksekliğin %83'ünde
  return { x: x - 15 * BUILD_K, y: y + 10, w: 124 * BUILD_K };
}

// Kale: Gemini sprite'ı (castle_1..3, hasar evresine göre) yoksa kışlanın en büyük hali yedek olarak kullanılır.
function drawCastle() {
  const c = G.castle, ratio = G.lives / G.maxLives, stage = castleStage();
  const im = castleStageSprite();
  const sh = c.shake > 0 ? Math.sin(c.shake * 70) * c.shake * 8 : 0;
  if (im) {
    const cp = castlePlace(c.x, c.y, im);
    ctx.save(); ctx.translate(cp.x + sh, cp.y);
    drawSprite(ctx, im, 0, 0, cp.w);
    if (c.flash > 0) { ctx.globalAlpha = c.flash / 0.25 * 0.45; drawSprite(ctx, whiteOf('castle_fx_' + stage, im), 0, 0, cp.w); }
    ctx.restore();
    drawCastleArchers();
    if (isKeep(im)) drawKeepLights(cp, cp.w * im.height / im.width, sh, im === spr('castle_keep_3'));
    if (NECRO) {
      drawMortimer();
      const h = cp.w * im.height / im.width, R = mortStage(im).rail, x0 = cp.x + sh - cp.w / 2, y0 = cp.y - h;
      if (R) {
        ctx.save(); ctx.beginPath(); ctx.rect(x0 + R[0] * cp.w, y0 + R[1] * h, (R[2] - R[0]) * cp.w, (R[3] - R[1]) * h); ctx.clip();
        ctx.translate(cp.x + sh, cp.y); drawSprite(ctx, im, 0, 0, cp.w); ctx.restore();
      }
    }
    if (G.sel && G.sel.kind === 'castle') {
      ctx.save(); ctx.strokeStyle = `rgba(255,230,160,${0.9 * clamp((time - G.menuT) / 0.25, 0, 1)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(c.x - (NECRO ? -4 : 12), c.y + (NECRO ? 14 : 4), (NECRO ? 72 : 56) + Math.sin(time * 6) * 1.5, NECRO ? 26 : 22, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // kale seviyesi: can barının yanında küçük yıldızlar
    for (let i = 0; i <= c.lvl; i++) fancyStar(c.x + 46 + i * 9, c.y + 22, 4.5, true);
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

// avlunun ön duvarı (alt bant): avluya girenleri örter; kapı canı barı
function drawAvluFront() {
  const c = G.castle, im = castleStageSprite(), cp = castlePlace(c.x, c.y, im), h = cp.w * im.height / im.width, sh = c.shake > 0 ? Math.sin(c.shake * 70) * c.shake * 8 : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(cp.x - cp.w / 2 + sh - 2, cp.y - h + AVLU.front * h, cp.w + 4, h); ctx.clip();
  ctx.translate(cp.x + sh, cp.y); drawSprite(ctx, im, 0, 0, cp.w); ctx.restore();
  drawAvluLights(cp, h, sh, im === spr('castle_avlu_1'));
  drawGateBar();
}
// Avlunun canlı ışıkları (görsel bozulmaz, üstüne ışık eklenir): duvardaki yeşil mumlar titrer, şapel pencereleri ve fenerler
// nabız gibi parlar, kapıdaki kafatasının alevi yanar, avluda ruh zerreleri süzülür. Noktalar castle_avlu görselinde oran (0..1).
const AVLU_FX = {
  candle: [[0.33, 0.155], [0.368, 0.15], [0.738, 0.18], [0.798, 0.183], [0.201, 0.225], [0.942, 0.3], [0.036, 0.42], [0.135, 0.545],
    [0.852, 0.52], [0.754, 0.63], [0.295, 0.658], [0.624, 0.7], [0.392, 0.71]],
  win: [[0.5, 0.214, 2], [0.418, 0.197, 1], [0.577, 0.213, 1], [0.607, 0.209, 0.7], [0.629, 0.294, 0.7], [0.463, 0.309, 1], [0.538, 0.323, 1],
    [0.42, 0.341, 1], [0.608, 0.346, 0.8], [0.576, 0.359, 1], [0.42, 0.474, 1], [0.576, 0.491, 1]],
  lamp: [[0.451, 0.434], [0.537, 0.445]], gate: [0.503, 0.66], eyes: [[0.485, 0.725], [0.515, 0.73]],
};
function avluFlame(x, y, hgt, wd, k, ph, col0, col1) {
  const gr = ctx.createLinearGradient(0, y + wd, 0, y - hgt);
  gr.addColorStop(0, `rgba(${col0},0.75)`); gr.addColorStop(0.55, `rgba(${col1},0.45)`); gr.addColorStop(1, `rgba(${col1},0)`);
  const sway = Math.sin(time * 6 + ph) * wd * 0.5;
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - wd, y + wd * 0.6);
  ctx.quadraticCurveTo(x - wd * 1.15, y - hgt * 0.45, x + sway, y - hgt * (0.9 + 0.2 * k));
  ctx.quadraticCurveTo(x + wd * 1.15, y - hgt * 0.45, x + wd, y + wd * 0.6); ctx.closePath(); ctx.fill();
}
// heybetli kalenin ışıkları: iki mangalda yeşil ruh ateşi, pencereler ve gül pencere nabız gibi, kafatası kapının gözleri yanar
const KEEP_FX = {
  fire: [[0.255, 0.715], [0.6, 0.765]], roof: [[0.276, 0.275], [0.8, 0.345]], eyes: [[0.405, 0.665], [0.505, 0.665]],
  win: [[0.505, 0.355, 2.2], [0.5, 0.245, 0.8], [0.63, 0.245, 0.8], [0.265, 0.455, 1], [0.36, 0.485, 0.8], [0.4, 0.485, 0.8],
    [0.72, 0.495, 1], [0.8, 0.5, 0.8], [0.625, 0.515, 0.8]],
};
function drawKeepLights(cp, h, sh, burning) {
  const s = cp.w / 1000, P = (f) => [cp.x - cp.w / 2 + f[0] * cp.w + sh, cp.y - h + f[1] * h];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [i, f] of KEEP_FX.win.entries()) {
    const [x, y] = P(f), k = 0.6 + 0.25 * Math.sin(time * 1.2 + i * 0.9) + 0.15 * Math.sin(time * 5 + i * 2) * Math.sin(time * 1.6 + i);
    glow(ctx, x, y, 22 * s * f[2], '120,255,140', 0.15 * k + 0.05);
  }
  for (const f of KEEP_FX.eyes) { const [x, y] = P(f); glow(ctx, x, y, 13 * s, '120,255,140', 0.3 + 0.2 * Math.sin(time * 2)); }
  for (const [i, f] of KEEP_FX.fire.entries()) {
    const [x, y] = P(f), k = 0.5 + 0.5 * Math.sin(time * 9 + i * 2) * Math.sin(time * 5.3 + i);
    glow(ctx, x, y - 6 * s, (62 + 10 * k) * s, '110,255,130', 0.32 + 0.12 * k);
    for (let j = 0; j < 3; j++) avluFlame(x + (j - 1) * 9 * s, y + 10 * s, (40 + 14 * Math.sin(time * 7 + j * 2 + i)) * s * (j === 1 ? 1.2 : 0.8), 9 * s, k, j * 2 + i, '235,255,225', '90,255,110');
    if (Math.random() < 0.05 * speed) emit(G.parts, { kind: 'glow', add: true, x: x + rand(-4, 4), y: y - 24 * s, vx: rand(-6, 6), vy: rand(-30, -16), col: '120,255,140', s0: rand(1, 1.8), s1: 0.2, life: rand(0.6, 1.1), a: 0.9 });
  }
  if (burning) for (const [i, f] of KEEP_FX.roof.entries()) { // ağır hasar: çatılarda yangın
    const [x, y] = P(f), k = 0.5 + 0.5 * Math.sin(time * 11 + i * 3) * Math.sin(time * 6.1 + i);
    glow(ctx, x, y, (50 + 10 * k) * s, '255,140,50', 0.3 + 0.12 * k);
    for (let j = 0; j < 2; j++) avluFlame(x + (j - 0.5) * 10 * s, y + 8 * s, (30 + 10 * Math.sin(time * 8 + j * 2 + i)) * s, 8 * s, k, j * 3 + i, '255,240,180', '255,120,30');
    if (Math.random() < 0.06 * speed) emit(G.parts, { kind: 'glow', add: true, x: x + rand(-5, 5), y: y - 14 * s, vx: rand(-8, 8), vy: rand(-36, -20), col: '255,160,60', s0: rand(1, 1.8), s1: 0.2, life: rand(0.5, 1), a: 0.9 });
  }
  ctx.restore();
}
function drawAvluLights(cp, h, sh, gateOk) {
  const s = cp.w / 1000, P = (f) => [cp.x - cp.w / 2 + f[0] * cp.w + sh, cp.y - h + f[1] * h];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [i, f] of AVLU_FX.win.entries()) {
    const [x, y] = P(f), k = 0.6 + 0.25 * Math.sin(time * 1.1 + i * 0.7) + 0.15 * Math.sin(time * 5.3 + i * 2.1) * Math.sin(time * 1.7 + i);
    glow(ctx, x, y, 26 * s * f[2], '120,255,140', 0.16 * k + 0.06);
  }
  for (const [i, f] of AVLU_FX.lamp.entries()) { const [x, y] = P(f); glow(ctx, x, y, 22 * s, '140,255,150', 0.3 + 0.12 * Math.sin(time * 9 + i * 3) * Math.sin(time * 4.1 + i)); }
  for (const [i, f] of AVLU_FX.candle.entries()) {
    const [x, y] = P(f), k = 0.5 + 0.5 * Math.sin(time * 12 + i * 2.3) * Math.sin(time * 7.1 + i * 1.3);
    glow(ctx, x, y, (20 + 5 * k) * s, '120,255,140', 0.3 + 0.15 * k);
    avluFlame(x, y + 6 * s, (20 + 6 * k) * s, 4.5 * s, k, i, '230,255,220', '110,255,120');
    if (Math.random() < 0.012 * speed) emit(G.parts, { kind: 'glow', add: true, x, y: y - 14 * s, vx: rand(-4, 4), vy: rand(-22, -12), col: '120,255,140', s0: rand(0.8, 1.4), s1: 0.2, life: rand(0.6, 1.2), a: 0.9 });
  }
  if (gateOk) { // kapının üstündeki boynuzlu kafatası: iri yeşil alev, gözler yanar
    const [x, y] = P(AVLU_FX.gate), k = 0.5 + 0.5 * Math.sin(time * 9) * Math.sin(time * 5.3);
    glow(ctx, x, y, (60 + 10 * k) * s, '110,255,130', 0.32 + 0.12 * k);
    for (let j = 0; j < 3; j++) avluFlame(x + (j - 1) * 9 * s, y + 18 * s, (44 + 14 * Math.sin(time * 7 + j * 2)) * s * (j === 1 ? 1.25 : 0.85), 10 * s, k, j * 2, '235,255,225', '90,255,110');
    for (const f of AVLU_FX.eyes) { const [ex, ey] = P(f); glow(ctx, ex, ey, 9 * s, '140,255,150', 0.5 + 0.3 * Math.sin(time * 2.5)); }
  }
  // avluda süzülen ruh zerreleri
  for (let i = 0; i < 7; i++) {
    const u = (time * 0.12 + i / 7) % 1, fx = 0.28 + 0.44 * ((i * 0.37) % 1) + Math.sin(time * 0.7 + i) * 0.03, fy = 0.6 - u * 0.25;
    const [x, y] = P([fx, fy]);
    glow(ctx, x, y, 7 * s * (1 - u * 0.5), '160,255,190', Math.sin(Math.PI * u) * 0.35);
  }
  ctx.restore();
}
// ----- kale okçuları -----
function castleSprite() { return spr('castle_1') || spr('tower_barracks_3'); }
// okçunun ayak noktası (kale görselindeki kule tepesi)
function castleArcherPoint(i) {
  const c = G.castle, im = castleSprite(), sp = CASTLE.spots[i];
  if (!im) return { x: c.x, y: c.y - 50 };
  const cp = castlePlace(c.x, c.y, im), h = cp.w * im.height / im.width;
  return { x: cp.x - cp.w / 2 + sp[0] * cp.w, y: cp.y - h + sp[1] * h };
}
const CASTLE_ARCHER_S = 0.5;
function updateCastleArchers(dt) {
  if (NECRO) { updateChapel(dt); return; } // şapelde okçu yok: kapıda Kemik Devi (Mortimer savaşmaz)
  const c = G.castle, L = CASTLE.levels[c.lvl];
  while (c.archers.length < L.archers) c.archers.push({ ang: Math.PI - 0.3, draw: 0, fx: 0, walk: 0, seed: rand(0, 9), cd: rand(0.2, 1) });
  if (G.lives <= 0) return;
  const tgt = findTarget({ x: c.x, y: c.y - 30 }, CASTLE.range, true);
  c.archers.forEach((a, i) => {
    a.fx = Math.max(0, a.fx - dt); a.cd -= dt;
    const o = castleArcherPoint(i); o.y -= 16.4 * CASTLE_ARCHER_S;
    const goal = tgt ? Math.atan2(aimY(tgt) - o.y, tgt.x - o.x) : a.ang + Math.sin(G.t * 0.6 + a.seed) * 0.4 * dt;
    a.ang += clamp(angDiff(goal, a.ang), -8 * dt, 8 * dt);
    a.draw = tgt ? clamp(1 - a.cd / 0.4, 0, 1) : Math.max(0, a.draw - dt * 4);
    if (a.cd > 0) return;
    if (!tgt) { a.cd = 0; return; }
    if (Math.abs(angDiff(goal, a.ang)) > 0.35) { a.cd = 0.02; return; }
    a.cd = L.rate; a.fx = 0.18; a.draw = 0;
    const f = Math.cos(a.ang) >= 0 ? 1 : -1, bx = o.x + f * 0.6 * CASTLE_ARCHER_S + Math.cos(a.ang) * 11 * CASTLE_ARCHER_S, by = o.y + Math.sin(a.ang) * 11 * CASTLE_ARCHER_S;
    const crit = L.crit && Math.random() < L.crit, d = dist(bx, by, tgt.x, tgt.y);
    G.projectiles.push({ kind: 'arrow', sx: bx, sy: by, target: tgt, tx: tgt.x, ty: aimY(tgt), t: 0, dur: clamp(d / 420, 0.15, 0.6),
      dmg: roll(L.dmg) * (crit ? 2 : 1), dtype: 'phys', arc: 18, crit, src: 'arrow' });
    sfx('arrow');
  });
}
function drawCastleArchers() {
  if (NECRO) return;
  const c = G.castle;
  c.archers.forEach((a, i) => paintArcher(ctx, castleArcherPoint(i), CASTLE_ARCHER_S, a, Math.min(c.lvl, 2)));
}
function upgradeCastle() {
  const c = G.castle, N = CASTLE.levels[c.lvl + 1];
  if (!N || G.gold < N.cost) return false;
  G.gold -= N.cost; c.lvl++;
  G.effects.push({ kind: 'ring', x: c.x, y: c.y - 20, r: 50, col: '255,226,122', t: 0, dur: 0.5 });
  for (let i = 0; i < 16; i++) emit(G.parts, { kind: 'glow', add: true, x: c.x + rand(-40, 40), y: c.y - rand(10, 80), vy: -rand(20, 60), col: '255,220,120', s0: 3.5, s1: 0.5, life: 0.7 });
  floatText(c.x, c.y - 90, N.title + '!', '#ffe27a');
  sfx('upgrade');
  return true;
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
  const oy = NECRO ? 18 : 0; // necro: tepede arma var, başlık ve ağaç biraz aşağıda
  ribbon(cx, py + 4 + (NECRO ? 42 : 0), 300, h.def.name, 'blue', 24);
  txt(`Seviye ${h.lvl}/${HERO_MAX}  ·  yetenekler seviye atladıkça kendiliğinden açılır`, cx, py + 54 + oy, 14, '#7a5530', 'center', '800', FONT_B, false);
  roundBtn('sk_close', px + pw - 26, py + 26, 17, 'close', () => setOverlay(null), { style: 'red', appear: k - 0.2 });
  h.def.paths.forEach((path, pi) => {
    const colX = h.def.paths.length === 1 ? cx - 60 : cx + (pi ? 130 : -130);
    roundRect(colX - 92, py + 70 + oy, 184, 24, 12, NECRO ? 'rgba(0,0,0,0.3)' : 'rgba(90,60,25,0.18)');
    txt(path.name, colX, py + 83 + oy, 16, '#4a2a0e', 'center', '400', FONT_T, false);
    const nxt = nextSkill(h, pi);
    path.skills.forEach((sk, si) => {
      const ny = py + 128 + oy + si * 58, nx = colX - 56;
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
// ----- ayarlar ekranı -----
let settingsBack = 'title', resetArm = 0;
function openSettings(from) { settingsBack = from; resetArm = 0; go(() => { screen = 'settings'; }); }
function drawSettings() {
  const st = time - screenT, bg = spr(NECRO ? 'nm_title' : 'title_bg');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(24,12,4,0.55)'); g.addColorStop(1, 'rgba(14,8,2,0.82)');
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 280, 'AYARLAR', 'gold', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = settingsBack; }), { appear: st - 0.1 });
  const pw = 560, ph = 390, px = W / 2 - pw / 2, py = 100;
  const pk = easeOutBack(clamp((st - 0.05) / 0.4, 0, 1));
  ctx.save(); ctx.translate(W / 2, py + ph / 2); ctx.scale(pk, pk); ctx.translate(-W / 2, -(py + ph / 2));
  if (NECRO) pauseFrame(px, py, pw, ph, 0);
  else {
    roundRect(px + 5, py + 10, pw, ph, 22, 'rgba(0,0,0,0.45)');
    const fr = ctx.createLinearGradient(0, py, 0, py + ph); fr.addColorStop(0, '#b07a46'); fr.addColorStop(1, '#4a2c14');
    roundRect(px, py, pw, ph, 22, fr, '#22120a', 3);
    const pg = ctx.createLinearGradient(0, py + 10, 0, py + ph - 10); pg.addColorStop(0, '#f8ebcc'); pg.addColorStop(1, '#dcc089');
    roundRect(px + 10, py + 10, pw - 20, ph - 20, 15, pg, 'rgba(92,58,22,0.6)', 1.5);
  }
  ctx.restore();
  if (pk < 0.9) return;
  settingsRows(px + 10, py + 22, pw - 20, st, false);
  if (resetArm && time - resetArm < 3) txt('Bütün yıldızlar ve gelişmeler silinir. Onaylamak için tekrar dokun.', W / 2, py + ph + 22, 13, '#ffb0a0', 'center', '700', FONT_B, false);
  gameButton('credits', W - 112, H - 34, 190, 38, 'EMEĞİ GEÇENLER', () => go(() => { screen = 'credits'; screenT = time; }), 'wood', { appear: st - 0.5, size: 14 });
}
// Ayar satırları (ana menüdeki ayarlar ekranı ve oyun içi duraklatma menüsü ortak). Kolay anlaşılsın diye (Caner, 10 Eki):
// her satırda solda simge + ad, sağda seçenekler yan yana; seçili olan yeşil yanar, tek dokunuşla değişir (sırayla gezme yok).
const SET_LEVELS = [[0, 'KAPALI'], [0.4, 'KISIK'], [0.7, 'ORTA'], [1, 'YÜKSEK']];
const levelOf = (on, v) => (!on ? 0 : SET_LEVELS.slice(1).reduce((b, o) => (Math.abs(o[0] - v) < Math.abs(b[0] - v) ? o : b))[0]);
function segmented(key, x, y, w, h, opts, cur, pick, appear) {
  const a = clamp(appear / 0.2, 0, 1); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  roundRect(x, y - h / 2 + 2, w, h, h / 2, NECRO ? 'rgba(0,0,0,0.4)' : 'rgba(60,34,12,0.35)');
  roundRect(x, y - h / 2, w, h, h / 2, NECRO ? '#1a0814' : '#5a3a1c', NECRO ? '#c9a865' : '#2a160a', NECRO ? 1.6 : 2);
  const sw = w / opts.length;
  opts.forEach(([v, label], i) => {
    const on = v === cur, sx = x + i * sw, hot = press.key === key + i;
    if (on) {
      const off = v === 0 || v === false, g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      if (NECRO) { g.addColorStop(0, off ? '#6a5a72' : '#b8284a'); g.addColorStop(1, off ? '#2e2436' : '#5e0a24'); }
      else { g.addColorStop(0, off ? '#9a8a7a' : '#8fe06a'); g.addColorStop(1, off ? '#5a4a3e' : '#2f8a2a'); }
      roundRect(sx + 3, y - h / 2 + 3, sw - 6, h - 6, (h - 6) / 2, g, NECRO ? 'rgba(230,190,110,0.75)' : 'rgba(20,40,10,0.7)', 1.5);
    } else if (hot) roundRect(sx + 3, y - h / 2 + 3, sw - 6, h - 6, (h - 6) / 2, 'rgba(255,240,200,0.15)');
    const fs = Math.min(14, (sw - 10) / Math.max(4, TR(label).length) * 1.55);
    txt(label, sx + sw / 2, y + 1, fs, on ? '#fff' : 'rgba(255,236,200,0.6)', 'center', '400', FONT_T, on);
    if (i) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx, y - h / 2 + 7, 1.5, h - 14); }
    buttons.push({ key: key + i, x: sx, y: y - h / 2 - 4, w: sw, h: h + 8, fn: () => { if (!on) { pick(v); sfx('click'); } } });
  });
  ctx.restore();
}
function settingsRows(x0, y0, w, st, inGame) {
  const LANGS = [['tr', 'TÜRKÇE'], ['en', 'ENGLISH'], ['es', 'ESPAÑOL'], ['de', 'DEUTSCH'], ['fr', 'FRANÇAIS'], ['ru', 'РУССКИЙ'], ['zh', '中文']];
  const lang = (LANGS.find(v => v[0] === window.LANG) || LANGS[0]);
  const vol = (onK, volK) => (v) => { setMuted(false); if (v === 0) setSetting(onK, false); else { setSetting(onK, true); setSetting(volK, v); } };
  const rows = [
    ['sound', 'Müzik', SET_LEVELS, levelOf(!muted && setting('music'), setting('mvol')), vol('music', 'mvol')],
    ['sound', 'Ses efektleri', SET_LEVELS, levelOf(!muted && setting('sfx'), setting('vol')), vol('sfx', 'vol')],
    ['fast', 'Ekran sarsıntısı', [[false, 'KAPALI'], [true, 'AÇIK']], !!setting('shake'), (v) => setSetting('shake', v)],
    ['gear', 'Görüntü kalitesi', [['low', 'DÜŞÜK'], ['auto', 'OTOMATİK'], ['high', 'YÜKSEK']], setting('gfx'), (v) => setSetting('gfx', v)],
  ];
  const lx = x0 + 26, cw = Math.min(310, w - 250), LC = NECRO ? '#eadfc4' : '#4a2a0e', LS = 17, cx = x0 + w - 24 - cw, step = 58, sh = inGame ? 42 : 38; // oyun içinde (telefonda) seçenekler biraz daha iri
  rows.forEach(([icon, label, opts, cur, pick], i) => {
    const y = y0 + 30 + i * step, ap = st - 0.2 - i * 0.04;
    if (i) { ctx.fillStyle = NECRO ? 'rgba(201,168,101,0.22)' : 'rgba(92,58,22,0.18)'; ctx.fillRect(x0 + 20, y - step / 2, w - 40, 1.5); }
    drawIcon(icon, lx + 12, y, 22, '#f2d58a');
    txt(label, lx + 32, y + 1, LS, LC, 'left', '400', FONT_T, false);
    segmented('seg' + i + '_', cx, y, cw, sh, opts, cur, pick, ap);
  });
  // dil: dokununca sıradaki dil (dil adı kendi dilinde yazar, herkes kendi dilini tanır)
  const y = y0 + 30 + rows.length * step;
  ctx.fillStyle = NECRO ? 'rgba(201,168,101,0.22)' : 'rgba(92,58,22,0.18)'; ctx.fillRect(x0 + 20, y - step / 2, w - 40, 1.5);
  drawIcon('map', lx + 12, y, 22, '#f2d58a');
  txt('Dil / Language', lx + 32, y + 1, LS, LC, 'left', '400', FONT_T, false);
  const cyc = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length][0];
  gameButton('setlang', cx + cw / 2, y, cw, 40, '◀  ' + lang[1] + '  ▶', () => window.setLang(cyc), 'blue', { appear: st - 0.4, size: 15 });
  if (inGame) return;
  const y2 = y + step;
  ctx.fillStyle = NECRO ? 'rgba(201,168,101,0.22)' : 'rgba(92,58,22,0.18)'; ctx.fillRect(x0 + 20, y2 - step / 2, w - 40, 1.5);
  drawIcon('restart', lx + 12, y2, 22, '#ff9a8a');
  txt('İlerlemeyi sıfırla', lx + 32, y2 + 1, LS, LC, 'left', '400', FONT_T, false);
  gameButton('setreset', cx + cw / 2, y2, cw, 40, time - resetArm < 3 ? 'EMİN MİSİN?' : 'SIFIRLA', () => {
    if (time - resetArm < 3) { save = { stars: [], settings: save.settings }; persist(); resetArm = 0; mapEp = null; sfx('error'); }
    else resetArm = time;
  }, 'red', { appear: st - 0.45, size: 15 });
}
// ---------- reklam ve tek seferlik satın alma ----------
// Gelir modeli (10 Eki): ödüllü reklam (isteğe bağlı: kaybedince 5 canla devam, bölüme +150 altınla başla) + 3 bölümde bir
// ara reklam; tek seferlik "Mortimer'ın Hazinesi" (MONET.price) ara reklamları kaldırır, ödüllü reklam ödüllerini reklamsız verir.
// Tarayıcı sürümünde reklamlar DENEME ekranıdır; mağaza sürümünde Capacitor AdMob + uygulama içi satın alma buraya bağlanacak
// (window.NativeAds?.showRewarded / showInterstitial, window.NativeIAP?.buy('mortimer_hazine')).
const MONET = { interEvery: 3, interMinSec: 120, price: '₺149,99', priceUsd: '$4.99', product: 'mortimer_hazine', boostGold: 150 };
let AD = null, lastInterAd = -1e9; // AD: { kind: 'rew' | 'int', t0, dur, cb }
const isPremium = () => !!save.premium;
function showRewardedAd(cb) {
  if (isPremium()) { cb(); return; }
  if (window.NativeAds && window.NativeAds.showRewarded) { window.NativeAds.showRewarded().then(ok => ok && cb()).catch(() => {}); return; }
  AD = { kind: 'rew', t0: time, dur: 3, cb };
}
function levelEndAd() {
  if (isPremium()) return;
  save.levelsEnded = (save.levelsEnded || 0) + 1; persist();
  if (save.levelsEnded % MONET.interEvery !== 0 || time - lastInterAd < MONET.interMinSec) return;
  lastInterAd = time;
  setTimeout(() => {
    if (window.NativeAds && window.NativeAds.showInterstitial) { window.NativeAds.showInterstitial().catch(() => {}); return; }
    AD = { kind: 'int', t0: time, dur: 2.5 };
  }, 1600); // zafer/yenilgi ekranı önce görünsün
}
function buyPremium() {
  if (window.NativeIAP && window.NativeIAP.buy) { window.NativeIAP.buy(MONET.product).then(ok => { if (ok) { save.premium = true; persist(); sfx('levelup'); } }).catch(() => {}); return; }
  save.premium = true; persist(); sfx('levelup'); // tarayıcı: deneme satın alma
  mapNote = { text: 'Deneme satın alma: gerçek ödeme mağaza sürümünde', t: time };
}
function drawAd() {
  if (!AD) return;
  const k = time - AD.t0, left = Math.max(0, AD.dur - k);
  buttons.length = 0; // reklam sürerken alttaki düğmeler çalışmaz
  ctx.fillStyle = 'rgba(6,4,10,0.94)'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  roundRect(W / 2 - 220, H / 2 - 120, 440, 240, 18, '#1a1424', '#5a4a7a', 2);
  txt(AD.kind === 'rew' ? 'ÖDÜLLÜ REKLAM' : 'REKLAM', W / 2, H / 2 - 82, 22, '#e8dcc0', 'center', '400', FONT_T, false);
  txt('(deneme — mağaza sürümünde gerçek reklam gösterilir)', W / 2, H / 2 - 56, 12, '#9a8cb0', 'center', '700', FONT_B, false);
  ctx.save(); ctx.translate(W / 2, H / 2 + 6); ctx.rotate(Math.sin(time * 3) * 0.08); drawIcon('skull', 0, 0, 56); ctx.restore();
  if (left > 0) txt(Math.ceil(left) + '', W / 2, H / 2 + 80, 20, '#ffe27a', 'center', '400', FONT_T, false);
  else gameButton('ad_close', W / 2, H / 2 + 82, 200, 44, AD.kind === 'rew' ? 'ÖDÜLÜ AL' : 'KAPAT', () => { const cb = AD.cb; AD = null; if (cb) cb(); }, 'green', { size: 16 });
}
function drawShop() {
  const st = time - screenT, bg = spr(NECRO ? 'nm_title' : 'title_bg');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
    ctx.fillStyle = 'rgba(14,8,2,0.7)'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 300, 'DÜKKÂN', 'gold', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = menuBack || 'map'; screenT = time; }), { appear: st - 0.1 });
  const pw = 520, ph = 360, px = W / 2 - pw / 2, py = 108, pk = easeOutBack(clamp((st - 0.05) / 0.4, 0, 1));
  ctx.save(); ctx.translate(W / 2, py + ph / 2); ctx.scale(pk, pk); ctx.translate(-W / 2, -(py + ph / 2));
  glow(ctx, W / 2, py + 90, 200, '255,200,90', 0.18 + Math.sin(time * 2) * 0.05);
  if (NECRO) pauseFrame(px, py, pw, ph, 0);
  else {
    roundRect(px + 5, py + 10, pw, ph, 22, 'rgba(0,0,0,0.45)');
    const fr = ctx.createLinearGradient(0, py, 0, py + ph); fr.addColorStop(0, '#6a1a20'); fr.addColorStop(1, '#2a0608');
    roundRect(px, py, pw, ph, 22, fr, '#e8bb52', 3);
  }
  ctx.restore();
  if (pk < 0.9) return;
  ctx.save(); ctx.translate(W / 2, py + 72); drawIcon('skull', 0, 0, 54); drawCrown(0, -36, 1.1, 1); ctx.restore();
  txt("MORTİMER'IN HAZİNESİ", W / 2, py + 132, 24, '#ffe9b0', 'center', '400', FONT_T, false);
  txt('Tek seferlik satın alma · abonelik yok', W / 2, py + 154, 13, '#e0c8a8', 'center', '700', FONT_B, false);
  const rows = ['Bölüm aralarındaki reklamlar tamamen kalkar', 'Reklam ödülleri (5 canla devam, altınla başla) reklam izlemeden', 'Mortimer\'a altın taç', 'Bir necromancer\'ı mutlu edersin'];
  rows.forEach((r, i) => { circle(px + 74, py + 186 + i * 26, 6, '#3cbf3c', '#0a2a0a', 1.2); txt(r, px + 90, py + 187 + i * 26, 14, '#f2ecd8', 'left', '700', FONT_B, false); });
  if (isPremium()) txt('SATIN ALINDI — teşekkürler!', W / 2, py + ph - 38, 18, '#a8f0a0', 'center', '400', FONT_T, false);
  else gameButton('buy', W / 2, py + ph - 40, 280, 52, 'SATIN AL · ' + MONET.price, buyPremium, 'green', { shine: true, size: 17 });
  txt('Satın alımları geri yükle', W / 2, H - 22, 12, '#cdb894', 'center', '700', FONT_B, false);
  buttons.push({ key: 'restore', x: W / 2 - 90, y: H - 34, w: 180, h: 24, fn: () => { if (window.NativeIAP && window.NativeIAP.restore) window.NativeIAP.restore().then(ok => { if (ok) { save.premium = true; persist(); } }); else mapNote = { text: 'Geri yükleme mağaza sürümünde', t: time }; } });
}
// Emeği geçenler: kaynaklar ve lisanslar (CC-BY sesler adın gösterilmesini şart koşar; yeni kaynak eklenince buraya yaz)
const CREDITS = [
  ['OYUN', [['Tasarım ve yapım', 'Caner'], ['Programlama yardımı', 'Claude (Anthropic)']]],
  ['GÖRSEL VE MÜZİK', [['Karakter, kule ve harita çizimleri', 'Google Gemini ile üretildi'], ['Animasyonlar', 'Wan 2.2 (Apache 2.0)'],
    ['Lanet Kulesi (geçici görsel)', 'FLUX.1 Kontext [dev]'], ['Müzik', 'Google Gemini (Lyria) ile üretildi']]],
  ['SES', [['Ses efektleri', 'Kenney · kenney.nl · CC0'], ['Düşman acı ve ölüm sesleri', 'Michel Baradari · CC-BY 3.0'],
    ['', '"11 male human pain/death sounds" · opengameart.org'], ['Kılıç sesleri', 'StarNinjas · opengameart.org · CC0'], ['Mortimer\'ın sesi', 'ElevenLabs · Callum (yapay zekâ seslendirme)'], ['Fil, akbaba, büyü, borazan ve arbalet efektleri', 'ElevenLabs Sound Effects · elevenlabs.io'], ['Diğer sesler', 'oyunda sentezlendi']]],
  ['YAZI TİPİ', [['Metal Mania · Russo One · Rubik', 'SIL Open Font License']]],
];
function drawCredits() {
  const st = time - screenT, bg = spr(NECRO ? 'nm_title' : 'title_bg');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(24,12,4,0.6)'); g.addColorStop(1, 'rgba(14,8,2,0.85)');
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 340, 'EMEĞİ GEÇENLER', 'gold', 24); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'settings'; screenT = time; }), { appear: st - 0.1 });
  const pw = NECRO ? 680 : 640, ph = NECRO ? 436 : 410, px = W / 2 - pw / 2, py = NECRO ? 92 : 100, m = NECRO ? 22 : 0; // necro: köşe süslerine değmesin
  const pk = easeOutBack(clamp((st - 0.05) / 0.4, 0, 1));
  ctx.save(); ctx.translate(W / 2, py + ph / 2); ctx.scale(pk, pk); ctx.translate(-W / 2, -(py + ph / 2));
  if (NECRO) pauseFrame(px, py, pw, ph, 0);
  else {
    roundRect(px + 5, py + 10, pw, ph, 22, 'rgba(0,0,0,0.45)');
    const fr = ctx.createLinearGradient(0, py, 0, py + ph); fr.addColorStop(0, '#b07a46'); fr.addColorStop(1, '#4a2c14');
    roundRect(px, py, pw, ph, 22, fr, '#22120a', 3);
    const pg = ctx.createLinearGradient(0, py + 10, 0, py + ph - 10); pg.addColorStop(0, '#f8ebcc'); pg.addColorStop(1, '#dcc089');
    roundRect(px + 10, py + 10, pw - 20, ph - 20, 15, pg, 'rgba(92,58,22,0.6)', 1.5);
  }
  ctx.restore();
  if (pk < 0.9) return;
  let y = py + 36 + (NECRO ? 10 : 0);
  for (const [head, rows] of CREDITS) {
    txt(head, px + 40 + m, y, 17, '#8a1a14', 'left', '400', FONT_T, false); y += NECRO ? 21 : 22;
    for (const [a, b] of rows) {
      if (a) txt(a, px + 52 + m, y, 13, '#4a2a0e', 'left', '800', FONT_B, false);
      txt(b, px + pw - 40 - m, y, 13, '#5a3a1a', 'right', '700', FONT_B, false); y += NECRO ? 18 : 19;
    }
    y += NECRO ? 6 : 7;
  }
}

function drawHeroes() {
  const st = time - screenT, bg = spr(NECRO ? 'nm_title' : 'title_bg');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(24,12,4,0.5)'); g.addColorStop(1, 'rgba(14,8,2,0.8)');
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 300, NECRO ? 'KOMUTANLAR' : 'KAHRAMANLAR', 'blue', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'map'; }), { appear: st - 0.1 });
  const tm = team();
  txt(NECRO ? 'Savaşa bir komutan götürürsün · seçmek için karta dokun' : 'Savaşa bir kahraman götürürsün · seçmek için karta dokun', W / 2, 98, 14, '#f0e2c4', 'center', '700', FONT_B, false);
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
  if (NECRO) velvetCard(x0, y0, w, h, 20, { border: sel ? '#7be05a' : null, ac: sel ? d.aura : null });
  else {
    roundRect(x0 + 5, y0 + 12, w, h, 20, 'rgba(0,0,0,0.5)');
    const fr = ctx.createLinearGradient(0, y0, 0, y0 + h); fr.addColorStop(0, '#b07a46'); fr.addColorStop(1, '#4a2c14');
    roundRect(x0, y0, w, h, 20, fr, sel ? '#7be05a' : '#22120a', sel ? 4 : 3);
    const pg = ctx.createLinearGradient(0, y0 + 10, 0, y0 + h - 10); pg.addColorStop(0, '#f8ebcc'); pg.addColorStop(1, '#dcc089');
    roundRect(x0 + 10, y0 + 10, w - 20, h - 20, 15, pg, 'rgba(92,58,22,0.6)', 1.5);
  }
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
  roundRect(x0 + 18, y0 + 18, w - 36, 150, 12, null, NECRO ? '#c9a865' : '#3a2410', 2.5);
  txt(d.name, 0, y0 + 188, 21, '#4a2a0e', 'center', '400', FONT_T, false);
  txt(d.role, 0, y0 + 208, 10.5, '#8a6238', 'center', '800', FONT_B, false);
  // değer çubukları
  const bars = !unlocked ? [] : [['Can', d.hp / 520, '#e8434b'], ['Saldırı', ((d.dmg[0] + d.dmg[1]) / 2 / d.rate) / 28, '#ffb347'], ['Hız', d.speed / 135, '#5ad0ff'], ['Menzil', (d.ranged || 40) / 215, '#9be06a']];
  bars.forEach(([lab, v, col], j) => {
    const by = y0 + 228 + j * 14;
    txt(lab, x0 + 22, by, 10, '#6a4420', 'left', '800', FONT_B, false);
    roundRect(x0 + 70, by - 3.5, 82, 7, 3.5, NECRO ? 'rgba(0,0,0,0.45)' : 'rgba(60,40,20,0.25)');
    roundRect(x0 + 70, by - 3.5, 82 * clamp(v, 0.08, 1), 7, 3.5, col);
  });
  const by2 = NECRO ? -7 : 0; // necro: kart çerçevesinin süslerine değmesin
  if (!unlocked) { /* rozet yok */ }
  else if (d.ranged) { roundRect(-34, y0 + 290 + by2, 68, 16, 8, '#2a5fb8'); txt('MENZİLLİ', 0, y0 + 298 + by2, 9, '#fff', 'center', '800', FONT_B, false); }
  else { roundRect(-44, y0 + 290 + by2, 88, 16, 8, '#8a3a1a'); txt('YAKIN DÖVÜŞ', 0, y0 + 298 + by2, 9, '#fff', 'center', '800', FONT_B, false); }
  if (unlocked) txt('Güç: ' + HERO_ULT[id].name, 0, y0 + 315 + by2 * 1.6, 9.5, '#5a3410', 'center', '800', FONT_B, false);
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
  if (team()[0] === id) return;
  save.team = [id]; persist(); sfx('select');
}

// ---------- bosslar ----------
// Boss görselleri temel düşman görselinden renk değiştirilerek üretilir (bir kez, önbelleğe alınır).
// img/ klasörüne enemy_<boss>.png koyulursa o kullanılır.
const BOSS_LOOK = {
  // Atlı Okçu: kırmızı kumaş koyu yeşil deri, beyaz zırh ham deri rengi, altın bronz
  horsearcher: (h, s, l) => {
    if ((h < 16 || h > 335) && s > 0.35) return [95, 0.35, l * 0.55];
    if (s < 0.22 && l > 0.5) return [32, 0.32, l * 0.78];
    if (h > 32 && h < 62 && s > 0.4) return [28, 0.6, l * 0.8];
    return null;
  },
  // Güneş Rahibesi: kumaş beyaz-altın, zırh fildişi (ışıl ışıl)
  sunpriest: (h, s, l) => {
    if ((h < 16 || h > 335) && s > 0.35) return [44, 0.9, Math.min(0.78, l * 1.45)];
    if (s < 0.25 && l > 0.45) return [48, 0.45, Math.min(0.95, l * 1.08)];
    return null;
  },
};
// Kare şeridi: <ad><ek> varsa o; yoksa asıl türün (rig) şeridi bu türün renkleriyle (boss/rütbe) yeniden boyanır ve saklanır.
const ULT_ANIM = 1.3; // komutan gücü şeridinin süresi (sn)
function animStrip(name, rig, suf) {
  const key = name + suf;
  if (ANIM_META[key] && spr(key)) return key;
  if (name.endsWith('_rot')) { // dirilen ölü: düşmanın şeridinin çürümüş renkli kopyası
    const src = animStrip(name.slice(0, -4), rig === name ? null : rig, suf);
    if (!src) return null;
    SPR[key] = rottenOf(key, spr(src)); ANIM_META[key] = ANIM_META[src];
    return key;
  }
  if (!SPR[key]) { loadStrip(key); if (rig) loadStrip(rig + suf); } // bölüm dışı (harita, kodeks): ilk istekte yüklenir
  if (!rig || rig === name || !ANIM_META[rig + suf] || !spr(rig + suf)) return null;
  const type = name.slice(6), d = ENEMIES[type];
  if (!d) return null;
  const f = BOSS_LOOK[type] || (d.rank && RANK_LOOK[d.rank]);
  SPR[key] = f ? recolorCanvas(spr(rig + suf), f) : spr(rig + suf);
  ANIM_META[key] = ANIM_META[rig + suf];
  return key;
}
// görseli renk işleviyle (h, s, l, x, y -> yeni hsl ya da null) yeniden boyar; y görsel yüksekliğine göre (şeritte kare yüksekliği)
function recolorCanvas(src, f) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), a = im.data, cw = c.width, ch = c.height;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 10) continue;
    const px = i / 4;
    const r = f(...rgb2hsl(a[i], a[i + 1], a[i + 2]), (px % cw) / cw, Math.floor(px / cw) / ch);
    if (!r) continue;
    const rgb = hsl2rgb((r[0] + 360) % 360, clamp(r[1], 0, 1), clamp(r[2], 0, 1));
    a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2];
  }
  g.putImageData(im, 0, 0);
  c.generated = true;
  return c;
}
function enemySprite(type) {
  const name = 'enemy_' + type;
  if (SPR[name]) return SPR[name];
  const d = ENEMIES[type];
  if (!d || !d.base) return null;
  const base = spr('enemy_' + d.base);
  if (!base) return null;
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
  const g = c.getContext('2d'); g.drawImage(base, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), a = im.data, f = BOSS_LOOK[type] || (d.rank && RANK_LOOK[d.rank]), cw = c.width, ch = c.height;
  if (f) for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 10) continue;
    const px = i / 4;
    const r = f(...rgb2hsl(a[i], a[i + 1], a[i + 2]), (px % cw) / cw, Math.floor(px / cw) / ch);
    if (!r) continue;
    const rgb = hsl2rgb((r[0] + 360) % 360, clamp(r[1], 0, 1), clamp(r[2], 0, 1));
    a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2];
  }
  g.putImageData(im, 0, 0);
  c.generated = true;
  return (SPR[name] = c);
}
// Testudo: dört lejyoner sıkı düzende, kalkanlar başlarının üstünde çatı olur
const FORMATION = [[-7, -4], [7, -4], [-7, 4], [7, 4]];
function drawFormation(e, name, im, x, uo) {
  const hh = 23, o = Object.assign({}, uo, { h: hh });
  for (const [dx, dy] of FORMATION) drawUnit(name, im, x + dx * e.face, e.y + dy, e.face, Object.assign({}, o, { seed: e.off + dx + dy * 3 }));
  // kalkan çatısı: dört kırmızı kalkan, altın kenar; vurulunca titrer
  const sh = e.hitT > 0 ? Math.sin(time * 60) * 0.8 : 0, ry = e.y - hh * 0.92 + sh, bob = Math.abs(Math.sin(e.anim * 9)) * 0.8;
  ctx.save(); ctx.translate(x, ry - bob);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 6, 17, 4, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const cx = -11.5 + i * 7.6, cy = (i % 2) * -1.2;
    roundRect(cx - 4, cy - 5, 8, 10, 1.8, i % 2 ? '#b82a22' : '#a3221c', '#3a0c08', 1);
    ctx.fillStyle = '#e8c35a'; ctx.fillRect(cx - 0.8, cy - 4, 1.6, 8);
    circle(cx, cy, 1.4, '#f2d77a', '#5a3a08', 0.6);
  }
  ctx.restore();
}
// kodla çizilen eşyalar: sancaktarın kartallı sancağı (sırtında), davulcunun davulu (belinde, tokmaklar iner kalkar)
function drawEnemyProp(e, prop, hh) {
  const f = e.face, bob = Math.abs(Math.sin(e.anim * 9)) * 1.2;
  ctx.save(); ctx.lineCap = 'round';
  if (prop === 'banner') {
    // gerçekteki gibi: direk öndeki elde, dipçiği yere yakın, dimdik; tepede çapraz kol, ondan sarkan kırmızı bayrak ve altın güneş
    const px = e.x + f * hh * 0.22, foot = e.y - 1 - bob * 0.3, grip = e.y - hh * 0.52 - bob, top = e.y - hh * 1.5 - bob;
    const sway = Math.sin(time * 2.2 + e.off) * 0.8;
    ctx.strokeStyle = '#2a1808'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(px, foot); ctx.lineTo(px, top); ctx.stroke();
    ctx.strokeStyle = '#9a6a34'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, foot); ctx.lineTo(px, top); ctx.stroke();
    // tutan el (yumruk) direğin önünde
    circle(px, grip, 2, '#e8b890', '#4a2a14', 0.7);
    // çapraz kol ve sarkan bayrak (saçaklı)
    ctx.strokeStyle = '#d9b04a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(px - 6, top + 5); ctx.lineTo(px + 6, top + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 5.5, top + 5.5); ctx.lineTo(px + 5.5, top + 5.5); ctx.lineTo(px + 5.5 + sway, top + 16); ctx.lineTo(px - 5.5 + sway, top + 16); ctx.closePath();
    ctx.fillStyle = '#b8261e'; ctx.fill(); ctx.strokeStyle = '#4a0c08'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#e8c35a'; ctx.fillRect(px - 5.5 + sway, top + 15.2, 11, 1.6);
    circle(px + sway * 0.5, top + 10.5, 2.1, '#f2d77a', '#5a3a08', 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, px, top, 6, '255,210,110', 0.35); ctx.restore();
    circle(px, top, 2.4, '#ffd96a', '#6a4408', 0.8);
    // zırh halesi: çevresindekiler korunuyor
    ctx.strokeStyle = `rgba(255,215,120,${0.16 + Math.sin(time * 3 + e.off) * 0.05})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, e.def.aura.r * 0.9, e.def.aura.r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (prop === 'drum' && spr('enemy_drummer')) {
    // davul görselde: yalnız vuruşta derinin parlaması (tokmak hareketi animasyon şeridinde)
    const since = G.t - (e.hitAt ?? -9), pulse = since < 0.14 ? 1 - since / 0.14 : 0;
    if (pulse > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, e.x + f * hh * 0.17, e.y - hh * 0.45 - bob, 11, '255,190,110', 0.55 * pulse); }
  } else if (prop === 'drum') {
    // önde, belden asılı savaş davulu: kırmızı gövde, altın çemberler, çapraz germe ipleri; iki tokmak sırayla iner
    const dx = e.x + f * hh * 0.2, dy = e.y - hh * 0.36 - bob, R = 6.4, D = 5.2, since = G.t - (e.hitAt ?? -9);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(dx, dy + D + 1.5, R, 2, 0, 0, Math.PI * 2); ctx.fill();
    const gr = ctx.createLinearGradient(dx - R, 0, dx + R, 0); gr.addColorStop(0, '#5a0e0a'); gr.addColorStop(0.45, '#b8261e'); gr.addColorStop(1, '#4a0a08');
    ctx.fillStyle = gr; ctx.fillRect(dx - R, dy, R * 2, D); ctx.beginPath(); ctx.ellipse(dx, dy + D, R, 2.3, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#2a0a06'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(dx - R, dy); ctx.lineTo(dx - R, dy + D); ctx.ellipse(dx, dy + D, R, 2.3, 0, Math.PI, 0, true); ctx.lineTo(dx + R, dy); ctx.stroke();
    ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 0.7; ctx.beginPath(); // germe ipleri (zikzak)
    for (let j = 0; j <= 6; j++) { const x = dx - R + j * R / 3; ctx[j ? 'lineTo' : 'moveTo'](x, j % 2 ? dy + D + 1.5 : dy + 0.5); } ctx.stroke();
    const pulse = since < 0.12 ? 1 - since / 0.12 : 0; // vuruşta deri titrer, parlar
    ctx.fillStyle = '#efe2c4'; ctx.beginPath(); ctx.ellipse(dx, dy, R, 2.3 + pulse * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 1.2; ctx.stroke();
    if (pulse > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, dx, dy, 10, '255,190,110', 0.5 * pulse); ctx.restore(); }
    // tokmaklar: vuran el aşağı iner (0,1 sn), sonra yeniden kalkar; öbür el havada bekler
    for (const sd of [-1, 1]) {
      const mine = (e.hand ?? 0) === (sd > 0 ? 1 : 0), u = mine ? clamp(since / 0.1, 0, 1) : 1;
      const up = mine ? (u < 1 ? 1 - u : clamp((since - 0.1) / (DRUM.beat * 0.9), 0, 1)) : 1; // 1 = havada
      const hx = dx + sd * 2.6, hy = dy - 6 - 3 * up, a = -sd * (0.35 + 0.9 * up) * f;
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.sin(a) * 7, hy + Math.cos(a) * 7 * (up > 0.5 ? -0.2 : 1)); ctx.stroke();
      const tx = hx + Math.sin(a) * 7, ty = hy + Math.cos(a) * 7 * (up > 0.5 ? -0.2 : 1);
      circle(tx, ty, 1.6, '#e8dcc0', '#3a2410', 0.6);
    }
  }
  ctx.restore();
}
// Rütbe renkleri (h 0-360, s, l, x, y: görseldeki yer). Solarian askerleri beyaz-altın zırh, kırmızı kumaş giyer.
// Kıdemli: kırmızı kumaş koyu şarap kırmızısı, beyaz zırh mavimsi koyu çelik, altın süsler gümüş;
//   lejyonerin gri sorgucu (görselin üst kısmında) kırmızı olur.
// Yüzbaşı: kırmızı kumaş altın-turuncu, altın süsler parlak, beyaz zırh sıcak fildişi; gri sorguç altın.
const RANK_LOOK = {
  1: (h, s, l, x, y) => {
    const red = (h < 16 || h > 335) && s > 0.35, gold = h > 32 && h < 62 && s > 0.4 && l > 0.3;
    if (y < 0.24 && s < 0.18 && l > 0.35) return [356, 0.75, l * 0.62];
    if (red) return [348, Math.min(1, s * 1.05), l * 0.62];
    if (gold) return [215, 0.1, Math.min(0.92, l * 1.08)];
    if (s < 0.22 && l > 0.5) return [215, 0.18, l * 0.68];
    return null;
  },
  2: (h, s, l, x, y) => {
    const red = (h < 16 || h > 335) && s > 0.35, gold = h > 32 && h < 62 && s > 0.4 && l > 0.3;
    if (y < 0.24 && s < 0.18 && l > 0.35) return [45, 0.95, l * 0.72];
    if (red) return [40, 0.95, Math.min(0.72, l * 1.25)];
    if (gold) return [h, Math.min(1, s * 1.2), Math.min(0.85, l * 1.12)];
    if (s < 0.22 && l > 0.55) return [42, 0.35, l * 0.95];
    return null;
  },
};
// başın üstünde taç
// yüzbaşı işareti: başın üstünde küçük altın yıldız (taç yerine; boss taçlarıyla karışmasın)
function drawRankStar(x, y) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 7, '255,210,90', 0.35 + Math.sin(time * 4 + x) * 0.1); ctx.restore();
  drawStar(x, y, 3.6, '#ffd34d');
}
function drawCrown(x, y, s, face) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s); ctx.rotate(0.12);
  ctx.beginPath();
  ctx.moveTo(-10, 6); ctx.lineTo(-11, -5); ctx.lineTo(-5, 0); ctx.lineTo(0, -9); ctx.lineTo(5, 0); ctx.lineTo(11, -5); ctx.lineTo(10, 6); ctx.closePath();
  const g = ctx.createLinearGradient(0, -9, 0, 6); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc928'); g.addColorStop(1, '#b8780c');
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a2004'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
  circle(0, 1.5, 2, '#e8434b'); circle(-6, 2.5, 1.4, '#4fc3ff'); circle(6, 2.5, 1.4, '#4fc3ff');
  ctx.restore();
}

// Boss girişi: ekran kızıl karanlığa bürünür, boru ve davullar çalar, ekran sarsılır, kükrer
// Boss girişi: ilk BOSS_ENTRY sn ağır ağır yürür, her adımda yer sarsılır ve toz kalkar; ekran uzun süre kızıl karanlıkta kalır
const BOSS_ENTRY = 5;
function bossIntro(e) {
  G.bossT = 0; e.entryT = BOSS_ENTRY;
  G.intro = { type: e.type, t: 0, dur: 6.5, boss: true };
  G.bossFx = { t: 0, dur: 5.5 };
  shakeScreen(4, 0.9);
  bossSting(); setTimeout(() => sfx('roar'), 1400);
  setTimeout(() => mortSay('boss', true), 2600);
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
    const p = G.paths[pi], d0 = behind ? Math.max(dLo(p), e.d - 30 - i * 12) : 10 + i * 14;
    const m = spawnEnemy(t2, pi, d0);
    const q = pathPos(p, d0);
    if (i === 0) G.effects.push({ kind: 'portal', x: q.x, y: q.y, t: 0, dur: 1.4, col: '200,60,60' });
    for (let j = 0; j < 5; j++) emit(G.parts, { kind: 'glow', add: true, x: m.x + rand(-8, 8), y: m.y - rand(0, 20), vy: -rand(20, 50), col: '255,110,90', s0: 4, s1: 0.5, life: 0.6 });
  }
  floatText(e.x, e.y - (CHAR_H['enemy_' + e.type] || 50) - 34, 'LEJYON!', '#ff6a50');
}

// boss yetenekleri
// Boss yeteneği kullanırken: adı belirir, boss parlar ve etrafına kıvılcım saçılır
// ---- Özel saldırılar (10 Eki): orta güçteki düşmanların alternatif saldırısı (def.alt) ve bossların ek yetenekleri ----
// Hepsi kısa bir "büyü anı" oynatır (e.skillT): düşman durur, varsa <ad>_skill şeridi, yoksa saldırı şeridi oynar.
// kind: net (ağ: kımıldayamaz), bash (kalkan darbesi), burn/poison (süreli hasar), whirl (çevresine savurma), charge (geri savurma)
const ALT_DUR = 0.65;
function playSkill(e, dur = ALT_DUR) { if (!(e.skillT > 0)) e.skillT = e.skillDur = dur; }
function soldierDot(s, dps, t, col) { s.dotT = Math.max(s.dotT || 0, t); s.dotDps = Math.max(s.dotT > t ? s.dotDps || 0 : 0, dps); s.dotCol = col; }
function netSoldier(s, t) { if (s.wall) return; s.stunT = Math.max(s.stunT || 0, t); s.netT = Math.max(s.netT || 0, t); }
function throwNet(e, s, stun) {
  G.projectiles.push({ kind: 'net', foe: true, hero: s, from: e, sx: e.x + e.face * 6, sy: aimY(e), tx: s.x, ty: s.y - 12, t: 0, dur: clamp(dist(e.x, e.y, s.x, s.y) / 260, 0.2, 0.5), arc: 22, edmg: 0, net: stun });
}
function doAlt(e, A, v) {
  const m = foeDmgMul(e), base = roll(e.def.dmg) * m, hy = v ? v.y - unitH(v) * 0.55 : e.y;
  if (A.kind === 'net') { throwNet(e, v, A.stun); sfx('whirl'); }
  else if (A.kind === 'bash') {
    damageSoldier(v, base * (A.mul || 1.3), e); if (!v.wall) v.stunT = Math.max(v.stunT || 0, A.stun || 1);
    impactFx(v.x, hy, '255,230,180', 1.3); G.effects.push({ kind: 'ring', x: v.x, y: v.y, r: 16, col: '255,220,150', t: 0, dur: 0.35 }); sfx('bash');
  } else if (A.kind === 'burn' || A.kind === 'poison') {
    const col = A.kind === 'burn' ? '255,140,60' : '140,255,80';
    damageSoldier(v, base * 0.6, e); soldierDot(v, A.dps, A.t, col);
    for (let i = 0; i < 10; i++) emit(G.parts, { kind: 'glow', add: true, x: v.x + rand(-6, 6), y: hy + rand(-6, 6), vx: rand(-30, 30), vy: -rand(20, 60), col, s0: rand(3, 5), s1: 0.5, life: rand(0.4, 0.7) });
    sfx(A.kind === 'burn' ? 'meteor' : 'splash');
  } else if (A.kind === 'whirl') {
    for (const o of G.soldiers) if (!o.dead && !o.wall && dist(o.x, o.y, e.x, e.y) < A.r) { damageSoldier(o, base * (A.mul || 0.8), e); slashFx(o.x, o.y - unitH(o) * 0.55, o.x < e.x ? -1 : 1, '#ffd0a0', 0.8); }
    G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: A.r, col: '255,200,150', t: 0, dur: 0.4 }); sfx('whirl');
  } else if (A.kind === 'charge') {
    damageSoldier(v, base * (A.mul || 1.2), e);
    if (!v.wall && !v.hero) { v.x += e.face * A.d; v.stunT = Math.max(v.stunT || 0, A.stun || 0.8); }
    G.effects.push({ kind: 'dust', x: v.x, y: v.y, t: 0, dur: 0.5 }); impactFx(v.x, hy, '235,225,200', 1.2); sfx('bash');
  }
}
function bossCastFx(e, name, col) {
  playSkill(e, e.def.chief ? 0.8 : ALT_DUR);
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
  // Öfke evresi (her bossta): canı yarıya inince kükrer, askerlere %25 sert vurur, yetenekleri %20 sık gelir
  if (e.def.chief && !e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true; e.dmgMul = (e.dmgMul || 1) * 1.25; e.cdMul = (e.cdMul || 1) * 0.8; mortSay('bossRage', true);
    bossCastFx(e, 'ÖFKELENDİ!', '255,60,40');
    G.effects.push({ kind: 'shock', x: e.x, y: e.y, r: 110, t: 0, dur: 0.6 });
    for (let i = 0; i < 3; i++) G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 40 + i * 30, col: '255,60,40', t: -i * 0.1, dur: 0.6 });
    shakeScreen(6, 0.6); sfx('roar'); G.hurt = Math.max(G.hurt, 0.35);
  }
  // Zehir: çevresindeki askerlere yeşil zehir püskürtür (hasar + kısa sersemleme)
  if (ab.venom && ready('venom', ab.venom.cd)) {
    const vs = G.soldiers.filter(s2 => !s2.dead && dist(s2.x, s2.y, e.x, e.y) < ab.venom.r);
    if (!vs.length) e.abT.venom = 1;
    else {
      for (const s2 of vs) {
        damageSoldier(s2, ab.venom.dmg * (e.dmgMul || 1), e); s2.stunT = Math.max(s2.stunT || 0, ab.venom.stun);
        for (let k = 0; k < 6; k++) emit(G.parts, { kind: 'glow', add: true, x: s2.x + rand(-6, 6), y: s2.y - rand(4, 18), vy: -rand(10, 30), col: k % 2 ? '140,255,80' : '90,200,60', s0: 4, s1: 0.5, life: 0.7 });
      }
      for (let k = 0; k < 24; k++) { const a = rand(0, Math.PI * 2), v = rand(60, 140); emit(G.parts, { kind: 'glow', x: e.x, y: e.y - 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, drag: 2.5, col: '120,220,70', s0: 6, s1: 14, life: 0.7, a: 0.55 }); }
      G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: ab.venom.r, col: '140,255,80', t: 0, dur: 0.5 });
      bossCastFx(e, 'Zehir!', '140,255,90'); sfx('roar');
    }
  }
  // sefer sonu bossu: canı yarıya inince ikinci lejyon
  if (e.def.legion && e.phase2 && !e.legion2 && e.hp < e.maxHp * 0.5) { e.legion2 = true; bossCastFx(e, 'Son Çağrı!', '255,90,70'); summonLegion(e); shakeScreen(5, 0.4); }
  // Muhafız çağırma: boss'un arkasında açılan geçitten minyonlar çıkar ve onunla yürür
  if (ab.summon && e.siege === undefined && ready('summon', ab.summon.cd) && G.enemies.filter(o => !o.dead && o.summonedBy === e).length < 8) { // en çok 8 çağrılmış asker
    const pi = G.paths.indexOf(e.p), d0 = Math.max(0, e.d - 24), q = pathPos(e.p, d0);
    G.effects.push({ kind: 'portal', x: q.x, y: q.y, t: 0, dur: 1.2, col: e.def.base === 'knight' || e.type === 'dark_shaman' ? '170,90,255' : '120,230,90' });
    for (let i = 0; i < ab.summon.n; i++) {
      const st = Array.isArray(ab.summon.t) ? ab.summon.t[i % ab.summon.t.length] : ab.summon.t;
      const m = spawnEnemy(st, pi, Math.max(dLo(G.paths[pi]), d0 - i * 10), i % 2 ? 10 : -10);
      m.leader = e; m.form = -22 - i * 12; m.summonedBy = e;
      for (let k = 0; k < 6; k++) emit(G.parts, { kind: 'glow', add: true, x: m.x + rand(-8, 8), y: m.y - rand(0, 20), vy: -rand(20, 50), col: '200,160,255', s0: 4, s1: 0.5, life: 0.6 });
    }
    bossCastFx(e, 'Çağrı!', '200,140,255'); sfx('portal');
  }
  if (ab.howl && ready('howl', ab.howl.cd)) {
    for (const o of G.enemies) if (!o.dead && dist(o.x, o.y, e.x, e.y) < ab.howl.r) o.hasteT = 4;
    for (let i = 0; i < 3; i++) G.effects.push({ kind: 'ring', x: e.x, y: e.y, r: ab.howl.r * (0.5 + i * 0.25), col: '255,90,70', t: -i * 0.12, dur: 0.6 });
    bossCastFx(e, ab.howl.say || (NECRO ? 'Borazan!' : 'Uluma!'), '255,110,80'); if (!ab.howl.soft) sfx('roar');
  }
  if (ab.slam && ready('slam', ab.slam.cd)) {
    const hitAny = G.soldiers.some(s => !s.dead && dist(s.x, s.y, e.x, e.y) < ab.slam.r);
    if (!hitAny) e.abT.slam = 1;
    else {
      for (const s of G.soldiers) if (!s.dead && dist(s.x, s.y, e.x, e.y) < ab.slam.r) { damageSoldier(s, ab.slam.dmg * (e.dmgMul || 1), e); s.stunT = ab.slam.stun; }
      if (ab.slam.bell) { // çan: altın ses halkaları, toprak sıçramaz
        for (let i = 0; i < 3; i++) G.effects.push({ kind: 'ring', x: e.x, y: e.y - 10, r: ab.slam.r * (0.45 + i * 0.28), col: '255,215,120', t: -i * 0.12, dur: 0.6 });
        bossCastFx(e, ab.slam.say || 'Çan!', '255,215,120'); sfx('horn'); if (e.def.chief) shakeScreen(4, 0.35);
      } else {
      G.effects.push({ kind: 'shock', x: e.x, y: e.y, r: ab.slam.r * 1.3, t: 0, dur: 0.45 });
      G.effects.push({ kind: 'firering', x: e.x, y: e.y, r: ab.slam.r, t: 0, dur: 0.4 });
      G.decals.push({ x: e.x, y: e.y, r: ab.slam.r * 0.6, t: 0, life: 6 });
      for (let i = 0; i < 18; i++) emit(G.parts, { kind: 'chunk', x: e.x + rand(-20, 20), y: e.y, vx: rand(-110, 110), vy: -rand(70, 170), g: 420, col: '#6a5040', s0: 3, s1: 2, life: 0.8, vr: rand(-10, 10), floor: e.y + rand(-6, 8) });
      bossCastFx(e, ab.slam.say || 'Yer Sarsıntısı!', '255,190,110');
      shakeScreen(5, 0.35); sfx('boom');
      }
    }
  }
  // --- ek boss yetenekleri (10 Eki) ---
  const near = (r) => G.soldiers.filter(o => !o.dead && !o.wall && dist(o.x, o.y, e.x, e.y) < r);
  if (ab.net && ready('net', ab.net.cd)) { // ağ: en yakın birkaç iskelete ağ fırlatır
    const vs = near(ab.net.r).sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y)).slice(0, ab.net.n);
    if (!vs.length) e.abT.net = 1; else { vs.forEach(v => throwNet(e, v, ab.net.stun)); bossCastFx(e, ab.net.say || 'Ağ!', '230,220,180'); sfx('whirl'); }
  }
  if (ab.volley && ready('volley', ab.volley.cd)) { // mızrak/ok yağmuru: rastgele iskeletlere, isabet eden sersemler
    const vs = near(ab.volley.r).sort(() => Math.random() - 0.5).slice(0, ab.volley.n);
    if (!vs.length) e.abT.volley = 1;
    else {
      vs.forEach((v, i) => G.projectiles.push({ kind: 'harrow', foe: true, hero: v, from: e, sx: e.x, sy: aimY(e) - 8, tx: v.x, ty: v.y - 12, t: -i * 0.08, dur: 0.45, arc: 40, edmg: ab.volley.dmg * (e.dmgMul || 1), stunHit: ab.volley.stun }));
      bossCastFx(e, ab.volley.say || 'Mızrak Yağmuru!', '255,210,140');
    }
  }
  if (ab.whirl && ready('whirl', ab.whirl.cd)) { // savurma: çevresindeki bütün iskeletlere
    if (!near(ab.whirl.r).length) e.abT.whirl = 1;
    else { doAlt(e, { kind: 'whirl', r: ab.whirl.r, mul: 0 }, null); for (const o of near(ab.whirl.r)) damageSoldier(o, ab.whirl.dmg * (e.dmgMul || 1), e); bossCastFx(e, ab.whirl.say || 'Savurma!', '255,180,120'); }
  }
  if (ab.charge && e.blocker && ready('charge', ab.charge.cd)) { // hücum: önündeki iskeleti savurup ilerler
    const v = e.blocker; doAlt(e, { kind: 'charge', d: ab.charge.d, stun: ab.charge.stun, mul: 0 }, v); damageSoldier(v, ab.charge.dmg * (e.dmgMul || 1), e);
    for (const o of near(40)) if (o !== v && !o.hero) { o.x += e.face * ab.charge.d * 0.6; o.stunT = Math.max(o.stunT || 0, ab.charge.stun * 0.6); }
    bossCastFx(e, ab.charge.say || 'Hücum!', '255,200,120'); shakeScreen(4, 0.3);
  }
  if (ab.burn && ready('burn', ab.burn.cd)) { // ateş/zehir halkası: alandaki iskeletler yanar
    const vs = near(ab.burn.r), col = ab.burn.poison ? '140,255,80' : '255,140,60';
    if (!vs.length) e.abT.burn = 1;
    else {
      vs.forEach(v => soldierDot(v, ab.burn.dps, ab.burn.t, col));
      G.effects.push({ kind: ab.burn.poison ? 'ring' : 'firering', x: e.x, y: e.y, r: ab.burn.r, col, t: 0, dur: 0.5 });
      for (let i = 0; i < 26; i++) { const a = rand(0, Math.PI * 2), v = rand(50, 120); emit(G.parts, { kind: 'glow', add: true, x: e.x, y: e.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, drag: 2.5, col, s0: 6, s1: 12, life: 0.6, a: 0.5 }); }
      bossCastFx(e, ab.burn.say || (ab.burn.poison ? 'Zehir Bulutu!' : 'Alev Halkası!'), col); sfx(ab.burn.poison ? 'splash' : 'meteor');
    }
  }
  if (ab.smite && ready('smite', ab.smite.cd)) { // ilahi yıldırım: en güçlü iskelete gökten altın ışın
    const vs = near(ab.smite.r).sort((a, b) => b.hp - a.hp);
    if (!vs.length) e.abT.smite = 1;
    else {
      const v = vs[0];
      G.effects.push({ kind: 'zap', x0: v.x + rand(-20, 20), y0: v.y - 240, x1: v.x, y1: v.y - 6, t: 0, dur: 0.45, w: 2, col: 'rgb(255,220,120)', seed: rand(0, 99) });
      G.effects.push({ kind: 'ring', x: v.x, y: v.y, r: 26, col: '255,220,120', t: 0, dur: 0.5 });
      damageSoldier(v, ab.smite.dmg * (e.dmgMul || 1), e); bossCastFx(e, ab.smite.say || 'İlahi Ceza!', '255,220,120'); sfx('zap');
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
      if (o.burnT > 0) continue; // yanan iyileşemez
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
    bossCastFx(e, 'Öfke!', '255,80,50'); sfx('roar');
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
        const hc = ab.hex.col || '170,70,255';
        G.effects.push({ kind: 'zap', x0: t.x + rand(-30, 30), y0: ty - 230, x1: t.x, y1: ty, t: 0, dur: 0.45, w: 1.6, col: `rgb(${hc})`, seed: rand(0, 99) });
        G.effects.push({ kind: 'zap', x0: e.x, y0: e.y - (e.def.h || 40), x1: e.x, y1: e.y - (e.def.h || 40) - 60, t: 0, dur: 0.3, w: 0.8, col: 'rgb(170,70,255)', seed: rand(0, 99) });
        G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: 40, col: '190,110,255', t: 0, dur: 0.5 });
        t.disabledT = Math.max(t.disabledT || 0, ab.hex.t); t.disabledKind = 'hex';
        bossCastFx(e, ab.hex.say || 'Lanet!', ab.hex.col || '190,110,255'); sfx('zap');
      }
    }
  }
  // Can emme: yakındaki askerlerden yeşil ışınlarla can çeker
  if (ab.drain && ready('drain', ab.drain.cd)) {
    const vs = G.soldiers.filter(s2 => !s2.dead && dist(s2.x, s2.y, e.x, e.y) < ab.drain.r);
    if (!vs.length) e.abT.drain = 1;
    else {
      for (const s2 of vs) {
        damageSoldier(s2, ab.drain.dmg * (e.dmgMul || 1), e); e.hp = Math.min(e.maxHp, e.hp + ab.drain.dmg * 1.5);
        G.effects.push({ kind: 'zap', x0: s2.x, y0: s2.y - 14, x1: e.x, y1: e.y - (e.def.h || 40) * 0.5, t: 0, dur: 0.5, w: 0.7, col: 'rgb(80,230,110)', seed: rand(0, 99) });
      }
      bossCastFx(e, 'Can Emme!', '110,255,140'); sfx('magic');
    }
  }
}

// Boss halesi: ayağının altında karanlık, nabız gibi atan kızıl gölge ve dönen rün halkası, çevresinde yükselen
// kor ve duman; öfkelenince kırmızı yanar. Yetenekten hemen önce yerde uyarı halkası belirir (yer sarsıntısı,
// zehir, çağrı), oyuncu ne geleceğini görür.
function drawBossAura(e, dh) {
  const d = e.def, col = d.ab && d.ab.blink ? '90,220,230' : e.enraged ? '255,40,20' : '255,70,40', pulse = 0.5 + Math.sin(time * (e.enraged ? 9 : 4)) * 0.5;
  ctx.save();
  const g = ctx.createRadialGradient(e.x, e.y + 2, 2, e.x, e.y + 2, dh * 0.9);
  g.addColorStop(0, `rgba(30,0,0,${0.45 + pulse * 0.1})`); g.addColorStop(1, 'rgba(30,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, dh * 0.95, dh * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, e.x, e.y - 2, dh * 1.05, col, 0.32 + pulse * 0.14 + (e.enraged ? 0.15 : 0));
  ctx.restore();
  ctx.save(); ctx.translate(e.x, e.y + 1); ctx.scale(1, 0.36);
  ctx.strokeStyle = `rgba(${col},${0.55 + pulse * 0.3})`; ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 5]); ctx.lineDashOffset = -time * 24;
  ctx.beginPath(); ctx.arc(0, 0, dh * 0.62, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${col},0.4)`;
  ctx.beginPath(); ctx.arc(0, 0, dh * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (Math.random() < (e.enraged ? 0.7 : 0.35)) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-dh * 0.45, dh * 0.45), y: e.y - rand(0, dh * 0.3), vy: -rand(18, 45), col: e.enraged ? '255,80,40' : '255,140,70', s0: rand(1.5, 3), s1: 0.3, life: rand(0.6, 1) });
  if (Math.random() < 0.18) emit(G.parts, { kind: 'glow', x: e.x + rand(-dh * 0.4, dh * 0.4), y: e.y - rand(0, 6), vy: -rand(8, 20), col: '30,18,22', s0: rand(5, 8), s1: rand(12, 18), life: rand(0.8, 1.3), a: 0.35 });
  // yetenek uyarısı: hazır olmaya 0.9 sn kala yerde büyüyen kesik çizgili kırmızı halka
  const A = d.ab || {}, T = e.abT || {};
  for (const k of ['slam', 'venom', 'summon']) {
    if (!A[k] || T[k] == null || T[k] > 0.9 || T[k] <= 0) continue;
    if (k !== 'summon' && !G.soldiers.some(s2 => !s2.dead && dist(s2.x, s2.y, e.x, e.y) < A[k].r)) continue;
    const r = k === 'summon' ? 34 : A[k].r, kk = 1 - T[k] / 0.9, c2 = k === 'venom' ? '140,255,80' : k === 'summon' ? '190,120,255' : '255,60,40';
    let cx = e.x, cy = e.y;
    if (k === 'summon') { const q = pathPos(e.p, Math.max(0, e.d - 24)); cx = q.x; cy = q.y; }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.42);
    ctx.fillStyle = `rgba(${c2},${0.1 + kk * 0.15})`; ctx.beginPath(); ctx.arc(0, 0, r * kk, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${c2},${0.5 + Math.sin(time * 20) * 0.3})`; ctx.lineWidth = 2.5; ctx.setLineDash([9, 6]); ctx.lineDashOffset = time * 30;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

// ekranın üstünde boss can barı
// Ekranın üstünde boss barı: altın çerçeve, solda kuru kafa madalyonu, ad şeridi; zırhlı bosslarda iki bar
// (üstte çelik zırh, altta can). Hasar yiyince bar önce beyaz iz bırakır, iz yavaşça erir.
// boss can barı ekranın üstünde, %60 boyutunda (çok yer kaplamasın); üst kenara yaslı ölçeklenir
const BOSS_BAR_K = 0.6 * 1.3; // Caner: boss canı okunmuyordu, %30 büyük
function drawBossBar() {
  const b = G.enemies.find(e => e.def.chief && !e.dead);
  if (!b) return;
  // ekranın en üst ortasına yaslı (içeriğin üstü y=34 -> 4 px); altından düşman geçiyorsa yarı saydam (yol görünsün)
  const under = G.enemies.some(e => !e.dead && Math.abs((e.x - cam.x) * cam.z - W / 2) < 130 && (e.y - cam.y) * cam.z < 52);
  G.bossBarA = (G.bossBarA ?? 1) + ((under ? 0.45 : 1) - (G.bossBarA ?? 1)) * 0.12;
  ctx.save(); ctx.globalAlpha = G.bossBarA; ctx.translate(W / 2, 4); ctx.scale(BOSS_BAR_K, BOSS_BAR_K); ctx.translate(-W / 2, -34);
  drawBossBarAt(b);
  ctx.restore();
}
function drawBossBarAt(b) {
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
// yeni düşman / rütbe: sol üstte dalga göstergesinin altından kayan küçük bildirim (oyunu örtmez)
function drawIntroToast(it) {
  const d = ENEMIES[it.type], wk = d.wk || {}, weak = Object.keys(wk).filter(k => wk[k] > 1).map(k => WK_NAME[k]);
  const k = clamp(Math.min(it.t / 0.3, (it.dur - it.t) / 0.4), 0, 1), slide = easeOutBack(clamp(it.t / 0.35, 0, 1));
  const label = it.rank ? 'YENİ RÜTBE' : 'YENİ DÜŞMAN', name = it.rank ? (it.rank === 2 ? 'Yüzbaşı' : 'Kıdemli') + ' · ' + d.name : d.name;
  const sub = weak.length ? 'Zayıf: ' + weak.join(', ') : '';
  ctx.font = `400 13px ${FONT_T}`; const nw = ctx.measureText(name).width; ctx.font = `800 9.5px ${FONT_B}`;
  const w = Math.max(nw, ctx.measureText(sub).width, 70) + 46, h = sub ? 40 : 30, x0 = 8 - (1 - slide) * (w + 12), y0 = 62;
  ctx.save(); ctx.globalAlpha *= k;
  roundRect(x0, y0, w, h, 9, 'rgba(14,8,20,0.82)', '#d4ab5a', 1.2);
  circle(x0 + 17, y0 + h / 2, 12, '#1a120a', '#c9a35a', 1.2);
  const im = enemySprite(it.type) || spr('enemy_' + it.type);
  if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x0 + 17, y0 + h / 2, 11, 0, Math.PI * 2); ctx.clip(); drawSprite(ctx, im, x0 + 17, y0 + h / 2 + 12, 22 * im.width / im.height); ctx.restore(); }
  txt(label, x0 + 35, y0 + 9, 8.5, '#ffd34d', 'left', '800', FONT_B, false);
  txt(name, x0 + 35, y0 + 21, 13, '#fff', 'left', '400', FONT_T, false);
  if (sub) txt(sub, x0 + 35, y0 + 33, 9.5, '#ffd08a', 'left', '800', FONT_B, false);
  ctx.restore();
}
function drawIntro() {
  const it = G.intro;
  if (!it) return;
  if (it.t > it.dur) { G.intro = null; return; }
  if (!it.boss) { drawIntroToast(it); return; }
  const d = ENEMIES[it.type], a = clamp(Math.min(it.t / 0.3, (it.dur - it.t) / 0.4), 0, 1), e = easeOutBack(clamp(it.t / 0.4, 0, 1));
  const wk = d.wk || {}, weak = Object.keys(wk).filter(k => wk[k] > 1), res = Object.keys(wk).filter(k => wk[k] < 1);
  const w = it.boss ? 360 : 320, dl = wrapLines(d.desc || ENEMY_DESC[it.type] || '', w - 84, 11.5), ex = (dl.length - 1) * 13;
  const h = (weak.length || res.length ? 88 : 70) + ex, x0 = W / 2 - w / 2, y0 = it.boss ? 92 : 64;
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
  txt(it.boss ? 'BOSS GELİYOR' : it.rank ? 'YENİ RÜTBE: ' + (it.rank === 2 ? 'YÜZBAŞI' : 'KIDEMLİ') : 'YENİ DÜŞMAN', x0 + 72, y0 + 16, 11, it.boss ? '#ff9a7a' : '#ffd34d', 'left', '800', FONT_B, false);
  txt(d.name, x0 + 72, y0 + 34, 19, '#fff', 'left', '400', FONT_T);
  dl.forEach((l, i) => txt(l, x0 + 72, y0 + 54 + i * 13, 11.5, '#f0e2c4', 'left', '700', FONT_B, false));
  let tx = x0 + 72;
  const tag = (label, list, col, bg) => {
    if (!list.length) return;
    const s = label + ' ' + list.map(k => WK_NAME[k]).join(', ');
    ctx.font = `800 10.5px ${FONT_B}`; const tw = ctx.measureText(s).width + 14;
    roundRect(tx, y0 + 64 + ex, tw, 16, 8, bg, col, 1);
    txt(s, tx + tw / 2, y0 + 72.5 + ex, 10.5, col, 'center', '800', FONT_B, false);
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
function starsTotal() { return save.stars.reduce((a, b) => a + (b || 0), 0) + chalStars(); }
function starsSpent() { return UPGRADES.reduce((a, u) => a + u.ranks.slice(0, upgRank(u.id)).reduce((b, r) => b + r.cost, 0), 0); }
function diff() { return GAME_DIFF; } // zorluk sabit
// gelişmelerle güçlenmiş kule seviyesi değerleri
// uzmanlık seçen kule +%20 hasar (kışlada asker canı ve hasarı) alır: tek yol seçmenin karşılığı
const SPEC_BONUS = 1.2;
// Kan Sunağı: menzilindeki (kule merkezleri arası) en güçlü sunağın etkisi
function altarBuff(t) {
  let buff = 0, dmg = 0;
  if (!G || !TOWERS.altar) return null;
  for (const a of G.towers) {
    if (a.type !== 'altar' || a === t || a.disabledT > 0) continue;
    const L = a.def.levels[a.lvl];
    if (dist(a.x, a.y, t.x, t.y) > L.range) continue;
    if (t.type === 'archer') dmg = Math.max(dmg, L.ally || 0); // lanet aurası: okçu/arbaletçiler daha sert vurur
    const ri = abRank(a, 'rite'); if (!ri) continue; // kan ayini
    buff = Math.max(buff, ri.rate); dmg = Math.max(dmg, ri.dmg);
  }
  return buff || dmg ? { buff, dmg } : null;
}
// tövbekâr (frenzy) canı azaldıkça sertleşir (lanet artık vuruş gücünü değil, saldırı hızını düşürür: curseSlowAtk)
const foeDmgMul = (e) => (e.dmgMul || 1) * (e.def.frenzy ? 1 + e.def.frenzy.dmg * (1 - e.hp / e.maxHp) : 1);
// Lanet Kulesi aurası (haritada tek): menzildeki iskeletler (mahzen askeri, dirilen ölü) daha sert vurur ve daha az hasar alır
function curseAura(x, y) {
  if (!G || !TOWERS.altar) return null;
  for (const a of G.towers) { if (a.type !== 'altar' || a.disabledT > 0) continue; const L = a.def.levels[a.lvl]; if (dist(a.x, a.y, x, y) <= L.range) return L; }
  return null;
}
const allyK = (s) => { const A = !s.hero && (s.tower || s.minion) && curseAura(s.x, s.y); return A ? 1 + A.ally : 1; };
// Engizisyon feneri (def.light): ışık dairesinde iskelet hasarı azalır, ceset diriltilemez, lanet tutmaz
function lightAt(x, y) {
  for (const o of G.enemies) { const L = o.def.light; if (L && !o.dead && Math.hypot(o.x - x, (o.y - y) * 1.3) < L.r) return L; }
  return null;
}
const curseSlowAtk = (e) => (e.curseT > 0 ? 1 + (e.curseWeak || 0) : 1);
function updateAltar(t, dt) {
  const L = effLevel(t), bl = abRank(t, 'blight');
  // lanet dalgası: kuleden yayılan mor halka (hasar vermez, yalnız laneti tazeler ve gösterir)
  t.pulseCd = (t.pulseCd ?? 0.6) - dt;
  if (t.pulseCd <= 0) {
    const near = G.enemies.filter(e => !e.dead && !e.under && dist(e.x, e.y, t.x, t.y) <= L.range);
    if (near.length) {
      t.pulseCd = L.every; t.shotAnim = 0.35; t.engageT = 2; // mabet animasyonu (varsa) düşman varken döngüde
      G.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, col: '190,90,255', t: 0, dur: 0.55 });
      for (const e of near) {
        for (let i = 0; i < 3; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: e.y - rand(4, 24), vy: -rand(15, 40), col: i % 2 ? '190,90,255' : '120,255,140', s0: rand(2.5, 4), s1: 0.4, life: rand(0.4, 0.7) });
      }
      sfx('zap');
    } else t.pulseCd = 0.3;
  }
  for (const e of G.enemies) {
    if (e.dead || e.under || dist(e.x, e.y, t.x, t.y) > L.range) continue;
    if (e.def.nocurse || lightAt(e.x, e.y)) continue; // taş heykel ve fener ışığındakiler lanet tutmaz
    const BF = towerForm(t);
    // girişte bir kez korku şansı (bosslar ve makineler korkmaz); korkan geri kaçar
    if (!e.altarRoll) { e.altarRoll = true;
      if (L.fear && !e.def.chief && !e.def.machine && e.siege === undefined && Math.random() < L.fear) {
        e.fearT = Math.max(e.fearT || 0, 1.6); e.fearMax = 1.6; e.hopT = 0.4; floatText(e.x, e.y - 30, '!', '#d8a8ff'); t.scareT = time + 1; // göz kızarır
        for (let i = 0; i < 6; i++) emit(G.parts, { kind: 'glow', add: true, x: e.x + rand(-6, 6), y: e.y - rand(6, 26), vy: -rand(20, 50), col: '170,110,255', s0: 3, s1: 0.4, life: 0.6 });
      }
    }
    e.curseT = Math.max(e.curseT || 0, L.linger || 0.4); // alandan çıkınca lanet 10 sn daha sürer e.curseK = Math.max(e.curseK || 0, L.curse); e.curseRise = Math.max(e.curseRise || 0, L.rise + (t.spec === 'blight' ? 0.1 : 0) + (BF && BF.rise || 0));
    e.curseRes = Math.max(e.curseRes || 0, L.res || 0); e.curseWeak = Math.max(e.curseWeak || 0, L.weak || 0);
    e.drumT = 0; e.armT = 0; // davul ve sancak coşkusu söner
    if (bl) e.blightN = Math.max(e.blightN || 0, bl.n);
    slowEnemy(e, L.slow, 0.4);
  }
}
function effLevel(t) {
  let L = t.def.levels[t.lvl];
  { const F = t.type !== 'archer' && towerForm(t); if (F && F.range) L = Object.assign({}, L, { range: L.range * F.range }); } // dönüşmüş kulenin menzili
  if (t.type === 'altar') return L;
  const ab = t.type !== 'barracks' && altarBuff(t);
  if (ab) L = Object.assign({}, L, { rate: L.rate / (1 + ab.buff), dmg: [L.dmg[0] * (1 + ab.dmg), L.dmg[1] * (1 + ab.dmg)] });
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
  const st = time - screenT, bg = spr(NECRO ? 'nm_title' : 'title_bg');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(24,12,4,0.5)'); g.addColorStop(1, 'rgba(14,8,2,0.82)');
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 54); ctx.scale(rk, rk); ribbon(0, 0, 320, 'GELİŞMELER', 'gold', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = 'map'; }), { appear: st - 0.1 });
  const free = starsTotal() - starsSpent();
  if (NECRO) velvetCard(W - 160, 26, 138, 38, 19); else roundRect(W - 160, 26, 138, 38, 19, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
  fancyStar(W - 139, 45, 13, true);
  txt(`${free} yıldız`, W - 84, 46, 18, '#ffe27a', 'center', '400', FONT_T);
  txt('Bölümlerden kazandığın yıldızlarla kalıcı güç satın al · her satır soldan sağa açılır', W / 2, 100, 13.5, '#f0e2c4', 'center', '700', FONT_B, false);
  UPGRADES.forEach((u, i) => {
    const y = 140 + i * 56, r = upgRank(u.id), p = clamp((st - 0.1 - i * 0.05) / 0.35, 0, 1);
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - easeOutBack(p)) * -60, 0);
    if (NECRO) velvetCard(70, y - 22, 820, 46, 23); else roundRect(70, y - 22, 820, 46, 23, 'rgba(30,18,8,0.75)', 'rgba(212,171,90,0.5)', 1.5);
    circle(98, y + 1, 19, '#2a1c10', '#c9a35a', 2);
    upgradeIcon(u.id, 98, y + 1);
    txt(u.name, 128, y + 1, 18, '#ffe9b0', 'left', '400', FONT_T);
    u.ranks.forEach((rk2, j) => {
      const x = 262 + j * 208, bought = j < r, next = j === r, can = next && free >= rk2.cost;
      const key = 'up' + u.id + j, sc = pressScale(key);
      ctx.save(); ctx.translate(x + 95, y + 1); ctx.scale(sc, sc);
      const fill = bought ? '#3c7a24' : can ? (NECRO ? '#7a1434' : '#6a4a1c') : NECRO ? 'rgba(26,8,24,0.85)' : 'rgba(60,44,28,0.85)';
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
  } else if (id === 'spells') { ctx.save(); ctx.translate(x, y); ctx.scale(0.9, 0.9); drawUltGlyph('zeynep', 20); ctx.restore(); }
  else drawIcon('heart', x, y, 20);
}

// ---------- KODEKS: görülen düşmanların ve kulelerin kartları ----------
// save.codex: görülen düşman türleri (rütbeliler asıl türün kaydına sayılır); save.codexNew: kodekste henüz bakılmamış yeni kayıtlar.
const CODEX_ENEMIES = ['legion', 'drummer', 'solarcher', 'wardog', 'gladiator', 'signifer', 'assassin', 'eagle', 'priest', 'testudo', 'sunpriest', 'heavy', 'cavalry', 'chariot', 'horsearcher', 'ram', 'catapult', 'siegetower', 'vulture', 'elephant',
  'centurion', 'champion', 'hierophant', 'shadowmaster', 'ironwarden', 'cavcaptain', 'gloriosus',
  // 2. sefer: Engizisyon
  'hunter', 'hound', 'torch', 'holywater', 'flagellant', 'lantern', 'bellpriest', 'paladin', 'inquisitor', 'saint',
  'malleus', 'campanus', 'ignis', 'colossus', 'cathedral', 'severus'];
const CODEX_NOTE = {
  legion: 'Hepsi aynı kalıptan çıkmış. İskeletleri de birbirine benziyor, saymak kolay.',
  solarcher: 'Uzaktan ok atar, yakından ağlar. İskeletlerimi yanına yolla.',
  gladiator: 'Arenada alkış bekler. Burada tek alkış kemiklerinin takırtısı.',
  assassin: 'Gölgeye saklanır. Benim bahçemde gölgeler de benim, haberi yok.',
  priest: 'Yaralıları iyileştirir. Ben de ölüleri. Mesleki rekabet.',
  heavy: 'Kalkanı kapımdan geniş. Oklar seker, ruh ışını geçer.',
  cavalry: 'At güzel. Üstündeki fazlalık. Atı bende kalsın.',
  ram: 'Kapımı çalmanın en kaba yolu. Zil var, zil!',
  horsearcher: 'Koşarken ok atıyor. Atı da ben olsam koşardım.',
  wardog: 'Köpekler. Kemiklerime fazla ilgi gösteriyorlar.',
  chariot: 'Tekerlekli kibir. Duvara toslayınca hepsi aynı.',
  siegetower: 'Yürüyen bir apartman. Kirayı içindekiler ödüyor.',
  vulture: 'Cesetlerimi yiyorlar. Bu bir hırsızlık. Kemikleri bari geri bıraksınlar.',
  hunter: 'Cadı avlıyormuş. Ben cadı değilim. Cadılar kibar olur.',
  hound: 'Beyaz köpekler. Kemik kokusunu alıyorlar, maalesef haklılar.',
  torch: 'Her şeyi yakıyor. Cesetleri de. İsrafa bak.',
  holywater: 'Kutsal su atıyor. Çayımı demlerdim o suyla.',
  flagellant: 'Kendini kırbaçlıyor. Bana bırakmıyor bile.',
  lantern: 'Bir fener. Gece benim, ışığını başka yere tut.',
  bellpriest: 'Çan çalıyor. Kemiklerim titriyor, ben değil.',
  paladin: 'Parlıyor. Gözlerimi alıyor. Kalkanı da çok büyük.',
  inquisitor: 'Kulelerimi sorguya çekiyor. Kuleler konuşmaz.',
  saint: 'Taş bir aziz. Laneti üstüne yapışmıyor, çok kaygan.',
  malleus: 'Avcıların başı. İki arbalet. Biri yetmiyormuş.',
  campanus: 'Sırtında çan taşıyor. Sırt ağrısı ondan.',
  ignis: 'Ateşli bir rahibe. Cesetlerimi kül etti, affetmem.',
  colossus: 'Bir katedral heykeli yürüyor. Mimarlara söylemek lazım.',
  cathedral: 'Tekerlekli kilise. Çanını sevmedim.',
  severus: 'Çaydanlığım onda. Konu kapanmıştır.',
  elephant: 'Fil getirmişler. Kemiklerinden bir kale yaparım, kapısı hortum.',
  eagle: 'İmparatorun kuşları. Kargalarım hiç sevmedi.',
  testudo: 'Kaplumbağa gibi geliyorlar. Kaplumbağa çorbası severim.',
  sunpriest: 'Cesetlerimi yakıyor! Bu israf. Ayrıca kaba.',
  signifer: 'Sancağı çok parlak. Gözüm yok ama yine de kamaştı.',
  drummer: 'Ritim duygusu yok. İskeletlerim daha iyi dans eder.',
  catapult: 'Bahçeme taş atıyor. Komşuluk bunu gerektirmez.',
  centurion: 'Borazanı çok sesli. Çayımı içemiyorum.',
  champion: 'Kalabalığı coşturur. Kalabalık az sonra benim olacak.',
  hierophant: 'Güneşe dua ediyor. Burada güneş öğlene kadar uyur.',
  ironwarden: 'Zırhı o kadar ağır ki iskeletlerim onu taşımaya üşeniyor.',
  shadowmaster: 'Gölgelerin ustası. Ben de mezarların ustasıyım. Tanışırız.',
  cavcaptain: 'Hücum ederken bağırır. Neden hep bağırıyorlar?',
  gloriosus: 'Kendi heykelini sipariş etmiş. Mezar taşını ben hediye ederim.',
  archer: 'Arbaletçilerim hiç ıskalamaz. Iskalasalar da cıvatayı geri toplarlar.',
  barracks: 'Eski komşular. Kira ödemiyorlar ama kapıyı iyi tutuyorlar.',
  mage: 'Ruhlar burada çalışıyor. Mesai bitince de çalışıyor.',
  artillery: 'Tarifi gizli: biraz veba, biraz çürük, bolca sevgi.',
  altar: 'Kan bağışı gönüllüdür. Genellikle.',
};
const CODEX = { tab: 'e', sel: { e: 'legion', t: 'archer' }, rank: 0, lvl: 2, t0: 0 };
function codexSeen(t) { return (save.codex || []).includes(t); }
function codexNote(type) {
  const d = ENEMIES[type], base = d.rank ? d.base : type;
  save.codex = save.codex || [];
  if (save.codex.includes(base)) return;
  save.codex.push(base); save.codexNew = save.codexNew || []; save.codexNew.push(base); persist();
  if (CODEX_ENEMIES.every(t => save.codex.includes(t))) achGive('codex');
}
// eski kayıtlar: tanıtım kartı gösterilmiş düşmanlar kodekse sayılır
if (save.seenEnemies2 && !save.codex) { save.codex = save.seenEnemies2.filter(t => CODEX_ENEMIES.includes(t)); persist(); }
function codexTowerOpen(type) { const u = TOWERS[type].unlockLevel; return u == null || (save.stars[u - 1] || 0) > 0; }
// düşmanın ilk göründüğü bölüm (dalgalar, boss, muhafız)
function codexFirstLevel(type) {
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    if (lv.boss === type) return i;
    for (const w of lv.waves) for (const g of w) {
      const ts = g.types || [g.t];
      if (ts.some(t => t === type || (ENEMIES[t] && ENEMIES[t].base === type && ENEMIES[t].rank))) return i;
      if ((BOSS_ESCORT[g.t] || []).some(([t]) => t === type)) return i;
    }
  }
  return -1;
}
// siluet: görülmemiş düşman karartılmış görünür
const SILHOUETTE = {};
function silhouette(name, im) {
  if (SILHOUETTE[name]) return SILHOUETTE[name];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1c1426'; g.fillRect(0, 0, c.width, c.height);
  return (SILHOUETTE[name] = c);
}
function codexEnemyImg(type) { const d = ENEMIES[type]; return d.base ? enemySprite(type) : spr('enemy_' + type); }
function speedName(v) { return v < 13 ? 'Çok yavaş' : v < 20 ? 'Yavaş' : v < 28 ? 'Orta' : v < 34 ? 'Hızlı' : 'Çok hızlı'; }
// düşman yetenekleri (veriden)
function enemySkills(d) {
  const L = [], ab = d.ab || {};
  if (d.ranged) L.push(d.ranged.hold ? 'Menzilli: uzakta durup iskeletlere ve komutana ok atar' : 'Menzilli: durup iskeletlere ok atar');
  if (d.heals) L.push('İyileştirir: yakındaki askerlerin canını doldurur');
  if (d.blink || ab.blink) L.push('Gölgeye dalar: ileri ışınlanır');
  if (ab.summon) L.push('Çağırır: yanına asker getirir');
  if (ab.howl) L.push(ab.howl.say === 'Borazan!' || d.chief ? 'Borazan: çevresindekileri hızlandırır' : 'Uluma: çevresindekileri hızlandırır');
  if (ab.slam) L.push('Yere vurur: iskeletleri sersemletir');
  if (ab.pounce) L.push('Atılır: ileri hücum eder');
  if (ab.shield) L.push('Kalkan: kısa süre hasar almaz');
  if (ab.bomb) L.push(`Mancınık ateşi: kuleyi ${ab.bomb.stun} sn susturur`);
  if (d.chief) L.push('Öfke: canı yarıya inince daha sert vurur');
  return L;
}
function codexBossHp(type) {
  const i = LEVELS.findIndex(lv => lv.boss === type), lv = LEVELS[i] || {}, tier = lv.tier ?? i;
  return Math.round((650 + 400 * Math.max(0, tier)) * (ENEMIES[type].hpK || 1));
}
function codexBookIcon(r) {
  ctx.save(); ctx.scale(r / 20, r / 20); ctx.lineJoin = 'round';
  // kapak: mor deri, ortada yeşil kafatası mührü
  ctx.fillStyle = '#e8dcbc'; ctx.strokeStyle = 'rgba(28,15,5,0.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-9, -11, 19, 22, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a2a7a'; ctx.beginPath(); ctx.roundRect(-11, -12, 18, 22, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a1a52'; ctx.fillRect(-11, -10, 3, 18);
  ctx.fillStyle = '#9dff9a'; ctx.beginPath(); ctx.arc(-1, -3, 4, Math.PI, 0); ctx.lineTo(3, 1); ctx.lineTo(-5, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a1a52'; ctx.beginPath(); ctx.arc(-2.6, -2.6, 1.1, 0, Math.PI * 2); ctx.arc(0.6, -2.6, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function fitTxt(s, x, y, maxW, size, col, align = 'left', weight = '800', font = FONT_B, stroke = false, min = 7.5) {
  s = TR(s);
  let sz = size; ctx.font = `${weight} ${sz}px ${font}`; lastFont = null;
  while (sz > min && ctx.measureText(s).width > maxW) { sz -= 0.5; ctx.font = `${weight} ${sz}px ${font}`; }
  if (ctx.measureText(s).width > maxW) { while (s.length > 2 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
  txt(s, x, y, sz, col, align, weight, font, stroke);
}
function codexStats(stats, x0, y) {
  stats.forEach(([a, b], i) => {
    const sx = x0 + (i % 2) * 112, sy = y + Math.floor(i / 2) * 20;
    txt(a, sx, sy, 10, '#a898b8', 'left', '700', FONT_B, false);
    fitTxt(b, sx + 106, sy, 44, 12, '#fff', 'right', '400', FONT_T);
  });
  return y + Math.ceil(stats.length / 2) * 20;
}
function codexChip(x, y, s, col, bg, size = 10.5) {
  ctx.font = `800 ${size}px ${FONT_B}`; lastFont = null; const w = ctx.measureText(s).width + 14;
  roundRect(x, y - 8, w, 16, 8, bg, col, 1); txt(s, x + w / 2, y + 0.5, size, col, 'center', '800', FONT_B, false);
  return w;
}
function codexPill(key, x, y, w, label, on, fn) {
  const sc = pressScale(key);
  ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(sc, sc);
  roundRect(-w / 2, -12, w, 24, 12, on ? '#c9962e' : 'rgba(40,26,14,0.9)', on ? '#ffe9a0' : 'rgba(212,171,90,0.5)', on ? 2 : 1.2);
  txt(label, 0, 1, 12, on ? '#fff' : '#cdbb98', 'center', '400', FONT_T);
  ctx.restore();
  buttons.push({ key, x, y: y - 14, w, h: 28, fn: () => { if (!on) { fn(); sfx('pick'); } } });
}
function drawCodex() {
  const st = time - screenT, bg = spr(NECRO ? 'nm_title' : 'title_bg');
  if (NECRO) menuBackdrop(st);
  else {
    if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
    else { ctx.fillStyle = '#2a1a2a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(20,10,24,0.55)'); g.addColorStop(1, 'rgba(10,6,12,0.88)');
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  ctx.save(); ctx.translate(W / 2, 46); ctx.scale(rk, rk); ribbon(0, 0, 300, 'KODEKS', 'blue', 26); ctx.restore();
  roundBtn('back', 44, 44, 23, 'back', () => go(() => { screen = menuBack; screenT = time; }), { appear: st - 0.1 });
  // sekmeler
  const tab = CODEX.tab, nE = CODEX_ENEMIES.filter(codexSeen).length;
  gameButton('cx_e', 160, 104, 200, 34, `DÜŞMANLAR ${nE}/${CODEX_ENEMIES.length}`, () => { CODEX.tab = 'e'; CODEX.t0 = time; }, tab === 'e' ? 'red' : 'dark', { size: 14, appear: st - 0.15 });
  gameButton('cx_t', 372, 104, 190, 34, 'KULELER', () => { CODEX.tab = 't'; CODEX.t0 = time; }, tab === 't' ? 'gold' : 'dark', { size: 14, appear: st - 0.2 });
  // sol: kart ızgarası
  const list = tab === 'e' ? CODEX_ENEMIES : TOWER_ORDER, cols = tab === 'e' ? 5 : 3, tw = tab === 'e' ? 74 : 118, th = tab === 'e' ? 84 : 118, gap = 8;
  const gx = 40, gy = 136;
  list.forEach((id, i) => {
    const x = gx + (i % cols) * (tw + gap), y = gy + Math.floor(i / cols) * (th + gap), p = clamp((st - 0.15 - i * 0.025) / 0.3, 0, 1);
    if (p <= 0) return;
    const known = tab === 'e' ? codexSeen(id) : codexTowerOpen(id), on = CODEX.sel[tab] === id, key = 'cx' + tab + id, sc = pressScale(key) * easeOutBack(p);
    const boss = tab === 'e' && ENEMIES[id].chief;
    ctx.save(); ctx.translate(x + tw / 2, y + th / 2); ctx.scale(sc, sc); ctx.translate(-(x + tw / 2), -(y + th / 2));
    if (on) glow(ctx, x + tw / 2, y + th / 2, tw * 0.8, boss ? '255,110,80' : '170,120,255', 0.35 + Math.sin(time * 4) * 0.1);
    if (NECRO) velvetCard(x, y, tw, th, 12, { border: on ? '#ffe9a0' : boss ? '#e0603e' : null, top: boss ? '#5e1018' : null });
    else { const bgc = ctx.createLinearGradient(0, y, 0, y + th); bgc.addColorStop(0, boss ? 'rgba(90,24,20,0.95)' : 'rgba(58,36,70,0.95)'); bgc.addColorStop(1, 'rgba(18,10,22,0.95)');
      roundRect(x, y, tw, th, 12, bgc, on ? '#ffe9a0' : boss ? '#c8563a' : 'rgba(170,140,210,0.55)', on ? 2.5 : 1.5); }
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 3, y + 3, tw - 6, th - 22, 9); ctx.clip();
    if (tab === 'e') {
      const im = codexEnemyImg(id);
      if (im) { const ih = boss ? 92 : id === 'ram' || id === 'catapult' || id === 'cavalry' ? 70 : 82; drawSprite(ctx, known ? im : silhouette('enemy_' + id, im), x + tw / 2, y + th - 22 + ih * 0.2, ih * im.width / im.height); }
    } else {
      const im = towerIcon(id, 3);
      if (im) drawSprite(ctx, known ? im : silhouette('tower_' + id, im), x + tw / 2, y + th - 24, (th - 26) * im.width / im.height * 0.95);
    }
    ctx.restore();
    fitTxt(known ? (tab === 'e' ? ENEMIES[id].name : TOWERS[id].name) : '???', x + tw / 2, y + th - 10, tw - 8, tab === 'e' ? 9.5 : 11, known ? '#f0e2c4' : '#8a7a9a', 'center', '800', FONT_B, false, 7);
    if (!known) drawIcon('lock', x + tw - 14, y + 14, 14);
    if ((save.codexNew || []).includes(id)) { const by = y + 6 + Math.sin(time * 5 + i) * 1.5; roundRect(x + tw - 34, by - 7, 34, 14, 7, '#e8434b', '#fff', 1.2); txt('YENİ', x + tw - 17, by + 0.5, 8.5, '#fff', 'center', '400', FONT_T); }
    ctx.restore();
    buttons.push({ key, x, y, w: tw, h: th, fn: () => { if (!known) { sfx('error'); return; } if (!on) { CODEX.sel[tab] = id; CODEX.t0 = time; CODEX.rank = 0; sfx('pick'); } } });
  });
  // sağ: ayrıntı kartı
  const id = CODEX.sel[tab], known = tab === 'e' ? codexSeen(id) : codexTowerOpen(id);
  const px = 476, py = 86, pw = 456, ph = 434, pk = clamp((st - 0.2) / 0.3, 0, 1);
  if (pk <= 0) return;
  ctx.save(); ctx.globalAlpha = pk;
  if (NECRO) pauseFrame(px, py, pw, ph, 0);
  else {
    roundRect(px + 3, py + 6, pw, ph, 18, 'rgba(0,0,0,0.4)');
    const pg = ctx.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, 'rgba(52,34,62,0.97)'); pg.addColorStop(1, 'rgba(20,12,24,0.97)');
    roundRect(px, py, pw, ph, 18, pg, '#b89ad8', 2);
    roundRect(px + 5, py + 5, pw - 10, ph - 10, 14, null, 'rgba(255,255,255,0.1)', 1.2);
  }
  if (!known) {
    drawIcon('lock', px + pw / 2, py + ph / 2 - 20, 40);
    txt(tab === 'e' ? 'Henüz karşılaşmadın' : 'Henüz açılmadı', px + pw / 2, py + ph / 2 + 22, 18, '#cdbb98', 'center', '400', FONT_T);
  } else if (tab === 'e') drawCodexEnemy(id, px, py, pw, ph);
  else drawCodexTower(id, px, py, pw, ph);
  ctx.restore();
  // bakılan kayıt artık yeni değil
  if (known && save.codexNew && save.codexNew.includes(id)) { save.codexNew = save.codexNew.filter(t => t !== id); persist(); }
}
// sahne: kaidenin üstünde canlı (yürüyen) karakter
function codexStage(x, y, w, h, col) {
  const g = ctx.createRadialGradient(x, y - h * 0.4, 10, x, y - h * 0.4, w * 0.7); g.addColorStop(0, `rgba(${col},0.28)`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - w, y - h, w * 2, h + 20);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 2, w * 0.42, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(${col},0.5)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y + 2, w * 0.42, 11, 0, 0, Math.PI * 2); ctx.stroke();
}
function drawCodexEnemy(id, px, py, pw, ph) {
  const ranked = RANKED.includes(id), r = ranked ? CODEX.rank : 0, type = r ? id + '_' + RANKS[r].id : id, d = ENEMIES[type];
  const k = easeOutBack(clamp((time - CODEX.t0) / 0.35, 0, 1));
  // sol üst: canlı karakter
  const cx = px + 104, cy = py + 210, im = codexEnemyImg(type);
  codexStage(cx, cy, 170, 190, d.chief ? '255,110,80' : r === 2 ? '255,210,90' : '170,130,255');
  if (im) {
    const big = d.chief ? 168 : ['ram', 'catapult', 'cavalry'].includes(id) ? 132 : 150;
    const hh = Math.min(big, 200 * im.height / im.width) * (0.6 + 0.4 * k);
    ctx.save(); ctx.beginPath(); ctx.rect(px + 4, py + 4, 206, 236); ctx.clip();
    drawUnit('enemy_' + type, im, cx, cy, 1, { h: hh, phase: time * 6, walking: true, fly: 0, seed: 0, rig: d.base ? 'enemy_' + d.base : undefined });
    ctx.restore();
    if (r === 2) drawRankStar(cx, cy - hh - 8);
  }
  // rütbe seçimi
  if (ranked) ['Er', 'Kıdemli', 'Yüzbaşı'].forEach((lb, i) => codexPill('cxr' + i, px + 14 + i * 66, py + 250, i ? 70 : 52, lb, r === i, () => { CODEX.rank = i; CODEX.t0 = time; }));
  // sağ üst: ad ve bilgiler
  const x0 = px + 222;
  txt(d.chief ? 'BOSS' : r ? `RÜTBE: ${RANKS[r].name.toLocaleUpperCase('tr')}` : 'SOLARIAN İMPARATORLUĞU', x0, py + 26, 10.5, d.chief ? '#ff9a7a' : '#c8a8ff', 'left', '800', FONT_B, false);
  const nl = wrapLines(d.name, pw - 236, 22, '400', FONT_T, 2);
  nl.forEach((l, i) => txt(l, x0, py + 48 + i * 24, 22, '#fff', 'left', '400', FONT_T));
  let y = py + 54 + nl.length * 24;
  const fl = codexFirstLevel(id);
  if (fl >= 0) { fitTxt(`İlk görüldüğü yer: ${fl + 1}. bölüm · ${LEVELS[fl].name}`, x0, y, pw - 236, 10, '#a898b8', 'left', '700'); y += 18; }
  const hp = d.chief ? codexBossHp(id) : d.hp;
  const stats = [['Can', hp + ''], ['Zırh', `%${Math.round(d.armor * 100)}`], ['Büyü dir.', `%${Math.round(d.mr * 100)}`],
    ['Hız', speedName(d.speed)], ['Hasar', `${d.dmg[0]}–${d.dmg[1]}`], ['Can kaybı', d.lives + ''], ['Altın', d.gold + '']];
  y = codexStats(stats, x0, y) + 6;
  const wk = d.wk || {}, weak = Object.keys(wk).filter(q => wk[q] > 1), res = Object.keys(wk).filter(q => wk[q] < 1);
  let cxp = x0;
  if (NECRO && ARMOR_CLASS[d.acl]) { codexChip(cxp, y, `Zırh sınıfı: ${ARMOR_CLASS[d.acl].name}`, '#efe1c0', 'rgba(90,20,50,0.7)', 9.5); y += 20; } // hasar türü tablosu (10 Eki)
  for (const q of weak) cxp += codexChip(cxp, y, `Zayıf: ${WK_NAME[q]} +%${Math.round((wk[q] - 1) * 100)}`, '#ffd08a', 'rgba(150,60,10,0.6)', 9.5) + 4;
  if (weak.length) { y += 20; cxp = x0; }
  for (const q of res) cxp += codexChip(cxp, y, `Dirençli: ${WK_NAME[q]} −%${Math.round((1 - wk[q]) * 100)}`, '#a8d8ff', 'rgba(20,60,120,0.6)', 9.5) + 4;
  // alt: açıklama, yetenekler, Mortimer'ın notu
  let by = py + 284;
  const desc = ENEMY_DESC[id] || d.desc || '';
  if (r) { txt(r === 1 ? 'Kıdemli: %60 daha canlı, daha sert vurur, biraz daha zırhlı' : 'Yüzbaşı: 2,5 kat canlı, borazanıyla çevresini hızlandırır', px + 18, by, 11.5, r === 2 ? '#ffe27a' : '#ff9a8a', 'left', '800', FONT_B, false); by += 18; }
  wrapLines(d.chief ? d.desc : desc, pw - 36, 11.5, '700', FONT_B, 2).forEach(l => { txt(l, px + 18, by, 11.5, '#f0e2c4', 'left', '700', FONT_B, false); by += 16; });
  const sk = enemySkills(d);
  if (sk.length) {
    by += 2;
    for (const l of sk.slice(0, 4)) { circle(px + 22, by, 3, '#c8a8ff'); txt(l, px + 32, by + 0.5, 10.5, '#e0d4f0', 'left', '700', FONT_B, false); by += 15; }
  }
  codexNoteBox(CODEX_NOTE[id], px, Math.max(by + 6, py + ph - 58), pw);
}
function codexNoteBox(note, px, y, pw) {
  if (!note) return;
  roundRect(px + 14, y, pw - 28, 44, 10, 'rgba(232,220,188,0.95)', '#1a1024', 1.6);
  drawSkullIcon(px + 32, y + 22, 9);
  txt("Mortimer'ın notu", px + 48, y + 12, 9.5, '#6a4a8a', 'left', '800', FONT_B, false);
  wrapLines(note, pw - 80, 11.5, '800', FONT_B, 2).forEach((l, i) => txt(l, px + 48, y + 26 + i * 13, 11.5, '#2a1838', 'left', '800', FONT_B, false));
}
const DMG_NAME = { archer: 'Delici (ok)', mage: 'Ruh (büyü)', artillery: 'Veba/Ateş (alan)', barracks: 'Kesici (iskeletler)', altar: 'Saldırmaz' };
function drawCodexTower(id, px, py, pw, ph) {
  const T = TOWERS[id], li = clamp(CODEX.lvl, 0, T.levels.length - 1), L = T.levels[li], k = easeOutBack(clamp((time - CODEX.t0) / 0.35, 0, 1));
  const cx = px + 104, cy = py + 214, im = towerIcon(id, li + 1);
  codexStage(cx, cy, 170, 190, '170,130,255');
  if (im) { const h = (110 + li * 20) * (0.7 + 0.3 * k); drawSprite(ctx, im, cx, cy + 4, h * im.width / im.height); }
  ['1', '2', '3'].forEach((lb, i) => codexPill('cxl' + i, px + 30 + i * 54, py + 250, 46, lb + '. sv', li === i, () => { CODEX.lvl = i; CODEX.t0 = time; }));
  const x0 = px + 222;
  txt(T.name.toLocaleUpperCase('tr'), x0, py + 26, 10.5, '#c8a8ff', 'left', '800', FONT_B, false);
  txt(L.title, x0, py + 48, 22, '#fff', 'left', '400', FONT_T);
  txt(`Hasar türü: ${DMG_NAME[id] || ''}`, x0, py + 70, 10, '#a898b8', 'left', '700', FONT_B, false);
  const stats = [['Maliyet', L.cost + ' altın'], ['Menzil', L.range + '']];
  if (id === 'barracks') stats.push(['İskelet canı', L.hp + ''], ['İsk. hasarı', `${L.dmg[0]}–${L.dmg[1]}`], ['İsk. zırhı', `%${Math.round(L.armor * 100)}`], ['Doğma süresi', L.respawn + ' sn']);
  else if (id === 'altar') stats.push(['Direnç kırma', `%${Math.round(L.res * 100)}`], ['Fazla hasar', `+%${Math.round(L.curse * 100)}`], ['Yavaşlık', `%${Math.round(L.slow * 100)}`], ['Güçsüzlük', `%${Math.round(L.weak * 100)}`], ['Dirilme', `%${Math.round(L.rise * 100)}`]);
  else { stats.push(['Hasar', `${L.dmg[0]}–${L.dmg[1]}`], ['Atış arası', L.rate + ' sn']); if (L.splash) stats.push(['Alan', L.splash + '']); }
  let y = codexStats(stats, x0, py + 92) + 4;
  wrapLines(L.perk || T.desc, pw - 236, 11, '700', FONT_B, 3).forEach(l => { txt(l, x0, y, 11, '#f0e2c4', 'left', '700', FONT_B, false); y += 15; });
  // uzmanlıklar
  let by = py + 284;
  txt('UZMANLIKLAR (3. seviyede biri seçilir)', px + 18, by, 10.5, '#ffe27a', 'left', '800', FONT_B, false); by += 16;
  for (const a of T.abilities || []) {
    const S = SPEC[a.id] || {}, top = a.ranks[a.ranks.length - 1], title = S.title || a.name;
    txt(title, px + 18, by, 12.5, '#fff', 'left', '400', FONT_T);
    ctx.font = `400 12.5px ${FONT_T}`; lastFont = null; const nw = ctx.measureText(title).width;
    if (S.who) fitTxt('· ' + S.who, px + 24 + nw, by, pw - 48 - nw, 10, '#a898b8', 'left', '700');
    by += 13;
    fitTxt(`${a.name}, en üst kademe: ${a.desc(top)}`, px + 18, by, pw - 36, 10, '#cdbb98', 'left', '700');
    by += 14;
  }
  codexNoteBox(CODEX_NOTE[id], px, Math.max(by + 4, py + ph - 58), pw);
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
// menü arka planları ekranın tamamını (VIS, geniş telefonda çerçevenin yanları dahil) kaplar
function coverImage(im, zoom = 1, ox = 0, oy = 0) {
  const k = Math.max(VIS.w / im.width, VIS.h / im.height) * zoom, w = im.width * k, h = im.height * k;
  ctx.drawImage(im.width > w * 1.5 ? pickMip(ctx, im, w) : im, VIS.l + (VIS.w - w) / 2 + ox, VIS.t + (VIS.h - h) / 2 + oy, w, h);
}

// ----- Necromancer giriş ekranı: kemik rengi, mor konturlu, yeşil ışıklı başlık ve mezar taşı düğme -----
// ----- giriş ekranı: logo ve düğmeler önbellekte (gölgeli yazılar her karede çizilmez, kasma olmaz) -----
const TITLE_C = {};
// logo yazı tipi: Metal Mania (sivri, metal havası; Caner 10 Eki, Creepster'ın yerine); önbellekler yalnız yazı tipi yüklenince bir kez yenilenir
const FONT_LOGO = '"Metal Mania", "Russo One", "Arial Black", sans-serif';
let FONT_VER = 0;
if (document.fonts) {
  document.fonts.load('80px "Metal Mania"').then(() => { FONT_VER++; }).catch(() => {});
  document.fonts.ready.then(() => { FONT_VER++; }).catch(() => {});
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { FONT_VER++; }); // yazı tipleri sonradan gelirse önbellekli yazılar yenilenir
  // yazı tipi sayfası beklemeden yüklendiği için (index.html media=print) yüzler sonradan tanımlanır: gelene kadar yarım saniyede bir dene
  const fontPoll = setInterval(() => {
    Promise.all(['80px "Metal Mania"', '40px "Russo One"', '800 20px "Rubik"'].map(f => document.fonts.load(f))).then(r => {
      if (r.every(x => x.length)) { clearInterval(fontPoll); FONT_VER++; }
    }).catch(() => {});
  }, 500);
  setTimeout(() => clearInterval(fontPoll), 20000);
}
function offscreen(w, h, k = 2) { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.scale(k, k); return [c, g]; }
// logo: üstte koyu kızıl, altın çerçeveli kurdelede "DON'T MESS WITH" (arayüz yazı tipi, kemik beyazı),
// altta Metal Mania ile kan kırmızısı "THE NECROMANCER"
function titleLogo() {
  if (TITLE_C.logo && TITLE_C.logo.ver === FONT_VER) return TITLE_C.logo;
  const LW = 780, LH = 260, [c, g] = offscreen(LW, LH), cx = LW / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  // kurdele: iki yanda katlanmış uçlar, ortada gövde
  const ry = 50, rw = 430, rh = 56;
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sd * (rw / 2 - 10), ry - rh / 2 + 12); g.lineTo(cx + sd * (rw / 2 + 52), ry - rh / 2 + 12);
    g.lineTo(cx + sd * (rw / 2 + 32), ry + 12); g.lineTo(cx + sd * (rw / 2 + 52), ry + rh / 2 + 12); g.lineTo(cx + sd * (rw / 2 - 10), ry + rh / 2 + 12); g.closePath();
    g.fillStyle = '#3a060c'; g.fill(); g.strokeStyle = '#0c0204'; g.lineWidth = 3.5; g.stroke();
    g.beginPath(); g.moveTo(cx + sd * (rw / 2), ry + rh / 2); g.lineTo(cx + sd * (rw / 2 - 10), ry + rh / 2 + 12); g.lineTo(cx + sd * (rw / 2 - 10), ry + rh / 2); g.closePath();
    g.fillStyle = '#12020a'; g.fill(); // katlanma gölgesi
  }
  let gr = g.createLinearGradient(0, ry - rh / 2, 0, ry + rh / 2); gr.addColorStop(0, '#f6e7b4'); gr.addColorStop(0.5, '#c9a35a'); gr.addColorStop(1, '#8a6428');
  g.beginPath(); g.roundRect(cx - rw / 2, ry - rh / 2, rw, rh, 8); g.fillStyle = gr; g.fill(); g.strokeStyle = '#0c0204'; g.lineWidth = 3.5; g.stroke();
  gr = g.createLinearGradient(0, ry - rh / 2, 0, ry + rh / 2); gr.addColorStop(0, '#7e121a'); gr.addColorStop(0.55, '#4e0a10'); gr.addColorStop(1, '#2a0408');
  g.beginPath(); g.roundRect(cx - rw / 2 + 4, ry - rh / 2 + 4, rw - 8, rh - 8, 5); g.fillStyle = gr; g.fill();
  gr = g.createLinearGradient(0, ry - rh / 2, 0, ry); gr.addColorStop(0, 'rgba(255,220,200,0.22)'); gr.addColorStop(1, 'rgba(255,220,200,0)');
  g.fillStyle = gr; g.fillRect(cx - rw / 2 + 4, ry - rh / 2 + 4, rw - 8, rh / 2 - 4);
  g.font = `40px ${FONT_LOGO}`;
  if ('letterSpacing' in g) g.letterSpacing = '3px';
  const DM = "DON'T MESS WITH", dx = ('letterSpacing' in g) ? 1.5 : 0;
  g.strokeStyle = '#0c0204'; g.lineWidth = 8; g.strokeText(DM, cx + dx, ry + 3);
  gr = g.createLinearGradient(0, ry - 16, 0, ry + 18); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#fbf1d6'); gr.addColorStop(1, '#e2cc93');
  g.fillStyle = gr; g.fillText(DM, cx + dx, ry + 2);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  // ana yazı
  const ty = 150, T = 'THE NECROMANCER';
  let sz = 100; g.font = `${sz}px ${FONT_LOGO}`;
  while (g.measureText(T).width > LW - 40) { sz -= 4; g.font = `${sz}px ${FONT_LOGO}`; } // geniş yazı tipinde taşmasın
  const tw = g.measureText(T).width;
  // harf maskesi (2x): üzerinden geçen ışık yalnız harflere düşsün
  const [m, mg] = offscreen(LW, LH); mg.font = g.font; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillStyle = '#fff'; mg.fillText(T, cx, ty);
  // gölge, kalın koyu kontur, iç koyu kızıl kontur (kan damlaları 10 Eki'de kaldırıldı, Caner)
  g.save(); g.shadowColor = 'rgba(255,30,20,0.7)'; g.shadowBlur = 28; g.strokeStyle = '#0c0204'; g.lineWidth = sz * 0.2; g.strokeText(T, cx, ty); g.restore();
  g.strokeStyle = '#0c0204'; g.lineWidth = sz * 0.2; g.strokeText(T, cx, ty + 5);
  g.strokeStyle = '#3a0610'; g.lineWidth = sz * 0.09; g.strokeText(T, cx, ty);
  // dolgu: üstte açık, ortada kan kırmızısı, altta koyu kan
  gr = g.createLinearGradient(0, ty - sz / 2, 0, ty + sz * 0.45);
  gr.addColorStop(0, '#ffd9c8'); gr.addColorStop(0.28, '#ff4a32'); gr.addColorStop(0.6, '#d0101a'); gr.addColorStop(1, '#9a0812');
  g.fillStyle = gr; g.fillText(T, cx, ty);
  gr = g.createLinearGradient(0, ty - sz / 2, 0, ty); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillText(T, cx, ty - 2);
  // parıltı maskesi: yalnız ana yazının harfleri
  TITLE_C.logo = { c, m, w: LW, h: LH, ver: FONT_VER };
  return TITLE_C.logo;
}
function drawTitleLogo(x, y, k) {
  const L = titleLogo();
  ctx.drawImage(L.c, x - L.w / 2 * k, y - L.h / 2 * k, L.w * k, L.h * k);
  // ara ara harflerin üzerinden geçen ışık
  const ph = (time * 0.32) % 2.2 - 0.3;
  if (ph < -0.1 || ph > 1.1) return;
  const [t, tg] = TITLE_C.shine || (TITLE_C.shine = offscreen(L.w, L.h));
  tg.setTransform(2, 0, 0, 2, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, L.w, L.h);
  const sx = ph * L.w, sg = tg.createLinearGradient(sx - 70, 0, sx + 70, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,240,0.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  tg.fillStyle = sg; tg.fillRect(0, 0, L.w, L.h);
  tg.globalCompositeOperation = 'destination-in'; tg.setTransform(1, 0, 0, 1, 0, 0); tg.drawImage(L.m, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(t, x - L.w / 2 * k, y - L.h / 2 * k, L.w * k, L.h * k); ctx.restore();
}
// büyük OYNA düğmesi: sade kapsül — koyu kızıl (logo ve Mortimer'ın cübbesiyle aynı), ince altın çerçeve, üstte cam parlaklığı,
// yazının iki yanında küçük altın elmas (gövde önbellekte)
function playButtonBody(w, h, label) {
  const key = w + 'x' + h + label;
  if (TITLE_C.btn && TITLE_C.btn.key === key && TITLE_C.btn.ver === FONT_VER) return TITLE_C.btn;
  const P = 24, [c, g] = offscreen(w + P * 2, h + P * 2), x0 = P, y0 = P;
  const cap = (gg, o) => { const r = h / 2 - o; gg.beginPath(); gg.moveTo(x0 + h / 2, y0 + o); gg.lineTo(x0 + w - h / 2, y0 + o);
    gg.arc(x0 + w - h / 2, y0 + h / 2, r, -Math.PI / 2, Math.PI / 2); gg.lineTo(x0 + h / 2, y0 + h - o); gg.arc(x0 + h / 2, y0 + h / 2, r, Math.PI / 2, Math.PI * 1.5); gg.closePath(); };
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 14; g.shadowOffsetY = 5; cap(g, 0); g.fillStyle = '#1a0406'; g.fill(); g.restore();
  let gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#f6e7b4'); gr.addColorStop(0.5, '#c9a35a'); gr.addColorStop(1, '#8a6428');
  cap(g, 0); g.fillStyle = gr; g.fill(); // altın çerçeve
  cap(g, 2.2); g.fillStyle = '#240407'; g.fill();
  gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#a3222a'); gr.addColorStop(0.55, '#6e0f16'); gr.addColorStop(1, '#3e060b');
  cap(g, 3.4); g.fillStyle = gr; g.fill();
  g.save(); cap(g, 3.4); g.clip(); // üst yarıda cam parlaklığı
  gr = g.createLinearGradient(0, y0, 0, y0 + h * 0.55); gr.addColorStop(0, 'rgba(255,220,200,0.32)'); gr.addColorStop(1, 'rgba(255,220,200,0.02)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x0 + w / 2, y0 + h * 0.08, w * 0.48, h * 0.42, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.font = `${Math.round(h * 0.5)}px ${FONT_T}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if ('letterSpacing' in g) g.letterSpacing = Math.round(h * 0.07) + 'px';
  const tx = x0 + w / 2 + (('letterSpacing' in g) ? h * 0.035 : 0), ty = y0 + h / 2 + 2;
  g.strokeStyle = 'rgba(30,2,6,0.9)'; g.lineWidth = 5; g.strokeText(label, tx, ty);
  gr = g.createLinearGradient(0, y0 + h * 0.25, 0, y0 + h * 0.75); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#f2d9a6');
  g.fillStyle = gr; g.fillText(label, tx, ty);
  const tw = g.measureText(label).width;
  for (const sd of [-1, 1]) { // yazının iki yanında ince çizgi ve elmas
    const dx = x0 + w / 2 + sd * (tw / 2 + 16);
    g.strokeStyle = 'rgba(240,215,150,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(dx + sd * 6, ty - 1); g.lineTo(dx + sd * 22, ty - 1); g.stroke();
    g.fillStyle = '#f0d58e'; g.beginPath(); g.moveTo(dx, ty - 6); g.lineTo(dx + 4.5, ty - 1); g.lineTo(dx, ty + 4); g.lineTo(dx - 4.5, ty - 1); g.closePath(); g.fill();
  }
  const [m, mg] = offscreen(w + P * 2, h + P * 2);
  cap(mg, 3.4); mg.fillStyle = '#fff'; mg.fill(); // parıltı maskesi: düğmenin iç yüzü
  TITLE_C.btn = { key, c, m, P, w, h, ver: FONT_VER };
  return TITLE_C.btn;
}
function necroPlayButton(key, x, y, w, h, label, fn, appear) {
  const a = appear == null ? 1 : easeOutBack(clamp(appear / 0.35, 0, 1));
  if (a <= 0.01) return;
  const B = playButtonBody(w, h, label), down = press.key === key;
  const sc = pressScale(key) * a * (1 + Math.sin(time * 2) * 0.012), dy = down ? 2 : 0;
  ctx.save(); ctx.translate(x, y + dy); ctx.scale(sc, sc);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 4, w * 0.62, '255,90,60', 0.14 + Math.sin(time * 2) * 0.05); ctx.restore();
  const X = -w / 2 - B.P, Y = -h / 2 - B.P, CW = w + B.P * 2, CH = h + B.P * 2;
  ctx.drawImage(B.c, X, Y, CW, CH);
  const ph = (time * 0.45) % 1.8 - 0.2;
  if (ph > -0.1 && ph < 1.1) {
    const [t, tg] = TITLE_C.bshine && TITLE_C.bshine[2] === B.key ? TITLE_C.bshine : (TITLE_C.bshine = [...offscreen(CW, CH), B.key]);
    tg.setTransform(2, 0, 0, 2, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, CW, CH);
    const sx = ph * CW, sg = tg.createLinearGradient(sx - 40, 0, sx + 10, CH);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,235,210,0.3)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    tg.fillStyle = sg; tg.fillRect(0, 0, CW, CH);
    tg.globalCompositeOperation = 'destination-in'; tg.setTransform(1, 0, 0, 1, 0, 0); tg.drawImage(B.m, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(t, X, Y, CW, CH); ctx.restore();
  }
  ctx.restore();
  if (fn) buttons.push({ key, x: x - w / 2, y: y - h / 2 - 12, w, h: h + 20, fn });
}
function drawSkullIcon(x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#e8e0c8'; ctx.strokeStyle = '#140c18'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.75, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(r * 0.45, r * 0.55); ctx.lineTo(-r * 0.45, r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#140c18'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.1, r * 0.2, r * 0.24, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.3, -r * 0.1, r * 0.2, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, -r * 0.3, -r * 0.1, r * 0.35, '120,255,140', 0.8); glow(ctx, r * 0.3, -r * 0.1, r * 0.35, '120,255,140', 0.8); ctx.restore();
  ctx.restore();
}
// yeni giriş görseli (Mortimer tahtında çay içiyor, lejyon geliyor): ışıklar görseldeki yerlerine (0..1) bağlı canlandırılır
const KEY_FX = {
  eyes: [[0.187, 0.307], [0.208, 0.309]], skull: [[0.175, 0.11], [0.198, 0.112]], cup: [0.348, 0.378], moon: [0.915, 0.122],
  torch: [[0.48, 0.517], [0.549, 0.491], [0.635, 0.487], [0.695, 0.463], [0.735, 0.564], [0.755, 0.457], [0.78, 0.469], [0.781, 0.664],
    [0.844, 0.666], [0.885, 0.451], [0.905, 0.683], [0.93, 0.472], [0.931, 0.562], [0.968, 0.51]],
  win: [[0.325, 0.26], [0.352, 0.263], [0.365, 0.164], [0.392, 0.228], [0.375, 0.355], [0.425, 0.254], [0.445, 0.178], [0.445, 0.276], [0.445, 0.362]],
  flame: [[0.042, 0.583, 70, '110,255,120'], [0.05, 0.72, 50, '190,120,255'], [0.333, 0.507, 46, '110,255,120'], [0.381, 0.645, 50, '190,120,255']],
  // görselin kendisi dalgalandırılan bölgeler [x0, y0, x1, y1, genlik(kaynak px), sıklık, hız]: tahtın yanındaki büyü alevleri, çay buharı
  // tür: 'fire' yalnız yeşil/mor alev pikselleri, 'steam' yalnız açık renkli buhar pikselleri kıpırdar (kol, cübbe, fincan yerinde kalır)
  warp: [[0.0, 0.40, 0.075, 0.70, 5, 0.05, 5, 'fire'], [0.025, 0.62, 0.105, 0.80, 4, 0.06, 4.5, 'fire'], [0.305, 0.43, 0.36, 0.525, 4, 0.07, 5.5, 'fire'],
    [0.365, 0.42, 0.425, 0.64, 5, 0.05, 4.6, 'fire'], [0.33, 0.28, 0.36, 0.352, 3, 0.13, 3, 'steam']],
  // yürüyüş yerinde dönen uzak kargalar: yalnız göğün sağ yarısında, küçük, uzaklaşıp kaybolur
  crowSky: [0.5, 0.97, 0.06, 0.24],
};
// dalgalanan bölge: görselin dikdörtgeni yatay şeritlere bölünür, her şerit yukarı doğru akan bir dalga kadar kayar,
// kenarlar yumuşak maskeyle asıl resme karışır (dikiş görünmez). Kaynak piksel uzayında önbellekli tuval.
function keyWarp(bg, ox, oy, iw, ih, r, i) {
  const C = TITLE_C.warp || (TITLE_C.warp = []);
  const sx = Math.round(r[0] * bg.width), sy = Math.round(r[1] * bg.height), sw = Math.round((r[2] - r[0]) * bg.width), sh = Math.round((r[3] - r[1]) * bg.height);
  let o = C[i];
  if (!o || o.w !== sw) {
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const m = document.createElement('canvas'); m.width = sw; m.height = sh;
    const mg = m.getContext('2d'); mg.drawImage(bg, sx, sy, sw, sh, 0, 0, sw, sh);
    const D = mg.getImageData(0, 0, sw, sh), px = D.data, key = new Uint8Array(sw * sh), E = Math.ceil(r[4]) + 1;
    for (let j = 0, q = 0; j < sw * sh; j++, q += 4) { // renk anahtarı: bu piksel alev/buhar mı
      const R = px[q], Gc = px[q + 1], B = px[q + 2], mx = Math.max(R, Gc, B), mn = Math.min(R, Gc, B);
      key[j] = r[7] === 'steam' ? (mn > 120 && mx - mn < 70 ? 1 : 0)
        : ((Gc > 110 && Gc - R > 35 && Gc - B > 10) || (B > 120 && B - Gc > 45 && R - Gc > 10)) ? 1 : 0;
    }
    // yatayda E px aşındır: kayan şerit alevin dışından (kol, cübbe) piksel getirmesin
    const er = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let ok = 1; for (let k = -E; k <= E && ok; k++) { const xx = x + k; if (xx < 0 || xx >= sw || !key[y * sw + xx]) ok = 0; }
      er[y * sw + x] = ok;
    }
    for (let pass = 0; pass < 2; pass++) { // kenarı yumuşat (3x3 kutu bulanıklığı)
      const t = er.slice();
      for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
        let a = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += t[(y + dy) * sw + x + dx];
        er[y * sw + x] = a / 9;
      }
    }
    for (let j = 0, q = 0; j < sw * sh; j++, q += 4) {
      const x = j % sw, y = (j / sw) | 0, edge = Math.min(1, x / 6, (sw - 1 - x) / 6, y / 6, (sh - 1 - y) / 6); // bölge kenarında sıfıra iner
      px[q] = px[q + 1] = px[q + 2] = 0; px[q + 3] = Math.round(255 * er[j] * Math.max(0, edge));
    }
    mg.putImageData(D, 0, 0);
    o = C[i] = { c, g: c.getContext('2d'), m, w: sw };
  }
  const g = o.g, A = r[4], F = r[5], S = r[6], st = 3;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, sw, sh);
  for (let y = 0; y < sh; y += st) {
    const up = 1 - y / sh, dx = A * (0.3 + 0.7 * up) * (Math.sin(y * F - time * S) + 0.4 * Math.sin(y * F * 2.3 - time * S * 1.7 + i));
    g.drawImage(bg, sx, sy + y, sw, st, dx, y, sw, st);
  }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(o.m, 0, 0);
  ctx.drawImage(o.c, ox + r[0] * iw, oy + r[1] * ih, (r[2] - r[0]) * iw, (r[3] - r[1]) * ih);
}
// meşale alevi: görselin alevi üstünde titreyen turuncu dil (görsel bozulmaz, yalnız ışık eklenir)
function keyTorch(bg, ox, oy, iw, ih, f, i) {
  const k = 0.5 + 0.5 * Math.sin(time * 13 + i * 2.1) * Math.sin(time * 7.7 + i), lean = Math.sin(time * 5 + i) * 0.016 * iw * 0.12;
  const s = iw / W, fx = ox + f[0] * iw + lean, fy = oy + f[1] * ih;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fh = (9 + 5 * k) * s, fw = 3.4 * s, gr = ctx.createLinearGradient(0, fy + 2 * s, 0, fy - fh);
  gr.addColorStop(0, 'rgba(255,200,90,0.55)'); gr.addColorStop(0.6, 'rgba(255,120,30,0.35)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(fx - fw, fy + 2 * s);
  ctx.quadraticCurveTo(fx - fw * 1.1, fy - fh * 0.5, fx + Math.sin(time * 9 + i) * fw * 0.8, fy - fh);
  ctx.quadraticCurveTo(fx + fw * 1.1, fy - fh * 0.5, fx + fw, fy + 2 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawKeyArt(bg) {
  // kapak görseli ekranın tamamını kaplar (geniş telefonda üstten/alttan biraz kırpılır, yanlarda boşluk kalmaz)
  const z = 1.035 + Math.sin(time * 0.1) * 0.012, k = Math.max(VIS.w / bg.width, VIS.h / bg.height) * z, iw = bg.width * k, ih = bg.height * k;
  const ox = VIS.l + (VIS.w - iw) / 2 + Math.sin(time * 0.07) * 6, oy = VIS.t + (VIS.h - ih) / 2 + Math.cos(time * 0.09) * 3, s = iw / W;
  ctx.drawImage(bg.width > iw * 1.5 ? pickMip(ctx, bg, iw) : bg, ox, oy, iw, ih);
  const P = (f) => [ox + f[0] * iw, oy + f[1] * ih];
  for (const [i, r] of KEY_FX.warp.entries()) keyWarp(bg, ox, oy, iw, ih, r, i);
  for (const [i, f] of KEY_FX.torch.entries()) keyTorch(bg, ox, oy, iw, ih, f, i);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const [mx, my] = P(KEY_FX.moon);
  glow(ctx, mx, my, 120 * s, '210,240,255', 0.2 + Math.sin(time * 0.8) * 0.04);
  // büyü alevleri ve kule pencereleri: yavaş nabız
  for (const [i, f] of KEY_FX.flame.entries()) { const [x, y] = P(f); glow(ctx, x, y - Math.sin(time * 3 + i) * 4, f[2] * s * (1 + Math.sin(time * 4.3 + i * 2) * 0.12), f[3], 0.22 + Math.sin(time * 5.1 + i) * 0.07); }
  for (const [i, f] of KEY_FX.win.entries()) { const [x, y] = P(f); glow(ctx, x, y, 13 * s, '120,255,140', 0.18 + Math.sin(time * 1.3 + i * 0.8) * 0.12); }
  // meşale ışığı titrer
  for (const [i, f] of KEY_FX.torch.entries()) {
    const [x, y] = P(f), fl = Math.sin(time * 11 + i * 1.7) * 0.5 + Math.sin(time * 17.3 + i) * 0.5;
    glow(ctx, x, y, (16 + fl * 3) * s, '255,170,70', 0.32 + fl * 0.1);
    if (Math.random() < 0.025) emit(uiParts, { kind: 'glow', add: true, x, y: y - 6 * s, vx: rand(-5, 5), vy: rand(-28, -16), col: '255,170,70', s0: rand(1, 2), s1: 0.3, life: rand(0.8, 1.5), a: 0.9 });
  }
  // Mortimer'ın gözleri ve tahttaki kafatası: kızıl parıltı, ara ara göz kırpar
  const blink = (time % 6.3) < 0.12 ? 0.15 : 1;
  for (const f of KEY_FX.eyes) { const [x, y] = P(f); glow(ctx, x, y, 11 * s, '255,40,30', (0.55 + Math.sin(time * 2.2) * 0.2) * blink); }
  for (const f of KEY_FX.skull) { const [x, y] = P(f); glow(ctx, x, y, 9 * s, '255,40,30', 0.4 + Math.sin(time * 1.7 + 1) * 0.2); }
  ctx.restore();
  // çay buharı: fincandan yükselen, kıvrılan üç ince duman çizgisi (doğar, yükselir, söner)
  const [cx, cy] = P(KEY_FX.cup);
  ctx.save(); ctx.lineCap = 'round';
  for (let j = 0; j < 3; j++) {
    const life = (time * 0.4 + j / 3) % 1, a = Math.sin(Math.PI * life) * 0.5, base = cy - 4 * s - life * 14 * s, len = 26 * s;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, x = cx + (j - 1) * 3 * s + Math.sin(u * 5 + time * 2.6 + j * 2) * (1.5 + u * 4) * s, y = base - u * len;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    const gr = ctx.createLinearGradient(0, base, 0, base - len);
    gr.addColorStop(0, `rgba(245,248,255,${a})`); gr.addColorStop(1, 'rgba(245,248,255,0)');
    ctx.strokeStyle = gr; ctx.lineWidth = (2.6 - life) * s; ctx.stroke();
  }
  ctx.restore();
}
// uzak kargalar: göğün sağında belirir, yavaşça süzülüp küçülerek uzaklaşır ve kaybolur (Mortimer'ın önünden geçmez)
function drawSkyCrows() {
  const [x0, x1, y0, y1] = KEY_FX.crowSky;
  TITLE_C.sky = (TITLE_C.sky || []).filter(c => time - c.t0 < c.life);
  if (!TITLE_C.skyT || time > TITLE_C.skyT) {
    TITLE_C.skyT = time + rand(2.5, 5);
    if (TITLE_C.sky.length < 4) TITLE_C.sky.push({ x: W * rand(x0 + 0.05, x1 - 0.1), y: H * rand(y0, y1), vx: rand(-14, 14) || 8, vy: rand(-4, 2), t0: time, life: rand(6, 9), s: rand(0.55, 0.85), ph: rand(0, 6) });
  }
  ctx.save(); ctx.fillStyle = '#120f18';
  for (const c of TITLE_C.sky) {
    const u = (time - c.t0) / c.life, x = c.x + c.vx * (time - c.t0), y = c.y + c.vy * (time - c.t0) + Math.sin(time * 1.3 + c.ph) * 2;
    if (x < W * x0) continue;
    const k = c.s * (1 - 0.6 * u), fl = Math.sin(time * 8 + c.ph);
    ctx.globalAlpha = Math.min(1, u * 5, (1 - u) * 3) * 0.85;
    ctx.save(); ctx.translate(x, y); ctx.scale(k * (c.vx < 0 ? -1 : 1), k);
    ctx.beginPath(); ctx.moveTo(-9, -fl * 4); ctx.quadraticCurveTo(-4, -2 - fl * 2, 0, 0); ctx.quadraticCurveTo(4, -2 - fl * 2, 9, -fl * 4);
    ctx.quadraticCurveTo(4, 0.5 - fl, 0, 2); ctx.quadraticCurveTo(-4, 0.5 - fl, -9, -fl * 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
// mağaza uygulaması (Capacitor): açılış görseli kapak çizilene kadar kalır, sonra yumuşakça kaybolur
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function hideSplash() { try { const P = window.Capacitor && window.Capacitor.Plugins; if (P && P.SplashScreen) P.SplashScreen.hide(); } catch (e) {} }
setTimeout(hideSplash, 6000); // kapak hiç gelmezse
function drawNecroTitle(st) {
  const key = spr('nm_key');
  // kapak görseli yüklenene kadar düz karanlık (eski başlık görseli ya da ara zeminler görünüp değişmesin); gelince karanlıktan belirir
  if (!key && time < 5) { ctx.fillStyle = '#06030a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); return; } // 5 sn'de gelmezse eski zemine düşer
  if (TITLE_C.keyT == null) { TITLE_C.keyT = time; hideSplash(); }
  if (key) drawKeyArt(key);
  const fadeIn = NATIVE ? 0 : clamp(1 - (time - TITLE_C.keyT) / 0.6, 0, 1); // uygulamada açılış görseli zaten kapakla aynı: karanlıktan belirme yok
  if (fadeIn > 0) { ctx.fillStyle = `rgba(6,3,10,${fadeIn})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
  const bg = key ? null : spr('nm_title');
  const bz = 1.06 + Math.sin(time * 0.1) * 0.02, bx = Math.sin(time * 0.07) * 8, by = Math.cos(time * 0.09) * 4;
  if (bg) coverImage(bg, bz, bx, by);
  else if (!key) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c0614'); g.addColorStop(1, '#141a12'); ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
  // ay ışığı (eski görsel): soğuk mor ton, aydan inen yavaş dönen huzmeler
  if (!key) {
  ctx.fillStyle = 'rgba(40,20,70,0.16)'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  const mx = W * 0.77, my = H * 0.16;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, mx, my, 150, '200,210,255', 0.16 + Math.sin(time * 0.8) * 0.03);
  ctx.translate(mx, my);
  for (let i = 0; i < 5; i++) {
    const a = 1.75 + i * 0.22 + Math.sin(time * 0.15 + i) * 0.05, len = 520, wd = 0.045 + (i % 2) * 0.02;
    const gr = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(190,200,255,0.10)'); gr.addColorStop(1, 'rgba(190,200,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, len, a - wd, a + wd); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  }
  // sürüklenen yeşil sis
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = ((time * (8 + i * 3) + i * 170) % (W + 400)) - 200, y = H * (0.66 + (i % 3) * 0.1) + Math.sin(time * 0.5 + i) * 10;
    glow(ctx, x, y, 150 + (i % 3) * 40, '90,200,120', 0.08);
  }
  ctx.restore();
  // kenar karartması (önbellekte)
  if (!TITLE_C.vig) {
    const [c, g] = offscreen(W, H, 1);
    let gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.72); gr.addColorStop(0, 'rgba(4,2,8,0)'); gr.addColorStop(1, 'rgba(4,2,8,0.7)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, 'rgba(6,3,12,0.7)'); gr.addColorStop(1, 'rgba(6,3,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 200);
    gr = g.createLinearGradient(0, H - 190, 0, H); gr.addColorStop(0, 'rgba(4,2,8,0)'); gr.addColorStop(1, 'rgba(4,2,8,0.85)'); g.fillStyle = gr; g.fillRect(0, H - 190, W, 190);
    TITLE_C.vig = c;
  }
  if (!key) ctx.drawImage(TITLE_C.vig, 0, 0, W, H); // yeni kapak görselinde karartma yok (Caner istemedi)
  // uzakta ara ara şimşek
  TITLE_C.bolt = TITLE_C.bolt ?? time + 5;
  if (time > TITLE_C.bolt) { TITLE_C.bolt = time + rand(7, 13); TITLE_C.flash = time; }
  if (TITLE_C.flash && time - TITLE_C.flash < 0.5) {
    const k = time - TITLE_C.flash, a = (k < 0.08 ? 1 : k < 0.16 ? 0.3 : k < 0.24 ? 0.8 : Math.max(0, 1 - (k - 0.24) / 0.26)) * 0.22;
    ctx.fillStyle = `rgba(210,220,255,${a})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  // gökte geçen kargalar
  if (key) drawSkyCrows(key);
  else {
  TITLE_C.crows = (TITLE_C.crows || []).filter(c => c.x > -60 && c.x < W + 60);
  if (!TITLE_C.crowT || time > TITLE_C.crowT) { TITLE_C.crowT = time + rand(5, 9); const l = Math.random() < 0.5; TITLE_C.crows.push({ x: l ? -40 : W + 40, y: rand(150, 260), v: (l ? 1 : -1) * rand(60, 90), ph: rand(0, 6), t: time }); }
  for (const c of TITLE_C.crows) { const dt = time - c.t; c.t = time; c.x += c.v * dt; drawFlyingCrow(c.x, c.y + Math.sin(time + c.ph) * 4, c.v > 0 ? 1 : -1, time * 9 + c.ph); }
  }
  // logo: düşerek gelir, sonra hafifçe süzülür
  const e = easeOutBack(clamp(st / 0.8, 0, 1));
  ctx.save(); ctx.globalAlpha = clamp(st / 0.3, 0, 1);
  if (key) drawTitleLogo(W * 0.6, 114 + Math.sin(time * 1.2) * 3 - (1 - e) * 40, 0.64 * (0.85 + 0.15 * e)); // sağ üst düğmelerin altında kalsın
  else drawTitleLogo(W / 2, 102 + Math.sin(time * 1.2) * 3 - (1 - e) * 40, 0.92 * (0.85 + 0.15 * e));
  ctx.restore();
  necroPlayButton('play', W / 2, 452, 230, 56, 'OYNA', () => go(() => { screen = 'map'; }), st - 0.6);
  // yükselen yeşil ruh kıvılcımları
  if (Math.random() < 0.4) emit(uiParts, { kind: 'glow', add: true, x: rand(0, W), y: rand(H * 0.55, H), vx: rand(-6, 6), vy: rand(-26, -10),
    col: Math.random() < 0.7 ? '120,255,140' : '190,140,255', s0: rand(1.5, 3.4), s1: 0.4, life: rand(3, 5), a: 0.9, fadeIn: 0.4 });
}
function drawTitle() {
    const st = time - screenT;
    drawNecroTitle(st);
    roundBtn('snd', W - 38, 38, 21, muted ? 'mute' : 'sound', () => setMuted(!muted), { appear: st - 0.7 });
    roundBtn('settings', W - 88, 38, 21, 'gear', () => openSettings('title'), { appear: st - 0.75 });
    roundBtn('t_codex', W - 138, 38, 21, codexBookIcon, () => go(() => { menuBack = 'title'; screen = 'codex'; screenT = time; CODEX.t0 = time; }), { appear: st - 0.8 });
    roundBtn('t_ach', W - 188, 38, 21, (r) => { ctx.save(); ctx.scale(0.9, 0.9); drawIcon('crown', 0, 0, r * 1.3); ctx.restore(); }, () => go(() => { menuBack = 'title'; screen = 'ach'; screenT = time; }), { appear: st - 0.85 });
    txt('v0.3' + (window.SURUM ? ' · yayın ' + window.SURUM : ''), W - 14, H - 14, 12, 'rgba(255,255,255,0.6)', 'right', '700', FONT_B, false);
    return;
  }

// ----- bölüm seçimi: önizlemeli kartlar -----
const DIFF = ['Kolay', 'Kolay', 'Kolay', 'Orta', 'Orta', 'Orta', 'Orta', 'Zor', 'Zor', 'Zor', 'Zor', 'Çok zor', 'Çok zor', 'Çok zor', 'Efsane'];
const DIFF2 = ['Orta', 'Orta', 'Zor', 'Zor', 'Zor', 'Zor', 'Çok zor', 'Çok zor', 'Çok zor', 'Çok zor', 'Efsane', 'Efsane', 'Efsane', 'Efsane', 'Kâbus'];
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
  if ((save.stars[i] || 0) > 0) return true; // bitirilmiş bölüm hep açık (eski kayıttan taşınanlar dahil)
  return i === first ? epUnlocked(epOf(i)) : (save.stars[i - 1] || 0) > 0;
}
let mapEp = null;
function ensureMapEp() {
  if (mapEp == null) {
    const first = LEVELS.findIndex((lv, i) => levelUnlocked(i) && !(save.stars[i] > 0));
    mapEp = first < 0 ? EPISODES.length : epOf(first);
  }
  return mapEp;
}
// Harita zemini (5 mekân, her biri tam bölüm zemini) ilk açılışta karelere bölünse de telefonda takılıyordu (Caner, 11 Eki):
// giriş ekranındayken, görseller yüklendikten sonra parça parça önceden hazırlanır; çözünürlük ekrana göre (telefonda ~1,3x)
const mapRes = () => clamp(view.scale * view.dpr * 1.25, 1.2, 2);
let warmT = 0;
function warmMap() {
  if (!IMG_READY || time - warmT < 0.25) return;
  warmT = time;
  const ep = ensureMapEp(), E = EPISODES[ep - 1], R = REGION_BG[ep];
  if (E && E.zones && !(R && R.done && R.done.m.x >= BLEED.x && R.done.m.y >= BLEED.y)) { regionBg(ep); return; }
  const cur = LEVELS.findIndex((lv, i) => levelUnlocked(i) && !(save.stars[i] > 0)); // sıradaki bölümün kart önizlemesi de hazır olsun
  if (cur >= 0 && !THUMB[cur]) thumbOf(cur);
}
const THUMB = {};
function thumbOf(i) {
  if (THUMB[i]) return THUMB[i];
  if (thumbOf.at === time) return null; // kare başına en çok bir önizleme hazırlanır (takılma olmasın)
  thumbOf.at = time;
  const lv = LEVELS[i], bg = renderBackground(lv, lv.paths.map(buildPath), 0.75); // 480 px önizleme için düşük çözünürlük yeter (2x'te kart açılışı takılıyordu)
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.scale(480 / W, 270 / H);
  g.drawImage(pickMip(g, bg, W), 0, 0, W, H);
  const im = spr('castle_keep_1') || spr('castle_1') || spr('tower_barracks_3');
  if (im) { const cp = castlePlace(lv.castle[0], lv.castle[1], im); drawSprite(g, im, cp.x, cp.y, cp.w); }
  return (THUMB[i] = c);
}

// Bölüm haritası: seferin haritası ekranı kaplar; bölümler yol boyunca bayraklı madalyonlar olarak dizilir,
// aralarında noktalı patika vardır (açılan kısım parlak). Bayrağa dokununca bölüm kartı açılır.
let mapSel = null, mapSelT = 0;
function mapCurve(a, b, i) {
  // iki bayrak arası hafif kıvrımlı patika (yanlara sırayla bükülür)
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, bend = (i % 2 ? 1 : -1) * Math.min(22, l * 0.18);
  return [mx - dy / l * bend, my + dx / l * bend];
}
function drawMapTrail(nodes, ids) {
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1], c = mapCurve(a, b, i), open = levelUnlocked(ids[i + 1]);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(3, Math.floor(L / 11));
    for (let k = 1; k < n; k++) {
      const t = k / n, u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
      if (Math.hypot(x - a[0], y - a[1]) < 17 || Math.hypot(x - b[0], y - b[1]) < 17) continue;
      if (open) { circle(x, y + 1.2, 3.2, 'rgba(20,10,2,0.45)'); circle(x, y, 2.8, '#fff3d0', '#4a2a0e', 1.2); }
      else circle(x, y, 2.2, 'rgba(255,240,210,0.35)', 'rgba(20,10,2,0.35)', 1);
    }
  }
}
function drawMapNode(i, x, y, num, last, at) {
  const p = clamp(at / 0.4, 0, 1);
  if (p <= 0) return;
  const unlocked = levelUnlocked(i), st = save.stars[i] || 0, current = unlocked && st === 0;
  const e = easeOutBack(p), key = 'node' + i, sc = pressScale(key) * e;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(10,6,2,0.4)'; ctx.beginPath(); ctx.ellipse(0, 13, 17, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  if (!unlocked) {
    circle(0, 0, 12, '#5a544c', '#1e1a14', 2.2);
    circle(0, 0, 9, '#3e3a34');
    drawIcon('lock', 0, 0, 13);
    ctx.restore();
    return;
  }
  if (current) glow(ctx, 0, 0, 44, '255,210,100', 0.45 + Math.sin(time * 4) * 0.15);
  // bayrak direği ve sancak (tamamlananda sefer renginde, bölüm sonunda taçlı)
  const flagCol = epOf(i) === 1 ? ['#e8434b', '#8a1a14'] : ['#ffcf4a', '#a8701a'];
  const wv = Math.sin(time * 4 + i) * 1.5;
  ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(8, -34); ctx.stroke();
  ctx.strokeStyle = '#a8763a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(8, -34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -34); ctx.quadraticCurveTo(18, -33 + wv, 27, -29 + wv * 1.4); ctx.quadraticCurveTo(18, -25 + wv, 8, -22); ctx.closePath();
  const fg = ctx.createLinearGradient(8, -34, 27, -22); fg.addColorStop(0, flagCol[0]); fg.addColorStop(1, flagCol[1]);
  ctx.fillStyle = fg; ctx.fill(); ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 1.4; ctx.stroke();
  circle(8, -35, 2.2, '#ffd34d', '#5a3a08', 1);
  // madalyon
  const mg = ctx.createLinearGradient(0, -16, 0, 16); mg.addColorStop(0, '#fff0b0'); mg.addColorStop(1, '#a8681a');
  circle(0, 0, 16, mg, '#2e1606', 2);
  const mb = ctx.createRadialGradient(-4, -5, 2, 0, 0, 13);
  if (st > 0) { mb.addColorStop(0, '#5ab8ff'); mb.addColorStop(1, '#14408a'); } else { mb.addColorStop(0, '#f05a4a'); mb.addColorStop(1, '#7a140e'); }
  circle(0, 0, 12.5, mb);
  if (last) drawCrown(0, -1, 10);
  else txt(num + '', 0, 1, 16, '#fff', 'center', '400', FONT_T);
  // yıldızlar
  if (st > 0) for (let s = 0; s < 3; s++) fancyStar((s - 1) * 11, 22 - (s === 1 ? 2 : 0), s === 1 ? 6.5 : 5.5, s < st);
  ctx.restore();
  if (current) {
    // sıradaki bölüm: üstünde zıplayan ok ve adı
    const by = y - 52 + Math.sin(time * 5) * 4;
    ctx.save(); ctx.translate(x, by);
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(8, -6); ctx.lineTo(0, 5); ctx.closePath();
    ctx.fillStyle = '#ffd34d'; ctx.fill(); ctx.strokeStyle = '#3a2008'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    const name = LEVELS[i].name;
    ctx.font = `400 13px ${FONT_T}`; const w = ctx.measureText(name).width + 18;
    roundRect(x - w / 2, y + 26, w, 20, 10, 'rgba(30,16,6,0.85)', '#d4ab5a', 1.4);
    txt(name, x, y + 36.5, 13, '#ffe9a8', 'center', '400', FONT_T, false);
  }
  buttons.push({ key, x: x - 22, y: y - 40, w: 50, h: 64, fn: () => { mapSel = i; mapSelT = time; sfx('open'); } });
}

// ----- bölge haritası -----
// Beş mekânın zemini bölüm zemin çizeriyle (renderBackground) ayrı ayrı çizilir, soldan sağa yumuşak geçişle birleşir.
// Bölümleri tek kıvrımlı toprak yol bağlar, yolun sonunda şapel durur. Önbellekte tutulur; kare başına bir mekân hazırlanır.
const REGION_BG = {};
function regionRoad(E) {
  const P = [E.start, ...E.nodes, ...gateApproach([E.nodes[E.nodes.length - 1], E.end]).slice(1)], out = [];
  for (let i = 0; i < P.length - 1; i++) { // Catmull-Rom: noktaların hepsinden geçen yumuşak eğri
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 8; k++) {
      const t = k / 8, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(E.end);
  return out;
}
const REGION_TINT = { ravenwood: 'rgba(40,30,60,0.2)', plague: 'rgba(90,60,30,0.2)', monastery: 'rgba(20,80,80,0.22)', ossuary: 'rgba(90,60,120,0.22)', bloodmoon: 'rgba(150,20,30,0.25)', cursed: 'rgba(90,110,40,0.08)', bog: 'rgba(30,120,100,0.2)', graveyard: 'rgba(110,100,140,0.2)', blacklake: 'rgba(20,40,100,0.28)', necrogate: 'rgba(120,30,90,0.2)' };
const regionCastle = (E) => E.end;
function regionBg(ep) {
  const E = EPISODES[ep - 1], R = REGION_BG[ep] || (REGION_BG[ep] = { parts: [] });
  if (R.done && R.done.m.x >= BLEED.x && R.done.m.y >= BLEED.y) return R.done;
  if (R.done) { R.done = null; R.parts = []; R.res = 0; } // ekran genişledi: taşma payıyla yeniden
  if (!R.road) R.road = [buildPath(regionRoad(E))];
  if (R.parts.length < E.zones.length) {
    const k = R.parts.length;
    const part = renderBackground({ name: 'bolge' + ep + '_' + k, theme: E.zones[k][0], plots: E.nodes, castle: regionCastle(E), roadK: 0.62, decorK: 1.9 }, R.road, R.res || (R.res = mapRes()), BLEED);
    // her mekânın kendi rengi: bataklık yeşil-mavi, mezarlık kül moru, kara göl gece mavisi, kapı kızıl mor
    const tint = REGION_TINT[E.zones[k][0]];
    if (tint) { const pg = part.getContext('2d'); pg.setTransform(1, 0, 0, 1, 0, 0); pg.fillStyle = tint; pg.fillRect(0, 0, part.width, part.height); }
    R.parts.push(part);
    if (R.parts.length < E.zones.length) return R.parts[0];
  }
  const m = R.parts[0].m, c = document.createElement('canvas'); c.width = R.parts[0].width; c.height = R.parts[0].height; c.m = m;
  const rs = R.res || 2, g = c.getContext('2d'), zw = W * rs / E.zones.length, blend = 70 * rs, x0 = m.x * rs; // mekânlar çerçeveye göre bölünür, uçtakiler taşma payına uzar
  g.drawImage(R.parts[0], 0, 0);
  for (let i = 1; i < R.parts.length; i++) {
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    const tg = t.getContext('2d');
    tg.drawImage(R.parts[i], 0, 0);
    tg.globalCompositeOperation = 'destination-in';
    const gr = tg.createLinearGradient(x0 + i * zw - blend, 0, x0 + i * zw + blend, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    tg.fillStyle = gr; tg.fillRect(0, 0, t.width, t.height);
    g.drawImage(t, 0, 0);
  }
  R.parts = null;
  return (R.done = c);
}
// uçan karga (haritaya yukarıdan bakılır): gövde uçuş yönünde, kanatlar iki yana açılıp kapanır; yerde gölgesi
function drawFlyingCrow(x, y, dir, ph) {
  const c = Math.cos(ph), span = 10 * (0.45 + 0.55 * Math.abs(c)), lift = c * 2.2;
  const wing = (sd, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(2.5, 0); ctx.quadraticCurveTo(1, sd * span * 0.6 - lift, -1.5, sd * span);
    ctx.lineTo(-3.2, sd * span * 0.92); ctx.lineTo(-3.4, sd * span * 0.75); ctx.lineTo(-4.6, sd * span * 0.68); // uçta tüyler
    ctx.quadraticCurveTo(-4, sd * span * 0.3, -2.5, 0); ctx.closePath(); ctx.fill();
  };
  ctx.save(); ctx.translate(x, y + 24); ctx.scale(dir, 0.55); ctx.globalAlpha *= 0.22;
  wing(-1, '#000'); wing(1, '#000'); ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  wing(-1, '#16131c'); wing(1, '#1c1824');
  ctx.fillStyle = '#121016';
  ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();            // gövde
  ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(-9, -2.6); ctx.lineTo(-9.5, 0); ctx.lineTo(-9, 2.6); ctx.closePath(); ctx.fill(); // yelpaze kuyruk
  ctx.beginPath(); ctx.arc(5.2, 0, 1.9, 0, Math.PI * 2); ctx.fill();                       // baş
  ctx.fillStyle = '#4a4038'; ctx.beginPath(); ctx.moveTo(6.8, -0.7); ctx.lineTo(9.4, 0); ctx.lineTo(6.8, 0.7); ctx.closePath(); ctx.fill(); // gaga
  ctx.restore();
}
// harita canlılığı: yolda yürüyen lejyon devriyesi, uçan kargalar, mezarlıkta ruh ışıkları
const MAPFX = { patrol: [], crows: [], nextPatrol: 0, nextCrow: 2 };
function drawRegionMap(E, ep, st) {
  const bg = regionBg(ep), R = REGION_BG[ep], bm = bg.m || { x: 0, y: 0 };
  ctx.drawImage(bg, -bm.x, -bm.y, W + 2 * bm.x, H + 2 * bm.y);
  const road = R.road[0], dt = Math.min(0.05, time - (MAPFX.last || time)); MAPFX.last = time;
  // devriye: girişten sıradaki bölüme kadar yürür ve orada söner (düşman oraya dayandı)
  const cur = Math.max(0, LEVELS.findIndex((lv, i) => levelUnlocked(i) && !(save.stars[i] > 0)));
  const node = E.nodes[Math.min(cur, E.nodes.length - 1)], stop = Math.max(60, nearestOnPaths(R.road, node[0], node[1]).along - 26);
  if (time > MAPFX.nextPatrol) { MAPFX.nextPatrol = time + 9; for (let i = 0; i < 4; i++) MAPFX.patrol.push({ d: -i * 15, off: (i % 2 ? 4 : -4), seed: Math.random() * 9 }); }
  const im = spr('enemy_legion');
  MAPFX.patrol = MAPFX.patrol.filter(u => u.d < stop + 30);
  for (const u of MAPFX.patrol) {
    u.d += dt * 16;
    if (u.d < 0 || !im) continue;
    const q = pathPos(road, u.d, u.off), a = clamp(Math.min(u.d / 20, (stop + 30 - u.d) / 30), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    drawUnit('enemy_legion', im, q.x, q.y, q.dx >= 0 ? 1 : -1, { h: 17, phase: (time + u.seed) * 7, walking: true, fly: 0, seed: u.seed });
    ctx.restore();
  }
  // şapel (haritada biraz büyük) ve balkonda kuru kafalı Mortimer: çay içer, arkasında ruh ışığı
  const ch = spr('castle_1'), mort = spr('mortimer');
  if (ch) {
    const cw = 150, chh = cw * ch.height / ch.width, cx = E.end[0], cy = E.end[1] + 0.17 * chh;
    drawSprite(ctx, ch, cx, cy, cw);
    const S = MORT_STAGE[1];
    if (mort) {
      const mx = cx - cw / 2 + S.at[0] * cw, my = cy - chh + S.at[1] * chh, mh = 36 + Math.sin(time * 1.6) * 0.4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, mx, my - mh * 0.55, mh * 1.4, '150,90,255', 0.45 + Math.sin(time * 2) * 0.1);
      glow(ctx, mx, my - mh * 0.55, mh * 0.75, '120,255,140', 0.35 + Math.sin(time * 2.6) * 0.08);
      ctx.restore();
      const tea = mortStrip('mortimer_cay');
      if (tea) { ctx.save(); ctx.translate(mx, my); drawFrame(spr(tea), ANIM_META[tea], Math.floor(time * 12) % ANIM_META[tea].n, mh * MORT_SIT_K); ctx.restore(); }
      else drawSprite(ctx, mort, mx, my, mh * mort.width / mort.height);
      if (S.rail) { // korkuluk ayakların önünde
        const [x0, y0, x1, y1] = S.rail;
        ctx.drawImage(ch, x0 * ch.width, y0 * ch.height, (x1 - x0) * ch.width, (y1 - y0) * ch.height, cx - cw / 2 + x0 * cw, cy - chh + y0 * chh, (x1 - x0) * cw, (y1 - y0) * chh);
      }
      // çay buharı: fincandan kıvrılarak yükselen üç ince tel
      const tx = mx + mh * 0.29, ty = my - mh * 0.66;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) {
        const ph = (time * 0.55 + i / 3) % 1, a = Math.sin(ph * Math.PI) * 0.75;
        ctx.strokeStyle = `rgba(245,245,238,${Math.min(1, a * 1.25)})`; ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const yy = ty - (ph * 6 + k * 1.5), xx = tx + (i - 1) * 1.6 + Math.sin(k * 0.8 + time * 3 + i * 2) * 1.6;
          k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // yavaş sürüklenen sis
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 233 + time * (6 + i * 2)) % (W + 400)) - 200, y = 130 + i * 85 + Math.sin(time * 0.3 + i) * 12;
    glow(ctx, x, y, 170, '150,170,190', 0.05);
  }
  // mezarlıkta ve kara gölde süzülen ruh ışıkları
  for (let i = 0; i < 9; i++) {
    const ph = (time * 0.12 + i * 0.37) % 1, zx = i < 5 ? 400 : 580, x = zx + ((i * 71) % 170) + Math.sin(time * 0.8 + i) * 8, y = 470 - ((i * 53) % 260) - ph * 40;
    glow(ctx, x, y, 7, i < 5 ? '140,255,170' : '140,190,255', 0.5 * Math.sin(ph * Math.PI));
  }
  ctx.restore();
  // kargalar: arada bir ekranı kanat çırparak geçer
  if (time > MAPFX.nextCrow) { MAPFX.nextCrow = time + rand(4, 8); const l = Math.random() < 0.5; MAPFX.crows.push({ x: l ? -30 : W + 30, y: rand(110, 380), v: (l ? 1 : -1) * rand(70, 100), ph: rand(0, 6) }); }
  MAPFX.crows = MAPFX.crows.filter(c => c.x > -60 && c.x < W + 60);
  for (const c of MAPFX.crows) {
    c.x += c.v * dt; c.y += Math.sin(time * 2 + c.ph) * 0.3;
    drawFlyingCrow(c.x, c.y, c.v > 0 ? 1 : -1, time * 9 + c.ph);
  }
}

let mapNote = null;
function drawMap() {
  // gelişme fiyatları arttı (9 Eki): harcanan yıldız eldekini aşıyorsa gelişmeler sıfırlanır, yıldızlar iade edilir
  if (!save.upgFix2) { save.upgFix2 = 1; if (starsSpent() > starsTotal()) save.upg = {}; persist(); }
  ensureMapEp();
  const E = EPISODES[mapEp - 1], ids = epLevels(mapEp);
  const st = time - screenT;
  if (E.zones) drawRegionMap(E, mapEp, st);
  else { const bg = spr(E.bg) || spr('title_bg'); if (bg) coverImage(bg, 1); else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); } }
  // üstte başlık için koyu bant, kenarlarda hafif vinyet
  let g = ctx.createLinearGradient(0, 0, 0, 110); g.addColorStop(0, 'rgba(24,12,4,0.55)'); g.addColorStop(1, 'rgba(24,12,4,0)');
  ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, 110 - VIS.t);
  g = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, W * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  const nodes = E.nodes || ids.map((_, k) => [120 + k * 80, 420 - (k % 2) * 60]);
  if (!E.zones) drawMapTrail(nodes, ids);
  ids.forEach((i, k) => drawMapNode(i, nodes[k][0], nodes[k][1], k + 1, k === ids.length - 1, st - 0.15 - k * 0.05));

  const rk = easeOutBack(clamp(st / 0.45, 0, 1));
  // üst çubuk (Caner, 11 Eki: mobilde dokunmaya göre büyütüldü, ekran kenarlarına yaslı): solda geri + sefer sekmeleri,
  // sağda yıldız sayacı ve 5 yuvarlak düğme (ayarlar, kodeks, başarımlar, günün sınavı, dükkân), aradaki boşlukta sefer adı
  const TY = EDGE.t + 42, RB = 25, RS = 60, L0 = EDGE.l, R0 = EDGE.r;
  roundBtn('back', L0 + 42, TY, 27, 'back', () => go(() => { screen = 'title'; mapSel = null; }), { appear: st - 0.1 });
  const tabX = (k) => L0 + 142 + k * 120;
  if (EPISODES.length > 1) EPISODES.forEach((ep, k) => {
    const n = k + 1, x = tabX(k), open = epUnlocked(n), on = n === mapEp, key = 'ep' + n;
    gameButton(key, x, TY, 112, 46, n + '. SEFER', null, on ? 'gold' : open ? 'wood' : 'dark', { appear: st - 0.3, size: 16, icon: open ? null : 'lock' });
    buttons.push({ key, x: x - 56, y: TY - 26, w: 112, h: 56, fn: () => {
      if (!open) { sfx('error'); return; }
      if (mapEp !== n) { mapEp = n; mapSel = null; screenT = time; sfx('pick'); }
    } });
  });
  const total = starsTotal(), pw = 142, px = R0 - 16 - pw;
  ctx.save(); ctx.globalAlpha = clamp((st - 0.15) / 0.25, 0, 1);
  roundRect(px, TY - 23, pw, 46, 23, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
  fancyStar(px + 24, TY, 15, true);
  txt(`${total} / ${LEVELS.length * 4}`, px + 86, TY + 1, 21, '#ffe27a', 'center', '400', FONT_T);
  ctx.restore();
  const bx = (i) => px - 14 - RB - i * RS;
  roundBtn('settings', bx(0), TY, RB, 'gear', () => openSettings('map'), { appear: st - 0.15 });
  roundBtn('codex', bx(1), TY, RB, codexBookIcon, () => go(() => { menuBack = 'map'; screen = 'codex'; CODEX.t0 = time; }), { appear: st - 0.2 });
  roundBtn('ach', bx(2), TY, RB, (r) => { ctx.save(); ctx.scale(0.9, 0.9); drawIcon('crown', 0, 0, r * 1.3); ctx.restore(); }, () => go(() => { menuBack = 'map'; screen = 'ach'; screenT = time; }), { appear: st - 0.25 });
  { // günün sınavı: takvim düğmesi, bugün yapılmadıysa parlar
    const done = save.daily && save.daily.key === todayKey() && save.daily.done, k = RB / 19;
    if (!done) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, bx(3), TY, 34, '255,200,90', 0.3 + Math.sin(time * 3) * 0.1); ctx.restore(); }
    roundBtn('daily', bx(3), TY, RB, (r) => {
      ctx.save(); ctx.scale(k, k);
      roundRect(-9, -8, 18, 17, 3, '#f2ead6', '#2a1608', 1.4); ctx.fillStyle = '#c8322a'; ctx.fillRect(-9, -8, 18, 5);
      txt(new Date().getDate() + '', 0, 3.5, 9, '#2a1608', 'center', '400', FONT_T, false);
      if (done) { ctx.strokeStyle = '#3cbf3c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(-1, 6); ctx.lineTo(7, -4); ctx.stroke(); }
      ctx.restore();
    }, () => { const D = dailyPick(); mapNote = { text: `Günün sınavı: ${LEVELS[D.idx].name} · ${D.mod.name} (${D.mod.desc})`, t: time }; go(() => startLevel(D.idx, 'd')); }, { appear: st - 0.3 });
  }
  roundBtn('shop', bx(4), TY, RB, (r) => { drawIcon('coin', 0, 0, r * 1.15); if (isPremium()) drawCrown(0, -r * 0.9, 0.55, 1); }, () => go(() => { menuBack = 'map'; screen = 'shop'; screenT = time; }), { appear: st - 0.35 });
  if (save.achNew) { circle(bx(2) + 18, TY - 18, 9, '#e04a3a', '#2a0606', 1.4); txt(save.achNew + '', bx(2) + 18, TY - 17.5, 11, '#fff', 'center', '400', FONT_T, false); }
  if ((save.codexNew || []).length) { const cx = bx(1) + 18, cy = TY - 18 + Math.sin(time * 5) * 1.5; circle(cx, cy, 9, '#e8434b', '#fff', 1.4); txt(save.codexNew.length + '', cx, cy + 0.5, 10.5, '#fff', 'center', '400', FONT_T); }
  // sefer adı: sekmelerle sağ düğmeler arasındaki boşlukta (dar ekranda küçülür, sığmazsa ikinci satıra iner)
  { const x0 = EPISODES.length > 1 ? tabX(EPISODES.length - 1) + 62 : L0 + 80, x1 = bx(4) - RB - 10, room = x1 - x0;
    const two = room < 190, cx = two ? (L0 + R0) / 2 : (x0 + x1) / 2, cy = two ? TY + 58 : TY, rw = two ? 240 : Math.min(250, room - 60);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(rk, rk); ribbon(0, 0, rw, E.name.toLocaleUpperCase('tr'), mapEp === 1 ? 'red' : 'gold', 19); ctx.restore(); }
  // kahramanlar ve gelişmeler (sağ alt, ekran köşesine yaslı)
  const fresh = HERO_ORDER.filter(id => heroUnlocked(id) && !(save.seenHeroes || ['commander']).includes(id)), BY = EDGE.b - 40;
  gameButton('heroes', R0 - 392, BY, 234, 52, NECRO ? 'KOMUTANLAR' : 'KAHRAMANLAR', () => go(() => { screen = 'heroes'; }), 'blue', { icon: 'crown', appear: st - 0.35, size: 19, shine: fresh.length > 0 });
  const freeStars = starsTotal() - starsSpent();
  gameButton('upgrades', R0 - 140, BY, 234, 52, 'GELİŞMELER', () => go(() => { screen = 'upgrades'; }), 'gold', { icon: 'crown', appear: st - 0.4, size: 19, shine: freeStars > 0 });
  if (freeStars > 0) { const ex = R0 - 30, ey = BY - 24 + Math.sin(time * 5) * 2; circle(ex, ey, 12, '#e8434b', '#fff', 1.5); txt(freeStars + '', ex, ey + 1, 13, '#fff', 'center', '400', FONT_T); }
  if (fresh.length) {
    const ex = R0 - 300, ey = BY - 24 + Math.sin(time * 5) * 2;
    roundRect(ex - 24, ey - 11, 48, 22, 11, '#e8434b', '#fff', 1.5); txt('YENİ', ex, ey + 1, 12, '#fff', 'center', '400', FONT_T);
  }
  if (Math.random() < 0.12) {
    emit(uiParts, { kind: 'glow', add: true, x: rand(0, W), y: rand(H * 0.4, H), vx: rand(-6, 6), vy: rand(-14, -5),
      col: '255,210,140', s0: rand(1.5, 2.8), s1: 0.5, life: rand(3, 5), a: 0.7, fadeIn: 0.3 });
  }
  // bölüm kartı (bayrağa dokununca): arka plan kararır, dışına dokununca kapanır
  if (mapSel != null) {
    const k = clamp((time - mapSelT) / 0.2, 0, 1);
    ctx.fillStyle = `rgba(10,5,0,${0.55 * k})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
    buttons.push({ key: 'map_close', x: 0, y: 0, w: W, h: H, fn: () => { mapSel = null; } });
    drawLevelCard(mapSel, W / 2, H / 2 + 6, time - mapSelT);
    roundBtn('card_x', W / 2 + 122, H / 2 - 158, 22, 'close', () => { mapSel = null; }, { appear: time - mapSelT - 0.15 });
  }
  // kısa harita uyarısı (ör. kilitli meydan okuma)
  if (mapNote && time - mapNote.t < 2.2) {
    const a = clamp(Math.min((time - mapNote.t) / 0.2, (2.2 - (time - mapNote.t)) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 15px ${FONT_B}`;
    const w = ctx.measureText(mapNote.text).width + 36;
    roundRect(W / 2 - w / 2, 70, w, 30, 15, 'rgba(14,8,20,0.92)', '#c9b6ea', 1.6);
    txt(mapNote.text, W / 2, 85.5, 15, '#f2ecd8', 'center', '700', FONT_B, false);
    ctx.restore();
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
  if (NECRO) velvetCard(x0, y0, w, h, 22, { border: current ? '#ffd34d' : null });
  else {
    roundRect(x0 + 5, y0 + 12, w, h, 22, 'rgba(0,0,0,0.5)');
    const fr = ctx.createLinearGradient(0, y0, 0, y0 + h);
    fr.addColorStop(0, '#b07a46'); fr.addColorStop(1, '#4a2c14');
    roundRect(x0, y0, w, h, 22, fr, current ? '#ffd34d' : '#22120a', current ? 3.5 : 3);
    const pg = ctx.createLinearGradient(0, y0 + 10, 0, y0 + h - 10);
    pg.addColorStop(0, '#f8ebcc'); pg.addColorStop(1, '#dcc089');
    roundRect(x0 + 10, y0 + 10, w - 20, h - 20, 15, pg, 'rgba(92,58,22,0.6)', 1.5);
  }
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
  roundRect(tx, ty, tw, th, 11, null, NECRO ? '#c9a865' : '#3a2410', 3);
  roundRect(tx + 2, ty + 2, tw - 4, th - 4, 9, null, 'rgba(255,255,255,0.3)', 1.2);
  // bölüm numarası madalyonu
  const mg = ctx.createLinearGradient(0, y0 + 6, 0, y0 + 46);
  mg.addColorStop(0, '#fff0b0'); mg.addColorStop(1, '#a8681a');
  circle(x0 + 26, y0 + 26, 21, mg, '#2e1606', 2);
  const mb = ctx.createRadialGradient(x0 + 22, y0 + 21, 2, x0 + 26, y0 + 26, 17);
  mb.addColorStop(0, '#f05a4a'); mb.addColorStop(1, '#7a140e');
  circle(x0 + 26, y0 + 26, 16.5, mb);
  txt(num + '', x0 + 26, y0 + 27, 21, '#fff', 'center', '400', FONT_T);
  if (NECRO) crimsonRibbon(0, y0 + 182, lv.name, 20, w - 70); else txt(lv.name, 0, y0 + 180, 24, '#4a2a0e', 'center', '400', FONT_T, false);
  txt(`${lv.waves.length} dalga  ·  ${(lv.ep === 2 ? DIFF2 : DIFF)[epLevels(lv.ep || 1).indexOf(i)] || 'Zor'}`, 0, y0 + (NECRO ? 212 : 204), 14, '#8a6238', 'center', '800', FONT_B, false);
  for (let s = 0; s < 3; s++) fancyStar((s - 1) * 40, y0 + 238 - (s === 1 ? 4 : 0), s === 1 ? 17 : 15, s < st);
  if (!unlocked) {
    roundRect(x0, y0, w, h, 22, 'rgba(18,10,4,0.62)');
    drawIcon('lock', 0, y0 + 86, 46);
    txt('Kilitli', 0, y0 + 274, 24, '#f0e2c4', 'center', '400', FONT_T);
    txt(num === 1 ? 'Önceki bölgeyi tamamla' : 'Önceki bölümü tamamla', 0, y0 + 298, 13, '#cdb894', 'center', '700', FONT_B, false);
  }
  ctx.restore();
  if (unlocked) {
    const by = fy + (y0 + 290) * sc;
    ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1);
    gameButton(key, cx, by, st ? 132 : 176, 46, st ? 'TEKRAR' : 'OYNA', null, st ? 'gold' : 'green', { icon: st ? 'restart' : 'play', shine: current, size: 19 });
    ctx.restore();
    buttons.push({ key, x: cx - w / 2, y: fy - h / 2, w, h, fn: () => go(() => startLevel(i)) });
    // ödüllü reklam: +150 altınla başla (bölüm kartının altında küçük düğme)
    { const kb = 'boost' + i, yb = by + 46 * sc;
      gameButton(kb, cx, yb, 196 * sc, 30 * sc, (isPremium() ? '' : '▶ ') + '+' + MONET.boostGold + ' ALTINLA BAŞLA', () => showRewardedAd(() => go(() => { startLevel(i); G.gold += MONET.boostGold; })), 'blue', { size: 11 * sc }); }
    // sonsuz gece: bölümü bir kez bitirince açılır; rekor altında yazar
    if (st) {
      const bx = cx - 96 * sc, k2 = 'end' + i, best = (save.endless || {})[i] || 0;
      ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1); ctx.translate(bx, by); const s2 = pressScale(k2) * sc; ctx.scale(s2, s2);
      glow(ctx, 0, 0, 30, '150,90,255', 0.25 + Math.sin(time * 2.5) * 0.08);
      hudFrame(-21, -21, 42, 42, 9, '#2a1440');
      ctx.strokeStyle = '#d8b0ff'; ctx.lineWidth = 3.2; ctx.beginPath(); // sonsuzluk işareti
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.1) { const d = 1 + Math.sin(a) ** 2, X = 11 * Math.cos(a) / d, Y = 11 * Math.sin(a) * Math.cos(a) / d; a ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke();
      txt(best ? 'Rekor ' + best : 'Sonsuz', 0, 30, 10, '#f2ecd8', 'center', '800', FONT_B);
      ctx.restore();
      buttons.push({ key: k2, x: bx - 24, y: by - 24, w: 48, h: 48, fn: () => go(() => startLevel(i, 'e')) });
    }
    // meydan okumalar: 3 yıldızdan sonra açılır; tamamlanan tikli
    if (st) for (const [c, dx] of [['h', 96]]) {
      const open = st >= 3, done = save.ch && save.ch[i] && save.ch[i][c], bx = cx + dx * sc, k2 = 'ch' + c + i;
      ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1); ctx.translate(bx, by); const s2 = pressScale(k2) * sc; ctx.scale(s2, s2);
      if (open && !done) glow(ctx, 0, 0, 34, '255,90,70', 0.35 + Math.sin(time * 3) * 0.1);
      hudFrame(-21, -21, 42, 42, 9, '#5a1a20');
      // kalkan
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, -7); ctx.lineTo(8, 3); ctx.quadraticCurveTo(5, 9, 0, 12); ctx.quadraticCurveTo(-5, 9, -8, 3); ctx.lineTo(-9, -7); ctx.closePath();
      ctx.fillStyle = '#e04a3a'; ctx.fill(); ctx.strokeStyle = '#1a0606'; ctx.lineWidth = 2; ctx.stroke(); drawSkullIcon(0, -1, 4.5);
      if (!open) { ctx.fillStyle = 'rgba(10,6,14,0.6)'; ctx.fillRect(-17, -17, 34, 34); drawIcon('lock', 0, 0, 18); }
      if (done) { circle(13, -13, 7, '#3cbf3c', '#0a2a0a', 1.4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(12.5, -10.5); ctx.lineTo(16.5, -15.5); ctx.stroke(); }
      txt(CHAL[c].short, 0, 30, 10, open ? '#f2ecd8' : '#a89a80', 'center', '800', FONT_B);
      ctx.restore();
      buttons.push({ key: k2, x: bx - 24, y: by - 24, w: 48, h: 48, fn: () => {
        if (!open) { mapNote = { text: '3 yıldız al: ' + CHAL[c].short + ' açılır', t: time }; sfx('error'); return; }
        go(() => startLevel(i, c));
      } });
    }
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
  ctx.fillStyle = `rgba(200,140,80,${0.24 * k})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, `rgba(235,175,110,${0.3 * k})`); g.addColorStop(1, 'rgba(235,175,110,0.04)');
  ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
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
  // karanlık katmanı ekranın tamamını (VIS, tam ekranda çerçevenin yanları dahil) kaplar
  const k = 480 / VIS.w, nh = Math.round(VIS.h * k);
  if (!NIGHT) NIGHT = document.createElement('canvas');
  if (NIGHT.width !== 480 || NIGHT.height !== nh) { NIGHT.width = 480; NIGHT.height = nh; }
  const n = NIGHT.getContext('2d');
  n.setTransform(1, 0, 0, 1, 0, 0); n.globalCompositeOperation = 'source-over'; n.clearRect(0, 0, 480, nh);
  n.fillStyle = 'rgba(6,10,30,0.66)'; n.fillRect(0, 0, 480, nh);
  n.translate(-VIS.l * k, -VIS.t * k);
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
  ctx.drawImage(NIGHT, VIS.l, VIS.t, VIS.w, VIS.h);
  // meşale ışığı: kulelerin çevresinde sıcak parıltı
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const t of G.towers) { const q = worldToScreen(t.x, t.y - 26); glow(ctx, q.x, q.y, 34 * cam.z, '255,170,80', 0.16 + Math.sin(time * 8 + t.x) * 0.03); }
  ctx.restore();
}

function drawWeather() {
  if (G.weather === 'sand' || G.stormT > 0) drawSandstorm(G.stormT > 0 ? 1.6 : 1);
  if (G.weather === 'rain') {
    const fl = flashLevel(WFX.flashT);
    ctx.fillStyle = `rgba(10,18,32,${0.2 * (1 - fl)})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
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
    if (fl > 0) { ctx.fillStyle = `rgba(235,242,255,${0.42 * fl})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
  } else if (G.weather === 'night') {
    drawNight();
  } else if (G.weather === 'snow') {
    ctx.fillStyle = 'rgba(185,205,235,0.08)'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
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
    // yağmur: tiz cızırtı yerine alçak geçiren süzgeçle yumuşak, boğuk bir hışırtı
    amb = { rain: mk('lowpass', 1100, 0.5), wind: mk('lowpass', 420, 0.8) };
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

// ağa yakalanmış askerin üstünde ağ örgüsü (kalan süreye göre solar), altında kıpırdanma tozu
// ruh kafesine kapatılan düşman: çevresinde mor hayalet parmaklıklar, solarak kaybolur
function drawCages() {
  for (const e of G.enemies) {
    if (!(e.cageT > 0) || e.dead) continue;
    const h = CHAR_H['enemy_' + e.type] || 26, a = clamp(e.cageT / 0.3, 0, 1), R = Math.max(10, h * 0.45);
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    glow(ctx, e.x, e.y - h * 0.5, R * 1.4, '190,130,255', 0.35);
    ctx.strokeStyle = 'rgba(210,170,255,0.85)'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 7; i++) {
      const k = i / 6 * Math.PI, x = e.x + Math.cos(k) * R;
      ctx.beginPath(); ctx.moveTo(x, e.y + 2); ctx.quadraticCurveTo(e.x + Math.cos(k) * R * 1.1, e.y - h * 0.6, e.x + Math.cos(k) * R * 0.3, e.y - h - 6); ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, R, R * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
function drawNets() {
  for (const s of G.soldiers) {
    if (!(s.netT > 0) || s.dead) continue;
    const h = unitH(s), a = clamp(s.netT / 0.4, 0, 1), cx = s.x, cy = s.y - h * 0.5, R = h * 0.62;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(Math.sin(time * 6 + s.x) * 0.05);
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.75, R, 0, 0, Math.PI * 2); ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(225,210,170,0.9)'; ctx.lineWidth = 0.8;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * R / 4 - R, -R); ctx.lineTo(i * R / 4 + R, R); ctx.moveTo(i * R / 4 + R, -R); ctx.lineTo(i * R / 4 - R, R); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,90,50,0.95)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.75, R, 0, 0, Math.PI * 2); ctx.stroke();
    for (const [x, y] of [[-R * 0.6, R * 0.7], [R * 0.6, R * 0.7], [0, -R]]) circle(x, y, 1.3, '#6a5034');
    ctx.restore();
  }
}
// fener ışığı: yerde altın, kenarı yumuşak, hafif titreyen bir daire (lightAt ile aynı elips)
function drawHolyLights() {
  for (const e of G.enemies) {
    const L = e.def.light; if (!L || e.dead) continue;
    const k = 0.9 + Math.sin(time * 7 + e.anim) * 0.05;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 1 / 1.3); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, L.r * 0.2, 0, 0, L.r * k);
    g.addColorStop(0, 'rgba(255,220,130,0.32)'); g.addColorStop(0.75, 'rgba(255,200,100,0.16)'); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, L.r * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,120,0.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -time * 12;
    ctx.beginPath(); ctx.arc(0, 0, L.r * 0.97, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
}
function drawPlay() {
  if (G.bakeQ && G.bakeQ.length) bakeNext();
  const sh = G.shakeT > 0 ? G.shakeAmp * (G.shakeT / G.shakeDur) : 0;
  ctx.save();
  if (sh > 0) ctx.translate(rand(-sh, sh), rand(-sh, sh));
  ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const bm = G.bg.m || { x: 0, y: 0 };
  ctx.drawImage(G.bg, -bm.x, -bm.y, W + 2 * bm.x, H + 2 * bm.y);
  for (const d of G.decals) {
    if (d.kind === 'splat') {
      // veba birikintisi: yere dökülmüş sıvı; hızla yayılır, yavaşça solar (yer düzlemine yatık)
      if (d.t < 0) continue;
      const k = Math.min(1, (d.life - d.t) / 1.2), grow = d.small ? 1 : 0.55 + 0.45 * Math.min(1, d.t / 0.12);
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1, 0.48); ctx.rotate(d.rot);
      ctx.globalAlpha = 0.72 * k; const R = d.r * 1.7 * grow; ctx.drawImage(splatTex(d.v), -R, -R, R * 2, R * 2);
      ctx.restore();
      continue;
    }
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
  drawHolyLights();
  for (const pl of G.plots) if (!pl.tower) drawPlot(pl);
  drawHatches();
  drawMechGround();
  drawProps(false);
  drawHeralds();
  CORPSE_BAKE = 3;
  if (G.sel && G.sel.kind === 'hatch') {
    const h = G.sel.hatch;
    ctx.strokeStyle = `rgba(160,255,140,${0.9 * clamp((time - G.menuT) / 0.25, 0, 1)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 2, 30 + Math.sin(time * 6) * 1.5, 13, 0, 0, Math.PI * 2); ctx.stroke();
  }
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
  if (G.mode && G.mode.kind === 'rally' && G.mode.castle) { if (G.castle.rally) drawRally(G.castle.rally.x, G.castle.rally.y); }
  else if (G.mode && G.mode.kind === 'rally') {
    const t = G.mode.tower; drawRange(t.x, t.y, t.def.levels[t.lvl].range, true); drawRally(t.rx, t.ry);
  }
  // derinlik sıralı varlıklar
  const ents = [];
  for (const t of G.towers) ents.push([t.y, 0, t]);
  for (const e of G.enemies) ents.push([e.y + (e.def.flying ? 60 : 0), 1, e]);
  for (const s of G.soldiers) ents.push([s.exit && s.tower ? s.tower.y + 0.5 : s.y, 2, s]); // kapıdan çıkan iskelet binanın önünde
  for (const c of G.coins) if (c.state !== 'fly') ents.push([c.y, 4, c]);
  if (avluOn()) { const im = castleStageSprite(), cp = castlePlace(G.castle.x, G.castle.y, im); ents.push([cp.y - cp.w * im.height / im.width, 3, G.castle]); ents.push([G.castle.y - 2, 5, G.castle]); }
  else ents.push([G.castle.y - 30, 3, G.castle]);
  ents.sort((a, b) => a[0] - b[0]);
  for (const f of G.effects) if (f.kind === 'corpse') drawCorpse(f); else if (f.kind === 'bones') drawBones(f); else if (f.kind === 'skyfall') drawSkyFall(f);
  for (const [, k, o] of ents) k === 0 ? drawTower(o) : k === 1 ? (drawEnemy(o), o.inMud && drawWade(o)) : k === 2 ? (drawSoldier(o), o.inMud && drawWade(o)) : k === 4 ? drawCoinWorld(o) : k === 5 ? drawAvluFront() : drawCastle();
  drawGasClouds();
  drawBatSwarms();
  drawFearGhosts();
  for (const p of G.projectiles) drawProjectile(p);
  for (const g of G.ghosts) { // hayaletler
    const a = Math.min(1, g.t / 0.25, (g.d - g.end) / 30);
    ctx.save(); ctx.globalAlpha = 0.85 * a; ctx.translate(g.x, g.y - 18 + Math.sin(time * 6 + g.end) * 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 18, '190,140,255', 0.5); ctx.restore();
    drawNecroGlyph('nm_fear', 10); ctx.restore();
  }
  for (const f of G.effects) if (f.kind !== 'corpse') drawEffect(f);
  drawPartsAll(G.parts);
  drawMechFx();
  drawProps(true);
  drawDmgNums();
  drawNets(); drawCages();
  for (const f of G.floaters) {
    const k = f.t / 1.1, pop = easeOutBack(clamp(f.t / 0.2, 0, 1));
    ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.scale(pop, pop);
    txt(f.text, 0, 0, 15, f.col, 'center', '400', FONT_T);
    ctx.restore();
  }
  drawMortSay();
  drawMenuRange();
  drawEnemyRing();
  ctx.restore();
  drawWeather();
  drawBloodMoon();
  if (G.bossFx) {
    // boss girişi: ekran kenarları kızıl karanlığa bürünür, nabız gibi atar, sonra açılır
    const B = G.bossFx, k = Math.min(1, B.t / 0.4) * (1 - clamp((B.t - B.dur + 1) / 1, 0, 1)), p = 0.75 + Math.sin(B.t * 7) * 0.25;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.65);
    g.addColorStop(0, `rgba(40,0,0,${0.28 * k})`); g.addColorStop(1, `rgba(110,0,0,${0.82 * k * p})`);
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  if (G.hurt > 0) {
    // kale hasar alınca ekran kenarları kızarır
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${0.45 * G.hurt / 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  drawMenu();
  drawEnemyPanel();
  drawHud();
  drawCoinsFlying();
  drawBossBar();
  drawIntro();
  drawBanner();
  drawTut();
  if (overlay) drawOverlay();
}

const TIPS = NECRO ? [
  'İpucu: Mahzenden çıkan iskeletler düşmanı yolda durdurur, arbaletçiler arkadan vurur.',
  'İpucu: Ölüleri kaldırmak için yerde ceset olmalı; cesetler 10 saniye bekler.',
  'İpucu: Veba Kazanı\'nın gazı zırhı çürütür; ağır zırhlılara karşı iyidir.',
  'İpucu: Korkuyla kaçan düşmanlar kulelerinin menzilinde daha uzun kalır.',
  'İpucu: Lanet Kulesi menzilindekiler fazla hasar alır; ölürlerse kendiliğinden dirilebilirler.',
] : [
  'İpucu: Kışla askerleri düşmanı yolda durdurur, okçular da arkadan vurur.',
  'İpucu: Uçan yarasaları yalnızca okçu ve büyücü kuleleri vurabilir.',
  'İpucu: Kara şövalyenin zırhı kalın; büyücü kulesi zırhı deler.',
];
// zafer ekranında bölüme göre Mortimer esprisi
const WIN_QUIPS = [
  'Mortimer çayına kaldığı yerden devam ediyor.',
  'Ölüler bugün de fazla mesai yaptı.',
  'İmparatorluk yine eli boş döndü. Biraz da eksik.',
  'Solarian ordusu yeni gönüllüler arıyor. Acil.',
  'Mortimer\'ı rahatsız etmeyin. Etmeyin işte.',
];

// ----- hikâye panelleri (çizgi roman): bölge girişi ve her yeni bossun ilk gelişinden önce, oyundaki çizimlerle kurulur -----
// panel: bg (gece | gun | mezar | karanlik | balkon), act (oyuncular: s = 'mort' | 'mort_sit' | 'mort_cast' | 'e:tür' | 'k:iskelet no',
// x/y yer oranı, h boy oranı, f yön, rise yerden çıkış 0..1, walk yürür), say (konuşma: who, text, x, y balon üstü-orta oranı, to konuşanın ağzı),
// cap (üst altyazı), title (büyük başlık)
const COMICS = {
  intro: [
    { bg: 'balkon', mort: 'sit', cap: 'Lanetli Sınır. Huzurlu bir akşam.',
      say: [{ who: 'Mortimer', text: 'Earl Grey, sessizlik ve tek bir misafir bile yok. Mükemmel.', x: 0.27, y: 0.16, to: [0.5, 0.42] }] },
    { bg: 'gun', cap: 'Bu sırada, sınırın öbür yanında...',
      act: [{ s: 'e:legion', x: 0.2, y: 0.9, h: 0.42, walk: 1 }, { s: 'e:legion', x: 0.38, y: 0.9, h: 0.42, walk: 1 }, { s: 'e:centurion', x: 0.66, y: 0.92, h: 0.55, walk: 1 }],
      say: [{ who: 'Yüzbaşı Lucius', text: 'İmparator emretti: necromancer\'ın toprakları artık bizim!', x: 0.42, y: 0.12, to: [0.64, 0.42] }] },
    { bg: 'gun',
      act: [{ s: 'e:gloriosus', x: 0.5, y: 0.95, h: 0.8 }],
      say: [{ who: 'General Gloriosus', text: 'Ve o meşhur çaydanlığı da. İmparator çaya bayılır.', x: 0.5, y: 0.06, to: [0.5, 0.3] }] },
    { bg: 'balkon', mort: 'stand', shake: 1,
      say: [{ who: 'Mortimer', text: 'Çaydanlığım mı?!', x: 0.5, y: 0.1, to: [0.5, 0.36] }] },
    { bg: 'mezar',
      act: [{ s: 'k:1', x: 0.2, y: 0.92, h: 0.5, rise: 1 }, { s: 'k:2', x: 0.45, y: 0.94, h: 0.52, rise: 1, d: 0.3 }, { s: 'k:6', x: 0.7, y: 0.92, h: 0.5, rise: 1, d: 0.6 }, { s: 'mort_cast', x: 0.9, y: 0.7, h: 0.34 }],
      say: [{ who: 'Mortimer', text: 'Kalkın tembeller. Davetsiz misafirlerimiz var.', x: 0.5, y: 0.08, to: [0.88, 0.4] }],
      title: 'DAVETSİZ MİSAFİRLER' },
  ],
  champion: [
    { bg: 'gun', act: [{ s: 'e:gladiator', x: 0.25, y: 0.92, h: 0.42 }, { s: 'e:champion', x: 0.62, y: 0.94, h: 0.6 }],
      say: [{ who: 'Arena Şampiyonu Maximus', text: 'Arenada yüz zafer! Bir torba kemik bana ne yapabilir?', x: 0.45, y: 0.08, to: [0.6, 0.36] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Yüz bir oldu. Mezar taşına yazdırırım.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  hierophant: [
    { bg: 'gun', sun: 1, act: [{ s: 'e:priest', x: 0.22, y: 0.92, h: 0.42 }, { s: 'e:hierophant', x: 0.6, y: 0.94, h: 0.6 }],
      say: [{ who: 'Başrahip Sollemnis', text: 'Güneşin ışığı karanlığını yakacak, necromancer!', x: 0.45, y: 0.08, to: [0.58, 0.36] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Perdeleri kapatın. Ve biri şu adama şapka versin.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  shadowmaster: [
    { bg: 'karanlik', act: [{ s: 'e:shadowmaster', x: 0.5, y: 0.94, h: 0.62, fade: 1 }],
      say: [{ who: 'Gölge Usta', text: 'Gölgelerden geleceğim. Fark etmeyeceksin bile.', x: 0.5, y: 0.08, to: [0.5, 0.36] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Gölgeler benim mahallem, ufaklık. Kira da istiyorum.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  ironwarden: [
    { bg: 'gun', act: [{ s: 'e:heavy', x: 0.22, y: 0.92, h: 0.44 }, { s: 'e:ironwarden', x: 0.62, y: 0.95, h: 0.64 }],
      say: [{ who: 'Demir Muhafız Brutus', text: 'Bu zırhı hiçbir büyü delemez!', x: 0.4, y: 0.08, to: [0.6, 0.34] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Harika. O zaman büyü yapmam. Kazanı getirin.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  cavcaptain: [
    { bg: 'gun', act: [{ s: 'e:cavalry', x: 0.25, y: 0.92, h: 0.5, walk: 1 }, { s: 'e:cavcaptain', x: 0.65, y: 0.95, h: 0.66, walk: 1 }],
      say: [{ who: 'Süvari Kaptanı Aurelius', text: 'Atlılar! Şapele varana kadar durmak yok!', x: 0.42, y: 0.08, to: [0.62, 0.32] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Atlar da ölür, kaptan. Sonra benim olurlar.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  gloriosus: [
    { bg: 'gun', act: [{ s: 'e:legion', x: 0.14, y: 0.9, h: 0.38 }, { s: 'e:heavy', x: 0.86, y: 0.9, h: 0.4, f: -1 }, { s: 'e:gloriosus', x: 0.5, y: 0.96, h: 0.82 }],
      say: [{ who: 'General Gloriosus', text: 'Gloriosus bizzat geldi! Teslim ol ve çaydanlığı ver!', x: 0.5, y: 0.05, to: [0.5, 0.28] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Çaydanlığımı ancak cesedimden alırsın. Bir dakika... ben zaten ölüyüm.', x: 0.3, y: 0.08, to: [0.5, 0.36] }] },
    { bg: 'mezar', act: [{ s: 'k:4', x: 0.18, y: 0.93, h: 0.5, rise: 1 }, { s: 'k:3', x: 0.4, y: 0.94, h: 0.52, rise: 1, d: 0.25 }, { s: 'k:8', x: 0.62, y: 0.93, h: 0.5, rise: 1, d: 0.5 }, { s: 'mort_cast', x: 0.88, y: 0.7, h: 0.34 }],
      say: [{ who: 'Mortimer', text: 'Herkes yerine! Bu sefer misafir ağırlamıyoruz.', x: 0.45, y: 0.08, to: [0.86, 0.4] }] },
  ],
  // ---- 20 bölüme çıkınca eklenen bölümlerin girişleri (10 Eki) ----
  patika: [
    { bg: 'gun', cap: 'Dikenli Patika. Kestirme yol, dediler.', act: [{ s: 'e:legion', x: 0.22, y: 0.92, h: 0.44, walk: 1 }, { s: 'e:gladiator', x: 0.5, y: 0.92, h: 0.46, walk: 1 }, { s: 'e:centurion', x: 0.78, y: 0.93, h: 0.56, walk: 1 }],
      say: [{ who: 'Yüzbaşı Lucius', text: 'Dikenler mi? Lejyon dikenden korkmaz! ...Ay.', x: 0.45, y: 0.19, to: [0.76, 0.42] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'O dikenleri ben ektim. Sulamayı da unutmadım.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  kurbaga: [
    { bg: 'gece', cap: 'Kurbağa Adası. Bataklığın tam ortası.', act: [{ s: 'e:assassin', x: 0.3, y: 0.92, h: 0.46 }, { s: 'e:champion', x: 0.66, y: 0.94, h: 0.6 }],
      say: [{ who: 'Arena Şampiyonu Maximus', text: 'Çamur, kurbağa, sivrisinek... Arenayı özledim.', x: 0.45, y: 0.19, to: [0.64, 0.36] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Kurbağalar benim dostum. Seni çok sevecekler. Yemek olarak.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  bekci: [
    { bg: 'mezar', cap: 'Fener Bekçisinin Mezarı. Bekçi hâlâ nöbette.', act: [{ s: 'k:3', x: 0.25, y: 0.93, h: 0.5, rise: 1 }, { s: 'e:shadowmaster', x: 0.68, y: 0.94, h: 0.58, fade: 1 }],
      say: [{ who: 'Gölge Usta', text: 'Fener sönük. Gölgeler bana yol gösterecek.', x: 0.5, y: 0.19, to: [0.66, 0.36] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Bekçi fenerini sana tutacak. Biraz yakından.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  sazlik: [
    { bg: 'gece', cap: 'Sazlık Kıyı. Kara Göl\'ün sığ ucu.', act: [{ s: 'e:cavalry', x: 0.28, y: 0.92, h: 0.5, walk: 1 }, { s: 'e:cavcaptain', x: 0.68, y: 0.95, h: 0.64, walk: 1 }],
      say: [{ who: 'Süvari Kaptanı Aurelius', text: 'Atlar suya girmez mi? Girecekler!', x: 0.45, y: 0.19, to: [0.66, 0.34] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Bubu sabahtan beri aç. Tam vaktinde geldiniz.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  kopru: [
    { bg: 'gun', cap: 'Kemik Köprü. Şapele son geçit.', act: [{ s: 'e:heavy', x: 0.22, y: 0.92, h: 0.44, walk: 1 }, { s: 'e:ironwarden', x: 0.62, y: 0.95, h: 0.64, walk: 1 }],
      say: [{ who: 'Demir Muhafız Brutus', text: 'Bu köprü kemikten mi? Benim zırhım daha sağlam.', x: 0.42, y: 0.19, to: [0.6, 0.34] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Köprüyü eski misafirlerimden yaptım. Sen de güzel bir korkuluk olursun.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  kamp: [
    { bg: 'gece', cap: 'Avcı Kampı. Tuzaklar kuruldu.', act: [{ s: 'e:hound', x: 0.2, y: 0.92, h: 0.32 }, { s: 'e:hunter', x: 0.46, y: 0.92, h: 0.46 }, { s: 'e:torch', x: 0.74, y: 0.92, h: 0.46 }],
      say: [{ who: 'Cadı Avcısı', text: 'Kemik kokusu! Tuzakları kontrol edin!', x: 0.5, y: 0.19, to: [0.46, 0.42] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Tuzaklarına iskelet koydum. Yanlış tarafı yakalasınlar.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  hendek: [
    { bg: 'gece', cap: 'Veba Hendeği. Kimse girmek istemez.', act: [{ s: 'e:holywater', x: 0.26, y: 0.92, h: 0.46 }, { s: 'e:flagellant', x: 0.64, y: 0.92, h: 0.46 }],
      say: [{ who: 'Kutsal Su Taşıyıcı', text: 'Kutsal su her şeyi temizler. Hendeği bile!', x: 0.42, y: 0.19, to: [0.26, 0.42] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'O hendeği yüz yıldır temizletmiyorum. Bırakın kalsın.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  koridor: [
    { bg: 'karanlik', cap: 'Mum Işığı Koridoru. Batık manastırın kalbi.', act: [{ s: 'e:bellpriest', x: 0.24, y: 0.92, h: 0.46 }, { s: 'e:paladin', x: 0.62, y: 0.93, h: 0.5 }],
      say: [{ who: 'Paladin', text: 'Mumlar yandıkça karanlık geri çekilir!', x: 0.45, y: 0.19, to: [0.62, 0.4] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Mumlar erir. Ben kalırım. Basit matematik.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  mahzen: [
    { bg: 'mezar', cap: 'Kemik Mahzeni. Katedralin altında, kemikten raflar.', act: [{ s: 'e:inquisitor', x: 0.26, y: 0.92, h: 0.48 }, { s: 'e:saint', x: 0.66, y: 0.94, h: 0.56 }],
      say: [{ who: 'Engizitör', text: 'Bu kemikleri sorguya çekeceğiz. Hepsini.', x: 0.42, y: 0.19, to: [0.26, 0.4] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Kemiklerim konuşmaz. Ama ısırır.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  sur: [
    { bg: 'gece', cap: 'Kızıl Sur. Ay Sunağı\'na giden son duvar.', act: [{ s: 'e:paladin', x: 0.2, y: 0.92, h: 0.44, walk: 1 }, { s: 'e:colossus', x: 0.6, y: 0.97, h: 0.82, walk: 1 }],
      say: [{ who: 'Aziz Kolos', text: 'DUVAR... DÜŞECEK...', x: 0.42, y: 0.12, to: [0.6, 0.26] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Duvar düşerse arkasında ben varım. Ve çok kızgınım.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  // ---- 2. sefer: Cadı Avı ----
  intro2: [
    { bg: 'karanlik', cap: 'Lejyon yenildi. İmparator bu kez başka birini çağırdı.',
      act: [{ s: 'e:paladin', x: 0.2, y: 0.92, h: 0.46 }, { s: 'e:severus', x: 0.56, y: 0.95, h: 0.66 }, { s: 'e:inquisitor', x: 0.84, y: 0.92, h: 0.46, f: -1 }],
      say: [{ who: 'Büyük Engizitör Severus', text: 'Ölülere kılıç işlemez, majesteleri. Ama ateş işler.', x: 0.42, y: 0.17, to: [0.56, 0.36] }] },
    { bg: 'karanlik', act: [{ s: 'e:severus', x: 0.5, y: 0.96, h: 0.8 }],
      say: [{ who: 'Severus', text: 'Lanetli eşya: bir çaydanlık. Sahibinin gözü önünde yakacağız.', x: 0.5, y: 0.06, to: [0.5, 0.3] }] },
    { bg: 'gece', cap: 'Gece yarısı, Kuzgun Ormanı...',
      act: [{ s: 'e:hound', x: 0.16, y: 0.92, h: 0.32, walk: 1 }, { s: 'e:torch', x: 0.4, y: 0.92, h: 0.46, walk: 1 }, { s: 'e:hunter', x: 0.64, y: 0.92, h: 0.46, walk: 1 }, { s: 'e:torch', x: 0.86, y: 0.92, h: 0.44, walk: 1 }],
      say: [{ who: 'Cadı Avcısı', text: 'Meşaleleri yakın! Cadı avı başladı!', x: 0.5, y: 0.19, to: [0.64, 0.42] }] },
    { bg: 'balkon', mort: 'stand',
      say: [{ who: 'Mortimer', text: 'Cadı mı? Ben cadı değilim. Cadılar kibar olur.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
    { bg: 'mezar', act: [{ s: 'k:5', x: 0.18, y: 0.93, h: 0.5, rise: 1 }, { s: 'k:7', x: 0.42, y: 0.94, h: 0.52, rise: 1, d: 0.3 }, { s: 'k:2', x: 0.64, y: 0.93, h: 0.5, rise: 1, d: 0.6 }, { s: 'mort_cast', x: 0.88, y: 0.7, h: 0.34 }],
      say: [{ who: 'Mortimer', text: 'Çaydanlığıma dokunan... yanar.', x: 0.45, y: 0.08, to: [0.86, 0.4] }],
      title: 'CADI AVI' },
  ],
  malleus: [
    { bg: 'gece', act: [{ s: 'e:hound', x: 0.24, y: 0.92, h: 0.34 }, { s: 'e:malleus', x: 0.62, y: 0.95, h: 0.64 }],
      say: [{ who: 'Avcıbaşı Malleus', text: 'Tazılarım kemik kokusu aldı, necromancer. Av başladı!', x: 0.45, y: 0.08, to: [0.62, 0.34] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Kemik mi istiyorlar? Bir mezarlık dolusu var.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  campanus: [
    { bg: 'gece', act: [{ s: 'e:bellpriest', x: 0.22, y: 0.92, h: 0.44 }, { s: 'e:campanus', x: 0.62, y: 0.95, h: 0.66 }],
      say: [{ who: 'Çan Ustası Campanus', text: 'Bu çan çaldığında bütün ölüler diz çöker!', x: 0.42, y: 0.08, to: [0.62, 0.34] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Benim ölülerim kulaksız. Kendileri tercih etti.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  ignis: [
    { bg: 'karanlik', act: [{ s: 'e:ignis', x: 0.5, y: 0.95, h: 0.68 }],
      say: [{ who: 'Rahibe Ignis', text: 'Ateş arındırır. Önce cesetlerini, sonra seni.', x: 0.5, y: 0.08, to: [0.5, 0.34] }] },
    { bg: 'balkon', mort: 'sit', say: [{ who: 'Mortimer', text: 'Güzel. Çay suyumu ısıtacak biri lazımdı.', x: 0.3, y: 0.14, to: [0.5, 0.42] }] },
  ],
  colossus: [
    { bg: 'gece', act: [{ s: 'e:saint', x: 0.2, y: 0.92, h: 0.46 }, { s: 'e:colossus', x: 0.6, y: 0.97, h: 0.84 }],
      say: [{ who: 'Aziz Kolos', text: 'TAŞ... UNUTMAZ...', x: 0.42, y: 0.06, to: [0.6, 0.26] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Ben de unutmam. Hele kırılan vazolarımı.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
  ],
  severus: [
    { bg: 'karanlik', act: [{ s: 'e:paladin', x: 0.18, y: 0.92, h: 0.44 }, { s: 'e:severus', x: 0.56, y: 0.95, h: 0.68 }],
      say: [{ who: 'Büyük Engizitör Severus', text: 'Sonunda yüz yüzeyiz. Çaydanlığını özledin mi?', x: 0.42, y: 0.08, to: [0.56, 0.34] }] },
    { bg: 'balkon', mort: 'stand', shake: 1, say: [{ who: 'Mortimer', text: 'BIRAK. ONU. YERE.', x: 0.5, y: 0.1, to: [0.5, 0.36] }] },
  ],
  cathedral: [
    { bg: 'gece', cap: 'Kızıl Ay Tepesi. Ay Sunağı.', act: [{ s: 'e:paladin', x: 0.14, y: 0.92, h: 0.36 }, { s: 'e:cathedral', x: 0.55, y: 0.97, h: 0.9 }],
      say: [{ who: 'Severus', text: 'Katedral yürüyor, necromancer! Göklerin gazabı seninle!', x: 0.42, y: 0.15, to: [0.55, 0.2] }] },
    { bg: 'balkon', mort: 'stand', say: [{ who: 'Mortimer', text: 'Yürüyen kilise mi? Bu çağda her şey var.', x: 0.3, y: 0.1, to: [0.5, 0.36] }] },
    { bg: 'mezar', act: [{ s: 'k:8', x: 0.18, y: 0.93, h: 0.52, rise: 1 }, { s: 'k:6', x: 0.42, y: 0.94, h: 0.52, rise: 1, d: 0.25 }, { s: 'k:4', x: 0.64, y: 0.93, h: 0.5, rise: 1, d: 0.5 }, { s: 'mort_cast', x: 0.88, y: 0.7, h: 0.34 }],
      say: [{ who: 'Mortimer', text: 'Kalkın! Bu gece çaydanlığı eve getiriyoruz.', x: 0.45, y: 0.08, to: [0.86, 0.4] }],
      title: 'AY SUNAĞI' },
  ],
};
// sayfa düzeni: panel sayısına göre ızgara
function comicRects(n) {
  const x0 = 34, y0 = 34, w = W - 68, h = H - 84, g = 12, R = (x, y, ww, hh) => ({ x: x0 + x * w, y: y0 + y * h, w: ww * w - g / 2, h: hh * h - g / 2 });
  if (n === 5) return [R(0, 0, 0.56, 0.5), R(0.56 + 0.006, 0, 0.44, 0.5), R(0, 0.5 + 0.01, 1 / 3, 0.5), R(1 / 3 + 0.004, 0.51, 1 / 3, 0.5), R(2 / 3 + 0.008, 0.51, 1 / 3, 0.5)];
  if (n === 3) return [R(0, 0, 1, 0.5), R(0, 0.51, 0.5, 0.5), R(0.506, 0.51, 0.5, 0.5)];
  return [R(0, 0, 0.5, 1), R(0.506, 0, 0.5, 1)];
}
function startComic(key, then) {
  const P = COMICS[key];
  if (!P) { then && then(); return; }
  const C = { key, P, i: 0, at: [time], then };
  // panellerde yürüyen düşmanların şeritleri
  for (const p of P) for (const a of p.act || []) if (a.s.startsWith('e:')) { const d = ENEMIES[a.s.slice(2)]; animStrip('enemy_' + a.s.slice(2), d && d.base ? 'enemy_' + d.base : null, '_walk'); }
  G.comic = C; setOverlay('comic');
}
function endComic() {
  const C = G.comic; if (!C) return;
  save.comics = save.comics || {}; save.comics[C.key] = true; persist();
  G.comic = null; setOverlay(null);
  if (C.then) C.then();
}
function comicNext() {
  const C = G.comic; if (!C) return;
  if (time - C.at[C.i] < 0.3) return; // açılış bitmeden geçme
  if (C.i + 1 >= C.P.length) { endComic(); return; }
  C.i++; C.at[C.i] = time; sfx('click');
}
function comicBg(p, r, t) {
  const g = ctx;
  if (p.bg === 'gun') {
    let gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, '#f3c27c'); gr.addColorStop(0.6, '#e08a54'); gr.addColorStop(1, '#a8583a');
    g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, r.x + r.w * 0.78, r.y + r.h * 0.3, r.h * (p.sun ? 0.8 : 0.5), '255,230,150', p.sun ? 0.7 : 0.45); g.restore();
    g.fillStyle = '#9a5240'; g.beginPath(); g.moveTo(r.x, r.y + r.h * 0.7);
    for (let i = 0; i <= 8; i++) g.lineTo(r.x + r.w * i / 8, r.y + r.h * (0.62 + 0.06 * Math.sin(i * 1.7)));
    g.lineTo(r.x + r.w, r.y + r.h); g.lineTo(r.x, r.y + r.h); g.fill();
    g.fillStyle = '#c8986a'; g.fillRect(r.x, r.y + r.h * 0.82, r.w, r.h * 0.18);
    g.fillStyle = 'rgba(90,50,30,0.35)'; g.fillRect(r.x, r.y + r.h * 0.82, r.w, 3);
  } else if (p.bg === 'karanlik') {
    let gr = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.6, 10, r.x + r.w / 2, r.y + r.h * 0.6, r.w * 0.7);
    gr.addColorStop(0, '#3a1c50'); gr.addColorStop(1, '#06030a'); g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) glow(g, r.x + r.w * (0.2 + i * 0.2) + Math.sin(t + i) * 10, r.y + r.h * 0.85, r.w * 0.2, '140,80,200', 0.12);
    g.restore();
  } else {
    // gece / balkon / mezar: ay ışıklı mor gece
    let gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, '#0d0818'); gr.addColorStop(1, '#2a1838');
    g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, r.x + r.w * 0.82, r.y + r.h * 0.2, r.h * 0.35, '210,220,255', 0.35); g.restore();
    circle(r.x + r.w * 0.82, r.y + r.h * 0.2, r.h * 0.08, '#eef0ff');
    if (p.bg === 'mezar') {
      // mezarlık: koyu tepe, arkada mezar taşları ve çıplak ağaç, yerde yeşil sis
      g.fillStyle = '#1a1424'; g.beginPath(); g.moveTo(r.x, r.y + r.h * 0.72);
      for (let i = 0; i <= 6; i++) g.lineTo(r.x + r.w * i / 6, r.y + r.h * (0.66 + 0.05 * Math.sin(i * 2.1)));
      g.lineTo(r.x + r.w, r.y + r.h); g.lineTo(r.x, r.y + r.h); g.fill();
      const tomb = ['nm_tomb_1', 'nm_tomb_2', 'nm_tomb_3'], tree = spr('nm_tree_2');
      if (tree) { g.save(); g.globalAlpha = 0.7; drawSprite(g, tree, r.x + r.w * 0.08, r.y + r.h * 0.74, r.h * 0.5); g.restore(); }
      for (let i = 0; i < 5; i++) { const im = spr(tomb[i % 3]); if (im) drawSprite(g, im, r.x + r.w * (0.12 + i * 0.19), r.y + r.h * (0.74 + (i % 2) * 0.04), r.h * 0.16); }
      g.fillStyle = '#100c16'; g.fillRect(r.x, r.y + r.h * 0.88, r.w, r.h * 0.12);
      g.save(); g.globalCompositeOperation = 'lighter'; glow(g, r.x + r.w * 0.45, r.y + r.h * 0.9, r.w * 0.5, '110,255,140', 0.25); g.restore();
    } else {
      g.fillStyle = '#120c18'; g.fillRect(r.x, r.y + r.h * 0.9, r.w, r.h * 0.1);
    }
  }
}
// balkonda Mortimer: şapelin yakın planı (oturup çay içer / ayakta)
function comicBalcony(p, r, t) {
  const ch = spr('castle_1'); if (!ch) return;
  const mh = r.h * 0.5, cw = mh * ch.width / MORT_PX, chh = cw * ch.height / ch.width, S = MORT_STAGE[1];
  const fx = r.x + r.w * 0.5, fy = r.y + r.h * 0.84; // Mortimer'ın ayağı
  const X = fx - S.at[0] * cw, Y = fy - S.at[1] * chh;
  ctx.drawImage(ch, X, Y, cw, chh);
  ctx.save(); ctx.translate(fx + (p.shake ? Math.sin(t * 50) * 1.5 : 0), fy);
  const sit = p.mort === 'sit' && mortStrip('mortimer_cay'), im = spr('mortimer');
  if (sit) drawFrame(spr(sit), ANIM_META[sit], Math.floor(t * 12) % ANIM_META[sit].n, mh * 1.15 * MORT_SIT_K);
  else if (im) drawSprite(ctx, im, 0, 0, mh * im.width / im.height);
  ctx.restore();
  // korkuluk Mortimer'ın önünde
  const rl = S.rail;
  if (rl) ctx.drawImage(ch, rl[0] * ch.width, rl[1] * ch.height, (rl[2] - rl[0]) * ch.width, (rl[3] - rl[1]) * ch.height, X + rl[0] * cw, Y + rl[1] * chh, (rl[2] - rl[0]) * cw, (rl[3] - rl[1]) * chh);
  if (p.shake) { txt('!', fx + r.w * 0.12, fy - mh * 1.05, r.h * 0.18, '#ff5a3c', 'center', '400', FONT_LOGO); }
}
function comicActor(a, r, t) {
  const x = r.x + a.x * r.w, y = r.y + a.y * r.h, h = a.h * r.h, k = a.rise ? easeOutQ(clamp((t - 0.25 - (a.d || 0)) / 0.7, 0, 1)) : 1;
  ctx.save();
  if (a.rise) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, y - r.y + 2); ctx.clip(); ctx.translate(0, (1 - k) * h); }
  if (a.fade) ctx.globalAlpha *= 0.55 + 0.45 * Math.abs(Math.sin(t * 1.3));
  if (a.rise) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - h * 0.2, h * 0.5, '110,255,140', 0.3 * k); ctx.restore(); }
  if (a.s === 'mort_cast') {
    const n = mortStrip('mortimer_buyu'), im = spr('mortimer');
    ctx.translate(x, y);
    if (n) drawFrame(spr(n), ANIM_META[n], Math.floor(t * 10) % ANIM_META[n].n, h); else if (im) drawSprite(ctx, im, 0, 0, h * im.width / im.height);
  } else if (a.s.startsWith('k:')) {
    const im = spr('unit_skel_' + a.s.slice(2)); if (im) drawSprite(ctx, im, x, y, h * im.width / im.height);
  } else {
    const ty = a.s.slice(2), d = ENEMIES[ty], name = 'enemy_' + ty;
    const st = a.walk && animStrip(name, d && d.base ? 'enemy_' + d.base : null, '_walk');
    ctx.translate(x, y); ctx.scale(a.f || 1, 1);
    if (st) drawFrame(spr(st), ANIM_META[st], Math.floor(t * 14) % ANIM_META[st].n, h);
    else { const im = enemySprite(ty) || spr(name); if (im) drawSprite(ctx, im, 0, 0, h * im.width / im.height); }
  }
  ctx.restore();
}
function comicBubble(s, r, a) {
  if (a <= 0) return;
  const mw = Math.min(r.w * 0.8, 300), size = clamp(r.h * 0.055, 11, 15);
  const lines = wrapLines(s.text, mw - 22, size, '800', FONT_B, 4);
  ctx.font = `800 ${size}px ${FONT_B}`;
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width), s.who ? ctx.measureText(s.who).width * 0.8 : 0);
  const bw = tw + 24, bh = lines.length * (size + 3) + 14 + (s.who ? size : 0);
  const cx = clamp(r.x + s.x * r.w, r.x + bw / 2 + 6, r.x + r.w - bw / 2 - 6), by = r.y + s.y * r.h, tx = r.x + s.to[0] * r.w, ty = r.y + s.to[1] * r.h;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, by + bh / 2); ctx.scale(0.85 + 0.15 * a, 0.85 + 0.15 * a); ctx.translate(-cx, -(by + bh / 2));
  // kuyruk konuşana uzanır
  const bx = clamp(tx, cx - bw / 2 + 14, cx + bw / 2 - 14), down = ty > by + bh;
  ctx.fillStyle = '#fbf6e8'; ctx.strokeStyle = '#120a10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx - 8, down ? by + bh - 2 : by + 2); ctx.lineTo(lerp(bx, tx, 0.85), lerp(down ? by + bh : by, ty, 0.85)); ctx.lineTo(bx + 8, down ? by + bh - 2 : by + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  roundRect(cx - bw / 2, by, bw, bh, 12, '#fbf6e8', '#120a10', 2);
  ctx.fillStyle = '#fbf6e8'; ctx.fillRect(bx - 6.5, down ? by + bh - 3 : by + 1, 13, 3); // kuyruk birleşimi
  let y = by + 8;
  if (s.who) { txt(s.who, cx - bw / 2 + 12, y + size * 0.4, size * 0.78, '#8a2a3a', 'left', '800', FONT_B, false); y += size; }
  for (const l of lines) { txt(l, cx, y + size * 0.55, size, '#1a1018', 'center', '800', FONT_B, false); y += size + 3; }
  ctx.restore();
}
function drawComic() {
  const C = G.comic; if (!C) return;
  const k = time - overlayT;
  ctx.fillStyle = `rgba(6,3,10,${0.92 * clamp(k / 0.3, 0, 1)})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  const R = comicRects(C.P.length);
  buttons.push({ key: 'comic_next', x: 0, y: 0, w: W, h: H, fn: comicNext });
  for (let i = 0; i <= C.i; i++) {
    const p = C.P[i], r = R[i], t = time - C.at[i], a = clamp(t / 0.35, 0, 1), e = easeOutBack(a);
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 6, '#0a0608');
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    comicBg(p, r, t);
    if (p.bg === 'balkon') comicBalcony(p, r, t);
    for (const ac of p.act || []) comicActor(ac, r, t);
    if (p.title) {
      const q = clamp((t - 1.1) / 0.4, 0, 1);
      if (q > 0) { // alt şeritte büyük başlık
        ctx.save(); ctx.globalAlpha *= q;
        const gr = ctx.createLinearGradient(0, r.y + r.h * 0.68, 0, r.y + r.h); gr.addColorStop(0, 'rgba(6,3,10,0)'); gr.addColorStop(0.5, 'rgba(6,3,10,0.85)'); gr.addColorStop(1, 'rgba(6,3,10,0.95)');
        ctx.fillStyle = gr; ctx.fillRect(r.x, r.y + r.h * 0.68, r.w, r.h * 0.32);
        txt(p.title, r.x + r.w / 2, r.y + r.h * 0.88, Math.min(r.h * 0.14, r.w * 0.085), '#ff3b2e', 'center', '400', FONT_LOGO); ctx.restore();
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    if (p.cap) { // üst sol altyazı kutusu
      ctx.font = `700 12px ${FONT_B}`; const cw = ctx.measureText(p.cap).width + 18;
      roundRect(r.x + 8, r.y + 8, cw, 22, 3, '#f2d98a', '#120a10', 1.6);
      txt(p.cap, r.x + 17, r.y + 19.5, 12, '#2a1a10', 'left', '700', FONT_B, false);
    }
    for (const s of p.say || []) comicBubble(s, r, clamp((t - 0.35) / 0.25, 0, 1));
    ctx.restore();
  }
  const last = C.i + 1 >= C.P.length;
  txt(last ? 'Başla ›' : 'Dokun ›', W - 40, H - 24, 14, `rgba(239,230,204,${0.55 + 0.35 * Math.sin(time * 4)})`, 'right', '800', FONT_B, false);
  gameButton('comic_skip', W - 70, 16, 96, 26, 'Geç ›', () => endComic(), 'wood', { size: 13 });
}
// zafer ekranı özeti: sayılar sırayla sayarak dolar; en çok öldüren vurgulanır
const KILLER_NAME = { curse: 'Lanet Kuleleri', arrow: 'Kemik Kuleleri', magic: 'Ruh Fenerleri', blast: 'Veba Kazanları', melee: 'Mahzen İskeletleri', minion: 'Dirilen Ölüler', burst: 'Ceset Patlatma' };
function drawWinSummary(k, px, py, pw, cx) {
  const S = G.stats || { by: {}, raised: 0, spells: 0 }, x0 = px + 40, w = pw - 80, y0 = py + 198;
  roundRect(x0, y0, w, 118, 12, 'rgba(10,6,18,0.55)', 'rgba(207,196,168,0.35)', 1.2);
  const up = (v, d) => Math.round(v * easeOutQ(clamp((k - 1.0 - d) / 0.8, 0, 1)));
  const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60);
  const cell = (x, y, label, val, col) => {
    txt(label, x, y, 12, '#a89cb8', 'left', '800', FONT_B, false);
    txt(String(val), x + w / 2 - 34, y, 17, col || '#efe6cc', 'right', '400', FONT_T, false);
  };
  cell(x0 + 18, y0 + 22, 'Öldürülen düşman', up(G.kills || 0, 0));
  cell(x0 + w / 2 + 18, y0 + 22, 'Süre', k > 1.0 ? `${mm}:${String(ss).padStart(2, '0')}` : '–');
  cell(x0 + 18, y0 + 50, 'Diriltilen ölü', up(S.raised, 0.15), '#9dff8a');
  cell(x0 + w / 2 + 18, y0 + 50, 'Kullanılan büyü', up(S.spells, 0.15));
  // en çok öldüren
  let best = null, bn = 0;
  for (const [id, n] of Object.entries(S.by)) if (id !== 'other' && n > bn) { best = id; bn = n; }
  if (!best || k < 1.6) return;
  const a = easeOutBack(clamp((k - 1.6) / 0.4, 0, 1)), name = best === 'hero' ? ((G.heroes[0] && G.heroes[0].def.name) || 'Komutan') : KILLER_NAME[best] || best;
  ctx.save(); ctx.translate(cx, y0 + 90); ctx.scale(a, a);
  roundRect(-w / 2 + 10, -16, w - 20, 32, 9, 'rgba(60,140,70,0.25)', 'rgba(140,255,150,0.6)', 1.2);
  drawIcon('crown', -w / 2 + 34, 0, 20);
  txt('En çok öldüren:', -w / 2 + 52, 1, 13, '#cfe8c8', 'left', '800', FONT_B, false);
  txt(`${name} · ${bn}`, w / 2 - 24, 1, 17, '#b8ff9a', 'right', '400', FONT_T, false);
  ctx.restore();
}
// ---- Necromancer menü kiti (duraklatma menüsünün tasarımı bütün oyuna; Caner, 10 Eki: "çok güzel olmuş, tüm oyuna uyarla") ----
// velvetCard: kızıl-mor kadife, soluk desen, kenar karartması, altın çerçeve. o.border: seçili çerçeve rengi, o.ac: alttan ruh ışığı
function velvetCard(x, y, w, h, r = 14, o = {}) {
  // büyük kartlar duraklatma menüsünün panelinin aynısı (kalın kara çerçeve, kızıl-mor kadife, çift altın çizgi, köşelerde altın kıvrım ve yakut);
  // küçük kartlarda (kodeks kutusu, başarım satırı) süsler sığmaz: aynı kadife ve altın çerçeve
  if (w >= 120 && h >= 90) {
    pauseFrame(x, y, w, h, 0);
    if (o.ac) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + 12, y + 12, w - 24, h - 24, 12); ctx.clip(); const tg = ctx.createLinearGradient(0, y + h, 0, y); tg.addColorStop(0, `rgba(${o.ac},0.3)`); tg.addColorStop(0.6, `rgba(${o.ac},0)`); ctx.fillStyle = tg; ctx.fillRect(x, y, w, h); ctx.restore(); }
    if (o.border) roundRect(x + 1, y + 1, w - 2, h - 2, 14, null, o.border, 3);
    return;
  }
  roundRect(x + 3, y + 8, w, h, r, 'rgba(0,0,0,0.45)');
  roundRect(x - 3, y - 3, w + 6, h + 6, r + 3, '#140810', '#050206', 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.top || '#4c0f24'); g.addColorStop(0.55, '#33102e'); g.addColorStop(1, '#1e0b26');
  roundRect(x, y, w, h, r, g);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.globalAlpha = 0.07; ctx.fillStyle = ctx.createPattern(pausePattern(), 'repeat'); ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  if (o.ac) { const tg = ctx.createLinearGradient(0, y + h, 0, y); tg.addColorStop(0, `rgba(${o.ac},0.28)`); tg.addColorStop(0.6, `rgba(${o.ac},0)`); ctx.fillStyle = tg; ctx.fillRect(x, y, w, h); }
  const vg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = vg; ctx.fillRect(x, y, w, h);
  ctx.restore();
  roundRect(x, y, w, h, r, null, o.border || '#c9a865', o.border ? 3 : 2);
  if (w > 40 && h > 30) roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3), null, 'rgba(201,168,101,0.28)', 1);
}
// tam ekran menülerin arka planı: bulanık kapak, üstüne kızıl-mor karartma, yavaş dönen ritüel çemberi ve sis
function menuBackdrop(st) {
  const bg = spr('nm_title');
  if (bg) coverImage(blurOf('title_bg', bg), 1.1 + Math.sin(time * 0.1) * 0.02);
  else { ctx.fillStyle = '#1a0816'; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h); }
  const g = ctx.createLinearGradient(0, VIS.t, 0, VIS.b); g.addColorStop(0, 'rgba(40,6,22,0.72)'); g.addColorStop(1, 'rgba(14,4,20,0.9)');
  ctx.fillStyle = g; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  ctx.save(); ctx.globalAlpha = clamp(st / 0.6, 0, 1) * 0.13; ctx.translate(W / 2, H / 2 + 20); ctx.rotate(time * 0.04);
  const sg = pauseSigil(); ctx.drawImage(sg, -sg.width * 0.65, -sg.height * 0.65, sg.width * 1.3, sg.height * 1.3); ctx.restore();
  drawOverlayFog(clamp(st / 0.6, 0, 1));
}
// kızıl kumaş kurdele başlık (altın kenarlı, uçları çatallı)
function crimsonRibbon(cx, cy, text, size = 24, w = 0) {
  ctx.font = `400 ${size}px ${FONT_T}`; const tw = ctx.measureText(TR(text)).width, bw = Math.max(w, tw + 70), bh = size * 1.6;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + sd * (bw / 2 - 8), cy - bh / 2 + 7); ctx.lineTo(cx + sd * (bw / 2 + 30), cy - bh / 2 + 7); ctx.lineTo(cx + sd * (bw / 2 + 18), cy + 7);
    ctx.lineTo(cx + sd * (bw / 2 + 30), cy + bh / 2 + 7); ctx.lineTo(cx + sd * (bw / 2 - 8), cy + bh / 2 + 7); ctx.closePath();
    ctx.fillStyle = '#5a0a1c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#050206'; ctx.stroke();
  }
  const rg = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2); rg.addColorStop(0, '#a3182f'); rg.addColorStop(1, '#5e0a1c');
  roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4, rg, '#050206', 2.5); roundRect(cx - bw / 2 + 4, cy - bh / 2 + 4, bw - 8, bh - 8, 3, null, 'rgba(230,190,110,0.7)', 1.2);
  txt(text, cx, cy + 1, tw > bw - 24 ? size * (bw - 24) / tw : size, '#fff0d8', 'center', '400', FONT_T);
}
// ---- Duraklatma menüsü (10 Eki, 2. tasarım; Caner: "rakip oyunlardan beğenilen özellikleri örnek al, desen olsun, koyu kırmızı-mor").
// Kingdom Rush / Iron Marines duraklatmalarından alınanlar: süslü çerçeve ve arma, büyük ana düğme, savaş durumu özeti, hızlı ses
// düğmeleri, her açılışta bir ipucu. Arkada yavaş dönen ritüel çemberi, kadife zeminde Necromancer deseni, köşelerde yakut süsler.
const PAUSE_TIPS = [
  'Mahzenin bayrağını yolun dar yerine dik: iskeletler düşmanı orada tutar, kuleler rahat vurur.',
  'Kalabalık bölüğe Korku büyüsü at: 4 saniye geri kaçarlar, kuleler bu arada işini görür.',
  'Erken dalga çağırırsan altın kazanırsın. Ama açgözlülük mezar kazdırır.',
  'Zırhlı düşmana Ruh Feneri, kalabalığa Veba Kazanı. Kuleleri karıştır.',
  'Dirilttiğin ölüler bedava askerdir. Savaş alanında ceset israf etme.',
  'Kule satmak ayıp değil. Yanlış yere kurmak ayıp.',
];
const PAUSE_ART = {};
function pauseSigil() { // ritüel çemberi (bir kez çizilir, her karede döndürülür)
  if (PAUSE_ART.sigil) return PAUSE_ART.sigil;
  const S = 640, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), m = S / 2; g.translate(m, m); g.lineCap = 'round';
  const ring = (r, w, col) => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  ring(300, 3, 'rgba(200,40,70,0.9)'); ring(286, 1.5, 'rgba(200,40,70,0.7)'); ring(212, 2, 'rgba(160,80,230,0.8)'); ring(120, 1.5, 'rgba(160,80,230,0.6)');
  g.strokeStyle = 'rgba(220,60,90,0.85)'; g.lineWidth = 2;
  for (let i = 0; i < 36; i++) { // dış halkada runlar
    const a = i / 36 * Math.PI * 2; g.save(); g.rotate(a); g.translate(0, -293);
    const k = i % 4; g.beginPath();
    if (k === 0) { g.moveTo(0, -5); g.lineTo(0, 5); g.moveTo(-4, -2); g.lineTo(4, 2); }
    else if (k === 1) { g.moveTo(-4, 4); g.lineTo(0, -5); g.lineTo(4, 4); }
    else if (k === 2) { g.arc(0, 0, 3.5, 0, Math.PI * 2); }
    else { g.moveTo(-4, -4); g.lineTo(4, 4); g.moveTo(4, -4); g.lineTo(-4, 4); }
    g.stroke(); g.restore();
  }
  g.strokeStyle = 'rgba(170,90,240,0.75)'; g.lineWidth = 1.8; g.beginPath(); // iç yıldız (yedi köşeli, kesişen çizgiler)
  for (let i = 0; i <= 7; i++) { const a = -Math.PI / 2 + i * 3 / 7 * Math.PI * 2; g.lineTo(Math.cos(a) * 212, Math.sin(a) * 212); }
  g.stroke();
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i / 7 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 212, Math.sin(a) * 212, 9, 0, Math.PI * 2); g.fillStyle = 'rgba(40,8,30,0.9)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(220,60,90,0.9)'; g.stroke(); }
  return (PAUSE_ART.sigil = c);
}
function pausePattern() { // kadife üstünde soluk Necromancer deseni: küçük kafatası ve dört yapraklı süs, şaşırtmalı
  if (PAUSE_ART.pat) return PAUSE_ART.pat;
  const c = document.createElement('canvas'); c.width = c.height = 56; const g = c.getContext('2d');
  const orn = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = 'rgba(255,190,210,1)';
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -5, 2.2, 4.5, 0, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fill(); g.restore(); };
  const skull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = 'rgba(255,190,210,1)';
    g.beginPath(); g.arc(0, -1, 4.5, Math.PI, 0); g.lineTo(3.2, 3); g.lineTo(-3.2, 3); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(-1.7, -0.6, 1.2, 0, Math.PI * 2); g.arc(1.7, -0.6, 1.2, 0, Math.PI * 2); g.fill(); g.restore(); };
  orn(14, 14); orn(42, 42); skull(42, 14); skull(14, 42);
  return (PAUSE_ART.pat = c);
}
function rubyGem(x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ff9aa8'); g.addColorStop(0.45, '#c0122e'); g.addColorStop(1, '#4a0410');
  circle(x, y, r + 1.5, '#c9a865', '#1a0a08', 1.2); circle(x, y, r, g);
  circle(x - r * 0.35, y - r * 0.4, r * 0.28, 'rgba(255,255,255,0.75)');
}
function pauseFrame(x, y, w, h, rise = 26) {
  ctx.save();
  tombPath(x + 4, y + 10, w, h, rise); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  const fr = ctx.createLinearGradient(0, y, 0, y + h); fr.addColorStop(0, '#3a1a2a'); fr.addColorStop(1, '#140810');
  tombPath(x, y, w, h, rise); ctx.fillStyle = fr; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#050206'; ctx.stroke();
  const ix = x + 12, iy = y + 12, iw = w - 24, ih = h - 24, ir = Math.max(0, rise - 6);
  const vel = ctx.createLinearGradient(0, iy, 0, iy + ih); vel.addColorStop(0, '#4c0f24'); vel.addColorStop(0.55, '#33102e'); vel.addColorStop(1, '#1e0b26');
  tombPath(ix, iy, iw, ih, ir); ctx.fillStyle = vel; ctx.fill();
  ctx.save(); tombPath(ix, iy, iw, ih, ir); ctx.clip();
  ctx.globalAlpha = 0.07; ctx.fillStyle = ctx.createPattern(pausePattern(), 'repeat'); ctx.fillRect(ix, iy, iw, ih); ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(x + w / 2, y + h * 0.45, h * 0.2, x + w / 2, y + h * 0.45, w * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(ix, iy, iw, ih);
  ctx.restore();
  tombPath(ix, iy, iw, ih, ir); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c9a865'; ctx.stroke();
  tombPath(ix + 6, iy + 6, iw - 12, ih - 12, Math.max(0, ir - 4)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(201,168,101,0.35)'; ctx.stroke();
  for (const [cx, cy, sx, sy] of [[ix + 8, iy + ir + 8, 1, 1], [ix + iw - 8, iy + ir + 8, -1, 1], [ix + 8, iy + ih - 8, 1, -1], [ix + iw - 8, iy + ih - 8, -1, -1]]) {
    ctx.strokeStyle = '#c9a865'; ctx.lineWidth = 2; ctx.beginPath(); // köşe süsü: kıvrık altın kol + yakut
    ctx.moveTo(cx + sx * 34, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + sy * 34); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + sx * 34, cy + sy * 5, 4, 0, Math.PI * 2); ctx.moveTo(cx + sx * 5 + 4, cy + sy * 34); ctx.arc(cx + sx * 5, cy + sy * 34, 4, 0, Math.PI * 2); ctx.stroke();
    rubyGem(cx + sx * 7, cy + sy * 7, 5);
  }
  ctx.restore();
}
function pauseCrest(cx, cy) { // tepe arması: yarasa kanatlı kafatası madalyonu
  ctx.save(); ctx.translate(cx, cy);
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * 22, -6);
    ctx.quadraticCurveTo(sd * 52, -34, sd * 92, -18); ctx.quadraticCurveTo(sd * 80, -8, sd * 84, 4);
    ctx.quadraticCurveTo(sd * 70, -2, sd * 64, 10); ctx.quadraticCurveTo(sd * 54, 2, sd * 46, 14); ctx.quadraticCurveTo(sd * 36, 4, sd * 22, 10); ctx.closePath();
    const wg = ctx.createLinearGradient(0, -30, 0, 14); wg.addColorStop(0, '#5a1838'); wg.addColorStop(1, '#22081a');
    ctx.fillStyle = wg; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#050206'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(201,168,101,0.5)'; ctx.beginPath(); ctx.moveTo(sd * 24, 0); ctx.lineTo(sd * 84, -14); ctx.moveTo(sd * 30, 4); ctx.lineTo(sd * 62, 6); ctx.stroke();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 46, '190,90,255', 0.35 + Math.sin(time * 2) * 0.08); ctx.restore();
  const mg = ctx.createRadialGradient(-6, -8, 2, 0, 0, 30); mg.addColorStop(0, '#5a2a6a'); mg.addColorStop(1, '#1a0820');
  circle(0, 0, 30, '#c9a865', '#050206', 2.5); circle(0, 0, 26, mg); circle(0, 0, 22, null, 'rgba(201,168,101,0.45)', 1);
  drawSkullIcon(0, 1, 15);
  ctx.restore();
}
function pauseTile(key, x, y, w, h, label, icon, fn, ac, ap, primary) {
  const appear = easeOutBack(clamp(ap / 0.35, 0, 1)); if (appear <= 0.01) return;
  const down = press.key === key, dy = down ? 3 : 0, r = 14;
  ctx.save(); ctx.translate(x, y); const sc = pressScale(key) * appear * (primary ? 1 + Math.sin(time * 3) * 0.015 : 1); ctx.scale(sc, sc);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, w * 0.75, ac, primary ? 0.32 + Math.sin(time * 3) * 0.08 : 0.1); ctx.restore();
  roundRect(-w / 2 + 2, -h / 2 + 8, w - 4, h, r, 'rgba(0,0,0,0.5)');
  roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 9, r + 3, '#050206');
  roundRect(-w / 2, -h / 2 + 4, w, h, r, '#140610');
  const g = ctx.createLinearGradient(0, -h / 2 + dy, 0, h / 2 + dy); g.addColorStop(0, primary ? '#3e1530' : '#3a1226'); g.addColorStop(1, '#170816');
  roundRect(-w / 2, -h / 2 + dy, w, h, r, g);
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + dy, w, h, r); ctx.clip();
  ctx.globalAlpha = 0.06; ctx.fillStyle = ctx.createPattern(pausePattern(), 'repeat'); ctx.fillRect(-w / 2, -h / 2 + dy, w, h); ctx.globalAlpha = 1;
  const tg = ctx.createLinearGradient(0, h / 2 + dy, 0, -h / 2 + dy); tg.addColorStop(0, `rgba(${ac},0.3)`); tg.addColorStop(0.6, `rgba(${ac},0)`); ctx.fillStyle = tg; ctx.fillRect(-w / 2, -h / 2 + dy, w, h);
  if (primary) { const ph = (time * 0.35) % 1.8; if (ph < 1) { const sx = -w / 2 - 40 + ph * (w + 80), sg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
    sg.addColorStop(0, `rgba(${ac},0)`); sg.addColorStop(0.5, `rgba(${ac},0.25)`); sg.addColorStop(1, `rgba(${ac},0)`); ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2 + dy, w, h); } }
  ctx.restore();
  roundRect(-w / 2, -h / 2 + dy, w, h, r, null, '#c9a865', 2);
  roundRect(-w / 2 + 4, -h / 2 + dy + 4, w - 8, h - 8, r - 3, null, 'rgba(201,168,101,0.3)', 1);
  const my = dy - h * 0.13, mr = Math.min(25, h * 0.24); // simge madalyonu
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, my, mr * 1.8, ac, 0.3); ctx.restore();
  const mg = ctx.createRadialGradient(-mr * 0.3, my - mr * 0.3, 1, 0, my, mr); mg.addColorStop(0, '#3a1a3a'); mg.addColorStop(1, '#12060f');
  circle(0, my, mr + 2.5, '#c9a865', '#050206', 1.5); circle(0, my, mr, mg); circle(0, my, mr - 3, null, `rgba(${ac},0.55)`, 1.2);
  drawIcon(icon, 0, my, mr * 1.05);
  ctx.font = `17px ${FONT_T}`; const tw = ctx.measureText(TR(label)).width, fs = Math.min(17, 17 * (w - 18) / Math.max(1, tw));
  txt(label, 0, dy + h * 0.3, fs, '#efe1c0', 'center', '400', FONT_T);
  ctx.restore();
  buttons.push({ key, x: x - w / 2, y: y - h / 2, w, h: h + 6, fn });
}
function drawPauseMenu(k, cx, cy) {
  // ritüel çemberi
  ctx.save(); ctx.globalAlpha = clamp(k / 0.4, 0, 1) * 0.22; ctx.translate(cx, cy); ctx.rotate(time * 0.05);
  const sg = pauseSigil(); ctx.drawImage(sg, -sg.width / 2, -sg.height / 2); ctx.rotate(-time * 0.13); ctx.scale(0.62, 0.62); ctx.drawImage(sg, -sg.width / 2, -sg.height / 2);
  ctx.restore();
  const pw = 680, ph = 446, px = cx - pw / 2, py = cy - ph / 2 + 8;
  pauseFrame(px, py, pw, ph);
  pauseCrest(cx, py + 4);
  // başlık: kızıl kumaş kurdele, altında bölüm adı
  const by = py + 64; crimsonRibbon(cx, by, 'DURAKLATILDI', 24, 300);
  txt(G.lv.name, cx, by + 34, 14, '#d9b8e8', 'center', '700', FONT_B);
  // sol: 2x2 karolar (Caner'in düzeni: solda Devam Et / Yeniden Başla, sağda Ayarlar / Haritaya Dön)
  const tw = 160, th = 116, gap = 16, gx = px + 54 + tw / 2, x2 = gx + tw + gap, y1 = py + 186, y2 = y1 + th + gap;
  pauseTile('ov_resume', gx, y1, tw, th, 'DEVAM ET', 'play', () => setOverlay(null), '120,255,150', k - 0.15, true);
  pauseTile('ov_set', x2, y1, tw, th, 'AYARLAR', 'gear', () => setOverlay('psettings'), '190,130,255', k - 0.19, false);
  pauseTile('ov_restart', gx, y2, tw, th, 'YENİDEN BAŞLA', 'restart', () => go(() => startLevel(G.idx, G.chal)), '255,110,110', k - 0.23, false);
  pauseTile('ov_map', x2, y2, tw, th, 'HARİTAYA DÖN', 'map', () => go(() => { screen = 'map'; setOverlay(null); }), '235,200,140', k - 0.27, false);
  // sağ: savaş durumu ve hızlı ses düğmeleri
  const rx = x2 + tw / 2 + 26, rw = px + pw - 40 - rx, rcx = rx + rw / 2, a = clamp((k - 0.25) / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha *= a;
  roundRect(rx, y1 - th / 2, rw, 178, 12, 'rgba(10,3,10,0.45)', 'rgba(201,168,101,0.45)', 1.5);
  txt('SAVAŞ DURUMU', rcx, y1 - th / 2 + 20, 14, '#e6c27a', 'center', '400', FONT_T, false);
  ctx.fillStyle = 'rgba(201,168,101,0.35)'; ctx.fillRect(rx + 16, y1 - th / 2 + 34, rw - 32, 1.2);
  const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60), nW = G.endless ? '∞' : G.lv.waves.length;
  const rows = [['skull', 'Dalga', `${Math.max(0, G.wave)}/${nW}`], ['heart', 'Can', `${G.lives}/${G.maxLives}`], ['coin', 'Altın', String(Math.floor(G.gold))], ['fast', 'Süre', `${mm}:${String(ss).padStart(2, '0')}`]];
  rows.forEach(([ic, lb, v], i) => { const yy = y1 - th / 2 + 56 + i * 32;
    drawIcon(ic, rx + 26, yy, 20); txt(lb, rx + 44, yy + 1, 14, '#d8c8e0', 'left', '700', FONT_B, false); txt(v, rx + rw - 18, yy + 1, 17, '#fff0d8', 'right', '400', FONT_T, false); });
  ctx.restore();
  const mOn = !muted && setting('music'), sOn = !muted && setting('sfx'), ty = y2 + 18;
  const tog = (kk, xx, on, lb, fn) => { roundBtn(kk, xx, ty, 25, on ? 'sound' : 'mute', fn, { appear: k - 0.32, style: on ? 'blue' : 'wood', active: on, activeCol: '190,120,255' });
    txt(lb, xx, ty + 40, 13, on ? '#e8d8f0' : '#8a7a90', 'center', '700', FONT_B, false); };
  tog('ov_mus', rcx - rw * 0.24, mOn, 'Müzik', () => { if (mOn) setSetting('music', false); else { setMuted(false); setSetting('music', true); } sfx('click'); });
  tog('ov_sfx', rcx + rw * 0.24, sOn, 'Efektler', () => { if (sOn) setSetting('sfx', false); else { setMuted(false); setSetting('sfx', true); } sfx('click'); });
  // alt: Mortimer'ın tavsiyesi (her açılışta başka)
  const tip = PAUSE_TIPS[Math.floor(overlayT * 7.3) % PAUSE_TIPS.length], tyy = py + ph - 36, ta = clamp((k - 0.4) / 0.4, 0, 1);
  ctx.save(); ctx.globalAlpha *= ta;
  ctx.fillStyle = 'rgba(201,168,101,0.3)'; ctx.fillRect(px + 60, tyy - 20, pw - 120, 1.2);
  drawSkullIcon(px + 72, tyy + 1, 8);
  txt("Mortimer'ın tavsiyesi:", px + 86, tyy - 1, 13, '#e6c27a', 'left', '800', FONT_B, false);
  ctx.font = `800 13px ${FONT_B}`; const lw = ctx.measureText(TR("Mortimer'ın tavsiyesi:")).width;
  const lines = wrapLines(tip, pw - 160 - lw, 13, '700', FONT_B, 2);
  lines.forEach((l, i) => txt(l, px + 94 + lw, tyy - 1 + (i - (lines.length - 1) / 2) * 16, 13, '#d9c8ea', 'left', '700', FONT_B, false));
  ctx.restore();
}
// duraklatma: panelin solunda Mortimer, elinde ruh ışığı; yerde süzülen sis (Necromancer havası)
function drawPauseMortimer(px, py, ph, k) {
  const im = spr('mortimer'); if (!im) return;
  const a = clamp((k - 0.1) / 0.35, 0, 1), h = 240, w = h * im.width / im.height, x = px - w * 0.42, by = Math.min(py + ph + 6, VIS.b - 6) + (1 - a) * 30 + Math.sin(time * 1.4) * 2;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, by - h * 0.45, h * 0.6, '150,100,255', 0.16 + Math.sin(time * 1.7) * 0.04);
  ctx.restore();
  drawSprite(ctx, im, x, by, w);
  ctx.restore();
}
function drawOverlayFog(fade) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const sp = 9 + (i % 4) * 5, x = VIS.l + (((time * sp * (i % 2 ? 1 : -1) + i * 173) % (VIS.w + 300)) + VIS.w + 300) % (VIS.w + 300) - 150;
    const y = VIS.b - 30 - (i % 3) * 34 + Math.sin(time * 0.5 + i) * 8, w = 260 + (i % 3) * 70;
    ctx.globalAlpha = fade * (0.16 + 0.07 * Math.sin(time * 0.6 + i * 1.3));
    ctx.drawImage(fogTex(i % 2 ? '170,230,190' : '180,160,230', i % 3), x - w / 2, y - w * 0.25, w, w * 0.5);
  }
  ctx.restore();
}
function drawOverlay() {
  if (overlay === 'comic') { drawComic(); return; }
  const k = time - overlayT, fade = clamp(k / 0.25, 0, 1);
  ctx.fillStyle = NECRO ? `rgba(8,4,16,${0.7 * fade})` : `rgba(12,7,2,${0.62 * fade})`; ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  if (NECRO) drawOverlayFog(fade);
  const big = overlay === 'skills' || overlay === 'psettings';
  const sum = overlay === 'win' && NECRO; // zafer: bölüm özeti kartı için uzun panel
  const pz = overlay === 'pause'; // duraklatma: telefonda yanlış dokunulmasın diye büyük, aralıklı düğmeler (Caner, 10 Eki)
  const pw = big ? 600 : pz ? 480 : 470, ph = big ? (NECRO ? 420 : 400) : sum ? 440 : pz ? 430 : 350, cx = W / 2, cy = H / 2 + (big ? 14 : 18), px = cx - pw / 2, py = cy - ph / 2;
  const e = easeOutBack(clamp(k / 0.42, 0, 1));
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15, 0, 1);
  ctx.translate(cx, cy); ctx.scale(e, e); ctx.translate(-cx, -cy);
  if (overlay === 'win') sunburst(cx, py + 110, 300, NECRO ? '140,255,150' : '255,220,120');
  if (NECRO && pz) { drawPauseMenu(k, cx, cy); ctx.restore(); return; } // duraklatma: kendi tasarımı (drawPauseMenu)
  if (NECRO && overlay === 'psettings') drawPauseMortimer(px, py, ph, k);
  panel(px, py, pw, ph);
  if (overlay === 'skills') {
    drawSkillsPanel(k, px, py, pw, ph, cx);
  } else if (overlay === 'pause') {
    if (NECRO) plaqueTitle(cx, py + 50, 'DURAKLATILDI'); else ribbon(cx, py + 4, 290, 'DURAKLATILDI', 'blue', 26);
    // 2x2 kare karolar (Caner, 10 Eki): solda Devam Et / Yeniden Başla, sağda Ayarlar / Haritaya Dön
    const tw = 184, th = 128, gx = 26, gy = 26, x1 = cx - tw / 2 - gx / 2, x2 = cx + tw / 2 + gx / 2, y1 = py + 100 + th / 2, y2 = y1 + th + gy, fs = 18;
    gameButton('ov_resume', x1, y1, tw, th, 'DEVAM ET', () => setOverlay(null), 'green', { icon: 'play', tile: true, shine: true, appear: k - 0.15, size: fs });
    gameButton('ov_restart', x1, y2, tw, th, 'YENİDEN BAŞLA', () => go(() => startLevel(G.idx, G.chal)), 'gold', { icon: 'restart', tile: true, appear: k - 0.22, size: fs });
    gameButton('ov_set', x2, y1, tw, th, 'AYARLAR', () => setOverlay('psettings'), 'blue', { icon: 'gear', tile: true, appear: k - 0.18, size: fs });
    gameButton('ov_map', x2, y2, tw, th, 'HARİTAYA DÖN', () => go(() => { screen = 'map'; setOverlay(null); }), 'wood', { icon: 'map', tile: true, appear: k - 0.26, size: fs });
  } else if (overlay === 'psettings') {
    // duraklatma menüsünden ayarlar: ana ayarlarla aynı satırlar (sıfırlama hariç), geri ok duraklatmaya döner
    if (NECRO) plaqueTitle(cx, py + 50, 'AYARLAR'); else ribbon(cx, py + 4, 290, 'AYARLAR', 'blue', 26);
    roundBtn('ov_setback', px + 44, py + 46, 22, 'back', () => setOverlay('pause'), { appear: k - 0.1 });
    settingsRows(px + 16, py + 84, pw - 32, k, true);
  } else if (overlay === 'win') {
    if (NECRO) plaqueTitle(cx, py + 46, G.chal ? CHAL[G.chal].name + '!' : 'ZAFER!', '#a8f0a0', 30);
    else ribbon(cx, py + 4, G.chal ? 300 : 260, G.chal ? CHAL[G.chal].name + '!' : 'ZAFER!', 'green', 32);
    for (let s = 0; s < 3; s++) {
      if (G.chal && s !== 1) continue; // meydan okuma: ortada tek yıldız
      const sx = cx + (s - 1) * 82, sy = py + 120 - (s === 1 ? 10 : 0), r = s === 1 ? 36 : 29;
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
    txt(lt, cx + 12, py + 178, 21, NECRO ? '#e8dcc0' : '#5a3410', 'center', '400', FONT_T, false);
    const mm = Math.floor(G.t / 60), ss2 = Math.floor(G.t % 60);
    if (sum) drawWinSummary(k, px, py, pw, cx);
    else txt(`${G.kills || 0} düşman · ${mm}:${String(ss2).padStart(2, '0')}`, cx, py + 206, 13, '#8a6238', 'center', '800', FONT_B, false);
    if (NECRO) txt(WIN_QUIPS[G.idx % WIN_QUIPS.length], cx, py + (sum ? 336 : 228), 13, '#9fd8a0', 'center', '700', FONT_B, false);
    const appear = k - 1.3, by = sum ? 110 : NECRO ? 10 : 0; // necro: özet kartına ve espri satırına yer aç
    if (G.idx + 1 < LEVELS.length) {
      roundBtn('ov_retry', cx - 168, py + 262 + by, 25, 'restart', () => go(() => startLevel(G.idx, G.chal)), { appear });
      txt('Tekrar', cx - 168, py + 302 + by, 12, NECRO ? '#cfc4a8' : '#6a4420', 'center', '800', FONT_B, false);
      roundBtn('ov_map', cx - 104, py + 262 + by, 25, 'map', () => go(() => { screen = 'map'; setOverlay(null); }), { appear: appear - 0.06, style: 'blue' });
      txt('Harita', cx - 104, py + 302 + by, 12, NECRO ? '#cfc4a8' : '#6a4420', 'center', '800', FONT_B, false);
      gameButton('ov_next', cx + 70, py + 262 + by, 236, 56, 'SONRAKİ BÖLÜM', () => go(() => startLevel(G.idx + 1)), 'green',
        { icon: 'next', shine: true, breathe: true, appear: appear - 0.12, size: 22, glow: '140,255,120' });
    } else {
      if (!NECRO) txt('Tüm bölümleri tamamladın!', cx, py + 222, 18, '#3a7a2a', 'center', '400', FONT_T, false);
      gameButton('ov_retry', cx - 100, py + 278, 170, 50, 'TEKRAR', () => go(() => startLevel(G.idx, G.chal)), 'wood', { icon: 'restart', appear });
      gameButton('ov_map', cx + 100, py + 278, 170, 50, 'HARİTA', () => go(() => { screen = 'map'; setOverlay(null); }), 'green', { icon: 'map', appear: appear - 0.06, shine: true });
    }
  } else if (overlay === 'lose') {
    if (NECRO) plaqueTitle(cx, py + 46, G.endless ? 'SONSUZ GECE BİTTİ' : 'KALE DÜŞTÜ', '#ff9a8a', 28); else ribbon(cx, py + 4, 280, 'KALE DÜŞTÜ', 'red', 28);
    ctx.save(); ctx.translate(cx, py + 110); ctx.rotate(Math.sin(time * 2) * 0.05);
    drawIcon('skull', 0, 0, 64); ctx.restore();
    if (G.endless) {
      txt(`${G.wave} dalga dayandın`, cx, py + 164, 22, '#e8dcc0', 'center', '400', FONT_T, false);
      txt(G.endNew ? 'YENİ REKOR!' : `Rekor: ${G.endBest} dalga`, cx, py + 192, 15, G.endNew ? '#ffe27a' : '#a89cb8', 'center', '400', FONT_T, false);
    } else {
      txt(`${G.wave}. dalgada düştün`, cx, py + 164, 22, NECRO ? '#e8dcc0' : '#5a3410', 'center', '400', FONT_T, false);
      { const L = wrapLines(TIPS[(G.idx + G.wave) % TIPS.length], pw - 70, 13, '700', FONT_B, 2); // uzun ipucu panelden taşmasın
        L.forEach((l, i) => txt(l, cx, py + 192 + (i - (L.length - 1) / 2) * 16, 13, NECRO ? '#a89cb8' : '#8a6238', 'center', '700', FONT_B, false)); }
    }
    if (!G.revived && !G.endless) { // ödüllü reklam: bölüm başına bir kez, 5 canla kaldığın yerden devam
      gameButton('ov_revive', cx, py + 236, 300, 50, isPremium() ? '5 CANLA DEVAM ET' : '▶ REKLAM İZLE · 5 CANLA DEVAM', () => showRewardedAd(() => {
        G.revived = true; G.lives = 5; G.maxLives = Math.max(G.maxLives, 5);
        for (const e of G.enemies) if (dist(e.x, e.y, G.castle.x, G.castle.y) < 90) damageEnemy(e, 1e9, 'true'); // kapıdakiler dağılır
        setOverlay(null); sfx('levelup');
      }), 'blue', { appear: k - 0.25, size: 15 });
      gameButton('ov_retry', cx - 72, py + 296, 136, 44, 'TEKRAR', () => go(() => startLevel(G.idx, G.chal)), 'green', { icon: 'restart', appear: k - 0.3 });
      gameButton('ov_map', cx + 72, py + 296, 136, 44, 'HARİTA', () => go(() => { screen = 'map'; setOverlay(null); }), 'wood', { icon: 'map', appear: k - 0.38 });
    } else {
      gameButton('ov_retry', cx, py + 240, 270, 52, 'TEKRAR DENE', () => go(() => startLevel(G.idx, G.chal)), 'green', { icon: 'restart', shine: true, appear: k - 0.3 });
      gameButton('ov_map', cx, py + 304, 270, 46, 'HARİTA', () => go(() => { screen = 'map'; setOverlay(null); }), 'wood', { icon: 'map', appear: k - 0.38 });
    }
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
  startMusic();
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
    if (Math.abs(dx) > 70 && mapSel == null) {
      // haritada yana kaydırma: önceki / sonraki sefer (açıksa)
      const ne = clamp((mapEp || 1) - Math.sign(dx), 1, EPISODES.length);
      if (ne !== mapEp && epUnlocked(ne)) { mapEp = ne; screenT = time; sfx('pick'); }
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
  G.spellPeek = null; // büyü seçimi: başka yere dokununca kalkar
  const hitU = (b) => hit(b, x, y, b.r * UI_HIT); // arayüz düğmeleri: görünenden geniş dokunma alanı
  if (hitU(HUD.pause)) { tapPop('hud_pause'); sfx('click'); setOverlay('pause'); return true; }
  if (hitU(HUD.speed)) { tapPop('hud_speed'); sfx('click'); speed = speed >= 3 ? 1 : speed + 1; return true; }
  if (hitU(HUD.mute)) { tapPop('hud_mute'); setMuted(!muted); sfx('click'); return true; }
  for (let i = 0; i < G.heroes.length; i++) {
    const h = G.heroes[i], hb = HUD.heroes[i], bd = heroBadge(hb);
    if (dist(bd.x, bd.y, x, y) <= bd.r + 6) { tapPop('hb' + i); openSkills(h); return true; }
    if (hitU(hb)) {
      tapPop('hud_hero' + i); G.mode = null;
      setSel((G.sel && G.sel.hero === h) || h.dead ? null : { kind: 'hero', hero: h });
      sfx('select');
      return true;
    }
  }
  for (const [i, id] of spellIds().entries()) {
    if (hitU(spellBtn(i))) {
      tapPop('hud_' + id);
      setSel(null);
      // tek dokunuş: hazırsa seçer (diriltme hemen çalışır), alt panelde ne yaptığını yazar; seçiliyken dokunmak bırakır
      if (G.spells[id] > 0) { G.spellPeek = id; G.mode = null; sfx('error'); return true; }
      if (id === 'nm_raise') { G.mode = null; castSpell(id); return true; }
      G.mode = G.mode && G.mode.id === id ? null : { kind: 'spell', id };
      if (G.mode) { G.spellPeek = id; sfx('spell'); }
      return true;
    }
  }
  // dalga butonu
  // ilk dokunuş: o girişten gelecek düşmanları gösterir; ikinci dokunuş (8 sn içinde): dalgayı çağırır
  if (waveCallable()) {
    for (const pi of nextWavePaths()) {
      const b = waveBtnScreen(pi);
      if (dist(b.x, b.y, x, y) < 24 * WAVE_BTN_K + 4) {
        tapPop('wave' + pi);
        if (G.wavePeek && G.wavePeek.w === G.wave && time - G.wavePeek.t < 8) { G.wavePeek = null; waveBonusAndStart(); }
        else { G.wavePeek = { pi, w: G.wave, t: time }; setSel(null); sfx('select'); }
        return true;
      }
    }
    if (G.wavePeek && G.wavePeek.pi != null) {
      // önizleme kutusuna dokunmak da dalgayı çağırır
      const R = G.wavePeek.box;
      if (R && x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) { G.wavePeek = null; waveBonusAndStart(); return true; }
      G.wavePeek = null;
    }
  }
  // açık menü
  if (!G.mode && G.sel && (G.sel.kind === 'plot' || G.sel.kind === 'tower' || G.sel.kind === 'castle' || G.sel.kind === 'hatch')) {
    for (const it of currentMenu()) {
      if (dist(it.x, it.y, x, y) <= MENU_R * MENU_K + 8) {
        const same = G.preview && G.preview.id === it.id && G.preview.type === it.type;
        tapPop('mi' + it.id + (it.type || ''));
        if (it.id === 'rally') { const tw = G.sel.tower; setSel(null); G.mode = tw ? { kind: 'rally', tower: tw } : { kind: 'rally', castle: true }; sfx('pick'); return true; }
        if (it.id === 'max') return true;
        if (it.id === 'imbue' && !G.sel.tower.imbue) { G.sel.sub = 'imbue'; G.preview = null; G.menuT = time; sfx('pick'); return true; } // büyü seçimine geç
        if (it.id === 'imback') { G.sel.sub = null; G.preview = null; G.menuT = time; sfx('pick'); return true; }
        if (!same) { G.preview = it; sfx('pick'); return true; }
        if (it.id === 'build') { if (buildTower(G.sel.plot, it.type)) setSel(null); else sfx('error'); }
        else if (it.id === 'ghoul') { if (openHatch(G.sel.hatch)) setSel(null); else sfx('error'); }
        else if (it.id === 'extra') { if (it.cost != null && buyExtra(G.sel.tower)) { G.preview = null; G.menuT = time; } else if (it.cost != null) sfx('error'); }
        else if (it.id === 'spellup') { if (it.cost != null && buySpellUp(it.type)) { G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'upgrade' && it.type === 'castle') { if (upgradeCastle()) { G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'upgrade') { if (upgradeTower(G.sel.tower)) { G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'ability') { if (it.cost != null && buyAbility(G.sel.tower, it.type)) G.preview = null; else sfx('error'); }
        else if (it.id === 'path') { if (buyPath(G.sel.tower, it.type)) { G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'imbuepick') { if (buyImbue(G.sel.tower, it.type)) { G.sel.sub = null; G.preview = null; G.menuT = time; } else sfx('error'); }
        else if (it.id === 'sell') { sellTower(G.sel.tower); setSel(null); }
        return true;
      }
    }
  }
  // açık düşman paneline dokunmak paneli kapatmaz
  if (G.sel && G.sel.kind === 'enemy' && G.enemyPanelR && hit(G.enemyPanelR, x, y)) return true;
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
      castSpell(m.id, x, y);
    } else if (m.kind === 'rally' && m.castle) {
      // paralı askerlerin toplanma yeri: haritanın her yeri (yola yakınsa yola oturur)
      const n = nearestOnPaths(G.paths, x, y);
      const px = n.d < 30 ? n.x : x, py = n.d < 30 ? n.y : y;
      G.castle.rally = { x: clamp(px, 12, W - 12), y: clamp(py, 60, H - 12) };
      for (const s of G.soldiers) if (s.merc && !s.dead) sendMerc(s);
      const cg = G.chapelGiant; if (cg) { cg.rx = G.castle.rally.x; cg.ry = G.castle.rally.y; if (!cg.dead) { releaseSoldier(cg); cg.moving = true; } }
      G.effects.push({ kind: 'ring', x: px, y: py, r: 22, col: '216,160,64', t: 0, dur: 0.4 });
      sfx('click');
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
  // dekor şakaları: Mortimer'ın çayı, karga, mezardan el
  if (tapProps(x, y)) return;
  // kale: dokununca okçu yükseltme menüsü
  {
    const c = G.castle;
    if (!NECRO && Math.abs(x - (c.x - 12)) < 52 && y < c.y + 22 && y > c.y - 92) {
      setSel(G.sel && G.sel.kind === 'castle' ? null : { kind: 'castle' }); sfx('select'); return;
    }
  }
  // kule
  for (const t of G.towers) {
    if (Math.abs(x - t.x) < 32 * BUILD_K && y < t.y + 20 && y > t.y - 88 * BUILD_K) {
      if (G.sel && G.sel.tower === t) { setSel(null); return; }
      setSel({ kind: 'tower', tower: t }); sfx('select'); return;
    }
  }
  // mahzen kapağı
  for (const h of G.hatches) {
    if (dist(h.x, h.y - 6, x, y) < 26) {
      if (h.state === 'sealed') { floatText(h.x, h.y - 30, 'Mühürlü!', '#ffb070'); sfx('error'); setSel(null); return; }
      if (h.state === 'open') { floatText(h.x, h.y - 30, h.ghoul && h.ghoul.dead ? `${Math.ceil(h.ghoul.respawnT)} sn` : 'Gulyabani nöbette', '#c8ffb0'); setSel(null); return; }
      if (G.sel && G.sel.hatch === h) { setSel(null); return; }
      setSel({ kind: 'hatch', hatch: h }); sfx('select'); return;
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
  const w0 = performance.now(), real = Math.min(0.05, (now - last) / 1000);
  last = now; time += real;
  adaptQuality(real);
  if (bgDirty && time - bgDirty > 0.3) {
    bgDirty = 0;
    if (G) G.bg = renderBackground(G.lv, G.paths, bgRes(), BLEED);
    for (const k in THUMB) delete THUMB[k];
  }
  if (screen === 'play' && !overlay && !trans && !AD) {
    for (let i = 0; i < speed; i++) update(real);
  }
  if (screen === 'play' && G) { updateCamera(real); weatherVisuals(real); }
  if (screen === 'title' && !trans) warmMap(); // haritanın zemini önceden hazırlanır
  weatherAudio();
  updateMusic(real);
  if (trans) {
    trans.t += real;
    if (!trans.fired && trans.t >= TRANS.in) { trans.fired = true; uiParts = []; trans.fn(); screenT = time; }
    if (trans.t >= TRANS.in + TRANS.out) trans = null;
  }
  uiParts = updateParts(uiParts, real);
  // çizim
  const { dpr, scale, ox, oy } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#06030a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  ctx.save(); ctx.beginPath(); ctx.rect(VIS.l, VIS.t, VIS.w, VIS.h); ctx.clip();
  buttons.length = 0;
  if (screen === 'title') drawTitle();
  else if (screen === 'map') drawMap();
  else if (screen === 'heroes') drawHeroes();
  else if (screen === 'settings') drawSettings();
  else if (screen === 'credits') drawCredits();
  else if (screen === 'upgrades') drawUpgrades();
  else if (screen === 'codex') drawCodex();
  else if (screen === 'ach') drawAchievements();
  else if (screen === 'shop') drawShop();
  else drawPlay();
  drawPartsAll(uiParts);
  drawAchToast();
  drawAd();
  if (trans) {
    const a = clamp(trans.t < TRANS.in ? trans.t / TRANS.in : 1 - (trans.t - TRANS.in) / TRANS.out, 0, 1), e = a * a * (3 - 2 * a);
    const cx = (VIS.l + VIS.r) / 2, cy = (VIS.t + VIS.b) / 2, R = Math.hypot(VIS.w, VIS.h) / 2 * 1.15 * (1 - e);
    if (e > 0.995) ctx.fillStyle = '#06030a';
    else { const g = ctx.createRadialGradient(cx, cy, Math.max(0, R - 120), cx, cy, R + 1); g.addColorStop(0, `rgba(6,3,10,${0.25 * e})`); g.addColorStop(1, 'rgba(6,3,10,1)'); ctx.fillStyle = g; }
    ctx.fillRect(VIS.l, VIS.t, VIS.w, VIS.h);
  }
  ctx.restore();
  if (view.ch > view.cw * 1.1) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    roundRect(view.cw / 2 - 150, view.ch - 60, 300, 40, 20, 'rgba(24,14,6,0.9)', '#d4ab5a', 2);
    txt('Telefonu yan çevir ↻', view.cw / 2, view.ch - 40, 16, '#ffd34d', 'center', '400', FONT_T);
  }
  perf.last = (performance.now() - w0) / 1000; // bu karenin iş süresi (kalite ayarı için)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// test/geliştirme kancası
const PLOT_ENTRY = { len: 150, r: 92 }; // yol ağzında arsasız kalan uzunluk ve yarıçap (plotAudit)
window.__game = {
  cut: (n) => spr(n) && ARMS[n] ? cutImage(spr(n), ARMS[n]) : null, ARMS,
  // arsa denetimi (test): yolun çizilen şekline (koyu kenar dahil) taşan arsaları bulur, en yakın uygun yeri önerir
  plotAudit(fix = false, rw = 62) { // rw: arsanın değmeyeceği yol genişliği (ROAD_K katı)
    const out = [];
    LEVELS.forEach((lv, li) => {
      const paths = lv.paths.map(buildPath), R = lv.roadK || ROAD_K;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.fillStyle = '#000'; roadShape(g, paths, rw * R); g.fill();
      const A = g.getImageData(0, 0, W, H).data, road = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A[(Math.round(y) * W + Math.round(x)) * 4 + 3] > 20;
      const RX = 29, RY = 17, ring = (x, y, ax, ay) => { for (let a = 0; a < 6.283; a += 0.2) if (road(x + Math.cos(a) * ax, y + 2 + Math.sin(a) * ay)) return true; return false; };
      const hit = (x, y) => ring(x, y, RX, RY) || ring(x, y, RX * 0.6, RY * 0.6) || road(x, y + 2);
      const near = (x, y) => ring(x, y, RX + 16, RY + 12);
      // düşmanların girdiği yol ağzı: ekrana girdikleri yerden ilk ENTRY.len px boyunca yanına arsa konmaz (geliş yolu boş kalsın)
      const EZ = [];
      for (const p of paths) {
        let d0 = 0; while (d0 < p.total) { const q = pathPos(p, d0); if (q.x > 0 && q.y > 0 && q.x < W && q.y < H) break; d0 += 4; }
        for (let d = d0; d < Math.min(p.total, d0 + PLOT_ENTRY.len); d += 6) EZ.push(pathPos(p, d));
      }
      const entry = (x, y) => EZ.some(q => Math.hypot(q.x - x, q.y - y) < PLOT_ENTRY.r);
      // şapel görselinin kutusu: arsa üstüne binmesin, arsanın kulesi (80 px yukarı uzanır) şapeli örtmesin
      const cim = spr('castle_keep_1') || spr('castle_1'), cp = cim ? castlePlace(lv.castle[0], lv.castle[1], cim) : { x: lv.castle[0], y: lv.castle[1], w: 120 };
      const cTop = cp.y - cp.w * (cim ? cim.height / cim.width : 1.2), cHalf = cp.w / 2;
      const onCastle = (x, y) => Math.abs(x - cp.x) < cHalf + RX + 4 && y > cTop - RY - 6 && y < cp.y + 80;
      const ui = (x, y) => { const top = y - 80; return (top < 74 && (x < 300 || x > W - 200)) || top < 40 || (y > H - 110 && x < 330) || x < 36 || x > W - 36 || y > H - 30 || onCastle(x, y); };
      const plots = lv.plots.map(p => p.slice());
      plots.forEach((pl, k) => {
        if (!hit(pl[0], pl[1]) && !onCastle(pl[0], pl[1]) && !entry(pl[0], pl[1])) return;
        let best = null, bd = 1e9;
        for (const S of [90, 180]) if (!best) for (let dy = -S; dy <= S; dy += 3) for (let dx = -S; dx <= S; dx += 3) {
          const x = pl[0] + dx, y = pl[1] + dy, d = Math.hypot(dx, dy);
          if (d >= bd || hit(x, y) || !near(x, y) || ui(x, y) || entry(x, y)) continue;
          if (plots.some((o, j) => o && j !== k && Math.hypot(o[0] - x, (o[1] - y) * 1.4) < 66)) continue;
          best = [x, y]; bd = d;
        }
        out.push({ level: li + 1, plot: k, from: pl.slice(), to: best });
        plots[k] = best; // yer bulunamazsa arsa kalkar
      });
      for (let k = plots.length - 1; k >= 0; k--) if (!plots[k]) plots.splice(k, 1);
      if (fix) lv.plots = plots;
      out.push({ level: li + 1, plots: JSON.stringify(plots) });
    });
    return out;
  },
  // kare maliyeti ölçümü (test): n kare boyunca güncelleme ve tam sahne çizimi süresini ölçer (ms; ortalama ve en kötü %5)
  perf(n = 120) {
    const U = [], D = [], { dpr, scale, ox, oy } = view;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now(); update(1 / 60); const t1 = performance.now();
      ctx.save(); ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy); buttons.length = 0; drawPlay(); ctx.restore();
      U.push(t1 - t0); D.push(performance.now() - t1);
    }
    const st = (a) => { const b = [...a].sort((x, y) => x - y); return { ort: +(a.reduce((x, y) => x + y) / a.length).toFixed(2), p95: +b[Math.floor(b.length * 0.95)].toFixed(2) }; };
    return { guncelleme: st(U), cizim: st(D), dusman: G.enemies.filter(e => !e.dead).length, asker: G.soldiers.length, parca: G.parts.length, kalite: quality };
  },
  // çizim maliyeti ölçümü (test): bir karakteri n kez yürürken/saldırırken çizer, çizim başına ms döndürür
  bench(name, n = 500) {
    const type = name.slice(6), d = ENEMIES[type], im = d.base ? enemySprite(type) : spr(name), rig = d.base ? 'enemy_' + d.base : name;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) drawUnit(name, im, 100 + (i % 20) * 30, 200 + (i % 7) * 20, 1, { h: CHAR_H[name], rig, fly: 0, seed: i, walking: i % 2 === 0, phase: i * 0.37, atk: i % 2 ? -0.3 + (i % 75) / 100 : null, wings: d.flying ? i * 0.1 : null });
    return (performance.now() - t0) / n;
  },
  // animasyon vitrini (test): bir karakteri verilen pozlarda yan yana çizer, dataURL döndürür.
  // frames: [{ kind: 'atk'|'walk'|'idle'|'cast'|'die', v }] (atk: saniye -0.3..0.45, walk: döngü 0..1, cast: 0.45..0, die: saniye)
  anim(name, frames, size = 160) {
    const type = name.startsWith('enemy_') ? name.slice(6) : null, d = type && ENEMIES[type];
    const hd = !type ? Object.values(HEROES).find(x => x.sprite === name) : null;
    const im = d ? (d.base ? enemySprite(type) : spr(name)) : hd ? heroSprite(hd) : spr(name);
    if (!im) return null;
    const rig = d && d.base ? 'enemy_' + d.base : name, h = CHAR_H[name] || (hd ? hd.h * UNIT_K : 24);
    const out = document.createElement('canvas'); out.width = frames.length * size; out.height = size;
    const o = out.getContext('2d');
    frames.forEach((f, i) => {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#6f7458'; ctx.fillRect(0, 0, size, size);
      const k = size / (h * 1.5); ctx.scale(k, k);
      const x = size / k / 2, y = size / k * 0.9;
      if (f.kind === 'die') drawCorpse({ name, rig, h, x, y, face: 1, fly: 0, t: f.v });
      else drawUnit(name, im, x, y, 1, { h, rig, fly: 0, seed: 0, walking: f.kind === 'walk', phase: f.kind === 'walk' ? f.v * TAU : 0,
        atk: f.kind === 'atk' ? f.v : null, cast: f.kind === 'cast' ? f.v : 0, wings: d && d.flying ? f.v : null });
      ctx.restore();
      o.drawImage(canvas, 0, 0, size, size, i * size, 0, size, size);
    });
    return out.toDataURL();
  },
  music: MUSIC,
  get G() { return G; }, get overlay() { return overlay; }, get screen() { return screen; }, startLevel, setSpeed: (s) => { speed = s; },
  build: (i, type) => buildTower(G.plots[i], type), upgrade: (i) => G.plots[i].tower && upgradeTower(G.plots[i].tower),
  path: (i, p) => buyPath(G.plots[i].tower, p), imbue: (i, k) => buyImbue(G.plots[i].tower, k), // test: Kemik Kulesi yolu ve silah büyüsü
  warmMapNow: () => { const t0 = performance.now(), T = []; for (let i = 0; i < 8; i++) { const a = performance.now(); warmT = -1; warmMap(); T.push(Math.round(performance.now() - a)); } return T; }, // test: önceden hazırlama süreleri
  mapReady: () => ({ img: IMG_READY, ep: mapEp, done: !!(REGION_BG[ensureMapEp()] && REGION_BG[ensureMapEp()].done) }), // test: harita zemini önceden hazır mı
  wave: () => waveBonusAndStart(), cast: castSpell, upgradeCastle, cam, zoomAt, lightning: () => strikeLightning(), spawn: (t, p = 0) => spawnEnemy(t, p), setOverlay, buy: buyAbility, selectTower: (t) => setSel({ kind: 'tower', tower: t }), select: (i) => setSel({ kind: 'plot', plot: G.plots[i] }),
  goMap: () => { screen = 'map'; screenT = time; }, card: (i) => { screen = 'map'; mapSel = i; mapSelT = time; }, goHeroes: () => { screen = 'heroes'; screenT = time; }, goUpgrades: () => { screen = 'upgrades'; screenT = time; },   goCodex: () => { screen = 'codex'; screenT = time; CODEX.t0 = time; }, codex: CODEX, goAch: () => { screen = 'ach'; screenT = time; }, achGive, cnt, mapfx: MAPFX,
  logo: () => titleLogo(), // test: logo tuvali (yakından bakmak için)
  benchTitle(n = 120) { // giriş ekranı çizim süresi (ms)
    const D = [], { dpr, scale, ox, oy } = view;
    for (let i = 0; i < n; i++) { const t0 = performance.now(); ctx.save(); ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy); buttons.length = 0; drawNecroTitle(5 + i / 60); drawPartsAll(uiParts); ctx.restore(); D.push(performance.now() - t0); time += 1 / 60; }
    D.sort((a, b) => a - b); return { ort: +(D.reduce((a, b) => a + b) / n).toFixed(2), p95: +D[Math.floor(n * 0.95)].toFixed(2), max: +D[n - 1].toFixed(2) };
  },
  learn: (i, pi) => learnSkill(G.heroes[i], pi), kill: (e) => damageEnemy(e, 1e9, 'true'), hurt: (s, a = 1e9) => damageSoldier(s, a), openSkills: (i) => openSkills(G.heroes[i]), save: () => save,
  sim(seconds, dt = 1 / 30) { for (let t = 0; t < seconds && !overlay; t += dt) update(dt); return overlay; },
};
})();

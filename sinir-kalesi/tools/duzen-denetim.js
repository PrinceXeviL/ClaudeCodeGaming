// 24 Eki: düzen denetimi (Caner: "buton pencere içindeki yazılar taşıyor, her yeri kontrol et").
// Sunucu açıkken: node sinir-kalesi/tools/duzen-denetim.js <çıktı klasörü> [diller, ör. tr,en,de,ru]
// Her ekranda bir karelik yazı ve kutu (düğme, hap, kart, pencere, yuvarlak düğme) dikdörtgenleri alınır (__game.lay).
// Yazının ortası hangi en küçük kutunun içindeyse yazı o kutudan 2 px'ten fazla taşıyorsa ya da ekran dışına çıkıyorsa kaydedilir.
// Çıktı: <klasör>/rapor.json + <klasör>/<dil>_<ekran>.png (taşmalar kırmızı çerçeveli).
const { chromium } = require('/Users/caner/Documents/Game Lab/kod/ClaudeCodeGaming/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'duzen'; const LANGS = (process.argv[3] || 'tr,en,de,ru').split(',');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(6000);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.cine = Object.assign(S.cine || {}, { intro: 1, oyun: 1, kahve: 1, boss_severus: 1 }); window.__game.lay(true); });
  const tap = async (key) => { const q = await ev((k) => window.__game.btn(k), key); if (q) { await p.mouse.click(q.x, q.y); await p.waitForTimeout(700); } return !!q; };
  const play = async () => { await ev(() => { const g = window.__game; g.setOv(null); g.startLevel(0); }); await p.waitForTimeout(5000);
    await ev(() => { const g = window.__game; g.G.tut = null; g.setOverlay(null); g.G.gold = 5000; }); await p.waitForTimeout(500); };
  const SCENES = [
    ['baslik', async () => { await ev(() => window.__game.goScreen('title')); }],
    ...['ses', 'goruntu', 'oyun', 'dil', 'kayit'].map((t) => ['ayar_' + t, async () => { await ev(() => window.__game.goSettings()); await p.waitForTimeout(800); await tap('settab_' + t); }]),
    ['harita', async () => { await ev(() => window.__game.goMap()); }],
    ...['c', 'h', 'e', 'i', 's'].map((m) => ['kart_' + m, async () => { await ev(() => { window.__game.goMap(); window.__game.card(0); }); await p.waitForTimeout(1500); await tap('mode_' + m + '0'); }]),
    ['komutanlar', async () => { await ev(() => window.__game.goHeroes()); }],
    ['komutan_sayfa', async () => { await ev(() => window.__game.goHeroes()); await p.waitForTimeout(1200); await tap('hcmerlin'); }],
    ['gelismeler', async () => { await ev(() => window.__game.goUpgrades()); }],
    ['kodeks_d', async () => { await ev(() => { window.__game.goCodex(); window.__game.codexSel('cavalry', 'e'); }); }],
    ['kodeks_k', async () => { await ev(() => window.__game.goCodex()); await p.waitForTimeout(800); await tap('cx_t'); }],
    ['basarim', async () => { await ev(() => window.__game.goScreen('ach')); }],
    ...['full', 'kristal', 'keep', 'cos'].map((t) => ['dukkan_' + t, async () => { await ev(() => window.__game.goScreen('shop')); await p.waitForTimeout(800); await tap('tab_' + t); }]),
    ['buyu', async () => { await ev(() => window.__game.goScreen('grim')); }],
    ['oyun', play],
    ['insa', async () => { await ev(() => window.__game.select(0)); }],
    ['kule', async () => { await ev(() => { const g = window.__game; g.setOv(null); g.build(1, 'archer'); g.selectTower(g.G.plots[1].tower); }); }],
    ['kule_bilgi', async () => { await ev(() => { const g = window.__game; g.build(2, 'mage'); g.upgrade(2); g.upgrade(2); g.selectTower(g.G.plots[2].tower); }); }],
    ['dusman', async () => { const q = await ev(() => { const g = window.__game, e = g.spawn('legion'); g.setSpeed && g.setSpeed(0); return e ? g.toScreen(e.x, e.y - 20) : null; }); if (q) await p.mouse.click(q.x, q.y); }],
    ['yetenek', async () => { await ev(() => window.__game.openSkills(0)); }],
    ['duraklat', async () => { await ev(() => window.__game.setOv('pause')); }],
    ['oyun_ayar', async () => { await ev(() => window.__game.setOv('psettings')); }],
    ['zafer', async () => { await ev(() => window.__game.setOv('win')); }],
    ['yenilgi', async () => { await ev(() => window.__game.setOv('lose')); }],
  ];
  const rep = {};
  for (const L of LANGS) {
    await ev((L) => new Promise((r) => (window.LANG === L ? r() : window.setLang(L, r))), L); await p.waitForTimeout(1200);
    for (const [name, fn] of SCENES) {
      try { await fn(); } catch (e) { console.log('sahne hata', L, name, e.message); continue; }
      await p.waitForTimeout(2600);
      const d = await ev(() => { const c = document.getElementById('game'); return Object.assign(window.__game.lay(), { cw: c.width, ch: c.height }); });
      const bad = [];
      d.t = d.t.filter((t) => { const cx = t.x + t.w / 2, cy = t.y + t.h / 2; return !d.b.some((q) => q.i > t.i && q.k !== 'rr' && cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h); }); /* sonradan çizilen pencere/kartın altında kalan yazı görünmez */
      for (const t of d.t) {
        const cx = t.x + t.w / 2, cy = t.y + t.h / 2, pad = 2 * d.ch / 540;
        const box = d.b.filter((q) => q.i < t.i && cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h).sort((a, c) => a.w * a.h - c.w * c.h)[0];
        const inside = t.x + t.w > 0 && t.x < d.cw && t.y + t.h > 0 && t.y < d.ch, off = inside && (t.x < -pad || t.x + t.w > d.cw + pad || t.y < -pad || t.y + t.h > d.ch + pad); /* tamamen dışarıdaki yazı kaydırılan listede kırpılmıştır */
        const over = box && (t.x < box.x - pad || t.x + t.w > box.x + box.w + pad);
        if (off || over) bad.push({ s: t.s, k: off ? 'ekran' : box.k, t: [t.x, t.y, t.w, t.h].map(Math.round), b: box && [box.x, box.y, box.w, box.h].map(Math.round) });
      }
      const k1 = d.ch / 540; /* mantıksal 1 birim (540 yükseklik) */
      for (const t of d.t) if (t.z / k1 < 9.5) bad.push({ s: t.s, k: 'küçük ' + (t.z / k1).toFixed(1), t: [t.x, t.y, t.w, t.h].map(Math.round) });
      for (let i = 0; i < d.t.length; i++) for (let j = i + 1; j < d.t.length; j++) { const a = d.t[i], c = d.t[j];
        const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ox > 3 * k1 && oy > 3 * k1 && a.s !== c.s) bad.push({ s: a.s + ' ⟷ ' + c.s, k: 'çakışma', t: [Math.min(a.x, c.x), Math.min(a.y, c.y), Math.max(a.x + a.w, c.x + c.w) - Math.min(a.x, c.x), Math.max(a.y + a.h, c.y + c.h) - Math.min(a.y, c.y)].map(Math.round) }); }
      const seen = new Set(); const uniq = bad.filter((q) => { const k = q.s + q.t.join(); if (seen.has(k)) return false; seen.add(k); return true; });
      rep[L + '_' + name] = uniq;
      const sk = 2 * 852 / d.cw * (d.cw / 1704);
      if (uniq.length) {
        await ev(([u, k]) => { let el = document.getElementById('__lay'); if (!el) { el = document.createElement('div'); el.id = '__lay'; el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99'; document.body.appendChild(el); }
          el.innerHTML = u.map((q) => `<div style="position:absolute;left:${q.t[0] * k}px;top:${q.t[1] * k}px;width:${q.t[2] * k}px;height:${q.t[3] * k}px;outline:2px solid red"></div>` + (q.b ? `<div style="position:absolute;left:${q.b[0] * k}px;top:${q.b[1] * k}px;width:${q.b[2] * k}px;height:${q.b[3] * k}px;outline:1px dashed yellow"></div>` : '')).join(''); }, [uniq, 852 / d.cw]);
      }
      await p.screenshot({ path: `${OUT}/${L}_${name}.png` });
      await ev(() => { const el = document.getElementById('__lay'); if (el) el.innerHTML = ''; });
      console.log(L, name, uniq.length ? uniq.length + ': ' + uniq.map((q) => q.k + '·' + q.s).slice(0, 12).join(' | ') : 'temiz');
    }
  }
  fs.writeFileSync(`${OUT}/rapor.json`, JSON.stringify(rep, null, 1));
  console.log('hatalar', errs.slice(0, 5)); await b.close();
})();

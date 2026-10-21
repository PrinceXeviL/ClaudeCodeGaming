// Mağaza ekran görüntüleri (13 Eki): iPhone 6,9" (2868x1320), iPad 13" (2752x2064), Google Play (2640x1320) aynı sahnelerden çekilir.
// Sunucu 8765'te açıkken: node tools/magaza-ekran.js   → ../magaza/app_store_iphone, app_store_ipad, play
// İpuçları, başarım bildirimleri ve tanıtım kartları gizlenir (gerçek oyunda ilk oyunda bir kez çıkarlar).
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, '..', '..', 'magaza'); // OUT=klasör: deneme çekimi
const SIZES = [['app_store_iphone', 956, 440, 3], ['app_store_ipad', 1376, 1032, 2], ['play', 1320, 660, 2]].filter(z => !process.env.YALNIZ || z[0] === process.env.YALNIZ);

// sahne: ad + sayfada çalışan hazırlık (g = window.__game)
// kurulum: altın 2000 altında tutulur (Cimri Büyücü başarımı bildirimi çıkmasın); bitince kamera odağa yaklaşır
const setup = (lv, towers, spawns, simT, gold, zoom) => async (p) => {
  await p.evaluate(([lv, towers, spawns]) => { const g = window.__game; g.startLevel(lv); g.setOverlay(null);
    towers.forEach(([t, u], i) => { g.G.gold = 1900; g.build(i, t); for (let k = 0; k < u; k++) { g.G.gold = 1900; g.upgrade(i); } });
    if (spawns) { const L = []; spawns.forEach(([t, n]) => { for (let i = 0; i < n; i++) L.push(t); }); // boss önde; kalanlar 4 grupta, aralarında 2,5 sn (yola yayılsınlar)
      g.spawn(L.shift(), 0); g.G.gold = 1500; g.sim(2.5); for (let k = 0; k < 4; k++) { L.splice(0, Math.ceil(L.length / (4 - k))).forEach((t, i) => g.spawn(t, i % (g.G.paths.length || 1))); g.sim(2.5); } }
    else { g.wave(); g.wave(); g.wave(); } }, [lv, towers, spawns]);
  await p.evaluate(([simT, gold]) => { const g = window.__game; g.setOverlay(null); g.G.gold = 1500; g.sim(simT); g.G.gold = gold; }, [simT, gold]);
  await p.evaluate((zoom) => { const g = window.__game, G = g.G; // odak: boss varsa o, yoksa en kalabalık dövüş
    const b = G.enemies.find(e => !e.dead && e.def.chief); let x, y;
    if (b) { x = b.x; y = b.y - 20; } else { const f = G.soldiers.filter(s => !s.dead && s.target); const L = f.length ? f : G.enemies.filter(e => !e.dead); x = L.reduce((a, o) => a + o.x, 0) / L.length; y = L.reduce((a, o) => a + o.y, 0) / L.length; }
    g.cam.z = 1; g.cam.x = 0; g.cam.y = 0; g.zoomAt(x, y, zoom); }, zoom);
  await p.waitForTimeout(1600);
};
const SCENES = [
  ['0_baslik', async (p) => { await p.waitForTimeout(2500); }],
  // 1_savas: 21 Eki yeniden (yeni Kemik Kulesi, Ruh Feneri; yoğun dövüş, boss yok)
  ['1_savas', setup(9, [['archer', 3], ['barracks', 3], ['mage', 3], ['artillery', 3], ['archer', 2], ['mage', 2], ['barracks', 2]], [['heavy', 4], ['legion', 10], ['legion_k', 4], ['cavalry', 3]], 10.5, 960, 1.4)],
  ['2_boss', setup(19, [['barracks', 3], ['archer', 3], ['mage', 3], ['artillery', 3], ['altar', 2], ['mage', 2], ['archer', 2]], [['gloriosus1', 1], ['heavy', 3], ['legion', 4]], 12, 1210, 1.7)],
  ['3_final', setup(39, [['barracks', 3], ['mage', 3], ['artillery', 3], ['archer', 3], ['altar', 2], ['barracks', 2]], [['severus3', 1], ['paladin', 3], ['inquisitor', 3], ['torch', 3], ['flagellant', 3]], 9, 1875, 1.7)],
  ['4_harita', async (p) => { await p.evaluate(() => window.__game.goMap()); await p.waitForTimeout(3000); }],
  ['5_kodeks', async (p) => {
    await p.evaluate(() => { const S = window.__game.save(); S.codex = Object.keys(ENEMIES).filter(k => !ENEMIES[k].rank); S.codexNew = []; window.__game.goMap(); }); // 21 Eki: kodeks dolu görünsün
    await p.waitForTimeout(1500);
    const q = await p.evaluate(() => window.__game.btn('codex') || window.__game.btn('t_codex')); if (q) await p.mouse.click(q.x, q.y);
    await p.waitForTimeout(1200);
    const c = await p.evaluate(() => window.__game.btn('cxecenturion')); if (c) await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(1500);
  }],
];

(async () => {
  const b = await chromium.launch();
  for (const [dir, w, h, dpr] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await ctx.addInitScript(() => { window.MAGAZA = true; }); // 21 Eki: mağaza sürümü görünümü (admin/deneme düğmeleri yok)
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(2500);
    // bütün bölümler açık, ipuçları görülmüş say (kayıt yeniden yüklenince geçerli)
    await p.evaluate(() => {
      const k = 'sinirKalesi.v1', s = JSON.parse(localStorage.getItem(k) || '{}');
      s.tips = { castle: 1, grim: 1, pts: 1, tree: 1 }; Object.assign(s, { burstSeen: true, golemSeen: true, graveSeen: true, hatchSeen: true, mapSeen: true, statsAsked: 1, tdAsked: 1 }); { const d = new Date(); s.login = Object.assign(s.login || {}, { last: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }); } // günlük hediye penceresi çıkmasın // 21 Eki: izin kutusu ve öğretici sorusu çıkmasın
      s.stars = s.stars || []; for (let i = 0; i < 31; i++) s.stars[i] = s.stars[i] || (i < 27 ? 3 : 2);
      localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem('sinirKalesi.muted', '1');
    });
    for (const [name, prep] of SCENES) {
      await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(4500);
      await prep(p);
      await p.evaluate(() => { const G = window.__game.G; if (G) { G.banner = null; G.intro = null; G.sigBanner = null; G.floaters = []; G.dmgNums = []; G.lvlBanner = null; G.toast = null; } window.__hideWaveBtn = true; }); // 21 Eki: boss yetenek adı ve uçan yazılar arayüze binmesin
      await p.waitForTimeout(300);
      await p.evaluate(() => { const G = window.__game.G; if (G) { G.banner = null; G.sigBanner = null; G.floaters = []; G.dmgNums = []; } });
      require('fs').mkdirSync(path.join(OUT, dir), { recursive: true }); await p.screenshot({ path: path.join(OUT, dir, name + '.png') });
    }
    console.log(dir, 'tamam', errs.length ? errs : '');
    await ctx.close();
  }
  await b.close();
})();

// Kalabalık taraması (16 Eki, Caner: "kalabalık gruplar tek seferde geliyor, yolda sıkışıyorlar"): her bölümün her dalgası kulesiz oynatılır,
// düşmanlar yürürken yolun ilk 220 px'inde aynı anda kaç düşman olduğu ve bir düşmanın 12 px yakınında kaç komşu olduğu ölçülür.
//   node tools/kalabalik-tara.js [bölümler]   (sunucu 8765'te açık)
const { chromium } = require('playwright');
const arg = process.argv[2] || '0-39';
const lvls = arg.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(arg.split('-').map(Number)) : arg.split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto('http://localhost:8765/index.html?' + Date.now(), { timeout: 180000 }); await p.waitForTimeout(2500);
  for (const lvl of lvls) {
    const r = await p.evaluate((lvl) => {
      const g = window.__game; g.save().tutDone = 1; g.startLevel(lvl); const G = g.G; g.setOv && g.setOv(null);
      const out = [];
      for (let w = 0; w < G.lv.waves.length; w++) {
        for (const e of G.enemies) e.dead = true; G.enemies = []; G.spawners = []; G.lives = 999;
        g.wave(); let peak = 0, jam = 0, t = 0;
        while ((G.spawners.length || G.enemies.some(e => !e.dead && e.p && e.d < 260)) && t < 240) {
          g.sim(0.25); t += 0.25; G.lives = 999; if (g.overlay) g.setOv(null);
          const L = G.enemies.filter(e => !e.dead && e.p && e.d >= 0 && e.d < 220 && !e.def.flying);
          const byP = {}; for (const e of L) byP[G.paths.indexOf(e.p)] = (byP[G.paths.indexOf(e.p)] || 0) + 1;
          peak = Math.max(peak, ...Object.values(byP), 0);
          for (const e of L) { let n = 0; for (const o of L) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 12) n++; jam = Math.max(jam, n); }
        }
        out.push([w + 1, peak, jam]);
      }
      return { lvl, name: G.lv.name, waves: out };
    }, lvl);
    const worst = r.waves.reduce((a, w) => Math.max(a, w[2]), 0), peak = r.waves.reduce((a, w) => Math.max(a, w[1]), 0);
    console.log(JSON.stringify({ lvl: r.lvl, name: r.name, peak, jam: worst, bad: r.waves.filter(w => w[2] >= 4).map(w => w[0] + ':' + w[2]).join(' ') }));
  }
  await b.close();
})();

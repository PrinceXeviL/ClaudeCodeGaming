const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await p.addInitScript((f) => Object.assign(window, f), JSON.parse(process.argv[2] || '{}'));
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const g = window.__game; g.startLevel(8); const G = g.G; G.gold = 99999;
    for (let i = 0; i < G.plots.length; i++) { g.build(i, ['archer','mage','artillery','barracks'][i % 4]); g.upgrade(i); g.upgrade(i); }
    for (const t of G.towers) for (const a of t.def.abilities) for (let r = 0; r < 3; r++) g.buy(t, a.id);
    g.wave(); g.sim(8); g.wave(); g.sim(4); g.wave(); g.setSpeed(2); });
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else r((n / 4).toFixed(1) + ' fps, enemies ' + window.__game.G.enemies.length + ', parts ' + window.__game.G.parts.length); }; requestAnimationFrame(f); }));
  console.log(fps);
  await b.close();
})();

const { chromium } = require('playwright');
(async () => {
  const lvls = (process.argv[2] || '0,1,2,3,4,5,6,7,8,9').split(',').map(Number), team = (process.argv[3] || 'commander').split(',');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript((team) => { localStorage.setItem('sinirKalesi.v1', JSON.stringify({ stars: [3,3,3,3,3,3,3,3,3,3], team })); }, team);
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForTimeout(800);
  for (const lvl of lvls) {
    const r = await p.evaluate((lvl) => {
      const g = window.__game; g.startLevel(lvl); const G = g.G;
      const order = ['archer', 'barracks', 'mage', 'archer', 'artillery', 'mage', 'barracks', 'archer', 'artillery', 'mage', 'archer', 'barracks', 'mage'];
      let time = 0; g.wave();
      const dens = () => { let best = null, bn = 0; for (const e of G.enemies) { if (e.dead || e.def.flying) continue; const n = G.enemies.filter(o => !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 55).length; if (n > bn) { bn = n; best = e; } } return [best, bn]; };
      while (!g.overlay && time < 1200) {
        // kahraman yetenekleri
        G.heroes.forEach((h, i) => { for (let k = 0; k < 3; k++) g.learn(i, (h.lvl + k) % 2) || g.learn(i, (h.lvl + k + 1) % 2); });
        // harcama: en ucuz seçenek
        for (let guard = 0; guard < 6; guard++) {
          const opts = [];
          const free = G.plots.findIndex(p => !p.tower);
          if (free >= 0) { const t = order[G.towers.length % order.length]; opts.push({ c: { archer: 70, barracks: 70, mage: 100, artillery: 125 }[t] * 1.6, f: () => g.build(free, t) }); }
          for (let i = 0; i < G.plots.length; i++) { const t = G.plots[i].tower; if (t && t.lvl < 2) opts.push({ c: t.def.levels[t.lvl + 1].cost, f: () => g.upgrade(i) }); }
          if (G.castle.lvl < CASTLE.levels.length - 1 && G.towers.length >= 4) opts.push({ c: CASTLE.levels[G.castle.lvl + 1].cost * 1.5, f: () => g.upgradeCastle() });
          if (free < 0) for (const t of G.towers) if (t.lvl === 2) for (const a of t.def.abilities) { const r = (t.ab && t.ab[a.id]) || 0; if (r < 3) opts.push({ c: a.ranks[r].cost, f: () => g.buy(t, a.id) }); }
          opts.sort((a, b) => a.c - b.c);
          const o = opts[0];
          if (!o || !o.f()) break;
        }
        // büyüler
        // kahraman güçleri: kalabalığın üstüne
        for (const id of ['ult0', 'ult1']) if (G.spells[id] != null && G.spells[id] <= 0) { const [e, n] = dens(); if (e && n >= 4) g.cast(id, e.x, e.y); }
        // Mortimer'ın büyüleri: korku kalabalığa, diriltme yerde 3+ ceset varken
        if (G.spells.nm_fear != null && G.spells.nm_fear <= 0) { const [e, n] = dens(); if (e && n >= 5) g.cast('nm_fear', e.x, e.y); }
        if (G.spells.nm_raise != null && G.spells.nm_raise <= 0 && G.effects.filter(f => f.kind === 'corpse' && f.raisable).length >= 3) g.cast('nm_raise', 0, 0);
        g.sim(0.5); time += 0.5;
      }
      return { lvl: lvl + 1, result: g.overlay, lives: G.lives, wave: G.wave + '/' + G.lv.waves.length, t: Math.round(time) };
    }, lvl);
    console.log(JSON.stringify(r));
  }
  if (errs.length) console.log('errors', errs);
  await b.close();
})();

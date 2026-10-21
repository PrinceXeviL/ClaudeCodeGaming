// Uzmanlık arenası (21 Eki): aynı bölüm, aynı arsa, tek tam geliştirilmiş kule; aynı düşman akışı 100 sn. Ölçüm: hasar/sn, altın, hasar/100 altın, sızan.
const { chromium } = require('/Users/caner/Documents/Game Lab/kod/ClaudeCodeGaming/node_modules/playwright');
const SPECS = [['archer', 'bow', 'bow'], ['archer', 'xbow', 'fan'], ['barracks', null, 'shield'], ['barracks', null, 'blade'], ['barracks', null, 'golem'],
  ['mage', null, 'drain'], ['mage', null, 'ghost'], ['artillery', null, 'corpse'], ['artillery', null, 'plague'], ['altar', null, 'rite'], ['altar', null, 'blight'],
  ['archer', 'bow', null], ['archer', 'xbow', null], ['barracks', null, null], ['mage', null, null], ['artillery', null, null], ['altar', null, null]];
const LV = 9, REP = +(process.argv[2] || 3);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(5000);
  await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.cine = { intro: 1, oyun: 1, kahve: 1 }; S.team = ['leonidas']; S.upg = {}; });
  const out = [];
  for (const [type, path, sp] of SPECS) for (let rep = 0; rep < REP; rep++) {
    const r = await p.evaluate(async ([type, path, sp, LV, rep]) => {
      const g = window.__game; g.setOv(null); g.startLevel(LV); await new Promise(r => setTimeout(r, 2500)); const G = g.G;
      G.soldiers = G.soldiers.filter(s => !s.hero); G.heroes.length = 0; G.lives = 9999; G.gold = 1e6;
      // yola en çok bakan arsa (menzil 150 içinde kalan yol noktası sayısı)
      let best = 0, bi = 0; G.plots.forEach((pl, i) => { let n = 0; for (const P of G.paths) for (let d = 0; d < P.total; d += 8) { const q = g.pathPos(P, d); if (Math.hypot(q.x - pl.x, q.y - pl.y) < 150) n++; } if (n > best) { best = n; bi = i; } });
      const g0 = G.gold; g.build(bi, type); const t = G.plots[bi].tower; if (path) g.path(bi, path); while (t.lvl < t.def.levels.length - 1) { if (!g.upgrade(bi) && t.lvl < t.def.levels.length - 1) { g.upgrade(bi); break; } }
      if (sp) { for (let k = 0; k < 3; k++) g.ability(bi, sp); for (let k = 0; k < 3; k++) g.extra(bi); g.buyMore(bi); }
      const cost = g0 - G.gold; g.sim(3);
      window.__dmgAcc = { by: {}, mx: {} }; let spawned = 0;
      const MIX = ['legion', 'legion_k', 'heavy', 'cavalry', 'eagle', 'priest', 'assassin', 'legion', 'gladiator', 'testudo'];
      const lives0 = G.lives;
      for (let s = 0; s < 100; s += 0.5) { if (s % 2.5 === 0 && s < 80) { for (const ty of [MIX[(s / 2.5) % MIX.length], MIX[(s / 2.5 + 3) % MIX.length]]) if (ENEMIES[ty]) { g.spawn(ty, G.paths.length > 1 ? (spawned % G.paths.length) : 0); spawned++; } } g.sim(0.5); }
      const dmg = Object.values(window.__dmgAcc.by).reduce((a, b) => a + b, 0);
      return { type, path, sp, rep, cost, dmg: Math.round(dmg), dps: +(dmg / 100).toFixed(1), per100: +(dmg / cost * 100).toFixed(1), leak: lives0 - G.lives, spawned, plot: bi, lvl: t.lvl, spec: t.spec };
    }, [type, path, sp, LV, rep]);
    out.push(r); console.error(JSON.stringify(r));
  }
  console.log(JSON.stringify({ out, errs: [...new Set(errs)].slice(0, 5) })); await b.close();
})();

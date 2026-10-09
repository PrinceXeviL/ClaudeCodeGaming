// Sayfa içi denge botu (Playwright gerekmez): oyun açıkken konsolda/tarayıcı aracıyla çalıştırılır.
//   __bot(i)            -> i. bölümü (0'dan) botla oynar: { lvl, result: 'win'|'lose', lives, wave, n, t }
//   __measure(a, b, k)  -> a..b-1 bölümlerini k kez oynatır, ortalama puan (kazanınca kalan can, kaybedince eksi)
//   __tune2(a, b)       -> puanı hedefe (__T) göre hpMul'u sönümlü adımla ayarlar (sonuç data.js HPMUL'a elle yazılır)
window.__bot = function (lvl) {
  const g = window.__game; g.startLevel(lvl); const G = g.G; if (g.overlay) g.setOverlay(null);
  const order = ['archer', 'barracks', 'mage', 'archer', 'artillery', 'mage', 'barracks', 'archer', 'artillery', 'mage', 'archer', 'barracks', 'mage'];
  let time = 0; g.wave();
  const dens = () => { let best = null, bn = 0; for (const e of G.enemies) { if (e.dead || e.def.flying) continue; const n = G.enemies.filter(o => !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 55).length; if (n > bn) { bn = n; best = e; } } return [best, bn]; };
  while (time < 1500) {
    const ov = g.overlay; if (ov === 'win' || ov === 'lose') break; if (ov) g.setOverlay(null);
    G.heroes.forEach((h, i) => { for (let k = 0; k < 3; k++) g.learn(i, (h.lvl + k) % 2) || g.learn(i, (h.lvl + k + 1) % 2); });
    for (let guard = 0; guard < 6; guard++) {
      const opts = []; const free = G.plots.findIndex(p => !p.tower);
      if (free >= 0) { const t = order[G.towers.length % order.length]; opts.push({ c: { archer: 70, barracks: 70, mage: 100, artillery: 125 }[t] * 1.6, f: () => g.build(free, t) }); }
      for (let i = 0; i < G.plots.length; i++) { const t = G.plots[i].tower; if (t && t.lvl < 2) opts.push({ c: t.def.levels[t.lvl + 1].cost, f: () => g.upgrade(i) }); }
      if (free < 0) for (const t of G.towers) if (t.lvl === 2) for (const a of (t.def.abilities || [])) { const r = (t.ab && t.ab[a.id]) || 0; if (r < 3 && a.ranks && a.ranks[r]) opts.push({ c: a.ranks[r].cost, f: () => g.buy(t, a.id) }); }
      opts.sort((a, b) => a.c - b.c); const o = opts[0]; if (!o || !o.f()) break;
    }
    for (const id of ['ult0']) if (G.spells[id] != null && G.spells[id] <= 0) { const [e, n] = dens(); if (e && n >= 4) g.cast(id, e.x, e.y); }
    if (G.spells.nm_fear != null && G.spells.nm_fear <= 0) { const [e, n] = dens(); if (e && n >= 5) g.cast('nm_fear', e.x, e.y); }
    if (G.spells.nm_raise != null && G.spells.nm_raise <= 0 && G.effects.filter(f => f.kind === 'corpse' && f.raisable).length >= 3) g.cast('nm_raise', 0, 0);
    g.sim(0.5); time += 0.5;
  }
  return { lvl: lvl + 1, result: g.overlay, lives: G.lives, wave: G.wave, n: G.lv.waves.length, t: Math.round(time) };
};
window.__score = (r) => r.result === 'win' ? r.lives : -(r.n - r.wave + 1) * 3;
window.__T = [19, 18, 17, 16, 15, 15, 14, 13, 12, 12, 11, 10, 9, 8, 7]; // hedef: kalan can (1. bölüm kolay, 15. zor)
window.__measure = function (from, to, k = 2) {
  const res = []; for (let i = from; i < to; i++) { let s = 0; for (let j = 0; j < k; j++) s += window.__score(window.__bot(i)); res.push((i + 1) + ':' + (s / k).toFixed(1) + '/' + window.__T[i]); } return res.join(' ');
};
window.__tune2 = function (from, to, k = 3) {
  const res = []; for (let i = from; i < to; i++) {
    let s = 0; for (let j = 0; j < k; j++) s += window.__score(window.__bot(i));
    const avg = s / k, d = avg - window.__T[i], lv = LEVELS[i], f = lv.hpMul || 1; let nf = f;
    if (d > 1.5) nf = f * (1 + Math.min(0.12, d * 0.012)); else if (d < -1.5) nf = f * (1 - Math.min(0.15, -d * 0.015));
    lv.hpMul = +Math.min(i < 3 ? 1.25 : 1.4, nf).toFixed(3); res.push((i + 1) + ':' + avg.toFixed(1) + '→' + lv.hpMul);
  } return res.join(' ');
};

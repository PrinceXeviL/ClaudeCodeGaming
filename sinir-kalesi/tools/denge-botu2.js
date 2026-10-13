// Denge botu 2 (15 Eki): gerçekçi oyuncu gibi oynar, bölüm başına sonuç + kaleye sızan düşman türlerini yazar.
//   node tools/denge-botu2.js 0-39 [commander] [yildiz=3]
// Oyuncu modeli: önceki bölümlerin hepsinden `yildiz` yıldız (gelişmeler açgözlü alınır), büyü XP'si bölüm sırasıyla artar
// (Büyü Kitabı puanları harcanır), komutan seviyesi bölümle artar (yetenek puanları harcanır).
// Strateji: kule yerleri yolu en çok gördükleri sıraya göre; karışık kule; en ucuz geliştirme; okçu yolu sırayla bow/xbow;
// büyüler: duvar kaleye yaklaşan durdurulamayanların (noblock/hızlı) önüne, korku kalabalığa, diriltme/patlatma/golem ceset kümesine.
const { chromium } = require('playwright');
const arg = process.argv[2] || '0-39', team = (process.argv[3] || 'commander').split(','), STARS = +(process.argv[4] || 3);
const lvls = arg.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(arg.split('-').map(Number)) : arg.split(',').map(Number);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForTimeout(1500);
  for (const lvl of lvls) {
    const r = await p.evaluate(({ lvl, team, STARS }) => {
      const g = window.__game, S = g.save();
      // --- oyuncu ilerlemesi ---
      S.stars = Array.from({ length: lvl }, () => STARS); S.team = team; S.upg = {}; S.grim = {}; S.sxp = {}; S.tutDone = 1; S.comics = S.comics || {};
      let free = S.stars.reduce((a, b) => a + b, 0), bought = true;
      while (bought) { bought = false; for (const u of UPGRADES) { const r = S.upg[u.id] || 0; if (r < u.ranks.length && u.ranks[r].cost <= free) { free -= u.ranks[r].cost; S.upg[u.id] = r + 1; bought = true; } } }
      for (const id of ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem']) { S.sxp[id] = 85 * lvl; for (let k = 0; k < 5; k++) g.grimBuy(id); }
      S.hero = {}; for (const id of team) S.hero[id] = { lvl: Math.min(10, 1 + Math.floor(lvl / 2)), xp: 0, sk: {}, ult: 1 };
      g.startLevel(lvl); const G = g.G; if (g.overlay === 'comic') g.setOverlay(null);
      // komutan puanları
      for (let k = 0; k < 12; k++) { g.learn(0, 'ult'); for (const pth of G.heroes[0].def.paths) for (const sk of pth.skills) g.learn(0, sk.id); }
      // --- yol örnekleri ve kule yeri sırası ---
      const ptsAll = []; for (const P of G.paths) for (let d = 0; d < P.total; d += 18) { const q = at(P, d); q.k = d / P.total; ptsAll.push(q); }
      function at(P, d) { const c = P.cum, pt = P.pts; let i = 1; while (i < c.length - 1 && c[i] < d) i++; const t = (d - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]); return { x: pt[i - 1][0] + (pt[i][0] - pt[i - 1][0]) * t, y: pt[i - 1][1] + (pt[i][1] - pt[i - 1][1]) * t }; } // yol noktaları [x, y]
      const cover = (pl, R) => ptsAll.filter(q => Math.hypot(q.x - pl.x, q.y - pl.y) < R).length;
      const order = G.plots.map((pl, i) => ({ i, c: cover(pl, 140) })).sort((a, b) => b.c - a.c).map(o => o.i);
      const flyN = G.lv.waves.reduce((a, w) => a + (w.groups || w).reduce ? (w.groups || w).reduce((s, gr) => s + (((ENEMIES[gr.t || gr.type || gr[0]] || {}).flying) ? 1 : 0), 0) : 0, 0);
      const plan = ['barracks', 'archer', 'mage', 'artillery', 'archer', 'mage', 'barracks', 'artillery', 'archer', 'mage', 'archer', 'barracks', 'mage', 'artillery'];
      const leaks = {}, alive = new Map(); let time = 0, casts = 0, xbow = 0;
      const cast = (id, x, y) => { g.cast(id, x, y); if (G.spells[id] > 0) { casts++; used[id] = (used[id] || 0) + 1; } }, used = {};
      g.wave();
      const dens = (list, r) => { let best = null, bn = 0; for (const e of list) { const n = list.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < r).length; if (n > bn) { bn = n; best = e; } } return [best, bn]; };
      while (!g.overlay && time < 1500) {
        // harcama
        for (let guard = 0; guard < 8; guard++) {
          const opts = [];
          const fi = order.find(i => !G.plots[i].tower);
          if (fi != null) { const t = plan[G.towers.length % plan.length]; opts.push({ c: TOWERS[t].levels[0].cost * 1.3, f: () => g.build(fi, t) }); }
          for (const i of order) { const t = G.plots[i].tower; if (!t) continue;
            if (t.type === 'archer' && NECRO && !t.path && t.lvl === 0) { const pp = (xbow++ % 2) ? 'xbow' : 'bow'; opts.push({ c: 140, f: () => g.path(i, pp) }); continue; }
            if (t.lvl < t.def.levels.length - 1) opts.push({ c: t.def.levels[t.lvl + 1].cost, f: () => g.upgrade(i) });
            else for (const a of t.def.abilities || []) { const r = (t.ab && t.ab[a.id]) || 0; if (r < a.ranks.length && (!t.spec || t.spec === a.id)) opts.push({ c: a.ranks[r].cost * 1.2, f: () => g.buy(t, a.id) }); }
          }
          if (G.castle.lvl < CASTLE.levels.length - 1 && G.towers.length >= 5) opts.push({ c: CASTLE.levels[G.castle.lvl + 1].cost * 1.4, f: () => g.upgradeCastle() });
          opts.sort((a, b) => a.c - b.c); const o = opts[0];
          if (!o || !o.f()) break;
        }
        const live = G.enemies.filter(e => !e.dead && !e.under);
        const ground = live.filter(e => !e.def.flying);
        const ready = (id) => G.spells[id] != null && G.spells[id] <= 0;
        // duvar: kaleye yaklaşan (yolun %55'ini geçmiş) durdurulamayan / hızlı düşmanın önüne
        if (ready('nm_wall')) { const run = ground.filter(e => (e.def.noblock || e.def.speed >= 30) && e.p && e.d / e.p.total > 0.55).sort((a, b) => b.d - a.d)[0];
          if (run) { const q = at(run.p, Math.min(run.p.total - 10, run.d + 45)); cast('nm_wall', q.x, q.y); } }
        if (ready('nm_fear')) { const [e, n] = dens(ground.filter(e => e.p && e.d / e.p.total > 0.35), 60); if (e && n >= 5) { cast('nm_fear', e.x, e.y); } }
        const corpses = G.effects.filter(f => f.kind === 'corpse' && f.raisable);
        if (ready('nm_raise') && corpses.length >= 3) cast('nm_raise'); // 13 Eki: diriltme hedefsiz (sahadaki bütün cesetler)
        if (ready('nm_burst')) { const [c, n] = dens(corpses, 100); if (c && n >= 3 && ground.some(e => Math.hypot(e.x - c.x, e.y - c.y) < 110)) { cast('nm_burst', c.x, c.y); } }
        if (ready('nm_golem')) { const [c, n] = dens(corpses, 100); if (c && n >= 3) { cast('nm_golem', c.x, c.y); } }
        if (ready('ult0')) { const [e, n] = dens(live, 60); if (e && n >= 4) { cast('ult0', e.x, e.y); } }
        // sızanlar: bir önceki adımda yolun sonuna yakın olup bu adımda yok olanlar
        const now = new Set(G.enemies.filter(e => !e.dead));
        for (const [e, rem] of alive) if (!now.has(e) && (e.leaked || rem < 40)) leaks[e.type] = (leaks[e.type] || 0) + 1;
        alive.clear(); for (const e of now) if (e.p) alive.set(e, e.p.total - e.d);
        g.sim(0.5); time += 0.5;
      }
      const stuck = g.overlay ? null : G.enemies.filter(e => !e.dead).slice(0, 6).map(e => ({ t: e.type, d: e.p ? Math.round(e.d) + '/' + Math.round(e.p.total) : '-', x: Math.round(e.x), y: Math.round(e.y), under: !!e.under, blk: !!e.blocker, st: e.siege, hp: Math.round(e.hp) }));
      return { lvl, name: G.lv.name, result: g.overlay, stuck, spawners: G.spawners.length, cd: G.waveCountdown, lives: G.lives, wave: G.wave + '/' + G.lv.waves.length, t: Math.round(time), gold: G.gold, towers: G.towers.map(t => t.type[0] + t.lvl).join(''), casts, used, leaks };
    }, { lvl, team, STARS });
    console.log(JSON.stringify(r));
  }
  if (errs.length) console.log('HATALAR', JSON.stringify([...new Set(errs)].slice(0, 20)));
  await b.close();
})();

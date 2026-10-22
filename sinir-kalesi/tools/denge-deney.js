// Denge deneyi (16 Eki, Caner: "kuleleri ekstrem teste sok, en güçlü/güçsüz kuleyi bul"): denge-botu2'nin strateji seçmeli hâli.
//   node tools/denge-deney.js <bölümler> <strateji> [komutan] [yıldız]   strateji: mix | mono:<tür> | iki:<tür> (2 tam kule + gerisi mahzen)
// Denge botu 2 (15 Eki): gerçekçi oyuncu gibi oynar, bölüm başına sonuç + kaleye sızan düşman türlerini yazar.
//   node tools/denge-botu2.js 0-39 [commander] [yildiz=3]
// Oyuncu modeli: önceki bölümlerin hepsinden `yildiz` yıldız (gelişmeler açgözlü alınır), büyü XP'si bölüm sırasıyla artar
// (Büyü Kitabı puanları harcanır), komutan seviyesi bölümle artar (yetenek puanları harcanır).
// Strateji: kule yerleri yolu en çok gördükleri sıraya göre; karışık kule; en ucuz geliştirme; okçu yolu sırayla bow/xbow;
// büyüler: duvar kaleye yaklaşan durdurulamayanların (noblock/hızlı) önüne, korku kalabalığa, diriltme/patlatma/golem ceset kümesine.
const { chromium } = require('playwright');
// 20 Eki: komutan 'yok' = komutansız; NOSPELL=1 Mortimer büyüleri yok; NORAISE=1 yalnız diriltme yok; çıktıda dmg (kaynak) ve mx (tür|zırh sınıfı) hasar toplamları
const arg = process.argv[2] || '0-39', STRAT = process.argv[3] || 'mix', team = (process.argv[4] || 'leonidas').split(',').filter(t => t !== 'yok'), STARS = +(process.argv[5] || 3), NOSPELL = !!process.env.NOSPELL, NORAISE = !!process.env.NORAISE;
const LOADOUT = process.env.LOADOUT ? process.env.LOADOUT.split(',') : null; // 22 Eki: götürülen büyüler (ör. LOADOUT=nm_raise,nm_wall)
const lvls = arg.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(arg.split('-').map(Number)) : arg.split(',').map(Number);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (process.env.WK1) await p.addInitScript(() => { window.__WK1 = true; }); // 20 Eki: eski karşıtlık tablosu (karşılaştırma; data.js WK_V2)
  if (process.env.BALX) await p.addInitScript((j) => { window.__BALX = JSON.parse(j); }, process.env.BALX); // 22 Eki: {hp: HERO_POWER, tw: kule hasar çarpanı}
  if (process.env.HPX) await p.addInitScript((k) => { window.__HPX = k; }, +process.env.HPX);
  await p.goto('http://localhost:8765/index.html?' + Date.now(), { timeout: 180000 }); await p.waitForFunction(() => window.__game && window.__game.G !== undefined, null, { timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(1500);
  for (const lvl of lvls) {
    const r = await p.evaluate(({ lvl, team, STARS, STRAT, NOSPELL, NORAISE, LOADOUT }) => {
      const g = window.__game, S = g.save();
      // --- oyuncu ilerlemesi ---
      const TM = team.length ? team : ['leonidas']; // komutansız: kayıt için bir komutan kurulur, bölüm başında sahadan kaldırılır
      S.stars = Array.from({ length: lvl }, () => STARS); S.team = TM; S.heroBuy = [...new Set((S.heroBuy || []).concat(TM))]; /* 18 Eki: kristalle açılan komutan (LOCK_TEST) bot için açık */ S.upg = {}; S.grim = {}; S.sxp = {}; S.tutDone = 1; S.tut3 = { 0: 1, 1: 1, 2: 1 }; S.comics = S.comics || {};
      let free = S.stars.reduce((a, b) => a + b, 0), bought = true;
      while (bought) { bought = false; for (const u of UPGRADES) { const r = S.upg[u.id] || 0; if (r < u.ranks.length && u.ranks[r].cost <= free) { free -= u.ranks[r].cost; S.upg[u.id] = r + 1; bought = true; } } }
      for (const id of ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem']) { S.sxp[id] = 85 * lvl; for (let k = 0; k < 5; k++) g.grimBuy(id); }
      if (LOADOUT) S.loadout = LOADOUT;
      S.hero = {}; for (const id of TM) S.hero[id] = { lvl: Math.min(10, 1 + Math.floor(lvl / 2)), xp: 0, sk: {}, ult: 1 };
      g.startLevel(lvl); const G = g.G; if (!team.length) { G.soldiers = G.soldiers.filter(s => !s.hero); G.heroes.length = 0; } /* 20 Eki: gerçekten komutansız (boş takım ilk açık komutana düşüyordu) */ window.__dmgAcc = { by: {}, mx: {} }; if (g.overlay === 'comic') g.setOverlay(null);
      // komutan puanları
      if (G.heroes[0]) for (let k = 0; k < 12; k++) { g.learn(0, 'ult'); for (const pth of G.heroes[0].def.paths) for (const sk of pth.skills) g.learn(0, sk.id); }
      // --- yol örnekleri ve kule yeri sırası ---
      const ptsAll = []; for (const P of G.paths) for (let d = 0; d < P.total; d += 18) { const q = at(P, d); q.k = d / P.total; ptsAll.push(q); }
      function at(P, d) { const c = P.cum, pt = P.pts; let i = 1; while (i < c.length - 1 && c[i] < d) i++; const t = (d - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]); return { x: pt[i - 1][0] + (pt[i][0] - pt[i - 1][0]) * t, y: pt[i - 1][1] + (pt[i][1] - pt[i - 1][1]) * t }; } // yol noktaları [x, y]
      const cover = (pl, R) => ptsAll.filter(q => Math.hypot(q.x - pl.x, q.y - pl.y) < R).length;
      const order = G.plots.map((pl, i) => ({ i, c: cover(pl, 140) })).sort((a, b) => b.c - a.c).map(o => o.i);
      const flyN = G.lv.waves.reduce((a, w) => a + (w.groups || w).reduce ? (w.groups || w).reduce((s, gr) => s + (((ENEMIES[gr.t || gr.type || gr[0]] || {}).flying) ? 1 : 0), 0) : 0, 0);
      const [SK, ST] = STRAT.split(':');
      let plan = ['barracks', 'archer', 'mage', 'artillery', 'altar', 'archer', 'mage', 'barracks', 'artillery', 'archer', 'altar', 'mage', 'archer', 'barracks', 'mage', 'artillery'].filter(t => g.towerOn(t)); // öğretici bölümde yalnız açık kuleler
      if (SK === 'mono') plan = g.towerOn(ST) ? [ST] : plan;
      if (SK === 'iki') plan = (g.towerOn(ST) ? [ST, ST] : []).concat(Array(20).fill('barracks'));
      const specAlt = {}; let spent = 0;
      const leaks = {}, alive = new Map(); let time = 0, casts = 0, xbow = 0;
      const cast = (id, x, y) => { if (NOSPELL && id.startsWith('nm_')) return; if (NORAISE && id === 'nm_raise') return; g.cast(id, x, y); if (G.spells[id] > 0) { casts++; used[id] = (used[id] || 0) + 1; } }, used = {};
      g.wave();
      const dens = (list, r) => { let best = null, bn = 0; for (const e of list) { const n = list.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < r).length; if (n > bn) { bn = n; best = e; } } return [best, bn]; };
      while (!g.overlay && time < 2400) {
        // harcama
        for (let guard = 0; guard < 8; guard++) {
          const opts = [];
          const fi = order.find(i => !G.plots[i].tower);
          if (fi != null && (SK !== 'iki' || G.towers.length < 2 || G.towers.filter(t => t.type === ST).every(t => t.spec && ((t.ab && t.ab[t.spec]) || 0) >= 3) || G.wave >= 4)) { const t = SK === 'iki' ? plan[Math.min(G.towers.length, plan.length - 1)] : plan[G.towers.length % plan.length]; opts.push({ c: (g.buildCost ? g.buildCost(t) : TOWERS[t].levels[0].cost) * (SK === 'iki' && G.towers.length < 2 ? 0.5 : 1.3), f: () => g.build(fi, t) }); }
          for (const i of order) { const t = G.plots[i].tower; if (!t) continue;
            if (t.type === 'archer' && NECRO && !t.path && t.lvl === 0) { const pp = (xbow++ % 2) ? 'xbow' : 'bow'; opts.push({ c: 140, f: () => g.path(i, pp) }); continue; }
            if (t.lvl < t.def.levels.length - 1) opts.push({ c: (g.upCost ? g.upCost(t) : t.def.levels[t.lvl + 1].cost) * (SK === 'iki' && t.type === ST ? 0.4 : 1), f: () => g.upgrade(i) });
            else { const abs = t.def.abilities || [], pick = t.spec || abs[(specAlt[t.type] = (specAlt[t.type] || 0) + (t.spec ? 0 : 1)) % abs.length].id; // uzmanlık sırayla
              for (const a of abs) { if (a.id !== pick) continue; const r = (t.ab && t.ab[a.id]) || 0; if (r < a.ranks.length) opts.push({ c: a.ranks[r].cost * 1.2 * (SK === 'iki' && t.type === ST ? 0.4 : 1), f: () => g.buy(t, a.id) }); } }
          }
          if (G.castle.lvl < CASTLE.levels.length - 1 && G.towers.length >= 5) opts.push({ c: CASTLE.levels[G.castle.lvl + 1].cost * 1.4, f: () => g.upgradeCastle() });
          opts.sort((a, b) => a.c - b.c); const g0 = G.gold; // 18 Eki: alınamayan seçenek (kilitli/yanlış yol) harcamayı durdurmasın, sıradakine geç
          let ok = false; for (const o of opts) { if (o.c > G.gold * 1.5) break; if (o.f()) { ok = true; break; } }
          if (!ok) break; spent += Math.max(0, g0 - G.gold);
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
        if (G.heroes.length && ready('ult0')) { const [e, n] = dens(live, 60); if (e && n >= 4) { cast('ult0', e.x, e.y); } }
        // sızanlar: bir önceki adımda yolun sonuna yakın olup bu adımda yok olanlar
        const now = new Set(G.enemies.filter(e => !e.dead));
        for (const [e, rem] of alive) if (!now.has(e) && (e.leaked || rem < 40)) leaks[e.type] = (leaks[e.type] || 0) + 1;
        alive.clear(); for (const e of now) if (e.p) alive.set(e, e.p.total - e.d);
        g.sim(0.5); time += 0.5;
      }
      const stuck = g.overlay ? null : G.enemies.filter(e => !e.dead).sort((a, b) => b.d - a.d).slice(0, 6).map(e => ({ t: e.type, d: e.p ? Math.round(e.d) + '/' + Math.round(e.p.total) : '-', x: Math.round(e.x), y: Math.round(e.y), under: !!e.under, blk: !!e.blocker, st: e.siege, hp: Math.round(e.hp), fear: +(e.fearT || 0).toFixed(1), stun: +(e.stun || 0).toFixed(1), spd: +(e.curSpd || 0).toFixed(1), slow: +(e.slowT || 0).toFixed(1), n: G.enemies.filter(o => !o.dead).length }));
      return { lvl, name: G.lv.name, result: g.overlay, stuck, spawners: G.spawners.length, cd: G.waveCountdown, lives: G.lives, wave: G.wave + '/' + G.lv.waves.length, t: Math.round(time), gold: G.gold, strat: STRAT, spent, by: G.stats && G.stats.by, towers: G.towers.map(t => t.type.slice(0, 3) + t.lvl).join(''), casts, used, leaks, heroes: G.heroes.map(h => h.id), dmg: Object.fromEntries(Object.entries(window.__dmgAcc.by).map(([k, v]) => [k, Math.round(v)])), mx: Object.fromEntries(Object.entries(window.__dmgAcc.mx).map(([k, v]) => [k, Math.round(v)])) };
    }, { lvl, team, STARS, STRAT, NOSPELL, NORAISE, LOADOUT });
    console.log(JSON.stringify(r));
  }
  if (errs.length) console.log('HATALAR', JSON.stringify([...new Set(errs)].slice(0, 20)));
  await b.close();
})();

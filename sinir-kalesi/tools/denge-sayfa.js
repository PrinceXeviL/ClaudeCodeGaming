// Sayfa içi denge botu (Playwright gerekmez): oyun açıkken konsolda/tarayıcı aracıyla çalıştırılır.
//   __bot(i)            -> i. bölümü (0'dan) botla oynar: { lvl, result: 'win'|'lose', lives, wave, n, t }
//   __measure(a, b, k)  -> a..b-1 bölümlerini k kez oynatır, ortalama puan (kazanınca kalan can, kaybedince eksi)
//   __tune2(a, b)       -> puanı hedefe (__T) göre hpMul'u sönümlü adımla ayarlar (sonuç data.js HPMUL'a elle yazılır)
// 11 Eki: kalıcı gelişim. Bölüme o noktaya kadar normal oynamış oyuncunun komutan seviyesi ve Büyü Kitabı kademeleriyle girilir
// (__prog). XP: önceki bölümlerin düşman altını (komutan hepsini öldürmez: %60) + bölüm sonu XP'si; ruh taşı: bölüm başına ~2,6.
window.__progOf = function (lvl) {
  let xp = 0; for (let j = 0; j < lvl; j++) { let s = 0; for (const w of LEVELS[j].waves) for (const gr of w) for (const t of gr.types || Array(gr.n).fill(gr.t)) s += (ENEMIES[t] || {}).gold || 0; xp += s * 0.6 + 100 + 40 * j; }
  let L = 1; while (L < HERO_MAX && xp >= 80 * L * L) { xp -= 80 * L * L; L++; }
  return { lvl: L, souls: Math.floor(2.6 * lvl) };
};
window.__prog = function (lvl, off) {
  const save = window.__game.save(); const P = off ? { lvl: 1, souls: 0 } : window.__progOf(lvl);
  const id = (save.team || ['commander'])[0], R = { lvl: P.lvl, xp: 0, sk: {}, ult: 1 }, sks = HEROES[id].paths.flatMap(p => p.skills).map(s => s.id);
  for (let pts = P.lvl, guard = 0; pts > 0 && guard < 60; guard++) { // puanlar sırayla: yetenekler ve güç, açıldıkça
    const opts = sks.map(k => ['sk', k]).concat([['ult', 'ult']]).filter(([kind, k]) => { const T = kind === 'ult' ? HERO_TREE.ult : HERO_TREE.sk, r = kind === 'ult' ? R.ult : R.sk[k] || 0; return r + 1 < T.length && P.lvl >= T[r + 1]; });
    if (!opts.length) break; opts.sort((a, b) => (a[0] === 'ult' ? R.ult - 1 : R.sk[a[1]] || 0) - (b[0] === 'ult' ? R.ult - 1 : R.sk[b[1]] || 0));
    const [kind, k] = opts[0]; if (kind === 'ult') R.ult++; else R.sk[k] = (R.sk[k] || 0) + 1; pts--;
  }
  save.hero = { [id]: R };
  const ids = ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem'].filter(k => { const u = NECRO_SPELLS[k].unlock; return u == null || u < lvl; });
  save.grim = {}; let left = P.souls;
  for (let guard = 0; guard < 40 && ids.length; guard++) { const k = ids.slice().sort((a, b) => (save.grim[a] || 0) - (save.grim[b] || 0))[0], r = save.grim[k] || 0; if (r >= 5 || GRIM.cost[r] > left) break; left -= GRIM.cost[r]; save.grim[k] = r + 1; }
  return { hero: R.lvl, grim: Object.assign({}, save.grim) };
};
window.__bot = function (lvl, off) {
  window.__prog(lvl, off);
  const g = window.__game; g.startLevel(lvl); const G = g.G; if (g.overlay) g.setOverlay(null);
  const order = ['archer', 'barracks', 'mage', 'archer', 'artillery', 'mage', 'barracks', 'archer', 'artillery', 'mage', 'archer', 'barracks', 'mage'];
  let time = 0; g.wave();
  const dens = () => { let best = null, bn = 0; for (const e of G.enemies) { if (e.dead || e.def.flying) continue; const n = G.enemies.filter(o => !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 55).length; if (n > bn) { bn = n; best = e; } } return [best, bn]; };
  while (time < 1500) {
    const ov = g.overlay; if (ov === 'win' || ov === 'lose') break; if (ov) g.setOverlay(null);
    { const h = G.heroes[0]; if (h) for (let q = 0; q < 3; q++) { // savaşta kazanılan puan: en düşük kademeli açık yetenek
      const R = window.__game.save().hero[h.id], ids = HEROES[h.id].paths.flatMap(p => p.skills).map(s => s.id).concat(['ult']);
      ids.sort((a, b) => (a === 'ult' ? R.ult - 1 : R.sk[a] || 0) - (b === 'ult' ? R.ult - 1 : R.sk[b] || 0));
      if (!ids.some(id => g.learn(0, id))) break; } }
    for (let guard = 0; guard < 6; guard++) {
      // yolu neredeyse hiç görmeyen arsa atlanır (oyuncu oraya kurmaz); 110 px içinde en az 20 yol noktası
      const cov = (p) => p._cov ?? (p._cov = G.paths.reduce((a, P) => a + P.pts.filter(q => Math.hypot((q.x ?? q[0]) - p.x, (q.y ?? q[1]) - p.y) < 110).length, 0));
      const opts = []; let free = G.plots.findIndex(p => !p.tower && cov(p) >= 20); if (free < 0) free = G.plots.findIndex(p => !p.tower);
      if (free >= 0) { const t = order[G.towers.length % order.length]; opts.push({ c: { archer: 70, barracks: 70, mage: 100, artillery: 125 }[t] * 1.6, f: () => g.build(free, t) }); }
      for (let i = 0; i < G.plots.length; i++) { const t = G.plots[i].tower; if (t && t.lvl < 2) opts.push({ c: t.def.levels[t.lvl + 1].cost, f: () => (t.type === 'archer' && t.lvl === 0 && g.path ? g.path(i, i % 2 ? 'bow' : 'xbow') : g.upgrade(i)) }); } // Kemik Kulesi: arsalara göre okçu/arbaletçi yolu
      if (free < 0) for (const t of G.towers) if (t.lvl === 2) for (const a of (t.def.abilities || [])) { const r = (t.ab && t.ab[a.id]) || 0; if (r < 3 && a.ranks && a.ranks[r]) opts.push({ c: a.ranks[r].cost, f: () => g.buy(t, a.id) }); }
      // yeni sistemler (10 Eki): şapel devi, 4. kademe ikinci güç, büyü geliştirme (oyuncu bunları da alır)
      if (free < 0) {
        if (G.castle.lvl < 2) opts.push({ c: [0, 200, 300][G.castle.lvl + 1] * 1.2, f: () => g.upgradeCastle() });
        for (const t of G.towers) { const pi = G.plots.indexOf(t.plot); if (g.imbue && t.spec && !t.imbue && (t.type === 'archer' || t.type === 'barracks') && ((t.ab && t.ab[t.spec]) || 0) >= 3) opts.push({ c: 220, f: () => g.imbue(pi, IMBUE_ORDER[pi % IMBUE_ORDER.length]) }); } // silah büyüsü
        for (const t of G.towers) { const E = t.spec && TOWER_EXTRA[t.spec]; if (E && !t.extra) opts.push({ c: E.cost, f: () => (G.gold >= E.cost ? (G.gold -= E.cost, t.extra = true, t.exT = 1.5, true) : false) }); }
      }
      opts.sort((a, b) => a.c - b.c); const o = opts[0]; if (!o || !o.f()) break;
    }
    for (const id of ['ult0']) if (G.spells[id] != null && G.spells[id] <= 0) { const [e, n] = dens(); if (e && n >= 4) g.cast(id, e.x, e.y); }
    if (G.spells.nm_fear != null && G.spells.nm_fear <= 0) { const [e, n] = dens(); if (e && n >= 5) g.cast('nm_fear', e.x, e.y); }
    // kemik duvar: kaleye en yakın düşmanın önüne; patlama (15. bölüm kazanılınca açılır): en kalabalık kümeye
    if (G.spells.nm_wall != null && G.spells.nm_wall <= 0) { const c = G.castle, lead = G.enemies.filter(e => !e.dead && !e.def.flying).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]; if (lead && Math.hypot(lead.x - c.x, lead.y - c.y) < 380) g.cast('nm_wall', lead.x, lead.y); }
    if (lvl >= 15 && G.spells.nm_burst != null && G.spells.nm_burst <= 0) { const [e, n] = dens(); if (e && n >= 4) g.cast('nm_burst', e.x, e.y); }
    if (G.spells.nm_raise != null && G.spells.nm_raise <= 0 && G.effects.filter(f => f.kind === 'corpse' && f.raisable).length >= 3) g.cast('nm_raise', 0, 0);
    g.sim(0.5); time += 0.5;
  }
  return { lvl: lvl + 1, result: g.overlay, lives: G.lives, wave: G.wave, n: G.lv.waves.length, t: Math.round(time) };
};
window.__score = (r) => r.result === 'win' ? r.lives : -(r.n - r.wave + 1) * 3;
window.__T = [19, 18, 18, 17, 16, 16, 15, 15, 14, 13, 13, 12, 11, 11, 10, 10, 9, 8, 8, 7, // hedef: kalan can (1. bölüm kolay, 20. zor)
  13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4]; // 2. sefer (15 canla başlar): daha zor
window.__measure = function (from, to, k = 2) {
  const res = []; for (let i = from; i < to; i++) { let s = 0; for (let j = 0; j < k; j++) s += window.__score(window.__bot(i)); res.push((i + 1) + ':' + (s / k).toFixed(1) + '/' + window.__T[i]); } return res.join(' ');
};
window.__tune2 = function (from, to, k = 3) {
  const res = []; for (let i = from; i < to; i++) {
    let s = 0; for (let j = 0; j < k; j++) s += window.__score(window.__bot(i));
    const avg = s / k, d = avg - window.__T[i], lv = LEVELS[i], f = lv.hpMul || 1; let nf = f;
    if (d > 1.5) nf = f * (1 + Math.min(0.12, d * 0.012)); else if (d < -1.5) nf = f * (1 - Math.min(0.15, -d * 0.015));
    lv.hpMul = +Math.min(i < 3 ? 1.3 : 2.5, nf).toFixed(3); res.push((i + 1) + ':' + avg.toFixed(1) + '→' + lv.hpMul);
  } return res.join(' ');
};

// Oyun içi özellik taraması (21 Eki): her komutanla bir bölüm; bütün kule/uzmanlık/yetenek/ikinci güç/+1/büyü işleme/hedef,
// Mortimer büyüleri, komutan gücü (ult, ult2), eşyalar, yıkıl-yeniden kur, sat; dalgalar; zafer ve yenilgi ekranı.
// Her adımda sayfa hatası ve NaN konum/can denetimi.
const { chromium } = require('/Users/caner/Documents/Game Lab/kod/ClaudeCodeGaming/node_modules/playwright');
const LV = +(process.argv[2] || 12);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 640 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(6000);
  const rapor = {};
  for (const hero of ['leonidas', 'merlin', 'robin', 'bathory']) {
    errs.length = 0;
    const r = await p.evaluate(async ([hero, LV]) => {
      const g = window.__game, S = g.save(), log = [], bad = [];
      S.statsAsked = 1; S.tdAsked = 1; S.cine = { intro: 1, oyun: 1, kahve: 1 }; S.stars = Array.from({ length: 40 }, () => 3);
      S.team = [hero]; S.heroBuy = ['leonidas', 'merlin', 'robin', 'bathory']; S.hero = S.hero || {}; S.hero[hero] = { lvl: 20, xp: 0, sk: {}, ult: 5, ult2: 5, act: 'ult', v2: 1, v3: 1, v4: 1, v5: 1, v6: 1 };
      S.sxp = S.sxp || {}; S.grim = S.grim || {}; for (const id of ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem']) { S.sxp[id] = 9999; for (let k = 0; k < 5; k++) g.grimBuy(id); }
      S.items = {}; for (const k of Object.keys(ITEMS).filter(k => ITEMS[k] && ITEMS[k].name)) S.items[k] = 3;
      g.startLevel(LV); await new Promise(r => setTimeout(r, 5000));
      const G = g.G; G.gold = 1e6; G.lives = 999;
      const nan = (tag) => { for (const L of [G.enemies, G.soldiers, G.towers, G.projectiles]) for (const o of L) if ((typeof o.x === 'number' && !Number.isFinite(o.x)) || (typeof o.y === 'number' && !Number.isFinite(o.y)) || (L === G.projectiles && ['sx', 'tx'].some(k => typeof o[k] === 'number' && !Number.isFinite(o[k]))) || ('hp' in o && Number.isNaN(o.hp))) { bad.push(tag + ': NaN ' + (o.type || o.kind || (o.tower ? 'asker' : '?'))); return; } };
      const step = (tag, fn) => { try { const v = fn(); g.sim(0.4); nan(tag); return v; } catch (e) { bad.push(tag + ' HATA ' + e.message); } };
      // kule planı: 11 uzmanlık
      const plan = [['archer', 'path', 'bow'], ['archer', 'path', 'fan'], ['barracks', 'ab', 'shield'], ['barracks', 'ab', 'blade'], ['barracks', 'ab', 'golem'],
        ['mage', 'ab', 'drain'], ['mage', 'ab', 'ghost'], ['artillery', 'ab', 'corpse'], ['artillery', 'ab', 'plague'], ['altar', 'ab', 'rite'], ['altar', 'ab', 'blight']];
      const nP = G.plots.length; log.push('arsa ' + nP);
      const IMB = typeof IMBUE_ORDER !== 'undefined' ? IMBUE_ORDER : [];
      plan.forEach(([type, kind, sp], i) => {
        if (i >= nP) { bad.push('arsa yetmedi: ' + sp); return; }
        if (type === 'altar' && G.towers.some(t => t.type === 'altar')) { const o = G.plots.findIndex(pl => pl.tower && pl.tower.type === 'altar'); step('sat lanet', () => g.sell(o)); }
        step(sp + ' kur', () => g.build(i, type));
        const t = G.plots[i].tower; if (!t) { bad.push(sp + ': kurulmadı'); return; }
        if (kind === 'path') { step(sp + ' yol', () => g.path(i, sp === 'fan' ? 'xbow' : sp)); step(sp + ' yük2', () => g.upgrade(i)); step(sp + ' yük3', () => g.upgrade(i)); }
        else { step(sp + ' yük2', () => g.upgrade(i)); step(sp + ' yük3', () => g.upgrade(i)); }
        for (let k = 0; k < 3; k++) step(sp + ' uzm' + (k + 1), () => g.ability(i, sp));
        if (t.spec !== sp && !(t.path && ARCHER_PATH[t.path].spec === t.spec)) bad.push(sp + ': uzmanlık tutmadı (' + t.spec + ')');
        for (let k = 0; k < 3; k++) step(sp + ' ikinci güç ' + (k + 1), () => g.extra(i));
        step(sp + ' +1', () => g.buyMore(i));
        if (IMB.length && (type === 'archer' || type === 'barracks')) step(sp + ' büyü ' + IMB[i % IMB.length], () => g.imbue(i, IMB[i % IMB.length]));
        for (let k = 0; k < 4; k++) step(sp + ' hedef', () => { t.prio = ['first', 'last', 'strong', 'fly'][k]; });
        log.push(sp + ': kademe ' + (t.lvl + 1) + ', uzm ' + ((t.ab && t.ab[sp]) || 0) + ', ikinci ' + (t.extra || 0) + ', +1 ' + !!t.more + (t.imbue ? ', ' + t.imbue : ''));
      });
      function buyExtraT(t) { const before = t.extra || 0; const fn = window.__game.extra || null; if (typeof buyExtra === 'function') return buyExtra(t); return before; }
      // dalgalar
      for (let w = 0; w < 4; w++) { step('dalga ' + (w + 1), () => g.wave()); for (let k = 0; k < 20; k++) { g.sim(0.5); nan('dalga'); } }
      // büyüler ve komutan güçleri, eşyalar: kalabalığın üstüne
      const tgt = () => { const e = G.enemies.filter(e => !e.dead)[0]; return e ? [e.x, e.y] : [480, 270]; };
      for (const id of ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem']) { const [x, y] = tgt(); step('büyü ' + id, () => { G.spellCd = {}; if (G.cds) G.cds = {}; return g.cast(id, x, y); }); g.sim(1.5); }
      { const h = G.heroes && G.heroes[0]; if (!h) bad.push('komutan yok'); else { const [x, y] = tgt(); step('ult', () => { h.ultCd = 0; return g.ult(x, y); }); g.sim(2); step('ult2', () => { h.act = 'ult2'; h.ultCd = 0; return g.ult(x, y); }); g.sim(2); for (let k = 0; k < 20; k++) { g.sim(0.5); nan('komutan'); } log.push('eşyalar kaldı: ' + Object.keys(S.items).map(k => k + '=' + S.items[k]).join(' ')); log.push('komutan ' + hero + ' sv' + h.lvl + ' can ' + Math.round(h.hp)); } }
      for (const id of Object.keys(S.items)) { const [x, y] = tgt(); step('eşya ' + id, () => g.useItem(id, x, y)); }
      function useItemT(id, x, y) { if (typeof useItem === 'function') return useItem(id, x, y); }
      // yıkıl, yeniden kur, sat
      step('yıkıl', () => g.collapse(0)); g.sim(4); step('yeniden kur', () => g.rebuild(0)); g.sim(6); log.push('yeniden kuruldu: ' + !!(G.plots[0].tower));
      step('sat', () => g.sell(1)); log.push('satıldı: ' + !G.plots[1].tower);
      step('zone', () => g.zfire && G.zitem && g.zfire());
      // bölümü bitir: kalan dalgalar
      let guard = 0; while (!g.sim(0.5) && guard++ < 2400) { if (guard % 20 === 0) g.wave(); nan('son'); }
      const ov = g.sim(0); log.push('sonuç ' + JSON.stringify(ov && (ov.kind || ov)) + ' t=' + Math.round(G.t) + ' can=' + G.lives);
      return { log, bad };
    }, [hero, LV]);
    r.errs = errs.slice(0, 5); rapor[hero] = r;
    await p.screenshot({ path: `/private/tmp/claude-501/-Users-caner-Documents-Game-Lab/2fc5a378-d4a7-46bc-ac43-ea175627ec8e/scratchpad/test/son_${hero}.png` });
  }
  console.log(JSON.stringify(rapor, null, 1)); await b.close();
})();

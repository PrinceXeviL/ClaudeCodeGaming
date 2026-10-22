// Fragman kaydı (22 Eki): oyun karelerini dışarıdan sürerek (__game.recStep) 30 kare/sn, 1920x1080 kaydeder; arayüz gizli (__CLEAN).
// Her sahne ayrı klasöre: <çıkış>/<sahne>/0000.jpg ... + ses.json (oyunun çaldığı sesler, sahne başından saniye).
//   node tools/fragman-kayit.js <çıkış dizini> [sahne ...]     (sunucu 8765'te açık olmalı)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2], ONLY = process.argv.slice(3), FPS = 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// sahneler: kur (gerçek zamanla), kamera, süre (sn); her karede isteğe bağlı adım (oyun zamanı t ile)
const SCENES = {
  // 1) balkonda kahvesini içen Mortimer (yakın)
  balkon: { lvl: 26, dur: 4.5, setup: `G.lives = 20;`, cam: `const m = g.mortPt(); return [7.4, m.x + 4, m.y - m.h * 0.55];` },
  // 2) yolda yürüyen Solarian ordusu
  ordu: { lvl: 9, dur: 4, team: ['leonidas'], setup: `
      for (let i = 0; i < 26; i++) g.spawn(['legion', 'legion', 'heavy', 'legion_k', 'cavalry', 'eagle'][i % 6], 0), g.sim(0.32);
      g.sim(2);`, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.32); return [1.9, q.x, q.y - 10];`, follow: true },
  // 3) Mortimer büyü yapar (yakın)
  buyu: { lvl: 26, dur: 6.5, setup: `G.mortCastN = null; G.mortSlam = false; G.mortCast = G.mortCastT = 184 / 24;`, cam: `const m = g.mortPt(); return [6.2, m.x, m.y - m.h * 1.0];` },
  // 4) kuleler savaşıyor (orta bölüm, tam geliştirilmiş kuleler, kalabalık)
  kuleler: { lvl: 22, dur: 8, team: ['leonidas'], towers: true, setup: `
      for (let i = 0; i < 26; i++) window.__near(['legion', 'heavy', 'legion_k', 'priest', 'gladiator', 'testudo', 'cavalry'][i % 7], i * 6);
      g.sim(1.5);`, cam: `return [1.5, TP.x - 80, TP.y - 20];`, spawnEvery: 0.45 },
  // 5) diriltme: cesetlerin üstüne Ölüleri Diriltme (geniş)
  dirilt: { lvl: 22, dur: 5, team: ['leonidas'], towers: true, setup: `
      for (let i = 0; i < 30; i++) { const e = window.__near(['legion', 'legion_k', 'heavy', 'priest'][i % 4], i * 3); if (e) { e.hp /= 3; e.maxHp /= 3; } }
      g.sim(7);`, cam: `return [1.6, TP.x - 80, TP.y - 20];`, at: [[0.4, `const b = G.effects.filter(f => f.kind === 'corpse'); const q = b.length ? b[Math.floor(b.length / 2)] : TC; G.spells.nm_raise = 0; g.cast('nm_raise', q.x, q.y);`]] },
  // 6) Mortimer havada (diriltme, yakın)
  ucus: { lvl: 26, dur: 6, setup: `G.mortCastN = 'mortimer_dirilt'; G.mortCast = G.mortCastT = 208 / 24; G.mortFlash = false;`, cam: `const m = g.mortPt(); return [5.2, m.x, m.y - m.h * 1.5];` },
  // 7) komutanın anlık gücü: Merlin'in meteor yağmuru kalabalığa
  meteor: { lvl: 9, dur: 4.5, team: ['merlin'], setup: `
      for (let i = 0; i < 30; i++) g.spawn(['legion', 'legion', 'heavy', 'legion_k', 'cavalry'][i % 5], 0), g.sim(0.3);
      g.sim(1.5); G.heroes.forEach(h => { h.x = -200; h.y = -200; });`, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [1.8, q.x, q.y - 10];`, follow: true,
    at: [[0.4, `const C = window.__recCam, e = G.enemies.filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - C.x, a.y - C.y) - Math.hypot(b.x - C.x, b.y - C.y)); const m = e[0] || C; G.spells.ult0 = 0; g.cast('ult0', m.x + 20, m.y); console.log('ult', G.heroes.map(h => h.id).join(','), G.projectiles.filter(p => p.kind === 'meteor').length);`]] },
  // 8) boss: General Gloriosus iskeletlere karşı
  boss: { lvl: 14, dur: 5, team: ['leonidas'], towers: true, setup: `
      g.spawn('gloriosus', 0); for (let i = 0; i < 10; i++) g.spawn(['legion', 'heavy'][i % 2], 0), g.sim(0.3);
      g.sim(4);`, cam: `const b = G.enemies.find(e => e.def.chief && !e.dead) || TC; return [2.1, b.x, b.y - 20];`, follow: 'boss' },
};

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.text().startsWith('ult')) console.log(m.text()); });
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await wait(7000);
  await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.cine = { intro: 1, oyun: 1, kahve: 1 }; S.loadout = ['nm_raise', 'nm_fear']; });
  for (const [name, SC] of Object.entries(SCENES)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    await p.evaluate(() => { window.__game.recStop(); window.__CLEAN = false; });
    await p.evaluate(async ({ SC }) => {
      const g = window.__game, S = g.save(); S.team = SC.team || ['leonidas']; S.heroBuy = [...new Set((S.heroBuy || []).concat(S.team))];
      S.hero = S.hero || {}; for (const id of S.team) S.hero[id] = { lvl: 12, xp: 0, sk: {}, ult: 3 };
      g.setOv && g.setOv(null); g.startLevel(SC.lvl); await new Promise((r) => setTimeout(r, 6000));
      const G = g.G; G.gold = 1e6; G.lives = 20; G.tut = null;
      if (SC.towers) { // yolu en çok gören arsalara tam geliştirilmiş, uzmanlaşmış kuleler
        const pts = []; for (const P of G.paths) for (let d = 0; d < P.total; d += 14) pts.push(g.pathPos(P, d));
        const order = G.plots.map((pl, i) => ({ i, n: pts.filter((q) => Math.hypot(q.x - pl.x, q.y - pl.y) < 140).length })).sort((a, b) => b.n - a.n).map((o) => o.i);
        const plan = [['archer', 'bow', 'bow'], ['artillery', null, 'plague'], ['mage', null, 'drain'], ['barracks', null, 'shield'], ['archer', 'xbow', 'fan'], ['altar', null, 'rite'], ['mage', null, 'ghost'], ['artillery', null, 'corpse']];
        plan.forEach(([type, pth, sp], k) => { const i = order[k]; if (i == null) return; g.build(i, type); const t = G.plots[i].tower; if (!t) return; if (pth) g.path(i, pth);
          for (let n = 0; n < 6; n++) g.upgrade(i); if (sp) { for (let n = 0; n < 3; n++) g.ability && g.ability(i, sp); } });
        const used = order.slice(0, 5).map((i) => G.plots[i]); window.TC = { x: used.reduce((a, q) => a + q.x, 0) / used.length, y: used.reduce((a, q) => a + q.y, 0) / used.length };
        const near = pts.filter((q) => used.filter((u) => Math.hypot(q.x - u.x, q.y - u.y) < 150).length >= 3); window.TP = near.length ? { x: near.reduce((a, q) => a + q.x, 0) / near.length, y: near.reduce((a, q) => a + q.y, 0) / near.length } : window.TC;
      } else window.TC = window.TP = { x: G.castle.x, y: G.castle.y };
      window.__near = (t, back = 0) => { const pi = Math.floor(Math.random() * G.paths.length), P = G.paths[pi]; let bd = 1e9, D = 0;
        for (let d = 0; d < P.total; d += 6) { const q = g.pathPos(P, d), k = Math.hypot(q.x - window.TP.x, q.y - window.TP.y); if (k < bd) { bd = k; D = d; } }
        const e = g.spawn(t, pi); const E = e && e.def ? e : G.enemies[G.enemies.length - 1]; if (E) { E.d = Math.max(0, D - 70 - back - Math.random() * 50); E.hp *= 3; E.maxHp *= 3; } return E; };
      g.wave(); new Function('g', 'G', 'TC', SC.setup)(g, G, window.TC);
    }, { SC });
    await wait(2500); // yeni şeritler yüklensin
    await p.evaluate(({ SC }) => {
      const g = window.__game, G = g.G; window.__CLEAN = true; window.__recLog = [];
      const [z, x, y] = new Function('g', 'G', 'TC', 'TP', SC.cam)(g, G, window.TC, window.TP); window.__camC = (z, x, y) => g.camSet(z, Math.max(0, Math.min(960 - 960 / z, x - 480 / z)), Math.max(0, Math.min(540 - 540 / z, y - 270 / z))); window.__camC(z, x, y); window.__recCam = { z, x, y };
      window.__recT0 = g.recStep(1);
    }, { SC });
    const N = Math.round(SC.dur * FPS), at = (SC.at || []).slice();
    let spawnT = 0;
    for (let i = 0; i < N; i++) {
      const t = i / FPS;
      while (at.length && at[0][0] <= t) { const code = at.shift()[1]; await p.evaluate((code) => { const g = window.__game; new Function('g', 'G', 'TC', 'TP', code)(g, g.G, window.TC, window.TP); }, code); }
      if (SC.spawnEvery && t >= spawnT) { spawnT += SC.spawnEvery; await p.evaluate(() => { const g = window.__game, G = g.G; window.__near(['legion', 'heavy', 'legion_k', 'priest', 'cavalry'][Math.floor(Math.random() * 5)], 40); }); }
      await p.evaluate(({ SC }) => { // kamera yavaşça kayar (takip ya da hafif yakınlaşma)
        const g = window.__game, G = g.G, C = window.__recCam;
        if (SC.follow === 'boss') { const b = G.enemies.find((e) => e.def.chief && !e.dead); if (b) { C.x += (b.x - C.x) * 0.06; C.y += (b.y - 20 - C.y) * 0.06; } }
        else if (SC.follow) { const e = G.enemies.filter((e) => !e.dead && e.p === G.paths[0]); if (e.length) { const m = e[Math.floor(e.length / 2)]; C.x += (m.x - C.x) * 0.03; C.y += (m.y - 10 - C.y) * 0.03; } }
        const Z = (C.z = C.z * (1 + 0.0009)); window.__camC(Z, C.x, C.y);
        g.recStep(1000 / 30);
      }, { SC });
      await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    }
    const log = await p.evaluate(() => window.__recLog.map((r) => [+(r[0] - window.__recT0).toFixed(3)].concat(r.slice(1))));
    fs.writeFileSync(path.join(dir, 'ses.json'), JSON.stringify({ fps: FPS, n: N, log }));
    console.log(name, N, 'kare', log.length, 'ses', errs.length ? 'HATA ' + errs.slice(-2).join(' | ') : '');
  }
  await b.close();
})();

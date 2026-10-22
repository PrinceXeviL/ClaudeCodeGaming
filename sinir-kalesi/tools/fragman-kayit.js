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
  balkon: { lvl: 0, dur: 4.5, setup: `G.lives = 20;`, cam: `const c = G.castle; return [4.2, c.x + 58, c.y - 47];` },
  // 2) yolda yürüyen Solarian ordusu
  ordu: { lvl: 9, dur: 4, team: ['leonidas'], setup: `
      for (let i = 0; i < 26; i++) g.spawn(['legion', 'legion', 'heavy', 'legion_k', 'cavalry', 'eagle'][i % 6], 0), g.sim(0.32);
      g.sim(2);`, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.32); return [1.9, q.x, q.y - 10];`, follow: true },
  // 3) Mortimer büyü yapar (yakın)
  buyu: { lvl: 0, dur: 6.5, setup: `G.mortCastN = null; G.mortSlam = false; G.mortCast = G.mortCastT = 184 / 24;`, cam: `const c = G.castle; return [3.6, c.x + 58, c.y - 60];` },
  // 4) kuleler savaşıyor (orta bölüm, tam geliştirilmiş kuleler, kalabalık)
  kuleler: { lvl: 12, dur: 8, team: ['leonidas'], towers: true, setup: `
      for (let i = 0; i < 34; i++) g.spawn(['legion', 'heavy', 'legion_k', 'priest', 'gladiator', 'testudo', 'cavalry'][i % 7], i % G.paths.length), g.sim(0.25);
      g.sim(3);`, cam: `return [1.45, TC.x, TC.y];`, spawnEvery: 0.45 },
  // 5) diriltme: cesetlerin üstüne Ölüleri Diriltme (geniş)
  dirilt: { lvl: 12, dur: 5, team: ['leonidas'], towers: true, setup: `
      for (let i = 0; i < 40; i++) g.spawn(['legion', 'legion_k', 'heavy', 'priest'][i % 4], i % G.paths.length), g.sim(0.2);
      g.sim(6);`, cam: `return [1.55, TC.x, TC.y];`, at: [[0.4, `const b = G.effects.filter(f => f.kind === 'corpse'); const q = b.length ? b[Math.floor(b.length / 2)] : TC; G.spells.nm_raise = 0; g.cast('nm_raise', q.x, q.y);`]] },
  // 6) Mortimer havada (diriltme, yakın)
  ucus: { lvl: 0, dur: 6, setup: `G.mortCastN = 'mortimer_dirilt'; G.mortCast = G.mortCastT = 208 / 24; G.mortFlash = false;`, cam: `const c = G.castle; return [3.2, c.x + 58, c.y - 75];` },
  // 7) komutanın anlık gücü: Merlin'in meteor yağmuru kalabalığa
  meteor: { lvl: 12, dur: 4.5, team: ['merlin'], towers: true, setup: `
      for (let i = 0; i < 30; i++) g.spawn(['legion', 'heavy', 'legion_k', 'cavalry'][i % 4], 0), g.sim(0.2);
      g.sim(2.5);`, cam: `const e = G.enemies.filter(e => !e.dead && e.p === G.paths[0]); const m = e[Math.floor(e.length / 2)] || TC; return [1.7, m.x, m.y];`,
    at: [[0.3, `const e = G.enemies.filter(e => !e.dead); const m = e[Math.floor(e.length / 2)]; G.heroes.forEach(h => h.ultCd = 0); G.spells.ult0 = 0; g.cast('ult0', m.x, m.y);`]] },
  // 8) boss: General Gloriosus iskeletlere karşı
  boss: { lvl: 14, dur: 5, team: ['leonidas'], towers: true, setup: `
      g.spawn('gloriosus', 0); for (let i = 0; i < 10; i++) g.spawn(['legion', 'heavy'][i % 2], 0), g.sim(0.3);
      g.sim(4);`, cam: `const b = G.enemies.find(e => e.def.chief && !e.dead) || TC; return [2.1, b.x, b.y - 20];`, follow: 'boss' },
};

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await wait(7000);
  await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.cine = { intro: 1, oyun: 1, kahve: 1 }; S.loadout = ['nm_raise', 'nm_fear']; });
  for (const [name, SC] of Object.entries(SCENES)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    await p.evaluate(() => { window.__game.recStop(); window.__CLEAN = false; });
    await p.evaluate(async ({ SC }) => {
      const g = window.__game, S = g.save(); S.team = SC.team || ['leonidas'];
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
      } else window.TC = { x: G.castle.x, y: G.castle.y };
      g.wave(); new Function('g', 'G', 'TC', SC.setup)(g, G, window.TC);
    }, { SC });
    await wait(2500); // yeni şeritler yüklensin
    await p.evaluate(({ SC }) => {
      const g = window.__game, G = g.G; window.__CLEAN = true; window.__recLog = [];
      const [z, x, y] = new Function('g', 'G', 'TC', SC.cam)(g, G, window.TC); g.camSet(z, x - 480 / z, y - 270 / z); window.__recCam = { z, x, y };
      window.__recT0 = g.recStep(1);
    }, { SC });
    const N = Math.round(SC.dur * FPS), at = (SC.at || []).slice();
    let spawnT = 0;
    for (let i = 0; i < N; i++) {
      const t = i / FPS;
      while (at.length && at[0][0] <= t) { const code = at.shift()[1]; await p.evaluate((code) => { const g = window.__game; new Function('g', 'G', 'TC', code)(g, g.G, window.TC); }, code); }
      if (SC.spawnEvery && t >= spawnT) { spawnT += SC.spawnEvery; await p.evaluate(() => { const g = window.__game, G = g.G; g.spawn(['legion', 'heavy', 'legion_k', 'priest'][Math.floor(Math.random() * 4)], Math.floor(Math.random() * G.paths.length)); }); }
      await p.evaluate(({ SC }) => { // kamera yavaşça kayar (takip ya da hafif yakınlaşma)
        const g = window.__game, G = g.G, C = window.__recCam;
        if (SC.follow === 'boss') { const b = G.enemies.find((e) => e.def.chief && !e.dead); if (b) { C.x += (b.x - C.x) * 0.06; C.y += (b.y - 20 - C.y) * 0.06; } }
        else if (SC.follow) { const e = G.enemies.filter((e) => !e.dead && e.p === G.paths[0]); if (e.length) { const m = e[Math.floor(e.length / 2)]; C.x += (m.x - C.x) * 0.03; C.y += (m.y - 10 - C.y) * 0.03; } }
        const z = C.z * (1 + 0.0009), Z = (C.z = z); g.camSet(Z, C.x - 480 / Z, C.y - 270 / Z);
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

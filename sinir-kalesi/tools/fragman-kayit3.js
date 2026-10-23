// Fragman kaydı v3 (23 Eki, Caner 6/10: balkon animasyonu eksik, dalga/yetenek az): v2 sahneleri + balkon, büyü, kalabalık dalga, Kemik Duvarı,
// Ceset Golemi, Ceset Patlatma. 3840x2160, 30 kare/sn.
// Oyun kareleri dışarıdan sürülür (__game.recStep), arayüz gizli (__CLEAN), çalınan sesler günlüğe (__recLog).
//   node tools/fragman-kayit3.js <çıkış dizini> [sahne ...]     (sunucu 8765'te açık olmalı)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2], ONLY = process.argv.slice(3), FPS = 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 23 Eki: ceset sahnelerinde rahip yok (rahip cesedi kutsar: üstünde 'diriltilemez' işareti çıkıyordu)
const MARCH = `for (let i = 0; i < 28; i++) g.spawn(['legion', 'legion', 'heavy', 'legion_k', 'cavalry', 'legion'][i % 6], 0), g.sim(0.3); g.sim(1.2); G.heroes.forEach(h => { h.x = -300; h.y = -300; });`;
const CROWD = `const C = window.__recCam, e = G.enemies.filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - C.x, a.y - C.y) - Math.hypot(b.x - C.x, b.y - C.y)); const m = e[0] || C;`;
const CROWD_FRONT = `const e = G.enemies.filter(e => !e.dead && e.p === G.paths[0]).sort((a, b) => b.d - a.d), f = e[Math.min(2, e.length - 1)], w = f ? g.pathPos(f.p, f.d + 40) : window.__recCam;`;
const ULT = (dx = 15) => CROWD + ` G.spells.ult0 = 0; g.cast('ult0', m.x + ${dx}, m.y);`;
const TOW = [['archer', 'bow', 'bow'], ['artillery', null, 'plague'], ['mage', null, 'drain'], ['barracks', null, 'shield'], ['archer', 'xbow', 'fan'], ['altar', null, 'rite'], ['mage', null, 'ghost']];
const SCENES = {
  gece:     { lvl: 26, dur: 4.2, cam: `const c = G.castle; return [2.3, c.x, c.y - 75];`, zTo: 3.0 },
  kahve:    { lvl: 26, dur: 9.5, cam: `const m = g.mortPt(); return [8, m.x + 2, m.y - m.h * 0.55];`, zTo: 8.4 },
  ordu:     { lvl: 9, dur: 4.5, setup: MARCH, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [3.0, q.x, q.y - 12];`, follow: 'front', zTo: 3.3 },
  insa:     { lvl: 22, dur: 3.6, plotCam: 6, cam: `return [3.4, PL.x, PL.y - 30];`, at: [[0.25, `g.build(PI, 'mage');`], [1.4, `G.gold = 1e6; g.upgrade(PI);`], [2.4, `g.upgrade(PI);`]] },
  kule_ok:  { lvl: 22, dur: 3.6, towers: TOW, focus: 'archer', cam: `return [2.9, FT.x - 25, FT.y - 30];`, near: 1, spawnEvery: 0.3 },
  kule_veba:{ lvl: 22, dur: 3.6, towers: TOW, focus: 'artillery', cam: `return [2.9, FT.x - 25, FT.y - 30];`, near: 1, spawnEvery: 0.3 },
  kule_fener:{ lvl: 22, dur: 3.6, towers: TOW, focus: 'mage', cam: `return [2.9, FT.x - 25, FT.y - 30];`, near: 1, spawnEvery: 0.3 },
  dalga:    { lvl: 22, dur: 4.5, towers: TOW, focus: 'barracks', cam: `return [2.2, FT.x - 40, FT.y + 10];`, near: 1, spawnEvery: 0.22, zTo: 2.45 },
  ucus:     { lvl: 26, dur: 6.5, setup: `G.mortCastN = 'mortimer_dirilt'; G.mortCast = G.mortCastT = 208 / 24; G.mortFlash = false;`, cam: `const m = g.mortPt(); return [5.2, m.x, m.y - m.h * 1.5];` },
  zombi:    { lvl: 9, dur: 6.5, setup: `
      const P = G.paths[0], q = g.pathPos(P, P.total * 0.42); window.ZP = q;
      for (let i = 0; i < 36; i++) { g.spawn(['legion', 'legion_k', 'heavy', 'gladiator'][i % 4], 0); const e = G.enemies[G.enemies.length - 1]; e.d = P.total * 0.42 + (Math.random() - 0.5) * 90; }
      g.sim(0.2); for (const e of G.enemies.slice()) g.kill(e); g.sim(0.5); G.heroes.forEach(h => { h.x = -300; h.y = -300; });`,
    cam: `return [2.4, ZP.x, ZP.y - 10];`, zTo: 2.7,
    at: [[0.2, `g.raiseAll();`], [2.2, `const P = G.paths[0]; for (let i = 0; i < 14; i++) { g.spawn(['legion', 'heavy', 'cavalry'][i % 3], 0); G.enemies[G.enemies.length - 1].d = P.total * 0.3 + i * 6; }`]] },
  boss:     { lvl: 22, dur: 6, team: ['leonidas'], towers: TOW, setup: `g.spawn('gloriosus', 0); const B = G.enemies[G.enemies.length - 1]; B.hp *= 2; B.maxHp *= 2; for (let k = 0; k < 240 && !B.dead && Math.hypot(B.x - TP.x, B.y - TP.y) > 170; k++) g.sim(0.25); for (let i = 0; i < 8; i++) window.__near(['legion', 'heavy'][i % 2], 30 + i * 8); g.sim(0.6);`,
    cam: `const b = G.enemies.find(e => e.def.chief && !e.dead) || TP; return [2.5, b.x, b.y - 20];`, follow: 'boss' },
  meteor:   { lvl: 9, dur: 2.6, team: ['merlin'], setup: MARCH, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [2.3, q.x, q.y - 10];`, follow: 'mid', at: [[0.15, ULT(20)]] },
  kasirga:  { lvl: 9, dur: 2.6, team: ['merlin'], act: 'ult2', setup: MARCH, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [2.3, q.x, q.y - 10];`, follow: 'mid', at: [[0.15, ULT(10)]] },
  kangolu:  { lvl: 9, dur: 2.6, team: ['bathory'], setup: MARCH, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [2.3, q.x, q.y - 10];`, follow: 'mid', at: [[0.15, ULT(10)]] },
  okyagmuru:{ lvl: 9, dur: 2.6, team: ['robin'], setup: MARCH, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [2.3, q.x, q.y - 10];`, follow: 'mid', at: [[0.15, ULT(20)]] },
  final:    { lvl: 22, dur: 8, team: ['leonidas'], act: 'ult2', towers: TOW, setup: `g.spawn('gloriosus', 0); const B = G.enemies[G.enemies.length - 1]; B.hp *= 2; B.maxHp *= 2; for (let k = 0; k < 240 && !B.dead && Math.hypot(B.x - TP.x, B.y - TP.y) > 170; k++) g.sim(0.25); for (let i = 0; i < 8; i++) window.__near(['legion', 'heavy'][i % 2], 30 + i * 8); g.sim(0.6);`,
    cam: `const b = G.enemies.find(e => e.def.chief && !e.dead) || TP; return [2.6, b.x, b.y - 20];`, follow: 'boss',
    at: [[0.3, `const b = G.enemies.find(e => e.def.chief && !e.dead); if (b) { G.spells.ult0 = 0; g.cast('ult0', b.x - 10, b.y); }`],
         [2.6, `const b = G.enemies.find(e => e.def.chief && !e.dead); if (b) b.hp = Math.min(b.hp, b.maxHp * 0.05);`],
         [3.4, `const b = G.enemies.find(e => e.def.chief && !e.dead); if (b) g.kill(b); for (const e of G.enemies.slice()) if (!e.dead && !e.def.chief) g.kill(e);`],
         [5.0, `G.celebTime = window.__recNow;`]] },
  // 23 Eki (v3): balkon ve büyü (Mortimer Veo şeritleri), kalabalık dalga, Mortimer'ın öteki büyüleri
  balkon:   { lvl: 26, dur: 5.0, cam: `const m = g.mortPt(); return [7.0, m.x, m.y - m.h * 0.55];`, zTo: 7.6 },
  buyu:     { lvl: 26, dur: 5.5, loadout: ['nm_raise', 'nm_fear'], setup: `for (let i = 0; i < 16; i++) { g.spawn(['legion', 'heavy', 'cavalry'][i % 3], 0); g.sim(0.25); }`,
    cam: `const m = g.mortPt(); return [6.2, m.x, m.y - m.h * 0.75];`, zTo: 6.6,
    at: [[0.2, `const P = G.paths[0], q = g.pathPos(P, P.total * 0.85); G.spells.nm_fear = 0; g.cast('nm_fear', q.x, q.y);`]] },
  dalga2:   { lvl: 22, dur: 5.0, towers: TOW, cam: `return [1.8, TP.x, TP.y];`, near: 1, spawnEvery: 0.08, zTo: 2.0,
    setup: `for (let i = 0; i < 40; i++) window.__near(['legion', 'heavy', 'legion_k', 'cavalry', 'priest', 'gladiator', 'legarcher'][i % 7], 20 + i * 9); g.sim(0.4);` },
  duvar:    { lvl: 9, dur: 3.2, loadout: ['nm_raise', 'nm_wall'], setup: MARCH, cam: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.3); return [2.6, q.x, q.y - 10];`, follow: 'front',
    at: [[0.2, CROWD_FRONT + ` G.spells.nm_wall = 0; g.cast('nm_wall', w.x, w.y);`]] },
  golem:    { lvl: 9, dur: 4.2, loadout: ['nm_raise', 'nm_golem'], setup: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.42); window.ZP = q;
      for (let i = 0; i < 30; i++) { g.spawn(['legion', 'legion_k', 'heavy', 'gladiator'][i % 4], 0); const e = G.enemies[G.enemies.length - 1]; e.d = P.total * 0.42 + (Math.random() - 0.5) * 80; }
      g.sim(0.2); for (const e of G.enemies.slice()) g.kill(e); g.sim(0.5); G.heroes.forEach(h => { h.x = -300; h.y = -300; });`, cam: `return [2.6, ZP.x, ZP.y - 14];`, zTo: 2.9,
    at: [[0.2, `G.spells.nm_golem = 0; g.cast('nm_golem', ZP.x, ZP.y);`], [1.0, `const P = G.paths[0]; for (let i = 0; i < 12; i++) { g.spawn(['legion', 'heavy', 'cavalry'][i % 3], 0); G.enemies[G.enemies.length - 1].d = P.total * 0.32 + i * 6; }`]] },
  patlat:   { lvl: 9, dur: 3.4, loadout: ['nm_raise', 'nm_burst'], setup: `const P = G.paths[0], q = g.pathPos(P, P.total * 0.42); window.ZP = q;
      for (let i = 0; i < 30; i++) { g.spawn(['legion', 'legion_k', 'heavy', 'gladiator'][i % 4], 0); const e = G.enemies[G.enemies.length - 1]; e.d = P.total * 0.42 + (Math.random() - 0.5) * 80; }
      g.sim(0.2); for (const e of G.enemies.slice()) g.kill(e); g.sim(0.5); G.heroes.forEach(h => { h.x = -300; h.y = -300; }); const P2 = G.paths[0]; for (let i = 0; i < 14; i++) { g.spawn(['legion', 'heavy', 'legion_k'][i % 3], 0); G.enemies[G.enemies.length - 1].d = P2.total * 0.42 - 40 + i * 5; }`,
    cam: `return [2.6, ZP.x, ZP.y - 12];`, zTo: 2.85, at: [[0.6, `G.spells.nm_burst = 0; g.cast('nm_burst', ZP.x, ZP.y);`]] },
};

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await wait(8000);
  await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.cine = { intro: 1, oyun: 1, kahve: 1 }; S.loadout = ['nm_raise', 'nm_fear']; });
  for (const [name, SC] of Object.entries(SCENES)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    await p.evaluate(() => { window.__game.recStop(); window.__CLEAN = false; });
    await p.evaluate(async ({ SC, TOWJ }) => {
      const g = window.__game, S = g.save(); S.team = SC.team || ['leonidas']; S.heroBuy = [...new Set((S.heroBuy || []).concat(S.team))];
      S.loadout = SC.loadout || ['nm_raise', 'nm_fear']; S.hero = S.hero || {}; for (const id of S.team) S.hero[id] = { lvl: 12, xp: 0, sk: {}, ult: 3, ult2: 3, act: SC.act || 'ult' };
      g.setOv && g.setOv(null); g.startLevel(SC.lvl); await new Promise((r) => setTimeout(r, 6500));
      const G = g.G; G.gold = 1e6; G.lives = 20; G.tut = null;
      const pts = []; for (const P of G.paths) for (let d = 0; d < P.total; d += 12) pts.push(g.pathPos(P, d));
      const order = G.plots.map((pl, i) => ({ i, n: pts.filter((q) => Math.hypot(q.x - pl.x, q.y - pl.y) < 140).length })).sort((a, b) => b.n - a.n).map((o) => o.i);
      window.TC = window.TP = window.FT = { x: G.castle.x, y: G.castle.y };
      if (SC.plotCam != null) { window.PI = order[SC.plotCam]; window.PL = G.plots[window.PI]; }
      if (SC.towers) {
        SC.towers.forEach(([type, pth, sp], k) => { const i = order[k]; if (i == null) return; g.build(i, type); const t = G.plots[i].tower; if (!t) return; if (pth) g.path(i, pth);
          for (let n = 0; n < 6; n++) g.upgrade(i); if (sp) for (let n = 0; n < 3; n++) g.ability(i, sp); });
        const used = order.slice(0, 5).map((i) => G.plots[i]);
        window.TC = { x: used.reduce((a, q) => a + q.x, 0) / used.length, y: used.reduce((a, q) => a + q.y, 0) / used.length };
        const near = pts.filter((q) => used.filter((u) => Math.hypot(q.x - u.x, q.y - u.y) < 150).length >= 3);
        window.TP = near.length ? { x: near.reduce((a, q) => a + q.x, 0) / near.length, y: near.reduce((a, q) => a + q.y, 0) / near.length } : window.TC;
        if (SC.focus) { const t = G.towers.find((t) => t.type === SC.focus); if (t) { window.FT = { x: t.x, y: t.y }; const np = pts.slice().sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0]; window.TP = SC.near ? { x: (np.x + t.x) / 2, y: (np.y + t.y) / 2 } : window.TP; window.NP = np; } }
      }
      window.__near = (t, back = 0) => { const pi = Math.floor(Math.random() * G.paths.length), P = G.paths[pi], tgt = window.NP || window.TP; let bd = 1e9, D = 0;
        for (let d = 0; d < P.total; d += 6) { const q = g.pathPos(P, d), k = Math.hypot(q.x - tgt.x, q.y - tgt.y); if (k < bd) { bd = k; D = d; } }
        g.spawn(t, pi); const E = G.enemies[G.enemies.length - 1]; if (E) { E.d = Math.max(0, D - 60 - back - Math.random() * 50); E.hp *= 3; E.maxHp *= 3; } return E; };
      g.wave();
      if (SC.near) for (let i = 0; i < 14; i++) window.__near(['legion', 'heavy', 'legion_k', 'priest', 'gladiator', 'cavalry'][i % 6], i * 7);
      if (SC.setup) new Function('g', 'G', 'TP', SC.setup)(g, G, window.TP);
    }, { SC });
    await wait(3000); // yeni şeritler yüklensin
    await p.evaluate(({ SC }) => {
      const g = window.__game, G = g.G; window.__CLEAN = true; window.__recLog = [];
      const [z, x, y] = new Function('g', 'G', 'TC', 'TP', 'FT', 'PL', 'ZP', SC.cam)(g, G, window.TC, window.TP, window.FT, window.PL, window.ZP);
      window.__camC = (z, x, y) => g.camSet(z, Math.max(0, Math.min(960 - 960 / z, x - 480 / z)), Math.max(0, Math.min(540 - 540 / z, y - 270 / z)));
      window.__camC(z, x, y); window.__recCam = { z, x, y, z0: z }; window.__recT0 = window.__recNow = g.recStep(1);
    }, { SC });
    const N = Math.round(SC.dur * FPS), at = (SC.at || []).slice();
    let spawnT = 0;
    for (let i = 0; i < N; i++) {
      const t = i / FPS;
      while (at.length && at[0][0] <= t) { const code = at.shift()[1]; await p.evaluate((code) => { const g = window.__game; new Function('g', 'G', 'TC', 'TP', 'PI', 'ZP', code)(g, g.G, window.TC, window.TP, window.PI, window.ZP); }, code); }
      if (SC.spawnEvery && t >= spawnT) { spawnT += SC.spawnEvery; await p.evaluate(() => window.__near(['legion', 'heavy', 'legion_k', 'priest', 'cavalry'][Math.floor(Math.random() * 5)], 10)); }
      await p.evaluate(({ SC, k }) => {
        const g = window.__game, G = g.G, C = window.__recCam;
        if (G.mort) { G.mort.quiet = 0; G.mort.calm = Math.min(G.mort.calm || 0, 1); if (['in', 'goin', 'out'].includes(G.mort.st)) { G.mort.st = 'tea'; G.mort.t = 0; } } // Mortimer balkonda kalsın
        if (SC.follow === 'boss') { const b = G.enemies.find((e) => e.def.chief && !e.dead); if (b) { C.x += (b.x - C.x) * 0.05; C.y += (b.y - 20 - C.y) * 0.05; } }
        else if (SC.follow) { const e = G.enemies.filter((e) => !e.dead && e.p === G.paths[0]).sort((a, b) => b.d - a.d); if (e.length) { const m = e[SC.follow === 'front' ? Math.min(4, e.length - 1) : Math.floor(e.length / 2)]; C.x += (m.x - C.x) * 0.04; C.y += (m.y - 10 - C.y) * 0.04; } }
        C.z = SC.zTo ? C.z0 + (SC.zTo - C.z0) * (1 - Math.pow(1 - k, 2)) : C.z * 1.0006; window.__camC(C.z, C.x, C.y);
        window.__recNow = g.recStep(1000 / 30);
      }, { SC, k: i / N });
      await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    }
    const log = await p.evaluate(() => window.__recLog.map((r) => [+(r[0] - window.__recT0).toFixed(3)].concat(r.slice(1))));
    fs.writeFileSync(path.join(dir, 'ses.json'), JSON.stringify({ fps: FPS, n: N, log }));
    console.log(name, N, 'kare', log.length, 'ses', errs.length ? 'HATA ' + errs.slice(-2).join(' | ') : '');
  }
  await b.close();
})();

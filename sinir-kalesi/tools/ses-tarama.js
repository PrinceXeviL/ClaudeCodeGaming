// 20 Eki: ses taraması — her kule/uzmanlık/büyü/komutan için çalan sesler (taban çıkarılır). Sunucu 8765'te: node sinir-kalesi/tools/ses-tarama.js
// Her olay ayrı ayrı: hangi sesler çaldı (taban çizgisi çıkarılır)
const { chromium } = require(process.cwd() + '/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('HATA', e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(7000);
  await p.evaluate(() => { const g = window.__game; g.startLevel(1); });
  for (let k = 0; k < 4; k++) { await p.waitForTimeout(900); await p.mouse.click(1180, 35); }
  await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const g = window.__game, R = {}, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const fresh = async (hero) => { if (hero) g.save().team = [hero]; g.startLevel(1); await sleep(1800); const G = g.G; G.gold = 99999; G.lives = 9999; G.comic = null; return G; };
    const run = async (sec, fn) => { window.__sfxLog = []; for (let i = 0; i < sec * 2; i++) { if (fn) fn(i); g.sim(0.5); } return [...new Set(window.__sfxLog)].sort(); };
    const mob = (G) => (i) => { if (i % 4 === 0) { g.spawn('legion', 0); g.spawn('solarcher', 0); if (i % 8 === 0) g.spawn('legion_k', 0); } };
    let G = await fresh(); R.base = await run(20, mob(G));
    for (const T of ['archer', 'barracks', 'mage', 'artillery', 'altar']) {
      G = await fresh(); g.build(0, T); g.build(1, T); g.upgrade(0); g.upgrade(0); g.upgrade(1); g.upgrade(1);
      R[T + '_3'] = await run(20, mob(G));
    }
    const ABS = { archer: ['bow', 'fan'], barracks: ['shield', 'blade'], mage: ['drain', 'ghost'], artillery: ['corpse', 'plague'], altar: ['rite', 'blight'] };
    for (const [T, L] of Object.entries(ABS)) for (const ab of L) {
      G = await fresh(); g.build(0, T); g.build(1, T); for (const i of [0, 1]) { g.upgrade(i); g.upgrade(i); g.upgrade(i); try { g.path && T === 'archer' && g.path(i, ab === 'bow' ? 'bow' : 'xbow'); } catch (e) {} for (let r = 0; r < 3; r++) try { g.spec(i, ab); } catch (e) {} }
      R[T + ':' + ab] = await run(24, mob(G));
    }
    for (const sp of ['nm_raise', 'nm_wall', 'nm_fear', 'nm_golem', 'nm_burst']) {
      G = await fresh(); const P = G.path ? null : null; g.spawn('legion', 0); g.spawn('legion', 0); g.sim(6); const e = G.enemies.find(x => !x.dead) || { x: 400, y: 300 };
      window.__sfxLog = []; g.cast(sp, e.x, e.y); g.sim(4); R['büyü:' + sp] = [...new Set(window.__sfxLog)].sort();
    }
    for (const H of ['commander', 'zeynep', 'leonidas', 'merlin', 'robin', 'bathory']) {
      G = await fresh(H); const h = G.heroes[0]; if (!h) { R['komutan:' + H] = ['YOK']; continue; } for (let k = 0; k < 20; k++) try { g.learn(0, 'ult'); } catch (e) {}
      R['komutan:' + H] = await run(24, (i) => { mob(G)(i); const e = G.enemies.find(x => !x.dead && x.pi === undefined || !x.dead); if (e && i % 2 === 0) { h.x += (e.x - h.x) * 0.5; h.y += (e.y - h.y) * 0.5; } if (i === 14 && e) try { g.ult(e.x, e.y); } catch (er) {} });
    }
    const EN = {}; for (const [k, d] of Object.entries(window.__game.data ? {} : {})) {}
    return R;
  });
  const base = new Set(out.base); console.log('TABAN', out.base.join(' '));
  for (const [k, v] of Object.entries(out)) if (k !== 'base') console.log(k.padEnd(14), v.filter(x => !base.has(x)).join(' '));
  await b.close();
})();

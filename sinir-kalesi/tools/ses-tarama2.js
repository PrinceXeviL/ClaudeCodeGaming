// 20 Eki: Lanet Kulesi ve düşman becerileri ses taraması: node sinir-kalesi/tools/ses-tarama2.js <en_ab.json>
const { chromium } = require(process.cwd() + '/node_modules/playwright');
const AB = require(process.argv[2]);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('HATA', e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(7000);
  await p.evaluate(() => window.__game.startLevel(4));
  for (let k = 0; k < 4; k++) { await p.waitForTimeout(900); await p.mouse.click(1180, 35); }
  await p.waitForTimeout(2000);
  const out = await p.evaluate(async (AB) => {
    const g = window.__game, R = {}, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const fresh = async () => { g.startLevel(4); await sleep(1500); const G = g.G; G.gold = 99999; G.lives = 9999; return G; };
    const run = async (sec, fn) => { window.__sfxLog = []; for (let i = 0; i < sec * 2; i++) { if (fn) fn(i); g.sim(0.5); } return [...new Set(window.__sfxLog)].sort(); };
    const mob = (i) => { if (i % 4 === 0) { g.spawn('legion', 0); g.spawn('solarcher', 0); } };
    let G = await fresh(); g.build(0, 'barracks'); g.build(1, 'archer'); R.base = await run(20, mob);
    for (const ab of ['', 'rite', 'blight']) { G = await fresh(); g.build(0, 'barracks'); g.build(1, 'archer'); const ok = g.build(2, 'altar'); g.upgrade(2); g.upgrade(2); g.upgrade(2); if (ab) for (let r = 0; r < 3; r++) try { g.spec(2, ab); } catch (e) {} R['altar:' + (ab || '3') + (G.plots[2].tower ? '' : ' KURULMADI')] = await run(24, mob); }
    for (const [ab, type] of Object.entries(AB)) { G = await fresh(); g.build(0, 'barracks'); g.build(1, 'archer'); R['düşman:' + ab + '(' + type + ')'] = await run(24, (i) => { mob(i); if (i % 10 === 0) g.spawn(type, 0); }); }
    return R;
  }, AB);
  const base = new Set(out.base); console.log('TABAN', out.base.join(' '));
  for (const [k, v] of Object.entries(out)) if (k !== 'base') console.log(k.padEnd(30), v.filter(x => !base.has(x)).join(' '));
  await b.close();
})();

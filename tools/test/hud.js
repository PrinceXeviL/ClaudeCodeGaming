// Oyun ekranı göstergeleri (dalga, duraklat, hız, ses, komutan, çanta, büyüler, sancak) + gerçek zafer ve yenilgi ekranı düğmeleri
const { chromium } = require('/Users/caner/Documents/Game Lab/kod/ClaudeCodeGaming/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 640 } });
  await ctx.addInitScript(() => { window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const p = await ctx.newPage(); let errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(5000);
  await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.cine = { intro: 1, oyun: 1, kahve: 1 }; S.stars = Array.from({ length: 20 }, () => 3); S.items = { bomb: 9, freeze: 9, tea: 9, purse: 9 }; });
  const out = [];
  const prep = async () => { await p.evaluate(async () => { const g = window.__game; g.setOv(null); g.startLevel(4); await new Promise(r => setTimeout(r, 3500)); g.G.gold = 5000; g.build(0, 'archer'); g.wave(); g.sim(4); }); await p.waitForTimeout(700); };
  await prep(); const Z = await p.evaluate(() => window.__game.uiZones().filter(z => !z.rect).map(z => Object.assign({}, window.__game.ui2s(z.x, z.y), { tag: z.tag })));
  for (const z of Z) {
    await prep(); errs = []; const f0 = await p.evaluate(() => window.__fr);
    await p.mouse.click(z.x, z.y); await p.waitForTimeout(500); await p.mouse.click(640, 330); await p.waitForTimeout(500); // büyü/eşya için haritaya da dokun
    const st = await p.evaluate(() => ({ fr: window.__fr, ov: window.__game.sim(0) })); out.push([z.tag, errs.length ? 'HATA ' + errs[0] : st.fr - f0 < 5 ? 'DONMA' : 'tamam' + (st.ov ? ' (' + (st.ov.kind || st.ov) + ')' : '')]);
  }
  for (const end of ['win', 'lose']) {
    await p.evaluate(async (end) => { const g = window.__game; g.setOv(null); g.startLevel(0); await new Promise(r => setTimeout(r, 3500)); const G = g.G;
      if (end === 'win') { G.gold = 99999; for (let i = 0; i < Math.min(6, G.plots.length); i++) { g.build(i, 'archer'); g.upgrade(i); g.upgrade(i); } }
      else { G.lives = 1; for (let k = 0; k < 15; k++) { g.spawn('cavalry', 0); g.sim(0.2); } }
      let k = 0; while (!g.sim(0.5) && k++ < 2400) if (k % 10 === 0) g.wave(); }, end);
    await p.waitForTimeout(3500);
    const keys = await p.evaluate(() => window.__game.btnKeys());
    for (const key of keys) {
      const q = await p.evaluate((k) => window.__game.btn(k), key); if (!q) continue;
      errs = []; const f0 = await p.evaluate(() => window.__fr); await p.mouse.click(q.x, q.y); await p.waitForTimeout(1500);
      const f1 = await p.evaluate(() => window.__fr); out.push([end + ':' + key, errs.length ? 'HATA ' + errs[0] : f1 - f0 < 5 ? 'DONMA' : 'tamam']);
      await p.evaluate(async (end) => { const g = window.__game; g.setOv(null); g.startLevel(0); await new Promise(r => setTimeout(r, 3000)); const G = g.G;
        if (end === 'win') { G.gold = 99999; for (let i = 0; i < Math.min(6, G.plots.length); i++) { g.build(i, 'archer'); g.upgrade(i); g.upgrade(i); } } else { G.lives = 1; for (let k = 0; k < 15; k++) { g.spawn('cavalry', 0); g.sim(0.2); } }
        let k = 0; while (!g.sim(0.5) && k++ < 2400) if (k % 10 === 0) g.wave(); }, end);
      await p.waitForTimeout(3000);
    }
    out.push([end, 'düğmeler: ' + keys.join(' ')]);
  }
  console.log(JSON.stringify(out)); await b.close();
})();

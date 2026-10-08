// Akış testi: başlık → harita → bölüm kartı → bölüm; kule kur, dalga önizle/çağır, duraklat/devam, kazanma ekranından sonraki bölüm.
// Sunucu 8765'te açıkken: node tools/akis-testi.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, ignoreHTTPSErrors: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.clear(); });
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForTimeout(1500);
  const st = () => p.evaluate(() => { const g = window.__game, G = g.G; return JSON.stringify({ screen: g.screen, overlay: g.overlay, sel: G && G.sel && G.sel.kind, towers: G && G.towers.length, wave: G && G.wave, peek: !!(G && G.wavePeek) }); }).then(JSON.parse);
  const tap = async (x, y) => { await p.mouse.click(x, y); await p.waitForTimeout(700); };
  let ok = true; const check = (cond, msg) => { if (!cond) { ok = false; console.log('HATA:', msg); } };
  await tap(480, 452); let s = await st(); console.log('OYNA ->', s); check(s.screen === 'map', 'haritaya geçmedi');
  await tap(150, 450); console.log('bölüm 1 bayrağı ->', await st());
  await tap(480, 400); s = await st(); console.log('kart OYNA ->', s); check(s.screen === 'play', 'bölüm başlamadı');
  await p.waitForTimeout(1200);
  // ilk arsaya dokun, menüden okçu kulesini seç (önizleme) ve kur
  const pl = await p.evaluate(() => { const G = window.__game.G, c = window.__game.cam, P = G.plots[0]; return { x: (P.x - c.x) * c.z, y: (P.y - c.y) * c.z }; });
  await tap(pl.x, pl.y); s = await st(); console.log('arsa ->', s); check(s.sel === 'plot', 'arsa seçilmedi');
  await tap(pl.x - 48, pl.y - 16 - 44); console.log('okçu önizleme ->', await st());
  await tap(pl.x - 48, pl.y - 16 - 44); s = await st(); console.log('okçu inşa ->', s); check(s.towers === 1, 'kule kurulmadı');
  // dalga işareti: ilk dokunuş önizleme, ikinci dokunuş çağırır
  const wb = await p.evaluate(() => { const G = window.__game.G, c = window.__game.cam, b = Object.values(G.waveBtn)[0]; return { x: (b.x - c.x) * c.z, y: (b.y - c.y) * c.z }; });
  await tap(wb.x, wb.y); s = await st(); console.log('dalga önizleme ->', s); check(s.peek && s.wave === 0, 'önizleme açılmadı');
  await tap(wb.x, wb.y); s = await st(); console.log('dalga çağır ->', s); check(s.wave === 1, 'dalga çağrılmadı');
  await tap(960 - 32, 32); s = await st(); console.log('duraklat ->', s); check(s.overlay === 'pause', 'duraklamadı');
  await tap(480, 288 + 18 - 175 + 104); s = await st(); console.log('devam ->', s); check(!s.overlay, 'devam etmedi');
  await p.evaluate(() => { window.__game.G.stars = 3; window.__game.setOverlay('win'); });
  await p.waitForTimeout(2200);
  await tap(480 + 70, 288 + 18 - 175 + 262); const idx = await p.evaluate(() => window.__game.G.idx); console.log('sonraki bölüm ->', await st(), idx); check(idx === 1, 'sonraki bölüme geçmedi');
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'AKIŞ TAMAM' : 'AKIŞTA SORUN VAR');
  await b.close();
})();

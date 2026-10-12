// Akış testi: başlık → harita → bölüm kartı → bölüm; kule kur, dalga önizle/çağır, duraklat/devam, eşya çantası, kazanma ekranından sonraki bölüm.
// Sunucu 8765'te açıkken: node tools/akis-testi.js   (Playwright: depo kökünde `npm i -D playwright` + `npx playwright install chromium`)
// 12 Eki: düğmeler piksel konumuyla değil adıyla bulunur (__game.btn(key)); arayüz değişince test bozulmasın.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, ignoreHTTPSErrors: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.clear(); });
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForTimeout(3000);
  const st = () => p.evaluate(() => { const g = window.__game, G = g.G; return JSON.stringify({ screen: g.screen, overlay: g.overlay, sel: G && G.sel && G.sel.kind, towers: G && G.towers.length, wave: G && G.wave, peek: !!(G && G.wavePeek), idx: G && G.idx }); }).then(JSON.parse);
  const tap = async (x, y, w = 700) => { await p.mouse.click(x, y); await p.waitForTimeout(w); };
  const btn = (key) => p.evaluate((k) => window.__game.btn(k), key);
  const tapBtn = async (key, w = 900) => { const q = await btn(key); if (!q) { console.log('düğme yok:', key, await p.evaluate(() => window.__game.btnKeys().join(','))); return false; } await tap(q.x, q.y, w); return true; };
  let ok = true; const check = (cond, msg) => { if (!cond) { ok = false; console.log('HATA:', msg); } };
  // çizgi roman / tanıtım kaplamaları: varsa geç
  const skipOverlays = async () => { for (let i = 0; i < 12; i++) { const o = await p.evaluate(() => window.__game.overlay); if (!o || o === 'pause' || o === 'win' || o === 'lose') return; await p.evaluate(() => window.__game.setOverlay(null)); await p.waitForTimeout(300); } };

  await tapBtn('play', 2500); let s = await st(); console.log('OYNA ->', s); check(s.screen === 'map', 'haritaya geçmedi');
  await tapBtn('node0', 1200); console.log('bölüm 1 ->', await st());
  await tapBtn('play0', 2500); await skipOverlays(); s = await st(); console.log('kart SAVAŞA ->', s); check(s.screen === 'play', 'bölüm başlamadı');
  await p.waitForTimeout(1500); await skipOverlays();
  // ilk arsaya dokun, menüden ilk kuleyi seç (önizleme) ve kur
  const pl = await p.evaluate(() => { const G = window.__game.G, P = G.plots[0]; return window.__game.toScreen(P.x, P.y); });
  await tap(pl.x, pl.y); s = await st(); console.log('arsa ->', s); check(s.sel === 'plot', 'arsa seçilmedi');
  const mi = await p.evaluate(() => { const g = window.__game; const it = g.menu && g.menu()[0]; return it ? g.toScreen(it.x, it.y) : null; });
  if (mi) { await tap(mi.x, mi.y); await tap(mi.x, mi.y); } else await p.evaluate(() => window.__game.build(0, 'archer'));
  s = await st(); console.log('kule inşa ->', s); check(s.towers === 1, 'kule kurulmadı');
  // dalga işareti: ilk dokunuş önizleme, ikinci dokunuş çağırır
  const wb = await p.evaluate(() => window.__game.waveBtn(+Object.keys(window.__game.G.waveBtn)[0] || 0)); // ekrana kenetlenmiş gerçek yer
  await tap(wb.x, wb.y); s = await st(); console.log('dalga önizleme ->', s); check(s.peek && s.wave === 0, 'önizleme açılmadı');
  await tap(wb.x, wb.y); s = await st(); console.log('dalga çağır ->', s); check(s.wave === 1, 'dalga çağrılmadı');
  // eşya çantası açılıp kapanır
  const bag = await p.evaluate(() => { const g = window.__game; return g.bag ? g.bag() : null; });
  if (bag) { await tap(bag.x, bag.y); const open = await p.evaluate(() => !!window.__game.G.bagOpen); check(open, 'çanta açılmadı'); await tap(bag.x, bag.y); }
  // duraklat / devam
  await p.evaluate(() => window.__game.setOverlay('pause')); await p.waitForTimeout(900);
  s = await st(); check(s.overlay === 'pause', 'duraklamadı');
  const keys = await p.evaluate(() => window.__game.btnKeys());
  const resume = keys.find(k => /resume|devam|cont/.test(k));
  if (resume) { await tapBtn(resume); s = await st(); console.log('devam ->', s); check(!s.overlay, 'devam etmedi'); } else { console.log('devam düğmesi adları:', keys.join(',')); await p.evaluate(() => window.__game.setOverlay(null)); }
  // kazanma → sonraki bölüm
  await p.evaluate(() => { window.__game.G.stars = 3; window.__game.setOverlay('win'); });
  await p.waitForTimeout(2500);
  const wk = await p.evaluate(() => window.__game.btnKeys());
  const next = wk.find(k => /next|sonraki/.test(k));
  if (next) { await tapBtn(next, 2500); await skipOverlays(); } else console.log('kazanma düğmeleri:', wk.join(','));
  const idx = await p.evaluate(() => window.__game.G.idx); console.log('sonraki bölüm ->', await st()); check(idx === 1, 'sonraki bölüme geçmedi');
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'AKIŞ TAMAM' : 'AKIŞTA SORUN VAR');
  await b.close();
})();

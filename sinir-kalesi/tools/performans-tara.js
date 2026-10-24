// 24 Eki (Caner: "36. bölümde dondu, haritaya attı; bütün bölümleri test et, kalabalıkta, büyülerde, kulelerde kasma var mı"): performans taraması.
// Telefon taklidi (isMobile: şerit ölçeği ve bütçesi telefondaki gibi), TEK sayfada bölümler sırayla (bellek birikimi de görülsün).
// Her bölümde: bütün arsalara karışık kule (3. kademe + uzmanlık), dalgalar 5 sn'de bir çağrılır, büyüler/komutan gücü/diriltme sırayla kullanılır.
// Ölçülen: kare süreleri (rAF aralığı: ort, p95, >50 ms ve >100 ms sayısı, en uzun), görsel belleği (memInfo: şerit+diğer), ses belleği, JS yığını, düşman/asker tepe sayısı.
//   node tools/performans-tara.js [bölümler, ör. 0-39 ya da 33,35] [sn/bölüm, varsayılan 40]   (sunucu 8765'te açık)
const { chromium } = require('playwright');
const arg = process.argv[2] || '0-39', DUR = +(process.argv[3] || 40);
const lvls = arg.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(arg.split('-').map(Number)) : arg.split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now(), { timeout: 180000 }); await p.waitForTimeout(5000);
  await p.mouse.click(400, 200); // ses bağlamı
  await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.tutDone = 1; S.cine = new Proxy(S.cine || {}, { get: () => 1 });
    window.__ft = []; let last = performance.now(); const loop = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  for (const lvl of lvls) {
    await p.evaluate((L) => { const g = window.__game; g.setOv(null); g.startLevel(L); }, lvl);
    await p.waitForTimeout(7000);
    await p.evaluate(() => { const g = window.__game, G = g.G; G.tut = null; g.setOverlay(null); G.say = null; G.gold = 99999; G.lives = 999;
      const T = ['archer', 'barracks', 'mage', 'artillery'];
      G.plots.forEach((pl, i) => { try { g.build(i, T[i % 4]); g.upgrade(i); g.upgrade(i); g.upgrade(i); } catch (e) {} });
      window.__ft.length = 0; window.__peak = { e: 0, s: 0 }; });
    const t0 = Date.now(); let k = 0, mem = { s: 0, o: 0 };
    while (Date.now() - t0 < DUR * 1000) {
      await p.waitForTimeout(2500); k++;
      const m = await p.evaluate((k) => { const g = window.__game, G = g.G; if (!G) return null; G.lives = 999; G.gold = 99999; if (g.overlay) g.setOv(null);
        if (k % 2 === 0) try { g.wave(); } catch (e) {}
        const live = G.enemies.filter((e) => !e.dead); window.__peak.e = Math.max(window.__peak.e, live.length); window.__peak.s = Math.max(window.__peak.s, G.soldiers.filter((s) => !s.dead).length);
        const tg = live[Math.floor(live.length / 2)];
        if (tg) { const ids = ['nm_raise', 'nm_fear', 'nm_wall', 'nm_burst', 'nm_golem']; for (const id of ids) { try { if ((G.spells[id] || 0) <= 0) g.cast(id, tg.x, tg.y); } catch (e) {} }
          try { if (G.heroes[0]) { G.heroes[0].ultCd = 0; g.ult(tg.x, tg.y); } } catch (e) {} }
        const mi = g.memInfo(3); return { s: mi.strips, o: mi.other, w: mi.white, r: mi.rot }; }, k);
      if (m) { mem.s = Math.max(mem.s, m.s); mem.o = Math.max(mem.o, m.o); mem.w = Math.max(mem.w || 0, m.w); mem.r = Math.max(mem.r || 0, m.r); }
    }
    if (process.env.KALABALIK) await p.evaluate(() => { const g = window.__game, G = g.G; const P = G.paths[0]; for (let k = 0; k < 60; k++) { const e = g.spawn(['legion', 'gladiator', 'heavy', 'priest'][k % 4], k % G.paths.length); if (e) e.hp = e.maxHp = 20000; } });
    if (process.env.KALABALIK) await p.waitForTimeout(4000);
    const perf = await p.evaluate(() => { try { return window.__game.perf(60); } catch (e) { return String(e); } });
    const r = await p.evaluate(() => { const f = window.__ft.slice(5).sort((a, b) => a - b), n = f.length || 1, avg = f.reduce((a, b) => a + b, 0) / n;
      const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, a = window.__game.audMem();
      return { n, avg: +avg.toFixed(1), p95: Math.round(f[Math.floor(n * 0.95)] || 0), j50: f.filter((x) => x > 50).length, j100: f.filter((x) => x > 100).length, max: Math.round(f[n - 1] || 0), heap, aud: a.snd + a.mort, pk: window.__peak, name: window.__game.G.lv.name }; });
    const tot = mem.s + mem.o + (mem.w || 0) + (mem.r || 0) + r.aud + r.heap;
    console.log(JSON.stringify({ lvl, ...r, img: mem, toplamMB: tot, perf }));
    if (process.env.BIG) console.log(await p.evaluate(() => { const L = window.__game.memInfo(999).big, g = {}; for (const [k, v] of L) { const m = k.match(/^(enemy|unit|hero|pet|mortimer|tower|castle)_?([a-z0-9]*)/); const key = m ? m[1] + (m[1] === 'enemy' || m[1] === 'unit' || m[1] === 'hero' ? '_' + m[2] : '') : k; g[key] = (g[key] || 0) + v; } const suf = {}; for (const [k, v] of L) { const m = k.match(/_([a-z0-9]+)$/); suf[m[1]] = (suf[m[1]] || 0) + v; } return JSON.stringify({ n: L.length, gruplar: Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 25), ekler: Object.entries(suf).sort((a, b) => b[1] - a[1]).slice(0, 15) }); }));
  }
  console.log('hatalar', JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();

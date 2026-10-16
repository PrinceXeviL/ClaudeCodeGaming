// Öğretici testi (16 Eki, Caner: "tıklanması gereken yeri yanlış gösteriyorsun; sen de tıklayarak test et"):
// haritadaki ÖĞRETİCİ bölümünü baştan sona oynar: kartta ekrana, adımda OKUN GÖSTERDİĞİ NOKTAYA tıklar. Ok tıklandığı hâlde adım geçmiyorsa yazar.
// Kullanım (sunucu 8765'te açıkken): node tools/ogretici-test.js [hız=3]
const { chromium } = require('playwright');
const SPEED = +(process.argv[2] || 3);
(async () => {
  const b = await chromium.launch(); const VW = +(process.env.VW || 1170), VH = +(process.env.VH || 540); const p = await b.newPage({ viewport: { width: VW, height: VH } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForFunction(() => window.__game && window.__game.mapReady && window.__game.mapReady().img, null, { timeout: 60000 });
  await p.evaluate(() => window.__game.startLevel(0, 'o'));
  await p.waitForFunction(() => { const G = window.__game.G; return G && !G.loadWait; }, null, { timeout: 60000 });
  await p.evaluate((s) => window.__game.setSpeed(s), SPEED);
  const log = [], t0 = Date.now(); let last = -1, same = 0, bad = 0;
  for (let k = 0; k < 2000 && Date.now() - t0 < 600000; k++) {
    const st = await p.evaluate(() => window.__game.tutState());
    if (st.overlay) { log.push(`SON: ${st.overlay} (dalga ${st.wave})`); break; }
    if (st.none) { await p.waitForTimeout(300); continue; }
    if (st.i !== last) { if (last >= 0) log[log.length - 1] += `  → ${st.why}`; if (/süre|koşul/.test(st.why || '')) bad++; log.push(`${String(st.i).padStart(2)}/${st.n} ${st.card ? '[KART] ' : ''}${st.text}`); last = st.i; same = 0; } else same++;
    if (st.card) { await p.waitForTimeout(450); await p.mouse.click(VW / 2, VH * 0.55); await p.waitForTimeout(250); continue; }
    if (st.on && st.cl) {
      await p.mouse.click(st.cl.x, st.cl.y); await p.waitForTimeout(300);
      if (same === 10) { log.push(`   !! OK TIKLANIYOR AMA ADIM GEÇMİYOR: ok (${Math.round(st.at.x)}, ${Math.round(st.at.y)}) seçili=${st.sel} kip=${st.mode}`); bad++; }
      continue;
    }
    await p.waitForTimeout(250);
  }
  console.log(log.join('\n'));
  console.log(bad ? `SORUNLU ADIM: ${bad}` : 'OKLAR DOĞRU');
  if (errs.length) console.log('HATALAR', JSON.stringify([...new Set(errs)].slice(0, 10)));
  await b.close();
})();

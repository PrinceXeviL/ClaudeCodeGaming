// Sefer haritası zeminlerini önceden pişirir (12 Eki): img/map_bolge<N>.webp + img/map_bolge.json (taşma payı, ışık/sancak/el noktaları)
// ve bölüm kartı önizlemelerini tek atlasta: img/map_kartlar.webp (480x270 hücre, LEVELS sırası). Bölüm yolları/temaları değişince de çalıştır.
// Oyunda çizmek başlıkta her mekân için ~0,3-1 sn donduruyordu. Harita dekoru, temalar ya da EPISODES düğümleri değişince yeniden çalıştır.
// Sunucu 8765'te açıkken: node tools/harita-pisir.js   (taşma payı: 20:9 telefon ve 4:3 tablete yeter; daha geniş pencerede oyun kendisi çizer)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BX = 180, BY = 110, RES = 2, HI = 4, NT = 4; // 16 Eki: dikey bölge haritaları HI çözünürlükte NT şerit (map_bolge<N>_t<k>.webp) + RES'te yedek
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now());
  await p.waitForFunction(() => window.__game && window.__game.mapReady && window.__game.mapReady().img, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const eps = await p.evaluate(() => EPISODES.map((E, i) => (E.zones ? i + 1 : 0)).filter(Boolean));
  const img = path.join(__dirname, '..', 'img'), meta = {};
  for (const ep of eps) {
    const vert = await p.evaluate((ep) => !!EPISODES[ep - 1].vert, ep);
    const r = await p.evaluate(([ep, bx, by, res, nt]) => window.__game.bakeRegion(ep, bx, by, res, nt), [ep, BX, BY, vert ? HI : RES, vert ? NT : 0]);
    const file = `map_bolge${ep}.webp`;
    fs.writeFileSync(path.join(img, file), Buffer.from(r.data.split(',')[1], 'base64'));
    meta[ep] = { file, m: r.m, ext: r.ext, res: r.res, lights: r.lights, banners: r.banners, hands: r.hands }; // ext: dikey haritanın dünya kutusu
    if (r.tiles) meta[ep].tiles = r.tiles.map((t, k) => { const f = `map_bolge${ep}_t${k}.webp`; fs.writeFileSync(path.join(img, f), Buffer.from(t.data.split(',')[1], 'base64')); console.log(' ', f, Math.round(fs.statSync(path.join(img, f)).size / 1024) + ' KB'); return { file: f, y: t.y, h: t.h }; });
    console.log(file, r.w + 'x' + r.h, Math.round(fs.statSync(path.join(img, file)).size / 1024) + ' KB', 'ışık', r.lights.length, 'sancak', r.banners.length, 'el', r.hands.length);
  }
  fs.writeFileSync(path.join(img, 'map_bolge.json'), JSON.stringify(meta));
  const t = await p.evaluate(() => window.__game.bakeThumbs());
  fs.writeFileSync(path.join(img, 'map_kartlar.webp'), Buffer.from(t.data.split(',')[1], 'base64'));
  console.log('map_kartlar.webp', t.n, 'bölüm', t.w + 'x' + t.h, Math.round(fs.statSync(path.join(img, 'map_kartlar.webp')).size / 1024) + ' KB');
  console.log('hatalar', errs); await b.close();
})();

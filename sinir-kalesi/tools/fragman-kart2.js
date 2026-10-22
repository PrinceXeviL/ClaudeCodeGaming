// Fragman v2 yazıları (22 Eki): başlık kartları, altyazılar, "yakında", platform rozetleri (simge + ad). Oyunun yazı tipleri (sunucu 8765).
//   node tools/fragman-kart2.js <çıkış dizini> <ikon dizini: apple.svg android.svg steam.svg (simple-icons, CC0)>
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2], IK = process.argv[3];
const T = {
  tr: { cards: ['KULELERİNİ KUR', 'ÖLÜLERİ DİRİLT', 'EFSANELERİ ÇAĞIR', 'İMPARATORLUĞU EZ', 'YETER!'], soon: 'YAKINDA',
    subs: ['Her gece... hep aynı şey.', 'Tek istediğim... sessiz bir fincan kahve.', 'Ve her gece, İmparatorluk kapımı çalıyor.', 'Yeter!', 'Kemik. Veba. Şimşek. Seç birini.',
      'Kalkın dostlarım... misafirlerimiz var.', 'Bir de general getirmişler. Ne incelik.', 'Efsaneler... buyurun.', 'Şimdi... nerede kalmıştım?', "Necromancer'a bulaşma."] },
  en: { cards: ['BUILD YOUR TOWERS', 'RAISE THE DEAD', 'SUMMON LEGENDS', 'CRUSH THE EMPIRE', 'ENOUGH!'], soon: 'COMING SOON',
    subs: ['Every night... the same thing.', 'All I ask for... is one quiet cup of coffee.', 'And every night... the Empire comes knocking.', 'Enough!', 'Bones. Plague. Lightning. Pick your poison.',
      'Rise, my friends... we have guests.', 'Oh, they brought a general. How thoughtful.', 'Legends... if you please.', 'Now... where was I?', "Don't mess with the Necromancer."] },
};
const ico = (n) => fs.readFileSync(`${IK}/${n}.svg`, 'utf8').replace('<svg ', '<svg fill="#fff" width="64" height="64" ');
const css = `<link rel="stylesheet" href="http://localhost:8765/fonts/fonts.css"><style>html,body{margin:0;background:transparent}
.c{font-family:'Metal Mania';font-size:150px;letter-spacing:4px;color:#ffd75a;-webkit-text-stroke:14px #1a0610;paint-order:stroke fill;filter:drop-shadow(0 8px 0 #2a0a14) drop-shadow(0 0 26px rgba(255,70,50,.7));padding:30px 50px;white-space:nowrap;display:inline-block}
.r{color:#ff3b3b;font-size:230px;filter:drop-shadow(0 10px 0 #2a0000) drop-shadow(0 0 40px rgba(255,0,0,.8))}
.s{font-family:'Rubik';font-weight:700;font-size:54px;color:#fff;-webkit-text-stroke:9px #12060c;paint-order:stroke fill;padding:16px 30px;white-space:nowrap;display:inline-block}
.n{font-family:'Russo One';font-size:70px;color:#ffe9b0;-webkit-text-stroke:9px #1a0610;paint-order:stroke fill;padding:20px 40px;white-space:nowrap;display:inline-block;letter-spacing:8px}
.b{display:inline-flex;align-items:center;gap:22px;padding:22px 44px;border-radius:26px;background:linear-gradient(#2a1424,#12060e);border:4px solid #c9a865;box-shadow:0 8px 24px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.12);
 font-family:'Russo One';font-size:58px;color:#fff;margin:12px}</style>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 500 } });
  const shot = async (html, name) => { await p.setContent(css + `<span id=x>${html}</span>`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    await (await p.$('#x > *')).screenshot({ path: `${OUT}/${name}.png`, omitBackground: true }); };
  for (const [L, t] of Object.entries(T)) {
    for (const [i, c] of t.cards.entries()) await shot(`<span class="c${i === 4 ? ' r' : ''}">${c}</span>`, `${L}_kart${i + 1}`);
    await shot(`<span class=n>${t.soon}</span>`, `${L}_yakinda`);
    for (const [i, s] of t.subs.entries()) await shot(`<span class=s>${s}</span>`, `${L}_alt${i + 1}`);
  }
  for (const [n, label] of [['apple', 'iOS'], ['android', 'Android'], ['steam', 'Steam']]) await shot(`<span class=b>${ico(n)}<span>${label}</span></span>`, `rozet_${n}`);
  await b.close(); })();

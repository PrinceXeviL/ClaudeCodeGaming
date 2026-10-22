// fragman yazıları: oyunun yazı tipleriyle saydam PNG (Metal Mania başlık, Rubik altyazı)
const { chromium } = require('/Users/caner/Documents/Game Lab/kod/ClaudeCodeGaming/node_modules/playwright');
// node tools/fragman-kart.js <çıkış dizini>  (sunucu 8765 açık: yazı tipleri oradan)
const OUT = process.argv[2];
const T = {
  tr: { cards: ['KULELERİNİ KUR', 'ÖLÜLERİ DİRİLT', 'EFSANELERİ ÇAĞIR', 'İMPARATORLUĞU EZ'], soon: "YAKINDA GOOGLE PLAY'DE",
        subs: ["Tek istediğim... sessizce bir fincan kahveydi.", "Ama İmparatorluk yine kapımda.", "Peki. Kemik kuleler, veba kazanları... biraz da şimşek.", "Ve birkaç eski dost.", "Büyük hata.", "Necromancer'a bulaşma!"] },
  en: { cards: ['BUILD YOUR TOWERS', 'RAISE THE DEAD', 'SUMMON LEGENDS', 'CRUSH THE EMPIRE'], soon: 'COMING SOON ON GOOGLE PLAY',
        subs: ["All I wanted... was a quiet cup of coffee.", "But the Empire is at my door. Again.", "Fine. Bone towers, plague cauldrons... a little lightning.", "And a few old friends.", "Big mistake.", "Don't mess with the Necromancer!"] },
};
const css = `<link rel="stylesheet" href="http://localhost:8765/fonts/fonts.css"><style>html,body{margin:0;background:transparent}
.c{font-family:'Metal Mania';font-size:150px;letter-spacing:4px;color:#ffd75a;-webkit-text-stroke:14px #1a0610;paint-order:stroke fill;
 filter:drop-shadow(0 8px 0 #2a0a14) drop-shadow(0 0 26px rgba(255,70,50,.7));padding:30px 50px;white-space:nowrap;display:inline-block}
.s{font-family:'Rubik';font-weight:700;font-size:54px;color:#fff;-webkit-text-stroke:9px #12060c;paint-order:stroke fill;padding:16px 30px;white-space:nowrap;display:inline-block;text-shadow:0 4px 0 #000}
.n{font-family:'Russo One';font-size:64px;color:#fff4d8;-webkit-text-stroke:9px #1a0610;paint-order:stroke fill;padding:20px 40px;white-space:nowrap;display:inline-block;letter-spacing:3px}</style>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 400 } });
  const shot = async (cls, text, name) => { await p.setContent(css + `<span id=x class=${cls}>${text}</span>`); await p.waitForTimeout(400); await p.evaluate(() => document.fonts.ready);
    await (await p.$('#x')).screenshot({ path: `${OUT}/${name}.png`, omitBackground: true }); };
  for (const [L, t] of Object.entries(T)) { for (const [i, c] of t.cards.entries()) await shot('c', c, `${L}_kart${i + 1}`); await shot('n', t.soon, `${L}_yakinda`); for (const [i, s] of t.subs.entries()) await shot('s', s, `${L}_alt${i + 1}`); }
  await b.close(); })();

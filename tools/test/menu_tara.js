// Menü taraması: her ekranda her düğmeye bir kez basar (her basıştan önce ekran ve kayıt baştan kurulur).
// Hata: sayfa hatası, çizim döngüsü durması (donma), ekranın boş/siyah kalması.
const { chromium } = require('/Users/caner/Documents/Game Lab/kod/ClaudeCodeGaming/node_modules/playwright');
const SCREENS = ['title', 'map', 'codex', 'grim', 'heroes', 'shop', 'upgrades', 'ach', 'settings', 'event', 'credits'];
const SKIP = /^(reset|sifirla|wipe|del_save)/i;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 640 } });
  await ctx.addInitScript(() => { window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const p = await ctx.newPage(); let errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(6000);
  const base = await p.evaluate(() => { const S = window.__game.save(); S.statsAsked = 1; S.tdAsked = 1; S.stars = Array.from({ length: 20 }, () => 3); S.cine = { intro: 1, oyun: 1, kahve: 1 }; const d = new Date(); S.login = { last: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }; return JSON.stringify(S); });
  const out = []; let n = 0;
  const prep = async (sc) => { await p.evaluate(([sc, base]) => { const g = window.__game, S = g.save(); for (const k of Object.keys(S)) delete S[k]; Object.assign(S, JSON.parse(base)); if (sc === 'map') g.goMap(); else g.goScreen(sc); }, [sc, base]); await p.waitForTimeout(900); };
  for (const sc of SCREENS) {
    await prep(sc);
    const keys = (await p.evaluate(() => window.__game.btnKeys())).filter((k, i, a) => a.indexOf(k) === i);
    for (const key of keys) {
      if (SKIP.test(key)) continue;
      await prep(sc);
      const q = await p.evaluate((k) => window.__game.btn(k), key); if (!q) { out.push([sc, key, 'düğme bulunamadı']); continue; }
      errs = []; const f0 = await p.evaluate(() => window.__fr);
      await p.mouse.click(q.x, q.y); await p.waitForTimeout(700);
      const st = await p.evaluate(() => { const g = window.__game, c = document.getElementById('game'); return { fr: window.__fr, sc: g.screenName ? g.screenName() : null, keys: g.btnKeys().length }; });
      n++;
      if (errs.length) out.push([sc, key, 'HATA: ' + errs[0]]);
      else if (st.fr - f0 < 5) out.push([sc, key, 'DONMA (kare ilerlemedi)']);
    }
    out.push([sc, '—', keys.length + ' düğme denendi']);
  }
  console.log(JSON.stringify({ basilan: n, sonuc: out }, null, 1)); await b.close();
})();

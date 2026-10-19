// 19 Eki (Caner: "düşmanların girdiği yolun ağzına yakın arsa olmasın; üstteki/alttaki düğmeleri hesaba kat, yanlışlıkla tıklanmasın"):
// her bölümü iki ekran oranında (16:9 masaüstü, geniş iPhone) açar; arayüz dokunma alanlarını (__game.uiZones) ve yolların görünür ekrana
// girdiği noktayı ölçer. İhlal: kule gövdesi (arsanın 82 yukarısı, ±30 yana) bir düğmeye MARGIN'den yakın, ya da arsa yol ağzına ENTRY'den yakın.
// İhlal eden arsa en yakın uygun yere taşınır (yola uzaklık kuralı, kale, öteki arsalar, yolu görme oranı korunur).
// Kullanım (sunucu 8765'te açıkken): node tools/arsa-ui-denetim.js [--apply]
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'js', 'data.js');
const ENTRY = 150, MARGIN = 10, ROAD_MIN = 66, GAP = 72;
const ASPECTS = [[1280, 720, 'masaüstü'], [852, 393, 'iPhone']];
(async () => {
  const b = await chromium.launch(); const per = [];
  for (const [vw, vh, nm] of ASPECTS) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    await p.goto('http://localhost:8765/index.html?' + Date.now()); await p.waitForTimeout(5000);
    const n = await p.evaluate(() => LEVELS.length);
    const out = [];
    for (let li = 0; li < n; li++) {
      const r = await p.evaluate(async (li) => {
        const g = window.__game; g.startLevel(li); await new Promise(r => setTimeout(r, 900));
        const G = g.G; G.comic = null; g.setOverlay(null); G.banner = null; await new Promise(r => setTimeout(r, 400));
        const o = g.w2u(0, 0), ax = g.w2u(100, 0), ay = g.w2u(0, 100), A = { ox: o.x, oy: o.y, kx: (ax.x - o.x) / 100, ky: (ay.y - o.y) / 100 };
        const { VIS } = g.vis(), inV = (x, y) => { const q = g.w2u(x, y); return q.x > VIS.l + 4 && q.x < VIS.r - 4 && q.y > VIS.t + 4 && q.y < VIS.b - 4; };
        const entries = G.paths.map(P => { const pts = P.pts; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], c = pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]); for (let t = 0; t <= L; t += 4) { const x = a[0] + (c[0] - a[0]) * t / L, y = a[1] + (c[1] - a[1]) * t / L; if (inV(x, y)) return [x, y]; } } return pts[0]; });
        return { A, zones: g.uiZones(), entries, plots: G.plots.map(q => [q.x, q.y]), data: LEVELS[li].plots, paths: G.paths.map(P => P.pts), castle: [G.castle.x, G.castle.y], wide: LEVELS[li].roadWide || 1, name: LEVELS[li].name };
      }, li);
      out.push(r);
    }
    per.push(out); await p.close();
  }
  await b.close();
  const L0 = per[0], fixes = [];
  const toW = (A, x, y) => [(x - A.ox) / A.kx, (y - A.oy) / A.ky];
  L0.forEach((lv, li) => {
    const views = per.map(v => v[li]);
    const zonesW = views.flatMap(v => v.zones.map(z => z.rect ? { rect: true, x0: toW(v.A, z.x, z.y)[0], y0: toW(v.A, z.x, z.y)[1], x1: toW(v.A, z.x + z.w, z.y + z.h)[0], y1: toW(v.A, z.x + z.w, z.y + z.h)[1], tag: z.tag } : { x: toW(v.A, z.x, z.y)[0], y: toW(v.A, z.x, z.y)[1], r: (z.r + MARGIN) / v.A.kx, tag: z.tag }));
    const entries = views.flatMap(v => v.entries);
    const pts = lv.paths.flat(), RML = ROAD_MIN * lv.wide;
    const dPath = (x, y) => { let d = 1e9; for (const P of lv.paths) for (let i = 0; i < P.length - 1; i++) { const a = P[i], c = P[i + 1], dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)); } return d; };
    const rectHit = (x, y, z) => { const X0 = x - 30, X1 = x + 30, Y0 = y - 82, Y1 = y + 8; if (z.rect) return X1 > z.x0 && X0 < z.x1 && Y1 > z.y0 && Y0 < z.y1; const cx = Math.max(X0, Math.min(z.x, X1)), cy = Math.max(Y0, Math.min(z.y, Y1)); return Math.hypot(z.x - cx, z.y - cy) < z.r; };
    const why = (x, y) => { if (y - 82 < 40) return 'ekran üstü'; const z = zonesW.find(z => rectHit(x, y, z)); if (z) return 'arayüz:' + z.tag; if (entries.some(e => Math.hypot(e[0] - x, e[1] - y) < ENTRY)) return 'yol ağzı'; return null; };
    const castleBad = (x, y) => Math.abs(x - lv.castle[0]) < 90 && y > lv.castle[1] - 140 && y < lv.castle[1] + 50;
    const cover = (x, y) => { let n = 0; for (const P of lv.paths) for (let i = 0; i < P.length - 1; i++) { const a = P[i], c = P[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]); for (let t = 0; t < L; t += 8) { const qx = a[0] + (c[0] - a[0]) * t / L, qy = a[1] + (c[1] - a[1]) * t / L; if (Math.hypot(qx - x, (qy - y) * 1.1) < 125) n++; } } return n; };
    const plots = lv.plots.map(q => q.slice());
    plots.forEach((pl, k) => {
      const w = why(pl[0], pl[1]); if (!w) return;
      const c0 = cover(pl[0], pl[1]); let best = null;
      // önce yakında ve yolu eskisi kadar gören yer; bulunmazsa daha geniş alanda, yolu daha az gören yer de kabul
      for (const [R, cvK, far, gap] of [[240, 0.7, 40, GAP], [360, 0.5, 60, GAP], [480, 0.35, 80, GAP], [520, 0.2, 120, GAP - 10]]) {
        let bs = -1e9;
        for (let dx = -R; dx <= R; dx += 6) for (let dy = -R; dy <= R; dy += 6) {
          const x = Math.round(pl[0] + dx), y = Math.round(pl[1] + dy);
          if (x < 40 || x > 920 || y < 100 || y > 520) continue;
          if (why(x, y) || castleBad(x, y)) continue;
          const dp = dPath(x, y); if (dp < RML || dp > RML + far) continue;
          if (plots.some((o, j) => j !== k && o && Math.hypot(o[0] - x, (o[1] - y) * 1.3) < gap)) continue;
          const cv = cover(x, y); if (cv < c0 * cvK) continue;
          const sc = cv * 1.5 - Math.hypot(dx, dy) * 0.6;
          if (sc > bs) { bs = sc; best = [x, y]; }
        }
        if (best) break;
      }
      fixes.push({ li, name: lv.name, k, from: pl.slice(), to: best, why: w });
      plots[k] = best; // yer yoksa arsa kalkar
    });
    lv._fixed = plots.filter(Boolean); lv._same = JSON.stringify(lv.plots) === JSON.stringify(lv.data);
  });
  for (const f of fixes) console.log(`${f.li + 1}. ${f.name} arsa ${f.k}: [${f.from}] (${f.why}) -> ${f.to ? '[' + f.to + ']' : 'YER YOK (arsa kalkar)'}`);
  console.log(fixes.length + ' ihlal, ' + fixes.filter(f => !f.to).length + ' yer bulunamadı; veriyle oyundaki arsa farklı bölüm: ' + L0.filter(l => !l._same).map(l => l.name).join(', '));
  if (process.argv[2] === '--apply') {
    let src = fs.readFileSync(DATA, 'utf8'), n = 0; const used = new Set();
    src = src.replace(/plots: (\[\[[^\n]*?\]\])(?=,| \})/g, (m, a) => {
      const key = JSON.stringify(JSON.parse(a)), i = L0.findIndex((l, k) => !used.has(k) && l._same && JSON.stringify(l.data) === key);
      if (i < 0) return m; used.add(i); if (JSON.stringify(L0[i]._fixed) === key) return m; n++;
      return 'plots: ' + JSON.stringify(L0[i]._fixed);
    });
    fs.writeFileSync(DATA, src); console.log(n + ' bölümün arsaları yazıldı');
  }
})();

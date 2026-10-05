// Arsa denetimi: kule gövdesi (arsanın ~80 px yukarısına uzanır) dalga düğmesine ve arayüze taşmasın.
// Ayrıca arsa yolun kenarına taşmasın: merkezi yol ortasından en az ROAD_MIN px uzakta olmalı (yol genişleyince büyüt).
// Kullanım: node tools/arsa-denetim.js js/data.js [düzeltilmiş.json | --apply]  → ihlalleri ve önerilen yeni yerleri yazar;
// --apply önerilen yerleri doğrudan data.js'e yazar.
const fs = require('fs');
eval(fs.readFileSync(process.argv[2], 'utf8') + ';global.LEVELS=LEVELS;');
const W = 960, H = 540, ROAD = 33, ROAD_MIN = +(process.env.ROAD_MIN || 66);
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
function smoothPts(pts, step = 5) {
  if (pts.length < 3) return pts;
  const P = [pts[0].map((v, k) => 2 * v - pts[1][k]), ...pts, pts[pts.length - 1].map((v, k) => 2 * v - pts[pts.length - 2][k])];
  const out = [pts[0]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const tj = (a, b) => Math.pow(Math.max(1e-4, dist(a[0], a[1], b[0], b[1])), 0.5);
    const t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    const n = Math.max(2, Math.ceil(dist(p1[0], p1[1], p2[0], p2[1]) / step));
    for (let j = 1; j <= n; j++) {
      const t = t1 + (t2 - t1) * j / n;
      out.push([0, 1].map(k => {
        const A1 = (t1 - t) / t1 * p0[k] + t / t1 * p1[k], A2 = (t2 - t) / (t2 - t1) * p1[k] + (t - t1) / (t2 - t1) * p2[k], A3 = (t3 - t) / (t3 - t2) * p2[k] + (t - t2) / (t3 - t2) * p3[k];
        const B1 = (t2 - t) / t2 * A1 + t / t2 * A2, B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        return (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      }));
    }
  }
  return out;
}
function cum(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return c; }
function at(pts, c, d) { let i = 1; while (i < pts.length - 1 && c[i] < d) i++; const a = pts[i - 1], b = pts[i], L = c[i] - c[i - 1] || 1, t = (d - c[i - 1]) / L; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
// oyundaki waveButtonPos ile aynı kural
const hudBlock = (x, y) => x < 26 || x > W - 26 || y < 26 || y > H - 26 || (x < 300 && y < 64) || (x > W - 180 && y < 74) || (x < 280 && y > H - 92);
function waveBtn(pts) { const c = cum(pts), T = c[c.length - 1]; let d = 0, q = at(pts, c, 0); while (d < T - 40 && hudBlock(q[0], q[1])) { d += 3; q = at(pts, c, d); } return at(pts, c, d + 8); }
// arsa kuralı: kule gövdesi (arsanın 80 px yukarısı, ±32 px yana) üst arayüze ve dalga düğmesine taşmasın
function bad(x, y, btns) {
  const top = y - 80;
  if (top < 74 && (x < 300 || x > W - 200)) return 'üst arayüz';     // sol üst göstergeler / sağ üst düğmeler
  if (top < 40) return 'ekran üstü';
  if (y > H - 110 && x < 330) return 'sol alt arayüz';              // kahraman / güç düğmeleri
  if (x < 36 || x > W - 36 || y > H - 30) return 'kenar';
  for (const b of btns) if (dist(x, y - 30, b[0], b[1]) < 80 || dist(x, y, b[0], b[1]) < 70) return 'dalga düğmesi';
  return null;
}
const fixes = [];
LEVELS.forEach((lv, li) => {
  const ps = lv.paths.map(p => smoothPts(p)), btns = ps.map(waveBtn);
  const dPath = (x, y) => Math.min(...ps.map(p => Math.min(...p.map(q => Math.hypot(q[0] - x, q[1] - y)))));
  const castleBad = (x, y) => Math.abs(x - lv.castle[0]) < 90 && y > lv.castle[1] - 140 && y < lv.castle[1] + 50;
  const plots = lv.plots.map(p => p.slice());
  plots.forEach((pl, k) => {
    const why = bad(pl[0], pl[1], btns) || (dPath(pl[0], pl[1]) < ROAD_MIN ? 'yola yakın' : null);
    if (!why) return;
    // en yakın uygun yer: yol kenarı adayları (yoldan 60-95 px), diğer arsalara en az 72 px
    let best = null, bd = 1e9;
    for (const p of ps) for (let i = 0; i < p.length; i += 2) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      for (const s of [-1, 1]) for (const off of [ROAD_MIN, ROAD_MIN + 6, ROAD_MIN + 12, ROAD_MIN + 18, ROAD_MIN + 26]) {
        const x = Math.round(p[i][0] - dy / l * off * s), y = Math.round(p[i][1] + dx / l * off * s);
        if (bad(x, y, btns) || castleBad(x, y)) continue;
        const dp = dPath(x, y); if (dp < ROAD_MIN || dp > ROAD_MIN + 36) continue;
        if (plots.some((o, j) => j !== k && Math.hypot(o[0] - x, (o[1] - y) * 1.3) < 72)) continue;
        const d = Math.hypot(x - pl[0], y - pl[1]);
        if (d < bd) { bd = d; best = [x, y]; }
      }
    }
    fixes.push({ li, k, from: pl.slice(), to: best, why });
    if (best) plots[k] = best;
  });
  lv._fixed = plots;
});
for (const f of fixes) console.log(`${f.li + 1}. bölüm arsa ${f.k}: [${f.from}] (${f.why}) -> ${f.to ? '[' + f.to + ']' : 'YER YOK'}`);
if (process.argv[3] === '--apply') {
  let src = fs.readFileSync(process.argv[2], 'utf8'), n = 0;
  src = src.replace(/plots: \[\[[^\n]*?\]\],/g, (m) => { const P = LEVELS[n++]._fixed; return 'plots: ' + JSON.stringify(P).replace(/,/g, ', ').replace(/\], \[/g, '], [') + ','; });
  fs.writeFileSync(process.argv[2], src); console.log(n + ' bölümün arsaları yazıldı');
} else if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(LEVELS.map(l => l._fixed)));
if (!fixes.length) console.log("Tüm arsalar uygun.");

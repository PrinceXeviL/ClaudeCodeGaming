// Arsa üretici: her bölümde kule arsalarını yollara göre otomatik yerleştirir ve data.js'e yazar.
// Kurallar: arsa (elips 28x16) yolun dalgalı kenarına değmez, ekran kenarından/arayüzden/kaleden/dalga düğmesinden uzak,
// arsalar arası boşluk yeterli. Seçim açgözlüdür: yol kıvrımlarını ve kavşakları en çok gören yer önce seçilir,
// seçilen yerin gördüğü yol parçalarının ağırlığı düşer (arsalar yol boyunca yayılır).
// Kullanım: node tools/arsa-uret.js js/data.js [bölüm numaraları, ör. 1,2,3] [--dry]
const fs = require('fs');
const file = process.argv[2], only = (process.argv[3] && process.argv[3] !== '--dry') ? process.argv[3].split(',').map(n => +n - 1) : null, dry = process.argv.includes('--dry');
eval(fs.readFileSync(file, 'utf8') + ';global.LEVELS=LEVELS;');
const W = 960, H = 540;
const ROAD_HALF = 46, CLEAR = 5, PLOT_RX = 28, PLOT_RY = 16, SPACING = 84, RANGE = 150;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const src = fs.readFileSync(__dirname + '/arsa-denetim.js', 'utf8');
eval(src.slice(src.indexOf('function smoothPts'), src.indexOf('function cum(')));
function cum(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return c; }
function at(pts, c, d) { let i = 1; while (i < pts.length - 1 && c[i] < d) i++; const a = pts[i - 1], b = pts[i], L = c[i] - c[i - 1] || 1, t = (d - c[i - 1]) / L; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
const hudBlock = (x, y) => x < 26 || x > W - 26 || y < 26 || y > H - 26 || (x < 300 && y < 64) || (x > W - 180 && y < 74) || (x < 280 && y > H - 92);
function waveBtn(pts) { const c = cum(pts), T = c[c.length - 1]; let d = 0, q = at(pts, c, 0); while (d < T - 40 && hudBlock(q[0], q[1])) { d += 3; q = at(pts, c, d); } return at(pts, c, d + 8); }
function dseg(x, y, p) { let m = 1e9; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1], dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)); } return m; }

const result = LEVELS.map((lv, li) => {
  if (only && !only.includes(li)) return lv.plots;
  const ps = lv.paths.map(p => smoothPts(p)), E = lv.entr || lv.paths.length;
  const btns = ps.slice(0, E).map(waveBtn), cx = lv.castle[0], cy = lv.castle[1];
  const dRoad = (x, y) => Math.min(...ps.map(p => dseg(x, y, p)));
  // yol ağzı: düşmanların ekrana girdiği yerden ilk 150 px boyunca yanına arsa konmaz (game.js PLOT_ENTRY ile aynı)
  const EZ = [];
  for (const p of ps.slice(0, E)) { const c = cum(p), T = c[c.length - 1]; let d0 = 0; while (d0 < T) { const q = at(p, c, d0); if (q[0] > 0 && q[1] > 0 && q[0] < W && q[1] < H) break; d0 += 4; } for (let d = d0; d < Math.min(T, d0 + 150); d += 6) EZ.push(at(p, c, d)); }
  // yol örnekleri (kapsama hesabı için), ekran içindekiler
  const S = [];
  for (const p of ps) { const c = cum(p), T = c[c.length - 1]; for (let d = 0; d < T; d += 8) { const q = at(p, c, d); if (q[0] > 0 && q[0] < W && q[1] > 0 && q[1] < H && !S.some(s => dist(s.x, s.y, q[0], q[1]) < 6)) S.push({ x: q[0], y: q[1], w: 1 }); } }
  const ok = (x, y) => {
    if (x < 64 || x > W - 74 || y < 132 || y > H - 38) return false;          // kenar payı (kule gövdesi ~80 px yukarı uzanır)
    if (x < 335 && y > 425) return false;                                     // sol alt: kahraman/güç düğmeleri
    if (x > W - 190 && y < 160) return false;                                 // sağ üst düğmeler
    if (Math.abs(x - cx) < 88 && y > cy - 150 && y < cy + 48) return false;   // kale
    for (const b of btns) if (dist(x, y, b[0], b[1]) < 72 || dist(x, y - 40, b[0], b[1]) < 60) return false;
    for (const q of EZ) if (dist(x, y, q[0], q[1]) < 96) return false;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (dRoad(x + Math.cos(a) * PLOT_RX, y + Math.sin(a) * PLOT_RY) < ROAD_HALF + CLEAR) return false; }
    return true;
  };
  const cands = [];
  for (let y = 132; y <= H - 38; y += 6) for (let x = 64; x <= W - 74; x += 6) if (ok(x, y)) cands.push([x, y]);
  const plots = [];
  while (plots.length < lv.plots.length && cands.length) {
    let best = null, bs = -1;
    for (const c of cands) {
      if (plots.some(p => Math.hypot(p[0] - c[0], (p[1] - c[1]) * 1.25) < SPACING)) continue;
      let s = 0; for (const q of S) { const d = dist(c[0], c[1] - 10, q.x, q.y); if (d < RANGE) s += q.w * (1 - d / RANGE * 0.5); }
      if (s > bs) { bs = s; best = c; }
    }
    if (!best) break;
    plots.push(best);
    for (const q of S) if (dist(best[0], best[1] - 10, q.x, q.y) < RANGE) q.w *= 0.5;
  }
  console.log(`${li + 1}. ${lv.name}: ${plots.length}/${lv.plots.length} arsa`);
  return plots;
});
if (!dry) {
  let text = fs.readFileSync(file, 'utf8'), n = 0;
  const start = text.indexOf('const LEVELS = [');
  let head = text.slice(0, start), body = text.slice(start);
  body = body.replace(/plots: \[\[[^\n]*?\]\](?=[ ,])/g, () => { const P = result[n++]; return 'plots: ' + JSON.stringify(P); });
  fs.writeFileSync(file, head + body); console.log(n + ' bölüm yazıldı');
}

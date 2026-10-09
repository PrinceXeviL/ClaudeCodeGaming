// Sol alttaki arayüzün (komutan portresi + büyü düğmeleri) altından yol geçmesin: yol kontrol noktaları bu köşeden itilir.
// Kullanım: node tools/hud-yol-duzelt.js js/data.js [--dry]   (sonra: node tools/arsa-uret.js js/data.js <değişen bölümler>)
// Aynı koordinatlı noktalar aynı yere taşınır (kollar ortak gövdeyi paylaşmaya devam eder).
const fs = require('fs'); global.window = {}; global.dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const file = process.argv[2], dry = process.argv.includes('--dry');
const src = fs.readFileSync(__dirname + '/arsa-denetim.js', 'utf8');
eval(src.slice(src.indexOf('function smoothPts'), src.indexOf('function cum(')));
const RECTS = [[10, 440, 145, 540], [85, 468, 378, 540]], HALF = 22 * 1.57, CLEAR = 12, M = HALF + CLEAR;
const dRect = (x, y, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - y, 0, y - r[3]));
const dZone = (x, y) => Math.min(...RECTS.map(r => dRect(x, y, r)));
function push([x, y], m) {
  if (x < 0) return [x, Math.min(y, RECTS[0][1] - m)];                 // soldan giriş: düğmelerin üstünden
  if (y > 540) return [Math.max(x, RECTS[1][2] + m), y];                // alttan giriş: düğmelerin sağından
  if (dZone(x, y) >= m) return [x, y];
  const up = x <= RECTS[0][2] + m ? RECTS[0][1] - m : RECTS[1][1] - m;  // yukarı it ya da sağa it: hangisi az oynatıyorsa
  const right = RECTS[1][2] + m;
  return Math.abs(y - up) <= Math.abs(x - right) ? [x, Math.min(y, up)] : [Math.max(x, right), y];
}
function worst(paths) {
  let w = { d: 1e9 };
  paths.forEach((p, pi) => { const ps = smoothPts(p); for (let k = 0; k < ps.length - 1; k++) for (let t = 0; t <= 1; t += 0.1) {
    const x = ps[k][0] + (ps[k + 1][0] - ps[k][0]) * t, y = ps[k][1] + (ps[k + 1][1] - ps[k][1]) * t, d = dZone(x, y) - HALF;
    if (d < w.d) w = { d, x, y, pi }; } });
  return w;
}
let text = fs.readFileSync(file, 'utf8'), changed = [], li = 0;
text = text.replace(/^(  \{ paths: )(\[\[\[.*?\]\]\])(, plots:)/gm, (all, a, ps, b) => {
  li++;
  let paths = JSON.parse(ps), w0 = worst(paths);
  if (w0.d >= CLEAR) return all;
  // alttan sol köşeden giren yol: girişten itibaren alt banttaki noktalar birlikte düğmelerin sağına kayar
  paths = paths.map(p => { if (!(p[0][1] > 540 && p[0][0] < RECTS[1][2] + M)) return p; const q = p.map(v => v.slice());
    for (let k = 0; k < q.length && q[k][1] > RECTS[1][1] - M - 30; k++) q[k][0] = Math.max(q[k][0], RECTS[1][2] + M + 10); return q; });
  for (let it = 0, m = M; it < 12; it++, m += 6) {
    const map = new Map();
    paths = paths.map(p => p.map(q => { const k = q.join(','); if (!map.has(k)) map.set(k, push(q, m)); return map.get(k).map(Math.round); }));
    if (worst(paths).d >= CLEAR) break;
  }
  const w1 = worst(paths);
  changed.push(li); console.log(`${li}. bölüm: ${w0.d.toFixed(0)} px -> ${w1.d.toFixed(0)} px`);
  return a + JSON.stringify(paths) + b;
});
if (!dry) fs.writeFileSync(file, text);
console.log('değişen:', changed.join(','));

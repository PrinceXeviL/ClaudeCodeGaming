// 19 Eki: Google Play'de ana paket en çok 200 MB. cap sync oyunu android/app/src/main/assets/public'e kopyalar (~370 MB);
// bu betik görselleri (public/img) kurulumda gelen varlık paketine (android/oyunvarlik) taşır. Kurulunca ikisi aynı AssetManager'da birleşir,
// Capacitor dosyaları yine "public/img/..." yolundan sunar. Sıra: cap sync android → yerel_temizle.js → bu betik.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = path.join(ROOT, 'android/app/src/main/assets/public/img');
const dst = path.join(ROOT, 'android/oyunvarlik/src/main/assets/public/img');
if (!fs.existsSync(src)) { console.log('img yok (önce cap sync)'); process.exit(0); }
fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.renameSync(src, dst);
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log('ana paket', (size(path.join(ROOT, 'android/app/src/main/assets/public')) / 1e6).toFixed(1), 'MB · varlık paketi', (size(dst) / 1e6).toFixed(1), 'MB');

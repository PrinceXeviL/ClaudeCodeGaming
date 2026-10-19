// Mağaza derlemesi (19 Eki): cap sync'ten sonra iOS/Android kopyasındaki index.html'e window.MAGAZA = true yazar.
// game.js: MAGAZA → TEST_OPEN kapalı (her şey kilitli başlar, admin/deneme düğmeleri yok), sahte reklam ve ödemesiz satın alma yok.
// Kullanım: npm run magaza:ios / npm run magaza:android. Geliştirme kurulumu (npm run ios/android) test sürümü olarak kalır.
const fs = require('fs'), path = require('path');
const yerler = ['ios/App/App/public/index.html', 'android/app/src/main/assets/public/index.html'];
const ISARET = '<script>window.MAGAZA = true;</script>';
let n = 0;
for (const y of yerler) {
  const p = path.join(__dirname, '..', y);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(ISARET)) { s = s.replace('<script>', ISARET + '\n<script>'); fs.writeFileSync(p, s); }
  n++; console.log('mağaza sürümü:', y);
}
if (!n) { console.error('public/index.html bulunamadı (önce cap sync)'); process.exit(1); }

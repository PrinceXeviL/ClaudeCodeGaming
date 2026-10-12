// Mağaza paketini küçültür (11 Eki): `npx cap sync` web klasörünü (sinir-kalesi) iOS ve Android'e olduğu gibi kopyalar.
// Bu betik kopyadan oyunun hiç açmadığı dosyaları siler; depodaki asıl klasöre dokunmaz.
//   - ses/*_N.wav: kısa seslerin tek tek kopyaları (oyun hepsini ses/paket.wav'dan okur; game.js "Paket yoksa tek tek WAV")
//   - img/ içinde manifest.json'da olmayan görseller (oyun görselleri yalnız manifest üzerinden yükler)
//   - tools/ (test araçları), yayin.html (claude.ai yayın sayfası)
// Kullanım: npm run android | npm run ios (ikisi de önce cap sync, sonra bu betik)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIRS = [path.join(ROOT, 'android/app/src/main/assets/public'), path.join(ROOT, 'ios/App/App/public')];

for (const pub of DIRS) {
  if (!fs.existsSync(pub)) continue;
  let n = 0, bytes = 0;
  const rm = (p) => { const st = fs.statSync(p); bytes += st.isDirectory() ? 0 : st.size; fs.rmSync(p, { recursive: true, force: true }); n++; };
  const ses = path.join(pub, 'ses');
  if (fs.existsSync(path.join(ses, 'paket.wav')))
    for (const f of fs.readdirSync(ses)) if (/_\d+\.wav$/.test(f)) rm(path.join(ses, f));
  const img = path.join(pub, 'img'), manP = path.join(img, 'manifest.json');
  if (fs.existsSync(manP)) {
    const man = new Set(JSON.parse(fs.readFileSync(manP, 'utf8')));
    for (const f of fs.readdirSync(img)) if (!f.endsWith('.json') && !man.has(f) && !/^(map_|atlas_)/.test(f)) rm(path.join(img, f)); // map_*: önceden pişirilmiş harita zeminleri, atlas_*: küçük görsel sayfaları (kod doğrudan yükler)
  }
  for (const f of ['tools', 'yayin.html']) if (fs.existsSync(path.join(pub, f))) rm(path.join(pub, f));
  console.log(path.relative(ROOT, pub) + ': ' + n + ' dosya silindi, ' + (bytes / 1e6).toFixed(1) + ' MB');
}

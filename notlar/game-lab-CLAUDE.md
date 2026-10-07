# Game Lab — Oyun Geliştirme Projesi

Caner'in üçüncü projesi (Backtest Lab / Chart Trials ve Maya Vale'den tamamen ayrı).
"Game Lab" çalışma adı; oyunun geçici adı "Sınır Kalesi". Başlangıç: 3 Eki 2026.

## Çalışma şekli (Caner'in isteği)

- Kısa, adım adım. Her seferinde tek adım; Caner yapınca sonrakine geç.
- Gereksiz onay/övgü yok. Kötü fikir varsa doğrudan söyle, alternatif sun.
- Yaratıcı/teknik kararları kendin ver, sonucu kısaca bildir. Para harcama,
  hesap açma ve geri dönüşü olmayan işler için sor.
- Durum: PROTOTİP (v0.3, 10 bölüm). Caner'in revizeleriyle ilerle.

## GÜNCEL KOD NEREDE (önemli)

- Güncel oyun: `kod/ClaudeCodeGaming/sinir-kalesi/` — GitHub deposu PrinceXeviL/ClaudeCodeGaming,
  dal `claude/google-ai-studio-image-generation-hvravc` (main yok). Ayrıntılı devir notu: `kod/ClaudeCodeGaming/CLAUDE.md`.
- 4–5 Ekim'de oyun bulut oturumunda (claude.ai/code) geliştirildi; yerel kopya geride kaldı.
  İşe başlamadan `git pull` yap. Eskimiş kopyalar: `kod/www/` (3 Ekim) ve `kod/www-v03/` (geçiş kopyası), bunları kullanma.
- Yayın: `sinir-kalesi/yayin.html` + değişen dosyalar `files` ile aynı Artifact URL'ine.
- Oyun artık "Don't Mess with the Necromancer" (tek sefer, 5 bölüm). Eski seferlerin dosyaları 8 Eki'de silindi (git geçmişinde).
- Görseller: `varliklar/ham/nm_*.jpg` → `python3 varliklar/nm_isle.py [sayfa.jpg]`; kare kare animasyon: `varliklar/anim_isle.py` + poz kılavuzları.

## Konsept (kararlar)

- Tür: Kingdom Rush tarzı tower defense. Mekanik klon serbest; isim, görsel,
  ses, seviye düzeni KR'den kopyalanmaz (Apple klon kuralı, telif).
- Platform: mobil (App Store + Google Play), yatay ekran.
- Teknik: HTML5 Canvas + vanilla JS, bağımlılık yok (`kod/ClaudeCodeGaming/sinir-kalesi/`).
  Mağaza için Capacitor ile sarılacak (webDir = `sinir-kalesi`).
- Denge değerleri tek yerde: `sinir-kalesi/js/data.js`. Ölçekler `game.js` başında: UNIT_K, BUILD_K, ROAD_K, ZOOM_MAX.
  Hava: bölümde `weather: 'rain'|'snow'`, ayarlar `WEATHER` (data.js).
- Görseller: Caner Gemini (Nano Banana) ile üretir → `varliklar/ham/*.jpg`
  (promptlar `tasarim/gemini-promptlari.md`). `varliklar/gorsel_isle.py` (numpy, scipy,
  pillow gerekir) arka planı siler, parçalar. 1. sefer betikleri (gorsel_isle, sprite_uret, doku_uret)
  artık `varliklar/cikti/` içine yazar (canlı img/ manifestini ezmesinler; gerekeni elle kopyala).
  `sefer2_isle.py` doğrudan `sinir-kalesi/img/` içine yazar ve manifest/meta'ya ekler.
  Yol dokuları: `ham/yol_toprak.jpg`, `yol_kum.jpg` → `yol_isle.py` (dikişsiz karo) → `img/road_dirt.jpg`, `road_sand.jpg`.
  Oyun içi boyutlar `game.js` başında: CHAR_H, TOWER_K, TREE_K, ROCK_K.
  Önizleme: `/onizleme.html?h=200&f=tower`.
- Kale: her bölümde `castle` konumu (data.js), yollar kale kapısında biter; düşman kapıda bir kez vurur,
  kale canı (lives) düşer. Sprite `castle_1..3` (hasar evresi) yoksa kışla_3 yedek.
- Kahraman yetenekleri HERO.skills (data.js), mantık `useSkill` (game.js).
- Sesler: Kenney CC0 paketleri → `sinir-kalesi/ses/*.wav` + manifest; ayarlar `SOUND` (game.js).
- Oynanabilir bağlantı (Artifact): https://claude.ai/artifact/8P186cq2J4UkEbF8QzEmFp
  Yayın sayfası `sinir-kalesi/yayin.html`; değişiklikten sonra aynı dosyayla yeniden yayınla.
- Çalıştırma: `.claude/launch.json` → "oyun" (python http.server :8765, sinir-kalesi klasörü).
  Test kancası: `window.__game` (startLevel, build, upgrade, wave, sim).

## Açık sorular

- Kalıcı oyun adı, gelir modeli. AI ile boyanmış görsellere geçiş (kredi gerekir) opsiyonel.

## Klasörler ve yedek

Her şey GitHub deposunda: `notlar/`, `arastirma/`, `tasarim/`, `varliklar/` ve bu dosya
(`notlar/game-lab-CLAUDE.md`) depoda durur; Game Lab kökündekiler depoya sembolik bağdır.
Depo HERKESE AÇIK (public). Push için anahtar Mac anahtar zincirinde (osxkeychain).

- `notlar/` — beyin fırtınası ve karar notları
- `arastirma/` — pazar, rakip ve referans araştırmaları
- `tasarim/` — oyun tasarım dokümanı (GDD), mekanikler, seviye taslakları
- `kod/ClaudeCodeGaming/` — depo (oyun + yukarıdakiler)
- `varliklar/` — görsel, ses, müzik

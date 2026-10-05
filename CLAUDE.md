# Sınır Kalesi — devir notu

Kingdom Rush tarzı tarayıcı kule savunma oyunu. Saf HTML5 Canvas + vanilla JS, derleme adımı yok.
Kullanıcı Türkçe konuşur; yanıtlar ve koddaki yorumlar Türkçe.

## Çalıştırma
```
cd sinir-kalesi && python3 -m http.server 8765   # http://localhost:8765
```
Yayınlanan sürüm (claude.ai artifact): https://claude.ai/artifact/8P186cq2J4UkEbF8QzEmFp

## Dosyalar
- `sinir-kalesi/js/data.js` — tüm veriler: TOWERS (seviyeler, `title` unvanları, yetenekler), ENEMIES
  (`wk` zayıflık/direnç, bosslarda `chief`, `ab` yetenekler, `hpK`), BOSS_ESCORT, LEVELS (dalgalar, `hpMul`),
  HEROES/HERO_SKILLS, SPELLS, UPGRADES, GAME_DIFF (sabit zorluk).
- `sinir-kalesi/js/game.js` — tek IIFE içinde oyun mantığı ve çizim (~5000 satır). Mantıksal çözünürlük 960x540.
  Test kancası: `window.__game` (G, startLevel, build, upgrade, wave, sim, cast, kill, ...).
- `sinir-kalesi/img/` — görseller (`manifest.json` yüklenecekler, `meta.json` kaynak genişlik/taban ofseti).
  Kule okçuları, kışla askerleri, 3B top ve efektler kodla çizilir (önbellekli parçalar).
- `sinir-kalesi/ses/` — Kenney CC0 sesleri; arayüz "pop" sesleri ve düşman ölüm sesleri WebAudio ile sentezlenir.
- `sinir-kalesi/tools/` — Playwright test araçları (sunucu 8765'te açıkken `node tools/...`):
  - `akis-testi.js` menü→bölüm→kule kur akışı, sayfa hatalarını yazar
  - `denge-botu.js [bölümler] [kahramanlar]` ör. `node tools/denge-botu.js 0,4,9 commander,caner` — botla bölüm oynatır
  - `arsa-denetim.js` (Playwright gerekmez: `node tools/arsa-denetim.js js/data.js`) arsaların dalga düğmesine
    ve arayüze taşmadığını denetler, taşanlar için yol kenarında yeni yer önerir. Yeni bölüm ekleyince çalıştır.
  - `fps.js` yoğun sahnede FPS; `magenta-sil.js girdi.jpg cikti.png` magenta zeminli görseli saydamlaştırır
- `tasarim/` tasarım notları ve Gemini promptları, `arastirma/`, `notlar/` (Game Lab ana notu: `notlar/game-lab-CLAUDE.md`).
- `varliklar/` ham Gemini görselleri (`ham/`) ve işleme betikleri.
- `scripts/generate_image.py` — Gemini görsel üretimi (anahtar `.env` içinde, repoya girmez).

## Son durum
2 sefer (EPISODES): 1. Ardan Krallığı (bölüm 1–10), 2. Kızılkum Sultanlığı (11–20, çöl; LEVELS'ta ep: 2).
2. sefer görselleri: varliklar/ham/s2_*.jpg → varliklar/sefer2_isle.py (numpy+scipy+pillow) → img/.
Yapılanlar: 20 bölüm, 5 kahraman (3'er yetenek), boss + muhafız + efektli boss yetenekleri, düşman zayıflık/direnç
ve dokununca bilgi paneli, yıldırım atan büyücü kulesi, 3B top, seviyeli okçu/asker çizimleri, kule unvanları,
yol girişinde küçük dalga işareti. Bot dengesi: 1–10. bölümler kazanılıyor, 10. bölüm en zor.

Her değişiklikten sonra: akış testi + gerekirse denge botu, sonra commit/push.

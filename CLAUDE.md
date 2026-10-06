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
  - `arsa-uret.js` (`node tools/arsa-uret.js js/data.js [1,2,..]`) arsaları yollara göre otomatik yerleştirir ve yazar:
    yola değmez, kenar/arayüz/kale/dalga düğmesinden uzak, kıvrım ve kavşakları gören yerler önce. Yol değişince çalıştır (yavaş, ~3 dk).
  - `arsa-denetim.js` (Playwright gerekmez: `node tools/arsa-denetim.js js/data.js [--apply]`) arsaların dalga düğmesine,
    arayüze ve yola (ROAD_MIN=66, yol genişleyince büyüt) taşmadığını denetler, yeni yer önerir; --apply data.js'e yazar.
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

Sistemler (6 Eki): bölüm haritası (EPISODES[].nodes: bayrak yerleri, noktalı patika, bayrağa dokununca bölüm kartı),
kahraman güçleri (HERO_ULT: takımdaki her kahramanın sol altta hedefli düğmesi; meteor ve takviye düğmesi yok),
paralı askerler (MERCS: ilk dalgadan sonra kale her dakika 2 asker çıkarır, yol boyunca yavaş yürürler; SOLDIER_LOOK.merc;
kaleye dokunup bayrakla haritanın her yerine gönderilir: G.castle.rally, sendMerc),
yollar (6 Eki yeniden tasarım): girişler + kollar (routes), kesişen/ayrılıp birleşen yollar; kale ilk yolun ucuna kapısıyla oturur
(lv.castle data.js sonunda hesaplanır), yol kapıya doğru daralır; kazanç GAME_DIFF.bounty (0.8),
tek kahraman (team() 1 kişi; kahramanlar ekranı ve AYARLAR ekranından seçilir), ayarlar: save.settings (ses düzeyi, sarsıntı, grafik),
boss havası: bossSting girişi + kızıl karartma, drawBossAura (hale + yetenek uyarı halkaları), dev boss adımı (stomp), öfke evresi %50 canda,
sentez sesler portal/roar/stomp; kilitlendiği hedef gelmeyen düşman kendisi yürür (e.offPath ile yola döner),
kale okçuları + kaleye dokunup 3 seviye yükseltme (CASTLE), yol kenarı dalgalı (roadVary/roadShape),
NPC sistemi hazır ama kapalı (NPC_ON=false; Gemini görselleriyle yeniden yapılacak), 12 pozlu animasyonlar (track/pose: saldırı, yürüyüş, ölüm, kanat, yetenek, kışla askeri, yay çekişi; Hermite eğri),
sentez sesler: zapSound (elektrik kulesi), clashSound (kılıç). Yol dokuları: road_dirt / road_sand (Gemini).

Her değişiklikten sonra: akış testi + gerekirse denge botu, sonra commit/push.

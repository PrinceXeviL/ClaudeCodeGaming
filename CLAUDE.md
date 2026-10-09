# Sınır Kalesi — devir notu

Kingdom Rush tarzı tarayıcı kule savunma oyunu. Saf HTML5 Canvas + vanilla JS, derleme adımı yok.
Kullanıcı Türkçe konuşur; yanıtlar ve koddaki yorumlar Türkçe.

## Çalıştırma
```
cd sinir-kalesi && python3 -m http.server 8765   # http://localhost:8765
```
Yayınlanan sürüm (claude.ai artifact): https://claude.ai/artifact/8P186cq2J4UkEbF8QzEmFp
Her yayında `yayin.html` ve `index.html` içindeki `window.SURUM` değerini artır (js ve görseller `?v=` ile yüklenir;
artırmazsan tarayıcı eski önbellek kopyasını gösterir). Başlık ekranının sağ altında "yayın N" yazar.

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

## GÖRSEL ÜRETİMİ: Claude kendisi üretir (kullanıcı kuralı, 8 Eki 2026)
Görsel gerektiğinde kullanıcıya prompt verip Gemini'de çizdirmesini İSTEME; `scripts/generate_image.py` ile API'den kendin üret,
sonucu incele (Read ile bak), gerekirse yeniden üret, işle (nm_isle.py / anim_isle.py) ve oyuna bağla. Kullanıcıya yalnız sonucu göster.
```
python3 scripts/generate_image.py -f tasarim/promptlar/<ad>.txt -m gemini-3-pro-image -a 16:9 -r <referans.png> -r <kılavuz.png> -o varliklar/ham/...
python3 scripts/generate_image.py --list-models      # erişilebilir görsel modelleri
```
- Anahtar: repo kökündeki `.env` (GEMINI_API_KEY, git'e girmez). Evdeki bilgisayarda da `.env` olmalı.
- Modeller: `gemini-3-pro-image` (Nano Banana Pro, tutarlılık en iyi, kare kare animasyon için tercih), `gemini-3.1-flash-image`, `gemini-2.5-flash-image`.
- DİKKAT: görsel modellerinin ücretsiz kotası 0. Anahtarın Google AI Studio projesinde faturalandırma açık değilse her çağrı
  "429 ... free_tier ... limit: 0" verir (8 Eki'de böyleydi). O zaman kullanıcıya bir kez söyle: aistudio.google.com → API anahtarının
  projesi → faturalandırmayı aç (Paid tier). Açılana kadar kullanıcı Gemini uygulamasında "Görsel oluştur" ile çizip dosyayı gönderebilir.
  Faturalandırma kapalıyken kullanıcı adım adım ilerlemek istiyor: her seferinde TEK adım ver (Gemini'de "Görsel oluştur" aracını seç,
  şu dosyaları ekle, şu promptu yapıştır, çıkan görseli gönder); gelen görseli incele, işle, sonra bir sonraki adımı ver.
- Uzun promptlar `tasarim/promptlar/*.txt` içinde (-f ile okunur); tasarım notları `tasarim/*.md`.

## DON'T MESS WITH THE NECROMANCER (7 Eki 2026, aktif)
Oyun yeniden temalandı: necromancer Mortimer kulesinde (kale), Solarian İmparatorluğu saldırıyor. Tasarım: `tasarim/necromancer-gdd.md`.
`data.js` sonundaki NECRO bloğu: yeni düşmanlar/bosslar, 5 bölüm (eski ilk 5 bölümün yol/arsa düzeni), tek sefer "Lanetli Sınır",
kule/komutan adları (Vladrik = eski commander, Wren = eski zeynep). Eski seferlerin verisi duruyor ama görünmüyor.
Görseller: `varliklar/ham/nm_*.jpg` (Gemini, magenta zemin) → `python3 varliklar/nm_isle.py` → img/ (castle_*, tower_*, unit_skel_*, enemy_*, nm_* dekor,
grass_cursed, road_cursed; komşu nesne taşmaları ERASE ile silinir). Başlık/harita arka planı `img/nm_title.jpg` (kod dışında birleştirildi).
Temalar game.js THEMES: cursed, bog, graveyard, blacklake, necrogate (treeSpr/rockSpr/bushSpr/pondSpr/roadTex).
Yapıldı: Mortimer'ın 3 büyüsü (Ölüleri Diriltme, Kemik Duvarı, Korku), rütbe renkleri (yayın 87), kodeks (yayın 90).
Bölgeler (eski adıyla sefer; arayüzde "sefer" yazmaz, mekân adı geçer): her bölge 15 bölüm, liste `tasarim/bolgeler.md` (6 bölge, 90 bölüm).
1. bölge Lanetli Sınır (9 Eki, yayın 109): 15 bölüm, beş mekân (Ölü Orman, Sisli Bataklık, Unutulmuş Mezarlık, Kara Göl, Mortimer'ın Kapısı).
Yol/arsa düzenleri eski 20 bölümlük seferlerden (data.js LEVELS, oynanış sırasıyla). Eski 5 bölümün kaydı 1/4/7/10/15'e taşınır (save.v15).
Bölge haritası: EPISODES[].zones/nodes/labels → game.js drawRegionMap (mekân zeminleri renderBackground ile, ince yol roadK, mekân tonu REGION_TINT).
Demir meydan okuması kaldırıldı (yalnız Kahramanlık). Büyüler tek dokunuşta. Yansıma yazıları (GÜM/ÇAT) yerine impactFx.
Animasyon: `varliklar/video_uret.py` (Hugging Face Wan 2.2, ücretsiz, hesapsız; anonim kota günde 2–3 klip) → video_isle.py → img/enemy_<tür>_walk.webp.
Venv gerekir: gradio_client imageio-ffmpeg numpy pillow scipy (ffmpeg yoksa imageio-ffmpeg'inki). Plan: 4 bölge × 15 bölüm, bölge başına ~18 düşman (tasarim/bolgeler.md).
Savaş sesleri `varliklar/ses_uret.py` ile sentezlenir (indirme yok): arrow, arrowhit, clash, bash, zap, splash, pain, dvoice, scream.
Yapıldı (8 Eki, yayın 106): dekor şakaları (setupProps/tapProps/drawProps: karga, mezar eli, Mortimer'ın çayı),
meydan okuma modları (CHAL h/i, IRON_TOWERS, save.ch, kart üstünde 3 yıldızdan sonra açılır),
başarımlar (ACH tablosu, `cnt(k)` kalıcı sayaç save.cnt, `achGive(id)` save.ach + üstten kayan bildirim, haritada kupa düğmesi → screen 'ach').
Sırada: çizgi roman panelleri
(sefer girişi 5, boss öncesi 2-3; Gemini yazısız, balonlar kodla), Sefer 2 (çöl lejyonları / kuzey savaşçıları), animasyon kareleri (poz kılavuzu).

## Müzik, dalga önizleme, rütbeler, Mortimer lafları (8 Eki 2026, yayın 87)
- Müzik üç parça (game.js MUSIC.tracks): `ses/muzik_menu.mp3` menüler, `ses/muzik_savas.mp3` bölüm içi, `ses/muzik_boss.mp3` boss sahadayken.
  Savaş = "The Necromancer's Parade", boss = "Bones on the Battlements" (Gemini, promptlar `tasarim/muzik-promptlari.md`; yayın 88).
  Dosya yoksa o parça sessiz kalır, boss parçası yoksa savaş parçası çalar. Ses düzeyi parça başına `gain`.
  Dikişsiz döngü (`seam`): ham parçanın sönen sonu kesilip son 2 sn başın ilk 2 sn'siyle harmanlandı (ffmpeg atrim/afade/amix,
  savaş 157.9 sn, boss 159.4 sn'de kesildi); oyunda iki ses öğesi sırayla çalar (musicSeam), MP3 loop boşluğu duyulmaz.
- Dalga işaretine ilk dokunuş o girişten gelecek düşmanları gösterir (drawWavePeek: simge, sayı, ad, rütbe rozetleri), ikinci dokunuş
  (ya da kutuya dokunmak) dalgayı çağırır.
- Düşman rütbeleri (data.js sonu RANKS/RANKED): `legion_k` Kıdemli (can ×1,6), `legion_y` Yüzbaşı (can ×2,5, "Borazan!" ile çevresini
  hızlandırır, başında altın yıldız). Ayrı ENEMIES kaydıdır, `base` ile asıl görseli/iskeleti kullanır; renk game.js RANK_LOOK (konumlu HSL).
  Dalgalara tohumlu dağıtılır: 2. bölümden kıdemli, 5. bölümde yüzbaşı; ağır piyade/süvari rütbelileri yalnız 5. bölümde (RANK_FROM).
  Tanıtım kartı rütbe başına bir kez çıkar ("YENİ RÜTBE").
- Necro düşmanlarının zayıflık/dirençleri (ENEMY_WK) önceden bağlanmıyordu (etkisizdi); data.js sonunda bağlanıyor. Açıklamalar ENEMY_DESC'te.
- Mortimer'ın yeni lafları (MORT_LINES): ilk can kaybı, 5 can altı, kıdemli/yüzbaşı ilk görünüş, koçbaşı, boss öfkesi ve ölümü,
  kule susturulması, ilk tam yükseltme, komutan ölümü, kayıpsız dalga, çok altın biriktirip harcamamak.
- Denge (bot, 2 tur): 20/20/15–19/10–11/6–13 can. 4. bölüm hpMul 0.92, 5. bölüm 0.57.
- `tools/akis-testi.js` yeni harita ve dalga önizlemesine göre güncellendi; sonunda "AKIŞ TAMAM" yazmalı.

## Çamur birikintisi (8 Eki 2026, yayın 89)
2. bölüm (Sisli Bataklık, mech 'mud') çamuru game.js drawMud: yol yönünde uzanan düzensiz birikinti (mudShape tohumlu kenar,
yer düzlemi MUD_SQ=0.6 basık). Durağan katman önbellekte (mudBase: ıslak leke, sıçrantılar, ıslak kenar, yosun, topaklar, çubuklar),
her karede girdap, parıltı, kabarcık (şişer/patlar), yağmur halkaları, içinden geçenlerin halkaları ve yarı gömülü kemik/kafatası (mudProp).
Yavaşlatma alanı mudAt (döndürülmüş elips), çamurda hız %52 (MUD_SLOW, yayın 91). Çamurdaki birimlerin ayağına drawWade ile çamur halkası çizilir, yürürken çamur sıçrar.

## Kodeks (8 Eki 2026, yayın 90)
Haritada ayarların solundaki kitap düğmesi (yeni kayıt sayısı rozetli) → `screen = 'codex'` (game.js drawCodex).
İki sekme: DÜŞMANLAR (CODEX_ENEMIES, görülmeyen karartılmış siluet + kilit) ve KULELER (TOWER_ORDER, açılmamışsa kilitli).
Ayrıntı kartı: kaidede yürüyen canlı karakter (drawUnit), Er/Kıdemli/Yüzbaşı seçimi (rütbeli görünüm ve değerler), ilk görüldüğü bölüm,
can/zırh/büyü direnci/hız/hasar/can kaybı/altın, zayıf/dirençli rozetleri, yetenekler (enemySkills: veriden), açıklama, "Mortimer'ın notu"
(CODEX_NOTE, yeni düşman/kule eklenince buraya esprili not ekle). Kulelerde 1-3. seviye seçimi, değerler, uzmanlıklar.
Kayıt: save.codex (görülen asıl türler; spawnEnemy → codexNote), save.codexNew (bakılmamış yeniler). Yeni düşman eklenince CODEX_ENEMIES'e ekle.

## Kare kare düşman animasyonu (lejyonerle başlıyor)
Promptlar: `tasarim/lejyoner-animasyon-promptlari.md` (0 model sayfası → 1 yandan yürüyüş → 2 önden → 3 arkadan → 4 mızrak saldırısı).
Ekler: `varliklar/ham/anim/ref_lejyoner.png`, kılavuzlar `kilavuz_yuru.png`, `kilavuz_onarka.png`, `kilavuz_mizrak.png` (poz_kilavuzu.py mizrak).
Gemini sayfaları `varliklar/ham/anim/lejyoner_*.jpg` → `python3 varliklar/anim_isle.py ham/anim/<dosya> enemy_legion_<walk|walk_on|walk_arka|atk> 4 2`.
Oyun bu şeritleri drawUnit'te kendiliğinden kullanır; `base`'li türler (rütbeliler, lejyoner kılığındaki boss) asıl türün şeridini
kendi renkleriyle kullanır (animStrip + recolorCanvas, bölüm başında bakeNext hazırlar).
Durum (yayın 92): `lejyoner_model.jpg` (model sayfası), `enemy_legion_atk` (8 kare, --auto --anchor heel: taşan mızrak karakterle kalır,
arka topuk sabit), `enemy_legion_walk` (Gemini 8 kare çizdi ama 5-8'de kalkanın içi görünüyordu; 1-4 iki kez: --order 1,2,3,4,1,2,3,4,
--anchor head), `enemy_legion_walk_on` (yayın 93; 6. karede mızrak ters döndüğü için 7 kare: --order 1,2,3,4,5,7,8).
`enemy_legion_walk_arka` (yayın 94; Gemini zemin çizgisi çizmişti, silindi; 7. karede tunik maviydi: --order 1,2,3,4,5,6,8;
alt sıra daha büyük çizilmişti: --norm). Lejyoner 4 yönde tamam. Gemini tuzakları: kalkanın arka yüzüne dönmesi, mızrağın ters dönmesi,
renk kayması, zemin çizgisi, satırlar arası boy farkı; promptta "ALL 8 frames" ile açıkça yaz, kusurlu kareyi --order ile at.
Sonraki düşmanlar aynı sırayla: model sayfası → yandan yürüyüş → önden → arkadan → saldırı (kendi silahına uygun kılavuzla).
anim_isle.py seçenekleri: --auto (bağlı parçalarla ayırma, scipy), --anchor body|head|heel, --order, --norm.

## Animasyon denemeleri (8 Eki 2026) — İKİSİ DE KULLANICI TARAFINDAN BEĞENİLMEDİ, KAPALI (yayın 96)
1) Gemini kare kare şeritler (enemy_legion_walk/_on/_arka/_atk): titreşen çizim, az kare → "amatörce". anim.json'dan çıkarıldı
   (kayıtlar varliklar/ham/anim/lejyoner_anim_kapali.json, webp'ler img/'de duruyor).
2) Parçalı kukla (aşağıda): "berbat". PUP_OFF = true. Lejyoner yine diğer düşmanlar gibi eski ARMS/rig animasyonunu kullanıyor.
3) GÖRSELDEN VİDEO (kullanıcı beğendi, yayın 97, KULLANILAN YOL): Gemini "Video oluştur" (Veo) + yandan görsel
   (`varliklar/ham/anim/lejyoner_yandan_video.png`), prompt: yerinde yürüyüş, sabit kamera, düz magenta zemin.
   `python3 varliklar/video_isle.py ham/anim/lejyoner_yuru_video.mp4 enemy_legion_walk [--start 61 --len 31]`: 24 fps'e çevirir,
   en iyi kapanan döngüyü bulur (lejyoner: 31 kare), magentayı siler, kareleri SABİT çerçeveyle keser → enemy_legion_walk (31 kare).
   Önden/arkadan şerit yok → yandan şerit kullanılır.
   Saldırı (yayın 98): `lejyoner_saldiri_video.mp4` → `video_isle.py ... enemy_legion_atk --start 31 --len 31` (videoda tek net saplama;
   darbe karesi = başlangıç + round(n * ATK_PREP/(ATK_PREP+ATK_AFTER)) = 0,4*n; lejyonerde video karesi 44).
   Dururken yürüyüş şeridinin "idle" karesi gösterilir (ayaklar en kapalı; video_isle yazar) → tek resme dönüp tasarım değişmez.
   Şeritler 300 px boy (TARGET_H): rütbe kopyalarıyla bellek makul kalsın. Kareler başın yerine göre hizalanır (mızrak uzasa da kaymaz).
   Veo kotası (Gemini uygulamasında günde 3 video) sınırlı: diğer düşmanlar için alternatif video kaynakları kullanıcıya önerildi.
Kingdom Rush: Flash/Animate'te elle (vektör parçalar + kare kare) animasyon, çok kare, tutarlı kaynak.
Çapraz yürüyüşte takılma düzeltmesi (yayın 99): yandan sapmalı (e.off) yürüyüşte pathPos örnek geçişlerinde konum <1 px geri sıçrıyordu;
yüz yönü konum farkından hesaplandığı için her ~12 karede bir kare ters dönüyordu. Artık yüz yönü yol teğetinden (q.dx, |dx|>0,08).
Önden/arkadan görünüş seçimi histerezisli (e.dirV: 1,5'te girer, 1,1'de çıkar). Ölçüm: drawUnit'e o.logId verilen birim için
window.__animLog'a [id, şerit, kare, yüz, yürüyor, yön, x, y] yazılır (test aracı; scratchpad diag.js mantığı: yüz çevirme/şerit değişimi say).
Video üretimi için kullanıcının evdeki bilgisayarı MacBook Air M4 16 GB (NVIDIA yok): Wan 2.2 yerelde zor/yavaş; Kaggle/Colab ücretsiz GPU önerildi.

### Parçalı (iskeletli) animasyon (KALDIRILDI 9 Eki; kod ve dosyalar git geçmişinde)
Kullanıcı Gemini kare kare animasyonlarını "amatörce" buldu (az kare ~10 fps, her karede çizim titriyor). Yerine Spine benzeri parçalı karakter:
Gemini'den bir PARÇA SAYFASI (baş, gövde, etek, pelerin, üst kol/önkol x2, uyluk/baldır/ayak x2, kalkan, mızrak; magenta zemin, ayrık parçalar)
→ `python3 varliklar/kukla_isle.py ham/anim/lejyoner_parcalar.jpg enemy_legion_parts <ad listesi satır satır>` → img/<atlas>.webp + img/puppet.json.
game.js PUPPETS: kemikler (ebeveyn, bağlantı oranı, eklem noktası, dinlenme açısı, abs = dünya açısı, sc = ölçek) ve çizim sırası;
puppetSolve (ileri kinematik), legionPose (yürüyüş: uyluk salınımı, salınımda diz bükülür, topuk kalkar, gövde iner kalkar, kollar karşı salınır,
pelerin gecikmeli; saldırı: kurulma → saplama → toparlanma, ATK_FRAME_T ölçeğinde 0 = darbe; duruş: nefes), drawPuppet (taban her an zemine basar).
drawUnit'te PUPPETS[rig] varsa her yönde parçalı çizim kullanılır (kare şeritleri devre dışı; önden/arkadan parça sayfaları ileride).
Rütbe/boss renkleri atlası yeniden boyar (puppetAtlas; sorguç = baş parçasının üstü). Test: `__game.puppet(ctx,x,y,h,{walking,phase|atk,type})`, `__game.pupOff(true)`.
Yeni düşman: model sayfası → parça sayfası (şablon `tasarim/promptlar/kukla_parcalar_lejyoner.txt`) → kukla_isle.py → PUPPETS'e kemikler + poz işlevi.
Parça adlarını ve eklem noktalarını belirlemek için parçaları %10 ızgarayla görüntüle (bkz. lejyoner değerleri).

## Eski oyun dosyaları (8 Eki 2026)
Eski seferlerin (Ardan, Kızılkum) görselleri, ham Gemini sayfaları, işleme betikleri (gorsel_isle, sprite_uret, doku_uret, sefer2_isle)
ve eski tasarım notları silindi (git geçmişinde duruyor). data.js'teki eski LEVELS/ENEMIES verisi duruyor: NECRO bölümleri eski ilk 5 bölümün
yol ve arsa düzenini kullanıyor. Görsel işleme artık yalnız `varliklar/nm_isle.py` (sayfa adı verilirse yalnız o sayfa) ve `anim_isle.py`.

## Performans ve görseller (8 Eki 2026)
- Görseller WebP (`varliklar/webp_cevir.py`; nm_isle.py ve anim_isle.py artık doğrudan WebP yazar). img/ ~3.5 MB.
- Kare maliyeti: `__game.perf(n)` (güncelleme + tam sahne çizimi, ms). 80 düşman + 60 ceset + 17 gaz bulutu: çizim ort. ~3.3 ms (masaüstü).
- Cesetler ölüm pozundan sonra önbelleğe alınır (kare başına en çok 3); gaz/buhar öbekleri hazır görselle çizilir.
- Eski kod temizliği (9 Eki): eski okçu kulesi/top/büyücü küresi çizimleri, eski başlık, eski kahramanlar (Caner, Tarçın, Bilge) ve 19 yeteneği,
  kukla (parçalı) animasyon sistemi ve dosyaları, eski düşmanların kodla yedek çizimi, eski RIG/ARMS/boss renk kayıtları, data.js'te eski
  20 bölümün dalgaları (yalnız ilk 5'in yol/arsa/kol düzeni kaldı) silindi. game.js 9916 -> ~8850, data.js 1154 -> ~670 satır.
  Ölü fonksiyon taraması: hiç çağrılmayan fonksiyon/sabitleri bulup silen betik mantığı (adı dosyada bir kez geçenler) tur tur uygulandı.

## Son durum (eski oyun, tarihçe)
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
iskelet (6 Eki): ARMS (game.js) her karakter görselinin silahlı kolunu çokgenle keser, omuzdan döndürür (cutImage: kopan adacıklar kola geçer,
arkada kalan boşluk itme-çekme ile dolar; bölüm başında bakeNext ile hazırlanır); gövde 5 dilimde omurga gibi kıvrılır (P.bend),
bacaklar kalçadan döner; yarı saydam çizim RIGBUF tamponundan geçer. Yeni görsel eklenince ARMS'a kol çokgeni ekle.
Test: tools/kesim-onizleme.js (showCuts, showAnim, strip) + __game.anim / __game.bench. Görsellerdeki beyaz delikler temizlendi.
sentez sesler: zapSound (elektrik kulesi), clashSound (kılıç). Yol dokuları: road_dirt / road_sand (Gemini).

Her değişiklikten sonra: akış testi + gerekirse denge botu, sonra commit/push.

## Animasyon şeritleri ve bellek (9 Eki 2026, yayın 130)
Saldırı şeritleri eklenince hepsi açılışta yüklenip ~350 MB çözülmüş bellek tuttu, oyun tablette dondu (yayın 125–127; 128'de geri alındı).
Kural: düşman/iskelet şeritleri karakter boyu 160 px (video_isle.py UNIT_H; eskiler `varliklar/serit_kucult.py` ile küçültülür).
game.js: `/^(enemy|unit)_..._(walk|atk)$/` şeritleri manifestte olsa da açılışta yüklenmez (LAZY); startLevel bölümün düşman türleri
(+ base, split, summon) ve iskeletler için useStrips(keep) çağırır, gerekmeyenleri bellekten atar; bölüm dışında ilk istekte yüklenir (loadStrip).
Yeni ağır görsel eklerken çözülmüş boyu (genişlik × yükseklik × 4) hesapla.

## Ücretsiz görsel üretimi: Kaggle + FLUX Kontext (9 Eki 2026, yayın 147)
Gemini görsel kotası 0, HF ZeroGPU anonim kotası 1 görselde bitiyor. Kalıcı yol: `varliklar/kaggle_kontext.py varliklar/ham/yeni/isler.json`
(işler: name, ref = varliklar/ham/anim/*_ref.png magenta zeminli referans, prompt "Replace the X with ... keep same art style", seeds).
Model: QuantStack/FLUX.1-Kontext-dev-GGUF Q4 + ostris/Flex.1-alpha (VAE/metin kodlayıcı, Apache, hesapsız). T4'te fp16 SİYAH resim verir:
metin kodlayıcı fp16 bir kez, dönüştürücü fp32 hesap, 768 px → görsel başına ~14 dk. Çıktı magenta zeminli PNG → anim_isle.remove_magenta +
video_isle.biggest_mask ile kes, img/'e WebP; meta.json [w, h] (kulede [w, h, 0.13]). Kontext çıktıları ticari kullanılabilir (FLUX dev lisansı).
Bu yolla yapılanlar: enemy_wardog, enemy_chariot (yatay çevrildi), enemy_siegetower, enemy_eagle, tower_altar_1..3 (Lanet Kulesi).
Kaggle kuralları: aynı anda 2 GPU oturumu (betikler dakikada bir yeniden dener); veri seti sürümü işlenmeden çekirdek gönderilmez (refs_dataset bekler).

## 9 Eki 2026 akşam (yayın 160–170)
- Giriş ekranı: Gemini anahtar görseli `img/nm_key.jpg` (ham: varliklar/ham/nm_title_mortimer.jpg). game.js KEY_FX: ışık noktaları, `keyWarp` (yalnız renk anahtarlı alev/buhar pikselleri dalgalanır; kol/cübbe sabit), meşale dilleri, uzak kargalar (drawSkyCrows). Logo titleLogo (kurdele + Creepster, sarkıt uçları maskeden bulunur, kan damlası).
- Yollar v2 (yayın 169): 15 bölüm KR esinli, zorlukla karmaşıklaşır (önizleme tasarim/yollar-v2-onizleme.jpg). ROAD_K 1.57. Arsalar: `node tools/arsa-uret.js js/data.js` (yol ağzı 150 px arsasız) sonra tarayıcıda `__game.plotAudit(true)` (avlu çakışması) ve sonucu data.js'e yaz.
- Avlu canlı ışıklar: drawAvluLights / AVLU_FX (mumlar, pencereler, kapı alevi, ruh zerreleri). Kaggle Wan avlu videoları KULLANILMADI: model binayı her karede yeniden çiziyor, bütün duvar titriyor.
- Ölümler: iskelet → kemik yığını (boneCollapse), ölüm şeridi olmayan makine → machineWreck, uçan → skyFall.
- Sesler: düşman acı/ölüm/korku sesleri gerçek kayıt (varliklar/ses_kayit_isle.py, Michel Baradari CC-BY 3.0). Savaş çığlığı sesi yok (beğenilmedi). Emeği geçenler ekranı: game.js CREDITS (yeni kaynak eklenince yaz).
- Dalga sayacı sahada düşman varken durur (WAVE_REST 20 sn). İskelet duruşları SKEL_STANCE (kılıç saldırgan, kalkan/temel savunmacı).

# Mağaza malzemeleri (App Store + Google Play)

Hazırlandı: 11 Eki 2026. Oyunun adı (23 Eki, Caner): **Lord of Graves: Tower Defense** (telefonda kısa ad: Lord of Graves).
Uygulama kimliği: `com.princexevil.necromancer` (iOS ve Android aynı).

## Klasörler

| Klasör | İçerik | Boyut |
|-|-|-|
| `app_store_iphone/` | iPhone 6,9" ekran görüntüleri (App Store bunlardan küçük iPhone'ları kendisi türetir) | 2868×1320, 7 adet |
| `app_store_ipad/` | iPad 13" ekran görüntüleri (oyun iPad'i de destekliyor, zorunlu) | 2752×2064, 7 adet |
| `play/` | Google Play telefon ekran görüntüleri (Play en çok 2:1 kabul ediyor, ortadan kırpıldı) | 2640×1320, 7 adet |
| `ekran/` | Ham çekimler (iPhone boyu) | |
| `simge_1024.png`, `play_simge_512.png` | Uygulama simgesi (App Store 1024, Play 512) | |
| `gizlilik.html` | Gizlilik politikası (TR + EN). Herkese açık bir adreste yayınlanmalı, iki mağaza da adres ister | |

Sıra: 0 başlık, 1 savaş, 2 boss (Gloriosus), 3 final (Lanetli Severus), 4 harita, 5 kodeks, 6 büyü kitabı.
Yeniden çekmek: sunucu açıkken `cd sinir-kalesi && node tools/magaza-ekran.js` (13 Eki; 1_savas ve 6_buyu_kitabi 11 Eki çekimi). Mağazada ilk görüntü en önemlisi: **1_savas** ya da **2_boss** başa alınabilir.

Ekran görüntüleri oyunun kendisinden alındı (tarayıcı, test kaydı). Üstteki altın/yıldız sayıları test verisi; gerçek oyunla aynı görünüm.

## Hâlâ gereken (Caner)

1. **Simge: HAZIR (11 Eki).** Gemini çizimi `varliklar/ham/nm_simge.jpg` → `simge_isle.py` ile iOS + Android'e işlendi. Mağaza dosyaları: `simge_1024.png` (App Store), `play_simge_512.png` (Play). Google Play öne çıkan görseli HAZIR (18 Eki): `play_one_cikan_1024x500.png` (Gemini, ham `varliklar/ham/nm42_play_banner.jpg`).
2. **Gizlilik politikası adresi:** `gizlilik.html` içindeki `[İLETİŞİM E-POSTASI]` yerine mağazada görünecek bir iletişim adresi yazılmalı (depo herkese açık, kişisel adres yazılmadı). Sonra sayfa bir yere yüklenmeli (ör. GitHub Pages; depo zaten herkese açık). Bu, herkese açık yayın olduğu için Caner'in onayıyla yapılacak.
3. **Hesaplar:** Apple Developer Program (yıllık 99 $), Google Play Console (tek sefer 25 $), vergi ve banka bilgileri.
4. **Gelir modeli (12 Eki, Caner onayı):** ücretsiz indirme, ilk 10 bölüm ücretsiz; tam oyun tek seferlik **4,99 $ / 149,99 ₺** (`mortimer_hazine`, game.js MONET). Zorunlu ara reklam YOK; yalnız isteğe bağlı ödüllü reklam (tam oyunda reklamsız). Araştırma: `arastirma/gelir-ve-pazarlama.md`.
5. **Reklam ve satın alma (21 Eki: Android kodu HAZIR, Play Billing 8 + AdMob + UMP):** AdMob hesabı + App Store Connect / Play Console'da `mortimer_hazine` ürünü. Reklam açılırsa gizlilik politikası ve yaş derecelendirmesi yanıtları güncellenir (aşağıda işaretli).
6. **Android derlemesi: HAZIR (11 Eki).** İmzalı paket `android/app/build/outputs/bundle/release/app-release.aab` (123 MB), emülatörde denendi. Yükleme imzası `~/.android-imza/` içinde (depoda değil) — bu klasör yedeklenmeli. Play Console hesabı açılınca bu AAB yüklenir; Play App Signing açık bırakılır.
7. **TEST_OPEN = false** (game.js) — göndermeden önce.

## Simge için Gemini promptu

```
App icon for a mobile tower defense game "Lord of Graves", square 1024x1024, no text, no letters, no border, no rounded corners (the store rounds them).
Close-up of a grinning skeleton necromancer in a deep red hood with glowing red eyes, holding a steaming teacup in a bony hand, a green-glowing gothic chapel window behind him, dark purple night sky.
Bold thick dark outlines, rich saturated colors, dark gothic cartoon style, very readable at small size, the face fills most of the icon, strong silhouette, high contrast.
```

## Kategori

- App Store: **Oyunlar → Strateji** (ikincil: Macera)
- Google Play: **Strateji** (etiketler: Kule savunması, Fantastik, Tek oyunculu, Çevrimdışı)

## Metinler — Türkçe

**Ad (en çok 30):** Lord of Graves: Tower Defense
**Alt başlık (App Store, en çok 30):** Necromancer kule savunması
**Kısa açıklama (Play, en çok 80):** Necromancer tower defense: kemik kuleler kur, ölüleri dirilt, ordunu büyüt!

**Açıklama:**

Lanetli Sınır, Mortimer'ın toprağı. Mezarlar onun, ölüler onun. Solarian İmparatorluğu bu toprakları istiyor, ardından engizisyon cadı avına çıkıyor. Kötü fikir: topraklarına izinsiz giren, onun ordusunda dirilir.

Kemik kuleler kur, mahzenlerinden iskelet savaşçılar çıkar, düşmüş düşmanları kendi ordunda dirilt. Lord of Graves, karanlık mizahlı, el çizimi bir kule savunma oyunu.

• 40 bölüm, iki sefer: Davetsiz Misafirler ve Cadı Avı
• 5 kule, her biri 3 kademe ve 4. kademede ayrı uzmanlık yolları; her uzmanlığın parayla geliştirilen ikinci gücü
• Okçu mu arbaletçi mi? Mahzende kalkan duvarı mı, ölüm şövalyeleri mi, beş düşmanı birden tutan Kemik Golem mi? Yolunu sen seç
• Ruh Feneri düşmanların ruhunu emer, biriken ruhları şimşek olarak çarpar
• Mortimer'ın büyü kitabı: Ölüleri Diriltme, Korku, Kemik Duvarı, Ceset Patlatma, Ceset Golemi. Büyüler kullandıkça güçlenir
• Seviye atlayan komutanlar ve yetenek ağaçları
• 40'tan fazla düşman: lejyonerler, savaş filleri, kuşatma kuleleri, engizisyoncular, yürüyen katedraller
• Sis perdeli sefer haritası, boss savaşları, Kahramanlık ve Sonsuz Gece modları, günlük sınav
• Mortimer'ın her şeye bir yorumu var
• İlk 10 bölüm ücretsiz; tam oyun tek seferlik, abonelik ve zorunlu reklam yok
• İnternet gerekmez

7 dil: Türkçe, English, Español, Deutsch, Français, Русский, 中文

**Anahtar kelimeler (App Store, en çok 100 karakter, virgülle):**
kule savunma,strateji,necromancer,iskelet,büyü,zombi,fantastik,çevrimdışı,td,kale

**Tanıtım metni (App Store, en çok 170):** Mortimer'ın kapısını çalmadan girdiler. Kemik kuleler kur, ölüleri dirilt, ordunu büyüt. 40 bölüm, 2 sefer, internet gerekmez.

## Texts — English

**Name:** Lord of Graves: Tower Defense
**Subtitle (≤30):** Necromancer Tower Defense
**Short description (Play, ≤80):** Necromancer tower defense: build bone towers, raise the dead, grow your army!

**Description:**

The Cursed Border is Mortimer's land. The graves are his, and so are the dead. The Solarian Empire wants this land, and then the Inquisition starts a witch hunt. Bad idea: whoever trespasses on his land rises again in his army.

Build bone towers, send skeleton warriors out of your crypts and raise fallen enemies into your own army. Lord of Graves is a hand-drawn tower defense game with a dark sense of humor.

• 40 levels across two campaigns: Uninvited Guests and Witch Hunt
• 5 towers, each with 3 tiers and specialization paths at tier 4; every specialization has a second power you buy with gold
• Archers or crossbowmen? In the crypt: a shield wall, death knights, or a Bone Golem that holds five enemies at once? Choose your path
• The Soul Lantern drains your enemies' souls and strikes them with the stored souls as lightning
• Mortimer's grimoire: Raise Dead, Fear, Bone Wall, Corpse Explosion, Corpse Golem. Spells grow stronger as you use them
• Commanders that level up, with skill trees
• 40+ enemies: legionaries, war elephants, siege towers, inquisitors, walking cathedrals
• Fog-of-war campaign map, boss fights, Heroic and Endless Night modes, a daily trial
• Mortimer has a comment for everything
• First 10 levels free; unlock the full game once, no subscription, no forced ads
• No internet needed

7 languages: English, Türkçe, Español, Deutsch, Français, Русский, 中文

**Keywords:** tower defense,strategy,necromancer,skeleton,undead,spells,zombie,fantasy,offline,td

**Promotional text:** They came in without knocking. Build bone towers, raise the dead, grow your army. 40 levels, 2 campaigns, no internet needed.

## Yaş derecelendirmesi

### App Store (Age Rating anketi)
| Soru | Yanıt |
|-|-|
| Cartoon or Fantasy Violence | **Frequent/Intense** (savaş oyunun tamamı; çizgi film tarzı, kan çok az. Az göstermek reddedilme sebebi olabilir) |
| Realistic Violence | None |
| Horror/Fear Themes | Infrequent/Mild (iskeletler, kafatasları, mezardan çıkan eller) |
| Mature/Suggestive Themes | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, Drugs | None (Mortimer kahve içiyor) |
| Gambling / Simulated Gambling | None |
| Sexual Content / Nudity | None |
| Medical/Treatment | None |
| Unrestricted Web Access | No |
| Contests | No |

Beklenen sonuç: **9+** (Frequent cartoon violence ile 9+, korku temasıyla değişmez).

### Google Play (IARC anketi)
- Kategori: Oyun
- Şiddet: Evet, fantastik/çizgi film karakterlerine yönelik, gerçekçi değil. **Kan: evet, çizgi film tarzı az kan** (isabette damla, ölünce küçük leke; ayarlardan kapanır). Düşmanlar insan olduğu için Avrupa'da **PEGI 12–16** çıkabilir (bkz. not)
- Korku: Hafif korku öğeleri (iskelet, kafatası)
- Cinsellik, küfür, uyuşturucu, kumar: Hayır
- Kullanıcılar arası etkileşim / içerik paylaşımı: Hayır
- Konum paylaşımı: Hayır
- Dijital ürün satın alma: **Evet** (tek seferlik "Mortimer'ın Hazinesi", mağaza sürümünde açılınca)
- Reklam: **Evet** (AdMob açılınca; kapalıysa Hayır)

Beklenen sonuç: **PEGI 12 (insana karşı kan varsa 16'ya çıkabilir) / USK 12 / ESRB Everyone 10+ (Mild Blood)**. Derece istenenden yüksek çıkarsa kanı varsayılan olarak kapalı başlatmak bir seçenek.

## Gizlilik soruları (App Store "App Privacy" ve Play "Data safety")

Şu anki sürüm (20 Eki): **GameAnalytics ile anonim oyun verisi** toplanıyor, yalnız oyuncu ilk açılıştaki izin kutusunda "Evet" derse (Ayarlar'dan kapatılabilir). Hesap yok, ilerleme yalnız cihazda (localStorage + Capacitor Preferences).
- Toplananlar: uygulama etkileşimi (bölüm başla/bitir, kule/büyü kullanımı), cihaz/işletim sistemi bilgisi, rastgele kurulum kimliği, kaba konum (IP'den ülke); çökme/hata kaydı. Reklam ya da takip amacı yok, üçüncü tarafa satılmaz.
- App Store "App Privacy": Usage Data → Product Interaction; Identifiers → Device ID (kurulum kimliği); Diagnostics. Amaç: Analytics. "Linked to you": Hayır. "Used for tracking": Hayır.
- Play Data safety: "App activity" + "App info and performance" + "Device or other IDs" toplanır, paylaşılmaz, amaç Analytics, isteğe bağlı (kullanıcı reddedebilir), aktarımda şifreli.
- iOS `PrivacyInfo.xcprivacy` güncellendi (20 Eki); `gizlilik.html`'de GameAnalytics ve AdMob bölümleri var (21 Eki).

**21 Eki: AdMob ödüllü reklam bağlandı (Android, NecroStorePlugin).** Play Data safety'ye EK olarak:
- "Device or other IDs" → Advertising ID: toplanır, **paylaşılır** (Google AdMob), amaç **Advertising or marketing** + Analytics; isteğe bağlı değil (reklam izlenirse), şifreli.
- "App activity" → App interactions: AdMob da toplar (reklam ölçümü). "Approximate location" (IP'den): AdMob, amaç reklam.
- Play Console → "Ads" sorusu: **Evet, reklam içeriyor**. "Advertising ID" bildirimi: **Evet** (AD_ID izni play-services-ads ile gelir).
- Hedef kitle: 13+ önerilir (çocuklara yönelik değil); 13 altı seçilirse Families politikası ve sertifikalı reklam SDK'sı gerekir.
- Uygulama içi ürün: Play Console → Monetize → In-app products → **`mortimer_hazine`**, tek seferlik (managed), fiyat 4,99 $ / 149,99 ₺. Kimlik koddaki ile aynı olmalı (android/app/src/main/res/values/strings.xml `iap_full_game`).
- AdMob kimlikleri: strings.xml `admob_app_id`, `admob_rewarded` (şimdi Google TEST kimlikleri; gerçekleri gelince değişir, yoksa mağazada reklam gelmez).

**AdMob eklenirse değişir:** Cihaz kimliği (reklam kimliği), kaba konum (IP'den), ürün etkileşimi, çökme verisi → "Third-party advertising" amacıyla toplanır. iOS'ta App Tracking Transparency izni ve SKAdNetwork ayarı gerekir; Play'de Data safety formu yeniden doldurulur. `gizlilik.html` içinde bu bölüm hazır, reklam açılınca "henüz yok" notu kaldırılır.

## Sürüm notu (ilk sürüm)

TR: İlk sürüm! Mortimer'ın topraklarını savun: izinsiz girenler dirilir.
EN: First release! Defend Mortimer's land: trespassers will rise.

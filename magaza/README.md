# Mağaza malzemeleri (App Store + Google Play)

Hazırlandı: 11 Eki 2026. Oyunun adı şimdilik **Don't Mess with the Necromancer**; kalıcı ad Caner'in kararı.
Uygulama kimliği: `com.princexevil.necromancer` (iOS ve Android aynı).

## Klasörler

| Klasör | İçerik | Boyut |
|-|-|-|
| `app_store_iphone/` | iPhone 6,9" ekran görüntüleri (App Store bunlardan küçük iPhone'ları kendisi türetir) | 2868×1320, 6 adet |
| `app_store_ipad/` | iPad 13" ekran görüntüleri (oyun iPad'i de destekliyor, zorunlu) | 2752×2064, 6 adet |
| `play/` | Google Play telefon ekran görüntüleri (Play en çok 2:1 kabul ediyor, ortadan kırpıldı) | 2640×1320, 6 adet |
| `ekran/` | Ham çekimler (iPhone boyu) | |
| `gizlilik.html` | Gizlilik politikası (TR + EN). Herkese açık bir adreste yayınlanmalı, iki mağaza da adres ister | |

Sıra: 0 başlık, 1 savaş, 2 boss, 3 harita, 4 kodeks, 5 büyü kitabı. Mağazada ilk görüntü en önemlisi: **1_savas** ya da **2_boss** başa alınabilir.

Ekran görüntüleri oyunun kendisinden alındı (tarayıcı, test kaydı). Üstteki altın/yıldız sayıları test verisi; gerçek oyunla aynı görünüm.

## Hâlâ gereken (Caner)

1. **Simge (1024×1024):** şu anki iOS simgesi başlık görselinden kırpma, kenarları kesik. Gemini ile ayrı simge çizdirilecek (prompt aşağıda). Google Play için 512×512 ve 1024×500 öne çıkan görsel de gerekiyor.
2. **Gizlilik politikası adresi:** `gizlilik.html` içindeki `[İLETİŞİM E-POSTASI]` yerine mağazada görünecek bir iletişim adresi yazılmalı (depo herkese açık, kişisel adres yazılmadı). Sonra sayfa bir yere yüklenmeli (ör. GitHub Pages; depo zaten herkese açık). Bu, herkese açık yayın olduğu için Caner'in onayıyla yapılacak.
3. **Hesaplar:** Apple Developer Program (yıllık 99 $), Google Play Console (tek sefer 25 $), vergi ve banka bilgileri.
4. **Reklam ve satın alma:** AdMob hesabı + App Store Connect / Play Console'da `mortimer_hazine` ürünü. Reklam açılırsa gizlilik politikası ve yaş derecelendirmesi yanıtları güncellenir (aşağıda işaretli).
5. **Android derlemesi:** bu bilgisayarda Java (JDK 17+) ve Android SDK yok. Android Studio kurulunca: `npm i @capacitor/android` → `npx cap add android` → `npx cap sync android` → Android Studio'da imzalı AAB.
6. **TEST_OPEN = false** (game.js) — göndermeden önce.

## Simge için Gemini promptu

```
App icon for a mobile tower defense game "Don't Mess with the Necromancer", square 1024x1024, no text, no letters, no border, no rounded corners (the store rounds them).
Close-up of a grinning skeleton necromancer in a deep red hood with glowing red eyes, holding a steaming teacup in a bony hand, a green-glowing gothic chapel window behind him, dark purple night sky.
Bold thick dark outlines, rich saturated colors, dark gothic cartoon style, very readable at small size, the face fills most of the icon, strong silhouette, high contrast.
```

## Kategori

- App Store: **Oyunlar → Strateji** (ikincil: Macera)
- Google Play: **Strateji** (etiketler: Kule savunması, Fantastik, Tek oyunculu, Çevrimdışı)

## Metinler — Türkçe

**Ad (en çok 30):** Don't Mess with the Necromancer
**Alt başlık (App Store, en çok 30):** Kemik kuleli kule savunması
**Kısa açıklama (Play, en çok 80):** Kemik kuleler kur, ölüleri dirilt, Mortimer'ın çayını böldürme!

**Açıklama:**

Mortimer sadece huzur içinde çayını içmek istiyordu. Sonra Solarian İmparatorluğu kapısına dayandı. Şimdi de engizisyon cadı avına çıktı. Kötü fikir.

Kemik kuleler kur, mahzenlerinden iskelet savaşçılar çıkar, düşmüş düşmanları kendi ordunda dirilt. Don't Mess with the Necromancer, karanlık mizahlı, el çizimi bir kule savunma oyunu.

• 40 bölüm, iki sefer: Davetsiz Misafirler ve Cadı Avı
• 5 kule, her biri 3 kademe ve 4. kademede iki farklı uzmanlık
• Okçu mu arbaletçi mi? Mezar Bekçisi mi Ölüm Şövalyesi mi? Yolunu sen seç
• Mortimer'ın büyü kitabı: Ölüleri Diriltme, Korku, Kemik Duvarı, Ceset Patlatma, Ceset Golemi. Büyüler kullandıkça güçlenir
• Seviye atlayan komutanlar ve yetenek ağaçları
• 40'tan fazla düşman: lejyonerler, savaş filleri, kuşatma kuleleri, engizisyoncular, yürüyen katedraller
• Sis perdeli sefer haritası, boss savaşları, Kahramanlık ve Sonsuz Gece modları, günlük sınav
• Mortimer'ın her şeye bir yorumu var
• İnternet gerekmez. Abonelik yok

7 dil: Türkçe, English, Español, Deutsch, Français, Русский, 中文

**Anahtar kelimeler (App Store, en çok 100 karakter, virgülle):**
kule savunma,strateji,necromancer,iskelet,büyü,zombi,fantastik,çevrimdışı,td,kale

**Tanıtım metni (App Store, en çok 170):** Mortimer'ın kapısını çalmadan girdiler. Kemik kuleler kur, ölüleri dirilt, ordunu büyüt. 40 bölüm, 2 sefer, internet gerekmez.

## Texts — English

**Name:** Don't Mess with the Necromancer
**Subtitle (≤30):** Bone tower defense
**Short description (Play, ≤80):** Build bone towers, raise the dead, and never interrupt Mortimer's tea.

**Description:**

Mortimer only wanted to drink his tea in peace. Then the Solarian Empire came knocking. Now the Inquisition is on a witch hunt. Bad idea.

Build bone towers, send skeleton warriors out of your crypts and raise fallen enemies into your own army. Don't Mess with the Necromancer is a hand-drawn tower defense game with a dark sense of humor.

• 40 levels across two campaigns: Uninvited Guests and Witch Hunt
• 5 towers, each with 3 tiers and two specializations at tier 4
• Archers or crossbowmen? Grave Warden or Death Knight? Choose your path
• Mortimer's grimoire: Raise Dead, Fear, Bone Wall, Corpse Explosion, Corpse Golem. Spells grow stronger as you use them
• Commanders that level up, with skill trees
• 40+ enemies: legionaries, war elephants, siege towers, inquisitors, walking cathedrals
• Fog-of-war campaign map, boss fights, Heroic and Endless Night modes, a daily trial
• Mortimer has a comment for everything
• No internet needed. No subscription

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
| Alcohol, Tobacco, Drugs | None (Mortimer çay içiyor) |
| Gambling / Simulated Gambling | None |
| Sexual Content / Nudity | None |
| Medical/Treatment | None |
| Unrestricted Web Access | No |
| Contests | No |

Beklenen sonuç: **9+** (Frequent cartoon violence ile 9+, korku temasıyla değişmez).

### Google Play (IARC anketi)
- Kategori: Oyun
- Şiddet: Evet, fantastik/çizgi film karakterlerine yönelik, gerçekçi değil, kan yok denecek kadar az
- Korku: Hafif korku öğeleri (iskelet, kafatası)
- Cinsellik, küfür, uyuşturucu, kumar: Hayır
- Kullanıcılar arası etkileşim / içerik paylaşımı: Hayır
- Konum paylaşımı: Hayır
- Dijital ürün satın alma: **Evet** (tek seferlik "Mortimer'ın Hazinesi", mağaza sürümünde açılınca)
- Reklam: **Evet** (AdMob açılınca; kapalıysa Hayır)

Beklenen sonuç: **PEGI 7 / USK 6 / ESRB Everyone 10+** civarı.

## Gizlilik soruları (App Store "App Privacy" ve Play "Data safety")

Şu anki sürüm: **Hiçbir veri toplanmıyor.** Oyun internete bağlanmıyor; ilerleme yalnız cihazda (localStorage + Capacitor Preferences) tutuluyor; hesap yok.
- App Store: "Data Not Collected"
- Play Data safety: "No data collected", "No data shared"

**AdMob eklenirse değişir:** Cihaz kimliği (reklam kimliği), kaba konum (IP'den), ürün etkileşimi, çökme verisi → "Third-party advertising" amacıyla toplanır. iOS'ta App Tracking Transparency izni ve SKAdNetwork ayarı gerekir; Play'de Data safety formu yeniden doldurulur. `gizlilik.html` içinde bu bölüm hazır, reklam açılınca "henüz yok" notu kaldırılır.

## Sürüm notu (ilk sürüm)

TR: İlk sürüm! Mortimer'ın çayı soğumadan savunmaya geç.
EN: First release! Defend the chapel before Mortimer's tea gets cold.

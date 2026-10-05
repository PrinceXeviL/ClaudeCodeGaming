# Vibe coding ile oyun/uygulama yapıp yayınlayanlar — kanıtlar

Tarih: 3 Eki 2026. Kaynaklar web araması ile tarandı (Reddit, Indie Hackers, HN, ekşi, haber siteleri).

## Güçlü kanıtlar (ölçülebilir sonuç var)

| Kim / ne | Ne yaptı | Sonuç | Kaynak |
|---|---|---|---|
| Pieter Levels — fly.pieter.com | Hiç oyun yapmamışken Cursor + Three.js ile tarayıcı uçuş simülatörü (~3 saatte ilk sürüm) | 17 günde $1M ARR (oyun içi reklam satışı, slot başı $5k/ay). Mobil mağaza değil, web. | levels.io/fly-pieter-com-vibecoded-flight-simulator, remarkablemag.com |
| Reddit "Ieocoout" — Capybara yemek dağıtım oyunu | Claude Code ile 2 haftada, 27.000 satır kodun tamamı AI | Cursor Vibe Jam 2026'da $25.000 ödül. Not: 9 yıllık iOS geliştiricisi. | wccftech.com (13 Tem 2026) |
| Hakan Turinay (X) | iOS oyununu "neredeyse tamamen AI ile" yapıp App Store'a çıkardı; Claude Code + React Native, 27 dil | Yayında | x.com/hakanturinay |
| Indie Hackers "Lloyd" | Kod bilmeden 6 haftada Claude ile iOS kalori uygulaması (Expo + Supabase + RevenueCat) | App Store'da yayında; "App Store incelemesi geliştirmeden uzun sürdü" | indiehackers.com |
| NYT / Yahoo Finance haberi (Tem 2026) | Kod bilmeyen girişimciler vibe coding ile App Store'a uygulama basıyor | Bazıları ciddi para kazanıyor, çoğu kazanmıyor | finance.yahoo.com |
| Emre Akın (TR) | 80+ Flutter uygulama/mini oyun, Google Play'de | Yayında (gelir belirtilmemiş) | keaa24.github.io |
| Onur Hüseyin Koçak (TR) — Vibe Coding Turkey | Claude Code/Codex ile birkaç iOS uygulaması | App Store'da yayında | vibecodingturkey.com |
| Levels'in Vibe Jam 2025/2026 | Yüzlerce AI ile yapılmış oyun | 2026 kazananları "üretim kalitesine yaklaşıyor" | levels.io/vibe-jam-2026-winners-quality |

## Ekşi sözlük ve TR forumlar

- ekşi "vibe coding" başlığı: tanım + genel görüş "prototip için harika, production için ne yaptığını bilmen lazım"; mağazalardaki "crap app" artışından şikâyet var. Somut "yaptım, şu kadar kazandım" entry'si bulunamadı.
- Technopat / DonanımHaber: AI ile yapılmış yayınlanmış oyun için doğrulanabilir başarı hikâyesi bulunamadı (çeviri, küçük araç örnekleri var).
- Webrazzi: Apple'ın vibe coding uygulaması Anything'i kaldırdığı haberi (Mar 2026) — bu, *AI ile yapılmış* uygulamaları değil, *uygulama içinde kod üreten* uygulamaları hedefliyor (Guideline 2.5.2). Bizi etkilemez.

## Ortak dersler (kanıtlardan çıkan)

1. Yayınlamak mümkün ve yaygın. Para kazanmak ayrı mesele: başarılı örneklerin çoğunda dağıtım gücü (Levels'in takipçisi, jam ödülü) belirleyici.
2. Başarılı olanların çoğu ya deneyimli geliştirici ya da çok iterasyon yapmış. "Tek promptla oyun" yok.
3. Mağaza incelemesi (gizlilik politikası, IAP kuralları, çökme) geliştirmeden uzun sürebilir.
4. **Klon riski:** Apple 2023'te kuralları sıkılaştırdı — başka uygulamanın adını, arayüzünü, varlıklarını kopyalayan uygulama reddedilir, geliştirici hesabı kapatılabilir. Mekanik kopyalanabilir (telif kapsamında değil), isim/görsel/ses/seviye düzeni kopyalanamaz.

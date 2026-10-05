# Seferler ve 2. Sefer: Kızılkum

## İsimlendirme

- Bölüm grupları **"Sefer"** adını alır. Her sefer bir ülkede geçer ve haritada kendi sayfası olur.
- **1. Sefer: Ardan Krallığı.** Mevcut 10 bölüm: çayır, orman, bataklık, kayalık, kar ve volkan. Son boss: Kara Lord.
- **2. Sefer: Kızılkum Sultanlığı.** Çöl, vahalar, kanyonlar, tuz gölü, yıkık şehirler ve mezarlar. Son boss: Fırtına Cini.
- Askerlerimiz, kulelerimiz, kahramanlarımız ve kalemiz aynı kalır. Değişenler ortam, düşmanlar, bosslar ve hava.

## 2. Sefer: ortam

| Öğe | 1. Sefer | 2. Sefer |
|---|---|---|
| Zemin | çimen, toprak | kırmızımsı kum, çatlak toprak, tuz kabuğu |
| Yol | toprak yol | sıkıştırılmış kum, yer yer taş döşeme |
| Ağaç | yaprak/çam | hurma, kaktüs, kuru akasya |
| Kaya | gri kaya | kumtaşı, yıkık sütun, yarı gömülü heykel |
| Hava | yağmur, kar | **kum fırtınası** (kule menzili −%15, ekran turuncu puslu), **gece** (karanlık, meşale ışıkları) |

## Yeni düşmanlar (8 + 3 boss)

Her düşmanın bir **karşı hamlesi** var, böylece kule seçimi önem kazanıyor.

| # | Ad | Rol | Özel mekanik | Karşı hamle |
|---|---|---|---|---|
| 1 | **Çöl Akıncısı** | temel piyade | yok, kalabalık gelir | her şey |
| 2 | **Kum Akrebi** | küçük, hızlı, zırhlı | zırh %50 | büyücü / zehir |
| 3 | **Akbaba** | uçan | sürü halinde dalış yapar | okçu |
| 4 | **Deve Süvarisi** | hızlı, yüksek can | ölünce süvari yere düşer, **Akıncı olarak yürümeye devam eder** | kışla ile durdurmak |
| 5 | **Kum Solucanı** | sinsi | **kuma gömülür**: gömülüyken vurulamaz ve durdurulamaz, ara ara yüzeye çıkar | top (yüzeye çıkınca alan hasarı) |
| 6 | **Mumya** | yavaş, çok canlı | **bir kez dirilir** (%50 canla), **ateşle ölürse dirilmez** | Ateş Bataryası, göktaşı |
| 7 | **Kum Cini** | uçan büyücü | büyü direnci yüksek, ileri ışınlanır, yakındakilere kalkan verir | okçu |
| 8 | **Taş Muhafız** | ağır tank | zırh %80, sersemlemez | büyücü |

**Bosslar** (aynı zırh barı sistemi: önce zırh, sonra can):
- **3. bölüm, Akrep Kraliçe:** akrep yavruları çağırır, kuyruğuyla askerleri zehirler.
- **6. bölüm, Dev Kum Solucanı:** kuma dalar, kışla askerlerinin altından çıkıp onları savurur. Zırh barı yerine "gömülü" evreleri var.
- **10. bölüm, Fırtına Cini (sefer sonu):** iki bar. Kum fırtınası çağırır (bütün kulelerin menzili düşer), cin ve mumya lejyonu getirir; zırhı kırılınca dev boyuta büyür.

## Bölümler

| # | Ad | Ortam | Yeni | Hava |
|---|---|---|---|---|
| 1 | Kızılkum Kapısı | açık çöl | Akıncı, Akrep | — |
| 2 | Vaha Yolu | hurmalı vaha, su kenarı | Akbaba | — |
| 3 | Akrep Vadisi | dar kanyon, 2 yol | **Boss: Akrep Kraliçe** | — |
| 4 | Tuz Gölü | beyaz tuz kabuğu | Deve Süvarisi | — |
| 5 | Yıkık Şehir | sütunlar, yarı gömülü heykeller | Kum Solucanı | kum fırtınası |
| 6 | Kum Denizi | dev kum tepeleri | **Boss: Dev Kum Solucanı** | kum fırtınası |
| 7 | Gece Kervanı | gece çölü, meşaleler | Kum Cini | gece |
| 8 | Mezarlar Vadisi | kaya mezarları | Mumya | gece |
| 9 | Güneş Tapınağı | altın kubbeli tapınak avlusu | Taş Muhafız | — |
| 10 | Kızıl Saray | sultan sarayı, 3 yol | **Sefer sonu: Fırtına Cini** | kum fırtınası |

Zorluk 1. seferin 10. bölümünden biraz aşağıda başlar ve oradan yükselir. Yıldızlar ve yıldız gelişmeleri ortak kalır.

## Gereken görseller

Kodla çizilenler: kum fırtınası, gece karanlığı, meşale ışıkları, yol ve zemin karışımı, efektler.

Gemini ile üretilecek 6 görsel (istenirse 1. seferdeki stille aynı sohbette):

1. `s2_dusmanlar_1.png`: Akıncı, Akrep, Akbaba, Deve Süvarisi
2. `s2_dusmanlar_2.png`: Kum Solucanı (yüzeyde), Mumya, Kum Cini, Taş Muhafız
3. `s2_bosslar.png`: Akrep Kraliçe, Dev Kum Solucanı, Fırtına Cini
4. `s2_dekor.png`: 3 hurma, 2 kaktüs, 2 kumtaşı kaya, 1 yıkık sütun, 1 yarı gömülü heykel başı
5. `s2_zemin.jpg`: kum zemin dokusu (kesintisiz döşenebilir)
6. `s2_kapak.jpg`: Kızılkum harita/kapak görseli (çöl, uzakta saray)

Promptlar: `tasarim/gemini-promptlari.md` dosyasının sonundaki "2. Sefer" bölümü.

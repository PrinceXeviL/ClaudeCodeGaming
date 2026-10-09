# Kuleler v2 — araştırma ve öneri (10 Eki 2026)

## Araştırma: oyuncular kulelerden ne bekliyor
Kaynaklar: Kingdom Rush serisi (Ironhide geliştirici notları, KR5 Alliance Steam tartışmaları ve incelemeleri),
Bloons TD 6 (yükseltme yolları), tür forumları (TouchArcade, gamedev.net, Hive Workshop).

1. **Az ama karakterli kule.** KR 4 temel kuleyle yıllardır türün ölçüsü; incelemeler kulelerin kişiliğini (ses, söz, animasyon)
   ve "her kulenin bir işi var" dengesini övüyor. Kalabalık kule listesi değil, her kulenin net rolü.
2. **Her yükseltme görünmeli.** KR5 incelemesi: "her elit seviyede görünüş değişiyor, tam güce gelince bayılıyorum".
   Para verilen adımın ekranda karşılığı olmalı (görsel + belirgin güç sıçraması).
3. **Dallanan, anlamlı seçim.** KR: 4. kademede iki farklı kuleden biri (ayrı görsel, ayrı oynanış). BTD6: yollar kulenin
   ne yaptığını değiştiriyor (yeni saldırı, özellik), sadece sayı değil.
4. **Az ve etkili yetenek.** KR5 geliştiricisi: "3 yerine 2 yetenek; her biri daha özgün ve etkili hissettirsin". İncelemelerde
   "yetenekler akılda kalmadı" en büyük eleştirilerden. Yetenek görünür, anlık ve güçlü olmalı (koyun yapan büyücü en sevilen örnek).
5. **Destek kulesi zayıf hissettirmesin.** KR5 oyuncusu: "hasar artıran kule güzel ama doğrudan hasar kulesi kurmak daha iyi geliyor".
   Destek kulesinin kendi görünür etkisi olmalı.
6. **Tek süper kule olmamalı.** Her kulenin zayıflığı olmalı; bölümün birden çok çözümü olmalı (zırh/büyü direnci/uçan karşıtlıkları).
7. **Sayısal sıkı denge.** Altın kıt; kademe yükseldikçe altın başına güç hafif artmalı (yatırım ödüllendirilsin), ama kuleler arası
   uçurum olmamalı.

## Bizde durum (sorunlar)
- Uzmanlık = tek yetenek yolu; kule görünüşü değişmiyor, etkiler küçük (Kemik Yelpazesi ek kıymık, Ruh Çivisi vb.). Seçimin karşılığı ekranda yok.
- Altın başına güç dengesiz: Ruh Feneri 9,1 / Dikilitaş 8,6 / Veba Kazanı 4,6 (alan hasarı hesaba katılsa bile düşük).
- Mahzen 3 yol, diğerleri 2 — tutarsız ama mahzende kabul edilebilir.

## Öneri: 3 kademe + 4. kademede dönüşüm (KR modeli)
- 1–3. kademe: şimdiki gibi (her kademede yeni görsel zaten var). Sayılar dengelenir.
- **4. kademe: iki ayrı kuleden biri seçilir.** Kendi Gemini görseli, kendi adı, belirgin güç sıçraması ve **saldırı biçimi değişir**.
- Seçilen 4. kademe kulenin **2 yeteneği** var, her biri 3 kademe (altınla).
- Her kulenin rolü ve zayıflığı net:

| Kule | Rol | Zayıflık | 4a | 4b |
|-|-|-|-|-|
| Kemik Dikilitaşı | hızlı tek hedef, uçanı vurur | ağır zırh | **Kemik Balistası**: dev kemik mızrak, sıradaki düşmanları da deler, zırh deler | **Hayalet Okçular**: tepesinde iki hayalet okçu, çok hızlı atış, uçanlara ekstra |
| Ruh Feneri | büyü, zırh deler | büyü direnci, yavaş | **Ruh Emici**: sürekli ışın, giderek artan hasar, iskeletleri iyileştirir | **Ruh Kafesi**: en güçlüyü ruh kafesine hapseder, hayalet salar |
| Veba Kazanı | alan hasarı | uçanı vuramaz, yavaş | **Ceset Mancınığı**: çok uzun menzil, dev ceset/kemik yığını, sarsıntı | **Kara Veba Kazanı**: yolda kalıcı zehir gölü, zırh çürütür |
| Mahzen | yolu keser | hasarı düşük | Kemik Muhafızlar (kalkan) | Ölüm Şövalyeleri (kılıç) / Kemik Okçular |
| Lanet Kulesi | alan zayıflatma + dalga hasarı | tek hedefe zayıf | **Kan Mabedi**: çevresindeki kuleleri hızlandırır + güçlendirir | **Kara Lanet Mabedi**: lanet sıçrar, ölenler kalkar |

Yetenek örnekleri (her biri 3 kademe):
- Kemik Balistası: Zıpkın (en güçlüyü 2 sn yere çiviler) · Kemik Yağmuru (alana kıymık yağmuru)
- Hayalet Okçular: Çoklu Atış (3 hedef) · Zehirli Kıymık (zehir + yavaşlatma)
- Ruh Emici: Zincir Işın · Can Emme
- Ruh Kafesi: Ruh Hapsi · Hayalet Alayı
- Ceset Mancınığı: Ceset Cephanesi · Kemik Şarapneli
- Kara Veba Kazanı: Bulaşıcı Veba · Çürük Gaz (zırh -%50)
- Kan Mabedi: Kan Ayini · Kan Kalkanı (iskeletleri iyileştirir)
- Kara Lanet Mabedi: Lanet Sıçraması · Mezar Çağrısı (lanetliler ölünce kalkar)

## Sayı hedefleri
- Altın başına saniyedeki hasar (tek hedef): 1. kademe ~6,5 → 3. kademe ~8,5 → 4. kademe ~10.
- Alan kuleleri tek hedefte %35–40 daha düşük, ama 3+ düşmanlı alanda öne geçer.
- 4. kademe maliyeti 230–300; yetenek kademeleri 120 / 170 / 230.
- Mahzen: iskelet canı ve zırhı, düşman hasarına göre "bir dalgada en az 2 düşmanı tutar".

## Görsel ihtiyacı (Gemini, Caner çizdirir)
4a/4b kuleleri: Dikilitaş 2, Ruh Feneri 2, Veba Kazanı 2, Lanet Kulesi 2 + Lanet Kulesi 1–3. kademe = 11 görsel
(ikişer ikişer tek sayfada → yaklaşık 6 adım). Mahzen 4. kademeleri mevcut iskelet görselleriyle.

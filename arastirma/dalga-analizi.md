# Dalga analizi: Kingdom Rush ile karşılaştırma (11 Eki 2026, yayın 339)

## 1. Bot testi (40 bölüm, her biri 3 tur)
Bot bütün kule türlerini kurar ve yükseltir; büyüleri ve komutanı kabaca kullanır. Puan: kazanınca kalan can, kaybedince eksi (kalan dalga).
Bot oyuncudan zayıf; asıl bakılacak şey eğrinin düzgünlüğü.

| Sefer | Bölüm | Ort. | | Sefer | Bölüm | Ort. |
|-|-|-|-|-|-|-|
| 1 | 1 Ölü Orman | 20 | | 2 | 21 Darağacı Yolu | 14.7 |
| 1 | 2 Kuzgun Tepesi | 20 | | 2 | 22 Yanık Kazıklar | 11 |
| 1 | 3 Dikenli Patika | 18.3 | | 2 | 23 Avcı Kampı | 11.3 |
| 1 | 4 Çürük Kökler | 20 | | 2 | 24 Kuzgun Tepesi | 9 |
| 1 | 5 Sisli Bataklık | 15 | | 2 | 25 Karantina Kapısı | 9.7 |
| 1 | 6 Sülük Gölcükleri | **1.3** | | 2 | 26 Boş Pazar | 15 |
| 1 | 7 Kurbağa Adası | 6.7 | | 2 | 27 Veba Hendeği | 4.7 |
| 1 | 8 Batık Köprü | **3** | | 2 | 28 Ölüler Kuyusu | 12.7 |
| 1 | 9 Unutulmuş Mezarlık | 15.3 | | 2 | 29 Sazlık Şapel | 10.7 |
| 1 | 10 Kemik Tarlası | 11.7 | | 2 | 30 Su Basmış Avlu | 7.3 |
| 1 | 11 Fener Bekçisinin Mezarı | 16.3 | | 2 | 31 Mum Işığı Koridoru | 5.7 |
| 1 | 12 Yıkık Kilise | **19.7** | | 2 | 32 Çan Kulesi | 2.3 |
| 1 | 13 Kara Göl Geçidi | 9.7 | | 2 | 33 Kafatası Kapısı | 7 |
| 1 | 14 Boğulmuşlar İskelesi | **−0.3** | | 2 | 34 Kemik Avize Salonu | 7 |
| 1 | 15 Sazlık Kıyı | 12.3 | | 2 | 35 Kemik Mahzeni | **−4.3** |
| 1 | 16 Kara Su Değirmeni | **1** | | 2 | 36 Kripta | 7 |
| 1 | 17 Kemik Kapı | 16.7 | | 2 | 37 Sis Yolu | **−4.7** |
| 1 | 18 Lanet Kuyusu | 7.3 | | 2 | 38 Yıkık Kule | 5.7 |
| 1 | 19 Kemik Köprü | **−5** | | 2 | 39 Kızıl Sur | 2 |
| 1 | 20 Mortimer'ın Kapısı | 8.7 | | 2 | 40 Ay Sunağı | 4.7 |

Eğri testere dişi: 6, 8, 14, 16, 19, 35, 37 ani duvar; 9-12 ve 17 çok kolay. 19. bölüm (Kemik Köprü) finalden zor.

## 2. Rakip: Kingdom Rush dalga tabloları (wiki, Campaign)
| Bölüm | Dalga | Toplam düşman | Başlangıç altını | Arsa | Not |
|-|-|-|-|-|-|
| 1 Southport | 7 | 56 | 265 | 8 | dalga 3 → 16; tek tür (goblin), 4. dalgada ilk ork |
| 4 Twin Rivers | 13 | ~350 | 520 | 15 | iki giriş, büyük dalgadan sonra 9'luk küçük haydut dalgası |
| 5 Silveroak Forest | 15 | ~240 | 700 | 12 | 30 kurt → 6 worg → karışık; 20 örümcek → 3 ana örümcek |
| 13 Sarelgaz (boss) | 20 | ~750 | 800 | 14 | dört giriş, her dalga bir tema, son dalgada boss |
| Origins 1 Gray Ravens | 6 | ~90 | 320 | 9 | ilk 3 dalga tek tür |

Kingdom Rush kalıpları:
1. **Dalga sayısı değişir:** ilk bölümler 6-7, orta 13-15, büyük boss bölümü 20.
2. **Toplam düşman 10 kat büyür:** 1. bölüm 56, 13. bölüm ~750. Erken bölümler kısa ve öğretici.
3. **Tema dalgaları:** çoğu dalga tek tür ya da tek fikir (yalnız örümcek, yalnız kurt sürüsü, yalnız trol). Yeni düşman önce tek başına gelir, sonra karışır.
4. **Ritim (nefes):** kalabalık dalgadan sonra az sayıda güçlü düşman (30 kurt → 6 worg; 20 örümcek → 3 ana örümcek). Eğri düz yükselmez, inip çıkar.
5. **Girişler bölünür:** aynı dalga iki-dört girişe dağıtılır, oyuncu kulelerini yaymak zorunda kalır.

## 3. Bizim dalgalar
- Her bölüm **tam 8 dalga** (iki seferin hepsi). Dalga sayısı hiç değişmiyor.
- Her dalga bir öncekinin **1,3 katı** (9-12-16-21-28-37-49-65): son dalga ilkinin ~7 katı, zorluk hep sona yığılıyor; ilk 3 dalga boş geçiyor, nefes dalgası yok.
- Toplam düşman 1. bölümde 237, 20. bölümde 373 (**yalnız 1,6 kat** artış). 1. bölüm Kingdom Rush'ın 1. bölümünün 4 katı kalabalık.
- 2. seferde aynı sayılar tekrar ediyor: 3 bölüm 237, 6 bölüm 288 düşman, eğri birebir aynı.
- Bir dalgada 3-11 farklı tür karışık geliyor; tema dalgası ve tanıtım dalgası yok.
- Çoğu bölüm tek ya da iki giriş.
- Başlangıç altını (300-720) ve arsa sayısı (9-14) Kingdom Rush'a yakın, sorun değil.

## 4. Tavsiyeler (öncelik sırasıyla)
1. **Zorluk eğrisini düzelt (hemen, yalnız sayı):** bölüm başına düşman canı (HPMUL/HPMUL2) bot hedefine göre yeniden ayarlansın:
   1. bölüm ~20 can, sefer sonu ~6 can, arada düzgün iniş. Duvarlar (6, 8, 14, 16, 19, 35, 37) yumuşar, kolay bölümler (9-12, 17) sertleşir.
2. **Dalga sayısını bölüme göre değiştir:** ilk bölümler 6, ortalar 10-12, her bölgenin son (boss) bölümü 14-15 dalga.
   Toplam düşman 1. bölümde ~120'ye iner, sona doğru ~450'ye çıkar (erken bölümler kısa ve öğretici, son bölümler destan gibi).
3. **Testere dişi ritim:** düz 1,3x yerine "büyü, büyü, nefes" düzeni. Her 3-4 dalgada bir az sayıda seçkin düşmandan oluşan kısa dalga
   (ör. 4 ağır piyade, 2 paladin). Oyuncu altın toplayıp kule yükseltir, gerilim inip çıkar.
4. **Tema ve tanıtım dalgaları:** yeni düşman ilk kez tek başına bir dalgada gelir (kodekste tanıtılır), sonra karışır.
   Bazı dalgalar tek fikirli: hızlı sürü (köpek, süvari: Mahzen ister), zırhlı (Ruh Feneri ister), uçan (okçu ister), kuşatma.
   Böylece "2 kazanla geçerim" stratejisi kırılır: her dalga başka bir kuleyi zorlar.
5. **Girişleri böl:** iki girişli haritalarda dalgalar iki yola dağıtılsın, bazı dalgalar ters taraftan baskın gibi gelsin.
6. **2. seferin kopyalarını ayır:** aynı toplam ve aynı eğriyi tekrar eden bölümlere farklı dalga sayıları ve temalar.

Uygulama yeri: `sinir-kalesi/js/data.js` `shapeWaves` (dalga şekli), `TOTAL`/`TOTAL2` ve `HPMUL`/`HPMUL2` (bölüm başına), denge botu `sinir-kalesi/tools/denge-sayfa.js` (`__bot`, `__measure`, `__tune2`).

Kaynaklar: Kingdom Rush Wiki (Fandom): Southport, Twin Rivers, Silveroak Forest, Sarelgaz's Lair, Gray Ravens (Origins) wave tabloları.

# Kalıcı gelişim (RPG) önerisi — 11 Eki 2026

## Bugün oyunda olan
- **Yıldız ağacı** (`UPGRADES`, data.js): bölüm yıldızlarıyla kule/kale/güç geliştirmeleri, 6 satır × 3 kademe. Kalıcı.
- **Şapelde büyü geliştirme** (`SPELL_UP`, game.js): bölüm içinde altınla, her büyüye 2 kademe. Bölüm bitince sıfırlanır.
- **Komutan seviyesi**: bölüm içinde XP ile 1→4, her bölüm 1'den başlar (`HERO_MAX = 4`, `xpNeed = 50·lvl`).

## Rakiplerde
| Oyun | Büyü / güç | Kahraman |
|-|-|-|
| Kingdom Rush (1) | Yıldızlarla kalıcı ağaç (büyüler dahil), ücretsiz sıfırlama | Bölüm içinde seviye, sıfırlanır |
| KR Frontiers / Origins | Aynı yıldız ağacı | Kahraman seviyesi KALICI (1→10), her seviyede yetenek puanı, puanlar 5 yetenek × 3 kademeye |
| KR Vengeance / Alliance | Yıldız ağacı + savaş öncesi kule/güç seçimi | Kalıcı seviye + eşya/rün |
| Iron Marines | Kalıcı ağaç | Kalıcı seviye, yetenek puanları |
| Bloons TD 6 | Kalıcı "Monkey Knowledge" ağacı | Bölüm içinde seviye (sıfırlanır) |

Ortak ders: oyuncuyu geri getiren şey **görünür ilerleme** (seviye çubuğu, yeni puan rozeti) ve **geri alınabilir seçim** (ücretsiz sıfırlama: yanlış seçim cezası yok, denemeye teşvik).

## Öneri
1. **Büyü Kitabı (Grimoire)**: Mortimer'ın 5 büyüsü × 5 kademe, kalıcı. Para birimi: bölümlerden kazanılan **Ruh Taşı**
   (yıldız başına 1, meydan okuma ve başarımlardan ek). Kademeler büyüye göre süre/alan/hasar/bekleme; 5. kademe yeni bir etki.
   Örnek Korku: 3 sn → +0,3 sn/kademe (5. kademede 4,5 sn = %50) · alan +%10/kademe · 5. kademe: korkan düşman %20 fazla hasar alır.
   Erişim: haritada şapel düğmesi ve bölümde kaleye dokununca açılan kitap (bölüm içinde yalnız görüntüleme ya da ilk dalgadan önce harcama).
   Ücretsiz sıfırlama. Bölüm içi altınla `SPELL_UP` kalkar (iki sistem karışmasın).
2. **Kalıcı komutan seviyesi**: 1→10, XP öldürmeden ve bölüm bitiminden (kazanınca tam, kaybedince yarım). Her seviyede can/hasar artışı +
   1 yetenek puanı; 4 yetenek × 3 kademe + nihai güç (sol alttaki altın düğme) 3 kademe. Komutanlar ekranında ağaç, ücretsiz sıfırlama.
   Bölüm içi XP 1→4 kalkar (yerine kalıcı seviye).
3. **Yıldız ağacı** yalnız kuleler ve kaleye kalır ("Güçler" satırı Büyü Kitabı'na taşınır).
4. Sonra (isteğe bağlı): komutan eşyası/emanet, bölüm ustalığı (3 yıldız + meydan okuma rozetleri), günlük görev.

Denge: kalıcı güç zorluğu düşürür; dalga canları (HPMUL) bot ile yeniden ayarlanmalı (bot ortalama gelişimle oynar).

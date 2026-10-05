# Görsel listesi (AI sprite üretimi)

> Durum (3 Eki 2026): Şu an tüm görseller Claude'un çizdiği SVG'ler (`varliklar/sprite_uret.py`).
> Bu liste ileride AI ile boyanmış görsellere geçilirse kullanılır. Aynı dosya adıyla PNG koymak yeterli.

Oyun `kod/www/img/<ad>.png` dosyalarını otomatik kullanır. Bir görsel eklenince adını
`kod/www/img/manifest.json` listesine yaz; eksik olanlar kodla çizilmeye devam eder.

## Ortak stil (her prompt'un başına eklenir)

> Hand-painted 2D mobile tower defense game asset, original design, stylized cartoon fantasy,
> bold dark outlines, warm saturated colors, soft light from top-left, 3/4 top-down view,
> single object centered, full object visible, transparent background, no text, no shadow on ground.

Kurallar:
- Hepsi aynı oturumda / aynı stil referansıyla üretilmeli (tutarlılık için ilk kuleyi referans görsel yap).
- Arka plan şeffaf olmalı (değilse arka plan silme aracından geçir).
- Karakterler **sağa bakmalı** (oyun sola bakışı kendisi çeviriyor).
- "Kingdom Rush" adı prompt'a yazılmaz (mağaza klon riski).

## Kuleler — 12 adet, 512×600 px

| Dosya | Prompt eki |
|---|---|
| tower_archer_1 | small wooden archer watchtower on stone foundation, two hooded archers on top |
| tower_archer_2 | taller archer tower, stone lower half, wooden upper deck, banners |
| tower_archer_3 | grand stone archer fortress tower, red banners, three elite archers |
| tower_barracks_1 | small stone barracks house with red roof and wooden door, blue flag |
| tower_barracks_2 | larger fortified barracks, darker red roof, weapon rack, blue flag |
| tower_barracks_3 | stone keep barracks with towers, gold trim, big blue banner |
| tower_mage_1 | slim purple stone mage tower with glowing violet crystal orb on top |
| tower_mage_2 | taller arcane tower, runes glowing, floating crystal |
| tower_mage_3 | majestic wizard spire, gold trim, large radiant crystal, magic aura |
| tower_artillery_1 | stone platform with a short black bronze mortar cannon, cannonball pile |
| tower_artillery_2 | reinforced artillery bastion with bigger mortar |
| tower_artillery_3 | heavy siege mortar fortress, gold bands, dwarven style |

## Düşmanlar — 8 adet, 256×256 px, sağa bakan, yürüme pozu

| Dosya | Prompt eki |
|---|---|
| enemy_goblin | small green goblin with big ears, leather rag, rusty dagger |
| enemy_wolf | grey wild wolf running, red eyes |
| enemy_bandit | human bandit with red bandana, short sword, brown clothes |
| enemy_orc | bulky green orc warrior, iron chest plate, wooden club |
| enemy_bat | giant dark purple bat flying, wings spread |
| enemy_shaman | goblin shaman in purple robe with glowing green staff |
| enemy_knight | dark armored knight, black steel plate, red plume, shield |
| enemy_troll | huge blue-grey mountain troll boss with big wooden club |

## Birimler — 3 adet, 256×256 px, sağa bakan

| Dosya | Prompt eki |
|---|---|
| hero | heroic commander, golden armor, red cape, silver helmet, sword |
| soldier | footman soldier, blue tunic, iron helmet, sword and round shield |
| militia | peasant militia, brown clothes, pitchfork |

## Harita parçaları

| Dosya | Boyut | Prompt eki |
|---|---|---|
| plot | 256×160 | empty circular dirt build site ringed with small stones, top-down |
| tree_1, tree_2, tree_3 | 256×320 | round leafy tree / pine tree / bushy oak (her biri ayrı) |
| rock_1, rock_2 | 192×128 | grey boulder cluster with moss |
| grass_meadow | 512×512 | **seamless tileable** top-down light green meadow grass texture |
| grass_forest | 512×512 | **seamless tileable** dark green forest floor with grass and leaves |
| grass_rocky | 512×512 | **seamless tileable** dry olive grass with small pebbles |
| road | 512×512 | **seamless tileable** top-down sandy dirt road texture with pebbles |

Toplam: 33 görsel. Önce kuleler + düşmanlar (20) yeterli: en büyük görsel farkı onlar yaratır.

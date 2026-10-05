# Gemini (Nano Banana) prompt listesi

## Nasıl yapılır

1. Gemini'de **yeni bir sohbet** aç. Hepsini **aynı sohbette** sırayla üret (stil tutarlı kalsın).
2. Her prompt'tan önce aşağıdaki **STİL** bloğunu yapıştır, ardından o görselin prompt'unu ekle.
3. 2. görselden itibaren **1. görseli (okçu kuleleri) sohbete ekleyip** prompt'un başına şunu yaz:
   `Use exactly the same art style, lighting, outline and level of detail as the attached image.`
4. Her görselde kontrol et; tutmuyorsa **aynı prompt'la yeniden üret**:
   - Arka plan düz beyaz mı?
   - Nesneler birbirine ve kenarlara değmiyor mu?
   - Karakterler sağa mı bakıyor?
5. İndir (tam boyut) ve `Game Lab/varliklar/ham/` klasörüne aşağıdaki adla kaydet.
6. Bitince bana "görseller hazır" yaz. Kesme, arka plan silme, boyutlandırma ve oyuna yerleştirmeyi ben yaparım.

Not: Prompt'larda "Kingdom Rush" yazma. Mağaza klon kuralı nedeniyle orijinal tasarım lazım.

---

## STİL (her prompt'un başına)

```
Hand-painted 2D fantasy game art for a mobile tower defense game. Rich painterly textures with visible brush strokes, soft warm lighting from the top-left, gentle ambient occlusion, clean dark-brown outlines, saturated but natural colors, chunky stylized proportions, high detail. 3/4 top-down view (about 45 degrees from above). Plain solid pure white background, no ground shadow, no text, no watermark, no frame. Every object fully visible, not touching other objects or the image edges.
```

---

## 01_okcu.png — Okçu kuleleri (16:9)

```
16:9 image. Three versions of the same archer tower side by side from left to right, evenly spaced with wide white gaps, all standing on identical round cobblestone foundations of the same size:
1) a small wooden watchtower with cross-braced planks and two hooded green archers on the top platform;
2) a taller tower with a stone lower half, wooden upper deck, two archers and a red pennant;
3) a grand stone archer fortress with crenellations, hanging red banners, gold trim and three elite archers.
```

## 02_kisla.png — Kışlalar (16:9)

```
16:9 image. Three versions of a soldiers' barracks side by side from left to right, evenly spaced with wide white gaps, all on identical round cobblestone foundations:
1) a small stone house with a red tiled roof, wooden arched door and a small blue flag;
2) a larger fortified barracks with a darker red roof, a chimney and blue shields on the walls;
3) a stone keep with an attached round side tower with a conical roof, gold trim and blue banners.
```

## 03_buyucu.png — Büyücü kuleleri (16:9)

```
16:9 image. Three versions of a mage tower side by side from left to right, evenly spaced with wide white gaps, all on identical round cobblestone foundations:
1) a slim purple stone tower with a glowing violet orb floating above the top;
2) a taller arcane tower with glowing runes, gold bands and a floating purple crystal;
3) a majestic wizard spire with gold trim, two small side turrets and a large radiant crystal circled by a magic ring.
```

## 04_topcu.png — Top kuleleri (16:9)

```
16:9 image. Three versions of an artillery tower side by side from left to right, evenly spaced with wide white gaps, all on identical round cobblestone foundations:
1) a low round stone bastion with a short black iron mortar cannon pointing up-right and a small pile of cannonballs;
2) a reinforced bastion with crenellations and a bigger mortar;
3) a heavy dwarven siege mortar fortress with gold bands on the barrel and a red flag.
```

## 05_dusman_a.png — Düşmanlar 1 (16:9)

```
16:9 image. Four enemy characters side by side, evenly spaced with wide white gaps, all full body, all facing RIGHT in a walking pose, consistent scale:
1) a small green goblin with huge pointy ears, yellow eyes, leather rags and a rusty dagger;
2) a grey wild wolf running, red eyes, bristling fur;
3) a human bandit with a red bandana, eye mask, brown vest and a short curved sword;
4) a bulky green orc warrior with tusks, iron chest plate and a spiked wooden club.
```

## 06_dusman_b.png — Düşmanlar 2 (16:9)

```
16:9 image. Four enemy characters side by side, evenly spaced with wide white gaps, all full body, all facing RIGHT:
1) a giant dark purple bat flying with wings spread;
2) a goblin shaman in a purple hooded robe holding a staff with a glowing green orb;
3) a dark armored knight in black plate armor with a red plume, a red shield with a skull emblem and a sword;
4) a huge blue-grey mountain troll boss, hunched, with tusks and a giant wooden club, drawn about twice as big as the others.
```

## 07_dostlar.png — Kahraman ve askerler (16:9)

```
16:9 image. Three allied characters side by side, evenly spaced with wide white gaps, all full body, all facing RIGHT in a ready stance:
1) a heroic commander in golden armor with a flowing red cape, silver helmet with a white plume and a raised sword;
2) a footman soldier in a blue tunic, iron helmet with nose guard, round blue shield with gold rim and a sword;
3) a peasant militia man in brown clothes and a straw hat holding a pitchfork.
```

## 08_dekor.png — Harita parçaları (16:9)

```
16:9 image. Six separate map props spread out in a 3x2 grid with wide white gaps:
top row: 1) an empty round dirt building plot ringed with small stones, seen from above; 2) a round leafy green tree; 3) a tall pine tree;
bottom row: 4) a wide oak tree; 5) a cluster of grey boulders with moss; 6) a smaller pair of mossy rocks.
```

## 09–12 Zemin dokuları (1:1, STİL bloğunu KULLANMA)

Bunlarda STİL yerine şunu yaz, sonuna ilgili satırı ekle:

```
1:1 image. Seamless tileable top-down ground texture for a hand-painted 2D fantasy game, painterly brush strokes, flat even lighting, no objects, no shadows, no perspective, fills the entire image edge to edge.
```

- `09_cim_cayir.png` → `Lush light-green meadow grass with a few tiny wildflowers.`
- `10_cim_orman.png` → `Dark green forest floor grass with scattered fallen leaves and moss.`
- `11_cim_kayalik.png` → `Dry olive-green grass with small pebbles and patches of dirt.`
- `12_yol.png` → `Sandy brown dirt road surface with small pebbles and wheel-worn texture.`

## 13_baslik.png — Başlık ekranı arka planı (16:9, isteğe bağlı)

```
16:9 hand-painted fantasy landscape painting: a stone frontier castle with red-roofed towers on green rolling hills, a winding dirt road leading to its gate, forest on the sides, warm sunset sky. Leave the top-center area calm and empty for a game title. No text.
```

## 14_kale.png — Oyuncunun kalesi, 3 hasar evresi (16:9)

Eklerken 1. görseli (okçu kuleleri) stil referansı olarak ekle.

```
Use exactly the same art style, lighting, outline and level of detail as the attached image.

Hand-painted 2D fantasy game art for a mobile tower defense game. Rich painterly textures with visible brush strokes, soft warm lighting from the top-left, gentle ambient occlusion, clean dark-brown outlines, saturated but natural colors, chunky stylized proportions, high detail. 3/4 top-down view (about 45 degrees from above). Plain solid pure white background, no ground shadow, no text, no watermark, no frame. Every object fully visible, not touching other objects or the image edges.

16:9 image. Three versions of the SAME player castle side by side from left to right, evenly spaced with wide white gaps, identical size, shape and camera angle, each on an identical round cobblestone foundation. The castle is compact and wider than tall: a stone keep with two round corner towers with blue conical roofs, crenellated walls, a big arched wooden main gate at the front-left facing the viewer, and blue royal banners with a golden lion.
1) intact and proud, banners flying;
2) the same castle damaged: cracked walls, a few fallen stones, one torn banner, small fires and thin smoke;
3) the same castle heavily damaged: one tower roof collapsed, large holes in the walls, broken gate, big fires and thick dark smoke, banners torn.
```

---

# 2. Sefer: Kızılkum Sultanlığı

Kurallar aynı: yeni sohbet aç ya da eski sohbete devam et. Her görselde STİL bloğunu ekle ve 1. görseli (okçu kuleleri) stil referansı olarak koy. Karakterler **sağa** baksın, beyaz zemin üzerinde birbirine değmesin. Dosyaları `varliklar/ham/` klasörüne aşağıdaki adlarla kaydet.

## s2_dusmanlar_1.png — Çöl düşmanları 1 (16:9)

```
16:9 image. Four desert enemy characters side by side, evenly spaced with wide white gaps, all full body, all facing RIGHT in a walking pose, consistent scale:
1) a lean desert raider in a sand-colored turban and face veil, red sash, baggy trousers, curved scimitar;
2) a large armored desert scorpion with a glossy dark-red shell, raised stinger tail and big pincers (side view, legs visible);
3) a scruffy bald-headed vulture with ragged dark-brown wings spread mid-flight, hungry red eyes;
4) a camel rider: a tall tan camel with a striped saddle blanket and a mounted raider holding a spear.
```

## s2_dusmanlar_2.png — Çöl düşmanları 2 (16:9)

```
16:9 image. Four desert enemy characters side by side, evenly spaced with wide white gaps, all full body, all facing RIGHT, consistent scale:
1) a giant sandworm bursting up out of a small sand mound, ringed segmented body, round mouth full of teeth;
2) a shambling mummy wrapped in old torn bandages, glowing green eyes, arms stretched forward;
3) a floating blue djinn with a smoky tail instead of legs, golden bracelets and a glowing orb between its hands;
4) a hulking sandstone guardian golem with a carved ancient mask face, cracked stone body and glowing amber runes.
```

## s2_bosslar.png — Çöl bossları (16:9)

```
16:9 image. Three large boss monsters side by side, evenly spaced with wide white gaps, all full body, all facing RIGHT, menacing and bigger than normal enemies:
1) a scorpion queen: a huge scorpion with a golden crown-like crest, purple-black armored shell and a dripping venom stinger;
2) a colossal sandworm emerging from the sand, armored segments like stone plates, rows of teeth, small rocks falling off;
3) a storm djinn sultan: a towering red-and-gold djinn with a jeweled turban, swirling sandstorm tail, four arms holding a scimitar and lightning.
```

## s2_dekor.png — Çöl dekoru (16:9)

```
16:9 image. Desert map decorations side by side, evenly spaced with wide white gaps, each on its own: three different date palm trees, two tall green saguaro-like cacti, two sandstone boulders, one broken ancient stone column, one half-buried giant stone statue head.
```

## s2_zemin.jpg — Kum zemin dokusu (1:1, STİL bloğunu KULLANMA)

```
Seamless tileable top-down texture, hand-painted game art style: warm reddish-orange desert sand with soft wind ripples, a few tiny pebbles and small cracks. Even lighting, no shadows from objects, no objects, no text.
```

## s2_kapak.jpg — Kızılkum harita görseli (16:9)

```
16:9 hand-painted fantasy landscape painting: a vast red desert with rolling dunes, a green oasis with palm trees in the middle, a winding sand road leading to a distant golden domed sultan's palace on the horizon, warm late-afternoon sky. Leave the top-center area calm and empty for a title. No text.
```

## Yol dokuları (1:1, STİL bloğunu KULLANMA)

Yol boyunca döşenir. Doku yönsüz olmalı: yol kıvrıldıkça döndürülmüyor, o yüzden çizgi, iz ya da tek yönlü desen olmamalı.

### yol_toprak.jpg — 1. sefer toprak yol

```
Seamless tileable top-down texture, hand-painted mobile strategy game art style: a packed dirt road surface, warm light-brown earth with subtle darker compacted patches, small scattered pebbles and a few flat embedded stones, fine hairline cracks. Uniform pattern in all directions, no wheel tracks, no lines, no grass, no edges or borders, no objects, no text. Even soft lighting from above, no cast shadows.
```

### yol_kum.jpg — 2. sefer kum ve taş yol

```
Seamless tileable top-down texture, hand-painted mobile strategy game art style: a compacted desert sand road with some worn, half-buried old sandstone paving slabs, warm beige-orange tones, small pebbles and fine cracks between slabs. Uniform pattern in all directions, no wheel tracks, no lines, no edges or borders, no objects, no text. Even soft lighting from above, no cast shadows.
```

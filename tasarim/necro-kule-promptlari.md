# Kuleler — yeni kadro (8 Eki): Caner'in listesi benimsendi

ÖNCEKİ mancınık ve okçu promptları (aşağıda, eski bölüm) İPTAL. Yeni kule kadrosu:

| Kule | Yerine geçtiği | Rol | Mekanik | Uzmanlıklar |
|---|---|---|---|---|
| Kemik Dikilitaşı | Okçu | tek hedef, hızlı, uçanları vurur | kemik kıymığı fırlatır | Veba Kemiği (zehir) / Kemik Mızrak (kritik, uzun menzil) |
| Veba Kazanı | Mancınık | alan hasarı | veba güllesi; düştüğü yerde gaz kalır (sürekli hasar), zırh çürütür | Çürüme Bulutu (büyük gaz) / Çifte Kazan |
| Mezar Mahzeni | Kışla | minyon | iskeletler yolu keser | Mezar Bekçisi / Zombi Sürüsü |
| Ruh Feneri | Büyücü | zayıflatma | ruh ışını: zırh deler, yavaşlatır | Lanet (güçlü yavaşlatma) / Korku Işığı (kaçırma şansı) |
| Kan Sunağı (yeni, 3. bölüm) | — | güçlendirme | çevredeki kulelere +%20/30/40 saldırı hızı | Kan Ayini (+hasar) / Kan Kalkanı (iskeletleri iyileştirir) |
| Nekropol (yeni, 5. bölüm) | — | ağır savunma | tek dev Abomination: çok canlı, yolu tıkar, yere vurup sersemletir | İkiz Ucube / Zehirli Patlama |

Promptlar (kule sayfalarında `varliklar/ham/nm_mahzen.jpg` stil referansı, birimlerde `nm_iskeletler.jpg`): sohbette 8 Eki
mesajında tam metin; dosya adları: nm_dikilitas.jpg, nm_kazan.jpg, nm_fener.jpg, nm_sunak.jpg, nm_nekropol.jpg, nm_abomination.jpg.

---

## ESKİ (iptal)
# Kemik Mancınığı ve iskelet okçular — yeniden tasarım promptları (karanlık ambiyans)

Sıra: 1 → 2 → 3 (mancınık), 4 → 5 (okçular). Her sonucu kaydet: `varliklar/ham/` (adlar aşağıda).
Animasyon: mancınığın atış kolunu ayrı çizdiriyoruz, oyunda kod döndürür (geri çekilir, fırlatır, sallanır).
Okçular kare kare çizilir (8 karelik atış), poz kılavuzu: `varliklar/ham/anim/kilavuz_okcu.png`.

## Ortak stil (her promptun başında var)

Dark gothic hand-painted 2D mobile tower defense art in the style of Kingdom Rush, but with a darker mood: deep shadows,
desaturated cold grey stone, black wood and aged ivory bone, sickly green ghost-fire and violet glow as the only bright
light sources, thick dark outlines, soft cel shading, still clearly readable at small size.

## 1) Mancınık gövdeleri, kolsuz — `nm_mancinik_govde.jpg`

```
Dark gothic hand-painted 2D mobile tower defense art in the style of Kingdom Rush, but with a darker mood: deep shadows, desaturated cold grey stone, black wood and aged ivory bone, sickly green ghost-fire and violet glow as the only bright light sources, thick dark outlines, soft cel shading, still clearly readable at small size.

A sheet of 3 upgrade levels of the same tower, side by side, left to right, each bigger and more menacing: the BONE CATAPULT, a necromancer's artillery tower that hurls skulls to the RIGHT. Three-quarter top-down view, all on a round dark stone foundation, same baseline.

IMPORTANT: draw the catapults WITHOUT their throwing arm. Show the empty frame with a big round iron AXLE HUB clearly visible at the top of the frame, where the arm will be attached (the game adds a separate animated arm).
Level 1: a small crooked frame of black wood lashed together with bones and rope on a cracked stone base, a pile of skulls ready as ammunition, a dim green candle.
Level 2: a taller frame reinforced with big femur bones and rusty iron bands on a raised dark stone platform, a stack of green-glowing skulls, a hanging green lantern, chains.
Level 3: a monstrous siege engine whose frame is a giant blackened ribcage, green ghost-fire braziers at the corners, a bubbling cauldron of green plague beside it, spikes and chains, faint violet mist at the base.

Flat solid pure magenta #FF00FF background, no ground outside the foundations, no shadows, no text.
```

## 2) Atış kolları — `nm_mancinik_kol.jpg`
Ek: 1. adımın sonucu.

```
The attached image shows 3 catapult towers from my game without their throwing arms. Draw ONLY the 3 matching THROWING ARMS, one for each level, in EXACTLY the same dark art style, colors and scale as the attached image.

Layout: 3 rows, one arm per row (level 1 on top), each arm lying HORIZONTAL and pointing to the RIGHT, with clear empty space around each.
Each arm: a round iron AXLE HUB at its LEFT end (this is the pivot), the throwing cup at its RIGHT end opening upward.
Level 1: a black wooden beam lashed with bones and rope, a small wooden cup holding one skull.
Level 2: a long femur-bone beam with rusty iron bands, an iron cup holding a skull wrapped in green ghost-fire.
Level 3: a giant monster spine with vertebrae and chains, the cup is a horned giant skull holding bubbling green plague.

Flat solid pure magenta #FF00FF background, no shadows, no text.
```

## 3) Mermiler ve çarpma — `nm_mancinik_mermi.jpg`

```
Dark gothic hand-painted 2D mobile game effects in the style of Kingdom Rush, thick dark outlines, soft cel shading, sickly green and violet glow.

A sheet of 6 separate objects in one row with clear space between them:
1. A cracked aged bone skull (catapult ammo).
2. A skull wrapped in green ghost-fire, flames trailing to the left.
3. A clay pot of bubbling green plague with a skull on its lid, green drips.
4. A green plague splash puddle on the ground, seen from three-quarter top-down, with small skull bits.
5. A burst of bone fragments and green sparks flying outward (impact explosion).
6. A swirling green-violet ghost smoke puff.

Flat solid pure magenta #FF00FF background, no ground, no text.
```

## 4) İskelet okçular, tasarım — `nm_okcular.jpg`
Ek: `varliklar/ham/nm_iskeletler.jpg` (iskelet stil referansı).

```
The attached image shows the skeleton warriors of my game. Draw 5 NEW skeleton ARCHERS of the same undead army in the same art style and proportions (not chibi), but with a darker gothic mood: deep shadows, desaturated bone and black cloth, sickly green and violet glow as the only bright lights, thick dark outlines.

Layout: one row, full body, each standing in a ready stance holding the bow low, facing RIGHT, clear empty space between them. Every archer is fully OPAQUE.
1. Bone Archer: lean skeleton, ragged dark purple hooded cloak, a simple bow made of a bent rib bone, a small quiver of bone arrows, glowing green eye sockets.
2. Bone Marksman: dented iron half-helmet, leather straps over the ribcage, a recurve bow made of two curved bones bound with iron, a fuller quiver.
3. Skull Sentinel: elite archer with a tall hood and a small bone crown, a long black bow with a glowing green bowstring, tattered purple cape.
4. Plague Archer: a plague-doctor beak mask over the skull, dark leather coat, bubbling green poison dripping from the arrow tips.
5. Ghost Marksman: a gaunt skeleton wrapped in pale grey burial cloth, a very long black longbow, cold cyan-green glowing eyes and fingertips.

Flat solid pure magenta #FF00FF background, no ground, no shadows, no text.
```

## 5) Okçu atış animasyonu (8 kare) — `nm_okcu_1_atis.jpg` (sonra 2, 3, 4, 5 için aynı)
Ek: 4. adımın sonucu ve `varliklar/ham/anim/kilavuz_okcu.png`.

```
I attached two images.
IMAGE 1: five skeleton archers from my game. Use ONLY the FIRST archer (the Bone Archer, far left).
IMAGE 2: a POSE GUIDE with 8 stick-figure poses in 4 columns and 2 rows. Red = the archer's near arm (holding the bow) and near leg, blue = far arm (pulling the string) and far leg, brown = bow and string, green = arrow.

TASK: Redraw that archer 8 times, once in each pose of IMAGE 2, in the same 4x2 layout. Copy each pose EXACTLY:
1. idle, bow held low; 2. reaching back over the shoulder for an arrow; 3. nocking the arrow on the string; 4. raising the bow, string slightly pulled; 5. half draw; 6. FULL DRAW, bow vertical, string pulled back to the jaw, aiming RIGHT; 7. RELEASE: arrow flying away to the right, string vibrating, pulling hand thrown back; 8. lowering the bow back to idle.
The arms and bow must clearly change between frames; the legs stay planted.

KEEP IDENTICAL to IMAGE 1's first archer: skull, hood, cloak, bow, quiver, colors, proportions, dark gothic style. Faces RIGHT, same size in every frame, fully visible, feet on the ground line.
Flat solid pure magenta #FF00FF background. No stick figures, no guide lines, no text, no numbers in the final image. Aspect ratio 16:9.
```
Diğer okçular için ilk satırı değiştir: "Use ONLY the SECOND archer (the Bone Marksman)" … vb.

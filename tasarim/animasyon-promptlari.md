# Animasyon kareleri: Gemini promptları

Amaç: her karakter için elle çizilmiş gibi kare kare animasyon (Kingdom Rush kalitesi).
Şu anki görseller tek pozdan çizildiği için kodla sadece gövde eğilip kol dönebiliyor; bacaklar gerçekten adım atamıyor.

## Kurallar (her üretimde)

- Karakterin şu anki görselini Gemini'ye **ek olarak yükle** (`sinir-kalesi/img/<ad>.png`). Prompt "bu karakterin aynısı" der.
- Zemin **düz magenta (#FF00FF)**. Beyaz zemin kol-gövde arasında delik bırakıyordu; magenta temiz silinir.
- Her sayfa **4 sütun × 2 satır = 8 kare**, en-boy oranı **16:9**. Ölüm sayfası 3 × 2 = 6 kare.
- Kareler aynı boyda, ayaklar her karede aynı yer çizgisinde, kareler birbirine değmesin.
- Çıktıyı kaydet: `varliklar/ham/anim/<karakter>_<hareket>.png` (ör. `ork_yuru.png`, `ork_saldir.png`, `ork_olum.png`).
- Tutarsız kare varsa (yüz, silah, renk değişmiş), aynı sohbette "Kare 5'teki karakterin yüzü farklı, diğerleriyle aynı yap" diye düzelttir.

## Pilot: Ork (önce sadece bunu dene)

Ek: `sinir-kalesi/img/enemy_orc.png`

### 1) Yürüyüş — `ork_yuru.png`

```
The attached image is a character from my 2D tower defense game. Create an animation sprite sheet of THIS EXACT SAME orc, in the same polished hand-painted cartoon style as Kingdom Rush (thick dark outlines, soft cel shading, rich colors).

LAYOUT: 8 frames arranged in 4 columns and 2 rows, read left to right, top row first. All cells the same size. The orc is the same size in every frame, fully visible (head, feet and club never cut off), centered in its cell, with both feet standing on the same invisible ground line in every frame. Leave clear empty space between frames; nothing overlaps.

VIEW: three-quarter side view, the orc faces and walks to the RIGHT. Exactly the same camera angle in all 8 frames.

ANIMATION: a heavy, menacing WALK cycle, 8 frames:
1. Contact: right foot forward with heel touching the ground, left foot behind, legs wide apart.
2. Down: weight drops onto the right leg, knees bent, body at its lowest point.
3. Passing: left leg swings forward past the right leg, left knee lifted high, left foot off the ground.
4. Up: pushing off the right foot, body at its highest point.
5. Contact: left foot forward with heel touching the ground, right foot behind.
6. Down: weight on the left leg, body lowest.
7. Passing: right knee lifted high, right foot off the ground.
8. Up: pushing off the left foot, body highest.
The legs must clearly bend at the knees and the feet must clearly lift off the ground. The free arm swings opposite to the legs. The spiked wooden club stays in the same hand and sways with the walk. Shoulders rock slightly side to side.

CONSISTENCY: identical character in every frame: same face, tusks, ears, steel chest plate, leather belt with the round buckle, brown loincloth, wrist wraps, and the same spiked club. Do not redesign, recolor or add anything.

BACKGROUND: flat solid pure magenta #FF00FF filling the whole image. No ground, no shadow, no gradient, no text, no numbers, no grid lines, no borders.
Aspect ratio 16:9.
```

### 2) Saldırı — `ork_saldir.png`

```
The attached image is a character from my 2D tower defense game. Create an animation sprite sheet of THIS EXACT SAME orc, in the same polished hand-painted cartoon style as Kingdom Rush (thick dark outlines, soft cel shading, rich colors).

LAYOUT: 8 frames in 4 columns and 2 rows, read left to right, top row first. All cells the same size, the orc the same size in every frame, fully visible including the whole club, feet on the same invisible ground line. Clear empty space between frames, nothing overlaps or touches the cell edges.

VIEW: three-quarter side view, facing RIGHT, same camera angle in every frame.

ANIMATION: a powerful overhead CLUB SMASH attack, 8 frames:
1. Ready stance: knees bent, club held low in front, glaring at the enemy.
2. Anticipation: crouches lower, shoulders hunched, club pulled back near the hip.
3. Wind-up: club swung up and back over the shoulder, body leaning back, chest open, mouth roaring.
4. Peak: club raised high above and behind the head, whole body stretched tall, front foot lifted.
5. Swing: club coming down fast in front of the body, front foot stamping forward, a light white motion-trail arc behind the club.
6. Impact: club slammed down in front at ground level, body bent forward, knees deeply bent, small dust puff at the club head.
7. Follow-through: club bouncing slightly up from the ground, body still low and leaning forward.
8. Recovery: straightening up, pulling the club back toward the ready stance.

CONSISTENCY: identical character in every frame: same face, tusks, steel chest plate, belt with round buckle, loincloth, wrist wraps, and the same spiked club in the same hand. Do not redesign, recolor or add anything except the small motion trail in frame 5 and the dust puff in frame 6.

BACKGROUND: flat solid pure magenta #FF00FF filling the whole image. No ground, no shadow, no gradient, no text, no numbers, no grid lines, no borders.
Aspect ratio 16:9.
```

### 3) Ölüm — `ork_olum.png`

```
The attached image is a character from my 2D tower defense game. Create an animation sprite sheet of THIS EXACT SAME orc, in the same polished hand-painted cartoon style as Kingdom Rush (thick dark outlines, soft cel shading, rich colors).

LAYOUT: 6 frames in 3 columns and 2 rows, read left to right, top row first. All cells the same size, the orc the same size in every frame, fully visible, centered, the lowest point of the body always on the same invisible ground line. Clear empty space between frames.

VIEW: three-quarter side view, facing RIGHT, same camera angle in every frame.

ANIMATION: DEATH, 6 frames:
1. Hit: head and shoulders thrown backward, eyes squeezed shut, arms flung out, club slipping from the hand.
2. Stagger: stumbles one step backward, body twisted, club falling.
3. Knees buckle: sinks down onto bent knees, head drooping, arms hanging.
4. Falling: tipping over backward, body diagonal, legs coming off the ground.
5. Impact: back hits the ground, slight bounce, arms and legs splayed.
6. Lying still: flat on his back on the ground, eyes closed, club lying next to him.

CONSISTENCY: identical character in every frame (same face, armor, belt, loincloth, club). Do not redesign or recolor. No blood.

BACKGROUND: flat solid pure magenta #FF00FF filling the whole image. No ground, no shadow, no gradient, no text, no numbers, no grid lines, no borders.
Aspect ratio 16:9.
```

## Pilottan sonra

Ben kareleri keser, ayakları ortak çizgiye hizalar, oyuna kare kare animasyon olarak bağlarım. Ara karelerde
iki kare yumuşakça geçer; vuruş anı ve ayak basışları tam karelerden oluşur. Pilot temizse aynı üç promptu
aşağıdaki karakterlere uyarlarım (her biri için karakter tarifi ve silah hareketi değişir):

| Grup | Karakterler |
|---|---|
| 1. sefer düşmanlar | goblin, haydut, ork, şaman, şövalye, trol, kurt, yarasa (yarasa: uçuş 8 kare + ölüm) |
| 1. sefer bosslar | Goblin Kral, Kurt Alfa, Ork Savaş Ağası, Kara Büyücü, Ölüm Şövalyesi, Trol Kral, Kara Lord |
| 2. sefer düşmanlar | akıncı, akrep, akbaba, deve süvarisi, kum solucanı, mumya, kum cini, taş muhafız |
| 2. sefer bosslar | Akrep Kraliçe, Dev Kum Solucanı, Fırtına Cini |
| Kahramanlar | Komutan, Caner, Zeynep, Tarçın, Ateş Bilgesi (+ yetenek pozu: 8 kare) |
| Asker | köylü milis |

Renklendirilmiş kopyalar (Çöl Şeyhi, Mumya Kral, Taş Titan) temel karakterin karelerinden kodla üretilir; ayrıca çizim gerekmez.
Toplam yaklaşık 31 karakter × 3 sayfa ≈ 95 üretim.

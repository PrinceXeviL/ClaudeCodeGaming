# Lejyoner animasyon promptları (Gemini / Nano Banana)

Amaç: lejyonere kare kare, akıcı yürüyüş (yandan, önden, arkadan) ve mızrak saldırısı kazandırmak.
Oyun bu şeritleri zaten tanıyor (game.js drawUnit): `enemy_legion_walk`, `enemy_legion_walk_on`, `enemy_legion_walk_arka`,
`enemy_legion_atk` varsa iskelet animasyonu yerine bunlar oynatılır. Sola yürürken yandan şerit aynalanır, önden/arkadan aynalanmaz.

## Genel kurallar (her sayfada)
- Çıktı **16:9**, mümkünse en yüksek çözünürlük (2K varsa 2K). Sayfa **4 sütun x 2 satır = 8 kare**, kareler eşit.
- Zemin **düz magenta #FF00FF**. Gölge, zemin, yazı, numara, kılavuz çizgisi yok.
- Her karede karakter **aynı boyda**, kendi hücresinin ortasında; **mızrak dahil hiçbir parça hücre sınırını aşmasın**
  (gerekirse karakter biraz küçük çizilsin). Ayaklar her karede aynı zemin çizgisine bassın.
- Her sayfaya **iki görsel eklenir**: (1) karakter referansı, (2) poz kılavuzu (`varliklar/ham/anim/kilavuz_*.png`).
- Kılavuzdaki renkler: **kırmızı** = yakın (izleyiciye yakın) kol/bacak, **mavi** = uzak kol/bacak.
- Bir sayfa beğenilmezse aynı promptla 2-3 kez daha üret; en tutarlı olanı seç (karakter her karede aynı mı, ayaklar kayıyor mu?).

Ortak stil (her promptun başında):
```
Polished hand-painted 2D mobile tower defense art in the style of Kingdom Rush: chunky cartoon proportions, thick dark brown outlines, soft cel shading, rich saturated colors, slightly humorous dark-fantasy mood. Three-quarter top-down view (camera slightly above).
```

---

## 0) Model sayfası (önce bu): `lejyoner_model.jpg`
Ek: `varliklar/ham/anim/ref_lejyoner.png` (oyundaki lejyoner).
Bu sayfa sonraki tüm sayfalarda **referans** olarak eklenir; önden ve arkadan görünüşün tutarlı olması için şart.

```
[ortak stil]
I attached an image of a Roman-style legionnaire from my game (the golden Solarian Empire).
Draw a CHARACTER TURNAROUND MODEL SHEET of EXACTLY this character, 4 views in one row, same size, same height, standing relaxed, full body:
1. SIDE view facing RIGHT (exactly like the attached image),
2. FRONT view (facing the viewer, walking toward the camera),
3. BACK view (seen from behind, walking away from the camera),
4. three-quarter view facing right and slightly toward the viewer.
Keep IDENTICAL in all views: the steel helmet with the GREY horsehair crest running front-to-back, the cheek guards, the white-and-gold segmented plate armor, the red tunic and red cape, the leather straps and sandals, the big curved RECTANGULAR RED SHIELD with a GOLDEN SUN emblem held on his LEFT arm, the short SPEAR held in his RIGHT hand, the determined but slightly dim face.
In the back view show the back of the shield edge and the red cape; the spear is still in the right hand.
Flat solid pure magenta #FF00FF background, no ground, no shadows, no text, no labels. Aspect ratio 16:9.
```

---

## 1) Yandan yürüyüş (8 kare): `lejyoner_yuru.jpg`
Ek: model sayfası + `varliklar/ham/anim/kilavuz_yuru.png`

```
[ortak stil]
I attached two images.
IMAGE 1: a model sheet of a legionnaire from my game. Use the SIDE view (facing RIGHT) as the character reference.
IMAGE 2: a POSE GUIDE: 8 stick-figure poses of a WALK CYCLE in 4 columns and 2 rows. Red = his NEAR leg and NEAR arm (closer to the viewer), blue = his FAR leg and FAR arm.

TASK: Redraw the legionnaire 8 times, once in each pose of IMAGE 2, in the same 4x2 layout, as one smooth looping walk cycle facing RIGHT:
1. contact: near heel touches the ground in front; 2. down: weight on the near leg, body at its lowest; 3. passing: far knee lifted, far foot off the ground; 4. up: near foot pushes off, body at its highest; 5. contact with the far heel in front; 6. down; 7. passing: near knee lifted; 8. up.
Copy the LEG positions exactly from the guide; the body bobs up and down slightly (lowest in 2 and 6, highest in 4 and 8).
The shield (far arm) stays in front of the chest and only sways a little. The spear (near arm) is held low and swings gently opposite to the near leg.
The red cape and the grey helmet crest trail behind and sway with each step.

KEEP IDENTICAL to IMAGE 1 in every frame: helmet, grey crest, armor, red tunic, cape, shield with golden sun, spear, colors, proportions, face. Same size in every frame, fully visible, feet on the same ground line, the whole spear inside its cell.
Flat solid pure magenta #FF00FF background. No stick figures, no guide lines, no shadows, no text, no numbers. Aspect ratio 16:9.
```

İşleme: `python3 varliklar/anim_isle.py ham/anim/lejyoner_yuru.jpg enemy_legion_walk 4 2`

---

## 2) Önden yürüyüş (8 kare, kameraya / ekranın aşağısına doğru): `lejyoner_on.jpg`
Ek: model sayfası + `varliklar/ham/anim/kilavuz_onarka.png`

```
[ortak stil]
I attached two images.
IMAGE 1: a model sheet of a legionnaire from my game. Use the FRONT view as the character reference.
IMAGE 2: a POSE GUIDE: 8 stick-figure poses of a walk cycle seen FROM THE FRONT, in 4 columns and 2 rows. Red = the character's RIGHT leg and RIGHT arm (on the viewer's LEFT), blue = his LEFT leg and LEFT arm (on the viewer's right).

TASK: Redraw the legionnaire 8 times, WALKING TOWARD THE VIEWER (toward the camera, coming down the screen), once in each pose of IMAGE 2, in the same 4x2 layout, as one smooth looping walk cycle.
Copy which leg is lifted and how high in each frame exactly from the guide; the lifted knee comes up toward the viewer, the body bobs slightly and sways a little from side to side.
His LEFT arm (viewer's right) holds the big red shield with the golden sun in front of his body, angled slightly so we still see his face, helmet and legs. His RIGHT arm (viewer's left) holds the short spear pointing up and slightly forward, swinging gently with the steps.
Face, helmet with grey crest and cheek guards clearly visible from the front.

KEEP IDENTICAL to IMAGE 1 in every frame: helmet, crest, armor, red tunic, shield, spear, colors, proportions, face. Same size in every frame, fully visible, feet on the same ground line, the whole spear inside its cell.
Flat solid pure magenta #FF00FF background. No stick figures, no guide lines, no shadows, no text, no numbers. Aspect ratio 16:9.
```

İşleme: `python3 varliklar/anim_isle.py ham/anim/lejyoner_on.jpg enemy_legion_walk_on 4 2`

---

## 3) Arkadan yürüyüş (8 kare, kameradan uzağa / ekranın yukarısına doğru): `lejyoner_arka.jpg`
Ek: model sayfası + `varliklar/ham/anim/kilavuz_onarka.png`

```
[ortak stil]
I attached two images.
IMAGE 1: a model sheet of a legionnaire from my game. Use the BACK view as the character reference.
IMAGE 2: a POSE GUIDE: 8 stick-figure poses of a walk cycle, in 4 columns and 2 rows. Red = the leg and arm on the VIEWER'S LEFT side, blue = the leg and arm on the VIEWER'S RIGHT side. Seen from behind, the viewer's left is the character's LEFT side (shield side).

TASK: Redraw the legionnaire 8 times SEEN FROM BEHIND, WALKING AWAY FROM THE VIEWER (going up the screen, into the distance), once in each pose of IMAGE 2, in the same 4x2 layout, as one smooth looping walk cycle.
We see his back: the back of the helmet with the grey crest, the red cape covering his back and swaying with each step, the soles of his sandals when a foot lifts, the edge and back of the shield on his LEFT side (viewer's left), the spear in his RIGHT hand (viewer's right) pointing up.
Copy which leg is lifted in each frame exactly from the guide; the body bobs slightly.

KEEP IDENTICAL to IMAGE 1 in every frame: helmet, crest, armor, red cape, shield, spear, colors, proportions. Same size in every frame, fully visible, feet on the same ground line, the whole spear inside its cell.
Flat solid pure magenta #FF00FF background. No stick figures, no guide lines, no shadows, no text, no numbers. Aspect ratio 16:9.
```

İşleme: `python3 varliklar/anim_isle.py ham/anim/lejyoner_arka.jpg enemy_legion_walk_arka 4 2`

---

## 4) Mızrak saldırısı (8 kare, yandan): `lejyoner_saldiri.jpg`
Ek: model sayfası + `varliklar/ham/anim/kilavuz_mizrak.png` (`python3 varliklar/poz_kilavuzu.py mizrak`)
Oyunda **6. kare darbe anıdır** (iskelet o anda hasar alır); kılavuzda turuncu yıldızla işaretli.

```
[ortak stil]
I attached two images.
IMAGE 1: a model sheet of a legionnaire from my game. Use the SIDE view (facing RIGHT) as the character reference.
IMAGE 2: a POSE GUIDE: 8 stick-figure poses of a SHIELD-AND-SPEAR THRUST attack in 4 columns and 2 rows. Red = his NEAR arm holding the spear and his near (front) leg, blue = his FAR arm holding the shield and his far (back) leg. The brown line is the spear, the blue rectangle is the shield. The orange star marks the moment of impact.

TASK: Redraw the legionnaire 8 times, once in each pose of IMAGE 2, in the same 4x2 layout, as one fluid attack facing RIGHT:
1. ready stance: shield in front, spear level at the hip pointing forward;
2. weight shifts back, the spear starts to pull back;
3. PULL BACK: spear hand far behind the hip, spear tip drawn back to the shield, torso leaning back;
4. COIL: spear raised to shoulder height in an overhand grip, tip slightly down, knees bent, gathering power;
5. LUNGE starts: front foot steps forward, the arm drives forward;
6. IMPACT: arm fully extended, the spear thrust far forward past the shield, body leaning into the strike, front knee bent, back leg straight, a small white speed streak along the spear;
7. follow-through: spear still extended, starting to withdraw;
8. recover back to the ready stance.
Copy the arm, spear, shield and leg positions exactly from the guide; the arm and spear must clearly change between frames. The shield pushes forward a little during the lunge. Determined, slightly comical battle face; the cape and the grey crest whip with the motion.

KEEP IDENTICAL to IMAGE 1 in every frame: helmet, crest, armor, red tunic, cape, shield with golden sun, spear, colors, proportions. Same size in every frame, fully visible, feet on the ground line, the whole spear inside its cell even at full extension (draw the character a bit smaller if needed).
Flat solid pure magenta #FF00FF background. No stick figures, no guide lines, no orange star, no shadows, no text, no numbers. Aspect ratio 16:9.
```

İşleme: `python3 varliklar/anim_isle.py ham/anim/lejyoner_saldiri.jpg enemy_legion_atk 4 2`

---

## Sonra (kodda yapılacak)
- Rütbeli lejyonerler (legion_k, legion_y) de bu şeritleri kullansın: şeritler RANK_LOOK ile yeniden renklendirilecek.
- Ölüm animasyonu (8 kare: darbe alır, sendeler, düşer, kalkan yere çarpar) istenirse aynı yöntemle ayrı sayfa.
- Lejyoner iyi olursa aynı sırayla diğer düşmanlar: okçu, gladyatör, suikastçı...

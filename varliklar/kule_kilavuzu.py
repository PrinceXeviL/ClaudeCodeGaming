"""Kale (Mortimer'ın katedrali) için Gemini yerleşim kılavuzu: 3 hasar evresi yan yana.

    python3 varliklar/kule_kilavuzu.py  ->  varliklar/ham/kule_kilavuz.png

Gotik katedral cephesi izleyiciye bakar: iki yanda sivri çan kuleleri, ortada üçgen alınlık ve gül penceresi (yeşil),
altta sivri kemerli büyük kapı, kapının üstünde öne çıkan balkon. Ölçek: Mortimer (kırmızı) binanın ~1/8'i.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'kule_kilavuz.png')
W, H = 2000, 1116
im = Image.new('RGB', (W, H), (255, 0, 255))
d = ImageDraw.Draw(im)
STONE, STONE_D, ROOF, GLASS = (120, 120, 130), (90, 90, 100), (55, 57, 70), (60, 230, 110)

for cx in (340, 1000, 1660):
    base = 1030
    d.polygon([(cx - 280, base - 20), (cx, base - 120), (cx + 280, base - 20), (cx, base + 70)], fill=(92, 70, 40))
    # orta gövde (nef cephesi) ve üçgen alınlık
    d.rectangle([cx - 125, 330, cx + 125, base - 40], fill=STONE)
    d.polygon([(cx - 125, 335), (cx, 170), (cx + 125, 335)], fill=STONE_D)
    # gül penceresi
    d.ellipse([cx - 70, 210 + 40, cx + 70, 350 + 40], fill=GLASS)
    # iki çan kulesi ve sivri külahları
    for sx in (-1, 1):
        x0 = cx + sx * 125
        xa, xb = sorted((x0, x0 + sx * 95))
        d.rectangle([xa, 180, xb, base - 30], fill=STONE_D)
        d.polygon([(xa - 10, 185), ((xa + xb) / 2, 10), (xb + 10, 185)], fill=ROOF)
        for y in (300, 520, 740):  # sivri kemerli uzun pencereler
            m = (xa + xb) / 2
            d.rectangle([m - 18, y, m + 18, y + 110], fill=GLASS)
            d.polygon([(m - 18, y), (m, y - 30), (m + 18, y)], fill=GLASS)
    # sivri kemerli büyük kapı
    d.rectangle([cx - 75, base - 230, cx + 75, base - 40], fill=(70, 45, 25))
    d.polygon([(cx - 75, base - 230), (cx, base - 330), (cx + 75, base - 230)], fill=(70, 45, 25))
    # balkon: kapının üstünde, gül penceresinin altında, öne çıkar; arkasında küçük koyu kemer
    by = 600
    d.rectangle([cx - 40, by - 110, cx + 40, by], fill=(30, 25, 35))
    d.polygon([(cx - 40, by - 110), (cx, by - 160), (cx + 40, by - 110)], fill=(30, 25, 35))
    d.ellipse([cx - 120, by - 30, cx + 120, by + 55], fill=(170, 170, 175))
    d.rectangle([cx - 120, by + 10, cx + 120, by + 25], fill=(170, 170, 175))
    # Mortimer: KÜÇÜK (~125 px), önden, solunda tırpan
    d.ellipse([cx - 15, by - 122, cx + 15, by - 92], fill=(200, 20, 30))
    d.polygon([(cx - 19, by - 96), (cx + 19, by - 96), (cx + 30, by + 10), (cx - 30, by + 10)], fill=(200, 20, 30))
    d.line([(cx - 40, by - 132), (cx - 40, by + 8)], fill=(40, 30, 20), width=6)
    d.polygon([(cx - 40, by - 132), (cx - 90, by - 112), (cx - 104, by - 70), (cx - 52, by - 117)], fill=(210, 210, 220))
    d.arc([cx - 120, by - 30, cx + 120, by + 55], 0, 180, fill=(20, 20, 20), width=10)
    for k in range(-100, 101, 25):
        d.line([(cx + k, by + 12), (cx + k, by + 48 - abs(k) * 0.2)], fill=(20, 20, 20), width=6)
    d.line([(cx - 120, by + 10), (cx + 120, by + 10)], fill=(20, 20, 20), width=7)

im.save(OUT)
print(OUT)

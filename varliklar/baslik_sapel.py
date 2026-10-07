"""Başlık arka planı (img/nm_title.jpg): eski kulenin ve eski Mortimer'ın üstüne yeni şapel ve balkonda yeni Mortimer konur.

    python3 varliklar/baslik_sapel.py

Kaynak: varliklar/ham/nm_title_kule.jpg (eski kuleli arka plan, ilk çalıştırmada img/nm_title.jpg'den kopyalanır).
Şapel: img/castle_1.webp; Mortimer: img/mortimer_cast.webp 2. kare (dururken). Gece sahnesine uysun diye hafif karartılır.
"""
import json, os, shutil
import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
SRC = os.path.join(ROOT, 'varliklar', 'ham', 'nm_title_kule.jpg')
if not os.path.exists(SRC):
    shutil.copy(os.path.join(IMG, 'nm_title.jpg'), SRC)

bg = Image.open(SRC).convert('RGBA')
castle = Image.open(os.path.join(IMG, 'castle_1.webp')).convert('RGBA')
H = 690                                   # şapelin boyu (arka plan 1600x900)
k = H / castle.height
c = castle.resize((round(castle.width * k), H), Image.LANCZOS)
# gece: hafif karart, mavimsi
rgb = ImageEnhance.Brightness(c.convert('RGB')).enhance(0.82)
c = Image.merge('RGBA', (*rgb.split()[:3], c.split()[3]))
cx, bottom = 830, 800                     # eski kulenin ortası ve tabanı
x0, y0 = cx - c.width // 2, bottom - c.height
bg.alpha_composite(c, (x0, y0))

# Mortimer balkonda (oyundaki MORT_STAGE[1] ve MORT_PX ile aynı oranlar)
meta = json.load(open(os.path.join(IMG, 'anim.json')))['mortimer_cast']
strip = Image.open(os.path.join(IMG, 'mortimer_cast.webp')).convert('RGBA')
fr = strip.crop((meta['fw'] * 1, 0, meta['fw'] * 2, meta['fh']))
mh = 125 * k                              # Mortimer'ın boyu
s = mh / (meta['ch'] * meta['fh'])
fr = fr.resize((round(fr.width * s), round(fr.height * s)), Image.LANCZOS)
rgb = ImageEnhance.Brightness(fr.convert('RGB')).enhance(0.9)
fr = Image.merge('RGBA', (*rgb.split()[:3], fr.split()[3]))
fx, fy = x0 + 0.454 * c.width, y0 + 0.558 * c.height   # ayak noktası
bg.alpha_composite(fr, (round(fx - fr.width / 2), round(fy - fr.height * (1 - meta['base']))))
# balkon korkuluğu yeniden: ayaklar korkuluğun arkasında kalsın
R = (0.29, 0.548, 0.625, 0.6)
box = (round(R[0] * c.width), round(R[1] * c.height), round(R[2] * c.width), round(R[3] * c.height))
bg.alpha_composite(c.crop(box), (x0 + box[0], y0 + box[1]))

bg.convert('RGB').save(os.path.join(IMG, 'nm_title.jpg'), quality=88)
print('nm_title.jpg', bg.size, 'şapel', c.size, (x0, y0))

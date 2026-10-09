"""Sefer 2 zemin dokuları: Gemini'nin yan yana üç panelini (siyah ayraçlı) ayırır, kare kırpar ve döşenebilir yapar.

    python3 varliklar/zemin2_isle.py   ->  sinir-kalesi/img/grass_village.jpg, grass_marsh.jpg, grass_bone.jpg

Paneller tekrar etmez (yol_isle.py'deki periyot yöntemi işlemez): görüntü yarım kaydırılmış kopyasıyla yalnız kenar
bantlarında karıştırılır; karo kenarları birbirinin devamı olur, orta kısım hiç değişmez.
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SRC = os.path.join(ROOT, 'varliklar', 'ham', 'nm2_zeminler.jpg')
OUT = os.path.join(ROOT, 'sinir-kalesi', 'img')
NAMES = ['grass_village.jpg', 'grass_marsh.jpg', 'grass_bone.jpg']
BAND, SIZE = 0.16, 720


def seamless(a):
    n = a.shape[0]; h = n // 2
    r = np.roll(np.roll(a, h, 0), h, 1)  # kenarları ortada, ortası kenarda
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n * BAND)  # kenara uzaklık / bant
    w1 = np.clip(t, 0, 1); w1 = w1 * w1 * (3 - 2 * w1)
    w = np.minimum(w1[:, None], w1[None, :])[..., None]  # 1: özgün, 0: kaydırılmış (kenarda)
    return a * w + r * (1 - w)


a = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
dark = a.mean(axis=(0, 2)) < 25  # siyah ayraç sütunları
cols, x = [], 0
while x < a.shape[1]:
    if dark[x]: x += 1; continue
    x0 = x
    while x < a.shape[1] and not dark[x]: x += 1
    if x - x0 > 100: cols.append((x0 + 3, x - 3))
assert len(cols) == 3, cols
for (x0, x1), name in zip(cols, NAMES):
    p = a[3:-3, x0:x1]; s = min(p.shape[:2]); oy, ox = (p.shape[0] - s) // 2, (p.shape[1] - s) // 2
    t = seamless(p[oy:oy + s, ox:ox + s])
    Image.fromarray(np.clip(t, 0, 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, name), quality=86)
    print(name, (x0, x1), s)
mp = os.path.join(OUT, 'manifest.json')
json.dump(sorted(set(json.load(open(mp))) | set(NAMES)), open(mp, 'w'), indent=0)

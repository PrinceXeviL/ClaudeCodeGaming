"""Báthory'nin Veo ölümü (14 Eki, çift hareketli video): 0-72 kan küresi atışı (saldırı şeridi zaten var, kullanılmaz), 86-168 ölüm
(göğsünü tutar, kan kurdeleleri yere sıçrar, diz çöker, yana yığılır, kızıl sis). Kadraj saldırı videosuyla aynı (taç 80, etek 617),
bu yüzden aynı ölçek (FIG_TOP/FIG_BOT/CX, TARGET 300); yere yığılan gövde ve sıçrantılar için kutu geniş.
    .venv/bin/python varliklar/bathory_olum_isle.py
"""
import json, os, sys
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/bathory_saldiri_olum_veo.mp4'
FIG_TOP, FIG_BOT, CX = 82, 616, 622
BOX = (CX - 420, 40, CX + 420, 690)
TARGET = 300
name, order = 'hero_bathory_die', list(range(86, 169, 3))   # WebP 16383 px sınırı: 28 kare
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
# Veo sisi gri-beyaz çizdi (prompt kızıl istiyordu) ve beyaz silmede opak leke kalıyor: yığılmış gövdenin (168. kare) dışındaki
# açık renkli, doygunluğu düşük pikseller yarı saydam koyu kızıl sise çevrilir
import numpy as np
from scipy import ndimage
BODY = ndimage.binary_dilation(fr[168].min(2) < 200, iterations=6)
def mist(a, n):
    if n < 134: return a
    f = a.astype(np.float32); rgb = f[..., :3]; mn = rgb.min(2); sat = rgb.max(2) - mn
    m = ~BODY & (mn > 90) & (sat < 60)
    k = np.clip((255 - mn) / 140, 0, 1) * 0.75
    f[m, 3] = f[m, 3] * k[m]; f[m, :3] = np.array([120, 18, 32]) * 0.6 + rgb[m] * 0.15
    return f.astype(np.uint8)
k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
for i, n in enumerate(order):
    a = mist(video_isle.remove_white(fr[n]), n)[y0:y1, x0:x1]
    out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
meta[name] = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4), 'dur': 2.2}
if name + '.webp' not in man: man.append(name + '.webp')
print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

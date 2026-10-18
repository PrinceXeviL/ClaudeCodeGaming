"""Etkinlik sayfası görselleri (18 Eki, Ölüler Gecesi) tek sayfada -> img/ev_<id>_k.jpg (web dosya sınırı): üstte arka plan (1920 genişlik),
altta Gemini'nin yan yana üç kare panelli görselinden (siyah aralıklı) kesilen üç kart (640x640). game.js evImg '_bg' ve '_1..3' isteklerini keser
(kart satırı = genişlik / 3 yüksekliğinde, arka plan geri kalanı).
    .venv/bin/python3 varliklar/etkinlik_kart_isle.py <kartlar.jpg> <id> <arkaplan.jpg>"""
import os, sys
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, eid, bgsrc = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(os.path.join(ROOT, 'varliklar', src)).convert('RGB'); a = np.asarray(im).astype(int)
dark = a.mean(axis=(0, 2)) < 18; runs, s = [], None
for x, d in enumerate(list(dark) + [True]):
    if not d and s is None: s = x
    if d and s is not None:
        if x - s > im.width // 8: runs.append((s, x))
        s = None
ys = np.nonzero(a.mean(axis=(1, 2)) > 18)[0]; y0, y1 = ys.min(), ys.max() + 1; m = max(3, im.width // 600)
P = [im.crop((x0 + m, y0 + m, x1 - m, y1 - m)).resize((640, 640), Image.LANCZOS) for x0, x1 in runs[:3]]
bg = Image.open(os.path.join(ROOT, 'varliklar', bgsrc)).convert('RGB'); bh = round(1920 * bg.height / bg.width); bg = bg.resize((1920, bh), Image.LANCZOS)
S = Image.new('RGB', (1920, bh + 640)); S.paste(bg, (0, 0))
for i, p in enumerate(P): S.paste(p, (i * 640, bh))
out = os.path.join(ROOT, 'sinir-kalesi', 'img', f'ev_{eid}_k.jpg'); S.save(out, quality=86, optimize=True, progressive=True)
print(runs, out, os.path.getsize(out) // 1024, 'KB')

"""Hikâye paneli arka planları (nm_panel_arkaplan.jpg, 2x2, siyah çerçeveli): her kare kendi çerçevesinin içinden kesilir.
    .venv/bin/python varliklar/panel_isle.py   ->  img/comic_bg_{gun,karanlik,gece,mezar}.jpg (+ manifest)
"""
import json, os
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
im = Image.open(os.path.join(D, 'ham', 'nm_panel_arkaplan.jpg')).convert('RGB'); a = np.asarray(im).astype(int); H, W = a.shape[:2]
dark = a.max(-1) < 40
cols = np.nonzero(dark.mean(0) < 0.5)[0]; rows = np.nonzero(dark.mean(1) < 0.5)[0]   # içerik olan sütun/satırlar
def runs(idx):
    out, s = [], idx[0]
    for p, q in zip(idx, idx[1:]):
        if q != p + 1: out.append((s, p)); s = q
    out.append((s, idx[-1])); return [r for r in out if r[1] - r[0] > 100]
xs, ys = runs(cols), runs(rows)
names = [['gun', 'karanlik'], ['gece', 'mezar']]   # ordugâh, taht salonu / kuzgun ormanı, mezarlık
man = set(json.load(open(os.path.join(IMG, 'manifest.json'))))
for j, (y0, y1) in enumerate(ys[:2]):
    for i, (x0, x1) in enumerate(xs[:2]):
        c = im.crop((x0 + 6, y0 + 6, x1 - 5, y1 - 5)); n = 'comic_bg_' + names[j][i]
        c.save(os.path.join(IMG, n + '.jpg'), quality=86); man.add(n + '.jpg'); print(n, c.size)
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'))

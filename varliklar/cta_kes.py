"""24 Eki: Gemini büyük düğme seti (varliklar/ham/cta_v1.jpg, magenta zemin, 4 düğme alt alta) → sinir-kalesi/img/ui_k_cta_<renk>.webp
Sıra: yeşil, kızıl, mor, yeşil basılı. Ölçüler (cap, mücevher gövde kutusu) varliklar/ham/cta_v1_olcu.json ve game.js CTA_K.
    .venv/bin/python3 varliklar/cta_kes.py   (sonra: varliklar/atlas_kur.py)"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from anim_isle import remove_magenta
from arayuz_ton import ton
SRC = os.path.join(H, 'ham', 'cta_v1.jpg'); IMG = os.path.join(H, '..', 'sinir-kalesi', 'img')
rgb = np.asarray(Image.open(SRC).convert('RGB'))
BOX = {'cta_green': (90, 41, 1821, 257), 'cta_red': (90, 303, 1821, 257), 'cta_purple': (89, 564, 1822, 255), 'cta_green_dn': (90, 826, 1821, 253)}
meta = {}
for name, (x, y, w, h) in BOX.items():
    P = 8; x, y, w, h = max(0, x - P), max(0, y - P), w + 2 * P, h + 2 * P
    crop = rgb[y:y + h, x:x + w]; rgba = remove_magenta(crop)
    solid = ndimage.binary_fill_holes(rgba[..., 3] > 100); inner = ndimage.binary_erosion(solid, iterations=4)
    rgba[..., :3] = np.where(inner[..., None], crop, rgba[..., :3]); rgba[..., 3] = np.where(inner, 255, rgba[..., 3])
    f = rgba.astype(np.int16); pink = (rgba[..., 3] < 245) & (((f[..., 0] + f[..., 2]) // 2 - f[..., 1]) > 30) & ~inner
    for ch, v in ((0, 22), (1, 12), (2, 20)): rgba[..., ch] = np.where(pink, v, rgba[..., ch])
    ys, xs = np.where(rgba[..., 3] > 8); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    rgba = ton(rgba, name)
    im = Image.fromarray(rgba); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(os.path.join(IMG, f'ui_k_{name}.webp'), lossless=False, quality=92)
    # mücevher gövde: orta sütunda doygun renkli satırlar, orta satırda gövdenin sol ucu
    a = np.asarray(im).astype(int); mid = a[:, a.shape[1] // 2]; sat = (mid[:, :3].max(1) - mid[:, :3].min(1)) > 60
    ry = np.where(sat)[0]; row = a[(ry.min() + ry.max()) // 2]; sx = np.where((row[:, :3].max(1) - row[:, :3].min(1)) > 60)[0]
    meta[name] = {'w': im.width, 'h': im.height, 'gy0': int(ry.min()), 'gy1': int(ry.max()), 'gx0': int(sx.min()), 'gx1': int(sx.max())}; print(name, meta[name])
man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for n in BOX:
    k = 'ui_k_' + n + '.webp'
    if k not in man: man.append(k)
json.dump(man, open(man_p, 'w'))
json.dump(meta, open(os.path.join(H, 'ham', 'cta_v1_olcu.json'), 'w'))

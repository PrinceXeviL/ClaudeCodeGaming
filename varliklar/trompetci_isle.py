"""Trompetçi (19 Eki, Caner: borazan yerine önde tek elle çalınan düz trompet): ham/nm43_trompetci.jpg (Gemini, beyaz zemin)
-> img/enemy_herald.webp (eskisi cikti/iptal/enemy_herald_cornu.webp) + Wan referansı ham/anim/enemy_herald_ref.png (832x480 magenta).
Beyaz zemin yalnız kenara bağlı beyaz alan olarak silinir (içteki beyaz zırh parlamaları korunur).
    .venv/bin/python3 varliklar/trompetci_isle.py"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
src = np.asarray(Image.open(os.path.join(D, 'ham', 'nm43_trompetci.jpg')).convert('RGB')).astype(np.float32)
mn, mx = src.min(2), src.max(2)
white = (mn > 226) & (mx - mn < 26)
lab, n = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = ndimage.binary_dilation(np.isin(lab, list(edge)), iterations=1) & (mn > 195)
d = ndimage.distance_transform_edt(~bg); a = np.clip(d / 2.0, 0, 1)
soft = (d < 3) & (mn > 150); a[soft] = np.minimum(a[soft], np.clip((255 - mn[soft]) / 90, 0, 1)); a[bg] = 0
rgb = src.copy(); k = (a > 0) & (a < 1); rgb[k] = np.clip((rgb[k] - 255 * (1 - a[k, None])) / np.maximum(a[k, None], 0.05), 0, 255)
out = np.dstack([rgb, a * 255]).astype(np.uint8)
ys, xs = np.nonzero(out[..., 3] > 20); out = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
im = Image.fromarray(out)
H = 380; s = H / im.height; game = im.resize((round(im.width * s), H), Image.LANCZOS)
game.save(os.path.join(IMG, 'enemy_herald.webp'), 'WEBP', quality=92, method=6)
m = json.load(open(os.path.join(IMG, 'meta.json'))); m['enemy_herald'] = [game.width, game.height]; json.dump(m, open(os.path.join(IMG, 'meta.json'), 'w'))
# Wan referansı: magenta 832x480, karakter ~400 px boy ortada (ayaklar 440'ta)
R = Image.new('RGB', (832, 480), (255, 0, 255)); rh = 400; rs = rh / im.height; ri = im.resize((round(im.width * rs), rh), Image.LANCZOS)
R.paste(ri, ((832 - ri.width) // 2, 440 - rh), ri); R.save(os.path.join(D, 'ham', 'anim', 'enemy_herald_ref.png'))
print(game.size, ri.size)

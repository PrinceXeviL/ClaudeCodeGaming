"""Cam kristal kafatası (19 Eki, Caner'in kırmızı cam kafatası referansı): ham/nm42_kristal_cam.jpg -> img/ico_crystal.webp.
Beyaz zemin yalnız KENARA BAĞLI beyaz alan olarak silinir (kafatasının içindeki beyaz parlamalar korunur).
    .venv/bin/python3 varliklar/kristal_cam_isle.py && .venv/bin/python3 varliklar/atlas_kur.py"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); sys.path.insert(0, D)
import serit_temizle
src = np.asarray(Image.open(os.path.join(D, 'ham', sys.argv[1] if len(sys.argv) > 1 else 'nm42_kristal_cam.jpg')).convert('RGB')).astype(np.float32)
mn, mx = src.min(2), src.max(2)
white = (mn > 222) & (mx - mn < 30)
lab, n = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
bg = ndimage.binary_dilation(bg, iterations=1) & (mn > 190)  # kenardaki açık geçiş pikselleri
# yumuşak kenar: zemine 2 px yakın piksellerde beyazlığa göre kısmi saydamlık
d = ndimage.distance_transform_edt(~bg)
a = np.clip(d / 2.0, 0, 1)
soft = (d < 3) & (mn > 150)
a[soft] = np.minimum(a[soft], np.clip((255 - mn[soft]) / 90, 0, 1))
a[bg] = 0
# beyaz kenar sızıntısı: yarı saydam piksellerde rengi koyu kontura doğru it (beyaz hale kalmasın)
rgb = src.copy(); k = (a > 0) & (a < 1)
rgb[k] = np.clip((rgb[k] - 255 * (1 - a[k, None])) / np.maximum(a[k, None], 0.05), 0, 255)
out = np.dstack([rgb, a * 255]).astype(np.uint8)
ys, xs = np.nonzero(out[..., 3] > 20); out = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
im = Image.fromarray(out); s = 314 / im.height; im = im.resize((round(im.width * s), 314), Image.LANCZOS)
im = Image.fromarray(serit_temizle.kare(np.asarray(im), 'ico_crystal'))
im.save(os.path.join(IMG, 'ico_crystal.webp'), 'WEBP', quality=92, method=6); print(im.size)
m = json.load(open(os.path.join(IMG, 'meta.json'))); m['ico_crystal'] = [im.width, im.height]; json.dump(m, open(os.path.join(IMG, 'meta.json'), 'w'))

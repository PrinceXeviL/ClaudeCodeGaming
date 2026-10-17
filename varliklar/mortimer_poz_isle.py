"""Havalı Mortimer poz sayfası (17 Eki, Gemini: ham/nm35_mortimer_cool.jpg, 3x2, magenta zemin) → img/mortimer_pose_<ad>.webp
Pozlar birbirine çok yakın (zaferin tırpanı yenilgi pozunun kutusuna giriyor): dikdörtgen kutu yerine her ön plan pikseli en yakın büyük
gövde parçasına bağlanır (uzaklık dönüşümü). Ritüel pozunun ayağındaki rün çemberi de pozla birlikte kesilir (Caner: kalsın).
    .venv/bin/python3 varliklar/mortimer_poz_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img'); SRC = os.path.join(H0, 'ham', 'nm35_mortimer_cool.jpg')
NAMES = ['win', 'lose', 'cry', 'point', 'ritual', 'relax']  # sayfadaki sıra (soldan sağa, yukarıdan aşağı)
OUT_H = 640

a = np.asarray(Image.open(SRC).convert('RGB')); Hs, Ws = a.shape[:2]
rgba = remove_magenta(a.copy())
fg = rgba[..., 3] > 40
l, n = nd.label(fg); sz = nd.sum(fg, l, range(1, n + 1))
big = [i + 1 for i, s in enumerate(sz) if s > 100000]
cent = {i: nd.center_of_mass(l == i) for i in big}
order = sorted(big, key=lambda i: (cent[i][0] > Hs / 2, cent[i][1]))  # üst sıra soldan sağa, sonra alt sıra
assert len(order) == 6, (len(order), [int(sz[i - 1]) for i in big])
bigmask = np.isin(l, order)
_, (iy, ix) = nd.distance_transform_edt(~bigmask, return_indices=True)
near = l[iy, ix]  # her pikselin en yakın gövdesi
# küçük parçalar (kıvılcım, alev, çember parçası): 8 px genişletilmiş öbeklerinde tek gövde varsa ona, yoksa en yakın gövdeye
gl, _ = nd.label(nd.binary_dilation(fg, iterations=8))
owner = near.copy()
for gi in range(1, gl.max() + 1):
    gm = gl == gi; bs = [b for b in order if (gm & (l == b)).any()]
    if len(bs) == 1: owner[gm] = bs[0]
man = set(json.load(open(os.path.join(IMG, 'manifest.json')))); meta = json.load(open(os.path.join(IMG, 'meta.json')))
for name, lab in zip(NAMES, order):
    m = fg & (owner == lab)
    ys, xs = np.nonzero(l == lab)
    m = nd.binary_dilation(m, iterations=1) & (rgba[..., 3] > 0)
    yy, xx = np.nonzero(m); y0, y1, x0, x1 = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
    out = rgba[y0:y1, x0:x1].copy(); out[..., 3] = np.where(m[y0:y1, x0:x1], out[..., 3], 0)
    im = Image.fromarray(out); k = OUT_H / im.height; im = im.resize((round(im.width * k), OUT_H), Image.LANCZOS)
    nm = 'mortimer_pose_' + name; im.save(os.path.join(IMG, nm + '.webp'), 'WEBP', quality=90, method=6)
    man.add(nm + '.webp'); meta[nm] = [im.width, im.height]
    print(nm, im.size)
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0); json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'))

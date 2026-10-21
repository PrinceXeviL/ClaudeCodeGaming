"""Mortimer v2 tek görsel kesici (21 Eki): beyaz zemini (kenardan ve büyük iç boşluklardan) siler; kutu verilirse
o kutudaki açık renkli buharı çevresinin rengiyle doldurur (çizimde duman/buhar olmaz).
    .venv/bin/python3 varliklar/mortimer_v2_kes.py ham/mortimer_v2_ana.jpg cikti/mortimer_v2.png [buhar x0,y0,x1,y1]"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__))
src, out = os.path.join(H0, sys.argv[1]), os.path.join(H0, sys.argv[2])
a = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
mn, mx = a.min(2), a.max(2)
bg = (mn > 225) & (mx - mn < 22)
if len(sys.argv) > 3:
    x0, y0, x1, y1 = map(int, sys.argv[3].split(','))
    r, b = a[..., 0], a[..., 2]
    lum = a.mean(2)
    med = ndimage.median_filter(lum[y0 - 30:y1 + 30, x0 - 30:x1 + 30], 45)[30:-30, 30:-30]
    st = np.zeros(bg.shape, bool)
    st[y0:y1, x0:x1] = (lum[y0:y1, x0:x1] > med + 4) & (b > r - 45)[y0:y1, x0:x1]
    gold = (b < r - 45) & (lum > 110)
    st = ndimage.binary_dilation(st, iterations=8) & ~bg & ~gold
    st[:y0 - 8] = st[y1 + 8:] = False
    st[:, :x0 - 8] = st[:, x1 + 8:] = False
    f = a.astype(np.float32)
    Y0, Y1, X0, X1 = y0 - 20, y1 + 20, x0 - 20, x1 + 20
    m = st[Y0:Y1, X0:X1]
    sub = f[Y0:Y1, X0:X1]
    for c in range(3):
        ch = sub[..., c]
        ch[m] = ch[~m].mean()
        for _ in range(3000):
            avg = ndimage.uniform_filter(ch, 3)
            ch[m] = avg[m] * 9 / 8 - ch[m] / 8
    a = f.astype(np.int16)
lab, n = ndimage.label(bg)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sz = ndimage.sum(bg, lab, range(1, n + 1))
big = {i + 1 for i in range(n) if sz[i] > 400}
fg = ~np.isin(lab, list(edge | big))
lab2, n2 = ndimage.label(fg)
if n2 > 1:
    sz2 = ndimage.sum(fg, lab2, range(1, n2 + 1))
    fg = lab2 == np.argmax(sz2) + 1
alpha = ndimage.gaussian_filter(fg.astype(np.float32), 0.7)
alpha = np.where(ndimage.binary_erosion(fg, iterations=1), 1.0, alpha * fg)
rgba = np.dstack([np.clip(a, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
ys, xs = np.nonzero(alpha > 0.05)
im = Image.fromarray(rgba).crop((xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5))
os.makedirs(os.path.dirname(out), exist_ok=True)
im.save(out)
print(out, im.size)

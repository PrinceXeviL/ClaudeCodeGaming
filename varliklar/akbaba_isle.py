"""Akbaba (uçan düşman): Gemini sayfasındaki 3 kanat pozundan (yukarı, düz, aşağı) kanat çırpma şeridi üretir.

    python3 varliklar/akbaba_isle.py

Uçan birimde ayak çizgisi yok: kareler pembe kafanın merkezine göre hizalanır (gövde zıplamasın).
Çıktı: img/enemy_vulture.webp (düz poz), img/enemy_vulture_walk.webp (yukarı-düz-aşağı-düz, 4 kare) + anim/meta/manifest.
"""
import json, os
import numpy as np
from PIL import Image
from anim_isle import remove_magenta
from nm_isle import label

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
BODY_H = 230  # düz pozun şeritteki boyu (px)

rgba = remove_magenta(np.asarray(Image.open(os.path.join(ROOT, 'varliklar', 'ham', 'nm_akbaba.jpg')).convert('RGB')))
H, W = rgba.shape[:2]
# kanat uçları sütunlara taşıyor: nesneler bağlı bileşenle ayrılır (4 kat küçültülmüş maskede), soldan sağa en büyük üçü
F = 4
small = rgba[:H - H % F, :W - W % F, 3].reshape(H // F, F, W // F, F).max(axis=(1, 3)) > 100
lab, n = label(small)
sizes = np.bincount(lab.ravel()); sizes[0] = 0
top3 = sorted(np.argsort(sizes)[-3:], key=lambda kk: np.nonzero(lab == kk)[1].mean())
big = np.kron(lab, np.ones((F, F), np.int32)); big = np.pad(big, ((0, H - big.shape[0]), (0, W - big.shape[1])))
cells = []
for kk in top3:
    c = rgba.copy(); c[..., 3] = np.where(big == kk, c[..., 3], 0)
    ys, xs = np.nonzero(c[..., 3] > 8); c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    a = c.astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pink = (c[..., 3] > 200) & (r > 170) & (r - g > 35) & (b - g > 5) & (b < r)  # çıplak pembe kafa/boyun
    py, px = np.nonzero(pink)
    cells.append((c, px.mean(), py.mean()))
k = BODY_H / cells[1][0].shape[0]
L = max(hx for c, hx, hy in cells); R = max(c.shape[1] - hx for c, hx, hy in cells)
U = max(hy for c, hx, hy in cells); D = max(c.shape[0] - hy for c, hx, hy in cells)
pad = 6
FW, FH = int(np.ceil((L + R) * k)) + 2 * pad, int(np.ceil((U + D) * k)) + 2 * pad
frames = []
for c, hx, hy in cells:
    im = Image.fromarray(c).resize((round(c.shape[1] * k), round(c.shape[0] * k)), Image.LANCZOS)
    f = Image.new('RGBA', (FW, FH), (0, 0, 0, 0)); f.alpha_composite(im, (int(round(pad + (L - hx) * k)), int(round(pad + (U - hy) * k))))
    frames.append(f)
order = [0, 1, 2, 1]
strip = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
for i, j in enumerate(order): strip.alpha_composite(frames[j], (i * FW, 0))
strip.save(os.path.join(IMG, 'enemy_vulture_walk.webp'), 'WEBP', quality=88, method=6)
# düz pozun alt kenarı "ayak çizgisi": oyun uçanları zaten havada çizer
bot = pad + (U - cells[1][2]) * k + cells[1][0].shape[0] * k
anim = json.load(open(os.path.join(IMG, 'anim.json')))
anim['enemy_vulture_walk'] = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((FH - bot) / FH, 4), 'ch': round(BODY_H / FH, 4)}
json.dump(anim, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1)
st = Image.fromarray(cells[1][0]); st = st.resize((round(st.width * k), BODY_H), Image.LANCZOS)
st.save(os.path.join(IMG, 'enemy_vulture.webp'), 'WEBP', quality=88, method=6)
meta = json.load(open(os.path.join(IMG, 'meta.json'))); meta['enemy_vulture'] = [st.width, st.height]
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'))
man = set(json.load(open(os.path.join(IMG, 'manifest.json')))) | {'enemy_vulture.webp', 'enemy_vulture_walk.webp'}
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
print('akbaba', FW, 'x', FH, anim['enemy_vulture_walk'])

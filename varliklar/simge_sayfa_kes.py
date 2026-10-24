"""24 Eki: ızgaralı Gemini simge sayfası (magenta zemin) → img/<ad>.webp (300 px). Var olan dosya varliklar/cikti/iptal/simge_eski/ içine yedeklenir.
    .venv/bin/python3 varliklar/simge_sayfa_kes.py <sayfa.jpg> <sütun> <satır> ad1 ad2 ...   (boş hücre için '-'; sonra varliklar/atlas_kur.py)"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from anim_isle import remove_magenta
IMG = os.path.join(H, '..', 'sinir-kalesi', 'img'); BAK = os.path.join(H, 'cikti', 'iptal', 'simge_eski'); os.makedirs(BAK, exist_ok=True)
src, C, Rr, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
rgb = np.asarray(Image.open(src).convert('RGB')); Hh, Ww = rgb.shape[:2]; cw, ch = Ww / C, Hh / Rr
man = json.load(open(os.path.join(IMG, 'manifest.json')))
for k, name in enumerate(names):
    if name == '-': continue
    c, r = k % C, k // C; x0, y0 = int(c * cw), int(r * ch); crop = rgb[y0:int(y0 + ch), x0:int(x0 + cw)]
    a = remove_magenta(crop); al = a[..., 3]
    lab, n = ndimage.label(al > 60)
    if n > 1:
        sz = ndimage.sum(np.ones_like(al), lab, range(1, n + 1)); keep = np.isin(lab, np.where(sz >= sz.max() * 0.004)[0] + 1)
        a[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=3), al, 0)
    f = a.astype(np.int16); semi = (f[..., 3] < 235) & ((np.minimum(f[..., 0], f[..., 2]) - f[..., 1]) > 45)
    a[..., 3] = np.where(semi, (f[..., 3] * 0.25).astype(np.uint8), a[..., 3])
    ys, xs = np.where(a[..., 3] > 10); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(a); s = 300 / max(im.size); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = os.path.join(IMG, name + '.webp')
    if os.path.exists(p) and not os.path.exists(os.path.join(BAK, name + '.webp')): shutil.copy(p, os.path.join(BAK, name + '.webp'))
    im.save(p, quality=92); print(name, im.size)
    if name + '.webp' not in man: man.append(name + '.webp')
json.dump(man, open(os.path.join(IMG, 'manifest.json'), 'w'))

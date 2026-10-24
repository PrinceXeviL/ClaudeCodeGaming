"""24 Eki: bölüm kartı mod ve zorluk simgeleri (varliklar/ham/nm16_mod_zorluk.jpg, Gemini, magenta zemin, 4x2) → img/ico_mode_<c|h|e|i|s>.webp, ico_diff_<kolay|normal|usta>.webp
    .venv/bin/python3 varliklar/mod_simge_kes.py   (sonra varliklar/atlas_kur.py)"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from anim_isle import remove_magenta
IMG = os.path.join(H, '..', 'sinir-kalesi', 'img')
rgb = np.asarray(Image.open(os.path.join(H, 'ham', 'nm16_mod_zorluk.jpg')).convert('RGB'))
NAMES = ['ico_mode_c', 'ico_mode_h', 'ico_mode_e', 'ico_mode_i', 'ico_mode_s', 'ico_diff_kolay', 'ico_diff_normal', 'ico_diff_usta']
Hh, Ww = rgb.shape[:2]; cw, ch = Ww / 4, Hh / 2
man = json.load(open(os.path.join(IMG, 'manifest.json')))
for k, name in enumerate(NAMES):
    c, r = k % 4, k // 4; x0, y0 = int(c * cw), int(r * ch); crop = rgb[y0:int(y0 + ch), x0:int(x0 + cw)]
    a = remove_magenta(crop); al = a[..., 3]
    lab, n = ndimage.label(al > 60)
    if n > 1:  # en büyük parça + yakın kırıntılar (kıvılcım, para) kalır
        sz = ndimage.sum(np.ones_like(al), lab, range(1, n + 1)); keep = np.isin(lab, np.where(sz >= sz.max() * 0.004)[0] + 1)
        a[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=3), al, 0)
    f = a.astype(np.int16); semi = (f[..., 3] < 235) & ((np.minimum(f[..., 0], f[..., 2]) - f[..., 1]) > 45)
    a[..., 3] = np.where(semi, (f[..., 3] * 0.25).astype(np.uint8), a[..., 3])  # pembe hale
    ys, xs = np.where(a[..., 3] > 10); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(a); s = 300 / max(im.size); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(IMG, name + '.webp'), quality=92); print(name, im.size)
    if name + '.webp' not in man: man.append(name + '.webp')
json.dump(man, open(os.path.join(IMG, 'manifest.json'), 'w'))

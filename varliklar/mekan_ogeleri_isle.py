"""Haritada tıklanan mekân öğeleri (17 Eki, Gemini 3x3 sayfa, magenta zemin) -> img/nm37_z_<id>.webp (atlasa girer).
Sıra (soldan sağa, yukarıdan aşağı) game.js ZONE_ITEM kimlikleriyle: roots, gas, grave, whirl, obelisk, bats, bell, bones, altar.
    .venv/bin/python3 varliklar/mekan_ogeleri_isle.py"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from anim_isle import remove_magenta
import kenar_temizle
IMG = os.path.join(H, '..', 'sinir-kalesi', 'img')
IDS = ['roots', 'gas', 'grave', 'whirl', 'obelisk', 'bats', 'bell', 'bones', 'altar']
OUT_H = 260
a = np.asarray(Image.open(os.path.join(H, 'ham', 'nm37_mekan_ogeleri.jpg')).convert('RGB'))
rgba = remove_magenta(a.copy()); al = rgba[..., 3] > 40
Hh, Ww = al.shape
lab, n = nd.label(nd.binary_dilation(al, iterations=6))
cent = nd.center_of_mass(al, lab, range(1, n + 1)); size = nd.sum(al, lab, range(1, n + 1))
meta = json.load(open(os.path.join(IMG, 'meta.json'))); man = json.load(open(os.path.join(IMG, 'manifest.json')))
for k, zid in enumerate(IDS):
    r, c = divmod(k, 3)
    # hücre: sayfanın 3x3 ızgarası (çizimin ortası sayfa genişliğinin %17-83'ünde)
    cx0, cx1 = Ww * (0.15 + c * 0.235), Ww * (0.15 + (c + 1) * 0.235); cy0, cy1 = Hh * r / 3, Hh * (r + 1) / 3
    keep = [i + 1 for i in range(n) if size[i] > 30 and cx0 <= cent[i][1] < cx1 and cy0 <= cent[i][0] < cy1]
    m = np.isin(lab, keep) & al
    ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(m[y0:y1, x0:x1], crop[..., 3], 0)
    crop = kenar_temizle.temizle(crop, 'nm37_z_' + zid)
    im = Image.fromarray(crop); im = im.resize((round(im.width * OUT_H / im.height), OUT_H), Image.LANCZOS)
    name = 'nm37_z_' + zid; im.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6)
    meta[name] = [im.width, im.height]
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, im.size, len(keep), 'parça')
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w')); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)

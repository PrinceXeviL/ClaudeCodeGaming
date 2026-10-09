"""Heybetli kale görselleri (Gemini, magenta zemin) -> img/castle_keep_N.webp.
Hasar evreleri 1. evrenin kesim kutusuyla kesilir ki kapı ve balkon noktaları (game.js KEEP) hepsinde aynı yerde kalsın.
Kullanım: python3 varliklar/kale_isle.py   (ham/nm_kale_heybetli.jpg, _2.jpg, _3.jpg hangisi varsa)"""
import json, os
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); W_OUT = 760
src = open(os.path.join(D, 'anim_isle.py')).read()
ns = {'np': np}; exec(src[src.index('def remove_magenta'):src.index('def biggest_mask')], ns)


def cut(path):
    rgba = ns['remove_magenta'](np.asarray(Image.open(path).convert('RGB')))
    rgba[..., 3] = np.where(rgba[..., 3] < 24, 0, rgba[..., 3])
    return rgba


base = cut(os.path.join(D, 'ham', 'nm_kale_heybetli.jpg'))
ys, xs = np.where(base[..., 3] > 40)
box = (xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5)
meta = json.load(open(os.path.join(IMG, 'meta.json'))); man = json.load(open(os.path.join(IMG, 'manifest.json')))
for n, name in [(1, 'nm_kale_heybetli.jpg'), (2, 'nm_kale_heybetli_2.jpg'), (3, 'nm_kale_heybetli_3.jpg')]:
    p = os.path.join(D, 'ham', name)
    if not os.path.exists(p): continue
    rgba = base if n == 1 else cut(p)
    crop = Image.fromarray(rgba).crop(box)
    if n == 3:  # duman kutunun üstüne ve sağına taşar: kesik görünmesin diye üst bantta ve sağ kenarın üst yarısında soldur
        c = np.asarray(crop).copy(); h, w = c.shape[:2]; al = c[..., 3].astype(np.float32)
        top = np.clip(np.arange(h) / 70.0, 0, 1)[:, None]
        right = np.clip((w - 1 - np.arange(w)) / 60.0, 0, 1)[None, :]
        upper = (np.arange(h) < h * 0.45)[:, None]
        al = al * top * np.where(upper, right, 1.0)
        c[..., 3] = al.astype(np.uint8); crop = Image.fromarray(c)
    out = crop.resize((W_OUT, round(crop.height * W_OUT / crop.width)), Image.LANCZOS)
    out.save(os.path.join(IMG, f'castle_keep_{n}.webp'), quality=88, method=6)
    meta[f'castle_keep_{n}'] = list(out.size)
    if f'castle_keep_{n}.webp' not in man: man.append(f'castle_keep_{n}.webp')
    print(n, out.size)
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w')); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'))

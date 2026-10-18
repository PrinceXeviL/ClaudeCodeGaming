"""Kristal kafatası (18 Eki, Caner: "koyu kırmızı kafatası, zümrüt gibi ama kıpkırmızı"): Gemini, beyaz zemin.
ham/nm41_kristal_kafatasi.jpg -> img/ico_crystal.webp (atlasa girer; eskisi cikti/ico_crystal_eski.webp).
    .venv/bin/python3 varliklar/kristal_isle.py && .venv/bin/python3 varliklar/atlas_kur.py"""
import os, sys, json
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); sys.path.insert(0, D)
src = open(os.path.join(D, 'kale_v5_isle.py')).read(); ns = {'__file__': os.path.join(D, 'kale_v5_isle.py')}
exec(src[src.index('import os'):src.index('new = beyaz_sil(')], ns)
import serit_temizle
a = ns['beyaz_sil'](np.asarray(Image.open(os.path.join(D, 'ham', 'nm41_kristal_kafatasi.jpg')).convert('RGB')))
ys, xs = np.nonzero(a[..., 3] > 20); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
im = Image.fromarray(a); s = 314 / im.height; im = im.resize((round(im.width * s), 314), Image.LANCZOS)
im = Image.fromarray(serit_temizle.kare(np.asarray(im), 'ico_crystal'))
im.save(os.path.join(IMG, 'ico_crystal.webp'), 'WEBP', quality=92, method=6); print(im.size)
m = json.load(open(os.path.join(IMG, 'meta.json'))); m['ico_crystal'] = [im.width, im.height]; json.dump(m, open(os.path.join(IMG, 'meta.json'), 'w'))

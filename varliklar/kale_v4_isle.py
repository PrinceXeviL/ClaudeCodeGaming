"""Kale v4 (17 Eki, Caner: "buna benzer tasarlayalım Mortimer'in yeni evini kalesini"): teraslı gotik ev, Gemini magenta zemin.
ham/nm_kale_v4.jpg (+ hasar evreleri _2, _3 gelince) -> varliklar/cikti/kale_v4/castle_keep_N.webp (onaydan sonra img/'e geçer).
Tabuttaki haç silinir (harmonik dolgu). Hasar evreleri 1. evrenin kesim kutusuyla kesilir (KEEP noktaları aynı yerde kalsın).
    .venv/bin/python3 varliklar/kale_v4_isle.py"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from anim_isle import remove_magenta
OUT = os.path.join(D, 'cikti', 'kale_v4'); W_OUT = 760
HACLAR = {1: [[(1201, 2062), (1226, 2062), (1226, 2130), (1201, 2130)], [(1191, 2076), (1237, 2076), (1237, 2100), (1191, 2100)]]}


def harmonik(a, m, n=1500):
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min() - 2, ys.max() + 3, xs.min() - 2, xs.max() + 3
    b, mm = a[y0:y1, x0:x1].copy(), m[y0:y1, x0:x1]; b[mm] = b[~mm].mean(axis=0)
    for _ in range(n):
        p = np.pad(b, ((1, 1), (1, 1), (0, 0)), mode='edge'); b[mm] = ((p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4)[mm]
    a[y0:y1, x0:x1] = b


def load(n):
    p = os.path.join(D, 'ham', 'nm_kale_v4%s.jpg' % ('' if n == 1 else '_%d' % n))
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB'); a = np.asarray(im).astype(np.float32)
    for poly in HACLAR.get(n, []):
        mk = Image.new('L', im.size, 0); ImageDraw.Draw(mk).polygon(poly, fill=255); harmonik(a, np.asarray(mk) > 0)
    rgba = remove_magenta(np.clip(a, 0, 255).astype(np.uint8)); rgba[..., 3] = np.where(rgba[..., 3] < 24, 0, rgba[..., 3])
    return rgba


os.makedirs(OUT, exist_ok=True)
base = load(1); ys, xs = np.where(base[..., 3] > 40); box = (xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5)
for n in (1, 2, 3):
    rgba = base if n == 1 else load(n)
    if rgba is None: continue
    c = Image.fromarray(rgba).crop(box); c = c.resize((W_OUT, round(c.height * W_OUT / c.width)), Image.LANCZOS)
    c.save(os.path.join(OUT, 'castle_keep_%d.webp' % n), 'WEBP', quality=90, method=6); print(n, c.size)

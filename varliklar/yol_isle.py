"""Gemini yol dokularını döşenebilir karoya çevirir.

varliklar/ham/yol_toprak.jpg, yol_kum.jpg (Gemini 2x2 tekrarlı verir)  →  sinir-kalesi/img/road_dirt.jpg, road_sand.jpg
Tekrar periyodu ölçülür, dikişin en az fark ettiği satır/sütundan kesilir, kalan dikiş 40 px'lik geçişle kapatılır.
Çalıştır: python3 varliklar/yol_isle.py  (numpy + pillow)
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
HAM = os.path.join(ROOT, 'varliklar', 'ham')
OUT = os.path.join(ROOT, 'sinir-kalesi', 'img')
BAND = 40
JOBS = [('yol_toprak.jpg', 'road_dirt.jpg'), ('yol_kum.jpg', 'road_sand.jpg')]
WIDTH = 800  # çıktı karo genişliği


def period(a, axis):
    n = a.shape[axis]
    rng = range(n // 2 - 60, n // 2 + 60)
    err = lambda s: np.abs(np.take(a, range(s, n), axis) - np.take(a, range(0, n - s), axis)).mean()
    return min(rng, key=err)


def best_cut(a, p, axis):
    """Dikişin geçeceği yer: kopyalar arası farkın en küçük olduğu satır/sütun (geçiş bandı sığacak şekilde)."""
    n = a.shape[axis]
    other = (1, 2) if axis == 0 else (0, 2)
    e = np.abs(np.take(a, range(p, n), axis) - np.take(a, range(0, n - p), axis)).mean(axis=other)
    e[n - p - BAND:] = np.inf  # karo + bant görüntüye sığmalı
    return int(np.argmin(e))


def tile(a):
    py, px = period(a.mean(axis=2), 0), period(a.mean(axis=2), 1)
    y0, x0 = best_cut(a, py, 0), best_cut(a, px, 1)
    # önce sütun dikişi, sonra satır dikişi: kenar bandında karo sonunun devamı ile başı karıştırılır
    t = np.linspace(0, 1, BAND)
    rows = a[y0:y0 + py + BAND].copy()
    band = rows[:, x0:x0 + BAND] * t[None, :, None] + rows[:, x0 + px:x0 + px + BAND] * (1 - t[None, :, None])
    rows[:, x0:x0 + BAND] = band
    rows = rows[:, x0:x0 + px]
    rows[:BAND] = rows[:BAND] * t[:, None, None] + rows[py:py + BAND] * (1 - t[:, None, None])
    return rows[:py], (px, py, x0, y0)


if __name__ == '__main__':
    for src, dst in JOBS:
        a = np.asarray(Image.open(os.path.join(HAM, src)).convert('RGB')).astype(float)
        t, info = tile(a)
        im = Image.fromarray(np.clip(t, 0, 255).astype(np.uint8))
        im = im.resize((WIDTH, round(WIDTH * im.height / im.width)), Image.LANCZOS)
        im.save(os.path.join(OUT, dst), quality=88)
        print(dst, 'periyot/kesim', info, '→', im.size)
    mpath = os.path.join(OUT, 'manifest.json')
    man = sorted(set(json.load(open(mpath))) | {d for _, d in JOBS})
    json.dump(man, open(mpath, 'w'), indent=0)

"""Leonidas v2 (17 Eki, Caner: yeni tasarım: ölü Sparta kralı, Korint miğferi, lambdalı kalkan, tek mızrak, mor ruh alevleri).
ham/nm_leonidas_v2_alevsiz.jpg (beyaz zemin; mor alevli sürümü nm_leonidas_v2.jpg: Wan magenta zemini mor alevi siler, alevler kodla) -> img/hero_leonidas.webp (380 px boy) + meta. Eski görsel ve şeritler varliklar/cikti/leonidas_v1/.
    .venv/bin/python3 varliklar/leonidas_v2_isle.py"""
import os, json, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as nd
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); OLD = os.path.join(D, 'cikti', 'leonidas_v1')


def beyaz_sil(a):
    f = a.astype(np.float32); mn, mx = f.min(2), f.max(2)
    bg = (mn > 228) & (mx - mn < 20)
    lab, _ = nd.label(bg); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); bg = np.isin(lab, edge[edge > 0])
    hole = (mn > 238) & (mx - mn < 12) & ~bg; lab2, n2 = nd.label(hole)  # pelerin yırtıkları, mızrakla kol arası
    if n2: sz2 = nd.sum(np.ones_like(lab2), lab2, range(1, n2 + 1)); bg |= np.isin(lab2, 1 + np.where(sz2 >= 25)[0])
    near = nd.binary_dilation(bg, iterations=3) & ~bg
    w = np.clip((mn - 120) / (250 - 120), 0, 1); al = np.ones(mn.shape, np.float32); al[bg] = 0; al[near] = 1 - w[near]; al[al < 0.08] = 0
    k = np.maximum(al, 0.05)[..., None]; fg = ((f - (1 - k) * 255) / k).clip(0, 255)
    out = np.dstack([np.where(near[..., None], fg, f), al * 255]).astype(np.uint8)
    lab, n = nd.label(out[..., 3] > 40); sz = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.where(sz >= sz.max() * 0.0015)[0]); out[~nd.binary_dilation(keep, iterations=2), 3] = 0
    return out


rgba = beyaz_sil(np.asarray(Image.open(os.path.join(D, 'ham', 'nm_leonidas_v2_alevsiz.jpg')).convert('RGB')))
ys, xs = np.nonzero(rgba[..., 3] > 10); c = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
H = 380; c = c.resize((round(c.width * H / c.height), H), Image.LANCZOS)
os.makedirs(OLD, exist_ok=True)
p = os.path.join(IMG, 'hero_leonidas.webp')
if not os.path.exists(os.path.join(OLD, 'hero_leonidas.webp')): shutil.copy(p, OLD)
c.save(p, 'WEBP', quality=92, method=6)
mp = os.path.join(IMG, 'meta.json'); meta = json.load(open(mp)); meta['hero_leonidas'] = [c.width, H]; json.dump(meta, open(mp, 'w'), separators=(', ', ': '))
print('hero_leonidas', c.size)

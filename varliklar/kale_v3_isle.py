"""Yeni Mortimer kalesi (13 Eki, Caner: sıfırdan tasarım, Gemini, BEYAZ zemin) -> img/castle_keep_1..4.webp.
Beyaz zemin kenarlardan taşma doldurmayla silinir (kalenin içindeki açık renkler korunur). 2-4. hasar evreleri şimdilik
koddan: kararma, is lekeleri, sönük pencereler (gerçek çizim gelince yerine konur). Eski kale: varliklar/cikti/kale_eski/.
    .venv/bin/python varliklar/kale_v3_isle.py   (scipy gerekir)
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); W_OUT = 760
src = np.asarray(Image.open(os.path.join(D, 'ham', 'nm_kale_v3.jpg')).convert('RGB')).astype(float)
mn, mx = src.min(2), src.max(2)
white = (mn > 222) & (mx - mn < 26)                    # beyaza yakın ve renksiz
lab, _ = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
lab2, n2 = ndimage.label(white & ~bg)                  # korkuluk aralarında kalan kapalı beyaz cepler (saf beyaz, en az 25 px)
sz = ndimage.sum(np.ones_like(mn), lab2, range(1, n2 + 1)); pure = ndimage.mean(mn, lab2, range(1, n2 + 1))
holes = [i + 1 for i in range(n2) if sz[i] >= 25 and pure[i] > 236]
bg |= np.isin(lab2, holes)
bg = ndimage.binary_opening(bg, iterations=1)
a = (~bg).astype(float)
a = ndimage.gaussian_filter(a, 0.8); a = np.clip((a - 0.25) / 0.5, 0, 1)   # yumuşak kenar
# kenardaki açık hale: beyazlığı kadar saydamlaştır
soft = (a < 1) & (a > 0); a[soft] *= np.clip((255 - mn[soft]) / 60, 0.3, 1)
ys, xs = np.where(a > 0.3); box = (xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4)
rgba = np.dstack([src, a * 255]).clip(0, 255).astype(np.uint8)
base = Image.fromarray(rgba, 'RGBA').crop(box)
H_OUT = round(W_OUT * base.height / base.width)
base = base.resize((W_OUT, H_OUT), Image.LANCZOS)

def stage(im, k, soot, win):
    x = np.asarray(im).astype(float); rgb, al = x[..., :3], x[..., 3:]
    lum = rgb.mean(2, keepdims=True); glow = (rgb.max(2) - rgb.min(2) > 90)[..., None] & (lum > 90)
    rgb = rgb * (1 - k) + lum * k * 0.6                 # kararma + solma
    rgb = np.where(glow, x[..., :3] * win, rgb)          # pencere ışığı (evrede söner)
    rng = np.random.default_rng(3); h, w = al.shape[:2]
    m = np.zeros((h, w))
    for _ in range(soot):                                # is lekeleri
        cy, cx, r = rng.uniform(0.15, 0.7) * h, rng.uniform(0.15, 0.85) * w, rng.uniform(20, 55)
        yy, xx = np.ogrid[:h, :w]; m = np.maximum(m, np.exp(-((yy - cy) ** 2 + (xx - cx) ** 2) / (2 * r * r)))
    rgb = rgb * (1 - 0.55 * m[..., None])
    return Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8), 'RGBA')

outs = {1: base, 2: stage(base, 0.12, 6, 0.85), 3: stage(base, 0.25, 12, 0.6), 4: stage(base, 0.38, 18, 0.35)}
meta = json.load(open(os.path.join(IMG, 'meta.json')))
for n, im in outs.items():
    im.save(os.path.join(IMG, f'castle_keep_{n}.webp'), 'WEBP', quality=90, method=6)
    meta[f'castle_keep_{n}'] = [W_OUT, H_OUT]
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'), ensure_ascii=False)
print(W_OUT, H_OUT, box)

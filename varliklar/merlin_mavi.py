"""Merlin'in kırmızı pelerin astarı, yakası ve önlüğü koyu maviye (14 Eki, Caner: "pelerinin iç rengi mavi olsun").
Tonu kaydırır, parlaklığı ve doygunluğu korur; mor cübbe, yeşil ruh ateşi ve küre değişmez. Zaten mavi olana dokunmaz (tekrar çalıştırılabilir).
Merlin şeridi üreten betikler (merlin_veo_isle.py, merlin_saldiri_isle.py ...) sonunda bunu çağırır.
    .venv/bin/python varliklar/merlin_mavi.py            # img/hero_merlin*.webp hepsi
"""
import glob, os
import numpy as np
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
HUE = 0.64   # koyu mavi


def mavi(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255
    rgb = a[..., :3]; mx = rgb.max(2); mn = rgb.min(2); d = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    s = d / (mx + 1e-6)
    red = ((h < 0.05) | (h > 0.92)) & (s > 0.22) & (mx > 0.06) & (a[..., 3] > 0.05)
    i = np.full(h.shape, int(HUE * 6) % 6); f = HUE * 6 - np.floor(HUE * 6)
    v = mx; p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    new = np.stack([np.choose(i, [v, q, p, p, t, v]), np.choose(i, [t, v, v, q, p, p]), np.choose(i, [p, p, t, v, v, q])], 2)
    rgb[red] = new[red]
    return Image.fromarray((np.dstack([rgb, a[..., 3]]) * 255).round().astype(np.uint8))


if __name__ == '__main__':
    for p in sorted(glob.glob(os.path.join(IMG, 'hero_merlin*.webp'))):
        mavi(Image.open(p)).save(p, 'WEBP', quality=88, method=6); print(os.path.basename(p))

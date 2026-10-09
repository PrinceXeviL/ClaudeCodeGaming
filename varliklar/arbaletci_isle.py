"""Arbaletçi sayfasını (nm_hayalet_arbaletciler.jpg) iki poza ayırır: AYNI ölçek, ayaklar aynı hizada, aynı tuval yüksekliği.
Ayrıca yeşil (sıradan kademe) kopyalar üretir: kızıl pelerin/göz/sis yeşile döner (img/unit_xbow*, kızıllar unit_ghostxbow*)."""
import json, os
import numpy as np
from PIL import Image
import nm_isle as N
src = N.remove_magenta(np.asarray(Image.open(os.path.join(N.HAM, 'nm_hayalet_arbaletciler.jpg')).convert('RGB')))
objs, big = N.objects(src, 2, rows=True)
objs = sorted(objs, key=lambda o: o['x0'])
crops = [N.crop(src, o, big) for o in objs]
TH = 300  # karakter boyu (px) — iki poz aynı ölçekle küçülür
k = TH / max(c.shape[0] for c in crops)
ims = [Image.fromarray(c).resize((round(c.shape[1] * k), round(c.shape[0] * k)), Image.LANCZOS) for c in crops]
Hc = max(i.height for i in ims)
out = []
for im in ims:  # alt hizalı ortak yükseklik
    c = Image.new('RGBA', (im.width, Hc), (0, 0, 0, 0)); c.paste(im, (0, Hc - im.height)); out.append(c)
def green(im):
    a = np.asarray(im).astype(np.float32) / 255; rgb = a[..., :3]
    mx = rgb.max(-1); mn = rgb.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = (r > g + 0.06) & (r > b * 0.9) & (sat > 0.18)  # pelerin, göz, sis, kiriş: kızıl tonlar
    # ton kaydırma: kırmızı -> koyu yeşil (pelerin) / parlak yeşil (göz ve ışıltı); parlaklık korunur
    lum = 0.35 * r + 0.5 * g + 0.15 * b
    bright = mx > 0.75
    ng = np.where(bright, np.minimum(1, mx * 1.0), mx * 0.78); nr = np.where(bright, mx * 0.55, mx * 0.38); nb = np.where(bright, mx * 0.55, mx * 0.42)
    nr = nr * (1 - 0.0) ; o = rgb.copy()
    o[..., 0] = np.where(red, nr, r); o[..., 1] = np.where(red, ng, g); o[..., 2] = np.where(red, nb, b)
    return Image.fromarray((np.dstack([o, a[..., 3:]]) * 255).clip(0, 255).astype(np.uint8))
IMG = N.IMG
meta = json.load(open(os.path.join(IMG, 'meta.json'))); man = set(json.load(open(os.path.join(IMG, 'manifest.json'))))
for name, im in zip(['unit_ghostxbow', 'unit_ghostxbow_aim'], out):
    for nm, x in ((name, im), (name.replace('ghostxbow', 'xbow'), green(im))):
        x.save(os.path.join(IMG, nm + '.webp'), 'WEBP', quality=90, method=6)
        meta[nm] = [x.width, x.height]; man.add(nm + '.webp'); print(nm, x.size)
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w')); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)

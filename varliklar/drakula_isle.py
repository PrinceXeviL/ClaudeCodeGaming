"""Kont Drakula görseli (ham/nm_drakula.jpg) -> img/hero_drakula.webp (380 px boy) ve Kaggle referansı ham/anim/hero_drakula_ref.png.
Magenta silinir; en büyük parça (Drakula, pelerin, ayaktaki sis) kalır, uzaktaki yarasalar atılır."""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
from anim_isle import remove_magenta
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
rgba = remove_magenta(np.asarray(Image.open(os.path.join(D, 'ham', 'nm_drakula.jpg')).convert('RGB')))
lab, n = ndimage.label(ndimage.binary_dilation(rgba[..., 3] > 60, iterations=6))
big = np.argmax(np.bincount(lab.ravel())[1:]) + 1
rgba = rgba.copy(); rgba[lab != big, 3] = 0
ys, xs = np.nonzero(rgba[..., 3] > 10); c = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
im = Image.fromarray(c); k = 380 / im.height; im = im.resize((round(im.width * k), 380), Image.LANCZOS)
im.save(os.path.join(IMG, 'hero_drakula.webp'), 'WEBP', quality=90, method=6)
meta = json.load(open(os.path.join(IMG, 'meta.json'))); meta['hero_drakula'] = [im.width, im.height]; json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'))
man = set(json.load(open(os.path.join(IMG, 'manifest.json')))); man.add('hero_drakula.webp')
man -= {f for f in man if f.startswith('hero_vladrik')}  # eski komutan görseli ve şeritleri artık kullanılmıyor
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
# Kaggle referansı: 832x480 magenta zemin, karakter ortada
W, H = 832, 480; ref = Image.new('RGBA', (W, H), (255, 0, 255, 255)); r = Image.fromarray(c); kk = (H - 40) / r.height
r = r.resize((round(r.width * kk), H - 40), Image.LANCZOS); ref.alpha_composite(r, ((W - r.width) // 2, 20))
ref.convert('RGB').save(os.path.join(D, 'ham', 'anim', 'hero_drakula_ref.png')); print(im.size, r.size)

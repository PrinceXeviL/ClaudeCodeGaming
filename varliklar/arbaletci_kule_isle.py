"""Arbaletçi kuleleri sayfası (nm_arbaletci_kuleleri.jpg) -> img/tower_xbow_1..3.webp
Genişlikler kademe büyüklüğüne göre sabitlenir (560/630/700 px; Hayalet Arbaletçiler kulesi 700 px ile uyumlu)."""
import json, os
import numpy as np
from PIL import Image
import nm_isle as N
src = N.remove_magenta(np.asarray(Image.open(os.path.join(N.HAM, 'nm_arbaletci_kuleleri.jpg')).convert('RGB')))
objs, big = N.objects(src, 3, rows=True)
objs = sorted(objs, key=lambda o: o['x0'])
meta = json.load(open(os.path.join(N.IMG, 'meta.json'))); man = set(json.load(open(os.path.join(N.IMG, 'manifest.json'))))
for i, (o, W) in enumerate(zip(objs, (560, 630, 700)), 1):
    c = Image.fromarray(N.crop(src, o, big)); k = W / c.width
    c = c.resize((W, round(c.height * k)), Image.LANCZOS)
    nm = f'tower_xbow_{i}'; c.save(os.path.join(N.IMG, nm + '.webp'), 'WEBP', quality=88, method=6)
    meta[nm] = [c.width, c.height]; man.add(nm + '.webp'); print(nm, c.size)
json.dump(meta, open(os.path.join(N.IMG, 'meta.json'), 'w')); json.dump(sorted(man), open(os.path.join(N.IMG, 'manifest.json'), 'w'), indent=0)

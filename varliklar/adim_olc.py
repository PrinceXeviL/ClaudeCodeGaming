"""Yürüyüş şeritlerinin adım boyunu ölçer (13 Eki): anim.json'da her *_walk kaydına stride = bir döngüde (iki adım) gidilen yol / karakter boyu.
Oyun adım hızını buna göre ayarlar (ayak yerde kaymasın). Yeni yürüyüş şeridi eklenince çalıştır:  python3 varliklar/adim_olc.py
"""
import json, os
import numpy as np
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sinir-kalesi', 'img')
A = json.load(open(os.path.join(IMG, 'anim.json')))
for n, F in A.items():
    if not n.endswith('_walk') or not os.path.exists(os.path.join(IMG, n + '.webp')): continue
    a = np.asarray(Image.open(os.path.join(IMG, n + '.webp')).convert('RGBA'))[..., 3] > 128
    fw, fh, N = F['fw'], F['fh'], F['n']
    base = int(fh * (1 - F['base'])); band = slice(max(0, base - int(fh * 0.06)), base + 1)
    sp = []
    for i in range(N):
        xs = np.nonzero(a[band, i * fw:(i + 1) * fw].any(0))[0]
        if len(xs): sp.append(xs.max() - xs.min())
    if not sp: continue
    F['stride'] = round(float(2 * np.percentile(sp, 90) / (F['ch'] * fh)), 3)
json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1, ensure_ascii=False)
print(sum(1 for n, F in A.items() if 'stride' in F), 'şerit ölçüldü')

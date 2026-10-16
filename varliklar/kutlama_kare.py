"""Zafer kutlaması karesi (16 Eki, Caner: "bir ellerini yukarı kaldırsınlar, kılıcı havada tutsunlar"): her birimin saldırı şeritlerinde
(_atk, _atk2, _atk3) silahın en yükseğe çıktığı kareyi bulur (karedeki ilk opak satır en yukarıda olan; duruş karesinden belirgin yüksekte değilse yazılmaz) ve anim.json'da <ad>_atk
kaydına cheer: [ek, kare] yazar. Oyun (drawUnit, CHEER_POSE) kutlamada o kareye kalkar ve orada tutar.
    python3 varliklar/kutlama_kare.py
"""
import os, json
import numpy as np
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
A = json.load(open(os.path.join(IMG, 'anim.json')))
done = 0
SKIP = {'unit_skel_8'}  # en yüksek karesi yay germe (kutlama değil)
for name in [k for k in A if k.endswith('_atk') and (k.startswith('unit_') or k.startswith('hero_'))]:
    base = name[:-4]; best = None; A[name].pop('cheer', None)
    if base in SKIP: continue
    for suf in ('_atk', '_atk2', '_atk3'):
        k = base + suf
        if k not in A or not os.path.exists(os.path.join(IMG, k + '.webp')): continue
        m = A[k]; im = np.asarray(Image.open(os.path.join(IMG, k + '.webp')).convert('RGBA'))[..., 3]
        fw, fh, n = m['fw'], m['fh'], m['n']; cols = im.shape[1] // fw; H0 = None
        for i in range(n):
            fr = im[(i // cols) * fh:(i // cols + 1) * fh, (i % cols) * fw:(i % cols + 1) * fw]
            rows = np.nonzero((fr > 60).sum(1) > 1)[0]
            if not len(rows): continue
            hgt = rows[-1] - rows[0]  # ayaktan en yüksek noktaya
            if H0 is None: H0 = hgt  # şeridin ilk karesi: duruş boyu
            k2 = hgt / max(1, H0)  # silah başın üstüne çıktıkça büyür (ayak tabanına göre, şeritten bağımsız)
            if best is None or k2 > best[0] + 0.01: best = (k2, suf, i)
    if best and best[0] > 1.07: A[name]['cheer'] = [best[1], int(best[2])]; done += 1; print(base, best[1], best[2], round(best[0], 3))
json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'))
print(done, 'birim')

"""Şeritteki küçük kopuk zerreleri siler (13 Eki): Veo videolarında magenta zeminde uçuşan toz/kıvılcım lekeleri kalıyor.
Her karede gövdeye (en büyük parça) MESAFE px'ten uzak ve ALAN px'ten küçük parçalar silinir; gövdeye bağlı büyü dalgaları kalır.
    python3 varliklar/zerre_temizle.py mortimer_dirilt [alan=120] [mesafe=18]"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sinir-kalesi', 'img')
name = sys.argv[1]; AREA = int(sys.argv[2]) if len(sys.argv) > 2 else 120; DIST = int(sys.argv[3]) if len(sys.argv) > 3 else 18
F = json.load(open(os.path.join(IMG, 'anim.json')))[name]
a = np.asarray(Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA')).copy(); fw = F['fw']; n = 0
for i in range(F['n']):
    fr = a[:, i * fw:(i + 1) * fw]; m = fr[..., 3] > 30
    lab, k = ndimage.label(m)
    if k < 2: continue
    sz = ndimage.sum(np.ones_like(lab), lab, range(1, k + 1)); big = 1 + int(np.argmax(sz))
    near = ndimage.binary_dilation(lab == big, iterations=DIST)
    for j in range(1, k + 1):
        if j == big or sz[j - 1] >= AREA: continue
        comp = lab == j
        if (comp & near).any(): continue
        fr[..., 3][ndimage.binary_dilation(comp, iterations=1)] = 0; n += 1
Image.fromarray(a).save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6)
print(name, 'silinen zerre', n)

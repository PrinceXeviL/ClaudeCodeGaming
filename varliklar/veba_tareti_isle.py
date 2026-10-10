"""Veba Tareti sayfasını (nm_veba_tareti.jpg) ayırır: üst sırada 3 kaide (tower_artillery_1..3), alt sırada yandan döner iskelet topçu
(turret_artillery_1..3). Bağlı parçalar en yakın nesne merkezine atanır (üçüncü kaidenin halkası ile tarete ait alev birbirine çok yakın).
    .venv/bin/python varliklar/veba_tareti_isle.py
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
from anim_isle import remove_magenta
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
src = np.asarray(Image.open(os.path.join(D, 'ham', 'nm_veba_tareti.jpg')).convert('RGB'))
rgba = remove_magenta(src); H, W = rgba.shape[:2]; k = W / 2000
NAMES = ['tower_artillery_1', 'tower_artillery_2', 'tower_artillery_3', 'turret_artillery_1', 'turret_artillery_2', 'turret_artillery_3']
# piksel piksel atama: x'e göre sütun (sınırlar 842, 1734), y'ye göre sıra (sütun başına kesim çizgisi). 3. sütunda taretin yeşil alevi
# kaidenin halkasına değer: 790-852 bandındaki yeşil baskın pikseller tarete gider.
yy, xx = np.mgrid[0:H, 0:W]
col = np.where(xx < 842, 0, np.where(xx < 1734, 1, 2))
ycut = np.array([800, 840, 852])[col]
r, g, b = [rgba[..., i].astype(int) for i in range(3)]
green = (g > r + 40) & (g > b + 20)
sat = rgba[..., :3].max(-1).astype(int) - rgba[..., :3].min(-1)
bottom = (yy > ycut) | ((col == 2) & (yy > 790) & (green | ((xx > 1950) & (xx < 2250) & (sat > 40))))  # halkanın gri taşı değil: alev
grp = col + 3 * bottom
lab = np.where(rgba[..., 3] > 0, grp, -1)
man = set(json.load(open(os.path.join(IMG, 'manifest.json')))); meta = json.load(open(os.path.join(IMG, 'meta.json')))
for j, name in enumerate(NAMES):
    m = lab == j
    big = ndimage.label(m)[0]; sz = np.bincount(big.ravel()); sz[0] = 0
    m = np.isin(big, np.nonzero(sz > max(60, sz.max() * 0.002))[0])  # kesimden kalan kırıntılar atılır
    ys, xs = np.nonzero(m)
    c = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(); c[..., 3] = np.where(m[ys.min():ys.max() + 1, xs.min():xs.max() + 1], c[..., 3], 0)
    im = Image.fromarray(c); s = min(1, 700 / max(im.size)); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=88, method=6); man.add(name + '.webp')
    print(name, im.size)
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'))

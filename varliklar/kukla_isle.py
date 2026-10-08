"""Gemini parça sayfasını (magenta zemin, ayrık parçalar) parçalı animasyon atlasına çevirir.

    python3 varliklar/kukla_isle.py ham/anim/lejyoner_parcalar.jpg enemy_legion_parts \
        head,torso,skirt,cape,uarmN,farmN,uarmF,farmF,shield,thighN,shinN,footN,thighF,shinF,footF,spear

Parçalar sayfada satır satır (yukarıdan aşağı, soldan sağa) sıralanır ve verilen adlarla eşlenir (sıra = ad listesi).
Çıktı: sinir-kalesi/img/<ad>.webp (parçalar raf düzeninde), img/puppet.json'a parça dikdörtgenleri; manifest'e eklenir.
Eklem noktaları (pivot) ve iskelet game.js PUPPETS içinde tanımlıdır.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anim_isle import remove_magenta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
SCALE = 0.5


def main(src, name, names):
    rgb = np.asarray(Image.open(os.path.join(ROOT, 'varliklar', src)).convert('RGB'))
    rgba = remove_magenta(rgb)
    a = rgba[..., 3]
    lab, n = ndimage.label(a > 128, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    big = [i for i in range(n) if sizes[i] > 800]
    assert len(big) == len(names), f'{len(big)} parça bulundu, {len(names)} ad verildi'
    # satır: üst kenarı birbirine yakın olanlar aynı satır (parça boyları farklı)
    big.sort(key=lambda i: objs[i][0].start)
    rows, cur = [], [big[0]]
    for i in big[1:]:
        if objs[i][0].start - objs[cur[0]][0].start < 140: cur.append(i)
        else: rows.append(cur); cur = [i]
    rows.append(cur)
    order = [i for r in rows for i in sorted(r, key=lambda i: objs[i][1].start)]
    parts = []
    for nm, i in zip(names, order):
        sy, sx = objs[i]
        m = lab[sy, sx] == i + 1
        grown = ndimage.binary_dilation(m, iterations=2)
        cell = rgba[sy, sx].copy()
        cell[..., 3] = np.where(grown, cell[..., 3], 0)
        im = Image.fromarray(cell)
        im = im.resize((max(1, round(im.width * SCALE)), max(1, round(im.height * SCALE))), Image.LANCZOS)
        parts.append((nm, im))
    # raf düzeni
    W = 1024; x = y = rh = 0; pos = {}
    for nm, im in sorted(parts, key=lambda p: -p[1].height):
        if x + im.width + 2 > W: x = 0; y += rh + 2; rh = 0
        pos[nm] = (x, y, im.width, im.height); x += im.width + 2; rh = max(rh, im.height)
    atlas = Image.new('RGBA', (W, y + rh), (0, 0, 0, 0))
    for nm, im in parts: atlas.paste(im, pos[nm][:2])
    atlas.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6)
    meta_p = os.path.join(IMG, 'puppet.json')
    meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
    meta[name] = {nm: list(map(int, p)) for nm, p in pos.items()}
    json.dump(meta, open(meta_p, 'w'), indent=1)
    man_p = os.path.join(IMG, 'manifest.json')
    man = json.load(open(man_p))
    if name + '.webp' not in man: json.dump(sorted(man + [name + '.webp']), open(man_p, 'w'), indent=0)
    for nm, im in parts: print(nm, im.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3].split(','))

"""2. Sefer (Kızılkum) görsellerini oyuna hazırlar.

varliklar/ham/s2_*.jpg  →  sinir-kalesi/img/  (+ manifest.json ve meta.json güncellenir)
Beyaz zemin silme ve nesne ayırma gorsel_isle.py ile aynıdır.
Çalıştır: python3 varliklar/sefer2_isle.py
"""
import json
import os

import numpy as np
from PIL import Image

import gorsel_isle as gi

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
HAM = os.path.join(ROOT, 'varliklar', 'ham')
OUT = os.path.join(ROOT, 'sinir-kalesi', 'img')
gi.OUT = OUT

# sayfa: (dosya, soldan sağa adlar, ızgara mı, delik eşiği)
SHEETS = [
    ('s2_dusmanlar_1.jpg', ['enemy_raider', 'enemy_scorpion', 'enemy_vulture', 'enemy_camel']),
    ('s2_dusmanlar_2.jpg', ['enemy_sandworm', 'enemy_mummy', 'enemy_djinn', 'enemy_golem']),
    ('s2_bosslar.jpg', ['enemy_scorpion_queen', 'enemy_worm_king', 'enemy_storm_djinn']),
    # üst satır 3 hurma; alt satır hurma, kaktüs, büyük kaya, küçük kaya, sütun, heykel başı
    ('s2_dekor.jpg', ['s2_palm_1', 's2_palm_2', 's2_palm_3', 's2_palm_4', 's2_cactus', 's2_rock_1', 's2_rock_2', 's2_column', 's2_head'], 'grid'),
]
# ikinci dekor sayfasından elle seçilen parçalar: ad -> (x0, y0, x1, y1)
PICKS = {
    's2_palm_double': (55, 70, 565, 525),
    's2_bush_1': (745, 870, 935, 1015),
    's2_bush_2': (1360, 715, 1505, 820),
    's2_pond_2': (1315, 845, 1615, 1015),
}


def sand_tile():
    src = Image.open(os.path.join(HAM, 's2_zemin.jpg')).convert('RGB')
    tile = src.crop((0, 0, 999, 558)).resize((640, 357), Image.LANCZOS)
    tile.save(os.path.join(OUT, 'grass_desert.jpg'), quality=88)


def cover():
    im = Image.open(os.path.join(HAM, 's2_kapak.jpg')).convert('RGB')
    im = im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, 'title_bg_2.jpg'), quality=84)


if __name__ == '__main__':
    gi.META.clear()
    for sheet in SHEETS:
        fname, names = sheet[0], sheet[1]
        grid = len(sheet) > 2 and sheet[2] == 'grid'
        rgb = np.asarray(Image.open(os.path.join(HAM, fname)).convert('RGB'))
        parts = gi.split(gi.remove_white(rgb, 1500), names, grid)
        print(fname, {k: gi.save_sprite(k, v) for k, v in parts.items()})
    rgb = np.asarray(Image.open(os.path.join(HAM, 's2_dekor_2.jpg')).convert('RGB'))
    for name, (x0, y0, x1, y1) in PICKS.items():
        rgba = gi.remove_white(rgb[y0:y1, x0:x1].copy(), 250)  # küçük kapalı beyaz boşluklar da silinir (gövde araları)
        # yalnız en büyük nesne kalır (komşu nesnelerden kırpıntı girmesin)
        lab, n = gi.ndi.label(gi.ndi.binary_dilation(rgba[..., 3] > 90, iterations=4), structure=np.ones((3, 3)))
        if n > 1:
            big = 1 + int(np.argmax(gi.ndi.sum(np.ones(lab.shape), lab, np.arange(1, n + 1))))
            rgba[..., 3] = np.where(lab == big, rgba[..., 3], 0)
        print(name, gi.save_sprite(name, gi.trim(rgba)))
    sand_tile()
    cover()
    # manifest ve meta: mevcut listeye eklenir (eski girdiler korunur)
    mpath, tpath = os.path.join(OUT, 'manifest.json'), os.path.join(OUT, 'meta.json')
    man = json.load(open(mpath))
    new = sorted([n + '.png' for n in gi.META] + ['grass_desert.jpg', 'title_bg_2.jpg'])
    man = sorted(set(man) | set(new))
    json.dump(man, open(mpath, 'w'), indent=0)
    meta = json.load(open(tpath))
    meta.update(gi.META)
    json.dump(meta, open(tpath, 'w'))
    print('manifest', len(man), 'dosya')

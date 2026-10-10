"""Ruh Feneri (nm_ruh_feneri_v3.jpg) hareketli katmanları: fener (1. kademe) ve feneri tutan kol (2-3. kademe) ayrı görsele kesilir,
oyunda pivot noktasından döndürülür (game.js LANTERN_RIG). Önce nm_isle.py sayfayı yeniden keser, sonra bu betik:
    .venv/bin/python varliklar/ruh_feneri_isle.py
Çıktı: img/tower_mage_N.webp (gövde, katmanın yeri boşaltılıp gövdeye değen kısmı en yakın renkle doldurulmuş) ve
img/tower_mage_N_arm.webp (aynı tuval boyunda, yalnız katman). Çokgenler görsel oranı (% x soldan, % y üstten).
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
POLY = {
    1: [(58, 8), (77, 8), (77, 19), (92, 25), (93, 55.5), (55, 55.5), (52, 50), (39, 50), (39, 25), (57, 19)],  # kanca + fener
    2: [(61, 0), (86, 0), (89, 9), (100, 14), (100, 43), (80, 44), (62, 41), (57, 33), (56, 22), (61, 15)],     # kalkık kol + fener + ruh girdabı
    3: [(63, 0), (85, 0), (87, 9), (99, 21), (99, 41), (66, 41), (57, 33), (57, 21), (62, 12)],                  # yumruk + kafatası fener + üst girdap
}

subprocess.run([sys.executable, os.path.join(D, 'nm_isle.py'), 'nm_ruh_feneri_v3.jpg'], check=True, cwd=D)
man = set(json.load(open(os.path.join(IMG, 'manifest.json'))))
for n, poly in POLY.items():
    p = os.path.join(IMG, f'tower_mage_{n}.webp')
    im = np.array(Image.open(p).convert('RGBA')); H, W = im.shape[:2]
    mk = Image.new('L', (W, H), 0); ImageDraw.Draw(mk).polygon([(x * W / 100, y * H / 100) for x, y in poly], fill=255)
    m = np.array(mk) > 0
    arm = im.copy(); arm[~m] = 0
    body = im.copy(); body[m] = 0
    # katman kalkınca altında delik kalmasın: gövdeye 10 px'ten yakın boşaltılmış pikseller en yakın gövde rengiyle dolar (3. kademede hepsi)
    solid = body[..., 3] > 200
    dist, idx = ndimage.distance_transform_edt(~solid, return_indices=True)
    fill = m & (im[..., 3] > 0) & (dist <= (10 if n < 3 else 400))  # 3. kademede fenerin arkası kanat ve cüppe: tamamı dolar
    body[fill] = im[idx[0][fill], idx[1][fill]]; body[fill, 3] = 255
    Image.fromarray(body).save(p, 'WEBP', quality=88, method=6)
    Image.fromarray(arm).save(os.path.join(IMG, f'tower_mage_{n}_arm.webp'), 'WEBP', quality=88, method=6); man.add(f'tower_mage_{n}_arm.webp')
    print(n, W, H, 'katman px', int(m.sum()), 'dolgu px', int(fill.sum()))
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'))

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
    'drain': [(66, 0), (82, 0), (94, 6), (94, 44), (74, 46), (60, 42), (59, 8)],                                 # 4. kademe Ruh Emici: yumruk + kristal + girdap
    'ghost': [(68, 0), (82, 0), (84, 14), (97, 24), (97, 48), (82, 51), (62, 51), (53, 40), (53, 28), (60, 16), (68, 12)],  # Ruh Kafesi: zincir + kafes + eller
    1: [(58, 8), (77, 8), (77, 19), (92, 25), (93, 55.5), (55, 55.5), (52, 50), (39, 50), (39, 25), (57, 19)],  # kanca + fener
    2: [(61, 0), (86, 0), (89, 9), (100, 14), (100, 43), (80, 44), (62, 41), (57, 33), (56, 22), (61, 15)],     # kalkık kol + fener + ruh girdabı
    3: [(63, 0), (85, 0), (87, 9), (99, 21), (99, 41), (66, 41), (57, 33), (57, 21), (62, 12)],                  # yumruk + kafatası fener + üst girdap
}

for sheet in ('nm_ruh_feneri_v3.jpg', 'nm_ruh_feneri_k4.jpg'): subprocess.run([sys.executable, os.path.join(D, 'nm_isle.py'), sheet], check=True, cwd=D)
man = set(json.load(open(os.path.join(IMG, 'manifest.json'))))
for n, poly in POLY.items():
    p = os.path.join(IMG, f'tower_mage_{n}.webp'); full = isinstance(n, str) or n == 3  # kanatlı ölümde fenerin arkası kanat/cüppe: tamamı dolar
    im = np.array(Image.open(p).convert('RGBA')); H, W = im.shape[:2]
    mk = Image.new('L', (W, H), 0); ImageDraw.Draw(mk).polygon([(x * W / 100, y * H / 100) for x, y in poly], fill=255)
    m = np.array(mk) > 0
    arm = im.copy(); arm[~m] = 0
    body = im.copy(); body[m] = 0
    # katman kalkınca altında delik kalmasın: gövdeye 10 px'ten yakın boşaltılmış pikseller en yakın gövde rengiyle dolar (3. kademede hepsi)
    solid = body[..., 3] > 200
    dist, idx = ndimage.distance_transform_edt(~solid, return_indices=True)
    fill = m & (im[..., 3] > 0) & (dist <= (400 if full else 10))
    body[fill] = im[idx[0][fill], idx[1][fill]]; body[fill, 3] = 255
    Image.fromarray(body).save(p, 'WEBP', quality=88, method=6)
    Image.fromarray(arm).save(os.path.join(IMG, f'tower_mage_{n}_arm.webp'), 'WEBP', quality=88, method=6); man.add(f'tower_mage_{n}_arm.webp')
    print(n, W, H, 'katman px', int(m.sum()), 'dolgu px', int(fill.sum()))
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'))
# oyundaki genişlikler (nm_isle.py meta'yı 700'e çeker): kademeler büyür, 4. kademe 3. ile aynı
meta = json.load(open(os.path.join(IMG, 'meta.json')))
for name, w in (('tower_mage_1', 520), ('tower_mage_2', 620), ('tower_mage_3', 720), ('tower_mage_drain', 720), ('tower_mage_ghost', 720)):
    v = meta[name]; meta[name] = [w, round(w * v[1] / v[0]), 0.13]
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'))

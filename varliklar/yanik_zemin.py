"""Yanmış orman zemini (22 Eki, Caner: haritanın tepesindeki mor kare desenli bölge yerine yanmış orman). grass_cursed.jpg'den türetilir:
renk kül-kömüre çekilir (desen ve dikişsizlik korunur), dikişsiz (sarmalı) kor lekeleri ve kül serpintisi eklenir. → sinir-kalesi/img/grass_burnt.jpg
    .venv/bin/python3 varliklar/yanik_zemin.py"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
a = np.asarray(Image.open(os.path.join(IMG, 'grass_cursed.jpg')).convert('RGB')).astype(np.float32) / 255
H, W, _ = a.shape
lum = a @ np.array([0.3, 0.55, 0.15], np.float32)
lum = (lum - lum.mean()) * 0.85 + 0.27  # kontrast korunur, genel ton koyu
ash = np.dstack([lum * 1.02, lum * 0.93, lum * 0.86])  # sıcak kül-kömür
rng = np.random.default_rng(7)
def wrap_noise(scale, seed):
    r = np.random.default_rng(seed).random((H, W)).astype(np.float32)
    return nd.gaussian_filter(r, scale, mode='wrap')
big = wrap_noise(40, 1); big = (big - big.min()) / (big.max() - big.min())
ash *= (0.78 + 0.32 * big)[..., None]  # büyük açık-koyu lekeler (yanık izleri)
grey = wrap_noise(6, 2); grey = (grey - grey.min()) / (grey.max() - grey.min())
ash = ash * (1 - 0.18 * (grey > 0.72)[..., None]) + 0.18 * (grey > 0.72)[..., None] * np.array([0.52, 0.5, 0.48])  # kül serpintisi
emb = wrap_noise(2.2, 3); emb = (emb - emb.min()) / (emb.max() - emb.min())
mask = (emb > np.quantile(emb, 0.996)) & (big < 0.6)  # kor: koyu bölgelerde küçük turuncu benekler
glow = nd.gaussian_filter(mask.astype(np.float32), 2.2, mode="wrap") * 2.2
ash += np.clip(glow, 0, 1)[..., None] * np.array([0.85, 0.3, 0.06])
out = np.clip(ash, 0, 1)
Image.fromarray((out * 255).astype(np.uint8)).save(os.path.join(IMG, 'grass_burnt.jpg'), quality=88)
print('grass_burnt.jpg', W, H)

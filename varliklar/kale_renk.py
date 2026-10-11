"""Heybetli kale (castle_keep_1..3): yeşil pencere ve mangal ateşini mor / koyu kızıla boyar (Caner, 11 Eki).
Yukarıdaki pencereler mor, aşağıdaki mangal ateşi kızıl (kenarları mora kayar). Kaynak: git'teki yeşil sürüm (img/ dosyası yerinde değişir).
    .venv/bin/python varliklar/kale_renk.py
"""
import os, subprocess, io
import numpy as np
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
ORIG = 'c3feeab' # yeşil sürümün olduğu işleme
for n in (1, 2, 3):
    raw = subprocess.check_output(['git', 'show', f'{ORIG}:sinir-kalesi/img/castle_keep_{n}.webp'], cwd=IMG)
    im = Image.open(io.BytesIO(raw)).convert('RGBA'); A = np.array(im).astype(np.float32) / 255
    hsv = np.array(im.convert('RGB').convert('HSV')).astype(np.float32); h = hsv[..., 0] * 360 / 255; s = hsv[..., 1] / 255; v = hsv[..., 2] / 255
    H, W = h.shape; yy = np.repeat((np.arange(H) / H)[:, None], W, 1)
    g = (h > 70) & (h < 175) & (s > 0.07) & (A[..., 3] > 0.02) # yeşil (taşlara vuran soluk yeşil yansıma dahil)
    w = np.clip((s - 0.07) / 0.15, 0, 1) # kenar pikselleri yumuşak geçiş
    fire = yy > 0.6
    th = np.where(fire, np.where(v > 0.75, 350, 330), 285) # ateş: kızıl, sönük yerleri morumsu; pencere: mor
    tv = v * np.where(fire, 0.92, 0.85) # biraz koyu
    ts = np.clip(s * 1.05, 0, 1)
    out = Image.fromarray(np.dstack([th / 360 * 255, ts * 255, tv * 255]).astype(np.uint8), 'HSV').convert('RGB')
    O = np.array(out).astype(np.float32) / 255; RGB = A[..., :3]
    k = (g * w)[..., None]; R = RGB * (1 - k) + O * k
    res = np.dstack([R, A[..., 3:]]); Image.fromarray((res * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(IMG, f'castle_keep_{n}.webp'), 'WEBP', quality=92)
    print('castle_keep', n, int(g.sum()), 'yeşil piksel')

"""Yüksek çözünürlüklü zemin dokuları (17 Eki, Caner: "bölümlerin zeminleri kaliteli gelmiyor"): Gemini 2048 px kare doku -> img/grass_*.jpg.
Eski dokular 720 px'ti (oyunda karo 360 birim = 2 px/birim; telefonda ve yakınlaşınca 4 gerekir, bulanıktı). Kenarlar birbirine uymuyorsa
yarım kaydırılmış kopyayla kenar bandında karıştırılır (zemin2_isle.py ile aynı yöntem). Oyun karoyu dokunun genişliğine göre ölçekler.
    .venv/bin/python3 varliklar/zemin_hd_isle.py [cursed marsh village bone road]"""
import os, sys
import numpy as np
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(H, '..', 'sinir-kalesi', 'img')
JOBS = {'cursed': 'grass_cursed.jpg', 'marsh': 'grass_marsh.jpg', 'village': 'grass_village.jpg', 'bone': 'grass_bone.jpg', 'road': 'road_dirt.jpg'}
BAND, SIZE = 0.12, 2048


def seamless(a):
    n = a.shape[0]; h = n // 2; r = np.roll(np.roll(a, h, 0), h, 1)
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n * BAND); w1 = np.clip(t, 0, 1); w1 = w1 * w1 * (3 - 2 * w1)
    w = np.minimum(w1[:, None], w1[None, :])[..., None]
    return a * w + r * (1 - w)


for k in (sys.argv[1:] or JOBS):
    src = os.path.join(H, 'ham', f'zemin_hd_{k}.jpg')
    if not os.path.exists(src): continue
    im = Image.open(src).convert("RGB"); s = min(im.size); S = min(SIZE, s); im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((S, S), Image.LANCZOS)  # küçükse büyütülmez
    a = np.asarray(im).astype(np.float32)
    seam = (np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2; inner = np.abs(a[:, 1:] - a[:, :-1]).mean()
    if seam > inner * 2.5: a = seamless(a)  # kenarlar uymuyor: dikiş bandı
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(IMG, JOBS[k]), quality=88)
    print(k, "->", JOBS[k], S, 'dikiş/iç', round(seam, 1), round(inner, 1))

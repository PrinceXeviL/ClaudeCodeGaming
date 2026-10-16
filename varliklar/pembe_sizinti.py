"""Magenta zeminden saydam parıltılara sızan pembeyi temizler (16 Eki, nm29 mekanik sayfası: fener, mum, kemik yığını ışığı).
Kırmızı ve mavinin yeşilden fazlası (magenta payı) her pikselden düşülür; pembeleşmiş hale yerine özgün ışık rengi kalır.

    .venv/bin/python varliklar/pembe_sizinti.py nm29_post nm29_belltower ...
"""
import sys, os
import numpy as np
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
for n in [x for x in sys.argv[1:] if not x.startswith('--')]:
    p = os.path.join(IMG, n + '.webp'); a = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = np.clip(np.minimum(r, b) - g, 0, None)
    if '--sil' not in sys.argv: k = np.clip((260 - al) / 160, 0.35, 1); a[..., 0] = r - m * k * 0.95; a[..., 2] = b - m * k * 0.95   # saydam kenarda tam, opakta yarım
    if '--sil' in sys.argv: a[..., 3] = al * np.clip(1 - (m - 18) / 50, 0, 1)            # --sil: gerçek mor/pembe olmayan görselde magentalı piksel tamamen söner
    else: soft = (al < 250) & (m > 30); a[..., 3] = np.where(soft, al * 0.7, al)        # pembe hale biraz söner
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(p, 'WEBP', quality=90, method=6); print(n, 'temiz')

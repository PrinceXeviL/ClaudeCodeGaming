"""Wan şeritlerinde magenta zeminden sızan pembe/eflatun lekeleri düzeltir (12 Eki): ip, ahşap, ten gibi yerlerde pembe kayma.
Ölçüt: min(r, b) - g büyük (kırmızı VE mavi yeşilden fazla) ve kırmızı ile mavi yakın: kızıl kumaş, altın, ten etkilenmez.
Opak piksel bronz-ip rengine (parlaklığı korunarak) çekilir; yarı saydam pembe leke (yerdeki iz) silinir.
    python3 varliklar/pembe_duzelt.py enemy_gladiator_atkx [...]   (asıl dosya varliklar/cikti/pembe_yedek/ içine yedeklenir)
Mor duman/büyü ışığı olan karakterlerde (gölge ustası vb.) kullanma: onları da kahverengiye çevirir.
"""
import os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
BAK = os.path.join(ROOT, 'varliklar', 'cikti', 'pembe_yedek')
TAN = np.array([200, 166, 122], np.float32)

for n in sys.argv[1:]:
    p = os.path.join(IMG, n + '.webp')
    if not os.path.exists(p): print('yok:', n); continue
    os.makedirs(BAK, exist_ok=True); b = os.path.join(BAK, n + '.webp')
    if not os.path.exists(b) or os.path.getmtime(p) > os.path.getmtime(b): shutil.copy(p, b)  # 20 Eki: dosya yenilendiyse yedek de yenilenir (eski yedekten okuyup yeni şeridi eziyordu)
    a = np.asarray(Image.open(b).convert('RGBA')).astype(np.float32)
    r, g, bl, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mg = np.minimum(r, bl) - g
    k = np.clip((mg - 14) / 40, 0, 1) * (np.abs(r - bl) < 110)
    lum = (np.maximum(np.maximum(r, g), bl) / 255)[..., None]
    a[..., :3] = a[..., :3] * (1 - k[..., None]) + TAN * lum * 1.05 * k[..., None]
    a[..., 3] = np.where(al < 200, al * (1 - k), al)
    Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA').save(p, 'WEBP', quality=90, method=6)
    print(n, 'düzeltilen piksel:', int((k > 0.3).sum()))

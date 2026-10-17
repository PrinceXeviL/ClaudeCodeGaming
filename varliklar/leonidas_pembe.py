"""Leonidas Wan şeritlerinde magenta zeminden mızrak sapına ve pelerin kenarına sızan koyu mor/eflatunu düzeltir (18 Eki).
pembe_duzelt.py'nin ölçütü + göz koruması: parlak mor (gözler, lum > 0.62) ve doygun kızıl pelerin dokunulmaz; koyu eflatun sap rengine çekilir.
    .venv/bin/python3 varliklar/leonidas_pembe.py [şerit ...]   (varsayılan: bütün hero_leonidas_* şeritleri; yedek varliklar/cikti/pembe_yedek/)"""
import os, shutil, sys, json
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img'); BAK = os.path.join(ROOT, 'varliklar', 'cikti', 'pembe_yedek')
SHAFT = np.array([96, 66, 44], np.float32)
names = sys.argv[1:] or [k for k in json.load(open(os.path.join(IMG, 'anim.json'))) if k.startswith('hero_leonidas_')]
for n in names:
    p = os.path.join(IMG, n + '.webp'); os.makedirs(BAK, exist_ok=True); b = os.path.join(BAK, n + '.webp')
    if not os.path.exists(b): shutil.copy(p, b)
    a = np.asarray(Image.open(b).convert('RGBA')).astype(np.float32); r, g, bl, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    lum = np.maximum(np.maximum(r, g), bl) / 255
    mg = np.minimum(r, bl) - g
    k = np.clip((mg - 12) / 35, 0, 1) * (np.abs(r - bl) < 42) * (lum < 0.62) * ((bl - r) < 18) * (mg < 62)  # doygun mor göz (mg büyük), mavisi baskın göz ışığı ve kırmızısı baskın pelerin korunur
    a[..., :3] = a[..., :3] * (1 - k[..., None]) + SHAFT * (0.6 + lum[..., None]) * k[..., None]
    a[..., 3] = np.where(al < 200, al * (1 - 0.7 * k), al)
    Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA').save(p, 'WEBP', quality=90, method=6)
    print(n, 'düzeltilen:', int((k > 0.3).sum()))

"""Kale Veo döngüsünün kenarındaki beyaz saçak (17 Eki, Caner: "kalenin sınırlarında beyazlık kalmış").
Veo beyaz zemininden kesilen şeridin dış kenarında açık renkli, az doygun pikseller kalıyor (koyu kontur dışında).
Her karede: saydamlığa 4 px yakın bantta açık-soluk pikseller silinir, kalan kenar 1 px aşındırılır ve yumuşatılır.
Veo'nun beyaza boyadığı köşeler (sol alttaki kuru ağaç, sağdaki kemik iskelenin arası) durağan çizimden (castle_keep_N) yumuşak geçişle alınır.
    .venv/bin/python3 varliklar/kale_kenar_temizle.py castle_keep_1_idle"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
STATIK = [(0, 0.5, 0.18, 0.86), (0.79, 0.58, 1, 0.84)]  # kare kesri: x0, y0, x1, y1
for name in sys.argv[1:]:
    m = json.load(open(os.path.join(IMG, 'anim.json')))[name]; FW, FH, C = m['fw'], m['fh'], m.get('cols', m['n'])
    st = np.asarray(Image.open(os.path.join(IMG, name.replace('_idle', '') + '.webp')).convert('RGBA').resize((FW, FH), Image.LANCZOS)).astype(np.float32)
    tm = np.zeros((FH, FW), np.float32)
    for x0, y0, x1, y1 in STATIK: tm[int(y0 * FH):int(y1 * FH), int(x0 * FW):int(x1 * FW)] = 1
    tm = nd.gaussian_filter(tm, 5)[..., None]
    a = np.asarray(Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA')).copy()
    for i in range(m['n']):
        x0, y0 = (i % C) * FW, (i // C) * FH; f = a[y0:y0 + FH, x0:x0 + FW].astype(np.float32)
        f = f * (1 - tm) + st * tm
        al = f[..., 3]; out = al < 30
        band = nd.binary_dilation(out, iterations=4) & ~out
        mx, mn = f[..., :3].max(2), f[..., :3].min(2)
        light = band & (mn > 120) & ((mx - mn) < 0.35 * np.maximum(mx, 1))
        al[light] = 0
        solid = nd.binary_erosion(al > 30, iterations=1)
        al = np.where(solid, al, 0); al = nd.gaussian_filter(al, 0.6)
        f[..., 3] = al; a[y0:y0 + FH, x0:x0 + FW] = f.clip(0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=88, method=6); print(name, 'temizlendi')

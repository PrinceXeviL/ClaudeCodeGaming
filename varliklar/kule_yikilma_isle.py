"""Kule yıkılma animasyonları (18 Eki, Caner: "yıkılma efektini çok beğendim, tüm kulelere"). Wan videosu ham/anim/<kule>_collapse.mp4
(kule 832x480 tuvalde, magenta ya da Lanet Kulesi için yeşil zemin) -> img/<kule>_collapse.webp ızgara şerit + anim.json:
n, fw, fh, cols, fps, tw (şeritte kulenin genişliği, px), bx/by (kule tabanının ortası, kare içinde px). Oyun kareyi kulenin genişliğine göre ölçekler.
Zemin silinir, toza/molozlara bulaşan magenta (ya da yeşil) gri tona çekilir.
    .venv/bin/python3 varliklar/kule_yikilma_isle.py [kule ...]   (varsayılan: iş listesindeki bütün kuleler)"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_isle
from anim_isle import remove_magenta
import serit_temizle
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img'); ANIM = os.path.join(ROOT, 'varliklar', 'ham', 'anim')
FH = 170  # kare boyu (px): bellek (49 kare x 26 kule; yalnız kurulu kulelerinki yüklenir)
def key_green(a):
    f = a.astype(np.float32); r, g, b = f[..., 0], f[..., 1], f[..., 2]
    d = g - np.maximum(r, b); al = np.clip(1 - (d - 40) / 70, 0, 1)  # yeşil baskınlığı arttıkça saydam
    return np.dstack([f, al * 255]).astype(np.uint8)
def despill(rgba, green):
    a = rgba.astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if green: k = np.clip((g - np.maximum(r, b) - 6) / 30, 0, 1); ref = (r + b) / 2
    else: k = np.clip((np.minimum(r, b) - g - 8) / 30, 0, 1) * (np.abs(r - b) < 80); ref = g * 0.6 + (r + b) / 2 * 0.25
    for c in (0, 1, 2): a[..., c] = a[..., c] * (1 - k) + ref * k
    return a.clip(0, 255).astype(np.uint8)
jobs = json.load(open(os.path.join(ANIM, 'abarti2', 'kule_yikilma_hepsi.json'))) + [{'name': 'tower_xbow_2_collapse', 'key': 'magenta'}]
only = set(sys.argv[1:])
A = json.load(open(os.path.join(IMG, 'anim.json'))); man = json.load(open(os.path.join(IMG, 'manifest.json')))
for j in jobs:
    n = j['name']; tower = n[:-len('_collapse')]
    if only and tower not in only and n not in only: continue
    src = os.path.join(ANIM, n + '.mp4')
    if not os.path.exists(src): print('yok:', n); continue
    green = j.get('key') == 'green'
    rgb = video_isle.frames_of(src, 16)
    fr = [despill(key_green(x) if green else remove_magenta(x), green) for x in rgb]
    al = np.max([f[..., 3] for f in fr], axis=0) > 24; ys, xs = np.nonzero(al)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # ilk karedeki kulenin genişliği ve tabanı (referansta kule tuvalin altından 60 px yukarıda oturuyordu)
    a0 = fr[0][..., 3] > 128; ty, tx = np.nonzero(a0); tw0 = tx.max() - tx.min(); bx0 = (tx.max() + tx.min()) / 2; by0 = ty.max()
    s = FH / (y1 - y0); fw = int(round((x1 - x0) * s)); cols = 10
    rows = (len(fr) + cols - 1) // cols; S = Image.new('RGBA', (fw * cols, FH * rows))
    for k, f in enumerate(fr):
        im = Image.fromarray(serit_temizle.kare(np.asarray(Image.fromarray(f[y0:y1, x0:x1]).resize((fw, FH), Image.LANCZOS)), n)); S.paste(im, ((k % cols) * fw, (k // cols) * FH))
    S.save(os.path.join(IMG, n + '.webp'), 'WEBP', quality=86, method=6)
    A[n] = {'n': len(fr), 'fw': fw, 'fh': FH, 'cols': cols, 'fps': 16, 'tw': round(tw0 * s, 1), 'bx': round((bx0 - x0) * s, 1), 'by': round((by0 - y0) * s, 1)}
    if n + '.webp' not in man: man.append(n + '.webp')
    print(n, len(fr), 'kare', fw, 'x', FH, os.path.getsize(os.path.join(IMG, n + '.webp')) // 1024, 'KB')
json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1, ensure_ascii=False); open(os.path.join(IMG, 'anim.json'), 'a').write('\n')
json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)

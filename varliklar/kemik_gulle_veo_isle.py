"""Kemik Gülle Mancınığı atış döngüsü (16 Eki, Caner): Flow Frames to Video (ilk = son kare = tower_artillery_boneball).
ham/anim/kemik_gulle_atis_veo.mp4 (1280x720, magenta): ~12-24 kol fırlatır (gülle çerçeveden çıkar), kafatası karşı ağırlık sallanır,
~170-200 yeni gülle kazandan büyüyle kepçeye oturur, 239 = 0. Bütün kareler (Veo akıcılık); oyunda atış aralığına sığdırılır (fps meta'da değil, kodda).
Uçan gülle ve kopuk damlalar şeritten silinir (gülleyi oyun çizer); zemindeki beyaz Veo kırıntıları biggest_mask ile gider.
box: şerit karesinin kule görseline göre yeri (görsel kesirleri, towerAnim düzeni), rel: gülle bırakma anı (döngü kesri), relPt: bırakma noktası.
    .venv/bin/python varliklar/kemik_gulle_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
NAME = 'tower_artillery_boneball_atk'
TW = 150                       # şeritte kulenin genişliği (px; telefon belleği)
REL = 22                       # gülle kepçeden çıkar
fr = video_isle.frames_of(os.path.join(H0, 'ham/anim/kemik_gulle_atis_veo.mp4'), 24)
def cut(a):
    c = video_isle.remove_magenta(a); al = c[..., 3]
    keep = video_isle.biggest_mask(al)
    c[..., 3] = np.where(keep, al, 0)
    f = c.astype(np.float32); r, g, b = f[..., 0], f[..., 1], f[..., 2]
    pink = (np.minimum(r, b) - g > 30) & (np.abs(r - b) < 90) & (f[..., 3] < 250)   # pembe hız izleri / zemin taşması
    f[..., 3] = np.where(pink, f[..., 3] * 0.2, f[..., 3])
    return f.astype(np.uint8)
c0 = cut(fr[0]); ys, xs = np.nonzero(c0[..., 3] > 128)
tx0, tx1, ty0, ty1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1      # kulenin ilk karedeki kutusu = görselin kendisi
crops = [cut(f) for f in fr]
X0 = min(np.nonzero(c[..., 3] > 60)[1].min() for c in crops); X1 = max(np.nonzero(c[..., 3] > 60)[1].max() for c in crops) + 1
Y0 = min(np.nonzero(c[..., 3] > 60)[0].min() for c in crops); Y1 = max(ty1, max(np.nonzero(c[..., 3] > 60)[0].max() for c in crops) + 1)
X0, Y0 = max(0, X0 - 4), max(0, Y0 - 4); X1, Y1 = min(1280, X1 + 4), min(720, Y1 + 2)
k = TW / (tx1 - tx0); FW, FH = int(round((X1 - X0) * k)), int(round((Y1 - Y0) * k))
tiles = [Image.fromarray(c[Y0:Y1, X0:X1]).resize((FW, FH), Image.LANCZOS) for c in crops]
out, cols = video_isle.pack(tiles, FW, FH)
out.save(os.path.join(IMG, NAME + '.webp'), 'WEBP', quality=85, method=6)
W, H = tx1 - tx0, ty1 - ty0
box = [round((X0 - tx0) / W, 4), round((Y0 - ty0) / H, 4), round((X1 - tx0) / W, 4), round((Y1 - ty0) / H, 4)]
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
meta[NAME] = {'n': len(tiles), 'fw': FW, 'fh': FH, 'tower': True, 'box': box, 'rel': round(REL / len(tiles), 4), 'relPt': [0.22, -0.5]}
if cols: meta[NAME]['cols'] = cols
if NAME + '.webp' not in man: man.append(NAME + '.webp')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
print(NAME, meta[NAME], 'kule kutusu', (tx0, ty0, tx1, ty1), 'kesim', (X0, Y0, X1, Y1), os.path.getsize(os.path.join(IMG, NAME + '.webp')) // 1024, 'KB')

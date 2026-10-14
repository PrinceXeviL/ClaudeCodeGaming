"""Báthory'nin Veo yürüme + koşma videosu (14 Eki, çift hareket): yerinde, yana dönük (sağa). 0-88 yürüme, 88-96 duraklama, 97-193 koşma.
En temiz kapanan döngüler: yürüme 11-49 (39 kare), koşma 153-175 (23 kare). Boy (taç tepesi -> etek altı) saldırı şeridiyle aynı hedefe (300) getirilir.
    .venv/bin/python varliklar/bathory_yuru_isle.py
"""
import json, os, sys
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/bathory_yuru_kos_veo.mp4'
FIG_TOP, FIG_BOT, CX = 78, 662, 600
BOX = (CX - 330, 30, CX + 330, 700)
TARGET = 300
SETS = {'hero_bathory_walk': (list(range(11, 50)), {'idle': 0, 'stride': 0.8}),
        'hero_bathory_run': (list(range(153, 176)), {})}
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, (order, extra) in SETS.items():
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order):
        a = video_isle.remove_white(fr[n])[y0:y1, x0:x1]
        out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = dict({'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4)}, **extra)
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

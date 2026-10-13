"""Bubu (Mortimer'ın evcil mezar solucanı, 14 Eki, Caner): Veo videosundan (ham/anim/bubu_veo.mp4, 1024x576, beyaz zemin, sabit kamera) şeritler.
Videoda: 0-24 deliğe gömülür, 24-56 boş çukur, 56-80 topraktan fırlar, 80-115 ağzıyla yere vurur, 120+ kalkık pozda bekler.
  bubu_hole  : boş çukur (tek kare, 40)
  bubu_atk   : fırlama + vuruş + kalkık poza dönüş (56-130, 12 fps); vuruş anı şeritte 'hit' karesi
  bubu_idle  : kalkık pozda bekleme döngüsü (146-204, 12 fps)
  bubu_down  : deliğe gömülme (0-26, 12 fps)
Hepsi aynı kutu ve ölçekle kesilir; anchor: çukurun ortası (fx) ve dibi (base).
    .venv/bin/python varliklar/bubu_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
FIG_TOP, FIG_BOT, CX = 62, 536, 521          # kalkık pozda solucan tepesi, çukur altı, çukur ortası (video pikseli)
BOX = (CX - 370, 0, CX + 360, 576)              # vuruşta saçılan toprak da içeride kalsın
TARGET = 220
SETS = {
    'bubu_hole': [40],
    'bubu_atk': list(range(56, 132, 2)),
    'bubu_idle': list(range(146, 204, 2)),
    'bubu_down': list(range(0, 28, 2)),
}
fr = video_isle.frames_of(os.path.join(H0, 'ham/anim/bubu_veo.mp4'), 24)
k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, order in SETS.items():
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order):
        a = video_isle.remove_white(fr[n])[y0:y1, x0:x1]
        out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4),
                  'fx': round((CX - x0) / (x1 - x0), 4), 'fps': 12}
    if name == 'bubu_atk': meta[name]['hit'] = (94 - 56) // 2   # ağzın yere vurduğu kare
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

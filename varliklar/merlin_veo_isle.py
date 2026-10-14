"""Merlin'in Veo güç videosundan (beyaz zemin, ilk ~2 sn yakın çekim) üç komutan şeridi: _skill (Zaman Kapısı), _cast (yetenek), _idle.
Kamera 48. kareden sonra sabit; bütün şeritler AYNI kutu ve ölçekle kesilir (boy: alev tepesinden sis altına ~674 px), oyunda
sabit görselle (hero_merlin) aynı boyda durur. Işın patlaması kareleri (117-129) kadrajın kenarında kesildiği için atlanır.

    .venv/bin/python varliklar/merlin_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/merlin_guc_veo.mp4'
FIG_TOP, FIG_BOT, CX = 16, 690, 623       # bekleme karelerinde alev tepesi, sis altı ve gövde ortası (video pikseli)
BOX = (CX - 330, 0, CX + 330, 720)        # ortak kesim kutusu
TARGET = 300                               # figür boyu (şerit pikseli)
SETS = {
    'hero_merlin_skill': list(range(48, 115, 3)) + list(range(132, 163, 3)),   # 14 Eki: Meteor videosu gelene kadar geçici
    'hero_merlin_cast_timegate': list(range(48, 115, 3)) + list(range(132, 163, 3)),   # Zaman Kapısı (14 Eki'den beri pasif)
    'hero_merlin_cast': list(range(48, 100, 3)) + list(range(99, 47, -3))[1:],
    'hero_merlin_idle': list(range(162, 235, 2)),
}

fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, order in SETS.items():
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order):
        a = video_isle.remove_white(fr[n])[y0:y1, x0:x1]
        out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4), **({'dur': 1.4} if name.endswith('_timegate') else {})}
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name])
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

# 14 Eki: kırmızı pelerin astarı koyu maviye
import subprocess; subprocess.run([sys.executable, os.path.join(H0, "merlin_mavi.py")], check=True)

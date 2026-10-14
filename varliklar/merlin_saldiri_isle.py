"""Merlin'in Veo saldırı + ölüm videosu (14 Eki, çift hareket): 9-72 ruh ateşi küresi atışı (0 ~ 72 dinlenme, döngü kapanır),
98-146 ölüm (asası düşer, cübbesi çöker, kemik ve boynuz yığını, ruh izleri). Kadraj güç videosundan farklı: boy alev tepesinden
sis altına 77-629 px; şerit ölçeği eski Merlin şeritleriyle aynı (alev->sis 220 px, anim.json fh 235'e denk).
    .venv/bin/python varliklar/merlin_saldiri_isle.py
"""
import json, os, sys
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/merlin_saldiri_olum_veo.mp4'
FIG_TOP, FIG_BOT, CX = 77, 629, 636
TARGET = 220
SETS = {'hero_merlin_atk': (list(range(8, 73, 2)), (300, 300, 0, 650), {}),
        'hero_merlin_die': (list(range(98, 147, 2)), (430, 430, 0, 700), {'dur': 2.0})}
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
k = TARGET / (FIG_BOT - FIG_TOP)
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, (order, (L, R, y0, y1), extra) in SETS.items():
    x0, x1 = CX - L, CX + R
    FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order):
        a = video_isle.remove_white(fr[n])[y0:y1, x0:x1]
        out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = dict({'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4)}, **extra)
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

# 14 Eki: kırmızı pelerin astarı koyu maviye
import subprocess; subprocess.run([sys.executable, os.path.join(H0, "merlin_mavi.py")], check=True)

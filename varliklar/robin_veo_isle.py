"""Robin'in Veo videolarından komutan şeritleri (14 Eki, Caner: "skillerden başlayalım").
ham/anim/robin_okyagmuru_veo.mp4 (1024x576, beyaz zemin, sabit kamera): 0-44 bekleme (yeşil alevli ok elde), 44-110 yay göğe, ok sağanağı.
Bütün şeritler AYNI kutu ve ölçekle kesilir (boy: boynuz tepesinden ayak altına), oyunda sabit görselle (hero_robin) aynı boyda durur.
Bekleme videoda kapanmadığı için ileri-geri oynatılır.
    .venv/bin/python varliklar/robin_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
# kaynaklar: her video kendi figür ölçüsüyle (boynuz tepesi, ayak altı, gövde ortası) aynı hedef boya getirilir
SOURCES = [
    ('ham/anim/robin_okyagmuru_veo.mp4', 72, 531, 488, {
        'hero_robin_skill': list(range(44, 112, 2)),                              # Ok Yağmuru: yay göğe, sağanak
        'hero_robin_idle': list(range(0, 41, 2)) + list(range(38, 1, -2)),        # bekleme: ileri-geri
    }),
    # 14 Eki: önce yerinde yürür (0-110), sonra koşuya geçer; en temiz kapanan döngüler (yürüme 31, koşma 22 kare)
    ('ham/anim/robin_yuru_kos_veo.mp4', 72, 519, 479, {'hero_robin_walk': list(range(42, 73))}),
    ('ham/anim/robin_yuru_kos_veo.mp4', 72, 519, 503, {'hero_robin_run': list(range(139, 161))}),
]
TARGET = 220                               # figür boyu (şerit pikseli; serit_kucult komutan hedefi)
EXTRA = {'hero_robin_walk': {'idle': 0, 'stride': 0.5}}
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for src, FIG_TOP, FIG_BOT, CX, SETS in SOURCES:
    BOX = (CX - 330, 0, CX + 370, 548)      # ortak kesim kutusu (göğe kalkan yay ve savrulan pelerin içeride)
    fr = video_isle.frames_of(os.path.join(H0, src), 24)
    k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
    FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
    for name, order in SETS.items():
        out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
        for i, n in enumerate(order):
            a = video_isle.remove_white(fr[n])[y0:y1, max(0, x0):x1]
            out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
        out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
        meta[name] = dict({'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4)}, **EXTRA.get(name, {}))
        if name + '.webp' not in man: man.append(name + '.webp')
        print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

"""Báthory'nin Veo videosundan (14 Eki, beyaz zemin, geniş kadraj): Kan Bağı (_cast_bloodlink) ve Kan Yarasaları (_skill2).
bathory_kanbagi_yarasalar_veo.mp4: 0-20 kan kıvrımları kaybolur, 21-25 el kalkar ve kan fışkırır, 26-62 iplikler kadrajı aşar (kullanılmaz;
oyun iplikleri hedeflere kendisi çizer), 100-180 asa kalkar, kalp parlar, yarasalar sarmal çıkar, başın üstünde kan sisi (sonrasında kalp boş: kullanılmaz).
    .venv/bin/python varliklar/bathory_yarasa_isle.py
"""
import json, os, sys
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/bathory_kanbagi_yarasalar_veo.mp4'
FIG_TOP, FIG_BOT, CX = 231, 587, 636      # bekleme duruşunda taç tepesi, kan dalgası altı, gövde ortası (video pikseli)
BOX = (CX - 275, 70, CX + 275, 600)        # fışkıran kan, yarasalar ve sis bu kutunun içinde
FIG_X0, FIG_X1, FIG_Y0 = 500, 775, 225  # bekleme duruşundaki karakterin kutusu (asa kalkınca da içinde)
TARGET = 220                               # figür boyu (öteki Báthory şeritleriyle aynı)
SETS = {
    'hero_bathory_cast_bloodlink': ([21, 22, 23, 24, 25, 25, 24, 23, 22, 21], 0.8, None),
    'hero_bathory_skill2': (list(range(100, 173, 3)), 2.2, dict(dark=70, grow=1, gain=1.3, core_r=1, core_max=0)),  # kalp parıltısı ve kan sisi beyaz zeminden ayrıştırılır (soluk hale kalmasın); 172 sonrası sis beyaza döner
}
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, (order, dur, fx) in SETS.items():
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order):
        if fx:  # karakterin dikey şeridinde gövde maskesi geniş (açık kemik/yaka opak kalsın), dışında dar (yarasa kenarında beyaz hale kalmasın)
            a = video_isle.remove_white_fx(fr[n], **fx); b = video_isle.remove_white_fx(fr[n], **dict(fx, dark=90, grow=6))
            a[FIG_Y0:, FIG_X0:FIG_X1] = b[FIG_Y0:, FIG_X0:FIG_X1]
        else: a = video_isle.remove_white(fr[n])
        a = a[y0:y1, x0:x1]
        out.paste(Image.fromarray(a).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4), 'dur': dur}
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name], out.size)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

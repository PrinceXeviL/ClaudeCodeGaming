"""Merlin'in yeni Veo videoları (14 Eki, çift hareket; mavi pelerinli görselden). Kadraj ikisinde de aynı (alev ~77, sis ~629):
  merlin_suzulme_meteor_veo.mp4: 0-94 yerinde süzülme (temiz kapanmıyor: ileri-geri oynatılır), 98-180 Meteor çağırma
    (asayı göğe kaldırır, ateş runları toplanır, ateş topunu sağa fırlatır; çıkış şeridin ~%73'ünde, Meteor 1,8 sn'de ~1,3 sn'de düşer)
  merlin_simsek_kurbaga_veo.mp4: 6-70 Zincir Şimşek (elinden sağa mavi şimşekler), 88-140 Kurbağaya Çevirme (parmağını çevirip yeşil-mor yıldızlar)
Ateş ve şimşek parıltısı remove_white_fx ile yarı saydam (opak soluk leke kalmasın).
    .venv/bin/python varliklar/merlin_meteor_isle.py
"""
import json, os, subprocess, sys
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
FIG_TOP, FIG_BOT = 77, 629
TARGET = 220
fwd = list(range(14, 75))   # 16 Eki: her kare (Veo akıcılık)
ONLY = set(sys.argv[1:])  # 16 Eki: ad verilirse yalnız o şeritler yeniden kesilir (ötekiler olduğu gibi kalır)
SOURCES = [
    ('ham/anim/merlin_suzulme_meteor_veo.mp4', 630, {
        'hero_merlin_walk': (fwd + fwd[-2:0:-1], (300, 300, 0, 650), {'idle': 0, 'stride': 0.8}, False),
        'hero_merlin_skill': (list(range(98, 181, 2)), (380, 380, 0, 650), {}, {'core_r': 12, 'grow': 5})}),
    ('ham/anim/merlin_simsek_kurbaga_veo.mp4', 628, {
        'hero_merlin_skill2': (list(range(6, 71, 2)), (380, 380, 0, 660), {}, {'core_r': 2}),
        'hero_merlin_cast_frog': (list(range(88, 141)), (330, 330, 0, 660), {'dur': 1.4}, {'core_r': 3})}),
]
k = TARGET / (FIG_BOT - FIG_TOP)
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
DONE = []
for src, CX, SETS in SOURCES:
    if ONLY and not ONLY & set(SETS): continue
    fr = video_isle.frames_of(os.path.join(H0, src), 24)
    for name, (order, (L, R, y0, y1), extra, fx) in SETS.items():
        if ONLY and name not in ONLY: continue
        x0, x1 = CX - L, CX + R
        FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
        crops = [(video_isle.remove_white_fx(fr[n], **fx) if fx else video_isle.remove_white(fr[n]))[y0:y1, x0:x1] for n in order]  # fx: efekt ayarı (çekirdek kapanış yarıçapı)
        video_isle.save_strip(name, crops, FW, FH, IMG, meta, man, dict({'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4)}, **extra))
        DONE.append(name)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
import merlin_mavi  # 16 Eki: yalnız yeniden kesilen şeritler (hepsini yeniden kaydetmek kaliteyi düşürür)
for _n in DONE:
    _p = os.path.join(IMG, _n + '.webp'); merlin_mavi.mavi(Image.open(_p)).save(_p, 'WEBP', quality=88, method=6)

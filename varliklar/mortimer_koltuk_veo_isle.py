"""Zafer ekranı: koltukta kahvesini yudumlayan Mortimer (17 Eki, Caner: "veo ile yapalım").
Veo videosu ham/anim/mortimer_koltuk_veo.mp4 (1280x720, beyaz zemin, 24 kare/sn; referans veo_mortimer_koltuk/ tuvali).
Başı ve sonu en benzer döngü (24 + 204 kare: bir tam yudum) her kareyle şerit olur: img/mortimer_throne.webp (tembel, zafer ekranında yüklenir).
Döngünün ilk karesi durağan yedek: img/mortimer_pose_throne.webp (atlasa girer; şerit yüklenene kadar o çizilir).
    .venv/bin/python3 varliklar/mortimer_koltuk_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
X0, Y0, X1, Y1 = 490, 193, 791, 562  # tüm karelerin birleşik kutusu + 10 px pay
S0, L = 24, 204

fr = video_isle.frames_of(os.path.join(H0, 'ham', 'anim', 'mortimer_koltuk_veo.mp4'), 24)
cut = lambda a: video_isle.remove_white_fx(a)[Y0:Y1, X0:X1]
frames = [cut(fr[i]) for i in range(S0, S0 + L)]
meta_p, man_p = os.path.join(IMG, 'anim.json'), os.path.join(IMG, 'manifest.json')
meta, man = json.load(open(meta_p)), json.load(open(man_p))
video_isle.save_strip('mortimer_throne', frames, X1 - X0, Y1 - Y0, IMG, meta, man, {'fps': 24, 'ch': 1, 'base': 0}, keep=False)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
Image.fromarray(frames[0]).save(os.path.join(IMG, 'mortimer_pose_throne.webp'), 'WEBP', quality=90, method=6)
mp = os.path.join(IMG, 'meta.json'); m = json.load(open(mp)); m['mortimer_pose_throne'] = [X1 - X0, Y1 - Y0]; json.dump(m, open(mp, 'w'))

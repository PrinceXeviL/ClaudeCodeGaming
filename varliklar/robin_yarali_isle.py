"""Robin'in Veo videosundan (16 Eki, beyaz zemin, ham/anim/robin_yarali_lvlup_veo.mp4) iki komutan şeridi:
hero_robin_walk_hurt (yaralı topallama döngüsü: 37. kareden 41 kare, dikiş farkı en küçük) ve hero_robin_lvlup (seviye/zafer pozu, 124-191).
Karakter boyu yürüyüş şeridiyle aynı (220 px; keep_size yer tutucusu). Her kare, oyunda 24 kare/sn.

    .venv/bin/python varliklar/robin_yarali_isle.py [walk_hurt|lvlup]
"""
import json, os, sys
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
SRC = 'ham/anim/robin_yarali_lvlup_veo.mp4'
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
CH = 220  # hero_robin_walk: ch 0.8161 × fh 270
JOBS = {'walk_hurt': dict(start=37, length=41), 'lvlup': dict(order=list(range(124, 192)), first_h=True)}
for job, kw in JOBS.items():
    if len(sys.argv) > 1 and job not in sys.argv[1:]: continue
    name = 'hero_robin_' + job
    mp = os.path.join(IMG, 'anim.json'); m = json.load(open(mp)); m[name] = {'ch': 1, 'fh': CH}; json.dump(m, open(mp, 'w'), indent=1)  # boy yer tutucusu
    video_isle.main(SRC, name, white=True, play_fps=24, keep_size=True, **kw)

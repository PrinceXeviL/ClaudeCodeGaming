"""Yeni Bubu (16 Eki, Gemini nm_bubu2 + Veo ham/anim/bubu2_veo.mp4, beyaz zemin): iki şerit, aynı kutu ve ölçek.
bubu_idle: bekleme döngüsü (video 9-59, dikişi en küçük), bubu_atk: kap-savur (video 60-179; 60. kare bekleme döngüsünün sonundan kesintisiz devam eder,
86. kare bekleme döngüsünün 27. karesine benzer: ikinci giriş noktası `entry`). Her karede ağzın yeri (kafanın en sağ ucu) `mouth` [x, y] (kare kesri)
olarak yazılır: oyunda yakalanan düşman bu noktaya bağlanır. `bite`: çenenin kapandığı kare, `throw`: savurup bıraktığı kare (atk şeridinde).

    .venv/bin/python varliklar/bubu2_isle.py
"""
import json, os, sys
import numpy as np
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
fr = video_isle.frames_of(os.path.join(H0, 'ham/anim/bubu2_veo.mp4'), 24)
SETS = {'bubu_idle': list(range(9, 60)), 'bubu_atk': list(range(60, 180))}
cut = {n: [video_isle.remove_white(fr[i]) for i in idx] for n, idx in SETS.items()}
al = [c[..., 3] > 128 for cs in cut.values() for c in cs]
ys = np.concatenate([np.nonzero(a)[0] for a in al]); xs = np.concatenate([np.nonzero(a)[1] for a in al])
y0, y1, x0, x1 = ys.min() - 8, ys.max() + 8, xs.min() - 8, xs.max() + 8
a0 = cut['bubu_idle'][0][..., 3] > 128; ry, rx = np.nonzero(a0)
figT, figB = ry.min(), ry.max()                                  # bekleme pozunda figürün tepesi ve tabanı
hole = np.nonzero(a0[figB - 40:figB])[1]; hx = (hole.min() + hole.max()) / 2   # çukurun ortası (toprak yığını)
TARGET = 300; k = TARGET / (figB - figT); FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
def mouth(c):
    """ağız = gövde boyunca çukurdan EN UZAK nokta (jeodezik; kafa geri çekilince en sağ nokta gövde kıvrımı oluyordu). 1/4 çözünürlükte BFS."""
    from collections import deque
    a = video_isle.biggest_mask(c[..., 3])[::4, ::4]; Hh, Ww = a.shape
    D = np.full(a.shape, -1, np.int32); q = deque()
    by = min(Hh - 1, int(figB / 4)); 
    for yy in range(max(0, by - 12), by + 1):
        for xx in range(max(0, int(hx / 4) - 10), min(Ww, int(hx / 4) + 11)):
            if a[yy, xx]: D[yy, xx] = 0; q.append((yy, xx))
    while q:
        yy, xx = q.popleft(); d = D[yy, xx] + 1
        for ny, nx in ((yy - 1, xx), (yy + 1, xx), (yy, xx - 1), (yy, xx + 1)):
            if 0 <= ny < Hh and 0 <= nx < Ww and a[ny, nx] and D[ny, nx] < 0: D[ny, nx] = d; q.append((ny, nx))
    m = D.max(); ys, xs = np.nonzero(D >= m - 3)                 # uç bölge (burun)
    my, mx = ys.mean() * 4 + 2, xs.mean() * 4 + 2
    return [round((mx - x0) / (x1 - x0), 4), round((my + 6 - y0) / (y1 - y0), 4)]
for name, cs in cut.items():
    info = {'base': round((y1 - figB) / (y1 - y0), 4), 'ch': round((figB - figT) / (y1 - y0), 4), 'fx': round((hx - x0) / (x1 - x0), 4), 'fps': 24,
            'mouth': [mouth(c) for c in cs]}
    if name == 'bubu_atk': info.update(entry=[0, 26], bite=62, throw=86, back=36)  # back: bitince bekleme döngüsünde devam edilecek kare
    video_isle.save_strip(name, [c[y0:y1, x0:x1] for c in cs], FW, FH, IMG, meta, man, info, keep=False)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

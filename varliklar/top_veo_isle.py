"""Güneş Topu (yeni kuşatma düşmanı, 15 Eki) Veo videosu: magenta zemin, WhatsApp'tan 1024x576.
top_yuru_ates_yikim_veo.mp4: 0-98 iki lejyoner iter (döngü 11+18 kare), 100-118 top ateş eder (104 namlu alevi),
120-200 araba parçalanır, askerler düşer; 200 sonrası enkaz yerde durur.
Üç şerit ortak ölçekle ve aynı yer çizgisine (tekerlek altı, y=449) göre kesilir: _walk dar kutu, _atk ve _die geniş kutu
(alev ve enkaz kadrajı boydan boya kaplar). Grup boyu (bayrak tepesi → tekerlek altı) 289 px, iten asker ~175 px:
oyunda h = 30 (lejyoner) × 289 / 175 ≈ 49. Ayrıca durağan görsel enemy_cannon.webp (codex/yedek) yazılır.
    .venv/bin/python varliklar/top_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/top_yuru_ates_yikim_veo.mp4'
FIG_TOP, GROUND = 160, 449            # bayrak tepesi ve tekerlek altı (video pikseli)
TARGET = 180                          # grup boyu (şerit pikseli)
NARROW = (250, 150, 774, 456)         # x ortası 512
WIDE = (0, 70, 1024, 496)
SETS = {'enemy_cannon_walk': (list(range(11, 29)), NARROW), 'enemy_cannon_atk': (list(range(100, 119)), WIDE),
        'enemy_cannon_die': (list(range(120, 201, 4)), WIDE)}
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
S = fr[0].shape[1] / 1024   # 16 Eki: tam çözünürlüklü video (1280) gelince koordinatlar ölçeklenir
FIG_TOP, GROUND, NARROW, WIDE = video_isle.sc(FIG_TOP, S), video_isle.sc(GROUND, S), video_isle.sc(NARROW, S), video_isle.sc(WIDE, S)
SETS = {k: (o, NARROW if b == (250, 150, 774, 456) else WIDE) for k, (o, b) in SETS.items()}
k = TARGET / (GROUND - FIG_TOP)
def cut(n):
    a = np.array(video_isle.remove_magenta(fr[n]))
    m = a[..., 3] > 40; lab, cnt = nd.label(m)
    if cnt: sz = nd.sum(m, lab, range(1, cnt + 1)); a[..., 3] = np.where(np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 25]), 0, a[..., 3]) # tek tük toz zerrecikleri
    return a
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, (order, (x0, y0, x1, y1)) in SETS.items():
    FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order): out.paste(Image.fromarray(cut(n)[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    m = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - GROUND) / (y1 - y0), 4), 'ch': round((GROUND - FIG_TOP) / (y1 - y0), 4)}
    if name.endswith('_walk'): m.update({'idle': 0, 'stride': 1.6})
    if name.endswith('_die'): m['dur'] = 2.0
    meta[name] = m
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, m, out.size)
# durağan görsel: itmenin ilk karesi, gruba sıkı kesilmiş
a = cut(11)[FIG_TOP - 4:GROUND + 3, NARROW[0]:NARROW[2]]; ys, xs = np.nonzero(a[..., 3] > 30); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
st = Image.fromarray(a); st = st.resize((int(st.width * 380 / st.height), 380), Image.LANCZOS); st.save(os.path.join(IMG, 'enemy_cannon.webp'), 'WEBP', quality=88, method=6)
if 'enemy_cannon.webp' not in man: man.append('enemy_cannon.webp')
mp = os.path.join(IMG, 'meta.json'); mt = json.load(open(mp)); mt['enemy_cannon'] = [st.width, st.height]; json.dump(mt, open(mp, 'w'), indent=0)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
print('enemy_cannon', st.size)

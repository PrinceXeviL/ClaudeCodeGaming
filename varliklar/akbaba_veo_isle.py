"""Leş Akbabası'nın Veo videosu (15 Eki, magenta zemin, WhatsApp'tan 1024x576; kartal_veo_isle.py'den): uçuş döngüsü (_walk) ve dalış saldırısı (_atk).
akbaba_ucus_dalis_veo.mp4: 0-100 yerinde kanat çırpma (döngü 33+17 kare), 104-176 dalış ve geri tırmanış.
İki şerit AYNI kutu ve ölçekle kesilir (oyunda boy zıplamasın); dalışta kuş kutunun içinde aşağı iner.
Eski şeritler varliklar/cikti/akbaba_eski/ içine yedeklenir. Sonra: python3 varliklar/pembe_duzelt.py enemy_vulture_walk enemy_vulture_atk
    .venv/bin/python varliklar/akbaba_veo_isle.py
"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img'); BAK = os.path.join(H0, 'cikti', 'akbaba_eski')
SRC = 'ham/anim/akbaba_ucus_dalis_veo.mp4'
BOX = (272, 28, 748, 460)       # bütün karelerin (dalışın en alt ve en geniş anı dahil) kutusu, video pikseli
TARGET = 150                    # uçuştaki ortanca kuş boyu (şerit pikseli)
SETS = {'enemy_vulture_walk': list(range(33, 50)), 'enemy_vulture_atk': list(range(104, 177, 3))}
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
cut = lambda n: np.asarray(video_isle.remove_magenta(fr[n]))
hs, bots = [], []
for n in SETS['enemy_vulture_walk']:
    ys = np.nonzero(cut(n)[..., 3] > 128)[0]; hs.append(ys.max() - ys.min()); bots.append(ys.max())
chH = float(np.median(hs)); x0, y0, x1, y1 = BOX; k = TARGET / chH
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p))
os.makedirs(BAK, exist_ok=True)
for name, order in SETS.items():
    p = os.path.join(IMG, name + '.webp')
    if os.path.exists(p) and not os.path.exists(os.path.join(BAK, name + '.webp')): shutil.copy(p, BAK)
    out = Image.new('RGBA', (FW * len(order), FH), (0, 0, 0, 0))
    for i, n in enumerate(order):
        c = cut(n); keep = video_isle.biggest_mask(c[..., 3]); c[..., 3] = np.where(keep | ((c[..., 3] > 0) & (c[..., 3] <= 128)), c[..., 3], 0)
        out.paste(Image.fromarray(c[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS), (i * FW, 0))
    out.save(p, 'WEBP', quality=86, method=6)
    old = meta.get(name, {})
    m = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - max(bots)) / (y1 - y0), 4), 'ch': round(chH / (y1 - y0), 4)}
    for kk in ('idle', 'sh', 'stride'):
        if kk in old: m[kk] = old[kk] if kk != 'idle' else 0
    meta[name] = m; print(name, m, out.size)
json.dump(meta, open(meta_p, 'w'), indent=1)

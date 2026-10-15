"""Báthory'nin dikişsiz bekleme döngüsü (16 Eki, Caner: eski bekleme "başı sonu farklı"): Flow Frames to Video, ilk ve son kare aynı görsel.
ham/anim/bathory_bekleme_dongu_veo.mp4 (1280x720, beyaz zemin): kan yılanı bir tam tur döner. 0-230 (231. kare 0'a en yakın) her kareyle, 24 kare/sn.
Karakter boyu eski bekleme şeridindekiyle aynı (oyunda boy zıplamasın); kutu kan yılanının en geniş anını içine alır.
    .venv/bin/python varliklar/bathory_bekleme_isle.py
"""
import json, os, sys
import numpy as np
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/bathory_bekleme_dongu_veo.mp4'
ORDER = list(range(0, 231))
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
a0 = video_isle.remove_white(fr[0]); ys, xs = np.nonzero(a0[..., 3] > 128)
FIG_TOP, FIG_BOT = ys.min(), ys.max()
head = xs[ys < FIG_TOP + (FIG_BOT - FIG_TOP) * 0.16]; CX = int(round(head.mean()))   # taç ortası: eski şeritlerle aynı yatay çapa
from scipy import ndimage
BODY = ndimage.binary_dilation(video_isle.remove_white(fr[0])[..., 3] > 128, iterations=10)  # başlangıç duruşu (kemik eller, kafatası korunsun)
def mist(a):  # arkadan geçen yılanın soluk pembe-gri izi koyu zeminde gri leke gibi duruyordu -> yarı saydam koyu kızıl
    f = a.astype(np.float32); rgb = f[..., :3]; mn = rgb.min(2); sat = rgb.max(2) - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m = ((f[..., 3] < 250) | ~BODY) & (mn > 120) & (sat < 80) & (b >= g - 2) & (r - g >= 6)   # pembe-gri (kemik bej: b < g)
    f[m, :3] = np.array([130, 20, 34]) * 0.8 + rgb[m] * 0.12; f[m, 3] *= np.clip((255 - mn[m]) / 110, 0.35, 0.8)
    return f.astype(np.uint8)
crops = [mist(video_isle.remove_white(fr[n])) for n in ORDER]
X0 = min(np.nonzero(c[..., 3] > 40)[1].min() for c in crops[::5]); X1 = max(np.nonzero(c[..., 3] > 40)[1].max() for c in crops[::5])
Y0 = min(np.nonzero(c[..., 3] > 40)[0].min() for c in crops[::5]); Y1 = max(np.nonzero(c[..., 3] > 40)[0].max() for c in crops[::5])
half = max(CX - X0, X1 - CX) + 8; x0, x1 = CX - half, CX + half; y0, y1 = Y0 - 8, max(Y1, FIG_BOT) + 8
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
F0 = meta['hero_bathory_idle']; k = F0['ch'] * F0['fh'] / (FIG_BOT - FIG_TOP)   # eski şeritteki karakter boyu (px)
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
print('figür', FIG_TOP, FIG_BOT, 'CX', CX, 'kutu', (x0, y0, x1, y1), 'k', round(k, 3))
video_isle.save_strip('hero_bathory_idle', [c[y0:y1, x0:x1] for c in crops], FW, FH, IMG, meta, man,
    {'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4), 'fps': 24}, keep=False)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

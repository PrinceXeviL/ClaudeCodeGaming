"""Merlin'in Kasırga Fırtınası (18 Eki, Caner: "çok daha etkileyici, Gemini'den"): Gemini çizimi (ham/nm40_merlin_kasirga.jpg) Veo ile canlandırıldı
(ham/anim/merlin_kasirga_veo.mp4, beyaz zemin, geniş kadraj). Her kare (24 kare/sn), en az dikişli döngü (35. kareden 56 kare) -> img/fx_tornado.webp
+ anim.json: n, fw, fh, cols, fps, bx/by (huninin yere değdiği toz halkasının ortası, kare içinde px), rw (halkanın genişliği, px).
Oyun (game.js drawTornado) şeridi halka genişliği bölgenin çapına denk gelecek ölçekte çizer; düşmanları döndürüp savurmak kodda.
    .venv/bin/python3 varliklar/merlin_kasirga_isle.py"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_isle
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
ST, N, FH = 35, 56, 240
fr = video_isle.frames_of(os.path.join(ROOT, 'varliklar', 'ham', 'anim', 'merlin_kasirga_veo.mp4'), 24)[ST:ST + N]
cut = [video_isle.remove_white(f) for f in fr]
al = np.max([c[..., 3] for c in cut], axis=0) > 30; ys, xs = np.nonzero(al)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
# toz halkası: alt %12'lik banttaki dolu piksellerin yatay yayılımı ve ortası (ilk kare)
a0 = cut[0][..., 3] > 100; rows = np.nonzero(a0.any(1))[0]; bot = rows.max(); band = a0[bot - int((bot - rows.min()) * 0.12):bot + 1]
bxs = np.nonzero(band.any(0))[0]; ring_w = bxs.max() - bxs.min(); ring_cx = (bxs.max() + bxs.min()) / 2; ring_cy = bot - (bot - rows.min()) * 0.05
s = FH / (y1 - y0); FW = int(round((x1 - x0) * s))
tiles = [Image.fromarray(c[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS) for c in cut]
out, cols = video_isle.pack(tiles, FW, FH, limit=FW * 10, name='fx_tornado')
out.save(os.path.join(IMG, 'fx_tornado.webp'), 'WEBP', quality=86, method=6)
A = json.load(open(os.path.join(IMG, 'anim.json')))
A['fx_tornado'] = {'n': N, 'fw': FW, 'fh': FH, 'cols': cols or N, 'fps': 24, 'bx': round((ring_cx - x0) * s, 1), 'by': round((ring_cy - y0) * s, 1), 'rw': round(ring_w * s, 1)}
json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1)
man = json.load(open(os.path.join(IMG, 'manifest.json')))
if 'fx_tornado.webp' not in man: man.append('fx_tornado.webp'); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
print(A['fx_tornado'], out.size, os.path.getsize(os.path.join(IMG, 'fx_tornado.webp')) // 1024, 'KB')

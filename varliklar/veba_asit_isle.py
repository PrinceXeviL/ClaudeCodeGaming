"""Veba Kazanı asidi (18 Eki, Caner: "yeşil asidi Gemini'de daha detaylı çizdirip video yaptıralım"): ham/anim/veba_asit_veo.mp4 (Veo, beyaz zemin)
çarpma anından (14. kare) göl yayılana kadar her kare 24 kare/sn -> img/fx_acid.webp + anim.json (n, fw, fh, cols, fps, bx/by: çarpma noktası, rw: göl genişliği).
Oyun (game.js fxPlagueSplash) çarpma yerinde oynatır, son kare söner.
    .venv/bin/python3 varliklar/veba_asit_isle.py"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_isle
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
ST, N, FH = 14, 72, 120
fr = video_isle.frames_of(os.path.join(ROOT, 'varliklar', 'ham', 'anim', 'veba_asit_veo.mp4'), 24)[ST:ST + N]
cut = []
for f in fr:
    c = video_isle.remove_white(f); a = c[..., :3].astype(int)
    gray = (np.abs(a[..., 0] - a[..., 1]) < 14) & (np.abs(a[..., 1] - a[..., 2]) < 14) & (a.mean(2) > 150)  # yerdeki gri gölge
    c[gray, 3] = 0; cut.append(c)
al = np.max([c[..., 3] for c in cut], axis=0) > 30; ys, xs = np.nonzero(al)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
last = cut[-1][..., 3] > 100; lys, lxs = np.nonzero(last)
cx, cy, rw = (lxs.min() + lxs.max()) / 2, (lys.min() + lys.max()) / 2, lxs.max() - lxs.min()
s = FH / (y1 - y0); FW = int(round((x1 - x0) * s))
tiles = [Image.fromarray(c[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS) for c in cut]
out, cols = video_isle.pack(tiles, FW, FH, limit=FW * 12, name='fx_acid')
out.save(os.path.join(IMG, 'fx_acid.webp'), 'WEBP', quality=86, method=6)
A = json.load(open(os.path.join(IMG, 'anim.json')))
A['fx_acid'] = {'n': N, 'fw': FW, 'fh': FH, 'cols': cols or N, 'fps': 24, 'bx': round((cx - x0) * s, 1), 'by': round((cy - y0) * s, 1), 'rw': round(rw * s, 1)}
json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1)
man = json.load(open(os.path.join(IMG, 'manifest.json')))
if 'fx_acid.webp' not in man: man.append('fx_acid.webp'); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
print(A['fx_acid'], out.size, os.path.getsize(os.path.join(IMG, 'fx_acid.webp')) // 1024, 'KB')

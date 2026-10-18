"""Kristal kafatası Veo canlandırması (18 Eki, Caner: "kristal için animasyon da yapabiliriz veo ile"): ham/anim/kristal_veo.mp4 (beyaz zemin,
geniş kadraj). Her kare 24 kare/sn, en az dikişli döngü (7,5. sn sonrası bozuk kare dışarıda) -> img/fx_crystal.webp + anim.json (n, fw, fh, cols, fps).
Oyunda büyük kristal gösterimlerinde (dükkân başlığı, ödül) dönen taş; küçük rozetler durağan ico_crystal kalır.
    .venv/bin/python3 varliklar/kristal_veo_isle.py [başlangıç uzunluk]"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_isle
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
FH = 128
fr = video_isle.frames_of(os.path.join(ROOT, 'varliklar', 'ham', 'anim', 'kristal_veo.mp4'), 24)[:180]
if len(sys.argv) > 2: ST, N = int(sys.argv[1]), int(sys.argv[2])
else:
    sm = np.array([f[::4, ::4].astype(np.float32) for f in fr]); best = None
    for st in range(4, 60):
        for L in range(48, 120):
            if st + L + 1 >= len(fr): break
            v = np.abs(sm[st] - sm[st + L]).mean() + 0.5 * np.abs(sm[st + 1] - sm[st + L + 1]).mean()
            if best is None or v < best[0]: best = (v, st, L)
    print('döngü', best); ST, N = best[1], best[2]
from scipy import ndimage as nd
def kes(f):  # beyaz pırıltılar zemin sanılıp delik açılmasın: taşın içindeki kapalı boşluklar asıl renkle geri dolar
    c = video_isle.remove_white(f); m = c[..., 3] > 30; fill = nd.binary_fill_holes(m) & ~m
    fill = nd.binary_dilation(fill, iterations=1) & (c[..., 3] < 250) & nd.binary_fill_holes(m)
    c[fill, :3] = f[fill]; c[fill, 3] = 255; return c
cut = [kes(f) for f in fr[ST:ST + N]]
al = np.max([c[..., 3] for c in cut], axis=0) > 30; ys, xs = np.nonzero(al)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
s = FH / (y1 - y0); FW = int(round((x1 - x0) * s))
tiles = [Image.fromarray(c[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS) for c in cut]
out, cols = video_isle.pack(tiles, FW, FH, limit=FW * 12, name='fx_crystal')
out.save(os.path.join(IMG, 'fx_crystal.webp'), 'WEBP', quality=88, method=6)
A = json.load(open(os.path.join(IMG, 'anim.json')))
A['fx_crystal'] = {'n': N, 'fw': FW, 'fh': FH, 'cols': cols or N, 'fps': 24}
json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1)
man = json.load(open(os.path.join(IMG, 'manifest.json')))
if 'fx_crystal.webp' not in man: man.append('fx_crystal.webp'); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
print(A['fx_crystal'], out.size, os.path.getsize(os.path.join(IMG, 'fx_crystal.webp')) // 1024, 'KB')
# önizleme GIF
g = [Image.alpha_composite(Image.new('RGBA', t.size, (40, 14, 22, 255)), t.convert('RGBA')).resize((FW * 2, FH * 2)) for t in tiles]
d = os.path.expanduser('~/Downloads/GameLab/kristal_veo'); os.makedirs(d, exist_ok=True)
g[0].save(os.path.join(d, '3_sonuc_dongu.gif'), save_all=True, append_images=g[1:], duration=42, loop=0)

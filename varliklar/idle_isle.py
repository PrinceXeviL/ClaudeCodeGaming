"""Bekleme (idle) kare sayfası (Gemini, yan yana N kare, magenta zemin) -> img/<ad>_idle.webp şeridi + anim.json kaydı.
Ölçek ve boy, birimin yürüyüş şeridindeki "idle" karesine eşitlenir (dururken görünen boy değişmesin); her kare kendi ayak ortasına
ve tabanına hizalanır (ayaklar yerinde kalır), üst gövdenin kareler arası farkı korunur.
    .venv/bin/python varliklar/idle_isle.py ham/nm_iskelet_idle_1.jpg unit_skel_1
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
src, name = sys.argv[1], sys.argv[2]
A = remove_magenta(np.array(Image.open(os.path.join(H0, src)).convert('RGB')))
al = A[..., 3] > 40
cols = al.any(0); runs = []; x = 0; W = len(cols)
while x < W: # kare sütunları: boş sütun boşluklarıyla ayrılan gruplar (küçük artıklar atılır)
    if cols[x]:
        s = x
        while x < W and cols[x]: x += 1
        runs.append([s, x])
    else: x += 1
merged = []
for r in runs: # 25 px'ten dar boşlukla ayrılanlar aynı karedir
    if merged and r[0] - merged[-1][1] < 25: merged[-1][1] = r[1]
    else: merged.append(r)
merged = [r for r in merged if r[1] - r[0] > 60]
print('kare', len(merged), merged)
frames = []
for x0, x1 in merged:
    P = A[:, x0:x1].copy(); a = P[..., 3] > 40; lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1))
    main = lab == (int(np.argmax(sz)) + 1); near = ndimage.binary_dilation(main, iterations=4)
    keep = np.isin(lab, [j + 1 for j in range(n) if (near & (lab == j + 1)).any() and sz[j] > 20]); P[~ndimage.binary_dilation(keep, iterations=2), 3] = 0
    ys, xs = np.nonzero(P[..., 3] > 100); top, bot = ys.min(), ys.max() + 1
    fx = np.nonzero((P[bot - int(0.04 * (bot - top)):bot, :, 3] > 100).any(0))[0]
    frames.append(dict(P=P, top=top, bot=bot, foot=(fx.min() + fx.max()) / 2, l=xs.min(), r=xs.max() + 1))
meta = json.load(open(os.path.join(IMG, 'anim.json')))
Wm = meta[name + '_walk']; WS = Image.open(os.path.join(IMG, name + '_walk.webp')).convert('RGBA')
wf = np.array(WS)[:, Wm['idle'] * Wm['fw']:(Wm['idle'] + 1) * Wm['fw']]; ys, xs = np.nonzero(wf[..., 3] > 100)
ref_h = ys.max() + 1 - ys.min() # yürüyüş şeridinin bekleme karesindeki boy (px)
fh = Wm['fh']; f0 = frames[0]; S = ref_h / (f0['bot'] - f0['top'])
half = max(max(f['foot'] - f['l'], f['r'] - f['foot']) for f in frames) * S
fw = int(np.ceil(2 * half)) + 4; base = Wm['base']; floor = round(fh * (1 - base))
strip = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
for i, f in enumerate(frames):
    crop = Image.fromarray(f['P'][f['top'] - 40 if f['top'] > 40 else 0:f['bot'], f['l']:f['r']]); oy = f['top'] - 40 if f['top'] > 40 else 0
    crop = crop.resize((max(1, round((f['r'] - f['l']) * S)), max(1, round((f['bot'] - oy) * S))), Image.LANCZOS)
    strip.paste(crop, (round(i * fw + fw / 2 - (f['foot'] - f['l']) * S), floor - crop.height), crop)
strip.save(os.path.join(IMG, name + '_idle.webp'), 'WEBP', quality=92)
meta[name + '_idle'] = {'n': len(frames), 'fw': fw, 'fh': fh, 'base': base, 'ch': Wm['ch'], 'sh': 1}
json.dump(meta, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1)
mf = json.load(open(os.path.join(IMG, 'manifest.json')))
if name + '_idle.webp' not in mf: mf.append(name + '_idle.webp'); json.dump(sorted(mf), open(os.path.join(IMG, 'manifest.json'), 'w'))
print(name + '_idle', len(frames), 'kare', fw, 'x', fh, 'ölçek', round(S, 3), [f['bot'] - f['top'] for f in frames])

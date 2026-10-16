"""Mahzen iskeletlerinin Veo videoları (16 Eki, Caner): magenta zemin, 1280x720, her videoda 2 hareket (ölüm hep sonda).
  A: iskelet_A_bekci_hamle_olum_veo.mp4  -> unit_skel_4_dash (Kalkan Hamlesi), unit_skel_4_die (kemikler yığılır, dağılır)
  B: iskelet_B_bekci_tabut_yuruyus_veo.mp4 -> unit_skel_4_guard (Tabut Duvarı), unit_skel_4_walk
  C: iskelet_C_sovalye_ruh_olum_veo.mp4  -> unit_skel_5_skill (Ruh Biçimi), unit_skel_5_die
Ölçek: karakter boyu (ilk karede boynuz tepesi -> ayak) mevcut _walk şeridindeki karakter boyuna (ch*fh) eşitlenir; kare yatayda
karakterin gövde ortasına göre simetrik (drawFrame ortadan çizer), ayak çizgisi base. Her kare (Veo akıcılık), satırlara bölünür.
    .venv/bin/python varliklar/iskelet_veo_isle.py A [B C]
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
CFG = {
    'A': dict(src='iskelet_A_bekci_hamle_olum_veo.mp4', unit='unit_skel_4', sets={'_dash': (range(4, 77), {}), '_die': (range(120, 179), {'dur': round(59 / 24, 2)})}),
    # B: yürüyüş döngüsü temiz kapanmadı (dikiş farkı adımın ~2 katı) -> eski yürüyüş kalır; yalnız Tabut Duvarı (çakış, siper, sarsılma, kalkış)
    'B': dict(src='iskelet_B_bekci_tabut_yuruyus_veo.mp4', unit='unit_skel_4', sets={'_guard': (range(4, 95), {'dur': 3.4})}),
    # C (16 Eki): Ölüm Şövalyesi: Ruh Biçimi (eğilme, iki kılıçla tam dönüş, poza dönüş) + ölüm (sendeleme sonu, dağılma, kemik yığını)
    'C': dict(src='olum_sovalyesi_ruh_olum.mp4', unit='unit_skel_5', sets={'_skill': (range(6, 64), {}), '_die': (range(104, 173), {'dur': round(69 / 24, 2)})}),
}
def cut(a):
    c = video_isle.remove_magenta(a); al = c[..., 3]
    m = al > 40; lab, cnt = nd.label(m)
    if cnt: sz = nd.sum(m, lab, range(1, cnt + 1)); c[..., 3] = np.where(np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 80]), 0, al)   # Veo zemin kırıntıları
    f = c.astype(np.float32); r, g, b = f[..., 0], f[..., 1], f[..., 2]
    pink = (np.minimum(r, b) - g > 30) & (np.abs(r - b) < 90) & (f[..., 3] < 250)
    f[..., 3] = np.where(pink, f[..., 3] * 0.15, f[..., 3])
    return f.astype(np.uint8)
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for key in sys.argv[1:] or list(CFG):
    C = CFG[key]; fr = video_isle.frames_of(os.path.join(H0, 'ham', 'anim', C['src']), 24)
    c0 = cut(fr[0]); ys, xs = np.nonzero(c0[..., 3] > 128); TOP, BOT = ys.min(), ys.max()
    body = xs[(ys > TOP + (BOT - TOP) * 0.3) & (ys < TOP + (BOT - TOP) * 0.7)]; CX = int(np.median(body))   # gövde ortası (kalkan/silah taşmaları sayılmaz)
    W0 = meta[C['unit'] + '_walk']; k = W0['ch'] * W0['fh'] / (BOT - TOP)
    for suf, (rng, extra) in C['sets'].items():
        crops = [cut(fr[i]) for i in rng]
        X0 = min(np.nonzero(c[..., 3] > 60)[1].min() for c in crops); X1 = max(np.nonzero(c[..., 3] > 60)[1].max() for c in crops)
        Y0 = min(np.nonzero(c[..., 3] > 60)[0].min() for c in crops); Y1 = max(BOT, max(np.nonzero(c[..., 3] > 60)[0].max() for c in crops))
        half = max(CX - X0, X1 - CX) + 6; x0, x1 = max(0, CX - half), min(fr[0].shape[1], CX + half); y0, y1 = max(0, Y0 - 6), min(fr[0].shape[0], Y1 + 4)
        FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
        name = C['unit'] + suf
        out, cols = video_isle.pack([Image.fromarray(c[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS) for c in crops], FW, FH)
        out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
        m = dict({'n': len(crops), 'fw': FW, 'fh': FH, 'base': round(float((y1 - BOT) / (y1 - y0)), 4), 'ch': round(float((BOT - TOP) / (y1 - y0)), 4)}, **extra)
        if cols: m['cols'] = cols
        meta[name] = m
        if name + '.webp' not in man: man.append(name + '.webp')
        print(name, m, os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

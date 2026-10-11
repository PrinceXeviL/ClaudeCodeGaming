"""Mezar Bekçisi (Mahzen 4. kademe, unit_skel_4) saldırı ve yetenek şeritleri: her poz ayrı Gemini görseli (çöp adam kılavuzuyla, 11 Eki).
Kodla ara kare uydurulmaz: şerit karelerinde çizilmiş pozlar sırayla tutulur.
    .venv/bin/python varliklar/bekci_kare_isle.py
Ölçek: göz → ayak altı mesafesi (Gemini karelerinde ayakta duruşta ~1640 px, duruş görselinde 317 px) bütün karelerde ortak.
Hiza: ayak altı zemine, göz yatayda duruş görselindeki göz yerine (karakter yerinde kalır, poz değişir).
  unit_skel_4_atk   (8 kare, ATK_FRAME_T sırası): duruş, kurulma x4 (gürz başın arkasında), vuruş x2, duruş
  unit_skel_4_skill (10 kare, bir kez oynar): kalkanı kaldırma x3, kalkanı yere çakma x7 (Tabut Duvarı)
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
FH = 200                      # şerit kare yüksekliği (px)
BASE_H, BASE_EYE2FOOT = 380, 317
SB = 0.47                     # duruş görseli -> şerit ölçeği (380 px -> ~179 px karakter)
POSE_E2F = 1640               # Gemini karelerinde ayakta göz -> ayak


def eye_foot(a):
    al = a[..., 3] > 100; H, W = al.shape
    ys = np.nonzero(al.any(1))[0]; foot, top = ys.max(), ys.min()
    low = al[int(foot - (foot - top) * 0.15):foot]; lx = np.nonzero(low.any(0))[0]; cx = (lx.min() + lx.max()) / 2
    g = (a[..., 1].astype(int) > 190) & (a[..., 0].astype(int) < 170) & (a[..., 2].astype(int) < 170) & al
    Y, X = np.mgrid[0:H, 0:W]; band = g & (np.abs(X - cx) < (foot - top) * 0.25) & (Y < top + (foot - top) * 0.45)
    ey, ex = np.nonzero(band)
    return float(np.median(ex)), float(np.median(ey)), int(foot)


def placed(a, k):
    ex, ey, foot = eye_foot(a)
    im = Image.fromarray(a).resize((round(a.shape[1] * k), round(a.shape[0] * k)), Image.LANCZOS)
    return im, ex * k, foot * k


def main():
    base = np.asarray(Image.open(os.path.join(IMG, 'unit_skel_4.webp')).convert('RGBA'))
    bex, bey, bfoot = eye_foot(base)
    poses = {'stand': placed(base, SB)}
    k = SB * BASE_EYE2FOOT / POSE_E2F
    for nm, f in (('windup', 'nm_bekci_saldiri_1'), ('smash', 'nm_bekci_saldiri_2'), ('up', 'nm_bekci_yetenek_1'), ('slam', 'nm_bekci_yetenek_2')):
        poses[nm] = placed(remove_magenta(np.asarray(Image.open(os.path.join(H0, 'ham', f + '.jpg')).convert('RGB'))), k)
    # ortak çerçeve: göz noktası çerçevede sabit x'te, ayak altı sabit y'de; en geniş pozlar sığacak kadar
    L = max(ex for im, ex, ft in poses.values()) + 4; R = max(im.width - ex for im, ex, ft in poses.values()) + 4
    U = max(ft for im, ex, ft in poses.values()) + 4
    r = bex / base.shape[1]  # duruş görselinde göz x oranı: çerçevede de aynı oran (oyun çerçeveyi ortasından çizer, duruşla kareler üst üste oturur)
    if L / (L + R) < r: L = r * R / (1 - r)
    else: R = L * (1 - r) / r
    fw = int(np.ceil(L + R)); fh = int(np.ceil(U)) + 4; gy = int(np.ceil(U))
    def frame(p):
        im, ex, ft = poses[p]; c = Image.new('RGBA', (fw, fh), (0, 0, 0, 0)); c.alpha_composite(im, (round(L - ex), round(gy - ft))); return c
    meta = json.load(open(os.path.join(IMG, 'anim.json'))); man = set(json.load(open(os.path.join(IMG, 'manifest.json'))))
    char_h = BASE_H * SB
    for name, seq in (('unit_skel_4_atk', ['stand', 'windup', 'windup', 'windup', 'windup', 'smash', 'smash', 'stand']),
                      ('unit_skel_4_skill', ['up'] * 3 + ['slam'] * 7)):
        strip = Image.new('RGBA', (fw * len(seq), fh), (0, 0, 0, 0))
        for i, p in enumerate(seq): strip.alpha_composite(frame(p), (i * fw, 0))
        strip.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6)
        # ox: göz noktası çerçeve ortasından ne kadar sapık (oyun ayak ortasını çerçeve ortası sayar) -> çerçeve göz x'i duruştaki gibi
        meta[name] = {'n': len(seq), 'fw': fw, 'fh': fh, 'base': round((fh - gy) / fh, 4), 'ch': round(char_h / fh, 4), 'sh': 1}
        man.add(name + '.webp'); print(name, strip.size)
    json.dump(meta, open(os.path.join(IMG, 'anim.json'), 'w')); json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
    print('göz x çerçevede', round(L / fw, 3), 'duruş görselinde', round(bex / base.shape[1], 3))


if __name__ == '__main__':
    main()

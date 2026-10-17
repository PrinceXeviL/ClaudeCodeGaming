"""Çizim kenarı denetimi (17 Eki, Caner: "tüm çizimlerin kenarlarını iyi temizle; sefer haritasındaki ev, harabe vs. kusurlu").
img/ içindeki durağan görselleri (animasyon şeritleri hariç) tarar, her biri için:
  pembe : kenar bandında (saydamlığa 3 px) magenta tonlu piksel oranı (magenta zeminden kalan saçak)
  beyaz : kenar bandında açık-soluk (beyaz zeminden kalan) piksel oranı
  kirinti: ana gövdeden kopuk küçük öbek (< 40 px) sayısı (silinmemiş leke, komşu çizimden taşma)
  yari  : gövde dışında yarı saydam (alfa 20-200) geniş leke oranı (gölge/sis kalıntısı)
    .venv/bin/python3 varliklar/kenar_denetim.py [ön ek ...]   → varliklar/cikti/kenar_denetim.txt (en kötüden iyiye)"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')


def olc(a):
    al = a[..., 3].astype(np.float32); rgb = a[..., :3].astype(np.float32)
    solid = al > 20; out = ~solid
    band = solid & nd.binary_dilation(out, iterations=3)
    nb = max(1, band.sum())
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; mn, mx = rgb.min(2), rgb.max(2); sat = (mx - mn) / np.maximum(mx, 1)
    pembe = (band & (r - g > 45) & (b - g > 45)).sum() / nb
    beyaz = (band & (mn > 185) & (sat < 0.12)).sum() / nb
    lab, n = nd.label(solid, structure=np.ones((3, 3)))
    if n:
        sz = nd.sum(np.ones_like(al), lab, range(1, n + 1)); big = sz.max()
        kir = int(((sz < 40) & (sz < big * 0.02)).sum())
    else: kir = 0
    yari = ((al > 20) & (al < 200)).sum() / max(1, solid.sum())
    return pembe, beyaz, kir, yari


def main():
    anim = set(json.load(open(os.path.join(IMG, 'anim.json'))))
    pre = tuple(sys.argv[1:])
    rows = []
    for f in sorted(os.listdir(IMG)):
        if not f.endswith('.webp'): continue
        n = f[:-5]
        if n in anim or n.startswith(('atlas_', 'map_')) or (pre and not n.startswith(pre)): continue
        a = np.asarray(Image.open(os.path.join(IMG, f)).convert('RGBA'))
        if a[..., 3].min() > 250: continue  # saydamlığı yok (zemin dokusu)
        p, w, k, y = olc(a)
        skor = p * 100 + w * 40 + k * 0.6 + max(0, y - 0.15) * 20
        rows.append((round(skor, 1), n, round(p * 100, 1), round(w * 100, 1), k, round(y * 100, 1)))
    rows.sort(reverse=True)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cikti', 'kenar_denetim.txt')
    with open(out, 'w') as fo:
        fo.write('skor\tad\tpembe%\tbeyaz%\tkırıntı\tyarısaydam%\n')
        for r in rows: fo.write('\t'.join(map(str, r)) + '\n')
    for r in rows[:45]: print(*r, sep='\t')
    print(len(rows), 'görsel')


if __name__ == '__main__':
    main()

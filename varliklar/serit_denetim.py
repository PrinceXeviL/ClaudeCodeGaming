"""Animasyon şeridi denetimi (18 Eki, Caner: "hâlâ yer yer beyaz kenar, mor sızıntı ve tutarsız boylar").
anim.json'daki her şeridi kare kare tarar:
  pembe/beyaz : kenar bandında magenta saçak / beyaz zemin kalıntısı (karelerin ortalaması, %)
  kirinti     : kare başına gövdeden kopuk küçük öbek
  boy         : oyunda çizilen ilk karenin boyu / aynı karakterin yürüyüş (yoksa idle) şeridindeki ilk karenin boyu
                (Wan/Veo aynı referanstan başlar: ilk kareler aynı boyda olmalı; %8'den çok sapma = şerit değişince karakter büyür/küçülür)
    .venv/bin/python3 varliklar/serit_denetim.py [ön ek ...]  → varliklar/cikti/serit_denetim.txt"""
import json, os, sys, re
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kenar_denetim import olc
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
A = json.load(open(os.path.join(IMG, 'anim.json')))


def frames(n):
    F = A[n]; p = os.path.join(IMG, n + '.webp')
    if not os.path.exists(p) or 'fw' not in F: return None
    im = np.asarray(Image.open(p).convert('RGBA')); C = F.get('cols') or F['n']
    sx = im.shape[1] / (F['fw'] * C); R = (F['n'] + C - 1) // C; sy = im.shape[0] / (F['fh'] * R)
    fw, fh = int(round(F['fw'] * sx)), int(round(F['fh'] * sy))
    return [im[(i // C) * fh:(i // C + 1) * fh, (i % C) * fw:(i % C + 1) * fw] for i in range(F['n'])], sy


def hgt(f):  # oyunda çizilen boy (karakter boyu = 1 birim)
    ys = np.nonzero(f[..., 3].max(1) > 128)[0]; return (ys.max() - ys.min()) if len(ys) else 0


def main():
    pre = tuple(sys.argv[1:]); rows = []; first = {}
    for n in A:
        if pre and not n.startswith(pre): continue
        r = frames(n)
        if not r: continue
        fr, sy = r; F = A[n]
        ms = [olc(f) for f in fr[::max(1, len(fr) // 8)]]
        p = np.mean([m[0] for m in ms]) * 100; w = np.mean([m[1] for m in ms]) * 100; k = np.mean([m[2] for m in ms])
        h0 = hgt(fr[0]) / sy / (F['ch'] * F['fh']) if F.get('ch') else None
        first[n] = h0; rows.append([n, round(p, 1), round(w, 1), round(k, 1), h0])
    out = []
    for n, p, w, k, h0 in rows:
        base = re.sub(r'_(walk|idle|atk\d?|die|skill\d?|cast\w*|cheer|shield\w*|run|a\d?p\d?|hit|spin|block|jump|throw|x)$', '', n)
        ref = next((first.get(base + s) for s in ('_walk', '_idle') if first.get(base + s)), None)
        boy = round(h0 / ref, 2) if (h0 and ref and not n.endswith(('_walk', '_die'))) else ''
        skor = p * 3 + w * 2 + k * 2 + (abs(boy - 1) * 60 if boy != '' and abs(boy - 1) > 0.08 else 0)
        out.append((round(skor, 1), n, p, w, k, boy))
    out.sort(reverse=True)
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cikti', 'serit_denetim.txt'), 'w') as fo:
        fo.write('skor\tad\tpembe%\tbeyaz%\tkırıntı\tboy\n')
        for r in out: fo.write('\t'.join(map(str, r)) + '\n')
    for r in out[:60]: print(*r, sep='\t')
    print(len(out), 'şerit')


if __name__ == '__main__':
    main()

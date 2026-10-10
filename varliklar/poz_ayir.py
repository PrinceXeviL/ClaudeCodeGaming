"""Gemini poz sayfası (magenta zeminde yan yana pozlar) -> ortak ölçekli, ayak hizalı oyun kareleri.
Kullanım: python3 varliklar/poz_ayir.py <ham.webp> <ad1> <ad2> ... [--cuts '[[[x,y],...],...]'] [--h 300]
Pozlar ayrıksa büyük parçalar soldan sağa sıralanıp adlara verilir (küçük kopuk parçalar en yakın poza katılır).
Birbirine değen pozlar için --cuts ile her sınırın kırık çizgisi verilir (okcu_poz_isle.py mantığı).
Hepsi aynı ölçekle en uzun poz H px olacak şekilde küçültülür, ayak ortası tuvalin ortasına gelir (kareler arasında kayma yok).
img/<ad>.webp + meta.json + manifest.json yazar; 2. pozun (nişan) en sağ ucunu (cıvata ucu, tuval kesri) yazdırır."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
args = sys.argv[1:]; cuts = None; TH = 300
if '--cuts' in args: i = args.index('--cuts'); cuts = json.loads(args[i + 1]); del args[i:i + 2]
if '--h' in args: i = args.index('--h'); TH = int(args[i + 1]); del args[i:i + 2]
src, NAMES = args[0], args[1:]; N = len(NAMES)
A = remove_magenta(np.array(Image.open(src).convert('RGB'))); Hh, Ww = A.shape[:2]
a = A[..., 3] > 40; lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1)); com = ndimage.center_of_mass(a, lab, range(1, n + 1))
masks = []
if cuts:
    for i in range(N):
        m = Image.new('L', (Ww, Hh), 0); left = cuts[i - 1] if i > 0 else [[0, 0], [0, Hh]]; right = cuts[i] if i < len(cuts) else [[Ww, 0], [Ww, Hh]]
        ImageDraw.Draw(m).polygon([tuple(p) for p in left + right[::-1]], fill=255); masks.append(np.array(m) > 0)
else:
    big = sorted(np.argsort(sz)[::-1][:N], key=lambda k: com[k][1]); cx = [com[k][1] for k in big]
    own = np.zeros(n + 1, int) - 1
    for k in range(n): own[k + 1] = int(np.argmin([abs(com[k][1] - c) for c in cx])) if sz[k] > 30 else -1
    for i in range(N): masks.append(own[lab] == i)
polys, boxes = [], []
for i in range(N):
    P = A.copy(); P[~masks[i], 3] = 0
    m = P[..., 3] > 40; l2, n2 = ndimage.label(m); s2 = ndimage.sum(m, l2, range(1, n2 + 1))
    main = l2 == (int(np.argmax(s2)) + 1); near = ndimage.binary_dilation(main, iterations=3)
    keep = np.isin(l2, [k + 1 for k in range(n2) if (near & (l2 == k + 1)).any() or s2[k] > 400]); P[~ndimage.binary_dilation(keep, iterations=2), 3] = 0
    ys, xs = np.nonzero(P[..., 3] > 40); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # hiza noktası: bacak bölgesinin (boyun %78-92'si) kütle ortası; silah, pelerin ucu ve sis tek bir ayak kolonunu kaydırmasın
    band = P[y0 + int((y1 - y0) * 0.78):y0 + int((y1 - y0) * 0.92), :, 3] > 100; cols = band.sum(0)
    foot = float((np.arange(Ww) * cols).sum() / max(1, cols.sum())) if cols.sum() else (x0 + x1) / 2
    polys.append(P); boxes.append((x0, y0, x1, y1, foot))
S = TH / max(b[3] - b[1] for b in boxes); half = max(max(b[4] - b[0], b[2] - b[4]) for b in boxes)
cw, ch = int(np.ceil(2 * half * S)) + 4, TH
meta = json.load(open(os.path.join(IMG, 'meta.json'))); mf = json.load(open(os.path.join(IMG, 'manifest.json')))
for P, (x0, y0, x1, y1, foot), nm in zip(polys, boxes, NAMES):
    crop = Image.fromarray(P[y0:y1, x0:x1]).resize((round((x1 - x0) * S), round((y1 - y0) * S)), Image.LANCZOS)
    can = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); can.paste(crop, (round(cw / 2 - (foot - x0) * S), ch - crop.height), crop)
    can.save(os.path.join(IMG, nm + '.webp'), 'WEBP', quality=92); meta[nm] = [cw, ch]
    if nm + '.webp' not in mf: mf.append(nm + '.webp')
    print(nm, (int(x0), int(y0), int(x1), int(y1)), round(foot))
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'), separators=(',', ':')); json.dump(mf, open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
if N > 1:
    x0, y0, x1, y1, foot = boxes[1]; al = polys[1][..., 3] > 100; rows = slice(y0, y0 + int((y1 - y0) * 0.55))
    ys, xs = np.nonzero(al[rows]); j = xs.argmax(); tx, ty = xs[j], ys[j] + y0
    print('tip', round((cw / 2 + (tx - foot) * S) / cw, 3), round(1 - (y1 - ty) * S / ch, 3), 'tuval', cw, ch)

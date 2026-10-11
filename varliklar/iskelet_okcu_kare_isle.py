"""İskelet okçu kareleri ayrı Gemini görsellerinden: her kare ya tek figürlü bir görsel ya da bir sayfadan çokgenle kesilen parça.
Ölçek ortak: miğfer üstü → ayak altı boyu (yay uçları hariç) her karede aynı; ayak ortası tuvalin ortasında, en uzun kare 300 px.
    .venv/bin/python varliklar/iskelet_okcu_kare_isle.py 2      (okçu: unit_archer2 + _nock/_half/_draw/_rel)
    .venv/bin/python varliklar/iskelet_okcu_kare_isle.py x3     (arbaletçi: unit_xbow3 + _aim/_kick/_load)
Kare girdisinin 4. öğesi (varsa) o karenin gövde boyunun 1. kareye oranı: eğilen pozlar (arbalet dolumu) boya göre ölçeklenince büyük çıkmasın.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SUF = ['', '_nock', '_half', '_draw', '_rel'] # 1 kılıftan ok çekme (bekleme), 2 oku takma, 3 yarım germe, 4 tam germe, 5 bırakma
SUF_X = ['', '_aim', '_kick', '_load'] # arbaletçi: hazır, nişan, geri tepme, dolum
# kare: (görsel, sol kesim, sağ kesim); kesim None = görselin kenarı; kesimler görsel pikselinde çoklu çizgi
A2 = [(307, 0), (307, 318), (309, 322), (309, 336), (299, 339), (299, 768)]
B2 = [(559, 0), (559, 425), (578, 445), (578, 490), (555, 510), (555, 768)]
FRAMES = {
    1: [(f'nm_iskelet_okcu_1_k{i}.jpg', None, None) for i in range(1, 6)],
    # 3. kademe arbaletçi (11 Eki): hazır ve dolum eski sayfadan Gemini düzenlemesi (sis yok, zırh açık), nişan ve tepme kılavuzla; dolum boyu sayfadaki orandan
    'x3': [('nm_kemik_arbaletci_k3_hazir.jpg', None, None), ('nm_kemik_arbaletci_k3_nisan.jpg', None, None), ('nm_kemik_arbaletci_k3_tepme.jpg', None, None), ('nm_kemik_arbaletci_k3_dolum.jpg', None, None, 0.956)],
    2: [('nm_iskelet_okcu_2_deneme.jpg', None, A2), ('nm_iskelet_okcu_2_deneme.jpg', A2, B2),
        ('nm_iskelet_okcu_2_half.jpg', None, None), ('nm_iskelet_okcu_2_draw.jpg', None, None), ('nm_iskelet_okcu_2_rel.jpg', None, None)],
}
arg = sys.argv[1] if len(sys.argv) > 1 else '2'
k = arg if arg.startswith('x') else int(arg)
PRE, SUFS = (f'unit_xbow{arg[1:]}', SUF_X) if arg.startswith('x') else (f'unit_archer{k}', SUF)
cache = {}
def load(f):
    if f not in cache: cache[f] = remove_magenta(np.array(Image.open(os.path.join(H0, 'ham', f)).convert('RGB')))
    return cache[f]
outs = []
for f, lc, rc, *rt in FRAMES[k]:
    A = load(f).copy(); Hh, Ww = A.shape[:2]
    m = Image.new('L', (Ww, Hh), 0); left = lc or [(0, 0), (0, Hh)]; right = rc or [(Ww, 0), (Ww, Hh)]
    ImageDraw.Draw(m).polygon(left + right[::-1], fill=255); A[np.array(m) == 0, 3] = 0
    a = A[..., 3] > 40; lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1))
    main = lab == (int(np.argmax(sz)) + 1); near = ndimage.binary_dilation(main, iterations=3)
    keep = np.isin(lab, [j + 1 for j in range(n) if (near & (lab == j + 1)).any() and sz[j] > 30]); A[~ndimage.binary_dilation(keep, iterations=2), 3] = 0
    al = A[..., 3] > 100; ys, xs = np.nonzero(al); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    fig = y1 - y0
    # miğfer üstü: en uzun yatay dolu parçası boyun %7'sini geçen ilk satır (ince yay uçları sayılmaz)
    def run(row):
        r = np.diff(np.concatenate([[0], row.astype(int), [0]])); s, e = np.nonzero(r == 1)[0], np.nonzero(r == -1)[0]
        return (e - s).max() if len(s) else 0
    top = next(y for y in range(y0, y1) if run(al[y]) > 0.07 * fig)
    fx = np.nonzero(al[y1 - int(0.04 * fig):y1].any(0))[0]; foot = (fx.min() + fx.max()) / 2
    outs.append(dict(A=A, box=(x0, y0, x1, y1), top=top, foot=foot, body=(y1 - top) / (rt[0] if rt else 1)))
B = 1.0 # ortak gövde boyu (birim); her kare body -> B
tall = max((o['box'][3] - o['box'][1]) / o['body'] for o in outs) # yay uçlarıyla en uzun / gövde
S0 = 300 / tall # gövde boyu piksel
half = max(max(o['foot'] - o['box'][0], o['box'][2] - o['foot']) * S0 / o['body'] for o in outs)
cw, ch = int(np.ceil(2 * half)) + 4, 300
meta = json.load(open(os.path.join(IMG, 'meta.json'))); mf = json.load(open(os.path.join(IMG, 'manifest.json')))
for o, suf in zip(outs, SUFS):
    x0, y0, x1, y1 = o['box']; s = S0 / o['body']; nm = PRE + suf
    crop = Image.fromarray(o['A'][y0:y1, x0:x1]).resize((round((x1 - x0) * s), round((y1 - y0) * s)), Image.LANCZOS)
    can = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); can.paste(crop, (round(cw / 2 - (o['foot'] - x0) * s), ch - crop.height), crop)
    can.save(os.path.join(IMG, nm + '.webp'), 'WEBP', quality=92); meta[nm] = [cw, ch]
    if nm + '.webp' not in mf: mf.append(nm + '.webp')
    print(nm, 'gövde', o['body'], 'ölçek', round(s, 3))
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w')); json.dump(sorted(mf), open(os.path.join(IMG, 'manifest.json'), 'w'))
o = outs[1 if arg.startswith('x') else 3]; x0, y0, x1, y1 = o['box']; s = S0 / o['body']; al = o['A'][..., 3] > 100; ys, xs = np.nonzero(al); j = xs.argmax()
print('tip', round((cw / 2 + (xs[j] - o['foot']) * s) / cw, 3), round(1 - (y1 - ys[j]) * s / ch, 3), 'canvas', cw, ch)

"""Tek bir poz karesini yeni Gemini görseliyle değiştirir; boy ve ayak hizası referans kareye (aynı karakterin başka pozu) eşitlenir.
Ölçek: miğfer üstü → ayak altı (ince yay/kiriş uçları sayılmaz); ayak ortası ve taban referanstakiyle aynı yere, tuval boyu referansınki.
    .venv/bin/python varliklar/kare_degistir.py ham/nm_kemik_arbaletci_k2_tepme.jpg unit_xbow2_aim unit_xbow2_kick
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
def run(row):
    r = np.diff(np.concatenate([[0], row.astype(int), [0]])); s, e = np.nonzero(r == 1)[0], np.nonzero(r == -1)[0]
    return (e - s).max() if len(s) else 0
def metrics(A):
    al = A[..., 3] > 100; ys, xs = np.nonzero(al); y0, y1 = ys.min(), ys.max() + 1; fig = y1 - y0
    top = next(y for y in range(y0, y1) if run(al[y]) > 0.07 * fig)
    fx = np.nonzero(al[y1 - int(0.04 * fig):y1].any(0))[0]
    return dict(top=top, bot=y1, foot=(fx.min() + fx.max()) / 2, box=(xs.min(), y0, xs.max() + 1, y1))
src, ref, out = sys.argv[1:4]
A = remove_magenta(np.array(Image.open(os.path.join(H0, src)).convert('RGB')))
a = A[..., 3] > 40; lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1))
main = lab == (int(np.argmax(sz)) + 1); near = ndimage.binary_dilation(main, iterations=3)
keep = np.isin(lab, [j + 1 for j in range(n) if (near & (lab == j + 1)).any() and sz[j] > 30]); A[~ndimage.binary_dilation(keep, iterations=2), 3] = 0
R = np.array(Image.open(os.path.join(IMG, ref + '.webp')).convert('RGBA'))
m, r = metrics(A), metrics(R)
s = (r['bot'] - r['top']) / (m['bot'] - m['top'])
x0, y0, x1, y1 = m['box']
crop = Image.fromarray(A[y0:y1, x0:x1]).resize((round((x1 - x0) * s), round((y1 - y0) * s)), Image.LANCZOS)
can = Image.new('RGBA', (R.shape[1], R.shape[0]), (0, 0, 0, 0))
can.paste(crop, (round(r['foot'] - (m['foot'] - x0) * s), round(r['bot'] - crop.height)), crop)
can.save(os.path.join(IMG, out + '.webp'), 'WEBP', quality=92)
print(out, 'ölçek', round(s, 3), 'tuval', can.size)

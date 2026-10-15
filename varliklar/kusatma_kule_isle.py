"""Güneş Kuşatma Kulesi (15 Eki, Gemini): ham/nm_kusatma_kule.jpg → img/enemy_siegetower.webp (durağan, Veo gelene dek).
Magenta silinir, kuleden kopuk tek bayrak (sol üst) atılır. Eski yürüme/yıkılma şeritleri (eski kule) anim.json'dan çıkar,
dosyaları varliklar/cikti/eski_siegetower/ içine taşınır. Ölçek: iten asker ~325 px, bayrak ucu → tekerlek altı ~960 px
→ oyunda h = 30 (lejyoner) × 960 / 325 ≈ 89.
    .venv/bin/python varliklar/kusatma_kule_isle.py
"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
a = remove_magenta(np.array(Image.open(os.path.join(H0, 'ham', 'nm_kusatma_kule.jpg')).convert('RGB')))
lab, n = nd.label(a[..., 3] > 40, structure=np.ones((3, 3)))
sz = nd.sum(np.ones(lab.shape), lab, range(1, n + 1)); main = int(np.argmax(sz)) + 1
ys, xs = np.nonzero(lab == main); x0, x1 = xs.min() - 40, xs.max() + 40
keep = [i + 1 for i in range(n) if sz[i] > 60 and ((lambda p: p[1].min() >= x0 and p[1].max() <= x1)(np.nonzero(lab == i + 1)))]
a[..., 3] = np.where(np.isin(lab, keep), a[..., 3], 0)
ys, xs = np.nonzero(a[..., 3] > 30); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
print('kırpım', a.shape, 'parça', len(keep))
st = Image.fromarray(a); st = st.resize((int(st.width * 420 / st.height), 420), Image.LANCZOS)
st.save(os.path.join(IMG, 'enemy_siegetower.webp'), 'WEBP', quality=88, method=6)
mp = os.path.join(IMG, 'meta.json'); mt = json.load(open(mp)); mt['enemy_siegetower'] = [st.width, st.height]; json.dump(mt, open(mp, 'w'), indent=0)
ap = os.path.join(IMG, 'anim.json'); am = json.load(open(ap)); manp = os.path.join(IMG, 'manifest.json'); man = json.load(open(manp))
old = os.path.join(H0, 'cikti', 'eski_siegetower'); os.makedirs(old, exist_ok=True)
for k in ('enemy_siegetower_walk', 'enemy_siegetower_die'):
    am.pop(k, None)
    if k + '.webp' in man: man.remove(k + '.webp')
    f = os.path.join(IMG, k + '.webp')
    if os.path.exists(f): shutil.move(f, os.path.join(old, k + '.webp'))
json.dump(am, open(ap, 'w'), indent=1); json.dump(sorted(man), open(manp, 'w'), indent=0)
print('enemy_siegetower', st.size)

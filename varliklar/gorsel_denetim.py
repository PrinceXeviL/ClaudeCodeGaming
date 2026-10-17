"""Yayın öncesi görsel denetimi (18 Eki, Caner: "sonraki durumlarda önüne geçmek için ne gerekiyorsa uygula"). gonder.sh değişen görsellerle çağırır.
Animasyon şeridi ise serit_denetim, durağan görsel ise kenar_denetim ölçüsü; sınırı aşanlar UYARI olarak yazılır (yayını durdurmaz).
    .venv/bin/python3 varliklar/gorsel_denetim.py ad1 ad2 ...   (uzantısız img/ adları)"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kenar_denetim import olc, IMG
from serit_denetim import frames, A
from kenar_temizle import MOR
SINIR = {'pembe': 1.0, 'beyaz': 12.0, 'kirinti': 2.0}  # beyaz: açık mor alev, kemik kenarı gibi bilerek açık kenarlar yanlış uyarı vermesin
bad = 0
for n in sys.argv[1:]:
    p = os.path.join(IMG, n + '.webp')
    if not os.path.exists(p) or n.startswith(('atlas_', 'map_', 'ico_')): continue
    if n in A:
        r = frames(n)
        if not r: continue
        ms = [olc(f) for f in r[0][::max(1, len(r[0]) // 8)]]
    else:
        a = np.asarray(Image.open(p).convert('RGBA'))
        if a[..., 3].min() > 250: continue
        ms = [olc(a)]
    pe = np.mean([m[0] for m in ms]) * 100; be = np.mean([m[1] for m in ms]) * 100; ki = np.mean([m[2] for m in ms])
    if n.startswith(MOR): pe = 0
    w = [f'{k} {v:.1f}' for k, v in (('pembe%', pe), ('beyaz%', be), ('kırıntı', ki)) if v > SINIR[{'pembe%': 'pembe', 'beyaz%': 'beyaz', 'kırıntı': 'kirinti'}[k]]]
    if w: bad += 1; print('UYARI görsel kenarı:', n, ', '.join(w), '→ varliklar/serit_temizle.py' if n in A else '→ varliklar/kenar_temizle.py')
print('görsel denetimi:', len(sys.argv) - 1, 'görsel,', bad, 'uyarı')

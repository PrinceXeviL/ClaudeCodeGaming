"""Kale v5 hasar evreleri (18 Eki): ham/nm_kale_v5_hasar<N>.jpg (Gemini, beyaz zemin, sağlam kaleyle aynı kadraj) -> img/castle_keep_<N>.webp.
Beyaz zemin kale_v5_isle.beyaz_sil ile silinir; sağlam kaleye (img/castle_keep_1.webp) bütün görselle hizalanır (ölçek + konum aranır) ki
KEEP noktaları (kapı, balkon, Mortimer) bütün evrelerde aynı yere düşsün. Eski evre görselleri cikti/kale_v4/ yedekte.
    .venv/bin/python3 varliklar/kale_v5_hasar_isle.py 2 [--yaz]"""
import os, sys, re
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); OUT = os.path.join(D, 'cikti', 'kale_v5')
src = open(os.path.join(D, 'kale_v5_isle.py')).read(); ns = {'__file__': os.path.join(D, 'kale_v5_isle.py')}
exec(src[src.index('import os'):src.index('new = beyaz_sil(')], ns)  # yalnız işlevler (betik kısmı çalışmasın)
beyaz_sil, gri = ns['beyaz_sil'], ns['gri']
N = int(sys.argv[1]); new = beyaz_sil(np.asarray(Image.open(os.path.join(D, 'ham', f'nm_kale_v5_hasar{N}.jpg')).convert('RGB')))
ref = np.asarray(Image.open(os.path.join(IMG, 'castle_keep_1.webp')).convert('RGBA'))
rg, ra = gri(ref, 0.25)
best = None
for s in np.linspace(0.25, 0.6, 71):
    ng, na = gri(new, s * 0.25)
    if ng.shape[0] < rg.shape[0] * 0.8: continue
    H, Wd = rg.shape
    for dy in range(-40, 41, 1):
        for dx in range(-40, 41, 1):
            # yeni görsel ref tuvaline (dx, dy) kaydırılarak konur: örtüşen alfa farkı (siluet) + gri fark
            y0, x0 = max(0, dy), max(0, dx); y1, x1 = min(H, dy + ng.shape[0]), min(Wd, dx + ng.shape[1])
            if y1 - y0 < H * 0.7 or x1 - x0 < Wd * 0.7: continue
            pa = np.zeros_like(ra); pa[y0:y1, x0:x1] = na[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
            e = np.abs(pa - ra).mean()
            if best is None or e < best[0]: best = (e, s, dx * 4, dy * 4)
print('hizalama fark %.4f ölçek %.4f konum %d %d' % best)
_, s, dx, dy = best
im = Image.fromarray(new); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
c = Image.new('RGBA', (ref.shape[1], ref.shape[0])); c.alpha_composite(im, (dx, dy)) if dx >= 0 and dy >= 0 else c.paste(im, (dx, dy), im)
os.makedirs(OUT, exist_ok=True); c.save(os.path.join(OUT, f'castle_keep_{N}.webp'), 'WEBP', quality=90, method=6)
k = Image.new('RGBA', (ref.shape[1] * 2, ref.shape[0]), (90, 110, 70, 255)); k.alpha_composite(Image.fromarray(ref), (0, 0)); k.alpha_composite(c, (ref.shape[1], 0))
o = Image.fromarray(ref).copy(); o.putalpha(Image.fromarray((ref[..., 3] * 0.5).astype(np.uint8))); k2 = c.copy(); k2.alpha_composite(o)
k.convert('RGB').save(os.path.join(OUT, f'karsilastir_{N}.jpg'), quality=88); k2.convert('RGB').save(os.path.join(OUT, f'ust_uste_{N}.jpg'), quality=88)
if '--yaz' in sys.argv: c.save(os.path.join(IMG, f'castle_keep_{N}.webp'), 'WEBP', quality=90, method=6); print('img/ yazıldı')

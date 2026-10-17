"""Kale v5 (17 Eki, Caner: "üst kısmı iyi de alt kısmı tasarım olarak kötü"): v4'ün üst kısmı aynı, alt kısım kesme taş temel + kapı.
ham/nm_kale_v5.jpg (beyaz zemin) -> beyaz kenardan taşma doldurmayla silinir; v4 görseline üst kısımdan hizalanır (KEEP noktaları geçerli kalsın).
    .venv/bin/python3 varliklar/kale_v5_isle.py [--yaz]   (--yaz: img/castle_keep_1.webp üstüne; eskisi cikti/kale_v4/ yedekte)"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
OUT = os.path.join(D, 'cikti', 'kale_v5'); os.makedirs(OUT, exist_ok=True)


def beyaz_sil(a):
    """kenara bağlı beyazımsı zemin saydam; sınırda beyazlık oranıyla yumuşak alfa ve beyaz karışımın geri çözülmesi"""
    f = a.astype(np.float32); mn, mx = f.min(2), f.max(2)
    bg = (mn > 225) & (mx - mn < 22)
    lab, _ = nd.label(bg); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
    bg = np.isin(lab, edge)
    # korkuluk/çit aralarında kapalı kalan beyaz delikler (kenara bağlı değil): daha katı eşikle, 30 px üstü
    hole = (mn > 236) & (mx - mn < 14) & ~bg; lab2, n2 = nd.label(hole)
    if n2: sz2 = nd.sum(np.ones_like(lab2), lab2, range(1, n2 + 1)); bg |= np.isin(lab2, 1 + np.where(sz2 >= 30)[0])
    near = nd.binary_dilation(bg, iterations=3) & ~bg
    # sınır pikseli: beyaza ne kadar yakınsa o kadar saydam (en koyu kanala göre)
    w = np.clip((mn - 120) / (250 - 120), 0, 1)
    al = np.ones(mn.shape, np.float32); al[bg] = 0; al[near] = 1 - w[near]
    al = np.where(al < 0.08, 0, al)
    # beyaz karışımını çöz: c = al*fg + (1-al)*255 -> fg
    k = np.maximum(al, 0.05)[..., None]; fg = ((f - (1 - k) * 255) / k).clip(0, 255)
    out = np.dstack([np.where(near[..., None], fg, f), al * 255]).astype(np.uint8)
    lab, n = nd.label(out[..., 3] > 40); sz = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.where(sz >= sz.max() * 0.002)[0]); out[~nd.binary_dilation(keep, iterations=2), 3] = 0
    return out


def gri(rgba, s):
    im = Image.fromarray(rgba); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32); return a[..., :3].mean(2) * (a[..., 3] / 255), a[..., 3] / 255


new = beyaz_sil(np.asarray(Image.open(os.path.join(D, 'ham', 'nm_kale_v5.jpg')).convert('RGB')))
old = np.asarray(Image.open(os.path.join(D, 'cikti', 'kale_v4', 'castle_keep_1.webp')).convert('RGBA'))
og, _ = gri(old, 0.25); top = og[: int(og.shape[0] * 0.5)]  # eski görselin üst yarısı (ev + çatılar + teras başı)
best = None
for s in np.linspace(0.30, 0.55, 51):
    ng, _ = gri(new, s * 0.25)
    if ng.shape[0] < top.shape[0] or ng.shape[1] < top.shape[1]: continue
    from numpy.lib.stride_tricks import sliding_window_view as sw
    t = top - top.mean()
    # kaba arama: 2 px adım
    best_s = None
    for dy in range(0, ng.shape[0] - top.shape[0] + 1, 2):
        for dx in range(0, ng.shape[1] - top.shape[1] + 1, 2):
            p = ng[dy:dy + top.shape[0], dx:dx + top.shape[1]]; e = np.abs(p - p.mean() - t).mean()
            if best_s is None or e < best_s[0]: best_s = (e, dx, dy)
    if best is None or best_s[0] < best[0]: best = (best_s[0], s, best_s[1] * 4, best_s[2] * 4)
print('hizalama fark %.2f ölçek %.4f konum %d %d' % best)
_, s, dx, dy = best
im = Image.fromarray(new); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
# eski tuvale (760 genişlik) aynı yerden kes; alt kısım taşarsa tuval aşağı uzar
H = old.shape[0]  # eski tuvalle aynı (760x1025): yeni temelin zemini de içine sığıyor, KEEP kesirleri geçerli
c = Image.new('RGBA', (old.shape[1], H)); c.alpha_composite(im, (-dx, -dy)) if dx <= 0 and dy <= 0 else c.paste(im.crop((dx, dy, dx + old.shape[1], dy + H)), (0, 0))
print('boyut', c.size, 'eski', old.shape[1::-1])
c.save(os.path.join(OUT, 'castle_keep_1.webp'), 'WEBP', quality=90, method=6)
k = Image.new('RGBA', (old.shape[1] * 2, H), (90, 110, 70, 255)); k.alpha_composite(Image.fromarray(old), (0, 0)); k.alpha_composite(c, (old.shape[1], 0))
k.convert('RGB').save(os.path.join(OUT, 'karsilastir.jpg'), quality=88)
if '--yaz' in sys.argv:
    c.save(os.path.join(IMG, 'castle_keep_1.webp'), 'WEBP', quality=90, method=6)
    print('img/ yazıldı')

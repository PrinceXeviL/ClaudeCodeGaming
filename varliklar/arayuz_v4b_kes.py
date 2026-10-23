"""24 Eki: Gemini arayüz seti 2. parça (varliklar/ham/arayuz_v4b.jpg, magenta zemin) → sinir-kalesi/img/ui_k_*.webp (atlas: ui_ öneki).
Parçalar: boş yuvarlak düğmeler (6 renk), portre kartı (normal/seçili), kare karo (normal/seçili/kilitli), kaynak plakası, liste satırı.
    .venv/bin/python3 varliklar/arayuz_v4b_kes.py   (sonra: varliklar/atlas_kur.py)"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from anim_isle import remove_magenta
SRC = os.path.join(H, 'ham', 'arayuz_v4b.jpg'); IMG = os.path.join(H, '..', 'sinir-kalesi', 'img')
rgb = np.asarray(Image.open(SRC).convert('RGB'))
# x, y, w, h (kaynak pikseli; bileşen kutuları, kesimde 8 px pay)
BOX = {
  'rb_red': (72, 65, 381, 376), 'rb_green': (518, 65, 381, 377), 'rb_purple': (963, 65, 382, 381),
  'rb_blue': (1410, 65, 381, 383), 'rb_gold': (1856, 65, 381, 379), 'rb_gray': (2302, 65, 381, 377),
  'port': (77, 492, 715, 972), 'port_sel': (830, 466, 766, 1025),
  'tile': (1628, 530, 329, 341), 'tile_sel': (1963, 503, 384, 387), 'tile_lock': (2356, 530, 328, 341),
  'plate': (1789, 937, 714, 258), 'row': (1625, 1275, 1062, 181),
}
GLOW = ('port_sel', 'tile_sel')
meta = {}
for name, (x, y, w, h) in BOX.items():
    P = 8; x, y, w, h = max(0, x - P), max(0, y - P), w + 2 * P, h + 2 * P
    crop = rgb[y:y + h, x:x + w]
    rgba = remove_magenta(crop)
    # iç kısım tam opak, kaynak renginde (magenta silme mor/kızıl yüzeyleri yarı saydam yapabiliyor)
    solid = ndimage.binary_fill_holes(rgba[..., 3] > 100)
    if name in GLOW: solid = ndimage.binary_fill_holes(rgba[..., 3] > 235)
    inner = ndimage.binary_erosion(solid, iterations=4)
    rgba[..., :3] = np.where(inner[..., None], crop, rgba[..., :3]); rgba[..., 3] = np.where(inner, 255, rgba[..., 3])
    if name in GLOW:  # dış ışıltı: yarı saydam pikseller tek renk yeşil ışık
        soft = (rgba[..., 3] < 235) & ~inner
        rgba[..., 0] = np.where(soft, 110, rgba[..., 0]); rgba[..., 1] = np.where(soft, 255, rgba[..., 1]); rgba[..., 2] = np.where(soft, 130, rgba[..., 2])
    else:  # kenarda kalan pembe saçak: koyu kontur rengi
        f = rgba.astype(np.int16); pink = (rgba[..., 3] < 245) & (((f[..., 0] + f[..., 2]) // 2 - f[..., 1]) > 30) & ~inner
        for ch, v in ((0, 22), (1, 12), (2, 20)): rgba[..., ch] = np.where(pink, v, rgba[..., ch])
    a = rgba[..., 3]; lab, n = ndimage.label(a > 100)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1)); keep = sizes >= sizes.max() * 0.05
        m = ndimage.binary_dilation(np.isin(lab, np.where(keep)[0] + 1), iterations=3); rgba[..., 3] = np.where(m, a, 0)
    ys, xs = np.where(rgba[..., 3] > 8); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(rgba)
    if name.startswith('rb_'): im = im.resize((180, round(180 * im.height / im.width)), Image.LANCZOS)  # düğmeler en çok ~70 px çizilir
    elif name.startswith('port'): im = im.resize((360, round(360 * im.height / im.width)), Image.LANCZOS)
    else: im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(os.path.join(IMG, f'ui_k_{name}.webp'), lossless=False, quality=92)
    meta[name] = [im.width, im.height]; print(name, im.width, im.height)
man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for n in BOX:
    k = 'ui_k_' + n + '.webp'
    if k not in man: man.append(k)
json.dump(man, open(man_p, 'w'))
json.dump(meta, open(os.path.join(H, 'ham', 'arayuz_v4b_olcu.json'), 'w'))

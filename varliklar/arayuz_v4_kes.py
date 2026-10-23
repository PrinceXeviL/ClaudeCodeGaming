"""24 Eki: Gemini arayüz seti v4 (varliklar/ham/arayuz_v4.jpg, magenta zemin) → sinir-kalesi/img/ui_k_*.webp (atlas: ui_ öneki).
Parçalar: çerçeve (9 dilim), başlık şeridi, sekme açık/kapalı, yeşil/mor/kızıl düğme, kapat/geri, anahtar kapalı/açık, kaydırıcı yolu + kafatası, bilgi kartı, yıldızlar.
    .venv/bin/python3 varliklar/arayuz_v4_kes.py   (sonra: varliklar/atlas_kur.py)"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from anim_isle import remove_magenta
SRC = os.path.join(H, 'ham', 'arayuz_v4.jpg'); IMG = os.path.join(H, '..', 'sinir-kalesi', 'img')
rgb = np.asarray(Image.open(SRC).convert('RGB'))
# x, y, w, h (kaynak pikseli; magenta payıyla)
BOX = {
  'frame': (48, 47, 1109, 1022), 'banner': (1186, 62, 766, 134),
  'tab_on': (1180, 224, 301, 130), 'tab_off': (1192, 465, 276, 112),
  'btn_green': (1509, 231, 444, 135), 'btn_purple': (1509, 370, 444, 135), 'btn_red': (1510, 509, 443, 136),
  'close': (1181, 710, 142, 149), 'back': (1335, 710, 143, 149),
  'tog_off': (1513, 671, 202, 99), 'tog_on': (1744, 671, 202, 99),
  'slider': (1500, 801, 453, 87), 'card': (1181, 855, 297, 224),
  'star_empty': (1505, 930, 142, 137), 'star_gold': (1649, 925, 151, 150), 'star_green': (1799, 925, 151, 150),
}
meta = {}
for name, (x, y, w, h) in BOX.items():
    crop = rgb[y:y + h, x:x + w]
    rgba = remove_magenta(crop)
    # yarı saydam ışıltıda kalan pembe saçak (yeşil ışıltı magentaya karışmış): kırmızı ve maviyi yeşile indir
    f = rgba.astype(np.float32); al = f[..., 3]; pink = (al < 245) & (((f[..., 0] + f[..., 2]) / 2 - f[..., 1]) > 8)
    for ch in (0, 2): f[..., ch] = np.where(pink, np.minimum(f[..., ch], f[..., 1] * 0.9), f[..., ch])
    if name in ('star_gold', 'star_green', 'tab_on'):  # dış ışıltı: yarı saydam pikseller tek renk yeşil ışık
        soft = al < 215; f[..., 0] = np.where(soft, 110, f[..., 0]); f[..., 1] = np.where(soft, 255, f[..., 1]); f[..., 2] = np.where(soft, 130, f[..., 2])
    if name == 'star_empty':  # boş yıldızın mor saçağı: koyu
        soft = al < 215; f[..., 0] = np.where(soft, 24, f[..., 0]); f[..., 1] = np.where(soft, 10, f[..., 1]); f[..., 2] = np.where(soft, 24, f[..., 2])
    rgba = f.astype(np.uint8)
    a = rgba[..., 3]
    if name not in ('frame',):  # komşu parçadan taşan kırıntıları sil: en büyük bileşen + yakınları
        lab, n = ndimage.label(a > 100)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1)); keep = sizes >= sizes.max() * 0.05
            m = np.isin(lab, np.where(keep)[0] + 1); m = ndimage.binary_dilation(m, iterations=3); rgba[..., 3] = np.where(m, a, 0)
    if name == 'slider':  # kafatası ayrı: kaynakta x 1690-1765
        kx0, kx1 = 1688 - x, 1767 - x
        knob = rgba[:, kx0 + 4:kx1 - 6].copy(); Image.fromarray(knob).save(os.path.join(IMG, 'ui_k_knob.webp'), lossless=False, quality=92)
        track = rgba.copy(); fill = rgba[:, kx0 - 90:kx0 - 10]  # kafatasının altını yolun düz kısmıyla doldur
        reps = int(np.ceil((kx1 - kx0 + 20) / fill.shape[1])) + 1; band = np.concatenate([fill] * reps, 1)[:, :kx1 - kx0 + 20]
        track[:, kx0 - 10:kx1 + 10] = band
        # kafatasının yolun üstüne/altına taşan yerleri saydam (bant zaten yalnız yol yüksekliğinde dolu)
        rgba = track; meta['knob'] = [knob.shape[1], knob.shape[0]]
    ys, xs = np.where(rgba[..., 3] > 8); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba).save(os.path.join(IMG, f'ui_k_{name}.webp'), lossless=False, quality=92)
    meta[name] = [rgba.shape[1], rgba.shape[0]]; print(name, rgba.shape[1], rgba.shape[0])
# süssüz kart (iç kartlar için): üstteki kafatası-kemik süsü, üst kenarın sol düz parçası kaydırılarak örtülür
c = np.asarray(Image.open(os.path.join(IMG, 'ui_k_card.webp')).convert('RGBA')).copy(); ch, cw = c.shape[:2]
top = next(y for y in range(ch) if c[y, 6, 3] > 128 or c[y, cw // 4, 3] > 128)  # kartın asıl üst kenarı (sol kısımda)
seg = c[top:top + 40, 40:100]; x0 = cw // 2 - 70
for xx in range(x0, cw // 2 + 70, seg.shape[1]): w2 = min(seg.shape[1], cw // 2 + 70 - xx); c[top:top + 40, xx:xx + w2] = seg[:, :w2]
c[:top] = 0; c = c[top:]
Image.fromarray(c).save(os.path.join(IMG, 'ui_k_cardp.webp'), lossless=False, quality=92); meta['cardp'] = [c.shape[1], c.shape[0]]; print('cardp', c.shape[1], c.shape[0])
BOX['cardp'] = None
man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for n in list(BOX) + ['knob']:
    k = 'ui_k_' + n + '.webp'
    if k not in man: man.append(k)
json.dump(man, open(man_p, 'w'))
json.dump(meta, open(os.path.join(H, 'ham', 'arayuz_v4_olcu.json'), 'w'))

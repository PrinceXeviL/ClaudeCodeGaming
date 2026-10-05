"""Gemini'de üretilen ham görselleri oyuna hazırlar.

varliklar/ham/*.jpg  →  varliklar/cikti/*.png (+ manifest.json)
- Beyaz arka planı "color-to-alpha" ile siler: arka plana açık renkli piksellerle bağlı bölgeler
  (parıltı, duman) yarı saydam olur, koyu konturun içi tam opak kalır.
- Her sayfadaki nesneleri bağlı bileşenlerle ayırır (yüzen kristal, bayrak gibi küçük parçalar
  en yakın nesneye eklenir).
- Çim dokusunun tekrar periyodunu bulup tek karo keser, temalara göre renk varyantı üretir.

Gerekenler: numpy, scipy, pillow.  Çalıştır: python varliklar/gorsel_isle.py
Sıra: doku_uret.py (yol dokusu) → sprite_uret.py (SVG yedekler) → bu betik (manifesti son yazar).
"""
import json
import os

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
HAM = os.path.join(ROOT, 'varliklar', 'ham')
OUT = os.path.join(ROOT, 'varliklar', 'cikti')  # canlı img/ manifestini ezmesin

# sayfa: (dosya, beklenen nesne sayısı, soldan sağa adlar, ızgara mı)
SHEETS = [
    ('01_okcu.jpg', ['tower_archer_1', 'tower_archer_2', 'tower_archer_3']),
    ('02_kisla.jpg', ['tower_barracks_1', 'tower_barracks_2', 'tower_barracks_3']),
    ('03_buyucu.jpg', ['tower_mage_1', 'tower_mage_2', 'tower_mage_3']),
    ('04_topcu.jpg', ['tower_artillery_1', 'tower_artillery_2', 'tower_artillery_3']),
    ('05_dusman_a.jpg', ['enemy_goblin', 'enemy_wolf', 'enemy_bandit', 'enemy_orc']),
    ('06_dusman_b.jpg', ['enemy_bat', 'enemy_shaman', 'enemy_knight', 'enemy_troll']),
    ('07_dostlar.jpg', ['hero', 'soldier', 'militia']),
    # 3x2 ızgara: üst satır soldan sağa, sonra alt satır
    ('08_dekor.jpg', ['plot', 'tree_1', 'tree_2', 'tree_3', 'rock_1', 'rock_2'], 'grid', 100),
    # kale: sağlam, hasarlı, ağır hasarlı (yoksa oyun kışla sprite'ını yedek kullanır)
    ('14_kale.jpg', ['castle_1', 'castle_2', 'castle_3']),
]
MAX_SIDE = 380  # çıktı sprite'ının en uzun kenarı (px)


def remove_white(rgb, hole_area=1500):
    """RGBA döndürür: arka plana bağlı açık bölgeler color-to-alpha ile saydamlaşır."""
    c = rgb.astype(np.float32)
    minc = c.min(axis=2)
    light = minc > 150
    lab, _ = ndi.label(light, structure=np.ones((3, 3)))
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    soft = np.isin(lab, border[border > 0])
    # kapalı beyaz delikler (ör. ahşap kule iskeletinin arası, yaprak araları): düz ve saf beyaz.
    # Karakter sayfalarında eşik yüksek tutulur ki göz akları silinmesin.
    idx = np.arange(1, lab.max() + 1)
    areas = ndi.sum(np.ones_like(minc), lab, idx)
    means = ndi.mean(minc, lab, idx)
    stds = ndi.standard_deviation(minc, lab, idx)
    holes = idx[(areas > hole_area) & (means > 246) & (stds < 5)]
    soft |= np.isin(lab, holes)

    a = (255.0 - c).max(axis=2) / 255.0
    a = np.clip((a - 0.04) / 0.96 * 1.1, 0, 1)
    alpha = np.where(soft, a, 1.0)
    safe = np.maximum(alpha, 1e-3)[..., None]
    un = 255.0 - (255.0 - c) / safe          # beyazdan arındırılmış renk
    col = np.where(soft[..., None], np.clip(un, 0, 255), c)
    alpha[alpha < 0.03] = 0
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def split(rgba, names, grid=False):
    alpha = rgba[..., 3]
    solid = alpha > 90
    grown = ndi.binary_dilation(solid, iterations=6)
    lab, n = ndi.label(grown, structure=np.ones((3, 3)))
    objs = ndi.find_objects(lab)
    areas = ndi.sum(solid, lab, np.arange(1, n + 1))
    order = np.argsort(-areas)
    k = len(names)
    main = [int(i) + 1 for i in order[:k]]
    groups = {m: [m] for m in main}

    def center(l):
        s = objs[l - 1]
        return ((s[1].start + s[1].stop) / 2, (s[0].start + s[0].stop) / 2)

    for i in order[k:]:
        l = int(i) + 1
        if areas[i] < 40:
            continue
        cx, cy = center(l)
        best = min(main, key=lambda m: _box_dist(objs[m - 1], cx, cy))
        groups[best].append(l)

    items = []
    for m, ls in groups.items():
        ys = [objs[l - 1][0] for l in ls]
        xs = [objs[l - 1][1] for l in ls]
        y0, y1 = min(s.start for s in ys), max(s.stop for s in ys)
        x0, x1 = min(s.start for s in xs), max(s.stop for s in xs)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        items.append((cx, cy, (y0, y1, x0, x1), ls))
    if grid:
        h = rgba.shape[0]
        items.sort(key=lambda it: (it[1] > h / 2, it[0]))
    else:
        items.sort(key=lambda it: it[0])

    out = {}
    for name, (_, _, (y0, y1, x0, x1), ls) in zip(names, items):
        crop = rgba[y0:y1, x0:x1].copy()
        keep = np.isin(lab[y0:y1, x0:x1], ls)
        crop[..., 3] = np.where(keep, crop[..., 3], 0)
        out[name] = trim(crop)
    return out


def _box_dist(s, x, y):
    dx = max(s[1].start - x, 0, x - s[1].stop)
    dy = max(s[0].start - y, 0, y - s[0].stop)
    return dx * dx + dy * dy


def trim(rgba, pad=4):
    ys, xs = np.where(rgba[..., 3] > 8)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


META = {}  # ad -> [kaynak genişlik, kaynak yükseklik]: aynı sayfadaki nesnelerin göreli boyu korunur


def save_sprite(name, rgba):
    im = Image.fromarray(rgba, 'RGBA')
    # taban ortası: alt %8'lik bandın opak piksellerinin x ortalaması (duman/bayrak taşsa da hizalama tabana göre)
    al = rgba[..., 3]
    band = al[int(al.shape[0] * 0.92):] > 128
    xs = np.where(band.any(axis=0))[0]
    base_cx = float((xs.min() + xs.max()) / 2 / al.shape[1]) if len(xs) else 0.5
    META[name] = [im.width, im.height, round(base_cx, 3)]
    s = MAX_SIDE / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    return im.size


def grass_tiles():
    src = Image.open(os.path.join(HAM, '09_cim.jpg')).convert('RGB')
    g = np.asarray(src.convert('L')).astype(np.float32)
    h, w = g.shape

    def period(axis):
        best, bp = 1e9, None
        for p in range(int(w * 0.35), int(w * 0.65)):
            a = g[:, :w - p] if axis == 1 else g[:h - p, :]
            b = g[:, p:] if axis == 1 else g[p:, :]
            d = np.abs(a - b).mean()
            if d < best:
                best, bp = d, p
        return bp, best

    px, ex = period(1)
    py, ey = period(0)
    tile = src.crop((0, 0, px, py)) if ex < 12 and ey < 12 else src
    tile = tile.resize((512, 512), Image.LANCZOS)
    variants = {
        'grass_meadow': (1.06, 1.08, (1.0, 1.04, 0.92)),
        'grass_forest': (0.78, 1.0, (0.9, 1.0, 0.95)),
        'grass_rocky': (1.02, 0.7, (1.08, 1.04, 0.86)),
    }
    for name, (bright, sat, mul) in variants.items():
        im = ImageEnhance.Color(ImageEnhance.Brightness(tile).enhance(bright)).enhance(sat)
        arr = np.asarray(im).astype(np.float32) * np.array(mul)
        Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + '.png'), optimize=True)
    return (px, py, round(ex, 1), round(ey, 1))


def title():
    im = Image.open(os.path.join(HAM, '13_baslik.jpg')).convert('RGB')
    a = np.asarray(im).astype(int)
    ys, xs = np.where(a.min(axis=2) < 240)
    im = im.crop((xs.min() + 16, ys.min() + 16, xs.max() - 16, ys.max() - 16))
    im = im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, 'title_bg.jpg'), quality=84)
    return im.size


def write_manifest():
    files = os.listdir(OUT)
    by_name = {}
    for f in files:
        base, ext = os.path.splitext(f)
        if ext not in ('.png', '.jpg', '.svg'):
            continue
        # raster sürüm varsa SVG yedeğin önüne geçer
        if base not in by_name or ext != '.svg':
            by_name[base] = f
    with open(os.path.join(OUT, 'manifest.json'), 'w') as fh:
        json.dump(sorted(by_name.values()), fh, indent=0)
    return len(by_name)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for sheet in SHEETS:
        fname, names = sheet[0], sheet[1]
        if not os.path.exists(os.path.join(HAM, fname)):
            print(fname, 'yok, atlandı')
            continue
        grid = len(sheet) > 2 and sheet[2] == 'grid'
        hole_area = sheet[3] if len(sheet) > 3 else 1500
        rgb = np.asarray(Image.open(os.path.join(HAM, fname)).convert('RGB'))
        parts = split(remove_white(rgb, hole_area), names, grid)
        print(fname, {k: save_sprite(k, v) for k, v in parts.items()})
    print('çim periyodu', grass_tiles())
    print('başlık', title())
    with open(os.path.join(OUT, 'meta.json'), 'w') as fh:
        json.dump(META, fh)
    print('manifest', write_manifest(), 'dosya')

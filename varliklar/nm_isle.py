"""Don't Mess with the Necromancer: Gemini sayfalarını (magenta zemin) oyun görsellerine çevirir.

    python3 varliklar/nm_isle.py

Her sayfada nesneler bağlı bileşenlerle bulunur (yakın parçalar birleşir), soldan sağa (dekor: satır satır) adlandırılır,
sinir-kalesi/img/ içine PNG yazılır, manifest.json ve meta.json güncellenir. Ad None ise o nesne atılır.
"""
import json, os, sys
import numpy as np
from PIL import Image
from anim_isle import remove_magenta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAM = os.path.join(ROOT, 'varliklar', 'ham')
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
UNIT_H = 380      # birim görsellerinin boyu (px)
TOWER_BASE = 0.13  # kule: arsa merkezinin görselin altından uzaklığı (genişlik oranı)

# sayfa, adlar (sıralı), tür, ek
SHEETS = [
    ('nm_kule.jpg', ['castle_1', 'castle_2', 'castle_3'], 'castle'),
    ('nm_mahzen.jpg', ['tower_barracks_1', 'tower_barracks_2', 'tower_barracks_3'], 'tower'),
    ('nm_dikilitas.jpg', ['tower_archer_1', 'tower_archer_2', 'tower_archer_3'], 'tower'),  # 8 Eki: okçu yerine Kemik Dikilitaşı
    ('nm_fener.jpg', ['tower_mage_1', 'tower_mage_2', 'tower_mage_3'], 'tower'),  # Ruh Feneri
    ('nm_kazan.jpg', ['tower_artillery_1', 'tower_artillery_2', 'tower_artillery_3'], 'tower'),  # Veba Kazanı
    ('nm_sunak.jpg', ['tower_altar_1', 'tower_altar_2', 'tower_altar_3'], 'tower'),  # Kan Sunağı (yeni kule)
    ('nm_iskeletler.jpg', ['unit_skel_1', 'unit_skel_2', 'unit_skel_3', 'unit_skel_4', 'unit_skel_5'], 'unit'),
    ('nm_dusman_1.jpg', ['enemy_legion', 'enemy_solarcher', 'enemy_gladiator', 'enemy_assassin'], 'unit'),
    ('nm_dusman_2.jpg', ['enemy_heavy', 'enemy_cavalry', 'enemy_priest', 'enemy_gloriosus'], 'unit'),
    ('nm_kusatma.jpg', ['enemy_ram', 'enemy_catapult'], 'unit'),
    ('nm_komutanlar.jpg', ['hero_vladrik', None, None, None], 'unit'),  # eski Mortimer (4.) artık kullanılmıyor
    ('nm_mortimer.jpg', ['mortimer', None], 'unit'),  # azrail Mortimer: önden görünüş (balkondan ekrana/aşağı bakar)
    ('nm_banshee.jpg', ['hero_wren'], 'unit'),
    ('nm_dekor.jpg', ['nm_tree_1', 'nm_tree_2', 'nm_tree_3', 'nm_tree_4',
                      'nm_tomb_1', 'nm_tomb_2', 'nm_tomb_3', 'nm_bones', 'nm_shroom', 'nm_bush',
                      'nm_rock_1', 'nm_rock_2', 'nm_pond', 'nm_fence', 'nm_crow'], 'decor'),
]
FLIP = {'enemy_ram'}  # sola bakan görseller aynalanır
# komşu nesneden taşan parçalar: kaynak sayfada silinecek dikdörtgenler (x0, y0, x1, y1)
ERASE = {
    'enemy_priest': [(0, 0, 1070, 1116), (1330, 0, 2000, 592), (1475, 0, 2000, 1116)],
    'enemy_gloriosus': [(0, 0, 1330, 1116), (1330, 596, 1478, 745)],
    'hero_vladrik': [(522, 230, 800, 600)],
    'mortimer': [(0, 760, 400, 1116), (800, 700, 1000, 1116)],  # eteğin iki yanına savrulan duman (görseli genişletiyor)
}


def shift_or(m, r):
    out = m.copy()
    for _ in range(r):
        o = out.copy()
        o[1:] |= out[:-1]; o[:-1] |= out[1:]; o[:, 1:] |= out[:, :-1]; o[:, :-1] |= out[:, 1:]
        out = o
    return out


def label(m):
    H, W = m.shape
    lab = np.zeros((H, W), np.int32); n = 0
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]: continue
        n += 1; st = [(y0, x0)]; lab[y0, x0] = n
        while st:
            y, x = st.pop()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
    return lab, n


def objects(rgba, count, rows=False, merge=2, attach=25):
    """En büyük `count` nesne: düşük çözünürlüklü maskede bileşenler bulunur; kopuk küçük parçalar (kılıç ucu, alev)
    kutusuna en yakın büyük nesneye katılır."""
    F = 4
    a = rgba[..., 3]
    H, W = a.shape
    small = a[:H - H % F, :W - W % F].reshape(H // F, F, W // F, F).max(axis=(1, 3)) > 100
    lab, n = label(shift_or(small, merge))
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    order = list(np.argsort(-sizes[1:])[:count] + 1)
    boxes = {}
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        boxes[k] = [xs.min(), xs.max(), ys.min(), ys.max(), xs.mean(), ys.mean()]
    for k in range(1, n + 1):
        if k in order or sizes[k] < 6: continue
        bx = boxes[k]
        def gap(o):
            b = boxes[o]; dx = max(b[0] - bx[1], bx[0] - b[1], 0); dy = max(b[2] - bx[3], bx[2] - b[3], 0)
            return dx + dy
        best = min(order, key=gap)
        if gap(best) < attach:
            lab[lab == k] = best
            b = boxes[best]; boxes[best] = [min(b[0], bx[0]), max(b[1], bx[1]), min(b[2], bx[2]), max(b[3], bx[3]), b[4], b[5]]
        else:
            lab[lab == k] = 0
    objs = [{'k': k, 'x0': boxes[k][0] * F, 'x1': (boxes[k][1] + 1) * F, 'y0': boxes[k][2] * F, 'y1': (boxes[k][3] + 1) * F,
             'cx': boxes[k][4] * F, 'cy': boxes[k][5] * F} for k in order]
    if rows:
        # satırlara ayır: üst kenarı bir öncekinden belirgin aşağıdaysa yeni satır
        objs.sort(key=lambda o: o['y1'])
        groups, cur = [], [objs[0]]
        for o in objs[1:]:
            if o['y1'] - cur[0]['y1'] > 140: groups.append(cur); cur = [o]
            else: cur.append(o)
        groups.append(cur)
        objs = [o for g in groups for o in sorted(g, key=lambda o: o['cx'])]
    else:
        objs.sort(key=lambda o: o['cx'])
    big = np.kron(lab, np.ones((F, F), np.int32))
    big = np.pad(big, ((0, H - big.shape[0]), (0, W - big.shape[1])))
    return objs, big


def column_split(rgba, count):
    """Tek sıralı sayfa: sütun yoğunluğunun en düşük olduğu yerlerden dikey kesilir (silahı değen karakterler için)."""
    a = (rgba[..., 3] > 100).sum(0).astype(float)
    W = len(a)
    k = np.ones(15) / 15
    sm = np.convolve(a, k, mode='same')
    xs = np.nonzero(a > 2)[0]
    left, right = xs.min(), xs.max()
    span = (right - left) / count
    cuts = [left]
    for i in range(1, count):
        c = left + span * i
        lo, hi = int(c - span * 0.4), int(c + span * 0.4)
        cuts.append(lo + int(np.argmin(sm[lo:hi])))
    cuts.append(right + 1)
    return cuts


def crop(rgba, o, big):
    pad = 6
    y0, y1, x0, x1 = max(0, o['y0'] - pad), min(rgba.shape[0], o['y1'] + pad), max(0, o['x0'] - pad), min(rgba.shape[1], o['x1'] + pad)
    c = rgba[y0:y1, x0:x1].copy()
    other = (big[y0:y1, x0:x1] != 0) & (big[y0:y1, x0:x1] != o['k'])
    c[..., 3] = np.where(other, 0, c[..., 3])
    ys, xs = np.nonzero(c[..., 3] > 8)
    return c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main():
    man_p, meta_p = os.path.join(IMG, 'manifest.json'), os.path.join(IMG, 'meta.json')
    man, meta = set(json.load(open(man_p))), json.load(open(meta_p))
    only = set(sys.argv[1:])  # ör. `nm_isle.py nm_mortimer.jpg`: yalnız bu sayfalar (diğer çıktılar elle düzeltilmiş olabilir)
    for fname, names, kind in SHEETS:
        if only and fname not in only: continue
        rgba = remove_magenta(np.asarray(Image.open(os.path.join(HAM, fname)).convert('RGB')))
        if kind == 'decor':
            objs, big = objects(rgba, len(names), rows=True)
        else:
            # sütunlar sadece sahipliği belirler: her şeridin en çok pikselini tutan bileşen o nesnedir (şeridi aşsa da bütün alınır);
            # sahipsiz küçük parçalar merkezlerinin düştüğü şeridin nesnesine, yakınsa katılır
            cuts = column_split(rgba, len(names)); F = 4
            al = rgba[..., 3]; H, W = al.shape
            small = al[:H - H % F, :W - W % F].reshape(H // F, F, W // F, F).max(axis=(1, 3)) > 100
            lab, n = label(small)
            owners = []
            for i in range(len(names)):
                seg = lab[:, cuts[i] // F:cuts[i + 1] // F]
                cnt = np.bincount(seg.ravel(), minlength=n + 1); cnt[0] = 0
                owners.append(int(np.argmax(cnt)))
            # birbirine değen karakterler tek bileşen olur: o bileşen her şeritte şerit sınırından kesilir
            for i, ow in enumerate(owners):
                if owners.count(ow) > 1:
                    nid = n + 1 + i
                    sl = lab[:, cuts[i] // F:cuts[i + 1] // F]; sl[sl == ow] = nid
                    owners[i] = nid
            for i, ow in enumerate(owners):
                if ow <= n and np.any(np.array(owners) > n):
                    pass
            n2 = lab.max()
            sizes = np.bincount(lab.ravel(), minlength=n2 + 1)
            for k in range(1, n + 1):
                if k in owners or sizes[k] < 4: continue
                ys, xs = np.nonzero(lab == k)
                i = min(len(names) - 1, max(0, int(np.searchsorted(cuts, xs.mean() * F) - 1)))
                ow = owners[i]
                oy, ox = np.nonzero(lab == ow)
                gap = max(ox.min() - xs.max(), xs.min() - ox.max(), 0) + max(oy.min() - ys.max(), ys.min() - oy.max(), 0)
                lab[lab == k] = ow if gap < 8 and sizes[k] < sizes[ow] * 0.3 else 0
            objs = []
            for i, ow in enumerate(owners):
                ys, xs = np.nonzero(lab == ow)
                objs.append({'k': ow, 'x0': xs.min() * F, 'x1': (xs.max() + 1) * F, 'y0': ys.min() * F, 'y1': (ys.max() + 1) * F})
            big = np.kron(lab, np.ones((F, F), np.int32)); big = np.pad(big, ((0, H - big.shape[0]), (0, W - big.shape[1])))
        for o, name in zip(objs, names):
            if not name: continue
            src = rgba
            if name in ERASE:
                src = rgba.copy()
                for x0, y0, x1, y1 in ERASE[name]: src[y0:y1, x0:x1, 3] = 0
            im = Image.fromarray(crop(src, o, big))
            if name in FLIP: im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if kind == 'unit' and im.height > UNIT_H * 1.05:
                k = UNIT_H / im.height
                if name in ('enemy_gloriosus', 'enemy_cavalry', 'enemy_ram', 'enemy_catapult'): k *= 1.35  # büyükler daha çok çözünürlük
                im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            elif im.width > 700:
                k = 700 / im.width; im = im.resize((700, round(im.height * k)), Image.LANCZOS)
            im.save(os.path.join(IMG, name + '.png'), optimize=True)
            entry = [im.width, im.height]
            if kind == 'tower': entry.append(TOWER_BASE)
            meta[name] = entry; man.add(name + '.png')
            print(fname, '->', name, im.size)
    # zemin ve yol dokuları
    if only:
        json.dump(sorted(man), open(man_p, 'w'), indent=0); json.dump(meta, open(meta_p, 'w')); return
    g = Image.open(os.path.join(HAM, 'nm_zemin.jpg')).convert('RGB').resize((720, 720), Image.LANCZOS)
    g.save(os.path.join(IMG, 'grass_cursed.jpg'), quality=86); man.add('grass_cursed.jpg')
    r = Image.open(os.path.join(HAM, 'nm_yol.jpg')).convert('RGB').resize((720, 720), Image.LANCZOS)
    r.save(os.path.join(IMG, 'road_cursed.jpg'), quality=86); man.add('road_cursed.jpg')
    # eski okçu kulesi ön katmanı yeni kulelerle uyuşmaz
    for k in ('tower_archer_1_front.webp', 'tower_archer_2_front.webp', 'tower_archer_3_front.webp'): man.discard(k)
    json.dump(sorted(man), open(man_p, 'w'), indent=0)
    json.dump(meta, open(meta_p, 'w'))
    print('manifest', len(man))


if __name__ == '__main__':
    main()

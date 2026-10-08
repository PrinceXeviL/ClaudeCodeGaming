"""Gemini animasyon sayfasını (magenta zemin, sütun x satır kare) oyuna hazırlar.

    python3 varliklar/anim_isle.py ham/anim/ork_yuru.jpg enemy_orc_walk 4 2
    python3 varliklar/anim_isle.py ham/anim/lejyoner_saldiri.jpg enemy_legion_atk 4 2 --auto --anchor heel

--auto: ızgara yerine bağlı parçalara göre ayırır (mızrak/kılıç komşu kareye taşsa da karakterle birlikte kalır; scipy gerekir).
--norm: her kareyi ortanca boya ölçekler (satırlar farklı büyüklükte çizildiyse).
--order 1,2,3,4,1,2,3,4: kareleri bu sırayla şeride yazar (bozuk kareleri atlamak / yarım döngüyü tekrarlamak için).
--anchor: kareleri hizalama noktası. body (varsayılan): gövdenin üst yarısının ortası; head: başın (miğfer/sorguç) ortası,
  yürüyüşte en sabit nokta; heel: arka topuk (en alt satırların en geri noktası), saldırıda yerinde duran arka ayak.

- Magenta zemin silinir, kenardaki pembe taşma temizlenir.
- Her kare ayrılır; ayakların en alt noktası ortak zemin çizgisine, gövdenin (üst yarının) ortası kare ortasına hizalanır
  (bacaklar açılıp kapandıkça karakter sağa sola kaymasın).
- Çıktı: sinir-kalesi/img/<ad>.webp (kareler yan yana tek şerit), img/anim.json'a kare bilgisi, manifest'e dosya adı eklenir.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
TARGET_H = 380  # karakter boyu (piksel): mevcut görsellerle aynı ölçek


def remove_magenta(rgb):
    a = rgb.astype(np.float32)
    H, W = a.shape[:2]
    corners = np.array([a[5, 5], a[5, W - 6], a[H - 6, 5], a[H - 6, W - 6], a[5, W // 2]])
    bgc = corners.mean(0)
    bm = (bgc[0] + bgc[2]) / 2 - bgc[1]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r + b) / 2 - g
    hue = np.abs(r - b) < 70
    al = np.where(hue, 1 - np.clip((m - bm * 0.35) / (bm * 0.5), 0, 1), 1.0)
    out = a.copy()
    semi = (al > 0) & (al < 1)
    for ch in range(3):
        out[..., ch] = np.where(semi, np.clip((a[..., ch] - (1 - al) * bgc[ch]) / np.maximum(al, 1e-3), 0, 255), a[..., ch])
    # kalan pembe saçak: kırmızı ve maviyi yeşile doğru bastır
    spill = np.clip(((out[..., 0] + out[..., 2]) / 2 - out[..., 1] - 40) / 80, 0, 1) * hue
    for ch in (0, 2):
        out[..., ch] = out[..., ch] * (1 - spill * 0.5) + out[..., 1] * spill * 0.5
    rgba = np.dstack([np.clip(out, 0, 255), al * 255]).astype(np.uint8)
    return rgba


def biggest_mask(alpha):
    """En büyük nesne ve ona yakın parçalar (kopuk sopa ucu vb.) kalır, uzaktaki kırıntılar silinir."""
    m = alpha > 128
    H, W = m.shape
    lab = np.zeros((H, W), np.int32); n = 0; sizes = [0]
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; cnt = 0
        while stack:
            y, x = stack.pop(); cnt += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; stack.append((yy, xx))
        sizes.append(cnt)
    big = int(np.argmax(sizes))
    keep = np.zeros_like(m)
    ys, xs = np.nonzero(lab == big)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    for k in range(1, n + 1):
        if k == big or sizes[k] > sizes[big] * 0.02:
            yk, xk = np.nonzero(lab == k)
            # ana nesnenin kutusunun içinde ya da hemen yanındaysa kalır
            if k == big or (yk.min() < y1 + 20 and yk.max() > y0 - 20 and xk.min() < x1 + 20 and xk.max() > x0 - 20):
                keep |= lab == k
    return keep


def auto_cells(rgba, cols, rows):
    """Bağlı parçalarla ayırma: en büyük cols*rows parça karakterlerdir (satır, sonra sütun sırasıyla);
    küçük parçalar (kopuk mızrak ucu, hız çizgisi) kutusu en yakın karaktere katılır."""
    from scipy import ndimage
    a = rgba[..., 3]
    lab, n = ndimage.label(a > 128, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    order = np.argsort(sizes)[::-1]
    N = cols * rows
    main_ids = [int(i) + 1 for i in order[:N]]
    H = a.shape[0]
    cen = {k: ((objs[k - 1][0].start + objs[k - 1][0].stop) / 2, (objs[k - 1][1].start + objs[k - 1][1].stop) / 2) for k in main_ids}
    main_ids.sort(key=lambda k: (int(cen[k][0] // (H / rows)), cen[k][1]))
    groups = {k: [k] for k in main_ids}
    for i in order[N:]:
        k = int(i) + 1
        if sizes[i] < 30: continue
        sy, sx = objs[k - 1]
        best, bd = None, 1e9
        for m in main_ids:
            my, mx = objs[m - 1]
            dx = max(mx.start - sx.stop, sx.start - mx.stop, 0); dy = max(my.start - sy.stop, sy.start - my.stop, 0)
            d = dx + dy
            if d < bd: best, bd = m, d
        if bd < 80: groups[best].append(k)
    cells = []
    for m in main_ids:
        mask = np.isin(lab, groups[m])
        soft = (a > 0) & (a <= 128)
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = max(0, ys.min() - 4), ys.max() + 5, max(0, xs.min() - 4), xs.max() + 5
        cell = rgba[y0:y1, x0:x1].copy()
        # yumuşak kenar pikselleri yalnız bu karakterin yanındaysa kalır
        grown = ndimage.binary_dilation(mask[y0:y1, x0:x1], iterations=3)
        cell[..., 3] = np.where(mask[y0:y1, x0:x1] | (soft[y0:y1, x0:x1] & grown), cell[..., 3], 0)
        cells.append(cell)
    return cells


def anchor_of(cell, how):
    ys, xs = np.nonzero(cell[..., 3] > 128)
    top, bot = ys.min(), ys.max(); h = bot - top
    if how == 'head':
        sel = ys < top + h * 0.16
        return xs[sel].mean()
    if how == 'heel':
        sel = ys > bot - h * 0.06
        return np.percentile(xs[sel], 3)
    upper = ys < top + h * 0.45
    return xs[upper].mean()  # gövdenin ortası


def main(src, name, cols, rows, flip=False, auto=False, anchor='body', order=None, norm=False):
    rgb = np.asarray(Image.open(os.path.join(ROOT, 'varliklar', src)).convert('RGB'))
    rgba = remove_magenta(rgb)
    H, W = rgba.shape[:2]
    cw, ch = W / cols, H / rows
    frames = []
    if auto: raw = auto_cells(rgba, cols, rows)
    else:
        raw = []
        for r in range(rows):
            for c in range(cols):
                cell = rgba[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)].copy()
                keep = biggest_mask(cell[..., 3])
                cell[..., 3] = np.where(keep | ((cell[..., 3] > 0) & (cell[..., 3] <= 128)), cell[..., 3], 0)
                raw.append(cell)
    if order: raw = [raw[i - 1] for i in order]
    # topuk hizalamasında da kare ortası 1. karenin başına denk gelsin (yürüyüşten saldırıya geçerken karakter kaymasın)
    shift = anchor_of(raw[0], 'head') - anchor_of(raw[0], 'heel') if anchor == 'heel' else 0
    for cell in raw:
        ys, xs = np.nonzero(cell[..., 3] > 128)
        top, bot = ys.min(), ys.max()
        frames.append((cell, top, bot, anchor_of(cell, anchor) + shift))
    heights = sorted(f[2] - f[1] for f in frames)
    chH = heights[len(heights) // 2]
    if norm:
        # her kare ortanca boya getirilir (Gemini satırları farklı büyüklükte çizebiliyor; karakter büyüyüp küçülmesin)
        nf = []
        for cell, top, bot, anc in frames:
            q = chH / max(1, bot - top)
            im = Image.fromarray(cell).resize((max(1, round(cell.shape[1] * q)), max(1, round(cell.shape[0] * q))), Image.LANCZOS)
            nf.append((np.asarray(im), top * q, bot * q, anc * q))
        frames = nf
    k = TARGET_H / chH
    left = max(f[3] - np.nonzero(f[0][..., 3] > 0)[1].min() for f in frames)
    right = max(np.nonzero(f[0][..., 3] > 0)[1].max() - f[3] for f in frames)
    up = max(f[2] - f[1] for f in frames)
    pad = 6
    half = max(left, right)
    FW = int(np.ceil((2 * half + 2 * pad) * k)); FH = int(np.ceil((up + 2 * pad) * k))
    strip = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, (cell, top, bot, anchor) in enumerate(frames):
        im = Image.fromarray(cell)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT); anchor = cell.shape[1] - anchor
        ox = int(round(FW / 2 - anchor * k)) + i * FW
        oy = int(round(FH - pad * k - bot * k))
        strip.alpha_composite(im, (ox, oy)) if ox >= 0 else strip.paste(im, (ox, oy), im)
    # şerit taşmasın: her kare kendi hücresine kırpılır
    out = Image.new('RGBA', strip.size, (0, 0, 0, 0))
    for i in range(len(frames)):
        out.paste(strip.crop((i * FW, 0, (i + 1) * FW, FH)), (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=88, method=6)
    if os.path.exists(os.path.join(IMG, name + '.png')): os.remove(os.path.join(IMG, name + '.png'))
    meta_p = os.path.join(IMG, 'anim.json')
    meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
    meta[name] = {'n': len(frames), 'fw': FW, 'fh': FH, 'base': round(pad * k / FH, 4), 'ch': round(chH * k / FH, 4)}
    json.dump(meta, open(meta_p, 'w'), indent=1)
    man_p = os.path.join(IMG, 'manifest.json')
    man = json.load(open(man_p))
    if name + '.webp' not in man:
        man = sorted([m for m in man if m != name + '.png'] + [name + '.webp']); json.dump(man, open(man_p, 'w'), indent=0)
    print(name, len(frames), 'kare', FW, 'x', FH)


if __name__ == '__main__':
    an = sys.argv[sys.argv.index('--anchor') + 1] if '--anchor' in sys.argv else 'body'
    od = [int(x) for x in sys.argv[sys.argv.index('--order') + 1].split(',')] if '--order' in sys.argv else None
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), '--flip' in sys.argv, '--auto' in sys.argv, an, od, '--norm' in sys.argv)

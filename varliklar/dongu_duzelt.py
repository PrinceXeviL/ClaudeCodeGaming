"""Yürüyüş şeritlerinde takılmayı giderir (15 Eki, Caner: kodekste bazı yürüyüşler takılıyor).
- Donmuş/tekrarlanan kareler (bir öncekiyle neredeyse aynı) atılır: oynarken bir an duraklatıyordu.
- Döngü dikişi: son kareden ilk kareye geçiş sıçrıyorsa şerit, baş ve sonu en benzer olan aralığa kırpılır
  (s..e-1; e-1'den s'ye geçiş ortalama kare farkı kadar olur). Ara kare uydurulmaz (bulanık olmasın).
Kullanım: python3 varliklar/dongu_duzelt.py [ad ...]   (ad verilmezse bütün *_walk şeritleri taranır, yalnız sorunlular düzelir)
Eskileri: varliklar/cikti/dongu_eski/"""
import json, os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img'); OLD = os.path.join(ROOT, 'varliklar', 'cikti', 'dongu_eski')
A = json.load(open(os.path.join(IMG, 'anim.json')))


def frames(name):
    M = A[name]; im = Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA'); fw, fh = M['fw'], M['fh']; cols = im.width // fw
    return [im.crop(((i % cols) * fw, (i // cols) * fh, (i % cols) * fw + fw, (i // cols) * fh + fh)) for i in range(M['n'])]


def small(f):
    t = f.resize((max(1, int(f.width * 64 / f.height)), 64)); a = np.asarray(t).astype(np.float32)
    return a[..., :3] * (a[..., 3:] / 255.0)


def fix(name, force=False):
    F = frames(name); S = [small(f) for f in F]; N = len(F)
    dd = lambda i, j: float(np.abs(S[i] - S[j]).mean())
    d = [dd(i, (i + 1) % N) for i in range(N)]; med = float(np.median(d[:-1]))
    keep = [0] + [i for i in range(1, N) if dd(i, i - 1) > 0.25 * med]  # donmuş kareler
    seam = dd(keep[-1], keep[0]) / med
    froze = N - len(keep)
    if seam <= 1.8 and not froze and not force: return None
    K = len(keep); best = None
    if seam > 1.8 and K >= 12:
        for s in range(0, max(1, K // 4)):
            for e in range(max(s + 8, int(K * 0.7)), K + 1):  # kare aralığı keep[s:e]
                v = dd(keep[e - 1], keep[s]) / med + 0.02 * (K - (e - s))  # kısa kesmeyi biraz cezalandır
                if best is None or v < best[0]: best = (v, s, e)
        sel = keep[best[1]:best[2]] if best else keep
        if best and dd(sel[-1], sel[0]) / med > 0.7 * seam: sel = keep  # dikiş belirgin iyileşmiyorsa kırpma (yalnız donmuşlar atılır)
    else: sel = keep
    if len(sel) == N: return None
    M = A[name]; fw, fh = M['fw'], M['fh']
    os.makedirs(OLD, exist_ok=True)
    if not os.path.exists(os.path.join(OLD, name + '.webp')):
        shutil.copy(os.path.join(IMG, name + '.webp'), OLD); json.dump(M, open(os.path.join(OLD, name + '.json'), 'w'))
    out = Image.new('RGBA', (fw * len(sel), fh), (0, 0, 0, 0))
    for k, i in enumerate(sel): out.paste(F[i], (k * fw, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=88, method=6)
    M['n'] = len(sel)
    if 'idle' in M:  # duruş karesi: ayakların en kapalı olduğu kare
        def legw(f):
            a = np.asarray(f)[int(fh * 0.75):, :, 3] > 128; xs = np.nonzero(a)[1]; return xs.max() - xs.min() if len(xs) else 1e9
        M['idle'] = int(np.argmin([legw(F[i]) for i in sel]))
    new_seam = dd(sel[-1], sel[0]) / med
    return (N, len(sel), froze, round(seam, 2), round(new_seam, 2))


if __name__ == '__main__':
    names = sys.argv[1:] or sorted(n for n in A if n.endswith('_walk') or '_walk_' in n)
    for n in names:
        if n not in A or not os.path.exists(os.path.join(IMG, n + '.webp')): continue
        r = fix(n)
        if r:
            print(n, 'kare', r[0], '->', r[1], 'donmuş', r[2], 'dikiş', r[3], '->', r[4])
            json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1, ensure_ascii=False)  # her şeritten sonra (yarıda kalsa da tutarlı)

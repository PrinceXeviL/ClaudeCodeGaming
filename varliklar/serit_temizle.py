"""Animasyon şeritlerinin kenar temizliği (18 Eki, Caner: "beyaz kenar, mor sızıntı; her türlü çizimi güzelce temizle, sonra kontrol et").
Ölçüm: varliklar/serit_denetim.py. Her karede ayrı ayrı:
  1) beyaz hale: dış kenarın 3 px'lik bandında, içerideki komşusundan belirgin açık ve soluk (beyaz zeminden kalan) pikseller saydamlaşır
     (çizgi film çiziminde gövdenin dışında koyu kontur var: konturun dışındaki açık piksel zemindir; kemik gibi açık renkli gövdeye dokunmaz)
  2) pembe saçak: kenardaki magenta tonu griye çekilir (bilerek mor olanlar kenar_temizle.MOR: dokunulmaz)
  3) kırıntı: karenin ana gövdesinden kopuk küçük/soluk öbekler silinir
Özgünler varliklar/cikti/serit_once/ altına yedeklenir (yeniden çalıştırınca yedekten başlar).
    .venv/bin/python3 varliklar/serit_temizle.py [--dene] [ad ...]   (ad yoksa denetimde sorunlu çıkanlar)"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kenar_temizle import MOR
H = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(H, '..', 'sinir-kalesi', 'img'); BAK = os.path.join(H, 'cikti', 'serit_once')
A = json.load(open(os.path.join(IMG, 'anim.json')))
import re
GHOST = re.compile(r'ghost|wraith|spirit|soul|_lvlup')  # bilerek soluk/parlak (hayalet, ruh, seviye ışığı): beyaz hale adımı atlanır


def kare(a, name):
    a = a.astype(np.float32); al = a[..., 3]; rgb = a[..., :3]
    lum = rgb.mean(2); sat = (rgb.max(2) - rgb.min(2)) / np.maximum(rgb.max(2), 1)
    for _ in range(0 if GHOST.search(name) else 3):  # hale birkaç px kalın olabilir: dıştan içe soy
        solid = al > 20
        band = solid & nd.binary_dilation(~solid, iterations=2)
        inner = solid & ~nd.binary_dilation(~solid, iterations=4)
        w = nd.uniform_filter(inner.astype(np.float32), 9); il = nd.uniform_filter(lum * inner, 9) / np.maximum(w, 1e-3)
        halo = band & (w > 0.05) & (lum > 150) & (sat < 0.25) & (lum - il > 40)
        if not halo.any(): break
        al[halo] *= 0.1
    if name and not name.startswith(MOR):  # ad bilinmiyorsa (pack ad almadıysa) pembe adımı atlanır: mor karakteri bozmasın
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; m = np.minimum(r, b) - g
        solid = al > 20; edge = solid & nd.binary_dilation(~solid, iterations=4)
        fix = (m > 18) & ((al < 245) | edge); k = np.where(fix, np.clip((m - 18) / 40, 0, 1) * 0.9, 0)
        rgb[..., 0] -= m * k; rgb[..., 2] -= m * k
        sel = fix & (al < 170); al[sel] *= 1 - k[sel] * 0.75
    solid = al > 20; lab, n = nd.label(solid, structure=np.ones((3, 3)))
    if n > 1:
        idx = range(1, n + 1); sz = nd.sum(np.ones_like(al), lab, idx); ma = nd.mean(al, lab, idx); big = int(np.argmax(sz)) + 1
        body = nd.binary_dilation(lab == big, iterations=6)
        drop = [i + 1 for i in range(n) if i + 1 != big and ((sz[i] < 14 and ma[i] < 200) or (sz[i] < 6) or (ma[i] < 90 and sz[i] < 400 and not (body & (lab == i + 1)).any()))]
        if drop: al[np.isin(lab, drop)] = 0
    a[..., 3] = al
    return a.clip(0, 255).astype(np.uint8)


def temizle(im, name):
    F = A[name]; C = F.get('cols') or F['n']; R = (F['n'] + C - 1) // C
    fw = im.shape[1] / C; fh = im.shape[0] / R; out = im.copy()
    for i in range(F['n']):
        y0, y1 = int(round(i // C * fh)), int(round((i // C + 1) * fh)); x0, x1 = int(round(i % C * fw)), int(round((i % C + 1) * fw))
        out[y0:y1, x0:x1] = kare(im[y0:y1, x0:x1], name)
    return out


def sorunlular():
    p = os.path.join(H, 'cikti', 'serit_denetim.txt'); L = []
    for ln in open(p).read().splitlines()[1:]:
        s, n, pe, be, ki, boy = (ln.split('\t') + [''])[:6]
        if float(pe) > 1 or float(be) > 3 or float(ki) > 2: L.append(n)
    return L


def main():
    dene = '--dene' in sys.argv; names = [x for x in sys.argv[1:] if not x.startswith('--')] or sorunlular()
    os.makedirs(BAK, exist_ok=True); sheet = []
    for n in names:
        p = os.path.join(IMG, n + '.webp'); b = os.path.join(BAK, n + '.webp')
        if n not in A or not os.path.exists(p): continue
        # 19 Eki: şerit yeniden üretildiyse (Wan/Veo yeni sürüm) eski yedek geçersiz: yeni şerit yedek olur. Ölçüt: bu betiğin son yazdığı
        # zaman (yedeğin yanındaki .t) dosyanın şimdiki zamanından eskiyse ya da boyutlar tutmuyorsa dosya başka biri tarafından değiştirilmiştir.
        st = b[:-5] + '.t'
        if os.path.exists(b):
            last = float(open(st).read()) if os.path.exists(st) else None
            if (last is not None and os.path.getmtime(p) > last + 1) or Image.open(b).size != Image.open(p).size or last is None and os.path.getmtime(p) > os.path.getmtime(b) + 1:
                shutil.copy(p, b); print('yeni sürüm, yedek yenilendi', n)
        a = np.asarray(Image.open(b if os.path.exists(b) else p).convert('RGBA'))
        o = temizle(a, n)
        if dene: sheet.append((n, a, o)); continue
        if not os.path.exists(b): shutil.copy(p, b)
        Image.fromarray(o).save(p, 'WEBP', quality=86, method=6); open(st, 'w').write(str(os.path.getmtime(p))); print('temizlendi', n)
    if dene:
        rows = []
        for n, a, o in sheet:
            F = A[n]; C = F.get('cols') or F['n']; fw = a.shape[1] // C; fh = a.shape[0] // ((F['n'] + C - 1) // C); i = F['n'] // 2
            y0, x0 = (i // C) * fh, (i % C) * fw; T = []
            for im in (a, o):
                for bg in ((235, 235, 225), (60, 110, 50)):
                    c = Image.new('RGBA', (fw, fh), bg + (255,)); c.alpha_composite(Image.fromarray(im[y0:y0 + fh, x0:x0 + fw])); T.append(c.convert('RGB'))
            k = 260 / fh; r = Image.new('RGB', (int(fw * k) * 4, 260))
            for j, t in enumerate(T): r.paste(t.resize((int(fw * k), 260)), (j * int(fw * k), 0))
            rows.append(r)
        W = max(r.width for r in rows); S = Image.new('RGB', (W, 260 * len(rows)))
        for j, r in enumerate(rows): S.paste(r, (0, j * 260))
        S.save(os.path.join(H, 'cikti', 'serit_dene.jpg'), quality=88); print(len(sheet), 'şerit')


if __name__ == '__main__':
    main()

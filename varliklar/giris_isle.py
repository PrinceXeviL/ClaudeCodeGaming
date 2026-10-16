"""Giriş (kapak) görseli: Gemini çıktısındaki haçları siler, oyun boyuna küçültüp img/nm_key.jpg yazar.
Kullanım: .venv/bin/python3 varliklar/giris_isle.py [ham.jpg]
Haç bölgeleri çokgenle maskelenir, çevreden harmonik dolgu (Laplace) ile kapatılır, taş dokusu için hafif gürültü eklenir.
Eski kapak img/nm_key.jpg ilk çalıştırmada varliklar/cikti/eski_giris/ altına yedeklenir."""
import sys, os, shutil
import numpy as np
from PIL import Image, ImageDraw

KOK = os.path.dirname(os.path.abspath(__file__))
HAM = sys.argv[1] if len(sys.argv) > 1 else os.path.join(KOK, 'ham', 'nm_key_v2_a.jpg')
CIKTI = os.path.join(KOK, '..', 'sinir-kalesi', 'img', 'nm_key.jpg')
OYUN_W = 1920

# kaynak (2752x1536) piksel koordinatlarında silinecek bölgeler: [çokgen, gürültü]
HACLAR = [
    ([(10, 1350), (52, 1350), (88, 1514), (46, 1514)], 2.5),          # sol alttaki büyük mezar taşı: dikey kol
    ([(0, 1396), (98, 1388), (98, 1432), (0, 1438)], 2.5),            # büyük mezar taşı: yatay kol
    ([(1420, 678), (1431, 678), (1431, 694), (1420, 694)], 0),       # şapel sağındaki uzak haç: sol kol
    ([(1438, 680), (1452, 680), (1452, 697), (1438, 697)], 0),       # uzak haç: sağ kol
    ([(809, 561), (845, 561), (845, 597), (809, 597)], 0),           # şapel solundaki uzak haç
]


def harmonik(a, m, n=3000):
    """m maskeli pikselleri komşu ortalamasıyla tekrar tekrar doldur (kenardan içe yumuşak geçiş)."""
    ys, xs = np.where(m)
    y0, y1, x0, x1 = max(ys.min() - 2, 0), ys.max() + 3, max(xs.min() - 2, 0), xs.max() + 3
    b, mm = a[y0:y1, x0:x1].copy(), m[y0:y1, x0:x1]
    b[mm] = b[~mm].mean(axis=0)
    for _ in range(n):
        p = np.pad(b, ((1, 1), (1, 1), (0, 0)), mode='edge')
        avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
        b[mm] = avg[mm]
    a[y0:y1, x0:x1] = b


def main():
    im = Image.open(HAM).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(7)
    for poly, gur in HACLAR:
        mk = Image.new('L', im.size, 0); ImageDraw.Draw(mk).polygon(poly, fill=255)
        m = np.asarray(mk) > 0
        harmonik(a, m)
        if gur: a[m] += rng.normal(0, gur, (m.sum(), 1))
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    h = round(OYUN_W * out.height / out.width)
    out = out.resize((OYUN_W, h), Image.LANCZOS)
    yedek = os.path.join(KOK, 'cikti', 'eski_giris')
    os.makedirs(yedek, exist_ok=True)
    if os.path.exists(CIKTI) and not os.path.exists(os.path.join(yedek, 'nm_key.jpg')):
        shutil.copy(CIKTI, os.path.join(yedek, 'nm_key.jpg'))
    out.save(CIKTI, quality=88)
    print('yazıldı', CIKTI, out.size)


main()

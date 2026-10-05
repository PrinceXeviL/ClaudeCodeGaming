"""Dikişsiz zemin dokuları (PNG): çim (3 tema) ve yol. Çalıştır: python3 varliklar/doku_uret.py"""
import os
import random
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
OUT_DIR = os.path.join(ROOT, 'varliklar', 'cikti')  # canlı img/ manifestini ezmesin
S = 512


def wrap_draw(draw, fn):
    """Kenardan taşan şekli karşı kenara da çiz (dikişsiz döşeme için)."""
    for dx in (-S, 0, S):
        for dy in (-S, 0, S):
            fn(draw, dx, dy)


def layer(img, items, blur=0):
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for it in items:
        wrap_draw(d, it)
    if blur:
        # bulanıklaştırmayı dikişsiz yapmak için 3x3 döşeyip ortayı kes
        big = Image.new('RGBA', (S * 3, S * 3))
        for i in range(3):
            for j in range(3):
                big.paste(lay, (i * S, j * S))
        lay = big.filter(ImageFilter.GaussianBlur(blur)).crop((S, S, 2 * S, 2 * S))
    img.alpha_composite(lay)


def grass(base, darks, lights, flowers, seed, pebbles=0):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (S, S), base + (255,))
    blobs = []
    for _ in range(70):
        x, y, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(30, 90)
        col = rnd.choice(darks + lights) + (rnd.randint(40, 80),)
        blobs.append(lambda d, dx, dy, x=x, y=y, r=r, c=col: d.ellipse([x - r + dx, y - r * 0.7 + dy, x + r + dx, y + r * 0.7 + dy], fill=c))
    layer(img, blobs, 18)
    blades = []
    for _ in range(5200):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        h = rnd.uniform(5, 11)
        lean = rnd.uniform(-3, 3)
        col = rnd.choice(darks if rnd.random() < 0.55 else lights) + (rnd.randint(150, 230),)
        blades.append(lambda d, dx, dy, x=x, y=y, h=h, l=lean, c=col: d.line([x + dx, y + dy, x + l + dx, y - h + dy], fill=c, width=2))
    layer(img, blades, 0.6)
    extra = []
    for _ in range(flowers):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        col = rnd.choice([(255, 236, 110), (255, 255, 255), (240, 120, 160), (180, 160, 255)])
        extra.append(lambda d, dx, dy, x=x, y=y, c=col: (d.ellipse([x - 3 + dx, y - 3 + dy, x + 3 + dx, y + 3 + dy], fill=c + (255,), outline=(60, 50, 30, 200)),
                                                          d.ellipse([x - 1 + dx, y - 1 + dy, x + 1 + dx, y + 1 + dy], fill=(255, 200, 60, 255))))
    for _ in range(pebbles):
        x, y, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(2, 5)
        g = rnd.randint(120, 170)
        extra.append(lambda d, dx, dy, x=x, y=y, r=r, g=g: (d.ellipse([x - r + dx, y - r * 0.7 + dy, x + r + dx, y + r * 0.7 + dy], fill=(g, g - 4, g - 14, 255), outline=(60, 55, 45, 220)),
                                                            d.ellipse([x - r * 0.5 + dx, y - r * 0.6 + dy, x + dx, y - r * 0.1 + dy], fill=(g + 50, g + 46, g + 36, 200))))
    layer(img, extra)
    return img.convert('RGB')


def road(seed=7):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (S, S), (206, 170, 112, 255))
    blobs = []
    for _ in range(90):
        x, y, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(20, 70)
        col = rnd.choice([(176, 136, 84), (226, 196, 140), (190, 150, 96)]) + (rnd.randint(50, 100),)
        blobs.append(lambda d, dx, dy, x=x, y=y, r=r, c=col: d.ellipse([x - r + dx, y - r * 0.6 + dy, x + r + dx, y + r * 0.6 + dy], fill=c))
    layer(img, blobs, 14)
    specks = []
    for _ in range(2600):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        c = rnd.choice([(140, 100, 60), (240, 215, 165), (120, 90, 55)]) + (rnd.randint(90, 170),)
        specks.append(lambda d, dx, dy, x=x, y=y, c=c: d.point([x + dx, y + dy], fill=c))
    layer(img, specks, 0.5)
    stones = []
    for _ in range(140):
        x, y, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(3, 8)
        g = rnd.randint(140, 190)
        stones.append(lambda d, dx, dy, x=x, y=y, r=r, g=g: (d.ellipse([x - r + dx + 1, y - r * 0.7 + dy + 2, x + r + dx + 1, y + r * 0.7 + dy + 2], fill=(90, 65, 35, 110)),
                                                             d.ellipse([x - r + dx, y - r * 0.7 + dy, x + r + dx, y + r * 0.7 + dy], fill=(g, g - 10, g - 30, 255), outline=(95, 75, 50, 230)),
                                                             d.ellipse([x - r * 0.5 + dx, y - r * 0.55 + dy, x + r * 0.1 + dx, y - r * 0.1 + dy], fill=(g + 45, g + 40, g + 25, 200))))
    layer(img, stones)
    return img.convert('RGB')


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    grass((110, 168, 72), [(78, 132, 50), (66, 118, 42)], [(140, 196, 92), (158, 210, 104)], 26, 1).save(os.path.join(OUT_DIR, 'grass_meadow.png'))
    grass((72, 124, 54), [(48, 92, 38), (40, 80, 32)], [(98, 150, 70), (112, 160, 76)], 4, 2).save(os.path.join(OUT_DIR, 'grass_forest.png'))
    grass((140, 152, 92), [(110, 122, 70), (98, 110, 62)], [(170, 178, 112), (186, 190, 124)], 2, 3, pebbles=60).save(os.path.join(OUT_DIR, 'grass_rocky.png'))
    road().save(os.path.join(OUT_DIR, 'road.png'))
    print('ok')

"""Gemini'nin bölüm haritasını boyaması için düzen kılavuzu: yol (açık kahve), kule arsaları (sarı daire),
kale yeri (mor kare), geri kalan zemin (koyu yeşil). 1920x1080 (oyun 960x540'ın 2 katı).
    python3 varliklar/harita_kilavuzu.py levels.json 0  ->  varliklar/ham/harita/kilavuz_1.png
"""
import json, os, sys
from PIL import Image, ImageDraw

S = 2
ROAD_W = 46 * 1.74  # oyundaki yol genişliği (ROAD_K)


def catmull(pts, n=12):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def main(src, idx):
    lv = json.load(open(src))[idx]
    im = Image.new('RGB', (960 * S, 540 * S), (46, 70, 40))
    d = ImageDraw.Draw(im)
    for p in lv['paths']:
        pts = [(x * S, y * S) for x, y in catmull(p)]
        r = ROAD_W * S / 2
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(1, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / 4))
            for k in range(n + 1):
                x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
                d.ellipse([x - r, y - r, x + r, y + r], fill=(196, 160, 110))
    for x, y in lv['plots']:
        d.ellipse([(x - 30) * S, (y - 17) * S, (x + 30) * S, (y + 17) * S], fill=(235, 205, 60))
    cx, cy = lv['castle']
    d.rectangle([(cx - 70) * S, (cy - 120) * S, (cx + 20) * S, (cy + 20) * S], fill=(140, 70, 170))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'harita')
    os.makedirs(out, exist_ok=True)
    p = os.path.join(out, 'kilavuz_%d.png' % (idx + 1)); im.save(p); print(p, lv['name'])


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]))

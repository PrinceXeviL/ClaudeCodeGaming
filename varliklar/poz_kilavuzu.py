"""Gemini için poz kılavuzu: 4x2 karede çöp adam pozları (kırmızı = yakın/sağ bacak-kol, mavi = uzak/sol).
Kullanım: python3 varliklar/poz_kilavuzu.py yuru  ->  varliklar/ham/anim/kilavuz_yuru.png
"""
import math, os, sys
from PIL import Image, ImageDraw

W, H, COLS, ROWS = 1376, 768, 4, 2
CW, CH = W // COLS, H // ROWS
RED, BLUE, BODY, HEAD = (220, 40, 40), (40, 90, 230), (60, 60, 60), (120, 120, 120)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'anim')

# yürüyüş: (yakın uyluk, yakın diz, uzak uyluk, uzak diz, gövde iniş) — uyluk açısı derece, + öne; diz bükülmesi derece
YURU = [
    (32, 4, -28, 18, 0),    # 1 değme: yakın ayak önde topuk yerde
    (22, 28, -18, 45, 14),  # 2 çöküş: ağırlık yakın bacakta, gövde en altta
    (2, 6, 18, 95, 4),      # 3 geçiş: uzak diz yukarıda, ayak yerden kalkık
    (-18, 2, 38, 50, -14),  # 4 yükselme: yakın ayak iter, gövde en üstte
    (-28, 18, 32, 4, 0),    # 5 değme (ters)
    (-18, 45, 22, 28, 14),  # 6 çöküş
    (18, 95, 2, 6, 4),      # 7 geçiş: yakın diz yukarıda
    (38, 50, -18, 2, -14),  # 8 yükselme
]

def legpts(hip, thigh, knee, L1, L2):
    a1 = math.radians(thigh)
    k = (hip[0] + math.sin(a1) * L1, hip[1] + math.cos(a1) * L1)
    a2 = math.radians(thigh - knee)
    f = (k[0] + math.sin(a2) * L2, k[1] + math.cos(a2) * L2)
    return k, f

def leg(d, hip, thigh, knee, L1, L2, col, w):
    k, f = legpts(hip, thigh, knee, L1, L2)
    d.line([hip, k, f], fill=col, width=w, joint='curve')
    d.polygon([(f[0] - 8, f[1] - 10), (f[0] + 30, f[1] - 4), (f[0] + 30, f[1] + 6), (f[0] - 8, f[1] + 6)], fill=col)  # ayak (öne bakar)
    for p in (hip, k): d.ellipse([p[0] - w * 0.6, p[1] - w * 0.6, p[0] + w * 0.6, p[1] + w * 0.6], fill=col)

def arm(d, sh, ang, col, w, L=110):
    a = math.radians(ang)
    e = (sh[0] + math.sin(a) * L * 0.5, sh[1] + math.cos(a) * L * 0.5)
    h = (e[0] + math.sin(a + 0.6) * L * 0.5, e[1] + math.cos(a + 0.6) * L * 0.5)
    d.line([sh, e, h], fill=col, width=w, joint='curve')
    d.ellipse([h[0] - w, h[1] - w, h[0] + w, h[1] + w], fill=col)

def walk():
    im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im)
    L1, L2, TOR = 70, 70, 120
    for i, (nt, nk, ft, fk, bob) in enumerate(YURU):
        cx, cy = (i % COLS) * CW + CW // 2, (i // COLS) * CH
        ground = cy + CH - 36
        # en alttaki ayak tam yer çizgisine basar (kalça yüksekliği buna göre)
        h0 = (0, 0)
        low = max(legpts(h0, nt, nk, L1, L2)[1][1], legpts(h0, ft, fk, L1, L2)[1][1])
        hip = (cx - 20, ground - low - 6)
        top = (hip[0] + 12, hip[1] - TOR)
        d.line([(cx - 150, ground), (cx + 150, ground)], fill=(190, 190, 190), width=3)
        arm(d, (top[0] - 4, top[1] + 12), -0.8 * ft, BLUE, 16)
        leg(d, hip, ft, fk, L1, L2, BLUE, 20)
        d.line([hip, top], fill=BODY, width=40)                                   # gövde (hafif öne eğik)
        d.ellipse([top[0] - 30, top[1] - 68, top[0] + 30, top[1] - 8], fill=HEAD)  # baş
        leg(d, hip, nt, nk, L1, L2, RED, 22)
        arm(d, (top[0] + 4, top[1] + 14), -0.8 * nt, RED, 18)
    return im

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    kind = sys.argv[1] if len(sys.argv) > 1 else 'yuru'
    im = walk()
    p = os.path.join(OUT, 'kilavuz_%s.png' % kind); im.save(p); print(p)

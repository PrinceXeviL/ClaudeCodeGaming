"""Mortimer büyü animasyonu (8 kare, önden) için Gemini poz kılavuzu.

    python3 varliklar/mortimer_kilavuzu.py  ->  varliklar/ham/anim/kilavuz_mortimer.png

4x2 ızgara (2000x1116). Mavi = tırpanı tutan kol (izleyicinin solu), kırmızı = çay fincanlı kol, kahve = tırpan sapı,
açık gri = tırpan ağzı, beyaz = fincan, yeşil = büyü ışığı. Gövde ve baş koyu gri.
Kareler: 1 dur, 2 tırpanı kaldırmaya başla, 3 kollar yükselir, 4 tırpan başın üstünde, 5 doruk (ışık patlaması),
6 doruğu tut, 7 indir, 8 dur.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'anim', 'kilavuz_mortimer.png')
CW, CH = 500, 558
BLUE, RED, SHAFT, BLADE, CUP, GLOW, BODY = (40, 90, 230), (220, 30, 40), (110, 70, 30), (215, 215, 225), (255, 255, 255), (60, 255, 120), (70, 70, 80)

# kare başına: mavi dirsek, mavi el, tırpan üst ucu, tırpan alt ucu, kırmızı dirsek, kırmızı el, ışık yarıçapı
F = [
    ((185, 280), (175, 340), (168, 90), (180, 525), (322, 285), (348, 255), 0),
    ((182, 262), (172, 300), (160, 60), (178, 490), (326, 272), (356, 248), 0),
    ((178, 228), (165, 232), (150, 30), (170, 430), (332, 238), (372, 205), 14),
    ((188, 172), (190, 122), (192, 12), (188, 370), (338, 186), (378, 128), 28),
    ((196, 142), (206, 90), (214, 8), (200, 330), (334, 152), (366, 82), 60),
    ((198, 146), (208, 96), (216, 14), (202, 336), (336, 156), (368, 88), 48),
    ((180, 232), (167, 238), (152, 36), (172, 436), (330, 242), (368, 212), 10),
    ((185, 280), (175, 340), (168, 90), (180, 525), (322, 285), (348, 255), 0),
]

im = Image.new('RGB', (CW * 4, CH * 2), (255, 0, 255))
d = ImageDraw.Draw(im)
K = 0.82  # figür hücreye sığsın: ölçekle ve aşağı kaydır (ışık üstten taşmasın)
for i, (be, bh, st, sb, re, rh, gl) in enumerate(F):
    ox, oy = (i % 4) * CW, (i // 4) * CH
    P = lambda p: (ox + 250 + (p[0] - 250) * K, oy + 70 + p[1] * K)
    def disc(c, r, col):
        x, y = P(c); d.ellipse([x - r * K, y - r * K, x + r * K, y + r * K], fill=col)
    if gl:  # tırpan ucunda ve kaldırılan elde büyü ışığı
        disc(st, gl, GLOW); disc(rh, gl * 0.6, GLOW)
    # gövde: cüppe ve kapüşonlu baş
    d.polygon([P((215, 205)), P((285, 205)), P((320, 520)), P((180, 520))], fill=BODY)
    disc((250, 152), 30, BODY)
    # tırpan: sap ve ağız (izleyicinin soluna kıvrılır)
    d.line([P(sb), P(st)], fill=SHAFT, width=10)
    d.polygon([P(st), P((st[0] - 110, st[1] + 30)), P((st[0] - 122, st[1] + 92)), P((st[0] - 14, st[1] + 22))], fill=BLADE)
    # kollar
    d.line([P((215, 210)), P(be), P(bh)], fill=BLUE, width=17, joint='curve')
    d.line([P((285, 210)), P(re), P(rh)], fill=RED, width=17, joint='curve')
    disc((rh[0], rh[1] - 12), 12, CUP)
    # ayaklar sabit
    disc((219, 522), 16, (30, 30, 30)); disc((281, 522), 16, (30, 30, 30))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
im.save(OUT)
print(OUT)

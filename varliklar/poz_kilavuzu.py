"""Gemini için poz kılavuzu: 4x2 karede çöp adam pozları (kırmızı = yakın/sağ bacak-kol, mavi = uzak/sol).
Kullanım: python3 varliklar/poz_kilavuzu.py yuru  ->  varliklar/ham/anim/kilavuz_yuru.png
          python3 varliklar/poz_kilavuzu.py onarka  ->  önden/arkadan yürüyüş (kırmızı = karakterin sağ bacağı/kolu, mavi = sol)
          python3 varliklar/poz_kilavuzu.py saldiri ->  yandan kılıç saldırısı (kırmızı = kılıç kolu, dirsek eklemi belirgin; mavi = kalkan kolu)
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

# önden/arkadan yürüyüş: (sağ bacak kalkışı, sol bacak kalkışı, gövde iniş) — 0 yerde, 1 diz en yukarıda
ONARKA = [(0.0, 0.0, 6), (0.35, 0.0, 0), (0.85, 0.0, -8), (0.35, 0.0, 0), (0.0, 0.0, 6), (0.0, 0.35, 0), (0.0, 0.85, -8), (0.0, 0.35, 0)]

def front_leg(d, hip, lift, ground, col, w, side):
    # kalkan bacak: uyluk izleyiciye doğru gelir (kısalır), diz yükselir, ayak yerden kalkar
    L1 = 72
    knee = (hip[0] + side * 4, hip[1] + L1 * (1 - 0.5 * lift))
    foot = (hip[0] + side * 8, ground - 70 * lift)
    d.line([hip, knee, foot], fill=col, width=w, joint='curve')
    d.ellipse([foot[0] - 18, foot[1] - 10, foot[0] + 18, foot[1] + 8], fill=col)
    for q in (hip, knee): d.ellipse([q[0] - w * 0.6, q[1] - w * 0.6, q[0] + w * 0.6, q[1] + w * 0.6], fill=col)

def front_arm(d, sh, swing, col, w, side):
    # önden kol salınımı: el öne gelince yukarı ve içeri, arkaya gidince aşağı ve dışarı
    e = (sh[0] + side * (14 - swing * 4), sh[1] + 55 - swing * 6)
    h = (e[0] - side * swing * 10, e[1] + 50 - swing * 22)
    d.line([sh, e, h], fill=col, width=w, joint='curve')
    d.ellipse([h[0] - w, h[1] - w, h[0] + w, h[1] + w], fill=col)

def onarka():
    im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im)
    for i, (rl, ll, bob) in enumerate(ONARKA):
        cx, cy = (i % COLS) * CW + CW // 2, (i // COLS) * CH
        ground = cy + CH - 36
        hipY = ground - 150 + bob
        d.line([(cx - 150, ground), (cx + 150, ground)], fill=(190, 190, 190), width=3)
        # karakterin sağı izleyicinin solunda (önden görünüş); arkadan çizimde de aynı renkler aynı bacağı gösterir
        front_leg(d, (cx - 24, hipY), rl, ground, RED, 22, -1)
        front_leg(d, (cx + 24, hipY), ll, ground, BLUE, 22, 1)
        d.rectangle([cx - 42, hipY - 125, cx + 42, hipY + 6], fill=BODY)
        d.ellipse([cx - 30, hipY - 190, cx + 30, hipY - 128], fill=HEAD)
        # kollar bacaklara ters salınır
        front_arm(d, (cx - 46, hipY - 115), ll - rl, RED, 18, -1)
        front_arm(d, (cx + 46, hipY - 115), rl - ll, BLUE, 18, 1)
    return im

# yandan saldırı (sağa bakar): (kılıç üst kol açısı, dirsek bükümü, kılıç açısı, gövde öne eğim, öne adım)
# açılar derece: 0 = aşağı sarkık, 90 = öne yatay, 180 = yukarı; dirsek bükümü ön koldaki ek açı
SALDIRI = [
    (35, 75, 70, 0, 0),      # 1 hazır: kılıç önde, dirsek bükük
    (-25, 95, -40, -6, 0),   # 2 geri çek: dirsek geride, kılıç arkaya
    (140, 70, -40, -10, 0),  # 3 kaldır: el başın üstünde, kılıç sırta doğru arkaya düşer
    (165, 25, 150, -4, 10),  # 4 savuruş başı: kol dikleşir, kılıç yukarı-öne
    (110, 10, 120, 8, 30),   # 5 iniş: kol öne doğru açılır
    (85, 0, 95, 14, 45),     # 6 darbe: kol ve kılıç tam öne uzanır, gövde öne atılır
    (40, 20, 45, 10, 40),    # 7 devam: kılıç aşağı iner
    (30, 70, 70, 3, 15),     # 8 toparlan: hazıra döner
]

def pt(o, ang, L):
    a = math.radians(ang)
    return (o[0] + math.sin(a) * L, o[1] + math.cos(a) * L)

def saldiri():
    im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im)
    L1, L2, TOR = 70, 70, 100
    for i, (ua, eb, sa, lean, step) in enumerate(SALDIRI):
        cx, cy = (i % COLS) * CW + CW // 2, (i // COLS) * CH
        ground = cy + CH - 36
        hip = (cx - 40 + step * 0.6, ground - 128)
        top = pt(hip, 180 - lean, TOR)
        d.line([(cx - 150, ground), (cx + 150, ground)], fill=(190, 190, 190), width=3)
        # bacaklar: duruş, öne adımda ön bacak öne açılır
        leg(d, hip, -18, 8, L1, L2, BLUE, 20)
        # kalkan kolu (uzak): göğüs önünde, büyük dikdörtgen kalkan
        sh2 = (top[0] - 2, top[1] + 14)
        e2 = pt(sh2, 50, 48); h2 = pt(e2, 110, 42)
        d.line([sh2, e2, h2], fill=BLUE, width=16, joint='curve')
        d.rectangle([h2[0] - 10, h2[1] - 70, h2[0] + 22, h2[1] + 62], outline=BLUE, width=8)
        d.line([hip, top], fill=BODY, width=40)
        d.ellipse([top[0] - 26, top[1] - 58, top[0] + 26, top[1] - 6], fill=HEAD)
        leg(d, hip, 16 + step * 0.5, 10, L1, L2, RED, 22)
        # kılıç kolu (yakın): omuz -> dirsek -> el, dirsek eklemi büyük daire
        sh = (top[0] + 4, top[1] + 16)
        el = pt(sh, ua, 46); hd = pt(el, ua + eb, 44)
        tip = pt(hd, sa, 78)
        d.line([hd, tip], fill=(150, 150, 150), width=10)                     # kılıç
        d.line([(hd[0] - 12, hd[1]), (hd[0] + 12, hd[1])], fill=(120, 90, 40), width=8)  # kabza
        d.line([sh, el, hd], fill=RED, width=18, joint='curve')
        for q in (sh, el): d.ellipse([q[0] - 13, q[1] - 13, q[0] + 13, q[1] + 13], fill=RED)
        d.ellipse([hd[0] - 11, hd[1] - 11, hd[0] + 11, hd[1] + 11], fill=(150, 20, 20))
    return im

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    kind = sys.argv[1] if len(sys.argv) > 1 else 'yuru'
    im = {'yuru': walk, 'onarka': onarka, 'saldiri': saldiri}[kind]()
    p = os.path.join(OUT, 'kilavuz_%s.png' % kind); im.save(p); print(p)

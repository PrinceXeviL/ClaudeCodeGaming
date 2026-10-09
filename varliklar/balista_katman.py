"""Kemik Balistası görselini katmanlara ayırır (kodla animasyon için):
  tower_archer_nail_top.webp   : dönen yay (mızrak ve kirişler silinmiş, boşluk doldurulmuş)
  tower_archer_nail_ped.webp   : kaide (kesim çizgisinin altı)
  tower_archer_nail_spear.webp : yalnız mızrak (tüy + şaft + alevli uç), aynı tuval boyutunda (konum korunur)
  balista.json                  : kiriş uçları, gez noktası, mızrak ekseni (görsele göre 0..1)
Noktalar görselin piksel ölçüsüyle (700x773) elle ölçüldü."""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sinir-kalesi', 'img')
im = Image.open(os.path.join(IMG, 'tower_archer_nail.webp')).convert('RGBA'); W, H = im.size
A = np.array(im).astype(np.float32)
NOCK, TIP = (214, 94), (690, 262)
ARM_UP, ARM_LO = (512, 43), (76, 199)
def line_mask(pts, w):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m); d.line(pts, fill=255, width=w, joint='curve')
    for p in pts: d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=255)
    return np.array(m) > 0
def poly_mask(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.array(m) > 0
shaft = line_mask([(200, 96), (500, 190), (560, 214)], 15)
fletch = poly_mask([(178, 80), (240, 88), (262, 116), (205, 118), (172, 100)])
head = poly_mask([(495, 168), (538, 118), (618, 96), (664, 138), (716, 262), (646, 284), (552, 278), (495, 216)])
r, g, b, a = A[..., 0], A[..., 1], A[..., 2], A[..., 3]
beige = (r > 170) & (g > 150) & (b < 175) & (r - b > 35) & (np.abs(r - g) < 45)
spear = shaft | fletch | (head & ~beige & (a > 20))
xr = np.arange(W)[None, :] > 500
spear = spear | (head & xr & (a > 0) & (((r - g > 50) & (b - g > 10)) | (a < 140)))  # pembe alev dilleri ve yumuşak kenarı
spear = spear | (ndimage.binary_fill_holes(spear) & head)  # alevin içindeki açık renkli delikler de mızrağa
strings = line_mask([ARM_UP, (300, 77), (227, 88), NOCK], 17) | line_mask([NOCK, (168, 95), (120, 150), ARM_LO], 18)
hole = (spear | strings) & (a > 0)
# alevli uç gövdenin dışında: oradaki delik doldurulmaz, saydam kalır (gövdeye 3 px'ten yakın olanlar doldurulur)
body = (a > 0) & ~spear & ~strings
near_body = ndimage.distance_transform_edt(~body) <= 3
clear = head & spear & ~near_body
# mızrak katmanı: yalnız mızrak pikselleri (kenarları yumuşak)
S = A.copy(); S[..., 3] = np.where(spear, a, 0)
Image.fromarray(S.astype(np.uint8)).save(os.path.join(IMG, 'tower_archer_nail_spear.webp'), 'WEBP', quality=92)
# gövde: delikler çevreden yayılarak doldurulur (önceden çarpılmış renkle, saydam çevre saydam kalır)
B = A.copy(); known = ~hole
P = B[..., :3] * (B[..., 3:4] / 255.0); al = B[..., 3].copy()
P[hole] = 0; al[hole] = 0
k = np.array([[0.5, 1, 0.5], [1, 0, 1], [0.5, 1, 0.5]], np.float32)
wsum = known.astype(np.float32)
for it in range(260):
    num = np.stack([ndimage.convolve(P[..., c], k, mode='nearest') for c in range(3)], -1)
    na = ndimage.convolve(al, k, mode='nearest'); den = ndimage.convolve(wsum, k, mode='nearest')
    upd = hole & (den > 0)
    P[upd] = num[upd] / den[upd][:, None]; al[upd] = na[upd] / den[upd]
    wsum = np.where(upd, 1.0, wsum)
out = np.zeros_like(A); safe = np.maximum(al, 1)[..., None]
out[..., :3] = np.clip(P * 255.0 / safe, 0, 255); out[..., 3] = np.where(hole, al, a)
out[~hole] = A[~hole]
out[clear] = 0
# alev bölgesinde (kafatasının sağı) kalan pembe parıltı ve yarı saydam kenar izleri silinir
r2, g2, b2, a2 = [out[..., i] for i in range(4)]
fl = head & (np.arange(W)[None, :] > 500) & (((r2 - g2 > 50) & (b2 - g2 > 10)) | (a2 < 140))
out[fl] = 0
# doldurulan delikte yarı saydam bulanık kenar kalmasın: alfa eşiklenir, yeni dış kenara koyu çizgi çekilir
ah = out[..., 3]; ah[hole] = np.where(ah[hole] >= 150, 255, 0)
opq = ah > 0; edge = hole & opq & ~ndimage.binary_erosion(opq, iterations=2)
out[edge, :3] = [38, 24, 30]
# boş oluk (kundak üstü, x 250..425): şaft ekseninin üstü saydam, eksende koyu kenar çizgisi, altı alttaki ray dokusunun kopyası
yy, xx = np.mgrid[0:H, 0:W]; yc = 96 + (xx - 200) * (94 / 300)
band = hole & (xx >= 192) & (xx <= 425); band2 = hole & (xx >= 166) & (xx <= 492)
out[band & (yy < yc - 1)] = 0
cl = band2 & (yy >= yc + 1.5)
for k in (9, 18, 27, 36):  # kaynak da delikteyse daha aşağıdan al
    src = np.clip(yy + k, 0, H - 1); ok = cl & ~hole[src, xx]
    out[ok] = out[src[ok], xx[ok]]; cl = cl & ~ok
out[band2 & (yy >= yc - 1) & (yy < yc + 1.5), :] = [38, 24, 30, 255]
red = hole & (out[..., 0].astype(int) - out[..., 1] > 40) & (xx < 500)  # şaftın kızıl sargısından kalan leke: soluk mor-griye
lum = out[..., :3].mean(-1)
out[red, 0] = lum[red] * 0.8; out[red, 1] = lum[red] * 0.7; out[red, 2] = lum[red] * 0.85
# alevden kalan kopuk zerreler: gövdeye bağlı olmayan küçük adacıklar silinir
lab, n = ndimage.label(out[..., 3] > 8); sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
out[np.isin(lab, [i + 1 for i in range(n) if sz[i] < 400])] = 0
# delikte kalan pembe/mor alev izi: doygun magenta pikseller gövde rengine çekilir (mor tahta tonu)
r2, g2, b2 = out[..., 0], out[..., 1], out[..., 2]
pink = hole & (r2 > 150) & (b2 > 90) & (g2 < 90)
out[pink, :3] = [70, 50, 80]
# yay (dönen kısım) ve kaide ayrılır: kesim çizgisinin üstü yay; kaidenin üst yüzünü oyunda döner tabla (kod) örter
CUT = [(0, 340), (200, 329), (395, 326), (445, 312), (487, 300), (490, 246), (700, 246)]
cx = np.array([c[0] for c in CUT], float); cy = np.array([c[1] for c in CUT], float)
cut = np.interp(np.arange(W), cx, cy)[None, :]
top = out.copy(); top[yy >= cut] = 0
ped = out.copy(); ped[yy < cut] = 0
Image.fromarray(top.astype(np.uint8)).save(os.path.join(IMG, 'tower_archer_nail_top.webp'), 'WEBP', quality=92)
Image.fromarray(ped.astype(np.uint8)).save(os.path.join(IMG, 'tower_archer_nail_ped.webp'), 'WEBP', quality=92)
f = lambda p: [round(p[0] / W, 4), round(p[1] / H, 4)]
json.dump({'nock': f(NOCK), 'tip': f(TIP), 'armUp': f(ARM_UP), 'armLo': f(ARM_LO)}, open(os.path.join(IMG, 'balista.json'), 'w'))
print('ok', W, H, int(spear.sum()), int(strings.sum()))

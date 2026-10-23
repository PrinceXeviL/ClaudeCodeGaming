"""23 Eki: yeni giriş resminden (varliklar/ham/giris_v3.jpg) uygulama simgesi adayları. Mortimer'ın yüzü + yeşil alevli boynuzlu kafatası asa;
gökyüzü/arka plan mor-yeşil ışığa boyanır, gözler ve alev parlatılır, kenarlar kararır. Çıktı: varliklar/simge_v2/aday_<n>.png (1024)."""
import sys, numpy as np
from PIL import Image, ImageEnhance, ImageFilter
SRC = 'varliklar/ham/giris_v3.jpg'
im = Image.open(SRC).convert('RGB')
def glow(a, cx, cy, r, col, k):
    h, w = a.shape[:2]; y, x = np.mgrid[0:h, 0:w]; d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    g = np.clip(1 - d, 0, 1) ** 2 * k / 100.0  # k: yüzde (0-100), renk eklenir
    return a + g[..., None] * np.array(col)[None, None, :]
def make(box, out, sky=True, sat=1.35, con=1.12, z=1024):
    c = im.crop(box).resize((z, z), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
    c = ImageEnhance.Color(c).enhance(sat); c = ImageEnhance.Contrast(c).enhance(con)
    a = np.asarray(c).astype(np.float32)
    if sky: # lacivert gökyüzü ve gece arka planı: mavi baskın, doygun olmayan koyu pikseller → koyu mor, asa çevresinde yeşil
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        m = np.clip(((b - np.maximum(r, g)) / 40.0), 0, 1) * np.clip((150 - a.mean(2)) / 60, 0, 1)
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
        L = a.mean(2, keepdims=True)
        tint = np.concatenate([L * 1.15 + 18, L * 0.45, L * 1.5 + 30], 2)
        a = a * (1 - m[..., None]) + tint * m[..., None]
    return a
def finish(a, out, glows):
    for g in glows: a = glow(a, *g)
    h, w = a.shape[:2]; y, x = np.mgrid[0:h, 0:w]; d = np.sqrt(((x - w / 2) / w) ** 2 + ((y - h / 2) / h) ** 2) * 2
    a = a * np.clip(1.12 - d ** 2 * 0.55, 0.35, 1)[..., None]  # kenar kararması
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out); print(out)
# Aday 1: yüz + asa, orta kadraj
B1 = (420, 200, 1000, 780); k = 1024 / (B1[2] - B1[0])
a = make(B1, None); P = lambda x, y: ((x - B1[0]) * k, (y - B1[1]) * k)
finish(a, 'varliklar/simge_v2/aday_1.png', [(*P(908, 280), 260, (80, 255, 90), 60), (*P(908, 395), 120, (120, 255, 120), 50), (*P(530, 455), 60, (255, 40, 40), 70), (*P(587, 455), 60, (255, 40, 40), 70), (*P(560, 470), 330, (150, 40, 60), 25)])
# Aday 2: daha yakın, yüz büyük (göz okunur), asa sağda kesik
B2 = (440, 300, 900, 760); k = 1024 / (B2[2] - B2[0]); P = lambda x, y: ((x - B2[0]) * k, (y - B2[1]) * k)
a = make(B2, None, sat=1.45, con=1.18)
finish(a, 'varliklar/simge_v2/aday_2.png', [(*P(908, 290), 240, (80, 255, 90), 70), (*P(908, 395), 110, (120, 255, 120), 55), (*P(530, 455), 55, (255, 40, 40), 85), (*P(587, 455), 55, (255, 40, 40), 85)])
# Aday 3: gökyüzü boyanmadan, yalnız canlılık + parlama (aslına en yakın)
a = make(B1, None, sky=False, sat=1.4, con=1.15); k = 1024 / (B1[2] - B1[0]); P = lambda x, y: ((x - B1[0]) * k, (y - B1[1]) * k)
finish(a, 'varliklar/simge_v2/aday_3.png', [(*P(908, 280), 260, (80, 255, 90), 55), (*P(530, 455), 60, (255, 40, 40), 70), (*P(587, 455), 60, (255, 40, 40), 70)])

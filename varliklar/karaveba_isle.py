"""Kara Veba Kazanı (nm_kazan_k4_karaveba.jpg): Gemini sayfasındaki yarı saydam sis magenta zeminle karıştığı için pembe çıkıyor;
sis ve uçuşan sinekler oyunda kodla çizildiğinden (game.js CAULDRON_PLAGUE) görselden atılır: yalnız bina ve taban halkası kalır.
    .venv/bin/python varliklar/karaveba_isle.py   (önce nm_isle.py sayfayı keser, bu betik onu temizler)
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
subprocess.run([sys.executable, os.path.join(D, 'nm_isle.py'), 'nm_kazan_k4_karaveba.jpg'], check=True, cwd=D)
p = os.path.join(IMG, 'tower_artillery_plague.webp')
im = np.array(Image.open(p).convert('RGBA')); a = im[..., 3]; H, W = a.shape
# sis kat kat ve yoğun (binayla tek parça), rengiyle de ayrılmıyor: yer belirler. Kalan = taban halkası (elips) + binanın gövdesi
# (dikdörtgen: sivri uçlar, boynuzlar, sancaklar, mangallar). Oranlar nm_isle çıktısında ölçüldü (% x, % y).
yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W])[:, None, None] * 100
ring = ((xx - 53.5) / 33.5) ** 2 + ((yy - 80) / 18) ** 2 <= 1
tower = (xx >= 21.5) & (xx <= 80) & (yy <= 72)
# magenta zeminin üstündeki sis lila/pembe çıkar (bina gri, mor öğeleri ise doygun): lila pikseller her yerde atılır
r, g, b = [im[..., i].astype(int) for i in range(3)]; lum = (r + g + b) / 3
lilac = (r - g > 12) & (b - g > 12) & (np.abs(r - b) < 50) & (lum > 60) & ~((xx > 31) & (xx < 73) & (yy > 8)) & ~((xx > 21) & (xx < 28) & (yy > 37) & (yy < 63)) & ~((xx > 73) & (xx < 80) & (yy > 39) & (yy < 63))  # kafatası, mor şelale ve sancaklar korunur
keep = (ring | tower) & ~lilac
edge = ndimage.binary_dilation(keep, iterations=3) & ~keep    # kesik kenar sert olmasın: 3 px yumuşak geçiş
im[..., 3] = np.where(keep, a, np.where(edge, a // 3, 0))
ys, xs = np.nonzero(im[..., 3] > 0)
im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
out = Image.fromarray(im); s = 700 / max(out.size); out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
out.save(p, 'WEBP', quality=88, method=6)
meta = json.load(open(os.path.join(IMG, 'meta.json'))); meta['tower_artillery_plague'] = [900, round(900 * out.height / out.width), 0.13]  # taban geniş çizildi: kafatası 3. kademeyle aynı boyda kalsın
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'))
print('tower_artillery_plague', out.size, meta['tower_artillery_plague'])

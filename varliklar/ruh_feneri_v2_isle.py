# Ruh Feneri v2 (20 Eki 2026, "Ruh Deniz Feneri"; Caner'in kendi promptuyla Gemini, temizlenmiş 2. sürüm):
# ham/nm_ruh_feneri_v2_kademe.jpg -> img/tower_mage_1..3.webp. Fener kulenin içinde (ayrı _arm katmanı yok); ışın TOWER_EYE.mage noktasından çıkar.
# Gemini'nin bıraktığı artıklar kesimden önce silinir: 2. kademenin sağındaki kıvılcım, 3. kademenin sağ üstünde havada duran orak.
import os, shutil, sys
import numpy as np
from PIL import Image
from anim_isle import remove_magenta
from kemik_v2_isle import cut

HAM = 'ham/nm_ruh_feneri_v2_kademe.jpg'
IMG = '../sinir-kalesi/img'
ESKI = 'cikti/ruh_feneri_eski'
SEGS = [(87, 636), (716, 1312), (1333, 1978)]
SCALE = 1.6
# (x0, y0, x1, y1, kip): 'hepsi' kutuyu zemine boyar; 'simsek' yalnız mavi-beyaz şimşek piksellerini
ARTIK = [(1785, 100, 1975, 340, 'hepsi'), (1180, 465, 1325, 615, 'simsek')]


def main():
    os.makedirs(ESKI, exist_ok=True)
    src = np.array(Image.open(HAM).convert('RGB')).astype(int)
    bg = np.array([src[5, 5], src[5, -6], src[-6, 5], src[-6, -6]]).mean(0).astype(int)
    for x0, y0, x1, y1, kip in ARTIK:
        b = src[y0:y1, x0:x1]
        if kip == 'hepsi': b[:] = bg
        else:
            r, g, bl = b[..., 0], b[..., 1], b[..., 2]
            m = ((bl > 150) & (bl - r > 25) & (g > 120)) | ((bl > 140) & (bl - g > 40))  # mavi-beyaz ve mor kıvılcım (kemik, taş, pas bu renkte değil)
            b[m] = bg
    rgba = remove_magenta(src.astype(np.uint8))
    for k, (a, b) in enumerate(SEGS):
        name = f'tower_mage_{k + 1}'
        for suf in ('', '_arm', '_collapse'):
            p = f'{IMG}/{name}{suf}.webp'
            if os.path.exists(p) and not os.path.exists(f'{ESKI}/{name}{suf}.webp'): shutil.copy(p, f'{ESKI}/{name}{suf}.webp')
        c = Image.fromarray(cut(src, rgba, a, b)); c = c.resize((round(c.width * SCALE), round(c.height * SCALE)), Image.LANCZOS)
        c.save(f'{IMG}/{name}.webp', quality=90); print(name, c.size)


if __name__ == '__main__':
    main()

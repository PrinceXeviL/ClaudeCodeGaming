# Ruh Feneri v2 (20 Eki 2026, "Ruh Deniz Feneri"; Caner'in kendi promptuyla Gemini, temizlenmiş 2. sürüm):
# ham/nm_ruh_feneri_v2_kademe.jpg -> img/tower_mage_1..3.webp. Fener kulenin içinde (ayrı _arm katmanı yok); ışın TOWER_EYE.mage noktasından çıkar.
# Gemini'nin bıraktığı artıklar kesimden önce silinir: 2. kademenin sağındaki kıvılcım, 3. kademenin sağ üstünde havada duran orak.
import os, shutil, sys
import numpy as np
from PIL import Image
from anim_isle import remove_magenta
from kemik_v2_isle import cut

IMG = '../sinir-kalesi/img'
ESKI = 'cikti/ruh_feneri_eski'
# işler: ham sayfa, sütunlar, adlar, ölçek, artık kutuları (x0, y0, x1, y1, kip): 'hepsi' kutuyu zemine boyar; 'simsek' yalnız şimşek piksellerini
JOBS = {
    'kademe': dict(ham='ham/nm_ruh_feneri_v2_kademe.jpg', segs=[(87, 636), (716, 1312), (1333, 1978)], names=['tower_mage_1', 'tower_mage_2', 'tower_mage_3'], scale=1.6,
                   artik=[(1785, 100, 1975, 340, 'hepsi'), (1180, 465, 1325, 615, 'simsek')]),
    # 4. kademe: sol Ruh Emici (drain, dev kristal), sağ Ruh Kafesi (ghost, kanatlı ölümün kafesi)
    'yollar': dict(ham='ham/nm_ruh_feneri_v2_yollar.jpg', segs=[(100, 932), (1085, 1936)], names=['tower_mage_drain', 'tower_mage_ghost'], scale=1.2,
                   artik=[(720, 140, 800, 230, 'simsek')]),
}


def main(job='kademe'):
    J = JOBS[job]; os.makedirs(ESKI, exist_ok=True)
    src = np.array(Image.open(J['ham']).convert('RGB')).astype(int)
    bg = np.array([src[5, 5], src[5, -6], src[-6, 5], src[-6, -6]]).mean(0).astype(int)
    for x0, y0, x1, y1, kip in J['artik']:
        b = src[y0:y1, x0:x1]
        if kip == 'hepsi': b[:] = bg
        else:
            r, g, bl = b[..., 0], b[..., 1], b[..., 2]
            m = ((bl > 150) & (bl - r > 25) & (g > 120)) | ((bl > 140) & (bl - g > 40))  # mavi-beyaz ve mor kıvılcım (kemik, taş, pas bu renkte değil)
            b[m] = bg
    rgba = remove_magenta(src.astype(np.uint8))
    for k, (a, b) in enumerate(J['segs']):
        name = J['names'][k]
        for suf in ('', '_arm', '_collapse'):
            p = f'{IMG}/{name}{suf}.webp'
            if os.path.exists(p) and not os.path.exists(f'{ESKI}/{name}{suf}.webp'): shutil.copy(p, f'{ESKI}/{name}{suf}.webp')
        cc = cut(src, rgba, a, b)
        if name == 'tower_mage_drain': # kristalin çevresindeki pembe parıltı (magenta zemin + camgöbeği ışık) doldurulmasın: yeniden saydamlaştır
            f = cc.astype(int); r, g, bl = f[..., 0], f[..., 1], f[..., 2]; H0 = cc.shape[0]
            pink = ((r + bl) / 2 - g > 45) & (np.abs(r - bl) < 90) & (r > 120)
            pink[int(H0 * 0.34):] = False
            re = remove_magenta(cc[..., :3].astype(np.uint8)); cc[pink] = re[pink]
        c = Image.fromarray(cc); S = J['scale']; c = c.resize((round(c.width * S), round(c.height * S)), Image.LANCZOS)
        c.save(f'{IMG}/{name}.webp', quality=90); print(name, c.size)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'kademe')  # python3 ruh_feneri_v2_isle.py [kademe|yollar]

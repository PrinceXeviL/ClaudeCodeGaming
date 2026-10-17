"""Durağan çizimlerin kenar temizliği (17 Eki, Caner: "tüm çizimlerin kenarlarını iyi temizle"; ölçüm: varliklar/kenar_denetim.py).
Her görsel için (animasyon şeritleri hariç, img/):
  1) pembe saçak: yarı saydam kenar ve sis piksellerinde magenta tonu (min(R,B) - G) griye çekilir (bilerek mor olanlar MOR listesinde: dokunulmaz)
  2) düz kesik: görselin kenarına dayanan dolu pikseller (kesim kutusu sisi/gölgeyi kesmiş) o kenarda 18 px'te yumuşak söner
  3) kırıntı: ana gövdeden kopuk küçük öbekler (< 14 px) ve soluk karalamalar (ortalama alfa < 90, < 400 px, gövdeden uzak) silinir
Özgünler ilk çalıştırmada varliklar/cikti/kenar_once/ altına yedeklenir (yeniden çalıştırınca yedekten başlar: etki birikmez).
    .venv/bin/python3 varliklar/kenar_temizle.py [--dene] [ad ...]   (--dene: yazmaz, yalnız önce/sonra sayfası)"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(H, '..', 'sinir-kalesi', 'img'); BAK = os.path.join(H, 'cikti', 'kenar_once')
MOR = ('tower_altar_', 'enemy_shadowmaster', 'hero_merlin', 'unit_skel_5', 'enemy_severus', 'enemy_hierophant', 'nm30_map_necrogate', 'nm31_', 'nm_bonepool', 'mortimer', 'ico_sp_nm_fear', 'ico_ab_ghost', 'ico_ab_shadow', 'ico_ab_blight', 'tower_mage_ghost', 'nm7_ghost')
FADE = 18
import re
SKIP = re.compile(r'^(nm32_|nm31_|ui_|ico_)|_(flag\d|sw\d|rune|arm|front)$')  # kan damlası, ruh küresi, arayüz, simge ve kule katmanları: sıkı kırpılı, kenara değmeleri doğal
MOR = MOR + ('nm7_shroom', 'nm_shroom', 'nm7_ghost')


def temizle(a, name):
    a = a.astype(np.float32); al = a[..., 3]; rgb = a[..., :3]
    solid = al > 20
    if not name.startswith(MOR):
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; m = np.minimum(r, b) - g
        edge = solid & nd.binary_dilation(~solid, iterations=4)
        fix = (m > 18) & ((al < 245) | edge)
        k = np.where(fix, np.clip((m - 18) / 40, 0, 1) * 0.9, 0)
        rgb[..., 0] -= m * k; rgb[..., 2] -= m * k
        al[fix & (al < 170)] *= 1 - k[fix & (al < 170)] * 0.75  # magenta zeminin karışmasından kalan soluk pembe sis: saydamlaşır (yeşil/mor gerçek sis m < 0, dokunulmaz)
    Hh, Ww = al.shape
    for side in ('l', 'r', 't', 'b'):
        line = {'l': al[:, 0], 'r': al[:, -1], 't': al[0], 'b': al[-1]}[side]
        col = {'l': rgb[:, 0], 'r': rgb[:, -1], 't': rgb[0], 'b': rgb[-1]}[side]
        on = line > 40
        if on.sum() < 0.15 * len(line): continue  # düz kesik: kenar boyunca uzun dolu şerit
        if col[on].mean(1).mean() < 70: continue  # koyu kontur kenara değiyor (sıkı kırpım), kesik değil
        ramp = np.clip(np.arange(FADE) / FADE, 0, 1) ** 1.3
        if side == 'l': al[:, :FADE] *= ramp[None, :]
        if side == 'r': al[:, -FADE:] *= ramp[::-1][None, :]
        if side == 't': al[:FADE] *= ramp[:, None]
        if side == 'b' and name.startswith('nm30_'): al[-FADE:] *= ramp[::-1][:, None]  # zemin tabanı kesik: yalnız harita simgelerinde (dekorun tabanı düz kalsın)
    solid = al > 20; lab, n = nd.label(solid, structure=np.ones((3, 3)))
    if n > 1:
        idx = range(1, n + 1); sz = nd.sum(np.ones_like(al), lab, idx); ma = nd.mean(al, lab, idx); big = int(np.argmax(sz)) + 1
        body = nd.binary_dilation(lab == big, iterations=6)
        drop = [i + 1 for i in range(n) if i + 1 != big and ((sz[i] < 14 and ma[i] < 160) or (ma[i] < 90 and sz[i] < 400 and not (body & (lab == i + 1)).any()))]
        if drop: al[np.isin(lab, drop)] = 0
    a[..., 3] = al
    return a.clip(0, 255).astype(np.uint8)


def main():
    dene = '--dene' in sys.argv; names = [x for x in sys.argv[1:] if not x.startswith('--')]
    anim = set(json.load(open(os.path.join(IMG, 'anim.json'))))
    os.makedirs(BAK, exist_ok=True)
    todo = names or [f[:-5] for f in sorted(os.listdir(IMG)) if f.endswith('.webp') and f[:-5] not in anim and not f.startswith(('atlas_', 'map_', 'ico_'))]  # simgeler temiz kesildi, parıltıları var: dokunulmaz
    sheet = []
    for n in todo:
        if SKIP.search(n): continue
        p = os.path.join(IMG, n + '.webp'); b = os.path.join(BAK, n + '.webp')
        src = b if os.path.exists(b) else p
        a = np.asarray(Image.open(src).convert('RGBA'))
        if a[..., 3].min() > 250: continue
        out = temizle(a, n)
        if np.abs(out.astype(int) - a.astype(int)).max() < 3: continue
        if dene: sheet.append((n, a, out)); continue
        if not os.path.exists(b): shutil.copy(p, b)
        Image.fromarray(out).save(p, 'WEBP', quality=90, method=6); print('temizlendi', n)
    if dene:
        T = 220; rows = []
        for n, a, o in sheet[:40]:
            r = Image.new('RGB', (T * 4, T), (0, 0, 0))
            for j, (im, bg) in enumerate(((a, (235, 235, 225)), (o, (235, 235, 225)), (a, (40, 30, 50)), (o, (40, 30, 50)))):
                x = Image.fromarray(im); k = min((T - 6) / x.width, (T - 6) / x.height); x = x.resize((max(1, int(x.width * k)), max(1, int(x.height * k))), Image.LANCZOS)
                c = Image.new('RGBA', (T, T), bg + (255,)); c.alpha_composite(x, ((T - x.width) // 2, (T - x.height) // 2)); r.paste(c.convert('RGB'), (j * T, 0))
            rows.append(r)
        out = Image.new('RGB', (T * 4, T * len(rows)))
        for i, r in enumerate(rows): out.paste(r, (0, i * T))
        out.save(os.path.join(H, 'cikti', 'kenar_dene.jpg'), quality=85); print(len(sheet), 'değişecek')


if __name__ == '__main__':
    main()

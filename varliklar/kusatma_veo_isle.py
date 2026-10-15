"""Kuşatma araçlarının Veo videoları (15 Eki): magenta zemin, 1280x720; önce iten askerlerle yürüme döngüsü, sonra yıkılma.
Videolarda zemin boyunca uçuşan açık pembe benekler olabiliyor: b - g > 15 ve açık renkli pikseller atılır, küçük kırıntılar silinir.
Her araç: SRC, bayrak tepesi / tekerlek altı (FIG_TOP, GROUND), yürüme döngüsü kareleri ve dar kutu, yıkılma kareleri ve geniş kutu.
Ölçek: iten asker lejyoner boyunda (h 30) olacak şekilde data.js'te h; şerit pikseli TARGET (grup boyu).
  kule:    kule_yuru_yikim_veo.mp4 (grup 401 px → h 89; durağan enemy_siegetower.webp Gemini çizimi kalır)
  kocbasi: kocbasi_yuru_yikim_veo.mp4 (grup 323 px, iten asker ~197 px → h 49; durağan enemy_ram.webp videonun ilk karesinden)
  top:     top_yuru_ates_yikim_veo.mp4 (1024x576; 0-98 iter, 100-118 ateş, 120-200 parçalanır; grup 289 px → h 49; durağan görsel top_veo_isle.py'den kalır)
16 Eki (Caner: "kare kare gibi kasılıyor"): yavaş araçta yürüyüş döngüsü 1,4 sn'ye uzar (walkRate sınırı); tek döngü (14-18 kare) orada
saniyede 10-13 kare oynuyordu. Artık videonun 2-3 döngüsü art arda alınır (≈24 kare/sn). Yıkılma videonun HER karesinden, gerçek hızında (dur = kare / 24; eskiden her 4-5. kare, 8-10 kare/sn);
şerit 16383 px'e sığmazsa satırlara bölünür (anim.json 'cols', game.js drawFrame satır başına kare sayısını okur). 16 Eki (Caner: "ilk patlamadan sonra bekliyor, sonra tekrar patlıyor"): videolardaki ilk küçük darbe ve duraklama atılır, yıkılma asıl (son) parçalanmayla başlar
(kule 132, koçbaşı 134, top 150). 15 Eki (20. bölümde iPhone belleği taştı): çözünürlük ~%20 düştü, kare sayısı aynı. Bellek: ölüm şeridi ~12-17 MB (yalnız o aracın çıktığı bölümde yüklenir).
    .venv/bin/python varliklar/kusatma_veo_isle.py kule kocbasi
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
CFG = {
    'kule': dict(src='kule_yuru_yikim_veo.mp4', name='enemy_siegetower', top=172, ground=573, still=None,
                 walk=(range(13, 47), (390, 150, 890, 592), 200), die=(range(132, 197), (40, 60, 1240, 660), 122, 2.7)),
    'kocbasi': dict(src='kocbasi_yuru_yikim_veo.mp4', name='enemy_ram', top=240, ground=563, still=0,
                    walk=(range(45, 87), (280, 220, 980, 580), 140), die=(range(134, 201), (130, 150, 1180, 660), 100, 2.8)),
    'top': dict(src='top_yuru_ates_yikim_veo.mp4', name='enemy_cannon', top=160, ground=449, still=None, ref=1024,  # ref: koordinatların yazıldığı genişlik
                walk=(range(11, 47), (250, 150, 774, 456), 180), die=(range(150, 201), (0, 70, 1024, 496), 110, 2.1)),
}
def cut(fr, n):
    a = np.array(video_isle.remove_magenta(fr[n])); f = a[..., :3].astype(np.int16)
    pink = (f[..., 2] - f[..., 1] > 15) & (f[..., 1] > 120) & (f[..., 0] > 190)   # uçuşan benekler
    a[..., 3] = np.where(pink, 0, a[..., 3])
    m = a[..., 3] > 40; lab, cnt = nd.label(m)
    if cnt: sz = nd.sum(m, lab, range(1, cnt + 1)); a[..., 3] = np.where(np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 60]), 0, a[..., 3])
    return a
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for key in sys.argv[1:] or list(CFG):
    C = CFG[key]; fr = video_isle.frames_of(os.path.join(H0, 'ham', 'anim', C['src']), 24); S = fr[0].shape[1] / C.get('ref', fr[0].shape[1])
    G, T0 = video_isle.sc(C['ground'], S), video_isle.sc(C['top'], S)
    for suf, spec in (('_walk', C['walk']), ('_die', C['die'])):
        order, (x0, y0, x1, y1), T = list(spec[0]), video_isle.sc(spec[1], S), spec[2]; name = C['name'] + suf
        k = T / (G - T0); FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
        rows = -(-FW * len(order) // 16000); cols = -(-len(order) // rows)
        out = Image.new('RGBA', (FW * cols, FH * rows), (0, 0, 0, 0))
        for i, n in enumerate(order): out.paste(Image.fromarray(cut(fr, n)[y0:y1, x0:x1]).resize((FW, FH), Image.LANCZOS), ((i % cols) * FW, (i // cols) * FH))
        out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
        m = {'n': len(order), 'fw': FW, 'fh': FH, 'base': round((y1 - G) / (y1 - y0), 4), 'ch': round((G - T0) / (y1 - y0), 4)}
        if rows > 1: m['cols'] = cols
        if suf == '_walk': m.update({'idle': 0, 'stride': 1.2})
        else: m['dur'] = spec[3]
        meta[name] = m
        if name + '.webp' not in man: man.append(name + '.webp')
        print(name, m, out.size)
    if C['still'] is not None: # durağan görsel (codex/yedek): ilk kare, gruba sıkı kesilmiş
        x0, y0, x1, y1 = C['walk'][1]; a = cut(fr, C['still'])[y0:y1, x0:x1]; ys, xs = np.nonzero(a[..., 3] > 30); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        st = Image.fromarray(a); st = st.resize((int(st.width * 380 / st.height), 380), Image.LANCZOS); st.save(os.path.join(IMG, C['name'] + '.webp'), 'WEBP', quality=88, method=6)
        mp = os.path.join(IMG, 'meta.json'); mt = json.load(open(mp)); mt[C['name']] = [st.width, st.height]; json.dump(mt, open(mp, 'w'), indent=0)
        print(C['name'], st.size)
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
